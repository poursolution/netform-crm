SET crm.work_read_ref='rprechiaglyjaydkmxsu';
BEGIN;
SET LOCAL search_path=pg_catalog;
SET LOCAL lock_timeout='3s';
SET LOCAL statement_timeout='30s';
DO $$ BEGIN
 IF current_user<>'postgres' OR current_setting('crm.work_read_ref',true) IS DISTINCT FROM 'rprechiaglyjaydkmxsu'
 THEN RAISE EXCEPTION 'Staging work read rollback approval required'; END IF;
END $$;
CREATE OR REPLACE FUNCTION public.crm_read_scoped_v2(p_after uuid DEFAULT NULL,p_limit integer DEFAULT 100,p_deal_id uuid DEFAULT NULL,p_inquiry_id uuid DEFAULT NULL) RETURNS jsonb
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
GRANT EXECUTE ON FUNCTION public.crm_read_scoped_v2(uuid,integer,uuid,uuid) TO authenticated;
COMMIT;
