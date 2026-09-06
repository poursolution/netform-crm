-- Closed Won 이후 확장관리를 Active Pipeline Stage와 분리한다.
-- 적용 후 crm-api 번들에 crm_expansion_pool_json() 결과를 expansion_pool 키로 포함하고,
-- crm-write에 expansion_pool_upsert / expansion_pool_update 분기를 연결해야 한다.
begin;

alter table public.deals
  add column if not exists source_opportunity_id uuid references public.deals(id) on delete set null,
  add column if not exists origin_source text;

create index if not exists deals_source_opportunity_idx
  on public.deals(source_opportunity_id)
  where source_opportunity_id is not null;

create table if not exists public.crm_expansion_pool (
  id uuid primary key default gen_random_uuid(),
  source_opportunity_id uuid not null unique references public.deals(id) on delete restrict,
  site_id text,
  site_name text not null,
  source_work_summary text,
  source_won_amount numeric,
  completion_date date,
  owner_name text,
  last_contact_at timestamptz,
  next_contact_at date not null,
  candidate_work_items jsonb not null default '[]'::jsonb,
  relationship_state text not null default '기존고객',
  expansion_status text not null default '신규 대상',
  need_note text,
  created_opportunity_id uuid references public.deals(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint crm_expansion_pool_status_check check (expansion_status in (
    '신규 대상','접촉 예정','관계 관리중','추가 니즈 확인','신규 영업기회 생성','보류/휴면'
  )),
  constraint crm_expansion_pool_candidates_array check (jsonb_typeof(candidate_work_items)='array')
);

create index if not exists crm_expansion_pool_next_contact_idx
  on public.crm_expansion_pool(next_contact_at,expansion_status);
create index if not exists crm_expansion_pool_owner_idx
  on public.crm_expansion_pool(owner_name,expansion_status);

alter table public.crm_expansion_pool enable row level security;
drop policy if exists crm_expansion_pool_read on public.crm_expansion_pool;
create policy crm_expansion_pool_read on public.crm_expansion_pool
  for select to authenticated using (true);

create or replace function public.crm_expansion_pool_upsert(p jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
declare rid uuid; oid uuid; completed date; next_at date; candidates jsonb;
begin
  oid := (p->>'source_opportunity_id')::uuid;
  completed := coalesce(nullif(left(p->>'completion_date',10),'')::date,current_date);
  next_at := coalesce(nullif(left(p->>'next_contact_at',10),'')::date,completed+30);
  candidates := coalesce(p->'candidate_work_items','[]'::jsonb);
  if jsonb_typeof(candidates)<>'array' then raise exception 'candidate_work_items must be an array'; end if;

  insert into public.crm_expansion_pool (
    source_opportunity_id,site_id,site_name,source_work_summary,source_won_amount,
    completion_date,owner_name,last_contact_at,next_contact_at,candidate_work_items,
    relationship_state,expansion_status,need_note
  ) values (
    oid,nullif(p->>'site_id',''),coalesce(nullif(p->>'site_name',''),'현장명 미입력'),
    nullif(p->>'source_work_summary',''),nullif(p->>'source_won_amount','')::numeric,
    completed,nullif(p->>'owner_name',''),nullif(p->>'last_contact_at','')::timestamptz,
    next_at,candidates,coalesce(nullif(p->>'relationship_state',''),'기존고객'),
    coalesce(nullif(p->>'expansion_status',''),'신규 대상'),nullif(p->>'need_note','')
  ) on conflict (source_opportunity_id) do update set
    site_id=coalesce(excluded.site_id,crm_expansion_pool.site_id),
    site_name=excluded.site_name,
    source_work_summary=coalesce(excluded.source_work_summary,crm_expansion_pool.source_work_summary),
    source_won_amount=coalesce(excluded.source_won_amount,crm_expansion_pool.source_won_amount),
    completion_date=coalesce(excluded.completion_date,crm_expansion_pool.completion_date),
    owner_name=coalesce(excluded.owner_name,crm_expansion_pool.owner_name),
    next_contact_at=coalesce(crm_expansion_pool.next_contact_at,excluded.next_contact_at),
    candidate_work_items=case when excluded.candidate_work_items='[]'::jsonb then crm_expansion_pool.candidate_work_items else excluded.candidate_work_items end,
    updated_at=now()
  returning id into rid;
  return jsonb_build_object('ok',true,'expansion_record_id',rid,'source_opportunity_id',oid);
end $$;

create or replace function public.crm_expansion_pool_update(p jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
declare rid uuid; oid uuid; st text;
begin
  oid := (p->>'source_opportunity_id')::uuid;
  st := nullif(p->>'expansion_status','');
  if st is not null and st not in ('신규 대상','접촉 예정','관계 관리중','추가 니즈 확인','신규 영업기회 생성','보류/휴면') then
    raise exception 'invalid expansion_status';
  end if;
  update public.crm_expansion_pool set
    expansion_status=coalesce(st,expansion_status),
    next_contact_at=coalesce(nullif(left(p->>'next_contact_at',10),'')::date,next_contact_at),
    last_contact_at=coalesce(nullif(p->>'last_contact_at','')::timestamptz,last_contact_at),
    relationship_state=coalesce(nullif(p->>'relationship_state',''),relationship_state),
    created_opportunity_id=coalesce(nullif(p->>'created_opportunity_id','')::uuid,created_opportunity_id),
    need_note=coalesce(nullif(p->>'need_note',''),need_note),
    updated_at=now()
  where source_opportunity_id=oid returning id into rid;
  if rid is null then raise exception 'expansion record not found'; end if;
  return jsonb_build_object('ok',true,'expansion_record_id',rid,'source_opportunity_id',oid);
end $$;

create or replace function public.crm_expansion_pool_json()
returns jsonb language sql stable security definer set search_path=public as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id',id,'source_opportunity_id',source_opportunity_id,'site_id',site_id,'site_name',site_name,
    'source_work_summary',source_work_summary,'source_won_amount',source_won_amount,
    'completion_date',completion_date,'owner_name',owner_name,'last_contact_at',last_contact_at,
    'next_contact_at',next_contact_at,'candidate_work_items',candidate_work_items,
    'relationship_state',relationship_state,'expansion_status',expansion_status,
    'need_note',need_note,'created_opportunity_id',created_opportunity_id,
    'created_at',created_at,'updated_at',updated_at
  ) order by next_contact_at,created_at),'[]'::jsonb) from public.crm_expansion_pool;
