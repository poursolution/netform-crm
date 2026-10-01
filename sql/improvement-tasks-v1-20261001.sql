-- 개선 과제 v1 (2026-10-01 디자인 핸드오프 pipeline ② '과제 등록' — 대표 결정: SQL 받아서 직접 실행)
-- 단계 진단·확장관리·경남지사 등 화면의 "그래서 뭘 해야 하나"에서 나온 과제를 저장하고 모아 본다.
-- 새 테이블 1개 + 함수 2개. 기존 테이블·권한은 건드리지 않는다. 다시 실행해도 안전하다(if not exists / create or replace).
--   · 테이블은 RLS를 켜고 정책을 두지 않는다 — 읽기·쓰기는 아래 함수로만 한다.
--   · 등록·수정·완료 처리: 관리자만.  · 목록 읽기: 로그인한 CRM 사용자.

create table if not exists public.improvement_tasks(
 id uuid primary key default gen_random_uuid(),
 scope text not null,                -- 어느 화면·단계에서 나온 과제인가 (예: pipeline:lost, expansion, gyeongnam)
 basis_key text not null,            -- 같은 근거의 과제를 다시 찾는 열쇠 (예: 사유 라벨)
 basis text not null,                -- 근거 문구 (예: 가격 열세 16건)
 title text not null,                -- 과제
 owner text not null,                -- 담당 (사람 이름 또는 팀)
 due date not null,                  -- 기한
 goal text,                          -- 이렇게 되면 성공
 notify text[] not null default '{}',-- 어디에 알릴까: today / brief / kpi
 status text not null default 'open' check (status in ('open','done','dropped')),
 created_by uuid not null,
 created_at timestamptz not null default now(),
 updated_by uuid,
 updated_at timestamptz not null default now()
);
create index if not exists improvement_tasks_scope_idx on public.improvement_tasks(scope,status);
alter table public.improvement_tasks enable row level security;
revoke all on table public.improvement_tasks from public, anon, authenticated;

create or replace function public.crm_improvement_task_save_v1(p jsonb)
returns jsonb language plpgsql volatile security definer set search_path='' as $fn$
declare
 a record; t public.improvement_tasks%rowtype;
 v_id uuid; v_scope text; v_key text; v_basis text; v_title text; v_owner text; v_due date; v_goal text; v_status text; v_notify text[];
begin
 select * into a from crm_security.actor();
 if not found then raise exception 'forbidden' using errcode='42501'; end if;
 if a.permission_role<>'admin' then raise exception '관리자만 과제를 등록·수정할 수 있습니다' using errcode='42501'; end if;
 if jsonb_typeof(p) is distinct from 'object' then raise exception 'invalid payload' using errcode='22023'; end if;
 begin
  v_id:=nullif(p->>'id','')::uuid;
  v_due:=nullif(p->>'due','')::date;
 exception when others then raise exception 'invalid payload' using errcode='22023'; end;
 v_scope:=nullif(btrim(coalesce(p->>'scope','')),'');
 v_key:=nullif(btrim(coalesce(p->>'basis_key','')),'');
 v_basis:=nullif(btrim(coalesce(p->>'basis','')),'');
 v_title:=nullif(btrim(coalesce(p->>'title','')),'');
 v_owner:=nullif(btrim(coalesce(p->>'owner','')),'');
 v_goal:=nullif(btrim(coalesce(p->>'goal','')),'');
 v_status:=coalesce(nullif(btrim(coalesce(p->>'status','')),''),'open');
 if v_scope is null or v_key is null or v_basis is null or v_title is null or v_owner is null or v_due is null then raise exception '과제·담당·기한을 모두 입력해 주세요' using errcode='22023'; end if;
 if length(v_scope)>80 or length(v_key)>200 or length(v_basis)>300 or length(v_title)>500 or length(v_owner)>100 or length(coalesce(v_goal,''))>500 then raise exception 'invalid payload' using errcode='22023'; end if;
 if v_status not in ('open','done','dropped') then raise exception 'invalid payload' using errcode='22023'; end if;
 select coalesce(array_agg(x),'{}') into v_notify from (select jsonb_array_elements_text(case when jsonb_typeof(p->'notify')='array' then p->'notify' else '[]'::jsonb end) x) s where x in ('today','brief','kpi');
 if v_id is null then
  insert into public.improvement_tasks(scope,basis_key,basis,title,owner,due,goal,notify,status,created_by)
   values(v_scope,v_key,v_basis,v_title,v_owner,v_due,v_goal,v_notify,v_status,a.user_id) returning * into t;
 else
  update public.improvement_tasks i set basis=v_basis,title=v_title,owner=v_owner,due=v_due,goal=v_goal,notify=v_notify,status=v_status,updated_by=a.user_id,updated_at=now()
   where i.id=v_id returning * into t;
  if not found then raise exception '과제를 찾을 수 없습니다' using errcode='22023'; end if;
 end if;
 return jsonb_build_object('ok',true,'task',to_jsonb(t));
end $fn$;
revoke all on function public.crm_improvement_task_save_v1(jsonb) from public, anon;
grant execute on function public.crm_improvement_task_save_v1(jsonb) to authenticated;

create or replace function public.crm_improvement_task_list_v1(p jsonb default '{}'::jsonb)
returns jsonb language plpgsql stable security definer set search_path='' as $fn$
declare a record;
begin
 select * into a from crm_security.actor();
 if not found then raise exception 'forbidden' using errcode='42501'; end if;
 return jsonb_build_object('ok',true,'tasks',coalesce((
  select jsonb_agg(to_jsonb(i) order by i.status, i.due, i.created_at)
  from public.improvement_tasks i
  where i.status<>'dropped' and (nullif(p->>'scope','') is null or i.scope=p->>'scope')),'[]'::jsonb));
end $fn$;
revoke all on function public.crm_improvement_task_list_v1(jsonb) from public, anon;
grant execute on function public.crm_improvement_task_list_v1(jsonb) to authenticated;
