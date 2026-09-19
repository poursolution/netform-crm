begin;
set local lock_timeout='3s';
do $patch$
declare fn oid; definition text;
 old_call constant text := 'return crm_security.crm_operational_source_v1_pre_aligo_20260919(p_domain,p_after,p_limit);';
 new_call constant text := 'return case when p_domain=''deal_core'' then crm_security.crm_activity_content_enrich_v1(crm_security.crm_operational_source_v1_pre_aligo_20260919(p_domain,p_after,p_limit)) else crm_security.crm_operational_source_v1_pre_aligo_20260919(p_domain,p_after,p_limit) end;';
begin
 fn:=to_regprocedure('public.crm_operational_source_v1(text,uuid,integer)');
 if fn is null then raise exception 'operational read prerequisite missing'; end if;
 definition:=pg_get_functiondef(fn);
 if (length(definition)-length(replace(definition,new_call,'')))/length(new_call)<>1 then
  raise exception 'activity rollback definition drift';
 end if;
 execute replace(definition,new_call,old_call);
end $patch$;
drop function crm_security.crm_activity_content_enrich_v1(jsonb);
commit;
