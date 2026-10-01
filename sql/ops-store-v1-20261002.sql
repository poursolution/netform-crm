-- 운영 저장소 v1 (2026-10-02 · 대표 승인: KPI 약속 · 주간 결과 · 처리 기록 · 보고 스냅샷 · AI 제안 · 병합 기록 · 설정 플래그)
-- 관리팀 KPI(설정 · 4주 이력 · 처리 기록), 주간 브리핑 · 리포트(스냅샷 · 대표 응답 · 지난 약속 결과), AI 제안(공종 추정 · 질문 해석 · 보고 문장 · 중복 판단),
-- 데이터 정리(병합 기록 · 30일 되돌리기 준비)가 쓰는 저장소다.
-- 새 테이블 7개 + 함수 14개. 기존 테이블 · 권한은 건드리지 않는다. 다시 실행해도 안전하다(if not exists / create or replace).
--   · 모든 테이블은 RLS를 켜고 정책을 두지 않는다 — 읽기 · 쓰기는 아래 함수로만 한다.
--   · 쓰기는 관리자만(처리 기록 남기기와 AI 제안 확정 · 거절은 로그인 사용자). 읽기는 로그인한 CRM 사용자.
--   · 강제 적용(자동 배정 · 단계 이동 차단) · AI · 병합 · 잔디 발송은 플래그만 만든다 — 기본은 전부 꺼짐(false).
--   · AI 결과는 '제안'으로만 저장된다. 사람이 확정(accepted)해도 이 함수들은 영업 데이터를 바꾸지 않는다 — 반영은 기존 저장 경로가 한다.
--   · 병합 기록(merge_log)은 읽기 함수만 연다. 실제 합치기 · 30일 되돌리기 함수는 운영 확인 뒤 따로 설치한다.

-- ───────── 1. 설정 플래그 ─────────
create table if not exists public.crm_settings(
 key text primary key,
 value jsonb not null,
 updated_by uuid,
 updated_at timestamptz not null default now()
);
alter table public.crm_settings enable row level security;
revoke all on table public.crm_settings from public, anon, authenticated;
insert into public.crm_settings(key,value) values
 ('enforce_auto_assign','false'::jsonb),   -- 미배정 문의 자동 배정 강제
 ('enforce_stage_block','false'::jsonb),   -- 다음 할 일 없으면 단계 이동 차단
 ('ai_enabled','false'::jsonb),            -- Claude API 제안 사용
 ('merge_enabled','false'::jsonb),         -- 데이터 정리 합치기 · 연결 승인
 ('jandi_enabled','false'::jsonb)          -- 주간 브리핑 · 리포트 잔디 발송
on conflict (key) do nothing;

create or replace function public.crm_ops_settings_v1(p jsonb default '{}'::jsonb)
returns jsonb language plpgsql volatile security definer set search_path='' as $fn$
declare a record; k text; v jsonb;
begin
 select * into a from crm_security.actor();
 if not found then raise exception 'forbidden' using errcode='42501'; end if;
 if jsonb_typeof(p->'set')='object' then
  if a.permission_role<>'admin' then raise exception '관리자만 설정을 바꿀 수 있습니다' using errcode='42501'; end if;
  for k,v in select * from jsonb_each(p->'set') loop
   if k not in ('enforce_auto_assign','enforce_stage_block','ai_enabled','merge_enabled','jandi_enabled') or jsonb_typeof(v)<>'boolean' then
    raise exception 'invalid payload' using errcode='22023';
   end if;
   insert into public.crm_settings(key,value,updated_by,updated_at) values(k,v,a.user_id,now())
    on conflict (key) do update set value=excluded.value,updated_by=excluded.updated_by,updated_at=excluded.updated_at;
  end loop;
 end if;
 return jsonb_build_object('ok',true,'settings',coalesce((select jsonb_object_agg(s.key,s.value) from public.crm_settings s),'{}'::jsonb));
