-- LOCAL REVIEW CANDIDATE ONLY. Staging approval is required.
BEGIN;
-- LOCAL CANDIDATE ONLY. Adds the three reachable mobile response outcomes carried by inquiry_assign.
SET LOCAL crm.inquiry_response_ref='rprechiaglyjaydkmxsu';
SET LOCAL search_path=pg_catalog;
SET LOCAL lock_timeout='3s';
SET LOCAL statement_timeout='60s';

DO $guard$ BEGIN
 IF current_user<>'postgres'
  OR current_setting('crm.inquiry_response_ref',true) IS DISTINCT FROM 'rprechiaglyjaydkmxsu'
  OR to_regprocedure('public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)') IS NULL
  OR to_regprocedure('crm_security.crm_opportunity_create_command_v1(uuid,uuid,jsonb)') IS NULL
  OR to_regprocedure('crm_security.crm_operational_source_fragment_v1(text,uuid,integer)') IS NULL
  OR to_regprocedure('crm_security.crm_write_command_v2_opportunity_create_20260906(uuid,text,uuid,integer,jsonb)') IS NOT NULL
  OR to_regprocedure('crm_security.crm_operational_source_fragment_pre_inquiry_response_20260906(text,uuid,integer)') IS NOT NULL
  OR to_regprocedure('crm_security.crm_inquiry_response_command_v1(uuid,uuid,jsonb)') IS NOT NULL
  OR (SELECT pg_get_constraintdef(oid,true) FROM pg_constraint
      WHERE conrelid='crm_security.command_receipts'::regclass
       AND conname='command_receipts_operation_check') IS DISTINCT FROM $expected$CHECK (operation = ANY (ARRAY['opportunity_work_set'::text, 'inquiry_assign'::text, 'service_change'::text, 'inquiry_unassign'::text, 'favorite_set'::text, 'opportunity_touch'::text, 'next_action'::text, 'activity'::text, 'quote_version'::text, 'next_action_complete'::text, 'stage_check'::text, 'transition'::text, 'close'::text, 'amount'::text, 'waiting_context'::text, 'inquiry_reclassify'::text, 'inquiry_status'::text, 'inquiry_trash'::text, 'inquiry_restore'::text, 'inquiry_purge'::text, 'inquiry_followup'::text, 'opportunity_create'::text]))$expected$
  OR (SELECT pg_get_constraintdef(oid,true) FROM pg_constraint
      WHERE conrelid='crm_security.inquiry_audit_events'::regclass
       AND conname='inquiry_audit_events_action_check') IS DISTINCT FROM $expected$CHECK (action = ANY (ARRAY['direct_assign'::text, 'direct_reassign'::text, 'inquiry_unassign'::text, 'inquiry_reclassify'::text, 'inquiry_hold'::text, 'inquiry_trash'::text, 'inquiry_restore'::text, 'inquiry_purge'::text, 'inquiry_followup'::text]))$expected$
 THEN RAISE EXCEPTION 'inquiry response prerequisite drift'; END IF;
END $guard$;

LOCK TABLE crm_security.command_receipts,crm_security.inquiry_audit_events IN ACCESS EXCLUSIVE MODE;
ALTER FUNCTION public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)
 RENAME TO crm_write_command_v2_opportunity_create_20260906;
ALTER FUNCTION public.crm_write_command_v2_opportunity_create_20260906(uuid,text,uuid,integer,jsonb)
 SET SCHEMA crm_security;
REVOKE EXECUTE ON FUNCTION crm_security.crm_write_command_v2_opportunity_create_20260906(uuid,text,uuid,integer,jsonb)
 FROM PUBLIC,anon,authenticated,service_role;
ALTER FUNCTION crm_security.crm_operational_source_fragment_v1(text,uuid,integer)
 RENAME TO crm_operational_source_fragment_pre_inquiry_response_20260906;
REVOKE EXECUTE ON FUNCTION crm_security.crm_operational_source_fragment_pre_inquiry_response_20260906(text,uuid,integer)
 FROM PUBLIC,anon,authenticated,service_role;

ALTER TABLE crm_security.inquiry_audit_events DROP CONSTRAINT inquiry_audit_events_action_check;
ALTER TABLE crm_security.inquiry_audit_events ADD CONSTRAINT inquiry_audit_events_action_check
 CHECK(action IN ('direct_assign','direct_reassign','inquiry_unassign','inquiry_reclassify','inquiry_hold','inquiry_trash','inquiry_restore','inquiry_purge','inquiry_followup','inquiry_response_progress','inquiry_response_next_week_retry','inquiry_response_missed_retry'));

