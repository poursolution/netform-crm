-- 잔디 배정 · 응대 페이지의 「문의 성격: 공사 견적 / B2B」를 CRM이 받기 (2026-11-12, 보람님 "응 고쳐(초안 PR)")
-- 왜: n8n 「견적문의 담당자 배정」(rXU5jbSUlNRz11KN)은 11/12부터 배정 · 응대 페이지에서 문의 성격을 고르고,
--     B2B면 시트 공사유형 앞에 「협약/B2B · 」를 붙인다. 그런데 CRM은
--       · 시트 → CRM 동기화(crm_inquiry_sheet_ingest_v1)가 이미 있는 문의는 건드리지 않고(on conflict do nothing)
--       · 배정 · 응대 이벤트(crm_inquiry_change_enqueue_v1)에 공사유형이 오지 않아
--     B2B로 골라도 CRM에선 견적문의로 남았다(화면의 협약 판정 inquiry-b2b-client.js isAgreement 는 work_type · raw 공사유형의 '협약'을 본다).
-- 무엇을 (배정 · 재배정 · 응대 이벤트에 inquiry_kind '견적' | 'B2B' 를 선택으로 더 받는다. 없으면 지금과 같다)
--   1) B2B  → work_type · raw 공사유형 앞에 「협약/B2B · 」(이미 '협약'이 있으면 그대로) · raw 문의성격='B2B' → CRM 화면에서 「협약문의 · B2B」로 보임
--      견적 → n8n 이 붙인 「협약/B2B · 」만 떼고 raw 문의성격='견적' (원래 공사유형에 있던 '협약' 글자는 건드리지 않음)
--   2) B2B 문의는 잔디 응대 저장으로 파이프라인 영업건을 만들지 않는다(견적 날짜 · 응대 상태 둘 다). 결과는 ok · reason B2B_NO_PIPELINE(전환 검토로 안 남김).
--      판정: raw 문의성격='B2B', 또는 문의성격이 '견적'이 아니면서 work_type · raw 공사유형에 '협약'.
--   3) B2B 와 견적 보낸 날을 같이 보내면 받지 않는다(QUOTE_ON_B2B) — B2B 화면엔 견적 칸 대신 자료 · 협약서 보낸 날(+7일 = 다음 날짜)이 있다.
-- 지키는 것: 바뀔 때만 쓰고, 문의 감사 기록(flow_field_set · field inquiry_kind)을 남긴다(담당 CRM 로그인이 없으면 감사 기록만 건너뜀 — 이벤트 이력엔 남음).
--           전환 · 종결 문의는 기존 apply 규칙(CONVERTED_REVIEW · CLOSED_REVIEW)대로 손대지 않는다. 과거 문의 소급 없음. 고객 연락처 안 다룸.
-- 방식: 11/10 SQL과 같이 운영 본문을 읽어 정해진 문장이 정확히 1곳일 때만 한 줄씩 덧붙인다. 하나라도 다르면 아무것도 바꾸지 않고 멈춘다(한 묶음). 이미 바뀌어 있으면 건너뜀.
--   덧붙이는 곳: enqueue(받기 전 검사) · apply(배정/응대 처리 직전) · promote_v1 · promote_v2(영업건 만들기 직전)
-- 먼저 있어야 하는 것: supabase/migrations/20261109120000(#738) · sql/inquiry-external-promote-on-contact-v1-20261110.sql
-- 되돌리기: sql/inquiry-external-kind-b2b-v1-20261112-rollback.sql
-- 운영 반영은 대표님 확인 뒤.

CREATE OR REPLACE FUNCTION private.inquiry_external_kind_validate_v1(p jsonb)
RETURNS void LANGUAGE plpgsql IMMUTABLE SET search_path='' AS $fn$
DECLARE v text;
BEGIN
 IF NOT (p ? 'inquiry_kind') THEN RETURN; END IF;
 IF jsonb_typeof(p->'inquiry_kind') NOT IN ('string','null') THEN RAISE EXCEPTION 'INVALID_INQUIRY_KIND'; END IF;
 v:=nullif(btrim(coalesce(p->>'inquiry_kind','')),'');
 IF v IS NOT NULL AND v NOT IN ('견적','B2B') THEN RAISE EXCEPTION 'INVALID_INQUIRY_KIND'; END IF;
 IF v='B2B' AND nullif(p->>'quote_sent_on','') IS NOT NULL THEN RAISE EXCEPTION 'QUOTE_ON_B2B'; END IF;
END $fn$;

-- B2B 판정(서버). 화면 isAgreement 와 같은 칸을 보되, 잔디에서 고른 문의성격이 먼저.
CREATE OR REPLACE FUNCTION private.inquiry_is_b2b_v1(p_inquiry_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $fn$
 SELECT coalesce((SELECT coalesce(i.raw->>'문의성격','')='B2B'
   OR (coalesce(i.raw->>'문의성격','')<>'견적' AND (coalesce(i.work_type,'') ~ '협약' OR coalesce(i.raw->>'공사유형','') ~ '협약'))
  FROM public.inquiries i WHERE i.id=p_inquiry_id),false)
$fn$;

CREATE OR REPLACE FUNCTION private.inquiry_external_kind_apply_v1(p_inquiry_id uuid,p jsonb,p_event_id text,p_source_at timestamptz)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $fn$
DECLARE
 q public.inquiries%ROWTYPE; u record; v text; tag text:='협약/B2B · ';
 w_old text; w_new text; g_old text; g_new text;
BEGIN
 IF coalesce(nullif(current_setting('request.jwt.claim.role',true),''),
   nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'role','') <> 'service_role' THEN
  RAISE EXCEPTION 'SERVICE_ROLE_REQUIRED' USING ERRCODE='42501';
 END IF;
 v:=nullif(btrim(coalesce(p->>'inquiry_kind','')),'');
 IF v IS NULL THEN RETURN jsonb_build_object('ok',true,'kind',NULL); END IF;
 IF v NOT IN ('견적','B2B') THEN RAISE EXCEPTION 'INVALID_INQUIRY_KIND'; END IF;
 SELECT * INTO q FROM public.inquiries i WHERE i.id=p_inquiry_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'INQUIRY_NOT_FOUND'; END IF;
 w_old:=coalesce(q.work_type,''); g_old:=coalesce(q.raw->>'공사유형','');
 IF v='B2B' THEN
  w_new:=CASE WHEN w_old ~ '협약' THEN w_old ELSE tag||w_old END;
  g_new:=CASE WHEN g_old ~ '협약' THEN g_old ELSE tag||g_old END;
 ELSE
  w_new:=CASE WHEN left(w_old,length(tag))=tag THEN substr(w_old,length(tag)+1) ELSE w_old END;
  g_new:=CASE WHEN left(g_old,length(tag))=tag THEN substr(g_old,length(tag)+1) ELSE g_old END;
 END IF;
 IF w_new IS NOT DISTINCT FROM w_old AND g_new IS NOT DISTINCT FROM g_old AND coalesce(q.raw->>'문의성격','') = v THEN
  RETURN jsonb_build_object('ok',true,'kind',v,'changed',false);
 END IF;
 UPDATE public.inquiries i SET work_type=CASE WHEN q.work_type IS NULL AND w_new='' THEN NULL ELSE w_new END,
  raw=coalesce(i.raw,'{}'::jsonb)||jsonb_build_object('문의성격',v)
   ||CASE WHEN g_new IS DISTINCT FROM g_old THEN jsonb_build_object('공사유형',g_new) ELSE '{}'::jsonb END
  WHERE i.id=q.id;
 IF q.assigned_to IS NOT NULL THEN
  SELECT x.user_id,x.auth_uid,x.name INTO u FROM public.users x WHERE x.user_id=q.assigned_to;
  IF FOUND AND u.auth_uid IS NOT NULL THEN
   INSERT INTO crm_security.inquiry_audit_events(actor_auth_uid,actor_user_id,inquiry_id,action,before_data,after_data,reason,created_at)
   VALUES(u.auth_uid,u.user_id,q.id,'flow_field_set',
    jsonb_build_object('inquiry_kind',q.raw->>'문의성격','work_type',q.work_type,'공사유형',q.raw->>'공사유형'),
    jsonb_build_object('field','inquiry_kind','value',v,'work_type',w_new,'공사유형',g_new,'actor',u.name,'source','n8n','event_id',p_event_id,'source_at',p_source_at),
    '문의 성격 '||v||'(잔디)',clock_timestamp());
  END IF;
 END IF;
 RETURN jsonb_build_object('ok',true,'kind',v,'changed',true);
END $fn$;

REVOKE ALL ON FUNCTION private.inquiry_external_kind_validate_v1(jsonb) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION private.inquiry_is_b2b_v1(uuid) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION private.inquiry_external_kind_apply_v1(uuid,jsonb,text,timestamptz) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION private.inquiry_external_kind_validate_v1(jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION private.inquiry_external_kind_apply_v1(uuid,jsonb,text,timestamptz) TO service_role;

DO $migration$
DECLARE
 targets text[]:=ARRAY['public.crm_inquiry_change_enqueue_v1(jsonb)','public.crm_inquiry_change_apply_v1(text)',
  'private.inquiry_external_promote_v1(uuid,text)','private.inquiry_external_promote_v2(uuid,text,text)'];
 anchors text[]:=ARRAY[
  $a$insert into private.inquiry_change_events(event_id,payload)$a$,
  $a$if kind in ('assign','reassign') then$a$,
  $a$IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'reason','INQUIRY_NOT_FOUND'); END IF;$a$,
  $a$IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'reason','INQUIRY_NOT_FOUND'); END IF;$a$];
 -- 덧붙이는 글은 줄바꿈 없이 한 줄(운영 본문 CR+LF 와 무관하게 넣고 뺄 수 있게). 되돌리기 SQL 은 이 글을 그대로 뺀다.
 pre text[]:=ARRAY[
  $a$perform private.inquiry_external_kind_validate_v1(p_event); /* inquiry_external_kind_v1 */ $a$,
  $a$perform private.inquiry_external_kind_apply_v1(i.id,p,p_event_id,source_at); /* inquiry_external_kind_v1 */ $a$];
 guard text:=$a$ IF private.inquiry_is_b2b_v1(q.id) THEN RETURN jsonb_build_object('ok',true,'reason','B2B_NO_PIPELINE'); END IF; /* inquiry_external_kind_v1 */$a$;
 additions text[];
 target regprocedure; d text; acl aclitem[]; cfg text[]; sec boolean; k integer;
BEGIN
 additions:=ARRAY[pre[1]||anchors[1], pre[2]||anchors[2], anchors[3]||guard, anchors[4]||guard];
 -- 먼저 넷 다 확인하고, 하나라도 다르면 어느 것도 바꾸지 않는다
 FOR k IN 1..4 LOOP
  IF to_regprocedure(targets[k]) IS NULL THEN RAISE EXCEPTION '% missing; apply #738 and the 11/10 SQL first',targets[k]; END IF;
  d:=pg_get_functiondef(targets[k]::regprocedure);
  IF position('inquiry_external_kind_v1' in d)=0
   AND (length(d)-length(replace(d,anchors[k],'')))/length(anchors[k])<>1 THEN
   RAISE EXCEPTION 'Unexpected definition of %; review before applying',targets[k];
  END IF;
 END LOOP;
 FOR k IN 1..4 LOOP
  target:=targets[k]::regprocedure;
  SELECT pg_get_functiondef(target),proacl,proconfig,prosecdef INTO d,acl,cfg,sec FROM pg_proc WHERE oid=target;
  IF position('inquiry_external_kind_v1' in d)>0 THEN CONTINUE; END IF;
  EXECUTE replace(d,anchors[k],additions[k]);
  IF EXISTS(SELECT 1 FROM pg_proc WHERE oid=target AND (proacl IS DISTINCT FROM acl OR proconfig IS DISTINCT FROM cfg OR prosecdef IS DISTINCT FROM sec))
  THEN RAISE EXCEPTION 'Security properties of % changed',targets[k]; END IF;
 END LOOP;
END
$migration$;

NOTIFY pgrst, 'reload schema';

-- 확인: 표시 4곳(각 함수 1곳) · 새 함수는 밖에서 못 부름
select (select count(*) from unnest(ARRAY['public.crm_inquiry_change_enqueue_v1(jsonb)','public.crm_inquiry_change_apply_v1(text)',
  'private.inquiry_external_promote_v1(uuid,text)','private.inquiry_external_promote_v2(uuid,text,text)']) f
  where position('inquiry_external_kind_v1' in pg_get_functiondef(f::regprocedure))>0) as marked_functions,
 has_function_privilege('authenticated','private.inquiry_external_kind_apply_v1(uuid,jsonb,text,timestamptz)','EXECUTE') as auth_can_call;