end $fn$;
revoke all on function public.crm_ops_settings_v1(jsonb) from public, anon;
grant execute on function public.crm_ops_settings_v1(jsonb) to authenticated;

-- ───────── 2. 관리팀 KPI: 약속(기준) ─────────
create table if not exists public.kpi_promises(
 promise_key text primary key,          -- 화면의 약속 열쇠 (예: assign_same_day)
 title text not null,                   -- 약속 문장
 target numeric not null,               -- 목표(%)
 measure text,                          -- 재는 법
 consequence text,                      -- 안 하면
 active boolean not null default true,
 sort int not null default 0,
 updated_by uuid,
 updated_at timestamptz not null default now()
);
alter table public.kpi_promises enable row level security;
revoke all on table public.kpi_promises from public, anon, authenticated;

create or replace function public.crm_kpi_promise_save_v1(p jsonb)
returns jsonb language plpgsql volatile security definer set search_path='' as $fn$
declare a record; t public.kpi_promises%rowtype; v_key text; v_title text; v_target numeric;
begin
 select * into a from crm_security.actor();
 if not found then raise exception 'forbidden' using errcode='42501'; end if;
 if a.permission_role<>'admin' then raise exception '관리자만 약속 기준을 바꿀 수 있습니다' using errcode='42501'; end if;
 if jsonb_typeof(p) is distinct from 'object' then raise exception 'invalid payload' using errcode='22023'; end if;
 v_key:=nullif(btrim(coalesce(p->>'promise_key','')),'');
 v_title:=nullif(btrim(coalesce(p->>'title','')),'');
 begin v_target:=nullif(p->>'target','')::numeric; exception when others then raise exception 'invalid payload' using errcode='22023'; end;
 if v_key is null or v_title is null or v_target is null or v_target<0 or v_target>100 or length(v_key)>80 or length(v_title)>300 then
  raise exception '약속 · 목표(0~100)를 확인해 주세요' using errcode='22023';
 end if;
 insert into public.kpi_promises(promise_key,title,target,measure,consequence,active,sort,updated_by,updated_at)
  values(v_key,v_title,v_target,nullif(btrim(coalesce(p->>'measure','')),''),nullif(btrim(coalesce(p->>'consequence','')),''),
         coalesce((p->>'active')::boolean,true),coalesce((p->>'sort')::int,0),a.user_id,now())
  on conflict (promise_key) do update set title=excluded.title,target=excluded.target,measure=excluded.measure,consequence=excluded.consequence,
   active=excluded.active,sort=excluded.sort,updated_by=excluded.updated_by,updated_at=excluded.updated_at
  returning * into t;
 return jsonb_build_object('ok',true,'promise',to_jsonb(t));
end $fn$;
revoke all on function public.crm_kpi_promise_save_v1(jsonb) from public, anon;
grant execute on function public.crm_kpi_promise_save_v1(jsonb) to authenticated;

create or replace function public.crm_kpi_promise_list_v1(p jsonb default '{}'::jsonb)
returns jsonb language plpgsql stable security definer set search_path='' as $fn$
declare a record;
begin
 select * into a from crm_security.actor();
 if not found then raise exception 'forbidden' using errcode='42501'; end if;
 return jsonb_build_object('ok',true,'promises',coalesce((select jsonb_agg(to_jsonb(k) order by k.sort,k.promise_key) from public.kpi_promises k),'[]'::jsonb));
end $fn$;
revoke all on function public.crm_kpi_promise_list_v1(jsonb) from public, anon;
grant execute on function public.crm_kpi_promise_list_v1(jsonb) to authenticated;

-- ───────── 3. 관리팀 KPI: 주간 결과(4주 이력) ─────────
create table if not exists public.kpi_weekly(
 week_start date not null,              -- 그 주 월요일
 promise_key text not null,
 numerator int not null,
 denominator int not null,
 saved_by uuid not null,
 saved_at timestamptz not null default now(),
 primary key(week_start,promise_key),
 check (numerator>=0 and denominator>=0 and numerator<=denominator)
);
alter table public.kpi_weekly enable row level security;
revoke all on table public.kpi_weekly from public, anon, authenticated;

