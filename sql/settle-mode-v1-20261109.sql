-- 정착 모드 v1 (2026-11-09 대표 「전부 진행」)
-- 왜: 영업팀 의견 "필수 입력이 너무 많고, 견적문의 · 릴레잇 정보가 따로 관리되는 느낌".
--     10/1 운영 시작 뒤 문의 응대 기록 0건 · 문의→영업건 전환 0건 · 새 영업건 0건 · 단계 정보 저장 0건.
-- 무엇(서버 쪽 세 가지 — 화면은 settle-mode.js · 끄기 G.settleOff):
--   ① crm_settle_mode_v1(): 화면이 '서버도 풀렸는지' 확인하는 읽기 함수. 이 함수가 있어야 화면이 단계 칸 · 전환 조건을 푼다.
--   ② 단계 이동 검사(crm_transition_validate_v1): 단계별 필수 칸이 비어도 받는다. 검사 함수 안의 지역 값만 채워 검사를 통과시키고,
--      저장되는 기록(stage_transition_events · stage_contexts)에는 사람이 적은 값 그대로 남는다 — 지어낸 값이 저장되지 않는다.
--      남기는 것: 계약 · 시공의 계약금액, 준공의 준공일 · 준공 확인(돈 · 끝 확인).
--   ③ 문의 → 영업건 전환(crm_inquiry_pipeline_promote_command_v1): '견적 발송 · 현장방문 완료'에 더해
--      '전화응대 완료(실제 연결) · 현장방문예정' 상태도 전환을 받는다. 담당 배정 · 권한 · 중복 검사는 그대로.
-- 다시 실행해도 안전(표식이 있으면 건너뜀). 예상과 다른 함수 본문이면 아무것도 바꾸지 않고 멈춘다.
-- 되돌리기: sql/settle-mode-v1-20261109-rollback.sql
-- 운영 적용: Supabase SQL 편집기에서 대표가 Run.

begin;

-- ① 설치 확인 함수
create or replace function public.crm_settle_mode_v1(p jsonb default '{}'::jsonb)
returns jsonb language sql stable security invoker set search_path='' as $fn$
 select jsonb_build_object('ok',true,'version',1,'stage_fields','optional','promote_on_contact',true)
$fn$;
revoke all on function public.crm_settle_mode_v1(jsonb) from public, anon;
grant execute on function public.crm_settle_mode_v1(jsonb) to authenticated;

-- ② 단계 이동 검사: 비어 있는 필수 칸을 검사 함수의 지역 값으로만 채운다
do $migration$
declare
 definition text := pg_get_functiondef('crm_security.crm_transition_validate_v1(text,jsonb,date)'::regprocedure);
 marker text := $s$ IF p_to='first_contact' THEN$s$;
 block text := $block$
 -- settle-mode-v1:start (정착 모드 2026-11-09 — 검사용 지역 값만 채움, 저장 기록은 그대로)
 IF p_to='first_contact' THEN
  IF length(trim(coalesce(p_fields->>'needs','')))<1 THEN p_fields:=p_fields||jsonb_build_object('needs','미입력'); END IF;
  IF length(trim(coalesce(p_fields->>'work_scope','')))<1 THEN p_fields:=p_fields||jsonb_build_object('work_scope','미입력'); END IF;
 ELSIF p_to='consulting' THEN
  IF length(trim(coalesce(p_fields->>'quote_request','')))<1 THEN p_fields:=p_fields||jsonb_build_object('quote_request','미입력'); END IF;
  IF coalesce(p_fields->>'quote_due','')='' THEN p_fields:=p_fields||jsonb_build_object('quote_due',p_transition_date::text); END IF;
 ELSIF p_to='sent' THEN
  IF jsonb_typeof(p_fields->'materials') IS DISTINCT FROM 'array' OR jsonb_array_length(p_fields->'materials')<1 THEN p_fields:=p_fields||jsonb_build_object('materials',jsonb_build_array('기타자료')); END IF;
  IF length(trim(coalesce(p_fields->>'recipient','')))<1 THEN p_fields:=p_fields||jsonb_build_object('recipient','미입력'); END IF;
  IF coalesce(p_fields->>'sent_date','')='' THEN p_fields:=p_fields||jsonb_build_object('sent_date',p_transition_date::text); END IF;
  IF coalesce(p_fields->>'followup_date','')='' THEN p_fields:=p_fields||jsonb_build_object('followup_date',p_fields->>'sent_date'); END IF;
 ELSIF p_to='rapport' THEN
  IF length(trim(coalesce(p_fields->>'reaction','')))<1 THEN p_fields:=p_fields||jsonb_build_object('reaction','미입력'); END IF;
  IF coalesce(p_fields->>'contact_date','')='' THEN p_fields:=p_fields||jsonb_build_object('contact_date',p_transition_date::text); END IF;
 ELSIF p_to IN ('silent','waiting') THEN
  IF length(trim(coalesce(p_fields->>'reason','')))<1 AND NOT (p_fields ? 'relationship_reason') THEN p_fields:=p_fields||jsonb_build_object('reason','미입력'); END IF;
  IF coalesce(p_fields->>'contact_date','')='' THEN p_fields:=p_fields||jsonb_build_object('contact_date',p_transition_date::text); END IF;
 ELSIF p_to='compete' THEN
  IF coalesce(p_fields->>'competition_type','')='' THEN p_fields:=p_fields-'competition_type'; END IF;
 ELSIF p_to='imminent' THEN
  IF length(trim(coalesce(p_fields->>'final_terms','')))<1 THEN p_fields:=p_fields||jsonb_build_object('final_terms','미입력'); END IF;
  IF coalesce(p_fields->>'expected_contract','')='' THEN p_fields:=p_fields||jsonb_build_object('expected_contract',p_transition_date::text); END IF;
 ELSIF p_to='bidding' THEN
  IF length(trim(coalesce(p_fields->>'bid_terms','')))<1 THEN p_fields:=p_fields||jsonb_build_object('bid_terms','미입력'); END IF;
  IF coalesce(p_fields->>'bid_deadline','')='' THEN p_fields:=p_fields||jsonb_build_object('bid_deadline',p_transition_date::text); END IF;
 ELSIF p_to='contract' THEN
  IF coalesce(p_fields->>'contract_status','')='' THEN p_fields:=p_fields||jsonb_build_object('contract_status','체결 예정'); END IF;
  IF coalesce(p_fields->>'contract_date','')='' THEN p_fields:=p_fields||jsonb_build_object('contract_date',p_transition_date::text); END IF;
 ELSIF p_to='construction' THEN
  IF coalesce(p_fields->>'start_date','')='' THEN p_fields:=p_fields||jsonb_build_object('start_date',p_transition_date::text); END IF;
 END IF;
 -- settle-mode-v1:end
