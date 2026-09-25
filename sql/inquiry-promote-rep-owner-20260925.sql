-- 문의→영업 전환: 담당 영업사원 본인 허용 + 관리자 겸 영업(dual) 담당 허용 (2026-09-25 · 10/1 Live 전 필수)
-- 문제 1: crm_security.crm_inquiry_pipeline_promote_command_v1이 관리자만 실행 → 영업사원이 문의를 '견적서 발송'으로 바꾸면 전환 거절.
-- 문제 2: 문의 담당자가 승인된 rep여야 함 → 관리자 겸 영업(users.role='dual', 황윤선·이승우) 담당 문의는 전환 불가.
-- 변경(대표 확정 2026-09-25):
--   ① 실행자 = 관리자 또는 rep(단, rep는 본인 담당 문의만)
--   ② 담당자 = 승인된 rep 또는 승인된 관리자 중 users.role='dual'(관리자 겸 영업)
--   나머지 검증 그대로 — 견적 발송 상태 · 지사/기술자문 제외 · 중복 연결 금지 · 멱등 영수증 · 이력/감사.
-- 방식: 운영 정의(pg_get_functiondef — 저장소 9/7 버전보다 새 운영 수정분 포함)를 읽어 세 곳만 치환해 재생성.
--   각 치환은 따로 판정: 이미 적용된 곳은 건너뛰고, 앵커가 정확히 1회가 아니면 아무것도 바꾸지 않고 중단. 재실행 안전.
do $patch$
declare
 def text; newdef text;
 a1 constant text := $a$IF NOT FOUND OR a.permission_role<>'admin' THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;$a$;
 b1 constant text := $b$IF NOT FOUND OR a.permission_role NOT IN ('admin','rep') THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;$b$;
 a2 constant text := $a$THEN RAISE EXCEPTION 'inquiry owner is not an approved head-office rep' USING ERRCODE='42501'; END IF;$a$;
 b2 constant text := $b$THEN RAISE EXCEPTION 'inquiry owner is not an approved head-office rep' USING ERRCODE='42501'; END IF;
 IF a.permission_role='rep' AND owner_review.user_id IS DISTINCT FROM a.user_id THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;$b$;
 a3 constant text := $a$IF NOT FOUND OR owner_review.permission_role<>'rep' OR owner_review.name IS DISTINCT FROM btrim(p_payload->>'owner')$a$;
 b3 constant text := $b$IF NOT FOUND OR NOT (owner_review.permission_role='rep' OR (owner_review.permission_role='admin' AND EXISTS(SELECT 1 FROM public.users du WHERE du.user_id=owner_review.user_id AND du.role='dual'))) OR owner_review.name IS DISTINCT FROM btrim(p_payload->>'owner')$b$;
begin
 def := pg_get_functiondef('crm_security.crm_inquiry_pipeline_promote_command_v1(uuid,text,uuid,integer,jsonb)'::regprocedure);
 newdef := def;
 if position(b1 in newdef)=0 then
  if (length(newdef)-length(replace(newdef,a1,'')))/length(a1)<>1 then raise exception 'anchor 1 not found exactly once'; end if;
  newdef := replace(newdef,a1,b1);
 end if;
 if position('owner_review.user_id IS DISTINCT FROM a.user_id' in newdef)=0 then
  if (length(newdef)-length(replace(newdef,a2,'')))/length(a2)<>1 then raise exception 'anchor 2 not found exactly once'; end if;
  newdef := replace(newdef,a2,b2);
 end if;
 if position($q$du.role='dual'$q$ in newdef)=0 then
  if (length(newdef)-length(replace(newdef,a3,'')))/length(a3)<>1 then raise exception 'anchor 3 not found exactly once'; end if;
  newdef := replace(newdef,a3,b3);
 end if;
 if newdef<>def then execute newdef; else raise notice 'already applied'; end if;
end $patch$;
-- 내부 함수는 디스패처(crm_write_command_v2 → crm_write_command_v2_inquiry_pipeline_20260906)로만 호출 — 직접 실행 권한 없음 유지
revoke execute on function crm_security.crm_inquiry_pipeline_promote_command_v1(uuid,text,uuid,integer,jsonb) from public, anon, authenticated, service_role;

-- 적용 확인: rep_allowed true · own_only true · dual_owner true
select position($q$a.permission_role NOT IN ('admin','rep')$q$ in pg_get_functiondef('crm_security.crm_inquiry_pipeline_promote_command_v1(uuid,text,uuid,integer,jsonb)'::regprocedure))>0 as rep_allowed,
       position('owner_review.user_id IS DISTINCT FROM a.user_id' in pg_get_functiondef('crm_security.crm_inquiry_pipeline_promote_command_v1(uuid,text,uuid,integer,jsonb)'::regprocedure))>0 as own_only,
       position($q$du.role='dual'$q$ in pg_get_functiondef('crm_security.crm_inquiry_pipeline_promote_command_v1(uuid,text,uuid,integer,jsonb)'::regprocedure))>0 as dual_owner;
