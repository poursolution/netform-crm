-- LOCAL REVIEW CANDIDATE ONLY. Staging approval is required.
BEGIN;
-- LOCAL CANDIDATE ONLY. Connects reachable PC inquiry Next/complete/check actions.
SET LOCAL crm.inquiry_action_check_ref='rprechiaglyjaydkmxsu';
SET LOCAL search_path=pg_catalog;
SET LOCAL lock_timeout='3s';
SET LOCAL statement_timeout='60s';

DO $guard$ BEGIN
 IF current_user<>'postgres'
  OR current_setting('crm.inquiry_action_check_ref',true) IS DISTINCT FROM 'rprechiaglyjaydkmxsu'
  OR to_regprocedure('public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)') IS NULL
  OR to_regprocedure('crm_security.crm_inquiry_stage_progress_command_v1(uuid,uuid,jsonb)') IS NULL
  OR to_regprocedure('crm_security.crm_operational_source_fragment_v1(text,uuid,integer)') IS NULL
  OR to_regprocedure('crm_security.crm_write_command_v2_inquiry_stage_progress_20260906(uuid,text,uuid,integer,jsonb)') IS NOT NULL
  OR to_regprocedure('crm_security.crm_operational_source_fragment_pre_inquiry_action_check_20260906(text,uuid,integer)') IS NOT NULL
  OR to_regprocedure('crm_security.crm_inquiry_action_command_v1(uuid,text,uuid,jsonb)') IS NOT NULL
  OR (SELECT pg_get_constraintdef(oid,true) FROM pg_constraint
      WHERE conrelid='crm_security.inquiry_audit_events'::regclass AND conname='inquiry_audit_events_action_check')
     IS DISTINCT FROM $expected$CHECK (action = ANY (ARRAY['direct_assign'::text, 'direct_reassign'::text, 'inquiry_unassign'::text, 'inquiry_reclassify'::text, 'inquiry_hold'::text, 'inquiry_trash'::text, 'inquiry_restore'::text, 'inquiry_purge'::text, 'inquiry_followup'::text, 'inquiry_response_progress'::text, 'inquiry_response_next_week_retry'::text, 'inquiry_response_missed_retry'::text, 'inquiry_pipeline_promote'::text, 'inquiry_lineage_link'::text, 'inquiry_stage_progress'::text]))$expected$
 THEN RAISE EXCEPTION 'inquiry action/check prerequisite drift'; END IF;
END $guard$;

LOCK TABLE crm_security.command_receipts,crm_security.inquiry_audit_events IN ACCESS EXCLUSIVE MODE;
ALTER FUNCTION public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)
 RENAME TO crm_write_command_v2_inquiry_stage_progress_20260906;
ALTER FUNCTION public.crm_write_command_v2_inquiry_stage_progress_20260906(uuid,text,uuid,integer,jsonb)
 SET SCHEMA crm_security;
REVOKE EXECUTE ON FUNCTION crm_security.crm_write_command_v2_inquiry_stage_progress_20260906(uuid,text,uuid,integer,jsonb)
 FROM PUBLIC,anon,authenticated,service_role;
ALTER FUNCTION crm_security.crm_operational_source_fragment_v1(text,uuid,integer)
 RENAME TO crm_operational_source_fragment_pre_inquiry_action_check_20260906;
REVOKE EXECUTE ON FUNCTION crm_security.crm_operational_source_fragment_pre_inquiry_action_check_20260906(text,uuid,integer)
 FROM PUBLIC,anon,authenticated,service_role;

ALTER TABLE crm_security.inquiry_audit_events DROP CONSTRAINT inquiry_audit_events_action_check;
ALTER TABLE crm_security.inquiry_audit_events ADD CONSTRAINT inquiry_audit_events_action_check CHECK(action IN (
 'direct_assign','direct_reassign','inquiry_unassign','inquiry_reclassify','inquiry_hold','inquiry_trash',
 'inquiry_restore','inquiry_purge','inquiry_followup','inquiry_response_progress','inquiry_response_next_week_retry',
 'inquiry_response_missed_retry','inquiry_pipeline_promote','inquiry_lineage_link','inquiry_stage_progress',
 'inquiry_next_set','inquiry_next_complete','inquiry_check'));

