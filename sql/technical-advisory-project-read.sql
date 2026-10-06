-- Source project observations are readable without a contract document.
-- This is not a contract/performance reader and never creates a Deal or sales event.
create or replace function public.crm_advisory_project_read_v1(
 p_after text default null, p_deal_id uuid default null
) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb; actor_id uuid; actor_role text;
begin
 select a.user_id,a.permission_role into actor_id,actor_role from crm_security.actor() a;
 if actor_id is null then raise exception 'forbidden' using errcode='42501'; end if;
 if p_after is not null and (length(p_after)>256 or p_after ~ '[[:cntrl:]]') then
  raise exception 'INVALID_CURSOR' using errcode='22023';
 end if;
 if p_deal_id is not null and not coalesce(crm_security.can_deal(p_deal_id,false),false) then
  raise exception 'forbidden' using errcode='42501';
 end if;
 with permitted as (
  select b.project_id,b.revision,b.snapshot,b.received_at
  from crm_security.advisory_project_snapshots b
  where (p_after is null or b.project_id>p_after)
   and (p_deal_id is null or exists(
    select 1 from crm_security.advisory_deal_links l
    where l.project_id=b.project_id and l.deal_id=p_deal_id))
   and (actor_role='admin' or exists(
    select 1 from crm_security.advisory_deal_links l
    where l.project_id=b.project_id and crm_security.can_deal(l.deal_id,false)
   ) or exists(
    select 1 from crm_security.advisory_record_links l
    join public.advisory_deals a on a.advisory_id=l.advisory_id
    join crm_security.advisory_read_grants g on g.advisory_id=a.advisory_id
    where l.project_id=b.project_id and g.user_id=actor_id and g.expires_at>now()
   ))
  order by b.project_id limit 21
 ), page as (select * from permitted order by project_id limit 20)
 select jsonb_build_object('ok',true,'items',coalesce((
  select jsonb_agg(jsonb_build_object(
   'source_project_id',p.project_id,'revision',p.revision::text,'received_at',p.received_at,
   'site_name',p.snapshot->'site_name','work_name',p.snapshot->'work_name',
   'company_name',p.snapshot->'company_name','current_source_manager',p.snapshot->'current_source_manager',
   'source_project_status',p.snapshot->'source_project_status',
   'source_contract_document_type',p.snapshot->'source_contract_document_type',
   'source_printed_contract_date',p.snapshot->'source_printed_contract_date',
   'source_consulting_contract_amount',p.snapshot->'source_consulting_contract_amount',
   'operations',jsonb_build_object(
    'schema_version',p.snapshot#>'{operations,schema_version}',
    'source_status',p.snapshot#>'{operations,source_status}',
    'completed',p.snapshot#>'{operations,completed}',
    'progress_rate',p.snapshot#>'{operations,progress_rate}',
    'start_date',p.snapshot#>'{operations,start_date}',
    'completion_date',p.snapshot#>'{operations,completion_date}'
   )
  ) order by p.project_id) from page p),'[]'::jsonb),
  'next_cursor',case when (select count(*) from permitted)>20
   then (select project_id from page order by project_id desc limit 1) else null end
 ) into result;
 return result;
end $$;
revoke all on function public.crm_advisory_project_read_v1(text,uuid) from public,anon;
grant execute on function public.crm_advisory_project_read_v1(text,uuid) to authenticated;