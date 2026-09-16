begin;
do $$ begin
 if exists(select 1 from crm_security.site_record_link_decisions) then raise exception 'rollback blocked: Site record review decisions exist'; end if;
end $$;
drop function if exists public.crm_site_record_link_review_resolve_v1(text,uuid,text,uuid);
drop function if exists public.crm_site_record_link_review_list_v1(integer);
drop function if exists crm_security.site_record_link_review_resolve_v1(text,uuid,text,uuid);
drop function if exists crm_security.site_record_link_review_list_v1(integer);
drop table if exists crm_security.site_record_link_decisions;
commit;
