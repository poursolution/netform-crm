-- UUID AUTHORIZATION V1: LOCAL / ISOLATED STAGING CANDIDATE ONLY.
-- No automatic name/email matching. Existing customer ownership is left NULL.
-- Requires reviewed base schema: auth.users(id uuid), deals(id uuid), inquiries(id uuid).
-- Apply this BEFORE the UUID reader/export, then snapshot + exact ACL hardening.
begin;
do $$
declare t text;
begin
 foreach t in array array['auth.users','public.deals','public.inquiries'] loop
  if not exists(select 1 from pg_attribute where attrelid=to_regclass(t) and attname='id' and atttypid='uuid'::regtype and not attisdropped) then
   raise exception 'Expected UUID id contract missing: %',t;
  end if;
 end loop;
 -- Do not adopt unrelated objects with these security-sensitive names.
 if to_regclass('crm_private.uuid_v1_marker') is null and (
  to_regclass('public.crm_users') is not null or to_regclass('public.crm_teams') is not null or
  to_regclass('public.crm_sales_people') is not null or
  exists(select 1 from pg_attribute where attrelid in (to_regclass('public.deals'),to_regclass('public.inquiries')) and attname in ('assignee_user_id','crm_team_id') and not attisdropped)
 ) then raise exception 'Existing identity schema requires separate review';end if;
end $$;
create schema if not exists crm_private;
revoke all on schema crm_private from public,anon;
create table if not exists public.crm_teams (
 team_id uuid primary key, display_name text not null
);
create table if not exists public.crm_sales_people (
 sales_person_id uuid primary key, display_name text not null
);
create table if not exists public.crm_users (
 user_id uuid primary key references auth.users(id) on delete restrict,
 display_name text not null,
 role text not null check(role in ('rep','consultation','branch_rep','manager','admin')),
 team_id uuid not null references public.crm_teams(team_id),
 sales_person_id uuid unique references public.crm_sales_people(sales_person_id),
 active boolean not null default false,
 unique(user_id,team_id),
 check(role not in ('rep','branch_rep') or sales_person_id is not null)
);
create table if not exists crm_private.uuid_v1_marker (
 version integer primary key check(version=1), applied_by text not null
);
create table if not exists crm_private.identity_review (
 target_table text not null check(target_table in ('deals','inquiries')),
 target_id uuid not null, observed_legacy_name text,
 status text not null default 'manual_review' check(status in ('manual_review','resolved')),
 resolved_user_id uuid references public.crm_users(user_id),
 evidence text, reviewed_at timestamptz, primary key(target_table,target_id)
);
alter table public.deals add column if not exists assignee_user_id uuid;
alter table public.deals add column if not exists crm_team_id uuid;
alter table public.inquiries add column if not exists assignee_user_id uuid;
alter table public.inquiries add column if not exists crm_team_id uuid;
do $$
declare t text;
begin
 foreach t in array array['deals','inquiries'] loop
  if not exists(select 1 from pg_constraint where conrelid=('public.'||t)::regclass and conname=t||'_crm_uuid_owner_fk') then
   execute format('alter table public.%I add constraint %I foreign key(assignee_user_id,crm_team_id) references public.crm_users(user_id,team_id)',t,t||'_crm_uuid_owner_fk');
   execute format('alter table public.%I add constraint %I check((assignee_user_id is null)=(crm_team_id is null))',t,t||'_crm_uuid_owner_pair');
  end if;
 end loop;
end $$;
-- Legacy names are evidence for HUMAN review only; never used in any predicate.
insert into crm_private.identity_review(target_table,target_id,observed_legacy_name)
 select 'deals',d.id,coalesce(to_jsonb(d)->>'assignee',to_jsonb(d)->>'assigned_to') from public.deals d where d.assignee_user_id is null
 on conflict(target_table,target_id) do nothing;
insert into crm_private.identity_review(target_table,target_id,observed_legacy_name)
 select 'inquiries',i.id,coalesce(to_jsonb(i)->>'assigned_to',to_jsonb(i)->>'assignee') from public.inquiries i where i.assignee_user_id is null
 on conflict(target_table,target_id) do nothing;

create or replace function crm_private.uuid_actor() returns public.crm_users
language plpgsql stable security definer set search_path='' as $$
declare actor public.crm_users;
begin
 if auth.uid() is null then raise exception 'Authentication required' using errcode='42501';end if;
 select * into strict actor from public.crm_users u where u.user_id=auth.uid() and u.active;
 return actor;
exception when no_data_found or too_many_rows then
 raise exception 'Active UUID membership required' using errcode='42501';
