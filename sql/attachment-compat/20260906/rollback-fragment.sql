-- Evidence-preserving DB rollback. Storage bytes/bucket are never deleted by SQL.
SET LOCAL crm.attachment_compat_ref='rprechiaglyjaydkmxsu';
SET LOCAL search_path=pg_catalog;
SET LOCAL lock_timeout='3s';
SET LOCAL statement_timeout='90s';
DO $guard$ BEGIN
 IF current_user<>'postgres' OR current_setting('crm.attachment_compat_ref',true) IS DISTINCT FROM 'rprechiaglyjaydkmxsu'
  OR to_regprocedure('public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)') IS NULL
  OR to_regprocedure('crm_security.crm_write_command_v2_technical_transfer_20260906(uuid,text,uuid,integer,jsonb)') IS NULL
  OR to_regprocedure('public.crm_operational_source_v1(text,uuid,integer)') IS NULL
  OR to_regprocedure('crm_security.crm_operational_source_v1_technical_transfer_20260906(text,uuid,integer)') IS NULL
  OR to_regprocedure('crm_security.crm_attachment_command_v1(uuid,text,uuid,jsonb)') IS NULL
  OR to_regclass('crm_security.deal_attachments') IS NULL
  OR to_regnamespace('crm_attachment_compat_archive') IS NOT NULL
 THEN RAISE EXCEPTION 'attachment compatibility rollback drift'; END IF;
END $guard$;
LOCK TABLE crm_security.command_receipts IN ACCESS EXCLUSIVE MODE;

DROP POLICY crm_attachment_insert_v1 ON storage.objects;
DROP FUNCTION public.crm_operational_source_v1(text,uuid,integer);
ALTER FUNCTION crm_security.crm_operational_source_v1_technical_transfer_20260906(text,uuid,integer) SET SCHEMA public;
ALTER FUNCTION public.crm_operational_source_v1_technical_transfer_20260906(text,uuid,integer) RENAME TO crm_operational_source_v1;
REVOKE EXECUTE ON FUNCTION public.crm_operational_source_v1(text,uuid,integer) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.crm_operational_source_v1(text,uuid,integer) TO authenticated;

DROP FUNCTION public.crm_write_command_v2(uuid,text,uuid,integer,jsonb);
ALTER FUNCTION crm_security.crm_write_command_v2_technical_transfer_20260906(uuid,text,uuid,integer,jsonb) SET SCHEMA public;
ALTER FUNCTION public.crm_write_command_v2_technical_transfer_20260906(uuid,text,uuid,integer,jsonb) RENAME TO crm_write_command_v2;
REVOKE EXECUTE ON FUNCTION public.crm_write_command_v2(uuid,text,uuid,integer,jsonb) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.crm_write_command_v2(uuid,text,uuid,integer,jsonb) TO authenticated;
DROP FUNCTION crm_security.crm_attachment_command_v1(uuid,text,uuid,jsonb);
DROP FUNCTION public.crm_attachment_object_insert_allowed(text,text);

DO $archive$ BEGIN
 IF EXISTS(SELECT 1 FROM crm_security.command_receipts WHERE operation IN ('attachment_prepare','attachment_complete'))
  OR EXISTS(SELECT 1 FROM crm_security.deal_attachments) THEN
  CREATE SCHEMA crm_attachment_compat_archive AUTHORIZATION postgres;
  REVOKE ALL ON SCHEMA crm_attachment_compat_archive FROM PUBLIC,anon,authenticated,service_role;
 END IF;
 IF EXISTS(SELECT 1 FROM crm_security.command_receipts WHERE operation IN ('attachment_prepare','attachment_complete')) THEN
  CREATE TABLE crm_attachment_compat_archive.command_receipts AS
   SELECT * FROM crm_security.command_receipts WHERE operation IN ('attachment_prepare','attachment_complete');
  REVOKE ALL ON crm_attachment_compat_archive.command_receipts FROM PUBLIC,anon,authenticated,service_role;
  DELETE FROM crm_security.command_receipts WHERE operation IN ('attachment_prepare','attachment_complete');
 END IF;
 IF EXISTS(SELECT 1 FROM crm_security.deal_attachments) THEN
  ALTER TABLE crm_security.attachment_audit_events SET SCHEMA crm_attachment_compat_archive;
  ALTER TABLE crm_security.deal_attachments SET SCHEMA crm_attachment_compat_archive;
  REVOKE ALL ON crm_attachment_compat_archive.attachment_audit_events,
   crm_attachment_compat_archive.deal_attachments FROM PUBLIC,anon,authenticated,service_role;
 ELSE
  DROP TABLE crm_security.attachment_audit_events;
  DROP TABLE crm_security.deal_attachments;
 END IF;
END $archive$;

ALTER TABLE crm_security.command_receipts DROP CONSTRAINT command_receipts_operation_check;
ALTER TABLE crm_security.command_receipts ADD CONSTRAINT command_receipts_operation_check CHECK(operation IN (
 'opportunity_work_set','inquiry_assign','service_change','inquiry_unassign','favorite_set','opportunity_touch',
 'next_action','activity','quote_version','next_action_complete','stage_check','transition','close','amount',
 'waiting_context','inquiry_reclassify','inquiry_status','inquiry_trash','inquiry_restore','inquiry_purge',
 'inquiry_followup','opportunity_create','lineage_link'));

DO $post$ BEGIN
 IF to_regprocedure('crm_security.crm_attachment_command_v1(uuid,text,uuid,jsonb)') IS NOT NULL
  OR to_regprocedure('crm_security.crm_write_command_v2_technical_transfer_20260906(uuid,text,uuid,integer,jsonb)') IS NOT NULL
  OR to_regprocedure('crm_security.crm_operational_source_v1_technical_transfer_20260906(text,uuid,integer)') IS NOT NULL
  OR NOT has_function_privilege('authenticated','public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)','EXECUTE')
  OR NOT has_function_privilege('authenticated','public.crm_operational_source_v1(text,uuid,integer)','EXECUTE')
  OR EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='crm_attachment_insert_v1')
 THEN RAISE EXCEPTION 'attachment compatibility rollback postcondition failed'; END IF;
END $post$;
