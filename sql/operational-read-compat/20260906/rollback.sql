-- Exact rollback for a deliberately non-mutating decision gate.
BEGIN READ ONLY;
SET LOCAL search_path=pg_catalog;
SET LOCAL lock_timeout='3s';
SET LOCAL statement_timeout='60s';

DO $guard$ DECLARE p record; BEGIN
 SELECT * INTO p FROM pg_proc
  WHERE oid='public.crm_read_scoped_v2(uuid,integer,uuid,uuid)'::regprocedure;
 IF current_setting('crm.operational_read_compat_ref',true) IS DISTINCT FROM 'rprechiaglyjaydkmxsu'
  OR p.oid IS NULL OR pg_get_userbyid(p.proowner)<>'postgres' OR NOT p.prosecdef
  OR p.provolatile<>'s' OR p.proconfig IS DISTINCT FROM ARRAY['search_path=""']
  OR coalesce(p.proacl::text,'')<>'{postgres=X/postgres,authenticated=X/postgres}'
  OR md5(pg_get_functiondef(p.oid))<>'919c4abff86e37beeb62ccb15beba33e'
 THEN RAISE EXCEPTION 'non-mutating operational read rollback drift'; END IF;
END $guard$;

SELECT jsonb_build_object('status','EXACT_NO_CHANGE','public_function_changed',false) AS rollback_result;
COMMIT;
