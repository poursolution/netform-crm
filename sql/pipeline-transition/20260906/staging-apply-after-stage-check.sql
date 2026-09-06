SET crm.transition_ref='rprechiaglyjaydkmxsu';
BEGIN;
SET LOCAL search_path=pg_catalog;SET LOCAL lock_timeout='3s';SET LOCAL statement_timeout='60s';
DO $guard$ BEGIN
 IF current_user<>'postgres' OR current_setting('crm.transition_ref',true) IS DISTINCT FROM 'rprechiaglyjaydkmxsu'
  OR to_regprocedure('public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)') IS NULL
  OR to_regprocedure('crm_security.crm_stage_check_command_v1(uuid,uuid,integer,jsonb)') IS NULL
  OR to_regprocedure('crm_security.crm_operational_source_fragment_v1(text,uuid,integer)') IS NULL
  OR NOT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='deals' AND column_name='stage_checklist')
  OR EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='deals' AND column_name='stage_contexts')
  OR to_regprocedure('crm_security.crm_write_command_v2_stage_check_20260906(uuid,text,uuid,integer,jsonb)') IS NOT NULL
  OR to_regprocedure('crm_security.crm_operational_source_fragment_pre_transition_20260906(text,uuid,integer)') IS NOT NULL
  OR to_regprocedure('crm_security.crm_deal_transition_command_v1(uuid,uuid,integer,jsonb)') IS NOT NULL
  OR to_regclass('crm_security.stage_transition_events') IS NOT NULL
  OR (SELECT pg_get_constraintdef(oid,true) FROM pg_constraint WHERE conrelid='crm_security.command_receipts'::regclass AND conname='command_receipts_operation_check') IS DISTINCT FROM $expected$CHECK (operation = ANY (ARRAY['opportunity_work_set'::text, 'inquiry_assign'::text, 'service_change'::text, 'inquiry_unassign'::text, 'favorite_set'::text, 'opportunity_touch'::text, 'next_action'::text, 'activity'::text, 'quote_version'::text, 'next_action_complete'::text, 'stage_check'::text]))$expected$
 THEN RAISE EXCEPTION 'transition after-stage-check prerequisite drift'; END IF;
END $guard$;
CREATE TEMP TABLE transition_source_guard AS SELECT p.oid,p.prosrc,p.proconfig,coalesce(p.proacl::text,'') acl FROM pg_proc p WHERE p.oid='public.crm_operational_source_v1(text,uuid,integer)'::regprocedure;
ALTER FUNCTION public.crm_write_command_v2(uuid,text,uuid,integer,jsonb) RENAME TO crm_write_command_v2_stage_check_20260906;
ALTER FUNCTION public.crm_write_command_v2_stage_check_20260906(uuid,text,uuid,integer,jsonb) SET SCHEMA crm_security;
REVOKE EXECUTE ON FUNCTION crm_security.crm_write_command_v2_stage_check_20260906(uuid,text,uuid,integer,jsonb) FROM PUBLIC,anon,authenticated,service_role;
ALTER FUNCTION crm_security.crm_operational_source_fragment_v1(text,uuid,integer) RENAME TO crm_operational_source_fragment_pre_transition_20260906;
REVOKE EXECUTE ON FUNCTION crm_security.crm_operational_source_fragment_pre_transition_20260906(text,uuid,integer) FROM PUBLIC,anon,authenticated,service_role;
ALTER TABLE public.deals ADD COLUMN stage_contexts jsonb NOT NULL DEFAULT '{}'::jsonb;
CREATE TABLE crm_security.stage_transition_events(
 event_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),request_id uuid NOT NULL UNIQUE,deal_id uuid NOT NULL REFERENCES public.deals(id) ON DELETE RESTRICT,
 from_stage text NOT NULL,to_stage text NOT NULL,transition_date date NOT NULL,fields jsonb NOT NULL CHECK(jsonb_typeof(fields)='object'),skip_reason text,memo text,
 actor_auth_uid uuid NOT NULL,actor_user_id uuid NOT NULL REFERENCES public.users(user_id) ON DELETE RESTRICT,recorded_at timestamptz NOT NULL,
 stage_history_id uuid NOT NULL REFERENCES public.stage_history(id) ON DELETE RESTRICT,activity_id uuid NOT NULL REFERENCES public.activities(id) ON DELETE RESTRICT,next_action_id uuid REFERENCES public.next_actions(id) ON DELETE RESTRICT);
