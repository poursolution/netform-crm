-- Staging rollback. Refuse rollback after any human review decision exists.
begin;
do $$
begin
 if current_database() is null then raise exception 'database identity unavailable'; end if;
 if exists(select 1 from crm_security.site_identity_links) then
  raise exception 'rollback blocked: site link review decisions exist';
 end if;
end $$;
drop function if exists public.crm_site_link_review_resolve_v1(uuid,text,uuid);
drop function if exists public.crm_site_link_review_list_v1(integer);
drop function if exists public.crm_site_linked_history_v1(uuid);
drop function if exists public.crm_site_linked_assets_v1();
drop function if exists crm_security.site_link_review_resolve_v1(uuid,text,uuid);
drop function if exists crm_security.site_link_review_list_v1(integer);
drop function if exists crm_security.site_linked_history_v1(uuid);
drop function if exists crm_security.site_linked_assets_v1();
drop table if exists crm_security.site_identity_links;
drop index if exists public.sites_norm_name_idx;
create unique index if not exists uq_sites_norm on public.sites(norm_name);
commit;
