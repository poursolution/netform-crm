-- Reconcile the exact inquiry assignment state already installed in Production.
-- This is a forward-only, repeatable migration. Existing n8n, Jandi and Google
-- Sheet workflows are intentionally outside its scope.

create index if not exists idx_inquiries_sheet_phone_brand_site_received
  on public.inquiries (
    (regexp_replace(coalesce(phone, ''), '[^0-9]', '', 'g')),
    (btrim(coalesce(brand, ''))),
    (regexp_replace(lower(coalesce(site_name, '')), '[^0-9a-z가-힣]', '', 'g')),
    received_at desc
  )
  where sheet_row is not null
    and opportunity_id is null
    and deal_id is null;

do $assignment_alias$
declare
  function_def text;
  marker text;
  alias_block text;
begin
  select pg_get_functiondef('public.crm_inquiry_assignment_sync_v1(jsonb)'::regprocedure)
    into function_def;
  if position('서비스운영팀(송보람)' in function_def) = 0 then
    marker := E'  target_name := btrim(coalesce(p_payload->>''to'', p_payload->>''assignee_name'', ''''));\n';
    alias_block := E'  if target_name = ''서비스운영팀(송보람)'' then\n    target_name := ''송보람'';\n  end if;\n';
    if position(marker in function_def) = 0 then
      raise exception 'assignment sync signature drift; no change applied';
    end if;
    execute replace(function_def, marker, marker || alias_block);
  end if;

  select pg_get_functiondef('public.crm_inquiry_ingest_v1(jsonb)'::regprocedure)
    into function_def;
  if position('서비스운영팀(송보람)' in function_def) = 0 then
    marker := E'  v_assignee := nullif(btrim(coalesce(\n    p_payload ->> ''assignee_name'', p_payload ->> ''assignee'', p_payload ->> ''담당자''\n  )), '''');\n';
    alias_block := E'  if v_assignee = ''서비스운영팀(송보람)'' then\n    v_assignee := ''송보람'';\n  end if;\n';
    if position(marker in function_def) = 0 then
      raise exception 'inquiry ingest assignee signature drift; no change applied';
    end if;
    execute replace(function_def, marker, marker || alias_block);
  end if;
end
$assignment_alias$;