$$;

-- deals의 실제 컬럼 구성이 조금 달라도 동작하도록 NEW를 jsonb로 읽는다.
create or replace function public.crm_create_expansion_after_closed_won()
returns trigger language plpgsql security definer set search_path=public as $$
declare j jsonb; old_j jsonb := '{}'::jsonb; stage_value text; old_stage text; completed_text text; completed date; eligible boolean := false;
begin
  j := to_jsonb(new);
  if tg_op='UPDATE' then old_j := to_jsonb(old); end if;
  stage_value := coalesce(j->>'code',j->>'stage_code','');
  old_stage := coalesce(old_j->>'code',old_j->>'stage_code','');
  completed_text := coalesce(j->>'completion_date',j->>'completed_at','');
  eligible := stage_value='expansion'
    or nullif(completed_text,'') is not null
    or (tg_op='UPDATE' and old_stage='completion'
      and (stage_value='won' or coalesce(j->>'outcome','')='won'));
  if not eligible then return new; end if;
  if stage_value not in ('won','expansion') and coalesce(j->>'outcome','')<>'won' then return new; end if;
  completed := coalesce(
    nullif(left(coalesce(j->>'completion_date',j->>'completed_at',j->>'closed_at',j->>'closed',''),10),'')::date,
    current_date
  );
  perform public.crm_expansion_pool_upsert(jsonb_build_object(
    'source_opportunity_id',new.id,
    'site_id',coalesce(j->>'site_id',j->>'siteId'),
    'site_name',coalesce(j->>'site',j->>'name','현장명 미입력'),
    'source_work_summary',coalesce(j->>'work_summary',j->>'work_name',j->>'work_type'),
    'source_won_amount',coalesce(j->>'won_amount',j->>'amt',j->>'amount'),
    'completion_date',completed,
    'owner_name',coalesce(j->>'assignee',j->>'owner_name',j->>'owner'),
    'last_contact_at',coalesce(j->>'last_meaningful_contact_at',j->>'last_activity'),
    'next_contact_at',completed+30,
    'candidate_work_items','[]'::jsonb,
    'relationship_state','기존고객',
    'expansion_status','신규 대상'
  ));
  return new;
end $$;

drop trigger if exists trg_deals_closed_won_expansion on public.deals;
create trigger trg_deals_closed_won_expansion
after insert or update on public.deals
for each row execute function public.crm_create_expansion_after_closed_won();

-- 과거 확장단계 레코드는 원 Deal을 재오픈하지 않고 Closed Won 기반 Pool로 이관한다.
insert into public.crm_expansion_pool (
  source_opportunity_id,site_id,site_name,source_work_summary,source_won_amount,
  completion_date,owner_name,next_contact_at,expansion_status
)
select d.id,to_jsonb(d)->>'site_id',coalesce(to_jsonb(d)->>'site',to_jsonb(d)->>'name','현장명 미입력'),
  coalesce(to_jsonb(d)->>'work_summary',to_jsonb(d)->>'work_name',to_jsonb(d)->>'work_type'),
  nullif(coalesce(to_jsonb(d)->>'won_amount',to_jsonb(d)->>'amt',to_jsonb(d)->>'amount'),'')::numeric,
  coalesce(nullif(left(coalesce(to_jsonb(d)->>'completion_date',to_jsonb(d)->>'closed_at',to_jsonb(d)->>'closed',''),10),'')::date,current_date),
  coalesce(to_jsonb(d)->>'assignee',to_jsonb(d)->>'owner_name',to_jsonb(d)->>'owner'),
  coalesce(nullif(left(coalesce(to_jsonb(d)->>'completion_date',to_jsonb(d)->>'closed_at',to_jsonb(d)->>'closed',''),10),'')::date,current_date)+30,
  '신규 대상'
from public.deals d
where (
  coalesce(to_jsonb(d)->>'code',to_jsonb(d)->>'stage_code')='expansion'
  or nullif(coalesce(to_jsonb(d)->>'completion_date',to_jsonb(d)->>'completed_at',''),'') is not null
)
and (
  coalesce(to_jsonb(d)->>'code',to_jsonb(d)->>'stage_code') in ('won','expansion')
  or coalesce(to_jsonb(d)->>'outcome','')='won'
)
on conflict (source_opportunity_id) do nothing;

grant execute on function public.crm_expansion_pool_upsert(jsonb) to service_role;
grant execute on function public.crm_expansion_pool_update(jsonb) to service_role;
grant execute on function public.crm_expansion_pool_json() to authenticated,service_role;

commit;
