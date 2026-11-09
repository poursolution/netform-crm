-- 잔디 응대 페이지(n8n) → CRM: 연락 결과 · 견적 발송일까지 이어 받기 (2026-11-09)
-- 왜: 담당자는 CRM 화면이 아니라 잔디 알림 링크(n8n 응대 페이지)에 첫 통화 결과를 적는다.
--     지금은 그 저장이 CRM 에 '상태 · 응대내용'만 남기고, 첫 시도 · 첫 연결 칸과 견적 발송은 비어
--     10/1 이후 견적문의 43건의 첫 시도 · 첫 연결 기록 0건, 영업건 전환 0건이었다.
-- 무엇을: n8n 이 이미 부르는 crm_inquiry_change_enqueue_v1(kind=response) 본문에 세 칸을 더 받는다(모두 선택).
--   contact_result  '연결됨' · '회신 받음' · '부재' · '번호 오류' · '문자'
--                   → CRM 연락 결과 기록(crm_security.inquiry_contact_logs) 한 줄 + first_attempt_at / first_connected_at (CRM 화면의 연락 결과 저장과 같은 규칙)
--                     연결됨 → 연결됨(접촉) · 회신 받음 → 고객 회신(접촉) · 부재 → 부재(시도) · 번호 오류 → 번호오류(시도)
--                     문자 → 채널 '문자' · 결과 '회신대기'(CRM 규칙: 보냈지만 답 없음 = 시도 횟수에도 접촉에도 안 넣음)
--   quote_sent_on   견적 보낸 날(YYYY-MM-DD, 보냈을 때만) → CRM '견적 발송 완료'와 같은 처리
--                     상태 '견적서 발송완료' · 보낸 날 + 7일 '고객 반응 확인' 할 일 · 전환 기준(qualified_by=quote_sent)
--                     · 파이프라인 '컨설팅 설계'(consulting) 영업건 자동 생성(매뉴얼 '방문 · 견적으로 넘기기')
--   quote_amount    견적 금액(원, 선택). 있으면 견적 버전으로 남기고 영업건 예상금액으로 넘긴다. 없으면 영업건 금액은 비워 둔다.
-- 지키는 것
--   · 세 칸이 없으면 지금과 똑같이 동작한다(기존 n8n 그대로 둬도 깨지지 않음).
--   · 연락 결과 · 견적 기록이 실패하면 응대 저장 전체가 지금처럼 재시도/검토로 간다(반쪽 저장 없음).
--   · 영업건 자동 생성만은 막혀도(현장 이름이 애매함 · 담당이 승인된 본사 영업이 아님 등) 응대 · 연락 결과 · 견적은 저장하고,
--     문의는 '전환 기준 충족'으로 남아 CRM 전환 대기 목록에서 넘길 수 있다. 이유는 이벤트 reason / 문의 이력에 남는다.
--   · 기록의 주인은 그 문의의 담당자(n8n 응대 페이지는 담당자 개인 링크). 담당이 없거나 CRM 로그인이 없으면 연락 결과 · 견적은 건너뛰고 검토로 남긴다.
--   · 이미 전환 · 종결된 문의는 기존 규칙(CONVERTED_REVIEW · CLOSED_REVIEW)대로 손대지 않는다.
--   · 과거 기록을 짐작으로 채우지 않는다(소급 없음). 고객 연락처를 새로 저장하거나 밖으로 보내지 않는다.
-- 어떻게: 지금 운영에 설치된 enqueue / apply 함수 본문을 읽어 정해진 한 줄씩만 덧붙여 다시 만든다(20261005030110 과 같은 방식).
--         바꿀 자리가 정확히 1곳이 아니거나 필요한 표 · 칸이 없으면 아무것도 바꾸지 않고 멈춘다. 이미 바뀌어 있으면 건너뛴다.
-- 되돌리기: 아래 두 함수 본문에서 'inquiry_external_flow_v1' 표시가 붙은 한 줄씩을 빼고 다시 만들면 된다(새 함수 3개는 남아도 무해).

