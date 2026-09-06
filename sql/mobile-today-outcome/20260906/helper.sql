SET LOCAL crm.mobile_today_ref='rprechiaglyjaydkmxsu';
SET LOCAL search_path=pg_catalog;
SET LOCAL lock_timeout='3s';
SET LOCAL statement_timeout='90s';

DO $guard$ BEGIN
 IF current_user<>'postgres' OR current_setting('crm.mobile_today_ref',true) IS DISTINCT FROM 'rprechiaglyjaydkmxsu'
  OR to_regclass('crm_security.next_action_postponements') IS NULL
  OR to_regprocedure('public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)') IS NULL
  OR to_regprocedure('crm_security.crm_write_command_v2_pre_mobile_today_20260906(uuid,text,uuid,integer,jsonb)') IS NOT NULL
  OR to_regprocedure('crm_security.crm_mobile_today_outcome_command_v1(uuid,text,uuid,integer,jsonb)') IS NOT NULL
  OR NOT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='crm_security' AND table_name='next_action_postponements' AND column_name='event_kind')
  OR NOT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='crm_security' AND table_name='next_action_postponements' AND column_name='replacement_action_id')
  OR (SELECT pg_get_constraintdef(oid,true) FROM pg_constraint WHERE conrelid='crm_security.command_receipts'::regclass AND conname='command_receipts_operation_check') IS DISTINCT FROM $expected$CHECK (operation = ANY (ARRAY['opportunity_work_set'::text, 'inquiry_assign'::text, 'service_change'::text, 'inquiry_unassign'::text, 'favorite_set'::text, 'opportunity_touch'::text, 'next_action'::text, 'activity'::text, 'quote_version'::text, 'next_action_complete'::text, 'stage_check'::text, 'transition'::text, 'close'::text, 'amount'::text, 'waiting_context'::text, 'inquiry_reclassify'::text, 'inquiry_status'::text, 'inquiry_trash'::text, 'inquiry_restore'::text, 'inquiry_purge'::text, 'inquiry_followup'::text, 'opportunity_create'::text, 'lineage_link'::text, 'attachment_prepare'::text, 'attachment_complete'::text, 'expansion_pool_update'::text, 'expansion_note'::text]))$expected$
 THEN RAISE EXCEPTION 'mobile Today outcome prerequisite drift'; END IF;
END $guard$;

LOCK TABLE crm_security.command_receipts IN ACCESS EXCLUSIVE MODE;
ALTER FUNCTION public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)
 RENAME TO crm_write_command_v2_pre_mobile_today_20260906;
ALTER FUNCTION public.crm_write_command_v2_pre_mobile_today_20260906(uuid,text,uuid,integer,jsonb)
 SET SCHEMA crm_security;
REVOKE EXECUTE ON FUNCTION crm_security.crm_write_command_v2_pre_mobile_today_20260906(uuid,text,uuid,integer,jsonb)
 FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION crm_security.crm_mobile_today_outcome_command_v1(
 p_request_id uuid,p_operation text,p_object_id uuid,p_expected_version integer,p_payload jsonb
) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $fn$
DECLARE
 a record; oldrow public.deals%ROWTYPE; newrow public.deals%ROWTYPE; actionrow public.next_actions%ROWTYPE;
 prior crm_security.command_receipts%ROWTYPE; action_id_value uuid; replacement_id uuid; activity_id uuid; audit_id uuid; postpone_event_id uuid;
 outcome_value text; action_type_value text; note_value text; result_value text; next_type_value text; next_title_value text;
 meaningful_value boolean; delay_days integer; due_value date; before_due date; count_value integer; actor_email text; owner_name text;
 server_at timestamptz; canonical jsonb; ack jsonb; cancelled_ids jsonb;
