-- Keep origin brand and customer type intact while giving inquiry routing a
-- separate, canonical business classification.

alter table public.inquiries
  add column if not exists business_type text;

update public.inquiries i
set business_type = case
      when regexp_replace(coalesce(i.brand, ''), '\s', '', 'g') = '기술자문'
        or (
          concat_ws(' ', i.raw ->> '문의내용', i.raw ->> 'message', i.raw ->> 'inquiry') ~ '기술\s*자문'
          and concat_ws(' ', i.raw ->> '문의내용', i.raw ->> 'message', i.raw ->> 'inquiry')
              !~ '기술\s*자문.{0,12}(아님|아니|해당\s*없|무관)'
        ) then '기술자문'
      else '견적문의'
    end
where i.business_type is null;

alter table public.inquiries
  alter column business_type set default '견적문의',
  alter column business_type set not null;

alter table public.inquiries
  drop constraint if exists inquiries_business_type_check;

alter table public.inquiries
  add constraint inquiries_business_type_check
  check (business_type in ('견적문의', '기술자문'));

create index if not exists idx_inquiries_business_type_status_received
  on public.inquiries (business_type, status, received_at desc);

comment on column public.inquiries.business_type is
'Canonical inquiry routing class. Origin brand and inquiry_type(customer type) remain unchanged.';

do $patch_ingest$
declare
  function_def text;
  declaration_marker text := E'  v_status text;\n';
  declaration_block text := E'  v_business_type text;\n  v_business_type_source text;\n  v_inquiry_text text;\n';
  parse_marker text := E'  v_status := nullif(btrim(coalesce(p_payload ->> ''status'', p_payload ->> ''진행상태'')), '''');\n';
  parse_block text := E'  v_inquiry_text := concat_ws('' '', p_payload ->> ''문의내용'', p_payload ->> ''message'', p_payload ->> ''inquiry'');\n  v_business_type := nullif(btrim(coalesce(p_payload ->> ''business_type'', p_payload ->> ''businessType'', p_payload ->> ''문의종류'')), '''');\n  if v_business_type is not null and v_business_type not in (''견적문의'', ''기술자문'') then\n    raise exception ''INVALID_BUSINESS_TYPE'' using errcode = ''22023'';\n  end if;\n  if v_business_type is not null then\n    v_business_type_source := ''explicit'';\n  elsif regexp_replace(coalesce(v_brand, ''''), ''\\s'', '''', ''g'') = ''기술자문''\n     or (v_inquiry_text ~ ''기술\\s*자문'' and v_inquiry_text !~ ''기술\\s*자문.{0,12}(아님|아니|해당\\s*없|무관)'') then\n    v_business_type := ''기술자문'';\n    v_business_type_source := ''message'';\n  else\n    v_business_type := ''견적문의'';\n    v_business_type_source := ''default'';\n  end if;\n';
  update_marker text := E'        inquiry_type = coalesce(i.inquiry_type, ''견적문의''),\n';
  update_block text := E'        business_type = case\n          when i.business_type = ''기술자문'' or v_business_type = ''기술자문'' then ''기술자문''\n          else ''견적문의''\n        end,\n';
  insert_columns_marker text := E'    received_at, sheet_row, raw, source_channel, inquiry_type,\n';
  insert_columns_block text := E'    received_at, sheet_row, raw, source_channel, inquiry_type, business_type,\n';
  insert_values_marker text := E'    ''견적문의'', v_assignee_user_id,\n';
  insert_values_block text := E'    ''견적문의'', v_business_type, v_assignee_user_id,\n';
  result_marker text := E'    ''site_name'', v_site\n';
  result_block text := E'    ''site_name'', v_site,\n    ''business_type'', v_business_type,\n    ''business_type_source'', v_business_type_source\n';
begin
  select pg_get_functiondef('public.crm_inquiry_ingest_v1(jsonb)'::regprocedure)
    into function_def;

  if position('v_business_type text;' in function_def) = 0 then
    if position(declaration_marker in function_def) = 0
       or position(parse_marker in function_def) = 0
       or position(update_marker in function_def) = 0
       or position(insert_columns_marker in function_def) = 0
       or position(insert_values_marker in function_def) = 0
       or position(result_marker in function_def) = 0 then
      raise exception 'inquiry ingest business-type signature drift; no change applied';
    end if;

    function_def := replace(function_def, declaration_marker, declaration_marker || declaration_block);
    function_def := replace(function_def, parse_marker, parse_marker || parse_block);
    function_def := replace(function_def, update_marker, update_marker || update_block);
    function_def := replace(function_def, insert_columns_marker, insert_columns_block);
    function_def := replace(function_def, insert_values_marker, insert_values_block);
    function_def := replace(function_def, result_marker, result_block);
    execute function_def;
  end if;
end
$patch_ingest$;

revoke execute on function public.crm_inquiry_ingest_v1(jsonb)
from public, anon, authenticated;
grant execute on function public.crm_inquiry_ingest_v1(jsonb)
to service_role;

comment on function public.crm_inquiry_ingest_v1(jsonb) is
'Service-role inquiry ingestion with private backup, race-safe deduplication and canonical business_type. Origin brand and inquiry_type(customer type) are preserved.';

do $postcheck$
declare
  missing_count integer;
  technical_count integer;
begin
  select count(*) into missing_count
  from public.inquiries
  where business_type is null
     or business_type not in ('견적문의', '기술자문');
  if missing_count <> 0 then
    raise exception 'business_type backfill failed: % invalid rows', missing_count;
  end if;

  select count(*) into technical_count
  from public.inquiries
  where id in (
    '7beba9d3-996c-4035-899b-0dea7f1e4e52'::uuid,
    'ae0e7dc9-094f-415f-bfe3-f93d454cd0ed'::uuid,
    'cb75ebfd-7c5d-4013-b715-17c6c6bf650e'::uuid
  )
    and business_type = '기술자문';
  if technical_count <> 3 then
    raise exception 'reviewed technical inquiry backfill failed: expected 3, got %', technical_count;
  end if;

  if position('v_business_type text;' in pg_get_functiondef('public.crm_inquiry_ingest_v1(jsonb)'::regprocedure)) = 0 then
    raise exception 'business_type ingest patch missing';
  end if;
end
$postcheck$;