create or replace function public.crm_kpi_weekly_save_v1(p jsonb)
returns jsonb language plpgsql volatile security definer set search_path='' as $fn$
declare a record; v_week date; r jsonb; n int:=0; v_key text; v_num int; v_den int;
begin
 select * into a from crm_security.actor();
 if not found then raise exception 'forbidden' using errcode='42501'; end if;
 if a.permission_role<>'admin' then raise exception '관리자만 주간 결과를 저장할 수 있습니다' using errcode='42501'; end if;
 begin v_week:=nullif(p->>'week_start','')::date; exception when others then raise exception 'invalid payload' using errcode='22023'; end;
 if v_week is null or extract(isodow from v_week)<>1 or v_week>current_date or jsonb_typeof(p->'rows')<>'array' or jsonb_array_length(p->'rows')>60 then
  raise exception '주(월요일 날짜)와 결과를 확인해 주세요' using errcode='22023';
 end if;
 for r in select * from jsonb_array_elements(p->'rows') loop
  v_key:=nullif(btrim(coalesce(r->>'promise_key','')),'');
  begin v_num:=(r->>'numerator')::int; v_den:=(r->>'denominator')::int; exception when others then raise exception 'invalid payload' using errcode='22023'; end;
  if v_key is null or length(v_key)>80 or v_num is null or v_den is null or v_num<0 or v_den<0 or v_num>v_den then raise exception 'invalid payload' using errcode='22023'; end if;
  insert into public.kpi_weekly(week_start,promise_key,numerator,denominator,saved_by,saved_at) values(v_week,v_key,v_num,v_den,a.user_id,now())
   on conflict (week_start,promise_key) do update set numerator=excluded.numerator,denominator=excluded.denominator,saved_by=excluded.saved_by,saved_at=excluded.saved_at;
  n:=n+1;
 end loop;
 return jsonb_build_object('ok',true,'week_start',v_week,'saved',n);
end $fn$;
revoke all on function public.crm_kpi_weekly_save_v1(jsonb) from public, anon;
grant execute on function public.crm_kpi_weekly_save_v1(jsonb) to authenticated;

create or replace function public.crm_kpi_weekly_list_v1(p jsonb default '{}'::jsonb)
returns jsonb language plpgsql stable security definer set search_path='' as $fn$
declare a record; v_weeks int;
begin
 select * into a from crm_security.actor();
 if not found then raise exception 'forbidden' using errcode='42501'; end if;
 v_weeks:=least(greatest(coalesce(nullif(p->>'weeks','')::int,4),1),26);
 return jsonb_build_object('ok',true,'rows',coalesce((
  select jsonb_agg(to_jsonb(w) order by w.week_start desc,w.promise_key)
  from public.kpi_weekly w where w.week_start>=current_date-(v_weeks*7+6)),'[]'::jsonb));
end $fn$;
revoke all on function public.crm_kpi_weekly_list_v1(jsonb) from public, anon;
grant execute on function public.crm_kpi_weekly_list_v1(jsonb) to authenticated;

-- ───────── 4. 관리팀 KPI: 처리 기록 ─────────
create table if not exists public.kpi_actions(
 id uuid primary key default gen_random_uuid(),
 promise_key text not null,
 action text not null,                  -- 무엇을 했나 (예: 담당 정하기 · 담당에게 전화 · 기록 요청)
 target_type text,                      -- inquiry / deal / person
 target_id text,
 target_name text,
 note text,
 actor uuid not null,
 actor_name text not null,
 created_at timestamptz not null default now()
);
create index if not exists kpi_actions_created_idx on public.kpi_actions(created_at desc);
alter table public.kpi_actions enable row level security;
revoke all on table public.kpi_actions from public, anon, authenticated;

