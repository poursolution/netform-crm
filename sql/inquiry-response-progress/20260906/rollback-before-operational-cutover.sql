-- LOCAL REVIEW CANDIDATE ONLY. Staging approval is required.
BEGIN;
-- Evidence-preserving rollback. Business timestamps/status are not guessed back.
SET LOCAL crm.inquiry_response_ref='rprechiaglyjaydkmxsu';
SET LOCAL search_path=pg_catalog;
SET LOCAL lock_timeout='3s';
SET LOCAL statement_timeout='60s';
DO $guard$ BEGIN
 IF current_user<>'postgres' OR current_setting('crm.inquiry_response_ref',true) IS DISTINCT FROM 'rprechiaglyjaydkmxsu'
  OR to_regprocedure('public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)') IS NULL
  OR to_regprocedure('crm_security.crm_write_command_v2_opportunity_create_20260906(uuid,text,uuid,integer,jsonb)') IS NULL
  OR to_regprocedure('crm_security.crm_inquiry_response_command_v1(uuid,uuid,jsonb)') IS NULL
  OR to_regprocedure('crm_security.crm_operational_source_fragment_v1(text,uuid,integer)') IS NULL
  OR to_regprocedure('crm_security.crm_operational_source_fragment_pre_inquiry_response_20260906(text,uuid,integer)') IS NULL
  OR to_regnamespace('crm_inquiry_response_archive') IS NOT NULL
 THEN RAISE EXCEPTION 'inquiry response progress rollback drift'; END IF;
END $guard$;
LOCK TABLE crm_security.command_receipts,crm_security.inquiry_audit_events IN ACCESS EXCLUSIVE MODE;
DO $archive$ BEGIN
 IF EXISTS(SELECT 1 FROM crm_security.command_receipts WHERE operation='inquiry_assign' AND payload->>'intent' IN ('response_progress','response_next_week_retry','response_missed_retry'))
  OR EXISTS(SELECT 1 FROM crm_security.inquiry_audit_events WHERE action IN ('inquiry_response_progress','inquiry_response_next_week_retry','inquiry_response_missed_retry')) THEN
  CREATE SCHEMA crm_inquiry_response_archive AUTHORIZATION postgres;
  REVOKE ALL ON SCHEMA crm_inquiry_response_archive FROM PUBLIC,anon,authenticated,service_role;
 END IF;
 IF EXISTS(SELECT 1 FROM crm_security.command_receipts WHERE operation='inquiry_assign' AND payload->>'intent' IN ('response_progress','response_next_week_retry','response_missed_retry')) THEN
  CREATE TABLE crm_inquiry_response_archive.command_receipts AS
   SELECT * FROM crm_security.command_receipts WHERE operation='inquiry_assign' AND payload->>'intent' IN ('response_progress','response_next_week_retry','response_missed_retry');
  REVOKE ALL ON TABLE crm_inquiry_response_archive.command_receipts FROM PUBLIC,anon,authenticated,service_role;
  DELETE FROM crm_security.command_receipts WHERE operation='inquiry_assign' AND payload->>'intent' IN ('response_progress','response_next_week_retry','response_missed_retry');
 END IF;
 IF EXISTS(SELECT 1 FROM crm_security.inquiry_audit_events WHERE action IN ('inquiry_response_progress','inquiry_response_next_week_retry','inquiry_response_missed_retry')) THEN
  CREATE TABLE crm_inquiry_response_archive.inquiry_audit_events AS
   SELECT * FROM crm_security.inquiry_audit_events WHERE action IN ('inquiry_response_progress','inquiry_response_next_week_retry','inquiry_response_missed_retry');
  REVOKE ALL ON TABLE crm_inquiry_response_archive.inquiry_audit_events FROM PUBLIC,anon,authenticated,service_role;
  DELETE FROM crm_security.inquiry_audit_events WHERE action IN ('inquiry_response_progress','inquiry_response_next_week_retry','inquiry_response_missed_retry');
 END IF;
END $archive$;
ALTER TABLE crm_security.inquiry_audit_events DROP CONSTRAINT inquiry_audit_events_action_check;
ALTER TABLE crm_security.inquiry_audit_events ADD CONSTRAINT inquiry_audit_events_action_check
 CHECK(action IN ('direct_assign','direct_reassign','inquiry_unassign','inquiry_reclassify','inquiry_hold','inquiry_trash','inquiry_restore','inquiry_purge','inquiry_followup'));
DROP FUNCTION public.crm_write_command_v2(uuid,text,uuid,integer,jsonb);
ALTER FUNCTION crm_security.crm_write_command_v2_opportunity_create_20260906(uuid,text,uuid,integer,jsonb) SET SCHEMA public;
ALTER FUNCTION public.crm_write_command_v2_opportunity_create_20260906(uuid,text,uuid,integer,jsonb) RENAME TO crm_write_command_v2;
REVOKE EXECUTE ON FUNCTION public.crm_write_command_v2(uuid,text,uuid,integer,jsonb) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.crm_write_command_v2(uuid,text,uuid,integer,jsonb) TO authenticated;
DROP FUNCTION crm_security.crm_operational_source_fragment_v1(text,uuid,integer);
ALTER FUNCTION crm_security.crm_operational_source_fragment_pre_inquiry_response_20260906(text,uuid,integer)
 RENAME TO crm_operational_source_fragment_v1;
REVOKE EXECUTE ON FUNCTION crm_security.crm_operational_source_fragment_v1(text,uuid,integer)
 FROM PUBLIC,anon,authenticated,service_role;
DROP FUNCTION crm_security.crm_inquiry_response_command_v1(uuid,uuid,jsonb);
DO $post$ BEGIN
 IF to_regprocedure('crm_security.crm_write_command_v2_opportunity_create_20260906(uuid,text,uuid,integer,jsonb)') IS NOT NULL
  OR to_regprocedure('crm_security.crm_inquiry_response_command_v1(uuid,uuid,jsonb)') IS NOT NULL
  OR to_regprocedure('crm_security.crm_operational_source_fragment_pre_inquiry_response_20260906(text,uuid,integer)') IS NOT NULL
  OR NOT has_function_privilege('authenticated','public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)','EXECUTE')
  OR has_function_privilege('authenticated','crm_security.crm_operational_source_fragment_v1(text,uuid,integer)','EXECUTE')
 THEN RAISE EXCEPTION 'inquiry response progress rollback postcondition failed'; END IF;
END $post$;
COMMIT;
