-- 새 영업 등록 v2 (2026-10-05 design_handoff_new_deal · 대표 "상단 [+ 새 영업] 창만 이 디자인으로 … source_type을 저장해서 인바운드 통계와 따로 집계")
-- 문의 없이 우리가 먼저 시작한 영업(아웃바운드 · 소개 · 기존 고객 재영업 · 현장 발굴/기타)을 견적문의를 거치지 않고 파이프라인 컨설팅 설계로 바로 만든다.
-- 기존 영업 생성 명령(crm_security.crm_opportunity_create_command_v1 · crm_write_command_v2 가 부르는 한 곳)에 아래만 더한다 — 그 밖의 검사 · 현장 판정 · 감사 기록 · 중복 방지는 그대로.
--   · 유입 구분 source_type(outbound · referral · re_sales · other) → deals.source 와 deals.list_fields.source_type 에 저장(기존 인바운드 = 'inbound'). 안 보내면 예전처럼 'direct_ui'
--   · 소개한 사람 referrer_name · referrer_phone → deals.list_fields
--   · 처음 만난 사람: 이름 + 연락처 하나 이상(휴대폰 또는 관리사무소 대표전화) · 역할 4종(관리소장 · 입대의 회장 · 관리과장 · 기타). 사람 열쇠 = 휴대폰이 있으면 mobile:번호, 없으면 office:번호:이름
--   · 첫 다음 행동 first_action_type · first_action_title · first_action_due(YYYY-MM-DD) → next_actions 에 바로 등록
--   · 브랜드에 POUR공법 · 담당은 본사 영업사원 또는 관리자 권한 직원(겸직 영업 · 등록하는 본인)
-- 새 표 · 새 칸 없음(기존 칸 deals.source · deals.list_fields · next_actions 를 쓴다). 화면이 서버 적용 여부를 알 수 있게 표식 함수 public.crm_new_deal_contract_v1() 하나를 더한다.
-- 안전장치: 지금 운영 함수가 2026-09-06 원본과 다르면(누가 그 사이에 바꿨으면) 아무것도 바꾸지 않고 멈춘다. 다시 실행해도 안전하다.
BEGIN;

DO $guard$
DECLARE cur text;
BEGIN
 IF current_user<>'postgres' THEN RAISE EXCEPTION 'postgres 로 실행해 주세요'; END IF;
 SELECT md5(regexp_replace(pg_get_functiondef('crm_security.crm_opportunity_create_command_v1(uuid,uuid,jsonb)'::regprocedure),'\s+','','g')) INTO cur;
 IF cur NOT IN ('2cbad0e5db376ca03547410c6bb8a2a4','e6d4bd13160476ace4f2a77df4b428df') THEN RAISE EXCEPTION '영업 생성 함수가 예상한 원본과 다릅니다(%). 바꾸지 않고 멈춥니다.',cur; END IF;
END $guard$;