DO $guard$
BEGIN
 IF to_regprocedure('public.crm_inquiry_change_enqueue_v1(jsonb)') IS NULL
  OR to_regprocedure('public.crm_inquiry_change_apply_v1(text)') IS NULL
  OR to_regclass('private.inquiry_change_events') IS NULL
  OR to_regclass('crm_security.inquiry_flow_state') IS NULL
  OR to_regclass('crm_security.inquiry_contact_logs') IS NULL
  OR to_regclass('crm_security.inquiry_quote_versions') IS NULL
  OR to_regclass('crm_security.schedules') IS NULL
  OR to_regclass('crm_security.inquiry_audit_events') IS NULL
  OR to_regclass('crm_security.access_review') IS NULL
  OR to_regclass('crm_security.audit_events') IS NULL
  OR to_regclass('public.stage_history') IS NULL
  OR to_regclass('public.activities') IS NULL
  OR to_regclass('public.sites') IS NULL
  OR to_regprocedure('crm_security.inquiry_contact_kind(text)') IS NULL
  OR to_regprocedure('crm_security.crm_site_common_key_v1(text)') IS NULL
  OR to_regprocedure('crm_security.crm_site_pc_key_v1(text)') IS NULL
  OR to_regprocedure('crm_security.crm_site_mobile_key_v1(text)') IS NULL
  OR NOT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='crm_security' AND table_name='inquiry_contact_logs' AND column_name='contact_result')
  OR NOT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='deals' AND column_name='origin_inquiry_id')
  OR NOT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='deals' AND column_name='stage_group')
 THEN RAISE EXCEPTION 'inquiry_external_flow_v1 prerequisites missing; review before applying'; END IF;
END $guard$;

-- 1) 받는 칸 검사(enqueue 단계). 틀리면 이벤트를 받지 않고 n8n 에 오류를 돌려준다.
CREATE OR REPLACE FUNCTION private.inquiry_external_flow_validate_v1(p jsonb)
RETURNS void LANGUAGE plpgsql STABLE SET search_path='' AS $fn$
DECLARE v_label text; v_day date; v_today date:=(pg_catalog.now() AT TIME ZONE 'Asia/Seoul')::date; v_amount text;
BEGIN
 IF p ? 'contact_result' THEN
  IF jsonb_typeof(p->'contact_result') NOT IN ('string','null') THEN RAISE EXCEPTION 'INVALID_CONTACT_RESULT'; END IF;
  v_label:=nullif(btrim(coalesce(p->>'contact_result','')),'');
  IF v_label IS NOT NULL AND v_label NOT IN ('연결됨','회신 받음','부재','번호 오류','문자') THEN RAISE EXCEPTION 'INVALID_CONTACT_RESULT'; END IF;
 END IF;
 IF p ? 'quote_sent_on' THEN
  IF jsonb_typeof(p->'quote_sent_on') NOT IN ('string','null') THEN RAISE EXCEPTION 'INVALID_QUOTE_DATE'; END IF;
  IF nullif(p->>'quote_sent_on','') IS NOT NULL THEN
   IF (p->>'quote_sent_on') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' THEN RAISE EXCEPTION 'INVALID_QUOTE_DATE'; END IF;
   BEGIN v_day:=(p->>'quote_sent_on')::date; EXCEPTION WHEN others THEN RAISE EXCEPTION 'INVALID_QUOTE_DATE'; END;
   IF v_day>v_today OR v_day<v_today-366 THEN RAISE EXCEPTION 'INVALID_QUOTE_DATE'; END IF;
   IF coalesce(p->>'status','') IN ('배드핏','연락두절','수주','실주','종결','종료') THEN RAISE EXCEPTION 'QUOTE_ON_CLOSED_STATUS'; END IF;
  END IF;
 END IF;
 IF p ? 'quote_amount' AND nullif(p->>'quote_amount','') IS NOT NULL THEN
  IF jsonb_typeof(p->'quote_amount') NOT IN ('string','number') THEN RAISE EXCEPTION 'INVALID_QUOTE_AMOUNT'; END IF;
  v_amount:=p->>'quote_amount';
  IF v_amount !~ '^[0-9]{1,13}$' OR v_amount::bigint<=0 OR v_amount::bigint>1000000000000 THEN RAISE EXCEPTION 'INVALID_QUOTE_AMOUNT'; END IF;
  IF nullif(p->>'quote_sent_on','') IS NULL THEN RAISE EXCEPTION 'QUOTE_AMOUNT_WITHOUT_DATE'; END IF;
 END IF;
