-- 정착 모드 v1 되돌리기 (sql/settle-mode-v1-20261109.sql 의 반대)
-- 단계 이동 검사의 정착 모드 블록을 빼고, 문의 전환 조건을 '견적 발송 · 현장방문 완료'로 되돌리고, 확인 함수를 지운다.
-- 화면은 확인 함수가 없으면 예전 필수 규칙으로 돌아간다(settle-mode.js). 운영 적용: 대표 Run.
begin;
do $migration$
declare
 definition text := pg_get_functiondef('crm_security.crm_transition_validate_v1(text,jsonb,date)'::regprocedure);
 s integer; e integer; tail text := '-- settle-mode-v1:end';
begin
 s:=position(' -- settle-mode-v1:start' in definition);
 if s=0 then raise notice '정착 모드 블록이 없습니다 — 건너뜁니다'; return; end if;
 e:=position(tail in definition);
 if e=0 or e<s then raise exception '정착 모드 블록 끝을 찾지 못했습니다 — 아무것도 바꾸지 않았습니다'; end if;
 -- 블록 앞의 줄바꿈 하나와 끝 표식 뒤 줄바꿈 하나까지 함께 뺀다(설치 때 붙인 그대로)
 execute substr(definition,1,s-2)||substr(definition,e+length(tail)+1);
end $migration$;
do $do$
declare
 d text; o oid;
 b constant text:=$b$status_value !~ '견적.*발송|현장[[:space:]]*방문[[:space:]]*완료'$b$;
 c constant text:=$c$status_value !~ '견적.*발송|현장[[:space:]]*방문[[:space:]]*(완료|예정)|전화[[:space:]]*응대[[:space:]]*완료'$c$;
begin
 select p.oid into o from pg_proc p join pg_namespace s on s.oid=p.pronamespace where s.nspname='crm_security' and p.proname='crm_inquiry_pipeline_promote_command_v1';
 if o is null then return; end if;
 d:=pg_get_functiondef(o);
 if position(c in d)=0 then raise notice '전환 조건은 정착 모드가 아닙니다 — 건너뜁니다'; return; end if;
 execute replace(d,c,b);
end $do$;
drop function if exists public.crm_settle_mode_v1(jsonb);
commit;
notify pgrst, 'reload schema';
