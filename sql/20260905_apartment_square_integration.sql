-- 아파트스퀘어(ASQ) 운영 프로젝트 → CRM 읽기 전용 미러
-- 적용: Supabase SQL Editor(service role) → n8n ASQ sync → crm-api bundle
-- 정본: CRM=고객/영업, ASQ=설계·감리 운영. 브라우저는 이 테이블을 직접 쓰지 않는다.

create extension if not exists pgcrypto;

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
  synced_at timestamptz not null default now(),
  raw_payload jsonb not null default '{}'::jsonb,
  write_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (opportunity_id),
  unique (asq_project_id),
  unique (write_id)
);

create index if not exists crm_asq_project_site_idx
  on public.crm_asq_project_links(site_id,updated_at desc);
create index if not exists crm_asq_project_status_idx
  on public.crm_asq_project_links(project_status,updated_at desc);

alter table public.crm_asq_project_links enable row level security;
revoke all on public.crm_asq_project_links from anon, authenticated;

create or replace function public.crm_asq_project_sync(p jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_opportunity_id uuid;
  v_asq_project_id text;
  v_write_id text;
  row_value public.crm_asq_project_links%rowtype;
begin
  v_opportunity_id := nullif(p->>'opportunity_id','')::uuid;
  v_asq_project_id := nullif(p->>'asq_project_id','');
  v_write_id := nullif(p->>'write_id','');

  if v_opportunity_id is null then
    raise exception 'opportunity_id is required';
  end if;
  if v_asq_project_id is null then
    raise exception 'asq_project_id is required';
  end if;
  if not exists(select 1 from public.deals where id=v_opportunity_id) then
    raise exception 'CRM opportunity not found: %', v_opportunity_id;
  end if;

  if v_write_id is not null then
    select * into row_value
      from public.crm_asq_project_links
     where write_id=v_write_id;
    if found then
      return jsonb_build_object(
        'ok',true,'duplicate',true,'opportunity_id',row_value.opportunity_id,
        'asq_project_id',row_value.asq_project_id,'synced_at',row_value.synced_at
      );
    end if;
  end if;

  insert into public.crm_asq_project_links (
    opportunity_id,site_id,asq_project_id,project_url,service_type,project_status,
    supervisor_name,contract_amount,contract_signed_at,contract_started_at,
    contract_ended_at,construction_started_at,expected_completion_at,
    last_supervision_at,next_visit_at,report_status,source_updated_at,
    synced_at,raw_payload,write_id,updated_at
  ) values (
    v_opportunity_id,nullif(p->>'site_id',''),v_asq_project_id,
    nullif(p->>'project_url',''),nullif(p->>'service_type',''),
    nullif(p->>'project_status',''),nullif(p->>'supervisor_name',''),
    nullif(p->>'contract_amount','')::numeric,
    nullif(p->>'contract_signed_at','')::date,
    nullif(p->>'contract_started_at','')::date,
    nullif(p->>'contract_ended_at','')::date,
    nullif(p->>'construction_started_at','')::date,
    nullif(p->>'expected_completion_at','')::date,
    nullif(p->>'last_supervision_at','')::timestamptz,
    nullif(p->>'next_visit_at','')::timestamptz,
    nullif(p->>'report_status',''),
    nullif(p->>'source_updated_at','')::timestamptz,
    now(),coalesce(p->'raw_payload',p),v_write_id,now()
  )
  on conflict (opportunity_id) do update set
    site_id=excluded.site_id,
    asq_project_id=excluded.asq_project_id,
    project_url=excluded.project_url,
    service_type=excluded.service_type,
    project_status=excluded.project_status,
    supervisor_name=excluded.supervisor_name,
    contract_amount=excluded.contract_amount,
    contract_signed_at=excluded.contract_signed_at,
    contract_started_at=excluded.contract_started_at,
    contract_ended_at=excluded.contract_ended_at,
    construction_started_at=excluded.construction_started_at,
    expected_completion_at=excluded.expected_completion_at,
    last_supervision_at=excluded.last_supervision_at,
    next_visit_at=excluded.next_visit_at,
    report_status=excluded.report_status,
    source_updated_at=excluded.source_updated_at,
    synced_at=now(),
    raw_payload=excluded.raw_payload,
    write_id=excluded.write_id,
    updated_at=now()
  returning * into row_value;

  return jsonb_build_object(
    'ok',true,'opportunity_id',row_value.opportunity_id,
    'asq_project_id',row_value.asq_project_id,'synced_at',row_value.synced_at
  );
end;
$$;

create or replace function public.crm_asq_projects_json()
returns jsonb
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'opportunity_id',opportunity_id,
    'site_id',site_id,
    'asq_project_id',asq_project_id,
    'project_url',project_url,
    'service_type',service_type,
    'project_status',project_status,
    'supervisor_name',supervisor_name,
    'contract_amount',contract_amount,
    'contract_signed_at',contract_signed_at,
    'contract_started_at',contract_started_at,
    'contract_ended_at',contract_ended_at,
    'construction_started_at',construction_started_at,
    'expected_completion_at',expected_completion_at,
    'last_supervision_at',last_supervision_at,
    'next_visit_at',next_visit_at,
    'report_status',report_status,
    'source_updated_at',source_updated_at,
    'synced_at',synced_at
  ) order by updated_at desc),'[]'::jsonb)
  from public.crm_asq_project_links;
$$;

revoke all on function public.crm_asq_project_sync(jsonb) from public, anon, authenticated;
revoke all on function public.crm_asq_projects_json() from public, anon, authenticated;
grant execute on function public.crm_asq_project_sync(jsonb) to service_role;
grant execute on function public.crm_asq_projects_json() to service_role;

-- n8n ASQ sync:
--   ASQ API/Webhook payload → CRM opportunity/site 매핑 → crm_asq_project_sync(payload)
-- crm-api bundle:
--   asq_projects → crm_asq_projects_json()
