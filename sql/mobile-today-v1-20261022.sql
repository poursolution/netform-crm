-- 모바일 오늘 업무 가벼운 조회 v1 (2026-10-22 회의록 9/9 · 10/2 '초기 데이터 로딩 지연': 로그인 뒤 전체 영업건 · 문의를 100건씩 끝까지 받기 전에 내 오늘 화면부터)
--   · 로그인한 담당자 본인의 열린 영업건(담당자 = 나 · 종료 아님)과 나에게 배정된 문의만, 화면 카드에 필요한 칸만(크게 가볍다 — 활동 · 견적 · 단계 이력 · 첨부 없음).
--   · 권한은 전체 조회와 같은 함수(crm_security.can_deal · can_inquiry)로 다시 거른다. 관리자가 불러도 '내 건'만 준다(전체는 기존 조회).
--   · 화면(operational-overlay.js loadLive)은 저장본이 없을 때 이 결과를 먼저 그리고, 전체 조회는 그대로 이어서 받아 덮어쓴다. 끄기 G.mobileTodayFirstOff.
--   · 읽기 전용. 다시 실행해도 안전하다.
BEGIN;

CREATE OR REPLACE FUNCTION public.crm_mobile_today_v1(p_limit integer DEFAULT 500)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=''
AS $fn$
DECLARE a record; v_limit integer; v_deals jsonb; v_inqs jsonb; v_deal_n integer; v_inq_n integer;
BEGIN
 SELECT * INTO a FROM crm_security.actor();
 IF NOT FOUND THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;
 v_limit:=LEAST(GREATEST(coalesce(p_limit,500),1),1000);
 SELECT coalesce(jsonb_agg(to_jsonb(q) ORDER BY q.id),'[]'::jsonb),count(*) INTO v_deals,v_deal_n FROM (
  SELECT d.id,d.site_id,
   coalesce(s.site_name,o.name,nullif(d.list_fields->>'site_name',''),nullif(d.list_fields->>'name','')) AS site_name,
   coalesce(s.site_name,o.name,nullif(d.list_fields->>'site_name',''),nullif(d.list_fields->>'name','')) AS site,
   d.owner_id,coalesce(u.name,d.assignee_name) AS owner_name,coalesce(u.name,d.assignee_name) AS assignee,
   d.stage_code,d.stage_raw,d.stage_group,d.brand,d.list_name,
   d.amount,d.amount AS amt,d.amount_unknown_reason,
   d.created_at,d.created_at AS created,d.updated_at,d.updated_at AS updated,d.closed_at,d.opened_at,
   d.lifecycle_status,d.outcome,d.wake_up_at,d.stage_entered_at,d.stage_entered_at AS "stageAt",
   d.last_activity_at,d.last_activity_at AS "lastActivity",d.last_customer_contact_at,
   d.origin_inquiry_id,d.origin_channel,d.source,d.service_type,
   d.primary_work,d.work_items,d.work_scope_type,d.work_summary,d.stage_checklist,d.stage_contexts,d.version,
   s.address,d.office_phone,d.manager_name,d.manager_mobile,d.manager_role,d.person_key,
   coalesce(nullif(d.manager_mobile,''),nullif(d.office_phone,'')) AS call_phone,
   (coalesce(nullif(d.manager_mobile,''),nullif(d.office_phone,'')) IS NOT NULL) AS has_contact,
   (SELECT jsonb_build_object('id',n.id,'type',n.action_type,'text',n.title,'due_at',n.due_at,'assignee_name',n.assignee_name,'status',n.status)
     FROM public.next_actions n WHERE n.deal_id=d.id AND n.status='open' ORDER BY n.due_at NULLS LAST,n.id LIMIT 1) AS next_action,
   '[]'::jsonb AS contacts,'[]'::jsonb AS completed_actions,'[]'::jsonb AS stage_history,'[]'::jsonb AS activity_signals,'[]'::jsonb AS quote_versions,
   true AS mobile_today_partial
  FROM public.deals d
  LEFT JOIN public.sites s ON s.site_id=d.site_id
  LEFT JOIN public.organizations o ON o.id=d.organization_id
  LEFT JOIN public.users u ON u.user_id=d.owner_id
  WHERE (d.owner_id=a.user_id OR (d.owner_id IS NULL AND d.assignee_name=a.display_name))
   AND coalesce(d.lifecycle_status,'active')<>'closed' AND d.outcome IS NULL
   AND crm_security.can_deal(d.id,false)
  ORDER BY d.id LIMIT v_limit
 ) q;
 SELECT coalesce(jsonb_agg(to_jsonb(q) ORDER BY q.id),'[]'::jsonb),count(*) INTO v_inqs,v_inq_n FROM (
  SELECT i.id,i.site_id,i.site_name,i.brand,i.inquiry_type,i.work_type,i.source_channel,i.channel,
   i.assigned_to,coalesce(u.name,i.assignee_name) AS assignee_name,
   i.status,i.deal_id,i.opportunity_id,i.received_at,i.created_at,i.updated_at,i.assigned_at,
   i.first_response_at,i.responded_at,i.next_action_date,i.contact_name,i.phone,
   true AS mobile_today_partial
  FROM public.inquiries i
  LEFT JOIN public.users u ON u.user_id=i.assigned_to
  WHERE (i.assigned_to=a.user_id OR (i.assigned_to IS NULL AND i.assignee_name=a.display_name))
   AND crm_security.can_inquiry(i.id)
  ORDER BY i.id LIMIT v_limit
 ) q;
 RETURN jsonb_build_object('ok',true,'contract_version',1,'resource','mobile_today','scope','actor_own_open_only',
  'server_time',clock_timestamp(),'actor_user_id',a.user_id,'actor_permission_role',a.permission_role,
  'deals',v_deals,'inquiries',v_inqs,'limit',v_limit,'truncated',jsonb_build_object('deals',v_deal_n>=v_limit,'inquiries',v_inq_n>=v_limit));
END $fn$;
REVOKE EXECUTE ON FUNCTION public.crm_mobile_today_v1(integer) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.crm_mobile_today_v1(integer) TO authenticated;
NOTIFY pgrst,'reload schema';

COMMIT;