$block$;
begin
 if position('settle-mode-v1:start' in definition)>0 then raise notice '단계 이동 검사는 이미 정착 모드입니다 — 건너뜁니다'; return; end if;
 if (length(definition)-length(replace(definition,marker,'')))/length(marker)<>1 then
  raise exception '단계 이동 검사 함수 본문이 예상과 다릅니다 — 아무것도 바꾸지 않았습니다';
 end if;
 execute replace(definition,marker,block||marker);
end $migration$;

-- ③ 문의 → 영업건 전환 조건: 실제 연결(전화응대 완료) · 현장방문예정도 받는다
do $do$
declare
 d text; o oid; n integer; hit text:=null;
 a constant text:=$a$status_value !~ '견적.*발송'$a$;
 b constant text:=$b$status_value !~ '견적.*발송|현장[[:space:]]*방문[[:space:]]*완료'$b$;
 c constant text:=$c$status_value !~ '견적.*발송|현장[[:space:]]*방문[[:space:]]*(완료|예정)|전화[[:space:]]*응대[[:space:]]*완료'$c$;
begin
 select p.oid into o from pg_proc p join pg_namespace s on s.oid=p.pronamespace where s.nspname='crm_security' and p.proname='crm_inquiry_pipeline_promote_command_v1';
 if o is null then raise exception '문의 전환 명령 함수가 없습니다 — 아무것도 바꾸지 않았습니다'; end if;
 d:=pg_get_functiondef(o);
 if position(c in d)>0 then raise notice '전환 조건은 이미 정착 모드입니다 — 건너뜁니다'; return; end if;
 if position(b in d)>0 then hit:=b; elsif position(a in d)>0 then hit:=a; end if;
 if hit is null then raise exception '전환 조건 자리를 찾지 못했습니다 — 아무것도 바꾸지 않았습니다'; end if;
 n:=(length(d)-length(replace(d,hit,'')))/length(hit);
 if n<>1 then raise exception '전환 조건을 바꿀 자리가 %곳입니다(1곳이어야 함) — 아무것도 바꾸지 않았습니다',n; end if;
 execute replace(d,hit,c);
end $do$;

commit;
notify pgrst, 'reload schema';

-- 확인(읽기만): 세 값이 모두 true 면 설치 완료
select
 (select (public.crm_settle_mode_v1()->>'ok')::boolean) as settle_function,
 position('settle-mode-v1:start' in pg_get_functiondef('crm_security.crm_transition_validate_v1(text,jsonb,date)'::regprocedure))>0 as stage_fields_optional,
 position('전화[[:space:]]*응대[[:space:]]*완료' in (select pg_get_functiondef(p.oid) from pg_proc p join pg_namespace s on s.oid=p.pronamespace where s.nspname='crm_security' and p.proname='crm_inquiry_pipeline_promote_command_v1'))>0 as promote_on_contact;
