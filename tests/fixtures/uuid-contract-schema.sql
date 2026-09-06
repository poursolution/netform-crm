-- PGlite LOCAL UNIT FIXTURE ONLY. NOT the production schema, never deploy to Supabase.
create role anon;create role authenticated;create role service_role bypassrls;
create schema auth;create table auth.users(id uuid primary key);
create function auth.uid() returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
create function auth.jwt() returns jsonb language sql as $$select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;
grant usage on schema auth to authenticated,anon;
create table public.deals(id uuid primary key,site text,assignee text,brand text,stage text,created text);
create table public.inquiries(id uuid primary key,site text,assigned_to text,status text,created text,amount numeric);
alter table public.deals enable row level security;
create policy old_open on public.deals for all to public using(true) with check(true);
create function public.crm_bundle() returns jsonb language sql stable security definer as $$
select jsonb_build_object('generated_at','2026-09-05T00:00:00Z',
'deals',(select coalesce(jsonb_agg(to_jsonb(d)),'[]') from public.deals d),
'inquiries',(select coalesce(jsonb_agg(to_jsonb(i)),'[]') from public.inquiries i),
'globalSecret','must not reach reader')$$;