CREATE OR REPLACE FUNCTION crm_security.crm_opportunity_create_command_v1(
 p_request_id uuid,p_object_id uuid,p_payload jsonb
) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $fn$
DECLARE
 a record; target_user record; target_count integer; receipt crm_security.command_receipts%ROWTYPE;
 server_at timestamptz:=pg_catalog.clock_timestamp(); common_key text; pc_key text; mobile_key text;
 site_ids uuid[]; site_target uuid; site_row public.sites%ROWTYPE; broad_count integer; supplied_site uuid;
 contact_target uuid; assignment_target uuid; deal_target uuid:=gen_random_uuid(); activity_target uuid; next_target uuid;
 audit_target uuid; office_digits text; mobile_digits text; item_count integer; normalized jsonb; ack jsonb;
 person_key_calc text; first_due date;
 target_review_expires timestamptz;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;
 SELECT * INTO a FROM crm_security.actor();
 IF NOT FOUND THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;
 IF p_request_id IS NULL OR p_object_id IS DISTINCT FROM p_request_id OR jsonb_typeof(p_payload) IS DISTINCT FROM 'object'
  OR EXISTS(SELECT 1 FROM jsonb_object_keys(p_payload) k WHERE k NOT IN
   ('surface','site_id','name','work_name','work_type','primary_work','work_items','work_scope_type','work_summary',
    'brand','owner','amount','address','reason','reason_source','office_phone','office_email','manager_name',
    'manager_mobile','manager_role','person_key','client_ref',
    'source_type','referrer_name','referrer_phone','first_action_type','first_action_title','first_action_due'))
  OR NOT p_payload ?& ARRAY['surface','name','work_name','work_type','primary_work','work_items','work_scope_type','work_summary',
    'brand','owner','reason','manager_name','manager_role','person_key','client_ref']
 THEN RAISE EXCEPTION 'invalid opportunity create contract' USING ERRCODE='22023'; END IF;

 IF p_payload->>'surface' NOT IN ('pc','mobile')
  OR jsonb_typeof(p_payload->'name') IS DISTINCT FROM 'string' OR length(btrim(p_payload->>'name')) NOT BETWEEN 1 AND 300
  OR jsonb_typeof(p_payload->'work_name') IS DISTINCT FROM 'string' OR length(btrim(p_payload->>'work_name')) NOT BETWEEN 1 AND 500
  OR jsonb_typeof(p_payload->'work_type') IS DISTINCT FROM 'string' OR length(btrim(p_payload->>'work_type')) NOT BETWEEN 1 AND 200
  OR jsonb_typeof(p_payload->'primary_work') IS DISTINCT FROM 'string' OR length(btrim(p_payload->>'primary_work')) NOT BETWEEN 1 AND 100
  OR jsonb_typeof(p_payload->'work_items') IS DISTINCT FROM 'array'
  OR jsonb_typeof(p_payload->'work_summary') IS DISTINCT FROM 'string' OR length(btrim(p_payload->>'work_summary')) NOT BETWEEN 1 AND 2000
  OR p_payload->>'work_scope_type' NOT IN ('single','multi')
  OR p_payload->>'brand' NOT IN ('POUR솔루션','아파트스퀘어','석민이앤씨','기술자문','POUR공법')
  OR jsonb_typeof(p_payload->'owner') IS DISTINCT FROM 'string' OR length(btrim(p_payload->>'owner')) NOT BETWEEN 1 AND 100
  OR jsonb_typeof(p_payload->'reason') IS DISTINCT FROM 'string' OR length(btrim(p_payload->>'reason')) NOT BETWEEN 5 AND 2000
  OR (p_payload ? 'office_phone' AND jsonb_typeof(p_payload->'office_phone') NOT IN ('string','null'))
  OR jsonb_typeof(p_payload->'manager_name') IS DISTINCT FROM 'string' OR length(btrim(p_payload->>'manager_name')) NOT BETWEEN 1 AND 200
  OR (p_payload ? 'manager_mobile' AND jsonb_typeof(p_payload->'manager_mobile') NOT IN ('string','null'))
  OR coalesce(p_payload->>'manager_role','') NOT IN ('관리소장','입대의 회장','관리과장','기타')
  OR jsonb_typeof(p_payload->'person_key') IS DISTINCT FROM 'string'
  OR jsonb_typeof(p_payload->'client_ref') IS DISTINCT FROM 'string' OR length(btrim(p_payload->>'client_ref')) NOT BETWEEN 1 AND 200
  OR (p_payload ? 'amount' AND jsonb_typeof(p_payload->'amount') NOT IN ('number','null'))
  OR (p_payload ? 'address' AND jsonb_typeof(p_payload->'address') NOT IN ('string','null'))
  OR (p_payload ? 'reason_source' AND jsonb_typeof(p_payload->'reason_source') NOT IN ('string','null'))
  OR (p_payload ? 'office_email' AND jsonb_typeof(p_payload->'office_email') NOT IN ('string','null'))
  OR (p_payload ? 'site_id' AND jsonb_typeof(p_payload->'site_id') NOT IN ('string','null'))
  OR (p_payload ? 'source_type' AND coalesce(p_payload->>'source_type','') NOT IN ('outbound','referral','re_sales','other'))
  OR (p_payload ? 'referrer_name' AND (jsonb_typeof(p_payload->'referrer_name') NOT IN ('string','null') OR length(coalesce(p_payload->>'referrer_name',''))>200))
  OR (p_payload ? 'referrer_phone' AND (jsonb_typeof(p_payload->'referrer_phone') NOT IN ('string','null') OR length(coalesce(p_payload->>'referrer_phone',''))>40))
  OR (p_payload ?| ARRAY['first_action_type','first_action_title','first_action_due'] AND (
       jsonb_typeof(p_payload->'first_action_type') IS DISTINCT FROM 'string' OR length(btrim(p_payload->>'first_action_type')) NOT BETWEEN 1 AND 40
    OR jsonb_typeof(p_payload->'first_action_title') IS DISTINCT FROM 'string' OR length(btrim(p_payload->>'first_action_title')) NOT BETWEEN 1 AND 200
    OR jsonb_typeof(p_payload->'first_action_due') IS DISTINCT FROM 'string' OR (p_payload->>'first_action_due') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'))
 THEN RAISE EXCEPTION 'invalid opportunity create values' USING ERRCODE='22023'; END IF;

 item_count:=jsonb_array_length(p_payload->'work_items');
 IF item_count NOT BETWEEN 1 AND 30
  OR EXISTS(SELECT 1 FROM jsonb_array_elements(p_payload->'work_items') x WHERE jsonb_typeof(x)<>'string')
  OR EXISTS(SELECT 1 FROM jsonb_array_elements_text(p_payload->'work_items') x WHERE length(btrim(x)) NOT BETWEEN 1 AND 100)
  OR (SELECT count(DISTINCT x) FROM jsonb_array_elements_text(p_payload->'work_items') x)<>item_count
  OR NOT ((p_payload->'work_items') ? (p_payload->>'primary_work'))
  OR (item_count=1 AND p_payload->>'work_scope_type'<>'single')
  OR (item_count>1 AND p_payload->>'work_scope_type'<>'multi')
 THEN RAISE EXCEPTION 'invalid opportunity work contract' USING ERRCODE='22023'; END IF;

 IF p_payload->>'amount' IS NOT NULL AND ((p_payload->>'amount') !~ '^[0-9]+$' OR (p_payload->>'amount')::numeric>9007199254740991)
 THEN RAISE EXCEPTION 'invalid opportunity amount' USING ERRCODE='22023'; END IF;
 IF length(coalesce(p_payload->>'address',''))>1000 OR length(coalesce(p_payload->>'reason_source',''))>200
  OR length(coalesce(p_payload->>'office_email',''))>320
 THEN RAISE EXCEPTION 'invalid opportunity optional values' USING ERRCODE='22023'; END IF;

 office_digits:=regexp_replace(coalesce(p_payload->>'office_phone',''),'[^0-9]','','g');
 mobile_digits:=regexp_replace(coalesce(p_payload->>'manager_mobile',''),'[^0-9]','','g');
 /* 새 영업 등록 v2(2026-10-05): 이름 + 연락처 하나 이상. 사람 열쇠 = 휴대폰이 있으면 휴대폰, 없으면 대표전화 + 이름 */
 person_key_calc:=CASE WHEN mobile_digits<>'' THEN 'mobile:'||mobile_digits ELSE 'office:'||office_digits||':'||btrim(p_payload->>'manager_name') END;
 IF (office_digits='' AND mobile_digits='')
  OR (office_digits<>'' AND length(office_digits) NOT BETWEEN 8 AND 20)
  OR (mobile_digits<>'' AND length(mobile_digits) NOT BETWEEN 10 AND 20)
  OR p_payload->>'person_key' IS DISTINCT FROM person_key_calc
 THEN RAISE EXCEPTION 'invalid contact identity' USING ERRCODE='22023'; END IF;
 IF p_payload->>'first_action_due' IS NOT NULL THEN
  BEGIN first_due:=(p_payload->>'first_action_due')::date; EXCEPTION WHEN others THEN RAISE EXCEPTION 'invalid opportunity create values' USING ERRCODE='22023'; END;
 END IF;

 normalized:=jsonb_strip_nulls(jsonb_build_object(
  'surface',p_payload->>'surface','site_id',p_payload->'site_id','name',btrim(p_payload->>'name'),
  'work_name',btrim(p_payload->>'work_name'),'work_type',btrim(p_payload->>'work_type'),
  'primary_work',btrim(p_payload->>'primary_work'),'work_items',p_payload->'work_items',
  'work_scope_type',p_payload->>'work_scope_type','work_summary',btrim(p_payload->>'work_summary'),
  'brand',p_payload->>'brand','owner',btrim(p_payload->>'owner'),'amount',p_payload->'amount',
  'address',nullif(btrim(coalesce(p_payload->>'address','')),''),'reason',btrim(p_payload->>'reason'),
  'reason_source',nullif(btrim(coalesce(p_payload->>'reason_source','')),''),'office_phone',nullif(office_digits,''),
  'office_email',nullif(btrim(coalesce(p_payload->>'office_email','')),''),'manager_name',btrim(p_payload->>'manager_name'),
  'manager_mobile',nullif(mobile_digits,''),'manager_role',p_payload->>'manager_role','person_key',person_key_calc,
  'client_ref',btrim(p_payload->>'client_ref'),
  'source_type',p_payload->>'source_type','referrer_name',nullif(btrim(coalesce(p_payload->>'referrer_name','')),''),
  'referrer_phone',nullif(regexp_replace(coalesce(p_payload->>'referrer_phone',''),'[^0-9]','','g'),''),
  'first_action_type',nullif(btrim(coalesce(p_payload->>'first_action_type','')),''),'first_action_title',nullif(btrim(coalesce(p_payload->>'first_action_title','')),''),
  'first_action_due',p_payload->>'first_action_due'));

 PERFORM pg_advisory_xact_lock(hashtextextended(a.auth_uid::text||p_request_id::text,0));
 SELECT * INTO receipt FROM crm_security.command_receipts r WHERE r.actor_auth_uid=a.auth_uid AND r.request_id=p_request_id;
 IF FOUND THEN
  IF receipt.actor_user_id IS DISTINCT FROM a.user_id OR receipt.operation IS DISTINCT FROM 'opportunity_create'
   OR receipt.object_id IS DISTINCT FROM p_object_id OR receipt.expected_version IS DISTINCT FROM 0 OR receipt.payload IS DISTINCT FROM normalized
  THEN RAISE EXCEPTION 'REQUEST_ID_REUSE' USING ERRCODE='PT409'; END IF;
  RETURN receipt.ack||jsonb_build_object('replayed',true);
 END IF;

 SELECT count(*) INTO target_count FROM public.users u JOIN crm_security.access_review r ON r.user_id=u.user_id
  WHERE u.name=normalized->>'owner' AND u.active AND u.auth_uid IS NOT NULL AND r.reviewed_auth_uid=u.auth_uid
   AND r.source_role=u.role AND r.approved AND r.expires_at>server_at;
 IF target_count<>1 THEN RAISE EXCEPTION 'invalid or ambiguous owner' USING ERRCODE='22023'; END IF;
 SELECT u.user_id,u.name,u.email,r.permission_role,r.expires_at INTO target_user
  FROM public.users u JOIN crm_security.access_review r ON r.user_id=u.user_id
  WHERE u.name=normalized->>'owner' AND u.active AND u.auth_uid IS NOT NULL AND r.reviewed_auth_uid=u.auth_uid
   AND r.source_role=u.role AND r.approved AND r.expires_at>server_at;
 target_review_expires:=target_user.expires_at;
 IF a.permission_role IN ('rep','admin') THEN
  IF target_user.permission_role NOT IN ('rep','admin') THEN RAISE EXCEPTION 'owner is not an approved head-office rep' USING ERRCODE='42501'; END IF;
 ELSIF a.permission_role='branch' THEN
  IF target_user.permission_role<>'branch' OR target_user.user_id<>a.user_id THEN RAISE EXCEPTION 'branch create must be self-owned' USING ERRCODE='42501'; END IF;
 ELSE RAISE EXCEPTION 'creator role cannot create direct opportunities' USING ERRCODE='42501';
 END IF;

 common_key:=crm_security.crm_site_common_key_v1(normalized->>'name');
 pc_key:=crm_security.crm_site_pc_key_v1(normalized->>'name');
 mobile_key:=crm_security.crm_site_mobile_key_v1(normalized->>'name');
 IF common_key='' THEN RAISE EXCEPTION 'empty site identity' USING ERRCODE='22023'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('site:'||common_key,0));

 IF normalized ? 'site_id' THEN
  BEGIN supplied_site:=(normalized->>'site_id')::uuid; EXCEPTION WHEN invalid_text_representation THEN RAISE EXCEPTION 'invalid site id' USING ERRCODE='22023'; END;
 END IF;
 IF supplied_site IS NOT NULL THEN
  SELECT * INTO site_row FROM public.sites s WHERE s.site_id=supplied_site FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'site not found' USING ERRCODE='22023'; END IF;
  IF crm_security.crm_site_common_key_v1(site_row.site_name) IS DISTINCT FROM common_key
  THEN RAISE EXCEPTION 'SITE_ID_NAME_MISMATCH' USING ERRCODE='PT409'; END IF;
  site_target:=site_row.site_id;
  UPDATE public.sites SET address=coalesce(nullif(address,''),normalized->>'address') WHERE site_id=site_target;
 ELSE
  SELECT array_agg(s.site_id ORDER BY s.site_id) INTO site_ids FROM public.sites s
   WHERE crm_security.crm_site_common_key_v1(s.site_name)=common_key;
  IF coalesce(array_length(site_ids,1),0)>1 THEN RAISE EXCEPTION 'SITE_NORMALIZATION_AMBIGUOUS' USING ERRCODE='PT409'; END IF;
  IF coalesce(array_length(site_ids,1),0)=1 THEN site_target:=site_ids[1];
  ELSE
   SELECT count(*) INTO broad_count FROM public.sites s WHERE
    crm_security.crm_site_pc_key_v1(s.site_name)=pc_key OR crm_security.crm_site_mobile_key_v1(s.site_name)=mobile_key
    OR s.norm_name='crm:v1:'||common_key;
   IF broad_count>0 THEN RAISE EXCEPTION 'SITE_MATCH_REQUIRES_EXPLICIT_SELECTION' USING ERRCODE='PT409'; END IF;
   INSERT INTO public.sites(site_name,norm_name,address) VALUES(normalized->>'name','crm:v1:'||common_key,normalized->>'address')
    RETURNING site_id INTO site_target;
  END IF;
 END IF;

 IF normalized->>'surface'='mobile' AND EXISTS(
  SELECT 1 FROM public.deals d WHERE d.site_id=site_target AND btrim(coalesce(d.list_fields->>'work_name',''))=normalized->>'work_name'
   AND btrim(coalesce(d.work_summary,''))=normalized->>'work_summary')
 THEN RAISE EXCEPTION 'SEMANTIC_DUPLICATE' USING ERRCODE='PT409'; END IF;

 PERFORM pg_advisory_xact_lock(hashtextextended('contact:'||(normalized->>'person_key'),0));
 UPDATE public.contacts SET name=normalized->>'manager_name',title=normalized->>'manager_role',phone=coalesce(normalized->>'manager_mobile',normalized->>'office_phone'),
  mobile=coalesce(normalized->>'manager_mobile',mobile),role=normalized->>'manager_role',current_site=(SELECT site_name FROM public.sites WHERE site_id=site_target),updated_at=server_at
  WHERE person_key=normalized->>'person_key' RETURNING id INTO contact_target;
 IF contact_target IS NULL THEN
  INSERT INTO public.contacts(name,title,phone,mobile,role,person_key,current_site,created_at,updated_at)
  VALUES(normalized->>'manager_name',normalized->>'manager_role',coalesce(normalized->>'manager_mobile',normalized->>'office_phone'),normalized->>'manager_mobile',normalized->>'manager_role',
   normalized->>'person_key',(SELECT site_name FROM public.sites WHERE site_id=site_target),server_at,server_at)
  RETURNING id INTO contact_target;
 END IF;

 INSERT INTO public.deals(id,contact_id,brand,list_name,stage_code,assignee_name,assignee_email,amount,source,list_fields,
  created_at,updated_at,site_id,owner_id,lifecycle_status,stage_entered_at,last_activity_at,opened_at,version,
  service_type,origin_business,current_business,office_phone,office_email,manager_name,manager_mobile,person_key,
  manager_role,manager_current_site,manager_started_at,manager_status,primary_work,work_items,work_scope_type,work_summary)
 VALUES(deal_target,contact_target,normalized->>'brand',normalized->>'brand','first_contact',target_user.name,target_user.email,
  CASE WHEN normalized ? 'amount' THEN (normalized->>'amount')::bigint ELSE NULL END,coalesce(normalized->>'source_type','direct_ui'),
  jsonb_strip_nulls(jsonb_build_object('work_name',normalized->>'work_name','reason_source',normalized->>'reason_source',
   'create_surface',normalized->>'surface','client_ref',normalized->>'client_ref',
   'source_type',normalized->>'source_type','referrer_name',normalized->>'referrer_name','referrer_phone',normalized->>'referrer_phone')),
  server_at,server_at,site_target,target_user.user_id,'active',server_at,server_at,server_at,1,
  normalized->>'brand',normalized->>'brand',normalized->>'brand',normalized->>'office_phone',normalized->>'office_email',
  normalized->>'manager_name',normalized->>'manager_mobile',normalized->>'person_key',normalized->>'manager_role',
  (SELECT site_name FROM public.sites WHERE site_id=site_target),server_at::date,'current',normalized->>'primary_work',
  normalized->'work_items',normalized->>'work_scope_type',normalized->>'work_summary');

 INSERT INTO public.contact_assignments(person_key,opportunity_id,site_name,office_phone,started_at,status,reason)
 VALUES(normalized->>'person_key',deal_target,(SELECT site_name FROM public.sites WHERE site_id=site_target),
  normalized->>'office_phone',server_at::date,'current','영업 등록')
 ON CONFLICT(person_key,site_name) WHERE ended_at IS NULL DO UPDATE SET office_phone=excluded.office_phone,status='current'
 RETURNING id INTO assignment_target;

 INSERT INTO public.activities(deal_id,actor_email,actor_name,type,detail,occurred_at)
 VALUES(deal_target,(SELECT email FROM public.users WHERE user_id=a.user_id),a.display_name,'영업등록',
  jsonb_strip_nulls(jsonb_build_object('note',(normalized->>'work_name')||' ('||(normalized->>'work_summary')||')',
   'result',normalized->>'reason','surface',normalized->>'surface','reason_source',normalized->>'reason_source')),server_at)
 RETURNING id INTO activity_target;
 IF normalized ? 'first_action_title' THEN
  /* 새 영업 등록 v2: 등록할 때 정한 첫 다음 행동 + 날짜 → 등록 즉시 오늘 업무 · 놓침 계산 대상 */
  INSERT INTO public.next_actions(deal_id,action_type,title,due_at,assignee_name,status,source_activity_id,created_at,updated_at)
  VALUES(deal_target,normalized->>'first_action_type',normalized->>'first_action_title',first_due::timestamptz,target_user.name,'open',activity_target,server_at,server_at)
  RETURNING id INTO next_target;
 ELSIF normalized->>'surface'='mobile' THEN
  INSERT INTO public.next_actions(deal_id,action_type,title,due_at,assignee_name,status,source_activity_id,created_at,updated_at)
  VALUES(deal_target,'첫통화','등록 후 첫 통화',(server_at::date+1)::timestamptz,target_user.name,'open',activity_target,server_at,server_at)
  RETURNING id INTO next_target;
 END IF;

 IF a.permission_role IN ('branch','admin') THEN
  INSERT INTO crm_security.object_scope(scope_id,user_id,deal_id,can_write,reviewed_by,expires_at)
  VALUES(gen_random_uuid(),a.user_id,deal_target,true,'opportunity_create:'||p_request_id::text,
   (SELECT expires_at FROM crm_security.access_review WHERE user_id=a.user_id));
 END IF;

 INSERT INTO crm_security.audit_events(actor_auth_uid,actor_user_id,actor_name,deal_id,action,before_data,after_data,reason,created_at)
 VALUES(a.auth_uid,a.user_id,a.display_name,deal_target,'opportunity_create','{}'::jsonb,
  jsonb_build_object('site_id',site_target,'owner_id',target_user.user_id,'contact_id',contact_target,'surface',normalized->>'surface',
   'primary_work',normalized->>'primary_work','work_items',normalized->'work_items','work_summary',normalized->>'work_summary',
   'activity_id',activity_target,'next_action_id',next_target,'source_type',normalized->>'source_type','referrer_name',normalized->>'referrer_name'),normalized->>'reason',server_at)
 RETURNING event_id INTO audit_target;

 ack:=jsonb_build_object('contract_version',1,'ok',true,'request_id',p_request_id,'operation','opportunity_create',
  'object_id',p_object_id,'new_opportunity_id',deal_target,'site_id',site_target,'owner_id',target_user.user_id,
  'contact_id',contact_target,'contact_assignment_id',assignment_target,'activity_id',activity_target,
  'next_action_id',next_target,'audit_event_id',audit_target,'version',1,'server_at',server_at,'replayed',false);
 INSERT INTO crm_security.command_receipts(actor_auth_uid,request_id,actor_user_id,operation,object_id,expected_version,payload,ack,created_at)
 VALUES(a.auth_uid,p_request_id,a.user_id,'opportunity_create',p_object_id,0,normalized,ack,server_at);
 RETURN ack;
END $fn$;

REVOKE EXECUTE ON FUNCTION crm_security.crm_opportunity_create_command_v1(uuid,uuid,jsonb) FROM PUBLIC,anon,authenticated,service_role;

-- 화면이 '새 영업 등록 v2 서버 적용됨'을 확인하는 표식(읽기만)
CREATE OR REPLACE FUNCTION public.crm_new_deal_contract_v1()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=''
AS $fn$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM crm_security.actor()) THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;
 RETURN jsonb_build_object('ok',true,'policy','new-deal-outbound-v1','source_types',jsonb_build_array('outbound','referral','re_sales','other'),
  'contact_roles',jsonb_build_array('관리소장','입대의 회장','관리과장','기타'),'one_phone',true,'first_action',true);
END $fn$;
REVOKE EXECUTE ON FUNCTION public.crm_new_deal_contract_v1() FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.crm_new_deal_contract_v1() TO authenticated;

DO $post$ BEGIN
 IF has_function_privilege('authenticated','crm_security.crm_opportunity_create_command_v1(uuid,uuid,jsonb)','EXECUTE')
  OR has_function_privilege('anon','crm_security.crm_opportunity_create_command_v1(uuid,uuid,jsonb)','EXECUTE')
  OR has_function_privilege('anon','public.crm_new_deal_contract_v1()','EXECUTE')
  OR NOT has_function_privilege('authenticated','public.crm_new_deal_contract_v1()','EXECUTE')
 THEN RAISE EXCEPTION '권한 확인 실패 — 되돌립니다'; END IF;
END $post$;

COMMIT;
