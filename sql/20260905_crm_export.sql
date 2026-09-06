-- STAGING CANDIDATE ONLY. Requires canonical crm_users UUID membership + crm_bundle.
-- New export audit rows only; no customer rows are changed by this migration.
begin;
create schema if not exists crm_private;
revoke all on schema crm_private from public,anon,authenticated;
create table if not exists crm_private.export_audit (
  id uuid primary key default gen_random_uuid(), actor_id uuid not null,
  created_at timestamptz not null default clock_timestamp(),
  filters jsonb not null, row_count integer not null check(row_count between 0 and 100)
);
alter table crm_private.export_audit enable row level security;
revoke all on crm_private.export_audit from public,anon,authenticated,service_role;
create index if not exists export_audit_actor_time on crm_private.export_audit(actor_id,created_at);

create or replace function public.crm_export_create(p jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  actor public.crm_users%rowtype; uid uuid:=auth.uid();
  start_date date; end_date date; brand text; reason text; cols jsonb; cap integer;
  rows_out jsonb; aid uuid;
begin
  if uid is null then raise exception 'Authentication required' using errcode='42501'; end if;
  select * into strict actor from public.crm_users u where u.user_id=uid and u.active is true;
  if actor.role is distinct from 'admin' or (auth.jwt()->>'aal') is distinct from 'aal2' then
    raise exception 'Admin MFA required' using errcode='42501';
  end if;
  if p is null or jsonb_typeof(p)<>'object' then raise exception 'Invalid filters' using errcode='22023'; end if;
  if exists(select 1 from jsonb_object_keys(p) k where k not in ('from','to','brand','reason','columns','limit')) then
    raise exception 'Unknown export filter' using errcode='22023';
  end if;
  start_date:=(p->>'from')::date; end_date:=(p->>'to')::date;
  brand:=nullif(btrim(p->>'brand'),'');reason:=nullif(btrim(p->>'reason'),'');
  cols:=p->'columns';cap:=(p->>'limit')::integer;
  if start_date is null or end_date is null or end_date<start_date or end_date-start_date>30
     or brand is null or reason is null or length(reason)<5 or length(reason)>500
     or cap is null or cap<1 or cap>100 or cols is null or jsonb_typeof(cols)<>'array' then
    raise exception 'Bounded dates, brand, reason, columns and limit required' using errcode='22023';
  end if;
  if jsonb_array_length(cols)=0 or jsonb_array_length(cols)>4 or exists(
    select 1 from jsonb_array_elements_text(cols) c where c not in ('site','brand','stage','created')) then
    raise exception 'Only approved non-contact columns may be exported' using errcode='22023';
  end if;
  -- Serialize concurrent requests by actor. Logging and returned rows share a transaction.
  perform pg_advisory_xact_lock(hashtextextended(uid::text,20260905));
  if exists(select 1 from crm_private.export_audit a where a.actor_id=uid and a.created_at>clock_timestamp()-interval '5 minutes') then
    raise exception 'Export rate limit exceeded' using errcode='P0001';
  end if;
  select coalesce(jsonb_agg(projected),'[]'::jsonb) into rows_out from (
    select (select jsonb_object_agg(k,d->k) from jsonb_array_elements_text(cols) k) projected
    from jsonb_array_elements(public.crm_bundle()::jsonb->'deals') d
    where d->>'brand'=brand and d->>'created' ~ '^\d{4}-\d{2}-\d{2}'
      and substring(d->>'created' from 1 for 10)::date between start_date and end_date
    order by d->>'created',d->>'id' limit cap
  ) limited;
  insert into crm_private.export_audit(actor_id,filters,row_count)
    values(uid,p,jsonb_array_length(rows_out)) returning id into aid;
  return jsonb_build_object('ok',true,'actor_id',uid,'audit_id',aid,'columns',cols,'rows',rows_out);
exception when no_data_found or too_many_rows then
  raise exception 'CRM membership unavailable' using errcode='42501';
end $$;
revoke all on function public.crm_export_create(jsonb) from public,anon,authenticated;
grant execute on function public.crm_export_create(jsonb) to authenticated;
commit;
