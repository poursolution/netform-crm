-- 문의→영업 전환: 담당 영업사원 본인 허용 (2026-09-25 · 10/1 Live 전 필수)
-- 문제: crm_security.crm_inquiry_pipeline_promote_command_v1이 관리자만 실행 → 영업사원이 문의를 '견적서 발송'으로 바꾸면 전환 거절.
-- 변경: 실행자 = 관리자 또는 '그 문의의 담당 영업사원 본인(rep)'. 나머지 검증은 그대로 —
--   승인된 본사 rep 담당 · 견적 발송 상태 · 지사/기술자문 제외 · 중복 연결 금지 · 멱등 영수증 · 이력/감사 기록.
-- 방식: 운영 정의(pg_get_functiondef, 저장소 9/7 버전보다 새 운영 수정분 포함)를 읽어 두 곳만 치환해 재생성.
--   앵커가 정확히 1회씩 없으면 아무것도 바꾸지 않고 중단. 재실행 안전(이미 적용되면 통과).
-- 되돌리기: 아래 두 치환을 반대로 적용(b1→a1, b2→a2).
do $patch$
declare
 def text; newdef text;
 a1 constant text := $a$IF NOT FOUND OR a.permission_role<>'admin' THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;$a$;
 b1 constant text := $b$IF NOT FOUND OR a.permission_role NOT IN ('admin','rep') THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;$b$;
 a2 constant text := $a$THEN RAISE EXCEPTION 'inquiry owner is not an approved head-office rep' USING ERRCODE='42501'; END IF;$a$;
 b2 constant text := $b$THEN RAISE EXCEPTION 'inquiry owner is not an approved head-office rep' USING ERRCODE='42501'; END IF;
 IF a.permission_role='rep' AND owner_review.user_id IS DISTINCT FROM a.user_id THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;$b$;
begin
 def := pg_get_functiondef('crm_security.crm_inquiry_pipeline_promote_command_v1(uuid,text,uuid,integer,jsonb)'::regprocedure);
 if position(b1 in def)>0 and position('owner_review.user_id IS DISTINCT FROM a.user_id' in def)>0 then
  raise notice 'already applied'; return;
 end if;
 if (length(def)-length(replace(def,a1,'')))/length(a1)<>1 then raise exception 'anchor 1 not found exactly once'; end if;
 if (length(def)-length(replace(def,a2,'')))/length(a2)<>1 then raise exception 'anchor 2 not found exactly once'; end if;
 newdef := replace(replace(def,a1,b1),a2,b2);
 execute newdef;
end $patch$;
-- 내부 함수는 디스패처(crm_write_command_v2 → crm_write_command_v2_inquiry_pipeline_20260906)로만 호출 — 직접 실행 권한 없음 유지
revoke execute on function crm_security.crm_inquiry_pipeline_promote_command_v1(uuid,text,uuid,integer,jsonb) from public, anon, authenticated, service_role;

-- 적용 확인: rep_allowed true · own_only true
select position($q$a.permission_role NOT IN ('admin','rep')$q$ in pg_get_functiondef('crm_security.crm_inquiry_pipeline_promote_command_v1(uuid,text,uuid,integer,jsonb)'::regprocedure))>0 as rep_allowed,
       position('owner_review.user_id IS DISTINCT FROM a.user_id' in pg_get_functiondef('crm_security.crm_inquiry_pipeline_promote_command_v1(uuid,text,uuid,integer,jsonb)'::regprocedure))>0 as own_only;