create or replace function public.crm_kpi_action_log_v1(p jsonb)
returns jsonb language plpgsql volatile security definer set search_path='' as $fn$
declare a record; t public.kpi_actions%rowtype; v_key text; v_action text;
begin
 select * into a from crm_security.actor();
 if not found then raise exception 'forbidden' using errcode='42501'; end if;
 if jsonb_typeof(p) is distinct from 'object' then raise exception 'invalid payload' using errcode='22023'; end if;
 v_key:=nullif(btrim(coalesce(p->>'promise_key','')),'');
 v_action:=nullif(btrim(coalesce(p->>'action','')),'');
 if v_key is null or v_action is null or length(v_key)>80 or length(v_action)>200 or length(coalesce(p->>'note',''))>500
    or length(coalesce(p->>'target_id',''))>80 or length(coalesce(p->>'target_name',''))>200
    or coalesce(p->>'target_type','') not in ('','inquiry','deal','person') then
  raise exception 'invalid payload' using errcode='22023';
 end if;
 insert into public.kpi_actions(promise_key,action,target_type,target_id,target_name,note,actor,actor_name)
  values(v_key,v_action,nullif(p->>'target_type',''),nullif(p->>'target_id',''),nullif(btrim(coalesce(p->>'target_name','')),''),nullif(btrim(coalesce(p->>'note','')),''),a.user_id,a.display_name)
  returning * into t;
 return jsonb_build_object('ok',true,'action',to_jsonb(t));
end $fn$;
revoke all on function public.crm_kpi_action_log_v1(jsonb) from public, anon;
grant execute on function public.crm_kpi_action_log_v1(jsonb) to authenticated;

create or replace function public.crm_kpi_action_list_v1(p jsonb default '{}'::jsonb)
returns jsonb language plpgsql stable security definer set search_path='' as $fn$
declare a record; v_limit int;
begin
 select * into a from crm_security.actor();
 if not found then raise exception 'forbidden' using errcode='42501'; end if;
 v_limit:=least(greatest(coalesce(nullif(p->>'limit','')::int,50),1),200);
 return jsonb_build_object('ok',true,'actions',coalesce((
  select jsonb_agg(to_jsonb(x) order by x.created_at desc) from (
   select k.* from public.kpi_actions k
   where (nullif(p->>'promise_key','') is null or k.promise_key=p->>'promise_key')
   order by k.created_at desc limit v_limit) x),'[]'::jsonb));
end $fn$;
revoke all on function public.crm_kpi_action_list_v1(jsonb) from public, anon;
grant execute on function public.crm_kpi_action_list_v1(jsonb) to authenticated;

-- ───────── 5. 보고 스냅샷 (주간 브리핑 · 월간 리포트) + 대표 응답 ─────────
create table if not exists public.report_snapshots(
 kind text not null check (kind in ('weekly','monthly','quarterly','yearly')),
 period_key text not null,              -- weekly: 그 주 월요일(YYYY-MM-DD) · monthly: YYYY-MM · quarterly: YYYY-Qn · yearly: YYYY
 payload jsonb not null,                -- 그 시점 숫자 · 문장(화면이 계산한 값 그대로)
 promises jsonb not null default '[]'::jsonb,  -- 그 기간의 행동 약속
 boss_response text check (boss_response in ('yes','partial','no')),
 boss_note text,
 boss_response_at timestamptz,
 boss_response_by uuid,
 saved_by uuid not null,
 saved_at timestamptz not null default now(),
 primary key(kind,period_key)
);
alter table public.report_snapshots enable row level security;
revoke all on table public.report_snapshots from public, anon, authenticated;

