-- Staging only. Execute the generated staging-apply.sql, never this file by itself.
-- Reuses the observed legacy work persistence contract; does not change its ACL.
BEGIN;
SET LOCAL search_path=pg_catalog;
SET LOCAL lock_timeout='3s';
SET LOCAL statement_timeout='60s';
DO $$ BEGIN
 IF current_user<>'postgres' OR current_setting('crm.work_compat_ref',true) IS DISTINCT FROM 'rprechiaglyjaydkmxsu'
 THEN RAISE EXCEPTION 'Staging work compatibility approval required'; END IF;
END $$;
-- BEFORE_METADATA_GUARD
CREATE OR REPLACE FUNCTION public.crm_write_command_v2(p_request_id uuid,p_operation text,p_object_id uuid,p_expected_version integer,p_payload jsonb) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $fn$
DECLARE a record; receipt crm_security.command_receipts%ROWTYPE; result jsonb; ack jsonb;
 oldrow public.deals%ROWTYPE; newrow public.deals%ROWTYPE; event uuid; n integer; touched integer;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;
 PERFORM 1 FROM public.users u WHERE u.auth_uid=auth.uid() FOR SHARE;
 PERFORM 1 FROM crm_security.access_review r WHERE r.reviewed_auth_uid=auth.uid() FOR SHARE;
 SELECT * INTO a FROM crm_security.actor();
 IF NOT FOUND THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;
 PERFORM 1 FROM crm_security.object_scope s WHERE s.user_id=a.user_id AND s.deal_id=p_object_id FOR SHARE;
 SELECT * INTO oldrow FROM public.deals d WHERE d.id=p_object_id FOR UPDATE;
 IF NOT FOUND OR NOT crm_security.can_deal(p_object_id,true) THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;
 IF p_request_id IS NULL OR p_object_id IS NULL OR p_expected_version IS NULL OR p_expected_version<0
 OR p_operation IS DISTINCT FROM 'opportunity_work_set' OR jsonb_typeof(p_payload) IS DISTINCT FROM 'object'
 THEN RAISE EXCEPTION 'unsupported command' USING ERRCODE='22023'; END IF;
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
  -- Preserve the already-deployed three-field contract and its historical receipts.
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
  -- Only this fixed function is called; never dynamic SQL or client-supplied RPC names.
  -- Full baseline definition/ACL/trigger dependencies are checked by the apply wrapper.
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
 THEN RAISE EXCEPTION 'work dispatcher ACL/config drift'; END IF;
END $$;
-- AFTER_METADATA_GUARD
COMMIT;
