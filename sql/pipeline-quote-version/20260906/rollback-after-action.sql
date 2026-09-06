SET crm.quote_version_ref='rprechiaglyjaydkmxsu';
BEGIN;
SET LOCAL search_path=pg_catalog;
SET LOCAL lock_timeout='3s';
SET LOCAL statement_timeout='60s';
DO $guard$ BEGIN
 IF current_setting('crm.quote_version_ref',true) IS DISTINCT FROM 'rprechiaglyjaydkmxsu'
  OR to_regprocedure('public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)') IS NULL
  OR to_regprocedure('crm_security.crm_write_command_v2_action_20260906(uuid,text,uuid,integer,jsonb)') IS NULL
  OR to_regprocedure('crm_security.crm_quote_version_command_v1(uuid,uuid,integer,jsonb)') IS NULL
  OR to_regclass('crm_security.quote_versions') IS NULL OR to_regnamespace('crm_quote_version_archive') IS NOT NULL
  OR (SELECT pg_get_constraintdef(oid,true) FROM pg_constraint WHERE conrelid='crm_security.command_receipts'::regclass AND conname='command_receipts_operation_check') IS DISTINCT FROM $expected$CHECK (operation = ANY (ARRAY['opportunity_work_set'::text, 'inquiry_assign'::text, 'service_change'::text, 'inquiry_unassign'::text, 'favorite_set'::text, 'opportunity_touch'::text, 'next_action'::text, 'activity'::text, 'quote_version'::text]))$expected$
 THEN RAISE EXCEPTION 'quote-version rollback drift'; END IF;
END $guard$;
CREATE SCHEMA crm_quote_version_archive AUTHORIZATION postgres;
REVOKE ALL ON SCHEMA crm_quote_version_archive FROM PUBLIC,anon,authenticated,service_role;
CREATE TABLE crm_quote_version_archive.command_receipts AS SELECT * FROM crm_security.command_receipts WHERE operation='quote_version';
REVOKE ALL ON crm_quote_version_archive.command_receipts FROM PUBLIC,anon,authenticated,service_role;
DELETE FROM crm_security.command_receipts WHERE operation='quote_version';
ALTER TABLE crm_security.quote_versions SET SCHEMA crm_quote_version_archive;
REVOKE ALL ON crm_quote_version_archive.quote_versions FROM PUBLIC,anon,authenticated,service_role;
DROP FUNCTION public.crm_write_command_v2(uuid,text,uuid,integer,jsonb);
DROP FUNCTION crm_security.crm_quote_version_command_v1(uuid,uuid,integer,jsonb);
ALTER FUNCTION crm_security.crm_write_command_v2_action_20260906(uuid,text,uuid,integer,jsonb) RENAME TO crm_write_command_v2;
ALTER FUNCTION crm_security.crm_write_command_v2(uuid,text,uuid,integer,jsonb) SET SCHEMA public;
REVOKE EXECUTE ON FUNCTION public.crm_write_command_v2(uuid,text,uuid,integer,jsonb) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.crm_write_command_v2(uuid,text,uuid,integer,jsonb) TO authenticated;
ALTER TABLE crm_security.command_receipts DROP CONSTRAINT command_receipts_operation_check;
ALTER TABLE crm_security.command_receipts ADD CONSTRAINT command_receipts_operation_check CHECK(operation IN ('opportunity_work_set','inquiry_assign','service_change','inquiry_unassign','favorite_set','opportunity_touch','next_action','activity'));
DO $post$ BEGIN IF to_regprocedure('crm_security.crm_write_command_v2_action_20260906(uuid,text,uuid,integer,jsonb)') IS NOT NULL OR to_regprocedure('crm_security.crm_quote_version_command_v1(uuid,uuid,integer,jsonb)') IS NOT NULL OR to_regclass('crm_security.quote_versions') IS NOT NULL OR (SELECT pg_get_constraintdef(oid,true) FROM pg_constraint WHERE conrelid='crm_security.command_receipts'::regclass AND conname='command_receipts_operation_check') IS DISTINCT FROM $expected$CHECK (operation = ANY (ARRAY['opportunity_work_set'::text, 'inquiry_assign'::text, 'service_change'::text, 'inquiry_unassign'::text, 'favorite_set'::text, 'opportunity_touch'::text, 'next_action'::text, 'activity'::text]))$expected$ THEN RAISE EXCEPTION 'quote-version rollback verification drift'; END IF; END $post$;
COMMIT;