create or replace function public.crm_report_snapshot_save_v1(p jsonb)
returns jsonb language plpgsql volatile security definer set search_path='' as $fn$
declare a record; v_kind text; v_key text;
begin
 select * into a from crm_security.actor();
 if not found then raise exception 'forbidden' using errcode='42501'; end if;
 if a.permission_role<>'admin' then raise exception '관리자만 스냅샷을 저장할 수 있습니다' using errcode='42501'; end if;
 v_kind:=coalesce(p->>'kind',''); v_key:=nullif(btrim(coalesce(p->>'period_key','')),'');
 if v_kind not in ('weekly','monthly','quarterly','yearly') or v_key is null or length(v_key)>20 or jsonb_typeof(p->'payload')<>'object'
    or pg_catalog.octet_length((p->'payload')::text)>200000
    or (p ? 'promises' and jsonb_typeof(p->'promises')<>'array') then
  raise exception 'invalid payload' using errcode='22023';
 end if;
 insert into public.report_snapshots(kind,period_key,payload,promises,saved_by,saved_at)
  values(v_kind,v_key,p->'payload',coalesce(p->'promises','[]'::jsonb),a.user_id,now())
  on conflict (kind,period_key) do update set payload=excluded.payload,promises=excluded.promises,saved_by=excluded.saved_by,saved_at=excluded.saved_at;
 return jsonb_build_object('ok',true,'kind',v_kind,'period_key',v_key);
end $fn$;
revoke all on function public.crm_report_snapshot_save_v1(jsonb) from public, anon;
grant execute on function public.crm_report_snapshot_save_v1(jsonb) to authenticated;

create or replace function public.crm_report_snapshot_get_v1(p jsonb)
returns jsonb language plpgsql stable security definer set search_path='' as $fn$
declare a record; v_kind text;
begin
 select * into a from crm_security.actor();
 if not found then raise exception 'forbidden' using errcode='42501'; end if;
 v_kind:=coalesce(p->>'kind','');
 if v_kind not in ('weekly','monthly','quarterly','yearly') then raise exception 'invalid payload' using errcode='22023'; end if;
 -- period_key 를 주면 그 기간 하나, 안 주면 최근 것부터(기본 6개)
 return jsonb_build_object('ok',true,'snapshots',coalesce((
  select jsonb_agg(to_jsonb(x) order by x.period_key desc) from (
   select s.* from public.report_snapshots s
   where s.kind=v_kind and (nullif(p->>'period_key','') is null or s.period_key=p->>'period_key')
   order by s.period_key desc limit least(greatest(coalesce(nullif(p->>'limit','')::int,6),1),30)) x),'[]'::jsonb));
end $fn$;
revoke all on function public.crm_report_snapshot_get_v1(jsonb) from public, anon;
grant execute on function public.crm_report_snapshot_get_v1(jsonb) to authenticated;

create or replace function public.crm_report_response_save_v1(p jsonb)
returns jsonb language plpgsql volatile security definer set search_path='' as $fn$
declare a record; v_resp text; n int;
begin
 select * into a from crm_security.actor();
 if not found then raise exception 'forbidden' using errcode='42501'; end if;
 if a.permission_role<>'admin' then raise exception '관리자만 응답을 남길 수 있습니다' using errcode='42501'; end if;
 v_resp:=coalesce(p->>'response','');
 if v_resp not in ('yes','partial','no') or length(coalesce(p->>'note',''))>500 then raise exception 'invalid payload' using errcode='22023'; end if;
 update public.report_snapshots s set boss_response=v_resp,boss_note=nullif(btrim(coalesce(p->>'note','')),''),boss_response_at=now(),boss_response_by=a.user_id
  where s.kind=coalesce(p->>'kind','') and s.period_key=coalesce(p->>'period_key','');
 get diagnostics n=row_count;
 if n=0 then raise exception '먼저 그 기간의 보고를 저장해 주세요' using errcode='22023'; end if;
 return jsonb_build_object('ok',true,'response',v_resp);
end $fn$;
revoke all on function public.crm_report_response_save_v1(jsonb) from public, anon;
grant execute on function public.crm_report_response_save_v1(jsonb) to authenticated;

