-- 실주 원인 새 목록 받기 v1 (2026-11-10 대표 "이거 안 옮겨지는 이유 설명해 줘" — 단계 바꾸기 → 실주가 안 됨)
-- 왜: 화면의 실주 원인은 운영 기준(설정 'reasons_lost', 2026-10-04 회의 확정 12개 · 예: '가격 · 예산 부족')인데,
--     서버 종결 명령(crm_deal_close_nonwon_command_v1)은 예전 13개('가격 열세' · '고객 예산 무산' 등)만 받아 'invalid non-won close payload'로 거절했다.
--     운영 확인(읽기 전용): 10/1 뒤 단계 바꾸기 창으로 실주 처리된 건 0건(종결 4건은 모두 예전 종료 창).
-- 무엇: 실주(lost)일 때 예전 13개에 더해 ① 회의 확정 12개 ② 지금 설정 화면의 '실주 원인' 목록(crm_settings 'ops_rules'.reasons_lost)도 받는다.
--       배드핏 · 연락두절 목록, 길이 검사, 권한 · 버전 검사는 그대로. 영업 데이터는 바꾸지 않는다.
-- 다시 실행해도 안전(표식이 있으면 건너뜀). 예상과 다른 함수 본문이면 아무것도 바꾸지 않고 멈춘다.
-- 되돌리기: sql/close-lost-reasons-v1-20261110-rollback.sql
-- 운영 적용: Supabase SQL 편집기에서 대표가 Run.

begin;

do $migration$
declare
 o oid; d text;
 anchor text := $a$'타업체 선정','내부 사정','기타')$a$;
 addon text := $b$'타업체 선정','내부 사정','기타')
  /* close-lost-reasons-v1:start (2026-11-10 — 실주 원인 새 목록 · 설정 목록도 받음) */
  AND category_value NOT IN ('관계 · 관리소장 변경','관계 · 입대의 · 회장 영향','관계 · 경쟁업체 기존 관계','공법 · 타 공법 선호','공법 · 특허 조건 불리','공법 · 설계 변경','가격 · 가격 경쟁','가격 · 예산 부족','가격 · 실행가 문제','사업 · 공사 취소','사업 · 연기','사업 · 예산 미확정')
  AND NOT EXISTS(SELECT 1 FROM public.crm_settings s, jsonb_array_elements_text(CASE WHEN jsonb_typeof(s.value->'reasons_lost')='array' THEN s.value->'reasons_lost' ELSE '[]'::jsonb END) x(v) WHERE s.key='ops_rules' AND btrim(x.v)=category_value)
  /* close-lost-reasons-v1:end */$b$;
 n int;
begin
 select p.oid into o from pg_proc p join pg_namespace s on s.oid=p.pronamespace
  where s.nspname in ('public','crm_security') and p.proname='crm_deal_close_nonwon_command_v1' and p.prokind='f';
 if o is null then raise exception '실주 종결 명령 함수가 없습니다 — 아무것도 바꾸지 않았습니다'; end if;
 d:=pg_get_functiondef(o);
 if position('close-lost-reasons-v1:start' in d)>0 then raise notice '이미 적용됨 — 건너뜀'; return; end if;
 n:=(length(d)-length(replace(d,anchor,'')))/length(anchor);
 if n<>1 then raise exception '실주 사유 목록 자리가 %곳입니다(1곳이어야 함) — 아무것도 바꾸지 않았습니다',n; end if;
 execute replace(d,anchor,addon);
end $migration$;

commit;

-- 확인: 표식이 들어갔는지 · 지금 설정 목록
select position('close-lost-reasons-v1:start' in pg_get_functiondef(p.oid))>0 as lost_reasons_accepted,
       (select s.value->'reasons_lost' from public.crm_settings s where s.key='ops_rules') as settings_reasons_lost
from pg_proc p join pg_namespace s on s.oid=p.pronamespace
where s.nspname in ('public','crm_security') and p.proname='crm_deal_close_nonwon_command_v1' and p.prokind='f';
