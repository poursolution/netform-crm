-- REVIEW ONLY. Additive v2 phase BEFORE legacy cutover (v2-first revision).
-- No production/staging execution authorized. No legacy identity backfill.
BEGIN;
SET LOCAL lock_timeout='3s';
SET LOCAL statement_timeout='30s';
DO $guard$
BEGIN
 IF current_setting('crm.reviewed_staging_ref',true) IS DISTINCT FROM 'rprechiaglyjaydkmxsu'
    OR current_setting('crm.uuid_contract_approved',true) IS DISTINCT FROM 'yes' THEN
   RAISE EXCEPTION 'REVIEW ONLY: UUID role/scope contract requires separate approval';
 END IF;
 IF current_user<>'postgres' THEN RAISE EXCEPTION 'Unexpected owner'; END IF;
 IF current_setting('crm.isolated_synthetic_staging',true) IS DISTINCT FROM 'yes' THEN
   RAISE EXCEPTION 'Isolated synthetic-only staging required; never production';
 END IF;
END
$guard$;

-- This is an approval ledger referencing the EXISTING users PK, not a new
-- identity system. No rows are populated automatically from names or emails.
CREATE SCHEMA IF NOT EXISTS crm_security;
REVOKE ALL ON SCHEMA crm_security FROM PUBLIC,anon,authenticated,service_role;
CREATE TABLE IF NOT EXISTS crm_security.access_review (
 user_id uuid PRIMARY KEY REFERENCES public.users(user_id),
 reviewed_auth_uid uuid NOT NULL,
 source_role text NOT NULL CHECK(source_role IN ('rep','admin','dual','viewer')),
 permission_role text NOT NULL CHECK(permission_role IN ('rep','consultation','branch','manager','admin')),
 approved boolean NOT NULL DEFAULT false,
 reviewed_by uuid NOT NULL,
 reviewed_at timestamptz NOT NULL DEFAULT now(),
 expires_at timestamptz NOT NULL
);
CREATE TABLE IF NOT EXISTS crm_security.object_scope (
 scope_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id uuid NOT NULL REFERENCES public.users(user_id),
 deal_id uuid REFERENCES public.deals(id),
 inquiry_id uuid REFERENCES public.inquiries(id),
 can_write boolean NOT NULL DEFAULT false,
 reviewed_by uuid NOT NULL,
 expires_at timestamptz NOT NULL,
 CHECK ((deal_id IS NOT NULL)::int+(inquiry_id IS NOT NULL)::int=1)
);
CREATE INDEX IF NOT EXISTS crm_scope_deal ON crm_security.object_scope(user_id,deal_id);
CREATE INDEX IF NOT EXISTS crm_scope_inquiry ON crm_security.object_scope(user_id,inquiry_id);
ALTER TABLE crm_security.access_review ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_security.object_scope ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ALL TABLES IN SCHEMA crm_security FROM PUBLIC,anon,authenticated,service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA crm_security REVOKE ALL ON TABLES FROM PUBLIC,anon,authenticated,service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA crm_security REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC,anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION crm_security.actor()
RETURNS TABLE(user_id uuid,auth_uid uuid,display_name text,permission_role text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=''
AS $fn$
 SELECT u.user_id,u.auth_uid,u.name,r.permission_role
 FROM public.users u JOIN crm_security.access_review r ON r.user_id=u.user_id
 WHERE u.auth_uid=(SELECT auth.uid()) AND u.active
   AND r.approved AND r.expires_at>now() AND r.reviewed_auth_uid=u.auth_uid AND r.source_role=u.role
   AND (SELECT count(*) FROM public.users x WHERE x.auth_uid=u.auth_uid)=1
$fn$;

CREATE OR REPLACE FUNCTION crm_security.can_deal(target uuid,writing boolean DEFAULT false)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=''
AS $fn$
 SELECT EXISTS(SELECT 1 FROM crm_security.actor() a JOIN public.deals d ON d.id=target
 WHERE (a.permission_role='rep' AND d.owner_id=a.user_id)
 OR (a.permission_role IN ('branch','manager','admin') AND EXISTS (
   SELECT 1 FROM crm_security.object_scope s WHERE s.user_id=a.user_id AND s.deal_id=d.id
     AND s.expires_at>now() AND (NOT writing OR s.can_write))))
$fn$;
CREATE OR REPLACE FUNCTION crm_security.can_inquiry(target uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=''
AS $fn$
 SELECT EXISTS(SELECT 1 FROM crm_security.actor() a JOIN public.inquiries i ON i.id=target
 WHERE (a.permission_role IN ('rep','consultation') AND i.assigned_to=a.user_id)
 OR (a.permission_role IN ('branch','manager','admin') AND EXISTS (
   SELECT 1 FROM crm_security.object_scope s WHERE s.user_id=a.user_id AND s.inquiry_id=i.id AND s.expires_at>now())))
$fn$;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA crm_security FROM PUBLIC,anon,authenticated,service_role;

-- Additive phase: do not change any legacy table grant, RLS or policy here.
-- Scoped public RPCs check UUID predicates internally. Direct RLS policy changes
-- belong to the final cutover AFTER browser compatibility evidence is approved.

CREATE OR REPLACE FUNCTION public.crm_profile_scoped_v2()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=''
AS $fn$
DECLARE a record;
BEGIN
 SELECT * INTO a FROM crm_security.actor();
 IF NOT FOUND THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;
 RETURN jsonb_build_object('contract_version',2,'auth_uid',a.auth_uid,'user_id',a.user_id,
   'name',a.display_name,'permission_role',a.permission_role,'active',true);
END
$fn$;

CREATE OR REPLACE FUNCTION public.crm_read_scoped_v2(p_after uuid DEFAULT NULL,p_limit integer DEFAULT 100)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=''
AS $fn$
DECLARE a record; result jsonb;
BEGIN
 SELECT * INTO a FROM crm_security.actor();
 IF NOT FOUND THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;
 IF p_limit IS NULL OR p_limit<1 OR p_limit>100 THEN RAISE EXCEPTION 'invalid limit'; END IF;
 SELECT jsonb_build_object(
   'actor',jsonb_build_object('user_id',a.user_id,'name',a.display_name,'role',a.permission_role),
   'deals',coalesce((SELECT jsonb_agg(to_jsonb(q) ORDER BY q.id) FROM (
     SELECT d.id,d.owner_id,d.stage_code,d.brand,d.primary_work,d.work_items,d.version
     FROM public.deals d WHERE crm_security.can_deal(d.id,false) AND (p_after IS NULL OR d.id>p_after)
     ORDER BY d.id LIMIT p_limit) q),'[]'::jsonb),
   'inquiries',coalesce((SELECT jsonb_agg(to_jsonb(q) ORDER BY q.id) FROM (
     SELECT i.id,i.assigned_to,i.site_name,i.status,i.received_at
     FROM public.inquiries i WHERE crm_security.can_inquiry(i.id) AND (p_after IS NULL OR i.id>p_after)
     ORDER BY i.id LIMIT p_limit) q),'[]'::jsonb)) INTO result;
 RETURN result;
END
$fn$;

CREATE OR REPLACE FUNCTION public.crm_contacts_scoped_v2(p_opportunity_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=''
AS $fn$
BEGIN
 IF NOT crm_security.can_deal(p_opportunity_id,false) THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;
 -- Do not infer a contact grant merely from a shared organization. Until contact
 -- assignment integrity is reviewed, only the Deal's explicit contact_id is used.
 -- No person_key/current_site/assignment history is returned across opportunities.
 RETURN coalesce((SELECT jsonb_agg(jsonb_build_object('id',c.id,'name',c.name,'title',c.title,'phone',c.phone,'mobile',c.mobile))
   FROM public.deals d JOIN public.contacts c ON c.id=d.contact_id AND c.organization_id=d.organization_id
   WHERE d.id=p_opportunity_id),'[]'::jsonb);
END
$fn$;

-- actor_id has a users.user_id FK: never put Auth UUID in that column.
-- Historical actor identity stays unknown; no retrospective name-based backfill.
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS actor_auth_uid uuid;
CREATE OR REPLACE FUNCTION public.crm_work_set_scoped_v2(
 p_opportunity_id uuid,p_primary_work text,p_work_items jsonb,p_reason text,p_expected_version integer)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $fn$
DECLARE a record; oldrow public.deals%ROWTYPE; newrow public.deals%ROWTYPE; n integer; summary text;
BEGIN
 SELECT * INTO a FROM crm_security.actor();
 IF NOT FOUND OR NOT crm_security.can_deal(p_opportunity_id,true) THEN
   RAISE EXCEPTION 'forbidden' USING ERRCODE='42501';
 END IF;
 IF p_reason IS NULL OR length(trim(p_reason))<5 OR length(p_reason)>2000 OR
    p_work_items IS NULL OR jsonb_typeof(p_work_items)<>'array' OR p_expected_version IS NULL THEN
   RAISE EXCEPTION 'invalid work contract';
 END IF;
 n:=jsonb_array_length(p_work_items);
 IF n<1 OR n>20 OR p_primary_work IS NULL OR length(p_primary_work)>100 OR NOT(p_work_items ? p_primary_work)
    OR EXISTS(SELECT 1 FROM jsonb_array_elements(p_work_items) x WHERE jsonb_typeof(x)<>'string')
    OR EXISTS(SELECT 1 FROM jsonb_array_elements_text(p_work_items) x WHERE length(trim(x))<1 OR length(x)>100)
    OR (SELECT count(DISTINCT x) FROM jsonb_array_elements_text(p_work_items) x)<>n THEN
   RAISE EXCEPTION 'invalid work items';
 END IF;
 SELECT * INTO oldrow FROM public.deals WHERE id=p_opportunity_id FOR UPDATE;
 IF NOT FOUND OR oldrow.version<>p_expected_version THEN RAISE EXCEPTION 'version conflict' USING ERRCODE='40001'; END IF;
 -- Recheck after locking the target: owner changes must not bypass the predicate.
 IF (a.permission_role='rep' AND oldrow.owner_id IS DISTINCT FROM a.user_id)
    OR NOT crm_security.can_deal(p_opportunity_id,true) THEN
   RAISE EXCEPTION 'forbidden' USING ERRCODE='42501';
 END IF;
 SELECT string_agg(x,' / ' ORDER BY ord) INTO summary FROM jsonb_array_elements_text(p_work_items) WITH ORDINALITY t(x,ord);
 UPDATE public.deals SET primary_work=p_primary_work,work_items=p_work_items,
   work_scope_type=CASE WHEN n=1 THEN 'single' ELSE 'multi' END,work_summary=summary,version=version+1
 WHERE id=p_opportunity_id RETURNING * INTO newrow;
 INSERT INTO public.audit_logs(actor_id,actor_auth_uid,actor_name,entity_type,entity_id,action,"before","after")
 VALUES(a.user_id,a.auth_uid,a.display_name,'deal',p_opportunity_id,'work_set',
   jsonb_build_object('primary_work',oldrow.primary_work,'work_items',oldrow.work_items,'version',oldrow.version),
   jsonb_build_object('primary_work',newrow.primary_work,'work_items',newrow.work_items,'version',newrow.version,'reason',p_reason));
 INSERT INTO public.activities(deal_id,organization_id,actor_name,type,detail)
 VALUES(newrow.id,newrow.organization_id,a.display_name,'work_set',
   jsonb_build_object('actor_auth_uid',a.auth_uid,'actor_user_id',a.user_id,'reason',p_reason));
 RETURN jsonb_build_object('id',newrow.id,'version',newrow.version);
END
$fn$;

REVOKE ALL ON FUNCTION public.crm_profile_scoped_v2() FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.crm_read_scoped_v2(uuid,integer) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.crm_contacts_scoped_v2(uuid) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.crm_work_set_scoped_v2(uuid,text,jsonb,text,integer) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.crm_profile_scoped_v2(),public.crm_read_scoped_v2(uuid,integer),public.crm_contacts_scoped_v2(uuid),
 public.crm_work_set_scoped_v2(uuid,text,jsonb,text,integer) TO authenticated;
DO $verify$
DECLARE f text;
BEGIN
 FOREACH f IN ARRAY ARRAY['public.crm_profile_scoped_v2()','public.crm_read_scoped_v2(uuid,integer)','public.crm_contacts_scoped_v2(uuid)',
 'public.crm_work_set_scoped_v2(uuid,text,jsonb,text,integer)'] LOOP
   IF has_function_privilege('anon',f,'EXECUTE') OR NOT has_function_privilege('authenticated',f,'EXECUTE') THEN
     RAISE EXCEPTION 'Scoped RPC ACL verification failed';
   END IF;
 END LOOP;
 IF has_table_privilege('authenticated','crm_security.access_review','SELECT,INSERT,UPDATE,DELETE') OR
    has_table_privilege('authenticated','crm_security.object_scope','SELECT,INSERT,UPDATE,DELETE') THEN
   RAISE EXCEPTION 'Review ledger exposed';
 END IF;
END
$verify$;
COMMIT;

-- No review/grant rows, test accounts or CRM seed are created by this migration.
-- No purge, reassignment, Export, signed URL or today_tasks replacement is exposed.
