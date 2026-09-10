-- Prevent the same external inquiry event from creating multiple CRM rows.
-- This migration changes only the service-role ingest boundary. It does not
-- modify n8n, Jandi, Google Sheets or existing inquiry rows.

create table if not exists private.inquiry_ingest_idempotency (
  event_key text primary key,
  inquiry_id uuid not null references public.inquiries(id) on delete cascade,
  first_seen_at timestamptz not null default clock_timestamp(),
  last_seen_at timestamptz not null default clock_timestamp(),
  attempts integer not null default 1,
  constraint inquiry_ingest_idempotency_event_key_not_blank
    check (length(btrim(event_key)) > 0)
);

alter table private.inquiry_ingest_idempotency enable row level security;

revoke all on table private.inquiry_ingest_idempotency
from public, anon, authenticated;
grant select, insert, update on table private.inquiry_ingest_idempotency
to service_role;

-- Freeze the already-installed implementation behind a private function. The
-- wrapper below adds idempotency without reimplementing the assignment,
-- business-type and sheet/direct reconciliation rules accumulated by earlier
-- migrations. Drift is rejected before any function is replaced.
do $capture_ingest_core$
declare
  function_def text;
  core_def text;
begin
  if to_regprocedure('private.crm_inquiry_ingest_core_20260911(jsonb)') is null then
    select pg_get_functiondef('public.crm_inquiry_ingest_v1(jsonb)'::regprocedure)
      into function_def;

    if position('recent_sheet_phone_brand_site' in function_def) = 0
       or position('v_business_type text;' in function_def) = 0
       or position('SERVICE_ROLE_REQUIRED' in function_def) = 0 then
      raise exception 'inquiry ingest core signature drift; no change applied';
    end if;

    core_def := regexp_replace(
      function_def,
      '^CREATE OR REPLACE FUNCTION public\.crm_inquiry_ingest_v1\(p_payload jsonb\)',
      'CREATE OR REPLACE FUNCTION private.crm_inquiry_ingest_core_20260911(p_payload jsonb)'
    );
    if core_def = function_def then
      raise exception 'inquiry ingest core capture failed; no change applied';
    end if;
    execute core_def;
  end if;
end
$capture_ingest_core$;

revoke execute on function private.crm_inquiry_ingest_core_20260911(jsonb)
from public, anon, authenticated;
grant execute on function private.crm_inquiry_ingest_core_20260911(jsonb)
to service_role;

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
  v_external_id text;
  v_source_namespace text;
  v_received_token text;
  v_event_date text;
  v_phone text;
  v_brand text;
  v_site text;
  v_message text;
  v_contact text;
  v_work_type text;
  v_channel text;
  v_source text;
  v_assignee text;
  v_assignee_user_id uuid;
  v_assignee_canonical text;
  v_assignee_count integer := 0;
  v_business_type text;
  v_keys text[] := array[]::text[];
  v_key text;
  v_inquiry_id uuid;
  v_mapped_ids uuid[];
  v_result jsonb;
