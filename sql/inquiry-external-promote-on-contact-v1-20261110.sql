-- 잔디 응대 페이지 저장에서도 '응대하면 영업건' (2026-11-10 대표 피드백 ① "견적 유입 > 응대했으면 파이프라인으로 자동으로 넘어가는지" → A 진행)
-- 왜: CRM 화면에서는 정착 모드(11/9)부터 담당이 있는 문의가 '전화응대 완료 · 현장방문 예정/완료 · 견적 발송'이 되면 영업건(컨설팅 설계)이 생긴다.
--     잔디 응대 페이지(n8n)로 저장하면 서버가 상태만 바꾸고, 영업건은 '견적 보낸 날'을 적었을 때만 만들었다.
--     운영 확인(11/10): 11/9 이후 실제 연결 5건 중 넘어가야 할 3건 → 영업건 1건(CRM 화면 저장분만). 잔디로 저장한 '현장방문예정'은 안 넘어감.
-- 무엇을
--   1) private.inquiry_external_promote_v2(문의, 이벤트, 이유) — v1 과 같은 몸통, 기록에 남는 인계 이유만 받는다(v1 은 그대로 둠).
--   2) private.inquiry_external_flow_apply_v1 에 두 곳:
--      · 연락 결과 · 견적 날짜가 둘 다 없어도 상태가 위 세 가지면 계속 진행(바로 끝내지 않음)
--      · 끝에서 견적 날짜가 없고 상태가 위 세 가지면 영업건 자동 생성(CRM 화면과 같은 기준). 막혀도 응대 저장은 그대로(전환 대기로 남음).
-- 지키는 것: 이미 영업건이 있으면 손대지 않음(ALREADY_LINKED) · 종결 · 기술자문 · 담당이 승인된 본사 영업이 아니면 만들지 않고 이유만 남김(v1 과 같음).
--           과거 문의를 소급해서 넘기지 않음(앞으로 잔디에서 저장하는 건만).
-- 방식: 운영 본문을 읽어 정해진 문장이 정확히 1곳일 때만 바꾼다. 아니면 아무것도 바꾸지 않고 멈춘다(한 묶음 · 실패하면 전부 되돌아감). 이미 바뀌어 있으면 건너뜀.
-- 되돌리기: sql/inquiry-external-promote-on-contact-v1-20261110-rollback.sql
DO $migration$
DECLARE
 promote_v1 regprocedure:='private.inquiry_external_promote_v1(uuid,text)'::regprocedure;
 apply_fn regprocedure:='private.inquiry_external_flow_apply_v1(uuid,jsonb,text,timestamptz)'::regprocedure;
 d text; n integer; acl aclitem[]; cfg text[]; sec boolean;
 h_old text:='private.inquiry_external_promote_v1(p_inquiry_id uuid, p_event_id text)';
 h_new text:='private.inquiry_external_promote_v2(p_inquiry_id uuid, p_event_id text, p_reason text)';
 r_old text:=$a$reason_value text:='견적 발송완료로 파이프라인 인계';$a$;
 r_new text:=$a$reason_value text:=coalesce(nullif(btrim(coalesce(p_reason,'')),''),'견적 발송완료로 파이프라인 인계');$a$;
 e_old text:=$a$IF v_label IS NULL AND v_day IS NULL THEN RETURN jsonb_build_object('ok',true,'reason','RESPONSE_SYNCED'); END IF;$a$;
 e_new text:=$a$IF v_label IS NULL AND v_day IS NULL AND NOT coalesce((SELECT coalesce(x.status,'') ~ '전화\s*응대\s*완료|현장\s*방문\s*(완료|예정)|견적.*발송' FROM public.inquiries x WHERE x.id=p_inquiry_id),false) THEN RETURN jsonb_build_object('ok',true,'reason','RESPONSE_SYNCED'); END IF; -- inquiry_external_promote_on_contact_v1$a$;
 -- 끝 문장은 줄바꿈 없이 RETURN 한 줄만 찾는다(2026-11-10 첫 Run 'apply tail 0 times': 운영 본문 줄바꿈이 CR+LF 라 '…;⏎END ' 가 안 맞았다)
 t_old text:=$a$RETURN jsonb_build_object('ok',true,'reason',v_reason,'flow',flow);$a$;
 t_new text:=$a$-- 응대 상태로 영업건(CRM 화면 정착 모드와 같은 기준) -- inquiry_external_promote_on_contact_v1
 IF v_day IS NULL AND coalesce((SELECT coalesce(x.status,'') ~ '전화\s*응대\s*완료|현장\s*방문\s*(완료|예정)|견적.*발송' FROM public.inquiries x WHERE x.id=q.id),false) THEN
  BEGIN
   conv:=private.inquiry_external_promote_v2(q.id,p_event_id,(SELECT coalesce(x.status,'응대')||' 상태로 파이프라인 인계(잔디 응대 페이지)' FROM public.inquiries x WHERE x.id=q.id));
  EXCEPTION WHEN others THEN
   conv:=jsonb_build_object('ok',false,'reason','PROMOTE_FAILED:'||SQLSTATE);
  END;
  flow:=flow||jsonb_build_object('promotion',conv);
  IF coalesce((conv->>'ok')::boolean,false) IS NOT TRUE THEN v_reason:='RESPONSE_SYNCED_CONVERSION_REVIEW'; END IF;
 END IF;
 RETURN jsonb_build_object('ok',true,'reason',v_reason,'flow',flow);$a$;
