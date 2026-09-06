-- Staging-only candidate. Generate and review staging-apply.sql before execution.
-- Adds only service_change. The frozen work/direct-assignment implementation is moved,
-- not rewritten, and remains the delegate for its two operations.
BEGIN;
SET LOCAL search_path=pg_catalog;
SET LOCAL lock_timeout='3s';
SET LOCAL statement_timeout='60s';
DO $$ BEGIN
 IF current_user<>'postgres'
  OR current_setting('crm.pipeline_service_ref',true) IS DISTINCT FROM 'rprechiaglyjaydkmxsu'
  OR to_regprocedure('crm_security.crm_write_command_v2_frozen_20260906(uuid,text,uuid,integer,jsonb)') IS NOT NULL
 THEN RAISE EXCEPTION 'Staging pipeline service-change approval required'; END IF;
END $$;
-- BEFORE_METADATA_GUARD

ALTER TABLE crm_security.command_receipts
 DROP CONSTRAINT command_receipts_operation_check;
ALTER TABLE crm_security.command_receipts
 ADD CONSTRAINT command_receipts_operation_check
 CHECK(operation IN ('opportunity_work_set','inquiry_assign','service_change'));

-- Keep the already Staging-verified body at the same OID. It is private and is the
-- only path used for the two frozen operations.
ALTER FUNCTION public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)
 SET SCHEMA crm_security;
ALTER FUNCTION crm_security.crm_write_command_v2(uuid,text,uuid,integer,jsonb)
 RENAME TO crm_write_command_v2_frozen_20260906;
REVOKE EXECUTE ON FUNCTION crm_security.crm_write_command_v2_frozen_20260906(uuid,text,uuid,integer,jsonb)
 FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION public.crm_write_command_v2(
 p_request_id uuid,
 p_operation text,
 p_object_id uuid,
 p_expected_version integer,
 p_payload jsonb
) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $fn$
DECLARE
 a record;
 receipt crm_security.command_receipts%ROWTYPE;
 oldrow public.deals%ROWTYPE;
 newrow public.deals%ROWTYPE;
 ack jsonb;
 event uuid;
 activity_id_value uuid;
 next_action_id_value uuid;
 history_id_value bigint;
 changed_at_value timestamptz;
 from_value text;
 to_value text;
 reason_value text;
 source_value text;
 next_value text;
 next_due_value date;
 actor_email_value text;
 history_entry jsonb;
