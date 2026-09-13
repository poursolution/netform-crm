-- Join the direct webhook and Google Sheet mirror when their external event
-- keys differ. This changes only the service-role ingest boundary and never
-- overwrites an existing owner UUID.

do $patch_mirror_race$
declare
  function_def text;
  declaration_marker text := 'v_result jsonb;';
  lock_marker text := 'select array_agg(distinct d.inquiry_id order by d.inquiry_id)';
  candidate_marker text := 'if coalesce(array_length(v_mapped_ids, 1), 0) > 1 then';
  declaration_patch text := 'v_mirror_candidate_id uuid; v_mirror_candidate_count integer := 0; v_result jsonb;';
  lock_patch text := $lock$
  -- Both collection paths use this common lock even when their event keys differ.
  if v_phone <> '' and v_brand <> '' then
    perform pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended('crm_inquiry_mirror:' || v_phone || '|' || v_brand, 0)
    );
  end if;

$lock$;
  candidate_patch text := $candidate$
  -- Reuse only one opposite-path row created within 30 seconds. The original
  -- event date must also agree, so a delayed replay for another day is never
  -- collapsed merely because it was processed immediately.
  if coalesce(array_length(v_mapped_ids, 1), 0) = 0
     and v_event_date is not null
     and v_phone <> '' and v_brand <> '' then
    select count(*), min(i.id::text)::uuid
      into v_mirror_candidate_count, v_mirror_candidate_id
    from public.inquiries i
    where ((v_sheet_row is null and i.sheet_row is not null)
        or (v_sheet_row is not null and i.sheet_row is null))
      and i.opportunity_id is null
      and i.deal_id is null
      and coalesce(i.status, '') not in ('종결', '종료')
      and regexp_replace(coalesce(i.phone, ''), '[^0-9]', '', 'g') = v_phone
      and regexp_replace(lower(coalesce(i.brand, '')), '[[:space:]]', '', 'g') = v_brand
      and left(replace(replace(coalesce(
        i.raw ->> '접수일시', i.raw ->> 'received_at', i.raw ->> 'receivedAt',
        i.raw ->> 'submitted_at', i.raw ->> 'submittedAt', ''
      ), '.', '-'), '/', '-'), 10) = v_event_date
      and coalesce(i.received_at, i.created_at) >= clock_timestamp() - interval '30 seconds'
      and coalesce(i.received_at, i.created_at) <= clock_timestamp() + interval '1 second';

    if v_mirror_candidate_count = 1 then
      v_mapped_ids := array[v_mirror_candidate_id];
      foreach v_key in array v_keys loop
        insert into private.inquiry_ingest_idempotency(event_key, inquiry_id)
        values (v_key, v_mirror_candidate_id)
        on conflict (event_key) do update
          set last_seen_at = clock_timestamp(),
              attempts = private.inquiry_ingest_idempotency.attempts + 1
          where private.inquiry_ingest_idempotency.inquiry_id = excluded.inquiry_id;
      end loop;
    elsif v_mirror_candidate_count > 1 then
      raise exception 'INGEST_MIRROR_IDENTITY_CONFLICT' using errcode = 'PT409';
    end if;
  end if;

$candidate$;
begin
  select pg_get_functiondef('public.crm_inquiry_ingest_v1(jsonb)'::regprocedure)
    into function_def;

  if position('crm_inquiry_mirror:' in function_def) > 0 then
    return;
  end if;
  if position('private.inquiry_ingest_idempotency' in function_def) = 0
     or position(declaration_marker in function_def) = 0
     or position(lock_marker in function_def) = 0
     or position(candidate_marker in function_def) = 0 then
    raise exception 'inquiry ingest mirror-race signature drift; no change applied';
  end if;

  function_def := replace(function_def, declaration_marker, declaration_patch);
  function_def := replace(function_def, lock_marker, lock_patch || lock_marker);
  function_def := replace(function_def, candidate_marker, candidate_patch || candidate_marker);
  execute function_def;
end
$patch_mirror_race$;

revoke execute on function public.crm_inquiry_ingest_v1(jsonb)
from public, anon, authenticated;
grant execute on function public.crm_inquiry_ingest_v1(jsonb)
to service_role;

comment on function public.crm_inquiry_ingest_v1(jsonb) is
'Service-role inquiry ingest with strict event idempotency and a 30-second unique opposite-path bridge for direct-webhook/Sheet mirror races. Existing owner UUIDs remain monotonic.';

do $postcheck$
declare
  function_def text := pg_get_functiondef('public.crm_inquiry_ingest_v1(jsonb)'::regprocedure);
begin
  if position('crm_inquiry_mirror:' in function_def) = 0
     or position('INGEST_MIRROR_IDENTITY_CONFLICT' in function_def) = 0 then
    raise exception 'inquiry mirror-race install incomplete';
  end if;
  if has_function_privilege('anon', 'public.crm_inquiry_ingest_v1(jsonb)', 'EXECUTE')
     or has_function_privilege('authenticated', 'public.crm_inquiry_ingest_v1(jsonb)', 'EXECUTE') then
    raise exception 'inquiry ingest privilege regression';
  end if;
end
$postcheck$;
