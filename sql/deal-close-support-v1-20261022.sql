-- 지원 업무 종결 v1 (2026-10-22 회의록 10/1 '비수주 지원 업무 상태값': PT 지원 · 기술자문 지원처럼 수주 · 실주로 끝나지 않는 영업건을 '지원 업무 종결'로 닫는다)
--   · 새 종료값 outcome='support' · stage_code='support'(stage_raw '지원 업무 종결' · stage_group 'closed' · lifecycle closed) — 수주 · 실주 · 배드핏 · 연락두절과 같은 자리의 다섯째 종료.
--   · 메이드율(수주 ÷ (수주 + 실주))에서 빠진다(실주가 아님). 실주 사유 · 배드핏 유형 칸은 건드리지 않는다.
--   · 저장 경로는 기존과 같다: 화면 → crm_write_command_v2('close', payload{outcome:'support', …}) → 새 함수 crm_security.crm_deal_close_support_command_v1 (그 밖의 close 는 기존 함수 그대로).
--   · 지원 종류(category): PT 지원 · 기술자문 지원 · 자료 · 견적 지원 · 현장 확인 지원 · 기타. 지원 내용(detail) 5자 이상 필수. 열린 다음 할 일은 완료 처리(기존 종료와 같음).
--   · 다시 실행해도 안전하다(제약 재정의 · 함수 교체 · 전송 함수 이름 바꾸기는 한 번만).
BEGIN;

-- ① deals.outcome 허용값에 support
DO $do$
DECLARE c record;
BEGIN
 FOR c IN SELECT conname FROM pg_constraint WHERE conrelid='public.deals'::regclass AND contype='c' AND conname='deals_outcome_check' LOOP
  EXECUTE format('ALTER TABLE public.deals DROP CONSTRAINT %I',c.conname);
 END LOOP;
 ALTER TABLE public.deals ADD CONSTRAINT deals_outcome_check CHECK (outcome IS NULL OR outcome IN ('won','lost','badfit','nocontact','support'));
END $do$;

-- ② 종료 단계 = 닫힌 상태(2026-09-25 state-contract)에 support 추가
DO $do$
BEGIN
 IF EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid='public.deals'::regclass AND conname='deals_closed_stage_consistent') THEN
  ALTER TABLE public.deals DROP CONSTRAINT deals_closed_stage_consistent;
 END IF;
 ALTER TABLE public.deals ADD CONSTRAINT deals_closed_stage_consistent
  CHECK (stage_code IS NULL OR stage_code NOT IN ('won','lost','badfit_lead','badfit_pipe','nocontact','support') OR lifecycle_status='closed');
END $do$;

-- ③ 종료 기록(deal_close_events).outcome 허용값에 support
DO $do$
DECLARE c record;
BEGIN
 IF to_regclass('crm_security.deal_close_events') IS NULL THEN RAISE EXCEPTION 'crm_security.deal_close_events missing — close nonwon 이 먼저 설치돼야 합니다'; END IF;
 FOR c IN SELECT conname FROM pg_constraint WHERE conrelid='crm_security.deal_close_events'::regclass AND contype='c' AND pg_get_constraintdef(oid) ILIKE '%outcome%' LOOP
  EXECUTE format('ALTER TABLE crm_security.deal_close_events DROP CONSTRAINT %I',c.conname);
 END LOOP;
 ALTER TABLE crm_security.deal_close_events ADD CONSTRAINT deal_close_events_outcome_check CHECK (outcome IN ('lost','badfit','nocontact','support'));
END $do$;

-- ④ 지원 업무 종결 명령(실주 · 배드핏 종료 함수와 같은 검사 · 같은 기록, 값만 support)
CREATE OR REPLACE FUNCTION crm_security.crm_deal_close_support_command_v1(
 p_request_id uuid,p_object_id uuid,p_expected_version integer,p_payload jsonb
) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $fn$
DECLARE a record;receipt crm_security.command_receipts%ROWTYPE;oldrow public.deals%ROWTYPE;newrow public.deals%ROWTYPE;
 canonical jsonb;ack jsonb;audit_id uuid;close_event_id uuid;history_id uuid;activity_id uuid;
 from_value text;category_value text;detail_value text;source_value text;note_value text;
 closed_date_value date;server_at timestamptz;effective_at timestamptz;contexts jsonb;completed_ids jsonb:='[]'::jsonb;actor_email_value text;