ALTER TABLE crm_security.stage_transition_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON crm_security.stage_transition_events FROM PUBLIC,anon,authenticated,service_role;
ALTER TABLE crm_security.command_receipts DROP CONSTRAINT command_receipts_operation_check;
ALTER TABLE crm_security.command_receipts ADD CONSTRAINT command_receipts_operation_check CHECK(operation IN ('opportunity_work_set','inquiry_assign','service_change','inquiry_unassign','favorite_set','opportunity_touch','next_action','activity','quote_version','next_action_complete','stage_check','transition'));
CREATE FUNCTION crm_security.crm_transition_field_date_v1(
 p_fields jsonb,p_key text,p_required boolean
) RETURNS date LANGUAGE plpgsql IMMUTABLE SECURITY INVOKER SET search_path='' AS $fn$
DECLARE value text; parsed date;
BEGIN
 value:=p_fields->>p_key;
 IF value IS NULL OR value='' THEN
  IF p_required THEN RAISE EXCEPTION 'missing transition date field: %',p_key USING ERRCODE='22023'; END IF;
  RETURN NULL;
 END IF;
 IF jsonb_typeof(p_fields->p_key) IS DISTINCT FROM 'string' OR value !~ '^\d{4}-\d{2}-\d{2}$'
 THEN RAISE EXCEPTION 'invalid transition date field: %',p_key USING ERRCODE='22023'; END IF;
 BEGIN parsed:=value::date; EXCEPTION WHEN datetime_field_overflow THEN RAISE EXCEPTION 'invalid transition date field: %',p_key USING ERRCODE='22023'; END;
 IF parsed::text<>value THEN RAISE EXCEPTION 'invalid transition date field: %',p_key USING ERRCODE='22023'; END IF;
 RETURN parsed;
END $fn$;

CREATE FUNCTION crm_security.crm_transition_validate_v1(
 p_to text,p_fields jsonb,p_transition_date date
) RETURNS void LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path='' AS $fn$
DECLARE allowed text[]; sent_date date; followup date; contact_date date; last_contact date;
 start_date date; contract_date date; completion_date date; support jsonb; checks jsonb;