BEGIN
 IF p_request_id IS NULL OR p_object_id IS NULL OR p_expected_version IS NULL OR p_expected_version<0
  OR p_operation IS DISTINCT FROM 'next_action_complete' OR jsonb_typeof(p_payload) IS DISTINCT FROM 'object'
  OR EXISTS(SELECT 1 FROM jsonb_object_keys(p_payload) k WHERE k NOT IN ('intent','action_id','outcome'))
  OR NOT p_payload ?& ARRAY['intent','action_id','outcome'] OR p_payload->>'intent'<>'today_outcome'
  OR p_payload->>'outcome' NOT IN ('progress','next_week','missed')
 THEN RAISE EXCEPTION 'invalid mobile Today outcome payload' USING ERRCODE='22023'; END IF;
 BEGIN action_id_value:=(p_payload->>'action_id')::uuid;
 EXCEPTION WHEN invalid_text_representation THEN RAISE EXCEPTION 'invalid mobile Today action identity' USING ERRCODE='22023'; END;
 outcome_value:=p_payload->>'outcome';
 canonical:=jsonb_build_object('intent','today_outcome','action_id',action_id_value,'outcome',outcome_value);
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;
 PERFORM 1 FROM public.users u WHERE u.auth_uid=auth.uid() FOR SHARE;
 PERFORM 1 FROM crm_security.access_review r WHERE r.reviewed_auth_uid=auth.uid() FOR SHARE;
 SELECT * INTO a FROM crm_security.actor();
 IF NOT FOUND OR a.permission_role NOT IN ('rep','branch','admin') THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;
 PERFORM 1 FROM crm_security.object_scope s WHERE s.user_id=a.user_id AND s.deal_id=p_object_id FOR SHARE;
 SELECT * INTO oldrow FROM public.deals d WHERE d.id=p_object_id FOR UPDATE;
 IF NOT FOUND OR NOT crm_security.can_deal(p_object_id,true) THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;
 SELECT * INTO actionrow FROM public.next_actions n WHERE n.id=action_id_value AND n.deal_id=p_object_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'next action not found' USING ERRCODE='PT409'; END IF;
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(a.auth_uid::text||p_request_id::text,0));
 SELECT * INTO prior FROM crm_security.command_receipts r WHERE r.actor_auth_uid=a.auth_uid AND r.request_id=p_request_id;
 IF FOUND THEN
  IF prior.actor_user_id IS DISTINCT FROM a.user_id OR prior.operation IS DISTINCT FROM p_operation
   OR prior.object_id IS DISTINCT FROM p_object_id OR prior.expected_version IS DISTINCT FROM p_expected_version
   OR prior.payload IS DISTINCT FROM canonical
  THEN RAISE EXCEPTION 'REQUEST_ID_REUSE' USING ERRCODE='PT409'; END IF;
  RETURN prior.ack||jsonb_build_object('replayed',true);
 END IF;
 IF oldrow.version IS DISTINCT FROM p_expected_version OR actionrow.status<>'open'
  OR action_id_value IS DISTINCT FROM (SELECT n.id FROM public.next_actions n WHERE n.deal_id=p_object_id AND n.status='open' ORDER BY n.due_at NULLS LAST,n.id LIMIT 1)
 THEN RAISE EXCEPTION 'mobile Today action state conflict' USING ERRCODE='PT409'; END IF;
 SELECT u.name INTO owner_name FROM public.users u JOIN crm_security.access_review r ON r.user_id=u.user_id
 WHERE u.user_id=oldrow.owner_id AND u.active AND r.approved AND r.expires_at>now() AND r.permission_role IN ('rep','branch','admin');
 IF owner_name IS NULL THEN RAISE EXCEPTION 'No approved UUID owner' USING ERRCODE='42501'; END IF;
 server_at:=clock_timestamp();before_due:=(actionrow.due_at AT TIME ZONE 'UTC')::date;
 IF outcome_value='progress' THEN action_type_value:='전화';note_value:='통화 — 진행됨';result_value:='다음 일정 협의';meaningful_value:=true;next_type_value:='후속확인';next_title_value:='통화 후속 확인';delay_days:=3;
 ELSIF outcome_value='next_week' THEN action_type_value:='전화';note_value:='고객 요청으로 후속 연기';meaningful_value:=true;next_type_value:='재연락';next_title_value:='고객 요청 재연락';delay_days:=7;
 ELSE action_type_value:='부재';note_value:='전화 부재 — 못 받으심';result_value:='';meaningful_value:=false;next_type_value:='재통화';next_title_value:='재통화 시도';delay_days:=1;
 END IF;
 due_value:=(server_at AT TIME ZONE 'Asia/Seoul')::date+delay_days;
 SELECT coalesce(jsonb_agg(n.id ORDER BY n.due_at NULLS LAST,n.id),'[]'::jsonb) INTO cancelled_ids
 FROM public.next_actions n WHERE n.deal_id=p_object_id AND n.status='open' AND n.id<>action_id_value;
 UPDATE public.next_actions SET status='completed',completed_at=server_at,updated_at=server_at WHERE id=action_id_value AND status='open';
 UPDATE public.next_actions SET status='cancelled',updated_at=server_at WHERE deal_id=p_object_id AND status='open';
 INSERT INTO public.next_actions(deal_id,action_type,title,due_at,assignee_name,status,created_at,updated_at)
 VALUES(p_object_id,next_type_value,next_title_value,due_value::timestamp AT TIME ZONE 'UTC',owner_name,'open',server_at,server_at)
 RETURNING id INTO replacement_id;
 SELECT coalesce(max(e.postpone_count),0) INTO count_value FROM crm_security.next_action_postponements e WHERE e.deal_id=p_object_id;
 IF outcome_value='next_week' THEN
  count_value:=count_value+1;
  INSERT INTO crm_security.next_action_postponements(request_id,event_kind,next_action_id,replacement_action_id,deal_id,before_due_at,after_due_at,postpone_count,actor_auth_uid,actor_user_id,actor_name,changed_at)
  VALUES(p_request_id,'today_next_week',action_id_value,replacement_id,p_object_id,before_due,due_value,count_value,a.auth_uid,a.user_id,a.display_name,server_at)
  RETURNING event_id INTO postpone_event_id;
  result_value:='재연락 요청 (연기 '||count_value||'회)';
 END IF;
 SELECT u.email INTO actor_email FROM public.users u WHERE u.user_id=a.user_id;
 INSERT INTO public.activities(deal_id,organization_id,actor_email,actor_name,type,detail,occurred_at)
 VALUES(p_object_id,oldrow.organization_id,actor_email,a.display_name,action_type_value,
  jsonb_build_object('note',note_value,'result',result_value,'meaningful_contact',meaningful_value,'completed_action_id',action_id_value,'next_action_id',replacement_id,'postpone_event_id',postpone_event_id),server_at)
 RETURNING id INTO activity_id;
 UPDATE public.deals SET next_action=next_title_value,next_action_date=due_value,last_activity_at=greatest(last_activity_at,server_at),
  last_customer_contact_at=CASE WHEN meaningful_value THEN greatest(last_customer_contact_at,server_at) ELSE last_customer_contact_at END,
  updated_at=server_at,version=version+1 WHERE id=p_object_id AND version=p_expected_version RETURNING * INTO newrow;
 IF NOT FOUND THEN RAISE EXCEPTION 'unexpected version mutation' USING ERRCODE='PT409'; END IF;
 INSERT INTO crm_security.audit_events(actor_auth_uid,actor_user_id,actor_name,deal_id,action,before_data,after_data,reason,created_at)
 VALUES(a.auth_uid,a.user_id,a.display_name,p_object_id,'next_action_today_outcome',
  jsonb_build_object('version',oldrow.version,'action_id',action_id_value,'action_status',actionrow.status,'due_at',before_due),
  jsonb_build_object('version',newrow.version,'intent','today_outcome','outcome',outcome_value,'completed_action_id',action_id_value,'next_action_id',replacement_id,'due_at',due_value,'postpone_count',count_value,'postpone_event_id',postpone_event_id,'activity_id',activity_id,'cancelled_action_ids',cancelled_ids),
  outcome_value,server_at) RETURNING event_id INTO audit_id;
 ack:=jsonb_build_object('contract_version',1,'ok',true,'request_id',p_request_id,'operation',p_operation,'object_id',p_object_id,
  'intent','today_outcome','outcome',outcome_value,'actor_auth_uid',a.auth_uid,'actor_user_id',a.user_id,
  'previous_version',p_expected_version,'version',newrow.version,'completed_action_id',action_id_value,'action_status','completed',
  'next_action_id',replacement_id,'due_at',due_value,'postpone_count',count_value,'postpone_event_id',postpone_event_id,
  'activity_id',activity_id,'audit_event_id',audit_id,'cancelled_action_ids',cancelled_ids,'completed_at',server_at,'server_at',server_at,'replayed',false);
 INSERT INTO crm_security.command_receipts(actor_auth_uid,request_id,actor_user_id,operation,object_id,expected_version,payload,ack,created_at)
 VALUES(a.auth_uid,p_request_id,a.user_id,p_operation,p_object_id,p_expected_version,canonical,ack,server_at);
 RETURN ack;