END $fn$;

-- 2) 영업건 자동 생성(파이프라인 '컨설팅 설계'). 막히면 오류를 내지 않고 이유만 돌려준다.
CREATE OR REPLACE FUNCTION private.inquiry_external_promote_v1(p_inquiry_id uuid,p_event_id text)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $fn$
DECLARE
 q public.inquiries%ROWTYPE; o record; server_at timestamptz:=clock_timestamp(); common_key text; site_ids uuid[];
 site_target uuid; broad_count integer; deal_target uuid:=gen_random_uuid(); amount_value bigint;
 history_id uuid; activity_id uuid; reason_value text:='견적 발송완료로 파이프라인 인계';
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended('inquiry-pipeline:'||p_inquiry_id::text,0));
 SELECT * INTO q FROM public.inquiries i WHERE i.id=p_inquiry_id FOR UPDATE;
 IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'reason','INQUIRY_NOT_FOUND'); END IF;
 IF q.deal_id IS NOT NULL OR q.opportunity_id IS NOT NULL OR EXISTS(SELECT 1 FROM public.deals d WHERE d.origin_inquiry_id=q.id)
 THEN RETURN jsonb_build_object('ok',true,'reason','ALREADY_LINKED'); END IF;
 IF coalesce(q.brand,'')='기술자문' OR coalesce(q.inquiry_type,'') ~ '기술자문' THEN RETURN jsonb_build_object('ok',false,'reason','TECHNICAL_ADVISORY'); END IF;
 IF coalesce(q.status,'') IN ('수주','실주','배드핏','연락두절','종결','종료') THEN RETURN jsonb_build_object('ok',false,'reason','CLOSED'); END IF;
 -- CRM 전환 명령과 같은 기준: 담당이 승인된 본사 영업(rep)일 때만
 SELECT u.user_id,u.name,u.email,u.auth_uid,r.permission_role INTO o
 FROM public.users u JOIN crm_security.access_review r ON r.user_id=u.user_id AND r.reviewed_auth_uid=u.auth_uid
 WHERE u.user_id=q.assigned_to AND u.active AND u.auth_uid IS NOT NULL AND r.source_role=u.role AND r.approved AND r.expires_at>server_at;
 IF NOT FOUND OR o.permission_role<>'rep' THEN RETURN jsonb_build_object('ok',false,'reason','OWNER_NOT_APPROVED_REP'); END IF;
 -- 현장: 문의에 연결된 현장이 있으면 그대로, 없으면 이름이 정확히 하나로 맞을 때만. 애매하면 사람이 고르게 남긴다.
 IF q.site_id IS NOT NULL THEN
  SELECT s.site_id INTO site_target FROM public.sites s WHERE s.site_id=q.site_id FOR UPDATE;
  IF site_target IS NULL THEN RETURN jsonb_build_object('ok',false,'reason','SITE_NOT_FOUND'); END IF;
 ELSE
  common_key:=crm_security.crm_site_common_key_v1(coalesce(q.site_name,''));
  IF coalesce(common_key,'')='' THEN RETURN jsonb_build_object('ok',false,'reason','EMPTY_SITE_NAME'); END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('site:'||common_key,0));
  SELECT array_agg(s.site_id ORDER BY s.site_id) INTO site_ids FROM public.sites s WHERE crm_security.crm_site_common_key_v1(s.site_name)=common_key;
  IF coalesce(array_length(site_ids,1),0)>1 THEN RETURN jsonb_build_object('ok',false,'reason','SITE_NORMALIZATION_AMBIGUOUS'); END IF;
  IF coalesce(array_length(site_ids,1),0)=1 THEN site_target:=site_ids[1];
  ELSE
   SELECT count(*) INTO broad_count FROM public.sites s WHERE
    crm_security.crm_site_pc_key_v1(s.site_name)=crm_security.crm_site_pc_key_v1(q.site_name)
    OR crm_security.crm_site_mobile_key_v1(s.site_name)=crm_security.crm_site_mobile_key_v1(q.site_name)
    OR s.norm_name='crm:v1:'||common_key;
   IF broad_count>0 THEN RETURN jsonb_build_object('ok',false,'reason','SITE_MATCH_REQUIRES_EXPLICIT_SELECTION'); END IF;
   INSERT INTO public.sites(site_name,norm_name,address) VALUES(q.site_name,'crm:v1:'||common_key,q.address) RETURNING site_id INTO site_target;
  END IF;
 END IF;
 SELECT v.amount INTO amount_value FROM crm_security.inquiry_quote_versions v
  WHERE v.inquiry_id=q.id AND v.sent_at IS NOT NULL ORDER BY v.version_no DESC LIMIT 1;
 INSERT INTO public.deals(id,brand,list_name,stage_code,stage_raw,stage_group,assignee_name,assignee_email,amount,
  source,list_fields,created_at,updated_at,site_id,owner_id,origin_inquiry_id,lifecycle_status,stage_entered_at,
  last_activity_at,opened_at,version,service_type,origin_business,current_business)
 VALUES(deal_target,q.brand,q.brand,'consulting','consulting','design',o.name,o.email,amount_value,
  'inquiry_promotion',jsonb_strip_nulls(jsonb_build_object('work_name',q.work_type,'create_surface','n8n',
   'client_ref','n8n:'||p_event_id,'promotion_mode','auto')),server_at,server_at,
  site_target,o.user_id,q.id,'active',server_at,server_at,server_at,1,q.brand,q.brand,q.brand);
 UPDATE public.inquiries SET qualified_at=coalesce(qualified_at,server_at),updated_at=server_at WHERE id=q.id;
 INSERT INTO public.stage_history(opportunity_id,inquiry_id,from_stage,to_stage,reason,actor_id,actor_name,changed_at)
 VALUES(deal_target,q.id,NULL,'consulting',reason_value,o.user_id,o.name,server_at) RETURNING id INTO history_id;
 INSERT INTO public.activities(deal_id,actor_email,actor_name,type,detail,occurred_at)
 VALUES(deal_target,o.email,o.name,'파이프라인 인계',jsonb_build_object('note',reason_value,'result','신규 Deal 생성',
  'origin_inquiry_id',q.id,'promotion_mode','auto','source','잔디 응대 페이지','meaningful_contact',false),server_at) RETURNING id INTO activity_id;
 INSERT INTO crm_security.audit_events(actor_auth_uid,actor_user_id,actor_name,deal_id,action,before_data,after_data,reason,created_at)
 VALUES(o.auth_uid,o.user_id,o.name,deal_target,'inquiry_pipeline_promote',jsonb_build_object('inquiry_status',q.status,'stage_code',NULL,'version',0),
  jsonb_build_object('inquiry_id',q.id,'stage_code','consulting','version',1,'site_id',site_target,'owner_id',o.user_id,
   'stage_history_id',history_id,'activity_id',activity_id,'promotion_mode','auto','source','n8n','event_id',p_event_id),reason_value,server_at);
 INSERT INTO crm_security.inquiry_audit_events(actor_auth_uid,actor_user_id,inquiry_id,action,before_data,after_data,reason,created_at)
 VALUES(o.auth_uid,o.user_id,q.id,'inquiry_pipeline_promote',jsonb_build_object('status',q.status),
  jsonb_build_object('status',q.status,'deal_id',deal_target,'stage_code','consulting','stage_history_id',history_id,'activity_id',activity_id,'source','n8n','event_id',p_event_id),reason_value,server_at);
 RETURN jsonb_build_object('ok',true,'reason','PROMOTED','deal_id',deal_target,'stage_code','consulting','site_id',site_target);
