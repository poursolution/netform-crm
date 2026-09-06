-- Removes only the local operational source pair. Existing read/write functions and data remain.
BEGIN;
SET LOCAL search_path=pg_catalog;
SET LOCAL lock_timeout='3s';
SET LOCAL statement_timeout='60s';
DO $guard$ BEGIN
 IF current_setting('crm.operational_source_ref',true) IS DISTINCT FROM 'rprechiaglyjaydkmxsu'
  OR to_regprocedure('public.crm_operational_source_v1(text,uuid,integer)') IS NULL
  OR to_regprocedure('crm_security.crm_operational_source_fragment_v1(text,uuid,integer)') IS NULL
 THEN RAISE EXCEPTION 'operational source rollback drift'; END IF;
END $guard$;
DROP FUNCTION public.crm_operational_source_v1(text,uuid,integer);
DROP FUNCTION crm_security.crm_operational_source_fragment_v1(text,uuid,integer);
COMMIT;
