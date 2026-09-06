-- LOCAL REVIEW CANDIDATE ONLY. Staging execution requires separate explicit approval.
-- Target project: netform-crm-staging / rprechiaglyjaydkmxsu. Production is forbidden.
BEGIN;
SET LOCAL search_path=pg_catalog;
SET LOCAL lock_timeout='3s';
SET LOCAL statement_timeout='180s';
SET LOCAL crm.reachable_operations_bundle_ref='rprechiaglyjaydkmxsu';
DO $reachable_bundle_guard$ BEGIN
 IF current_user<>'postgres'
  OR current_setting('crm.reachable_operations_bundle_ref',true) IS DISTINCT FROM 'rprechiaglyjaydkmxsu'
 THEN RAISE EXCEPTION 'reachable operations bundle project/role guard failed'; END IF;
END $reachable_bundle_guard$;
-- ===== ROLLBACK inquiry_followup =====
SET LOCAL crm.inquiry_followup_ref='rprechiaglyjaydkmxsu';
SET LOCAL crm.inquiry_followup_ref='rprechiaglyjaydkmxsu';
SET LOCAL search_path=pg_catalog;SET LOCAL lock_timeout='3s';SET LOCAL statement_timeout='60s';
DO $guard$ BEGIN IF current_setting('crm.inquiry_followup_ref',true) IS DISTINCT FROM 'rprechiaglyjaydkmxsu' OR to_regprocedure('public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)') IS NULL OR to_regprocedure('crm_security.crm_write_command_v2_inquiry_purge_20260906(uuid,text,uuid,integer,jsonb)') IS NULL OR to_regprocedure('crm_security.crm_inquiry_followup_command_v1(uuid,uuid,jsonb)') IS NULL OR to_regnamespace('crm_inquiry_followup_archive') IS NOT NULL OR (SELECT pg_get_constraintdef(oid,true) FROM pg_constraint WHERE conrelid='crm_security.command_receipts'::regclass AND conname='command_receipts_operation_check') IS DISTINCT FROM $expected$CHECK (operation = ANY (ARRAY['opportunity_work_set'::text, 'inquiry_assign'::text, 'service_change'::text, 'inquiry_unassign'::text, 'favorite_set'::text, 'opportunity_touch'::text, 'next_action'::text, 'activity'::text, 'quote_version'::text, 'next_action_complete'::text, 'stage_check'::text, 'transition'::text, 'close'::text, 'amount'::text, 'waiting_context'::text, 'inquiry_reclassify'::text, 'inquiry_status'::text, 'inquiry_trash'::text, 'inquiry_restore'::text, 'inquiry_purge'::text, 'inquiry_followup'::text]))$expected$ OR (SELECT pg_get_constraintdef(oid,true) FROM pg_constraint WHERE conrelid='crm_security.inquiry_audit_events'::regclass AND conname='inquiry_audit_events_action_check') IS DISTINCT FROM $expected$CHECK (action = ANY (ARRAY['direct_assign'::text, 'direct_reassign'::text, 'inquiry_unassign'::text, 'inquiry_reclassify'::text, 'inquiry_hold'::text, 'inquiry_trash'::text, 'inquiry_restore'::text, 'inquiry_purge'::text, 'inquiry_followup'::text]))$expected$ THEN RAISE EXCEPTION 'inquiry followup rollback drift';END IF;END $guard$;
CREATE SCHEMA crm_inquiry_followup_archive AUTHORIZATION postgres;REVOKE ALL ON SCHEMA crm_inquiry_followup_archive FROM PUBLIC,anon,authenticated,service_role;CREATE TABLE crm_inquiry_followup_archive.audit_events AS SELECT * FROM crm_security.inquiry_audit_events WHERE action='inquiry_followup';CREATE TABLE crm_inquiry_followup_archive.command_receipts AS SELECT * FROM crm_security.command_receipts WHERE operation='inquiry_followup';REVOKE ALL ON crm_inquiry_followup_archive.audit_events,crm_inquiry_followup_archive.command_receipts FROM PUBLIC,anon,authenticated,service_role;DELETE FROM crm_security.command_receipts WHERE operation='inquiry_followup';DELETE FROM crm_security.inquiry_audit_events WHERE action='inquiry_followup';
DROP FUNCTION public.crm_write_command_v2(uuid,text,uuid,integer,jsonb);DROP FUNCTION crm_security.crm_inquiry_followup_command_v1(uuid,uuid,jsonb);ALTER FUNCTION crm_security.crm_write_command_v2_inquiry_purge_20260906(uuid,text,uuid,integer,jsonb) RENAME TO crm_write_command_v2;ALTER FUNCTION crm_security.crm_write_command_v2(uuid,text,uuid,integer,jsonb) SET SCHEMA public;REVOKE EXECUTE ON FUNCTION public.crm_write_command_v2(uuid,text,uuid,integer,jsonb) FROM PUBLIC,anon,authenticated,service_role;GRANT EXECUTE ON FUNCTION public.crm_write_command_v2(uuid,text,uuid,integer,jsonb) TO authenticated;
ALTER TABLE crm_security.command_receipts DROP CONSTRAINT command_receipts_operation_check;ALTER TABLE crm_security.command_receipts ADD CONSTRAINT command_receipts_operation_check CHECK(operation IN ('opportunity_work_set','inquiry_assign','service_change','inquiry_unassign','favorite_set','opportunity_touch','next_action','activity','quote_version','next_action_complete','stage_check','transition','close','amount','waiting_context','inquiry_reclassify','inquiry_status','inquiry_trash','inquiry_restore','inquiry_purge'));
ALTER TABLE crm_security.inquiry_audit_events DROP CONSTRAINT inquiry_audit_events_action_check;ALTER TABLE crm_security.inquiry_audit_events ADD CONSTRAINT inquiry_audit_events_action_check CHECK(action IN ('direct_assign','direct_reassign','inquiry_unassign','inquiry_reclassify','inquiry_hold','inquiry_trash','inquiry_restore','inquiry_purge'));
DO $post$ BEGIN IF to_regprocedure('crm_security.crm_write_command_v2_inquiry_purge_20260906(uuid,text,uuid,integer,jsonb)') IS NOT NULL OR to_regprocedure('crm_security.crm_inquiry_followup_command_v1(uuid,uuid,jsonb)') IS NOT NULL OR (SELECT pg_get_constraintdef(oid,true) FROM pg_constraint WHERE conrelid='crm_security.command_receipts'::regclass AND conname='command_receipts_operation_check') IS DISTINCT FROM $expected$CHECK (operation = ANY (ARRAY['opportunity_work_set'::text, 'inquiry_assign'::text, 'service_change'::text, 'inquiry_unassign'::text, 'favorite_set'::text, 'opportunity_touch'::text, 'next_action'::text, 'activity'::text, 'quote_version'::text, 'next_action_complete'::text, 'stage_check'::text, 'transition'::text, 'close'::text, 'amount'::text, 'waiting_context'::text, 'inquiry_reclassify'::text, 'inquiry_status'::text, 'inquiry_trash'::text, 'inquiry_restore'::text, 'inquiry_purge'::text]))$expected$ OR (SELECT pg_get_constraintdef(oid,true) FROM pg_constraint WHERE conrelid='crm_security.inquiry_audit_events'::regclass AND conname='inquiry_audit_events_action_check') IS DISTINCT FROM $expected$CHECK (action = ANY (ARRAY['direct_assign'::text, 'direct_reassign'::text, 'inquiry_unassign'::text, 'inquiry_reclassify'::text, 'inquiry_hold'::text, 'inquiry_trash'::text, 'inquiry_restore'::text, 'inquiry_purge'::text]))$expected$ THEN RAISE EXCEPTION 'inquiry followup rollback verification drift';END IF;END $post$;
-- ===== ROLLBACK inquiry_purge =====
SET LOCAL crm.inquiry_purge_ref='rprechiaglyjaydkmxsu';
SET LOCAL crm.inquiry_purge_ref='rprechiaglyjaydkmxsu';
SET LOCAL search_path=pg_catalog;SET LOCAL lock_timeout='3s';SET LOCAL statement_timeout='60s';
DO $guard$ BEGIN IF current_setting('crm.inquiry_purge_ref',true) IS DISTINCT FROM 'rprechiaglyjaydkmxsu' OR to_regprocedure('public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)') IS NULL OR to_regprocedure('crm_security.crm_write_command_v2_inquiry_trash_restore_20260906(uuid,text,uuid,integer,jsonb)') IS NULL OR to_regprocedure('crm_security.crm_inquiry_purge_command_v1(uuid,uuid,jsonb)') IS NULL OR EXISTS(SELECT 1 FROM crm_security.command_receipts WHERE operation='inquiry_purge') OR EXISTS(SELECT 1 FROM crm_security.inquiry_audit_events WHERE action='inquiry_purge') OR (SELECT pg_get_constraintdef(oid,true) FROM pg_constraint WHERE conrelid='crm_security.command_receipts'::regclass AND conname='command_receipts_operation_check') IS DISTINCT FROM $expected$CHECK (operation = ANY (ARRAY['opportunity_work_set'::text, 'inquiry_assign'::text, 'service_change'::text, 'inquiry_unassign'::text, 'favorite_set'::text, 'opportunity_touch'::text, 'next_action'::text, 'activity'::text, 'quote_version'::text, 'next_action_complete'::text, 'stage_check'::text, 'transition'::text, 'close'::text, 'amount'::text, 'waiting_context'::text, 'inquiry_reclassify'::text, 'inquiry_status'::text, 'inquiry_trash'::text, 'inquiry_restore'::text, 'inquiry_purge'::text]))$expected$ OR (SELECT pg_get_constraintdef(oid,true) FROM pg_constraint WHERE conrelid='crm_security.inquiry_audit_events'::regclass AND conname='inquiry_audit_events_action_check') IS DISTINCT FROM $expected$CHECK (action = ANY (ARRAY['direct_assign'::text, 'direct_reassign'::text, 'inquiry_unassign'::text, 'inquiry_reclassify'::text, 'inquiry_hold'::text, 'inquiry_trash'::text, 'inquiry_restore'::text, 'inquiry_purge'::text]))$expected$ THEN RAISE EXCEPTION 'inquiry purge rollback blocked: drift or runtime purge evidence exists';END IF;END $guard$;
DROP FUNCTION public.crm_write_command_v2(uuid,text,uuid,integer,jsonb);DROP FUNCTION crm_security.crm_inquiry_purge_command_v1(uuid,uuid,jsonb);ALTER FUNCTION crm_security.crm_write_command_v2_inquiry_trash_restore_20260906(uuid,text,uuid,integer,jsonb) RENAME TO crm_write_command_v2;ALTER FUNCTION crm_security.crm_write_command_v2(uuid,text,uuid,integer,jsonb) SET SCHEMA public;REVOKE EXECUTE ON FUNCTION public.crm_write_command_v2(uuid,text,uuid,integer,jsonb) FROM PUBLIC,anon,authenticated,service_role;GRANT EXECUTE ON FUNCTION public.crm_write_command_v2(uuid,text,uuid,integer,jsonb) TO authenticated;
ALTER TABLE crm_security.command_receipts DROP CONSTRAINT command_receipts_operation_check;ALTER TABLE crm_security.command_receipts ADD CONSTRAINT command_receipts_operation_check CHECK(operation IN ('opportunity_work_set','inquiry_assign','service_change','inquiry_unassign','favorite_set','opportunity_touch','next_action','activity','quote_version','next_action_complete','stage_check','transition','close','amount','waiting_context','inquiry_reclassify','inquiry_status','inquiry_trash','inquiry_restore'));
ALTER TABLE crm_security.inquiry_audit_events DROP CONSTRAINT inquiry_audit_events_action_check;ALTER TABLE crm_security.inquiry_audit_events ADD CONSTRAINT inquiry_audit_events_action_check CHECK(action IN ('direct_assign','direct_reassign','inquiry_unassign','inquiry_reclassify','inquiry_hold','inquiry_trash','inquiry_restore'));
DO $post$ BEGIN IF to_regprocedure('crm_security.crm_write_command_v2_inquiry_trash_restore_20260906(uuid,text,uuid,integer,jsonb)') IS NOT NULL OR to_regprocedure('crm_security.crm_inquiry_purge_command_v1(uuid,uuid,jsonb)') IS NOT NULL OR (SELECT pg_get_constraintdef(oid,true) FROM pg_constraint WHERE conrelid='crm_security.command_receipts'::regclass AND conname='command_receipts_operation_check') IS DISTINCT FROM $expected$CHECK (operation = ANY (ARRAY['opportunity_work_set'::text, 'inquiry_assign'::text, 'service_change'::text, 'inquiry_unassign'::text, 'favorite_set'::text, 'opportunity_touch'::text, 'next_action'::text, 'activity'::text, 'quote_version'::text, 'next_action_complete'::text, 'stage_check'::text, 'transition'::text, 'close'::text, 'amount'::text, 'waiting_context'::text, 'inquiry_reclassify'::text, 'inquiry_status'::text, 'inquiry_trash'::text, 'inquiry_restore'::text]))$expected$ OR (SELECT pg_get_constraintdef(oid,true) FROM pg_constraint WHERE conrelid='crm_security.inquiry_audit_events'::regclass AND conname='inquiry_audit_events_action_check') IS DISTINCT FROM $expected$CHECK (action = ANY (ARRAY['direct_assign'::text, 'direct_reassign'::text, 'inquiry_unassign'::text, 'inquiry_reclassify'::text, 'inquiry_hold'::text, 'inquiry_trash'::text, 'inquiry_restore'::text]))$expected$ THEN RAISE EXCEPTION 'inquiry purge rollback verification drift';END IF;END $post$;
-- ===== ROLLBACK inquiry_trash_restore =====
SET LOCAL crm.inquiry_trash_restore_ref='rprechiaglyjaydkmxsu';
SET LOCAL crm.inquiry_trash_restore_ref='rprechiaglyjaydkmxsu';
SET LOCAL search_path=pg_catalog;SET LOCAL lock_timeout='3s';SET LOCAL statement_timeout='60s';
DO $guard$ BEGIN IF current_setting('crm.inquiry_trash_restore_ref',true) IS DISTINCT FROM 'rprechiaglyjaydkmxsu' OR to_regprocedure('public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)') IS NULL OR to_regprocedure('crm_security.crm_write_command_v2_inquiry_hold_20260906(uuid,text,uuid,integer,jsonb)') IS NULL OR to_regprocedure('crm_security.crm_inquiry_trash_command_v1(uuid,uuid,jsonb)') IS NULL OR to_regprocedure('crm_security.crm_inquiry_restore_command_v1(uuid,uuid,jsonb)') IS NULL OR to_regprocedure('crm_security.crm_operational_source_fragment_pre_inquiry_trash_restore_20260906(text,uuid,integer)') IS NULL OR to_regnamespace('crm_inquiry_trash_restore_archive') IS NOT NULL OR (SELECT pg_get_constraintdef(oid,true) FROM pg_constraint WHERE conrelid='crm_security.command_receipts'::regclass AND conname='command_receipts_operation_check') IS DISTINCT FROM $expected$CHECK (operation = ANY (ARRAY['opportunity_work_set'::text, 'inquiry_assign'::text, 'service_change'::text, 'inquiry_unassign'::text, 'favorite_set'::text, 'opportunity_touch'::text, 'next_action'::text, 'activity'::text, 'quote_version'::text, 'next_action_complete'::text, 'stage_check'::text, 'transition'::text, 'close'::text, 'amount'::text, 'waiting_context'::text, 'inquiry_reclassify'::text, 'inquiry_status'::text, 'inquiry_trash'::text, 'inquiry_restore'::text]))$expected$ OR (SELECT pg_get_constraintdef(oid,true) FROM pg_constraint WHERE conrelid='crm_security.inquiry_audit_events'::regclass AND conname='inquiry_audit_events_action_check') IS DISTINCT FROM $expected$CHECK (action = ANY (ARRAY['direct_assign'::text, 'direct_reassign'::text, 'inquiry_unassign'::text, 'inquiry_reclassify'::text, 'inquiry_hold'::text, 'inquiry_trash'::text, 'inquiry_restore'::text]))$expected$ THEN RAISE EXCEPTION 'inquiry trash/restore rollback drift';END IF;END $guard$;
CREATE SCHEMA crm_inquiry_trash_restore_archive AUTHORIZATION postgres;REVOKE ALL ON SCHEMA crm_inquiry_trash_restore_archive FROM PUBLIC,anon,authenticated,service_role;CREATE TABLE crm_inquiry_trash_restore_archive.audit_events AS SELECT * FROM crm_security.inquiry_audit_events WHERE action IN ('inquiry_trash','inquiry_restore');CREATE TABLE crm_inquiry_trash_restore_archive.command_receipts AS SELECT * FROM crm_security.command_receipts WHERE operation IN ('inquiry_trash','inquiry_restore');REVOKE ALL ON crm_inquiry_trash_restore_archive.audit_events,crm_inquiry_trash_restore_archive.command_receipts FROM PUBLIC,anon,authenticated,service_role;
DELETE FROM crm_security.command_receipts WHERE operation IN ('inquiry_trash','inquiry_restore');DELETE FROM crm_security.inquiry_audit_events WHERE action IN ('inquiry_trash','inquiry_restore');
DROP FUNCTION public.crm_write_command_v2(uuid,text,uuid,integer,jsonb);DROP FUNCTION crm_security.crm_inquiry_trash_command_v1(uuid,uuid,jsonb);DROP FUNCTION crm_security.crm_inquiry_restore_command_v1(uuid,uuid,jsonb);ALTER FUNCTION crm_security.crm_write_command_v2_inquiry_hold_20260906(uuid,text,uuid,integer,jsonb) RENAME TO crm_write_command_v2;ALTER FUNCTION crm_security.crm_write_command_v2(uuid,text,uuid,integer,jsonb) SET SCHEMA public;REVOKE EXECUTE ON FUNCTION public.crm_write_command_v2(uuid,text,uuid,integer,jsonb) FROM PUBLIC,anon,authenticated,service_role;GRANT EXECUTE ON FUNCTION public.crm_write_command_v2(uuid,text,uuid,integer,jsonb) TO authenticated;
DROP FUNCTION crm_security.crm_operational_source_fragment_v1(text,uuid,integer);ALTER FUNCTION crm_security.crm_operational_source_fragment_pre_inquiry_trash_restore_20260906(text,uuid,integer) RENAME TO crm_operational_source_fragment_v1;REVOKE EXECUTE ON FUNCTION crm_security.crm_operational_source_fragment_v1(text,uuid,integer) FROM PUBLIC,anon,authenticated,service_role;
ALTER TABLE crm_security.command_receipts DROP CONSTRAINT command_receipts_operation_check;ALTER TABLE crm_security.command_receipts ADD CONSTRAINT command_receipts_operation_check CHECK(operation IN ('opportunity_work_set','inquiry_assign','service_change','inquiry_unassign','favorite_set','opportunity_touch','next_action','activity','quote_version','next_action_complete','stage_check','transition','close','amount','waiting_context','inquiry_reclassify','inquiry_status'));
ALTER TABLE crm_security.inquiry_audit_events DROP CONSTRAINT inquiry_audit_events_action_check;ALTER TABLE crm_security.inquiry_audit_events ADD CONSTRAINT inquiry_audit_events_action_check CHECK(action IN ('direct_assign','direct_reassign','inquiry_unassign','inquiry_reclassify','inquiry_hold'));
DO $post$ BEGIN IF to_regprocedure('crm_security.crm_write_command_v2_inquiry_hold_20260906(uuid,text,uuid,integer,jsonb)') IS NOT NULL OR to_regprocedure('crm_security.crm_inquiry_trash_command_v1(uuid,uuid,jsonb)') IS NOT NULL OR to_regprocedure('crm_security.crm_inquiry_restore_command_v1(uuid,uuid,jsonb)') IS NOT NULL OR (SELECT pg_get_constraintdef(oid,true) FROM pg_constraint WHERE conrelid='crm_security.command_receipts'::regclass AND conname='command_receipts_operation_check') IS DISTINCT FROM $expected$CHECK (operation = ANY (ARRAY['opportunity_work_set'::text, 'inquiry_assign'::text, 'service_change'::text, 'inquiry_unassign'::text, 'favorite_set'::text, 'opportunity_touch'::text, 'next_action'::text, 'activity'::text, 'quote_version'::text, 'next_action_complete'::text, 'stage_check'::text, 'transition'::text, 'close'::text, 'amount'::text, 'waiting_context'::text, 'inquiry_reclassify'::text, 'inquiry_status'::text]))$expected$ OR (SELECT pg_get_constraintdef(oid,true) FROM pg_constraint WHERE conrelid='crm_security.inquiry_audit_events'::regclass AND conname='inquiry_audit_events_action_check') IS DISTINCT FROM $expected$CHECK (action = ANY (ARRAY['direct_assign'::text, 'direct_reassign'::text, 'inquiry_unassign'::text, 'inquiry_reclassify'::text, 'inquiry_hold'::text]))$expected$ THEN RAISE EXCEPTION 'inquiry trash/restore rollback verification drift';END IF;END $post$;
-- ===== ROLLBACK inquiry_hold =====
SET LOCAL crm.inquiry_hold_ref='rprechiaglyjaydkmxsu';
SET LOCAL crm.inquiry_hold_ref='rprechiaglyjaydkmxsu';
SET LOCAL search_path=pg_catalog;SET LOCAL lock_timeout='3s';SET LOCAL statement_timeout='60s';
DO $guard$ BEGIN IF current_setting('crm.inquiry_hold_ref',true) IS DISTINCT FROM 'rprechiaglyjaydkmxsu' OR to_regprocedure('public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)') IS NULL OR to_regprocedure('crm_security.crm_write_command_v2_inquiry_reclassify_20260906(uuid,text,uuid,integer,jsonb)') IS NULL OR to_regprocedure('crm_security.crm_inquiry_hold_command_v1(uuid,uuid,jsonb)') IS NULL OR to_regprocedure('crm_security.crm_operational_source_fragment_pre_inquiry_hold_20260906(text,uuid,integer)') IS NULL OR to_regnamespace('crm_inquiry_hold_archive') IS NOT NULL OR (SELECT pg_get_constraintdef(oid,true) FROM pg_constraint WHERE conrelid='crm_security.command_receipts'::regclass AND conname='command_receipts_operation_check') IS DISTINCT FROM $expected$CHECK (operation = ANY (ARRAY['opportunity_work_set'::text, 'inquiry_assign'::text, 'service_change'::text, 'inquiry_unassign'::text, 'favorite_set'::text, 'opportunity_touch'::text, 'next_action'::text, 'activity'::text, 'quote_version'::text, 'next_action_complete'::text, 'stage_check'::text, 'transition'::text, 'close'::text, 'amount'::text, 'waiting_context'::text, 'inquiry_reclassify'::text, 'inquiry_status'::text]))$expected$ OR (SELECT pg_get_constraintdef(oid,true) FROM pg_constraint WHERE conrelid='crm_security.inquiry_audit_events'::regclass AND conname='inquiry_audit_events_action_check') IS DISTINCT FROM $expected$CHECK (action = ANY (ARRAY['direct_assign'::text, 'direct_reassign'::text, 'inquiry_unassign'::text, 'inquiry_reclassify'::text, 'inquiry_hold'::text]))$expected$ THEN RAISE EXCEPTION 'inquiry hold rollback drift';END IF;END $guard$;
CREATE SCHEMA crm_inquiry_hold_archive AUTHORIZATION postgres;REVOKE ALL ON SCHEMA crm_inquiry_hold_archive FROM PUBLIC,anon,authenticated,service_role;CREATE TABLE crm_inquiry_hold_archive.audit_events AS SELECT * FROM crm_security.inquiry_audit_events WHERE action='inquiry_hold';CREATE TABLE crm_inquiry_hold_archive.command_receipts AS SELECT * FROM crm_security.command_receipts WHERE operation='inquiry_status';REVOKE ALL ON crm_inquiry_hold_archive.audit_events,crm_inquiry_hold_archive.command_receipts FROM PUBLIC,anon,authenticated,service_role;
UPDATE public.inquiries i SET status=x.before_data->>'status',updated_at=clock_timestamp() FROM (SELECT DISTINCT ON(inquiry_id) inquiry_id,before_data FROM crm_inquiry_hold_archive.audit_events ORDER BY inquiry_id,created_at DESC,event_id DESC)x WHERE i.id=x.inquiry_id AND i.status='보류';
DELETE FROM crm_security.command_receipts WHERE operation='inquiry_status';DELETE FROM crm_security.inquiry_audit_events WHERE action='inquiry_hold';
DROP FUNCTION public.crm_write_command_v2(uuid,text,uuid,integer,jsonb);DROP FUNCTION crm_security.crm_inquiry_hold_command_v1(uuid,uuid,jsonb);ALTER FUNCTION crm_security.crm_write_command_v2_inquiry_reclassify_20260906(uuid,text,uuid,integer,jsonb) RENAME TO crm_write_command_v2;ALTER FUNCTION crm_security.crm_write_command_v2(uuid,text,uuid,integer,jsonb) SET SCHEMA public;REVOKE EXECUTE ON FUNCTION public.crm_write_command_v2(uuid,text,uuid,integer,jsonb) FROM PUBLIC,anon,authenticated,service_role;GRANT EXECUTE ON FUNCTION public.crm_write_command_v2(uuid,text,uuid,integer,jsonb) TO authenticated;
DROP FUNCTION crm_security.crm_operational_source_fragment_v1(text,uuid,integer);ALTER FUNCTION crm_security.crm_operational_source_fragment_pre_inquiry_hold_20260906(text,uuid,integer) RENAME TO crm_operational_source_fragment_v1;REVOKE EXECUTE ON FUNCTION crm_security.crm_operational_source_fragment_v1(text,uuid,integer) FROM PUBLIC,anon,authenticated,service_role;
ALTER TABLE crm_security.command_receipts DROP CONSTRAINT command_receipts_operation_check;ALTER TABLE crm_security.command_receipts ADD CONSTRAINT command_receipts_operation_check CHECK(operation IN ('opportunity_work_set','inquiry_assign','service_change','inquiry_unassign','favorite_set','opportunity_touch','next_action','activity','quote_version','next_action_complete','stage_check','transition','close','amount','waiting_context','inquiry_reclassify'));
ALTER TABLE crm_security.inquiry_audit_events DROP CONSTRAINT inquiry_audit_events_action_check;ALTER TABLE crm_security.inquiry_audit_events ADD CONSTRAINT inquiry_audit_events_action_check CHECK(action IN ('direct_assign','direct_reassign','inquiry_unassign','inquiry_reclassify'));
DO $post$ BEGIN IF to_regprocedure('crm_security.crm_write_command_v2_inquiry_reclassify_20260906(uuid,text,uuid,integer,jsonb)') IS NOT NULL OR to_regprocedure('crm_security.crm_inquiry_hold_command_v1(uuid,uuid,jsonb)') IS NOT NULL OR (SELECT pg_get_constraintdef(oid,true) FROM pg_constraint WHERE conrelid='crm_security.command_receipts'::regclass AND conname='command_receipts_operation_check') IS DISTINCT FROM $expected$CHECK (operation = ANY (ARRAY['opportunity_work_set'::text, 'inquiry_assign'::text, 'service_change'::text, 'inquiry_unassign'::text, 'favorite_set'::text, 'opportunity_touch'::text, 'next_action'::text, 'activity'::text, 'quote_version'::text, 'next_action_complete'::text, 'stage_check'::text, 'transition'::text, 'close'::text, 'amount'::text, 'waiting_context'::text, 'inquiry_reclassify'::text]))$expected$ OR (SELECT pg_get_constraintdef(oid,true) FROM pg_constraint WHERE conrelid='crm_security.inquiry_audit_events'::regclass AND conname='inquiry_audit_events_action_check') IS DISTINCT FROM $expected$CHECK (action = ANY (ARRAY['direct_assign'::text, 'direct_reassign'::text, 'inquiry_unassign'::text, 'inquiry_reclassify'::text]))$expected$ THEN RAISE EXCEPTION 'inquiry hold rollback verification drift';END IF;END $post$;
-- ===== ROLLBACK inquiry_reclassify =====
SET LOCAL crm.inquiry_reclassify_ref='rprechiaglyjaydkmxsu';
SET LOCAL crm.inquiry_reclassify_ref='rprechiaglyjaydkmxsu';
SET LOCAL search_path=pg_catalog;SET LOCAL lock_timeout='3s';SET LOCAL statement_timeout='60s';
DO $guard$ BEGIN IF current_setting('crm.inquiry_reclassify_ref',true) IS DISTINCT FROM 'rprechiaglyjaydkmxsu' OR to_regprocedure('public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)') IS NULL OR to_regprocedure('crm_security.crm_write_command_v2_waiting_context_20260906(uuid,text,uuid,integer,jsonb)') IS NULL OR to_regprocedure('crm_security.crm_inquiry_reclassify_command_v1(uuid,uuid,jsonb)') IS NULL OR to_regprocedure('crm_security.crm_operational_source_fragment_pre_inquiry_reclassify_20260906(text,uuid,integer)') IS NULL OR to_regnamespace('crm_inquiry_reclassify_archive') IS NOT NULL OR (SELECT pg_get_constraintdef(oid,true) FROM pg_constraint WHERE conrelid='crm_security.command_receipts'::regclass AND conname='command_receipts_operation_check') IS DISTINCT FROM $expected$CHECK (operation = ANY (ARRAY['opportunity_work_set'::text, 'inquiry_assign'::text, 'service_change'::text, 'inquiry_unassign'::text, 'favorite_set'::text, 'opportunity_touch'::text, 'next_action'::text, 'activity'::text, 'quote_version'::text, 'next_action_complete'::text, 'stage_check'::text, 'transition'::text, 'close'::text, 'amount'::text, 'waiting_context'::text, 'inquiry_reclassify'::text]))$expected$ OR (SELECT pg_get_constraintdef(oid,true) FROM pg_constraint WHERE conrelid='crm_security.inquiry_audit_events'::regclass AND conname='inquiry_audit_events_action_check') IS DISTINCT FROM $expected$CHECK (action = ANY (ARRAY['direct_assign'::text, 'direct_reassign'::text, 'inquiry_unassign'::text, 'inquiry_reclassify'::text]))$expected$ THEN RAISE EXCEPTION 'inquiry reclassify rollback drift';END IF;END $guard$;
CREATE SCHEMA crm_inquiry_reclassify_archive AUTHORIZATION postgres;REVOKE ALL ON SCHEMA crm_inquiry_reclassify_archive FROM PUBLIC,anon,authenticated,service_role;CREATE TABLE crm_inquiry_reclassify_archive.audit_events AS SELECT * FROM crm_security.inquiry_audit_events WHERE action='inquiry_reclassify';CREATE TABLE crm_inquiry_reclassify_archive.command_receipts AS SELECT * FROM crm_security.command_receipts WHERE operation='inquiry_reclassify';REVOKE ALL ON crm_inquiry_reclassify_archive.audit_events,crm_inquiry_reclassify_archive.command_receipts FROM PUBLIC,anon,authenticated,service_role;
UPDATE public.inquiries i SET brand='기술자문',updated_at=clock_timestamp() FROM (SELECT DISTINCT ON(inquiry_id) inquiry_id,after_data FROM crm_inquiry_reclassify_archive.audit_events ORDER BY inquiry_id,created_at DESC,event_id DESC)x WHERE i.id=x.inquiry_id AND i.brand=x.after_data->>'brand';
DELETE FROM crm_security.command_receipts WHERE operation='inquiry_reclassify';DELETE FROM crm_security.inquiry_audit_events WHERE action='inquiry_reclassify';
DROP FUNCTION public.crm_write_command_v2(uuid,text,uuid,integer,jsonb);DROP FUNCTION crm_security.crm_inquiry_reclassify_command_v1(uuid,uuid,jsonb);ALTER FUNCTION crm_security.crm_write_command_v2_waiting_context_20260906(uuid,text,uuid,integer,jsonb) RENAME TO crm_write_command_v2;ALTER FUNCTION crm_security.crm_write_command_v2(uuid,text,uuid,integer,jsonb) SET SCHEMA public;REVOKE EXECUTE ON FUNCTION public.crm_write_command_v2(uuid,text,uuid,integer,jsonb) FROM PUBLIC,anon,authenticated,service_role;GRANT EXECUTE ON FUNCTION public.crm_write_command_v2(uuid,text,uuid,integer,jsonb) TO authenticated;
DROP FUNCTION crm_security.crm_operational_source_fragment_v1(text,uuid,integer);ALTER FUNCTION crm_security.crm_operational_source_fragment_pre_inquiry_reclassify_20260906(text,uuid,integer) RENAME TO crm_operational_source_fragment_v1;REVOKE EXECUTE ON FUNCTION crm_security.crm_operational_source_fragment_v1(text,uuid,integer) FROM PUBLIC,anon,authenticated,service_role;
ALTER TABLE crm_security.command_receipts DROP CONSTRAINT command_receipts_operation_check;ALTER TABLE crm_security.command_receipts ADD CONSTRAINT command_receipts_operation_check CHECK(operation IN ('opportunity_work_set','inquiry_assign','service_change','inquiry_unassign','favorite_set','opportunity_touch','next_action','activity','quote_version','next_action_complete','stage_check','transition','close','amount','waiting_context'));
ALTER TABLE crm_security.inquiry_audit_events DROP CONSTRAINT inquiry_audit_events_action_check;ALTER TABLE crm_security.inquiry_audit_events ADD CONSTRAINT inquiry_audit_events_action_check CHECK(action IN ('direct_assign','direct_reassign','inquiry_unassign'));
DO $post$ BEGIN IF to_regprocedure('crm_security.crm_write_command_v2_waiting_context_20260906(uuid,text,uuid,integer,jsonb)') IS NOT NULL OR to_regprocedure('crm_security.crm_inquiry_reclassify_command_v1(uuid,uuid,jsonb)') IS NOT NULL OR (SELECT pg_get_constraintdef(oid,true) FROM pg_constraint WHERE conrelid='crm_security.command_receipts'::regclass AND conname='command_receipts_operation_check') IS DISTINCT FROM $expected$CHECK (operation = ANY (ARRAY['opportunity_work_set'::text, 'inquiry_assign'::text, 'service_change'::text, 'inquiry_unassign'::text, 'favorite_set'::text, 'opportunity_touch'::text, 'next_action'::text, 'activity'::text, 'quote_version'::text, 'next_action_complete'::text, 'stage_check'::text, 'transition'::text, 'close'::text, 'amount'::text, 'waiting_context'::text]))$expected$ OR (SELECT pg_get_constraintdef(oid,true) FROM pg_constraint WHERE conrelid='crm_security.inquiry_audit_events'::regclass AND conname='inquiry_audit_events_action_check') IS DISTINCT FROM $expected$CHECK (action = ANY (ARRAY['direct_assign'::text, 'direct_reassign'::text, 'inquiry_unassign'::text]))$expected$ THEN RAISE EXCEPTION 'inquiry reclassify rollback verification drift';END IF;END $post$;
-- ===== ROLLBACK waiting_context =====
SET LOCAL crm.waiting_context_ref='rprechiaglyjaydkmxsu';
SET LOCAL crm.waiting_context_ref='rprechiaglyjaydkmxsu';
SET LOCAL search_path=pg_catalog;SET LOCAL lock_timeout='3s';SET LOCAL statement_timeout='60s';
DO $guard$ BEGIN IF current_setting('crm.waiting_context_ref',true) IS DISTINCT FROM 'rprechiaglyjaydkmxsu' OR to_regprocedure('public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)') IS NULL OR to_regprocedure('crm_security.crm_write_command_v2_expected_amount_20260906(uuid,text,uuid,integer,jsonb)') IS NULL OR to_regprocedure('crm_security.crm_deal_waiting_context_command_v1(uuid,uuid,integer,jsonb)') IS NULL OR to_regnamespace('crm_waiting_context_archive') IS NOT NULL OR (SELECT pg_get_constraintdef(oid,true) FROM pg_constraint WHERE conrelid='crm_security.command_receipts'::regclass AND conname='command_receipts_operation_check') IS DISTINCT FROM $expected$CHECK (operation = ANY (ARRAY['opportunity_work_set'::text, 'inquiry_assign'::text, 'service_change'::text, 'inquiry_unassign'::text, 'favorite_set'::text, 'opportunity_touch'::text, 'next_action'::text, 'activity'::text, 'quote_version'::text, 'next_action_complete'::text, 'stage_check'::text, 'transition'::text, 'close'::text, 'amount'::text, 'waiting_context'::text]))$expected$ THEN RAISE EXCEPTION 'waiting context rollback drift';END IF;END $guard$;
CREATE SCHEMA crm_waiting_context_archive AUTHORIZATION postgres;REVOKE ALL ON SCHEMA crm_waiting_context_archive FROM PUBLIC,anon,authenticated,service_role;CREATE TABLE crm_waiting_context_archive.command_receipts AS SELECT * FROM crm_security.command_receipts WHERE operation='waiting_context';REVOKE ALL ON crm_waiting_context_archive.command_receipts FROM PUBLIC,anon,authenticated,service_role;DELETE FROM crm_security.command_receipts WHERE operation='waiting_context';
DROP FUNCTION public.crm_write_command_v2(uuid,text,uuid,integer,jsonb);DROP FUNCTION crm_security.crm_deal_waiting_context_command_v1(uuid,uuid,integer,jsonb);ALTER FUNCTION crm_security.crm_write_command_v2_expected_amount_20260906(uuid,text,uuid,integer,jsonb) RENAME TO crm_write_command_v2;ALTER FUNCTION crm_security.crm_write_command_v2(uuid,text,uuid,integer,jsonb) SET SCHEMA public;REVOKE EXECUTE ON FUNCTION public.crm_write_command_v2(uuid,text,uuid,integer,jsonb) FROM PUBLIC,anon,authenticated,service_role;GRANT EXECUTE ON FUNCTION public.crm_write_command_v2(uuid,text,uuid,integer,jsonb) TO authenticated;
ALTER TABLE crm_security.command_receipts DROP CONSTRAINT command_receipts_operation_check;ALTER TABLE crm_security.command_receipts ADD CONSTRAINT command_receipts_operation_check CHECK(operation IN ('opportunity_work_set','inquiry_assign','service_change','inquiry_unassign','favorite_set','opportunity_touch','next_action','activity','quote_version','next_action_complete','stage_check','transition','close','amount'));
DO $post$ BEGIN IF to_regprocedure('crm_security.crm_write_command_v2_expected_amount_20260906(uuid,text,uuid,integer,jsonb)') IS NOT NULL OR to_regprocedure('crm_security.crm_deal_waiting_context_command_v1(uuid,uuid,integer,jsonb)') IS NOT NULL OR (SELECT pg_get_constraintdef(oid,true) FROM pg_constraint WHERE conrelid='crm_security.command_receipts'::regclass AND conname='command_receipts_operation_check') IS DISTINCT FROM $expected$CHECK (operation = ANY (ARRAY['opportunity_work_set'::text, 'inquiry_assign'::text, 'service_change'::text, 'inquiry_unassign'::text, 'favorite_set'::text, 'opportunity_touch'::text, 'next_action'::text, 'activity'::text, 'quote_version'::text, 'next_action_complete'::text, 'stage_check'::text, 'transition'::text, 'close'::text, 'amount'::text]))$expected$ THEN RAISE EXCEPTION 'waiting context rollback verification drift';END IF;END $post$;
-- ===== ROLLBACK expected_amount =====
SET LOCAL crm.expected_amount_ref='rprechiaglyjaydkmxsu';
SET LOCAL crm.expected_amount_ref='rprechiaglyjaydkmxsu';
SET LOCAL search_path=pg_catalog;SET LOCAL lock_timeout='3s';SET LOCAL statement_timeout='60s';
DO $guard$ BEGIN IF current_setting('crm.expected_amount_ref',true) IS DISTINCT FROM 'rprechiaglyjaydkmxsu' OR to_regprocedure('public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)') IS NULL OR to_regprocedure('crm_security.crm_write_command_v2_close_nonwon_20260906(uuid,text,uuid,integer,jsonb)') IS NULL OR to_regprocedure('crm_security.crm_deal_expected_amount_command_v1(uuid,uuid,integer,jsonb)') IS NULL OR to_regnamespace('crm_expected_amount_archive') IS NOT NULL OR (SELECT pg_get_constraintdef(oid,true) FROM pg_constraint WHERE conrelid='crm_security.command_receipts'::regclass AND conname='command_receipts_operation_check') IS DISTINCT FROM $expected$CHECK (operation = ANY (ARRAY['opportunity_work_set'::text, 'inquiry_assign'::text, 'service_change'::text, 'inquiry_unassign'::text, 'favorite_set'::text, 'opportunity_touch'::text, 'next_action'::text, 'activity'::text, 'quote_version'::text, 'next_action_complete'::text, 'stage_check'::text, 'transition'::text, 'close'::text, 'amount'::text]))$expected$ THEN RAISE EXCEPTION 'expected amount rollback drift';END IF;END $guard$;
CREATE SCHEMA crm_expected_amount_archive AUTHORIZATION postgres;REVOKE ALL ON SCHEMA crm_expected_amount_archive FROM PUBLIC,anon,authenticated,service_role;CREATE TABLE crm_expected_amount_archive.command_receipts AS SELECT * FROM crm_security.command_receipts WHERE operation='amount';REVOKE ALL ON crm_expected_amount_archive.command_receipts FROM PUBLIC,anon,authenticated,service_role;
DELETE FROM crm_security.command_receipts WHERE operation='amount';DROP FUNCTION public.crm_write_command_v2(uuid,text,uuid,integer,jsonb);DROP FUNCTION crm_security.crm_deal_expected_amount_command_v1(uuid,uuid,integer,jsonb);
ALTER FUNCTION crm_security.crm_write_command_v2_close_nonwon_20260906(uuid,text,uuid,integer,jsonb) RENAME TO crm_write_command_v2;ALTER FUNCTION crm_security.crm_write_command_v2(uuid,text,uuid,integer,jsonb) SET SCHEMA public;REVOKE EXECUTE ON FUNCTION public.crm_write_command_v2(uuid,text,uuid,integer,jsonb) FROM PUBLIC,anon,authenticated,service_role;GRANT EXECUTE ON FUNCTION public.crm_write_command_v2(uuid,text,uuid,integer,jsonb) TO authenticated;
ALTER TABLE crm_security.command_receipts DROP CONSTRAINT command_receipts_operation_check;ALTER TABLE crm_security.command_receipts ADD CONSTRAINT command_receipts_operation_check CHECK(operation IN ('opportunity_work_set','inquiry_assign','service_change','inquiry_unassign','favorite_set','opportunity_touch','next_action','activity','quote_version','next_action_complete','stage_check','transition','close'));
DO $post$ BEGIN IF to_regprocedure('crm_security.crm_write_command_v2_close_nonwon_20260906(uuid,text,uuid,integer,jsonb)') IS NOT NULL OR to_regprocedure('crm_security.crm_deal_expected_amount_command_v1(uuid,uuid,integer,jsonb)') IS NOT NULL OR (SELECT pg_get_constraintdef(oid,true) FROM pg_constraint WHERE conrelid='crm_security.command_receipts'::regclass AND conname='command_receipts_operation_check') IS DISTINCT FROM $expected$CHECK (operation = ANY (ARRAY['opportunity_work_set'::text, 'inquiry_assign'::text, 'service_change'::text, 'inquiry_unassign'::text, 'favorite_set'::text, 'opportunity_touch'::text, 'next_action'::text, 'activity'::text, 'quote_version'::text, 'next_action_complete'::text, 'stage_check'::text, 'transition'::text, 'close'::text]))$expected$ THEN RAISE EXCEPTION 'expected amount rollback verification drift';END IF;END $post$;
-- ===== ROLLBACK close_nonwon =====
SET LOCAL crm.close_nonwon_ref='rprechiaglyjaydkmxsu';
SET LOCAL crm.close_nonwon_ref='rprechiaglyjaydkmxsu';
SET LOCAL search_path=pg_catalog;SET LOCAL lock_timeout='3s';SET LOCAL statement_timeout='60s';
DO $guard$ BEGIN IF current_setting('crm.close_nonwon_ref',true) IS DISTINCT FROM 'rprechiaglyjaydkmxsu' OR to_regprocedure('public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)') IS NULL OR to_regprocedure('crm_security.crm_write_command_v2_transition_20260906(uuid,text,uuid,integer,jsonb)') IS NULL OR to_regprocedure('crm_security.crm_deal_close_nonwon_command_v1(uuid,uuid,integer,jsonb)') IS NULL OR to_regprocedure('crm_security.crm_operational_source_fragment_pre_close_nonwon_20260906(text,uuid,integer)') IS NULL OR to_regclass('crm_security.deal_close_events') IS NULL OR to_regnamespace('crm_close_nonwon_archive') IS NOT NULL OR (SELECT pg_get_constraintdef(oid,true) FROM pg_constraint WHERE conrelid='crm_security.command_receipts'::regclass AND conname='command_receipts_operation_check') IS DISTINCT FROM $expected$CHECK (operation = ANY (ARRAY['opportunity_work_set'::text, 'inquiry_assign'::text, 'service_change'::text, 'inquiry_unassign'::text, 'favorite_set'::text, 'opportunity_touch'::text, 'next_action'::text, 'activity'::text, 'quote_version'::text, 'next_action_complete'::text, 'stage_check'::text, 'transition'::text, 'close'::text]))$expected$ THEN RAISE EXCEPTION 'close nonwon rollback drift';END IF;END $guard$;
CREATE SCHEMA crm_close_nonwon_archive AUTHORIZATION postgres;REVOKE ALL ON SCHEMA crm_close_nonwon_archive FROM PUBLIC,anon,authenticated,service_role;
CREATE TABLE crm_close_nonwon_archive.deal_close_events AS TABLE crm_security.deal_close_events;CREATE TABLE crm_close_nonwon_archive.command_receipts AS SELECT * FROM crm_security.command_receipts WHERE operation='close';REVOKE ALL ON crm_close_nonwon_archive.deal_close_events,crm_close_nonwon_archive.command_receipts FROM PUBLIC,anon,authenticated,service_role;
DELETE FROM crm_security.command_receipts WHERE operation='close';DROP FUNCTION public.crm_write_command_v2(uuid,text,uuid,integer,jsonb);DROP FUNCTION crm_security.crm_deal_close_nonwon_command_v1(uuid,uuid,integer,jsonb);DROP TABLE crm_security.deal_close_events;
ALTER FUNCTION crm_security.crm_write_command_v2_transition_20260906(uuid,text,uuid,integer,jsonb) RENAME TO crm_write_command_v2;ALTER FUNCTION crm_security.crm_write_command_v2(uuid,text,uuid,integer,jsonb) SET SCHEMA public;REVOKE EXECUTE ON FUNCTION public.crm_write_command_v2(uuid,text,uuid,integer,jsonb) FROM PUBLIC,anon,authenticated,service_role;GRANT EXECUTE ON FUNCTION public.crm_write_command_v2(uuid,text,uuid,integer,jsonb) TO authenticated;
DROP FUNCTION crm_security.crm_operational_source_fragment_v1(text,uuid,integer);ALTER FUNCTION crm_security.crm_operational_source_fragment_pre_close_nonwon_20260906(text,uuid,integer) RENAME TO crm_operational_source_fragment_v1;REVOKE EXECUTE ON FUNCTION crm_security.crm_operational_source_fragment_v1(text,uuid,integer) FROM PUBLIC,anon,authenticated,service_role;
ALTER TABLE crm_security.command_receipts DROP CONSTRAINT command_receipts_operation_check;ALTER TABLE crm_security.command_receipts ADD CONSTRAINT command_receipts_operation_check CHECK(operation IN ('opportunity_work_set','inquiry_assign','service_change','inquiry_unassign','favorite_set','opportunity_touch','next_action','activity','quote_version','next_action_complete','stage_check','transition'));
DO $post$ BEGIN IF to_regprocedure('crm_security.crm_write_command_v2_transition_20260906(uuid,text,uuid,integer,jsonb)') IS NOT NULL OR to_regprocedure('crm_security.crm_deal_close_nonwon_command_v1(uuid,uuid,integer,jsonb)') IS NOT NULL OR to_regclass('crm_security.deal_close_events') IS NOT NULL OR (SELECT pg_get_constraintdef(oid,true) FROM pg_constraint WHERE conrelid='crm_security.command_receipts'::regclass AND conname='command_receipts_operation_check') IS DISTINCT FROM $expected$CHECK (operation = ANY (ARRAY['opportunity_work_set'::text, 'inquiry_assign'::text, 'service_change'::text, 'inquiry_unassign'::text, 'favorite_set'::text, 'opportunity_touch'::text, 'next_action'::text, 'activity'::text, 'quote_version'::text, 'next_action_complete'::text, 'stage_check'::text, 'transition'::text]))$expected$ THEN RAISE EXCEPTION 'close nonwon rollback verification drift';END IF;END $post$;
-- ===== ROLLBACK transition =====
SET LOCAL crm.transition_ref='rprechiaglyjaydkmxsu';
SET LOCAL crm.transition_ref='rprechiaglyjaydkmxsu';
SET LOCAL search_path=pg_catalog;SET LOCAL lock_timeout='3s';SET LOCAL statement_timeout='60s';
DO $guard$ BEGIN
 IF current_setting('crm.transition_ref',true) IS DISTINCT FROM 'rprechiaglyjaydkmxsu' OR to_regprocedure('public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)') IS NULL
  OR to_regprocedure('crm_security.crm_write_command_v2_stage_check_20260906(uuid,text,uuid,integer,jsonb)') IS NULL OR to_regprocedure('crm_security.crm_deal_transition_command_v1(uuid,uuid,integer,jsonb)') IS NULL
  OR to_regprocedure('crm_security.crm_operational_source_fragment_pre_transition_20260906(text,uuid,integer)') IS NULL OR to_regclass('crm_security.stage_transition_events') IS NULL OR to_regnamespace('crm_transition_archive') IS NOT NULL
  OR (SELECT pg_get_constraintdef(oid,true) FROM pg_constraint WHERE conrelid='crm_security.command_receipts'::regclass AND conname='command_receipts_operation_check') IS DISTINCT FROM $expected$CHECK (operation = ANY (ARRAY['opportunity_work_set'::text, 'inquiry_assign'::text, 'service_change'::text, 'inquiry_unassign'::text, 'favorite_set'::text, 'opportunity_touch'::text, 'next_action'::text, 'activity'::text, 'quote_version'::text, 'next_action_complete'::text, 'stage_check'::text, 'transition'::text]))$expected$
 THEN RAISE EXCEPTION 'transition rollback drift'; END IF;