END $fn$;

-- 3) 연락 결과 · 견적 발송 적용(apply 단계, 응대 저장과 같은 트랜잭션).
CREATE OR REPLACE FUNCTION private.inquiry_external_flow_apply_v1(p_inquiry_id uuid,p jsonb,p_event_id text,p_source_at timestamptz)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $fn$
DECLARE
 q public.inquiries%ROWTYPE; s crm_security.inquiry_flow_state%ROWTYPE; u record; lv crm_security.inquiry_quote_versions%ROWTYPE;
 v_at timestamptz:=clock_timestamp(); v_today date:=(clock_timestamp() AT TIME ZONE 'Asia/Seoul')::date;
 v_label text; v_channel text; v_contact text; v_result text; v_kind text; v_content text; v_rid uuid; v_log uuid; v_due date;
 v_day date; v_sent timestamptz; v_amount bigint; v_ver integer; v_follow date; v_next_id uuid; v_cancelled jsonb:='[]'::jsonb;
 flow jsonb:='{}'::jsonb; v_reason text:='RESPONSE_SYNCED'; conv jsonb; has_owner boolean;
BEGIN
 IF coalesce(nullif(current_setting('request.jwt.claim.role',true),''),
   nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'role','') <> 'service_role' THEN
  RAISE EXCEPTION 'SERVICE_ROLE_REQUIRED' USING ERRCODE='42501';
 END IF;
 v_label:=nullif(btrim(coalesce(p->>'contact_result','')),'');
 BEGIN v_day:=nullif(p->>'quote_sent_on','')::date; EXCEPTION WHEN others THEN RAISE EXCEPTION 'INVALID_QUOTE_DATE'; END;
 IF v_label IS NULL AND v_day IS NULL THEN RETURN jsonb_build_object('ok',true,'reason','RESPONSE_SYNCED'); END IF;
 SELECT * INTO q FROM public.inquiries i WHERE i.id=p_inquiry_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'INQUIRY_NOT_FOUND'; END IF;
 has_owner:=false;
 IF q.assigned_to IS NOT NULL THEN
  SELECT x.user_id,x.auth_uid,x.name INTO u FROM public.users x WHERE x.user_id=q.assigned_to;
  IF FOUND THEN has_owner:=u.auth_uid IS NOT NULL AND nullif(btrim(coalesce(u.name,'')),'') IS NOT NULL; END IF;
 END IF;
 IF NOT has_owner THEN
  RETURN jsonb_build_object('ok',true,'reason','RESPONSE_SYNCED_FLOW_REVIEW','flow',jsonb_build_object('skipped','NO_OWNER_LOGIN'));
 END IF;
 INSERT INTO crm_security.inquiry_flow_state(inquiry_id) VALUES(q.id) ON CONFLICT (inquiry_id) DO NOTHING;
 SELECT * INTO s FROM crm_security.inquiry_flow_state x WHERE x.inquiry_id=q.id FOR UPDATE;
 v_content:=left(btrim(coalesce(p->>'response_content','')),4000);

 -- 연락 결과 → 연락 결과 기록 한 줄 + 첫 시도 / 첫 연결(처음 한 번만)
 IF v_label IS NOT NULL THEN
  v_channel:=CASE WHEN v_label='문자' THEN '문자' ELSE '전화' END;
  v_contact:=CASE v_label WHEN '연결됨' THEN '연결됨' WHEN '회신 받음' THEN '고객 회신' WHEN '부재' THEN '부재' WHEN '번호 오류' THEN '번호오류' ELSE NULL END;
  v_result:=coalesce(v_contact,'회신대기');
  v_kind:=crm_security.inquiry_contact_kind(v_result);
  IF v_kind IS NULL THEN RAISE EXCEPTION 'INVALID_CONTACT_RESULT'; END IF;
  BEGIN v_due:=nullif(p->>'next_action_date','')::date; EXCEPTION WHEN others THEN v_due:=NULL; END;
  v_rid:=md5('n8n-contact:'||p_event_id)::uuid;
  INSERT INTO crm_security.inquiry_contact_logs(inquiry_id,request_id,channel,result,contact_result,kind,content,next_check_date,occurred_at,actor_auth_uid,actor_user_id,actor_name)
  VALUES(q.id,v_rid,v_channel,v_result,v_contact,v_kind,v_content,v_due,p_source_at,u.auth_uid,u.user_id,u.name)
  ON CONFLICT (actor_auth_uid,request_id) DO NOTHING RETURNING id INTO v_log;
  IF v_log IS NOT NULL THEN
   IF v_kind='attempt' THEN
    UPDATE crm_security.inquiry_flow_state x SET first_attempt_at=coalesce(x.first_attempt_at,p_source_at),attempt_count=x.attempt_count+1,
     last_attempt_at=greatest(coalesce(x.last_attempt_at,p_source_at),p_source_at),updated_at=v_at WHERE x.inquiry_id=q.id;
   ELSIF v_kind='connected' THEN
    UPDATE crm_security.inquiry_flow_state x SET first_connected_at=coalesce(x.first_connected_at,p_source_at),connected_count=x.connected_count+1,
     last_connected_at=greatest(coalesce(x.last_connected_at,p_source_at),p_source_at),updated_at=v_at WHERE x.inquiry_id=q.id;
   ELSE
    UPDATE crm_security.inquiry_flow_state x SET updated_at=v_at WHERE x.inquiry_id=q.id;
   END IF;
   INSERT INTO crm_security.inquiry_audit_events(actor_auth_uid,actor_user_id,inquiry_id,action,before_data,after_data,reason,created_at)
   VALUES(u.auth_uid,u.user_id,q.id,'flow_contact_log',
    jsonb_build_object('first_attempt_at',s.first_attempt_at,'first_connected_at',s.first_connected_at,'attempt_count',s.attempt_count),
    jsonb_build_object('log_id',v_log,'channel',v_channel,'result',v_result,'contact_result',v_contact,'kind',v_kind,'occurred_at',p_source_at,
     'next_check_date',v_due,'actor',u.name,'source','n8n','event_id',p_event_id),v_result,v_at);
  END IF;
  flow:=flow||jsonb_build_object('contact_log_id',v_log,'contact_kind',v_kind,'contact_result',v_result);
 END IF;

 -- 견적 발송일 → '견적 발송 완료'(CRM 화면과 같은 처리) → 파이프라인 '컨설팅 설계' 영업건
 IF v_day IS NOT NULL THEN
  IF q.deal_id IS NOT NULL OR q.opportunity_id IS NOT NULL OR q.qualified_at IS NOT NULL
   OR coalesce(q.status,'') IN ('종결','종료','수주','실주','배드핏','연락두절','협약완료','해결완료','영업전환') THEN
   RETURN jsonb_build_object('ok',true,'reason','RESPONSE_SYNCED_FLOW_REVIEW','flow',flow||jsonb_build_object('quote','SKIPPED_CLOSED_OR_CONVERTED'));
  END IF;
  -- 보낸 날이 오늘이면 저장 시각, 지난 날이면 그날 12:00(CRM 화면과 같은 규칙)
  v_sent:=CASE WHEN v_day=(p_source_at AT TIME ZONE 'Asia/Seoul')::date THEN p_source_at ELSE (v_day::timestamp+time '12:00') AT TIME ZONE 'Asia/Seoul' END;
  v_amount:=nullif(p->>'quote_amount','')::bigint;
  IF v_amount IS NOT NULL THEN
   SELECT * INTO lv FROM crm_security.inquiry_quote_versions v WHERE v.inquiry_id=q.id ORDER BY v.version_no DESC LIMIT 1;
   IF FOUND AND lv.sent_at IS NULL THEN
    v_ver:=lv.version_no;
    UPDATE crm_security.inquiry_quote_versions v SET amount=v_amount,sent_at=v_sent,author_user_id=u.user_id,author_name=u.name,actor_auth_uid=u.auth_uid,
     request_id=md5('n8n-quote:'||p_event_id)::uuid WHERE v.id=lv.id;
   ELSE
    v_ver:=coalesce(lv.version_no,0)+1;
    INSERT INTO crm_security.inquiry_quote_versions(inquiry_id,version_no,amount,sent_at,method,change_reason,author_user_id,author_name,actor_auth_uid,request_id)
    VALUES(q.id,v_ver,v_amount,v_sent,'잔디 응대 페이지',CASE WHEN lv.version_no IS NOT NULL THEN '잔디 응대 페이지에서 다시 보냄' END,
     u.user_id,u.name,u.auth_uid,md5('n8n-quote:'||p_event_id)::uuid);
   END IF;
  END IF;
  UPDATE crm_security.inquiry_flow_state x SET quote_sent_at=coalesce(x.quote_sent_at,v_sent),
   qualified_at=coalesce(x.qualified_at,v_sent),qualified_by=coalesce(x.qualified_by,'quote_sent'),updated_at=v_at WHERE x.inquiry_id=q.id;
  -- 후속 할 일: 보낸 날 + 7일 '고객 반응 확인'(오늘보다 앞이면 내일). 열린 할 일은 취소하고 새로 하나.
  v_follow:=greatest(v_day+7,v_today+1);
  SELECT coalesce(jsonb_agg(n.id ORDER BY n.created_at,n.id),'[]'::jsonb) INTO v_cancelled FROM public.next_actions n WHERE n.inquiry_id=q.id AND n.status='open';
  UPDATE public.next_actions n SET status='cancelled',updated_at=v_at WHERE n.inquiry_id=q.id AND n.status='open';
  INSERT INTO public.next_actions(inquiry_id,action_type,title,due_at,assignee_name,status,created_at,updated_at)
  VALUES(q.id,'전화','고객 반응 확인',v_follow::timestamp AT TIME ZONE 'Asia/Seoul',u.name,'open',v_at,v_at) RETURNING id INTO v_next_id;
  INSERT INTO crm_security.schedules(type,at,inquiry_id,owner_user_id,owner_name,title,created_by_user_id,created_by_name)
  VALUES('quote_followup',v_follow,q.id,u.user_id,u.name,'고객 반응 확인',u.user_id,u.name)
  ON CONFLICT (inquiry_id,type) WHERE status='open' AND inquiry_id IS NOT NULL DO UPDATE SET at=excluded.at,owner_user_id=excluded.owner_user_id,owner_name=excluded.owner_name,updated_at=v_at;
  UPDATE public.inquiries i SET status='견적서 발송완료',next_action_date=v_follow,
   raw=coalesce(i.raw,'{}'::jsonb)||jsonb_build_object('진행상태','견적서 발송완료'),updated_at=v_at WHERE i.id=q.id;
  INSERT INTO crm_security.inquiry_audit_events(actor_auth_uid,actor_user_id,inquiry_id,action,before_data,after_data,reason,created_at)
  VALUES(u.auth_uid,u.user_id,q.id,'flow_quote_send',
   jsonb_build_object('next_action_date',q.next_action_date,'cancelled_action_ids',v_cancelled,'quote_sent_at',s.quote_sent_at,'status',q.status),
   jsonb_build_object('version_no',v_ver,'amount',v_amount,'sent_at',v_sent,'next_action_id',v_next_id,'next_action_date',v_follow,
    'actor',u.name,'source','n8n','event_id',p_event_id),'견적 '||coalesce('v'||v_ver||' ','')||'발송(잔디 응대 페이지)',v_at);
  flow:=flow||jsonb_build_object('quote_sent_at',v_sent,'quote_version',v_ver,'next_action_id',v_next_id,'next_action_date',v_follow);
  -- 영업건 자동 생성. 막혀도 위 기록은 남기고 전환 대기로 둔다.
  BEGIN
   conv:=private.inquiry_external_promote_v1(q.id,p_event_id);
  EXCEPTION WHEN others THEN
   conv:=jsonb_build_object('ok',false,'reason','PROMOTE_FAILED:'||SQLSTATE);
  END;
  flow:=flow||jsonb_build_object('promotion',conv);
  IF coalesce((conv->>'ok')::boolean,false) IS NOT TRUE THEN v_reason:='RESPONSE_SYNCED_CONVERSION_REVIEW'; END IF;
 END IF;
 RETURN jsonb_build_object('ok',true,'reason',v_reason,'flow',flow);
