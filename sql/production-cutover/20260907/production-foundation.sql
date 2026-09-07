-- Production foundation approved 2026-09-07.
-- Target: ymfbmpnizxvqsamnczow. Additive only; no legacy table rows are changed.
BEGIN;
SET LOCAL search_path=pg_catalog;
SET LOCAL lock_timeout='3s';
SET LOCAL statement_timeout='120s';
SET LOCAL crm.cutover_ref='ymfbmpnizxvqsamnczow';

DO $guard$
DECLARE matched integer; null_auth integer; duplicate_auth integer; unmatched_auth integer;
BEGIN
 IF current_user<>'postgres'
    OR current_setting('crm.cutover_ref',true) IS DISTINCT FROM 'ymfbmpnizxvqsamnczow'
    OR to_regnamespace('crm_security') IS NOT NULL
    OR to_regnamespace('crm_v2_archive') IS NOT NULL
    OR to_regprocedure('public.crm_profile_scoped_v2()') IS NOT NULL
    OR to_regprocedure('public.crm_read_scoped_v2(uuid,integer,uuid,uuid)') IS NOT NULL
    OR to_regprocedure('public.crm_contacts_scoped_v2(uuid)') IS NOT NULL
    OR to_regprocedure('public.crm_work_set_scoped_v2(uuid,text,jsonb,text,integer,text)') IS NOT NULL
 THEN RAISE EXCEPTION 'production foundation target/catalog drift'; END IF;
 IF to_regclass('public.users') IS NULL OR to_regclass('public.deals') IS NULL
    OR to_regclass('public.inquiries') IS NULL OR to_regclass('public.contacts') IS NULL
 THEN RAISE EXCEPTION 'production foundation baseline missing'; END IF;
 IF (SELECT count(*) FROM public.users)<>12
    OR (SELECT count(*) FROM public.users WHERE active)<>12
    OR (SELECT count(*) FROM public.users WHERE role='rep')<>8
    OR (SELECT count(*) FROM public.users WHERE role='dual')<>2
    OR (SELECT count(*) FROM public.users WHERE role='admin')<>1
    OR (SELECT count(*) FROM public.users WHERE role='viewer')<>1
 THEN RAISE EXCEPTION 'production user-role inventory drift'; END IF;
 SELECT count(*) INTO matched FROM public.users u JOIN auth.users a ON a.id=u.auth_uid;
 SELECT count(*) INTO null_auth FROM public.users WHERE auth_uid IS NULL;
 SELECT count(*) INTO duplicate_auth FROM (SELECT auth_uid FROM public.users WHERE auth_uid IS NOT NULL GROUP BY auth_uid HAVING count(*)>1) x;
 SELECT count(*) INTO unmatched_auth FROM public.users u LEFT JOIN auth.users a ON a.id=u.auth_uid WHERE u.auth_uid IS NOT NULL AND a.id IS NULL;
 IF matched<>8 OR null_auth<>4 OR duplicate_auth<>0 OR unmatched_auth<>0
 THEN RAISE EXCEPTION 'production Auth/CRM UUID inventory drift'; END IF;
 IF EXISTS(
   SELECT 1 FROM public.users
   WHERE auth_uid IS NOT NULL AND active AND role NOT IN('rep','admin','dual')
 ) THEN RAISE EXCEPTION 'unreviewed authenticated role mapping'; END IF;
END $guard$;

CREATE SCHEMA crm_security AUTHORIZATION postgres;
REVOKE ALL ON SCHEMA crm_security FROM PUBLIC,anon,authenticated,service_role;