END $guard$;
CREATE SCHEMA crm_transition_archive AUTHORIZATION postgres;REVOKE ALL ON SCHEMA crm_transition_archive FROM PUBLIC,anon,authenticated,service_role;
CREATE TABLE crm_transition_archive.deal_stage_contexts AS SELECT id AS deal_id,stage_contexts,clock_timestamp() AS archived_at FROM public.deals WHERE stage_contexts<>'{}'::jsonb;
CREATE TABLE crm_transition_archive.stage_transition_events AS TABLE crm_security.stage_transition_events;
CREATE TABLE crm_transition_archive.command_receipts AS SELECT * FROM crm_security.command_receipts WHERE operation='transition';
REVOKE ALL ON crm_transition_archive.deal_stage_contexts,crm_transition_archive.stage_transition_events,crm_transition_archive.command_receipts FROM PUBLIC,anon,authenticated,service_role;
DELETE FROM crm_security.command_receipts WHERE operation='transition';
DROP FUNCTION public.crm_write_command_v2(uuid,text,uuid,integer,jsonb);DROP FUNCTION crm_security.crm_deal_transition_command_v1(uuid,uuid,integer,jsonb);DROP FUNCTION crm_security.crm_transition_validate_v1(text,jsonb,date);DROP FUNCTION crm_security.crm_transition_field_date_v1(jsonb,text,boolean);DROP TABLE crm_security.stage_transition_events;
ALTER FUNCTION crm_security.crm_write_command_v2_stage_check_20260906(uuid,text,uuid,integer,jsonb) RENAME TO crm_write_command_v2;ALTER FUNCTION crm_security.crm_write_command_v2(uuid,text,uuid,integer,jsonb) SET SCHEMA public;
REVOKE EXECUTE ON FUNCTION public.crm_write_command_v2(uuid,text,uuid,integer,jsonb) FROM PUBLIC,anon,authenticated,service_role;GRANT EXECUTE ON FUNCTION public.crm_write_command_v2(uuid,text,uuid,integer,jsonb) TO authenticated;
DROP FUNCTION crm_security.crm_operational_source_fragment_v1(text,uuid,integer);ALTER FUNCTION crm_security.crm_operational_source_fragment_pre_transition_20260906(text,uuid,integer) RENAME TO crm_operational_source_fragment_v1;REVOKE EXECUTE ON FUNCTION crm_security.crm_operational_source_fragment_v1(text,uuid,integer) FROM PUBLIC,anon,authenticated,service_role;
ALTER TABLE public.deals DROP COLUMN stage_contexts;
ALTER TABLE crm_security.command_receipts DROP CONSTRAINT command_receipts_operation_check;ALTER TABLE crm_security.command_receipts ADD CONSTRAINT command_receipts_operation_check CHECK(operation IN ('opportunity_work_set','inquiry_assign','service_change','inquiry_unassign','favorite_set','opportunity_touch','next_action','activity','quote_version','next_action_complete','stage_check'));
DO $post$ BEGIN IF to_regprocedure('crm_security.crm_write_command_v2_stage_check_20260906(uuid,text,uuid,integer,jsonb)') IS NOT NULL OR to_regprocedure('crm_security.crm_deal_transition_command_v1(uuid,uuid,integer,jsonb)') IS NOT NULL OR to_regclass('crm_security.stage_transition_events') IS NOT NULL OR EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='deals' AND column_name='stage_contexts') OR (SELECT pg_get_constraintdef(oid,true) FROM pg_constraint WHERE conrelid='crm_security.command_receipts'::regclass AND conname='command_receipts_operation_check') IS DISTINCT FROM $expected$CHECK (operation = ANY (ARRAY['opportunity_work_set'::text, 'inquiry_assign'::text, 'service_change'::text, 'inquiry_unassign'::text, 'favorite_set'::text, 'opportunity_touch'::text, 'next_action'::text, 'activity'::text, 'quote_version'::text, 'next_action_complete'::text, 'stage_check'::text]))$expected$ THEN RAISE EXCEPTION 'transition rollback verification drift'; END IF; END $post$;
-- ===== ROLLBACK stage_check =====
SET LOCAL crm.stage_check_ref='rprechiaglyjaydkmxsu';
SET LOCAL crm.stage_check_ref='rprechiaglyjaydkmxsu';