BEGIN
 IF p_operation IS DISTINCT FROM 'service_change' THEN
  RETURN crm_security.crm_write_command_v2_frozen_20260906(
   p_request_id,p_operation,p_object_id,p_expected_version,p_payload);
 END IF;

 IF auth.uid() IS NULL THEN
  RAISE EXCEPTION 'forbidden' USING ERRCODE='42501';
 END IF;
 PERFORM 1 FROM public.users u WHERE u.auth_uid=auth.uid() FOR SHARE;
 PERFORM 1 FROM crm_security.access_review r
  WHERE r.reviewed_auth_uid=auth.uid() FOR SHARE;
 SELECT * INTO a FROM crm_security.actor();
 IF NOT FOUND THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;

 IF p_request_id IS NULL OR p_object_id IS NULL OR p_expected_version IS NULL
  OR p_expected_version<0 OR jsonb_typeof(p_payload) IS DISTINCT FROM 'object'
  OR EXISTS(SELECT 1 FROM jsonb_object_keys(p_payload) k
   WHERE k NOT IN ('from_service','to_service','origin_channel','reason',
                   'reason_source','next_action','next_due','at'))
  OR NOT p_payload ?& ARRAY['to_service','reason']
  OR jsonb_typeof(p_payload->'to_service') IS DISTINCT FROM 'string'
  OR length(trim(p_payload->>'to_service'))<1
  OR length(p_payload->>'to_service')>100
  OR jsonb_typeof(p_payload->'reason') IS DISTINCT FROM 'string'
  OR length(trim(p_payload->>'reason'))<5
  OR length(p_payload->>'reason')>2000
  OR (p_payload ? 'from_service' AND jsonb_typeof(p_payload->'from_service') NOT IN ('string','null'))
  OR (p_payload ? 'from_service' AND jsonb_typeof(p_payload->'from_service')='string'
      AND length(p_payload->>'from_service')>100)
  OR (p_payload ? 'origin_channel' AND jsonb_typeof(p_payload->'origin_channel') NOT IN ('string','null'))
  OR (p_payload ? 'origin_channel' AND jsonb_typeof(p_payload->'origin_channel')='string'
      AND length(p_payload->>'origin_channel')>100)
  OR (p_payload ? 'reason_source' AND jsonb_typeof(p_payload->'reason_source') NOT IN ('string','null'))
  OR (p_payload ? 'reason_source' AND jsonb_typeof(p_payload->'reason_source')='string'
      AND length(p_payload->>'reason_source')>200)
  OR (p_payload ? 'next_action' AND jsonb_typeof(p_payload->'next_action') NOT IN ('string','null'))
  OR (p_payload ? 'next_action' AND jsonb_typeof(p_payload->'next_action')='string'
      AND length(p_payload->>'next_action')>500)
  OR (p_payload ? 'next_due' AND jsonb_typeof(p_payload->'next_due') NOT IN ('string','null'))
  OR (p_payload ? 'next_due' AND jsonb_typeof(p_payload->'next_due')='string'
      AND p_payload->>'next_due' !~ '^\d{4}-\d{2}-\d{2}$')
  OR (p_payload ? 'at' AND jsonb_typeof(p_payload->'at') NOT IN ('string','null'))
  OR (p_payload ? 'at' AND jsonb_typeof(p_payload->'at')='string'
      AND length(p_payload->>'at')>64)
 THEN RAISE EXCEPTION 'invalid service change payload; actor/time/from are server-owned'
  USING ERRCODE='22023';
 END IF;

 to_value:=trim(p_payload->>'to_service');
 reason_value:=trim(p_payload->>'reason');
 source_value:=coalesce(nullif(trim(p_payload->>'reason_source'),''),'text');
 next_value:=nullif(trim(p_payload->>'next_action'),'');
 IF p_payload->>'next_due' IS NOT NULL THEN
  BEGIN
   next_due_value:=(p_payload->>'next_due')::date;
  EXCEPTION WHEN datetime_field_overflow OR invalid_datetime_format THEN
   RAISE EXCEPTION 'invalid service change payload' USING ERRCODE='22023';
  END;
 END IF;
 IF next_value IS NULL AND next_due_value IS NOT NULL THEN
  RAISE EXCEPTION 'next_due requires next_action' USING ERRCODE='22023';
 END IF;

 PERFORM 1 FROM crm_security.object_scope s
  WHERE s.user_id=a.user_id AND s.deal_id=p_object_id FOR SHARE;
 SELECT * INTO oldrow FROM public.deals d WHERE d.id=p_object_id FOR UPDATE;
 IF NOT FOUND OR a.permission_role NOT IN ('rep','branch','admin')
  OR NOT crm_security.can_deal(p_object_id,true)
 THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;

 PERFORM pg_catalog.pg_advisory_xact_lock(
  pg_catalog.hashtextextended(a.auth_uid::text||p_request_id::text,0));
 SELECT * INTO receipt FROM crm_security.command_receipts r
  WHERE r.actor_auth_uid=a.auth_uid AND r.request_id=p_request_id;
 IF FOUND THEN
  IF receipt.actor_user_id IS DISTINCT FROM a.user_id
   OR receipt.operation IS DISTINCT FROM p_operation
   OR receipt.object_id IS DISTINCT FROM p_object_id
   OR receipt.expected_version IS DISTINCT FROM p_expected_version
   OR receipt.payload IS DISTINCT FROM p_payload
  THEN RAISE EXCEPTION 'REQUEST_ID_REUSE' USING ERRCODE='PT409'; END IF;
  RETURN receipt.ack||jsonb_build_object('replayed',true);
 END IF;
 IF oldrow.version IS DISTINCT FROM p_expected_version THEN
  RAISE EXCEPTION 'version conflict' USING ERRCODE='PT409';
 END IF;

 SELECT u.email INTO actor_email_value FROM public.users u
  WHERE u.user_id=a.user_id FOR SHARE;
 from_value:=coalesce(oldrow.current_business,oldrow.brand);
 changed_at_value:=clock_timestamp();
 history_entry:=jsonb_build_object(
  'at',changed_at_value,'from',from_value,'to',to_value,
  'reason',reason_value,'source',source_value,'actor',a.display_name);

 UPDATE public.deals d SET
  current_business=to_value,
  brand=to_value,
  origin_business=coalesce(oldrow.origin_business,from_value),
  service_type=to_value,
  business_history=coalesce(oldrow.business_history,'[]'::jsonb)||history_entry,
  last_activity_at=changed_at_value,
  updated_at=changed_at_value,
  version=oldrow.version+1
 WHERE d.id=p_object_id AND d.version=p_expected_version
 RETURNING * INTO newrow;
 IF NOT FOUND THEN
  RAISE EXCEPTION 'unexpected version mutation' USING ERRCODE='PT409';
 END IF;

 INSERT INTO public.business_history(
  deal_id,from_business,to_business,reason,reason_source,actor_name,changed_at)
 VALUES(p_object_id,from_value,to_value,reason_value,source_value,a.display_name,changed_at_value)
 RETURNING id INTO history_id_value;

 INSERT INTO public.activities(
  deal_id,organization_id,actor_email,actor_name,type,detail,occurred_at)
 VALUES(p_object_id,oldrow.organization_id,actor_email_value,a.display_name,
  '사업유형전환',jsonb_build_object(
   'note',coalesce(from_value,'')||' → '||to_value,
   'result',reason_value,
   'meaningful_contact',false,
   'reason_source',source_value),changed_at_value)
 RETURNING id INTO activity_id_value;

 -- Preserve the deployed apply_business_change rule exactly: an optional action is
 -- appended as open/기타, defaults to current_date+3 at +09:00, and does not cancel
 -- prior open rows or rewrite deals.next_action/deals.next_action_date.
 IF next_value IS NOT NULL THEN
  INSERT INTO public.next_actions(
   deal_id,action_type,title,due_at,assignee_name,status)
  VALUES(p_object_id,'기타',next_value,
   coalesce(next_due_value,current_date+3)::timestamptz+interval '9 hours',
   coalesce(a.display_name,'미지정'),'open')
  RETURNING id INTO next_action_id_value;
 END IF;

 INSERT INTO crm_security.audit_events(
  actor_auth_uid,actor_user_id,actor_name,deal_id,action,
  before_data,after_data,reason,created_at)
 VALUES(a.auth_uid,a.user_id,a.display_name,p_object_id,'service_change',
  jsonb_build_object(
   'current_business',oldrow.current_business,'brand',oldrow.brand,
   'origin_business',oldrow.origin_business,'service_type',oldrow.service_type,
   'business_history',oldrow.business_history,'version',oldrow.version),
  jsonb_build_object(
   'current_business',newrow.current_business,'brand',newrow.brand,
   'origin_business',newrow.origin_business,'service_type',newrow.service_type,
   'business_history',newrow.business_history,'version',newrow.version,
   'business_history_id',history_id_value,'activity_id',activity_id_value,
   'next_action_id',next_action_id_value),reason_value,changed_at_value)
 RETURNING event_id INTO event;

 ack:=jsonb_build_object(
  'contract_version',1,'ok',true,'operation','service_change',
  'request_id',p_request_id,'actor_auth_uid',a.auth_uid,
  'actor_user_id',a.user_id,'object_id',p_object_id,
  'previous_version',p_expected_version,'version',newrow.version,
  'from_service',from_value,'to_service',to_value,
  'business_history_id',history_id_value,'activity_id',activity_id_value,
  'next_action_id',next_action_id_value,'audit_event_id',event,
  'replayed',false);
 INSERT INTO crm_security.command_receipts(
  actor_auth_uid,request_id,actor_user_id,operation,object_id,
  expected_version,payload,ack)
 VALUES(a.auth_uid,p_request_id,a.user_id,p_operation,p_object_id,
  p_expected_version,p_payload,ack);
 RETURN ack;
