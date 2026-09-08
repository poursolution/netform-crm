create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
grant usage on schema private to service_role;

create table if not exists private.inquiry_ingest_backup (
  backup_id bigint generated always as identity primary key,
  request_key text not null unique,
  payload jsonb not null,
  inquiry_id uuid,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  attempts integer not null default 1
);

create table if not exists private.technical_advisory_ingest_backup (
  backup_id bigint generated always as identity primary key,
  request_key text not null unique,
  payload jsonb not null,
  advisory_id uuid,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  attempts integer not null default 1
);

revoke all on table private.inquiry_ingest_backup from public, anon, authenticated;
revoke all on table private.technical_advisory_ingest_backup from public, anon, authenticated;
grant select, insert, update on table private.inquiry_ingest_backup to service_role;
grant select, insert, update on table private.technical_advisory_ingest_backup to service_role;
grant usage, select on all sequences in schema private to service_role;

create unique index if not exists uq_inquiries_ingest_request_key
  on public.inquiries ((raw ->> 'ingest_request_key'))
  where raw ->> 'ingest_request_key' is not null;

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
  v_request_key text;
  v_inquiry_id uuid;
begin
  if v_role <> 'service_role' and current_user <> 'service_role' then
    raise exception 'SERVICE_ROLE_REQUIRED' using errcode = '42501';
  end if;

  if p_payload is null or jsonb_typeof(p_payload) <> 'object' then
    raise exception 'INVALID_PAYLOAD' using errcode = '22023';
  end if;

  if coalesce(p_payload ->> 'sheet_row', p_payload ->> 'rowNumber', '') ~ '^[0-9]+$' then
    v_sheet_row := coalesce(p_payload ->> 'sheet_row', p_payload ->> 'rowNumber')::integer;
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
  v_status := coalesce(
    nullif(btrim(coalesce(p_payload ->> 'status', p_payload ->> '진행상태')), ''),
    '접수'
  );

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
      'inquiry_id', v_inquiry_id, 'request_key', v_request_key
    );
  end if;

  insert into public.inquiries(
    brand, site_name, address, contact_name, phone, status,
    received_at, sheet_row, raw, source_channel, inquiry_type,
    channel, source, work_type, updated_at
  ) values (
    v_brand, v_site,
    nullif(btrim(coalesce(p_payload ->> 'address', p_payload ->> '건물주소')), ''),
    v_contact, v_phone, v_status, now(), v_sheet_row,
    p_payload || jsonb_build_object(
      'ingest_request_key', v_request_key,
      'normalized_site_name', v_site
    ),
    coalesce(v_channel, v_source, 'n8n'),
    '견적문의', v_channel, v_source, v_work_type, now()
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

revoke all on function public.crm_inquiry_ingest_v1(jsonb) from public, anon, authenticated;
grant execute on function public.crm_inquiry_ingest_v1(jsonb) to service_role;
