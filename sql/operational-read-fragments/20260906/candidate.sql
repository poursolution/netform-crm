-- LOCAL PRIVATE READ FRAGMENTS ONLY. No public function is changed or added.
BEGIN;
SET LOCAL search_path=pg_catalog;
SET LOCAL lock_timeout='3s';
SET LOCAL statement_timeout='60s';

DO $guard$ DECLARE r record; w record; BEGIN
 SELECT * INTO r FROM pg_proc WHERE oid='public.crm_read_scoped_v2(uuid,integer,uuid,uuid)'::regprocedure;
 SELECT * INTO w FROM pg_proc WHERE oid='public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)'::regprocedure;
 IF current_setting('crm.operational_read_ref',true) IS DISTINCT FROM 'rprechiaglyjaydkmxsu'
  OR r.oid IS NULL OR md5(pg_get_functiondef(r.oid))<>'919c4abff86e37beeb62ccb15beba33e'
  OR pg_get_userbyid(r.proowner)<>'postgres' OR NOT r.prosecdef
  OR r.proconfig IS DISTINCT FROM ARRAY['search_path=""']
  OR coalesce(r.proacl::text,'')<>'{postgres=X/postgres,authenticated=X/postgres}'
  OR w.oid IS NULL OR to_regprocedure('crm_security.crm_operational_read_fragment_v1(text,uuid,integer)') IS NOT NULL
 THEN RAISE EXCEPTION 'operational read private fragment prerequisite drift'; END IF;
END $guard$;