END $fn$;

REVOKE EXECUTE ON FUNCTION public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)
 FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)
 TO authenticated;
DO $$ DECLARE p record; frozen record; BEGIN
 SELECT * INTO p FROM pg_proc
  WHERE oid='public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)'::regprocedure;
 SELECT * INTO frozen FROM pg_proc
  WHERE oid='crm_security.crm_write_command_v2_frozen_20260906(uuid,text,uuid,integer,jsonb)'::regprocedure;
 IF pg_get_userbyid(p.proowner)<>'postgres' OR NOT p.prosecdef
  OR p.proconfig IS DISTINCT FROM ARRAY['search_path=""']
  OR has_function_privilege('anon',p.oid,'EXECUTE')
  OR has_function_privilege('service_role',p.oid,'EXECUTE')
  OR NOT has_function_privilege('authenticated',p.oid,'EXECUTE')
  OR EXISTS(SELECT 1 FROM aclexplode(p.proacl) x WHERE x.grantee=0)
  OR frozen.oid IS NULL OR pg_get_userbyid(frozen.proowner)<>'postgres'
  OR NOT frozen.prosecdef OR frozen.proconfig IS DISTINCT FROM ARRAY['search_path=""']
  OR has_function_privilege('anon',frozen.oid,'EXECUTE')
  OR has_function_privilege('authenticated',frozen.oid,'EXECUTE')
  OR has_function_privilege('service_role',frozen.oid,'EXECUTE')
  OR EXISTS(SELECT 1 FROM aclexplode(frozen.proacl) x WHERE x.grantee=0)
 THEN RAISE EXCEPTION 'pipeline service-change ACL/config drift'; END IF;
END $$;
-- AFTER_METADATA_GUARD
COMMIT;

