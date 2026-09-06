-- LOCAL CANDIDATE ONLY. Rollback is allowed only before runtime inquiry promotion/link evidence exists.
SET LOCAL crm.inquiry_pipeline_ref='rprechiaglyjaydkmxsu';
SET LOCAL search_path=pg_catalog;
SET LOCAL lock_timeout='3s';
SET LOCAL statement_timeout='60s';
DO $guard$ BEGIN
 IF current_setting('crm.inquiry_pipeline_ref',true) IS DISTINCT FROM 'rprechiaglyjaydkmxsu'
  OR to_regprocedure('public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)') IS NULL
  OR to_regprocedure('crm_security.crm_write_command_v2_inquiry_response_20260906(uuid,text,uuid,integer,jsonb)') IS NULL
  OR to_regprocedure('crm_security.crm_inquiry_pipeline_promote_command_v1(uuid,text,uuid,integer,jsonb)') IS NULL
  OR to_regprocedure('crm_security.crm_inquiry_lineage_link_command_v1(uuid,uuid,integer,jsonb)') IS NULL
  OR EXISTS(SELECT 1 FROM crm_security.command_receipts WHERE operation='lineage_link' OR payload->>'intent' IN ('inquiry_promote_create','inquiry_promote_existing'))
  OR EXISTS(SELECT 1 FROM crm_security.inquiry_audit_events WHERE action IN ('inquiry_pipeline_promote','inquiry_lineage_link'))
 THEN RAISE EXCEPTION 'inquiry pipeline rollback blocked: drift or runtime evidence exists'; END IF;
END $guard$;
DROP FUNCTION public.crm_write_command_v2(uuid,text,uuid,integer,jsonb);
ALTER FUNCTION crm_security.crm_write_command_v2_inquiry_response_20260906(uuid,text,uuid,integer,jsonb) SET SCHEMA public;
ALTER FUNCTION public.crm_write_command_v2_inquiry_response_20260906(uuid,text,uuid,integer,jsonb) RENAME TO crm_write_command_v2;
DROP FUNCTION crm_security.crm_inquiry_lineage_link_command_v1(uuid,uuid,integer,jsonb);
DROP FUNCTION crm_security.crm_inquiry_pipeline_promote_command_v1(uuid,text,uuid,integer,jsonb);
DROP FUNCTION crm_security.crm_inquiry_pipeline_reason_v1(text);
DROP FUNCTION crm_security.crm_inquiry_pipeline_stage_v1(text);
ALTER TABLE crm_security.command_receipts DROP CONSTRAINT command_receipts_operation_check;
ALTER TABLE crm_security.command_receipts ADD CONSTRAINT command_receipts_operation_check CHECK(operation IN (
 'opportunity_work_set','inquiry_assign','service_change','inquiry_unassign','favorite_set','opportunity_touch',
 'next_action','activity','quote_version','next_action_complete','stage_check','transition','close','amount',
 'waiting_context','inquiry_reclassify','inquiry_status','inquiry_trash','inquiry_restore','inquiry_purge',
 'inquiry_followup','opportunity_create'));
ALTER TABLE crm_security.inquiry_audit_events DROP CONSTRAINT inquiry_audit_events_action_check;
ALTER TABLE crm_security.inquiry_audit_events ADD CONSTRAINT inquiry_audit_events_action_check CHECK(action IN (
 'direct_assign','direct_reassign','inquiry_unassign','inquiry_reclassify','inquiry_hold','inquiry_trash',
 'inquiry_restore','inquiry_purge','inquiry_followup','inquiry_response_progress','inquiry_response_next_week_retry',
 'inquiry_response_missed_retry'));
REVOKE EXECUTE ON FUNCTION public.crm_write_command_v2(uuid,text,uuid,integer,jsonb) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.crm_write_command_v2(uuid,text,uuid,integer,jsonb) TO authenticated;