CREATE FUNCTION crm_security.crm_inquiry_action_command_v1(
 p_request_id uuid,p_operation text,p_inquiry_id uuid,p_payload jsonb
) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $fn$
DECLARE
 a record; receipt crm_security.command_receipts%ROWTYPE; oldrow public.inquiries%ROWTYPE;
 actionrow public.next_actions%ROWTYPE; canonical jsonb; ack jsonb; server_at timestamptz:=clock_timestamp();
 intent_value text; text_value text; type_value text; due_value date; action_id_value uuid;
 item_value integer; item_label text; checked_value boolean; prior_checked boolean;
 owner_name_value text; audit_id uuid; next_id uuid; cancelled_ids jsonb:='[]'::jsonb;
 next_due date; checks_value jsonb; latest_management text;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;
 PERFORM 1 FROM public.users u WHERE u.auth_uid=auth.uid() FOR SHARE;
 PERFORM 1 FROM crm_security.access_review r WHERE r.reviewed_auth_uid=auth.uid() FOR SHARE;
 SELECT * INTO a FROM crm_security.actor();
 IF NOT FOUND THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;
 IF p_request_id IS NULL OR p_inquiry_id IS NULL OR p_operation NOT IN ('next_action','next_action_complete','stage_check')
  OR jsonb_typeof(p_payload) IS DISTINCT FROM 'object'
 THEN RAISE EXCEPTION 'invalid inquiry action command' USING ERRCODE='22023'; END IF;
 intent_value:=p_payload->>'intent';
 IF p_operation='next_action' THEN
  IF intent_value<>'inquiry_next_set'
   OR EXISTS(SELECT 1 FROM jsonb_object_keys(p_payload) k WHERE k NOT IN ('intent','type','text','due_at'))
   OR NOT p_payload ?& ARRAY['intent','type','text','due_at'] OR p_payload->>'type'<>'전화'
  THEN RAISE EXCEPTION 'invalid inquiry next set payload' USING ERRCODE='22023'; END IF;
  type_value:='전화';text_value:=btrim(p_payload->>'text');
  IF length(text_value)<1 OR length(text_value)>500 OR p_payload->>'due_at' !~ '^\d{4}-\d{2}-\d{2}$'
  THEN RAISE EXCEPTION 'invalid inquiry next set payload' USING ERRCODE='22023'; END IF;
  BEGIN due_value:=(p_payload->>'due_at')::date; EXCEPTION WHEN datetime_field_overflow THEN RAISE EXCEPTION 'invalid inquiry next date' USING ERRCODE='22023'; END;
  IF due_value::text<>p_payload->>'due_at' OR due_value<(server_at AT TIME ZONE 'Asia/Seoul')::date
   OR due_value>(server_at AT TIME ZONE 'Asia/Seoul')::date+3650
  THEN RAISE EXCEPTION 'invalid inquiry next date' USING ERRCODE='22023'; END IF;
  canonical:=jsonb_build_object('intent',intent_value,'type',type_value,'text',text_value,'due_at',due_value);
 ELSIF p_operation='next_action_complete' THEN
  IF intent_value<>'inquiry_next_complete'
   OR EXISTS(SELECT 1 FROM jsonb_object_keys(p_payload) k WHERE k NOT IN ('intent','action_id'))
   OR NOT p_payload ?& ARRAY['intent','action_id']
  THEN RAISE EXCEPTION 'invalid inquiry next completion payload' USING ERRCODE='22023'; END IF;
  BEGIN action_id_value:=(p_payload->>'action_id')::uuid; EXCEPTION WHEN invalid_text_representation THEN RAISE EXCEPTION 'invalid inquiry action id' USING ERRCODE='22023'; END;
  canonical:=jsonb_build_object('intent',intent_value,'action_id',action_id_value);
 ELSE
  IF intent_value<>'inquiry_check'
   OR EXISTS(SELECT 1 FROM jsonb_object_keys(p_payload) k WHERE k NOT IN ('intent','item_index','checked'))
   OR NOT p_payload ?& ARRAY['intent','item_index','checked']
   OR jsonb_typeof(p_payload->'item_index') IS DISTINCT FROM 'number'
   OR jsonb_typeof(p_payload->'checked') IS DISTINCT FROM 'boolean'
  THEN RAISE EXCEPTION 'invalid inquiry check payload' USING ERRCODE='22023'; END IF;
  BEGIN item_value:=(p_payload->>'item_index')::integer;checked_value:=(p_payload->>'checked')::boolean;
  EXCEPTION WHEN invalid_text_representation OR numeric_value_out_of_range THEN RAISE EXCEPTION 'invalid inquiry check payload' USING ERRCODE='22023'; END;
  item_label:=(ARRAY['최초 연락 완료','현장 조건 확인','의사결정권자 확인','견적서 발송 확인','다음 행동일 확정','후속 통화 기록'])[item_value+1];
  IF item_label IS NULL THEN RAISE EXCEPTION 'invalid inquiry check item' USING ERRCODE='22023'; END IF;
  canonical:=jsonb_build_object('intent',intent_value,'item_index',item_value,'checked',checked_value);
 END IF;

 PERFORM 1 FROM crm_security.object_scope s WHERE s.user_id=a.user_id AND s.inquiry_id=p_inquiry_id FOR SHARE;
 SELECT * INTO oldrow FROM public.inquiries i WHERE i.id=p_inquiry_id FOR UPDATE;
 IF NOT FOUND OR NOT crm_security.can_inquiry(p_inquiry_id)
  OR a.permission_role NOT IN ('rep','consultation','admin')
  OR (a.permission_role<>'admin' AND oldrow.assigned_to IS DISTINCT FROM a.user_id)
  OR coalesce(oldrow.inquiry_type,'')='기술자문' OR coalesce(oldrow.brand,'')='기술자문'
 THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;
 SELECT e.action INTO latest_management FROM crm_security.inquiry_audit_events e
  WHERE e.inquiry_id=p_inquiry_id AND e.action IN ('inquiry_trash','inquiry_restore','inquiry_purge')
  ORDER BY e.created_at DESC,e.event_id DESC LIMIT 1;
 IF latest_management IN ('inquiry_trash','inquiry_purge') OR coalesce(oldrow.status,'') IN ('수주','실주','배드핏','연락두절','종결','종료')
 THEN RAISE EXCEPTION 'inquiry action state conflict' USING ERRCODE='PT409'; END IF;

 PERFORM pg_advisory_xact_lock(hashtextextended(a.auth_uid::text||p_request_id::text,0));
 SELECT * INTO receipt FROM crm_security.command_receipts r WHERE r.actor_auth_uid=a.auth_uid AND r.request_id=p_request_id;
 IF FOUND THEN
  IF receipt.actor_user_id IS DISTINCT FROM a.user_id OR receipt.operation IS DISTINCT FROM p_operation
   OR receipt.object_id IS DISTINCT FROM p_inquiry_id OR receipt.expected_version IS DISTINCT FROM 0
   OR receipt.payload IS DISTINCT FROM canonical
  THEN RAISE EXCEPTION 'REQUEST_ID_REUSE' USING ERRCODE='PT409'; END IF;
  RETURN receipt.ack||jsonb_build_object('replayed',true);
 END IF;

 IF p_operation='next_action' THEN
  SELECT coalesce(u.name,oldrow.assignee_name) INTO owner_name_value FROM public.users u WHERE u.user_id=oldrow.assigned_to;
  IF owner_name_value IS NULL THEN RAISE EXCEPTION 'No approved UUID inquiry owner' USING ERRCODE='42501'; END IF;
  SELECT coalesce(jsonb_agg(id ORDER BY created_at,id),'[]'::jsonb) INTO cancelled_ids
   FROM public.next_actions WHERE inquiry_id=p_inquiry_id AND status='open';
  UPDATE public.next_actions SET status='cancelled',updated_at=server_at WHERE inquiry_id=p_inquiry_id AND status='open';
  INSERT INTO public.next_actions(inquiry_id,action_type,title,due_at,assignee_name,status,created_at,updated_at)
  VALUES(p_inquiry_id,type_value,text_value,due_value::timestamp AT TIME ZONE 'Asia/Seoul',owner_name_value,'open',server_at,server_at)
  RETURNING id INTO next_id;
  UPDATE public.inquiries SET next_action_date=due_value,updated_at=server_at WHERE id=p_inquiry_id;
  INSERT INTO crm_security.inquiry_audit_events(actor_auth_uid,actor_user_id,inquiry_id,action,before_data,after_data,reason,created_at)
  VALUES(a.auth_uid,a.user_id,p_inquiry_id,'inquiry_next_set',jsonb_build_object('next_action_date',oldrow.next_action_date,'cancelled_action_ids',cancelled_ids),
   jsonb_build_object('next_action_id',next_id,'type',type_value,'text',text_value,'next_action_date',due_value,'assignee_name',owner_name_value,'actor',a.display_name),text_value,server_at)
  RETURNING event_id INTO audit_id;
  ack:=jsonb_build_object('contract_version',1,'ok',true,'request_id',p_request_id,'operation',p_operation,'object_id',p_inquiry_id,
   'intent',intent_value,'next_action_id',next_id,'cancelled_action_ids',cancelled_ids,'next_action_date',due_value,
   'assignee_name',owner_name_value,'inquiry_audit_event_id',audit_id,'server_at',server_at,'actor_name',a.display_name,
   'actor_auth_uid',a.auth_uid,'actor_user_id',a.user_id,'replayed',false);
 ELSIF p_operation='next_action_complete' THEN
  SELECT * INTO actionrow FROM public.next_actions n WHERE n.id=action_id_value AND n.inquiry_id=p_inquiry_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;
  IF actionrow.status IS DISTINCT FROM 'open' THEN RAISE EXCEPTION 'inquiry next action state conflict' USING ERRCODE='PT409'; END IF;
  UPDATE public.next_actions SET status='completed',completed_at=server_at,updated_at=server_at WHERE id=actionrow.id AND status='open';
  SELECT n.due_at::date INTO next_due FROM public.next_actions n WHERE n.inquiry_id=p_inquiry_id AND n.status='open' ORDER BY n.due_at,n.id LIMIT 1;
  UPDATE public.inquiries SET next_action_date=next_due,updated_at=server_at WHERE id=p_inquiry_id;
  INSERT INTO crm_security.inquiry_audit_events(actor_auth_uid,actor_user_id,inquiry_id,action,before_data,after_data,reason,created_at)
  VALUES(a.auth_uid,a.user_id,p_inquiry_id,'inquiry_next_complete',jsonb_build_object('next_action_id',actionrow.id,'status',actionrow.status,'next_action_date',oldrow.next_action_date),
   jsonb_build_object('next_action_id',actionrow.id,'status','completed','completed_at',server_at,'completed_title',actionrow.title,'next_action_date',next_due,'actor',a.display_name),actionrow.title,server_at)
  RETURNING event_id INTO audit_id;
  ack:=jsonb_build_object('contract_version',1,'ok',true,'request_id',p_request_id,'operation',p_operation,'object_id',p_inquiry_id,
   'intent',intent_value,'next_action_id',actionrow.id,'action_status','completed','completed_title',actionrow.title,
   'completed_at',server_at,'next_action_date',next_due,'inquiry_audit_event_id',audit_id,'server_at',server_at,'actor_name',a.display_name,
   'actor_auth_uid',a.auth_uid,'actor_user_id',a.user_id,'replayed',false);
 ELSE
  SELECT coalesce((SELECT (e.after_data->>'checked')::boolean FROM crm_security.inquiry_audit_events e
   WHERE e.inquiry_id=p_inquiry_id AND e.action='inquiry_check' AND (e.after_data->>'item_index')::integer=item_value
   ORDER BY e.created_at DESC,e.event_id DESC LIMIT 1),false) INTO prior_checked;
  IF prior_checked=checked_value THEN RAISE EXCEPTION 'inquiry check state conflict' USING ERRCODE='PT409'; END IF;
  UPDATE public.inquiries SET updated_at=server_at WHERE id=p_inquiry_id;
  INSERT INTO crm_security.inquiry_audit_events(actor_auth_uid,actor_user_id,inquiry_id,action,before_data,after_data,reason,created_at)
  VALUES(a.auth_uid,a.user_id,p_inquiry_id,'inquiry_check',jsonb_build_object('item_index',item_value,'item_text',item_label,'checked',prior_checked),
   jsonb_build_object('item_index',item_value,'item_text',item_label,'checked',checked_value,'actor',a.display_name),item_label,server_at)
  RETURNING event_id INTO audit_id;
  SELECT jsonb_agg(coalesce((SELECT (e.after_data->>'checked')::boolean FROM crm_security.inquiry_audit_events e
    WHERE e.inquiry_id=p_inquiry_id AND e.action='inquiry_check' AND (e.after_data->>'item_index')::integer=g.i
    ORDER BY e.created_at DESC,e.event_id DESC LIMIT 1),false) ORDER BY g.i)
   INTO checks_value FROM generate_series(0,5) g(i);
  ack:=jsonb_build_object('contract_version',1,'ok',true,'request_id',p_request_id,'operation',p_operation,'object_id',p_inquiry_id,
   'intent',intent_value,'item_index',item_value,'item_text',item_label,'checked',checked_value,'checks',checks_value,
   'inquiry_audit_event_id',audit_id,'server_at',server_at,'actor_name',a.display_name,
   'actor_auth_uid',a.auth_uid,'actor_user_id',a.user_id,'replayed',false);
 END IF;
 INSERT INTO crm_security.command_receipts(actor_auth_uid,request_id,actor_user_id,operation,object_id,expected_version,payload,ack,created_at)
 VALUES(a.auth_uid,p_request_id,a.user_id,p_operation,p_inquiry_id,0,canonical,ack,server_at);
 RETURN ack;
