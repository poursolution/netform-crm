-- Evidence-preserving rollback for the T03 private local candidate only.
BEGIN;
SET LOCAL search_path=pg_catalog;
SET LOCAL lock_timeout='3s';
SET LOCAL statement_timeout='60s';
DO $guard$ BEGIN
 IF current_setting('crm.attachment_state_ref',true) IS DISTINCT FROM 'rprechiaglyjaydkmxsu'
  OR to_regprocedure('crm_security.crm_user_opportunity_state_command_v1(uuid,text,uuid,jsonb)') IS NULL
  OR to_regprocedure('crm_security.crm_user_opportunity_states_v1()') IS NULL
  OR to_regclass('crm_security.user_opportunity_state') IS NULL
  OR to_regclass('crm_security.user_opportunity_state_receipts') IS NULL
  OR to_regnamespace('crm_attachment_state_archive') IS NOT NULL
 THEN RAISE EXCEPTION 'attachment/state rollback drift'; END IF;
END $guard$;
DROP FUNCTION crm_security.crm_user_opportunity_states_v1();
DROP FUNCTION crm_security.crm_user_opportunity_state_command_v1(uuid,text,uuid,jsonb);
CREATE SCHEMA crm_attachment_state_archive AUTHORIZATION postgres;
REVOKE ALL ON SCHEMA crm_attachment_state_archive FROM PUBLIC,anon,authenticated,service_role;
ALTER TABLE crm_security.user_opportunity_state_receipts
 SET SCHEMA crm_attachment_state_archive;
ALTER TABLE crm_security.user_opportunity_state
 SET SCHEMA crm_attachment_state_archive;
REVOKE ALL ON crm_attachment_state_archive.user_opportunity_state,
 crm_attachment_state_archive.user_opportunity_state_receipts
 FROM PUBLIC,anon,authenticated,service_role;
COMMIT;