BEGIN
 IF jsonb_typeof(p_fields) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'transition fields must be an object' USING ERRCODE='22023'; END IF;
 allowed:=CASE p_to
  WHEN 'first_contact' THEN ARRAY['needs','work_scope','expected_timing']
  WHEN 'consulting' THEN ARRAY['quote_request','required_materials','quote_due']
  WHEN 'sent' THEN ARRAY['materials','quote_version','recipient','sent_date','reaction','followup_date']
  WHEN 'rapport' THEN ARRAY['reaction','likelihood','contact_date']
  WHEN 'silent' THEN ARRAY['reason','last_contact','contact_date']
  WHEN 'waiting' THEN ARRAY['reason','last_contact','speaker','statement','resume_date','contact_date']
  WHEN 'compete' THEN ARRAY['competition_type','competitor','meeting_date','position','support']
  WHEN 'imminent' THEN ARRAY['final_terms','expected_contract','customer_intent','remaining_issues']
  WHEN 'bidding' THEN ARRAY['announcement_date','briefing_date','bid_deadline','bid_terms','bid_plan']
  WHEN 'contract' THEN ARRAY['bid_result','contract_amount','contract_status','contract_date','special_terms']
  WHEN 'construction' THEN ARRAY['start_date','contract_amount','handover','requests']
  WHEN 'completion' THEN ARRAY['completion_date','completion_checks','contract_amount','completion_documents','warranty','payment','customer_handover']
  ELSE NULL END;
 IF allowed IS NULL OR EXISTS(SELECT 1 FROM jsonb_object_keys(p_fields) k WHERE NOT k=ANY(allowed))
 THEN RAISE EXCEPTION 'invalid transition fields' USING ERRCODE='22023'; END IF;

 IF p_to='first_contact' THEN
  IF length(trim(coalesce(p_fields->>'needs','')))<1 OR length(trim(coalesce(p_fields->>'work_scope','')))<1 THEN RAISE EXCEPTION 'required first contact fields missing' USING ERRCODE='22023'; END IF;
 ELSIF p_to='consulting' THEN
  IF length(trim(coalesce(p_fields->>'quote_request','')))<1 THEN RAISE EXCEPTION 'quote request is required' USING ERRCODE='22023'; END IF;
  PERFORM crm_security.crm_transition_field_date_v1(p_fields,'quote_due',true);
 ELSIF p_to='sent' THEN
  IF jsonb_typeof(p_fields->'materials') IS DISTINCT FROM 'array' OR jsonb_array_length(p_fields->'materials')<1
   OR EXISTS(SELECT 1 FROM jsonb_array_elements_text(p_fields->'materials') x WHERE x NOT IN ('견적서','제안서','공법자료','기타자료'))
   OR length(trim(coalesce(p_fields->>'recipient','')))<1
  THEN RAISE EXCEPTION 'invalid sent fields' USING ERRCODE='22023'; END IF;
  IF (p_fields->'materials') ? '견적서' AND coalesce(p_fields->>'quote_version','') !~ '^\d+$'
  THEN RAISE EXCEPTION 'quote version is required' USING ERRCODE='22023'; END IF;
  IF coalesce(p_fields->>'reaction','')<>'' AND p_fields->>'reaction' NOT IN ('확인 전','검토중','추가자료 요청','가격협의') THEN RAISE EXCEPTION 'invalid reaction' USING ERRCODE='22023'; END IF;
  sent_date:=crm_security.crm_transition_field_date_v1(p_fields,'sent_date',true);
  followup:=crm_security.crm_transition_field_date_v1(p_fields,'followup_date',true);
  IF sent_date>p_transition_date OR followup<sent_date THEN RAISE EXCEPTION 'invalid sent date sequence' USING ERRCODE='22023'; END IF;
 ELSIF p_to='rapport' THEN
  IF length(trim(coalesce(p_fields->>'reaction','')))<1 OR (coalesce(p_fields->>'likelihood','')<>'' AND p_fields->>'likelihood' NOT IN ('높음','보통','낮음','미확인')) THEN RAISE EXCEPTION 'invalid rapport fields' USING ERRCODE='22023'; END IF;
  PERFORM crm_security.crm_transition_field_date_v1(p_fields,'contact_date',true);
 ELSIF p_to IN ('silent','waiting') THEN
  IF length(trim(coalesce(p_fields->>'reason','')))<1 THEN RAISE EXCEPTION 'waiting reason is required' USING ERRCODE='22023'; END IF;
  last_contact:=crm_security.crm_transition_field_date_v1(p_fields,'last_contact',false);
  contact_date:=crm_security.crm_transition_field_date_v1(p_fields,'contact_date',true);
  IF last_contact IS NOT NULL AND last_contact>p_transition_date THEN RAISE EXCEPTION 'last contact is after transition' USING ERRCODE='22023'; END IF;
  IF p_to='waiting' THEN PERFORM crm_security.crm_transition_field_date_v1(p_fields,'resume_date',false); END IF;
 ELSIF p_to='compete' THEN
  IF p_fields->>'competition_type' NOT IN ('PT','경쟁견적','가격협상','타공법 비교') OR (coalesce(p_fields->>'position','')<>'' AND p_fields->>'position' NOT IN ('우세','비슷','열세','모름')) THEN RAISE EXCEPTION 'invalid competition fields' USING ERRCODE='22023'; END IF;
  PERFORM crm_security.crm_transition_field_date_v1(p_fields,'meeting_date',false);
  support:=p_fields->'support';
  IF support IS NOT NULL AND (jsonb_typeof(support) IS DISTINCT FROM 'array' OR EXISTS(SELECT 1 FROM jsonb_array_elements_text(support)x WHERE x NOT IN ('PT자료','비교자료','가격검토','임원지원','없음')) OR (support ? '없음' AND jsonb_array_length(support)>1)) THEN RAISE EXCEPTION 'invalid support fields' USING ERRCODE='22023'; END IF;
 ELSIF p_to='imminent' THEN
  IF length(trim(coalesce(p_fields->>'final_terms','')))<1 THEN RAISE EXCEPTION 'final terms are required' USING ERRCODE='22023'; END IF;
  PERFORM crm_security.crm_transition_field_date_v1(p_fields,'expected_contract',true);
 ELSIF p_to='bidding' THEN
  IF length(trim(coalesce(p_fields->>'bid_terms','')))<1 THEN RAISE EXCEPTION 'bid terms are required' USING ERRCODE='22023'; END IF;
  PERFORM crm_security.crm_transition_field_date_v1(p_fields,'announcement_date',false);PERFORM crm_security.crm_transition_field_date_v1(p_fields,'briefing_date',false);PERFORM crm_security.crm_transition_field_date_v1(p_fields,'bid_deadline',true);
 ELSIF p_to='contract' THEN
  IF p_fields->>'bid_result' NOT IN ('낙찰','우선협상','수의계약','확인중') OR p_fields->>'contract_status' NOT IN ('체결 예정','체결 완료') OR jsonb_typeof(p_fields->'contract_amount') IS DISTINCT FROM 'number' OR (p_fields->>'contract_amount')::numeric<=0 THEN RAISE EXCEPTION 'invalid contract fields' USING ERRCODE='22023'; END IF;
  contract_date:=crm_security.crm_transition_field_date_v1(p_fields,'contract_date',true);
  IF p_fields->>'contract_status'='체결 완료' AND contract_date>p_transition_date THEN RAISE EXCEPTION 'contract date is after transition' USING ERRCODE='22023'; END IF;
 ELSIF p_to='construction' THEN
  IF jsonb_typeof(p_fields->'contract_amount') IS DISTINCT FROM 'number' OR (p_fields->>'contract_amount')::numeric<=0 OR (coalesce(p_fields->>'handover','')<>'' AND p_fields->>'handover' NOT IN ('완료','진행중','미완료')) THEN RAISE EXCEPTION 'invalid construction fields' USING ERRCODE='22023'; END IF;
  start_date:=crm_security.crm_transition_field_date_v1(p_fields,'start_date',true);IF start_date>p_transition_date THEN RAISE EXCEPTION 'start date is after transition' USING ERRCODE='22023'; END IF;
 ELSIF p_to='completion' THEN
  completion_date:=crm_security.crm_transition_field_date_v1(p_fields,'completion_date',true);IF completion_date>p_transition_date THEN RAISE EXCEPTION 'completion date is after transition' USING ERRCODE='22023'; END IF;
  checks:=p_fields->'completion_checks';
  IF jsonb_typeof(checks) IS DISTINCT FROM 'array' OR NOT checks ?& ARRAY['공사 완료','준공검사 완료'] OR EXISTS(SELECT 1 FROM jsonb_array_elements_text(checks)x WHERE x NOT IN ('공사 완료','준공검사 완료','하자보증서 전달','준공서류 전달')) THEN RAISE EXCEPTION 'invalid completion checks' USING ERRCODE='22023'; END IF;
  IF p_fields ? 'contract_amount' AND p_fields->>'contract_amount'<>'' AND (jsonb_typeof(p_fields->'contract_amount') IS DISTINCT FROM 'number' OR (p_fields->>'contract_amount')::numeric<0) THEN RAISE EXCEPTION 'invalid completion amount' USING ERRCODE='22023'; END IF;
  IF coalesce(p_fields->>'payment','')<>'' AND p_fields->>'payment' NOT IN ('청구전','청구완료','일부수금','완납') THEN RAISE EXCEPTION 'invalid payment' USING ERRCODE='22023'; END IF;
  IF coalesce(p_fields->>'customer_handover','')<>'' AND p_fields->>'customer_handover' NOT IN ('완료','확인필요') THEN RAISE EXCEPTION 'invalid customer handover' USING ERRCODE='22023'; END IF;
 END IF;
