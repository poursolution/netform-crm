create table if not exists crm_security.site_master_change_events (
 event_id uuid primary key default gen_random_uuid(),site_id uuid not null references public.sites(site_id) on delete restrict,
 field_name text not null check(field_name in ('address')),previous_value text,new_value text not null,
 reason text not null check(pg_catalog.length(pg_catalog.btrim(reason))>=5),changed_by uuid not null,changed_at timestamptz not null default statement_timestamp()
);
alter table crm_security.site_master_change_events enable row level security;
revoke all on table crm_security.site_master_change_events from public,anon,authenticated;

create or replace function crm_security.site_address_update_v1(p_site uuid,p_address text,p_reason text)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare actor_id uuid:=(select auth.uid()); clean_address text:=nullif(pg_catalog.btrim(p_address),'');clean_reason text:=pg_catalog.btrim(coalesce(p_reason,''));old_address text;
begin
 if actor_id is null or not exists(select 1 from crm_security.actor() a where a.permission_role='admin') then raise exception 'forbidden' using errcode='42501'; end if;
 if clean_address is null or pg_catalog.length(clean_address)<5 or pg_catalog.length(clean_reason)<5 then raise exception 'address and reason required' using errcode='22023'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('site-address:'||p_site::text,60919));
 select s.address into old_address from public.sites s where s.site_id=p_site for update;if not found then raise exception 'site not found' using errcode='P0002'; end if;
 if coalesce(pg_catalog.btrim(old_address),'')=clean_address then raise exception 'same address' using errcode='22023'; end if;
 insert into crm_security.site_master_change_events(site_id,field_name,previous_value,new_value,reason,changed_by) values(p_site,'address',old_address,clean_address,clean_reason,actor_id);
 update public.sites set address=clean_address where site_id=p_site;
 return jsonb_build_object('ok',true,'site_id',p_site,'previous_address',old_address,'address',clean_address);
end $$;
revoke all on function crm_security.site_address_update_v1(uuid,text,text) from public,anon,authenticated;
grant execute on function crm_security.site_address_update_v1(uuid,text,text) to authenticated;
create or replace function public.crm_site_address_update_v1(p_site uuid,p_address text,p_reason text) returns jsonb language sql volatile security invoker set search_path='' return crm_security.site_address_update_v1(p_site,p_address,p_reason);
revoke all on function public.crm_site_address_update_v1(uuid,text,text) from public,anon,authenticated;
grant execute on function public.crm_site_address_update_v1(uuid,text,text) to authenticated;