END $fn$;

REVOKE ALL ON FUNCTION private.inquiry_external_flow_validate_v1(jsonb) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION private.inquiry_external_promote_v1(uuid,text) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION private.inquiry_external_flow_apply_v1(uuid,jsonb,text,timestamptz) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION private.inquiry_external_flow_validate_v1(jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION private.inquiry_external_flow_apply_v1(uuid,jsonb,text,timestamptz) TO service_role;

-- 4) 운영 함수 두 곳에 한 줄씩 잇기
DO $migration$
DECLARE
 targets text[]:=ARRAY['public.crm_inquiry_change_enqueue_v1(jsonb)','public.crm_inquiry_change_apply_v1(text)'];
 anchors text[]:=ARRAY[
  $a$or nullif(btrim(p_event->>'response_content'),'') is null) then raise exception 'INVALID_RESPONSE'; end if;$a$,
  $a$result:=jsonb_build_object('ok',true,'reason','RESPONSE_SYNCED');$a$];
 additions text[]:=ARRAY[
  $a$or nullif(btrim(p_event->>'response_content'),'') is null) then raise exception 'INVALID_RESPONSE'; end if;
  if p_event->>'kind'='response' then perform private.inquiry_external_flow_validate_v1(p_event); end if; -- inquiry_external_flow_v1$a$,
  $a$result:=private.inquiry_external_flow_apply_v1(i.id,p,p_event_id,source_at); -- inquiry_external_flow_v1$a$];
 target regprocedure; definition text; previous_acl aclitem[]; previous_config text[]; previous_definer boolean; k integer;