SET LOCAL search_path=pg_catalog;
SET LOCAL lock_timeout='3s';
SET LOCAL statement_timeout='60s';
DO $guard$ BEGIN
 IF current_setting('crm.stage_check_ref',true) IS DISTINCT FROM 'rprechiaglyjaydkmxsu'
  OR to_regprocedure('public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)') IS NULL
  OR to_regprocedure('crm_security.crm_write_command_v2_next_complete_20260906(uuid,text,uuid,integer,jsonb)') IS NULL
  OR to_regprocedure('crm_security.crm_stage_check_command_v1(uuid,uuid,integer,jsonb)') IS NULL
  OR to_regprocedure('crm_security.crm_operational_source_fragment_v1(text,uuid,integer)') IS NULL
  OR to_regprocedure('crm_security.crm_operational_source_fragment_pre_stage_20260906(text,uuid,integer)') IS NULL
  OR to_regnamespace('crm_stage_check_archive') IS NOT NULL
  OR (SELECT pg_get_constraintdef(oid,true) FROM pg_constraint WHERE conrelid='crm_security.command_receipts'::regclass AND conname='command_receipts_operation_check') IS DISTINCT FROM $expected$CHECK (operation = ANY (ARRAY['opportunity_work_set'::text, 'inquiry_assign'::text, 'service_change'::text, 'inquiry_unassign'::text, 'favorite_set'::text, 'opportunity_touch'::text, 'next_action'::text, 'activity'::text, 'quote_version'::text, 'next_action_complete'::text, 'stage_check'::text]))$expected$
 THEN RAISE EXCEPTION 'stage-check rollback drift'; END IF;