BEGIN
 -- 1) promote_v2 (없을 때만)
 IF to_regprocedure('private.inquiry_external_promote_v2(uuid,text,text)') IS NULL THEN
  d:=pg_get_functiondef(promote_v1);
  n:=(length(d)-length(replace(d,h_old,'')))/length(h_old); IF n<>1 THEN RAISE EXCEPTION 'promote_v1 header % times; review before applying',n; END IF;
  n:=(length(d)-length(replace(d,r_old,'')))/length(r_old); IF n<>1 THEN RAISE EXCEPTION 'promote_v1 reason line % times; review before applying',n; END IF;
  EXECUTE replace(replace(d,h_old,h_new),r_old,r_new);
  REVOKE ALL ON FUNCTION private.inquiry_external_promote_v2(uuid,text,text) FROM PUBLIC,anon,authenticated,service_role;
 END IF;
 -- 2) apply 두 곳 (이미 바뀌어 있으면 건너뜀)
 SELECT pg_get_functiondef(apply_fn),proacl,proconfig,prosecdef INTO d,acl,cfg,sec FROM pg_proc WHERE oid=apply_fn;
 IF position('inquiry_external_promote_on_contact_v1' in d)=0 THEN
  n:=(length(d)-length(replace(d,e_old,'')))/length(e_old); IF n<>1 THEN RAISE EXCEPTION 'apply early-return % times; review before applying',n; END IF;
  n:=(length(d)-length(replace(d,t_old,'')))/length(t_old); IF n<>1 THEN RAISE EXCEPTION 'apply tail % times; review before applying',n; END IF;
  EXECUTE replace(replace(d,e_old,e_new),t_old,t_new);
  IF EXISTS(SELECT 1 FROM pg_proc WHERE oid=apply_fn AND (proacl IS DISTINCT FROM acl OR proconfig IS DISTINCT FROM cfg OR prosecdef IS DISTINCT FROM sec))
  THEN RAISE EXCEPTION 'Security properties of apply changed'; END IF;
 END IF;
END
$migration$;

-- 확인: v2 있음 · apply 에 표시 2곳 · v2 는 밖에서 못 부름
select to_regprocedure('private.inquiry_external_promote_v2(uuid,text,text)') is not null as promote_v2,
 (length(pg_get_functiondef('private.inquiry_external_flow_apply_v1(uuid,jsonb,text,timestamptz)'::regprocedure))
  -length(replace(pg_get_functiondef('private.inquiry_external_flow_apply_v1(uuid,jsonb,text,timestamptz)'::regprocedure),'inquiry_external_promote_on_contact_v1','')))/length('inquiry_external_promote_on_contact_v1') as marks,
 has_function_privilege('authenticated','private.inquiry_external_promote_v2(uuid,text,text)','EXECUTE') as auth_can_call;