END $fn$;

REVOKE EXECUTE ON FUNCTION crm_security.crm_transition_field_date_v1(jsonb,text,boolean) FROM PUBLIC,anon,authenticated,service_role;
REVOKE EXECUTE ON FUNCTION crm_security.crm_transition_validate_v1(text,jsonb,date) FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION crm_security.crm_deal_transition_command_v1(
 p_request_id uuid,p_object_id uuid,p_expected_version integer,p_payload jsonb
) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $fn$
DECLARE a record; receipt crm_security.command_receipts%ROWTYPE;
 oldrow public.deals%ROWTYPE; newrow public.deals%ROWTYPE;
 canonical jsonb; ack jsonb; audit_id uuid; transition_event_id uuid; history_id uuid; activity_id uuid; next_id uuid;
 from_value text; to_value text; transition_value date; fields_value jsonb; skip_value text; memo_value text; note_value text;
 effective_at timestamptz; server_at timestamptz; group_value text; lifecycle_value text; actor_email_value text; owner_name_value text;
 next_due date; next_title text; cancelled_ids jsonb:='[]'::jsonb; contexts jsonb; standard boolean;
BEGIN
 IF p_request_id IS NULL OR p_object_id IS NULL OR p_expected_version IS NULL OR p_expected_version<0
  OR jsonb_typeof(p_payload) IS DISTINCT FROM 'object'
  OR EXISTS(SELECT 1 FROM jsonb_object_keys(p_payload) k WHERE k NOT IN ('from','to','transition_date','fields','skip_reason','memo','note'))
  OR NOT p_payload ?& ARRAY['from','to','transition_date','fields','skip_reason','memo','note']
  OR jsonb_typeof(p_payload->'from') IS DISTINCT FROM 'string' OR jsonb_typeof(p_payload->'to') IS DISTINCT FROM 'string'
  OR jsonb_typeof(p_payload->'transition_date') IS DISTINCT FROM 'string' OR jsonb_typeof(p_payload->'fields') IS DISTINCT FROM 'object'
  OR jsonb_typeof(p_payload->'skip_reason') IS DISTINCT FROM 'string' OR jsonb_typeof(p_payload->'memo') IS DISTINCT FROM 'string'
  OR jsonb_typeof(p_payload->'note') IS DISTINCT FROM 'string'
 THEN RAISE EXCEPTION 'invalid structured transition payload' USING ERRCODE='22023'; END IF;
 from_value:=p_payload->>'from';to_value:=p_payload->>'to';fields_value:=p_payload->'fields';
 skip_value:=trim(p_payload->>'skip_reason');memo_value:=trim(p_payload->>'memo');note_value:=trim(p_payload->>'note');
 IF length(skip_value)>2000 OR length(memo_value)>8000 OR length(note_value)<1 OR length(note_value)>16000
  OR p_payload->>'transition_date' !~ '^\d{4}-\d{2}-\d{2}$'
 THEN RAISE EXCEPTION 'invalid structured transition payload' USING ERRCODE='22023'; END IF;
 BEGIN transition_value:=(p_payload->>'transition_date')::date; EXCEPTION WHEN datetime_field_overflow THEN RAISE EXCEPTION 'invalid transition date' USING ERRCODE='22023'; END;
 IF transition_value::text<>p_payload->>'transition_date' OR transition_value>(clock_timestamp() AT TIME ZONE 'Asia/Seoul')::date
 THEN RAISE EXCEPTION 'invalid transition date' USING ERRCODE='22023'; END IF;
 IF from_value IN ('won','lost','badfit','badfit_lead','badfit_pipe','nocontact') OR to_value IN ('won','lost','badfit','badfit_lead','badfit_pipe','nocontact') OR from_value=to_value
  OR to_value NOT IN ('first_contact','consulting','sent','rapport','silent','waiting','compete','imminent','bidding','contract','construction','completion')
 THEN RAISE EXCEPTION 'terminal or invalid transition is not connected' USING ERRCODE='22023'; END IF;
 standard:=CASE from_value
  WHEN 'first_contact' THEN to_value='consulting' WHEN 'consulting' THEN to_value='sent'
  WHEN 'sent' THEN to_value IN ('rapport','silent','compete') WHEN 'rapport' THEN to_value IN ('silent','compete')
  WHEN 'silent' THEN to_value IN ('rapport','compete') WHEN 'compete' THEN to_value IN ('imminent','bidding')
  WHEN 'imminent' THEN to_value IN ('bidding','contract') WHEN 'bidding' THEN to_value='contract'
  WHEN 'contract' THEN to_value='construction' WHEN 'construction' THEN to_value='completion'
  WHEN 'waiting' THEN to_value IN ('first_contact','rapport','silent') ELSE false END;
 IF to_value<>'waiting' AND NOT standard AND length(skip_value)<5
 THEN RAISE EXCEPTION 'transition exception reason is required' USING ERRCODE='22023'; END IF;
 PERFORM crm_security.crm_transition_validate_v1(to_value,fields_value,transition_value);
 canonical:=jsonb_build_object('from',from_value,'to',to_value,'transition_date',transition_value,'fields',fields_value,'skip_reason',skip_value,'memo',memo_value,'note',note_value);

 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;
 PERFORM 1 FROM public.users u WHERE u.auth_uid=auth.uid() FOR SHARE;
 PERFORM 1 FROM crm_security.access_review r WHERE r.reviewed_auth_uid=auth.uid() FOR SHARE;
 SELECT * INTO a FROM crm_security.actor();IF NOT FOUND THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;
 PERFORM 1 FROM crm_security.object_scope s WHERE s.user_id=a.user_id AND s.deal_id=p_object_id FOR SHARE;
 SELECT * INTO oldrow FROM public.deals d WHERE d.id=p_object_id FOR UPDATE;
 IF NOT FOUND OR a.permission_role NOT IN ('rep','branch','admin') OR NOT crm_security.can_deal(p_object_id,true)
 THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;

 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(a.auth_uid::text||p_request_id::text,0));
 SELECT * INTO receipt FROM crm_security.command_receipts r WHERE r.actor_auth_uid=a.auth_uid AND r.request_id=p_request_id;
 IF FOUND THEN
  IF receipt.actor_user_id IS DISTINCT FROM a.user_id OR receipt.operation IS DISTINCT FROM 'transition'
   OR receipt.object_id IS DISTINCT FROM p_object_id OR receipt.expected_version IS DISTINCT FROM p_expected_version OR receipt.payload IS DISTINCT FROM canonical
  THEN RAISE EXCEPTION 'REQUEST_ID_REUSE' USING ERRCODE='PT409'; END IF;
  RETURN receipt.ack||jsonb_build_object('replayed',true);
 END IF;
 IF oldrow.version IS DISTINCT FROM p_expected_version THEN RAISE EXCEPTION 'version conflict' USING ERRCODE='PT409'; END IF;
 IF oldrow.stage_code IS DISTINCT FROM from_value OR oldrow.outcome IS NOT NULL OR oldrow.lifecycle_status='closed'
 THEN RAISE EXCEPTION 'stage state conflict' USING ERRCODE='PT409'; END IF;
 IF jsonb_typeof(oldrow.stage_contexts) IS DISTINCT FROM 'object'
 THEN RAISE EXCEPTION 'stage contexts state conflict' USING ERRCODE='PT409'; END IF;
 IF to_value='sent' AND (fields_value->'materials') ? '견적서' AND NOT EXISTS(
  SELECT 1 FROM crm_security.quote_versions q WHERE q.deal_id=p_object_id AND q.version_no=(fields_value->>'quote_version')::integer)
 THEN RAISE EXCEPTION 'quote version not found' USING ERRCODE='22023'; END IF;

 server_at:=clock_timestamp();effective_at:=transition_value::timestamp AT TIME ZONE 'Asia/Seoul';
 group_value:=CASE WHEN to_value IN ('first_contact','consulting') THEN 'design' WHEN to_value='sent' THEN 'sent' WHEN to_value IN ('rapport','silent','waiting') THEN 'rel' WHEN to_value IN ('compete','imminent','bidding') THEN 'comp' ELSE 'con' END;
 lifecycle_value:=CASE WHEN to_value='waiting' THEN 'parked' ELSE 'active' END;
 contexts:=jsonb_set(coalesce(oldrow.stage_contexts,'{}'::jsonb),ARRAY[to_value],jsonb_build_object('transition_date',transition_value,'skip_reason',skip_value,'memo',memo_value,'fields',fields_value,'from',from_value,'to',to_value,'recorded_at',server_at,'actor',a.display_name,'terminal',false),true);
 next_due:=CASE WHEN to_value='sent' THEN nullif(fields_value->>'followup_date','')::date WHEN to_value IN ('rapport','silent','waiting') THEN nullif(fields_value->>'contact_date','')::date ELSE NULL END;
 next_title:=CASE WHEN next_due IS NULL THEN NULL WHEN to_value='sent' THEN '발송자료 검토 여부 확인' ELSE '고객 재접촉' END;
 SELECT u.email,u.name INTO actor_email_value,owner_name_value FROM public.users u WHERE u.user_id=a.user_id;
 IF next_due IS NOT NULL THEN
  SELECT coalesce(jsonb_agg(id ORDER BY created_at),'[]'::jsonb) INTO cancelled_ids FROM public.next_actions WHERE deal_id=p_object_id AND status='open';
  UPDATE public.next_actions SET status='cancelled',updated_at=server_at WHERE deal_id=p_object_id AND status='open';
  SELECT coalesce(u.name,oldrow.assignee_name) INTO owner_name_value FROM public.users u WHERE u.user_id=oldrow.owner_id;
  IF owner_name_value IS NULL THEN RAISE EXCEPTION 'No approved UUID owner' USING ERRCODE='42501'; END IF;
  INSERT INTO public.next_actions(deal_id,action_type,title,due_at,assignee_name,status,created_at,updated_at)
  VALUES(p_object_id,'후속접촉',next_title,next_due::timestamp AT TIME ZONE 'Asia/Seoul',owner_name_value,'open',server_at,server_at) RETURNING id INTO next_id;
 END IF;
 INSERT INTO public.stage_history(opportunity_id,from_stage,to_stage,reason,actor_id,actor_name,changed_at)
 VALUES(p_object_id,from_value,to_value,coalesce(nullif(skip_value,''),note_value),a.user_id,a.display_name,effective_at) RETURNING id INTO history_id;
 INSERT INTO public.activities(deal_id,organization_id,actor_email,actor_name,type,detail,occurred_at)
 VALUES(p_object_id,oldrow.organization_id,actor_email_value,a.display_name,'단계전환',jsonb_build_object('note',to_value,'result',note_value,'from_stage',from_value,'to_stage',to_value,'meaningful_contact',false),effective_at) RETURNING id INTO activity_id;
 INSERT INTO crm_security.stage_transition_events(request_id,deal_id,from_stage,to_stage,transition_date,fields,skip_reason,memo,actor_auth_uid,actor_user_id,recorded_at,stage_history_id,activity_id,next_action_id)
 VALUES(p_request_id,p_object_id,from_value,to_value,transition_value,fields_value,nullif(skip_value,''),nullif(memo_value,''),a.auth_uid,a.user_id,server_at,history_id,activity_id,next_id) RETURNING event_id INTO transition_event_id;
 UPDATE public.deals SET stage_code=to_value,stage_raw=to_value,stage_group=group_value,lifecycle_status=lifecycle_value,
  stage_entered_at=effective_at,stage_contexts=contexts,last_activity_at=effective_at,
  next_action=CASE WHEN next_id IS NULL THEN next_action ELSE next_title END,
  next_action_date=CASE WHEN next_id IS NULL THEN next_action_date ELSE next_due END,
  updated_at=server_at,version=version+1
 WHERE id=p_object_id AND version=p_expected_version RETURNING * INTO newrow;
 IF NOT FOUND THEN RAISE EXCEPTION 'unexpected version mutation' USING ERRCODE='PT409'; END IF;
 INSERT INTO crm_security.audit_events(actor_auth_uid,actor_user_id,actor_name,deal_id,action,before_data,after_data,reason,created_at)
 VALUES(a.auth_uid,a.user_id,a.display_name,p_object_id,'transition',
  jsonb_build_object('version',oldrow.version,'stage_code',oldrow.stage_code,'stage_group',oldrow.stage_group,'lifecycle_status',oldrow.lifecycle_status,'next_action',oldrow.next_action,'next_action_date',oldrow.next_action_date),
  jsonb_build_object('version',newrow.version,'stage_code',newrow.stage_code,'stage_group',newrow.stage_group,'lifecycle_status',newrow.lifecycle_status,'transition_event_id',transition_event_id,'stage_history_id',history_id,'activity_id',activity_id,'next_action_id',next_id,'cancelled_action_ids',cancelled_ids,'next_action',newrow.next_action,'next_action_date',newrow.next_action_date),
  coalesce(nullif(skip_value,''),note_value),server_at) RETURNING event_id INTO audit_id;
 ack:=jsonb_build_object('contract_version',1,'ok',true,'request_id',p_request_id,'operation','transition','object_id',p_object_id,
  'actor_auth_uid',a.auth_uid,'actor_user_id',a.user_id,'previous_version',p_expected_version,'version',newrow.version,
  'from_stage',from_value,'to_stage',to_value,'transition_date',transition_value,'stage_entered_at',effective_at,
  'stage_contexts',newrow.stage_contexts,'transition_event_id',transition_event_id,'stage_history_id',history_id,
  'activity_id',activity_id,'next_action_id',next_id,'cancelled_action_ids',cancelled_ids,'audit_event_id',audit_id,'server_at',server_at,'replayed',false);
 INSERT INTO crm_security.command_receipts(actor_auth_uid,request_id,actor_user_id,operation,object_id,expected_version,payload,ack)
 VALUES(a.auth_uid,p_request_id,a.user_id,'transition',p_object_id,p_expected_version,canonical,ack);
 RETURN ack;