END $fn$;
REVOKE EXECUTE ON FUNCTION crm_security.crm_inquiry_action_command_v1(uuid,text,uuid,jsonb)
 FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION crm_security.crm_operational_source_fragment_v1(
 p_domain text,p_after uuid DEFAULT NULL,p_limit integer DEFAULT 100
) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $fn$
DECLARE base jsonb; projected jsonb;
BEGIN
 base:=crm_security.crm_operational_source_fragment_pre_inquiry_action_check_20260906(p_domain,p_after,p_limit);
 IF p_domain<>'inquiry_core' THEN RETURN base; END IF;
 SELECT coalesce(jsonb_agg(item||jsonb_build_object(
  'checks',(SELECT jsonb_agg(coalesce((SELECT (e.after_data->>'checked')::boolean FROM crm_security.inquiry_audit_events e
    WHERE e.inquiry_id=(item->>'id')::uuid AND e.action='inquiry_check' AND (e.after_data->>'item_index')::integer=g.i
    ORDER BY e.created_at DESC,e.event_id DESC LIMIT 1),false) ORDER BY g.i) FROM generate_series(0,5) g(i)),
  'activities',coalesce(item->'activities','[]'::jsonb)||coalesce((SELECT jsonb_agg(jsonb_build_object(
    'id',e.event_id,'type',CASE e.action WHEN 'inquiry_next_set' THEN '다음행동등록' WHEN 'inquiry_next_complete' THEN '행동완료' ELSE '체크' END,
    'note',CASE e.action WHEN 'inquiry_next_set' THEN e.after_data->>'text' WHEN 'inquiry_next_complete' THEN e.after_data->>'completed_title' ELSE e.after_data->>'item_text' END,
    'result',CASE e.action WHEN 'inquiry_next_set' THEN '기한 '||(e.after_data->>'next_action_date') WHEN 'inquiry_next_complete' THEN '완료 처리' ELSE CASE WHEN (e.after_data->>'checked')::boolean THEN '확인' ELSE '해제' END END,
    'actor',e.after_data->>'actor','at',e.created_at) ORDER BY e.created_at,e.event_id)
    FROM crm_security.inquiry_audit_events e WHERE e.inquiry_id=(item->>'id')::uuid
     AND e.action IN ('inquiry_next_set','inquiry_next_complete','inquiry_check')),'[]'::jsonb),
  'next_action',coalesce((SELECT jsonb_build_object('id',n.id,'type',n.action_type,'text',n.title,'due',n.due_at,
    'due_at',n.due_at,'assignee',n.assignee_name,'status',n.status) FROM public.next_actions n
    WHERE n.inquiry_id=(item->>'id')::uuid AND n.status='open' ORDER BY n.due_at,n.id LIMIT 1),'null'::jsonb)
 ) ORDER BY item->>'id'),'[]'::jsonb) INTO projected FROM jsonb_array_elements(base->'items') item;
 RETURN jsonb_set(base,'{items}',projected,true);