BEGIN
 -- 먼저 두 곳 모두 확인하고, 하나라도 다르면 어느 것도 바꾸지 않는다
 FOR k IN 1..2 LOOP
  definition:=pg_get_functiondef(targets[k]::regprocedure);
  IF position('inquiry_external_flow_v1' in definition)=0
   AND (length(definition)-length(replace(definition,anchors[k],'')))/length(anchors[k])<>1 THEN
   RAISE EXCEPTION 'Unexpected definition of %; review before applying',targets[k];
  END IF;
 END LOOP;
 FOR k IN 1..2 LOOP
  target:=targets[k]::regprocedure;
  SELECT pg_get_functiondef(target),proacl,proconfig,prosecdef INTO definition,previous_acl,previous_config,previous_definer FROM pg_proc WHERE oid=target;
  IF position('inquiry_external_flow_v1' in definition)>0 THEN CONTINUE; END IF;
  IF (length(definition)-length(replace(definition,anchors[k],'')))/length(anchors[k])<>1 THEN
   RAISE EXCEPTION 'Unexpected definition of %; review before applying',targets[k];
  END IF;
  EXECUTE replace(definition,anchors[k],additions[k]);
  IF EXISTS(SELECT 1 FROM pg_proc WHERE oid=target AND
    (proacl IS DISTINCT FROM previous_acl OR proconfig IS DISTINCT FROM previous_config OR prosecdef IS DISTINCT FROM previous_definer))
  THEN RAISE EXCEPTION 'Security properties of % changed',targets[k]; END IF;
 END LOOP;
END
$migration$;

NOTIFY pgrst, 'reload schema';
