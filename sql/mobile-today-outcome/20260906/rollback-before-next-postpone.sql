-- LOCAL REVIEW CANDIDATE ONLY. Separate Staging approval is required.
BEGIN;
SET LOCAL crm.mobile_today_ref='rprechiaglyjaydkmxsu';
SET LOCAL search_path=pg_catalog;
SET LOCAL lock_timeout='3s';
SET LOCAL statement_timeout='90s';
DO $guard$ BEGIN
 IF current_user<>'postgres' OR current_setting('crm.mobile_today_ref',true) IS DISTINCT FROM 'rprechiaglyjaydkmxsu'
  OR to_regprocedure('crm_security.crm_mobile_today_outcome_command_v1(uuid,text,uuid,integer,jsonb)') IS NULL
  OR to_regprocedure('public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)') IS NULL
  OR to_regprocedure('crm_security.crm_write_command_v2_pre_mobile_today_20260906(uuid,text,uuid,integer,jsonb)') IS NULL
  OR to_regnamespace('crm_mobile_today_archive') IS NOT NULL
 THEN RAISE EXCEPTION 'mobile Today outcome rollback drift'; END IF;
END $guard$;
CREATE SCHEMA crm_mobile_today_archive AUTHORIZATION postgres;
REVOKE ALL ON SCHEMA crm_mobile_today_archive FROM PUBLIC,anon,authenticated,service_role;
CREATE TABLE crm_mobile_today_archive.events AS SELECT * FROM crm_security.next_action_postponements WHERE event_kind='today_next_week';
CREATE TABLE crm_mobile_today_archive.audit_events AS SELECT * FROM crm_security.audit_events WHERE action='next_action_today_outcome';
CREATE TABLE crm_mobile_today_archive.command_receipts AS SELECT * FROM crm_security.command_receipts WHERE operation='next_action_complete' AND payload->>'intent'='today_outcome';
REVOKE ALL ON crm_mobile_today_archive.events,crm_mobile_today_archive.audit_events,crm_mobile_today_archive.command_receipts FROM PUBLIC,anon,authenticated,service_role;
DELETE FROM crm_security.command_receipts WHERE operation='next_action_complete' AND payload->>'intent'='today_outcome';
DELETE FROM crm_security.audit_events WHERE action='next_action_today_outcome';
DELETE FROM crm_security.next_action_postponements WHERE event_kind='today_next_week';
DROP FUNCTION public.crm_write_command_v2(uuid,text,uuid,integer,jsonb);
DROP FUNCTION crm_security.crm_mobile_today_outcome_command_v1(uuid,text,uuid,integer,jsonb);
ALTER FUNCTION crm_security.crm_write_command_v2_pre_mobile_today_20260906(uuid,text,uuid,integer,jsonb) SET SCHEMA public;
ALTER FUNCTION public.crm_write_command_v2_pre_mobile_today_20260906(uuid,text,uuid,integer,jsonb) RENAME TO crm_write_command_v2;
REVOKE EXECUTE ON FUNCTION public.crm_write_command_v2(uuid,text,uuid,integer,jsonb) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.crm_write_command_v2(uuid,text,uuid,integer,jsonb) TO authenticated;
DO $post$ BEGIN
 IF to_regprocedure('crm_security.crm_mobile_today_outcome_command_v1(uuid,text,uuid,integer,jsonb)') IS NOT NULL
  OR to_regprocedure('crm_security.crm_write_command_v2_pre_mobile_today_20260906(uuid,text,uuid,integer,jsonb)') IS NOT NULL
  OR to_regprocedure('public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)') IS NULL
  OR NOT has_function_privilege('authenticated','public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)','EXECUTE')
  OR has_function_privilege('anon','public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)','EXECUTE')
  OR has_function_privilege('service_role','public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)','EXECUTE')
  OR EXISTS(SELECT 1 FROM crm_security.command_receipts WHERE operation='next_action_complete' AND payload->>'intent'='today_outcome')
  OR EXISTS(SELECT 1 FROM crm_security.next_action_postponements WHERE event_kind='today_next_week')
 THEN RAISE EXCEPTION 'mobile Today outcome rollback verification drift'; END IF;
END $post$;
COMMIT;
