-- Deal Command Center · waiting context persistence.
-- Run with the service-role migration account. Browser writes continue to use
-- the authenticated crm-write/n8n router and never call these objects directly.
begin;

alter table public.deals add column if not exists waiting_reason text;
alter table public.deals add column if not exists wake_up_at date;
alter table public.deals add column if not exists waiting_speaker text;
alter table public.deals add column if not exists waiting_customer_statement text;
alter table public.deals add column if not exists waiting_evidence text;
alter table public.deals add column if not exists expected_resume_at date;
alter table public.deals add column if not exists waiting_updated_at timestamptz;
alter table public.deals add column if not exists waiting_updated_by text;

-- waiting_reason and wake_up_at are also used by the relationship messaging
-- migration. IF NOT EXISTS keeps either migration order safe.
create table if not exists public.crm_waiting_context_history (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid not null references public.deals(id) on delete cascade,
  waiting_reason text not null,
  waiting_speaker text not null,
  waiting_customer_statement text not null,
  wake_up_at date not null,
  waiting_evidence text not null,
  expected_resume_at date not null,
  actor_name text not null,
  recorded_at timestamptz not null default now(),
  write_id text unique,
  check (length(btrim(waiting_reason)) >= 2),
  check (length(btrim(waiting_speaker)) >= 2),
  check (length(btrim(waiting_customer_statement)) >= 2),
  check (length(btrim(waiting_evidence)) >= 2)
);

create index if not exists crm_waiting_context_history_deal_at_idx
  on public.crm_waiting_context_history(opportunity_id, recorded_at desc);

alter table public.crm_waiting_context_history enable row level security;
revoke all on public.crm_waiting_context_history from anon, authenticated;
grant select, insert on public.crm_waiting_context_history to service_role;

create or replace function public.crm_waiting_context_set(p jsonb)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_id uuid;
  v_reason text := btrim(coalesce(p->>'waiting_reason',''));
  v_speaker text := btrim(coalesce(p->>'waiting_speaker',''));
  v_statement text := btrim(coalesce(p->>'waiting_customer_statement',''));
  v_evidence text := btrim(coalesce(p->>'waiting_evidence',''));
  v_wake date;
  v_resume date;
  v_actor text := btrim(coalesce(p->>'actor_name',''));
  v_at timestamptz := coalesce(nullif(p->>'at','')::timestamptz, now());
  v_write_id text := nullif(p->>'write_id','');
  v_row public.deals%rowtype;
begin
  v_id := nullif(p->>'opportunity_id','')::uuid;
  v_wake := nullif(p->>'wake_up_at','')::date;
  v_resume := nullif(p->>'expected_resume_at','')::date;

  if v_id is null then raise exception 'opportunity_id is required'; end if;
  if length(v_reason) < 2 then raise exception 'waiting_reason is required'; end if;
  if length(v_speaker) < 2 then raise exception 'waiting_speaker is required'; end if;
  if length(v_statement) < 2 then raise exception 'waiting_customer_statement is required'; end if;
  if v_wake is null then raise exception 'wake_up_at is required'; end if;
  if length(v_evidence) < 2 then raise exception 'waiting_evidence is required'; end if;
  if v_resume is null then raise exception 'expected_resume_at is required'; end if;
  if length(v_actor) < 1 then raise exception 'actor_name is required'; end if;

  update public.deals
     set waiting_reason=v_reason,
         waiting_speaker=v_speaker,
         waiting_customer_statement=v_statement,
         wake_up_at=v_wake,
         waiting_evidence=v_evidence,
         expected_resume_at=v_resume,
         waiting_updated_at=v_at,
         waiting_updated_by=v_actor
   where id=v_id
   returning * into v_row;

  if not found then raise exception 'deal not found: %', v_id; end if;

  insert into public.crm_waiting_context_history(
    opportunity_id, waiting_reason, waiting_speaker,
    waiting_customer_statement, wake_up_at, waiting_evidence,
    expected_resume_at, actor_name, recorded_at, write_id
  ) values (
    v_id, v_reason, v_speaker, v_statement, v_wake, v_evidence,
    v_resume, v_actor, v_at, v_write_id
  ) on conflict (write_id) do nothing;

  return jsonb_build_object(
    'ok', true,
    'opportunity_id', v_id,
    'waiting_reason', v_reason,
    'waiting_speaker', v_speaker,
    'waiting_customer_statement', v_statement,
    'wake_up_at', v_wake,
    'waiting_evidence', v_evidence,
    'expected_resume_at', v_resume,
    'updated_at', v_at
  );
end;
$$;

revoke all on function public.crm_waiting_context_set(jsonb) from public, anon, authenticated;
grant execute on function public.crm_waiting_context_set(jsonb) to service_role;

commit;

-- n8n crm-write route:
-- op = waiting_context -> select public.crm_waiting_context_set(payload ||
-- jsonb_build_object('write_id', write_id));
