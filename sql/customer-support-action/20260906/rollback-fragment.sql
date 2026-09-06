SET LOCAL crm.customer_support_ref='rprechiaglyjaydkmxsu';
SET LOCAL search_path=pg_catalog;
SET LOCAL lock_timeout='3s';
SET LOCAL statement_timeout='90s';
DO $guard$ BEGIN
 IF current_user<>'postgres' OR current_setting('crm.customer_support_ref',true) IS DISTINCT FROM 'rprechiaglyjaydkmxsu'
  OR to_regclass('crm_security.customer_support_actions') IS NULL
  OR to_regprocedure('crm_security.crm_customer_support_action_command_v1(uuid,text,uuid,integer,jsonb)') IS NULL
  OR to_regprocedure('crm_security.crm_write_command_v2_pre_customer_support_20260906(uuid,text,uuid,integer,jsonb)') IS NULL
  OR to_regprocedure('crm_security.crm_operational_source_v1_pre_customer_support_20260906(text,uuid,integer)') IS NULL
  OR to_regprocedure('public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)') IS NULL
  OR to_regprocedure('public.crm_operational_source_v1(text,uuid,integer)') IS NULL
  OR to_regnamespace('crm_customer_support_archive') IS NOT NULL
 THEN RAISE EXCEPTION 'customer support action rollback drift'; END IF;
END $guard$;
LOCK TABLE crm_security.command_receipts IN ACCESS EXCLUSIVE MODE;
CREATE SCHEMA crm_customer_support_archive AUTHORIZATION postgres;
REVOKE ALL ON SCHEMA crm_customer_support_archive FROM PUBLIC,anon,authenticated,service_role;
CREATE TABLE crm_customer_support_archive.actions AS TABLE crm_security.customer_support_actions;
CREATE TABLE crm_customer_support_archive.command_receipts AS SELECT * FROM crm_security.command_receipts WHERE operation='customer_support_action';
REVOKE ALL ON crm_customer_support_archive.actions,crm_customer_support_archive.command_receipts FROM PUBLIC,anon,authenticated,service_role;
DELETE FROM crm_security.command_receipts WHERE operation='customer_support_action';
DROP FUNCTION public.crm_operational_source_v1(text,uuid,integer);
DROP FUNCTION public.crm_write_command_v2(uuid,text,uuid,integer,jsonb);
DROP FUNCTION crm_security.crm_customer_support_action_command_v1(uuid,text,uuid,integer,jsonb);
DROP TABLE crm_security.customer_support_actions;
ALTER FUNCTION crm_security.crm_operational_source_v1_pre_customer_support_20260906(text,uuid,integer) SET SCHEMA public;
ALTER FUNCTION public.crm_operational_source_v1_pre_customer_support_20260906(text,uuid,integer) RENAME TO crm_operational_source_v1;
ALTER FUNCTION crm_security.crm_write_command_v2_pre_customer_support_20260906(uuid,text,uuid,integer,jsonb) SET SCHEMA public;
ALTER FUNCTION public.crm_write_command_v2_pre_customer_support_20260906(uuid,text,uuid,integer,jsonb) RENAME TO crm_write_command_v2;
REVOKE EXECUTE ON FUNCTION public.crm_operational_source_v1(text,uuid,integer) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.crm_operational_source_v1(text,uuid,integer) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.crm_write_command_v2(uuid,text,uuid,integer,jsonb) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.crm_write_command_v2(uuid,text,uuid,integer,jsonb) TO authenticated;
ALTER TABLE crm_security.command_receipts DROP CONSTRAINT command_receipts_operation_check;
ALTER TABLE crm_security.command_receipts ADD CONSTRAINT command_receipts_operation_check CHECK(operation=ANY(ARRAY[
 'opportunity_work_set','inquiry_assign','service_change','inquiry_unassign','favorite_set','opportunity_touch','next_action','activity','quote_version','next_action_complete','stage_check','transition','close','amount','waiting_context','inquiry_reclassify','inquiry_status','inquiry_trash','inquiry_restore','inquiry_purge','inquiry_followup','opportunity_create','lineage_link','attachment_prepare','attachment_complete','expansion_pool_update','expansion_note'
]::text[]));
DO $post$ BEGIN
 IF to_regclass('crm_security.customer_support_actions') IS NOT NULL
  OR to_regprocedure('crm_security.crm_customer_support_action_command_v1(uuid,text,uuid,integer,jsonb)') IS NOT NULL
  OR to_regprocedure('crm_security.crm_write_command_v2_pre_customer_support_20260906(uuid,text,uuid,integer,jsonb)') IS NOT NULL
  OR to_regprocedure('crm_security.crm_operational_source_v1_pre_customer_support_20260906(text,uuid,integer)') IS NOT NULL
  OR to_regprocedure('public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)') IS NULL
  OR to_regprocedure('public.crm_operational_source_v1(text,uuid,integer)') IS NULL
  OR EXISTS(SELECT 1 FROM crm_security.command_receipts WHERE operation='customer_support_action')
 THEN RAISE EXCEPTION 'customer support action rollback verification drift'; END IF;
END $post$;
