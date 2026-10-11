// Synthetic schema sufficient to execute the captured production go handler.
// No network, production rows or production credentials.
export const fixture = `
create role anon; create role authenticated; create role service_role;
create schema auth; create schema crm_security;
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
create table public.users(user_id uuid primary key,auth_uid uuid unique,name text,role text,active boolean);
create table public.deals(id uuid primary key,organization_id uuid,owner_id uuid,assignee_name text,
  contact_id uuid,person_key text,manager_name text,manager_mobile text,manager_role text,manager_current_site text,manager_status text,manager_left_at date,
  office_phone text,office_email text,stage_code text,amount numeric,next_action text,next_action_date date,version integer not null default 1,updated_at timestamptz);
create table public.inquiries(id uuid primary key,assigned_to uuid,assignee_name text,assigned_at timestamptz,status text,updated_at timestamptz);
create table public.contacts(id uuid primary key default gen_random_uuid(),organization_id uuid,name text,title text,phone text,emails jsonb,person_key text unique,mobile text,role text,current_site text,created_at timestamptz,updated_at timestamptz);
create table public.contact_assignments(id uuid primary key default gen_random_uuid(),person_key text references public.contacts(person_key),opportunity_id uuid,site_name text not null,office_phone text,started_at date not null,ended_at date,status text,reason text);
create unique index contact_assign_open on public.contact_assignments(person_key,site_name) where ended_at is null;
create table crm_security.contact_compat_state(contact_id uuid references public.contacts(id),deal_id uuid references public.deals(id),decision_role text,relationship_tone text,
  sms_consent boolean not null default false,kakao_consent boolean not null default false,consent_at timestamptz,opt_out_at timestamptz,
  send_blocked boolean not null default false,send_blocked_reason text,updated_by_auth_uid uuid not null,updated_by_user_id uuid not null,updated_at timestamptz not null default now(),
  primary key(contact_id,deal_id),check(not send_blocked or (not sms_consent and not kakao_consent)));
create table crm_security.command_receipts(actor_auth_uid uuid,request_id uuid,actor_user_id uuid,operation text,object_id uuid,expected_version integer,payload jsonb,ack jsonb,created_at timestamptz,primary key(actor_auth_uid,request_id));
create table crm_security.audit_events(event_id uuid primary key default gen_random_uuid(),actor_auth_uid uuid,actor_user_id uuid,actor_name text,deal_id uuid,action text,before_data jsonb,after_data jsonb,reason text,created_at timestamptz);
create table public.activities(id uuid default gen_random_uuid(),deal_id uuid,organization_id uuid,actor_name text,type text,detail jsonb,occurred_at timestamptz);
create table public.assignment_history(id uuid default gen_random_uuid(),opportunity_id uuid,inquiry_id uuid,from_owner text,to_owner text,reason text,actor_name text,changed_at timestamptz);
create function crm_security.actor() returns table(user_id uuid,auth_uid uuid,display_name text,permission_role text) language sql stable security definer set search_path='' as $$
  select u.user_id,u.auth_uid,u.name,u.role from public.users u where u.auth_uid=auth.uid() and u.active $$;
create function crm_security.can_deal(target uuid,writing boolean) returns boolean language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.deals d cross join crm_security.actor() a where d.id=target and (d.owner_id=a.user_id or a.permission_role='admin')) $$;
grant usage on schema public,auth to authenticated,anon;
`;
