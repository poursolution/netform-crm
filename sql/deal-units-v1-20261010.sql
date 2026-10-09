-- 관리 단위 v1 (2026-10-10 · design_handoff_units ① 단위 · 역할 정의)
-- 영업건(공종 · 연도)마다 참여 역할(지원 · 외부영업 · 관리 · 시공 담당)과 브랜드 3종(유입 · 제안 · 계약)을 저장한다.
-- 주담당(실적 귀속)은 여기 두지 않는다 — 이미 있는 crm_deal_owners(performance_owner · DealOwner.perf)가 한 곳이다(같은 정보 두 곳 금지).
-- 책임자 1명은 다음 행동(next_actions.assignee_name)이 이미 가진다. 업무 · 요청은 영업건 id 에 연결돼 있다(work_requests.target_id).
-- 쓰기 = 관리자 또는 그 영업건의 현재 담당. 바꿀 때마다 이력(전 → 후 · 누가 · 언제). 영업 데이터(단계 · 금액 · 담당 · 계약실적)는 건드리지 않는다.
-- 다시 실행해도 안전. 운영 적용: Supabase SQL 편집기에서 대표가 Run.

create table if not exists crm_security.deal_units(
 deal_id text primary key,
 roles jsonb not null default '[]'::jsonb,          -- [{name, role}] role ∈ 지원 · 외부영업 · 관리 · 시공 담당 (주담당 제외)
 brand_inflow text,                                  -- 유입 브랜드
 brand_proposal text,                                -- 제안 브랜드
 brand_contract text,                                -- 계약 브랜드
 updated_by uuid,
 updated_by_name text,
 updated_at timestamptz not null default now()
);
alter table crm_security.deal_units enable row level security;
revoke all on table crm_security.deal_units from public, anon, authenticated;

create table if not exists crm_security.deal_unit_events(
 id bigserial primary key,
 deal_id text not null,
 before jsonb,
 after jsonb not null,
 actor uuid,
 actor_name text,
 at timestamptz not null default now()
);
alter table crm_security.deal_unit_events enable row level security;
revoke all on table crm_security.deal_unit_events from public, anon, authenticated;
create index if not exists deal_unit_events_deal on crm_security.deal_unit_events(deal_id,at desc);

create or replace function public.crm_deal_unit_save_v1(p jsonb default '{}'::jsonb)
returns jsonb language plpgsql volatile security definer set search_path='' as $fn$
declare
 a record; v_deal text; v_roles jsonb; v_in text; v_pr text; v_ct text; v_name text; old jsonb; cur jsonb; e jsonb; n int:=0;
 allowed constant text[]:=array['지원','외부영업','관리','시공 담당'];