CREATE FUNCTION crm_security.crm_inquiry_response_command_v1(
 p_request_id uuid,p_inquiry_id uuid,p_payload jsonb
) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $fn$
DECLARE
 a record; receipt crm_security.command_receipts%ROWTYPE;
 oldrow public.inquiries%ROWTYPE; newrow public.inquiries%ROWTYPE;
 canonical jsonb; ack jsonb; response_event uuid; server_at timestamptz:=clock_timestamp();
 latest_management text; intent_value text; response_value text; status_value text;
 due_value date; today_kst date; audit_action text;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;
 PERFORM 1 FROM public.users u WHERE u.auth_uid=auth.uid() FOR SHARE;
 PERFORM 1 FROM crm_security.access_review r WHERE r.reviewed_auth_uid=auth.uid() FOR SHARE;
 SELECT * INTO a FROM crm_security.actor();
 IF NOT FOUND THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;
 IF p_request_id IS NULL OR p_inquiry_id IS NULL OR jsonb_typeof(p_payload) IS DISTINCT FROM 'object'
  OR EXISTS(SELECT 1 FROM jsonb_object_keys(p_payload) k WHERE k NOT IN ('intent','response'))
 THEN RAISE EXCEPTION 'invalid inquiry response payload' USING ERRCODE='22023'; END IF;
 intent_value:=p_payload->>'intent'; response_value:=p_payload->>'response';
 IF (intent_value,response_value) NOT IN (
  ('response_progress','진행됨 — 다음 잡음'),
  ('response_next_week_retry','다음주 다시'),
  ('response_missed_retry','못 받으심 (내일 재시도)')
 ) THEN RAISE EXCEPTION 'invalid inquiry response payload' USING ERRCODE='22023'; END IF;
 canonical:=jsonb_build_object('intent',intent_value,'response',response_value);
 today_kst:=(server_at AT TIME ZONE 'Asia/Seoul')::date;
 IF intent_value='response_progress' THEN
  status_value:='전화응대 완료'; audit_action:='inquiry_response_progress'; due_value:=NULL;
 ELSIF intent_value='response_next_week_retry' THEN
  status_value:='응대중'; audit_action:='inquiry_response_next_week_retry'; due_value:=today_kst+7;
 ELSE
  status_value:='배정완료'; audit_action:='inquiry_response_missed_retry'; due_value:=today_kst+1;
 END IF;

 PERFORM 1 FROM crm_security.object_scope s WHERE s.user_id=a.user_id AND s.inquiry_id=p_inquiry_id FOR SHARE;
 SELECT * INTO oldrow FROM public.inquiries i WHERE i.id=p_inquiry_id FOR UPDATE;
 IF NOT FOUND OR NOT crm_security.can_inquiry(p_inquiry_id)
  OR a.permission_role NOT IN ('rep','consultation') OR oldrow.assigned_to IS DISTINCT FROM a.user_id
 THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;
 SELECT e.action INTO latest_management FROM crm_security.inquiry_audit_events e
  WHERE e.inquiry_id=p_inquiry_id AND e.action IN ('inquiry_trash','inquiry_restore','inquiry_purge')
  ORDER BY e.created_at DESC,e.event_id DESC LIMIT 1;
 IF latest_management IN ('inquiry_trash','inquiry_purge')
  OR coalesce(oldrow.status,'') IN ('수주','실주','배드핏','연락두절','종결','종료')
 THEN RAISE EXCEPTION 'inquiry response state conflict' USING ERRCODE='PT409'; END IF;

 PERFORM pg_advisory_xact_lock(hashtextextended(a.auth_uid::text||p_request_id::text,0));
 SELECT * INTO receipt FROM crm_security.command_receipts r
  WHERE r.actor_auth_uid=a.auth_uid AND r.request_id=p_request_id;
 IF FOUND THEN
  IF receipt.actor_user_id IS DISTINCT FROM a.user_id OR receipt.operation IS DISTINCT FROM 'inquiry_assign'
   OR receipt.object_id IS DISTINCT FROM p_inquiry_id OR receipt.expected_version IS DISTINCT FROM 0
   OR receipt.payload IS DISTINCT FROM canonical
  THEN RAISE EXCEPTION 'REQUEST_ID_REUSE' USING ERRCODE='PT409'; END IF;
  RETURN receipt.ack||jsonb_build_object('replayed',true);
 END IF;

 UPDATE public.inquiries i SET
  first_response_at=CASE WHEN intent_value='response_missed_retry' THEN i.first_response_at ELSE coalesce(i.first_response_at,server_at) END,
  responded_at=CASE WHEN intent_value='response_missed_retry' THEN i.responded_at ELSE server_at END,
  next_action_date=CASE WHEN due_value IS NULL THEN i.next_action_date ELSE due_value END,
  status=status_value,updated_at=server_at
 WHERE i.id=p_inquiry_id RETURNING * INTO newrow;
 INSERT INTO crm_security.inquiry_audit_events(
  actor_auth_uid,actor_user_id,inquiry_id,action,before_data,after_data,reason,created_at)
 VALUES(a.auth_uid,a.user_id,p_inquiry_id,audit_action,
  jsonb_build_object('status',oldrow.status,'first_response_at',oldrow.first_response_at,'responded_at',oldrow.responded_at,'next_action_date',oldrow.next_action_date),
  jsonb_build_object('status',newrow.status,'first_response_at',newrow.first_response_at,
   'responded_at',newrow.responded_at,'next_action_date',newrow.next_action_date,'actor',a.display_name),
  response_value,server_at) RETURNING event_id INTO response_event;
 ack:=jsonb_build_object('contract_version',1,'ok',true,'request_id',p_request_id,
  'operation','inquiry_assign','object_id',p_inquiry_id,'intent',intent_value,
  'response',response_value,'status',newrow.status,
  'first_response_at',newrow.first_response_at,'responded_at',newrow.responded_at,
  'next_action_date',newrow.next_action_date,
  'updated_at',newrow.updated_at,
  'actor_auth_uid',a.auth_uid,'actor_user_id',a.user_id,
  'inquiry_audit_event_id',response_event,'changed',true,'replayed',false);
 INSERT INTO crm_security.command_receipts(
  actor_auth_uid,request_id,actor_user_id,operation,object_id,expected_version,payload,ack,created_at)
 VALUES(a.auth_uid,p_request_id,a.user_id,'inquiry_assign',p_inquiry_id,0,canonical,ack,server_at);
 RETURN ack;
