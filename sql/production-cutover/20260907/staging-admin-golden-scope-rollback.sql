-- Roll back only the approved Golden manager visibility change.
BEGIN;
SET LOCAL search_path=pg_catalog;
SET LOCAL lock_timeout='3s';
SET LOCAL statement_timeout='60s';

CREATE OR REPLACE FUNCTION crm_security.can_deal(target uuid, writing boolean DEFAULT false)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO ''
AS $fn$
 SELECT EXISTS(SELECT 1 FROM crm_security.actor() a JOIN public.deals d ON d.id=target
 WHERE (a.permission_role='rep' AND d.owner_id=a.user_id)
 OR (a.permission_role IN('branch','admin') AND EXISTS(SELECT 1 FROM crm_security.object_scope s
 WHERE s.user_id=a.user_id AND s.deal_id=d.id AND s.expires_at>now() AND (NOT writing OR s.can_write))))
$fn$;

CREATE OR REPLACE FUNCTION crm_security.can_inquiry(target uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO ''
AS $fn$
 SELECT EXISTS(SELECT 1 FROM crm_security.actor() a JOIN public.inquiries i ON i.id=target
 WHERE (a.permission_role IN('rep','consultation') AND i.assigned_to=a.user_id)
 OR (a.permission_role IN('branch','admin') AND EXISTS(SELECT 1 FROM crm_security.object_scope s
 WHERE s.user_id=a.user_id AND s.inquiry_id=i.id AND s.expires_at>now())))
$fn$;

REVOKE ALL ON FUNCTION crm_security.can_deal(uuid,boolean) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION crm_security.can_inquiry(uuid) FROM PUBLIC,anon,authenticated,service_role;
COMMIT;
