BEGIN;
SET LOCAL search_path=pg_catalog;
SET LOCAL lock_timeout='3s';
SET LOCAL statement_timeout='30s';
SET LOCAL crm.operational_pagination_hotfix_ref='rprechiaglyjaydkmxsu';

DO $guard$ BEGIN
 IF current_user<>'postgres'
  OR current_setting('crm.operational_pagination_hotfix_ref',true) IS DISTINCT FROM 'rprechiaglyjaydkmxsu'
  OR to_regprocedure('crm_security.crm_operational_source_v1_pre_expansion_update_20260906(text,uuid,integer)') IS NULL
  OR md5(pg_get_functiondef(to_regprocedure('crm_security.crm_operational_source_v1_pre_expansion_update_20260906(text,uuid,integer)'))) <> '77197e1c60a32d7e59440528769a9e8c'
 THEN RAISE EXCEPTION 'expansion pagination hotfix drift'; END IF;
END $guard$;

CREATE OR REPLACE FUNCTION crm_security.crm_operational_source_v1_pre_expansion_update_20260906(
 p_domain text,p_after uuid DEFAULT NULL,p_limit integer DEFAULT 100
) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $fn$
DECLARE base jsonb; rows jsonb; has_more boolean; next_cursor uuid;
BEGIN
 IF p_domain='expansion_pool' THEN
  IF auth.uid() IS NULL OR NOT EXISTS(SELECT 1 FROM crm_security.actor()) THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501';END IF;
  IF p_limit<1 OR p_limit>100 THEN RAISE EXCEPTION 'invalid limit' USING ERRCODE='22023';END IF;
  SELECT coalesce(jsonb_agg(item ORDER BY (item->>'id')::uuid) FILTER(WHERE rn<=p_limit),'[]'::jsonb),coalesce(max(rn)>p_limit,false),(max(item->>'id') FILTER(WHERE rn<=p_limit))::uuid
  INTO rows,has_more,next_cursor FROM (
   SELECT jsonb_build_object('id',x.source_deal_id,'source_opportunity_id',x.source_deal_id,'site_id',x.site_id,'owner_id',x.owner_id,'owner_name',u.name,'site_name',s.site_name,'source_work_summary',x.source_work_summary,'source_won_amount',x.source_won_amount,'completion_date',x.completion_date,'next_contact_at',x.next_contact_at,'candidate_work_items',x.candidate_work_items,'relationship_state',x.relationship_state,'expansion_status',x.expansion_status,'created_at',x.created_at,'updated_at',x.updated_at) item,row_number() over(order by x.source_deal_id) rn
   FROM crm_security.expansion_pool x LEFT JOIN public.users u ON u.user_id=x.owner_id LEFT JOIN public.sites s ON s.site_id=x.site_id
   WHERE (p_after IS NULL OR x.source_deal_id>p_after) AND crm_security.can_deal(x.source_deal_id,false)
   ORDER BY x.source_deal_id LIMIT p_limit+1
  ) q;
  RETURN jsonb_build_object('contract_version',1,'resource','operational_source','domain',p_domain,'scope_completeness','actor_authorized_rows_only','items',rows,'pagination',jsonb_build_object('completeness',CASE WHEN has_more THEN 'partial' ELSE 'complete' END,'has_more',has_more,'next_cursor',CASE WHEN has_more THEN next_cursor END));
 END IF;
 base:=crm_security.crm_operational_source_v1_pre_close_won_20260906(p_domain,p_after,p_limit);
 IF p_domain<>'deal_core' THEN RETURN base;END IF;
 SELECT coalesce(jsonb_agg(item||jsonb_build_object('won_amount',d.won_amount,'completion_date',d.completion_date) ORDER BY (item->>'id')::uuid),'[]'::jsonb)
 INTO rows FROM jsonb_array_elements(coalesce(base->'items','[]'::jsonb)) item JOIN public.deals d ON d.id=(item->>'id')::uuid;
 RETURN jsonb_set(base,'{items}',rows,false);
END $fn$;
REVOKE EXECUTE ON FUNCTION crm_security.crm_operational_source_v1_pre_expansion_update_20260906(text,uuid,integer) FROM PUBLIC,anon,authenticated,service_role;

DO $post$ BEGIN
 IF has_function_privilege('authenticated','crm_security.crm_operational_source_v1_pre_expansion_update_20260906(text,uuid,integer)','EXECUTE')
  OR regexp_replace(lower(pg_get_functiondef(to_regprocedure('crm_security.crm_operational_source_v1_pre_expansion_update_20260906(text,uuid,integer)'))),'\s+','','g') NOT LIKE '%coalesce(max(rn)>p_limit,false)%'
 THEN RAISE EXCEPTION 'expansion pagination hotfix postcondition failed'; END IF;
END $post$;
COMMIT;
