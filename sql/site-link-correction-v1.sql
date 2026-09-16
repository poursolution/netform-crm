-- Explicit admin-only correction path for reviewed Site links.
-- Every correction keeps the previous Site, new Site, actor and reason.
create table if not exists crm_security.site_link_correction_events (
 event_id uuid primary key default gen_random_uuid(),
 target_type text not null check(target_type in ('organization','deal','inquiry')),
 target_id uuid not null,
 previous_site_id uuid not null references public.sites(site_id) on delete restrict,
 new_site_id uuid not null references public.sites(site_id) on delete restrict,
 reason text not null check(pg_catalog.length(pg_catalog.btrim(reason))>=5),
 changed_by uuid not null,
 changed_at timestamptz not null default statement_timestamp(),
 check(previous_site_id<>new_site_id)
);
alter table crm_security.site_link_correction_events enable row level security;
revoke all on table crm_security.site_link_correction_events from public,anon,authenticated;

create or replace function crm_security.site_identity_relink_v1(p_organization uuid,p_site uuid,p_reason text)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare actor_id uuid:=(select auth.uid()); old_link record; clean_reason text:=pg_catalog.btrim(coalesce(p_reason,''));
begin
 if actor_id is null or not exists(select 1 from crm_security.actor() a where a.permission_role='admin') then raise exception 'forbidden' using errcode='42501'; end if;
 if pg_catalog.length(clean_reason)<5 then raise exception 'correction reason required' using errcode='22023'; end if;
 if not exists(select 1 from public.sites s where s.site_id=p_site) then raise exception 'site not found' using errcode='P0002'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('organization:'||p_organization::text,60918));
 select * into old_link from crm_security.site_identity_links l where l.organization_id=p_organization for update;
 if not found then raise exception 'reviewed link not found' using errcode='P0002'; end if;
 if old_link.site_id=p_site then raise exception 'same site' using errcode='22023'; end if;
 insert into crm_security.site_link_correction_events(target_type,target_id,previous_site_id,new_site_id,reason,changed_by)
 values('organization',p_organization,old_link.site_id,p_site,clean_reason,actor_id);
 update crm_security.site_identity_links set site_id=p_site,resolution='linked',reviewed_by=actor_id,reviewed_at=statement_timestamp() where organization_id=p_organization;
 return jsonb_build_object('ok',true,'target_type','organization','target_id',p_organization,'previous_site_id',old_link.site_id,'site_id',p_site);
end $$;

create or replace function crm_security.site_record_relink_v1(p_source_type text,p_source_id uuid,p_site uuid,p_reason text)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare actor_id uuid:=(select auth.uid()); old_decision record; clean_reason text:=pg_catalog.btrim(coalesce(p_reason,'')); assigned_site uuid;
begin
 if actor_id is null or not exists(select 1 from crm_security.actor() a where a.permission_role='admin') then raise exception 'forbidden' using errcode='42501'; end if;
 if p_source_type not in ('deal','inquiry') or pg_catalog.length(clean_reason)<5 then raise exception 'invalid correction' using errcode='22023'; end if;
 if not exists(select 1 from public.sites s where s.site_id=p_site) then raise exception 'site not found' using errcode='P0002'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_source_type||':'||p_source_id::text,60918));
 select * into old_decision from crm_security.site_record_link_decisions d where d.source_type=p_source_type and d.source_id=p_source_id for update;
 if not found then raise exception 'reviewed decision not found' using errcode='P0002'; end if;
 if old_decision.site_id=p_site then raise exception 'same site' using errcode='22023'; end if;
 if p_source_type='deal' then select d.site_id into assigned_site from public.deals d where d.id=p_source_id for update;
 else select q.site_id into assigned_site from public.inquiries q where q.id=p_source_id for update; end if;
 if assigned_site is distinct from old_decision.site_id then raise exception 'source link drift' using errcode='40001'; end if;
 insert into crm_security.site_link_correction_events(target_type,target_id,previous_site_id,new_site_id,reason,changed_by)
 values(p_source_type,p_source_id,old_decision.site_id,p_site,clean_reason,actor_id);
 if p_source_type='deal' then update public.deals set site_id=p_site,updated_at=statement_timestamp() where id=p_source_id;
 else update public.inquiries set site_id=p_site,updated_at=statement_timestamp() where id=p_source_id; end if;
 update crm_security.site_record_link_decisions set site_id=p_site,resolution='linked',reviewed_by=actor_id,reviewed_at=statement_timestamp() where source_type=p_source_type and source_id=p_source_id;
 return jsonb_build_object('ok',true,'target_type',p_source_type,'target_id',p_source_id,'previous_site_id',old_decision.site_id,'site_id',p_site);
end $$;

revoke all on function crm_security.site_identity_relink_v1(uuid,uuid,text) from public,anon,authenticated;
revoke all on function crm_security.site_record_relink_v1(text,uuid,uuid,text) from public,anon,authenticated;
grant execute on function crm_security.site_identity_relink_v1(uuid,uuid,text) to authenticated;
grant execute on function crm_security.site_record_relink_v1(text,uuid,uuid,text) to authenticated;
create or replace function public.crm_site_identity_relink_v1(p_organization uuid,p_site uuid,p_reason text) returns jsonb language sql volatile security invoker set search_path='' return crm_security.site_identity_relink_v1(p_organization,p_site,p_reason);
create or replace function public.crm_site_record_relink_v1(p_source_type text,p_source_id uuid,p_site uuid,p_reason text) returns jsonb language sql volatile security invoker set search_path='' return crm_security.site_record_relink_v1(p_source_type,p_source_id,p_site,p_reason);
revoke all on function public.crm_site_identity_relink_v1(uuid,uuid,text) from public,anon,authenticated;
revoke all on function public.crm_site_record_relink_v1(text,uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.crm_site_identity_relink_v1(uuid,uuid,text) to authenticated;
grant execute on function public.crm_site_record_relink_v1(text,uuid,uuid,text) to authenticated;
