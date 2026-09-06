-- LOCAL MODEL ONLY: correctly typed subset of measured schema, NOT a full clone.
-- Auth uid is a simulated database session claim; no real Supabase JWT validation.
CREATE ROLE anon;
CREATE ROLE authenticated;
CREATE ROLE service_role BYPASSRLS;
CREATE SCHEMA auth;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$
 SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid
$$;
CREATE TABLE public.users(user_id uuid PRIMARY KEY,name text UNIQUE NOT NULL,email text,
 role text NOT NULL DEFAULT 'rep' CHECK(role IN ('rep','admin','dual','viewer')),
 active boolean NOT NULL DEFAULT true,auth_uid uuid);
CREATE INDEX idx_users_auth ON public.users(auth_uid);
CREATE TABLE public.organizations(id uuid PRIMARY KEY,name text NOT NULL);
CREATE TABLE public.contacts(id uuid PRIMARY KEY,organization_id uuid REFERENCES public.organizations(id),
 name text,title text,phone text,mobile text);
CREATE TABLE public.deals(id uuid PRIMARY KEY,owner_id uuid REFERENCES public.users(user_id),
 organization_id uuid REFERENCES public.organizations(id),contact_id uuid REFERENCES public.contacts(id),
 stage_code text,brand text,primary_work text,work_items jsonb NOT NULL DEFAULT '[]',
 work_scope_type text,work_summary text,version integer NOT NULL DEFAULT 1);
CREATE TABLE public.inquiries(id uuid PRIMARY KEY,assigned_to uuid REFERENCES public.users(user_id),
 site_name text,status text,received_at timestamptz);
CREATE TABLE public.audit_logs(event_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 actor_id uuid REFERENCES public.users(user_id),actor_name text,entity_type text NOT NULL,
 entity_id uuid,action text NOT NULL,"before" jsonb,"after" jsonb,created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE public.activities(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),deal_id uuid REFERENCES public.deals(id),
 organization_id uuid REFERENCES public.organizations(id),actor_name text,type text NOT NULL,detail jsonb DEFAULT '{}');
CREATE FUNCTION public.crm_bundle() RETURNS jsonb LANGUAGE sql SECURITY DEFINER AS $$SELECT '{}'::jsonb$$;
REVOKE ALL ON FUNCTION public.crm_bundle() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.crm_bundle() TO service_role;
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM PUBLIC,anon,authenticated;
ALTER TABLE public.deals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inquiries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
