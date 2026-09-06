-- LOCAL REVIEW CANDIDATE ONLY. Separate Staging approval is required.
BEGIN;
SET LOCAL crm.expansion_update_ref='rprechiaglyjaydkmxsu';
SET LOCAL search_path=pg_catalog;
SET LOCAL lock_timeout='3s';
SET LOCAL statement_timeout='90s';

DO $guard$ BEGIN
 IF current_user<>'postgres' OR current_setting('crm.expansion_update_ref',true) IS DISTINCT FROM 'rprechiaglyjaydkmxsu'
  OR to_regprocedure('public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)') IS NULL
  OR to_regprocedure('public.crm_operational_source_v1(text,uuid,integer)') IS NULL
  OR to_regprocedure('crm_security.crm_expansion_pool_update_command_v1(uuid,uuid,integer,jsonb)') IS NULL
  OR to_regprocedure('crm_security.crm_write_command_v2_pre_expansion_update_20260906(uuid,text,uuid,integer,jsonb)') IS NULL
  OR to_regprocedure('crm_security.crm_operational_source_v1_pre_expansion_update_20260906(text,uuid,integer)') IS NULL
  OR to_regclass('crm_security.expansion_pool_events') IS NULL
  OR to_regnamespace('crm_expansion_update_archive') IS NOT NULL
 THEN RAISE EXCEPTION 'expansion pool update rollback drift'; END IF;
END $guard$;

CREATE SCHEMA crm_expansion_update_archive AUTHORIZATION postgres;
REVOKE ALL ON SCHEMA crm_expansion_update_archive FROM PUBLIC,anon,authenticated,service_role;
CREATE TABLE crm_expansion_update_archive.events AS TABLE crm_security.expansion_pool_events;
CREATE TABLE crm_expansion_update_archive.audit_events AS SELECT * FROM crm_security.audit_events WHERE action='expansion_pool_update';
CREATE TABLE crm_expansion_update_archive.command_receipts AS SELECT * FROM crm_security.command_receipts WHERE operation='expansion_pool_update';
REVOKE ALL ON crm_expansion_update_archive.events,crm_expansion_update_archive.audit_events,crm_expansion_update_archive.command_receipts FROM PUBLIC,anon,authenticated,service_role;
DELETE FROM crm_security.command_receipts WHERE operation='expansion_pool_update';
DELETE FROM crm_security.audit_events WHERE action='expansion_pool_update';

DROP FUNCTION public.crm_write_command_v2(uuid,text,uuid,integer,jsonb);
ALTER FUNCTION crm_security.crm_write_command_v2_pre_expansion_update_20260906(uuid,text,uuid,integer,jsonb) RENAME TO crm_write_command_v2;
ALTER FUNCTION crm_security.crm_write_command_v2(uuid,text,uuid,integer,jsonb) SET SCHEMA public;
REVOKE EXECUTE ON FUNCTION public.crm_write_command_v2(uuid,text,uuid,integer,jsonb) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.crm_write_command_v2(uuid,text,uuid,integer,jsonb) TO authenticated;

DROP FUNCTION public.crm_operational_source_v1(text,uuid,integer);
ALTER FUNCTION crm_security.crm_operational_source_v1_pre_expansion_update_20260906(text,uuid,integer) RENAME TO crm_operational_source_v1;
ALTER FUNCTION crm_security.crm_operational_source_v1(text,uuid,integer) SET SCHEMA public;
REVOKE EXECUTE ON FUNCTION public.crm_operational_source_v1(text,uuid,integer) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.crm_operational_source_v1(text,uuid,integer) TO authenticated;

DROP FUNCTION crm_security.crm_expansion_pool_update_command_v1(uuid,uuid,integer,jsonb);
DROP TABLE crm_security.expansion_pool_events;
ALTER TABLE crm_security.expansion_pool DROP CONSTRAINT expansion_pool_version_positive;
ALTER TABLE crm_security.expansion_pool DROP COLUMN version;
ALTER TABLE crm_security.command_receipts DROP CONSTRAINT command_receipts_operation_check;
ALTER TABLE crm_security.command_receipts ADD CONSTRAINT command_receipts_operation_check CHECK(operation IN (
 'opportunity_work_set','inquiry_assign','service_change','inquiry_unassign','favorite_set','opportunity_touch',
 'next_action','activity','quote_version','next_action_complete','stage_check','transition','close','amount',
 'waiting_context','inquiry_reclassify','inquiry_status','inquiry_trash','inquiry_restore','inquiry_purge',
 'inquiry_followup','opportunity_create','lineage_link','attachment_prepare','attachment_complete'
));

DO $post$ BEGIN
 IF to_regprocedure('crm_security.crm_expansion_pool_update_command_v1(uuid,uuid,integer,jsonb)') IS NOT NULL
  OR to_regprocedure('crm_security.crm_write_command_v2_pre_expansion_update_20260906(uuid,text,uuid,integer,jsonb)') IS NOT NULL
  OR to_regprocedure('crm_security.crm_operational_source_v1_pre_expansion_update_20260906(text,uuid,integer)') IS NOT NULL
  OR to_regclass('crm_security.expansion_pool_events') IS NOT NULL
  OR EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='crm_security' AND table_name='expansion_pool' AND column_name='version')
 THEN RAISE EXCEPTION 'expansion pool update rollback verification drift'; END IF;
END $post$;
COMMIT;