END $fn$;

REVOKE EXECUTE ON FUNCTION crm_security.crm_deal_transition_command_v1(uuid,uuid,integer,jsonb) FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION crm_security.crm_operational_source_fragment_v1(
 p_domain text,p_after uuid,p_limit integer
) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $fn$
DECLARE raw_items jsonb; items jsonb; next_cursor uuid; has_more boolean; a record;
BEGIN
 SELECT * INTO a FROM crm_security.actor();
 IF NOT FOUND THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;
 IF p_domain NOT IN ('deal_core','inquiry_core')
 THEN RAISE EXCEPTION 'unsupported operational source domain' USING ERRCODE='22023'; END IF;
 IF p_limit IS NULL OR p_limit<1 OR p_limit>100
 THEN RAISE EXCEPTION 'invalid limit' USING ERRCODE='22023'; END IF;

 IF p_domain='deal_core' THEN
  SELECT coalesce(jsonb_agg(to_jsonb(q) ORDER BY q.id),'[]'::jsonb) INTO raw_items FROM(
   SELECT d.id,d.site_id,
    coalesce(s.site_name,o.name,nullif(d.list_fields->>'site_name',''),nullif(d.list_fields->>'name','')) AS site_name,
    coalesce(s.site_name,o.name,nullif(d.list_fields->>'site_name',''),nullif(d.list_fields->>'name','')) AS site,
    d.owner_id,coalesce(u.name,d.assignee_name) AS owner_name,coalesce(u.name,d.assignee_name) AS assignee,
    d.stage_code,d.stage_raw,d.stage_group,d.brand,d.list_name,
    d.amount,d.amount AS amt,d.amount_unknown_reason,
    d.created_at,d.created_at AS created,d.updated_at,d.updated_at AS updated,d.closed_at,d.closed_at AS closed,d.opened_at,
    d.lifecycle_status,d.outcome,d.wake_up_at,d.stage_entered_at,
    d.last_activity_at,d.last_activity_at AS "lastActivity",d.last_customer_contact_at,
    d.stage_entered_at AS "stageAt",d.origin_inquiry_id,d.origin_channel,
    d.source,d.outbound_channel,d.lost_reason,d.lost_kind,d.badfit_type,
    d.service_type,d.service_history,d.origin_business,d.current_business,d.business_history,
    d.primary_work,d.work_items,d.work_scope_type,d.work_summary,d.stage_checklist,d.stage_contexts,d.version,
    s.address,
    d.office_phone,d.office_email,d.manager_name,d.manager_mobile,d.manager_role,d.person_key,
    d.manager_current_site,d.manager_started_at,d.manager_status,d.manager_left_at,
    (SELECT q.amount FROM crm_security.quote_versions q WHERE q.deal_id=d.id ORDER BY q.version_no DESC LIMIT 1) AS quote_amount,
    coalesce((SELECT jsonb_agg(jsonb_build_object('version_no',q.version_no,'amount',q.amount,'reason',q.reason,'created_at',q.created_at) ORDER BY q.version_no)
     FROM crm_security.quote_versions q WHERE q.deal_id=d.id),'[]'::jsonb) AS quote_versions,
    coalesce(nullif(d.manager_mobile,''),nullif(d.office_phone,''),nullif(c.mobile,''),nullif(c.phone,'')) AS call_phone,
    (coalesce(nullif(d.manager_mobile,''),nullif(d.office_phone,''),nullif(c.mobile,''),nullif(c.phone,'')) IS NOT NULL) AS has_contact,
    CASE WHEN c.id IS NULL THEN '[]'::jsonb ELSE jsonb_build_array(jsonb_build_object(
     'id',c.id,'person_key',c.person_key,'name',c.name,
     'role',coalesce(nullif(c.role,''),nullif(c.title,''),'담당자'),
     'phone',c.phone,'mobile',coalesce(c.mobile,c.phone),
     'current_site',coalesce(c.current_site,s.site_name),'office_phone',d.office_phone,
     'is_primary',true
    )) END AS contacts,
    coalesce(ps.favorite,false) AS favorite,ps.last_viewed_at,ps.last_worked_at,coalesce(ps.view_count,0) AS view_count,
    EXISTS(SELECT 1 FROM public.activities ac WHERE ac.deal_id=d.id) AS has_activity,
    (SELECT jsonb_build_object('id',n.id,'type',n.action_type,'text',n.title,'due_at',n.due_at,'assignee_name',n.assignee_name,'status',n.status)
     FROM public.next_actions n WHERE n.deal_id=d.id AND n.status='open'
     ORDER BY n.due_at NULLS LAST,n.id LIMIT 1) AS next_action,
    coalesce((SELECT jsonb_agg(jsonb_build_object('id',n.id,'type',n.action_type,'text',n.title,'due_at',n.due_at,'status',n.status,'completed_at',n.completed_at) ORDER BY n.due_at,n.id)
     FROM public.next_actions n WHERE n.deal_id=d.id AND n.status='completed'),'[]'::jsonb) AS completed_actions,
    coalesce((SELECT jsonb_agg(jsonb_build_object('from',h.from_stage,'to',h.to_stage,'at',h.changed_at,'changed_at',h.changed_at,'reason',h.reason,'actor',h.actor_name,'actor_id',h.actor_id) ORDER BY h.changed_at,h.id)
     FROM public.stage_history h WHERE h.opportunity_id=d.id),'[]'::jsonb) AS stage_history,
    coalesce((SELECT jsonb_agg(jsonb_build_object('id',ac.id,'type',ac.type,'occurred_at',ac.occurred_at) ORDER BY ac.occurred_at,ac.id)
     FROM public.activities ac WHERE ac.deal_id=d.id),'[]'::jsonb) AS activity_signals
   FROM public.deals d
   LEFT JOIN public.sites s ON s.site_id=d.site_id
   LEFT JOIN public.organizations o ON o.id=d.organization_id
   LEFT JOIN public.users u ON u.user_id=d.owner_id
   LEFT JOIN public.contacts c ON c.id=d.contact_id
   LEFT JOIN crm_security.user_opportunity_state ps ON ps.actor_user_id=a.user_id AND ps.deal_id=d.id
   WHERE crm_security.can_deal(d.id,false) AND (p_after IS NULL OR d.id>p_after)
   ORDER BY d.id LIMIT p_limit+1
  )q;
 ELSE
  SELECT coalesce(jsonb_agg(to_jsonb(q) ORDER BY q.id),'[]'::jsonb) INTO raw_items FROM(
   SELECT i.id,i.site_id,i.site_name,i.brand,i.inquiry_type,i.work_type,i.source_channel,i.channel,
    i.assigned_to,coalesce(u.name,i.assignee_name) AS assignee_name,ar.permission_role AS assignee_permission_role,
    i.status,i.deal_id,i.opportunity_id,i.received_at,i.created_at,i.updated_at,i.assigned_at,
    i.first_response_at,i.responded_at,i.next_action_date,i.contact_name,i.phone
   FROM public.inquiries i
   LEFT JOIN public.users u ON u.user_id=i.assigned_to
   LEFT JOIN crm_security.access_review ar ON ar.user_id=i.assigned_to AND ar.approved AND ar.expires_at>now()
   WHERE crm_security.can_inquiry(i.id) AND (p_after IS NULL OR i.id>p_after)
   ORDER BY i.id LIMIT p_limit+1
  )q;
 END IF;

 has_more:=jsonb_array_length(raw_items)>p_limit;
 items:=CASE WHEN has_more THEN raw_items-p_limit ELSE raw_items END;
 next_cursor:=CASE WHEN has_more AND jsonb_array_length(items)>0
  THEN (items->(jsonb_array_length(items)-1)->>'id')::uuid ELSE NULL END;
 RETURN jsonb_build_object(
  'contract_version',1,'resource','operational_source','domain',p_domain,
  'scope_completeness','actor_authorized_rows_only',
  'actor_user_id',a.user_id,'actor_permission_role',a.permission_role,
  'items',items,'pagination',jsonb_build_object(
   'completeness',CASE WHEN has_more THEN 'partial' ELSE 'complete' END,
   'has_more',has_more,'next_cursor',next_cursor));
