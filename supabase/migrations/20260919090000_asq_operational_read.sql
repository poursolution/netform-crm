-- ASQ remains the operational source of truth. CRM stores a read-only mirror
-- written by service_role and exposes only rows the signed-in CRM actor may read.

create extension if not exists pgcrypto;

do $$
begin
  if to_regprocedure('public.crm_operational_source_v1(text,uuid,integer)') is null
     or to_regprocedure('crm_security.can_deal(uuid,boolean)') is null then
    raise exception 'ASQ operational read prerequisites are missing';
  end if;
end $$;

create table if not exists public.crm_asq_project_links (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid not null references public.deals(id) on delete cascade,
  site_id text,
  asq_project_id text not null,
  project_url text,
  service_type text,
  project_status text,
  supervisor_name text,
  contract_amount numeric,
  contract_signed_at date,
  contract_started_at date,
  contract_ended_at date,
  construction_started_at date,
  expected_completion_at date,
  last_supervision_at timestamptz,
  next_visit_at timestamptz,
  report_status text,
  source_updated_at timestamptz,
  synced_at timestamptz not null default clock_timestamp(),
  raw_payload jsonb not null default '{}'::jsonb,
  write_id text,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp()
);

create unique index if not exists crm_asq_project_opportunity_uidx
  on public.crm_asq_project_links(opportunity_id);
create unique index if not exists crm_asq_project_source_uidx
  on public.crm_asq_project_links(asq_project_id);
create unique index if not exists crm_asq_project_write_uidx
  on public.crm_asq_project_links(write_id) where write_id is not null;
create index if not exists crm_asq_project_site_idx
  on public.crm_asq_project_links(site_id,updated_at desc);

alter table public.crm_asq_project_links enable row level security;
revoke all on table public.crm_asq_project_links from public, anon, authenticated;
grant select, insert, update on table public.crm_asq_project_links to service_role;

