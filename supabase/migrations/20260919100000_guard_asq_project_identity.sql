-- Prevent a second ASQ project from replacing the project already linked to
-- a CRM opportunity. The conditional conflict update also closes the race
-- where two workers pass the precheck concurrently.

create or replace function public.crm_asq_project_sync(p jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  opportunity_id_value uuid;
  project_id_value text;
  write_id_value text;
  saved public.crm_asq_project_links%rowtype;
begin
  if jsonb_typeof(p) is distinct from 'object'
     or exists (
       select 1 from jsonb_object_keys(p) key
       where key not in (
         'opportunity_id','site_id','asq_project_id','project_url','service_type','project_status',
         'supervisor_name','contract_amount','contract_signed_at','contract_started_at','contract_ended_at',
         'construction_started_at','expected_completion_at','last_supervision_at','next_visit_at',
         'report_status','source_updated_at','raw_payload','write_id'
       )
     ) then
    raise exception 'invalid ASQ payload' using errcode='22023';
  end if;

  begin
    opportunity_id_value := nullif(p->>'opportunity_id','')::uuid;
  exception when others then
    raise exception 'invalid ASQ opportunity' using errcode='22023';
  end;
  project_id_value := nullif(btrim(p->>'asq_project_id'),'');
  write_id_value := nullif(btrim(p->>'write_id'),'');

  if opportunity_id_value is null or project_id_value is null
     or length(project_id_value)>200 or length(coalesce(write_id_value,''))>200
     or (nullif(p->>'project_url','') is not null and p->>'project_url' !~ '^https://') then
    raise exception 'invalid ASQ identity' using errcode='22023';
  end if;
  if not exists(select 1 from public.deals d where d.id=opportunity_id_value) then
    raise exception 'CRM opportunity not found' using errcode='23503';
  end if;

  if write_id_value is not null then
    select * into saved from public.crm_asq_project_links where write_id=write_id_value;
    if found then
      if saved.opportunity_id is distinct from opportunity_id_value
         or saved.asq_project_id is distinct from project_id_value then
        raise exception 'ASQ write id mismatch' using errcode='23505';
      end if;
      return jsonb_build_object('ok',true,'duplicate',true,'opportunity_id',saved.opportunity_id,
        'asq_project_id',saved.asq_project_id,'synced_at',saved.synced_at);
    end if;
  end if;
  if exists(select 1 from public.crm_asq_project_links where asq_project_id=project_id_value
            and opportunity_id<>opportunity_id_value) then
    raise exception 'ASQ project already linked to another opportunity' using errcode='23505';
  end if;
  if exists(select 1 from public.crm_asq_project_links where opportunity_id=opportunity_id_value
            and asq_project_id<>project_id_value) then
    raise exception 'CRM opportunity already linked to another ASQ project' using errcode='23505';
  end if;

  insert into public.crm_asq_project_links (
    opportunity_id,site_id,asq_project_id,project_url,service_type,project_status,
    supervisor_name,contract_amount,contract_signed_at,contract_started_at,contract_ended_at,
    construction_started_at,expected_completion_at,last_supervision_at,next_visit_at,
    report_status,source_updated_at,synced_at,raw_payload,write_id,updated_at
  ) values (
    opportunity_id_value,nullif(p->>'site_id',''),project_id_value,nullif(p->>'project_url',''),
    nullif(p->>'service_type',''),nullif(p->>'project_status',''),nullif(p->>'supervisor_name',''),
    nullif(p->>'contract_amount','')::numeric,nullif(p->>'contract_signed_at','')::date,
    nullif(p->>'contract_started_at','')::date,nullif(p->>'contract_ended_at','')::date,
    nullif(p->>'construction_started_at','')::date,nullif(p->>'expected_completion_at','')::date,
    nullif(p->>'last_supervision_at','')::timestamptz,nullif(p->>'next_visit_at','')::timestamptz,
    nullif(p->>'report_status',''),nullif(p->>'source_updated_at','')::timestamptz,
    clock_timestamp(),coalesce(p->'raw_payload',p),write_id_value,clock_timestamp()
  )
  on conflict (opportunity_id) do update set
    site_id=excluded.site_id,asq_project_id=excluded.asq_project_id,project_url=excluded.project_url,
    service_type=excluded.service_type,project_status=excluded.project_status,
    supervisor_name=excluded.supervisor_name,contract_amount=excluded.contract_amount,
    contract_signed_at=excluded.contract_signed_at,contract_started_at=excluded.contract_started_at,
    contract_ended_at=excluded.contract_ended_at,construction_started_at=excluded.construction_started_at,
    expected_completion_at=excluded.expected_completion_at,last_supervision_at=excluded.last_supervision_at,
    next_visit_at=excluded.next_visit_at,report_status=excluded.report_status,
    source_updated_at=excluded.source_updated_at,synced_at=clock_timestamp(),
    raw_payload=excluded.raw_payload,write_id=excluded.write_id,updated_at=clock_timestamp()
  where public.crm_asq_project_links.asq_project_id=excluded.asq_project_id
  returning * into saved;

  if not found then
    raise exception 'CRM opportunity already linked to another ASQ project' using errcode='23505';
  end if;

  return jsonb_build_object('ok',true,'duplicate',false,'opportunity_id',saved.opportunity_id,
    'asq_project_id',saved.asq_project_id,'synced_at',saved.synced_at);
end $$;

revoke all on function public.crm_asq_project_sync(jsonb) from public, anon, authenticated;
grant execute on function public.crm_asq_project_sync(jsonb) to service_role;

do $$
begin
  if has_function_privilege('authenticated','public.crm_asq_project_sync(jsonb)','execute')
     or not has_function_privilege('service_role','public.crm_asq_project_sync(jsonb)','execute') then
    raise exception 'ASQ identity guard privilege postcondition failed';
  end if;
end $$;