END $guard$;
CREATE SCHEMA crm_stage_check_archive AUTHORIZATION postgres;
REVOKE ALL ON SCHEMA crm_stage_check_archive FROM PUBLIC,anon,authenticated,service_role;
CREATE TABLE crm_stage_check_archive.deal_stage_checklist AS SELECT id AS deal_id,stage_checklist,clock_timestamp() AS archived_at FROM public.deals WHERE stage_checklist<>'{}'::jsonb;
CREATE TABLE crm_stage_check_archive.command_receipts AS SELECT * FROM crm_security.command_receipts WHERE operation='stage_check';
REVOKE ALL ON crm_stage_check_archive.deal_stage_checklist,crm_stage_check_archive.command_receipts FROM PUBLIC,anon,authenticated,service_role;
DELETE FROM crm_security.command_receipts WHERE operation='stage_check';
DROP FUNCTION public.crm_write_command_v2(uuid,text,uuid,integer,jsonb);
DROP FUNCTION crm_security.crm_stage_check_command_v1(uuid,uuid,integer,jsonb);
ALTER FUNCTION crm_security.crm_write_command_v2_next_complete_20260906(uuid,text,uuid,integer,jsonb) RENAME TO crm_write_command_v2;
ALTER FUNCTION crm_security.crm_write_command_v2(uuid,text,uuid,integer,jsonb) SET SCHEMA public;
REVOKE EXECUTE ON FUNCTION public.crm_write_command_v2(uuid,text,uuid,integer,jsonb) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.crm_write_command_v2(uuid,text,uuid,integer,jsonb) TO authenticated;
DROP FUNCTION crm_security.crm_operational_source_fragment_v1(text,uuid,integer);
ALTER FUNCTION crm_security.crm_operational_source_fragment_pre_stage_20260906(text,uuid,integer) RENAME TO crm_operational_source_fragment_v1;
REVOKE EXECUTE ON FUNCTION crm_security.crm_operational_source_fragment_v1(text,uuid,integer) FROM PUBLIC,anon,authenticated,service_role;
ALTER TABLE public.deals DROP COLUMN stage_checklist;
ALTER TABLE crm_security.command_receipts DROP CONSTRAINT command_receipts_operation_check;
ALTER TABLE crm_security.command_receipts ADD CONSTRAINT command_receipts_operation_check CHECK(operation IN ('opportunity_work_set','inquiry_assign','service_change','inquiry_unassign','favorite_set','opportunity_touch','next_action','activity','quote_version','next_action_complete'));
DO $post$ BEGIN
 IF to_regprocedure('crm_security.crm_write_command_v2_next_complete_20260906(uuid,text,uuid,integer,jsonb)') IS NOT NULL
  OR to_regprocedure('crm_security.crm_stage_check_command_v1(uuid,uuid,integer,jsonb)') IS NOT NULL
  OR to_regprocedure('crm_security.crm_operational_source_fragment_pre_stage_20260906(text,uuid,integer)') IS NOT NULL
  OR EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='deals' AND column_name='stage_checklist')
  OR (SELECT pg_get_constraintdef(oid,true) FROM pg_constraint WHERE conrelid='crm_security.command_receipts'::regclass AND conname='command_receipts_operation_check') IS DISTINCT FROM $expected$CHECK (operation = ANY (ARRAY['opportunity_work_set'::text, 'inquiry_assign'::text, 'service_change'::text, 'inquiry_unassign'::text, 'favorite_set'::text, 'opportunity_touch'::text, 'next_action'::text, 'activity'::text, 'quote_version'::text, 'next_action_complete'::text]))$expected$
 THEN RAISE EXCEPTION 'stage-check rollback verification drift'; END IF;