END $fn$;
REVOKE EXECUTE ON FUNCTION crm_security.crm_inquiry_response_command_v1(uuid,uuid,jsonb)
 FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION crm_security.crm_operational_source_fragment_v1(
 p_domain text,p_after uuid DEFAULT NULL,p_limit integer DEFAULT 100
) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $fn$
DECLARE base jsonb; projected jsonb;
BEGIN
 base:=crm_security.crm_operational_source_fragment_pre_inquiry_response_20260906(p_domain,p_after,p_limit);
 IF p_domain<>'inquiry_core' THEN RETURN base; END IF;
 SELECT coalesce(jsonb_agg(item||jsonb_build_object('response_history',coalesce((
  SELECT jsonb_agg(jsonb_build_object(
   'id',e.event_id,'response',e.reason,'status',e.after_data->>'status',
   'first_response_at',e.after_data->>'first_response_at','responded_at',e.after_data->>'responded_at',
   'next_action_date',e.after_data->>'next_action_date',
   'at',e.created_at,'actor',e.after_data->>'actor') ORDER BY e.created_at,e.event_id)
  FROM crm_security.inquiry_audit_events e
  WHERE e.inquiry_id=(item->>'id')::uuid AND e.action IN ('inquiry_response_progress','inquiry_response_next_week_retry','inquiry_response_missed_retry')
 ),'[]'::jsonb)) ORDER BY item->>'id'),'[]'::jsonb) INTO projected
 FROM jsonb_array_elements(base->'items') item;
 RETURN jsonb_set(base,'{items}',projected,true);
END $fn$;
REVOKE EXECUTE ON FUNCTION crm_security.crm_operational_source_fragment_v1(text,uuid,integer)
 FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION public.crm_write_command_v2(
 p_request_id uuid,p_operation text,p_object_id uuid,p_expected_version integer,p_payload jsonb
) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $fn$
BEGIN
 IF p_operation='inquiry_assign' AND p_payload->>'intent' IN ('response_progress','response_next_week_retry','response_missed_retry') THEN
  IF p_expected_version IS DISTINCT FROM 0 THEN
   RAISE EXCEPTION 'invalid inquiry response version sentinel' USING ERRCODE='22023';
  END IF;
  RETURN crm_security.crm_inquiry_response_command_v1(p_request_id,p_object_id,p_payload);
 END IF;
 RETURN crm_security.crm_write_command_v2_opportunity_create_20260906(
  p_request_id,p_operation,p_object_id,p_expected_version,p_payload);
END $fn$;
REVOKE EXECUTE ON FUNCTION public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)
 FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.crm_write_command_v2(uuid,text,uuid,integer,jsonb) TO authenticated;

DO $post$ BEGIN
 IF has_function_privilege('public','public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)','EXECUTE')
  OR has_function_privilege('anon','public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)','EXECUTE')
  OR NOT has_function_privilege('authenticated','public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)','EXECUTE')
  OR has_function_privilege('service_role','public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)','EXECUTE')
  OR has_function_privilege('authenticated','crm_security.crm_inquiry_response_command_v1(uuid,uuid,jsonb)','EXECUTE')
  OR has_function_privilege('authenticated','crm_security.crm_operational_source_fragment_v1(text,uuid,integer)','EXECUTE')
  OR (SELECT pg_get_constraintdef(oid,true) FROM pg_constraint
      WHERE conrelid='crm_security.inquiry_audit_events'::regclass
       AND conname='inquiry_audit_events_action_check') IS DISTINCT FROM $expected$CHECK (action = ANY (ARRAY['direct_assign'::text, 'direct_reassign'::text, 'inquiry_unassign'::text, 'inquiry_reclassify'::text, 'inquiry_hold'::text, 'inquiry_trash'::text, 'inquiry_restore'::text, 'inquiry_purge'::text, 'inquiry_followup'::text, 'inquiry_response_progress'::text, 'inquiry_response_next_week_retry'::text, 'inquiry_response_missed_retry'::text]))$expected$
 THEN RAISE EXCEPTION 'inquiry response post-apply drift'; END IF;
END $post$;
COMMIT;
