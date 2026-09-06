SET LOCAL crm.expansion_note_ref='rprechiaglyjaydkmxsu';
SET LOCAL search_path=pg_catalog;
SET LOCAL lock_timeout='3s';
SET LOCAL statement_timeout='90s';

DO $guard$ BEGIN
 IF current_user<>'postgres' OR current_setting('crm.expansion_note_ref',true) IS DISTINCT FROM 'rprechiaglyjaydkmxsu'
  OR to_regprocedure('public.crm_expansion_note(jsonb)') IS NULL OR to_regprocedure('public.crm_expansion_context(jsonb)') IS NULL
  OR to_regclass('crm_security.expansion_pool_events') IS NULL OR to_regnamespace('crm_expansion_note_archive') IS NOT NULL
  OR (SELECT pg_get_constraintdef(oid,true) FROM pg_constraint WHERE conrelid='crm_security.command_receipts'::regclass AND conname='command_receipts_operation_check') IS DISTINCT FROM $expected$CHECK (operation = ANY (ARRAY['opportunity_work_set'::text, 'inquiry_assign'::text, 'service_change'::text, 'inquiry_unassign'::text, 'favorite_set'::text, 'opportunity_touch'::text, 'next_action'::text, 'activity'::text, 'quote_version'::text, 'next_action_complete'::text, 'stage_check'::text, 'transition'::text, 'close'::text, 'amount'::text, 'waiting_context'::text, 'inquiry_reclassify'::text, 'inquiry_status'::text, 'inquiry_trash'::text, 'inquiry_restore'::text, 'inquiry_purge'::text, 'inquiry_followup'::text, 'opportunity_create'::text, 'lineage_link'::text, 'attachment_prepare'::text, 'attachment_complete'::text, 'expansion_pool_update'::text, 'expansion_note'::text]))$expected$
 THEN RAISE EXCEPTION 'expansion note/context rollback drift'; END IF;
END $guard$;

CREATE SCHEMA crm_expansion_note_archive AUTHORIZATION postgres;
REVOKE ALL ON SCHEMA crm_expansion_note_archive FROM PUBLIC,anon,authenticated,service_role;
CREATE TABLE crm_expansion_note_archive.events AS SELECT * FROM crm_security.expansion_pool_events WHERE kind='note';
CREATE TABLE crm_expansion_note_archive.audit_events AS SELECT * FROM crm_security.audit_events WHERE action='expansion_note';
CREATE TABLE crm_expansion_note_archive.command_receipts AS SELECT * FROM crm_security.command_receipts WHERE operation='expansion_note';
REVOKE ALL ON crm_expansion_note_archive.events,crm_expansion_note_archive.audit_events,crm_expansion_note_archive.command_receipts FROM PUBLIC,anon,authenticated,service_role;
DELETE FROM crm_security.command_receipts WHERE operation='expansion_note';
DELETE FROM crm_security.audit_events WHERE action='expansion_note';
DELETE FROM crm_security.expansion_pool_events WHERE kind='note';
DROP FUNCTION public.crm_expansion_note(jsonb);
DROP FUNCTION public.crm_expansion_context(jsonb);
ALTER TABLE crm_security.command_receipts DROP CONSTRAINT command_receipts_operation_check;
ALTER TABLE crm_security.command_receipts ADD CONSTRAINT command_receipts_operation_check CHECK(operation IN (
 'opportunity_work_set','inquiry_assign','service_change','inquiry_unassign','favorite_set','opportunity_touch',
 'next_action','activity','quote_version','next_action_complete','stage_check','transition','close','amount',
 'waiting_context','inquiry_reclassify','inquiry_status','inquiry_trash','inquiry_restore','inquiry_purge',
 'inquiry_followup','opportunity_create','lineage_link','attachment_prepare','attachment_complete','expansion_pool_update'
));
DO $post$ BEGIN
 IF to_regprocedure('public.crm_expansion_note(jsonb)') IS NOT NULL OR to_regprocedure('public.crm_expansion_context(jsonb)') IS NOT NULL OR EXISTS(SELECT 1 FROM crm_security.expansion_pool_events WHERE kind='note')
  OR (SELECT pg_get_constraintdef(oid,true) FROM pg_constraint WHERE conrelid='crm_security.command_receipts'::regclass AND conname='command_receipts_operation_check') IS DISTINCT FROM $expected$CHECK (operation = ANY (ARRAY['opportunity_work_set'::text, 'inquiry_assign'::text, 'service_change'::text, 'inquiry_unassign'::text, 'favorite_set'::text, 'opportunity_touch'::text, 'next_action'::text, 'activity'::text, 'quote_version'::text, 'next_action_complete'::text, 'stage_check'::text, 'transition'::text, 'close'::text, 'amount'::text, 'waiting_context'::text, 'inquiry_reclassify'::text, 'inquiry_status'::text, 'inquiry_trash'::text, 'inquiry_restore'::text, 'inquiry_purge'::text, 'inquiry_followup'::text, 'opportunity_create'::text, 'lineage_link'::text, 'attachment_prepare'::text, 'attachment_complete'::text, 'expansion_pool_update'::text]))$expected$
 THEN RAISE EXCEPTION 'expansion note/context rollback verification drift'; END IF;
END $post$;