CREATE TABLE crm_security.access_review(
 user_id uuid PRIMARY KEY REFERENCES public.users(user_id),
 reviewed_auth_uid uuid NOT NULL UNIQUE,
 source_role text NOT NULL CHECK(source_role IN('rep','admin','dual','viewer')),
 permission_role text NOT NULL CHECK(permission_role IN('rep','consultation','branch','admin')),
 approved boolean NOT NULL DEFAULT false,
 reviewed_by text NOT NULL,
 reviewed_at timestamptz NOT NULL DEFAULT now(),
 expires_at timestamptz NOT NULL
);
CREATE TABLE crm_security.object_scope(
 scope_id uuid PRIMARY KEY,
 user_id uuid NOT NULL REFERENCES public.users(user_id),
 deal_id uuid REFERENCES public.deals(id),
 inquiry_id uuid REFERENCES public.inquiries(id),
 can_write boolean NOT NULL DEFAULT false,
 reviewed_by text NOT NULL,
 expires_at timestamptz NOT NULL,
 CHECK((deal_id IS NOT NULL)::int+(inquiry_id IS NOT NULL)::int=1)
);
CREATE UNIQUE INDEX crm_scope_deal ON crm_security.object_scope(user_id,deal_id) WHERE deal_id IS NOT NULL;
CREATE UNIQUE INDEX crm_scope_inquiry ON crm_security.object_scope(user_id,inquiry_id) WHERE inquiry_id IS NOT NULL;
CREATE TABLE crm_security.audit_events(
 event_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 actor_auth_uid uuid NOT NULL,
 actor_user_id uuid NOT NULL,
 actor_name text NOT NULL,
 deal_id uuid NOT NULL,
 action text NOT NULL,
 before_data jsonb NOT NULL,
 after_data jsonb NOT NULL,
 reason text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE crm_security.access_review ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_security.object_scope ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_security.audit_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE crm_security.access_review,crm_security.object_scope,crm_security.audit_events FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION crm_security.actor()
RETURNS TABLE(user_id uuid,auth_uid uuid,display_name text,permission_role text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=''
AS $fn$
 SELECT u.user_id,u.auth_uid,u.name,r.permission_role
 FROM public.users u JOIN crm_security.access_review r ON r.user_id=u.user_id
 WHERE auth.uid() IS NOT NULL AND u.auth_uid=auth.uid() AND u.active AND r.approved
   AND r.reviewed_auth_uid=u.auth_uid AND r.source_role=u.role AND r.expires_at>now()
   AND (SELECT count(*) FROM public.users x WHERE x.auth_uid=u.auth_uid)=1
$fn$;
REVOKE EXECUTE ON FUNCTION crm_security.actor() FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION crm_security.can_deal(target uuid,writing boolean DEFAULT false)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=''
AS $fn$
 SELECT EXISTS(
  SELECT 1 FROM crm_security.actor() a JOIN public.deals d ON d.id=target
  WHERE a.permission_role='admin'
     OR (a.permission_role='rep' AND d.owner_id=a.user_id)
     OR (a.permission_role='branch' AND EXISTS(
       SELECT 1 FROM crm_security.object_scope s
       WHERE s.user_id=a.user_id AND s.deal_id=d.id AND s.expires_at>now()
         AND (NOT writing OR s.can_write)
     ))
 )
$fn$;
REVOKE EXECUTE ON FUNCTION crm_security.can_deal(uuid,boolean) FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION crm_security.can_inquiry(target uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=''
AS $fn$
 SELECT EXISTS(
  SELECT 1 FROM crm_security.actor() a JOIN public.inquiries i ON i.id=target
  WHERE a.permission_role='admin'
     OR (a.permission_role IN('rep','consultation') AND i.assigned_to=a.user_id)
     OR (a.permission_role='branch' AND EXISTS(
       SELECT 1 FROM crm_security.object_scope s
       WHERE s.user_id=a.user_id AND s.inquiry_id=i.id AND s.expires_at>now()
     ))
 )
$fn$;
REVOKE EXECUTE ON FUNCTION crm_security.can_inquiry(uuid) FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION public.crm_profile_scoped_v2() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=''
AS $fn$
DECLARE a record; sr text; modes jsonb;
BEGIN
 SELECT * INTO a FROM crm_security.actor();
 IF NOT FOUND THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;
 SELECT u.role INTO sr FROM public.users u WHERE u.user_id=a.user_id;
 IF sr NOT IN ('rep','admin','dual','viewer') OR a.permission_role NOT IN ('rep','consultation','branch','admin')
 THEN RAISE EXCEPTION 'unsupported role mapping' USING ERRCODE='42501'; END IF;
 modes:=CASE WHEN a.permission_role='admin' AND sr IN ('admin','dual') THEN '["rep","admin"]'::jsonb ELSE '["rep"]'::jsonb END;
 RETURN jsonb_build_object('contract_version',2,'user_id',a.user_id,'auth_uid',a.auth_uid,
  'name',a.display_name,'permission_role',a.permission_role,'source_role',sr,'allowed_modes',modes);
END $fn$;
REVOKE EXECUTE ON FUNCTION public.crm_profile_scoped_v2() FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION public.crm_read_scoped_v2(p_after uuid DEFAULT NULL,p_limit integer DEFAULT 100,p_deal_id uuid DEFAULT NULL,p_inquiry_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=''
AS $fn$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM crm_security.actor())
    OR (p_deal_id IS NOT NULL AND NOT crm_security.can_deal(p_deal_id,false))
    OR (p_inquiry_id IS NOT NULL AND NOT crm_security.can_inquiry(p_inquiry_id))
 THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;
 IF p_limit IS NULL OR p_limit<1 OR p_limit>100 THEN RAISE EXCEPTION 'invalid limit' USING ERRCODE='22023'; END IF;
 RETURN jsonb_build_object('contract_version',2,
  'deals',coalesce((SELECT jsonb_agg(to_jsonb(q) ORDER BY q.id) FROM(
    SELECT d.id,d.site_id,d.owner_id,d.stage_code,d.brand,d.primary_work,d.work_items,d.work_summary,d.version
    FROM public.deals d WHERE crm_security.can_deal(d.id,false)
      AND (p_after IS NULL OR d.id>p_after) AND (p_deal_id IS NULL OR d.id=p_deal_id)
    ORDER BY d.id LIMIT p_limit) q),'[]'::jsonb),
  'inquiries',coalesce((SELECT jsonb_agg(to_jsonb(q) ORDER BY q.id) FROM(
    SELECT i.id,i.assigned_to,i.site_name,i.status FROM public.inquiries i
    WHERE crm_security.can_inquiry(i.id) AND (p_after IS NULL OR i.id>p_after)
      AND (p_inquiry_id IS NULL OR i.id=p_inquiry_id)
    ORDER BY i.id LIMIT p_limit) q),'[]'::jsonb));
END $fn$;
REVOKE EXECUTE ON FUNCTION public.crm_read_scoped_v2(uuid,integer,uuid,uuid) FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION public.crm_contacts_scoped_v2(p_opportunity_id uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=''
AS $fn$
BEGIN
 IF NOT crm_security.can_deal(p_opportunity_id,false) THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;
 RETURN coalesce((SELECT jsonb_agg(jsonb_build_object('id',c.id,'name',c.name,'phone',c.phone,'mobile',c.mobile))
 FROM public.deals d JOIN public.contacts c ON c.id=d.contact_id AND c.organization_id=d.organization_id
 WHERE d.id=p_opportunity_id),'[]'::jsonb);
END $fn$;
REVOKE EXECUTE ON FUNCTION public.crm_contacts_scoped_v2(uuid) FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION public.crm_work_set_scoped_v2(p_opportunity_id uuid,p_primary_work text,p_work_items jsonb,p_reason text,p_expected_version integer,p_actor_name text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $fn$
DECLARE a record; oldrow public.deals%ROWTYPE; newrow public.deals%ROWTYPE; n integer; work_summary_value text; event uuid;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;
 PERFORM 1 FROM public.users u WHERE u.auth_uid=auth.uid() FOR SHARE;
 PERFORM 1 FROM crm_security.access_review r WHERE r.reviewed_auth_uid=auth.uid() FOR SHARE;
 SELECT * INTO a FROM crm_security.actor();
 IF NOT FOUND THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;
 SELECT * INTO oldrow FROM public.deals WHERE id=p_opportunity_id FOR UPDATE;
 IF NOT FOUND OR NOT crm_security.can_deal(p_opportunity_id,true) THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;
 IF p_reason IS NULL OR length(trim(p_reason))<5 OR length(p_reason)>2000 OR p_work_items IS NULL
    OR jsonb_typeof(p_work_items)<>'array' OR p_expected_version IS NULL
 THEN RAISE EXCEPTION 'invalid work contract' USING ERRCODE='22023'; END IF;
 n:=jsonb_array_length(p_work_items);
 IF n<1 OR n>20 OR p_primary_work IS NULL OR length(trim(p_primary_work))<1 OR length(p_primary_work)>100
    OR NOT(p_work_items ? p_primary_work)
    OR EXISTS(SELECT 1 FROM jsonb_array_elements(p_work_items) x WHERE jsonb_typeof(x)<>'string')
    OR EXISTS(SELECT 1 FROM jsonb_array_elements_text(p_work_items) x WHERE length(trim(x))<1 OR length(x)>100)
    OR (SELECT count(DISTINCT x) FROM jsonb_array_elements_text(p_work_items) x)<>n
 THEN RAISE EXCEPTION 'invalid work items' USING ERRCODE='22023'; END IF;
 IF oldrow.version<>p_expected_version THEN RAISE EXCEPTION 'version conflict' USING ERRCODE='PT409'; END IF;
 SELECT string_agg(x,' / ' ORDER BY ord) INTO work_summary_value
 FROM jsonb_array_elements_text(p_work_items) WITH ORDINALITY t(x,ord);
 UPDATE public.deals SET primary_work=p_primary_work,work_items=p_work_items,
  work_scope_type=CASE WHEN n=1 THEN 'single' ELSE 'multi' END,
  work_summary=work_summary_value,version=version+1
 WHERE id=p_opportunity_id RETURNING * INTO newrow;
 INSERT INTO crm_security.audit_events(actor_auth_uid,actor_user_id,actor_name,deal_id,action,before_data,after_data,reason)
 VALUES(a.auth_uid,a.user_id,a.display_name,p_opportunity_id,'work_set',
  jsonb_build_object('primary_work',oldrow.primary_work,'work_items',oldrow.work_items,'work_scope_type',oldrow.work_scope_type,'work_summary',oldrow.work_summary,'version',oldrow.version,'updated_at',oldrow.updated_at),
  jsonb_build_object('primary_work',newrow.primary_work,'work_items',newrow.work_items,'work_scope_type',newrow.work_scope_type,'work_summary',newrow.work_summary,'version',newrow.version,'updated_at',newrow.updated_at),p_reason)
 RETURNING event_id INTO event;
 RETURN jsonb_build_object('id',newrow.id,'version',newrow.version,'audit_event_id',event);
END $fn$;
REVOKE EXECUTE ON FUNCTION public.crm_work_set_scoped_v2(uuid,text,jsonb,text,integer,text) FROM PUBLIC,anon,authenticated,service_role;

GRANT EXECUTE ON FUNCTION public.crm_profile_scoped_v2(),public.crm_read_scoped_v2(uuid,integer,uuid,uuid),
 public.crm_contacts_scoped_v2(uuid),public.crm_work_set_scoped_v2(uuid,text,jsonb,text,integer,text) TO authenticated;

INSERT INTO crm_security.access_review(user_id,reviewed_auth_uid,source_role,permission_role,approved,reviewed_by,reviewed_at,expires_at)
SELECT u.user_id,u.auth_uid,u.role,
 CASE WHEN u.role IN('admin','dual') THEN 'admin' ELSE 'rep' END,
 true,'production-cutover-approved-20260907',clock_timestamp(),'infinity'::timestamptz
FROM public.users u
JOIN auth.users a ON a.id=u.auth_uid
WHERE u.active AND u.role IN('rep','admin','dual');

DO $verify$
BEGIN
 IF (SELECT count(*) FROM crm_security.access_review)<>8
    OR (SELECT count(*) FROM crm_security.access_review WHERE permission_role='rep')<>5
    OR (SELECT count(*) FROM crm_security.access_review WHERE permission_role='admin')<>3
    OR EXISTS(SELECT 1 FROM crm_security.access_review WHERE NOT approved OR expires_at<=now())
 THEN RAISE EXCEPTION 'production access approval verification failed'; END IF;
 IF has_schema_privilege('anon','crm_security','USAGE') OR has_schema_privilege('authenticated','crm_security','USAGE')
    OR EXISTS(SELECT 1 FROM pg_class c WHERE c.relnamespace='crm_security'::regnamespace AND c.relkind='r'
      AND (NOT c.relrowsecurity OR has_table_privilege('anon',c.oid,'SELECT,INSERT,UPDATE,DELETE')
        OR has_table_privilege('authenticated',c.oid,'SELECT,INSERT,UPDATE,DELETE')))
 THEN RAISE EXCEPTION 'production private ledger exposed'; END IF;
 IF has_function_privilege('anon','public.crm_profile_scoped_v2()','EXECUTE')
    OR NOT has_function_privilege('authenticated','public.crm_profile_scoped_v2()','EXECUTE')
    OR has_function_privilege('authenticated','crm_security.actor()','EXECUTE')
 THEN RAISE EXCEPTION 'production foundation ACL verification failed'; END IF;
END $verify$;
COMMIT;