-- ───────── 6. AI 제안 (저장만 · 사람이 확정) ─────────
create table if not exists public.ai_suggestions(
 id uuid primary key default gen_random_uuid(),
 kind text not null check (kind in ('work_guess','ask_parse','report_text','dup_judge','next_action','call_opener')),
 subject_type text not null,            -- deal / inquiry / pair / report / question
 subject_id text not null,
 input_hash text not null,              -- 같은 입력이면 다시 만들지 않는다
 suggestion jsonb not null,
 model text,
 status text not null default 'proposed' check (status in ('proposed','accepted','rejected')),
 decided_by uuid,
 decided_at timestamptz,
 created_by uuid not null,
 created_at timestamptz not null default now(),
 unique(kind,subject_type,subject_id,input_hash)
);
create index if not exists ai_suggestions_subject_idx on public.ai_suggestions(kind,subject_type,subject_id,created_at desc);
alter table public.ai_suggestions enable row level security;
revoke all on table public.ai_suggestions from public, anon, authenticated;

create or replace function public.crm_ai_suggestion_save_v1(p jsonb)
returns jsonb language plpgsql volatile security definer set search_path='' as $fn$
declare a record; t public.ai_suggestions%rowtype; v_kind text; v_type text; v_id text; v_hash text;
begin
 select * into a from crm_security.actor();
 if not found then raise exception 'forbidden' using errcode='42501'; end if;
 if not coalesce((select (s.value)::text='true' from public.crm_settings s where s.key='ai_enabled'),false) then
  raise exception 'AI 제안이 꺼져 있습니다' using errcode='42501';
 end if;
 v_kind:=coalesce(p->>'kind',''); v_type:=nullif(btrim(coalesce(p->>'subject_type','')),''); v_id:=nullif(btrim(coalesce(p->>'subject_id','')),''); v_hash:=nullif(btrim(coalesce(p->>'input_hash','')),'');
 if v_kind not in ('work_guess','ask_parse','report_text','dup_judge','next_action','call_opener') or v_type is null or v_id is null or v_hash is null
    or length(v_type)>40 or length(v_id)>200 or length(v_hash)>128 or jsonb_typeof(p->'suggestion')<>'object'
    or pg_catalog.octet_length((p->'suggestion')::text)>20000 or length(coalesce(p->>'model',''))>80 then
  raise exception 'invalid payload' using errcode='22023';
 end if;
 insert into public.ai_suggestions(kind,subject_type,subject_id,input_hash,suggestion,model,created_by)
  values(v_kind,v_type,v_id,v_hash,p->'suggestion',nullif(p->>'model',''),a.user_id)
  on conflict (kind,subject_type,subject_id,input_hash) do update set suggestion=public.ai_suggestions.suggestion
  returning * into t;
 return jsonb_build_object('ok',true,'suggestion',to_jsonb(t));
end $fn$;
revoke all on function public.crm_ai_suggestion_save_v1(jsonb) from public, anon;
grant execute on function public.crm_ai_suggestion_save_v1(jsonb) to authenticated;

create or replace function public.crm_ai_suggestion_list_v1(p jsonb)
returns jsonb language plpgsql stable security definer set search_path='' as $fn$
declare a record; v_kind text;
begin
 select * into a from crm_security.actor();
 if not found then raise exception 'forbidden' using errcode='42501'; end if;
 v_kind:=coalesce(p->>'kind','');
 if v_kind not in ('work_guess','ask_parse','report_text','dup_judge','next_action','call_opener') then raise exception 'invalid payload' using errcode='22023'; end if;
 return jsonb_build_object('ok',true,'suggestions',coalesce((
  select jsonb_agg(to_jsonb(x) order by x.created_at desc) from (
   select s.* from public.ai_suggestions s
   where s.kind=v_kind
     and (nullif(p->>'subject_type','') is null or s.subject_type=p->>'subject_type')
     and (jsonb_typeof(p->'subject_ids')<>'array' or p->'subject_ids' is null or s.subject_id in (select jsonb_array_elements_text(p->'subject_ids')))
     and (nullif(p->>'status','') is null or s.status=p->>'status')
   order by s.created_at desc limit least(greatest(coalesce(nullif(p->>'limit','')::int,200),1),1000)) x),'[]'::jsonb));