END $post$;
-- ===== ROLLBACK next_complete =====
SET LOCAL crm.next_complete_ref='rprechiaglyjaydkmxsu';
SET LOCAL crm.next_complete_ref='rprechiaglyjaydkmxsu';

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
-- ===== ROLLBACK operational_source =====
SET LOCAL crm.operational_source_ref='rprechiaglyjaydkmxsu';
-- Removes only the local operational source pair. Existing read/write functions and data remain.

SET LOCAL search_path=pg_catalog;
SET LOCAL lock_timeout='3s';
SET LOCAL statement_timeout='60s';
DO $guard$ BEGIN
 IF current_setting('crm.operational_source_ref',true) IS DISTINCT FROM 'rprechiaglyjaydkmxsu'
  OR to_regprocedure('public.crm_operational_source_v1(text,uuid,integer)') IS NULL
  OR to_regprocedure('crm_security.crm_operational_source_fragment_v1(text,uuid,integer)') IS NULL
 THEN RAISE EXCEPTION 'operational source rollback drift'; END IF;
END $guard$;
DROP FUNCTION public.crm_operational_source_v1(text,uuid,integer);
DROP FUNCTION crm_security.crm_operational_source_fragment_v1(text,uuid,integer);
-- ===== ROLLBACK quote_version =====
SET LOCAL crm.quote_version_ref='rprechiaglyjaydkmxsu';
SET LOCAL crm.quote_version_ref='rprechiaglyjaydkmxsu';

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
-- ===== ROLLBACK pipeline_action =====
SET LOCAL crm.pipeline_action_ref='rprechiaglyjaydkmxsu';
SET LOCAL crm.pipeline_action_ref='rprechiaglyjaydkmxsu';

