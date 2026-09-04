-- Structured work types belong to an opportunity, never to the site itself.
-- Existing rows remain unclassified. This migration does not infer or persist
-- a work type from the project name or other free text.
begin;

alter table public.deals
  add column if not exists primary_work text,
  add column if not exists work_items jsonb not null default '[]'::jsonb,
  add column if not exists work_scope_type text,
  add column if not exists work_summary text;

alter table public.deals drop constraint if exists deals_work_items_array;
alter table public.deals add constraint deals_work_items_array
  check (jsonb_typeof(work_items) = 'array');

alter table public.deals drop constraint if exists deals_work_scope_consistent;
alter table public.deals add constraint deals_work_scope_consistent check (
  (jsonb_array_length(work_items) = 0
    and primary_work is null
    and work_scope_type is null
    and work_summary is null)
  or
  (jsonb_array_length(work_items) = 1
    and work_scope_type = 'single'
    and nullif(primary_work, '') is not null
    and work_items ? primary_work
    and nullif(work_summary, '') is not null)
  or
  (jsonb_array_length(work_items) >= 2
    and work_scope_type = 'multi'
    and nullif(primary_work, '') is not null
    and work_items ? primary_work
    and nullif(work_summary, '') is not null)
);

create index if not exists deals_work_items_gin
  on public.deals using gin (work_items);
create index if not exists deals_primary_work_idx
  on public.deals (primary_work)
  where primary_work is not null;

-- n8n crm-write may call this helper from the opportunity_create branch after
-- the deal id is known. Validation is repeated here so malformed combinations
-- cannot bypass the UI rules.
create or replace function public.crm_opportunity_work_set(p jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  oid uuid;
  items jsonb;
  primary_value text;
  scope_value text;
  summary_value text;
  reason_value text;
  actor_value text;
  write_value text;
  before_work jsonb;
  after_work jsonb;
  item_count integer;
begin
  oid := (p ->> 'opportunity_id')::uuid;
  items := coalesce(p -> 'work_items', p -> 'workItems', '[]'::jsonb);
  primary_value := nullif(coalesce(p ->> 'primary_work', p ->> 'primaryWork'), '');
  summary_value := nullif(coalesce(p ->> 'work_summary', p ->> 'workSummary'), '');
  reason_value := nullif(trim(p ->> 'reason'), '');
  actor_value := nullif(coalesce(p ->> 'actor_name', p ->> 'actor_id'), '');
  write_value := nullif(p ->> 'write_id', '');

  if reason_value is null or length(reason_value) < 5 then
    raise exception 'a work classification reason of at least 5 characters is required';
  end if;

  select jsonb_build_object(
           'primary_work', d.primary_work,
           'work_items', d.work_items,
           'work_scope_type', d.work_scope_type,
           'work_summary', d.work_summary
         )
    into before_work
    from public.deals d
   where d.id = oid;

  if before_work is null then
    raise exception 'opportunity not found: %', oid;
  end if;

  if jsonb_typeof(items) <> 'array' then
    raise exception 'work_items must be a JSON array';
  end if;

  item_count := jsonb_array_length(items);
  if item_count = 0 then
    update public.deals
       set primary_work = null, work_items = '[]'::jsonb,
           work_scope_type = null, work_summary = null, updated_at = now()
     where id = oid;
    after_work := jsonb_build_object(
      'primary_work', null, 'work_items', '[]'::jsonb,
      'work_scope_type', null, 'work_summary', null,
      'reason', reason_value, 'reason_source', p ->> 'reason_source'
    );
  else
    scope_value := case when item_count = 1 then 'single' else 'multi' end;
    if primary_value is null or not (items ? primary_value) then
      raise exception 'primary_work must be one of work_items';
    end if;
    if summary_value is null then
      raise exception 'work_summary is required';
    end if;

    update public.deals
       set primary_work = primary_value,
           work_items = items,
           work_scope_type = scope_value,
           work_summary = summary_value,
           updated_at = now()
     where id = oid;

    after_work := jsonb_build_object(
      'primary_work', primary_value, 'work_items', items,
      'work_scope_type', scope_value, 'work_summary', summary_value,
      'reason', reason_value, 'reason_source', p ->> 'reason_source'
    );
  end if;

  insert into public.activities (deal_id, actor_name, type, detail, occurred_at)
  values (
    oid, coalesce(actor_value, 'CRM 사용자'), '공종분류',
    jsonb_build_object(
      'note', coalesce(summary_value, '공종 미분류'),
      'result', reason_value,
      'reason_source', p ->> 'reason_source'
    ),
    coalesce(nullif(p ->> 'at', '')::timestamptz, now())
  );

  insert into public.audit_logs (
    write_id, actor_name, actor_id, entity_type, entity_id,
    action, before, after, created_at
  ) values (
    write_value, coalesce(actor_value, 'CRM 사용자'),
    case when actor_value ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
         then actor_value::uuid else null end,
    'opportunity', oid, 'opportunity_work_set', before_work, after_work,
    coalesce(nullif(p ->> 'at', '')::timestamptz, now())
  );

  return jsonb_build_object('ok', true, 'opportunity_id', oid) || after_work;
end;
$$;

-- Preserve the established crm_bundle body and add only the new opportunity
-- fields. If the exact anchor differs in production, inspect the current
-- function before applying instead of replacing it blindly.
do $$
declare
  fn text;
begin
  select pg_get_functiondef('public.crm_bundle()'::regprocedure) into fn;
  if position('''workItems''' in fn) = 0 then
    if position('''serviceHistory'', d.service_history' in fn) = 0 then
      raise exception 'crm_bundle anchor not found; review function before migration';
    end if;
    fn := replace(
      fn,
      '''serviceHistory'', d.service_history',
      '''serviceHistory'', d.service_history,
       ''primaryWork'', d.primary_work,
       ''workItems'', d.work_items,
       ''workScopeType'', d.work_scope_type,
       ''workSummary'', d.work_summary'
    );
    execute fn;
  end if;
end
$$;

commit;

-- Verification. Existing empty rows should stay unclassified.
select
  count(*) filter (where jsonb_array_length(work_items) = 0) as unclassified,
  count(*) filter (where work_scope_type = 'single') as single_scope,
  count(*) filter (where work_scope_type = 'multi') as multi_scope
from public.deals;
