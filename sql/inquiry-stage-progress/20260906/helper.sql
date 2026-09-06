-- LOCAL CANDIDATE ONLY. Connects the reachable PC inquiry non-terminal progress form.
SET LOCAL crm.inquiry_stage_progress_ref='rprechiaglyjaydkmxsu';
SET LOCAL search_path=pg_catalog;
SET LOCAL lock_timeout='3s';
SET LOCAL statement_timeout='60s';

DO $guard$ BEGIN
 IF current_user<>'postgres'
  OR current_setting('crm.inquiry_stage_progress_ref',true) IS DISTINCT FROM 'rprechiaglyjaydkmxsu'
  OR to_regprocedure('public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)') IS NULL
  OR to_regprocedure('crm_security.crm_inquiry_pipeline_promote_command_v1(uuid,text,uuid,integer,jsonb)') IS NULL
  OR to_regprocedure('crm_security.crm_operational_source_fragment_v1(text,uuid,integer)') IS NULL
  OR to_regprocedure('crm_security.crm_write_command_v2_inquiry_pipeline_20260906(uuid,text,uuid,integer,jsonb)') IS NOT NULL
  OR to_regprocedure('crm_security.crm_operational_source_fragment_pre_inquiry_stage_progress_20260906(text,uuid,integer)') IS NOT NULL
  OR to_regprocedure('crm_security.crm_inquiry_stage_progress_command_v1(uuid,uuid,jsonb)') IS NOT NULL
  OR (SELECT pg_get_constraintdef(oid,true) FROM pg_constraint
      WHERE conrelid='crm_security.command_receipts'::regclass AND conname='command_receipts_operation_check')
     IS DISTINCT FROM $expected$CHECK (operation = ANY (ARRAY['opportunity_work_set'::text, 'inquiry_assign'::text, 'service_change'::text, 'inquiry_unassign'::text, 'favorite_set'::text, 'opportunity_touch'::text, 'next_action'::text, 'activity'::text, 'quote_version'::text, 'next_action_complete'::text, 'stage_check'::text, 'transition'::text, 'close'::text, 'amount'::text, 'waiting_context'::text, 'inquiry_reclassify'::text, 'inquiry_status'::text, 'inquiry_trash'::text, 'inquiry_restore'::text, 'inquiry_purge'::text, 'inquiry_followup'::text, 'opportunity_create'::text, 'lineage_link'::text]))$expected$
  OR (SELECT pg_get_constraintdef(oid,true) FROM pg_constraint
      WHERE conrelid='crm_security.inquiry_audit_events'::regclass AND conname='inquiry_audit_events_action_check')
     IS DISTINCT FROM $expected$CHECK (action = ANY (ARRAY['direct_assign'::text, 'direct_reassign'::text, 'inquiry_unassign'::text, 'inquiry_reclassify'::text, 'inquiry_hold'::text, 'inquiry_trash'::text, 'inquiry_restore'::text, 'inquiry_purge'::text, 'inquiry_followup'::text, 'inquiry_response_progress'::text, 'inquiry_response_next_week_retry'::text, 'inquiry_response_missed_retry'::text, 'inquiry_pipeline_promote'::text, 'inquiry_lineage_link'::text]))$expected$
 THEN RAISE EXCEPTION 'inquiry stage progress prerequisite drift'; END IF;
END $guard$;

LOCK TABLE crm_security.command_receipts,crm_security.inquiry_audit_events IN ACCESS EXCLUSIVE MODE;
ALTER FUNCTION public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)
 RENAME TO crm_write_command_v2_inquiry_pipeline_20260906;
ALTER FUNCTION public.crm_write_command_v2_inquiry_pipeline_20260906(uuid,text,uuid,integer,jsonb)
 SET SCHEMA crm_security;
REVOKE EXECUTE ON FUNCTION crm_security.crm_write_command_v2_inquiry_pipeline_20260906(uuid,text,uuid,integer,jsonb)
 FROM PUBLIC,anon,authenticated,service_role;
ALTER FUNCTION crm_security.crm_operational_source_fragment_v1(text,uuid,integer)
 RENAME TO crm_operational_source_fragment_pre_inquiry_stage_progress_20260906;
REVOKE EXECUTE ON FUNCTION crm_security.crm_operational_source_fragment_pre_inquiry_stage_progress_20260906(text,uuid,integer)
 FROM PUBLIC,anon,authenticated,service_role;