END $fn$;
REVOKE EXECUTE ON FUNCTION crm_security.crm_mobile_today_outcome_command_v1(uuid,text,uuid,integer,jsonb) FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION public.crm_write_command_v2(
 p_request_id uuid,p_operation text,p_object_id uuid,p_expected_version integer,p_payload jsonb
) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $fn$
BEGIN
 IF p_operation='next_action_complete' AND p_payload->>'intent'='today_outcome'
 THEN RETURN crm_security.crm_mobile_today_outcome_command_v1(p_request_id,p_operation,p_object_id,p_expected_version,p_payload); END IF;
 RETURN crm_security.crm_write_command_v2_pre_mobile_today_20260906(p_request_id,p_operation,p_object_id,p_expected_version,p_payload);
END $fn$;
REVOKE EXECUTE ON FUNCTION public.crm_write_command_v2(uuid,text,uuid,integer,jsonb) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.crm_write_command_v2(uuid,text,uuid,integer,jsonb) TO authenticated;

DO $post$ BEGIN
 IF has_function_privilege('authenticated','crm_security.crm_mobile_today_outcome_command_v1(uuid,text,uuid,integer,jsonb)','EXECUTE')
  OR has_function_privilege('authenticated','crm_security.crm_write_command_v2_pre_mobile_today_20260906(uuid,text,uuid,integer,jsonb)','EXECUTE')
  OR NOT has_function_privilege('authenticated','public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)','EXECUTE')
  OR has_function_privilege('anon','public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)','EXECUTE')
  OR has_function_privilege('service_role','public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)','EXECUTE')
  OR has_table_privilege('authenticated','crm_security.next_action_postponements','SELECT')
 THEN RAISE EXCEPTION 'mobile Today outcome post-apply drift'; END IF;
END $post$;
