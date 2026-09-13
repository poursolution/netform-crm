-- LOCAL CHAIN TEST ONLY. Requires a separately captured dispatcher hash.
-- Production application requires a reviewed, environment-bound migration and explicit approval.
BEGIN;
SET LOCAL search_path=pg_catalog;
DO $guard$ DECLARE p record; BEGIN
 SELECT * INTO p FROM pg_proc WHERE oid=to_regprocedure('public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)');
 IF current_setting('crm.relationship_contact_lab',true) IS DISTINCT FROM 'local-only'
  OR p.oid IS NULL OR NOT p.prosecdef OR pg_get_userbyid(p.proowner)<>'postgres'
  OR p.proconfig IS DISTINCT FROM ARRAY['search_path=""']
  OR p.proacl::text IS DISTINCT FROM '{postgres=X/postgres,authenticated=X/postgres}'
  OR md5(pg_get_functiondef(p.oid)) IS DISTINCT FROM current_setting('crm.relationship_contact_dispatcher_md5',true)
  OR to_regprocedure('crm_security.crm_relationship_contact_candidate(uuid,uuid,integer,jsonb)') IS NULL
  OR to_regprocedure('crm_security.crm_write_command_v2_before_relationship_contact_candidate(uuid,text,uuid,integer,jsonb)') IS NOT NULL
 THEN RAISE EXCEPTION 'local dispatcher baseline drift'; END IF;
END $guard$;
ALTER FUNCTION public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)
 RENAME TO crm_write_command_v2_before_relationship_contact_candidate;
ALTER FUNCTION public.crm_write_command_v2_before_relationship_contact_candidate(uuid,text,uuid,integer,jsonb)
 SET SCHEMA crm_security;
REVOKE ALL ON FUNCTION crm_security.crm_write_command_v2_before_relationship_contact_candidate(uuid,text,uuid,integer,jsonb)
 FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION public.crm_write_command_v2(
 p_request_id uuid,p_operation text,p_object_id uuid,p_expected_version integer,p_payload jsonb
) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $fn$
BEGIN
 IF p_operation='relationship_contact' THEN
  RETURN crm_security.crm_relationship_contact_candidate(p_request_id,p_object_id,p_expected_version,p_payload);
 END IF;
 RETURN crm_security.crm_write_command_v2_before_relationship_contact_candidate(p_request_id,p_operation,p_object_id,p_expected_version,p_payload);
END $fn$;
REVOKE ALL ON FUNCTION public.crm_write_command_v2(uuid,text,uuid,integer,jsonb) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.crm_write_command_v2(uuid,text,uuid,integer,jsonb) TO authenticated;
COMMIT;