ALTER TABLE crm_security.inquiry_audit_events DROP CONSTRAINT inquiry_audit_events_action_check;
ALTER TABLE crm_security.inquiry_audit_events ADD CONSTRAINT inquiry_audit_events_action_check CHECK(action IN (
 'direct_assign','direct_reassign','inquiry_unassign','inquiry_reclassify','inquiry_hold','inquiry_trash',
 'inquiry_restore','inquiry_purge','inquiry_followup','inquiry_response_progress','inquiry_response_next_week_retry',
 'inquiry_response_missed_retry','inquiry_pipeline_promote','inquiry_lineage_link','inquiry_stage_progress'));

CREATE FUNCTION crm_security.crm_inquiry_stage_progress_command_v1(
 p_request_id uuid,p_inquiry_id uuid,p_payload jsonb
) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $fn$
DECLARE
 a record; receipt crm_security.command_receipts%ROWTYPE;
 oldrow public.inquiries%ROWTYPE; newrow public.inquiries%ROWTYPE;
 canonical jsonb; ack jsonb; server_at timestamptz:=clock_timestamp(); today_kst date;
 from_status_value text; target_value text; to_status_value text; from_stage_value text; to_stage_value text;
 did_value text; result_value text; next_value text; due_value date; owner_name_value text;
 history_id uuid; next_id uuid; audit_id uuid; cancelled_ids jsonb:='[]'::jsonb; latest_management text;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;
 PERFORM 1 FROM public.users u WHERE u.auth_uid=auth.uid() FOR SHARE;
 PERFORM 1 FROM crm_security.access_review r WHERE r.reviewed_auth_uid=auth.uid() FOR SHARE;
 SELECT * INTO a FROM crm_security.actor();
 IF NOT FOUND THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;
 IF p_request_id IS NULL OR p_inquiry_id IS NULL OR jsonb_typeof(p_payload) IS DISTINCT FROM 'object'
  OR EXISTS(SELECT 1 FROM jsonb_object_keys(p_payload) k WHERE k NOT IN ('intent','from_status','target','did','result','next','due'))
  OR NOT p_payload ?& ARRAY['intent','from_status','target','did','result','next','due']
 THEN RAISE EXCEPTION 'invalid inquiry stage progress payload' USING ERRCODE='22023'; END IF;
 from_status_value:=btrim(p_payload->>'from_status');target_value:=p_payload->>'target';
 did_value:=btrim(p_payload->>'did');result_value:=btrim(p_payload->>'result');next_value:=btrim(p_payload->>'next');
 IF p_payload->>'intent'<>'progress' OR target_value !~ '^step:[0-5]$'
  OR length(from_status_value)<1 OR length(from_status_value)>200
  OR length(did_value)<1 OR length(did_value)>8000 OR length(result_value)<1 OR length(result_value)>8000
  OR length(next_value)<1 OR length(next_value)>500 OR p_payload->>'due' !~ '^\d{4}-\d{2}-\d{2}$'
 THEN RAISE EXCEPTION 'invalid inquiry stage progress payload' USING ERRCODE='22023'; END IF;
 BEGIN due_value:=(p_payload->>'due')::date; EXCEPTION WHEN datetime_field_overflow THEN RAISE EXCEPTION 'invalid inquiry next date' USING ERRCODE='22023'; END;
 IF due_value::text<>p_payload->>'due' THEN RAISE EXCEPTION 'invalid inquiry next date' USING ERRCODE='22023'; END IF;
 today_kst:=(server_at AT TIME ZONE 'Asia/Seoul')::date;
 IF due_value<today_kst OR due_value>today_kst+3650 THEN RAISE EXCEPTION 'invalid inquiry next date' USING ERRCODE='22023'; END IF;
 to_status_value:=(ARRAY['접수','전화응대 완료','견적서 발송완료','초기 집중관리','경쟁·임박·입찰','계약·공사 예정'])[substring(target_value from 6)::integer+1];
 to_stage_value:=(ARRAY['견적문의 접수','응대·컨설팅','견적서 발송','영업·관리 (유대·대기)','경쟁·임박','계약·시공'])[substring(target_value from 6)::integer+1];
 canonical:=jsonb_build_object('intent','progress','from_status',from_status_value,'target',target_value,
  'did',did_value,'result',result_value,'next',next_value,'due',due_value);

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
 IF latest_management IN ('inquiry_trash','inquiry_purge')
  OR coalesce(oldrow.status,'') IN ('수주','실주','배드핏','연락두절','종결','종료','보류')
 THEN RAISE EXCEPTION 'inquiry stage state conflict' USING ERRCODE='PT409'; END IF;

 PERFORM pg_advisory_xact_lock(hashtextextended(a.auth_uid::text||p_request_id::text,0));
 SELECT * INTO receipt FROM crm_security.command_receipts r WHERE r.actor_auth_uid=a.auth_uid AND r.request_id=p_request_id;
 IF FOUND THEN
  IF receipt.actor_user_id IS DISTINCT FROM a.user_id OR receipt.operation IS DISTINCT FROM 'inquiry_status'
   OR receipt.object_id IS DISTINCT FROM p_inquiry_id OR receipt.expected_version IS DISTINCT FROM 0
   OR receipt.payload IS DISTINCT FROM canonical
  THEN RAISE EXCEPTION 'REQUEST_ID_REUSE' USING ERRCODE='PT409'; END IF;
  RETURN receipt.ack||jsonb_build_object('replayed',true);
 END IF;
 IF oldrow.status IS DISTINCT FROM from_status_value OR oldrow.status=to_status_value
 THEN RAISE EXCEPTION 'inquiry stage state conflict' USING ERRCODE='PT409'; END IF;
 from_stage_value:=CASE
  WHEN oldrow.status ~ '견적.*발송[[:space:]]*완료' THEN '견적서 발송'
  WHEN oldrow.status ~ '초기|유대|침묵|보류' THEN '영업·관리 (유대·대기)'
  WHEN oldrow.status ~ '경쟁|임박|입찰|PT' THEN '경쟁·임박'
  WHEN oldrow.status ~ '계약|공사|시공' THEN '계약·시공'
  WHEN oldrow.status ~ '전화|현장|방문|응대|견적' THEN '응대·컨설팅'
  ELSE '견적문의 접수' END;
 SELECT coalesce(u.name,oldrow.assignee_name) INTO owner_name_value FROM public.users u WHERE u.user_id=oldrow.assigned_to;
 IF owner_name_value IS NULL THEN RAISE EXCEPTION 'No approved UUID inquiry owner' USING ERRCODE='42501'; END IF;
 SELECT coalesce(jsonb_agg(id ORDER BY created_at,id),'[]'::jsonb) INTO cancelled_ids
  FROM public.next_actions WHERE inquiry_id=p_inquiry_id AND status='open';
 UPDATE public.next_actions SET status='cancelled',updated_at=server_at WHERE inquiry_id=p_inquiry_id AND status='open';
 INSERT INTO public.next_actions(inquiry_id,action_type,title,due_at,assignee_name,status,created_at,updated_at)
 VALUES(p_inquiry_id,'전화',next_value,due_value::timestamp AT TIME ZONE 'Asia/Seoul',owner_name_value,'open',server_at,server_at)
 RETURNING id INTO next_id;
 INSERT INTO public.stage_history(inquiry_id,from_stage,to_stage,reason,actor_id,actor_name,changed_at)
 VALUES(p_inquiry_id,from_stage_value,to_stage_value,result_value,a.user_id,a.display_name,server_at) RETURNING id INTO history_id;
 UPDATE public.inquiries SET status=to_status_value,first_response_at=coalesce(first_response_at,server_at),
  responded_at=server_at,next_action_date=due_value,updated_at=server_at WHERE id=p_inquiry_id RETURNING * INTO newrow;
 INSERT INTO crm_security.inquiry_audit_events(actor_auth_uid,actor_user_id,inquiry_id,action,before_data,after_data,reason,created_at)
 VALUES(a.auth_uid,a.user_id,p_inquiry_id,'inquiry_stage_progress',
  jsonb_build_object('status',oldrow.status,'first_response_at',oldrow.first_response_at,'responded_at',oldrow.responded_at,
   'next_action_date',oldrow.next_action_date),
  jsonb_build_object('status',newrow.status,'first_response_at',newrow.first_response_at,'responded_at',newrow.responded_at,
   'next_action_date',newrow.next_action_date,'from_stage',from_stage_value,'to_stage',to_stage_value,'did',did_value,
   'result',result_value,'next',next_value,'stage_history_id',history_id,'next_action_id',next_id,
   'cancelled_action_ids',cancelled_ids,'actor',a.display_name),result_value,server_at) RETURNING event_id INTO audit_id;
 ack:=jsonb_build_object('contract_version',1,'ok',true,'request_id',p_request_id,'operation','inquiry_status',
  'object_id',p_inquiry_id,'intent','progress','from_status',oldrow.status,'to_status',newrow.status,
  'from_stage',from_stage_value,'to_stage',to_stage_value,'first_response_at',newrow.first_response_at,
  'responded_at',newrow.responded_at,'next_action_date',newrow.next_action_date,'stage_history_id',history_id,
  'next_action_id',next_id,'cancelled_action_ids',cancelled_ids,'inquiry_audit_event_id',audit_id,
  'server_at',server_at,'actor_auth_uid',a.auth_uid,'actor_user_id',a.user_id,'replayed',false);
 INSERT INTO crm_security.command_receipts(actor_auth_uid,request_id,actor_user_id,operation,object_id,expected_version,payload,ack,created_at)
 VALUES(a.auth_uid,p_request_id,a.user_id,'inquiry_status',p_inquiry_id,0,canonical,ack,server_at);
 RETURN ack;
