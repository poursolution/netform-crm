-- Staging-only candidate. Generate and review staging-apply.sql before execution.
-- Connects only inquiry_assign/direct_assign; branch and response intents remain unavailable.
BEGIN;
SET LOCAL search_path=pg_catalog;
SET LOCAL lock_timeout='3s';
SET LOCAL statement_timeout='60s';
DO $$ BEGIN
 IF current_user<>'postgres' OR current_setting('crm.inquiry_direct_ref',true) IS DISTINCT FROM 'rprechiaglyjaydkmxsu'
 THEN RAISE EXCEPTION 'Staging inquiry direct assignment approval required'; END IF;
END $$;
-- BEFORE_METADATA_GUARD

CREATE TABLE crm_security.inquiry_audit_events(
 event_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 actor_auth_uid uuid NOT NULL,
 actor_user_id uuid NOT NULL,
 inquiry_id uuid NOT NULL,
 action text NOT NULL CHECK(action IN ('direct_assign','direct_reassign')),
 before_data jsonb NOT NULL,
 after_data jsonb NOT NULL,
 reason text,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX inquiry_audit_events_inquiry_changed
 ON crm_security.inquiry_audit_events(inquiry_id,created_at DESC);
ALTER TABLE crm_security.inquiry_audit_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE crm_security.inquiry_audit_events FROM PUBLIC,anon,authenticated,service_role;

ALTER TABLE crm_security.command_receipts DROP CONSTRAINT command_receipts_operation_check;
ALTER TABLE crm_security.command_receipts ADD CONSTRAINT command_receipts_operation_check
 CHECK(operation IN ('opportunity_work_set','inquiry_assign'));

CREATE OR REPLACE FUNCTION public.crm_write_command_v2(p_request_id uuid,p_operation text,p_object_id uuid,p_expected_version integer,p_payload jsonb) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $fn$
DECLARE
 a record; receipt crm_security.command_receipts%ROWTYPE; result jsonb; ack jsonb;
 oldrow public.deals%ROWTYPE; newrow public.deals%ROWTYPE; event uuid; n integer; touched integer;
 old_inquiry public.inquiries%ROWTYPE; new_inquiry public.inquiries%ROWTYPE; target_user record;
 inquiry_event uuid; from_name text; reason_value text; changed_at_value timestamptz; changed boolean;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;
 PERFORM 1 FROM public.users u WHERE u.auth_uid=auth.uid() FOR SHARE;
 PERFORM 1 FROM crm_security.access_review r WHERE r.reviewed_auth_uid=auth.uid() FOR SHARE;
 SELECT * INTO a FROM crm_security.actor();
 IF NOT FOUND THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;
 IF p_request_id IS NULL OR p_object_id IS NULL OR p_expected_version IS NULL OR p_expected_version<0
  OR p_operation NOT IN ('opportunity_work_set','inquiry_assign') OR jsonb_typeof(p_payload) IS DISTINCT FROM 'object'
 THEN RAISE EXCEPTION 'unsupported command' USING ERRCODE='22023'; END IF;

 IF p_operation='opportunity_work_set' THEN
  PERFORM 1 FROM crm_security.object_scope s WHERE s.user_id=a.user_id AND s.deal_id=p_object_id FOR SHARE;
  SELECT * INTO oldrow FROM public.deals d WHERE d.id=p_object_id FOR UPDATE;
  IF NOT FOUND OR NOT crm_security.can_deal(p_object_id,true) THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;
  IF EXISTS(SELECT 1 FROM jsonb_object_keys(p_payload) k WHERE k NOT IN ('primary_work','work_items','reason','work_summary','reason_source','at'))
   OR NOT p_payload ?& ARRAY['primary_work','work_items','reason']
   OR jsonb_typeof(p_payload->'primary_work') IS DISTINCT FROM 'string'
   OR jsonb_typeof(p_payload->'reason') IS DISTINCT FROM 'string'
  THEN RAISE EXCEPTION 'invalid payload; actor is server-owned' USING ERRCODE='22023'; END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(a.auth_uid::text||p_request_id::text,0));
  SELECT * INTO receipt FROM crm_security.command_receipts r WHERE r.actor_auth_uid=a.auth_uid AND r.request_id=p_request_id;
  IF FOUND THEN
   IF receipt.actor_user_id IS DISTINCT FROM a.user_id OR receipt.operation IS DISTINCT FROM p_operation
    OR receipt.object_id IS DISTINCT FROM p_object_id OR receipt.expected_version IS DISTINCT FROM p_expected_version
    OR receipt.payload IS DISTINCT FROM p_payload
   THEN RAISE EXCEPTION 'REQUEST_ID_REUSE' USING ERRCODE='PT409'; END IF;
   RETURN receipt.ack||jsonb_build_object('replayed',true);
  END IF;
  IF NOT (p_payload ? 'work_summary') THEN
   IF p_payload ?| ARRAY['reason_source','at'] THEN RAISE EXCEPTION 'work_summary required' USING ERRCODE='22023'; END IF;
   result:=public.crm_work_set_scoped_v2(p_object_id,p_payload->>'primary_work',p_payload->'work_items',p_payload->>'reason',p_expected_version,NULL);
  ELSE
   IF jsonb_typeof(p_payload->'work_items') IS DISTINCT FROM 'array'
    OR jsonb_typeof(p_payload->'work_summary') IS DISTINCT FROM 'string'
    OR length(trim(p_payload->>'work_summary'))<1 OR length(p_payload->>'work_summary')>2000
    OR length(trim(p_payload->>'reason'))<5 OR length(p_payload->>'reason')>2000
    OR (p_payload ? 'reason_source' AND (jsonb_typeof(p_payload->'reason_source') IS DISTINCT FROM 'string' OR length(p_payload->>'reason_source')>200))
    OR (p_payload ? 'at' AND (jsonb_typeof(p_payload->'at') IS DISTINCT FROM 'string' OR length(p_payload->>'at')>64))
   THEN RAISE EXCEPTION 'invalid work contract' USING ERRCODE='22023'; END IF;
   n:=jsonb_array_length(p_payload->'work_items');
   IF n<1 OR n>30 OR length(trim(p_payload->>'primary_work'))<1 OR length(p_payload->>'primary_work')>100
    OR NOT ((p_payload->'work_items') ? (p_payload->>'primary_work'))
    OR EXISTS(SELECT 1 FROM jsonb_array_elements(p_payload->'work_items') x WHERE jsonb_typeof(x)<>'string')
    OR EXISTS(SELECT 1 FROM jsonb_array_elements_text(p_payload->'work_items') x WHERE length(trim(x))<1 OR length(x)>100)
    OR (SELECT count(DISTINCT x) FROM jsonb_array_elements_text(p_payload->'work_items') x)<>n
   THEN RAISE EXCEPTION 'invalid work items' USING ERRCODE='22023'; END IF;
   IF oldrow.version IS DISTINCT FROM p_expected_version THEN RAISE EXCEPTION 'version conflict' USING ERRCODE='PT409'; END IF;
   IF EXISTS(SELECT 1 FROM public.audit_logs WHERE write_id=p_request_id::text)
   THEN RAISE EXCEPTION 'audit correlation collision' USING ERRCODE='PT409'; END IF;
   result:=public.crm_opportunity_work_set(p_payload||jsonb_build_object(
    'opportunity_id',p_object_id,'write_id',p_request_id,'actor_name',a.display_name));
   IF result->>'ok' IS DISTINCT FROM 'true' OR result->>'opportunity_id' IS DISTINCT FROM p_object_id::text
   THEN RAISE EXCEPTION 'work persistence ACK mismatch'; END IF;
   UPDATE public.audit_logs SET actor_id=a.user_id
    WHERE write_id=p_request_id::text AND entity_id=p_object_id AND action='opportunity_work_set';
   GET DIAGNOSTICS touched=ROW_COUNT;
   IF touched<>1 THEN RAISE EXCEPTION 'work audit correlation mismatch'; END IF;
   UPDATE public.deals SET version=version+1 WHERE id=p_object_id AND version=p_expected_version RETURNING * INTO newrow;
   IF NOT FOUND THEN RAISE EXCEPTION 'unexpected version mutation' USING ERRCODE='PT409'; END IF;
   INSERT INTO crm_security.audit_events(actor_auth_uid,actor_user_id,actor_name,deal_id,action,before_data,after_data,reason)
   VALUES(a.auth_uid,a.user_id,a.display_name,p_object_id,'work_set',
    jsonb_build_object('primary_work',oldrow.primary_work,'work_items',oldrow.work_items,'work_scope_type',oldrow.work_scope_type,'work_summary',oldrow.work_summary,'version',oldrow.version,'updated_at',oldrow.updated_at),
    jsonb_build_object('primary_work',newrow.primary_work,'work_items',newrow.work_items,'work_scope_type',newrow.work_scope_type,'work_summary',newrow.work_summary,'version',newrow.version,'updated_at',newrow.updated_at),p_payload->>'reason')
   RETURNING event_id INTO event;
   result:=result||jsonb_build_object('id',newrow.id,'version',newrow.version,'audit_event_id',event);
  END IF;
  ack:=jsonb_build_object('contract_version',1,'ok',true,'operation',p_operation,'request_id',p_request_id,
   'actor_auth_uid',a.auth_uid,'actor_user_id',a.user_id,'object_id',result->'id',
   'previous_version',p_expected_version,'version',result->'version','audit_event_id',result->'audit_event_id','replayed',false);
  IF p_payload ? 'work_summary' THEN
   ack:=ack||jsonb_build_object('work_contract','legacy_work_v1','work',result - ARRAY['ok','id','version','audit_event_id']);
  END IF;

 ELSE
  IF p_expected_version<>0
   OR EXISTS(SELECT 1 FROM jsonb_object_keys(p_payload) k WHERE k NOT IN ('intent','to_name','reason'))
   OR p_payload->>'intent' IS DISTINCT FROM 'direct_assign'
   OR jsonb_typeof(p_payload->'to_name') IS DISTINCT FROM 'string'
   OR length(trim(p_payload->>'to_name'))<1 OR length(p_payload->>'to_name')>100
   OR (p_payload ? 'reason' AND (jsonb_typeof(p_payload->'reason') IS DISTINCT FROM 'string' OR length(trim(p_payload->>'reason'))<1 OR length(p_payload->>'reason')>2000))
  THEN RAISE EXCEPTION 'invalid direct assignment payload' USING ERRCODE='22023'; END IF;
  PERFORM 1 FROM crm_security.object_scope s WHERE s.user_id=a.user_id AND s.inquiry_id=p_object_id FOR SHARE;
  SELECT * INTO old_inquiry FROM public.inquiries i WHERE i.id=p_object_id FOR UPDATE;
  IF NOT FOUND OR a.permission_role<>'admin' OR NOT crm_security.can_inquiry(p_object_id)
  THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;
  SELECT u.user_id,u.name INTO target_user
   FROM public.users u JOIN crm_security.access_review r ON r.user_id=u.user_id
   WHERE u.name=trim(p_payload->>'to_name') AND u.active AND u.auth_uid IS NOT NULL
    AND r.reviewed_auth_uid=u.auth_uid AND r.source_role=u.role AND r.permission_role='rep'
    AND r.approved AND r.expires_at>now()
   FOR SHARE OF u,r;
  IF NOT FOUND THEN RAISE EXCEPTION 'invalid direct assignment target' USING ERRCODE='22023'; END IF;
  reason_value:=nullif(trim(p_payload->>'reason'),'');
  changed:=old_inquiry.assigned_to IS DISTINCT FROM target_user.user_id;
  IF old_inquiry.assigned_to IS NOT NULL AND changed AND reason_value IS NULL
  THEN RAISE EXCEPTION 'reassignment reason is required' USING ERRCODE='22023'; END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(a.auth_uid::text||p_request_id::text,0));
  SELECT * INTO receipt FROM crm_security.command_receipts r WHERE r.actor_auth_uid=a.auth_uid AND r.request_id=p_request_id;
  IF FOUND THEN
   IF receipt.actor_user_id IS DISTINCT FROM a.user_id OR receipt.operation IS DISTINCT FROM p_operation
    OR receipt.object_id IS DISTINCT FROM p_object_id OR receipt.expected_version IS DISTINCT FROM p_expected_version
    OR receipt.payload IS DISTINCT FROM p_payload
   THEN RAISE EXCEPTION 'REQUEST_ID_REUSE' USING ERRCODE='PT409'; END IF;
   RETURN receipt.ack||jsonb_build_object('replayed',true);
  END IF;
  IF changed THEN
   changed_at_value:=clock_timestamp();
   SELECT u.name INTO from_name FROM public.users u WHERE u.user_id=old_inquiry.assigned_to;
   from_name:=coalesce(from_name,'미배정');
   UPDATE public.inquiries i SET assigned_to=target_user.user_id,assigned_at=changed_at_value,
    status=CASE WHEN old_inquiry.assigned_to IS NULL AND
      (old_inquiry.status IS NULL OR old_inquiry.status IN ('접수','신규') OR old_inquiry.status LIKE '%영업배정 필요%')
     THEN '배정완료' ELSE old_inquiry.status END
    WHERE i.id=p_object_id RETURNING * INTO new_inquiry;
   INSERT INTO public.assignment_history(inquiry_id,from_owner,to_owner,reason,actor_name,changed_at)
    VALUES(p_object_id,from_name,target_user.name,reason_value,a.display_name,changed_at_value);
   INSERT INTO crm_security.inquiry_audit_events(actor_auth_uid,actor_user_id,inquiry_id,action,before_data,after_data,reason,created_at)
    VALUES(a.auth_uid,a.user_id,p_object_id,
     CASE WHEN old_inquiry.assigned_to IS NULL THEN 'direct_assign' ELSE 'direct_reassign' END,
     jsonb_build_object('assigned_to',old_inquiry.assigned_to,'assigned_at',old_inquiry.assigned_at,'status',old_inquiry.status),
     jsonb_build_object('assigned_to',new_inquiry.assigned_to,'assigned_at',new_inquiry.assigned_at,'status',new_inquiry.status),
     reason_value,changed_at_value) RETURNING event_id INTO inquiry_event;
  ELSE
   new_inquiry:=old_inquiry;
  END IF;
  ack:=jsonb_build_object('contract_version',1,'ok',true,'operation',p_operation,'request_id',p_request_id,
   'actor_auth_uid',a.auth_uid,'actor_user_id',a.user_id,'object_id',p_object_id,
   'intent','direct_assign','assigned_to',target_user.user_id,'assigned_to_name',target_user.name,
   'status',coalesce(new_inquiry.status,''),'changed',changed,'inquiry_audit_event_id',inquiry_event,'replayed',false);
 END IF;
 INSERT INTO crm_security.command_receipts(actor_auth_uid,request_id,actor_user_id,operation,object_id,expected_version,payload,ack)
 VALUES(a.auth_uid,p_request_id,a.user_id,p_operation,p_object_id,p_expected_version,p_payload,ack);
 RETURN ack;
END $fn$;

REVOKE EXECUTE ON FUNCTION public.crm_write_command_v2(uuid,text,uuid,integer,jsonb) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.crm_write_command_v2(uuid,text,uuid,integer,jsonb) TO authenticated;
DO $$ DECLARE p record; BEGIN
 SELECT * INTO p FROM pg_proc WHERE oid='public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)'::regprocedure;
 IF pg_get_userbyid(p.proowner)<>'postgres' OR NOT p.prosecdef OR p.proconfig IS DISTINCT FROM ARRAY['search_path=""']
  OR has_function_privilege('anon',p.oid,'EXECUTE') OR has_function_privilege('service_role',p.oid,'EXECUTE')
  OR NOT has_function_privilege('authenticated',p.oid,'EXECUTE')
  OR EXISTS(SELECT 1 FROM aclexplode(p.proacl) x WHERE x.grantee=0)
  OR has_table_privilege('anon','crm_security.inquiry_audit_events','SELECT')
  OR has_table_privilege('authenticated','crm_security.inquiry_audit_events','SELECT')
 THEN RAISE EXCEPTION 'inquiry direct assignment ACL/config drift'; END IF;
END $$;
-- AFTER_METADATA_GUARD
COMMIT;
