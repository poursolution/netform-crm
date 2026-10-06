-- 2026-10-07: sales dashboard (dash/control/perf) company-wide READ ONLY.
-- Separate RPCs: existing operational ACL, can_deal/can_inquiry and every writer unchanged.
-- Original crm_direct_read is not installed in production. Use current reviewed actor().
begin;
CREATE OR REPLACE FUNCTION public.crm_dashboard_source_v1(p_domain text, p_after uuid, p_limit integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE raw_items jsonb; items jsonb; next_cursor uuid; has_more boolean; a record;
BEGIN
 SELECT * INTO a FROM crm_security.actor();
 IF NOT FOUND OR a.permission_role NOT IN ('admin','rep','branch') THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;
 IF p_domain NOT IN ('deal_core','inquiry_core')
 THEN RAISE EXCEPTION 'unsupported operational source domain' USING ERRCODE='22023'; END IF;
 IF p_limit IS NULL OR p_limit<1 OR p_limit>500
 THEN RAISE EXCEPTION 'invalid limit' USING ERRCODE='22023'; END IF;

 IF p_domain='deal_core' THEN
  SELECT coalesce(jsonb_agg(to_jsonb(q) ORDER BY q.id),'[]'::jsonb) INTO raw_items FROM(
   SELECT d.id,d.site_id,
    coalesce(s.site_name,o.name,nullif(d.list_fields->>'site_name',''),nullif(d.list_fields->>'name','')) AS site_name,
    coalesce(s.site_name,o.name,nullif(d.list_fields->>'site_name',''),nullif(d.list_fields->>'name','')) AS site,
    d.owner_id,coalesce(u.name,d.assignee_name) AS owner_name,coalesce(u.name,d.assignee_name) AS assignee,
    d.won_amount,d.completion_date,d.stage_code,d.stage_raw,d.stage_group,d.brand,d.list_name,d.list_fields->>'work_name' AS work_name,d.list_fields->>'work_name' AS work,
    d.amount,d.amount AS amt,d.amount_unknown_reason,
    d.created_at,d.created_at AS created,d.updated_at,d.updated_at AS updated,d.closed_at,d.closed_at AS closed,d.opened_at,
    d.lifecycle_status,d.outcome,d.lost_reason,d.lost_kind,d.badfit_type,d.wake_up_at,d.stage_entered_at,
    d.last_activity_at,d.last_activity_at AS "lastActivity",d.last_customer_contact_at,
    d.stage_entered_at AS "stageAt",d.origin_inquiry_id,d.origin_channel,
    d.source,d.outbound_channel,d.lost_reason,d.lost_kind,d.badfit_type,
    d.service_type,d.service_history,d.origin_business,d.current_business,d.business_history,
    d.primary_work,d.work_items,d.work_scope_type,d.work_summary,d.stage_checklist,d.stage_contexts,d.version,
    s.address,
    d.office_phone,d.office_email,d.manager_name,d.manager_mobile,d.manager_role,d.person_key,
    d.manager_current_site,d.manager_started_at,d.manager_status,d.manager_left_at,
    (SELECT q.amount FROM crm_security.quote_versions q WHERE q.deal_id=d.id ORDER BY q.version_no DESC LIMIT 1) AS quote_amount,
    coalesce((SELECT jsonb_agg(jsonb_build_object('version_no',q.version_no,'amount',q.amount,'reason',q.reason,'created_at',q.created_at) ORDER BY q.version_no)
     FROM crm_security.quote_versions q WHERE q.deal_id=d.id),'[]'::jsonb) AS quote_versions,
    coalesce(nullif(d.manager_mobile,''),nullif(d.office_phone,''),nullif(c.mobile,''),nullif(c.phone,'')) AS call_phone,
    (coalesce(nullif(d.manager_mobile,''),nullif(d.office_phone,''),nullif(c.mobile,''),nullif(c.phone,'')) IS NOT NULL) AS has_contact,
    CASE WHEN c.id IS NULL THEN '[]'::jsonb ELSE jsonb_build_array(jsonb_build_object(
     'id',c.id,'person_key',c.person_key,'name',c.name,
     'role',coalesce(nullif(c.role,''),nullif(c.title,''),'담당자'),
     'phone',c.phone,'mobile',coalesce(c.mobile,c.phone),
     'current_site',coalesce(c.current_site,s.site_name),'office_phone',d.office_phone,
     'is_primary',true
    )) END AS contacts,
    coalesce(ps.favorite,false) AS favorite,ps.last_viewed_at,ps.last_worked_at,coalesce(ps.view_count,0) AS view_count,
    EXISTS(SELECT 1 FROM public.activities ac WHERE ac.deal_id=d.id) AS has_activity,
    (SELECT jsonb_build_object('id',n.id,'type',n.action_type,'text',n.title,'due_at',n.due_at,'assignee_name',n.assignee_name,'status',n.status)
     FROM public.next_actions n WHERE n.deal_id=d.id AND n.status='open'
     ORDER BY n.due_at NULLS LAST,n.id LIMIT 1) AS next_action,
    coalesce((SELECT jsonb_agg(jsonb_build_object('id',n.id,'type',n.action_type,'text',n.title,'due_at',n.due_at,'status',n.status,'completed_at',n.completed_at) ORDER BY n.due_at,n.id)
     FROM public.next_actions n WHERE n.deal_id=d.id AND n.status='completed'),'[]'::jsonb) AS completed_actions,
    coalesce((SELECT jsonb_agg(jsonb_build_object('from',h.from_stage,'to',h.to_stage,'at',h.changed_at,'changed_at',h.changed_at,'reason',h.reason,'actor',h.actor_name,'actor_id',h.actor_id) ORDER BY h.changed_at,h.id)
     FROM public.stage_history h WHERE h.opportunity_id=d.id),'[]'::jsonb) AS stage_history,
    coalesce((SELECT jsonb_agg(jsonb_build_object('id',ac.id,'type',ac.type,'occurred_at',ac.occurred_at,
     'actor_name',ac.actor_name,
     'note',case when jsonb_typeof(ac.detail)='object' and jsonb_typeof(ac.detail->'note')='string' then ac.detail->>'note' when jsonb_typeof(ac.detail)='string' then ac.detail #>> '{}' else '' end,
     'result',case when jsonb_typeof(ac.detail)='object' and jsonb_typeof(ac.detail->'result')='string' then ac.detail->>'result' else '' end)
     || case when ac.type in ('단계전환','단계 전환','stage_change','stage_changed') and jsonb_typeof(ac.detail)='object'
      then jsonb_build_object('detail',(select coalesce(jsonb_object_agg(k,v),'{}'::jsonb) from jsonb_each(ac.detail) kv(k,v)
       where k in ('op','from','from_stage','to','to_stage') and jsonb_typeof(v)='string')) else '{}'::jsonb end
     ORDER BY ac.occurred_at,ac.id)
     FROM public.activities ac WHERE ac.deal_id=d.id),'[]'::jsonb) AS activity_signals
   FROM public.deals d
   LEFT JOIN public.sites s ON s.site_id=d.site_id
   LEFT JOIN public.organizations o ON o.id=d.organization_id
   LEFT JOIN public.users u ON u.user_id=d.owner_id
   LEFT JOIN public.contacts c ON c.id=d.contact_id
   LEFT JOIN crm_security.user_opportunity_state ps ON ps.actor_user_id=a.user_id AND ps.deal_id=d.id
   WHERE (p_after IS NULL OR d.id>p_after)
   ORDER BY d.id LIMIT p_limit+1
  )q;
 ELSE
  SELECT coalesce(jsonb_agg(to_jsonb(q) ORDER BY q.id),'[]'::jsonb) INTO raw_items FROM(
   SELECT i.id,i.sheet_row,i.site_id,i.site_name,i.brand,i.inquiry_type,i.business_type,i.work_type,i.source_channel,i.channel,
    crm_security.inquiry_flow_state_json(i.id) AS dashboard_flow_state,
    (SELECT jsonb_build_object('id',n.id,'type',n.action_type,'text',n.title,'due_at',n.due_at,'assignee_name',n.assignee_name,'status',n.status)
     FROM public.next_actions n WHERE n.inquiry_id=i.id AND n.status='open' ORDER BY n.due_at NULLS LAST,n.id LIMIT 1) AS next_action,
    i.assigned_to,coalesce(u.name,i.assignee_name) AS assignee_name,ar.permission_role AS assignee_permission_role,
    i.status,i.deal_id,i.opportunity_id,i.received_at,i.created_at,i.updated_at,i.assigned_at,
    coalesce((select fs.first_connected_at from crm_security.inquiry_flow_state fs where fs.inquiry_id=i.id),i.first_response_at) as first_response_at,i.responded_at,i.next_action_date,i.contact_name,i.phone,
    i.address,
    -- inquiry_external_response_projection_v1
    i.close_reason,
    jsonb_build_object(
     '응대내용',i.raw->>'응대내용',
     '종료사유',coalesce(nullif(i.close_reason,''),i.raw->>'종료사유'),
     'external_change_history',coalesce((
      SELECT jsonb_agg(jsonb_build_object(
       'kind','response','event_id',e.value->>'event_id','source_at',e.value->>'source_at',
       'after',jsonb_build_object(
        'response_content',e.value->'after'->>'response_content',
        'status',e.value->'after'->>'status',
        'close_reason',e.value->'after'->>'close_reason'
       )
      ) ORDER BY e.ordinality)
      FROM jsonb_array_elements(CASE WHEN jsonb_typeof(i.raw->'external_change_history')='array'
       THEN i.raw->'external_change_history' ELSE '[]'::jsonb END) WITH ORDINALITY AS e(value,ordinality)
      WHERE e.value->>'kind'='response' AND jsonb_typeof(e.value->'after')='object'
     ),'[]'::jsonb)
    ) AS raw,
    jsonb_build_object(
     'inquiry',coalesce(nullif(btrim(i.raw->>'문의내용'),''),nullif(btrim(i.raw->>'message'),''),nullif(btrim(i.raw->>'inquiry'),'')),
     'workType',coalesce(nullif(i.work_type,''),i.raw->>'공사유형'),
     'customerType',i.raw->>'고객유형',
     'office',i.raw->>'관리사무소',
     'buildingType',i.raw->>'건물유형',
     'complex',i.raw->>'단지개요',
     'sourceSite',i.raw->>'현장명',
     'responder',i.raw->>'전화응대자',
     'assignComment',i.raw->>'배정 코멘트',
     'response',i.raw->>'응대내용',
     'note',i.raw->>'특이사항',
     'address',coalesce(nullif(i.address,''),i.raw->>'건물주소'),
     'channel',coalesce(nullif(i.channel,''),i.raw->>'상담채널'),
     'inflow',coalesce(nullif(i.source_channel,''),i.raw->>'유입경로')
    ) AS detail,
    (SELECT e.after_data->>'review_status' FROM crm_security.inquiry_audit_events e WHERE e.inquiry_id=i.id AND e.action='inquiry_reclassify' ORDER BY e.created_at DESC,e.event_id DESC LIMIT 1) AS legacy_review_status,
    (SELECT e.after_data->>'reviewed_at' FROM crm_security.inquiry_audit_events e WHERE e.inquiry_id=i.id AND e.action='inquiry_reclassify' ORDER BY e.created_at DESC,e.event_id DESC LIMIT 1) AS legacy_reviewed_at,
    (SELECT e.after_data->>'reviewed_by' FROM crm_security.inquiry_audit_events e WHERE e.inquiry_id=i.id AND e.action='inquiry_reclassify' ORDER BY e.created_at DESC,e.event_id DESC LIMIT 1) AS legacy_reviewed_by,
    (SELECT e.after_data->>'hold_reason' FROM crm_security.inquiry_audit_events e WHERE e.inquiry_id=i.id AND e.action='inquiry_hold' ORDER BY e.created_at DESC,e.event_id DESC LIMIT 1) AS hold_reason,
    (SELECT e.created_at FROM crm_security.inquiry_audit_events e WHERE e.inquiry_id=i.id AND e.action='inquiry_hold' ORDER BY e.created_at DESC,e.event_id DESC LIMIT 1) AS held_at,
    (SELECT e.after_data->>'held_by' FROM crm_security.inquiry_audit_events e WHERE e.inquiry_id=i.id AND e.action='inquiry_hold' ORDER BY e.created_at DESC,e.event_id DESC LIMIT 1) AS held_by,
    (SELECT CASE WHEN e.action='inquiry_trash' THEN e.created_at END FROM crm_security.inquiry_audit_events e WHERE e.inquiry_id=i.id AND e.action IN ('inquiry_trash','inquiry_restore') ORDER BY e.created_at DESC,e.event_id DESC LIMIT 1) AS deleted_at,
    (SELECT CASE WHEN e.action='inquiry_trash' THEN e.after_data->>'deleted_by' END FROM crm_security.inquiry_audit_events e WHERE e.inquiry_id=i.id AND e.action IN ('inquiry_trash','inquiry_restore') ORDER BY e.created_at DESC,e.event_id DESC LIMIT 1) AS deleted_by,
    (SELECT CASE WHEN e.action='inquiry_trash' THEN e.after_data->>'delete_reason' END FROM crm_security.inquiry_audit_events e WHERE e.inquiry_id=i.id AND e.action IN ('inquiry_trash','inquiry_restore') ORDER BY e.created_at DESC,e.event_id DESC LIMIT 1) AS delete_reason,
    (SELECT CASE WHEN e.action='inquiry_trash' THEN e.after_data->>'delete_note' END FROM crm_security.inquiry_audit_events e WHERE e.inquiry_id=i.id AND e.action IN ('inquiry_trash','inquiry_restore') ORDER BY e.created_at DESC,e.event_id DESC LIMIT 1) AS delete_note,
    (SELECT CASE WHEN e.action='inquiry_trash' THEN (e.after_data->>'purge_at')::timestamptz END FROM crm_security.inquiry_audit_events e WHERE e.inquiry_id=i.id AND e.action IN ('inquiry_trash','inquiry_restore') ORDER BY e.created_at DESC,e.event_id DESC LIMIT 1) AS purge_at,
    coalesce((SELECT CASE WHEN e.action='inquiry_trash' THEN (e.after_data->>'archive_protected')::boolean ELSE false END FROM crm_security.inquiry_audit_events e WHERE e.inquiry_id=i.id AND e.action IN ('inquiry_trash','inquiry_restore') ORDER BY e.created_at DESC,e.event_id DESC LIMIT 1),false) AS archive_protected,
    (SELECT CASE WHEN e.action='inquiry_trash' THEN e.after_data->>'archive_reason' END FROM crm_security.inquiry_audit_events e WHERE e.inquiry_id=i.id AND e.action IN ('inquiry_trash','inquiry_restore') ORDER BY e.created_at DESC,e.event_id DESC LIMIT 1) AS archive_reason,
    coalesce((SELECT e.action<>'inquiry_trash' FROM crm_security.inquiry_audit_events e WHERE e.inquiry_id=i.id AND e.action IN ('inquiry_trash','inquiry_restore') ORDER BY e.created_at DESC,e.event_id DESC LIMIT 1),true) AS valid_inquiry,
    (SELECT CASE WHEN e.action='inquiry_trash' THEN e.after_data->'trash_snapshot' END FROM crm_security.inquiry_audit_events e WHERE e.inquiry_id=i.id AND e.action IN ('inquiry_trash','inquiry_restore') ORDER BY e.created_at DESC,e.event_id DESC LIMIT 1) AS trash_snapshot,
    (SELECT e.created_at FROM crm_security.inquiry_audit_events e WHERE e.inquiry_id=i.id AND e.action='inquiry_restore' ORDER BY e.created_at DESC,e.event_id DESC LIMIT 1) AS restored_at,
    (SELECT e.after_data->>'restored_by' FROM crm_security.inquiry_audit_events e WHERE e.inquiry_id=i.id AND e.action='inquiry_restore' ORDER BY e.created_at DESC,e.event_id DESC LIMIT 1) AS restored_by,
    coalesce((SELECT jsonb_agg(jsonb_build_object('id',e.event_id,'type','데이터정리','note',coalesce(e.before_data->>'brand','기술자문')||' → '||coalesce(e.after_data->>'brand',''),'result','정상 견적문의로 재분류','at',e.created_at,'actor',e.after_data->>'reviewed_by') ORDER BY e.created_at,e.event_id) FROM crm_security.inquiry_audit_events e WHERE e.inquiry_id=i.id AND e.action='inquiry_reclassify'),'[]'::jsonb)
    ||coalesce((SELECT jsonb_agg(jsonb_build_object('id',e.event_id,'type','상태변경','note','보류','result',e.reason,'at',e.created_at,'actor',e.after_data->>'held_by') ORDER BY e.created_at,e.event_id) FROM crm_security.inquiry_audit_events e WHERE e.inquiry_id=i.id AND e.action='inquiry_hold'),'[]'::jsonb)
    ||coalesce((SELECT jsonb_agg(jsonb_build_object(
      'id',h.id,'type','담당자 변경','note',coalesce(nullif(h.from_owner,''),'미배정')||' → '||coalesce(h.to_owner,'미배정'),
      'result',h.reason,'at',h.changed_at,'actor',h.actor_name) ORDER BY h.changed_at,h.id)
      FROM public.assignment_history h WHERE h.inquiry_id=i.id),'[]'::jsonb) AS activities
   FROM public.inquiries i
   LEFT JOIN public.users u ON u.user_id=i.assigned_to
   LEFT JOIN crm_security.access_review ar ON ar.user_id=i.assigned_to AND ar.approved AND ar.expires_at>now()
   WHERE coalesce((select e.action not in ('inquiry_trash','inquiry_purge') from crm_security.inquiry_audit_events e where e.inquiry_id=i.id and e.action in ('inquiry_trash','inquiry_restore','inquiry_purge') order by e.created_at desc,e.event_id desc limit 1),true) AND (p_after IS NULL OR i.id>p_after)
-- inquiry_sheet_mirror_read_v1

 AND NOT (
  i.sheet_row IS NULL AND i.assigned_to IS NULL AND nullif(btrim(i.assignee_name),'') IS NULL
  AND i.status IN ('접수','신규') AND i.deal_id IS NULL AND i.opportunity_id IS NULL
  AND i.qualified_at IS NULL AND i.responded_at IS NULL AND i.first_response_at IS NULL AND i.next_action_date IS NULL
  AND NOT EXISTS (SELECT 1 FROM crm_security.inquiry_audit_events ae WHERE ae.inquiry_id=i.id)
  AND NOT EXISTS (SELECT 1 FROM public.next_actions na WHERE na.inquiry_id=i.id)
  AND EXISTS (
   SELECT 1 FROM public.inquiries s
   WHERE s.sheet_row IS NOT NULL
   AND s.brand=i.brand
   AND length(regexp_replace(coalesce(i.phone,''),'[^0-9]','','g'))>=9
   AND regexp_replace(s.phone,'[^0-9]','','g')=regexp_replace(i.phone,'[^0-9]','','g')
   AND nullif(btrim(i.raw->>'접수일시'),'') IS NOT NULL AND s.raw->>'접수일시'=i.raw->>'접수일시'
   AND nullif(btrim(i.raw->>'문의내용'),'') IS NOT NULL AND s.raw->>'문의내용'=i.raw->>'문의내용'
   AND coalesce(s.raw->>'현장명','')=coalesce(i.raw->>'현장명','')
   AND coalesce(s.address,'')=coalesce(i.address,'')
   AND (SELECT count(*) FROM public.inquiries same_s WHERE same_s.sheet_row IS NOT NULL
     AND same_s.brand=s.brand AND regexp_replace(same_s.phone,'[^0-9]','','g')=regexp_replace(s.phone,'[^0-9]','','g')
     AND same_s.raw->>'접수일시'=s.raw->>'접수일시' AND same_s.raw->>'문의내용'=s.raw->>'문의내용'
     AND coalesce(same_s.raw->>'현장명','')=coalesce(s.raw->>'현장명','') AND coalesce(same_s.address,'')=coalesce(s.address,''))=1
   AND (SELECT count(*) FROM public.inquiries same_d WHERE same_d.sheet_row IS NULL
     AND same_d.brand=s.brand AND regexp_replace(same_d.phone,'[^0-9]','','g')=regexp_replace(s.phone,'[^0-9]','','g')
     AND same_d.raw->>'접수일시'=s.raw->>'접수일시' AND same_d.raw->>'문의내용'=s.raw->>'문의내용'
     AND coalesce(same_d.raw->>'현장명','')=coalesce(s.raw->>'현장명','') AND coalesce(same_d.address,'')=coalesce(s.address,''))=1
  )
 )
   ORDER BY i.id LIMIT p_limit+1
  )q;
 END IF;

 has_more:=jsonb_array_length(raw_items)>p_limit;
 items:=CASE WHEN has_more THEN raw_items-p_limit ELSE raw_items END;
 items:=(select coalesce(jsonb_agg(value - ARRAY['contacts','call_phone','phone','contact_name','address','office_phone','office_email','manager_mobile','manager_name','manager_current_site','person_key','trash_snapshot','delete_note'] order by ord),'[]'::jsonb) from jsonb_array_elements(items) with ordinality t(value,ord));
 next_cursor:=CASE WHEN has_more AND jsonb_array_length(items)>0
  THEN (items->(jsonb_array_length(items)-1)->>'id')::uuid ELSE NULL END;
 RETURN jsonb_build_object(
  'contract_version',1,'resource','operational_source','domain',p_domain,
  'scope_completeness','dashboard_all_read_only',
  'actor_user_id',a.user_id,'actor_permission_role',a.permission_role,
  'items',items,'pagination',jsonb_build_object(
   'completeness',CASE WHEN has_more THEN 'partial' ELSE 'complete' END,
   'has_more',has_more,'next_cursor',next_cursor));
END $function$;
CREATE OR REPLACE FUNCTION public.crm_dashboard_contracts_v1(p_cursor uuid DEFAULT NULL::uuid, p_limit integer DEFAULT 200)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE a record; result jsonb; lim integer:=greatest(1,least(coalesce(p_limit,200),500));
BEGIN
 SELECT * INTO a FROM crm_security.actor();
 IF a.user_id IS NULL OR a.permission_role NOT IN ('admin','rep','branch') THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;
 WITH eligible AS (
  SELECT h.* FROM crm_security.contract_sales h
  WHERE (p_cursor IS NULL OR h.contract_id>p_cursor)
  ORDER BY h.contract_id LIMIT lim+1
 ), page AS (SELECT * FROM eligible ORDER BY contract_id LIMIT lim), items AS (
  SELECT h.contract_id,jsonb_build_object('contract_id',h.contract_id,'deal_id',h.deal_id,'advisory_id',h.advisory_id,
   'contract_signed',true,'contract_date',h.contract_date,'contract_amount',h.contract_amount,
   'sales_owner',h.sales_owner,'sales_owner_name',h.sales_owner_name,'site',h.site_snapshot,'brand',h.brand_snapshot,
   'version',h.version,'cancelled',h.cancelled,'balance',h.balance,
   'events',(SELECT jsonb_agg(jsonb_build_object('policy','contract-signed-event-v1','contract_id',e.contract_id,
    'deal_id',e.deal_id,'event_id',e.event_id,'sequence',e.sequence,'kind',e.kind,
    'effective_date',e.effective_date,'amount_delta',e.amount_delta,'sales_owner',h.sales_owner,
    'sales_owner_name',h.sales_owner_name,'reason',e.reason,'recorded_at',e.recorded_at) ORDER BY e.sequence)
    FROM crm_security.contract_sales_events e WHERE e.contract_id=h.contract_id)) item FROM page h
 ) SELECT jsonb_build_object('ok',true,'policy','contract-signed-event-v1','items',
 coalesce((SELECT jsonb_agg(item ORDER BY contract_id) FROM items),'[]'::jsonb),
 'has_more',(SELECT count(*)>lim FROM eligible),'next_cursor',(SELECT contract_id FROM page ORDER BY contract_id DESC LIMIT 1)) INTO result;
 RETURN result;
END $function$;
revoke all on function public.crm_dashboard_source_v1(text,uuid,integer),public.crm_dashboard_contracts_v1(uuid,integer) from public,anon,service_role;
grant execute on function public.crm_dashboard_source_v1(text,uuid,integer),public.crm_dashboard_contracts_v1(uuid,integer) to authenticated;
notify pgrst,'reload schema';
commit;