END $fn$;
REVOKE EXECUTE ON FUNCTION crm_security.crm_operational_source_fragment_v1(text,uuid,integer)
 FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION public.crm_write_command_v2(
 p_request_id uuid,p_operation text,p_object_id uuid,p_expected_version integer,p_payload jsonb
) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $fn$
BEGIN
 IF (p_operation='next_action' AND p_payload->>'intent'='inquiry_next_set')
  OR (p_operation='next_action_complete' AND p_payload->>'intent'='inquiry_next_complete')
  OR (p_operation='stage_check' AND p_payload->>'intent'='inquiry_check') THEN
  IF p_expected_version IS DISTINCT FROM 0 THEN RAISE EXCEPTION 'invalid inquiry action version sentinel' USING ERRCODE='22023'; END IF;
  RETURN crm_security.crm_inquiry_action_command_v1(p_request_id,p_operation,p_object_id,p_payload);
 END IF;
 RETURN crm_security.crm_write_command_v2_inquiry_stage_progress_20260906(p_request_id,p_operation,p_object_id,p_expected_version,p_payload);
END $fn$;
REVOKE EXECUTE ON FUNCTION public.crm_write_command_v2(uuid,text,uuid,integer,jsonb) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.crm_write_command_v2(uuid,text,uuid,integer,jsonb) TO authenticated;

DO $post$ BEGIN
 IF has_function_privilege('public','public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)','EXECUTE')
  OR has_function_privilege('anon','public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)','EXECUTE')
  OR NOT has_function_privilege('authenticated','public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)','EXECUTE')
  OR has_function_privilege('service_role','public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)','EXECUTE')
  OR has_function_privilege('authenticated','crm_security.crm_inquiry_action_command_v1(uuid,text,uuid,jsonb)','EXECUTE')
  OR has_function_privilege('authenticated','crm_security.crm_operational_source_fragment_v1(text,uuid,integer)','EXECUTE')
 THEN RAISE EXCEPTION 'inquiry action/check post-apply ACL drift'; END IF;
END $post$;
COMMIT;
