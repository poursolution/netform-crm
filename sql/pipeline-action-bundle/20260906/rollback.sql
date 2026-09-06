-- Evidence-preserving rollback for the private local helper only.
BEGIN;
SET LOCAL search_path=pg_catalog;
SET LOCAL lock_timeout='3s';
SET LOCAL statement_timeout='60s';
DO $guard$ BEGIN
 IF current_setting('crm.pipeline_action_ref',true) IS DISTINCT FROM 'rprechiaglyjaydkmxsu'
  OR to_regprocedure('crm_security.crm_pipeline_action_command_v1(uuid,text,uuid,integer,jsonb)') IS NULL
  OR to_regnamespace('crm_pipeline_action_archive') IS NOT NULL
  OR (SELECT pg_get_constraintdef(oid,true) FROM pg_constraint
      WHERE conrelid='crm_security.command_receipts'::regclass AND conname='command_receipts_operation_check')
     IS DISTINCT FROM 'CHECK (operation = ANY (ARRAY[''opportunity_work_set''::text, ''inquiry_assign''::text, ''service_change''::text, ''inquiry_unassign''::text, ''next_action''::text, ''activity''::text]))'
 THEN RAISE EXCEPTION 'pipeline action rollback drift'; END IF;
END $guard$;
CREATE SCHEMA crm_pipeline_action_archive AUTHORIZATION postgres;
REVOKE ALL ON SCHEMA crm_pipeline_action_archive FROM PUBLIC,anon,authenticated,service_role;
CREATE TABLE crm_pipeline_action_archive.command_receipts AS
 SELECT * FROM crm_security.command_receipts WHERE operation IN ('next_action','activity');
REVOKE ALL ON crm_pipeline_action_archive.command_receipts FROM PUBLIC,anon,authenticated,service_role;
DELETE FROM crm_security.command_receipts WHERE operation IN ('next_action','activity');
DROP FUNCTION crm_security.crm_pipeline_action_command_v1(uuid,text,uuid,integer,jsonb);
ALTER TABLE crm_security.command_receipts DROP CONSTRAINT command_receipts_operation_check;
ALTER TABLE crm_security.command_receipts ADD CONSTRAINT command_receipts_operation_check
 CHECK(operation IN ('opportunity_work_set','inquiry_assign','service_change','inquiry_unassign'));
COMMIT;