do $reverse_race$
declare
  function_def text;
  marker text := E'\n  if v_candidate.id is not null then\n';
  reverse_match_block text := E'
  -- The sheet-backed row can arrive before the direct webhook. Reuse exactly
  -- one recent canonical row rather than inserting a second unassigned row.
  if v_candidate.id is null
     and v_sheet_row is null
     and v_phone is not null
     and v_brand is not null
     and v_site is not null then
    select count(*) into v_candidate_count
    from public.inquiries i
    where i.sheet_row is not null
      and i.opportunity_id is null
      and i.deal_id is null
      and coalesce(i.status, '''') not in (''종결'', ''종료'')
      and regexp_replace(coalesce(i.phone, ''''), ''[^0-9]'', '''', ''g'') =
          regexp_replace(v_phone, ''[^0-9]'', '''', ''g'')
      and btrim(coalesce(i.brand, '''')) = v_brand
      and regexp_replace(lower(coalesce(i.site_name, '''')), ''[^0-9a-z가-힣]'', '''', ''g'') =
          regexp_replace(lower(v_site), ''[^0-9a-z가-힣]'', '''', ''g'')
      and coalesce(i.received_at, i.created_at) >= clock_timestamp() - interval ''10 minutes''
      and coalesce(i.received_at, i.created_at) <= clock_timestamp() + interval ''1 minute'';

    if v_candidate_count = 1 then
      select * into v_candidate
      from public.inquiries i
      where i.sheet_row is not null
        and i.opportunity_id is null
        and i.deal_id is null
        and coalesce(i.status, '''') not in (''종결'', ''종료'')
        and regexp_replace(coalesce(i.phone, ''''), ''[^0-9]'', '''', ''g'') =
            regexp_replace(v_phone, ''[^0-9]'', '''', ''g'')
        and btrim(coalesce(i.brand, '''')) = v_brand
        and regexp_replace(lower(coalesce(i.site_name, '''')), ''[^0-9a-z가-힣]'', '''', ''g'') =
            regexp_replace(lower(v_site), ''[^0-9a-z가-힣]'', '''', ''g'')
        and coalesce(i.received_at, i.created_at) >= clock_timestamp() - interval ''10 minutes''
        and coalesce(i.received_at, i.created_at) <= clock_timestamp() + interval ''1 minute''
      for update;
      v_match_source := ''recent_sheet_phone_brand_site'';
    end if;
  end if;

  if v_candidate.id is not null then
';
  old_status text := E'        status = coalesce(v_status, i.status, ''접수''),\n';
  new_status text := E'        status = case\n          when v_match_source = ''recent_sheet_phone_brand_site''\n            then coalesce(i.status, v_status, ''접수'')\n          else coalesce(v_status, i.status, ''접수'')\n        end,\n';
begin
  select pg_get_functiondef('public.crm_inquiry_ingest_v1(jsonb)'::regprocedure)
    into function_def;

  if position('recent_sheet_phone_brand_site' in function_def) = 0 then
    if position(marker in function_def) = 0
       or position(old_status in function_def) = 0 then
      raise exception 'inquiry ingest reverse-race signature drift; no change applied';
    end if;
    function_def := replace(function_def, marker, reverse_match_block);
    function_def := replace(function_def, old_status, new_status);
    execute function_def;
  end if;
end
$reverse_race$;

revoke execute on function public.crm_inquiry_assignment_sync_v1(jsonb)
from public, anon, authenticated;
grant execute on function public.crm_inquiry_assignment_sync_v1(jsonb)
to service_role;

revoke execute on function public.crm_inquiry_ingest_v1(jsonb)
from public, anon, authenticated;
grant execute on function public.crm_inquiry_ingest_v1(jsonb)
to service_role;

comment on function public.crm_inquiry_assignment_sync_v1(jsonb) is
'Service-role-only inquiry assignment sync with exact active-user matching, approved operations-team alias resolution and existing-owner CAS protection.';

comment on function public.crm_inquiry_ingest_v1(jsonb) is
'Service-role inquiry ingestion with private backup and bidirectional race-safe sheet/direct deduplication. Reverse-order reuse requires one recent exact phone+brand+normalized-site match.';

-- Record the exact three direct-ingest duplicates previously approved for
-- closure. Accept either the eligible pre-state or the already-closed state.
do $first_cleanup$
declare
  valid_count integer;
  post_count integer;
begin
  with approved_pairs(duplicate_id, canonical_id, canonical_sheet_row) as (
    values
      ('a59391de-3cda-456f-be21-812cbc44ce79'::uuid, '14340ea1-b3df-41bf-968f-14486732fea2'::uuid, 405),
      ('284b7335-31db-483d-97ad-d87f3b1a4a46'::uuid, '6f06cb26-d8f2-4fa5-a7e8-c83943d9c959'::uuid, 406),
      ('99ec9878-acfd-48cb-a105-d0620ddbc9d8'::uuid, '4b4aa129-6dc7-465e-ae93-b9aa02aeaebe'::uuid, 407)
  ), valid as (
    select p.*
    from approved_pairs p
    join public.inquiries d on d.id = p.duplicate_id
    join public.inquiries c on c.id = p.canonical_id and c.sheet_row = p.canonical_sheet_row
    where c.assigned_to is not null
      and d.sheet_row is null and d.opportunity_id is null and d.deal_id is null
      and regexp_replace(coalesce(c.phone, ''), '[^0-9]', '', 'g') = regexp_replace(coalesce(d.phone, ''), '[^0-9]', '', 'g')
      and btrim(coalesce(c.brand, '')) = btrim(coalesce(d.brand, ''))
      and (
        coalesce(d.status, '') not in ('종결', '종료')
        or (
          d.status = '종결'
          and d.raw ->> 'duplicate_of_inquiry_id' = p.canonical_id::text
        )
      )
  )
  select count(*) into valid_count from valid;
  if valid_count <> 3 then
    raise exception 'approved duplicate validation failed: expected 3, got %', valid_count;
  end if;

  with approved_pairs(duplicate_id, canonical_id, canonical_sheet_row) as (
    values
      ('a59391de-3cda-456f-be21-812cbc44ce79'::uuid, '14340ea1-b3df-41bf-968f-14486732fea2'::uuid, 405),
      ('284b7335-31db-483d-97ad-d87f3b1a4a46'::uuid, '6f06cb26-d8f2-4fa5-a7e8-c83943d9c959'::uuid, 406),
      ('99ec9878-acfd-48cb-a105-d0620ddbc9d8'::uuid, '4b4aa129-6dc7-465e-ae93-b9aa02aeaebe'::uuid, 407)
  )
  update public.inquiries i
  set status = '종결',
      close_reason = '중복 문의 · sheet:' || p.canonical_sheet_row::text,
      raw = coalesce(i.raw, '{}'::jsonb) || jsonb_build_object(
        'duplicate_resolution', 'merged',
        'duplicate_of_inquiry_id', p.canonical_id,
        'duplicate_detected_by', '20260909232153_reconcile_inquiry_assignment_and_reverse_race'
      ),
      updated_at = clock_timestamp()
  from approved_pairs p
  where i.id = p.duplicate_id
    and coalesce(i.status, '') not in ('종결', '종료');

  with approved_pairs(duplicate_id, canonical_id) as (
    values
      ('a59391de-3cda-456f-be21-812cbc44ce79'::uuid, '14340ea1-b3df-41bf-968f-14486732fea2'::uuid),
      ('284b7335-31db-483d-97ad-d87f3b1a4a46'::uuid, '6f06cb26-d8f2-4fa5-a7e8-c83943d9c959'::uuid),
      ('99ec9878-acfd-48cb-a105-d0620ddbc9d8'::uuid, '4b4aa129-6dc7-465e-ae93-b9aa02aeaebe'::uuid)
  )
  select count(*) into post_count
  from approved_pairs p
  join public.inquiries d on d.id = p.duplicate_id
  where d.status = '종결'
    and d.raw ->> 'duplicate_of_inquiry_id' = p.canonical_id::text;
  if post_count <> 3 then
    raise exception 'approved duplicate postcheck failed: expected 3, got %', post_count;
  end if;
end
$first_cleanup$;

-- Replay the exact sheet-row 402 assignment. The RPC is idempotent when the
-- canonical UUID is already present and still refuses an unrelated owner.
do $row_402$
declare
  sync_result jsonb;
begin
  perform pg_catalog.set_config('request.jwt.claim.role', 'service_role', true);
  select public.crm_inquiry_assignment_sync_v1(jsonb_build_object(
    'inquiry_id', '903f0af2-de76-4a7f-9976-9d4b367fc08b',
    'sheet_row', 402,
    'phone', '010-2578-3372',
    'brand', 'POUR솔루션',
    'to', '서비스운영팀(송보람)',
    'operation', 'assign'
  )) into sync_result;
  if coalesce((sync_result ->> 'ok')::boolean, false) is not true
     or sync_result ->> 'assigned_to' <> '83ee1e70-a002-4a32-9044-c10992034f81'
     or sync_result ->> 'inquiry_id' <> '903f0af2-de76-4a7f-9976-9d4b367fc08b' then
    raise exception 'row 402 assignment validation failed: %', sync_result;
  end if;
end
$row_402$;

-- Record the two observed reverse-order duplicates. Exact IDs, sheet rows,
-- normalized identity and a 15-second window prevent scope expansion.
do $reverse_cleanup$
declare
  valid_count integer;
  post_count integer;
begin
  with approved_pairs(duplicate_id, canonical_id, canonical_sheet_row) as (
    values
      ('dfdf123e-0a3a-4160-8099-34e4103301fd'::uuid, 'd9db4ab1-ccf4-4502-a9fc-5889696a12a1'::uuid, 408),
      ('08d701c3-034c-4954-8083-cba90a36b923'::uuid, '8abccc0f-5a4b-4bed-9bb7-aebcab956377'::uuid, 409)
  ), valid as (
    select p.*
    from approved_pairs p
    join public.inquiries d on d.id = p.duplicate_id
    join public.inquiries c on c.id = p.canonical_id and c.sheet_row = p.canonical_sheet_row
    where c.assigned_to is not null
      and d.sheet_row is null and d.opportunity_id is null and d.deal_id is null
      and regexp_replace(coalesce(c.phone, ''), '[^0-9]', '', 'g') = regexp_replace(coalesce(d.phone, ''), '[^0-9]', '', 'g')
      and btrim(coalesce(c.brand, '')) = btrim(coalesce(d.brand, ''))
      and regexp_replace(lower(coalesce(c.site_name, '')), '[^0-9a-z가-힣]', '', 'g') = regexp_replace(lower(coalesce(d.site_name, '')), '[^0-9a-z가-힣]', '', 'g')
      and abs(extract(epoch from (coalesce(c.received_at, c.created_at) - coalesce(d.received_at, d.created_at)))) <= 15
      and (
        (d.assigned_to is null and coalesce(d.status, '') not in ('종결', '종료'))
        or (d.status = '종결' and d.raw ->> 'duplicate_of_inquiry_id' = p.canonical_id::text)
      )
  )
  select count(*) into valid_count from valid;
  if valid_count <> 2 then
    raise exception 'reverse-race cleanup validation failed: expected 2, got %', valid_count;
  end if;

  with approved_pairs(duplicate_id, canonical_id, canonical_sheet_row) as (
    values
      ('dfdf123e-0a3a-4160-8099-34e4103301fd'::uuid, 'd9db4ab1-ccf4-4502-a9fc-5889696a12a1'::uuid, 408),
      ('08d701c3-034c-4954-8083-cba90a36b923'::uuid, '8abccc0f-5a4b-4bed-9bb7-aebcab956377'::uuid, 409)
  )
  update public.inquiries i
  set status = '종결',
      close_reason = '중복 문의 · sheet:' || p.canonical_sheet_row::text,
      raw = coalesce(i.raw, '{}'::jsonb) || jsonb_build_object(
        'duplicate_resolution', 'merged',
        'duplicate_of_inquiry_id', p.canonical_id,
        'duplicate_detected_by', '20260909232153_reconcile_inquiry_assignment_and_reverse_race'
      ),
      updated_at = clock_timestamp()
  from approved_pairs p
  where i.id = p.duplicate_id
    and i.assigned_to is null
    and coalesce(i.status, '') not in ('종결', '종료');

  with approved_pairs(duplicate_id, canonical_id) as (
    values
      ('dfdf123e-0a3a-4160-8099-34e4103301fd'::uuid, 'd9db4ab1-ccf4-4502-a9fc-5889696a12a1'::uuid),
      ('08d701c3-034c-4954-8083-cba90a36b923'::uuid, '8abccc0f-5a4b-4bed-9bb7-aebcab956377'::uuid)
  )
  select count(*) into post_count
  from approved_pairs p
  join public.inquiries d on d.id = p.duplicate_id
  where d.status = '종결'
    and d.raw ->> 'duplicate_of_inquiry_id' = p.canonical_id::text;
  if post_count <> 2 then
    raise exception 'reverse-race cleanup postcheck failed: expected 2, got %', post_count;
  end if;
end
$reverse_cleanup$;
