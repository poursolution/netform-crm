-- Storage preparation ONLY. Apply with the crm-write/crm-api mapping described
-- in docs/structured-stage-transitions.md. Not applied by the frontend.
begin;
alter table public.deals
  add column if not exists stage_contexts jsonb not null default '{}'::jsonb;
create table if not exists public.crm_stage_transition_records (
  id uuid primary key default gen_random_uuid(),
  write_id text not null unique,
  opportunity_id uuid not null references public.deals(id) on delete restrict,
  from_stage text not null,
  to_stage text not null,
  transition_date date not null,
  fields jsonb not null,
  skip_reason text,
  memo text,
  actor_id uuid,
  recorded_at timestamptz not null default now(),
  constraint stage_transition_fields_object check(jsonb_typeof(fields)='object')
);
create index if not exists crm_stage_transition_records_deal_idx
  on public.crm_stage_transition_records(opportunity_id,transition_date desc);
alter table public.crm_stage_transition_records enable row level security;
-- No browser-wide read/write policy: use the existing authorized API.
revoke all on public.crm_stage_transition_records from anon,authenticated;
grant select,insert on public.crm_stage_transition_records to service_role;
commit;
