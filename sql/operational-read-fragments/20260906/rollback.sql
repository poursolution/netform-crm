-- Remove only the unconnected private read fragment.
BEGIN;
SET LOCAL search_path=pg_catalog;
SET LOCAL lock_timeout='3s';
SET LOCAL statement_timeout='60s';
DO $guard$ DECLARE p record; BEGIN
 SELECT * INTO p FROM pg_proc WHERE oid='crm_security.crm_operational_read_fragment_v1(text,uuid,integer)'::regprocedure;
 IF current_setting('crm.operational_read_ref',true) IS DISTINCT FROM 'rprechiaglyjaydkmxsu'
  OR p.oid IS NULL OR pg_get_userbyid(p.proowner)<>'postgres' OR NOT p.prosecdef
  OR p.proconfig IS DISTINCT FROM ARRAY['search_path=""']
  OR has_function_privilege('authenticated',p.oid,'EXECUTE')
 THEN RAISE EXCEPTION 'operational read fragment rollback drift'; END IF;
END $guard$;
DROP FUNCTION crm_security.crm_operational_read_fragment_v1(text,uuid,integer);
COMMIT;
