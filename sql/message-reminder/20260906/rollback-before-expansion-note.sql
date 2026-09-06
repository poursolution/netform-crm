-- LOCAL REVIEW CANDIDATE ONLY. Separate Staging approval is required.
BEGIN;
SET LOCAL crm.message_reminder_ref='rprechiaglyjaydkmxsu';
SET LOCAL search_path=pg_catalog;
SET LOCAL lock_timeout='3s';
SET LOCAL statement_timeout='90s';

DO $guard$ BEGIN
 IF current_user<>'postgres' OR current_setting('crm.message_reminder_ref',true) IS DISTINCT FROM 'rprechiaglyjaydkmxsu'
  OR to_regclass('crm_security.message_reminders') IS NULL OR to_regnamespace('crm_message_reminder_archive') IS NOT NULL
  OR to_regprocedure('crm_security.crm_message_reminder_command_v1(uuid,uuid,integer,jsonb)') IS NULL
  OR to_regprocedure('crm_security.crm_pipeline_action_command_v1_pre_message_reminder_20260906(uuid,text,uuid,integer,jsonb)') IS NULL
  OR to_regprocedure('crm_security.crm_operational_source_v1_pre_message_reminder_20260906(text,uuid,integer)') IS NULL
 THEN RAISE EXCEPTION 'message reminder rollback drift'; END IF;
END $guard$;

CREATE SCHEMA crm_message_reminder_archive AUTHORIZATION postgres;
REVOKE ALL ON SCHEMA crm_message_reminder_archive FROM PUBLIC,anon,authenticated,service_role;
CREATE TABLE crm_message_reminder_archive.reminders AS SELECT * FROM crm_security.message_reminders;
CREATE TABLE crm_message_reminder_archive.audit_events AS SELECT * FROM crm_security.audit_events WHERE action='message_reminder';
CREATE TABLE crm_message_reminder_archive.command_receipts AS SELECT * FROM crm_security.command_receipts WHERE operation='next_action' AND payload->>'intent'='message_reminder';
REVOKE ALL ON crm_message_reminder_archive.reminders,crm_message_reminder_archive.audit_events,crm_message_reminder_archive.command_receipts FROM PUBLIC,anon,authenticated,service_role;
DELETE FROM crm_security.command_receipts WHERE operation='next_action' AND payload->>'intent'='message_reminder';
DELETE FROM crm_security.audit_events WHERE action='message_reminder';

DROP FUNCTION public.crm_operational_source_v1(text,uuid,integer);
ALTER FUNCTION crm_security.crm_operational_source_v1_pre_message_reminder_20260906(text,uuid,integer) SET SCHEMA public;
ALTER FUNCTION public.crm_operational_source_v1_pre_message_reminder_20260906(text,uuid,integer) RENAME TO crm_operational_source_v1;
REVOKE EXECUTE ON FUNCTION public.crm_operational_source_v1(text,uuid,integer) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.crm_operational_source_v1(text,uuid,integer) TO authenticated;

DROP FUNCTION crm_security.crm_pipeline_action_command_v1(uuid,text,uuid,integer,jsonb);
DROP FUNCTION crm_security.crm_message_reminder_command_v1(uuid,uuid,integer,jsonb);
ALTER FUNCTION crm_security.crm_pipeline_action_command_v1_pre_message_reminder_20260906(uuid,text,uuid,integer,jsonb)
 RENAME TO crm_pipeline_action_command_v1;
REVOKE EXECUTE ON FUNCTION crm_security.crm_pipeline_action_command_v1(uuid,text,uuid,integer,jsonb) FROM PUBLIC,anon,authenticated,service_role;
DROP TABLE crm_security.message_reminders;

DO $post$ BEGIN
 IF to_regclass('crm_security.message_reminders') IS NOT NULL
  OR to_regprocedure('crm_security.crm_message_reminder_command_v1(uuid,uuid,integer,jsonb)') IS NOT NULL
  OR to_regprocedure('crm_security.crm_pipeline_action_command_v1(uuid,text,uuid,integer,jsonb)') IS NULL
  OR to_regprocedure('public.crm_operational_source_v1(text,uuid,integer)') IS NULL
  OR EXISTS(SELECT 1 FROM crm_security.command_receipts WHERE operation='next_action' AND payload->>'intent'='message_reminder')
 THEN RAISE EXCEPTION 'message reminder rollback verification drift'; END IF;
END $post$;
COMMIT;
