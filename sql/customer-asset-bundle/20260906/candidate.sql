-- LOCAL READ CANDIDATE ONLY. No DML and no public write Dispatcher change.
BEGIN;
SET LOCAL search_path=pg_catalog;
SET LOCAL lock_timeout='3s';
SET LOCAL statement_timeout='60s';

DO $guard$ DECLARE p record; BEGIN
 SELECT * INTO p FROM pg_proc WHERE oid='public.crm_contacts_scoped_v2(uuid)'::regprocedure;
 IF current_setting('crm.customer_asset_ref',true) IS DISTINCT FROM 'rprechiaglyjaydkmxsu'
  OR p.oid IS NULL OR md5(replace(replace(pg_get_functiondef(p.oid),chr(13)||chr(10),chr(10)),chr(13),chr(10)))<>'1a58be86503cb53bdc3a9a784eb4add2'
  OR pg_get_userbyid(p.proowner)<>'postgres' OR NOT p.prosecdef
  OR p.prolang<>(SELECT oid FROM pg_language WHERE lanname='plpgsql')
  OR p.provolatile<>'s' OR p.proisstrict OR p.proparallel<>'u' OR p.proleakproof
  OR p.proconfig IS DISTINCT FROM ARRAY['search_path=""']
  OR coalesce(p.proacl::text,'')<>'{postgres=X/postgres,authenticated=X/postgres}'
  OR md5(replace(replace(pg_get_functiondef('crm_security.can_deal(uuid,boolean)'::regprocedure),chr(13)||chr(10),chr(10)),chr(13),chr(10)))<>'05d51a3c77344504a05a0e932cfcb15d'
  OR to_regclass('public.deals') IS NULL OR to_regclass('public.contacts') IS NULL
  OR to_regclass('public.contact_assignments') IS NULL OR to_regclass('public.sites') IS NULL
 THEN RAISE EXCEPTION 'customer asset read baseline drift'; END IF;
 PERFORM set_config('crm.customer_asset_previous_oid',p.oid::text,true);
END $guard$;

DO $columns$ DECLARE missing text; BEGIN
 SELECT string_agg(x.rel||'.'||x.col,', ' ORDER BY x.rel,x.col) INTO missing
 FROM (VALUES
  ('deals','id','uuid'),('deals','contact_id','uuid'),('deals','person_key','text'),('deals','site_id','uuid'),
  ('contacts','id','uuid'),('contacts','person_key','text'),('contacts','name','text'),('contacts','role','text'),
  ('contacts','title','text'),('contacts','phone','text'),('contacts','mobile','text'),('contacts','current_site','text'),
  ('contact_assignments','id','uuid'),('contact_assignments','person_key','text'),('contact_assignments','opportunity_id','uuid'),
  ('contact_assignments','site_name','text'),('contact_assignments','office_phone','text'),
  ('contact_assignments','started_at','date'),('contact_assignments','ended_at','date'),('contact_assignments','status','text'),
  ('sites','site_id','uuid'),('sites','site_name','text')
 ) x(rel,col,typ)
 WHERE NOT EXISTS(SELECT 1 FROM pg_attribute a
  WHERE a.attrelid=('public.'||x.rel)::regclass AND a.attname=x.col AND NOT a.attisdropped
    AND format_type(a.atttypid,a.atttypmod)=x.typ);
 IF missing IS NOT NULL THEN RAISE EXCEPTION 'customer asset dependency drift: %',missing; END IF;
END $columns$;

CREATE OR REPLACE FUNCTION public.crm_contacts_scoped_v2(p_opportunity_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $fn$
BEGIN
 IF p_opportunity_id IS NULL OR NOT crm_security.can_deal(p_opportunity_id,false)
 THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;

 RETURN coalesce((
  SELECT jsonb_agg(jsonb_build_object(
   'id',c.id,
   'person_key',c.person_key,
   'name',c.name,
   'role',coalesce(nullif(c.role,''),nullif(c.title,''),'담당자'),
   'phone',c.phone,
   'mobile',coalesce(c.mobile,c.phone),
   'current_site',c.current_site,
   'site_id',d.site_id,
   'site_name',s.site_name,
   'is_primary',coalesce(c.id=d.contact_id OR c.person_key=d.person_key,false),
   'office_phone',cur.office_phone,
   'started_at',cur.started_at,
   'ended_at',cur.ended_at,
   'status',coalesce(cur.status,'current'),
   'assignment_history',coalesce((
    SELECT jsonb_agg(jsonb_build_object(
     'site_name',h.site_name,
     'office_phone',h.office_phone,
     'started_at',h.started_at,
     'ended_at',h.ended_at,
     'status',coalesce(h.status,CASE WHEN h.ended_at IS NULL THEN 'current' ELSE 'ended' END)
    ) ORDER BY h.started_at DESC,h.id)
    FROM public.contact_assignments h
    WHERE h.person_key=c.person_key AND h.opportunity_id IS NOT NULL
      AND crm_security.can_deal(h.opportunity_id,false)
   ),'[]'::jsonb)
  ) ORDER BY coalesce(c.id=d.contact_id OR c.person_key=d.person_key,false) DESC,c.name,c.id)
  FROM public.deals d
  LEFT JOIN public.sites s ON s.site_id=d.site_id
  JOIN public.contacts c ON c.id=d.contact_id OR EXISTS(
   SELECT 1 FROM public.contact_assignments x
   WHERE x.person_key=c.person_key AND x.opportunity_id=d.id)
  LEFT JOIN LATERAL(
   SELECT x.office_phone,x.started_at,x.ended_at,x.status
   FROM public.contact_assignments x
   WHERE x.person_key=c.person_key AND x.opportunity_id=d.id
   ORDER BY (x.ended_at IS NULL) DESC,x.started_at DESC,x.id DESC LIMIT 1
  ) cur ON true
  WHERE d.id=p_opportunity_id
 ),'[]'::jsonb);
END $fn$;

REVOKE EXECUTE ON FUNCTION public.crm_contacts_scoped_v2(uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.crm_contacts_scoped_v2(uuid) TO authenticated;

DO $verify$ DECLARE p record; BEGIN
 SELECT * INTO p FROM pg_proc WHERE oid='public.crm_contacts_scoped_v2(uuid)'::regprocedure;
 IF p.oid::text IS DISTINCT FROM current_setting('crm.customer_asset_previous_oid',true)
  OR md5(pg_get_functiondef(p.oid))<>'7e811c93e73ba945a0dfea164da55fcd'
  OR pg_get_userbyid(p.proowner)<>'postgres' OR NOT p.prosecdef
  OR p.prolang<>(SELECT oid FROM pg_language WHERE lanname='plpgsql')
  OR p.provolatile<>'s' OR p.proisstrict OR p.proparallel<>'u' OR p.proleakproof
  OR p.proconfig IS DISTINCT FROM ARRAY['search_path=""']
  OR coalesce(p.proacl::text,'')<>'{postgres=X/postgres,authenticated=X/postgres}'
  OR has_function_privilege('public',p.oid,'EXECUTE')
  OR has_function_privilege('anon',p.oid,'EXECUTE')
  OR has_function_privilege('service_role',p.oid,'EXECUTE')
 THEN RAISE EXCEPTION 'customer asset read ACL/config drift'; END IF;
END $verify$;
COMMIT;
