SET crm.next_complete_ref='rprechiaglyjaydkmxsu';
BEGIN;
SET LOCAL search_path=pg_catalog;
SET LOCAL lock_timeout='3s';
SET LOCAL statement_timeout='60s';
DO $guard$ BEGIN
 IF current_setting('crm.next_complete_ref',true) IS DISTINCT FROM 'rprechiaglyjaydkmxsu'
  OR to_regprocedure('public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)') IS NULL
  OR to_regprocedure('crm_security.crm_write_command_v2_quote_20260906(uuid,text,uuid,integer,jsonb)') IS NULL
  OR to_regprocedure('crm_security.crm_next_action_complete_command_v1(uuid,uuid,integer,jsonb)') IS NULL
  OR to_regnamespace('crm_next_complete_archive') IS NOT NULL
  OR (SELECT pg_get_constraintdef(oid,true) FROM pg_constraint WHERE conrelid='crm_security.command_receipts'::regclass AND conname='command_receipts_operation_check') IS DISTINCT FROM $expected$CHECK (operation = ANY (ARRAY['opportunity_work_set'::text, 'inquiry_assign'::text, 'service_change'::text, 'inquiry_unassign'::text, 'favorite_set'::text, 'opportunity_touch'::text, 'next_action'::text, 'activity'::text, 'quote_version'::text, 'next_action_complete'::text]))$expected$
 THEN RAISE EXCEPTION 'next-complete rollback drift'; END IF;
END $guard$;
CREATE SCHEMA crm_next_complete_archive AUTHORIZATION postgres;
REVOKE ALL ON SCHEMA crm_next_complete_archive FROM PUBLIC,anon,authenticated,service_role;
CREATE TABLE crm_next_complete_archive.command_receipts AS SELECT * FROM crm_security.command_receipts WHERE operation='next_action_complete';
REVOKE ALL ON crm_next_complete_archive.command_receipts FROM PUBLIC,anon,authenticated,service_role;
DELETE FROM crm_security.command_receipts WHERE operation='next_action_complete';
DROP FUNCTION public.crm_write_command_v2(uuid,text,uuid,integer,jsonb);
DROP FUNCTION crm_security.crm_next_action_complete_command_v1(uuid,uuid,integer,jsonb);
ALTER FUNCTION crm_security.crm_write_command_v2_quote_20260906(uuid,text,uuid,integer,jsonb) RENAME TO crm_write_command_v2;
ALTER FUNCTION crm_security.crm_write_command_v2(uuid,text,uuid,integer,jsonb) SET SCHEMA public;
REVOKE EXECUTE ON FUNCTION public.crm_write_command_v2(uuid,text,uuid,integer,jsonb) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.crm_write_command_v2(uuid,text,uuid,integer,jsonb) TO authenticated;
ALTER TABLE crm_security.command_receipts DROP CONSTRAINT command_receipts_operation_check;
ALTER TABLE crm_security.command_receipts ADD CONSTRAINT command_receipts_operation_check CHECK(operation IN ('opportunity_work_set','inquiry_assign','service_change','inquiry_unassign','favorite_set','opportunity_touch','next_action','activity','quote_version'));
DO $post$ BEGIN IF to_regprocedure('crm_security.crm_write_command_v2_quote_20260906(uuid,text,uuid,integer,jsonb)') IS NOT NULL OR to_regprocedure('crm_security.crm_next_action_complete_command_v1(uuid,uuid,integer,jsonb)') IS NOT NULL OR (SELECT pg_get_constraintdef(oid,true) FROM pg_constraint WHERE conrelid='crm_security.command_receipts'::regclass AND conname='command_receipts_operation_check') IS DISTINCT FROM $expected$CHECK (operation = ANY (ARRAY['opportunity_work_set'::text, 'inquiry_assign'::text, 'service_change'::text, 'inquiry_unassign'::text, 'favorite_set'::text, 'opportunity_touch'::text, 'next_action'::text, 'activity'::text, 'quote_version'::text]))$expected$ THEN RAISE EXCEPTION 'next-complete rollback verification drift'; END IF; END $post$;
COMMIT;
