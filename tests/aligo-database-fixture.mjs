export const fixture=`
create role anon; create role authenticated; create role service_role;
create schema auth; create schema crm_security;
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
create table public.users(user_id uuid primary key,auth_uid uuid,name text,role text,active boolean);
create table crm_security.access_review(user_id uuid,reviewed_auth_uid uuid,permission_role text,source_role text,approved boolean,expires_at timestamptz);
create table public.contacts(id uuid primary key,person_key text,mobile text,phone text);
create table public.deals(id uuid primary key,organization_id uuid,contact_id uuid,person_key text);
create table public.contact_assignments(person_key text,opportunity_id uuid,status text,ended_at date);
create table crm_security.contact_compat_state(contact_id uuid,deal_id uuid,sms_consent boolean,consent_at timestamptz,send_blocked boolean,opt_out_at timestamptz,primary key(contact_id,deal_id));
create table crm_security.command_receipts(actor_auth_uid uuid,request_id uuid,actor_user_id uuid,operation text,object_id uuid,expected_version integer,payload jsonb,ack jsonb,created_at timestamptz,constraint command_receipts_operation_check check(operation in ('relationship_contact','contact_upsert')),primary key(actor_auth_uid,request_id));
create table public.activities(id uuid default gen_random_uuid(),deal_id uuid,organization_id uuid,actor_name text,type text,detail jsonb,occurred_at timestamptz);
create function crm_security.actor() returns table(user_id uuid,auth_uid uuid,display_name text,permission_role text) language sql stable security definer set search_path='' as $$
 select u.user_id,u.auth_uid,u.name,r.permission_role from public.users u join crm_security.access_review r on r.user_id=u.user_id
 where u.auth_uid=auth.uid() and u.active and r.approved and r.reviewed_auth_uid=u.auth_uid and r.source_role=u.role and r.expires_at>now()
 and (select count(*) from public.users x where x.auth_uid=u.auth_uid)=1 $$;
create function crm_security.can_deal(uuid,boolean) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from crm_security.actor() a where a.permission_role='admin') $$;
create function public.crm_write_command_v2(uuid,text,uuid,integer,jsonb) returns jsonb language sql as $$ select '{"delegated":true}'::jsonb $$;
create function public.crm_operational_source_v1(text,uuid,integer) returns jsonb language sql as $$ select '{"delegated":true}'::jsonb $$;
grant usage on schema public,auth to authenticated,service_role;
`;