BEGIN
 IF p_request_id IS NULL OR p_object_id IS NULL OR p_expected_version IS NULL OR p_expected_version<0 OR jsonb_typeof(p_payload) IS DISTINCT FROM 'object'
  OR EXISTS(SELECT 1 FROM jsonb_object_keys(p_payload) k WHERE k NOT IN ('from','outcome','closed_date','category','detail','reason_source','note'))
  OR NOT p_payload ?& ARRAY['from','outcome','closed_date','category','detail','reason_source','note']
  OR jsonb_typeof(p_payload->'from') IS DISTINCT FROM 'string' OR jsonb_typeof(p_payload->'outcome') IS DISTINCT FROM 'string'
  OR jsonb_typeof(p_payload->'category') IS DISTINCT FROM 'string' OR jsonb_typeof(p_payload->'detail') IS DISTINCT FROM 'string'
  OR jsonb_typeof(p_payload->'reason_source') IS DISTINCT FROM 'string' OR jsonb_typeof(p_payload->'note') IS DISTINCT FROM 'string'
  OR jsonb_typeof(p_payload->'closed_date') NOT IN ('string','null')
 THEN RAISE EXCEPTION 'invalid support close payload' USING ERRCODE='22023'; END IF;
 from_value:=p_payload->>'from';category_value:=trim(p_payload->>'category');detail_value:=trim(p_payload->>'detail');source_value:=trim(p_payload->>'reason_source');note_value:=trim(p_payload->>'note');
 IF p_payload->>'outcome'<>'support' OR from_value IN ('won','lost','badfit','badfit_lead','badfit_pipe','nocontact','support')
  OR length(category_value)<1 OR length(category_value)>500 OR length(detail_value)<5 OR length(detail_value)>8000 OR length(source_value)<1 OR length(source_value)>50 OR length(note_value)<1 OR length(note_value)>16000
 THEN RAISE EXCEPTION 'invalid support close payload' USING ERRCODE='22023'; END IF;
 IF category_value NOT IN ('PT 지원','기술자문 지원','자료 · 견적 지원','현장 확인 지원','기타') THEN RAISE EXCEPTION 'invalid close category' USING ERRCODE='22023'; END IF;
 IF p_payload->>'closed_date' IS NOT NULL THEN
  IF p_payload->>'closed_date' !~ '^\d{4}-\d{2}-\d{2}$' THEN RAISE EXCEPTION 'invalid close date' USING ERRCODE='22023'; END IF;
  BEGIN closed_date_value:=(p_payload->>'closed_date')::date;EXCEPTION WHEN datetime_field_overflow THEN RAISE EXCEPTION 'invalid close date' USING ERRCODE='22023';END;
  IF closed_date_value::text<>p_payload->>'closed_date' THEN RAISE EXCEPTION 'invalid close date' USING ERRCODE='22023'; END IF;
 END IF;
 canonical:=jsonb_build_object('from',from_value,'outcome','support','closed_date',closed_date_value,'category',category_value,'detail',detail_value,'reason_source',source_value,'note',note_value);
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501';END IF;
 PERFORM 1 FROM public.users u WHERE u.auth_uid=auth.uid() FOR SHARE;PERFORM 1 FROM crm_security.access_review r WHERE r.reviewed_auth_uid=auth.uid() FOR SHARE;
 SELECT * INTO a FROM crm_security.actor();IF NOT FOUND THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501';END IF;
 PERFORM 1 FROM crm_security.object_scope s WHERE s.user_id=a.user_id AND s.deal_id=p_object_id FOR SHARE;
 SELECT * INTO oldrow FROM public.deals d WHERE d.id=p_object_id FOR UPDATE;
 IF NOT FOUND OR a.permission_role NOT IN ('rep','branch','admin') OR NOT crm_security.can_deal(p_object_id,true) THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501';END IF;
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(a.auth_uid::text||p_request_id::text,0));
 SELECT * INTO receipt FROM crm_security.command_receipts r WHERE r.actor_auth_uid=a.auth_uid AND r.request_id=p_request_id;
 IF FOUND THEN
  IF receipt.actor_user_id IS DISTINCT FROM a.user_id OR receipt.operation IS DISTINCT FROM 'close' OR receipt.object_id IS DISTINCT FROM p_object_id OR receipt.expected_version IS DISTINCT FROM p_expected_version OR receipt.payload IS DISTINCT FROM canonical THEN RAISE EXCEPTION 'REQUEST_ID_REUSE' USING ERRCODE='PT409';END IF;
  RETURN receipt.ack||jsonb_build_object('replayed',true);
 END IF;
 IF oldrow.version IS DISTINCT FROM p_expected_version THEN RAISE EXCEPTION 'version conflict' USING ERRCODE='PT409';END IF;
 IF oldrow.stage_code IS DISTINCT FROM from_value OR oldrow.outcome IS NOT NULL OR oldrow.lifecycle_status='closed' THEN RAISE EXCEPTION 'close state conflict' USING ERRCODE='PT409';END IF;
 IF jsonb_typeof(oldrow.stage_contexts) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'stage contexts state conflict' USING ERRCODE='PT409';END IF;
 server_at:=clock_timestamp();closed_date_value:=coalesce(closed_date_value,(server_at AT TIME ZONE 'Asia/Seoul')::date);
 IF closed_date_value>(server_at AT TIME ZONE 'Asia/Seoul')::date THEN RAISE EXCEPTION 'future close date' USING ERRCODE='22023';END IF;
 effective_at:=closed_date_value::timestamp AT TIME ZONE 'Asia/Seoul';
 contexts:=jsonb_set(oldrow.stage_contexts,ARRAY['support'],jsonb_build_object('transition_date',closed_date_value,'fields',jsonb_build_object('close_reason',category_value,'close_detail',detail_value),'from',from_value,'to','support','recorded_at',server_at,'actor',a.display_name,'terminal',true,'reason_source',source_value),true);
 SELECT coalesce(jsonb_agg(id ORDER BY created_at),'[]'::jsonb) INTO completed_ids FROM public.next_actions WHERE deal_id=p_object_id AND status='open';
 UPDATE public.next_actions SET status='completed',completed_at=server_at,updated_at=server_at WHERE deal_id=p_object_id AND status='open';
 SELECT u.email INTO actor_email_value FROM public.users u WHERE u.user_id=a.user_id;
 INSERT INTO public.stage_history(opportunity_id,from_stage,to_stage,reason,actor_id,actor_name,changed_at) VALUES(p_object_id,from_value,'support',category_value||' · '||detail_value,a.user_id,a.display_name,effective_at) RETURNING id INTO history_id;
 INSERT INTO public.activities(deal_id,organization_id,actor_email,actor_name,type,detail,occurred_at) VALUES(p_object_id,oldrow.organization_id,actor_email_value,a.display_name,'종료',jsonb_build_object('note','support','result',note_value,'category',category_value,'detail',detail_value,'meaningful_contact',false),effective_at) RETURNING id INTO activity_id;
 INSERT INTO crm_security.deal_close_events(request_id,deal_id,from_stage,outcome,closed_date,category,detail,reason_source,actor_auth_uid,actor_user_id,recorded_at,stage_history_id,activity_id,completed_action_ids)
 VALUES(p_request_id,p_object_id,from_value,'support',closed_date_value,category_value,detail_value,source_value,a.auth_uid,a.user_id,server_at,history_id,activity_id,completed_ids) RETURNING event_id INTO close_event_id;
 UPDATE public.deals SET stage_code='support',stage_raw='지원 업무 종결',stage_group='closed',lifecycle_status='closed',outcome='support',closed_at=effective_at,stage_entered_at=effective_at,stage_contexts=contexts,last_activity_at=effective_at,
  next_action=NULL,next_action_date=NULL,updated_at=server_at,version=version+1 WHERE id=p_object_id AND version=p_expected_version RETURNING * INTO newrow;
 IF NOT FOUND THEN RAISE EXCEPTION 'unexpected version mutation' USING ERRCODE='PT409';END IF;
 INSERT INTO crm_security.audit_events(actor_auth_uid,actor_user_id,actor_name,deal_id,action,before_data,after_data,reason,created_at)
 VALUES(a.auth_uid,a.user_id,a.display_name,p_object_id,'close',jsonb_build_object('version',oldrow.version,'stage_code',oldrow.stage_code,'outcome',oldrow.outcome,'lifecycle_status',oldrow.lifecycle_status,'next_action',oldrow.next_action,'next_action_date',oldrow.next_action_date),jsonb_build_object('version',newrow.version,'stage_code',newrow.stage_code,'outcome',newrow.outcome,'lifecycle_status',newrow.lifecycle_status,'close_event_id',close_event_id,'stage_history_id',history_id,'activity_id',activity_id,'completed_action_ids',completed_ids),category_value||' · '||detail_value,server_at) RETURNING event_id INTO audit_id;
 ack:=jsonb_build_object('contract_version',1,'ok',true,'request_id',p_request_id,'operation','close','object_id',p_object_id,'actor_auth_uid',a.auth_uid,'actor_user_id',a.user_id,'previous_version',p_expected_version,'version',newrow.version,'from_stage',from_value,'stage_code',newrow.stage_code,'outcome',newrow.outcome,'lifecycle_status',newrow.lifecycle_status,'closed_at',newrow.closed_at,'stage_contexts',newrow.stage_contexts,'lost_reason',newrow.lost_reason,'lost_kind',newrow.lost_kind,'badfit_type',newrow.badfit_type,'close_event_id',close_event_id,'stage_history_id',history_id,'activity_id',activity_id,'completed_action_ids',completed_ids,'audit_event_id',audit_id,'server_at',server_at,'replayed',false);
 INSERT INTO crm_security.command_receipts(actor_auth_uid,request_id,actor_user_id,operation,object_id,expected_version,payload,ack) VALUES(a.auth_uid,p_request_id,a.user_id,'close',p_object_id,p_expected_version,canonical,ack);
 RETURN ack;
