-- ORIGINAL INSECURE BASELINE / REVIEW ONLY / NEVER PRODUCTION
-- Source metadata MD5: 9872dac5bc6f60f19fc7c4a5514af0af
-- Exact public structure reconstruction, NOT security hardening and NOT a migration to apply now.
-- No customer/Auth rows, seed, sequence current values, role creation or managed extension installation.
BEGIN;
SET LOCAL lock_timeout='3s';
SET LOCAL statement_timeout='60s';
SET LOCAL standard_conforming_strings=on;
SET LOCAL search_path=public,pg_catalog;
SET LOCAL check_function_bodies=on;
-- BEGIN_APPROVAL_GUARD
DO $approval$
BEGIN
 IF current_setting('crm.baseline_staging_ref',true) IS DISTINCT FROM 'rprechiaglyjaydkmxsu'
 OR current_setting('crm.baseline_only_approved',true) IS DISTINCT FROM 'yes'
 OR current_setting('crm.synthetic_isolation_confirmed',true) IS DISTINCT FROM 'yes' THEN
   RAISE EXCEPTION 'REVIEW ONLY: independent staging approval required';
 END IF;
 -- These attestations do not prove the connection target; the reviewed runner must.
END $approval$;
-- END_APPROVAL_GUARD
-- BEGIN_ENVIRONMENT_GUARD
DO $environment$
BEGIN
 IF current_user<>'postgres' OR current_setting('server_version')<>'17.6' THEN RAISE EXCEPTION 'Expected reviewed postgres / PG17.6 environment'; END IF;
 IF EXISTS(SELECT 1 FROM pg_class WHERE relnamespace='public'::regnamespace AND relkind IN ('r','p','v','m','S','f'))
 OR EXISTS(SELECT 1 FROM pg_proc WHERE pronamespace='public'::regnamespace) THEN RAISE EXCEPTION 'Baseline requires empty public application namespace'; END IF;
 IF to_regprocedure('auth.jwt()') IS NULL THEN RAISE EXCEPTION 'Supabase auth.jwt prerequisite missing'; END IF;
 IF (SELECT pg_get_userbyid(nspowner) FROM pg_namespace WHERE nspname='public')<>'pg_database_owner' THEN RAISE EXCEPTION 'Public schema owner differs'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_database WHERE datname=current_database() AND datlocprovider='i' AND datlocale='en-US'
 AND datcollate='en_US.UTF-8' AND datctype='en_US.UTF-8' AND datcollversion='153.121') THEN RAISE EXCEPTION 'Database collation/ICU drift'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_extension e JOIN pg_namespace n ON n.oid=e.extnamespace WHERE e.extname='pg_stat_statements' AND e.extversion='1.11' AND n.nspname='extensions' AND pg_get_userbyid(e.extowner)='postgres') THEN RAISE EXCEPTION 'Extension prerequisite differs: pg_stat_statements'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_extension e JOIN pg_namespace n ON n.oid=e.extnamespace WHERE e.extname='pgcrypto' AND e.extversion='1.3' AND n.nspname='extensions' AND pg_get_userbyid(e.extowner)='postgres') THEN RAISE EXCEPTION 'Extension prerequisite differs: pgcrypto'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_extension e JOIN pg_namespace n ON n.oid=e.extnamespace WHERE e.extname='plpgsql' AND e.extversion='1.0' AND n.nspname='pg_catalog' AND pg_get_userbyid(e.extowner)='supabase_admin') THEN RAISE EXCEPTION 'Extension prerequisite differs: plpgsql'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_extension e JOIN pg_namespace n ON n.oid=e.extnamespace WHERE e.extname='supabase_vault' AND e.extversion='0.3.1' AND n.nspname='vault' AND pg_get_userbyid(e.extowner)='supabase_admin') THEN RAISE EXCEPTION 'Extension prerequisite differs: supabase_vault'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_extension e JOIN pg_namespace n ON n.oid=e.extnamespace WHERE e.extname='uuid-ossp' AND e.extversion='1.1' AND n.nspname='extensions' AND pg_get_userbyid(e.extowner)='postgres') THEN RAISE EXCEPTION 'Extension prerequisite differs: uuid-ossp'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='pg_database_owner' AND rolcanlogin=false AND rolsuper=false AND rolbypassrls=false AND rolinherit=true) THEN RAISE EXCEPTION 'Creator role prerequisite differs: pg_database_owner'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='postgres' AND rolcanlogin=true AND rolsuper=false AND rolbypassrls=true AND rolinherit=true) THEN RAISE EXCEPTION 'Creator role prerequisite differs: postgres'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='supabase_admin' AND rolcanlogin=true AND rolsuper=true AND rolbypassrls=true AND rolinherit=true) THEN RAISE EXCEPTION 'Creator role prerequisite differs: supabase_admin'; END IF;
END $environment$;
-- END_ENVIRONMENT_GUARD
-- BEGIN_BASELINE_OBJECTS
-- 01: baseline default privileges (existing source defaults, not hardening).
-- Skip already identical defaults. Changes for supabase_admin require its supported
-- authority; if denied the transaction aborts. Never grant yourself membership.


DO $global_defaults$ BEGIN IF EXISTS(SELECT 1 FROM pg_default_acl WHERE defaclnamespace=0) THEN RAISE EXCEPTION 'Global default privilege drift'; END IF; END $global_defaults$;

DO $defaults$ BEGIN
 IF (SELECT array_agg(v ORDER BY v) FROM pg_default_acl d,LATERAL unnest(d.defaclacl::text[]) v WHERE d.defaclrole='postgres'::regrole AND d.defaclnamespace='public'::regnamespace AND d.defaclobjtype='S')
 IS DISTINCT FROM ARRAY['anon=rwU/postgres','authenticated=rwU/postgres','postgres=rwU/postgres','service_role=rwU/postgres']::text[] THEN
 EXECUTE 'SET LOCAL ROLE "postgres";';
 EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM PUBLIC,postgres,anon,authenticated,service_role;';
 EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON SEQUENCES TO "postgres";';
 EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT UPDATE ON SEQUENCES TO "postgres";';
 EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE ON SEQUENCES TO "postgres";';
 EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON SEQUENCES TO "anon";';
 EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT UPDATE ON SEQUENCES TO "anon";';
 EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE ON SEQUENCES TO "anon";';
 EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON SEQUENCES TO "authenticated";';
 EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT UPDATE ON SEQUENCES TO "authenticated";';
 EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE ON SEQUENCES TO "authenticated";';
 EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON SEQUENCES TO "service_role";';
 EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT UPDATE ON SEQUENCES TO "service_role";';
 EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE ON SEQUENCES TO "service_role";';
 EXECUTE 'SET LOCAL ROLE postgres;';
 END IF;
END $defaults$;

DO $defaults$ BEGIN
 IF (SELECT array_agg(v ORDER BY v) FROM pg_default_acl d,LATERAL unnest(d.defaclacl::text[]) v WHERE d.defaclrole='postgres'::regrole AND d.defaclnamespace='public'::regnamespace AND d.defaclobjtype='f')
 IS DISTINCT FROM ARRAY['anon=X/postgres','authenticated=X/postgres','postgres=X/postgres','service_role=X/postgres']::text[] THEN
 EXECUTE 'SET LOCAL ROLE "postgres";';
 EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM PUBLIC,postgres,anon,authenticated,service_role;';
 EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO "postgres";';
 EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO "anon";';
 EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO "authenticated";';
 EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO "service_role";';
 EXECUTE 'SET LOCAL ROLE postgres;';
 END IF;
END $defaults$;

DO $defaults$ BEGIN
 IF (SELECT array_agg(v ORDER BY v) FROM pg_default_acl d,LATERAL unnest(d.defaclacl::text[]) v WHERE d.defaclrole='postgres'::regrole AND d.defaclnamespace='public'::regnamespace AND d.defaclobjtype='r')
 IS DISTINCT FROM ARRAY['anon=arwdDxtm/postgres','authenticated=arwdDxtm/postgres','postgres=arwdDxtm/postgres','service_role=arwdDxtm/postgres']::text[] THEN
 EXECUTE 'SET LOCAL ROLE "postgres";';
 EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM PUBLIC,postgres,anon,authenticated,service_role;';
 EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT INSERT ON TABLES TO "postgres";';
 EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO "postgres";';
 EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT UPDATE ON TABLES TO "postgres";';
 EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT DELETE ON TABLES TO "postgres";';
 EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT TRUNCATE ON TABLES TO "postgres";';
 EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT REFERENCES ON TABLES TO "postgres";';
 EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT TRIGGER ON TABLES TO "postgres";';
 EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT MAINTAIN ON TABLES TO "postgres";';
 EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT INSERT ON TABLES TO "anon";';
 EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO "anon";';
 EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT UPDATE ON TABLES TO "anon";';
 EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT DELETE ON TABLES TO "anon";';
 EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT TRUNCATE ON TABLES TO "anon";';
 EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT REFERENCES ON TABLES TO "anon";';
 EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT TRIGGER ON TABLES TO "anon";';
 EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT MAINTAIN ON TABLES TO "anon";';
 EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT INSERT ON TABLES TO "authenticated";';
 EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO "authenticated";';
 EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT UPDATE ON TABLES TO "authenticated";';
 EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT DELETE ON TABLES TO "authenticated";';
 EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT TRUNCATE ON TABLES TO "authenticated";';
 EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT REFERENCES ON TABLES TO "authenticated";';
 EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT TRIGGER ON TABLES TO "authenticated";';
 EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT MAINTAIN ON TABLES TO "authenticated";';
 EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT INSERT ON TABLES TO "service_role";';
 EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO "service_role";';
 EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT UPDATE ON TABLES TO "service_role";';
 EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT DELETE ON TABLES TO "service_role";';
 EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT TRUNCATE ON TABLES TO "service_role";';
 EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT REFERENCES ON TABLES TO "service_role";';
 EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT TRIGGER ON TABLES TO "service_role";';
 EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT MAINTAIN ON TABLES TO "service_role";';
 EXECUTE 'SET LOCAL ROLE postgres;';
 END IF;
END $defaults$;

DO $defaults$ BEGIN
 IF (SELECT array_agg(v ORDER BY v) FROM pg_default_acl d,LATERAL unnest(d.defaclacl::text[]) v WHERE d.defaclrole='supabase_admin'::regrole AND d.defaclnamespace='public'::regnamespace AND d.defaclobjtype='S')
 IS DISTINCT FROM ARRAY['anon=rwU/supabase_admin','authenticated=rwU/supabase_admin','postgres=rwU/supabase_admin','service_role=rwU/supabase_admin']::text[] THEN
 EXECUTE 'SET LOCAL ROLE "supabase_admin";';
 EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM PUBLIC,postgres,anon,authenticated,service_role;';
 EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON SEQUENCES TO "postgres";';
 EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT UPDATE ON SEQUENCES TO "postgres";';
 EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE ON SEQUENCES TO "postgres";';
 EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON SEQUENCES TO "anon";';
 EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT UPDATE ON SEQUENCES TO "anon";';
 EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE ON SEQUENCES TO "anon";';
 EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON SEQUENCES TO "authenticated";';
 EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT UPDATE ON SEQUENCES TO "authenticated";';
 EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE ON SEQUENCES TO "authenticated";';
 EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON SEQUENCES TO "service_role";';
 EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT UPDATE ON SEQUENCES TO "service_role";';
 EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE ON SEQUENCES TO "service_role";';
 EXECUTE 'SET LOCAL ROLE postgres;';
 END IF;
END $defaults$;

DO $defaults$ BEGIN
 IF (SELECT array_agg(v ORDER BY v) FROM pg_default_acl d,LATERAL unnest(d.defaclacl::text[]) v WHERE d.defaclrole='supabase_admin'::regrole AND d.defaclnamespace='public'::regnamespace AND d.defaclobjtype='f')
 IS DISTINCT FROM ARRAY['anon=X/supabase_admin','authenticated=X/supabase_admin','postgres=X/supabase_admin','service_role=X/supabase_admin']::text[] THEN
 EXECUTE 'SET LOCAL ROLE "supabase_admin";';
 EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM PUBLIC,postgres,anon,authenticated,service_role;';
 EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO "postgres";';
 EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO "anon";';
 EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO "authenticated";';
 EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO "service_role";';
 EXECUTE 'SET LOCAL ROLE postgres;';
 END IF;
END $defaults$;

DO $defaults$ BEGIN
 IF (SELECT array_agg(v ORDER BY v) FROM pg_default_acl d,LATERAL unnest(d.defaclacl::text[]) v WHERE d.defaclrole='supabase_admin'::regrole AND d.defaclnamespace='public'::regnamespace AND d.defaclobjtype='r')
 IS DISTINCT FROM ARRAY['anon=arwdDxtm/supabase_admin','authenticated=arwdDxtm/supabase_admin','postgres=arwdDxtm/supabase_admin','service_role=arwdDxtm/supabase_admin']::text[] THEN
 EXECUTE 'SET LOCAL ROLE "supabase_admin";';
 EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM PUBLIC,postgres,anon,authenticated,service_role;';
 EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT INSERT ON TABLES TO "postgres";';
 EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO "postgres";';
 EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT UPDATE ON TABLES TO "postgres";';
 EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT DELETE ON TABLES TO "postgres";';
 EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT TRUNCATE ON TABLES TO "postgres";';
 EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT REFERENCES ON TABLES TO "postgres";';
 EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT TRIGGER ON TABLES TO "postgres";';
 EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT MAINTAIN ON TABLES TO "postgres";';
 EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT INSERT ON TABLES TO "anon";';
 EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO "anon";';
 EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT UPDATE ON TABLES TO "anon";';
 EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT DELETE ON TABLES TO "anon";';
 EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT TRUNCATE ON TABLES TO "anon";';
 EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT REFERENCES ON TABLES TO "anon";';
 EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT TRIGGER ON TABLES TO "anon";';
 EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT MAINTAIN ON TABLES TO "anon";';
 EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT INSERT ON TABLES TO "authenticated";';
 EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO "authenticated";';
 EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT UPDATE ON TABLES TO "authenticated";';
 EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT DELETE ON TABLES TO "authenticated";';
 EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT TRUNCATE ON TABLES TO "authenticated";';
 EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT REFERENCES ON TABLES TO "authenticated";';
 EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT TRIGGER ON TABLES TO "authenticated";';
 EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT MAINTAIN ON TABLES TO "authenticated";';
 EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT INSERT ON TABLES TO "service_role";';
 EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO "service_role";';
 EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT UPDATE ON TABLES TO "service_role";';
 EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT DELETE ON TABLES TO "service_role";';
 EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT TRUNCATE ON TABLES TO "service_role";';
 EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT REFERENCES ON TABLES TO "service_role";';
 EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT TRIGGER ON TABLES TO "service_role";';
 EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT MAINTAIN ON TABLES TO "service_role";';
 EXECUTE 'SET LOCAL ROLE postgres;';
 END IF;
END $defaults$;

-- 02: schema owner/ACL, preserved original grants (including PUBLIC USAGE).

SET LOCAL ROLE pg_database_owner;

REVOKE ALL ON SCHEMA public FROM PUBLIC,"postgres","anon","authenticated","service_role","pg_database_owner";
SET LOCAL ROLE "pg_database_owner";
GRANT USAGE ON SCHEMA public TO "pg_database_owner";
GRANT CREATE ON SCHEMA public TO "pg_database_owner";
SET LOCAL ROLE "pg_database_owner";
GRANT USAGE ON SCHEMA public TO PUBLIC;
SET LOCAL ROLE "pg_database_owner";
GRANT USAGE ON SCHEMA public TO "postgres";
SET LOCAL ROLE "pg_database_owner";
GRANT USAGE ON SCHEMA public TO "anon";
SET LOCAL ROLE "pg_database_owner";
GRANT USAGE ON SCHEMA public TO "authenticated";
SET LOCAL ROLE "pg_database_owner";
GRANT USAGE ON SCHEMA public TO "service_role";
SET LOCAL ROLE postgres;

-- 03: sequence configuration only; no setval/current sequence data.

CREATE SEQUENCE public."business_history_id_seq" AS bigint INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1 NO CYCLE;

CREATE SEQUENCE public."stage_catalog_id_seq" AS integer INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1 NO CYCLE;

-- 04: all 18 original tables / 241 original columns.

CREATE TABLE public."activities" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "deal_id" uuid,
  "organization_id" uuid,
  "actor_email" text,
  "actor_name" text,
  "type" text NOT NULL,
  "detail" jsonb DEFAULT '{}'::jsonb,
  "occurred_at" timestamp with time zone DEFAULT now()
);

CREATE TABLE public."advisory_deals" (
  "advisory_id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "site_id" uuid,
  "site_name" text NOT NULL,
  "work_name" text,
  "work_type" text,
  "contractor" text,
  "owner_name" text,
  "owner_kind" text DEFAULT '미지정'::text,
  "bid_amount" bigint,
  "lrc" bigint,
  "exec_amount" bigint,
  "pour_amount" bigint,
  "advisory_fee" bigint,
  "settled" bigint,
  "contract_date" date,
  "start_date" date,
  "end_date" date,
  "status" text DEFAULT '진행중'::text NOT NULL,
  "origin_channel" text,
  "source_sheet" text,
  "source_row" integer,
  "raw" jsonb DEFAULT '{}'::jsonb,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public."assignment_history" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "opportunity_id" uuid,
  "inquiry_id" uuid,
  "from_owner" text,
  "to_owner" text NOT NULL,
  "reason" text,
  "actor_name" text,
  "changed_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public."audit_logs" (
  "event_id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "write_id" text,
  "actor_name" text,
  "actor_id" uuid,
  "entity_type" text NOT NULL,
  "entity_id" uuid,
  "action" text NOT NULL,
  "before" jsonb,
  "after" jsonb,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public."business_history" (
  "id" bigint DEFAULT nextval('business_history_id_seq'::regclass) NOT NULL,
  "deal_id" uuid NOT NULL,
  "from_business" text,
  "to_business" text NOT NULL,
  "reason" text NOT NULL,
  "reason_source" text DEFAULT 'text'::text NOT NULL,
  "actor_name" text,
  "changed_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public."contact_assignments" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "person_key" text NOT NULL,
  "opportunity_id" uuid,
  "site_name" text NOT NULL,
  "office_phone" text,
  "started_at" date NOT NULL,
  "ended_at" date,
  "status" text DEFAULT 'current'::text,
  "reason" text,
  "created_at" timestamp with time zone DEFAULT now()
);

CREATE TABLE public."contacts" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "relate_id" text,
  "organization_id" uuid,
  "name" text,
  "title" text,
  "phone" text,
  "emails" jsonb DEFAULT '[]'::jsonb,
  "custom_fields" jsonb DEFAULT '{}'::jsonb,
  "created_at" timestamp with time zone DEFAULT now(),
  "updated_at" timestamp with time zone DEFAULT now(),
  "person_key" text,
  "mobile" text,
  "role" text DEFAULT '관리소장'::text,
  "current_site" text
);

CREATE TABLE public."dashboard_state" (
  "id" text NOT NULL,
  "data" jsonb,
  "updated_at" timestamp with time zone DEFAULT now()
);

CREATE TABLE public."deals" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "relate_id" text,
  "relate_key" text,
  "organization_id" uuid,
  "contact_id" uuid,
  "brand" text,
  "list_name" text,
  "stage_code" text,
  "stage_raw" text,
  "stage_group" text,
  "assignee_name" text,
  "assignee_email" text,
  "amount" bigint,
  "source" text DEFAULT 'inbound'::text,
  "outbound_channel" text,
  "lost_reason" text,
  "badfit_type" text,
  "next_action" text,
  "next_action_date" date,
  "list_fields" jsonb DEFAULT '{}'::jsonb,
  "closed_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now(),
  "updated_at" timestamp with time zone DEFAULT now(),
  "site_id" uuid,
  "owner_id" uuid,
  "origin_inquiry_id" uuid,
  "lifecycle_status" text DEFAULT 'active'::text NOT NULL,
  "outcome" text,
  "wake_up_at" timestamp with time zone,
  "amount_unknown_reason" text,
  "stage_entered_at" timestamp with time zone,
  "last_activity_at" timestamp with time zone,
  "last_customer_contact_at" timestamp with time zone,
  "opened_at" timestamp with time zone,
  "version" integer DEFAULT 1 NOT NULL,
  "lost_kind" text,
  "origin_channel" text,
  "service_type" text,
  "service_history" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "origin_business" text,
  "current_business" text,
  "business_history" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "office_phone" text,
  "office_email" text,
  "manager_name" text,
  "manager_mobile" text,
  "person_key" text,
  "manager_role" text DEFAULT '관리소장'::text,
  "manager_current_site" text,
  "manager_started_at" date,
  "manager_status" text,
  "manager_left_at" date,
  "primary_work" text,
  "work_items" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "work_scope_type" text,
  "work_summary" text
);

CREATE TABLE public."inquiries" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "brand" text,
  "site_name" text,
  "address" text,
  "contact_name" text,
  "phone" text,
  "assignee_name" text,
  "status" text,
  "deal_id" uuid,
  "received_at" timestamp with time zone,
  "sheet_row" integer,
  "raw" jsonb DEFAULT '{}'::jsonb,
  "created_at" timestamp with time zone DEFAULT now(),
  "site_id" uuid,
  "source_channel" text,
  "assigned_to" uuid,
  "assigned_at" timestamp with time zone,
  "first_response_at" timestamp with time zone,
  "qualified_at" timestamp with time zone,
  "opportunity_id" uuid,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "inquiry_type" text,
  "channel" text,
  "source" text,
  "work_type" text,
  "responded_at" timestamp with time zone,
  "next_action_date" date,
  "close_reason" text
);

CREATE TABLE public."next_actions" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "deal_id" uuid,
  "inquiry_id" uuid,
  "action_type" text DEFAULT '기타'::text NOT NULL,
  "title" text NOT NULL,
  "due_at" timestamp with time zone NOT NULL,
  "assignee_name" text NOT NULL,
  "status" text DEFAULT 'open'::text NOT NULL,
  "completed_at" timestamp with time zone,
  "source_activity_id" uuid,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public."notes" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "relate_id" text,
  "organization_id" uuid,
  "deal_id" uuid,
  "author_name" text,
  "author_email" text,
  "body" text,
  "posted_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now()
);

CREATE TABLE public."organizations" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "relate_id" text,
  "name" text NOT NULL,
  "region" text,
  "address" text,
  "manager_name" text,
  "manager_email" text,
  "custom_fields" jsonb DEFAULT '{}'::jsonb,
  "created_at" timestamp with time zone DEFAULT now(),
  "updated_at" timestamp with time zone DEFAULT now()
);