end $fn$;
revoke all on function public.crm_ai_suggestion_list_v1(jsonb) from public, anon;
grant execute on function public.crm_ai_suggestion_list_v1(jsonb) to authenticated;

create or replace function public.crm_ai_suggestion_decide_v1(p jsonb)
returns jsonb language plpgsql volatile security definer set search_path='' as $fn$
declare a record; t public.ai_suggestions%rowtype; v_id uuid; v_status text;
begin
 select * into a from crm_security.actor();
 if not found then raise exception 'forbidden' using errcode='42501'; end if;
 begin v_id:=nullif(p->>'id','')::uuid; exception when others then raise exception 'invalid payload' using errcode='22023'; end;
 v_status:=coalesce(p->>'status','');
 if v_id is null or v_status not in ('accepted','rejected') then raise exception 'invalid payload' using errcode='22023'; end if;
 -- 확정 · 거절만 기록한다. 영업 데이터는 이 함수가 바꾸지 않는다(반영은 화면의 기존 저장 경로).
 update public.ai_suggestions s set status=v_status,decided_by=a.user_id,decided_at=now() where s.id=v_id returning * into t;
 if not found then raise exception '제안을 찾을 수 없습니다' using errcode='22023'; end if;
 return jsonb_build_object('ok',true,'suggestion',to_jsonb(t));
end $fn$;
revoke all on function public.crm_ai_suggestion_decide_v1(jsonb) from public, anon;
grant execute on function public.crm_ai_suggestion_decide_v1(jsonb) to authenticated;

-- ───────── 7. 병합 기록 (30일 되돌리기 준비 · 지금은 읽기만) ─────────
create table if not exists public.merge_log(
 id uuid primary key default gen_random_uuid(),
 pair_key text not null,
 action text not null check (action in ('merge','link')),
 keep_type text not null, keep_id text not null,      -- 남긴 쪽 (먼저 등록)
 hide_type text not null, hide_id text not null,      -- 숨긴 쪽 (삭제하지 않는다)
 before jsonb not null,                               -- 되돌리기에 필요한 원래 값
 note text,
 merged_by uuid not null,
 merged_at timestamptz not null default now(),
 undo_until timestamptz not null default (now()+interval '30 days'),
 undone_by uuid,
 undone_at timestamptz
);
create index if not exists merge_log_merged_idx on public.merge_log(merged_at desc);
alter table public.merge_log enable row level security;
revoke all on table public.merge_log from public, anon, authenticated;

create or replace function public.crm_merge_log_list_v1(p jsonb default '{}'::jsonb)
returns jsonb language plpgsql stable security definer set search_path='' as $fn$
declare a record;
begin
 select * into a from crm_security.actor();
 if not found then raise exception 'forbidden' using errcode='42501'; end if;
 if a.permission_role<>'admin' then raise exception '관리자만 병합 기록을 볼 수 있습니다' using errcode='42501'; end if;
 return jsonb_build_object('ok',true,'rows',coalesce((
  select jsonb_agg(jsonb_build_object('id',m.id,'pair_key',m.pair_key,'action',m.action,'keep_type',m.keep_type,'keep_id',m.keep_id,'hide_type',m.hide_type,'hide_id',m.hide_id,
    'note',m.note,'merged_at',m.merged_at,'undo_until',m.undo_until,'undone_at',m.undone_at,'can_undo',m.undone_at is null and m.undo_until>now()) order by m.merged_at desc)
  from public.merge_log m where m.merged_at>now()-interval '180 days'),'[]'::jsonb));
end $fn$;
revoke all on function public.crm_merge_log_list_v1(jsonb) from public, anon;
grant execute on function public.crm_merge_log_list_v1(jsonb) to authenticated;