SET LOCAL search_path=pg_catalog;
SET LOCAL lock_timeout='3s';
SET LOCAL statement_timeout='60s';
DO $guard$ BEGIN
 IF current_user<>'postgres'
  OR current_setting('crm.pipeline_action_ref',true) IS DISTINCT FROM 'rprechiaglyjaydkmxsu'
  OR to_regprocedure('public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)') IS NULL
  OR to_regprocedure('crm_security.crm_write_command_v2_personal_20260906(uuid,text,uuid,integer,jsonb)') IS NULL
  OR to_regprocedure('crm_security.crm_pipeline_action_command_v1(uuid,text,uuid,integer,jsonb)') IS NULL
  OR to_regnamespace('crm_pipeline_action_archive') IS NOT NULL
  OR (SELECT pg_get_constraintdef(oid,true) FROM pg_constraint
      WHERE conrelid='crm_security.command_receipts'::regclass
       AND conname='command_receipts_operation_check') IS DISTINCT FROM $expected$CHECK (operation = ANY (ARRAY['opportunity_work_set'::text, 'inquiry_assign'::text, 'service_change'::text, 'inquiry_unassign'::text, 'favorite_set'::text, 'opportunity_touch'::text, 'next_action'::text, 'activity'::text]))$expected$
 THEN RAISE EXCEPTION 'pipeline-action rollback prerequisite drift'; END IF;