begin
 select * into a from crm_security.actor();
 if not found then raise exception 'forbidden' using errcode='42501'; end if;
 if jsonb_typeof(p) is distinct from 'object' then raise exception 'invalid payload' using errcode='22023'; end if;
 v_deal:=nullif(btrim(coalesce(p->>'deal_id','')),'');
 if v_deal is null or length(v_deal)>80 then raise exception 'invalid payload' using errcode='22023'; end if;
 if not exists(select 1 from public.deals d where d.id::text=v_deal) then raise exception '영업건을 찾을 수 없습니다' using errcode='22023'; end if;
 select u.name into v_name from public.users u where u.user_id=a.user_id;
 -- 관리자 또는 그 영업건의 현재 담당만
 if a.permission_role<>'admin' and not exists(select 1 from public.deals d where d.id::text=v_deal and (d.owner_id=a.user_id or (v_name is not null and btrim(coalesce(d.assignee_name,''))=btrim(v_name)))) then
  raise exception '관리자 또는 담당자만 관리 단위를 바꿀 수 있습니다' using errcode='42501';
 end if;
 v_roles:=coalesce(p->'roles','[]'::jsonb);
 if jsonb_typeof(v_roles)<>'array' or jsonb_array_length(v_roles)>10 then raise exception '참여 역할은 10명까지입니다' using errcode='22023'; end if;
 for e in select * from jsonb_array_elements(v_roles) loop
  if jsonb_typeof(e)<>'object' or length(btrim(coalesce(e->>'name','')))<1 or length(e->>'name')>40 or not ((e->>'role')=any(allowed)) then
   raise exception '참여 역할 형식이 올바르지 않습니다(이름 1~40자 · 역할은 지원 · 외부영업 · 관리 · 시공 담당)' using errcode='22023';
  end if;
  n:=n+1;
 end loop;
 -- 이름 + 역할 중복 제거 · 이름 · 역할만 남긴다
 select coalesce(jsonb_agg(jsonb_build_object('name',x.name,'role',x.role) order by x.ord),'[]'::jsonb) into v_roles
  from (select distinct on (btrim(t.it->>'name'),t.it->>'role') btrim(t.it->>'name') as name,t.it->>'role' as role,t.ord from jsonb_array_elements(v_roles) with ordinality t(it,ord) order by btrim(t.it->>'name'),t.it->>'role',t.ord) x;
 v_in:=nullif(left(btrim(coalesce(p->>'brand_inflow','')),40),'');
 v_pr:=nullif(left(btrim(coalesce(p->>'brand_proposal','')),40),'');
 v_ct:=nullif(left(btrim(coalesce(p->>'brand_contract','')),40),'');
 select to_jsonb(u) into old from crm_security.deal_units u where u.deal_id=v_deal;
 insert into crm_security.deal_units(deal_id,roles,brand_inflow,brand_proposal,brand_contract,updated_by,updated_by_name,updated_at)
  values(v_deal,v_roles,v_in,v_pr,v_ct,a.user_id,v_name,clock_timestamp())
  on conflict (deal_id) do update set roles=excluded.roles,brand_inflow=excluded.brand_inflow,brand_proposal=excluded.brand_proposal,brand_contract=excluded.brand_contract,updated_by=excluded.updated_by,updated_by_name=excluded.updated_by_name,updated_at=excluded.updated_at;
 select to_jsonb(u) into cur from crm_security.deal_units u where u.deal_id=v_deal;
 -- 값(역할 · 브랜드)이 실제로 바뀌었을 때만 이력(저장 시각 · 저장자만 바뀐 것은 이력이 아니다)
 if old is null or (old-'updated_at'-'updated_by'-'updated_by_name') is distinct from (cur-'updated_at'-'updated_by'-'updated_by_name') then
  insert into crm_security.deal_unit_events(deal_id,before,after,actor,actor_name) values(v_deal,old,cur,a.user_id,v_name);
 end if;
 return jsonb_build_object('ok',true,'contract',1,'unit',cur);
end $fn$;
revoke all on function public.crm_deal_unit_save_v1(jsonb) from public, anon;
grant execute on function public.crm_deal_unit_save_v1(jsonb) to authenticated;

-- 읽기: 로그인한 사용자 전부(영업건 목록은 이미 모두 본다). deal_id 를 주면 그 건의 이력도 함께
create or replace function public.crm_deal_unit_list_v1(p jsonb default '{}'::jsonb)
returns jsonb language plpgsql stable security definer set search_path='' as $fn$
declare a record; v_deal text;
begin
 select * into a from crm_security.actor();
 if not found then raise exception 'forbidden' using errcode='42501'; end if;
 v_deal:=nullif(btrim(coalesce(p->>'deal_id','')),'');
 return jsonb_build_object('ok',true,'contract',1,
  'units',coalesce((select jsonb_agg(to_jsonb(u) order by u.updated_at desc) from (select * from crm_security.deal_units where v_deal is null or deal_id=v_deal order by updated_at desc limit 5000) u),'[]'::jsonb),
  'events',case when v_deal is null then '[]'::jsonb else coalesce((select jsonb_agg(jsonb_build_object('before',x.before,'after',x.after,'by',x.actor_name,'at',x.at) order by x.at desc) from (select * from crm_security.deal_unit_events where deal_id=v_deal order by at desc limit 50) x),'[]'::jsonb) end);
end $fn$;
revoke all on function public.crm_deal_unit_list_v1(jsonb) from public, anon;
grant execute on function public.crm_deal_unit_list_v1(jsonb) to authenticated;
