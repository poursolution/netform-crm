-- Enrich only activity IDs already returned for an authorized Deal.
-- Apply in a transaction after inspecting the current production definition.
begin;
set local lock_timeout='3s';
set local statement_timeout='60s';

create function crm_security.crm_activity_content_enrich_v1(p_page jsonb)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare enriched jsonb;
begin
 if not exists(select 1 from crm_security.actor()) then
  raise exception 'forbidden' using errcode='42501';
 end if;
 if jsonb_typeof(p_page->'items') is distinct from 'array' then
  raise exception 'activity read contract drift' using errcode='22023';
 end if;
 select coalesce(jsonb_agg(
  case when crm_security.can_deal((d.item->>'id')::uuid,false) then
   jsonb_set(d.item,'{activity_signals}',coalesce((
    select jsonb_agg(s.item || case when ac.id is null then '{}'::jsonb else
     jsonb_build_object(
      'actor_name',ac.actor_name,
      'note',case when jsonb_typeof(ac.detail)='object' and jsonb_typeof(ac.detail->'note')='string' then ac.detail->>'note'
                  when jsonb_typeof(ac.detail)='string' then ac.detail #>> '{}' else '' end,
      'result',case when jsonb_typeof(ac.detail)='object' and jsonb_typeof(ac.detail->'result')='string' then ac.detail->>'result' else '' end)
     end order by s.ord)
    from jsonb_array_elements(coalesce(d.item->'activity_signals','[]'::jsonb)) with ordinality s(item,ord)
    left join public.activities ac on ac.id=(s.item->>'id')::uuid and ac.deal_id=(d.item->>'id')::uuid
   ),'[]'::jsonb))
  else d.item end order by d.ord),'[]'::jsonb)
 into enriched from jsonb_array_elements(p_page->'items') with ordinality d(item,ord);
 return jsonb_set(p_page,'{items}',enriched);
end $$;
revoke all on function crm_security.crm_activity_content_enrich_v1(jsonb) from public,anon,authenticated,service_role;

do $patch$
declare fn oid; before_row record; after_row record; definition text;
 old_call constant text := 'return crm_security.crm_operational_source_v1_pre_aligo_20260919(p_domain,p_after,p_limit);';
 new_call constant text := 'return case when p_domain=''deal_core'' then crm_security.crm_activity_content_enrich_v1(crm_security.crm_operational_source_v1_pre_aligo_20260919(p_domain,p_after,p_limit)) else crm_security.crm_operational_source_v1_pre_aligo_20260919(p_domain,p_after,p_limit) end;';
begin
 fn:=to_regprocedure('public.crm_operational_source_v1(text,uuid,integer)');
 if fn is null then raise exception 'operational read prerequisite missing'; end if;
 select * into before_row from pg_proc where oid=fn;
 definition:=pg_get_functiondef(fn);
 if (length(definition)-length(replace(definition,old_call,'')))/length(old_call)<>1
    or not before_row.prosecdef or before_row.provolatile<>'s' then
  raise exception 'operational read definition drift';
 end if;
 execute replace(definition,old_call,new_call);
 select * into after_row from pg_proc where oid=fn;
 if after_row.proacl is distinct from before_row.proacl
    or after_row.proconfig is distinct from before_row.proconfig
    or after_row.proowner is distinct from before_row.proowner then
  raise exception 'operational read security drift';
 end if;
end $patch$;
commit;