END $guard$;
LOCK TABLE crm_security.command_receipts IN ACCESS EXCLUSIVE MODE;
CREATE SCHEMA crm_pipeline_action_archive AUTHORIZATION postgres;
REVOKE ALL ON SCHEMA crm_pipeline_action_archive FROM PUBLIC,anon,authenticated,service_role;
CREATE TABLE crm_pipeline_action_archive.command_receipts AS
 SELECT * FROM crm_security.command_receipts WHERE operation IN ('next_action','activity');
REVOKE ALL ON crm_pipeline_action_archive.command_receipts FROM PUBLIC,anon,authenticated,service_role;
DELETE FROM crm_security.command_receipts WHERE operation IN ('next_action','activity');
DROP FUNCTION public.crm_write_command_v2(uuid,text,uuid,integer,jsonb) RESTRICT;
DROP FUNCTION crm_security.crm_pipeline_action_command_v1(uuid,text,uuid,integer,jsonb) RESTRICT;
ALTER FUNCTION crm_security.crm_write_command_v2_personal_20260906(uuid,text,uuid,integer,jsonb)
 RENAME TO crm_write_command_v2;
ALTER FUNCTION crm_security.crm_write_command_v2(uuid,text,uuid,integer,jsonb) SET SCHEMA public;
REVOKE EXECUTE ON FUNCTION public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)
 FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.crm_write_command_v2(uuid,text,uuid,integer,jsonb) TO authenticated;
ALTER TABLE crm_security.command_receipts DROP CONSTRAINT command_receipts_operation_check;
ALTER TABLE crm_security.command_receipts ADD CONSTRAINT command_receipts_operation_check
 CHECK(operation IN ('opportunity_work_set','inquiry_assign','service_change','inquiry_unassign','favorite_set','opportunity_touch'));
DO $post$ BEGIN
 IF to_regprocedure('crm_security.crm_write_command_v2_personal_20260906(uuid,text,uuid,integer,jsonb)') IS NOT NULL
  OR to_regprocedure('crm_security.crm_pipeline_action_command_v1(uuid,text,uuid,integer,jsonb)') IS NOT NULL
  OR to_regprocedure('crm_security.crm_user_opportunity_state_command_v2(uuid,text,uuid,integer,jsonb)') IS NULL
  OR to_regprocedure('crm_security.crm_write_command_v2_operational_20260906(uuid,text,uuid,integer,jsonb)') IS NULL
  OR (SELECT pg_get_constraintdef(oid,true) FROM pg_constraint
      WHERE conrelid='crm_security.command_receipts'::regclass
       AND conname='command_receipts_operation_check') IS DISTINCT FROM $expected$CHECK (operation = ANY (ARRAY['opportunity_work_set'::text, 'inquiry_assign'::text, 'service_change'::text, 'inquiry_unassign'::text, 'favorite_set'::text, 'opportunity_touch'::text]))$expected$
 THEN RAISE EXCEPTION 'pipeline-action targeted rollback drift'; END IF;
END $post$;
-- ===== ROLLBACK personal_state =====
SET LOCAL crm.personal_state_ref='rprechiaglyjaydkmxsu';
SET LOCAL crm.personal_state_ref='rprechiaglyjaydkmxsu';

SET LOCAL search_path=pg_catalog;
SET LOCAL lock_timeout='3s';
SET LOCAL statement_timeout='60s';
DO $approval$ BEGIN
 IF current_user<>'postgres'
  OR current_setting('crm.personal_state_ref',true) IS DISTINCT FROM 'rprechiaglyjaydkmxsu'
  OR to_regprocedure('public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)') IS NULL
  OR to_regprocedure('crm_security.crm_write_command_v2_operational_20260906(uuid,text,uuid,integer,jsonb)') IS NULL
  OR to_regprocedure('crm_security.crm_user_opportunity_state_command_v2(uuid,text,uuid,integer,jsonb)') IS NULL
  OR to_regclass('crm_security.user_opportunity_state') IS NULL
  OR to_regnamespace('crm_personal_state_archive') IS NOT NULL
 THEN RAISE EXCEPTION 'personal-state rollback approval/drift failure'; END IF;
END $approval$;
DO $target_post_guard$ DECLARE w record; r record; h record; moved record; state_rel record; BEGIN
 SELECT * INTO w FROM pg_proc WHERE oid='public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)'::regprocedure;
 SELECT * INTO r FROM pg_proc WHERE oid='public.crm_read_scoped_v2(uuid,integer,uuid,uuid)'::regprocedure;
 SELECT * INTO h FROM pg_proc WHERE oid='crm_security.crm_user_opportunity_state_command_v2(uuid,text,uuid,integer,jsonb)'::regprocedure;
 SELECT * INTO moved FROM pg_proc WHERE oid='crm_security.crm_write_command_v2_operational_20260906(uuid,text,uuid,integer,jsonb)'::regprocedure;
 SELECT * INTO state_rel FROM pg_class WHERE oid='crm_security.user_opportunity_state'::regclass;
 IF md5(pg_get_functiondef(w.oid))<>'5bbfeae44207a639d80474f882b25e47'
  OR md5(pg_get_functiondef(r.oid))<>'5fe13081a33bcfee6a4e989f4680b3b4'
  OR md5(pg_get_functiondef(h.oid))<>'ba6945da818aff8a26f86037ff06b32a'
  OR moved.oid<>18115
  OR pg_get_userbyid(state_rel.relowner)<>'postgres' OR NOT state_rel.relrowsecurity
  OR has_table_privilege('public',state_rel.oid,'SELECT,INSERT,UPDATE,DELETE')
  OR has_table_privilege('anon',state_rel.oid,'SELECT,INSERT,UPDATE,DELETE')
  OR has_table_privilege('authenticated',state_rel.oid,'SELECT,INSERT,UPDATE,DELETE')
  OR has_table_privilege('service_role',state_rel.oid,'SELECT,INSERT,UPDATE,DELETE')
  OR (SELECT pg_get_constraintdef(oid,true) FROM pg_constraint
      WHERE conrelid='crm_security.command_receipts'::regclass
       AND conname='command_receipts_operation_check')
     IS DISTINCT FROM $expected$CHECK (operation = ANY (ARRAY['opportunity_work_set'::text, 'inquiry_assign'::text, 'service_change'::text, 'inquiry_unassign'::text, 'favorite_set'::text, 'opportunity_touch'::text]))$expected$
 THEN RAISE EXCEPTION 'personal-state targeted post-apply drift'; END IF;
END $target_post_guard$;
LOCK TABLE crm_security.command_receipts,crm_security.user_opportunity_state IN ACCESS EXCLUSIVE MODE;
CREATE SCHEMA crm_personal_state_archive AUTHORIZATION postgres;
REVOKE ALL ON SCHEMA crm_personal_state_archive FROM PUBLIC,anon,authenticated,service_role;
CREATE TABLE crm_personal_state_archive.command_receipts AS
 SELECT * FROM crm_security.command_receipts
 WHERE operation IN ('favorite_set','opportunity_touch');
REVOKE ALL ON crm_personal_state_archive.command_receipts
 FROM PUBLIC,anon,authenticated,service_role;
DELETE FROM crm_security.command_receipts
 WHERE operation IN ('favorite_set','opportunity_touch');
