-- Approved 2026-09-07: preserve Golden manager visibility for admin/dual.
-- Staging validation migration. Production is not targeted by this file.
BEGIN;
SET LOCAL search_path=pg_catalog;
SET LOCAL lock_timeout='3s';
SET LOCAL statement_timeout='60s';
SET LOCAL crm.cutover_ref='rprechiaglyjaydkmxsu';

DO $guard$
DECLARE d record; i record;
BEGIN
  SELECT * INTO d FROM pg_proc WHERE oid='crm_security.can_deal(uuid,boolean)'::regprocedure;
  SELECT * INTO i FROM pg_proc WHERE oid='crm_security.can_inquiry(uuid)'::regprocedure;
  IF current_user <> 'postgres'
     OR current_setting('crm.cutover_ref', true) IS DISTINCT FROM 'rprechiaglyjaydkmxsu'
     OR md5(pg_get_functiondef(d.oid)) IS DISTINCT FROM 'efdf75e2004fb4d7248b43eb06adcaeb'
     OR md5(pg_get_functiondef(i.oid)) IS DISTINCT FROM 'fafccdcdebca339fc7ab965574ed9d09'
     OR pg_get_userbyid(d.proowner) <> 'postgres' OR NOT d.prosecdef
     OR pg_get_userbyid(i.proowner) <> 'postgres' OR NOT i.prosecdef
     OR d.proconfig IS DISTINCT FROM ARRAY['search_path=""']
     OR i.proconfig IS DISTINCT FROM ARRAY['search_path=""']
     OR coalesce(d.proacl::text,'') <> '{postgres=X/postgres}'
     OR coalesce(i.proacl::text,'') <> '{postgres=X/postgres}'
  THEN RAISE EXCEPTION 'staging admin scope target/catalog drift'; END IF;
END $guard$;

CREATE OR REPLACE FUNCTION crm_security.can_deal(target uuid, writing boolean DEFAULT false)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO ''
AS $fn$
 SELECT EXISTS(
  SELECT 1
  FROM crm_security.actor() a
  JOIN public.deals d ON d.id=target
  WHERE a.permission_role='admin'
     OR (a.permission_role='rep' AND d.owner_id=a.user_id)
     OR (a.permission_role='branch' AND EXISTS(
       SELECT 1 FROM crm_security.object_scope s
       WHERE s.user_id=a.user_id AND s.deal_id=d.id AND s.expires_at>now()
         AND (NOT writing OR s.can_write)
     ))
 )
$fn$;

CREATE OR REPLACE FUNCTION crm_security.can_inquiry(target uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO ''
AS $fn$
 SELECT EXISTS(
  SELECT 1
  FROM crm_security.actor() a
  JOIN public.inquiries i ON i.id=target
  WHERE a.permission_role='admin'
     OR (a.permission_role IN('rep','consultation') AND i.assigned_to=a.user_id)
     OR (a.permission_role='branch' AND EXISTS(
       SELECT 1 FROM crm_security.object_scope s
       WHERE s.user_id=a.user_id AND s.inquiry_id=i.id AND s.expires_at>now()
     ))
 )
$fn$;

REVOKE ALL ON FUNCTION crm_security.can_deal(uuid,boolean) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION crm_security.can_inquiry(uuid) FROM PUBLIC,anon,authenticated,service_role;

COMMIT;