CREATE TABLE public."projects" (
  "project_id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "opportunity_id" uuid NOT NULL,
  "site_id" uuid,
  "delivery_stage" text DEFAULT 'contract_signed'::text NOT NULL,
  "contract_amount" bigint,
  "contract_date" date,
  "start_date" date,
  "completion_date" date,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public."sites" (
  "site_id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "site_name" text NOT NULL,
  "norm_name" text NOT NULL,
  "address" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public."stage_catalog" (
  "id" integer DEFAULT nextval('stage_catalog_id_seq'::regclass) NOT NULL,
  "brand" text DEFAULT '*'::text NOT NULL,
  "code" text NOT NULL,
  "name" text NOT NULL,
  "stage_group" text NOT NULL,
  "sort" integer NOT NULL,
  "weight" numeric,
  "remind_rule" text,
  "display_group" text
);

CREATE TABLE public."stage_history" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "opportunity_id" uuid,
  "inquiry_id" uuid,
  "from_stage" text,
  "to_stage" text NOT NULL,
  "reason" text,
  "actor_id" uuid,
  "actor_name" text,
  "changed_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public."users" (
  "user_id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "name" text NOT NULL,
  "email" text,
  "role" text DEFAULT 'rep'::text NOT NULL,
  "active" boolean DEFAULT true NOT NULL,
  "auth_uid" uuid,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- 05: PK/UNIQUE/CHECK, then standalone indexes, then FK (including cycles).

ALTER TABLE public."activities" ADD CONSTRAINT "activities_pkey" PRIMARY KEY (id);

ALTER TABLE public."advisory_deals" ADD CONSTRAINT "advisory_deals_owner_kind_check" CHECK (owner_kind = ANY (ARRAY['내부'::text, '외부'::text, '미지정'::text]));

ALTER TABLE public."advisory_deals" ADD CONSTRAINT "advisory_deals_pkey" PRIMARY KEY (advisory_id);

ALTER TABLE public."assignment_history" ADD CONSTRAINT "assignment_history_pkey" PRIMARY KEY (id);

ALTER TABLE public."audit_logs" ADD CONSTRAINT "audit_logs_pkey" PRIMARY KEY (event_id);

ALTER TABLE public."audit_logs" ADD CONSTRAINT "audit_logs_write_id_key" UNIQUE (write_id);

ALTER TABLE public."business_history" ADD CONSTRAINT "business_history_pkey" PRIMARY KEY (id);

ALTER TABLE public."contact_assignments" ADD CONSTRAINT "contact_assignments_pkey" PRIMARY KEY (id);

ALTER TABLE public."contacts" ADD CONSTRAINT "contacts_pkey" PRIMARY KEY (id);

ALTER TABLE public."contacts" ADD CONSTRAINT "contacts_relate_id_key" UNIQUE (relate_id);

ALTER TABLE public."dashboard_state" ADD CONSTRAINT "dashboard_state_pkey" PRIMARY KEY (id);

ALTER TABLE public."deals" ADD CONSTRAINT "deals_lifecycle_status_check" CHECK (lifecycle_status = ANY (ARRAY['active'::text, 'parked'::text, 'closed'::text]));

ALTER TABLE public."deals" ADD CONSTRAINT "deals_lost_kind_check" CHECK (lost_kind IS NULL OR (lost_kind = ANY (ARRAY['뺏김'::text, '놓침'::text, '기타'::text])));

ALTER TABLE public."deals" ADD CONSTRAINT "deals_outcome_check" CHECK (outcome IS NULL OR (outcome = ANY (ARRAY['won'::text, 'lost'::text, 'badfit'::text, 'nocontact'::text])));

ALTER TABLE public."deals" ADD CONSTRAINT "deals_pkey" PRIMARY KEY (id);

ALTER TABLE public."deals" ADD CONSTRAINT "deals_relate_id_key" UNIQUE (relate_id);

ALTER TABLE public."deals" ADD CONSTRAINT "deals_work_items_array" CHECK (jsonb_typeof(work_items) = 'array'::text);

ALTER TABLE public."deals" ADD CONSTRAINT "deals_work_scope_consistent" CHECK (jsonb_array_length(work_items) = 0 AND primary_work IS NULL AND work_scope_type IS NULL AND work_summary IS NULL OR jsonb_array_length(work_items) = 1 AND work_scope_type = 'single'::text AND NULLIF(primary_work, ''::text) IS NOT NULL AND work_items ? primary_work AND NULLIF(work_summary, ''::text) IS NOT NULL OR jsonb_array_length(work_items) >= 2 AND work_scope_type = 'multi'::text AND NULLIF(primary_work, ''::text) IS NOT NULL AND work_items ? primary_work AND NULLIF(work_summary, ''::text) IS NOT NULL);

ALTER TABLE public."inquiries" ADD CONSTRAINT "inquiries_pkey" PRIMARY KEY (id);

ALTER TABLE public."next_actions" ADD CONSTRAINT "next_action_one_owner" CHECK (deal_id IS NOT NULL AND inquiry_id IS NULL OR deal_id IS NULL AND inquiry_id IS NOT NULL);

ALTER TABLE public."next_actions" ADD CONSTRAINT "next_actions_pkey" PRIMARY KEY (id);

ALTER TABLE public."next_actions" ADD CONSTRAINT "next_actions_status_check" CHECK (status = ANY (ARRAY['open'::text, 'completed'::text, 'cancelled'::text]));

ALTER TABLE public."notes" ADD CONSTRAINT "notes_pkey" PRIMARY KEY (id);

ALTER TABLE public."notes" ADD CONSTRAINT "notes_relate_id_key" UNIQUE (relate_id);

ALTER TABLE public."organizations" ADD CONSTRAINT "organizations_pkey" PRIMARY KEY (id);

ALTER TABLE public."organizations" ADD CONSTRAINT "organizations_relate_id_key" UNIQUE (relate_id);

ALTER TABLE public."projects" ADD CONSTRAINT "projects_delivery_stage_check" CHECK (delivery_stage = ANY (ARRAY['contract_signed'::text, 'preconstruction'::text, 'construction'::text, 'completion'::text, 'closed'::text]));

ALTER TABLE public."projects" ADD CONSTRAINT "projects_pkey" PRIMARY KEY (project_id);

ALTER TABLE public."sites" ADD CONSTRAINT "sites_pkey" PRIMARY KEY (site_id);

ALTER TABLE public."stage_catalog" ADD CONSTRAINT "stage_catalog_brand_code_key" UNIQUE (brand, code);

ALTER TABLE public."stage_catalog" ADD CONSTRAINT "stage_catalog_pkey" PRIMARY KEY (id);

ALTER TABLE public."stage_history" ADD CONSTRAINT "stage_history_pkey" PRIMARY KEY (id);

ALTER TABLE public."users" ADD CONSTRAINT "users_name_key" UNIQUE (name);

ALTER TABLE public."users" ADD CONSTRAINT "users_pkey" PRIMARY KEY (user_id);

ALTER TABLE public."users" ADD CONSTRAINT "users_role_check" CHECK (role = ANY (ARRAY['rep'::text, 'admin'::text, 'dual'::text, 'viewer'::text]));

CREATE INDEX idx_act_actor_time ON public.activities USING btree (actor_email, occurred_at);

CREATE INDEX idx_act_deal ON public.activities USING btree (deal_id);

CREATE INDEX idx_adv_owner ON public.advisory_deals USING btree (owner_name);

CREATE INDEX idx_adv_site ON public.advisory_deals USING btree (site_id);

CREATE INDEX idx_adv_status ON public.advisory_deals USING btree (status);

CREATE UNIQUE INDEX uq_adv_src ON public.advisory_deals USING btree (source_sheet, source_row);

CREATE INDEX idx_assign_hist_opp ON public.assignment_history USING btree (opportunity_id, changed_at);

CREATE INDEX idx_audit_entity ON public.audit_logs USING btree (entity_type, entity_id, created_at);

CREATE INDEX idx_bizhist_deal ON public.business_history USING btree (deal_id, changed_at DESC);

CREATE UNIQUE INDEX contact_assign_open ON public.contact_assignments USING btree (person_key, site_name) WHERE (ended_at IS NULL);

CREATE UNIQUE INDEX contacts_person_key_uq ON public.contacts USING btree (person_key);

CREATE INDEX idx_contact_org ON public.contacts USING btree (organization_id);

CREATE INDEX idx_contact_phone ON public.contacts USING btree (phone);

CREATE INDEX deals_primary_work_idx ON public.deals USING btree (primary_work) WHERE (primary_work IS NOT NULL);

CREATE INDEX deals_work_items_gin ON public.deals USING gin (work_items);

CREATE INDEX idx_deal_assignee ON public.deals USING btree (assignee_email);

CREATE INDEX idx_deal_brand_stage ON public.deals USING btree (brand, stage_code);

CREATE INDEX idx_deal_next ON public.deals USING btree (next_action_date);

CREATE INDEX idx_deal_org ON public.deals USING btree (organization_id);

CREATE INDEX idx_deals_current_biz ON public.deals USING btree (current_business);

CREATE INDEX idx_deals_lost_kind ON public.deals USING btree (lost_kind) WHERE (lost_kind IS NOT NULL);

CREATE INDEX idx_deals_origin ON public.deals USING btree (origin_channel);

CREATE INDEX idx_deals_origin_biz ON public.deals USING btree (origin_business);

CREATE INDEX idx_deals_outcome ON public.deals USING btree (outcome);

CREATE INDEX idx_deals_owner ON public.deals USING btree (owner_id);

CREATE INDEX idx_deals_service ON public.deals USING btree (service_type);

CREATE INDEX idx_deals_site ON public.deals USING btree (site_id);

CREATE INDEX idx_deals_stage_entered ON public.deals USING btree (stage_entered_at);

CREATE INDEX idx_inq_assigned ON public.inquiries USING btree (assigned_to, assigned_at);

CREATE INDEX idx_inq_brand ON public.inquiries USING btree (brand);

CREATE INDEX idx_inq_phone ON public.inquiries USING btree (phone);

CREATE INDEX idx_inq_site ON public.inquiries USING btree (site_id);

CREATE INDEX idx_next_actions_assignee_open ON public.next_actions USING btree (assignee_name, status, due_at);

CREATE INDEX idx_next_actions_deal_open ON public.next_actions USING btree (deal_id, status, due_at);

CREATE INDEX idx_next_actions_inquiry_open ON public.next_actions USING btree (inquiry_id, status, due_at);

CREATE INDEX idx_note_deal ON public.notes USING btree (deal_id);

CREATE INDEX idx_note_org ON public.notes USING btree (organization_id);

CREATE INDEX idx_org_name ON public.organizations USING btree (name);

CREATE INDEX idx_projects_opp ON public.projects USING btree (opportunity_id);

CREATE UNIQUE INDEX uq_sites_norm ON public.sites USING btree (norm_name);

CREATE INDEX idx_stage_hist_opp ON public.stage_history USING btree (opportunity_id, changed_at);

CREATE INDEX idx_users_auth ON public.users USING btree (auth_uid);

ALTER TABLE public."activities" ADD CONSTRAINT "activities_deal_id_fkey" FOREIGN KEY (deal_id) REFERENCES deals(id) ON DELETE CASCADE;

ALTER TABLE public."activities" ADD CONSTRAINT "activities_organization_id_fkey" FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE SET NULL;

ALTER TABLE public."advisory_deals" ADD CONSTRAINT "advisory_deals_site_id_fkey" FOREIGN KEY (site_id) REFERENCES sites(site_id) ON DELETE SET NULL;

ALTER TABLE public."assignment_history" ADD CONSTRAINT "assignment_history_inquiry_id_fkey" FOREIGN KEY (inquiry_id) REFERENCES inquiries(id) ON DELETE CASCADE;

ALTER TABLE public."assignment_history" ADD CONSTRAINT "assignment_history_opportunity_id_fkey" FOREIGN KEY (opportunity_id) REFERENCES deals(id) ON DELETE CASCADE;

ALTER TABLE public."audit_logs" ADD CONSTRAINT "audit_logs_actor_id_fkey" FOREIGN KEY (actor_id) REFERENCES users(user_id) ON DELETE SET NULL;

ALTER TABLE public."business_history" ADD CONSTRAINT "business_history_deal_id_fkey" FOREIGN KEY (deal_id) REFERENCES deals(id) ON DELETE CASCADE;

ALTER TABLE public."contact_assignments" ADD CONSTRAINT "contact_assignments_person_key_fkey" FOREIGN KEY (person_key) REFERENCES contacts(person_key);

ALTER TABLE public."contacts" ADD CONSTRAINT "contacts_organization_id_fkey" FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE SET NULL;

ALTER TABLE public."deals" ADD CONSTRAINT "deals_contact_id_fkey" FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE SET NULL;

ALTER TABLE public."deals" ADD CONSTRAINT "deals_organization_id_fkey" FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE SET NULL;

ALTER TABLE public."deals" ADD CONSTRAINT "deals_origin_inquiry_id_fkey" FOREIGN KEY (origin_inquiry_id) REFERENCES inquiries(id) ON DELETE SET NULL;

ALTER TABLE public."deals" ADD CONSTRAINT "deals_owner_id_fkey" FOREIGN KEY (owner_id) REFERENCES users(user_id) ON DELETE SET NULL;

ALTER TABLE public."deals" ADD CONSTRAINT "deals_site_id_fkey" FOREIGN KEY (site_id) REFERENCES sites(site_id) ON DELETE SET NULL;

ALTER TABLE public."inquiries" ADD CONSTRAINT "inquiries_assigned_to_fkey" FOREIGN KEY (assigned_to) REFERENCES users(user_id) ON DELETE SET NULL;

ALTER TABLE public."inquiries" ADD CONSTRAINT "inquiries_deal_id_fkey" FOREIGN KEY (deal_id) REFERENCES deals(id) ON DELETE SET NULL;

ALTER TABLE public."inquiries" ADD CONSTRAINT "inquiries_opportunity_id_fkey" FOREIGN KEY (opportunity_id) REFERENCES deals(id) ON DELETE SET NULL;

ALTER TABLE public."inquiries" ADD CONSTRAINT "inquiries_site_id_fkey" FOREIGN KEY (site_id) REFERENCES sites(site_id) ON DELETE SET NULL;

ALTER TABLE public."next_actions" ADD CONSTRAINT "next_actions_deal_id_fkey" FOREIGN KEY (deal_id) REFERENCES deals(id) ON DELETE CASCADE;

ALTER TABLE public."next_actions" ADD CONSTRAINT "next_actions_inquiry_id_fkey" FOREIGN KEY (inquiry_id) REFERENCES inquiries(id) ON DELETE CASCADE;

ALTER TABLE public."next_actions" ADD CONSTRAINT "next_actions_source_activity_id_fkey" FOREIGN KEY (source_activity_id) REFERENCES activities(id) ON DELETE SET NULL;

ALTER TABLE public."notes" ADD CONSTRAINT "notes_deal_id_fkey" FOREIGN KEY (deal_id) REFERENCES deals(id) ON DELETE SET NULL;

ALTER TABLE public."notes" ADD CONSTRAINT "notes_organization_id_fkey" FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE SET NULL;

ALTER TABLE public."projects" ADD CONSTRAINT "projects_opportunity_id_fkey" FOREIGN KEY (opportunity_id) REFERENCES deals(id) ON DELETE CASCADE;

ALTER TABLE public."projects" ADD CONSTRAINT "projects_site_id_fkey" FOREIGN KEY (site_id) REFERENCES sites(site_id) ON DELETE SET NULL;

ALTER TABLE public."stage_history" ADD CONSTRAINT "stage_history_actor_id_fkey" FOREIGN KEY (actor_id) REFERENCES users(user_id) ON DELETE SET NULL;

ALTER TABLE public."stage_history" ADD CONSTRAINT "stage_history_inquiry_id_fkey" FOREIGN KEY (inquiry_id) REFERENCES inquiries(id) ON DELETE CASCADE;

ALTER TABLE public."stage_history" ADD CONSTRAINT "stage_history_opportunity_id_fkey" FOREIGN KEY (opportunity_id) REFERENCES deals(id) ON DELETE CASCADE;

ALTER SEQUENCE public."business_history_id_seq" OWNED BY public.business_history.id;

ALTER SEQUENCE public."stage_catalog_id_seq" OWNED BY public.stage_catalog.id;

-- 06: original views (original options, NOT security_invoker hardening).

CREATE VIEW public."opportunities" AS
SELECT id AS opportunity_id,
    site_id,
    origin_inquiry_id,
    owner_id,
    assignee_name AS owner_name,
    stage_code AS sales_stage_code,
    lifecycle_status,
    outcome,
    amount,
    amount_unknown_reason,
    stage_entered_at,
    last_activity_at,
    last_customer_contact_at,
    opened_at,
    closed_at,
    wake_up_at,
    version,
    brand,
    created_at,
    updated_at
   FROM deals d;

CREATE VIEW public."v_assignee" AS
SELECT assignee_name,
    count(*) AS total,
    sum(
        CASE
            WHEN stage_group <> 'closed'::text AND stage_group IS NOT NULL THEN 1
            ELSE 0
        END) AS open_cnt,
    sum(
        CASE
            WHEN stage_code = 'won'::text THEN 1
            ELSE 0
        END) AS won_cnt,
    sum(
        CASE
            WHEN stage_code = 'won'::text THEN amount
            ELSE 0::bigint
        END) AS won_amt,
    sum(
        CASE
            WHEN stage_code = 'lost'::text THEN 1
            ELSE 0
        END) AS lost_cnt,
    sum(
        CASE
            WHEN stage_code ~~ 'badfit%'::text THEN 1
            ELSE 0
        END) AS badfit_cnt
   FROM deals
  WHERE assignee_name IS NOT NULL
  GROUP BY assignee_name;

CREATE VIEW public."v_dup_org" AS
SELECT replace(replace(lower(name), ' '::text, ''::text), '아파트'::text, ''::text) AS norm,
    count(*) AS cnt,
    array_agg(name) AS names,
    array_agg(id) AS ids
   FROM organizations
  GROUP BY (replace(replace(lower(name), ' '::text, ''::text), '아파트'::text, ''::text))
 HAVING count(*) > 1;

CREATE VIEW public."v_funnel" AS
SELECT brand,
    stage_group,
    COALESCE(stage_code, stage_raw) AS stage,
    count(*) AS cnt,
    sum(amount) AS amt
   FROM deals
  GROUP BY brand, stage_group, (COALESCE(stage_code, stage_raw));

CREATE VIEW public."v_kanban" AS
SELECT d.brand,
    sc.display_group,
    count(*) AS cnt,
    sum(d.amount) AS amt
   FROM deals d
     JOIN stage_catalog sc ON sc.code = d.stage_code
  GROUP BY d.brand, sc.display_group;

-- 07: original functions, dependency ordered, bodies unchanged.

CREATE OR REPLACE FUNCTION public.set_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin new.updated_at = now(); return new; end $function$
;

CREATE OR REPLACE FUNCTION public.require_reason(p_reason text, p_what text)
 RETURNS void
 LANGUAGE plpgsql
 IMMUTABLE
AS $function$
begin
  if p_reason is null or length(btrim(p_reason)) < 5 then
    raise exception '%: 변경 근거를 남겨야 저장할 수 있습니다', p_what;
  end if;
end $function$
;

CREATE OR REPLACE FUNCTION public.stage_sla_days(code text)
 RETURNS integer
 LANGUAGE sql
 IMMUTABLE
AS $function$
  select case code
    when 'first_contact' then 7  when 'consulting' then 10 when 'sent'      then 7
    when 'rapport'       then 30 when 'silent'     then 30 when 'waiting'   then 180
    when 'compete'       then 14 when 'imminent'   then 14 when 'bidding'   then 7
    when 'contract'      then 14 when 'construction' then 60
    when 'completion'    then 30 when 'expansion'  then 90
    else 30 end
$function$
;

CREATE OR REPLACE FUNCTION public.parse_responses(txt text)
 RETURNS jsonb
 LANGUAGE plpgsql
 IMMUTABLE
AS $function$
declare
  parts text[];
  seg   text;
  out_j jsonb := '[]'::jsonb;
  m     text[];
begin
  if txt is null or btrim(txt) = '' then return out_j; end if;
  -- [2026. 9. 1. PM 2:44:42] 로 시작하는 지점마다 자른다
  parts := regexp_split_to_array(txt, E'(?=\\[\\d{4}\\. ?\\d{1,2}\\. ?\\d{1,2}\\.)');
  foreach seg in array parts loop
    if btrim(seg) = '' then continue; end if;
    m := regexp_match(seg, E'^\\[([^\\]]+)\\]\\s*(?:\\[([^\\]]+)\\])?\\s*([\\s\\S]*)$');
    if m is null then
      out_j := out_j || jsonb_build_object('at', null, 'kind', null, 'body', btrim(seg));
    else
      out_j := out_j || jsonb_build_object(
        'at',   btrim(coalesce(m[1],'')),
        'kind', btrim(coalesce(m[2],'응대')),
        'body', btrim(coalesce(m[3],'')));
    end if;
  end loop;
  return out_j;
end $function$
;

CREATE OR REPLACE FUNCTION public._done_today(p_rep text)
 RETURNS TABLE(ref text)
 LANGUAGE sql
AS $function$
  select detail->>'ref' from activities
  where actor_name=p_rep and type='today_chip'
    and occurred_at >= date_trunc('day', now() at time zone 'Asia/Seoul') at time zone 'Asia/Seoul'
$function$
;

CREATE OR REPLACE FUNCTION public.crm_site_contacts(p_opportunity_id uuid)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
 with rows as (
  select jsonb_build_object('id',c.id,'person_key',c.person_key,'name',c.name,'role',coalesce(nullif(c.role,''),nullif(c.title,''),'담당자'),'mobile',coalesce(c.mobile,c.phone),'current_site',c.current_site,'office_phone',ca.office_phone,'started_at',ca.started_at,'ended_at',ca.ended_at,'status',coalesce(ca.status,'current')) obj,
  case when coalesce(c.role,c.title)='관리소장' then 0 else 1 end ord,c.name
  from public.deals d join public.contacts c on c.organization_id=d.organization_id left join public.contact_assignments ca on ca.person_key=c.person_key and ca.ended_at is null where d.id=p_opportunity_id)
 select case when count(*)>1 then jsonb_agg(obj order by ord,name) else '[]'::jsonb end from rows;
$function$
;

CREATE OR REPLACE FUNCTION public.crm_contact_upsert(p jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare k text; cid uuid; org uuid; primary_contact boolean;
begin
 k:=coalesce(nullif(p->>'person_key',''),'mobile:'||regexp_replace(coalesce(p->>'manager_mobile',''),'\D','','g'));
 select organization_id into org from public.deals where id=(p->>'opportunity_id')::uuid;
 update public.contacts set organization_id=coalesce(org,organization_id),name=p->>'manager_name',title=coalesce(p->>'manager_role','담당자'),phone=p->>'manager_mobile',mobile=p->>'manager_mobile',role=coalesce(p->>'manager_role','담당자'),current_site=p->>'site_name',updated_at=now() where person_key=k returning id into cid;
 if cid is null then insert into public.contacts(organization_id,name,title,phone,mobile,role,person_key,current_site,created_at,updated_at) values(org,p->>'manager_name',coalesce(p->>'manager_role','담당자'),p->>'manager_mobile',p->>'manager_mobile',coalesce(p->>'manager_role','담당자'),k,p->>'site_name',now(),now()) returning id into cid; end if;
 insert into public.contact_assignments(person_key,opportunity_id,site_name,office_phone,started_at,status,reason) values(k,(p->>'opportunity_id')::uuid,p->>'site_name',p->>'office_phone',coalesce((p->>'started_at')::date,current_date),'current','CRM 연락처 저장') on conflict(person_key,site_name) where ended_at is null do update set office_phone=excluded.office_phone,status='current';
 primary_contact:=coalesce((p->>'is_primary')::boolean,false) or coalesce(p->>'manager_role','')='관리소장';
 if primary_contact then update public.deals set office_phone=coalesce(nullif(p->>'office_phone',''),office_phone),office_email=coalesce(nullif(p->>'office_email',''),office_email),manager_name=p->>'manager_name',manager_mobile=p->>'manager_mobile',manager_role=p->>'manager_role',person_key=k,manager_current_site=p->>'site_name',manager_status='current',updated_at=now() where id=(p->>'opportunity_id')::uuid; end if;
 return jsonb_build_object('ok',true,'contact_id',cid,'person_key',k,'is_primary',primary_contact);
end $function$
;

CREATE OR REPLACE FUNCTION public.crm_contact_move(p jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare v_key text:=nullif(trim(p->>'person_key'),''); v_from uuid:=(p->>'opportunity_id')::uuid; v_moved date:=coalesce(nullif(left(p->>'moved_at',10),'')::date,current_date); v_target uuid;
begin
 if v_key is null or nullif(trim(p->>'to_site'),'') is null then raise exception 'person_key and to_site are required'; end if;
 update public.contact_assignments set ended_at=v_moved,status='이동',reason=nullif(p->>'reason','') where person_key=v_key and ended_at is null and (opportunity_id=v_from or site_name=p->>'from_site');
 select d.id into v_target from public.deals d left join public.organizations o on o.id=d.organization_id where lower(trim(coalesce(o.name,d.list_fields->>'site_name',d.list_fields->>'name','')))=lower(trim(p->>'to_site')) order by d.updated_at desc nulls last limit 1;
 insert into public.contact_assignments(person_key,opportunity_id,site_name,office_phone,started_at,status,reason) values(v_key,v_target,p->>'to_site',nullif(p->>'to_office_phone',''),v_moved,'current',nullif(p->>'reason',''))
 on conflict(person_key,site_name) where ended_at is null do update set opportunity_id=excluded.opportunity_id,office_phone=excluded.office_phone,started_at=excluded.started_at,status='current',reason=excluded.reason;
 update public.contacts set name=coalesce(nullif(p->>'manager_name',''),name),mobile=coalesce(nullif(p->>'manager_mobile',''),mobile),phone=coalesce(nullif(p->>'manager_mobile',''),phone),current_site=p->>'to_site',updated_at=now() where person_key=v_key;
 update public.deals set manager_current_site=p->>'to_site',manager_status='moved',manager_left_at=v_moved,updated_at=now() where id=v_from;
 if v_target is not null then update public.deals set office_phone=coalesce(nullif(p->>'to_office_phone',''),office_phone),manager_name=case when manager_mobile is null then p->>'manager_name' else manager_name end,manager_mobile=case when manager_mobile is null then p->>'manager_mobile' else manager_mobile end,person_key=case when manager_mobile is null then v_key else person_key end,manager_role=case when manager_mobile is null then '관리소장' else manager_role end,manager_current_site=case when manager_mobile is null then p->>'to_site' else manager_current_site end,manager_started_at=case when manager_mobile is null then v_moved else manager_started_at end,manager_status=case when manager_mobile is null then 'current' else manager_status end,updated_at=now() where id=v_target; end if;
 return jsonb_build_object('ok',true,'op','contact_move','from_opportunity_id',v_from,'to_opportunity_id',v_target,'person_key',v_key);
end $function$
;

CREATE OR REPLACE FUNCTION public.crm_opportunity_work_set(p jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  oid uuid;
  items jsonb;
  primary_value text;
  scope_value text;
  summary_value text;
  reason_value text;
  actor_value text;
  write_value text;
  before_work jsonb;
  after_work jsonb;
  item_count integer;
begin
  oid := (p ->> 'opportunity_id')::uuid;
  items := coalesce(p -> 'work_items', p -> 'workItems', '[]'::jsonb);
  primary_value := nullif(coalesce(p ->> 'primary_work', p ->> 'primaryWork'), '');
  summary_value := nullif(coalesce(p ->> 'work_summary', p ->> 'workSummary'), '');
  reason_value := nullif(trim(p ->> 'reason'), '');
  actor_value := nullif(coalesce(p ->> 'actor_name', p ->> 'actor_id'), '');
  write_value := nullif(p ->> 'write_id', '');

  if reason_value is null or length(reason_value) < 5 then
    raise exception 'a work classification reason of at least 5 characters is required';
  end if;

  select jsonb_build_object(
           'primary_work', d.primary_work,
           'work_items', d.work_items,
           'work_scope_type', d.work_scope_type,
           'work_summary', d.work_summary
         )
    into before_work
    from public.deals d
   where d.id = oid;

  if before_work is null then
    raise exception 'opportunity not found: %', oid;
  end if;

  if jsonb_typeof(items) <> 'array' then
    raise exception 'work_items must be a JSON array';
  end if;

  item_count := jsonb_array_length(items);
  if item_count = 0 then
    update public.deals
       set primary_work = null, work_items = '[]'::jsonb,
           work_scope_type = null, work_summary = null, updated_at = now()
     where id = oid;
    after_work := jsonb_build_object(
      'primary_work', null, 'work_items', '[]'::jsonb,
      'work_scope_type', null, 'work_summary', null,
      'reason', reason_value, 'reason_source', p ->> 'reason_source'
    );
  else
    scope_value := case when item_count = 1 then 'single' else 'multi' end;
    if primary_value is null or not (items ? primary_value) then
      raise exception 'primary_work must be one of work_items';
    end if;
    if summary_value is null then
      raise exception 'work_summary is required';
    end if;

    update public.deals
       set primary_work = primary_value,
           work_items = items,
           work_scope_type = scope_value,
           work_summary = summary_value,
           updated_at = now()
     where id = oid;

    after_work := jsonb_build_object(
      'primary_work', primary_value, 'work_items', items,
      'work_scope_type', scope_value, 'work_summary', summary_value,
      'reason', reason_value, 'reason_source', p ->> 'reason_source'
    );
  end if;

  insert into public.activities (deal_id, actor_name, type, detail, occurred_at)
  values (
    oid, coalesce(actor_value, 'CRM 사용자'), '공종분류',
    jsonb_build_object(
      'note', coalesce(summary_value, '공종 미분류'),
      'result', reason_value,
      'reason_source', p ->> 'reason_source'
    ),
    coalesce(nullif(p ->> 'at', '')::timestamptz, now())
  );

  insert into public.audit_logs (
    write_id, actor_name, actor_id, entity_type, entity_id,
    action, before, after, created_at
  ) values (
    write_value, coalesce(actor_value, 'CRM 사용자'),
    case when actor_value ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
         then actor_value::uuid else null end,
    'opportunity', oid, 'opportunity_work_set', before_work, after_work,
    coalesce(nullif(p ->> 'at', '')::timestamptz, now())
  );

  return jsonb_build_object('ok', true, 'opportunity_id', oid) || after_work;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.apply_business_change(p_deal uuid, p_to text, p_reason text, p_actor text DEFAULT NULL::text, p_source text DEFAULT 'text'::text, p_next_action text DEFAULT NULL::text, p_next_due date DEFAULT NULL::date)
 RETURNS jsonb
 LANGUAGE plpgsql
AS $function$
declare v_from text; v_row jsonb;
begin
  if p_reason is null or length(btrim(p_reason)) < 5 then
    raise exception '변경 근거가 없습니다 — 사업유형 전환은 사유(직접 입력 또는 음성 변환 텍스트) 없이 저장할 수 없습니다';
  end if;
  select coalesce(current_business, brand) into v_from from deals where id = p_deal;
  if not found then raise exception 'deal not found: %', p_deal; end if;

  update deals set
    current_business = p_to,
    brand            = p_to,                       -- 파이프라인 필터가 «현재» 유형을 따르도록
    origin_business  = coalesce(origin_business, v_from),  -- 최초 유입은 절대 덮지 않는다
    service_type     = p_to,
    business_history = coalesce(business_history,'[]'::jsonb) || jsonb_build_object(
        'at', now(), 'from', v_from, 'to', p_to,
        'reason', p_reason, 'source', p_source, 'actor', p_actor),
    updated_at = now()
  where id = p_deal;

  insert into business_history (deal_id, from_business, to_business, reason, reason_source, actor_name)
  values (p_deal, v_from, p_to, p_reason, coalesce(p_source,'text'), p_actor);

  if p_next_action is not null and btrim(p_next_action) <> '' then
    insert into next_actions (deal_id, action_type, title, due_at, assignee_name, status)
    values (p_deal, '기타', p_next_action,
            coalesce(p_next_due, current_date + 3)::timestamptz + interval '9 hours',
            coalesce(p_actor,'미지정'), 'open');
  end if;

  select jsonb_build_object('deal_id', p_deal, 'from', v_from, 'to', p_to) into v_row;
  return v_row;
end $function$
;

CREATE OR REPLACE FUNCTION public.metrics_channel_flow()
 RETURNS json
 LANGUAGE sql
 STABLE
AS $function$
select json_build_object(
  'by_service', (select coalesce(json_object_agg(s, j), '{}'::json) from (
      select coalesce(service_type,'미지정') s,
             json_build_object(
               'total', count(*),
               'amount', coalesce(sum(amount),0),
               'origins', (select coalesce(json_object_agg(o, c), '{}'::json) from (
                   select coalesce(d2.origin_channel,'미지정') o, count(*) c
                   from deals d2
                   where coalesce(d2.service_type,'미지정') = coalesce(d.service_type,'미지정')
                   group by 1) t)
             ) j
      from deals d group by coalesce(service_type,'미지정'), service_type) x),
  'converted', (select count(*) from deals where jsonb_array_length(service_history) > 0),
  'generated_at', now()
)
$function$
;

CREATE OR REPLACE FUNCTION public.metrics_lost_breakdown(p_owner text DEFAULT NULL::text)
 RETURNS json
 LANGUAGE sql
 STABLE
AS $function$
with l as (
  select * from deals
  where stage_code = 'lost' and (p_owner is null or assignee_name = p_owner)
)
select json_build_object(
  'total',      (select count(*) from l),
  'amount',     (select coalesce(sum(amount),0) from l),
  'by_kind',    (select coalesce(json_object_agg(k, c), '{}'::json) from (
                   select coalesce(lost_kind,'미분류') k, count(*) c from l group by 1) x),
  'by_reason',  (select coalesce(json_object_agg(r, c), '{}'::json) from (
                   select coalesce(lost_reason,'미기재') r, count(*) c from l group by 1) y),
  -- 우리가 고칠 수 있는 손실 (놓침) — 이 숫자가 줄어야 실행이 좋아진 것
  'fixable',    (select count(*) from l where lost_kind = '놓침'),
  'fixable_amount', (select coalesce(sum(amount),0) from l where lost_kind = '놓침'),
  'unclassified',   (select count(*) from l where lost_kind is null)
)
$function$
;

CREATE OR REPLACE FUNCTION public.metrics_operations(p_owner text DEFAULT NULL::text)
 RETURNS json
 LANGUAGE sql
 STABLE
AS $function$
with opp as (
  select * from deals
  where outcome is null
    and stage_code not in ('won','lost','badfit','nocontact')
    and (p_owner is null or assignee_name = p_owner)
),
inq as (
  select * from inquiries
  where (p_owner is null or assignee_name = p_owner)
),
-- ① 배정 SLA: 접수 → 배정까지 24시간 이내 (시각이 있는 건만 모수)
assign as (
  select count(*) filter (where assigned_at is not null and received_at is not null) as base,
         count(*) filter (where assigned_at is not null and received_at is not null
                          and assigned_at - received_at <= interval '24 hours') as ok
  from inq
),
-- ② 최초응대: 배정 → 첫 응답까지 1일 이내
resp as (
  select count(*) filter (where first_response_at is not null and assigned_at is not null) as base,
         count(*) filter (where first_response_at is not null and assigned_at is not null
                          and first_response_at - assigned_at <= interval '1 day') as ok
  from inq
),
-- ③ 기한 준수: 완료된 다음행동 중 기한 내 완료 비율
due as (
  select count(*) filter (where status='completed' and completed_at is not null) as base,
         count(*) filter (where status='completed' and completed_at is not null and completed_at <= due_at) as ok
  from next_actions
  where (p_owner is null or assignee_name = p_owner)
),
-- ④ 단계 정체: 단계 진입 후 SLA 초과
stale as (
  select count(*) as base,
         count(*) filter (where stage_entered_at is not null
                          and now() - stage_entered_at > (stage_sla_days(stage_code) || ' days')::interval) as over
  from opp
),
-- ⑤ 다음 행동 보유율
nexts as (
  select count(*) as base,
         count(*) filter (where exists (
            select 1 from next_actions n where n.deal_id = opp.id and n.status='open')) as has
  from opp
),
-- ⑥ 고객 접촉 없이 «정상»인 건 (Trust Signal)
contact as (
  select count(*) filter (where last_customer_contact_at is null) as no_contact,
         count(*) filter (where last_customer_contact_at is not null
                          and now() - last_customer_contact_at > interval '21 days') as cold
  from opp
)
select json_build_object(
  'owner', p_owner,
  'open_count', (select count(*) from opp),
  -- 분모가 0이면 null → 화면에서 «수집 중» 으로 표시 (가짜 100% 금지)
  'assign_sla',   json_build_object('base',(select base from assign),'ok',(select ok from assign),
                    'pct', (select case when base>0 then round(ok*100.0/base,1) end from assign)),
  'first_response',json_build_object('base',(select base from resp),'ok',(select ok from resp),
                    'pct', (select case when base>0 then round(ok*100.0/base,1) end from resp)),
  'due_kept',     json_build_object('base',(select base from due),'ok',(select ok from due),
                    'pct', (select case when base>0 then round(ok*100.0/base,1) end from due)),
  'stage_stale',  json_build_object('base',(select base from stale),'over',(select over from stale),
                    'pct', (select case when base>0 then round(over*100.0/base,1) end from stale)),
  'next_coverage',json_build_object('base',(select base from nexts),'has',(select has from nexts),
                    'pct', (select case when base>0 then round(has*100.0/base,1) end from nexts)),
  'customer_contact', json_build_object('never',(select no_contact from contact),
                    'cold_21d',(select cold from contact)),
  'generated_at', now()
)
$function$
;

CREATE OR REPLACE FUNCTION public.work_items_today(p_owner text)
 RETURNS TABLE(entity_type text, entity_id uuid, title text, owner_name text, action text, due_at timestamp with time zone, priority integer, why text)
 LANGUAGE sql
 STABLE
AS $function$
  -- ① 미배정·미응대 문의 (Opportunity 이전 단계도 오늘 할 일이다)
  select 'inquiry'::text, i.id, coalesce(i.site_name,'(현장명 없음)'), i.assignee_name,
         '첫 응대'::text, i.received_at, 3,
         case when i.assignee_name is null then '미배정' else '배정 후 미응대' end
  from inquiries i
  where i.first_response_at is null
    and (i.assignee_name = p_owner or (p_owner is null))
    and coalesce(i.status,'') not in ('수주','실주','배드핏','종결','종료','연락두절')
  union all
  -- ② 기한 지난 / 오늘 마감 다음행동
  select 'opportunity'::text, d.id, coalesce(o.name, d.list_fields->>'name','(현장명 없음)'), d.assignee_name,
         n.title, n.due_at,
         case when n.due_at < now() then 1 else 2 end,
         case when n.due_at < now() then '기한 초과' else '오늘 마감' end
  from next_actions n
  join deals d on d.id = n.deal_id
  left join organizations o on o.id = d.organization_id
  where n.status = 'open' and n.due_at < now() + interval '1 day'
    and d.outcome is null
    and (d.assignee_name = p_owner or p_owner is null)
  union all
  -- ③ 다음 행동이 아예 없는 진행 건
  select 'opportunity'::text, d.id, coalesce(o.name, d.list_fields->>'name','(현장명 없음)'), d.assignee_name,
         '다음 행동 지정'::text, null::timestamptz, 5, '다음 행동 없음'
  from deals d
  left join organizations o on o.id = d.organization_id
  where d.outcome is null and d.stage_code not in ('won','lost','badfit','nocontact')
    and (d.assignee_name = p_owner or p_owner is null)
    and not exists (select 1 from next_actions n where n.deal_id = d.id and n.status='open')
  order by 7, 6 nulls last
  limit 50
$function$
;

CREATE OR REPLACE FUNCTION public.today_tasks(p_rep text)
 RETURNS jsonb
 LANGUAGE sql
 SECURITY DEFINER
AS $function$
with done as (select ref from _done_today(p_rep)),
deal_base as (
  select d.id::text as ref, d.stage_code, d.amount, d.created_at,
         coalesce(o.name,'(현장)') as nm,
         (select c.phone from contacts c where c.organization_id=d.organization_id and c.phone is not null limit 1) as phone,
         extract(day from now()-d.created_at)::int as age
  from deals d left join organizations o on o.id=d.organization_id
  where d.brand is not null and d.assignee_name=p_rep
    and d.stage_code in ('compete','imminent','bidding','contract','construction','sent','rapport','silent','waiting')
    and d.id::text not in (select ref from done)
),
t1 as ( -- 경쟁·임박·입찰: 전부
  select 10 pri, ref, nm, phone, true call,
    case stage_code when 'compete' then '경쟁 PT — 대응 상황 확인' when 'imminent' then '공사 임박 — 회의·일정 확정' else '입찰 진행 — 결과·서류 확인' end why,
    coalesce(round(amount/1e8,1)||'억','금액 미입력') sub,
    '["😊 진행됨 — 다음 잡음","⏸ 다음주 다시","📵 못 받으심"]'::jsonb res
  from deal_base where stage_code in ('compete','imminent','bidding')),
t2 as ( -- 시공·계약 주간 체크 (금요일 개념 단순화: 항상 후보, 1건)
  select 20, ref, nm, phone, false,
    case stage_code when 'construction' then '시공 주간 현장 체크' else '계약 후 착공 준비 확인' end,
    coalesce(round(amount/1e8,1)||'억','') , '["✓ 이상 없음","⚠ 이슈 있음 — 메모","⏸ 다음에"]'::jsonb
  from deal_base where stage_code in ('contract','construction') order by created_at limit 2),
t3 as ( -- 발송 후속
  select 30, ref, nm, phone, true, '견적 보낸 뒤 무응답 — 확인 전화',
    coalesce(round(amount/1e8,1)||'억',''), '["😊 검토 중 — 미팅 잡음","⏸ 다음주 다시","📵 못 받으심"]'::jsonb
  from deal_base where stage_code='sent' order by created_at limit 2),
t4 as ( -- 유대·침묵 가장 오래된 1건
  select 40, ref, nm, phone, true, '오래 연락 못 함 — 안부·동향 전화',
    age||'일 만', '["😊 잘 지내심 — 동향 기록","⏸ 다음주 다시","📵 못 받으심"]'::jsonb
  from deal_base where stage_code in ('rapport','silent') order by created_at limit 1),
t5 as ( -- 대기 반기 재접촉 1건
  select 50, ref, nm, phone, true, '반기 재접촉 — 다시 관심 있으신지',
    age||'일 만', '["😊 재활성!","그대로 대기","📵 못 받으심"]'::jsonb
  from deal_base where stage_code='waiting' and age>180 order by created_at limit 1),
inq as ( -- 견적문의 기준일 초과 상위 2건
  select 15 pri, 'inq:'||i.sheet_row ref, coalesce(i.site_name,'(현장)') nm, i.phone, true call,
    '견적 문의 후속 — '||coalesce(i.status,'접수') why,
    coalesce(i.work_type,'') sub,
    '["😊 진행 — 다음 단계","⏸ 보류","📵 못 받으심"]'::jsonb res
  from inquiries i
  where i.assignee_name=p_rep and i.status not in ('수주','실주','배드핏','연락두절','종결','종료')
    and 'inq:'||i.sheet_row not in (select ref from done)
    and i.received_at < now() - interval '3 days'
  order by i.received_at limit 2)
select coalesce(jsonb_agg(jsonb_build_object('ref',ref,'why',why,'nm',nm,'sub',sub,'phone',phone,'call',call,'res',res) order by pri),'[]'::jsonb)
from (select * from t1 union all select * from inq union all select * from t2 union all
      select * from t3 union all select * from t4 union all select * from t5 limit 8) x
$function$
;

CREATE OR REPLACE FUNCTION public.today_counts()
 RETURNS jsonb
 LANGUAGE sql
 SECURITY DEFINER
AS $function$
select coalesce(jsonb_object_agg(r, n),'{}'::jsonb) from (
  select r, jsonb_array_length(today_tasks(r)) n
  from unnest(array['이필선','황윤선','한준엽','김성민','정정훈','조현식','조재연','한인규','서비스운영팀(송보람)']) r
) t where n>0
$function$
;

CREATE OR REPLACE FUNCTION public.crm_bundle()
 RETURNS json
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
select json_build_object(
 'generated_at', now(),
 -- 원본(003_rpc)과 같은 조건: brand 가 있는 딜만. grp 은 stage_catalog.display_group.
 -- v5 에서 추가된 필드만 얹는다. 여기서 조건을 바꾸면 잠재고객까지 섞여 화면 숫자가 전부 틀어진다.
 'deals', (select coalesce(jsonb_agg(jsonb_build_object(
     'id', d.id, 'brand', d.brand, 'list', d.list_name,
     -- 현장명: organizations 우선, 없으면 딜이 들고 있는 이름(기술자문 등 외부 유입분)
     -- 폴백이 없으면 기술자문 46건이 전부 «(현장 미연결)» 로 보인다
     'site', coalesce(o.name, nullif(d.list_fields->>'site_name',''), nullif(d.list_fields->>'name',''), '(현장 미연결)'),
     'stage', coalesce(sc.name, d.stage_raw, '(단계없음)'),
     'code', d.stage_code,
     'grp', coalesce(sc.display_group,'기타'),
     'assignee', d.assignee_name, 'amt', d.amount,
     'closed', d.closed_at, 'created', d.created_at,
     'updated', d.updated_at, 'lastActivity', d.last_activity_at,
     'stageChangedAt', d.stage_entered_at,
     'last_customer_contact_at', d.last_customer_contact_at,
     'outcome', d.outcome, 'lifecycle', d.lifecycle_status,
     'wake_up_at', d.wake_up_at, 'site_id', d.site_id, 'origin_inquiry_id', d.origin_inquiry_id,
     'nextAction', d.next_action, 'nextActionDate', coalesce(na.due_at::text, d.next_action_date::text), 'nextActionText', na.title, 'nextActionAssignee', na.assignee_name,
     'lostReason', d.lost_reason, 'lostKind', d.lost_kind, 'badfitType', d.badfit_type,
     -- 유입채널(안 바뀜) / 현재 사업유형 / 전환 이력
     'originChannel', d.origin_channel, 'serviceType', d.service_type,
     -- 사업유형 3축: 최초(안 바뀜) / 현재 / 전환 이력. 영업 Stage 와는 별개 축이다.
     'originBusiness', coalesce(d.origin_business, d.brand),
     'currentBusiness', coalesce(d.current_business, d.brand),
     'businessHistory', d.business_history,
     -- 기술자문으로 전환된 딜의 전용 정보 (계약업체·자문료·공사일정 …)
     'advisory', case when d.list_fields->>'advisory' = 'true' then d.list_fields else null end,
     'serviceHistory', d.service_history,
       'primaryWork', d.primary_work,
       'workItems', d.work_items,
       'workScopeType', d.work_scope_type,
       'workSummary', d.work_summary, 'contacts', public.crm_site_contacts(d.id), 'office_phone', d.office_phone, 'office_email', d.office_email, 'manager_name', d.manager_name, 'manager_mobile', d.manager_mobile, 'person_key', d.person_key, 'manager_role', d.manager_role, 'manager_current_site', d.manager_current_site, 'manager_started_at', d.manager_started_at, 'manager_status', d.manager_status, 'manager_left_at', d.manager_left_at)), '[]'::jsonb)
   from deals d
   left join stage_catalog sc on sc.code = d.stage_code
   left join organizations o on o.id = d.organization_id left join lateral (select na2.title, na2.due_at, na2.assignee_name from next_actions na2 where na2.deal_id = d.id and na2.status = 'open' order by na2.due_at asc nulls last limit 1) na on true
   -- 배드핏은 브랜드가 없어도 반드시 내려보낸다.
   -- 견적 배드핏(badfit_lead)은 잠재고객 단계에서 끝나 brand 가 없는데,
   -- brand 조건만 걸면 203건이 통째로 화면에서 사라진다 (실제로 «배드핏 0» 으로 보이던 원인).
   where d.brand is not null or d.stage_code in ('badfit_lead','badfit_pipe')),
 'brands', (select coalesce(jsonb_object_agg(b, c), '{}'::jsonb) from (
     select brand b, count(*) c from deals where brand is not null group by 1) t),
 'leads', (select coalesce(jsonb_object_agg(s, c), '{}'::jsonb) from (
     select coalesce(stage_raw,'기타') s, count(*) c from deals where list_name='잠재고객' group by 1) t),
 -- ★ 응대 이력 포함
 'inquiries', (select coalesce(jsonb_agg(jsonb_build_object(
     'id', i.id, 'row', i.sheet_row, 'brand', i.brand, 'site', i.site_name,
     'assignee', i.assignee_name, 'status', i.status, 'work', i.work_type,
     'src', i.source, 'at', i.received_at, 'phone', i.phone,
     'due', i.next_action_date, 'contact', i.contact_name,
     'site_id', i.site_id, 'first_response_at', i.first_response_at,
     'assigned_at', i.assigned_at,
     -- 접수 상세 (응대폼 원문)
     'detail', jsonb_build_object(
        'customerType', i.raw->>'고객유형', 'buildingType', i.raw->>'건물유형',
        'address', i.raw->>'건물주소', 'complex', i.raw->>'단지개요',
        'workType', i.raw->>'공사유형', 'inquiry', i.raw->>'문의내용',
        'channel', i.raw->>'상담채널', 'inflow', i.raw->>'유입경로',
        'office', i.raw->>'관리사무소', 'note', i.raw->>'특이사항',
        'assignComment', i.raw->>'배정 코멘트', 'closeReason', i.raw->>'종료사유'),
     -- 응대 이력 (시각순 분해)
     'responder', i.raw->>'전화응대자',
     'respondedAt', i.raw->>'응대완료일시',
     'responses', parse_responses(i.raw->>'응대내용'))
     order by i.sheet_row desc), '[]'::jsonb)
   from inquiries i),
 'dups', (select coalesce(jsonb_agg(g.j order by g.c desc), '[]'::jsonb) from (
   select v.cnt c, jsonb_build_object('norm', v.norm, 'cnt', v.cnt,
     'orgs', (select jsonb_agg(jsonb_build_object('id', o.id, 'name', o.name,
        'deals', (select coalesce(jsonb_agg(jsonb_build_object(
            'brand', coalesce(dd.brand, dd.list_name),
            'stage', coalesce(sc2.name, dd.stage_raw, '-'),
            'assignee', dd.assignee_name, 'amt', dd.amount, 'created', dd.created_at)
            order by dd.created_at), '[]'::jsonb)
          from deals dd left join stage_catalog sc2 on sc2.code = dd.stage_code
          where dd.organization_id = o.id),
        -- ⚠ notes 는 반드시 함께 내려보낸다. 빠지면 중복현장 화면이 o.notes.length 에서 죽고
        --    «데이터를 불러오지 못했습니다» 배너가 뜬다 (2026-09-02 회귀 복구)
        'notes', (select coalesce(jsonb_agg(t.n2), '[]'::jsonb) from (
            select jsonb_build_object('author', n.author_name, 'at', n.posted_at, 'body', left(n.body,400)) n2
            from notes n where n.organization_id = o.id
            order by n.posted_at desc nulls last limit 5) t)))
       from organizations o where o.id = any(v.ids))) j   -- organizations 에 norm_name 컬럼은 없다. v_dup_org 가 준 ids 로 직접 찾는다
   from v_dup_org v where v.norm not in ('테스트','(무제)')) g),
 'users', (select coalesce(jsonb_agg(jsonb_build_object(
     'id', user_id, 'name', name, 'role', role) order by name), '[]'::jsonb) from users where active)
)
$function$
;

-- 08: table triggers and original RLS/policies.

CREATE TRIGGER trg_adv_upd BEFORE UPDATE ON advisory_deals FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_contacts_upd BEFORE UPDATE ON contacts FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_deals_upd BEFORE UPDATE ON deals FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_inq_upd BEFORE UPDATE ON inquiries FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_next_actions_upd BEFORE UPDATE ON next_actions FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_organizations_upd BEFORE UPDATE ON organizations FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_projects_upd BEFORE UPDATE ON projects FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_users_upd BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE public."activities" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."activities" NO FORCE ROW LEVEL SECURITY;

ALTER TABLE public."advisory_deals" DISABLE ROW LEVEL SECURITY;

ALTER TABLE public."advisory_deals" NO FORCE ROW LEVEL SECURITY;

ALTER TABLE public."assignment_history" DISABLE ROW LEVEL SECURITY;

ALTER TABLE public."assignment_history" NO FORCE ROW LEVEL SECURITY;

ALTER TABLE public."audit_logs" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."audit_logs" NO FORCE ROW LEVEL SECURITY;

ALTER TABLE public."business_history" DISABLE ROW LEVEL SECURITY;

ALTER TABLE public."business_history" NO FORCE ROW LEVEL SECURITY;

ALTER TABLE public."contact_assignments" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."contact_assignments" NO FORCE ROW LEVEL SECURITY;

ALTER TABLE public."contacts" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."contacts" NO FORCE ROW LEVEL SECURITY;

ALTER TABLE public."dashboard_state" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."dashboard_state" NO FORCE ROW LEVEL SECURITY;

ALTER TABLE public."deals" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."deals" NO FORCE ROW LEVEL SECURITY;

ALTER TABLE public."inquiries" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."inquiries" NO FORCE ROW LEVEL SECURITY;

ALTER TABLE public."next_actions" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."next_actions" NO FORCE ROW LEVEL SECURITY;

ALTER TABLE public."notes" DISABLE ROW LEVEL SECURITY;

ALTER TABLE public."notes" NO FORCE ROW LEVEL SECURITY;

ALTER TABLE public."organizations" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."organizations" NO FORCE ROW LEVEL SECURITY;

ALTER TABLE public."projects" DISABLE ROW LEVEL SECURITY;

ALTER TABLE public."projects" NO FORCE ROW LEVEL SECURITY;

ALTER TABLE public."sites" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."sites" NO FORCE ROW LEVEL SECURITY;

ALTER TABLE public."stage_catalog" DISABLE ROW LEVEL SECURITY;

ALTER TABLE public."stage_catalog" NO FORCE ROW LEVEL SECURITY;

ALTER TABLE public."stage_history" DISABLE ROW LEVEL SECURITY;

ALTER TABLE public."stage_history" NO FORCE ROW LEVEL SECURITY;

ALTER TABLE public."users" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."users" NO FORCE ROW LEVEL SECURITY;

CREATE POLICY "allow all" ON public."dashboard_state" AS PERMISSIVE FOR ALL TO PUBLIC USING (true) WITH CHECK (true);

CREATE POLICY "own row read" ON public."users" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((lower(email) = lower((auth.jwt() ->> 'email'::text))));

-- 09: owner and EXACT original ACLs. These reopen the known insecure paths.

ALTER TABLE public."activities" OWNER TO "postgres";

REVOKE ALL ON TABLE public."activities" FROM PUBLIC,"postgres","anon","authenticated","service_role";
SET LOCAL ROLE "postgres";
GRANT INSERT ON TABLE public."activities" TO "postgres";
GRANT SELECT ON TABLE public."activities" TO "postgres";
GRANT UPDATE ON TABLE public."activities" TO "postgres";
GRANT DELETE ON TABLE public."activities" TO "postgres";
GRANT TRUNCATE ON TABLE public."activities" TO "postgres";
GRANT REFERENCES ON TABLE public."activities" TO "postgres";
GRANT TRIGGER ON TABLE public."activities" TO "postgres";
GRANT MAINTAIN ON TABLE public."activities" TO "postgres";
SET LOCAL ROLE "postgres";
GRANT INSERT ON TABLE public."activities" TO "anon";
GRANT SELECT ON TABLE public."activities" TO "anon";
GRANT UPDATE ON TABLE public."activities" TO "anon";
GRANT DELETE ON TABLE public."activities" TO "anon";
GRANT TRUNCATE ON TABLE public."activities" TO "anon";
GRANT REFERENCES ON TABLE public."activities" TO "anon";
GRANT TRIGGER ON TABLE public."activities" TO "anon";
GRANT MAINTAIN ON TABLE public."activities" TO "anon";
SET LOCAL ROLE "postgres";
GRANT INSERT ON TABLE public."activities" TO "authenticated";
GRANT SELECT ON TABLE public."activities" TO "authenticated";
GRANT UPDATE ON TABLE public."activities" TO "authenticated";
GRANT DELETE ON TABLE public."activities" TO "authenticated";
GRANT TRUNCATE ON TABLE public."activities" TO "authenticated";
GRANT REFERENCES ON TABLE public."activities" TO "authenticated";
GRANT TRIGGER ON TABLE public."activities" TO "authenticated";
GRANT MAINTAIN ON TABLE public."activities" TO "authenticated";
SET LOCAL ROLE "postgres";
GRANT INSERT ON TABLE public."activities" TO "service_role";
GRANT SELECT ON TABLE public."activities" TO "service_role";
GRANT UPDATE ON TABLE public."activities" TO "service_role";
GRANT DELETE ON TABLE public."activities" TO "service_role";
GRANT TRUNCATE ON TABLE public."activities" TO "service_role";
GRANT REFERENCES ON TABLE public."activities" TO "service_role";
GRANT TRIGGER ON TABLE public."activities" TO "service_role";
GRANT MAINTAIN ON TABLE public."activities" TO "service_role";
SET LOCAL ROLE postgres;

ALTER TABLE public."advisory_deals" OWNER TO "postgres";

REVOKE ALL ON TABLE public."advisory_deals" FROM PUBLIC,"postgres","anon","authenticated","service_role";
SET LOCAL ROLE "postgres";
GRANT INSERT ON TABLE public."advisory_deals" TO "postgres";
GRANT SELECT ON TABLE public."advisory_deals" TO "postgres";
GRANT UPDATE ON TABLE public."advisory_deals" TO "postgres";
GRANT DELETE ON TABLE public."advisory_deals" TO "postgres";
GRANT TRUNCATE ON TABLE public."advisory_deals" TO "postgres";
GRANT REFERENCES ON TABLE public."advisory_deals" TO "postgres";
GRANT TRIGGER ON TABLE public."advisory_deals" TO "postgres";
GRANT MAINTAIN ON TABLE public."advisory_deals" TO "postgres";
SET LOCAL ROLE "postgres";
GRANT INSERT ON TABLE public."advisory_deals" TO "anon";
GRANT SELECT ON TABLE public."advisory_deals" TO "anon";
GRANT UPDATE ON TABLE public."advisory_deals" TO "anon";
GRANT DELETE ON TABLE public."advisory_deals" TO "anon";
GRANT TRUNCATE ON TABLE public."advisory_deals" TO "anon";
GRANT REFERENCES ON TABLE public."advisory_deals" TO "anon";
GRANT TRIGGER ON TABLE public."advisory_deals" TO "anon";
GRANT MAINTAIN ON TABLE public."advisory_deals" TO "anon";
SET LOCAL ROLE "postgres";
GRANT INSERT ON TABLE public."advisory_deals" TO "authenticated";
GRANT SELECT ON TABLE public."advisory_deals" TO "authenticated";
GRANT UPDATE ON TABLE public."advisory_deals" TO "authenticated";
GRANT DELETE ON TABLE public."advisory_deals" TO "authenticated";
GRANT TRUNCATE ON TABLE public."advisory_deals" TO "authenticated";
GRANT REFERENCES ON TABLE public."advisory_deals" TO "authenticated";
GRANT TRIGGER ON TABLE public."advisory_deals" TO "authenticated";
GRANT MAINTAIN ON TABLE public."advisory_deals" TO "authenticated";
SET LOCAL ROLE "postgres";
GRANT INSERT ON TABLE public."advisory_deals" TO "service_role";
GRANT SELECT ON TABLE public."advisory_deals" TO "service_role";
GRANT UPDATE ON TABLE public."advisory_deals" TO "service_role";
GRANT DELETE ON TABLE public."advisory_deals" TO "service_role";
GRANT TRUNCATE ON TABLE public."advisory_deals" TO "service_role";
GRANT REFERENCES ON TABLE public."advisory_deals" TO "service_role";
GRANT TRIGGER ON TABLE public."advisory_deals" TO "service_role";
GRANT MAINTAIN ON TABLE public."advisory_deals" TO "service_role";
SET LOCAL ROLE postgres;

ALTER TABLE public."assignment_history" OWNER TO "postgres";

REVOKE ALL ON TABLE public."assignment_history" FROM PUBLIC,"postgres","anon","authenticated","service_role";
SET LOCAL ROLE "postgres";
GRANT INSERT ON TABLE public."assignment_history" TO "postgres";
GRANT SELECT ON TABLE public."assignment_history" TO "postgres";
GRANT UPDATE ON TABLE public."assignment_history" TO "postgres";
GRANT DELETE ON TABLE public."assignment_history" TO "postgres";
GRANT TRUNCATE ON TABLE public."assignment_history" TO "postgres";
GRANT REFERENCES ON TABLE public."assignment_history" TO "postgres";
GRANT TRIGGER ON TABLE public."assignment_history" TO "postgres";
GRANT MAINTAIN ON TABLE public."assignment_history" TO "postgres";
SET LOCAL ROLE "postgres";
GRANT INSERT ON TABLE public."assignment_history" TO "anon";
GRANT SELECT ON TABLE public."assignment_history" TO "anon";
GRANT UPDATE ON TABLE public."assignment_history" TO "anon";
GRANT DELETE ON TABLE public."assignment_history" TO "anon";
GRANT TRUNCATE ON TABLE public."assignment_history" TO "anon";
GRANT REFERENCES ON TABLE public."assignment_history" TO "anon";
GRANT TRIGGER ON TABLE public."assignment_history" TO "anon";
GRANT MAINTAIN ON TABLE public."assignment_history" TO "anon";
SET LOCAL ROLE "postgres";
GRANT INSERT ON TABLE public."assignment_history" TO "authenticated";
GRANT SELECT ON TABLE public."assignment_history" TO "authenticated";
GRANT UPDATE ON TABLE public."assignment_history" TO "authenticated";
GRANT DELETE ON TABLE public."assignment_history" TO "authenticated";
GRANT TRUNCATE ON TABLE public."assignment_history" TO "authenticated";
GRANT REFERENCES ON TABLE public."assignment_history" TO "authenticated";
GRANT TRIGGER ON TABLE public."assignment_history" TO "authenticated";
GRANT MAINTAIN ON TABLE public."assignment_history" TO "authenticated";
SET LOCAL ROLE "postgres";
GRANT INSERT ON TABLE public."assignment_history" TO "service_role";
GRANT SELECT ON TABLE public."assignment_history" TO "service_role";
GRANT UPDATE ON TABLE public."assignment_history" TO "service_role";
GRANT DELETE ON TABLE public."assignment_history" TO "service_role";
GRANT TRUNCATE ON TABLE public."assignment_history" TO "service_role";
GRANT REFERENCES ON TABLE public."assignment_history" TO "service_role";
GRANT TRIGGER ON TABLE public."assignment_history" TO "service_role";
GRANT MAINTAIN ON TABLE public."assignment_history" TO "service_role";
SET LOCAL ROLE postgres;

ALTER TABLE public."audit_logs" OWNER TO "postgres";

REVOKE ALL ON TABLE public."audit_logs" FROM PUBLIC,"postgres","anon","authenticated","service_role";
SET LOCAL ROLE "postgres";
GRANT INSERT ON TABLE public."audit_logs" TO "postgres";
GRANT SELECT ON TABLE public."audit_logs" TO "postgres";
GRANT UPDATE ON TABLE public."audit_logs" TO "postgres";
GRANT DELETE ON TABLE public."audit_logs" TO "postgres";
GRANT TRUNCATE ON TABLE public."audit_logs" TO "postgres";
GRANT REFERENCES ON TABLE public."audit_logs" TO "postgres";
GRANT TRIGGER ON TABLE public."audit_logs" TO "postgres";
GRANT MAINTAIN ON TABLE public."audit_logs" TO "postgres";
SET LOCAL ROLE "postgres";
GRANT INSERT ON TABLE public."audit_logs" TO "anon";
GRANT SELECT ON TABLE public."audit_logs" TO "anon";
GRANT UPDATE ON TABLE public."audit_logs" TO "anon";
GRANT DELETE ON TABLE public."audit_logs" TO "anon";
GRANT TRUNCATE ON TABLE public."audit_logs" TO "anon";
GRANT REFERENCES ON TABLE public."audit_logs" TO "anon";
GRANT TRIGGER ON TABLE public."audit_logs" TO "anon";
GRANT MAINTAIN ON TABLE public."audit_logs" TO "anon";
SET LOCAL ROLE "postgres";
GRANT INSERT ON TABLE public."audit_logs" TO "authenticated";
GRANT SELECT ON TABLE public."audit_logs" TO "authenticated";
GRANT UPDATE ON TABLE public."audit_logs" TO "authenticated";
GRANT DELETE ON TABLE public."audit_logs" TO "authenticated";
GRANT TRUNCATE ON TABLE public."audit_logs" TO "authenticated";
GRANT REFERENCES ON TABLE public."audit_logs" TO "authenticated";
GRANT TRIGGER ON TABLE public."audit_logs" TO "authenticated";
GRANT MAINTAIN ON TABLE public."audit_logs" TO "authenticated";
SET LOCAL ROLE "postgres";
GRANT INSERT ON TABLE public."audit_logs" TO "service_role";
GRANT SELECT ON TABLE public."audit_logs" TO "service_role";
GRANT UPDATE ON TABLE public."audit_logs" TO "service_role";
GRANT DELETE ON TABLE public."audit_logs" TO "service_role";
GRANT TRUNCATE ON TABLE public."audit_logs" TO "service_role";
GRANT REFERENCES ON TABLE public."audit_logs" TO "service_role";
GRANT TRIGGER ON TABLE public."audit_logs" TO "service_role";
GRANT MAINTAIN ON TABLE public."audit_logs" TO "service_role";
SET LOCAL ROLE postgres;

ALTER TABLE public."business_history" OWNER TO "postgres";

REVOKE ALL ON TABLE public."business_history" FROM PUBLIC,"postgres","anon","authenticated","service_role";
SET LOCAL ROLE "postgres";
GRANT INSERT ON TABLE public."business_history" TO "postgres";
GRANT SELECT ON TABLE public."business_history" TO "postgres";
GRANT UPDATE ON TABLE public."business_history" TO "postgres";
GRANT DELETE ON TABLE public."business_history" TO "postgres";
GRANT TRUNCATE ON TABLE public."business_history" TO "postgres";
GRANT REFERENCES ON TABLE public."business_history" TO "postgres";
GRANT TRIGGER ON TABLE public."business_history" TO "postgres";
GRANT MAINTAIN ON TABLE public."business_history" TO "postgres";
SET LOCAL ROLE "postgres";
GRANT INSERT ON TABLE public."business_history" TO "anon";
GRANT SELECT ON TABLE public."business_history" TO "anon";
GRANT UPDATE ON TABLE public."business_history" TO "anon";
GRANT DELETE ON TABLE public."business_history" TO "anon";
GRANT TRUNCATE ON TABLE public."business_history" TO "anon";
GRANT REFERENCES ON TABLE public."business_history" TO "anon";
GRANT TRIGGER ON TABLE public."business_history" TO "anon";
GRANT MAINTAIN ON TABLE public."business_history" TO "anon";
SET LOCAL ROLE "postgres";
GRANT INSERT ON TABLE public."business_history" TO "authenticated";
GRANT SELECT ON TABLE public."business_history" TO "authenticated";
GRANT UPDATE ON TABLE public."business_history" TO "authenticated";
GRANT DELETE ON TABLE public."business_history" TO "authenticated";
GRANT TRUNCATE ON TABLE public."business_history" TO "authenticated";
GRANT REFERENCES ON TABLE public."business_history" TO "authenticated";
GRANT TRIGGER ON TABLE public."business_history" TO "authenticated";
GRANT MAINTAIN ON TABLE public."business_history" TO "authenticated";
SET LOCAL ROLE "postgres";
GRANT INSERT ON TABLE public."business_history" TO "service_role";
GRANT SELECT ON TABLE public."business_history" TO "service_role";
GRANT UPDATE ON TABLE public."business_history" TO "service_role";
GRANT DELETE ON TABLE public."business_history" TO "service_role";
GRANT TRUNCATE ON TABLE public."business_history" TO "service_role";
GRANT REFERENCES ON TABLE public."business_history" TO "service_role";
GRANT TRIGGER ON TABLE public."business_history" TO "service_role";
GRANT MAINTAIN ON TABLE public."business_history" TO "service_role";
SET LOCAL ROLE postgres;

ALTER SEQUENCE public."business_history_id_seq" OWNER TO "postgres";

REVOKE ALL ON SEQUENCE public."business_history_id_seq" FROM PUBLIC,"postgres","anon","authenticated","service_role";
SET LOCAL ROLE "postgres";
GRANT SELECT ON SEQUENCE public."business_history_id_seq" TO "postgres";
GRANT UPDATE ON SEQUENCE public."business_history_id_seq" TO "postgres";
GRANT USAGE ON SEQUENCE public."business_history_id_seq" TO "postgres";
SET LOCAL ROLE "postgres";
GRANT SELECT ON SEQUENCE public."business_history_id_seq" TO "anon";
GRANT UPDATE ON SEQUENCE public."business_history_id_seq" TO "anon";
GRANT USAGE ON SEQUENCE public."business_history_id_seq" TO "anon";
SET LOCAL ROLE "postgres";
GRANT SELECT ON SEQUENCE public."business_history_id_seq" TO "authenticated";
GRANT UPDATE ON SEQUENCE public."business_history_id_seq" TO "authenticated";
GRANT USAGE ON SEQUENCE public."business_history_id_seq" TO "authenticated";
SET LOCAL ROLE "postgres";
GRANT SELECT ON SEQUENCE public."business_history_id_seq" TO "service_role";
GRANT UPDATE ON SEQUENCE public."business_history_id_seq" TO "service_role";
GRANT USAGE ON SEQUENCE public."business_history_id_seq" TO "service_role";
SET LOCAL ROLE postgres;

ALTER TABLE public."contact_assignments" OWNER TO "postgres";

REVOKE ALL ON TABLE public."contact_assignments" FROM PUBLIC,"postgres","anon","authenticated","service_role";
SET LOCAL ROLE "postgres";
GRANT INSERT ON TABLE public."contact_assignments" TO "postgres";
GRANT SELECT ON TABLE public."contact_assignments" TO "postgres";
GRANT UPDATE ON TABLE public."contact_assignments" TO "postgres";
GRANT DELETE ON TABLE public."contact_assignments" TO "postgres";
GRANT TRUNCATE ON TABLE public."contact_assignments" TO "postgres";
GRANT REFERENCES ON TABLE public."contact_assignments" TO "postgres";
GRANT TRIGGER ON TABLE public."contact_assignments" TO "postgres";
GRANT MAINTAIN ON TABLE public."contact_assignments" TO "postgres";
SET LOCAL ROLE "postgres";
GRANT INSERT ON TABLE public."contact_assignments" TO "anon";
GRANT SELECT ON TABLE public."contact_assignments" TO "anon";
GRANT UPDATE ON TABLE public."contact_assignments" TO "anon";
GRANT DELETE ON TABLE public."contact_assignments" TO "anon";
GRANT TRUNCATE ON TABLE public."contact_assignments" TO "anon";
GRANT REFERENCES ON TABLE public."contact_assignments" TO "anon";
GRANT TRIGGER ON TABLE public."contact_assignments" TO "anon";
GRANT MAINTAIN ON TABLE public."contact_assignments" TO "anon";
SET LOCAL ROLE "postgres";
GRANT INSERT ON TABLE public."contact_assignments" TO "authenticated";
GRANT SELECT ON TABLE public."contact_assignments" TO "authenticated";
GRANT UPDATE ON TABLE public."contact_assignments" TO "authenticated";
GRANT DELETE ON TABLE public."contact_assignments" TO "authenticated";
GRANT TRUNCATE ON TABLE public."contact_assignments" TO "authenticated";
GRANT REFERENCES ON TABLE public."contact_assignments" TO "authenticated";
GRANT TRIGGER ON TABLE public."contact_assignments" TO "authenticated";
GRANT MAINTAIN ON TABLE public."contact_assignments" TO "authenticated";
SET LOCAL ROLE "postgres";
GRANT INSERT ON TABLE public."contact_assignments" TO "service_role";
GRANT SELECT ON TABLE public."contact_assignments" TO "service_role";
GRANT UPDATE ON TABLE public."contact_assignments" TO "service_role";
GRANT DELETE ON TABLE public."contact_assignments" TO "service_role";
GRANT TRUNCATE ON TABLE public."contact_assignments" TO "service_role";
GRANT REFERENCES ON TABLE public."contact_assignments" TO "service_role";
GRANT TRIGGER ON TABLE public."contact_assignments" TO "service_role";
GRANT MAINTAIN ON TABLE public."contact_assignments" TO "service_role";
SET LOCAL ROLE postgres;

ALTER TABLE public."contacts" OWNER TO "postgres";

REVOKE ALL ON TABLE public."contacts" FROM PUBLIC,"postgres","anon","authenticated","service_role";
SET LOCAL ROLE "postgres";
GRANT INSERT ON TABLE public."contacts" TO "postgres";
GRANT SELECT ON TABLE public."contacts" TO "postgres";
GRANT UPDATE ON TABLE public."contacts" TO "postgres";
GRANT DELETE ON TABLE public."contacts" TO "postgres";
GRANT TRUNCATE ON TABLE public."contacts" TO "postgres";
GRANT REFERENCES ON TABLE public."contacts" TO "postgres";
GRANT TRIGGER ON TABLE public."contacts" TO "postgres";
GRANT MAINTAIN ON TABLE public."contacts" TO "postgres";
SET LOCAL ROLE "postgres";
GRANT INSERT ON TABLE public."contacts" TO "anon";
GRANT SELECT ON TABLE public."contacts" TO "anon";
GRANT UPDATE ON TABLE public."contacts" TO "anon";
GRANT DELETE ON TABLE public."contacts" TO "anon";
GRANT TRUNCATE ON TABLE public."contacts" TO "anon";
GRANT REFERENCES ON TABLE public."contacts" TO "anon";
GRANT TRIGGER ON TABLE public."contacts" TO "anon";
GRANT MAINTAIN ON TABLE public."contacts" TO "anon";
SET LOCAL ROLE "postgres";
GRANT INSERT ON TABLE public."contacts" TO "authenticated";
GRANT SELECT ON TABLE public."contacts" TO "authenticated";
GRANT UPDATE ON TABLE public."contacts" TO "authenticated";
GRANT DELETE ON TABLE public."contacts" TO "authenticated";
GRANT TRUNCATE ON TABLE public."contacts" TO "authenticated";
GRANT REFERENCES ON TABLE public."contacts" TO "authenticated";
GRANT TRIGGER ON TABLE public."contacts" TO "authenticated";
GRANT MAINTAIN ON TABLE public."contacts" TO "authenticated";
SET LOCAL ROLE "postgres";
GRANT INSERT ON TABLE public."contacts" TO "service_role";
GRANT SELECT ON TABLE public."contacts" TO "service_role";
GRANT UPDATE ON TABLE public."contacts" TO "service_role";
GRANT DELETE ON TABLE public."contacts" TO "service_role";
GRANT TRUNCATE ON TABLE public."contacts" TO "service_role";
GRANT REFERENCES ON TABLE public."contacts" TO "service_role";
GRANT TRIGGER ON TABLE public."contacts" TO "service_role";
GRANT MAINTAIN ON TABLE public."contacts" TO "service_role";
SET LOCAL ROLE postgres;

ALTER TABLE public."dashboard_state" OWNER TO "postgres";

REVOKE ALL ON TABLE public."dashboard_state" FROM PUBLIC,"postgres","anon","authenticated","service_role";
SET LOCAL ROLE "postgres";
GRANT INSERT ON TABLE public."dashboard_state" TO "postgres";
GRANT SELECT ON TABLE public."dashboard_state" TO "postgres";
GRANT UPDATE ON TABLE public."dashboard_state" TO "postgres";
GRANT DELETE ON TABLE public."dashboard_state" TO "postgres";
GRANT TRUNCATE ON TABLE public."dashboard_state" TO "postgres";
GRANT REFERENCES ON TABLE public."dashboard_state" TO "postgres";
GRANT TRIGGER ON TABLE public."dashboard_state" TO "postgres";
GRANT MAINTAIN ON TABLE public."dashboard_state" TO "postgres";
SET LOCAL ROLE "postgres";
GRANT INSERT ON TABLE public."dashboard_state" TO "anon";
GRANT SELECT ON TABLE public."dashboard_state" TO "anon";
GRANT UPDATE ON TABLE public."dashboard_state" TO "anon";
GRANT DELETE ON TABLE public."dashboard_state" TO "anon";
GRANT TRUNCATE ON TABLE public."dashboard_state" TO "anon";
GRANT REFERENCES ON TABLE public."dashboard_state" TO "anon";
GRANT TRIGGER ON TABLE public."dashboard_state" TO "anon";
GRANT MAINTAIN ON TABLE public."dashboard_state" TO "anon";
SET LOCAL ROLE "postgres";
GRANT INSERT ON TABLE public."dashboard_state" TO "authenticated";
GRANT SELECT ON TABLE public."dashboard_state" TO "authenticated";
GRANT UPDATE ON TABLE public."dashboard_state" TO "authenticated";
GRANT DELETE ON TABLE public."dashboard_state" TO "authenticated";
GRANT TRUNCATE ON TABLE public."dashboard_state" TO "authenticated";
GRANT REFERENCES ON TABLE public."dashboard_state" TO "authenticated";
GRANT TRIGGER ON TABLE public."dashboard_state" TO "authenticated";
GRANT MAINTAIN ON TABLE public."dashboard_state" TO "authenticated";
SET LOCAL ROLE "postgres";
GRANT INSERT ON TABLE public."dashboard_state" TO "service_role";
GRANT SELECT ON TABLE public."dashboard_state" TO "service_role";
GRANT UPDATE ON TABLE public."dashboard_state" TO "service_role";
GRANT DELETE ON TABLE public."dashboard_state" TO "service_role";
GRANT TRUNCATE ON TABLE public."dashboard_state" TO "service_role";
GRANT REFERENCES ON TABLE public."dashboard_state" TO "service_role";
GRANT TRIGGER ON TABLE public."dashboard_state" TO "service_role";
GRANT MAINTAIN ON TABLE public."dashboard_state" TO "service_role";
SET LOCAL ROLE postgres;

ALTER TABLE public."deals" OWNER TO "postgres";

REVOKE ALL ON TABLE public."deals" FROM PUBLIC,"postgres","anon","authenticated","service_role";
SET LOCAL ROLE "postgres";
GRANT INSERT ON TABLE public."deals" TO "postgres";
GRANT SELECT ON TABLE public."deals" TO "postgres";
GRANT UPDATE ON TABLE public."deals" TO "postgres";
GRANT DELETE ON TABLE public."deals" TO "postgres";
GRANT TRUNCATE ON TABLE public."deals" TO "postgres";
GRANT REFERENCES ON TABLE public."deals" TO "postgres";
GRANT TRIGGER ON TABLE public."deals" TO "postgres";
GRANT MAINTAIN ON TABLE public."deals" TO "postgres";
SET LOCAL ROLE "postgres";
GRANT INSERT ON TABLE public."deals" TO "anon";
GRANT SELECT ON TABLE public."deals" TO "anon";
GRANT UPDATE ON TABLE public."deals" TO "anon";
GRANT DELETE ON TABLE public."deals" TO "anon";
GRANT TRUNCATE ON TABLE public."deals" TO "anon";
GRANT REFERENCES ON TABLE public."deals" TO "anon";
GRANT TRIGGER ON TABLE public."deals" TO "anon";
GRANT MAINTAIN ON TABLE public."deals" TO "anon";
SET LOCAL ROLE "postgres";
GRANT INSERT ON TABLE public."deals" TO "authenticated";
GRANT SELECT ON TABLE public."deals" TO "authenticated";
GRANT UPDATE ON TABLE public."deals" TO "authenticated";
GRANT DELETE ON TABLE public."deals" TO "authenticated";
GRANT TRUNCATE ON TABLE public."deals" TO "authenticated";
GRANT REFERENCES ON TABLE public."deals" TO "authenticated";
GRANT TRIGGER ON TABLE public."deals" TO "authenticated";
GRANT MAINTAIN ON TABLE public."deals" TO "authenticated";
SET LOCAL ROLE "postgres";
GRANT INSERT ON TABLE public."deals" TO "service_role";
GRANT SELECT ON TABLE public."deals" TO "service_role";
GRANT UPDATE ON TABLE public."deals" TO "service_role";
GRANT DELETE ON TABLE public."deals" TO "service_role";
GRANT TRUNCATE ON TABLE public."deals" TO "service_role";
GRANT REFERENCES ON TABLE public."deals" TO "service_role";
GRANT TRIGGER ON TABLE public."deals" TO "service_role";
GRANT MAINTAIN ON TABLE public."deals" TO "service_role";
SET LOCAL ROLE postgres;

ALTER TABLE public."inquiries" OWNER TO "postgres";

REVOKE ALL ON TABLE public."inquiries" FROM PUBLIC,"postgres","anon","authenticated","service_role";
SET LOCAL ROLE "postgres";
GRANT INSERT ON TABLE public."inquiries" TO "postgres";
GRANT SELECT ON TABLE public."inquiries" TO "postgres";
GRANT UPDATE ON TABLE public."inquiries" TO "postgres";
GRANT DELETE ON TABLE public."inquiries" TO "postgres";
GRANT TRUNCATE ON TABLE public."inquiries" TO "postgres";
GRANT REFERENCES ON TABLE public."inquiries" TO "postgres";
GRANT TRIGGER ON TABLE public."inquiries" TO "postgres";
GRANT MAINTAIN ON TABLE public."inquiries" TO "postgres";
SET LOCAL ROLE "postgres";
GRANT INSERT ON TABLE public."inquiries" TO "anon";
GRANT SELECT ON TABLE public."inquiries" TO "anon";
GRANT UPDATE ON TABLE public."inquiries" TO "anon";
GRANT DELETE ON TABLE public."inquiries" TO "anon";
GRANT TRUNCATE ON TABLE public."inquiries" TO "anon";
GRANT REFERENCES ON TABLE public."inquiries" TO "anon";
GRANT TRIGGER ON TABLE public."inquiries" TO "anon";
GRANT MAINTAIN ON TABLE public."inquiries" TO "anon";
SET LOCAL ROLE "postgres";
GRANT INSERT ON TABLE public."inquiries" TO "authenticated";
GRANT SELECT ON TABLE public."inquiries" TO "authenticated";
GRANT UPDATE ON TABLE public."inquiries" TO "authenticated";
GRANT DELETE ON TABLE public."inquiries" TO "authenticated";
GRANT TRUNCATE ON TABLE public."inquiries" TO "authenticated";
GRANT REFERENCES ON TABLE public."inquiries" TO "authenticated";
GRANT TRIGGER ON TABLE public."inquiries" TO "authenticated";
GRANT MAINTAIN ON TABLE public."inquiries" TO "authenticated";
SET LOCAL ROLE "postgres";
GRANT INSERT ON TABLE public."inquiries" TO "service_role";
GRANT SELECT ON TABLE public."inquiries" TO "service_role";
GRANT UPDATE ON TABLE public."inquiries" TO "service_role";
GRANT DELETE ON TABLE public."inquiries" TO "service_role";
GRANT TRUNCATE ON TABLE public."inquiries" TO "service_role";
GRANT REFERENCES ON TABLE public."inquiries" TO "service_role";
GRANT TRIGGER ON TABLE public."inquiries" TO "service_role";
GRANT MAINTAIN ON TABLE public."inquiries" TO "service_role";
SET LOCAL ROLE postgres;

ALTER TABLE public."next_actions" OWNER TO "postgres";

REVOKE ALL ON TABLE public."next_actions" FROM PUBLIC,"postgres","anon","authenticated","service_role";
SET LOCAL ROLE "postgres";
GRANT INSERT ON TABLE public."next_actions" TO "postgres";
GRANT SELECT ON TABLE public."next_actions" TO "postgres";
GRANT UPDATE ON TABLE public."next_actions" TO "postgres";
GRANT DELETE ON TABLE public."next_actions" TO "postgres";
GRANT TRUNCATE ON TABLE public."next_actions" TO "postgres";
GRANT REFERENCES ON TABLE public."next_actions" TO "postgres";
GRANT TRIGGER ON TABLE public."next_actions" TO "postgres";
GRANT MAINTAIN ON TABLE public."next_actions" TO "postgres";
SET LOCAL ROLE "postgres";
GRANT INSERT ON TABLE public."next_actions" TO "anon";
GRANT SELECT ON TABLE public."next_actions" TO "anon";
GRANT UPDATE ON TABLE public."next_actions" TO "anon";
GRANT DELETE ON TABLE public."next_actions" TO "anon";
GRANT TRUNCATE ON TABLE public."next_actions" TO "anon";
GRANT REFERENCES ON TABLE public."next_actions" TO "anon";
GRANT TRIGGER ON TABLE public."next_actions" TO "anon";
GRANT MAINTAIN ON TABLE public."next_actions" TO "anon";
SET LOCAL ROLE "postgres";
GRANT INSERT ON TABLE public."next_actions" TO "authenticated";
GRANT SELECT ON TABLE public."next_actions" TO "authenticated";
GRANT UPDATE ON TABLE public."next_actions" TO "authenticated";
GRANT DELETE ON TABLE public."next_actions" TO "authenticated";
GRANT TRUNCATE ON TABLE public."next_actions" TO "authenticated";
GRANT REFERENCES ON TABLE public."next_actions" TO "authenticated";
GRANT TRIGGER ON TABLE public."next_actions" TO "authenticated";
GRANT MAINTAIN ON TABLE public."next_actions" TO "authenticated";
SET LOCAL ROLE "postgres";
GRANT INSERT ON TABLE public."next_actions" TO "service_role";
GRANT SELECT ON TABLE public."next_actions" TO "service_role";
GRANT UPDATE ON TABLE public."next_actions" TO "service_role";
GRANT DELETE ON TABLE public."next_actions" TO "service_role";
GRANT TRUNCATE ON TABLE public."next_actions" TO "service_role";
GRANT REFERENCES ON TABLE public."next_actions" TO "service_role";
GRANT TRIGGER ON TABLE public."next_actions" TO "service_role";
GRANT MAINTAIN ON TABLE public."next_actions" TO "service_role";
SET LOCAL ROLE postgres;

ALTER TABLE public."notes" OWNER TO "postgres";

REVOKE ALL ON TABLE public."notes" FROM PUBLIC,"postgres","anon","authenticated","service_role";
SET LOCAL ROLE "postgres";
GRANT INSERT ON TABLE public."notes" TO "postgres";
GRANT SELECT ON TABLE public."notes" TO "postgres";
GRANT UPDATE ON TABLE public."notes" TO "postgres";
GRANT DELETE ON TABLE public."notes" TO "postgres";
GRANT TRUNCATE ON TABLE public."notes" TO "postgres";
GRANT REFERENCES ON TABLE public."notes" TO "postgres";
GRANT TRIGGER ON TABLE public."notes" TO "postgres";
GRANT MAINTAIN ON TABLE public."notes" TO "postgres";
SET LOCAL ROLE "postgres";
GRANT INSERT ON TABLE public."notes" TO "anon";
GRANT SELECT ON TABLE public."notes" TO "anon";
GRANT UPDATE ON TABLE public."notes" TO "anon";
GRANT DELETE ON TABLE public."notes" TO "anon";
GRANT TRUNCATE ON TABLE public."notes" TO "anon";
GRANT REFERENCES ON TABLE public."notes" TO "anon";
GRANT TRIGGER ON TABLE public."notes" TO "anon";
GRANT MAINTAIN ON TABLE public."notes" TO "anon";
SET LOCAL ROLE "postgres";
GRANT INSERT ON TABLE public."notes" TO "authenticated";
GRANT SELECT ON TABLE public."notes" TO "authenticated";
GRANT UPDATE ON TABLE public."notes" TO "authenticated";
GRANT DELETE ON TABLE public."notes" TO "authenticated";
GRANT TRUNCATE ON TABLE public."notes" TO "authenticated";
GRANT REFERENCES ON TABLE public."notes" TO "authenticated";
GRANT TRIGGER ON TABLE public."notes" TO "authenticated";
GRANT MAINTAIN ON TABLE public."notes" TO "authenticated";
SET LOCAL ROLE "postgres";
GRANT INSERT ON TABLE public."notes" TO "service_role";
GRANT SELECT ON TABLE public."notes" TO "service_role";
GRANT UPDATE ON TABLE public."notes" TO "service_role";
GRANT DELETE ON TABLE public."notes" TO "service_role";
GRANT TRUNCATE ON TABLE public."notes" TO "service_role";
GRANT REFERENCES ON TABLE public."notes" TO "service_role";
GRANT TRIGGER ON TABLE public."notes" TO "service_role";
GRANT MAINTAIN ON TABLE public."notes" TO "service_role";
SET LOCAL ROLE postgres;

ALTER VIEW public."opportunities" OWNER TO "postgres";

REVOKE ALL ON TABLE public."opportunities" FROM PUBLIC,"postgres","anon","authenticated","service_role";
SET LOCAL ROLE "postgres";
GRANT INSERT ON TABLE public."opportunities" TO "postgres";
GRANT SELECT ON TABLE public."opportunities" TO "postgres";
GRANT UPDATE ON TABLE public."opportunities" TO "postgres";
GRANT DELETE ON TABLE public."opportunities" TO "postgres";
GRANT TRUNCATE ON TABLE public."opportunities" TO "postgres";
GRANT REFERENCES ON TABLE public."opportunities" TO "postgres";
GRANT TRIGGER ON TABLE public."opportunities" TO "postgres";
GRANT MAINTAIN ON TABLE public."opportunities" TO "postgres";
SET LOCAL ROLE "postgres";
GRANT INSERT ON TABLE public."opportunities" TO "anon";
GRANT SELECT ON TABLE public."opportunities" TO "anon";
GRANT UPDATE ON TABLE public."opportunities" TO "anon";
GRANT DELETE ON TABLE public."opportunities" TO "anon";
GRANT TRUNCATE ON TABLE public."opportunities" TO "anon";
GRANT REFERENCES ON TABLE public."opportunities" TO "anon";
GRANT TRIGGER ON TABLE public."opportunities" TO "anon";
GRANT MAINTAIN ON TABLE public."opportunities" TO "anon";
SET LOCAL ROLE "postgres";
GRANT INSERT ON TABLE public."opportunities" TO "authenticated";
GRANT SELECT ON TABLE public."opportunities" TO "authenticated";
GRANT UPDATE ON TABLE public."opportunities" TO "authenticated";
GRANT DELETE ON TABLE public."opportunities" TO "authenticated";
GRANT TRUNCATE ON TABLE public."opportunities" TO "authenticated";
GRANT REFERENCES ON TABLE public."opportunities" TO "authenticated";
GRANT TRIGGER ON TABLE public."opportunities" TO "authenticated";
GRANT MAINTAIN ON TABLE public."opportunities" TO "authenticated";
SET LOCAL ROLE "postgres";
GRANT INSERT ON TABLE public."opportunities" TO "service_role";
GRANT SELECT ON TABLE public."opportunities" TO "service_role";
GRANT UPDATE ON TABLE public."opportunities" TO "service_role";
GRANT DELETE ON TABLE public."opportunities" TO "service_role";
GRANT TRUNCATE ON TABLE public."opportunities" TO "service_role";
GRANT REFERENCES ON TABLE public."opportunities" TO "service_role";
GRANT TRIGGER ON TABLE public."opportunities" TO "service_role";
GRANT MAINTAIN ON TABLE public."opportunities" TO "service_role";
SET LOCAL ROLE postgres;

ALTER TABLE public."organizations" OWNER TO "postgres";

REVOKE ALL ON TABLE public."organizations" FROM PUBLIC,"postgres","anon","authenticated","service_role";
SET LOCAL ROLE "postgres";
GRANT INSERT ON TABLE public."organizations" TO "postgres";
GRANT SELECT ON TABLE public."organizations" TO "postgres";
GRANT UPDATE ON TABLE public."organizations" TO "postgres";
GRANT DELETE ON TABLE public."organizations" TO "postgres";
GRANT TRUNCATE ON TABLE public."organizations" TO "postgres";
GRANT REFERENCES ON TABLE public."organizations" TO "postgres";
GRANT TRIGGER ON TABLE public."organizations" TO "postgres";
GRANT MAINTAIN ON TABLE public."organizations" TO "postgres";
SET LOCAL ROLE "postgres";
GRANT INSERT ON TABLE public."organizations" TO "anon";
GRANT SELECT ON TABLE public."organizations" TO "anon";
GRANT UPDATE ON TABLE public."organizations" TO "anon";
GRANT DELETE ON TABLE public."organizations" TO "anon";
GRANT TRUNCATE ON TABLE public."organizations" TO "anon";
GRANT REFERENCES ON TABLE public."organizations" TO "anon";
GRANT TRIGGER ON TABLE public."organizations" TO "anon";
GRANT MAINTAIN ON TABLE public."organizations" TO "anon";
SET LOCAL ROLE "postgres";
GRANT INSERT ON TABLE public."organizations" TO "authenticated";
GRANT SELECT ON TABLE public."organizations" TO "authenticated";
GRANT UPDATE ON TABLE public."organizations" TO "authenticated";
GRANT DELETE ON TABLE public."organizations" TO "authenticated";
GRANT TRUNCATE ON TABLE public."organizations" TO "authenticated";
GRANT REFERENCES ON TABLE public."organizations" TO "authenticated";
GRANT TRIGGER ON TABLE public."organizations" TO "authenticated";
GRANT MAINTAIN ON TABLE public."organizations" TO "authenticated";
SET LOCAL ROLE "postgres";
GRANT INSERT ON TABLE public."organizations" TO "service_role";
GRANT SELECT ON TABLE public."organizations" TO "service_role";
GRANT UPDATE ON TABLE public."organizations" TO "service_role";
GRANT DELETE ON TABLE public."organizations" TO "service_role";
GRANT TRUNCATE ON TABLE public."organizations" TO "service_role";
GRANT REFERENCES ON TABLE public."organizations" TO "service_role";
GRANT TRIGGER ON TABLE public."organizations" TO "service_role";
GRANT MAINTAIN ON TABLE public."organizations" TO "service_role";
SET LOCAL ROLE postgres;

ALTER TABLE public."projects" OWNER TO "postgres";

REVOKE ALL ON TABLE public."projects" FROM PUBLIC,"postgres","anon","authenticated","service_role";
SET LOCAL ROLE "postgres";
GRANT INSERT ON TABLE public."projects" TO "postgres";
GRANT SELECT ON TABLE public."projects" TO "postgres";
GRANT UPDATE ON TABLE public."projects" TO "postgres";
GRANT DELETE ON TABLE public."projects" TO "postgres";
GRANT TRUNCATE ON TABLE public."projects" TO "postgres";
GRANT REFERENCES ON TABLE public."projects" TO "postgres";
GRANT TRIGGER ON TABLE public."projects" TO "postgres";
GRANT MAINTAIN ON TABLE public."projects" TO "postgres";
SET LOCAL ROLE "postgres";
GRANT INSERT ON TABLE public."projects" TO "anon";
GRANT SELECT ON TABLE public."projects" TO "anon";
GRANT UPDATE ON TABLE public."projects" TO "anon";
GRANT DELETE ON TABLE public."projects" TO "anon";
GRANT TRUNCATE ON TABLE public."projects" TO "anon";
GRANT REFERENCES ON TABLE public."projects" TO "anon";
GRANT TRIGGER ON TABLE public."projects" TO "anon";
GRANT MAINTAIN ON TABLE public."projects" TO "anon";
SET LOCAL ROLE "postgres";
GRANT INSERT ON TABLE public."projects" TO "authenticated";
GRANT SELECT ON TABLE public."projects" TO "authenticated";
GRANT UPDATE ON TABLE public."projects" TO "authenticated";
GRANT DELETE ON TABLE public."projects" TO "authenticated";
GRANT TRUNCATE ON TABLE public."projects" TO "authenticated";
GRANT REFERENCES ON TABLE public."projects" TO "authenticated";
GRANT TRIGGER ON TABLE public."projects" TO "authenticated";
GRANT MAINTAIN ON TABLE public."projects" TO "authenticated";
SET LOCAL ROLE "postgres";
GRANT INSERT ON TABLE public."projects" TO "service_role";
GRANT SELECT ON TABLE public."projects" TO "service_role";
GRANT UPDATE ON TABLE public."projects" TO "service_role";
GRANT DELETE ON TABLE public."projects" TO "service_role";
GRANT TRUNCATE ON TABLE public."projects" TO "service_role";
GRANT REFERENCES ON TABLE public."projects" TO "service_role";
GRANT TRIGGER ON TABLE public."projects" TO "service_role";
GRANT MAINTAIN ON TABLE public."projects" TO "service_role";
SET LOCAL ROLE postgres;

ALTER TABLE public."sites" OWNER TO "postgres";

REVOKE ALL ON TABLE public."sites" FROM PUBLIC,"postgres","anon","authenticated","service_role";
SET LOCAL ROLE "postgres";
GRANT INSERT ON TABLE public."sites" TO "postgres";
GRANT SELECT ON TABLE public."sites" TO "postgres";
GRANT UPDATE ON TABLE public."sites" TO "postgres";
GRANT DELETE ON TABLE public."sites" TO "postgres";
GRANT TRUNCATE ON TABLE public."sites" TO "postgres";
GRANT REFERENCES ON TABLE public."sites" TO "postgres";
GRANT TRIGGER ON TABLE public."sites" TO "postgres";
GRANT MAINTAIN ON TABLE public."sites" TO "postgres";
SET LOCAL ROLE "postgres";
GRANT INSERT ON TABLE public."sites" TO "anon";
GRANT SELECT ON TABLE public."sites" TO "anon";
GRANT UPDATE ON TABLE public."sites" TO "anon";
GRANT DELETE ON TABLE public."sites" TO "anon";
GRANT TRUNCATE ON TABLE public."sites" TO "anon";
GRANT REFERENCES ON TABLE public."sites" TO "anon";
GRANT TRIGGER ON TABLE public."sites" TO "anon";
GRANT MAINTAIN ON TABLE public."sites" TO "anon";
SET LOCAL ROLE "postgres";
GRANT INSERT ON TABLE public."sites" TO "authenticated";
GRANT SELECT ON TABLE public."sites" TO "authenticated";
GRANT UPDATE ON TABLE public."sites" TO "authenticated";
GRANT DELETE ON TABLE public."sites" TO "authenticated";
GRANT TRUNCATE ON TABLE public."sites" TO "authenticated";
GRANT REFERENCES ON TABLE public."sites" TO "authenticated";
GRANT TRIGGER ON TABLE public."sites" TO "authenticated";
GRANT MAINTAIN ON TABLE public."sites" TO "authenticated";
SET LOCAL ROLE "postgres";
GRANT INSERT ON TABLE public."sites" TO "service_role";
GRANT SELECT ON TABLE public."sites" TO "service_role";
GRANT UPDATE ON TABLE public."sites" TO "service_role";
GRANT DELETE ON TABLE public."sites" TO "service_role";
GRANT TRUNCATE ON TABLE public."sites" TO "service_role";
GRANT REFERENCES ON TABLE public."sites" TO "service_role";
GRANT TRIGGER ON TABLE public."sites" TO "service_role";
GRANT MAINTAIN ON TABLE public."sites" TO "service_role";
SET LOCAL ROLE postgres;

ALTER TABLE public."stage_catalog" OWNER TO "postgres";

REVOKE ALL ON TABLE public."stage_catalog" FROM PUBLIC,"postgres","anon","authenticated","service_role";
SET LOCAL ROLE "postgres";
GRANT INSERT ON TABLE public."stage_catalog" TO "postgres";
GRANT SELECT ON TABLE public."stage_catalog" TO "postgres";
GRANT UPDATE ON TABLE public."stage_catalog" TO "postgres";
GRANT DELETE ON TABLE public."stage_catalog" TO "postgres";
GRANT TRUNCATE ON TABLE public."stage_catalog" TO "postgres";
GRANT REFERENCES ON TABLE public."stage_catalog" TO "postgres";
GRANT TRIGGER ON TABLE public."stage_catalog" TO "postgres";
GRANT MAINTAIN ON TABLE public."stage_catalog" TO "postgres";
SET LOCAL ROLE "postgres";
GRANT INSERT ON TABLE public."stage_catalog" TO "anon";
GRANT SELECT ON TABLE public."stage_catalog" TO "anon";
GRANT UPDATE ON TABLE public."stage_catalog" TO "anon";
GRANT DELETE ON TABLE public."stage_catalog" TO "anon";
GRANT TRUNCATE ON TABLE public."stage_catalog" TO "anon";
GRANT REFERENCES ON TABLE public."stage_catalog" TO "anon";
GRANT TRIGGER ON TABLE public."stage_catalog" TO "anon";
GRANT MAINTAIN ON TABLE public."stage_catalog" TO "anon";
SET LOCAL ROLE "postgres";
GRANT INSERT ON TABLE public."stage_catalog" TO "authenticated";
GRANT SELECT ON TABLE public."stage_catalog" TO "authenticated";
GRANT UPDATE ON TABLE public."stage_catalog" TO "authenticated";
GRANT DELETE ON TABLE public."stage_catalog" TO "authenticated";
GRANT TRUNCATE ON TABLE public."stage_catalog" TO "authenticated";
GRANT REFERENCES ON TABLE public."stage_catalog" TO "authenticated";
GRANT TRIGGER ON TABLE public."stage_catalog" TO "authenticated";
GRANT MAINTAIN ON TABLE public."stage_catalog" TO "authenticated";
SET LOCAL ROLE "postgres";
GRANT INSERT ON TABLE public."stage_catalog" TO "service_role";
GRANT SELECT ON TABLE public."stage_catalog" TO "service_role";
GRANT UPDATE ON TABLE public."stage_catalog" TO "service_role";
GRANT DELETE ON TABLE public."stage_catalog" TO "service_role";
GRANT TRUNCATE ON TABLE public."stage_catalog" TO "service_role";
GRANT REFERENCES ON TABLE public."stage_catalog" TO "service_role";
GRANT TRIGGER ON TABLE public."stage_catalog" TO "service_role";
GRANT MAINTAIN ON TABLE public."stage_catalog" TO "service_role";
SET LOCAL ROLE postgres;

ALTER SEQUENCE public."stage_catalog_id_seq" OWNER TO "postgres";

REVOKE ALL ON SEQUENCE public."stage_catalog_id_seq" FROM PUBLIC,"postgres","anon","authenticated","service_role";
SET LOCAL ROLE "postgres";
GRANT SELECT ON SEQUENCE public."stage_catalog_id_seq" TO "postgres";
GRANT UPDATE ON SEQUENCE public."stage_catalog_id_seq" TO "postgres";
GRANT USAGE ON SEQUENCE public."stage_catalog_id_seq" TO "postgres";
SET LOCAL ROLE "postgres";
GRANT SELECT ON SEQUENCE public."stage_catalog_id_seq" TO "anon";
GRANT UPDATE ON SEQUENCE public."stage_catalog_id_seq" TO "anon";
GRANT USAGE ON SEQUENCE public."stage_catalog_id_seq" TO "anon";
SET LOCAL ROLE "postgres";
GRANT SELECT ON SEQUENCE public."stage_catalog_id_seq" TO "authenticated";
GRANT UPDATE ON SEQUENCE public."stage_catalog_id_seq" TO "authenticated";
GRANT USAGE ON SEQUENCE public."stage_catalog_id_seq" TO "authenticated";
SET LOCAL ROLE "postgres";
GRANT SELECT ON SEQUENCE public."stage_catalog_id_seq" TO "service_role";
GRANT UPDATE ON SEQUENCE public."stage_catalog_id_seq" TO "service_role";
GRANT USAGE ON SEQUENCE public."stage_catalog_id_seq" TO "service_role";
SET LOCAL ROLE postgres;

ALTER TABLE public."stage_history" OWNER TO "postgres";

REVOKE ALL ON TABLE public."stage_history" FROM PUBLIC,"postgres","anon","authenticated","service_role";
SET LOCAL ROLE "postgres";
GRANT INSERT ON TABLE public."stage_history" TO "postgres";
GRANT SELECT ON TABLE public."stage_history" TO "postgres";
GRANT UPDATE ON TABLE public."stage_history" TO "postgres";
GRANT DELETE ON TABLE public."stage_history" TO "postgres";
GRANT TRUNCATE ON TABLE public."stage_history" TO "postgres";
GRANT REFERENCES ON TABLE public."stage_history" TO "postgres";
GRANT TRIGGER ON TABLE public."stage_history" TO "postgres";
GRANT MAINTAIN ON TABLE public."stage_history" TO "postgres";
SET LOCAL ROLE "postgres";
GRANT INSERT ON TABLE public."stage_history" TO "anon";
GRANT SELECT ON TABLE public."stage_history" TO "anon";
GRANT UPDATE ON TABLE public."stage_history" TO "anon";
GRANT DELETE ON TABLE public."stage_history" TO "anon";
GRANT TRUNCATE ON TABLE public."stage_history" TO "anon";
GRANT REFERENCES ON TABLE public."stage_history" TO "anon";
GRANT TRIGGER ON TABLE public."stage_history" TO "anon";
GRANT MAINTAIN ON TABLE public."stage_history" TO "anon";
SET LOCAL ROLE "postgres";
GRANT INSERT ON TABLE public."stage_history" TO "authenticated";
GRANT SELECT ON TABLE public."stage_history" TO "authenticated";
GRANT UPDATE ON TABLE public."stage_history" TO "authenticated";
GRANT DELETE ON TABLE public."stage_history" TO "authenticated";
GRANT TRUNCATE ON TABLE public."stage_history" TO "authenticated";
GRANT REFERENCES ON TABLE public."stage_history" TO "authenticated";
GRANT TRIGGER ON TABLE public."stage_history" TO "authenticated";
GRANT MAINTAIN ON TABLE public."stage_history" TO "authenticated";
SET LOCAL ROLE "postgres";
GRANT INSERT ON TABLE public."stage_history" TO "service_role";
GRANT SELECT ON TABLE public."stage_history" TO "service_role";
GRANT UPDATE ON TABLE public."stage_history" TO "service_role";
GRANT DELETE ON TABLE public."stage_history" TO "service_role";
GRANT TRUNCATE ON TABLE public."stage_history" TO "service_role";
GRANT REFERENCES ON TABLE public."stage_history" TO "service_role";
GRANT TRIGGER ON TABLE public."stage_history" TO "service_role";
GRANT MAINTAIN ON TABLE public."stage_history" TO "service_role";
SET LOCAL ROLE postgres;

ALTER TABLE public."users" OWNER TO "postgres";

REVOKE ALL ON TABLE public."users" FROM PUBLIC,"postgres","anon","authenticated","service_role";
SET LOCAL ROLE "postgres";
GRANT INSERT ON TABLE public."users" TO "postgres";
GRANT SELECT ON TABLE public."users" TO "postgres";
GRANT UPDATE ON TABLE public."users" TO "postgres";
GRANT DELETE ON TABLE public."users" TO "postgres";
GRANT TRUNCATE ON TABLE public."users" TO "postgres";
GRANT REFERENCES ON TABLE public."users" TO "postgres";
GRANT TRIGGER ON TABLE public."users" TO "postgres";
GRANT MAINTAIN ON TABLE public."users" TO "postgres";
SET LOCAL ROLE "postgres";
GRANT INSERT ON TABLE public."users" TO "anon";
GRANT SELECT ON TABLE public."users" TO "anon";
GRANT UPDATE ON TABLE public."users" TO "anon";
GRANT DELETE ON TABLE public."users" TO "anon";
GRANT TRUNCATE ON TABLE public."users" TO "anon";
GRANT REFERENCES ON TABLE public."users" TO "anon";
GRANT TRIGGER ON TABLE public."users" TO "anon";
GRANT MAINTAIN ON TABLE public."users" TO "anon";
SET LOCAL ROLE "postgres";
GRANT INSERT ON TABLE public."users" TO "authenticated";
GRANT SELECT ON TABLE public."users" TO "authenticated";
GRANT UPDATE ON TABLE public."users" TO "authenticated";
GRANT DELETE ON TABLE public."users" TO "authenticated";
GRANT TRUNCATE ON TABLE public."users" TO "authenticated";
GRANT REFERENCES ON TABLE public."users" TO "authenticated";
GRANT TRIGGER ON TABLE public."users" TO "authenticated";
GRANT MAINTAIN ON TABLE public."users" TO "authenticated";
SET LOCAL ROLE "postgres";
GRANT INSERT ON TABLE public."users" TO "service_role";
GRANT SELECT ON TABLE public."users" TO "service_role";
GRANT UPDATE ON TABLE public."users" TO "service_role";
GRANT DELETE ON TABLE public."users" TO "service_role";
GRANT TRUNCATE ON TABLE public."users" TO "service_role";
GRANT REFERENCES ON TABLE public."users" TO "service_role";
GRANT TRIGGER ON TABLE public."users" TO "service_role";
GRANT MAINTAIN ON TABLE public."users" TO "service_role";
SET LOCAL ROLE postgres;

ALTER VIEW public."v_assignee" OWNER TO "postgres";

REVOKE ALL ON TABLE public."v_assignee" FROM PUBLIC,"postgres","anon","authenticated","service_role";
SET LOCAL ROLE "postgres";
GRANT INSERT ON TABLE public."v_assignee" TO "postgres";
GRANT SELECT ON TABLE public."v_assignee" TO "postgres";
GRANT UPDATE ON TABLE public."v_assignee" TO "postgres";
GRANT DELETE ON TABLE public."v_assignee" TO "postgres";
GRANT TRUNCATE ON TABLE public."v_assignee" TO "postgres";
GRANT REFERENCES ON TABLE public."v_assignee" TO "postgres";
GRANT TRIGGER ON TABLE public."v_assignee" TO "postgres";
GRANT MAINTAIN ON TABLE public."v_assignee" TO "postgres";
SET LOCAL ROLE "postgres";
GRANT INSERT ON TABLE public."v_assignee" TO "anon";
GRANT SELECT ON TABLE public."v_assignee" TO "anon";
GRANT UPDATE ON TABLE public."v_assignee" TO "anon";
GRANT DELETE ON TABLE public."v_assignee" TO "anon";
GRANT TRUNCATE ON TABLE public."v_assignee" TO "anon";
GRANT REFERENCES ON TABLE public."v_assignee" TO "anon";
GRANT TRIGGER ON TABLE public."v_assignee" TO "anon";
GRANT MAINTAIN ON TABLE public."v_assignee" TO "anon";
SET LOCAL ROLE "postgres";
GRANT INSERT ON TABLE public."v_assignee" TO "authenticated";
GRANT SELECT ON TABLE public."v_assignee" TO "authenticated";
GRANT UPDATE ON TABLE public."v_assignee" TO "authenticated";
GRANT DELETE ON TABLE public."v_assignee" TO "authenticated";
GRANT TRUNCATE ON TABLE public."v_assignee" TO "authenticated";
GRANT REFERENCES ON TABLE public."v_assignee" TO "authenticated";
GRANT TRIGGER ON TABLE public."v_assignee" TO "authenticated";
GRANT MAINTAIN ON TABLE public."v_assignee" TO "authenticated";
SET LOCAL ROLE "postgres";
GRANT INSERT ON TABLE public."v_assignee" TO "service_role";
GRANT SELECT ON TABLE public."v_assignee" TO "service_role";
GRANT UPDATE ON TABLE public."v_assignee" TO "service_role";
GRANT DELETE ON TABLE public."v_assignee" TO "service_role";
GRANT TRUNCATE ON TABLE public."v_assignee" TO "service_role";
GRANT REFERENCES ON TABLE public."v_assignee" TO "service_role";
GRANT TRIGGER ON TABLE public."v_assignee" TO "service_role";
GRANT MAINTAIN ON TABLE public."v_assignee" TO "service_role";
SET LOCAL ROLE postgres;

ALTER VIEW public."v_dup_org" OWNER TO "postgres";

REVOKE ALL ON TABLE public."v_dup_org" FROM PUBLIC,"postgres","anon","authenticated","service_role";
SET LOCAL ROLE "postgres";
GRANT INSERT ON TABLE public."v_dup_org" TO "postgres";
GRANT SELECT ON TABLE public."v_dup_org" TO "postgres";
GRANT UPDATE ON TABLE public."v_dup_org" TO "postgres";
GRANT DELETE ON TABLE public."v_dup_org" TO "postgres";
GRANT TRUNCATE ON TABLE public."v_dup_org" TO "postgres";
GRANT REFERENCES ON TABLE public."v_dup_org" TO "postgres";
GRANT TRIGGER ON TABLE public."v_dup_org" TO "postgres";
GRANT MAINTAIN ON TABLE public."v_dup_org" TO "postgres";
SET LOCAL ROLE "postgres";
GRANT INSERT ON TABLE public."v_dup_org" TO "anon";
GRANT SELECT ON TABLE public."v_dup_org" TO "anon";
GRANT UPDATE ON TABLE public."v_dup_org" TO "anon";
GRANT DELETE ON TABLE public."v_dup_org" TO "anon";
GRANT TRUNCATE ON TABLE public."v_dup_org" TO "anon";
GRANT REFERENCES ON TABLE public."v_dup_org" TO "anon";
GRANT TRIGGER ON TABLE public."v_dup_org" TO "anon";
GRANT MAINTAIN ON TABLE public."v_dup_org" TO "anon";
SET LOCAL ROLE "postgres";
GRANT INSERT ON TABLE public."v_dup_org" TO "authenticated";
GRANT SELECT ON TABLE public."v_dup_org" TO "authenticated";
GRANT UPDATE ON TABLE public."v_dup_org" TO "authenticated";
GRANT DELETE ON TABLE public."v_dup_org" TO "authenticated";
GRANT TRUNCATE ON TABLE public."v_dup_org" TO "authenticated";
GRANT REFERENCES ON TABLE public."v_dup_org" TO "authenticated";
GRANT TRIGGER ON TABLE public."v_dup_org" TO "authenticated";
GRANT MAINTAIN ON TABLE public."v_dup_org" TO "authenticated";
SET LOCAL ROLE "postgres";
GRANT INSERT ON TABLE public."v_dup_org" TO "service_role";
GRANT SELECT ON TABLE public."v_dup_org" TO "service_role";
GRANT UPDATE ON TABLE public."v_dup_org" TO "service_role";
GRANT DELETE ON TABLE public."v_dup_org" TO "service_role";
GRANT TRUNCATE ON TABLE public."v_dup_org" TO "service_role";
GRANT REFERENCES ON TABLE public."v_dup_org" TO "service_role";
GRANT TRIGGER ON TABLE public."v_dup_org" TO "service_role";
GRANT MAINTAIN ON TABLE public."v_dup_org" TO "service_role";
SET LOCAL ROLE postgres;

ALTER VIEW public."v_funnel" OWNER TO "postgres";

REVOKE ALL ON TABLE public."v_funnel" FROM PUBLIC,"postgres","anon","authenticated","service_role";
SET LOCAL ROLE "postgres";
GRANT INSERT ON TABLE public."v_funnel" TO "postgres";
GRANT SELECT ON TABLE public."v_funnel" TO "postgres";
GRANT UPDATE ON TABLE public."v_funnel" TO "postgres";
GRANT DELETE ON TABLE public."v_funnel" TO "postgres";
GRANT TRUNCATE ON TABLE public."v_funnel" TO "postgres";
GRANT REFERENCES ON TABLE public."v_funnel" TO "postgres";
GRANT TRIGGER ON TABLE public."v_funnel" TO "postgres";
GRANT MAINTAIN ON TABLE public."v_funnel" TO "postgres";
SET LOCAL ROLE "postgres";
GRANT INSERT ON TABLE public."v_funnel" TO "anon";
GRANT SELECT ON TABLE public."v_funnel" TO "anon";
GRANT UPDATE ON TABLE public."v_funnel" TO "anon";
GRANT DELETE ON TABLE public."v_funnel" TO "anon";
GRANT TRUNCATE ON TABLE public."v_funnel" TO "anon";
GRANT REFERENCES ON TABLE public."v_funnel" TO "anon";
GRANT TRIGGER ON TABLE public."v_funnel" TO "anon";
GRANT MAINTAIN ON TABLE public."v_funnel" TO "anon";
SET LOCAL ROLE "postgres";
GRANT INSERT ON TABLE public."v_funnel" TO "authenticated";
GRANT SELECT ON TABLE public."v_funnel" TO "authenticated";
GRANT UPDATE ON TABLE public."v_funnel" TO "authenticated";
GRANT DELETE ON TABLE public."v_funnel" TO "authenticated";
GRANT TRUNCATE ON TABLE public."v_funnel" TO "authenticated";
GRANT REFERENCES ON TABLE public."v_funnel" TO "authenticated";
GRANT TRIGGER ON TABLE public."v_funnel" TO "authenticated";
GRANT MAINTAIN ON TABLE public."v_funnel" TO "authenticated";
SET LOCAL ROLE "postgres";
GRANT INSERT ON TABLE public."v_funnel" TO "service_role";
GRANT SELECT ON TABLE public."v_funnel" TO "service_role";
GRANT UPDATE ON TABLE public."v_funnel" TO "service_role";
GRANT DELETE ON TABLE public."v_funnel" TO "service_role";
GRANT TRUNCATE ON TABLE public."v_funnel" TO "service_role";
GRANT REFERENCES ON TABLE public."v_funnel" TO "service_role";
GRANT TRIGGER ON TABLE public."v_funnel" TO "service_role";
GRANT MAINTAIN ON TABLE public."v_funnel" TO "service_role";
SET LOCAL ROLE postgres;

ALTER VIEW public."v_kanban" OWNER TO "postgres";

REVOKE ALL ON TABLE public."v_kanban" FROM PUBLIC,"postgres","anon","authenticated","service_role";
SET LOCAL ROLE "postgres";
GRANT INSERT ON TABLE public."v_kanban" TO "postgres";
GRANT SELECT ON TABLE public."v_kanban" TO "postgres";
GRANT UPDATE ON TABLE public."v_kanban" TO "postgres";
GRANT DELETE ON TABLE public."v_kanban" TO "postgres";
GRANT TRUNCATE ON TABLE public."v_kanban" TO "postgres";
GRANT REFERENCES ON TABLE public."v_kanban" TO "postgres";
GRANT TRIGGER ON TABLE public."v_kanban" TO "postgres";
GRANT MAINTAIN ON TABLE public."v_kanban" TO "postgres";
SET LOCAL ROLE "postgres";
GRANT INSERT ON TABLE public."v_kanban" TO "anon";
GRANT SELECT ON TABLE public."v_kanban" TO "anon";
GRANT UPDATE ON TABLE public."v_kanban" TO "anon";
GRANT DELETE ON TABLE public."v_kanban" TO "anon";
GRANT TRUNCATE ON TABLE public."v_kanban" TO "anon";
GRANT REFERENCES ON TABLE public."v_kanban" TO "anon";
GRANT TRIGGER ON TABLE public."v_kanban" TO "anon";
GRANT MAINTAIN ON TABLE public."v_kanban" TO "anon";
SET LOCAL ROLE "postgres";
GRANT INSERT ON TABLE public."v_kanban" TO "authenticated";
GRANT SELECT ON TABLE public."v_kanban" TO "authenticated";
GRANT UPDATE ON TABLE public."v_kanban" TO "authenticated";
GRANT DELETE ON TABLE public."v_kanban" TO "authenticated";
GRANT TRUNCATE ON TABLE public."v_kanban" TO "authenticated";
GRANT REFERENCES ON TABLE public."v_kanban" TO "authenticated";
GRANT TRIGGER ON TABLE public."v_kanban" TO "authenticated";
GRANT MAINTAIN ON TABLE public."v_kanban" TO "authenticated";
SET LOCAL ROLE "postgres";
GRANT INSERT ON TABLE public."v_kanban" TO "service_role";
GRANT SELECT ON TABLE public."v_kanban" TO "service_role";
GRANT UPDATE ON TABLE public."v_kanban" TO "service_role";
GRANT DELETE ON TABLE public."v_kanban" TO "service_role";
GRANT TRUNCATE ON TABLE public."v_kanban" TO "service_role";
GRANT REFERENCES ON TABLE public."v_kanban" TO "service_role";
GRANT TRIGGER ON TABLE public."v_kanban" TO "service_role";
GRANT MAINTAIN ON TABLE public."v_kanban" TO "service_role";
SET LOCAL ROLE postgres;

ALTER FUNCTION public._done_today(text) OWNER TO "postgres";

REVOKE ALL ON FUNCTION public._done_today(text) FROM PUBLIC,"postgres","anon","authenticated","service_role";
SET LOCAL ROLE "postgres";
GRANT EXECUTE ON FUNCTION public._done_today(text) TO PUBLIC;
SET LOCAL ROLE "postgres";
GRANT EXECUTE ON FUNCTION public._done_today(text) TO "postgres";
SET LOCAL ROLE "postgres";
GRANT EXECUTE ON FUNCTION public._done_today(text) TO "anon";
SET LOCAL ROLE "postgres";
GRANT EXECUTE ON FUNCTION public._done_today(text) TO "authenticated";
SET LOCAL ROLE "postgres";
GRANT EXECUTE ON FUNCTION public._done_today(text) TO "service_role";
SET LOCAL ROLE postgres;

ALTER FUNCTION public.apply_business_change(uuid,text,text,text,text,text,date) OWNER TO "postgres";

REVOKE ALL ON FUNCTION public.apply_business_change(uuid,text,text,text,text,text,date) FROM PUBLIC,"postgres","anon","authenticated","service_role";
SET LOCAL ROLE "postgres";
GRANT EXECUTE ON FUNCTION public.apply_business_change(uuid,text,text,text,text,text,date) TO PUBLIC;
SET LOCAL ROLE "postgres";
GRANT EXECUTE ON FUNCTION public.apply_business_change(uuid,text,text,text,text,text,date) TO "postgres";
SET LOCAL ROLE "postgres";
GRANT EXECUTE ON FUNCTION public.apply_business_change(uuid,text,text,text,text,text,date) TO "anon";
SET LOCAL ROLE "postgres";
GRANT EXECUTE ON FUNCTION public.apply_business_change(uuid,text,text,text,text,text,date) TO "authenticated";
SET LOCAL ROLE "postgres";
GRANT EXECUTE ON FUNCTION public.apply_business_change(uuid,text,text,text,text,text,date) TO "service_role";
SET LOCAL ROLE postgres;

ALTER FUNCTION public.crm_bundle() OWNER TO "postgres";

REVOKE ALL ON FUNCTION public.crm_bundle() FROM PUBLIC,"postgres","anon","authenticated","service_role";
SET LOCAL ROLE "postgres";
GRANT EXECUTE ON FUNCTION public.crm_bundle() TO PUBLIC;
SET LOCAL ROLE "postgres";
GRANT EXECUTE ON FUNCTION public.crm_bundle() TO "postgres";
SET LOCAL ROLE "postgres";
GRANT EXECUTE ON FUNCTION public.crm_bundle() TO "anon";
SET LOCAL ROLE "postgres";
GRANT EXECUTE ON FUNCTION public.crm_bundle() TO "authenticated";
SET LOCAL ROLE "postgres";
GRANT EXECUTE ON FUNCTION public.crm_bundle() TO "service_role";
SET LOCAL ROLE postgres;

ALTER FUNCTION public.crm_contact_move(jsonb) OWNER TO "postgres";

REVOKE ALL ON FUNCTION public.crm_contact_move(jsonb) FROM PUBLIC,"postgres","anon","authenticated","service_role";
SET LOCAL ROLE "postgres";
GRANT EXECUTE ON FUNCTION public.crm_contact_move(jsonb) TO "postgres";
SET LOCAL ROLE "postgres";
GRANT EXECUTE ON FUNCTION public.crm_contact_move(jsonb) TO "service_role";
SET LOCAL ROLE postgres;

ALTER FUNCTION public.crm_contact_upsert(jsonb) OWNER TO "postgres";

REVOKE ALL ON FUNCTION public.crm_contact_upsert(jsonb) FROM PUBLIC,"postgres","anon","authenticated","service_role";
SET LOCAL ROLE "postgres";
GRANT EXECUTE ON FUNCTION public.crm_contact_upsert(jsonb) TO "postgres";
SET LOCAL ROLE "postgres";
GRANT EXECUTE ON FUNCTION public.crm_contact_upsert(jsonb) TO "service_role";
SET LOCAL ROLE postgres;

ALTER FUNCTION public.crm_opportunity_work_set(jsonb) OWNER TO "postgres";

REVOKE ALL ON FUNCTION public.crm_opportunity_work_set(jsonb) FROM PUBLIC,"postgres","anon","authenticated","service_role";
SET LOCAL ROLE "postgres";
GRANT EXECUTE ON FUNCTION public.crm_opportunity_work_set(jsonb) TO PUBLIC;
SET LOCAL ROLE "postgres";
GRANT EXECUTE ON FUNCTION public.crm_opportunity_work_set(jsonb) TO "postgres";
SET LOCAL ROLE "postgres";
GRANT EXECUTE ON FUNCTION public.crm_opportunity_work_set(jsonb) TO "anon";
SET LOCAL ROLE "postgres";
GRANT EXECUTE ON FUNCTION public.crm_opportunity_work_set(jsonb) TO "authenticated";
SET LOCAL ROLE "postgres";
GRANT EXECUTE ON FUNCTION public.crm_opportunity_work_set(jsonb) TO "service_role";
SET LOCAL ROLE postgres;

ALTER FUNCTION public.crm_site_contacts(uuid) OWNER TO "postgres";

REVOKE ALL ON FUNCTION public.crm_site_contacts(uuid) FROM PUBLIC,"postgres","anon","authenticated","service_role";
SET LOCAL ROLE "postgres";
GRANT EXECUTE ON FUNCTION public.crm_site_contacts(uuid) TO PUBLIC;
SET LOCAL ROLE "postgres";
GRANT EXECUTE ON FUNCTION public.crm_site_contacts(uuid) TO "postgres";
SET LOCAL ROLE "postgres";
GRANT EXECUTE ON FUNCTION public.crm_site_contacts(uuid) TO "anon";
SET LOCAL ROLE "postgres";
GRANT EXECUTE ON FUNCTION public.crm_site_contacts(uuid) TO "authenticated";
SET LOCAL ROLE "postgres";
GRANT EXECUTE ON FUNCTION public.crm_site_contacts(uuid) TO "service_role";
SET LOCAL ROLE postgres;

ALTER FUNCTION public.metrics_channel_flow() OWNER TO "postgres";

REVOKE ALL ON FUNCTION public.metrics_channel_flow() FROM PUBLIC,"postgres","anon","authenticated","service_role";
SET LOCAL ROLE "postgres";
GRANT EXECUTE ON FUNCTION public.metrics_channel_flow() TO PUBLIC;
SET LOCAL ROLE "postgres";
GRANT EXECUTE ON FUNCTION public.metrics_channel_flow() TO "postgres";
SET LOCAL ROLE "postgres";
GRANT EXECUTE ON FUNCTION public.metrics_channel_flow() TO "anon";
SET LOCAL ROLE "postgres";
GRANT EXECUTE ON FUNCTION public.metrics_channel_flow() TO "authenticated";
SET LOCAL ROLE "postgres";
GRANT EXECUTE ON FUNCTION public.metrics_channel_flow() TO "service_role";
SET LOCAL ROLE postgres;

ALTER FUNCTION public.metrics_lost_breakdown(text) OWNER TO "postgres";

REVOKE ALL ON FUNCTION public.metrics_lost_breakdown(text) FROM PUBLIC,"postgres","anon","authenticated","service_role";
SET LOCAL ROLE "postgres";
GRANT EXECUTE ON FUNCTION public.metrics_lost_breakdown(text) TO PUBLIC;
SET LOCAL ROLE "postgres";
GRANT EXECUTE ON FUNCTION public.metrics_lost_breakdown(text) TO "postgres";
SET LOCAL ROLE "postgres";
GRANT EXECUTE ON FUNCTION public.metrics_lost_breakdown(text) TO "anon";
SET LOCAL ROLE "postgres";
GRANT EXECUTE ON FUNCTION public.metrics_lost_breakdown(text) TO "authenticated";
SET LOCAL ROLE "postgres";
GRANT EXECUTE ON FUNCTION public.metrics_lost_breakdown(text) TO "service_role";
SET LOCAL ROLE postgres;

ALTER FUNCTION public.metrics_operations(text) OWNER TO "postgres";

REVOKE ALL ON FUNCTION public.metrics_operations(text) FROM PUBLIC,"postgres","anon","authenticated","service_role";
SET LOCAL ROLE "postgres";
GRANT EXECUTE ON FUNCTION public.metrics_operations(text) TO PUBLIC;
SET LOCAL ROLE "postgres";
GRANT EXECUTE ON FUNCTION public.metrics_operations(text) TO "postgres";
SET LOCAL ROLE "postgres";
GRANT EXECUTE ON FUNCTION public.metrics_operations(text) TO "anon";
SET LOCAL ROLE "postgres";
GRANT EXECUTE ON FUNCTION public.metrics_operations(text) TO "authenticated";
SET LOCAL ROLE "postgres";
GRANT EXECUTE ON FUNCTION public.metrics_operations(text) TO "service_role";
SET LOCAL ROLE postgres;

ALTER FUNCTION public.parse_responses(text) OWNER TO "postgres";

REVOKE ALL ON FUNCTION public.parse_responses(text) FROM PUBLIC,"postgres","anon","authenticated","service_role";
SET LOCAL ROLE "postgres";
GRANT EXECUTE ON FUNCTION public.parse_responses(text) TO PUBLIC;
SET LOCAL ROLE "postgres";
GRANT EXECUTE ON FUNCTION public.parse_responses(text) TO "postgres";
SET LOCAL ROLE "postgres";
GRANT EXECUTE ON FUNCTION public.parse_responses(text) TO "anon";
SET LOCAL ROLE "postgres";
GRANT EXECUTE ON FUNCTION public.parse_responses(text) TO "authenticated";
SET LOCAL ROLE "postgres";
GRANT EXECUTE ON FUNCTION public.parse_responses(text) TO "service_role";
SET LOCAL ROLE postgres;

ALTER FUNCTION public.require_reason(text,text) OWNER TO "postgres";

REVOKE ALL ON FUNCTION public.require_reason(text,text) FROM PUBLIC,"postgres","anon","authenticated","service_role";
SET LOCAL ROLE "postgres";
GRANT EXECUTE ON FUNCTION public.require_reason(text,text) TO PUBLIC;
SET LOCAL ROLE "postgres";
GRANT EXECUTE ON FUNCTION public.require_reason(text,text) TO "postgres";
SET LOCAL ROLE "postgres";
GRANT EXECUTE ON FUNCTION public.require_reason(text,text) TO "anon";
SET LOCAL ROLE "postgres";
GRANT EXECUTE ON FUNCTION public.require_reason(text,text) TO "authenticated";
SET LOCAL ROLE "postgres";
GRANT EXECUTE ON FUNCTION public.require_reason(text,text) TO "service_role";
SET LOCAL ROLE postgres;

ALTER FUNCTION public.set_updated_at() OWNER TO "postgres";

REVOKE ALL ON FUNCTION public.set_updated_at() FROM PUBLIC,"postgres","anon","authenticated","service_role";
SET LOCAL ROLE "postgres";
GRANT EXECUTE ON FUNCTION public.set_updated_at() TO PUBLIC;
SET LOCAL ROLE "postgres";
GRANT EXECUTE ON FUNCTION public.set_updated_at() TO "postgres";
SET LOCAL ROLE "postgres";
GRANT EXECUTE ON FUNCTION public.set_updated_at() TO "anon";
SET LOCAL ROLE "postgres";
GRANT EXECUTE ON FUNCTION public.set_updated_at() TO "authenticated";
SET LOCAL ROLE "postgres";
GRANT EXECUTE ON FUNCTION public.set_updated_at() TO "service_role";
SET LOCAL ROLE postgres;

ALTER FUNCTION public.stage_sla_days(text) OWNER TO "postgres";

REVOKE ALL ON FUNCTION public.stage_sla_days(text) FROM PUBLIC,"postgres","anon","authenticated","service_role";
SET LOCAL ROLE "postgres";
GRANT EXECUTE ON FUNCTION public.stage_sla_days(text) TO PUBLIC;
SET LOCAL ROLE "postgres";
GRANT EXECUTE ON FUNCTION public.stage_sla_days(text) TO "postgres";
SET LOCAL ROLE "postgres";
GRANT EXECUTE ON FUNCTION public.stage_sla_days(text) TO "anon";
SET LOCAL ROLE "postgres";
GRANT EXECUTE ON FUNCTION public.stage_sla_days(text) TO "authenticated";
SET LOCAL ROLE "postgres";
GRANT EXECUTE ON FUNCTION public.stage_sla_days(text) TO "service_role";
SET LOCAL ROLE postgres;

ALTER FUNCTION public.today_counts() OWNER TO "postgres";

REVOKE ALL ON FUNCTION public.today_counts() FROM PUBLIC,"postgres","anon","authenticated","service_role";
SET LOCAL ROLE "postgres";
GRANT EXECUTE ON FUNCTION public.today_counts() TO PUBLIC;
SET LOCAL ROLE "postgres";
GRANT EXECUTE ON FUNCTION public.today_counts() TO "postgres";
SET LOCAL ROLE "postgres";
GRANT EXECUTE ON FUNCTION public.today_counts() TO "anon";
SET LOCAL ROLE "postgres";
GRANT EXECUTE ON FUNCTION public.today_counts() TO "authenticated";
SET LOCAL ROLE "postgres";
GRANT EXECUTE ON FUNCTION public.today_counts() TO "service_role";
SET LOCAL ROLE postgres;

ALTER FUNCTION public.today_tasks(text) OWNER TO "postgres";

REVOKE ALL ON FUNCTION public.today_tasks(text) FROM PUBLIC,"postgres","anon","authenticated","service_role";
SET LOCAL ROLE "postgres";
GRANT EXECUTE ON FUNCTION public.today_tasks(text) TO PUBLIC;
SET LOCAL ROLE "postgres";
GRANT EXECUTE ON FUNCTION public.today_tasks(text) TO "postgres";
SET LOCAL ROLE "postgres";
GRANT EXECUTE ON FUNCTION public.today_tasks(text) TO "anon";
SET LOCAL ROLE "postgres";
GRANT EXECUTE ON FUNCTION public.today_tasks(text) TO "authenticated";
SET LOCAL ROLE "postgres";
GRANT EXECUTE ON FUNCTION public.today_tasks(text) TO "service_role";
SET LOCAL ROLE postgres;

ALTER FUNCTION public.work_items_today(text) OWNER TO "postgres";

REVOKE ALL ON FUNCTION public.work_items_today(text) FROM PUBLIC,"postgres","anon","authenticated","service_role";
SET LOCAL ROLE "postgres";
GRANT EXECUTE ON FUNCTION public.work_items_today(text) TO PUBLIC;
SET LOCAL ROLE "postgres";
GRANT EXECUTE ON FUNCTION public.work_items_today(text) TO "postgres";
SET LOCAL ROLE "postgres";
GRANT EXECUTE ON FUNCTION public.work_items_today(text) TO "anon";
SET LOCAL ROLE "postgres";
GRANT EXECUTE ON FUNCTION public.work_items_today(text) TO "authenticated";
SET LOCAL ROLE "postgres";
GRANT EXECUTE ON FUNCTION public.work_items_today(text) TO "service_role";
SET LOCAL ROLE postgres;

-- END_BASELINE_OBJECTS

-- Fail before COMMIT if inherited grants or default privilege drift remains.

DO $postcheck$ BEGIN

IF (SELECT array_agg(v ORDER BY v) FROM pg_namespace n,LATERAL unnest(n.nspacl::text[]) v WHERE n.nspname='public') IS DISTINCT FROM ARRAY['=U/pg_database_owner','anon=U/pg_database_owner','authenticated=U/pg_database_owner','pg_database_owner=UC/pg_database_owner','postgres=U/pg_database_owner','service_role=U/pg_database_owner']::text[] THEN RAISE EXCEPTION 'Restored ACL mismatch: public schema'; END IF;

IF (SELECT array_agg(v ORDER BY v) FROM pg_class c,LATERAL unnest(c.relacl::text[]) v WHERE c.oid='public."activities"'::regclass) IS DISTINCT FROM ARRAY['anon=arwdDxtm/postgres','authenticated=arwdDxtm/postgres','postgres=arwdDxtm/postgres','service_role=arwdDxtm/postgres']::text[] THEN RAISE EXCEPTION 'Restored ACL mismatch: activities'; END IF;

IF (SELECT array_agg(v ORDER BY v) FROM pg_class c,LATERAL unnest(c.relacl::text[]) v WHERE c.oid='public."advisory_deals"'::regclass) IS DISTINCT FROM ARRAY['anon=arwdDxtm/postgres','authenticated=arwdDxtm/postgres','postgres=arwdDxtm/postgres','service_role=arwdDxtm/postgres']::text[] THEN RAISE EXCEPTION 'Restored ACL mismatch: advisory_deals'; END IF;

IF (SELECT array_agg(v ORDER BY v) FROM pg_class c,LATERAL unnest(c.relacl::text[]) v WHERE c.oid='public."assignment_history"'::regclass) IS DISTINCT FROM ARRAY['anon=arwdDxtm/postgres','authenticated=arwdDxtm/postgres','postgres=arwdDxtm/postgres','service_role=arwdDxtm/postgres']::text[] THEN RAISE EXCEPTION 'Restored ACL mismatch: assignment_history'; END IF;

IF (SELECT array_agg(v ORDER BY v) FROM pg_class c,LATERAL unnest(c.relacl::text[]) v WHERE c.oid='public."audit_logs"'::regclass) IS DISTINCT FROM ARRAY['anon=arwdDxtm/postgres','authenticated=arwdDxtm/postgres','postgres=arwdDxtm/postgres','service_role=arwdDxtm/postgres']::text[] THEN RAISE EXCEPTION 'Restored ACL mismatch: audit_logs'; END IF;

IF (SELECT array_agg(v ORDER BY v) FROM pg_class c,LATERAL unnest(c.relacl::text[]) v WHERE c.oid='public."business_history"'::regclass) IS DISTINCT FROM ARRAY['anon=arwdDxtm/postgres','authenticated=arwdDxtm/postgres','postgres=arwdDxtm/postgres','service_role=arwdDxtm/postgres']::text[] THEN RAISE EXCEPTION 'Restored ACL mismatch: business_history'; END IF;

IF (SELECT array_agg(v ORDER BY v) FROM pg_class c,LATERAL unnest(c.relacl::text[]) v WHERE c.oid='public."business_history_id_seq"'::regclass) IS DISTINCT FROM ARRAY['anon=rwU/postgres','authenticated=rwU/postgres','postgres=rwU/postgres','service_role=rwU/postgres']::text[] THEN RAISE EXCEPTION 'Restored ACL mismatch: business_history_id_seq'; END IF;

IF (SELECT array_agg(v ORDER BY v) FROM pg_class c,LATERAL unnest(c.relacl::text[]) v WHERE c.oid='public."contact_assignments"'::regclass) IS DISTINCT FROM ARRAY['anon=arwdDxtm/postgres','authenticated=arwdDxtm/postgres','postgres=arwdDxtm/postgres','service_role=arwdDxtm/postgres']::text[] THEN RAISE EXCEPTION 'Restored ACL mismatch: contact_assignments'; END IF;

IF (SELECT array_agg(v ORDER BY v) FROM pg_class c,LATERAL unnest(c.relacl::text[]) v WHERE c.oid='public."contacts"'::regclass) IS DISTINCT FROM ARRAY['anon=arwdDxtm/postgres','authenticated=arwdDxtm/postgres','postgres=arwdDxtm/postgres','service_role=arwdDxtm/postgres']::text[] THEN RAISE EXCEPTION 'Restored ACL mismatch: contacts'; END IF;

IF (SELECT array_agg(v ORDER BY v) FROM pg_class c,LATERAL unnest(c.relacl::text[]) v WHERE c.oid='public."dashboard_state"'::regclass) IS DISTINCT FROM ARRAY['anon=arwdDxtm/postgres','authenticated=arwdDxtm/postgres','postgres=arwdDxtm/postgres','service_role=arwdDxtm/postgres']::text[] THEN RAISE EXCEPTION 'Restored ACL mismatch: dashboard_state'; END IF;

IF (SELECT array_agg(v ORDER BY v) FROM pg_class c,LATERAL unnest(c.relacl::text[]) v WHERE c.oid='public."deals"'::regclass) IS DISTINCT FROM ARRAY['anon=arwdDxtm/postgres','authenticated=arwdDxtm/postgres','postgres=arwdDxtm/postgres','service_role=arwdDxtm/postgres']::text[] THEN RAISE EXCEPTION 'Restored ACL mismatch: deals'; END IF;

IF (SELECT array_agg(v ORDER BY v) FROM pg_class c,LATERAL unnest(c.relacl::text[]) v WHERE c.oid='public."inquiries"'::regclass) IS DISTINCT FROM ARRAY['anon=arwdDxtm/postgres','authenticated=arwdDxtm/postgres','postgres=arwdDxtm/postgres','service_role=arwdDxtm/postgres']::text[] THEN RAISE EXCEPTION 'Restored ACL mismatch: inquiries'; END IF;

IF (SELECT array_agg(v ORDER BY v) FROM pg_class c,LATERAL unnest(c.relacl::text[]) v WHERE c.oid='public."next_actions"'::regclass) IS DISTINCT FROM ARRAY['anon=arwdDxtm/postgres','authenticated=arwdDxtm/postgres','postgres=arwdDxtm/postgres','service_role=arwdDxtm/postgres']::text[] THEN RAISE EXCEPTION 'Restored ACL mismatch: next_actions'; END IF;

IF (SELECT array_agg(v ORDER BY v) FROM pg_class c,LATERAL unnest(c.relacl::text[]) v WHERE c.oid='public."notes"'::regclass) IS DISTINCT FROM ARRAY['anon=arwdDxtm/postgres','authenticated=arwdDxtm/postgres','postgres=arwdDxtm/postgres','service_role=arwdDxtm/postgres']::text[] THEN RAISE EXCEPTION 'Restored ACL mismatch: notes'; END IF;

IF (SELECT array_agg(v ORDER BY v) FROM pg_class c,LATERAL unnest(c.relacl::text[]) v WHERE c.oid='public."opportunities"'::regclass) IS DISTINCT FROM ARRAY['anon=arwdDxtm/postgres','authenticated=arwdDxtm/postgres','postgres=arwdDxtm/postgres','service_role=arwdDxtm/postgres']::text[] THEN RAISE EXCEPTION 'Restored ACL mismatch: opportunities'; END IF;

IF (SELECT array_agg(v ORDER BY v) FROM pg_class c,LATERAL unnest(c.relacl::text[]) v WHERE c.oid='public."organizations"'::regclass) IS DISTINCT FROM ARRAY['anon=arwdDxtm/postgres','authenticated=arwdDxtm/postgres','postgres=arwdDxtm/postgres','service_role=arwdDxtm/postgres']::text[] THEN RAISE EXCEPTION 'Restored ACL mismatch: organizations'; END IF;

IF (SELECT array_agg(v ORDER BY v) FROM pg_class c,LATERAL unnest(c.relacl::text[]) v WHERE c.oid='public."projects"'::regclass) IS DISTINCT FROM ARRAY['anon=arwdDxtm/postgres','authenticated=arwdDxtm/postgres','postgres=arwdDxtm/postgres','service_role=arwdDxtm/postgres']::text[] THEN RAISE EXCEPTION 'Restored ACL mismatch: projects'; END IF;

IF (SELECT array_agg(v ORDER BY v) FROM pg_class c,LATERAL unnest(c.relacl::text[]) v WHERE c.oid='public."sites"'::regclass) IS DISTINCT FROM ARRAY['anon=arwdDxtm/postgres','authenticated=arwdDxtm/postgres','postgres=arwdDxtm/postgres','service_role=arwdDxtm/postgres']::text[] THEN RAISE EXCEPTION 'Restored ACL mismatch: sites'; END IF;

IF (SELECT array_agg(v ORDER BY v) FROM pg_class c,LATERAL unnest(c.relacl::text[]) v WHERE c.oid='public."stage_catalog"'::regclass) IS DISTINCT FROM ARRAY['anon=arwdDxtm/postgres','authenticated=arwdDxtm/postgres','postgres=arwdDxtm/postgres','service_role=arwdDxtm/postgres']::text[] THEN RAISE EXCEPTION 'Restored ACL mismatch: stage_catalog'; END IF;

IF (SELECT array_agg(v ORDER BY v) FROM pg_class c,LATERAL unnest(c.relacl::text[]) v WHERE c.oid='public."stage_catalog_id_seq"'::regclass) IS DISTINCT FROM ARRAY['anon=rwU/postgres','authenticated=rwU/postgres','postgres=rwU/postgres','service_role=rwU/postgres']::text[] THEN RAISE EXCEPTION 'Restored ACL mismatch: stage_catalog_id_seq'; END IF;

IF (SELECT array_agg(v ORDER BY v) FROM pg_class c,LATERAL unnest(c.relacl::text[]) v WHERE c.oid='public."stage_history"'::regclass) IS DISTINCT FROM ARRAY['anon=arwdDxtm/postgres','authenticated=arwdDxtm/postgres','postgres=arwdDxtm/postgres','service_role=arwdDxtm/postgres']::text[] THEN RAISE EXCEPTION 'Restored ACL mismatch: stage_history'; END IF;

IF (SELECT array_agg(v ORDER BY v) FROM pg_class c,LATERAL unnest(c.relacl::text[]) v WHERE c.oid='public."users"'::regclass) IS DISTINCT FROM ARRAY['anon=arwdDxtm/postgres','authenticated=arwdDxtm/postgres','postgres=arwdDxtm/postgres','service_role=arwdDxtm/postgres']::text[] THEN RAISE EXCEPTION 'Restored ACL mismatch: users'; END IF;

IF (SELECT array_agg(v ORDER BY v) FROM pg_class c,LATERAL unnest(c.relacl::text[]) v WHERE c.oid='public."v_assignee"'::regclass) IS DISTINCT FROM ARRAY['anon=arwdDxtm/postgres','authenticated=arwdDxtm/postgres','postgres=arwdDxtm/postgres','service_role=arwdDxtm/postgres']::text[] THEN RAISE EXCEPTION 'Restored ACL mismatch: v_assignee'; END IF;

IF (SELECT array_agg(v ORDER BY v) FROM pg_class c,LATERAL unnest(c.relacl::text[]) v WHERE c.oid='public."v_dup_org"'::regclass) IS DISTINCT FROM ARRAY['anon=arwdDxtm/postgres','authenticated=arwdDxtm/postgres','postgres=arwdDxtm/postgres','service_role=arwdDxtm/postgres']::text[] THEN RAISE EXCEPTION 'Restored ACL mismatch: v_dup_org'; END IF;

IF (SELECT array_agg(v ORDER BY v) FROM pg_class c,LATERAL unnest(c.relacl::text[]) v WHERE c.oid='public."v_funnel"'::regclass) IS DISTINCT FROM ARRAY['anon=arwdDxtm/postgres','authenticated=arwdDxtm/postgres','postgres=arwdDxtm/postgres','service_role=arwdDxtm/postgres']::text[] THEN RAISE EXCEPTION 'Restored ACL mismatch: v_funnel'; END IF;

IF (SELECT array_agg(v ORDER BY v) FROM pg_class c,LATERAL unnest(c.relacl::text[]) v WHERE c.oid='public."v_kanban"'::regclass) IS DISTINCT FROM ARRAY['anon=arwdDxtm/postgres','authenticated=arwdDxtm/postgres','postgres=arwdDxtm/postgres','service_role=arwdDxtm/postgres']::text[] THEN RAISE EXCEPTION 'Restored ACL mismatch: v_kanban'; END IF;

IF (SELECT array_agg(v ORDER BY v) FROM pg_proc p,LATERAL unnest(p.proacl::text[]) v WHERE p.oid='public._done_today(text)'::regprocedure) IS DISTINCT FROM ARRAY['=X/postgres','anon=X/postgres','authenticated=X/postgres','postgres=X/postgres','service_role=X/postgres']::text[] THEN RAISE EXCEPTION 'Restored ACL mismatch: _done_today(text)'; END IF;

IF (SELECT array_agg(v ORDER BY v) FROM pg_proc p,LATERAL unnest(p.proacl::text[]) v WHERE p.oid='public.apply_business_change(uuid,text,text,text,text,text,date)'::regprocedure) IS DISTINCT FROM ARRAY['=X/postgres','anon=X/postgres','authenticated=X/postgres','postgres=X/postgres','service_role=X/postgres']::text[] THEN RAISE EXCEPTION 'Restored ACL mismatch: apply_business_change(uuid,text,text,text,text,text,date)'; END IF;

IF (SELECT array_agg(v ORDER BY v) FROM pg_proc p,LATERAL unnest(p.proacl::text[]) v WHERE p.oid='public.crm_bundle()'::regprocedure) IS DISTINCT FROM ARRAY['=X/postgres','anon=X/postgres','authenticated=X/postgres','postgres=X/postgres','service_role=X/postgres']::text[] THEN RAISE EXCEPTION 'Restored ACL mismatch: crm_bundle()'; END IF;

IF (SELECT array_agg(v ORDER BY v) FROM pg_proc p,LATERAL unnest(p.proacl::text[]) v WHERE p.oid='public.crm_contact_move(jsonb)'::regprocedure) IS DISTINCT FROM ARRAY['postgres=X/postgres','service_role=X/postgres']::text[] THEN RAISE EXCEPTION 'Restored ACL mismatch: crm_contact_move(jsonb)'; END IF;

IF (SELECT array_agg(v ORDER BY v) FROM pg_proc p,LATERAL unnest(p.proacl::text[]) v WHERE p.oid='public.crm_contact_upsert(jsonb)'::regprocedure) IS DISTINCT FROM ARRAY['postgres=X/postgres','service_role=X/postgres']::text[] THEN RAISE EXCEPTION 'Restored ACL mismatch: crm_contact_upsert(jsonb)'; END IF;

IF (SELECT array_agg(v ORDER BY v) FROM pg_proc p,LATERAL unnest(p.proacl::text[]) v WHERE p.oid='public.crm_opportunity_work_set(jsonb)'::regprocedure) IS DISTINCT FROM ARRAY['=X/postgres','anon=X/postgres','authenticated=X/postgres','postgres=X/postgres','service_role=X/postgres']::text[] THEN RAISE EXCEPTION 'Restored ACL mismatch: crm_opportunity_work_set(jsonb)'; END IF;

IF (SELECT array_agg(v ORDER BY v) FROM pg_proc p,LATERAL unnest(p.proacl::text[]) v WHERE p.oid='public.crm_site_contacts(uuid)'::regprocedure) IS DISTINCT FROM ARRAY['=X/postgres','anon=X/postgres','authenticated=X/postgres','postgres=X/postgres','service_role=X/postgres']::text[] THEN RAISE EXCEPTION 'Restored ACL mismatch: crm_site_contacts(uuid)'; END IF;

IF (SELECT array_agg(v ORDER BY v) FROM pg_proc p,LATERAL unnest(p.proacl::text[]) v WHERE p.oid='public.metrics_channel_flow()'::regprocedure) IS DISTINCT FROM ARRAY['=X/postgres','anon=X/postgres','authenticated=X/postgres','postgres=X/postgres','service_role=X/postgres']::text[] THEN RAISE EXCEPTION 'Restored ACL mismatch: metrics_channel_flow()'; END IF;

IF (SELECT array_agg(v ORDER BY v) FROM pg_proc p,LATERAL unnest(p.proacl::text[]) v WHERE p.oid='public.metrics_lost_breakdown(text)'::regprocedure) IS DISTINCT FROM ARRAY['=X/postgres','anon=X/postgres','authenticated=X/postgres','postgres=X/postgres','service_role=X/postgres']::text[] THEN RAISE EXCEPTION 'Restored ACL mismatch: metrics_lost_breakdown(text)'; END IF;

IF (SELECT array_agg(v ORDER BY v) FROM pg_proc p,LATERAL unnest(p.proacl::text[]) v WHERE p.oid='public.metrics_operations(text)'::regprocedure) IS DISTINCT FROM ARRAY['=X/postgres','anon=X/postgres','authenticated=X/postgres','postgres=X/postgres','service_role=X/postgres']::text[] THEN RAISE EXCEPTION 'Restored ACL mismatch: metrics_operations(text)'; END IF;

IF (SELECT array_agg(v ORDER BY v) FROM pg_proc p,LATERAL unnest(p.proacl::text[]) v WHERE p.oid='public.parse_responses(text)'::regprocedure) IS DISTINCT FROM ARRAY['=X/postgres','anon=X/postgres','authenticated=X/postgres','postgres=X/postgres','service_role=X/postgres']::text[] THEN RAISE EXCEPTION 'Restored ACL mismatch: parse_responses(text)'; END IF;

IF (SELECT array_agg(v ORDER BY v) FROM pg_proc p,LATERAL unnest(p.proacl::text[]) v WHERE p.oid='public.require_reason(text,text)'::regprocedure) IS DISTINCT FROM ARRAY['=X/postgres','anon=X/postgres','authenticated=X/postgres','postgres=X/postgres','service_role=X/postgres']::text[] THEN RAISE EXCEPTION 'Restored ACL mismatch: require_reason(text,text)'; END IF;

IF (SELECT array_agg(v ORDER BY v) FROM pg_proc p,LATERAL unnest(p.proacl::text[]) v WHERE p.oid='public.set_updated_at()'::regprocedure) IS DISTINCT FROM ARRAY['=X/postgres','anon=X/postgres','authenticated=X/postgres','postgres=X/postgres','service_role=X/postgres']::text[] THEN RAISE EXCEPTION 'Restored ACL mismatch: set_updated_at()'; END IF;

IF (SELECT array_agg(v ORDER BY v) FROM pg_proc p,LATERAL unnest(p.proacl::text[]) v WHERE p.oid='public.stage_sla_days(text)'::regprocedure) IS DISTINCT FROM ARRAY['=X/postgres','anon=X/postgres','authenticated=X/postgres','postgres=X/postgres','service_role=X/postgres']::text[] THEN RAISE EXCEPTION 'Restored ACL mismatch: stage_sla_days(text)'; END IF;

IF (SELECT array_agg(v ORDER BY v) FROM pg_proc p,LATERAL unnest(p.proacl::text[]) v WHERE p.oid='public.today_counts()'::regprocedure) IS DISTINCT FROM ARRAY['=X/postgres','anon=X/postgres','authenticated=X/postgres','postgres=X/postgres','service_role=X/postgres']::text[] THEN RAISE EXCEPTION 'Restored ACL mismatch: today_counts()'; END IF;

IF (SELECT array_agg(v ORDER BY v) FROM pg_proc p,LATERAL unnest(p.proacl::text[]) v WHERE p.oid='public.today_tasks(text)'::regprocedure) IS DISTINCT FROM ARRAY['=X/postgres','anon=X/postgres','authenticated=X/postgres','postgres=X/postgres','service_role=X/postgres']::text[] THEN RAISE EXCEPTION 'Restored ACL mismatch: today_tasks(text)'; END IF;

IF (SELECT array_agg(v ORDER BY v) FROM pg_proc p,LATERAL unnest(p.proacl::text[]) v WHERE p.oid='public.work_items_today(text)'::regprocedure) IS DISTINCT FROM ARRAY['=X/postgres','anon=X/postgres','authenticated=X/postgres','postgres=X/postgres','service_role=X/postgres']::text[] THEN RAISE EXCEPTION 'Restored ACL mismatch: work_items_today(text)'; END IF;

IF (SELECT array_agg(v ORDER BY v) FROM pg_default_acl d,LATERAL unnest(d.defaclacl::text[]) v WHERE d.defaclrole='postgres'::regrole AND d.defaclnamespace='public'::regnamespace AND d.defaclobjtype='S') IS DISTINCT FROM ARRAY['anon=rwU/postgres','authenticated=rwU/postgres','postgres=rwU/postgres','service_role=rwU/postgres']::text[] THEN RAISE EXCEPTION 'Restored ACL mismatch: postgres/S'; END IF;

IF (SELECT array_agg(v ORDER BY v) FROM pg_default_acl d,LATERAL unnest(d.defaclacl::text[]) v WHERE d.defaclrole='postgres'::regrole AND d.defaclnamespace='public'::regnamespace AND d.defaclobjtype='f') IS DISTINCT FROM ARRAY['anon=X/postgres','authenticated=X/postgres','postgres=X/postgres','service_role=X/postgres']::text[] THEN RAISE EXCEPTION 'Restored ACL mismatch: postgres/f'; END IF;

IF (SELECT array_agg(v ORDER BY v) FROM pg_default_acl d,LATERAL unnest(d.defaclacl::text[]) v WHERE d.defaclrole='postgres'::regrole AND d.defaclnamespace='public'::regnamespace AND d.defaclobjtype='r') IS DISTINCT FROM ARRAY['anon=arwdDxtm/postgres','authenticated=arwdDxtm/postgres','postgres=arwdDxtm/postgres','service_role=arwdDxtm/postgres']::text[] THEN RAISE EXCEPTION 'Restored ACL mismatch: postgres/r'; END IF;

IF (SELECT array_agg(v ORDER BY v) FROM pg_default_acl d,LATERAL unnest(d.defaclacl::text[]) v WHERE d.defaclrole='supabase_admin'::regrole AND d.defaclnamespace='public'::regnamespace AND d.defaclobjtype='S') IS DISTINCT FROM ARRAY['anon=rwU/supabase_admin','authenticated=rwU/supabase_admin','postgres=rwU/supabase_admin','service_role=rwU/supabase_admin']::text[] THEN RAISE EXCEPTION 'Restored ACL mismatch: supabase_admin/S'; END IF;

IF (SELECT array_agg(v ORDER BY v) FROM pg_default_acl d,LATERAL unnest(d.defaclacl::text[]) v WHERE d.defaclrole='supabase_admin'::regrole AND d.defaclnamespace='public'::regnamespace AND d.defaclobjtype='f') IS DISTINCT FROM ARRAY['anon=X/supabase_admin','authenticated=X/supabase_admin','postgres=X/supabase_admin','service_role=X/supabase_admin']::text[] THEN RAISE EXCEPTION 'Restored ACL mismatch: supabase_admin/f'; END IF;

IF (SELECT array_agg(v ORDER BY v) FROM pg_default_acl d,LATERAL unnest(d.defaclacl::text[]) v WHERE d.defaclrole='supabase_admin'::regrole AND d.defaclnamespace='public'::regnamespace AND d.defaclobjtype='r') IS DISTINCT FROM ARRAY['anon=arwdDxtm/supabase_admin','authenticated=arwdDxtm/supabase_admin','postgres=arwdDxtm/supabase_admin','service_role=arwdDxtm/supabase_admin']::text[] THEN RAISE EXCEPTION 'Restored ACL mismatch: supabase_admin/r'; END IF;

IF (SELECT count(*) FROM pg_default_acl WHERE defaclnamespace=0 OR defaclnamespace='public'::regnamespace)<>6 THEN RAISE EXCEPTION 'Unexpected default privilege rows'; END IF;

END $postcheck$;

-- Full structural comparison using capture-metadata.sql is additionally required.

COMMIT;