END $fn$;


REVOKE EXECUTE ON FUNCTION crm_security.crm_operational_source_fragment_v1(text,uuid,integer) FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION public.crm_write_command_v2(p_request_id uuid,p_operation text,p_object_id uuid,p_expected_version integer,p_payload jsonb)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $fn$
BEGIN
 IF p_operation='transition' THEN RETURN crm_security.crm_deal_transition_command_v1(p_request_id,p_object_id,p_expected_version,p_payload); END IF;
 RETURN crm_security.crm_write_command_v2_stage_check_20260906(p_request_id,p_operation,p_object_id,p_expected_version,p_payload);
END $fn$;
REVOKE EXECUTE ON FUNCTION public.crm_write_command_v2(uuid,text,uuid,integer,jsonb) FROM PUBLIC,anon,authenticated,service_role;GRANT EXECUTE ON FUNCTION public.crm_write_command_v2(uuid,text,uuid,integer,jsonb) TO authenticated;
DO $post$ DECLARE changed integer; BEGIN
 SELECT count(*) INTO changed FROM transition_source_guard g JOIN pg_proc p ON p.oid=g.oid WHERE p.prosrc IS DISTINCT FROM g.prosrc OR p.proconfig IS DISTINCT FROM g.proconfig OR coalesce(p.proacl::text,'') IS DISTINCT FROM g.acl;
 IF changed<>0 OR has_function_privilege('anon','public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)','EXECUTE') OR NOT has_function_privilege('authenticated','public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)','EXECUTE') OR has_function_privilege('service_role','public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)','EXECUTE')
  OR has_function_privilege('authenticated','crm_security.crm_deal_transition_command_v1(uuid,uuid,integer,jsonb)','EXECUTE') OR has_function_privilege('authenticated','crm_security.crm_transition_validate_v1(text,jsonb,date)','EXECUTE') OR has_table_privilege('authenticated','crm_security.stage_transition_events','SELECT') OR NOT (SELECT relrowsecurity FROM pg_class WHERE oid='crm_security.stage_transition_events'::regclass)
  OR (SELECT pg_get_constraintdef(oid,true) FROM pg_constraint WHERE conrelid='crm_security.command_receipts'::regclass AND conname='command_receipts_operation_check') IS DISTINCT FROM $expected$CHECK (operation = ANY (ARRAY['opportunity_work_set'::text, 'inquiry_assign'::text, 'service_change'::text, 'inquiry_unassign'::text, 'favorite_set'::text, 'opportunity_touch'::text, 'next_action'::text, 'activity'::text, 'quote_version'::text, 'next_action_complete'::text, 'stage_check'::text, 'transition'::text]))$expected$
 THEN RAISE EXCEPTION 'transition post-apply drift'; END IF;
END $post$;
COMMIT;
