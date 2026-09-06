-- STAGING ONLY. postgres-owned additive v2; never apply migration directory wholesale.
BEGIN;
SET LOCAL lock_timeout='3s'; SET LOCAL statement_timeout='60s'; SET LOCAL search_path=public,pg_catalog;
DO $guard$ BEGIN
 IF current_user<>'postgres' OR current_setting('crm.v2_staging_ref',true) IS DISTINCT FROM 'rprechiaglyjaydkmxsu'
 OR current_setting('crm.v2_approved',true) IS DISTINCT FROM 'yes' THEN RAISE EXCEPTION 'v2 staging approval required'; END IF;
 IF to_regnamespace('crm_security') IS NOT NULL OR to_regnamespace('crm_v2_archive') IS NOT NULL
 OR EXISTS(SELECT 1 FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname LIKE '%scoped_v2') THEN
 RAISE EXCEPTION 'Unexpected existing v2 object'; END IF;
END $guard$;
-- Global removal is necessary: IN SCHEMA alone cannot remove global PUBLIC defaults.
-- Only postgres is changed. Its other schema-specific grants remain unchanged.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC,anon,authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC,anon,authenticated;
CREATE FUNCTION public._crm_v2_acl_probe() RETURNS integer LANGUAGE sql SECURITY DEFINER SET search_path='' AS 'SELECT 1';
DO $probe$ BEGIN
 IF has_function_privilege('anon','public._crm_v2_acl_probe()','EXECUTE') OR has_function_privilege('authenticated','public._crm_v2_acl_probe()','EXECUTE')
 OR EXISTS(SELECT 1 FROM pg_proc p,LATERAL aclexplode(p.proacl) a WHERE p.oid='public._crm_v2_acl_probe()'::regprocedure AND a.grantee=0 AND a.privilege_type='EXECUTE')
 OR (SELECT pg_get_userbyid(proowner) FROM pg_proc WHERE oid='public._crm_v2_acl_probe()'::regprocedure)<>'postgres' THEN RAISE EXCEPTION 'postgres probe failed'; END IF;
 RAISE NOTICE 'POSTGRES_FUTURE_DEFAULT_PROBE_PASS';
END $probe$;
DROP FUNCTION public._crm_v2_acl_probe() RESTRICT;

