-- Restore the exact pre-candidate scoped contact projection.
BEGIN;
SET LOCAL search_path=pg_catalog;
SET LOCAL lock_timeout='3s';
SET LOCAL statement_timeout='60s';
DO $guard$ DECLARE p record; BEGIN
 SELECT * INTO p FROM pg_proc WHERE oid='public.crm_contacts_scoped_v2(uuid)'::regprocedure;
 IF current_setting('crm.customer_asset_ref',true) IS DISTINCT FROM 'rprechiaglyjaydkmxsu'
  OR p.oid IS NULL OR md5(pg_get_functiondef(p.oid))<>'7e811c93e73ba945a0dfea164da55fcd'
  OR pg_get_userbyid(p.proowner)<>'postgres' OR NOT p.prosecdef
  OR p.prolang<>(SELECT oid FROM pg_language WHERE lanname='plpgsql')
  OR p.provolatile<>'s' OR p.proisstrict OR p.proparallel<>'u' OR p.proleakproof
  OR p.proconfig IS DISTINCT FROM ARRAY['search_path=""']
  OR coalesce(p.proacl::text,'')<>'{postgres=X/postgres,authenticated=X/postgres}'
 THEN RAISE EXCEPTION 'customer asset read rollback drift'; END IF;
 PERFORM set_config('crm.customer_asset_candidate_oid',p.oid::text,true);
END $guard$;

CREATE OR REPLACE FUNCTION public.crm_contacts_scoped_v2(p_opportunity_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $fn$
BEGIN
 IF NOT crm_security.can_deal(p_opportunity_id,false) THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;
 RETURN coalesce((SELECT jsonb_agg(jsonb_build_object('id',c.id,'name',c.name,'phone',c.phone,'mobile',c.mobile))
 FROM public.deals d JOIN public.contacts c ON c.id=d.contact_id AND c.organization_id=d.organization_id WHERE d.id=p_opportunity_id),'[]'::jsonb);
END $fn$;
REVOKE EXECUTE ON FUNCTION public.crm_contacts_scoped_v2(uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.crm_contacts_scoped_v2(uuid) TO authenticated;
DO $verify$ DECLARE p record; BEGIN
 SELECT * INTO p FROM pg_proc WHERE oid='public.crm_contacts_scoped_v2(uuid)'::regprocedure;
 IF p.oid::text IS DISTINCT FROM current_setting('crm.customer_asset_candidate_oid',true)
  OR md5(replace(replace(pg_get_functiondef(p.oid),chr(13)||chr(10),chr(10)),chr(13),chr(10)))<>'1a58be86503cb53bdc3a9a784eb4add2'
  OR pg_get_userbyid(p.proowner)<>'postgres' OR NOT p.prosecdef
  OR p.prolang<>(SELECT oid FROM pg_language WHERE lanname='plpgsql')
  OR p.provolatile<>'s' OR p.proisstrict OR p.proparallel<>'u' OR p.proleakproof
  OR p.proconfig IS DISTINCT FROM ARRAY['search_path=""']
  OR coalesce(p.proacl::text,'')<>'{postgres=X/postgres,authenticated=X/postgres}'
  OR has_function_privilege('public',p.oid,'EXECUTE')
  OR has_function_privilege('anon',p.oid,'EXECUTE')
  OR has_function_privilege('service_role',p.oid,'EXECUTE')
 THEN RAISE EXCEPTION 'customer asset read rollback verification failed'; END IF;
END $verify$;
COMMIT;