end $$;
create or replace function crm_private.uuid_can_read_deal(owner_id uuid,team uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select owner_id is not null and team is not null and exists(
  select 1 from public.crm_users u where u.user_id=auth.uid() and u.active
   and (u.role='admin' or (u.team_id=team and (
    u.role='manager' or (u.role in ('rep','branch_rep') and owner_id=u.user_id)
   )))
 );
$$;
create or replace function crm_private.uuid_can_read_inquiry(owner_id uuid,team uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select owner_id is not null and team is not null and exists(
  select 1 from public.crm_users u where u.user_id=auth.uid() and u.active
   and (u.role='admin' or (u.team_id=team and (
    u.role='manager' or (u.role in ('rep','branch_rep','consultation') and owner_id=u.user_id)
   )))
 );
$$;
create or replace function crm_private.uuid_identity_immutable() returns trigger
language plpgsql set search_path='' as $$
begin
 if new.user_id is distinct from old.user_id or
  (old.sales_person_id is not null and new.sales_person_id is distinct from old.sales_person_id)
 then raise exception 'Immutable identity cannot be reassigned' using errcode='42501';end if;
 return new;
end $$;
drop trigger if exists crm_uuid_identity_immutable on public.crm_users;
create trigger crm_uuid_identity_immutable before update on public.crm_users for each row execute function crm_private.uuid_identity_immutable();

revoke all on function crm_private.uuid_actor(),crm_private.uuid_can_read_deal(uuid,uuid),
 crm_private.uuid_can_read_inquiry(uuid,uuid),crm_private.uuid_identity_immutable() from public,anon,authenticated;
grant usage on schema crm_private to authenticated;
grant execute on function crm_private.uuid_actor(),crm_private.uuid_can_read_deal(uuid,uuid),
 crm_private.uuid_can_read_inquiry(uuid,uuid) to authenticated;
-- Direct client writes, including changing owner/team, are never granted.
revoke all on public.crm_users,public.crm_teams,public.crm_sales_people,public.deals,public.inquiries from public,anon,authenticated;
revoke all on crm_private.identity_review,crm_private.uuid_v1_marker from public,anon,authenticated,service_role;
grant select on public.crm_users,public.deals to authenticated;
-- No direct inquiry table SELECT: consultation must not receive finance fields.
-- Its reader uses a fixed projection. RLS below is an additional safeguard.
alter table public.crm_users enable row level security;
alter table public.crm_teams enable row level security;
alter table public.crm_sales_people enable row level security;
alter table public.deals enable row level security;
alter table public.inquiries enable row level security;
alter table crm_private.identity_review enable row level security;
alter table crm_private.uuid_v1_marker enable row level security;
drop policy if exists crm_uuid_self on public.crm_users;
create policy crm_uuid_self on public.crm_users for select to authenticated using(user_id=auth.uid() and active);
drop policy if exists crm_uuid_users_gate on public.crm_users;
create policy crm_uuid_users_gate on public.crm_users as restrictive for all to public
 using(user_id=auth.uid() and active) with check(false);
drop policy if exists crm_uuid_users_no_delete on public.crm_users;
create policy crm_uuid_users_no_delete on public.crm_users as restrictive for delete to public using(false);
-- Restrictive policies AND with any old permissive policy; old policies cannot widen access.
drop policy if exists crm_uuid_deals_gate on public.deals;
drop policy if exists crm_uuid_deals_read on public.deals;
create policy crm_uuid_deals_gate on public.deals as restrictive for all to public
 using(crm_private.uuid_can_read_deal(assignee_user_id,crm_team_id)) with check(false);
create policy crm_uuid_deals_read on public.deals for select to authenticated
 using(crm_private.uuid_can_read_deal(assignee_user_id,crm_team_id));
drop policy if exists crm_uuid_inquiries_gate on public.inquiries;
drop policy if exists crm_uuid_inquiries_read on public.inquiries;
create policy crm_uuid_inquiries_gate on public.inquiries as restrictive for all to public
 -- Consultation uses ONLY the definer reader's fixed projection. Even inherited
 -- column SELECT must not reveal inquiry finance fields to consultation staff.
 using(crm_private.uuid_can_read_deal(assignee_user_id,crm_team_id)) with check(false);
create policy crm_uuid_inquiries_read on public.inquiries for select to authenticated
 using(crm_private.uuid_can_read_inquiry(assignee_user_id,crm_team_id));
-- Delete also needs denial if a legacy column/table grant is inherited.
drop policy if exists crm_uuid_deals_no_delete on public.deals;
create policy crm_uuid_deals_no_delete on public.deals as restrictive for delete to public using(false);
drop policy if exists crm_uuid_inquiries_no_delete on public.inquiries;
create policy crm_uuid_inquiries_no_delete on public.inquiries as restrictive for delete to public using(false);
insert into crm_private.uuid_v1_marker(version,applied_by) values(1,current_user) on conflict(version) do nothing;
commit;