END $fn$;
REVOKE EXECUTE ON FUNCTION crm_security.crm_inquiry_stage_progress_command_v1(uuid,uuid,jsonb)
 FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION crm_security.crm_operational_source_fragment_v1(
 p_domain text,p_after uuid DEFAULT NULL,p_limit integer DEFAULT 100
) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $fn$
DECLARE base jsonb; projected jsonb;
BEGIN
 base:=crm_security.crm_operational_source_fragment_pre_inquiry_stage_progress_20260906(p_domain,p_after,p_limit);
 IF p_domain<>'inquiry_core' THEN RETURN base; END IF;
 SELECT coalesce(jsonb_agg(item||jsonb_build_object(
  'stage_history',coalesce((SELECT jsonb_agg(jsonb_build_object('id',h.id,'from',h.from_stage,'to',h.to_stage,
    'reason',h.reason,'actor',h.actor_name,'at',h.changed_at) ORDER BY h.changed_at,h.id)
    FROM public.stage_history h WHERE h.inquiry_id=(item->>'id')::uuid),'[]'::jsonb),
  'activities',coalesce((SELECT jsonb_agg(jsonb_build_object('id',e.event_id,'type','단계전환',
    'note',e.after_data->>'did','result',e.after_data->>'result','actor',e.after_data->>'actor',
    'stage',e.after_data->>'to_stage','at',e.created_at) ORDER BY e.created_at,e.event_id)
    FROM crm_security.inquiry_audit_events e WHERE e.inquiry_id=(item->>'id')::uuid AND e.action='inquiry_stage_progress'),'[]'::jsonb),
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
 IF p_operation='inquiry_status' AND p_payload->>'intent'='progress' THEN
  IF p_expected_version IS DISTINCT FROM 0 THEN RAISE EXCEPTION 'invalid inquiry progress version sentinel' USING ERRCODE='22023'; END IF;
  RETURN crm_security.crm_inquiry_stage_progress_command_v1(p_request_id,p_object_id,p_payload);
 END IF;
 RETURN crm_security.crm_write_command_v2_inquiry_pipeline_20260906(p_request_id,p_operation,p_object_id,p_expected_version,p_payload);
END $fn$;
REVOKE EXECUTE ON FUNCTION public.crm_write_command_v2(uuid,text,uuid,integer,jsonb) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.crm_write_command_v2(uuid,text,uuid,integer,jsonb) TO authenticated;

DO $post$ BEGIN
 IF has_function_privilege('public','public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)','EXECUTE')
  OR has_function_privilege('anon','public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)','EXECUTE')
  OR NOT has_function_privilege('authenticated','public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)','EXECUTE')
  OR has_function_privilege('service_role','public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)','EXECUTE')
  OR has_function_privilege('authenticated','crm_security.crm_inquiry_stage_progress_command_v1(uuid,uuid,jsonb)','EXECUTE')
  OR has_function_privilege('authenticated','crm_security.crm_operational_source_fragment_v1(text,uuid,integer)','EXECUTE')
 THEN RAISE EXCEPTION 'inquiry stage progress post-apply ACL drift'; END IF;
END $post$;
