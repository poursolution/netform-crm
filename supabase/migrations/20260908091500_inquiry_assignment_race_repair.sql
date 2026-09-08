-- Keep the existing n8n/Jandi workflow unchanged.  This migration repairs the
-- database-side race where assignment can arrive before the sheet-backed row.

create index if not exists idx_inquiries_unlinked_phone_brand_received
  on public.inquiries (
    (regexp_replace(coalesce(phone, ''), '[^0-9]', '', 'g')),
    (btrim(coalesce(brand, ''))),
    received_at desc
  )
  where sheet_row is null
    and opportunity_id is null
    and deal_id is null;

create or replace function public.crm_inquiry_assignment_sync_v1(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  requested_role text := coalesce(
    nullif(current_setting('request.jwt.claim.role', true), ''),
    nullif((nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role'), ''),
    ''
  );
  target_name text;
  operation_name text;
  inquiry_uuid uuid;
  inquiry_sheet_row integer;
  inquiry_phone text;
  inquiry_brand text;
  expected_from text;
  expected_uuid uuid;
  matched_inquiry public.inquiries%rowtype;
  target_user_id uuid;
  target_canonical_name text;
  target_count integer;
  inquiry_count integer := 0;
  current_owner_name text;
  changed_at_value timestamptz;
  changed boolean := false;
  match_source text := '';
begin
  if requested_role <> 'service_role' and current_user <> 'service_role' then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  if p_payload is null or jsonb_typeof(p_payload) is distinct from 'object' then
    raise exception 'invalid payload' using errcode = '22023';
  end if;

  target_name := btrim(coalesce(p_payload->>'to', p_payload->>'assignee_name', ''));
  operation_name := lower(btrim(coalesce(p_payload->>'operation', 'assign')));
  expected_from := nullif(btrim(coalesce(p_payload->>'expected_from', '')), '');

  if target_name = '' or operation_name not in ('assign', 'reassign') then
    raise exception 'invalid assignment target or operation' using errcode = '22023';
  end if;

  begin
    inquiry_uuid := nullif(p_payload->>'inquiry_id', '')::uuid;
    inquiry_sheet_row := nullif(p_payload->>'sheet_row', '')::integer;
    expected_uuid := nullif(p_payload->>'expected_assigned_to', '')::uuid;
  exception when invalid_text_representation then
    raise exception 'invalid inquiry or expected owner identifier' using errcode = '22023';
  end;

  inquiry_phone := nullif(regexp_replace(coalesce(p_payload->>'phone', ''), '[^0-9]', '', 'g'), '');
  inquiry_brand := nullif(btrim(coalesce(p_payload->>'brand', '')), '');

  select count(*), min(u.user_id::text)::uuid, min(u.name)
    into target_count, target_user_id, target_canonical_name
  from public.users u
  where u.active is true
    and btrim(u.name) = target_name;

  if target_count <> 1 then
    raise exception 'assignment_sync_rejected:%',
      case when target_count = 0 then 'ACTIVE_USER_NOT_FOUND' else 'ACTIVE_USER_NAME_AMBIGUOUS' end
      using errcode = 'P0001';
  end if;

  -- Assignment and sheet ingestion take the same lock, preventing a second row
  -- from being created while the sheet row is attached to the direct-ingest row.
  if inquiry_sheet_row is not null then
    perform pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended('crm_inquiry_sheet:' || inquiry_sheet_row::text, 0)
    );
  end if;

  if inquiry_uuid is not null then
    select count(*) into inquiry_count from public.inquiries i where i.id = inquiry_uuid;
    if inquiry_count = 1 then
      select * into matched_inquiry from public.inquiries i where i.id = inquiry_uuid for update;
      match_source := 'inquiry_id';
    end if;
  elsif inquiry_sheet_row is not null then
    select count(*) into inquiry_count from public.inquiries i where i.sheet_row = inquiry_sheet_row;
    if inquiry_count = 1 then
      select * into matched_inquiry from public.inquiries i where i.sheet_row = inquiry_sheet_row for update;
      match_source := 'sheet_row';
    elsif inquiry_count = 0 and inquiry_phone is not null and inquiry_brand is not null then
      -- The direct webhook row normally exists first with no sheet_row.  Only a
      -- single recent, unconverted candidate is safe to attach automatically.
      select count(*) into inquiry_count
      from public.inquiries i
      where i.sheet_row is null
        and i.opportunity_id is null
        and i.deal_id is null
        and regexp_replace(coalesce(i.phone, ''), '[^0-9]', '', 'g') = inquiry_phone
        and btrim(coalesce(i.brand, '')) = inquiry_brand
        and coalesce(i.received_at, i.created_at) >= clock_timestamp() - interval '24 hours';

      if inquiry_count = 1 then
        select * into matched_inquiry
        from public.inquiries i
        where i.sheet_row is null
          and i.opportunity_id is null
          and i.deal_id is null
          and regexp_replace(coalesce(i.phone, ''), '[^0-9]', '', 'g') = inquiry_phone
          and btrim(coalesce(i.brand, '')) = inquiry_brand
          and coalesce(i.received_at, i.created_at) >= clock_timestamp() - interval '24 hours'
        for update;
        match_source := 'recent_phone_brand';
      end if;
    end if;
  elsif inquiry_phone is not null and inquiry_brand is not null then
    select count(*) into inquiry_count
    from public.inquiries i
    where regexp_replace(coalesce(i.phone, ''), '[^0-9]', '', 'g') = inquiry_phone
      and btrim(coalesce(i.brand, '')) = inquiry_brand;
    if inquiry_count = 1 then
      select * into matched_inquiry
      from public.inquiries i
      where regexp_replace(coalesce(i.phone, ''), '[^0-9]', '', 'g') = inquiry_phone
        and btrim(coalesce(i.brand, '')) = inquiry_brand
      for update;
      match_source := 'phone_brand';
    end if;
  else
    raise exception 'inquiry_id, sheet_row, or phone+brand is required' using errcode = '22023';
  end if;

  if inquiry_count <> 1 or matched_inquiry.id is null then
    raise exception 'assignment_sync_rejected:%',
      case when coalesce(inquiry_count, 0) = 0 then 'INQUIRY_NOT_FOUND' else 'INQUIRY_MATCH_AMBIGUOUS' end
      using errcode = 'P0001';
  end if;

  if matched_inquiry.assigned_to is not null
     and matched_inquiry.assigned_to is distinct from target_user_id then
    select u.name into current_owner_name
    from public.users u
    where u.user_id = matched_inquiry.assigned_to;

    if operation_name <> 'reassign'
      or (expected_uuid is null and expected_from is null)
      or (expected_uuid is not null and expected_uuid is distinct from matched_inquiry.assigned_to)
      or (expected_from is not null and btrim(coalesce(current_owner_name, '')) is distinct from expected_from)
    then
      raise exception 'assignment_sync_rejected:EXISTING_UUID_PRESERVED' using errcode = 'P0001';
    end if;
  end if;

  changed := matched_inquiry.assigned_to is distinct from target_user_id
    or btrim(coalesce(matched_inquiry.assignee_name, '')) is distinct from target_canonical_name
    or (inquiry_sheet_row is not null and matched_inquiry.sheet_row is null)
    or matched_inquiry.assigned_at is null;
  changed_at_value := clock_timestamp();

  update public.inquiries i
  set assigned_to = target_user_id,
      assignee_name = target_canonical_name,
      assigned_at = case
        when matched_inquiry.assigned_to is distinct from target_user_id
          then changed_at_value
        else coalesce(matched_inquiry.assigned_at, changed_at_value)
      end,
      sheet_row = coalesce(matched_inquiry.sheet_row, inquiry_sheet_row),
      raw = case when inquiry_sheet_row is null then coalesce(i.raw, '{}'::jsonb)
        else coalesce(i.raw, '{}'::jsonb) || jsonb_build_object(
          'assignment_sheet_row', inquiry_sheet_row,
          'assignment_match_source', match_source
        ) end,
      updated_at = changed_at_value
  where i.id = matched_inquiry.id;

  return jsonb_build_object(
    'ok', true,
    'changed', changed,
    'reason', case
      when not changed then 'ALREADY_SYNCED'
      when matched_inquiry.assigned_to is null then 'ASSIGNED'
      else 'REASSIGNED'
    end,
    'match_source', match_source,
    'inquiry_id', matched_inquiry.id,
    'sheet_row', coalesce(matched_inquiry.sheet_row, inquiry_sheet_row),
    'assigned_to', target_user_id,
    'assignee_name', target_canonical_name,
    'server_at', changed_at_value
  );
end;
$function$;

revoke execute on function public.crm_inquiry_assignment_sync_v1(jsonb)
from public, anon, authenticated;
grant execute on function public.crm_inquiry_assignment_sync_v1(jsonb)
to service_role;

comment on function public.crm_inquiry_assignment_sync_v1(jsonb) is
'Service-role-only inquiry assignment sync. Exact IDs win; a missing sheet row may attach only one recent unconverted phone+brand match. Existing owner UUIDs remain CAS-protected.';

create or replace function public.crm_inquiry_ingest_v1(p_payload jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_role text := coalesce(
    nullif(current_setting('request.jwt.claim.role', true), ''),
    nullif((nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role'), ''),
    ''
  );
  v_sheet_row integer;
  v_phone text;
  v_region text;
  v_site text;
  v_brand text;
  v_contact text;
  v_work_type text;
  v_channel text;
  v_source text;
  v_status text;
  v_assignee text;
  v_assignee_user_id uuid;
  v_assignee_canonical text;
  v_assignee_count integer := 0;
  v_request_key text;
  v_inquiry_id uuid;
  v_candidate_count integer := 0;
  v_candidate public.inquiries%rowtype;
  v_match_source text := '';
begin
  if v_role <> 'service_role' and current_user <> 'service_role' then
    raise exception 'SERVICE_ROLE_REQUIRED' using errcode = '42501';
  end if;

  if p_payload is null or jsonb_typeof(p_payload) <> 'object' then
    raise exception 'INVALID_PAYLOAD' using errcode = '22023';
  end if;

  if coalesce(p_payload ->> 'sheet_row', p_payload ->> 'rowNumber', p_payload ->> 'row_number', '') ~ '^[0-9]+$' then
    v_sheet_row := coalesce(p_payload ->> 'sheet_row', p_payload ->> 'rowNumber', p_payload ->> 'row_number')::integer;
  end if;

  v_phone := nullif(btrim(coalesce(
    p_payload ->> 'phone', p_payload ->> '고객연락처',
    p_payload ->> 'client_phone', p_payload ->> '관리사무소'
  )), '');
  v_region := nullif(btrim(coalesce(
    p_payload ->> 'region', p_payload ->> '지역원본', p_payload ->> '지역'
  )), '');
  v_site := nullif(btrim(coalesce(
    p_payload ->> 'site_name', p_payload ->> '현장명',
    p_payload ->> '현장명원본', p_payload ->> 'name'
  )), '');
  v_brand := nullif(btrim(coalesce(p_payload ->> 'brand', p_payload ->> '브랜드')), '');
  v_contact := nullif(btrim(coalesce(
    p_payload ->> 'contact_name', p_payload ->> '고객성함', p_payload ->> 'client_name'
  )), '');
  v_work_type := nullif(btrim(coalesce(
    p_payload ->> 'work_type', p_payload ->> '공사유형',
    p_payload ->> 'construction_type', p_payload ->> '건물유형'
  )), '');
  v_channel := nullif(btrim(coalesce(
    p_payload ->> 'channel', p_payload ->> '상담채널', p_payload ->> 'source'
  )), '');
  v_source := nullif(btrim(coalesce(
    p_payload ->> 'referral_source', p_payload ->> '유입경로', p_payload ->> 'source_channel'
  )), '');
  v_status := nullif(btrim(coalesce(p_payload ->> 'status', p_payload ->> '진행상태')), '');
  v_assignee := nullif(btrim(coalesce(
    p_payload ->> 'assignee_name', p_payload ->> 'assignee', p_payload ->> '담당자'
  )), '');

  if v_assignee is not null then
    select count(*), min(u.user_id::text)::uuid, min(u.name)
      into v_assignee_count, v_assignee_user_id, v_assignee_canonical
    from public.users u
    where u.active is true and btrim(u.name) = v_assignee;
    if v_assignee_count <> 1 then
      v_assignee_user_id := null;
      v_assignee_canonical := null;
    end if;
  end if;

  if v_site is null or v_site ~ '^\[[^]]*\]\s*$' then
    v_site := format(
      '[%s] 문의-%s',
      coalesce(v_region, '지역미상'),
      coalesce(
        nullif(right(regexp_replace(coalesce(v_phone, ''), '\D', '', 'g'), 4), ''),
        to_char(clock_timestamp(), 'MMDDHH24MI')
      )
    );
  elsif v_region is not null and v_site !~ '^\[' then
    v_site := format('[%s] %s', v_region, v_site);
  end if;

  v_request_key := case
    when v_sheet_row is not null then 'sheet:' || v_sheet_row::text
    else 'payload:' || md5(concat_ws('|',
      coalesce(p_payload ->> '접수일시', p_payload ->> 'received_at', ''),
      coalesce(v_brand, ''), coalesce(v_site, ''), coalesce(v_phone, ''),
      coalesce(p_payload ->> '문의내용', p_payload ->> 'message', p_payload ->> 'inquiry', '')
    ))
  end;

  if v_sheet_row is not null then
    perform pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended('crm_inquiry_sheet:' || v_sheet_row::text, 0)
    );
  end if;

  insert into private.inquiry_ingest_backup(request_key, payload)
  values (v_request_key, p_payload)
  on conflict (request_key) do update
    set payload = excluded.payload,
        last_seen_at = now(),
        attempts = private.inquiry_ingest_backup.attempts + 1
  returning inquiry_id into v_inquiry_id;

  if v_inquiry_id is not null then
    return jsonb_build_object(
      'ok', true, 'deduplicated', true,
      'inquiry_id', v_inquiry_id, 'request_key', v_request_key,
      'matched_by', 'request_key'
    );
  end if;

  if v_sheet_row is not null then
    select count(*) into v_candidate_count
    from public.inquiries i where i.sheet_row = v_sheet_row;

    if v_candidate_count = 1 then
      select * into v_candidate
      from public.inquiries i where i.sheet_row = v_sheet_row for update;
      v_match_source := 'sheet_row';
    elsif v_candidate_count = 0 and v_phone is not null and v_brand is not null then
      select count(*) into v_candidate_count
      from public.inquiries i
      where i.sheet_row is null
        and i.opportunity_id is null
        and i.deal_id is null
        and regexp_replace(coalesce(i.phone, ''), '[^0-9]', '', 'g') = regexp_replace(v_phone, '[^0-9]', '', 'g')
        and btrim(coalesce(i.brand, '')) = v_brand
        and coalesce(i.received_at, i.created_at) >= clock_timestamp() - interval '24 hours';

      if v_candidate_count = 1 then
        select * into v_candidate
        from public.inquiries i
        where i.sheet_row is null
          and i.opportunity_id is null
          and i.deal_id is null
          and regexp_replace(coalesce(i.phone, ''), '[^0-9]', '', 'g') = regexp_replace(v_phone, '[^0-9]', '', 'g')
          and btrim(coalesce(i.brand, '')) = v_brand
          and coalesce(i.received_at, i.created_at) >= clock_timestamp() - interval '24 hours'
        for update;
        v_match_source := 'recent_phone_brand';
      end if;
    end if;
  end if;

  if v_candidate.id is not null then
    update public.inquiries i
    set sheet_row = coalesce(i.sheet_row, v_sheet_row),
        brand = coalesce(v_brand, i.brand),
        site_name = coalesce(v_site, i.site_name),
        address = coalesce(nullif(btrim(coalesce(p_payload ->> 'address', p_payload ->> '건물주소')), ''), i.address),
        contact_name = coalesce(v_contact, i.contact_name),
        phone = coalesce(v_phone, i.phone),
        status = coalesce(v_status, i.status, '접수'),
        assignee_name = coalesce(v_assignee_canonical, v_assignee, i.assignee_name),
        assigned_to = coalesce(v_assignee_user_id, i.assigned_to),
        assigned_at = case
          when i.assigned_to is null and v_assignee_user_id is not null then clock_timestamp()
          else i.assigned_at
        end,
        source_channel = coalesce(v_channel, v_source, i.source_channel),
        inquiry_type = coalesce(i.inquiry_type, '견적문의'),
        channel = coalesce(v_channel, i.channel),
        source = coalesce(v_source, i.source),
        work_type = coalesce(v_work_type, i.work_type),
        raw = coalesce(i.raw, '{}'::jsonb) || p_payload || jsonb_strip_nulls(jsonb_build_object(
          'ingest_request_key', coalesce(i.raw ->> 'ingest_request_key', v_request_key),
          'sheet_ingest_request_key', case when v_sheet_row is not null then v_request_key end,
          'normalized_site_name', coalesce(v_site, i.site_name),
          'ingest_match_source', v_match_source
        )),
        updated_at = clock_timestamp()
    where i.id = v_candidate.id
    returning i.id into v_inquiry_id;

    update private.inquiry_ingest_backup
       set inquiry_id = v_inquiry_id, last_seen_at = now()
     where request_key = v_request_key;

    return jsonb_build_object(
      'ok', true, 'deduplicated', true,
      'inquiry_id', v_inquiry_id, 'request_key', v_request_key,
      'matched_by', v_match_source
    );
  end if;

  insert into public.inquiries(
    brand, site_name, address, contact_name, phone, assignee_name, status,
    received_at, sheet_row, raw, source_channel, inquiry_type,
    assigned_to, assigned_at, channel, source, work_type, updated_at
  ) values (
    v_brand, v_site,
    nullif(btrim(coalesce(p_payload ->> 'address', p_payload ->> '건물주소')), ''),
    v_contact, v_phone, coalesce(v_assignee_canonical, v_assignee), coalesce(v_status, '접수'),
    now(), v_sheet_row,
    p_payload || jsonb_build_object(
      'ingest_request_key', v_request_key,
      'normalized_site_name', v_site
    ),
    coalesce(v_channel, v_source, 'n8n'),
    '견적문의', v_assignee_user_id,
    case when v_assignee_user_id is not null then clock_timestamp() end,
    v_channel, v_source, v_work_type, now()
  )
  returning id into v_inquiry_id;

  update private.inquiry_ingest_backup
     set inquiry_id = v_inquiry_id, last_seen_at = now()
   where request_key = v_request_key;

  return jsonb_build_object(
    'ok', true, 'deduplicated', false,
    'inquiry_id', v_inquiry_id, 'request_key', v_request_key,
    'site_name', v_site
  );
end;
$function$;

revoke execute on function public.crm_inquiry_ingest_v1(jsonb)
from public, anon, authenticated;
grant execute on function public.crm_inquiry_ingest_v1(jsonb)
to service_role;

comment on function public.crm_inquiry_ingest_v1(jsonb) is
'Service-role inquiry ingestion with private backup and race-safe sheet/direct deduplication. A recent phone+brand candidate is merged only when exactly one row matches.';

-- Repair name-only assignments when exactly one active user is an exact match.
with unique_user as (
  select btrim(u.name) as name, min(u.user_id::text)::uuid as user_id
  from public.users u
  where u.active is true
  group by btrim(u.name)
  having count(*) = 1
)
update public.inquiries i
set assigned_to = u.user_id,
    assigned_at = coalesce(i.assigned_at, clock_timestamp()),
    updated_at = clock_timestamp(),
    raw = coalesce(i.raw, '{}'::jsonb) || jsonb_build_object(
      'assignment_repaired_by', '20260908091500_inquiry_assignment_race_repair'
    )
from unique_user u
where i.assigned_to is null
  and nullif(btrim(coalesce(i.assignee_name, '')), '') = u.name;

-- Preserve the direct-ingest copies as closed history instead of deleting them.
-- Only unambiguous same-phone/same-brand pairs within 24 hours are repaired.
with candidate_pairs as (
  select a.id as duplicate_id,
         min(b.id::text)::uuid as canonical_id,
         min(b.sheet_row) as canonical_sheet_row
  from public.inquiries a
  join public.inquiries b
    on b.id <> a.id
   and b.sheet_row is not null
   and regexp_replace(coalesce(b.phone, ''), '[^0-9]', '', 'g') = regexp_replace(coalesce(a.phone, ''), '[^0-9]', '', 'g')
   and btrim(coalesce(b.brand, '')) = btrim(coalesce(a.brand, ''))
   and abs(extract(epoch from (coalesce(b.received_at, b.created_at) - coalesce(a.received_at, a.created_at)))) <= 86400
  where a.sheet_row is null
    and a.opportunity_id is null
    and a.deal_id is null
    and coalesce(a.status, '') not in ('종결', '종료')
  group by a.id
  having count(*) = 1
), assigned_canonical as (
  select p.*
  from candidate_pairs p
  join public.inquiries c on c.id = p.canonical_id
  where c.assigned_to is not null
)
update public.inquiries i
set status = '종결',
    close_reason = '중복 문의 · sheet:' || p.canonical_sheet_row::text,
    raw = coalesce(i.raw, '{}'::jsonb) || jsonb_build_object(
      'duplicate_resolution', 'merged',
      'duplicate_of_inquiry_id', p.canonical_id,
      'duplicate_detected_by', '20260908091500_inquiry_assignment_race_repair'
    ),
    updated_at = clock_timestamp()
from assigned_canonical p
where i.id = p.duplicate_id;
