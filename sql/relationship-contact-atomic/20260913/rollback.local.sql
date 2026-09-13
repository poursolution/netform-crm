-- LOCAL CHAIN ROLLBACK ONLY. Restore the same original dispatcher object.
-- Do not delete committed contact/activity/next-action/audit/receipt evidence.
BEGIN;
DO $guard$ BEGIN
 IF current_setting('crm.relationship_contact_lab',true) IS DISTINCT FROM 'local-only'
  OR md5(pg_get_functiondef(to_regprocedure('public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)')))
    IS DISTINCT FROM current_setting('crm.relationship_contact_rollback_md5',true)
  OR to_regprocedure('crm_security.crm_write_command_v2_before_relationship_contact_candidate(uuid,text,uuid,integer,jsonb)') IS NULL
 THEN RAISE EXCEPTION 'local rollback baseline drift'; END IF;
END $guard$;
DROP FUNCTION public.crm_write_command_v2(uuid,text,uuid,integer,jsonb);
ALTER FUNCTION crm_security.crm_write_command_v2_before_relationship_contact_candidate(uuid,text,uuid,integer,jsonb) SET SCHEMA public;
ALTER FUNCTION public.crm_write_command_v2_before_relationship_contact_candidate(uuid,text,uuid,integer,jsonb) RENAME TO crm_write_command_v2;
GRANT EXECUTE ON FUNCTION public.crm_write_command_v2(uuid,text,uuid,integer,jsonb) TO authenticated;
DROP FUNCTION crm_security.crm_relationship_contact_candidate(uuid,uuid,integer,jsonb);
COMMIT;
