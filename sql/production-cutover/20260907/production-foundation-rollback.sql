-- Immediate rollback for the foundation only. Refuses once later cutover objects or audit rows exist.
BEGIN;
SET LOCAL search_path=pg_catalog;
SET LOCAL lock_timeout='3s';
SET LOCAL statement_timeout='60s';
DO $guard$
BEGIN
 IF to_regnamespace('crm_security') IS NULL
    OR to_regclass('crm_security.command_receipts') IS NOT NULL
    OR EXISTS(SELECT 1 FROM crm_security.audit_events)
    OR EXISTS(SELECT 1 FROM crm_security.object_scope)
    OR (SELECT count(*) FROM crm_security.access_review)<>8
 THEN RAISE EXCEPTION 'foundation rollback runtime boundary exceeded'; END IF;
END $guard$;
DROP FUNCTION public.crm_work_set_scoped_v2(uuid,text,jsonb,text,integer,text) RESTRICT;
DROP FUNCTION public.crm_contacts_scoped_v2(uuid) RESTRICT;
DROP FUNCTION public.crm_read_scoped_v2(uuid,integer,uuid,uuid) RESTRICT;
DROP FUNCTION public.crm_profile_scoped_v2() RESTRICT;
DROP FUNCTION crm_security.can_inquiry(uuid) RESTRICT;
DROP FUNCTION crm_security.can_deal(uuid,boolean) RESTRICT;
DROP FUNCTION crm_security.actor() RESTRICT;
DROP TABLE crm_security.audit_events RESTRICT;
DROP TABLE crm_security.object_scope RESTRICT;
DROP TABLE crm_security.access_review RESTRICT;
DROP SCHEMA crm_security RESTRICT;
COMMIT;