create or replace function public.crm_asq_project_sync(p jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  opportunity_id_value uuid;
  project_id_value text;
  write_id_value text;
  saved public.crm_asq_project_links%rowtype;
begin
  if jsonb_typeof(p) is distinct from 'object'
     or exists (
       select 1 from jsonb_object_keys(p) key
       where key not in (
         'opportunity_id','site_id','asq_project_id','project_url','service_type','project_status',
         'supervisor_name','contract_amount','contract_signed_at','contract_started_at','contract_ended_at',
         'construction_started_at','expected_completion_at','last_supervision_at','next_visit_at',
         'report_status','source_updated_at','raw_payload','write_id'
       )
     ) then
    raise exception 'invalid ASQ payload' using errcode='22023';
  end if;

  begin
    opportunity_id_value := nullif(p->>'opportunity_id','')::uuid;
  exception when others then
    raise exception 'invalid ASQ opportunity' using errcode='22023';
  end;
  project_id_value := nullif(btrim(p->>'asq_project_id'),'');
  write_id_value := nullif(btrim(p->>'write_id'),'');

  if opportunity_id_value is null or project_id_value is null
     or length(project_id_value)>200 or length(coalesce(write_id_value,''))>200
     or (nullif(p->>'project_url','') is not null and p->>'project_url' !~ '^https://') then
    raise exception 'invalid ASQ identity' using errcode='22023';
  end if;
  if not exists(select 1 from public.deals d where d.id=opportunity_id_value) then
    raise exception 'CRM opportunity not found' using errcode='23503';
  end if;

  if write_id_value is not null then
    select * into saved from public.crm_asq_project_links where write_id=write_id_value;
    if found then
      if saved.opportunity_id is distinct from opportunity_id_value
         or saved.asq_project_id is distinct from project_id_value then
        raise exception 'ASQ write id mismatch' using errcode='23505';
      end if;
      return jsonb_build_object('ok',true,'duplicate',true,'opportunity_id',saved.opportunity_id,
        'asq_project_id',saved.asq_project_id,'synced_at',saved.synced_at);
    end if;
  end if;
  if exists(select 1 from public.crm_asq_project_links where asq_project_id=project_id_value
            and opportunity_id<>opportunity_id_value) then
    raise exception 'ASQ project already linked to another opportunity' using errcode='23505';
  end if;

  insert into public.crm_asq_project_links (
    opportunity_id,site_id,asq_project_id,project_url,service_type,project_status,
    supervisor_name,contract_amount,contract_signed_at,contract_started_at,contract_ended_at,
    construction_started_at,expected_completion_at,last_supervision_at,next_visit_at,
    report_status,source_updated_at,synced_at,raw_payload,write_id,updated_at
  ) values (
    opportunity_id_value,nullif(p->>'site_id',''),project_id_value,nullif(p->>'project_url',''),
    nullif(p->>'service_type',''),nullif(p->>'project_status',''),nullif(p->>'supervisor_name',''),
    nullif(p->>'contract_amount','')::numeric,nullif(p->>'contract_signed_at','')::date,
    nullif(p->>'contract_started_at','')::date,nullif(p->>'contract_ended_at','')::date,
    nullif(p->>'construction_started_at','')::date,nullif(p->>'expected_completion_at','')::date,
    nullif(p->>'last_supervision_at','')::timestamptz,nullif(p->>'next_visit_at','')::timestamptz,
    nullif(p->>'report_status',''),nullif(p->>'source_updated_at','')::timestamptz,
    clock_timestamp(),coalesce(p->'raw_payload',p),write_id_value,clock_timestamp()
  )
  on conflict (opportunity_id) do update set
    site_id=excluded.site_id,asq_project_id=excluded.asq_project_id,project_url=excluded.project_url,
    service_type=excluded.service_type,project_status=excluded.project_status,
    supervisor_name=excluded.supervisor_name,contract_amount=excluded.contract_amount,
    contract_signed_at=excluded.contract_signed_at,contract_started_at=excluded.contract_started_at,
    contract_ended_at=excluded.contract_ended_at,construction_started_at=excluded.construction_started_at,
    expected_completion_at=excluded.expected_completion_at,last_supervision_at=excluded.last_supervision_at,
    next_visit_at=excluded.next_visit_at,report_status=excluded.report_status,
    source_updated_at=excluded.source_updated_at,synced_at=clock_timestamp(),
    raw_payload=excluded.raw_payload,write_id=excluded.write_id,updated_at=clock_timestamp()
  returning * into saved;

  return jsonb_build_object('ok',true,'duplicate',false,'opportunity_id',saved.opportunity_id,
    'asq_project_id',saved.asq_project_id,'synced_at',saved.synced_at);
end $$;

revoke all on function public.crm_asq_project_sync(jsonb) from public, anon, authenticated;
grant execute on function public.crm_asq_project_sync(jsonb) to service_role;

alter function public.crm_operational_source_v1(text,uuid,integer) set schema crm_security;
alter function crm_security.crm_operational_source_v1(text,uuid,integer)
  rename to crm_operational_source_v1_pre_asq_20260919;
revoke all on function crm_security.crm_operational_source_v1_pre_asq_20260919(text,uuid,integer)
  from public, anon, authenticated;

create function public.crm_operational_source_v1(
  p_domain text,
  p_after uuid default null,
  p_limit integer default 100
) returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  items jsonb;
  next_cursor uuid;
  more boolean := false;
begin
  if p_limit not between 1 and 100 then
    raise exception 'invalid limit' using errcode='22023';
  end if;
  if p_domain<>'asq_project' then
    return crm_security.crm_operational_source_v1_pre_asq_20260919(p_domain,p_after,p_limit);
  end if;
  if not exists(select 1 from crm_security.actor()) then
    raise exception 'forbidden' using errcode='42501';
  end if;

  select coalesce(jsonb_agg(to_jsonb(x) order by x.id),'[]'::jsonb),max(x.id)
    into items,next_cursor
  from (
    select l.id,l.opportunity_id,l.site_id,l.asq_project_id,l.project_url,l.service_type,
      l.project_status,l.supervisor_name,l.contract_amount,l.contract_signed_at,
      l.contract_started_at,l.contract_ended_at,l.construction_started_at,
      l.expected_completion_at,l.last_supervision_at,l.next_visit_at,l.report_status,
      l.source_updated_at,l.synced_at,l.updated_at
    from public.crm_asq_project_links l
    where crm_security.can_deal(l.opportunity_id,false)
      and (p_after is null or l.id>p_after)
    order by l.id
    limit p_limit
  ) x;

  if next_cursor is not null then
    select exists(
      select 1 from public.crm_asq_project_links l
      where crm_security.can_deal(l.opportunity_id,false) and l.id>next_cursor
    ) into more;
  end if;

  return jsonb_build_object(
    'contract_version',1,'resource','operational_source','domain',p_domain,
    'scope_completeness','actor_authorized_rows_only','items',items,
    'pagination',jsonb_build_object('completeness',case when more then 'partial' else 'complete' end,
      'has_more',more,'next_cursor',case when more then next_cursor::text else null end)
  );
end $$;

revoke all on function public.crm_operational_source_v1(text,uuid,integer) from public, anon;
grant execute on function public.crm_operational_source_v1(text,uuid,integer) to authenticated;

do $$
begin
  if has_function_privilege('anon','public.crm_operational_source_v1(text,uuid,integer)','execute')
     or not has_function_privilege('authenticated','public.crm_operational_source_v1(text,uuid,integer)','execute')
     or has_function_privilege('authenticated','public.crm_asq_project_sync(jsonb)','execute')
     or not has_function_privilege('service_role','public.crm_asq_project_sync(jsonb)','execute') then
    raise exception 'ASQ privilege postcondition failed';
  end if;
end $$;
