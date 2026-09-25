-- 운영 DB 스냅샷 (2026-09-25) — 화면이 호출하지만 저장소에 SQL이 없던 RPC 4개의 정의를 운영에서 그대로 추출(pg_get_functiondef).
-- 목적: "화면이 쓰는 RPC는 전부 저장소에 정의가 있다"(tests/release-contract.test.cjs) 계약을 성립시키고, 운영 재구축 시 복원 근거로 쓴다.
-- 운영 권한(추출 시점): 4개 모두 authenticated EXECUTE, anon 없음. 재적용해도 동작 변화 없음(CREATE OR REPLACE).

CREATE OR REPLACE FUNCTION public.crm_advisory_bid_summary_v1()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
 if not exists(select 1 from crm_security.actor() a where a.permission_role='admin') then
  raise exception 'forbidden' using errcode='42501';
 end if;
 return (select jsonb_build_object('ok',true,
  'total',count(*),
  'with_bid',count(*) filter (where bid_amount>0),
  'bid_sum',coalesce(sum(bid_amount),0),
  'jandi',count(*) filter (where origin_channel='jandi'),
  'owners',coalesce((select jsonb_agg(jsonb_build_object('name',o.owner_name,'n',o.n,'sum',o.s) order by o.s desc)
    from (select coalesce(nullif(owner_name,''),'미지정') owner_name, count(*) n, coalesce(sum(bid_amount),0) s
          from public.advisory_deals group by 1) o),'[]'::jsonb))
  from public.advisory_deals);
end $function$;
revoke all on function public.crm_advisory_bid_summary_v1() from public, anon;
grant execute on function public.crm_advisory_bid_summary_v1() to authenticated;

