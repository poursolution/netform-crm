-- PostgreSQL does not provide max(uuid). Derive the page cursor from the
-- final ordered JSON item while preserving the ASQ authorization boundary.

create or replace function public.crm_operational_source_v1(
  p_domain text,
  p_after uuid default null,
  p_limit integer default 100
) returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  items jsonb;
  next_cursor uuid;
  more boolean := false;
begin
  if p_limit not between 1 and 100 then
    raise exception 'invalid limit' using errcode='22023';
  end if;
  if p_domain<>'asq_project' then
    return crm_security.crm_operational_source_v1_pre_asq_20260919(p_domain,p_after,p_limit);
  end if;
  if not exists(select 1 from crm_security.actor()) then
    raise exception 'forbidden' using errcode='42501';
  end if;

  select coalesce(jsonb_agg(to_jsonb(x) order by x.id),'[]'::jsonb)
    into items
  from (
    select l.id,l.opportunity_id,l.site_id,l.asq_project_id,l.project_url,l.service_type,
      l.project_status,l.supervisor_name,l.contract_amount,l.contract_signed_at,
      l.contract_started_at,l.contract_ended_at,l.construction_started_at,
      l.expected_completion_at,l.last_supervision_at,l.next_visit_at,l.report_status,
      l.source_updated_at,l.synced_at,l.updated_at
    from public.crm_asq_project_links l
    where crm_security.can_deal(l.opportunity_id,false)
      and (p_after is null or l.id>p_after)
    order by l.id
    limit p_limit
  ) x;
  next_cursor := nullif(items->-1->>'id','')::uuid;

  if next_cursor is not null then
    select exists(
      select 1 from public.crm_asq_project_links l
      where crm_security.can_deal(l.opportunity_id,false) and l.id>next_cursor
    ) into more;
  end if;

  return jsonb_build_object(
    'contract_version',1,'resource','operational_source','domain',p_domain,
    'scope_completeness','actor_authorized_rows_only','items',items,
    'pagination',jsonb_build_object('completeness',case when more then 'partial' else 'complete' end,
      'has_more',more,'next_cursor',case when more then next_cursor::text else null end)
  );
end $$;

revoke all on function public.crm_operational_source_v1(text,uuid,integer) from public, anon;
grant execute on function public.crm_operational_source_v1(text,uuid,integer) to authenticated;

do $$
begin
  if has_function_privilege('anon','public.crm_operational_source_v1(text,uuid,integer)','execute')
     or not has_function_privilege('authenticated','public.crm_operational_source_v1(text,uuid,integer)','execute') then
    raise exception 'ASQ cursor fix privilege postcondition failed';
  end if;
end $$;