CREATE OR REPLACE FUNCTION public.crm_read_scoped_v2(p_after uuid DEFAULT NULL::uuid, p_limit integer DEFAULT 100, p_deal_id uuid DEFAULT NULL::uuid, p_inquiry_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM crm_security.actor()) OR (p_deal_id IS NOT NULL AND NOT crm_security.can_deal(p_deal_id,false))
 OR (p_inquiry_id IS NOT NULL AND NOT crm_security.can_inquiry(p_inquiry_id))
 THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;
 IF p_limit IS NULL OR p_limit<1 OR p_limit>100 THEN RAISE EXCEPTION 'invalid limit' USING ERRCODE='22023'; END IF;
 RETURN jsonb_build_object('contract_version',2,
 'deals',coalesce((SELECT jsonb_agg(to_jsonb(q) ORDER BY q.id) FROM(
 SELECT d.id,d.site_id,d.owner_id,d.stage_code,d.brand,d.primary_work,d.work_items,d.work_scope_type,d.work_summary,d.version
 FROM public.deals d WHERE crm_security.can_deal(d.id,false) AND (p_after IS NULL OR d.id>p_after)
 AND (p_deal_id IS NULL OR d.id=p_deal_id) ORDER BY d.id LIMIT p_limit) q),'[]'::jsonb),
 'inquiries',coalesce((SELECT jsonb_agg(to_jsonb(q) ORDER BY q.id) FROM(
 SELECT i.id,i.sheet_row,i.sheet_row AS "row",i.brand,i.site_name,i.site_name AS site,i.address,
  i.contact_name,i.contact_name AS contact,i.phone,coalesce(u.name,i.assignee_name) AS assignee_name,
  coalesce(u.name,i.assignee_name) AS assignee,i.assigned_to,i.status,i.deal_id,i.opportunity_id,
  i.received_at,i.created_at,coalesce(i.received_at,i.created_at) AS at,i.site_id,i.source_channel,i.channel,
  i.work_type,i.work_type AS work,i.assigned_at,i.first_response_at,i.responded_at,
  i.next_action_date,i.next_action_date AS due,
  jsonb_build_object(
   'customerType',i.raw->>'고객유형','buildingType',i.raw->>'건물유형',
   'address',coalesce(nullif(i.raw->>'건물주소',''),i.address),'complex',i.raw->>'단지개요',
   'workType',coalesce(nullif(i.raw->>'공사유형',''),i.work_type),'inquiry',i.raw->>'문의내용',
   'channel',coalesce(nullif(i.raw->>'상담채널',''),i.channel),
   'inflow',coalesce(nullif(i.raw->>'유입경로',''),i.source_channel),
   'office',i.raw->>'관리사무소','note',i.raw->>'특이사항',
   'assignComment',i.raw->>'배정 코멘트','closeReason',coalesce(nullif(i.raw->>'종료사유',''),i.close_reason)
  ) AS detail,coalesce(h.items,'[]'::jsonb) AS assignment_history
 FROM public.inquiries i
 LEFT JOIN public.users u ON u.user_id=i.assigned_to
 LEFT JOIN LATERAL (
  SELECT jsonb_agg(jsonb_build_object(
   'id',ah.id,'inquiry_id',ah.inquiry_id,'from_owner',ah.from_owner,'from',ah.from_owner,
   'to_owner',ah.to_owner,'to',ah.to_owner,'reason',ah.reason,
   'actor_name',ah.actor_name,'actor',ah.actor_name,'changed_by',ah.actor_name,
   'changed_at',ah.changed_at,'at',ah.changed_at
  ) ORDER BY ah.changed_at,ah.id) AS items
  FROM public.assignment_history ah WHERE ah.inquiry_id=i.id
 ) h ON true
 WHERE crm_security.can_inquiry(i.id)
 AND (p_after IS NULL OR i.id>p_after) AND (p_inquiry_id IS NULL OR i.id=p_inquiry_id)
 ORDER BY i.id LIMIT p_limit) q),'[]'::jsonb));
END $function$
;
DROP FUNCTION public.crm_write_command_v2(uuid,text,uuid,integer,jsonb) RESTRICT;
DROP FUNCTION crm_security.crm_user_opportunity_state_command_v2(uuid,text,uuid,integer,jsonb) RESTRICT;
ALTER FUNCTION crm_security.crm_write_command_v2_operational_20260906(uuid,text,uuid,integer,jsonb)
 RENAME TO crm_write_command_v2;
ALTER FUNCTION crm_security.crm_write_command_v2(uuid,text,uuid,integer,jsonb)
 SET SCHEMA public;
REVOKE EXECUTE ON FUNCTION public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)
 FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)
 TO authenticated;
ALTER TABLE crm_security.command_receipts
 DROP CONSTRAINT command_receipts_operation_check;
ALTER TABLE crm_security.command_receipts
 ADD CONSTRAINT command_receipts_operation_check
 CHECK(operation IN ('opportunity_work_set','inquiry_assign','service_change','inquiry_unassign'));
ALTER TABLE crm_security.user_opportunity_state
 SET SCHEMA crm_personal_state_archive;
REVOKE ALL ON crm_personal_state_archive.user_opportunity_state
 FROM PUBLIC,anon,authenticated,service_role;
DO $restored_guard$ DECLARE w record; r record; BEGIN
 SELECT * INTO w FROM pg_proc WHERE oid='public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)'::regprocedure;
 SELECT * INTO r FROM pg_proc WHERE oid='public.crm_read_scoped_v2(uuid,integer,uuid,uuid)'::regprocedure;
 IF w.oid<>18115 OR md5(pg_get_functiondef(w.oid))<>'04ad2b922c42ca79c6ec854f79c19583'
  OR r.oid<>18064 OR md5(pg_get_functiondef(r.oid))<>'d1cde3372f07295076fc62bf28d12a01'
  OR to_regprocedure('crm_security.crm_write_command_v2_operational_20260906(uuid,text,uuid,integer,jsonb)') IS NOT NULL
  OR to_regprocedure('crm_security.crm_user_opportunity_state_command_v2(uuid,text,uuid,integer,jsonb)') IS NOT NULL
  OR to_regclass('crm_personal_state_archive.user_opportunity_state') IS NULL
  OR (SELECT pg_get_constraintdef(oid,true) FROM pg_constraint
      WHERE conrelid='crm_security.command_receipts'::regclass
       AND conname='command_receipts_operation_check')
     IS DISTINCT FROM $expected$CHECK (operation = ANY (ARRAY['opportunity_work_set'::text, 'inquiry_assign'::text, 'service_change'::text, 'inquiry_unassign'::text]))$expected$
 THEN RAISE EXCEPTION 'personal-state targeted rollback verification drift'; END IF;
END $restored_guard$;
DO $reachable_bundle_rollback_post$ BEGIN
 IF to_regprocedure('public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)') IS NULL
  OR to_regprocedure('public.crm_read_scoped_v2(uuid,integer,uuid,uuid)') IS NULL
  OR to_regprocedure('public.crm_operational_source_v1(text,uuid,integer)') IS NOT NULL
  OR to_regprocedure('crm_security.crm_user_opportunity_state_command_v2(uuid,text,uuid,integer,jsonb)') IS NOT NULL
  OR to_regprocedure('crm_security.crm_pipeline_action_command_v1(uuid,text,uuid,integer,jsonb)') IS NOT NULL
  OR to_regprocedure('crm_security.crm_operational_source_fragment_v1(text,uuid,integer)') IS NOT NULL
  OR to_regprocedure('crm_security.crm_quote_version_command_v1(uuid,uuid,integer,jsonb)') IS NOT NULL
  OR to_regprocedure('crm_security.crm_next_action_complete_command_v1(uuid,uuid,integer,jsonb)') IS NOT NULL
  OR to_regprocedure('crm_security.crm_stage_check_command_v1(uuid,uuid,integer,jsonb)') IS NOT NULL
  OR to_regprocedure('crm_security.crm_deal_transition_command_v1(uuid,uuid,integer,jsonb)') IS NOT NULL
  OR to_regprocedure('crm_security.crm_deal_close_nonwon_command_v1(uuid,uuid,integer,jsonb)') IS NOT NULL
  OR to_regprocedure('crm_security.crm_deal_expected_amount_command_v1(uuid,uuid,integer,jsonb)') IS NOT NULL
  OR to_regprocedure('crm_security.crm_deal_waiting_context_command_v1(uuid,uuid,integer,jsonb)') IS NOT NULL
  OR to_regprocedure('crm_security.crm_inquiry_reclassify_command_v1(uuid,uuid,jsonb)') IS NOT NULL
  OR to_regprocedure('crm_security.crm_inquiry_hold_command_v1(uuid,uuid,jsonb)') IS NOT NULL
  OR to_regprocedure('crm_security.crm_inquiry_trash_command_v1(uuid,uuid,jsonb)') IS NOT NULL
  OR to_regprocedure('crm_security.crm_inquiry_restore_command_v1(uuid,uuid,jsonb)') IS NOT NULL
  OR to_regprocedure('crm_security.crm_inquiry_purge_command_v1(uuid,uuid,jsonb)') IS NOT NULL
  OR to_regprocedure('crm_security.crm_inquiry_followup_command_v1(uuid,uuid,jsonb)') IS NOT NULL
  OR to_regclass('crm_security.user_opportunity_state') IS NOT NULL
  OR to_regclass('crm_security.quote_versions') IS NOT NULL
  OR to_regclass('crm_security.stage_transition_events') IS NOT NULL
  OR to_regclass('crm_security.deal_close_events') IS NOT NULL
  OR to_regnamespace('crm_personal_state_archive') IS NULL
  OR to_regnamespace('crm_pipeline_action_archive') IS NULL
  OR to_regnamespace('crm_quote_version_archive') IS NULL
  OR to_regnamespace('crm_next_complete_archive') IS NULL
  OR to_regnamespace('crm_stage_check_archive') IS NULL
  OR to_regnamespace('crm_transition_archive') IS NULL
  OR to_regnamespace('crm_close_nonwon_archive') IS NULL
  OR to_regnamespace('crm_expected_amount_archive') IS NULL
  OR to_regnamespace('crm_waiting_context_archive') IS NULL
  OR to_regnamespace('crm_inquiry_reclassify_archive') IS NULL
  OR to_regnamespace('crm_inquiry_hold_archive') IS NULL
  OR to_regnamespace('crm_inquiry_trash_restore_archive') IS NULL
  OR to_regnamespace('crm_inquiry_followup_archive') IS NULL
  OR (SELECT pg_get_constraintdef(oid,true) FROM pg_constraint
      WHERE conrelid='crm_security.command_receipts'::regclass
       AND conname='command_receipts_operation_check')
     IS DISTINCT FROM $expected$CHECK (operation = ANY (ARRAY['opportunity_work_set'::text, 'inquiry_assign'::text, 'service_change'::text, 'inquiry_unassign'::text]))$expected$
 THEN RAISE EXCEPTION 'reachable operations cumulative rollback drift'; END IF;
END $reachable_bundle_rollback_post$;
COMMIT;
