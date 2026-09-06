-- STAGING ONLY. Domain version conflicts must not signal retryable serialization failures.
BEGIN;
SET LOCAL search_path=public,pg_catalog; SET LOCAL lock_timeout='3s'; SET LOCAL statement_timeout='30s';
DO $patch$ DECLARE def text; BEGIN
 IF current_user<>'postgres' OR current_setting('crm.v2_staging_ref',true) IS DISTINCT FROM 'rprechiaglyjaydkmxsu' OR current_setting('crm.v2_approved',true) IS DISTINCT FROM 'yes' THEN RAISE EXCEPTION 'Staging-only approval required'; END IF;
 SELECT replace(replace(pg_get_functiondef(oid),chr(13)||chr(10),chr(10)),chr(13),chr(10)) INTO def FROM pg_proc WHERE oid='public.crm_work_set_scoped_v2(uuid,text,jsonb,text,integer,text)'::regprocedure;
 IF md5(def)<>'245529d8a59c2e99cf13d8e6cc11948e' OR
 (SELECT proowner<>'postgres'::regrole OR proacl IS DISTINCT FROM ARRAY['postgres=X/postgres','authenticated=X/postgres']::aclitem[] OR proconfig IS DISTINCT FROM ARRAY['search_path=""'] FROM pg_proc WHERE oid='public.crm_work_set_scoped_v2(uuid,text,jsonb,text,integer,text)'::regprocedure) THEN RAISE EXCEPTION 'Unexpected work RPC before version-conflict patch'; END IF;
 EXECUTE replace(def,'ERRCODE=''40001''','ERRCODE=''PT409''');
END $patch$;
REVOKE EXECUTE ON FUNCTION public.crm_work_set_scoped_v2(uuid,text,jsonb,text,integer,text) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.crm_work_set_scoped_v2(uuid,text,jsonb,text,integer,text) TO authenticated;
DO $verify$ BEGIN
 IF has_function_privilege('anon','public.crm_work_set_scoped_v2(uuid,text,jsonb,text,integer,text)','EXECUTE') OR NOT has_function_privilege('authenticated','public.crm_work_set_scoped_v2(uuid,text,jsonb,text,integer,text)','EXECUTE') THEN RAISE EXCEPTION 'Conflict patch ACL failure'; END IF;
END $verify$;
COMMIT;