CREATE FUNCTION crm_security.crm_operational_read_fragment_v1(
 p_domain text,p_after uuid,p_limit integer
) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $fn$
DECLARE items jsonb; next_cursor uuid; a record;
BEGIN
 SELECT * INTO a FROM crm_security.actor();
 IF NOT FOUND THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;
 IF p_domain NOT IN ('deal_core','inquiry_core') THEN RAISE EXCEPTION 'unsupported read fragment domain' USING ERRCODE='22023'; END IF;
 IF p_limit IS NULL OR p_limit<1 OR p_limit>100 THEN RAISE EXCEPTION 'invalid limit' USING ERRCODE='22023'; END IF;

 IF p_domain='deal_core' THEN
  SELECT coalesce(jsonb_agg(to_jsonb(q) ORDER BY q.id),'[]'::jsonb) INTO items FROM(
   SELECT d.id,d.site_id,coalesce(s.site_name,o.name,nullif(d.list_fields->>'site_name',''),nullif(d.list_fields->>'name','')) AS site_name,
    d.owner_id,coalesce(u.name,d.assignee_name) AS owner_name,d.stage_code,d.brand,d.amount,d.amount_unknown_reason,
    d.created_at,d.updated_at,d.closed_at,d.lifecycle_status,d.outcome,d.wake_up_at,d.stage_entered_at,
    d.last_activity_at,d.last_customer_contact_at,d.origin_inquiry_id,d.origin_channel,d.service_type,
    d.origin_business,d.current_business,d.primary_work,d.work_items,d.work_scope_type,d.work_summary,d.version,
    coalesce(nullif(d.manager_mobile,''),nullif(d.office_phone,''),nullif(c.mobile,''),nullif(c.phone,'')) AS call_phone,
    (coalesce(nullif(d.manager_mobile,''),nullif(d.office_phone,''),nullif(c.mobile,''),nullif(c.phone,'')) IS NOT NULL) AS has_contact,
    EXISTS(SELECT 1 FROM public.activities ac WHERE ac.deal_id=d.id) AS has_activity,
    (SELECT jsonb_build_object('id',n.id,'type',n.action_type,'text',n.title,'due_at',n.due_at,'assignee_name',n.assignee_name,'status',n.status)
     FROM public.next_actions n WHERE n.deal_id=d.id AND n.status='open' ORDER BY n.due_at NULLS LAST,n.id LIMIT 1) AS next_action,
    coalesce((SELECT jsonb_agg(jsonb_build_object('id',n.id,'type',n.action_type,'text',n.title,'due_at',n.due_at,'status',n.status,'completed_at',n.completed_at) ORDER BY n.due_at,n.id)
     FROM public.next_actions n WHERE n.deal_id=d.id AND n.status='completed'),'[]'::jsonb) AS completed_actions,
    coalesce((SELECT jsonb_agg(jsonb_build_object('from',h.from_stage,'to',h.to_stage,'changed_at',h.changed_at) ORDER BY h.changed_at,h.id)
     FROM public.stage_history h WHERE h.opportunity_id=d.id),'[]'::jsonb) AS stage_history,
    coalesce((SELECT jsonb_agg(jsonb_build_object('id',ac.id,'type',ac.type,'occurred_at',ac.occurred_at) ORDER BY ac.occurred_at,ac.id)
     FROM public.activities ac WHERE ac.deal_id=d.id),'[]'::jsonb) AS activity_signals
   FROM public.deals d
   LEFT JOIN public.sites s ON s.site_id=d.site_id
   LEFT JOIN public.organizations o ON o.id=d.organization_id
   LEFT JOIN public.users u ON u.user_id=d.owner_id
   LEFT JOIN public.contacts c ON c.id=d.contact_id
   WHERE crm_security.can_deal(d.id,false) AND (p_after IS NULL OR d.id>p_after)
   ORDER BY d.id LIMIT p_limit
  )q;
 ELSE
  SELECT coalesce(jsonb_agg(to_jsonb(q) ORDER BY q.id),'[]'::jsonb) INTO items FROM(
   SELECT i.id,i.site_id,i.site_name,i.brand,i.inquiry_type,i.work_type,i.source_channel,i.channel,
    i.assigned_to,coalesce(u.name,i.assignee_name) AS assignee_name,ar.permission_role AS assignee_permission_role,
    i.status,i.deal_id,i.opportunity_id,i.received_at,i.created_at,i.updated_at,i.assigned_at,
    i.first_response_at,i.responded_at,i.next_action_date,i.contact_name,i.phone
   FROM public.inquiries i
   LEFT JOIN public.users u ON u.user_id=i.assigned_to
   LEFT JOIN crm_security.access_review ar ON ar.user_id=i.assigned_to AND ar.approved AND ar.expires_at>now()
   WHERE crm_security.can_inquiry(i.id) AND (p_after IS NULL OR i.id>p_after)
   ORDER BY i.id LIMIT p_limit
  )q;
 END IF;

 next_cursor:=CASE WHEN jsonb_array_length(items)>0
  THEN (items->(jsonb_array_length(items)-1)->>'id')::uuid ELSE NULL END;

 RETURN jsonb_build_object('contract_version',1,'domain',p_domain,'scope_completeness','actor_authorized_rows_only',
  'actor_user_id',a.user_id,'actor_permission_role',a.permission_role,'items',items,
  'next_cursor',CASE WHEN jsonb_array_length(items)=p_limit THEN next_cursor ELSE NULL END);
END $fn$;

REVOKE EXECUTE ON FUNCTION crm_security.crm_operational_read_fragment_v1(text,uuid,integer)
 FROM PUBLIC,anon,authenticated,service_role;

DO $verify$ DECLARE p record; BEGIN
 SELECT * INTO p FROM pg_proc WHERE oid='crm_security.crm_operational_read_fragment_v1(text,uuid,integer)'::regprocedure;
 IF p.oid IS NULL OR pg_get_userbyid(p.proowner)<>'postgres' OR NOT p.prosecdef OR p.provolatile<>'s'
  OR p.proconfig IS DISTINCT FROM ARRAY['search_path=""']
  OR has_function_privilege('anon',p.oid,'EXECUTE')
  OR has_function_privilege('authenticated',p.oid,'EXECUTE')
  OR has_function_privilege('service_role',p.oid,'EXECUTE')
  OR EXISTS(SELECT 1 FROM aclexplode(p.proacl)x WHERE x.grantee=0)
 THEN RAISE EXCEPTION 'operational read private fragment ACL/config drift'; END IF;
END $verify$;
COMMIT;
