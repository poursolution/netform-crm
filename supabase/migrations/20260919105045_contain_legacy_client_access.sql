-- Approved netform-crm legacy client access containment.
-- Target: netform-crm production ymfbmpnizxvqsamnczow, reviewed 2026-09-19.
-- Current CRM scoped API and service_role remain available.
SET LOCAL lock_timeout='2s';
SET LOCAL statement_timeout='20s';
DO $preflight$ BEGIN
IF (SELECT proacl::text FROM pg_proc WHERE oid=to_regprocedure('public.crm_bundle()')) IS DISTINCT FROM '{=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}' THEN RAISE EXCEPTION 'Function ACL changed: crm_bundle()'; END IF;
IF (SELECT proacl::text FROM pg_proc WHERE oid=to_regprocedure('public.crm_opportunity_work_set(jsonb)')) IS DISTINCT FROM '{=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}' THEN RAISE EXCEPTION 'Function ACL changed: crm_opportunity_work_set(jsonb)'; END IF;
IF (SELECT proacl::text FROM pg_proc WHERE oid=to_regprocedure('public.crm_site_contacts(uuid)')) IS DISTINCT FROM '{=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}' THEN RAISE EXCEPTION 'Function ACL changed: crm_site_contacts(uuid)'; END IF;
IF (SELECT proacl::text FROM pg_proc WHERE oid=to_regprocedure('public.today_counts()')) IS DISTINCT FROM '{=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}' THEN RAISE EXCEPTION 'Function ACL changed: today_counts()'; END IF;
IF (SELECT proacl::text FROM pg_proc WHERE oid=to_regprocedure('public.today_tasks(text)')) IS DISTINCT FROM '{=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}' THEN RAISE EXCEPTION 'Function ACL changed: today_tasks(text)'; END IF;
IF (SELECT relacl::text FROM pg_class WHERE oid=to_regclass('public.advisory_deals')) IS DISTINCT FROM '{postgres=arwdDxtm/postgres,anon=arwdDxtm/postgres,authenticated=arwdDxtm/postgres,service_role=arwdDxtm/postgres}' OR EXISTS(SELECT 1 FROM pg_attribute WHERE attrelid=to_regclass('public.advisory_deals') AND attnum>0 AND attacl IS NOT NULL) THEN RAISE EXCEPTION 'Relation ACL changed: advisory_deals'; END IF;
IF (SELECT relacl::text FROM pg_class WHERE oid=to_regclass('public.assignment_history')) IS DISTINCT FROM '{postgres=arwdDxtm/postgres,anon=arwdDxtm/postgres,authenticated=arwdDxtm/postgres,service_role=arwdDxtm/postgres}' OR EXISTS(SELECT 1 FROM pg_attribute WHERE attrelid=to_regclass('public.assignment_history') AND attnum>0 AND attacl IS NOT NULL) THEN RAISE EXCEPTION 'Relation ACL changed: assignment_history'; END IF;
IF (SELECT relacl::text FROM pg_class WHERE oid=to_regclass('public.business_history')) IS DISTINCT FROM '{postgres=arwdDxtm/postgres,anon=arwdDxtm/postgres,authenticated=arwdDxtm/postgres,service_role=arwdDxtm/postgres}' OR EXISTS(SELECT 1 FROM pg_attribute WHERE attrelid=to_regclass('public.business_history') AND attnum>0 AND attacl IS NOT NULL) THEN RAISE EXCEPTION 'Relation ACL changed: business_history'; END IF;
IF (SELECT relacl::text FROM pg_class WHERE oid=to_regclass('public.opportunities')) IS DISTINCT FROM '{postgres=arwdDxtm/postgres,anon=arwdDxtm/postgres,authenticated=arwdDxtm/postgres,service_role=arwdDxtm/postgres}' OR EXISTS(SELECT 1 FROM pg_attribute WHERE attrelid=to_regclass('public.opportunities') AND attnum>0 AND attacl IS NOT NULL) THEN RAISE EXCEPTION 'Relation ACL changed: opportunities'; END IF;
IF (SELECT relacl::text FROM pg_class WHERE oid=to_regclass('public.projects')) IS DISTINCT FROM '{postgres=arwdDxtm/postgres,anon=arwdDxtm/postgres,authenticated=arwdDxtm/postgres,service_role=arwdDxtm/postgres}' OR EXISTS(SELECT 1 FROM pg_attribute WHERE attrelid=to_regclass('public.projects') AND attnum>0 AND attacl IS NOT NULL) THEN RAISE EXCEPTION 'Relation ACL changed: projects'; END IF;
IF (SELECT relacl::text FROM pg_class WHERE oid=to_regclass('public.stage_catalog')) IS DISTINCT FROM '{postgres=arwdDxtm/postgres,anon=arwdDxtm/postgres,authenticated=arwdDxtm/postgres,service_role=arwdDxtm/postgres}' OR EXISTS(SELECT 1 FROM pg_attribute WHERE attrelid=to_regclass('public.stage_catalog') AND attnum>0 AND attacl IS NOT NULL) THEN RAISE EXCEPTION 'Relation ACL changed: stage_catalog'; END IF;
IF (SELECT relacl::text FROM pg_class WHERE oid=to_regclass('public.stage_history')) IS DISTINCT FROM '{postgres=arwdDxtm/postgres,anon=arwdDxtm/postgres,authenticated=arwdDxtm/postgres,service_role=arwdDxtm/postgres}' OR EXISTS(SELECT 1 FROM pg_attribute WHERE attrelid=to_regclass('public.stage_history') AND attnum>0 AND attacl IS NOT NULL) THEN RAISE EXCEPTION 'Relation ACL changed: stage_history'; END IF;
IF (SELECT relacl::text FROM pg_class WHERE oid=to_regclass('public.v_assignee')) IS DISTINCT FROM '{postgres=arwdDxtm/postgres,anon=arwdDxtm/postgres,authenticated=arwdDxtm/postgres,service_role=arwdDxtm/postgres}' OR EXISTS(SELECT 1 FROM pg_attribute WHERE attrelid=to_regclass('public.v_assignee') AND attnum>0 AND attacl IS NOT NULL) THEN RAISE EXCEPTION 'Relation ACL changed: v_assignee'; END IF;
IF (SELECT relacl::text FROM pg_class WHERE oid=to_regclass('public.v_dup_org')) IS DISTINCT FROM '{postgres=arwdDxtm/postgres,anon=arwdDxtm/postgres,authenticated=arwdDxtm/postgres,service_role=arwdDxtm/postgres}' OR EXISTS(SELECT 1 FROM pg_attribute WHERE attrelid=to_regclass('public.v_dup_org') AND attnum>0 AND attacl IS NOT NULL) THEN RAISE EXCEPTION 'Relation ACL changed: v_dup_org'; END IF;
IF (SELECT relacl::text FROM pg_class WHERE oid=to_regclass('public.v_funnel')) IS DISTINCT FROM '{postgres=arwdDxtm/postgres,anon=arwdDxtm/postgres,authenticated=arwdDxtm/postgres,service_role=arwdDxtm/postgres}' OR EXISTS(SELECT 1 FROM pg_attribute WHERE attrelid=to_regclass('public.v_funnel') AND attnum>0 AND attacl IS NOT NULL) THEN RAISE EXCEPTION 'Relation ACL changed: v_funnel'; END IF;
IF (SELECT relacl::text FROM pg_class WHERE oid=to_regclass('public.v_kanban')) IS DISTINCT FROM '{postgres=arwdDxtm/postgres,anon=arwdDxtm/postgres,authenticated=arwdDxtm/postgres,service_role=arwdDxtm/postgres}' OR EXISTS(SELECT 1 FROM pg_attribute WHERE attrelid=to_regclass('public.v_kanban') AND attnum>0 AND attacl IS NOT NULL) THEN RAISE EXCEPTION 'Relation ACL changed: v_kanban'; END IF;
END $preflight$;
REVOKE EXECUTE ON FUNCTION public.crm_bundle() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.crm_opportunity_work_set(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.crm_site_contacts(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.today_counts() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.today_tasks(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public.advisory_deals FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public.assignment_history FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public.business_history FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public.opportunities FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public.projects FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public.stage_catalog FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public.stage_history FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public.v_assignee FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public.v_dup_org FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public.v_funnel FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public.v_kanban FROM PUBLIC, anon, authenticated;
DO $checks$
DECLARE signature text; rel text; role_name text;
BEGIN
FOREACH signature IN ARRAY ARRAY['public.crm_bundle()','public.crm_opportunity_work_set(jsonb)','public.crm_site_contacts(uuid)','public.today_counts()','public.today_tasks(text)'] LOOP
 IF has_function_privilege('anon',signature,'EXECUTE') OR has_function_privilege('authenticated',signature,'EXECUTE') OR NOT has_function_privilege('service_role',signature,'EXECUTE') THEN RAISE EXCEPTION 'Function ACL assertion failed: %',signature; END IF;
END LOOP;
FOREACH rel IN ARRAY ARRAY['public.advisory_deals','public.assignment_history','public.business_history','public.opportunities','public.projects','public.stage_catalog','public.stage_history','public.v_assignee','public.v_dup_org','public.v_funnel','public.v_kanban'] LOOP
 FOREACH role_name IN ARRAY ARRAY['anon','authenticated'] LOOP
  IF has_table_privilege(role_name,rel,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') OR has_any_column_privilege(role_name,rel,'SELECT,INSERT,UPDATE,REFERENCES') THEN RAISE EXCEPTION 'Relation ACL assertion failed: % %',rel,role_name; END IF;
 END LOOP;
 IF NOT has_table_privilege('service_role',rel,'SELECT') OR NOT has_table_privilege('service_role',rel,'INSERT') OR NOT has_table_privilege('service_role',rel,'UPDATE') OR NOT has_table_privilege('service_role',rel,'DELETE') THEN RAISE EXCEPTION 'Service ACL assertion failed: %',rel; END IF;
END LOOP;
IF NOT has_function_privilege('authenticated','public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)','EXECUTE') OR NOT has_function_privilege('authenticated','public.crm_profile_scoped_v2()','EXECUTE') OR NOT has_function_privilege('authenticated','public.crm_contacts_scoped_v2(uuid)','EXECUTE') THEN RAISE EXCEPTION 'Scoped API permission lost'; END IF;
END $checks$;