END $fn$;
REVOKE EXECUTE ON FUNCTION crm_security.crm_deal_close_support_command_v1(uuid,uuid,integer,jsonb) FROM PUBLIC,anon,authenticated,service_role;

-- ⑤ 전송 함수: close + outcome=support 만 새 함수로, 나머지는 지금 함수 그대로(이름만 뒤로 보낸다 — 기존 겹 쌓기 방식과 같음)
DO $do$
BEGIN
 IF to_regprocedure('crm_security.crm_write_command_v2_pre_support_20261022(uuid,text,uuid,integer,jsonb)') IS NULL THEN
  ALTER FUNCTION public.crm_write_command_v2(uuid,text,uuid,integer,jsonb) SET SCHEMA crm_security;
  ALTER FUNCTION crm_security.crm_write_command_v2(uuid,text,uuid,integer,jsonb) RENAME TO crm_write_command_v2_pre_support_20261022;
  REVOKE ALL ON FUNCTION crm_security.crm_write_command_v2_pre_support_20261022(uuid,text,uuid,integer,jsonb) FROM PUBLIC,anon,authenticated;
 END IF;
END $do$;
CREATE OR REPLACE FUNCTION public.crm_write_command_v2(p_request_id uuid,p_operation text,p_object_id uuid,p_expected_version integer,p_payload jsonb)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $fn$
BEGIN
 IF p_operation='close' AND jsonb_typeof(p_payload) = 'object' AND p_payload->>'outcome'='support' THEN
  RETURN crm_security.crm_deal_close_support_command_v1(p_request_id,p_object_id,p_expected_version,p_payload);
 END IF;
 RETURN crm_security.crm_write_command_v2_pre_support_20261022(p_request_id,p_operation,p_object_id,p_expected_version,p_payload);
END $fn$;
REVOKE ALL ON FUNCTION public.crm_write_command_v2(uuid,text,uuid,integer,jsonb) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.crm_write_command_v2(uuid,text,uuid,integer,jsonb) TO authenticated;

COMMIT;