CREATE SCHEMA crm_security AUTHORIZATION postgres;
REVOKE ALL ON SCHEMA crm_security FROM PUBLIC,anon,authenticated,service_role;
CREATE TABLE crm_security.access_review(
 user_id uuid PRIMARY KEY REFERENCES public.users(user_id), reviewed_auth_uid uuid NOT NULL UNIQUE,
 source_role text NOT NULL CHECK(source_role IN('rep','admin','dual','viewer')),
 permission_role text NOT NULL CHECK(permission_role IN('rep','consultation','branch','admin')),
 approved boolean NOT NULL DEFAULT false, reviewed_by text NOT NULL, reviewed_at timestamptz NOT NULL DEFAULT now(), expires_at timestamptz NOT NULL
);
CREATE TABLE crm_security.object_scope(
 scope_id uuid PRIMARY KEY, user_id uuid NOT NULL REFERENCES public.users(user_id),
 deal_id uuid REFERENCES public.deals(id), inquiry_id uuid REFERENCES public.inquiries(id),
 can_write boolean NOT NULL DEFAULT false, reviewed_by text NOT NULL, expires_at timestamptz NOT NULL,
 CHECK((deal_id IS NOT NULL)::int+(inquiry_id IS NOT NULL)::int=1)
);
CREATE UNIQUE INDEX crm_scope_deal ON crm_security.object_scope(user_id,deal_id) WHERE deal_id IS NOT NULL;
CREATE UNIQUE INDEX crm_scope_inquiry ON crm_security.object_scope(user_id,inquiry_id) WHERE inquiry_id IS NOT NULL;
CREATE TABLE crm_security.audit_events(
 event_id uuid PRIMARY KEY DEFAULT gen_random_uuid(), actor_auth_uid uuid NOT NULL, actor_user_id uuid NOT NULL,
 actor_name text NOT NULL, deal_id uuid NOT NULL, action text NOT NULL,
 before_data jsonb NOT NULL, after_data jsonb NOT NULL, reason text NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE crm_security.access_review ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_security.object_scope ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_security.audit_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE crm_security.access_review,crm_security.object_scope,crm_security.audit_events FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION crm_security.actor() RETURNS TABLE(user_id uuid,auth_uid uuid,display_name text,permission_role text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $fn$
 SELECT u.user_id,u.auth_uid,u.name,r.permission_role
 FROM public.users u JOIN crm_security.access_review r ON r.user_id=u.user_id
 WHERE auth.uid() IS NOT NULL AND u.auth_uid=auth.uid() AND u.active AND r.approved
 AND r.reviewed_auth_uid=u.auth_uid AND r.source_role=u.role AND r.expires_at>now()
 AND (SELECT count(*) FROM public.users x WHERE x.auth_uid=u.auth_uid)=1
$fn$;
REVOKE EXECUTE ON FUNCTION crm_security.actor() FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION crm_security.can_deal(target uuid,writing boolean DEFAULT false) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $fn$
 SELECT EXISTS(SELECT 1 FROM crm_security.actor() a JOIN public.deals d ON d.id=target
 WHERE (a.permission_role='rep' AND d.owner_id=a.user_id)
 OR (a.permission_role IN('branch','admin') AND EXISTS(SELECT 1 FROM crm_security.object_scope s
 WHERE s.user_id=a.user_id AND s.deal_id=d.id AND s.expires_at>now() AND (NOT writing OR s.can_write))))
$fn$;
REVOKE EXECUTE ON FUNCTION crm_security.can_deal(uuid,boolean) FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION crm_security.can_inquiry(target uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $fn$
 SELECT EXISTS(SELECT 1 FROM crm_security.actor() a JOIN public.inquiries i ON i.id=target
 WHERE (a.permission_role IN('rep','consultation') AND i.assigned_to=a.user_id)
 OR (a.permission_role IN('branch','admin') AND EXISTS(SELECT 1 FROM crm_security.object_scope s
 WHERE s.user_id=a.user_id AND s.inquiry_id=i.id AND s.expires_at>now())))
$fn$;
REVOKE EXECUTE ON FUNCTION crm_security.can_inquiry(uuid) FROM PUBLIC,anon,authenticated,service_role;

-- Invoker would require exposing private helper/table privileges while legacy RLS remains.
-- Narrow definer entrypoints retain the private schema boundary; all data is explicitly scoped.
CREATE FUNCTION public.crm_profile_scoped_v2() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $fn$
DECLARE a record; BEGIN
 SELECT * INTO a FROM crm_security.actor(); IF NOT FOUND THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;
 RETURN jsonb_build_object('contract_version',2,'user_id',a.user_id,'auth_uid',a.auth_uid,'name',a.display_name,'permission_role',a.permission_role);
END $fn$;
REVOKE EXECUTE ON FUNCTION public.crm_profile_scoped_v2() FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION public.crm_read_scoped_v2(p_after uuid DEFAULT NULL,p_limit integer DEFAULT 100,p_deal_id uuid DEFAULT NULL,p_inquiry_id uuid DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $fn$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM crm_security.actor()) OR (p_deal_id IS NOT NULL AND NOT crm_security.can_deal(p_deal_id,false))
 OR (p_inquiry_id IS NOT NULL AND NOT crm_security.can_inquiry(p_inquiry_id)) THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;
 IF p_limit IS NULL OR p_limit<1 OR p_limit>100 THEN RAISE EXCEPTION 'invalid limit' USING ERRCODE='22023'; END IF;
 RETURN jsonb_build_object('contract_version',2,
 'deals',coalesce((SELECT jsonb_agg(to_jsonb(q) ORDER BY q.id) FROM(
 SELECT d.id,d.site_id,d.owner_id,d.stage_code,d.brand,d.primary_work,d.work_items,d.version FROM public.deals d
 WHERE crm_security.can_deal(d.id,false) AND (p_after IS NULL OR d.id>p_after) AND (p_deal_id IS NULL OR d.id=p_deal_id) ORDER BY d.id LIMIT p_limit) q),'[]'::jsonb),
 'inquiries',coalesce((SELECT jsonb_agg(to_jsonb(q) ORDER BY q.id) FROM(
 SELECT i.id,i.assigned_to,i.site_name,i.status FROM public.inquiries i WHERE crm_security.can_inquiry(i.id)
 AND (p_after IS NULL OR i.id>p_after) AND (p_inquiry_id IS NULL OR i.id=p_inquiry_id) ORDER BY i.id LIMIT p_limit) q),'[]'::jsonb));
END $fn$;
REVOKE EXECUTE ON FUNCTION public.crm_read_scoped_v2(uuid,integer,uuid,uuid) FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION public.crm_contacts_scoped_v2(p_opportunity_id uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $fn$
BEGIN
 IF NOT crm_security.can_deal(p_opportunity_id,false) THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;
 RETURN coalesce((SELECT jsonb_agg(jsonb_build_object('id',c.id,'name',c.name,'phone',c.phone,'mobile',c.mobile))
 FROM public.deals d JOIN public.contacts c ON c.id=d.contact_id AND c.organization_id=d.organization_id WHERE d.id=p_opportunity_id),'[]'::jsonb);
END $fn$;
REVOKE EXECUTE ON FUNCTION public.crm_contacts_scoped_v2(uuid) FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION public.crm_work_set_scoped_v2(p_opportunity_id uuid,p_primary_work text,p_work_items jsonb,p_reason text,p_expected_version integer,p_actor_name text DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
DECLARE a record; oldrow public.deals%ROWTYPE; newrow public.deals%ROWTYPE; n integer; work_summary_value text; event uuid;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;
 -- Lock authorization rows against concurrent revocation/identity edits for this write.
 PERFORM 1 FROM public.users u WHERE u.auth_uid=auth.uid() FOR SHARE;
 PERFORM 1 FROM crm_security.access_review r WHERE r.reviewed_auth_uid=auth.uid() FOR SHARE;
 SELECT * INTO a FROM crm_security.actor();
 IF NOT FOUND THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;
 PERFORM 1 FROM crm_security.object_scope s WHERE s.user_id=a.user_id AND s.deal_id=p_opportunity_id FOR SHARE;
 IF NOT crm_security.can_deal(p_opportunity_id,true) THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;
 IF p_reason IS NULL OR length(trim(p_reason))<5 OR length(p_reason)>2000 OR p_work_items IS NULL OR jsonb_typeof(p_work_items)<>'array'
 OR p_expected_version IS NULL THEN RAISE EXCEPTION 'invalid work contract' USING ERRCODE='22023'; END IF;
 n:=jsonb_array_length(p_work_items);
 IF n<1 OR n>20 OR p_primary_work IS NULL OR length(trim(p_primary_work))<1 OR length(p_primary_work)>100 OR NOT(p_work_items ? p_primary_work)
 OR EXISTS(SELECT 1 FROM jsonb_array_elements(p_work_items) x WHERE jsonb_typeof(x)<>'string')
 OR EXISTS(SELECT 1 FROM jsonb_array_elements_text(p_work_items) x WHERE length(trim(x))<1 OR length(x)>100)
 OR (SELECT count(DISTINCT x) FROM jsonb_array_elements_text(p_work_items) x)<>n THEN RAISE EXCEPTION 'invalid work items' USING ERRCODE='22023'; END IF;
 SELECT * INTO oldrow FROM public.deals WHERE id=p_opportunity_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;
 IF oldrow.version<>p_expected_version THEN RAISE EXCEPTION 'version conflict' USING ERRCODE='40001'; END IF;
 IF (a.permission_role='rep' AND oldrow.owner_id IS DISTINCT FROM a.user_id) OR NOT crm_security.can_deal(p_opportunity_id,true)
 THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;
 SELECT string_agg(x,' / ' ORDER BY ord) INTO work_summary_value FROM jsonb_array_elements_text(p_work_items) WITH ORDINALITY t(x,ord);
 UPDATE public.deals SET primary_work=p_primary_work,work_items=p_work_items,work_scope_type=CASE WHEN n=1 THEN 'single' ELSE 'multi' END,
 work_summary=work_summary_value,version=version+1 WHERE id=p_opportunity_id RETURNING * INTO newrow;
 -- Client p_actor_name is deliberately ignored. No user_metadata/name/email authorization.
 INSERT INTO crm_security.audit_events(actor_auth_uid,actor_user_id,actor_name,deal_id,action,before_data,after_data,reason)
 VALUES(a.auth_uid,a.user_id,a.display_name,p_opportunity_id,'work_set',
 jsonb_build_object('primary_work',oldrow.primary_work,'work_items',oldrow.work_items,'work_scope_type',oldrow.work_scope_type,'work_summary',oldrow.work_summary,'version',oldrow.version,'updated_at',oldrow.updated_at),
 jsonb_build_object('primary_work',newrow.primary_work,'work_items',newrow.work_items,'work_scope_type',newrow.work_scope_type,'work_summary',newrow.work_summary,'version',newrow.version,'updated_at',newrow.updated_at),p_reason) RETURNING event_id INTO event;
 RETURN jsonb_build_object('id',newrow.id,'version',newrow.version,'audit_event_id',event);
END $fn$;
REVOKE EXECUTE ON FUNCTION public.crm_work_set_scoped_v2(uuid,text,jsonb,text,integer,text) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.crm_profile_scoped_v2(),public.crm_read_scoped_v2(uuid,integer,uuid,uuid),public.crm_contacts_scoped_v2(uuid),public.crm_work_set_scoped_v2(uuid,text,jsonb,text,integer,text) TO authenticated;
DO $verify$ DECLARE f record; BEGIN
 IF (SELECT pg_get_userbyid(nspowner) FROM pg_namespace WHERE nspname='crm_security')<>'postgres'
 OR EXISTS(SELECT 1 FROM pg_class WHERE relnamespace='crm_security'::regnamespace AND relowner<>'postgres'::regrole) THEN RAISE EXCEPTION 'Unexpected v2 owner'; END IF;
 FOR f IN SELECT p.*,n.nspname FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='crm_security' OR (n.nspname='public' AND p.proname LIKE '%scoped_v2') LOOP
 IF f.proowner<>'postgres'::regrole OR f.proconfig IS DISTINCT FROM ARRAY['search_path=""'] OR NOT f.prosecdef
 OR has_function_privilege('anon',f.oid,'EXECUTE') OR has_function_privilege('service_role',f.oid,'EXECUTE')
 OR has_function_privilege('authenticated',f.oid,'EXECUTE') IS DISTINCT FROM (f.nspname='public')
 OR EXISTS(SELECT 1 FROM aclexplode(f.proacl) a WHERE a.grantee=0 AND a.privilege_type='EXECUTE') THEN RAISE EXCEPTION 'v2 ACL/owner/config failed: %',f.proname; END IF;
 END LOOP;
 IF has_schema_privilege('anon','crm_security','USAGE') OR has_schema_privilege('authenticated','crm_security','USAGE')
 OR EXISTS(SELECT 1 FROM pg_class c WHERE c.relnamespace='crm_security'::regnamespace AND c.relkind='r' AND
 (NOT c.relrowsecurity OR has_table_privilege('anon',c.oid,'SELECT,INSERT,UPDATE,DELETE') OR has_table_privilege('authenticated',c.oid,'SELECT,INSERT,UPDATE,DELETE'))) THEN RAISE EXCEPTION 'Private ledger exposed'; END IF;
END $verify$;
COMMIT;
