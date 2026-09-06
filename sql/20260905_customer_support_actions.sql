-- 영업사원 관리 · 고객관리 지원 액션 이력
-- 적용: Supabase SQL Editor(service role) → n8n crm-write/customer_support_action 연결

create table if not exists public.crm_customer_support_actions (
  id uuid primary key default gen_random_uuid(),
  client_ref text not null unique,
  target_type text not null check (target_type in ('deal','inq')),
  target_key text not null,
  opportunity_id uuid null,
  inquiry_id text null,
  site_name text not null default '',
  rep_name text not null,
  action_key text not null,
  action_label text not null,
  reason text not null default '',
  completion_rule text not null default '',
  status text not null default 'requested' check (status in ('requested','completed','cancelled')),
  requested_by text not null,
  requested_at timestamptz not null default now(),
  completed_at timestamptz null,
  metadata jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create index if not exists crm_customer_support_target_idx
  on public.crm_customer_support_actions(target_key, requested_at desc);
create index if not exists crm_customer_support_rep_status_idx
  on public.crm_customer_support_actions(rep_name, status, requested_at desc);

alter table public.crm_customer_support_actions enable row level security;
revoke all on public.crm_customer_support_actions from anon, authenticated;
grant select, insert, update on public.crm_customer_support_actions to service_role;

create or replace function public.crm_customer_support_action_upsert(p jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  row_id uuid;
begin
  if coalesce(nullif(p->>'client_ref',''),'')='' then
    raise exception 'client_ref is required';
  end if;
  if coalesce(nullif(p->>'target_key',''),'')='' then
    raise exception 'target_key is required';
  end if;
  if coalesce(nullif(p->>'rep_name',''),'')='' then
    raise exception 'rep_name is required';
  end if;

  insert into public.crm_customer_support_actions (
    client_ref,target_type,target_key,opportunity_id,inquiry_id,site_name,rep_name,
    action_key,action_label,reason,completion_rule,status,requested_by,requested_at,
    completed_at,metadata,updated_at
  ) values (
    p->>'client_ref',coalesce(nullif(p->>'target_type',''),'deal'),p->>'target_key',
    nullif(p->>'opportunity_id','')::uuid,nullif(p->>'inquiry_id',''),
    coalesce(p->>'site_name',''),p->>'rep_name',p->>'action_key',p->>'action_label',
    coalesce(p->>'reason',''),coalesce(p->>'completion_rule',''),
    coalesce(nullif(p->>'status',''),'requested'),p->>'requested_by',
    coalesce(nullif(p->>'requested_at','')::timestamptz,now()),
    nullif(p->>'completed_at','')::timestamptz,coalesce(p->'metadata','{}'::jsonb),now()
  )
  on conflict (client_ref) do update set
    status=excluded.status,completed_at=excluded.completed_at,
    metadata=excluded.metadata,updated_at=now()
  returning id into row_id;

  return jsonb_build_object('ok',true,'support_action_id',row_id);
end;
$$;

create or replace function public.crm_customer_support_actions_json()
returns jsonb
language sql
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id',id,'client_ref',client_ref,'target_type',target_type,'target_key',target_key,
    'opportunity_id',opportunity_id,'inquiry_id',inquiry_id,'site_name',site_name,
    'rep_name',rep_name,'action_key',action_key,'action_label',action_label,
    'reason',reason,'completion_rule',completion_rule,'status',status,
    'requested_by',requested_by,'requested_at',requested_at,'completed_at',completed_at,
    'metadata',metadata
  ) order by requested_at desc),'[]'::jsonb)
  from public.crm_customer_support_actions
  where requested_at >= now() - interval '180 days';
$$;

grant execute on function public.crm_customer_support_action_upsert(jsonb) to service_role;
grant execute on function public.crm_customer_support_actions_json() to service_role;

comment on table public.crm_customer_support_actions is
  '관리자가 영업담당자에게 요청한 최초응대·재접촉·문자·자료·일정·재활성 지원 이력';

-- n8n crm-write:
-- customer_support_action → crm_customer_support_action_upsert(payload)
-- crm-api bundle:
-- customerSupportActions → crm_customer_support_actions_json()