CREATE OR REPLACE FUNCTION public.crm_advisory_site_read_v1(p_deal_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
 if not coalesce(crm_security.can_deal(p_deal_id,false),false) then
  raise exception 'forbidden' using errcode='42501';
 end if;
 return jsonb_build_object('ok',true,'scope','site','items',coalesce((
 select jsonb_agg(jsonb_build_object('source_project_id',l.project_id,
 'advisory_id',a.advisory_id,'contracts',jsonb_build_array(c.value)))
 from public.deals d join public.advisory_deals a on a.site_id=d.site_id
 join crm_security.advisory_record_links l on l.advisory_id=a.advisory_id
 join crm_security.advisory_snapshots s on s.project_id=l.project_id
 cross join lateral jsonb_array_elements(s.snapshot->'contracts') c
 where d.id=p_deal_id and c.value->>'source_document_id'=l.document_id
 and exists(select 1 from crm_security.actor() actor where actor.permission_role='admin'
 or exists(select 1 from crm_security.advisory_read_grants g
 where g.advisory_id=a.advisory_id and g.user_id=actor.user_id and g.expires_at>now()))
 ),'[]'::jsonb));
end $function$;
revoke all on function public.crm_advisory_site_read_v1(uuid) from public, anon;
grant execute on function public.crm_advisory_site_read_v1(uuid) to authenticated;

CREATE OR REPLACE FUNCTION public.crm_manager_request_create_v1(p_id uuid, p_target uuid, p_kind text, p_due timestamp with time zone, p_instruction text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE a record; ack jsonb; prior record; owner_id uuid; old_plan record; payload jsonb;
BEGIN
 SELECT * INTO a FROM crm_security.actor();
 IF NOT FOUND OR a.permission_role<>'admin' OR NOT crm_security.can_inquiry(p_target) THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;
 IF p_id IS NULL OR p_kind IS NULL OR p_kind NOT IN ('call','next') OR p_due IS NULL OR p_instruction IS NULL OR length(btrim(p_instruction)) NOT BETWEEN 1 AND 2000 THEN RAISE EXCEPTION 'invalid request' USING ERRCODE='22023'; END IF;
 -- Lock the target to serialize duplicate requests and owner changes.
 SELECT assigned_to INTO owner_id FROM public.inquiries WHERE id=p_target FOR UPDATE;
 SELECT c.*,m.kind,m.due_at,m.instruction INTO prior FROM crm_security.customer_support_actions c JOIN crm_security.manager_request_plans m ON m.support_id=c.id WHERE c.request_id=p_id;
 IF FOUND THEN
  IF prior.requested_by_user_id IS DISTINCT FROM a.user_id OR prior.target_id IS DISTINCT FROM p_target OR prior.kind IS DISTINCT FROM p_kind OR prior.due_at IS DISTINCT FROM p_due OR prior.instruction IS DISTINCT FROM btrim(p_instruction) THEN RAISE EXCEPTION 'REQUEST_ID_REUSE' USING ERRCODE='PT409'; END IF;
  RETURN jsonb_build_object('ok',true,'id',prior.id,'request_id',p_id,'replayed',true,'delivery','not_sent');
 END IF;
 IF p_due<=clock_timestamp() THEN RAISE EXCEPTION 'deadline must be future' USING ERRCODE='22023'; END IF;
 IF EXISTS(SELECT 1 FROM crm_security.customer_support_actions c JOIN crm_security.manager_request_plans m ON m.support_id=c.id WHERE c.target_type='inq' AND c.target_id=p_target AND c.rep_user_id=owner_id AND m.kind=p_kind AND crm_security.manager_request_evidence_v1(c.id) IS NULL) THEN RAISE EXCEPTION 'UNRESOLVED_REQUEST_EXISTS' USING ERRCODE='PT409'; END IF;
 payload:=jsonb_build_object('client_ref','support-'||floor(extract(epoch FROM clock_timestamp())*1000)::bigint||'-'||substr(replace(p_id::text,'-',''),1,5),'target_type','inq','action_key',CASE p_kind WHEN 'call' THEN 'response_request' WHEN 'next' THEN 'recontact_schedule' ELSE 'inquiry_review' END,'action_label',p_kind,'reason',btrim(p_instruction),'completion_rule',p_kind);
 ack:=crm_security.crm_customer_support_action_command_v1(p_id,'customer_support_action',p_target,0,payload);
 INSERT INTO crm_security.manager_request_plans(support_id,kind,due_at,instruction) VALUES((ack->>'support_action_id')::uuid,p_kind,p_due,btrim(p_instruction));
 RETURN jsonb_build_object('ok',true,'id',ack->>'support_action_id','request_id',p_id,'replayed',false,'delivery','not_sent');
END $function$;
revoke all on function public.crm_manager_request_create_v1(uuid,uuid,text,timestamp with time zone,text) from public, anon;
grant execute on function public.crm_manager_request_create_v1(uuid,uuid,text,timestamp with time zone,text) to authenticated;

CREATE OR REPLACE FUNCTION public.crm_manager_request_list_v1()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE a record; result jsonb;
BEGIN
 SELECT * INTO a FROM crm_security.actor();IF NOT FOUND THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501';END IF;
 SELECT coalesce(jsonb_agg(x.row ORDER BY x.due_at),'[]'::jsonb) INTO result FROM (
 SELECT m.due_at,jsonb_build_object('id',c.id,'target_id',c.target_id,'target_type',c.target_type,'assignee_id',c.rep_user_id,'requested_by',c.requested_by_name,'requested_at',c.requested_at,'kind',m.kind,'due_at',m.due_at,'instruction',m.instruction,'state',CASE WHEN crm_security.manager_request_evidence_v1(c.id) IS NOT NULL THEN 'completed' WHEN m.due_at<now() THEN 'overdue' ELSE 'requested' END,'completion',crm_security.manager_request_evidence_v1(c.id),'delivery','not_sent') row
 FROM crm_security.manager_request_plans m JOIN crm_security.customer_support_actions c ON c.id=m.support_id
 WHERE c.target_type='inq' AND crm_security.can_inquiry(c.target_id) AND (a.permission_role='admin' OR c.rep_user_id=a.user_id)
 ) x;
 RETURN result;
END $function$;
revoke all on function public.crm_manager_request_list_v1() from public, anon;
grant execute on function public.crm_manager_request_list_v1() to authenticated;
