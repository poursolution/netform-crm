-- Staging-only compatibility projection for the existing work editor.
BEGIN;
SET LOCAL search_path=pg_catalog;
SET LOCAL lock_timeout='3s';
SET LOCAL statement_timeout='30s';
DO $$
DECLARE p record;
BEGIN
 IF current_user<>'postgres' OR current_setting('crm.work_read_ref',true) IS DISTINCT FROM 'rprechiaglyjaydkmxsu'
 THEN RAISE EXCEPTION 'Staging work read projection approval required'; END IF;
 SELECT * INTO p FROM pg_proc WHERE oid='public.crm_read_scoped_v2(uuid,integer,uuid,uuid)'::regprocedure;
 IF md5(replace(replace(pg_get_functiondef(p.oid),chr(13)||chr(10),chr(10)),chr(13),chr(10)))<>'1abbbcb937ff06540ea10e77c8b32e9e'
  OR pg_get_userbyid(p.proowner)<>'postgres' OR NOT p.prosecdef OR p.proconfig IS DISTINCT FROM ARRAY['search_path=""']
  OR has_function_privilege('anon',p.oid,'EXECUTE') OR has_function_privilege('service_role',p.oid,'EXECUTE')
  OR NOT has_function_privilege('authenticated',p.oid,'EXECUTE') OR EXISTS(SELECT 1 FROM aclexplode(p.proacl) x WHERE x.grantee=0)
 THEN RAISE EXCEPTION 'crm_read_scoped_v2 definition or ACL drift'; END IF;
END $$;

CREATE OR REPLACE FUNCTION public.crm_read_scoped_v2(p_after uuid DEFAULT NULL,p_limit integer DEFAULT 100,p_deal_id uuid DEFAULT NULL,p_inquiry_id uuid DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $fn$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM crm_security.actor()) OR (p_deal_id IS NOT NULL AND NOT crm_security.can_deal(p_deal_id,false))
 OR (p_inquiry_id IS NOT NULL AND NOT crm_security.can_inquiry(p_inquiry_id)) THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;
 IF p_limit IS NULL OR p_limit<1 OR p_limit>100 THEN RAISE EXCEPTION 'invalid limit' USING ERRCODE='22023'; END IF;
 RETURN jsonb_build_object('contract_version',2,
 'deals',coalesce((SELECT jsonb_agg(to_jsonb(q) ORDER BY q.id) FROM(
 SELECT d.id,d.site_id,d.owner_id,d.stage_code,d.brand,d.primary_work,d.work_items,d.work_scope_type,d.work_summary,d.version FROM public.deals d
 WHERE crm_security.can_deal(d.id,false) AND (p_after IS NULL OR d.id>p_after) AND (p_deal_id IS NULL OR d.id=p_deal_id) ORDER BY d.id LIMIT p_limit) q),'[]'::jsonb),
 'inquiries',coalesce((SELECT jsonb_agg(to_jsonb(q) ORDER BY q.id) FROM(
 SELECT i.id,i.assigned_to,i.site_name,i.status FROM public.inquiries i WHERE crm_security.can_inquiry(i.id)
 AND (p_after IS NULL OR i.id>p_after) AND (p_inquiry_id IS NULL OR i.id=p_inquiry_id) ORDER BY i.id LIMIT p_limit) q),'[]'::jsonb));
END $fn$;
REVOKE EXECUTE ON FUNCTION public.crm_read_scoped_v2(uuid,integer,uuid,uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.crm_read_scoped_v2(uuid,integer,uuid,uuid) TO authenticated;
DO $$ DECLARE p record; BEGIN
 SELECT * INTO p FROM pg_proc WHERE oid='public.crm_read_scoped_v2(uuid,integer,uuid,uuid)'::regprocedure;
 IF pg_get_userbyid(p.proowner)<>'postgres' OR NOT p.prosecdef OR p.provolatile<>'s' OR p.proconfig IS DISTINCT FROM ARRAY['search_path=""']
  OR has_function_privilege('anon',p.oid,'EXECUTE') OR has_function_privilege('service_role',p.oid,'EXECUTE')
  OR NOT has_function_privilege('authenticated',p.oid,'EXECUTE') OR EXISTS(SELECT 1 FROM aclexplode(p.proacl) x WHERE x.grantee=0)
 THEN RAISE EXCEPTION 'work read projection ACL/config drift'; END IF;
END $$;
COMMIT;
