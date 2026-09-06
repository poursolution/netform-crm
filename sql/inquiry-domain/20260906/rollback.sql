-- Local candidate rollback. Not approved for remote execution.
-- Preserves inquiry_unassign receipts/audits in a private archive and never reverts business rows.
SET crm.inquiry_domain_ref='rprechiaglyjaydkmxsu';
BEGIN;
SET LOCAL search_path=pg_catalog;
SET LOCAL lock_timeout='3s';
SET LOCAL statement_timeout='60s';

DO $guard$
DECLARE dispatcher text;
BEGIN
 IF current_user<>'postgres'
  OR current_setting('crm.inquiry_domain_ref',true) IS DISTINCT FROM 'rprechiaglyjaydkmxsu'
  OR to_regnamespace('crm_inquiry_unassign_archive') IS NOT NULL
  OR to_regprocedure('public.crm_inquiry_unassign_command_v1(uuid,uuid,jsonb)') IS NULL
 THEN RAISE EXCEPTION 'inquiry_unassign rollback preflight failed'; END IF;
 SELECT pg_get_functiondef('public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)'::regprocedure)
 INTO dispatcher;
 IF md5(dispatcher) IS DISTINCT FROM '0febf128445d3fe539d0d1f2bc63e3d7'
  OR (SELECT pg_get_constraintdef(oid,true) FROM pg_constraint
      WHERE conrelid='crm_security.command_receipts'::regclass
        AND conname='command_receipts_operation_check')
      IS DISTINCT FROM 'CHECK (operation = ANY (ARRAY[''opportunity_work_set''::text, ''inquiry_assign''::text, ''inquiry_unassign''::text]))'
  OR (SELECT pg_get_constraintdef(oid,true) FROM pg_constraint
      WHERE conrelid='crm_security.inquiry_audit_events'::regclass
        AND conname='inquiry_audit_events_action_check')
      IS DISTINCT FROM 'CHECK (action = ANY (ARRAY[''direct_assign''::text, ''direct_reassign''::text, ''inquiry_unassign''::text]))'
 THEN RAISE EXCEPTION 'inquiry_unassign rollback drift'; END IF;
END $guard$;

LOCK TABLE crm_security.command_receipts,crm_security.inquiry_audit_events
 IN ACCESS EXCLUSIVE MODE;

DO $archive$
BEGIN
 IF EXISTS(SELECT 1 FROM crm_security.command_receipts WHERE operation='inquiry_unassign')
  OR EXISTS(SELECT 1 FROM crm_security.inquiry_audit_events WHERE action='inquiry_unassign')
 THEN
  CREATE SCHEMA crm_inquiry_unassign_archive AUTHORIZATION postgres;
  REVOKE ALL ON SCHEMA crm_inquiry_unassign_archive
   FROM PUBLIC,anon,authenticated,service_role;

  CREATE TABLE crm_inquiry_unassign_archive.command_receipts AS
   SELECT * FROM crm_security.command_receipts WHERE operation='inquiry_unassign';
  CREATE TABLE crm_inquiry_unassign_archive.inquiry_audit_events AS
   SELECT * FROM crm_security.inquiry_audit_events WHERE action='inquiry_unassign';
  REVOKE ALL ON TABLE
   crm_inquiry_unassign_archive.command_receipts,
   crm_inquiry_unassign_archive.inquiry_audit_events
   FROM PUBLIC,anon,authenticated,service_role;

  DELETE FROM crm_security.command_receipts WHERE operation='inquiry_unassign';
  DELETE FROM crm_security.inquiry_audit_events WHERE action='inquiry_unassign';
 END IF;
END $archive$;

DROP FUNCTION public.crm_inquiry_unassign_command_v1(uuid,uuid,jsonb);

ALTER TABLE crm_security.command_receipts
 DROP CONSTRAINT command_receipts_operation_check;
ALTER TABLE crm_security.command_receipts
 ADD CONSTRAINT command_receipts_operation_check
 CHECK(operation IN ('opportunity_work_set','inquiry_assign'));

ALTER TABLE crm_security.inquiry_audit_events
 DROP CONSTRAINT inquiry_audit_events_action_check;
ALTER TABLE crm_security.inquiry_audit_events
 ADD CONSTRAINT inquiry_audit_events_action_check
 CHECK(action IN ('direct_assign','direct_reassign'));
COMMIT;
