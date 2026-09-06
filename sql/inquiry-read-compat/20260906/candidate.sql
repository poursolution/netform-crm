-- Local candidate only. Do not run against Production.
SET crm.inquiry_read_ref='rprechiaglyjaydkmxsu';
BEGIN;
SET LOCAL search_path=pg_catalog;
SET LOCAL lock_timeout='3s';
SET LOCAL statement_timeout='60s';
DO $preflight$ DECLARE p record; BEGIN
 IF current_user<>'postgres' OR current_setting('crm.inquiry_read_ref',true) IS DISTINCT FROM 'rprechiaglyjaydkmxsu' THEN RAISE EXCEPTION 'Staging inquiry read approval required'; END IF;
 SELECT * INTO p FROM pg_proc WHERE oid='public.crm_read_scoped_v2(uuid,integer,uuid,uuid)'::regprocedure;
 IF pg_get_userbyid(p.proowner)<>'postgres' OR NOT p.prosecdef OR coalesce(p.proacl::text,'')<>'{postgres=X/postgres,authenticated=X/postgres}'
  OR md5(pg_get_functiondef(p.oid))<>'c4eb651d77355533220825381b013b88'
 THEN RAISE EXCEPTION 'crm_read_scoped_v2 drift'; END IF;
END $preflight$;
CREATE OR REPLACE FUNCTION public.crm_read_scoped_v2(p_after uuid DEFAULT NULL::uuid, p_limit integer DEFAULT 100, p_deal_id uuid DEFAULT NULL::uuid, p_inquiry_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM crm_security.actor()) OR (p_deal_id IS NOT NULL AND NOT crm_security.can_deal(p_deal_id,false))
 OR (p_inquiry_id IS NOT NULL AND NOT crm_security.can_inquiry(p_inquiry_id)) THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;
 IF p_limit IS NULL OR p_limit<1 OR p_limit>100 THEN RAISE EXCEPTION 'invalid limit' USING ERRCODE='22023'; END IF;
 RETURN jsonb_build_object('contract_version',2,
 'deals',coalesce((SELECT jsonb_agg(to_jsonb(q) ORDER BY q.id) FROM(
 SELECT d.id,d.site_id,d.owner_id,d.stage_code,d.brand,d.primary_work,d.work_items,d.work_scope_type,d.work_summary,d.version FROM public.deals d
 WHERE crm_security.can_deal(d.id,false) AND (p_after IS NULL OR d.id>p_after) AND (p_deal_id IS NULL OR d.id=p_deal_id) ORDER BY d.id LIMIT p_limit) q),'[]'::jsonb),
 'inquiries',coalesce((SELECT jsonb_agg(to_jsonb(q) ORDER BY q.id) FROM(
 SELECT i.id,
  i.sheet_row, i.sheet_row AS "row",
  i.brand,
  i.site_name, i.site_name AS site,
  i.address,
  i.contact_name, i.contact_name AS contact,
  i.phone,
  coalesce(u.name,i.assignee_name) AS assignee_name,
  coalesce(u.name,i.assignee_name) AS assignee,
  i.assigned_to,
  i.status,
  i.deal_id, i.opportunity_id,
  i.received_at, i.created_at, coalesce(i.received_at,i.created_at) AS at,
  i.site_id,
  i.source_channel,
  i.channel,
  i.work_type, i.work_type AS work,
  i.assigned_at,
  i.first_response_at,
  i.responded_at,
  i.next_action_date, i.next_action_date AS due,
  jsonb_build_object(
   'customerType',i.raw->>'고객유형',
   'buildingType',i.raw->>'건물유형',
   'address',coalesce(nullif(i.raw->>'건물주소',''),i.address),
   'complex',i.raw->>'단지개요',
   'workType',coalesce(nullif(i.raw->>'공사유형',''),i.work_type),
   'inquiry',i.raw->>'문의내용',
   'channel',coalesce(nullif(i.raw->>'상담채널',''),i.channel),
   'inflow',coalesce(nullif(i.raw->>'유입경로',''),i.source_channel),
   'office',i.raw->>'관리사무소',
   'note',i.raw->>'특이사항',
   'assignComment',i.raw->>'배정 코멘트',
   'closeReason',coalesce(nullif(i.raw->>'종료사유',''),i.close_reason)
  ) AS detail,
  coalesce(h.items,'[]'::jsonb) AS assignment_history
 FROM public.inquiries i
 LEFT JOIN public.users u ON u.user_id=i.assigned_to
 LEFT JOIN LATERAL (
  SELECT jsonb_agg(jsonb_build_object(
   'id',ah.id,
   'inquiry_id',ah.inquiry_id,
   'from_owner',ah.from_owner,'from',ah.from_owner,
   'to_owner',ah.to_owner,'to',ah.to_owner,
   'reason',ah.reason,
   'actor_name',ah.actor_name,'actor',ah.actor_name,'changed_by',ah.actor_name,
   'changed_at',ah.changed_at,'at',ah.changed_at
  ) ORDER BY ah.changed_at,ah.id) AS items
  FROM public.assignment_history ah WHERE ah.inquiry_id=i.id
 ) h ON true
 WHERE crm_security.can_inquiry(i.id)
 AND (p_after IS NULL OR i.id>p_after) AND (p_inquiry_id IS NULL OR i.id=p_inquiry_id) ORDER BY i.id LIMIT p_limit) q),'[]'::jsonb));
END $function$;
DO $postflight$ DECLARE p record; body text; BEGIN
 SELECT *,pg_get_functiondef(oid) AS body INTO p FROM pg_proc WHERE oid='public.crm_read_scoped_v2(uuid,integer,uuid,uuid)'::regprocedure;
 body:=p.body;
 IF pg_get_userbyid(p.proowner)<>'postgres' OR NOT p.prosecdef OR coalesce(p.proacl::text,'')<>'{postgres=X/postgres,authenticated=X/postgres}'
  OR position('crm_security.can_inquiry(i.id)' in body)=0 OR position('crm_security.can_deal(d.id,false)' in body)=0
  OR position('d.work_scope_type' in body)=0 OR position('d.work_summary' in body)=0
  OR position('parse_responses' in body)>0
 THEN RAISE EXCEPTION 'inquiry read compatibility postflight failed'; END IF;
END $postflight$;
COMMIT;