begin
  if v_role <> 'service_role' and current_user <> 'service_role' then
    raise exception 'SERVICE_ROLE_REQUIRED' using errcode = '42501';
  end if;
  if p_payload is null or jsonb_typeof(p_payload) <> 'object' then
    raise exception 'INVALID_PAYLOAD' using errcode = '22023';
  end if;

  if coalesce(p_payload ->> 'sheet_row', p_payload ->> 'rowNumber', p_payload ->> 'row_number', '') ~ '^[0-9]+$' then
    v_sheet_row := coalesce(p_payload ->> 'sheet_row', p_payload ->> 'rowNumber', p_payload ->> 'row_number')::integer;
    v_keys := array_append(v_keys, 'sheet:' || v_sheet_row::text);
  end if;

  v_external_id := nullif(btrim(coalesce(
    p_payload ->> 'event_id', p_payload ->> 'eventId',
    p_payload ->> 'submission_id', p_payload ->> 'submissionId',
    p_payload ->> 'message_id', p_payload ->> 'messageId',
    p_payload ->> 'form_response_id', p_payload ->> 'formResponseId',
    p_payload ->> 'request_id', p_payload ->> 'requestId'
  )), '');
  v_source_namespace := lower(nullif(btrim(coalesce(
    p_payload ->> 'source_channel', p_payload ->> 'channel',
    p_payload ->> 'source', p_payload ->> 'brand', p_payload ->> '브랜드',
    'unknown'
  )), ''));
  if v_external_id is not null then
    v_keys := array_append(v_keys, 'external:v1:' || md5(v_source_namespace || '|' || v_external_id));
  end if;

  v_received_token := nullif(btrim(coalesce(
    p_payload ->> '접수일시', p_payload ->> 'received_at',
    p_payload ->> 'receivedAt', p_payload ->> 'submitted_at',
    p_payload ->> 'submittedAt'
  )), '');
  if v_received_token ~ '^[[:space:]]*[0-9]{4}[-./][[:space:]]*[0-9]{1,2}[-./][[:space:]]*[0-9]{1,2}' then
    v_event_date :=
      substring(v_received_token from '^[[:space:]]*([0-9]{4})') || '-' ||
      lpad(substring(v_received_token from '^[[:space:]]*[0-9]{4}[-./][[:space:]]*([0-9]{1,2})'), 2, '0') || '-' ||
      lpad(substring(v_received_token from '^[[:space:]]*[0-9]{4}[-./][[:space:]]*[0-9]{1,2}[-./][[:space:]]*([0-9]{1,2})'), 2, '0');
  end if;

  v_phone := regexp_replace(coalesce(
    p_payload ->> 'phone', p_payload ->> '고객연락처',
    p_payload ->> 'client_phone', p_payload ->> '관리사무소', ''
  ), '[^0-9]', '', 'g');
  v_brand := regexp_replace(lower(coalesce(
    p_payload ->> 'brand', p_payload ->> '브랜드', ''
  )), '[[:space:]]', '', 'g');
  v_site := regexp_replace(lower(coalesce(
    p_payload ->> 'site_name', p_payload ->> '현장명',
    p_payload ->> '현장명원본', p_payload ->> 'name', ''
  )), '[^0-9a-z가-힣]', '', 'g');
  v_message := regexp_replace(lower(coalesce(
    p_payload ->> '문의내용', p_payload ->> 'message', p_payload ->> 'inquiry', ''
  )), '[^0-9a-z가-힣]', '', 'g');

  -- This bridge key is deliberately unavailable without an original event
  -- date and exact phone+brand+site identity. It therefore catches replay of
  -- one collection event without collapsing unrelated historical inquiries.
  if v_event_date is not null and v_phone <> '' and v_brand <> '' and v_site <> '' then
    v_keys := array_append(v_keys, 'fingerprint:v1:' || md5(concat_ws(
      '|', v_event_date, v_phone, v_brand, v_site, v_message
    )));
  end if;

  select coalesce(array_agg(distinct k order by k), array[]::text[])
    into v_keys
  from unnest(v_keys) as keys(k);

  -- A deterministic lock order prevents both duplicate inserts and deadlocks
  -- when sheet and webhook requests arrive concurrently.
  foreach v_key in array v_keys loop
    perform pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended('crm_inquiry_event:' || v_key, 0)
    );
  end loop;

  select array_agg(distinct d.inquiry_id order by d.inquiry_id)
    into v_mapped_ids
  from private.inquiry_ingest_idempotency d
  where d.event_key = any(v_keys);

  if coalesce(array_length(v_mapped_ids, 1), 0) > 1 then
    raise exception 'INGEST_IDENTITY_CONFLICT' using errcode = 'PT409';
  end if;

  if coalesce(array_length(v_mapped_ids, 1), 0) = 1 then
    v_inquiry_id := v_mapped_ids[1];

    if v_sheet_row is not null and exists (
      select 1 from public.inquiries other
      where other.sheet_row = v_sheet_row and other.id <> v_inquiry_id
    ) then
      raise exception 'INGEST_SHEET_IDENTITY_CONFLICT' using errcode = 'PT409';
    end if;

    v_assignee := nullif(btrim(coalesce(
      p_payload ->> 'assignee_name', p_payload ->> 'assignee', p_payload ->> '담당자'
    )), '');
    if v_assignee = '서비스운영팀(송보람)' then
      v_assignee := '송보람';
    end if;
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
    v_business_type := nullif(btrim(coalesce(
      p_payload ->> 'business_type', p_payload ->> 'businessType', p_payload ->> '문의종류'
    )), '');
    if v_business_type is not null and v_business_type not in ('견적문의', '기술자문') then
      raise exception 'INVALID_BUSINESS_TYPE' using errcode = '22023';
    end if;

    update public.inquiries i
    set sheet_row = coalesce(i.sheet_row, v_sheet_row),
        brand = coalesce(i.brand, nullif(btrim(coalesce(p_payload ->> 'brand', p_payload ->> '브랜드')), '')),
        site_name = coalesce(i.site_name, nullif(btrim(coalesce(
          p_payload ->> 'site_name', p_payload ->> '현장명', p_payload ->> '현장명원본', p_payload ->> 'name'
        )), '')),
        address = coalesce(i.address, nullif(btrim(coalesce(p_payload ->> 'address', p_payload ->> '건물주소')), '')),
        contact_name = coalesce(i.contact_name, v_contact),
        phone = coalesce(i.phone, nullif(btrim(coalesce(
          p_payload ->> 'phone', p_payload ->> '고객연락처', p_payload ->> 'client_phone', p_payload ->> '관리사무소'
        )), '')),
        assigned_to = coalesce(i.assigned_to, v_assignee_user_id),
        assignee_name = case
          when i.assigned_to is not null then coalesce(
            i.assignee_name,
            (select u.name from public.users u where u.user_id = i.assigned_to)
          )
          when v_assignee_user_id is not null then v_assignee_canonical
          else i.assignee_name
        end,
        assigned_at = case
          when i.assigned_to is null and v_assignee_user_id is not null
            then coalesce(i.assigned_at, clock_timestamp())
          else i.assigned_at
        end,
        source_channel = coalesce(i.source_channel, v_channel, v_source),
        channel = coalesce(i.channel, v_channel),
        source = coalesce(i.source, v_source),
        work_type = coalesce(i.work_type, v_work_type),
        business_type = case
          when i.business_type = '기술자문' or v_business_type = '기술자문' then '기술자문'
          else coalesce(i.business_type, '견적문의')
        end,
        raw = coalesce(i.raw, '{}'::jsonb) || p_payload || jsonb_build_object(
          'ingest_idempotency_keys', to_jsonb(v_keys),
          'ingest_match_source', 'idempotency_alias'
        ),
        updated_at = clock_timestamp()
    where i.id = v_inquiry_id;

    if not found then
      raise exception 'INGEST_IDEMPOTENCY_TARGET_MISSING' using errcode = 'PT409';
    end if;

    update private.inquiry_ingest_idempotency d
    set last_seen_at = clock_timestamp(), attempts = d.attempts + 1
    where d.event_key = any(v_keys);

    return jsonb_build_object(
      'ok', true, 'deduplicated', true,
      'inquiry_id', v_inquiry_id,
      'matched_by', 'idempotency_alias',
      'event_keys', to_jsonb(v_keys)
    );
  end if;

  v_result := private.crm_inquiry_ingest_core_20260911(p_payload);
  if coalesce((v_result ->> 'ok')::boolean, false) is not true
     or coalesce(v_result ->> 'inquiry_id', '') !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
    raise exception 'INGEST_CORE_ACK_INVALID' using errcode = 'PT409';
  end if;
  v_inquiry_id := (v_result ->> 'inquiry_id')::uuid;

  foreach v_key in array v_keys loop
    insert into private.inquiry_ingest_idempotency(event_key, inquiry_id)
    values (v_key, v_inquiry_id)
    on conflict (event_key) do update
      set last_seen_at = clock_timestamp(),
          attempts = private.inquiry_ingest_idempotency.attempts + 1
      where private.inquiry_ingest_idempotency.inquiry_id = excluded.inquiry_id;
  end loop;

  if exists (
    select 1 from private.inquiry_ingest_idempotency d
    where d.event_key = any(v_keys) and d.inquiry_id <> v_inquiry_id
  ) then
    -- Raising here rolls back the core insert as well, so a conflicting event
    -- identity can never leave a second inquiry row behind.
    raise exception 'INGEST_IDENTITY_CONFLICT' using errcode = 'PT409';
  end if;

  return v_result || jsonb_build_object('event_keys', to_jsonb(v_keys));
end;
$function$;

revoke execute on function public.crm_inquiry_ingest_v1(jsonb)
from public, anon, authenticated;
grant execute on function public.crm_inquiry_ingest_v1(jsonb)
to service_role;

comment on function public.crm_inquiry_ingest_v1(jsonb) is
'Service-role inquiry ingest boundary with strict event idempotency, deterministic concurrency locks, fail-closed identity conflicts and monotonic owner UUID preservation.';

do $postcheck$
begin
  if to_regprocedure('private.crm_inquiry_ingest_core_20260911(jsonb)') is null
     or to_regprocedure('public.crm_inquiry_ingest_v1(jsonb)') is null then
    raise exception 'inquiry ingest idempotency install incomplete';
  end if;
  if has_function_privilege('anon', 'public.crm_inquiry_ingest_v1(jsonb)', 'EXECUTE')
     or has_function_privilege('authenticated', 'public.crm_inquiry_ingest_v1(jsonb)', 'EXECUTE') then
    raise exception 'inquiry ingest privilege regression';
  end if;
end
$postcheck$;
