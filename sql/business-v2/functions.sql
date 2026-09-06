-- Function bodies used only by the guarded Staging business-contract builder.
CREATE TABLE crm_security.business_events(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), entity_kind text NOT NULL CHECK(entity_kind IN('deal','inquiry')),
 object_id uuid NOT NULL, action text NOT NULL, actor_auth_uid uuid NOT NULL, actor_user_id uuid NOT NULL,
 actor_name text NOT NULL, before_data jsonb NOT NULL, after_data jsonb NOT NULL, reason text NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE crm_security.assignment_rules(
 actor_user_id uuid NOT NULL REFERENCES public.users(user_id), entity_kind text NOT NULL CHECK(entity_kind IN('deal','inquiry')),
 object_id uuid NOT NULL, target_user_id uuid NOT NULL REFERENCES public.users(user_id), expires_at timestamptz NOT NULL,
 PRIMARY KEY(actor_user_id,entity_kind,object_id,target_user_id)
);
ALTER TABLE crm_security.business_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_security.assignment_rules ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE crm_security.business_events,crm_security.assignment_rules FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION crm_security.business_can_write(k text,target uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $fn$
 SELECT CASE WHEN k='deal' THEN crm_security.can_deal(target,true) WHEN k='inquiry' THEN EXISTS(
 SELECT 1 FROM crm_security.actor() a JOIN public.inquiries i ON i.id=target WHERE
 (a.permission_role IN('rep','consultation') AND i.assigned_to=a.user_id) OR
 (a.permission_role IN('branch','admin') AND EXISTS(SELECT 1 FROM crm_security.object_scope s WHERE s.user_id=a.user_id AND s.inquiry_id=target AND s.can_write AND s.expires_at>now()))) ELSE false END
$fn$;
CREATE FUNCTION crm_security.business_lock(k text,target uuid,token text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
DECLARE r jsonb; BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;
 PERFORM 1 FROM public.users WHERE auth_uid=auth.uid() FOR SHARE;
 PERFORM 1 FROM crm_security.access_review WHERE reviewed_auth_uid=auth.uid() FOR SHARE;
 PERFORM 1 FROM crm_security.object_scope s JOIN crm_security.actor() a ON a.user_id=s.user_id WHERE s.deal_id=target OR s.inquiry_id=target FOR SHARE OF s;
 IF NOT crm_security.business_can_write(k,target) THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;
 IF k='deal' THEN SELECT to_jsonb(d) INTO r FROM public.deals d WHERE id=target FOR UPDATE;
 ELSE SELECT to_jsonb(i) INTO r FROM public.inquiries i WHERE id=target FOR UPDATE; END IF;
 IF r IS NULL OR NOT crm_security.business_can_write(k,target) THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;
 IF token IS NULL OR (k='deal' AND r->>'version' IS DISTINCT FROM token) OR (k='inquiry' AND (r->>'updated_at')::timestamptz IS DISTINCT FROM token::timestamptz) THEN RAISE EXCEPTION 'version conflict' USING ERRCODE='PT409'; END IF;
 RETURN r;
END $fn$;
CREATE FUNCTION crm_security.business_log(k text,target uuid,act text,before_row jsonb,after_row jsonb,why text) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
DECLARE a record; eid uuid; BEGIN
 SELECT * INTO a FROM crm_security.actor(); IF NOT FOUND THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;
 IF why IS NULL OR length(trim(why))<2 OR length(why)>2000 THEN RAISE EXCEPTION 'reason required' USING ERRCODE='22023'; END IF;
 INSERT INTO crm_security.business_events(entity_kind,object_id,action,actor_auth_uid,actor_user_id,actor_name,before_data,after_data,reason)
 VALUES(k,target,act,a.auth_uid,a.user_id,a.display_name,before_row,after_row,why) RETURNING id INTO eid;
 RETURN eid;
END $fn$;
CREATE FUNCTION public.crm_deals_scoped_v2(p_after uuid DEFAULT NULL,p_limit integer DEFAULT 100) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $fn$
DECLARE rows jsonb; total bigint; BEGIN
 IF NOT EXISTS(SELECT 1 FROM crm_security.actor()) THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;
 IF p_limit IS NULL OR p_limit<1 OR p_limit>100 THEN RAISE EXCEPTION 'invalid limit' USING ERRCODE='22023'; END IF;
 SELECT count(*) INTO total FROM public.deals d WHERE crm_security.can_deal(d.id,false) AND (p_after IS NULL OR d.id>p_after);
 SELECT coalesce(jsonb_agg(to_jsonb(q) ORDER BY q.id),'[]') INTO rows FROM(
 SELECT d.id,d.site_id,s.site_name,d.owner_id,u.name AS owner_name,d.brand,d.stage_code,d.amount::text AS amount,d.version,d.primary_work,d.work_items,d.work_summary,d.created_at,d.stage_entered_at,d.last_activity_at,d.lifecycle_status,
 crm_security.business_can_write('deal',d.id) can_write,EXISTS(SELECT 1 FROM crm_security.assignment_rules ar JOIN crm_security.actor() a ON a.user_id=ar.actor_user_id WHERE ar.entity_kind='deal' AND ar.object_id=d.id AND ar.expires_at>now()) can_assign
 FROM public.deals d LEFT JOIN public.sites s ON s.site_id=d.site_id LEFT JOIN public.users u ON u.user_id=d.owner_id
 WHERE crm_security.can_deal(d.id,false) AND (p_after IS NULL OR d.id>p_after) ORDER BY d.id LIMIT p_limit) q;
 RETURN jsonb_build_object('contract_version',3,'coverage',CASE WHEN total>p_limit THEN 'partial' ELSE 'complete' END,'scope','authorized_only','rows',rows,'has_more',total>p_limit);
END $fn$;
CREATE FUNCTION public.crm_inquiries_scoped_v2(p_after uuid DEFAULT NULL,p_limit integer DEFAULT 100) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $fn$
DECLARE rows jsonb; total bigint; BEGIN
 IF NOT EXISTS(SELECT 1 FROM crm_security.actor()) THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;
 IF p_limit IS NULL OR p_limit<1 OR p_limit>100 THEN RAISE EXCEPTION 'invalid limit' USING ERRCODE='22023'; END IF;
 SELECT count(*) INTO total FROM public.inquiries i WHERE crm_security.can_inquiry(i.id) AND (p_after IS NULL OR i.id>p_after);
 SELECT coalesce(jsonb_agg(to_jsonb(q) ORDER BY q.id),'[]') INTO rows FROM(
 SELECT i.id,i.site_id,i.site_name,i.brand,i.address,i.contact_name,i.phone,i.work_type,coalesce(i.raw->>'message',i.raw->>'inquiry',i.raw->>'note') content,i.status,i.received_at,i.created_at,i.assigned_to,u.name AS owner_name,i.assigned_at,i.first_response_at,i.responded_at,i.next_action_date,i.updated_at,
 CASE WHEN i.deal_id IS NOT NULL AND crm_security.can_deal(i.deal_id,false) THEN i.deal_id ELSE NULL END AS deal_id,
 crm_security.business_can_write('inquiry',i.id) can_write,EXISTS(SELECT 1 FROM crm_security.assignment_rules ar JOIN crm_security.actor() a ON a.user_id=ar.actor_user_id WHERE ar.entity_kind='inquiry' AND ar.object_id=i.id AND ar.expires_at>now()) can_assign
 FROM public.inquiries i LEFT JOIN public.users u ON u.user_id=i.assigned_to WHERE crm_security.can_inquiry(i.id) AND (p_after IS NULL OR i.id>p_after) ORDER BY i.id LIMIT p_limit) q;
 RETURN jsonb_build_object('contract_version',3,'coverage',CASE WHEN total>p_limit THEN 'partial' ELSE 'complete' END,'scope','authorized_only','rows',rows,'has_more',total>p_limit);
END $fn$;
CREATE FUNCTION public.crm_dashboard_scoped_v2(p_from date DEFAULT NULL,p_to date DEFAULT NULL,p_brand text DEFAULT NULL,p_owner uuid DEFAULT NULL) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $fn$
DECLARE a record; groups jsonb; n bigint; unknowns bigint; amount_value numeric; ni bigint; BEGIN
 SELECT * INTO a FROM crm_security.actor(); IF NOT FOUND THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;
 IF (p_from IS NOT NULL AND p_to IS NOT NULL AND p_from>p_to) THEN RAISE EXCEPTION 'invalid period' USING ERRCODE='22023'; END IF;
 SELECT count(*) INTO ni FROM public.inquiries i WHERE crm_security.can_inquiry(i.id) AND (p_brand IS NULL OR i.brand=p_brand) AND (p_owner IS NULL OR i.assigned_to=p_owner)
 AND (p_from IS NULL OR coalesce(i.received_at,i.created_at)>=(p_from::timestamp AT TIME ZONE 'Asia/Seoul')) AND (p_to IS NULL OR coalesce(i.received_at,i.created_at)<((p_to+1)::timestamp AT TIME ZONE 'Asia/Seoul'));
 IF a.permission_role='consultation' THEN RETURN jsonb_build_object('contract_version',3,'coverage','complete','scope','authorized_only','company_coverage','partial','inquiries',ni,'sales_status','unavailable','deals',NULL,'amount',NULL,'groups','[]'::jsonb); END IF;
 WITH allowed AS (SELECT d.* FROM public.deals d WHERE crm_security.can_deal(d.id,false) AND (p_brand IS NULL OR d.brand=p_brand) AND (p_owner IS NULL OR d.owner_id=p_owner)
 AND (p_from IS NULL OR d.created_at>=(p_from::timestamp AT TIME ZONE 'Asia/Seoul')) AND (p_to IS NULL OR d.created_at<((p_to+1)::timestamp AT TIME ZONE 'Asia/Seoul')))
 SELECT count(*),count(*) FILTER(WHERE amount IS NULL),sum(amount),
 (SELECT coalesce(jsonb_agg(to_jsonb(g)),'[]') FROM(SELECT brand,stage_code,owner_id,count(*) count,sum(amount)::text amount FROM allowed GROUP BY brand,stage_code,owner_id ORDER BY brand,stage_code,owner_id) g)
 INTO n,unknowns,amount_value,groups FROM allowed;
 RETURN jsonb_build_object('contract_version',3,'coverage','complete','scope','authorized_only','company_coverage','partial','sales_status','available','deals',n,'inquiries',ni,'amount',coalesce(amount_value,0)::text,'unknown_amount_count',unknowns,'groups',groups);
END $fn$;
CREATE FUNCTION public.crm_assignment_targets_scoped_v2(p_kind text,p_id uuid) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $fn$
BEGIN
 IF NOT crm_security.business_can_write(p_kind,p_id) THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;
 RETURN (SELECT coalesce(jsonb_agg(jsonb_build_object('user_id',u.user_id,'name',u.name) ORDER BY u.user_id),'[]')
 FROM crm_security.assignment_rules r JOIN crm_security.actor() a ON a.user_id=r.actor_user_id AND a.permission_role='admin'
 JOIN public.users u ON u.user_id=r.target_user_id JOIN crm_security.access_review ar ON ar.user_id=u.user_id AND ar.reviewed_auth_uid=u.auth_uid AND ar.source_role=u.role
 WHERE r.entity_kind=p_kind AND r.object_id=p_id AND r.expires_at>now() AND ar.approved AND ar.expires_at>now() AND u.active
 AND u.auth_uid IS NOT NULL AND (SELECT count(*) FROM public.users du WHERE du.auth_uid=u.auth_uid)=1
 AND (p_kind='inquiry' OR ar.permission_role<>'consultation')
 AND (ar.permission_role NOT IN('branch','admin') OR EXISTS(SELECT 1 FROM crm_security.object_scope ts WHERE ts.user_id=u.user_id AND ts.expires_at>now() AND ((p_kind='deal' AND ts.deal_id=p_id) OR (p_kind='inquiry' AND ts.inquiry_id=p_id)))));
END $fn$;
CREATE FUNCTION public.crm_assign_scoped_v2(p_kind text,p_id uuid,p_target uuid,p_token text,p_reason text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
DECLARE oldrow jsonb; result jsonb; target_name text; BEGIN
 oldrow:=crm_security.business_lock(p_kind,p_id,p_token);
 PERFORM 1 FROM public.users WHERE user_id=p_target FOR SHARE;
 PERFORM 1 FROM crm_security.access_review WHERE user_id=p_target FOR SHARE;
 PERFORM 1 FROM crm_security.assignment_rules r WHERE r.entity_kind=p_kind AND r.object_id=p_id AND r.target_user_id=p_target FOR SHARE;
 IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(public.crm_assignment_targets_scoped_v2(p_kind,p_id)) t WHERE (t->>'user_id')::uuid=p_target) THEN RAISE EXCEPTION 'assignment forbidden' USING ERRCODE='42501'; END IF;
 SELECT name INTO target_name FROM public.users WHERE user_id=p_target AND active FOR SHARE;
 IF p_kind='deal' THEN UPDATE public.deals SET owner_id=p_target,assignee_name=target_name,assignee_email=NULL,version=version+1 WHERE id=p_id RETURNING to_jsonb(deals) INTO result;
 ELSE UPDATE public.inquiries SET assigned_to=p_target,assignee_name=target_name,assigned_at=now(),updated_at=clock_timestamp() WHERE id=p_id RETURNING to_jsonb(inquiries) INTO result; END IF;
 PERFORM crm_security.business_log(p_kind,p_id,'assignment',oldrow,result,p_reason);
 RETURN jsonb_build_object('id',p_id,'saved',true);
END $fn$;
CREATE FUNCTION public.crm_inquiry_status_scoped_v2(p_id uuid,p_status text,p_token text,p_reason text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
DECLARE oldrow jsonb; result jsonb; BEGIN
 oldrow:=crm_security.business_lock('inquiry',p_id,p_token);
 IF p_status IS NULL OR p_status NOT IN('접수','배정완료','응대중','전화응대 완료','현장방문예정','견적진행','종료') THEN RAISE EXCEPTION 'invalid status' USING ERRCODE='22023'; END IF;
 UPDATE public.inquiries SET status=p_status,close_reason=CASE WHEN p_status='종료' THEN p_reason ELSE NULL END,updated_at=clock_timestamp() WHERE id=p_id RETURNING to_jsonb(inquiries) INTO result;
 PERFORM crm_security.business_log('inquiry',p_id,'status',oldrow,result,p_reason); RETURN jsonb_build_object('id',p_id,'saved',true);
END $fn$;
CREATE FUNCTION public.crm_inquiry_response_scoped_v2(p_id uuid,p_note text,p_token text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
DECLARE oldrow jsonb; result jsonb; BEGIN
 oldrow:=crm_security.business_lock('inquiry',p_id,p_token);
 UPDATE public.inquiries SET first_response_at=coalesce(first_response_at,now()),responded_at=now(),status='전화응대 완료',updated_at=clock_timestamp() WHERE id=p_id RETURNING to_jsonb(inquiries) INTO result;
 PERFORM crm_security.business_log('inquiry',p_id,'response',oldrow,result,p_note); RETURN jsonb_build_object('id',p_id,'saved',true);
END $fn$;
CREATE FUNCTION public.crm_deal_stage_scoped_v2(p_id uuid,p_stage text,p_version integer,p_reason text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
DECLARE oldrow jsonb; result jsonb; outcome_value text; BEGIN
 oldrow:=crm_security.business_lock('deal',p_id,p_version::text);
 IF p_stage IS NULL OR p_stage NOT IN('first_contact','consulting','sent','rapport','silent','waiting','compete','imminent','bidding','contract','construction','completion','won','lost','badfit','badfit_lead','badfit_pipe','nocontact') THEN RAISE EXCEPTION 'invalid stage' USING ERRCODE='22023'; END IF;
 outcome_value:=CASE WHEN p_stage IN('won','lost','nocontact') THEN p_stage WHEN p_stage IN('badfit','badfit_lead','badfit_pipe') THEN 'badfit' ELSE NULL END;
 UPDATE public.deals SET stage_code=p_stage,stage_raw=p_stage,stage_group=CASE WHEN outcome_value IS NOT NULL THEN 'closed' WHEN p_stage IN('first_contact','consulting') THEN 'design' WHEN p_stage='sent' THEN 'sent' WHEN p_stage IN('rapport','silent','waiting') THEN 'rel' WHEN p_stage IN('compete','imminent','bidding') THEN 'comp' ELSE 'con' END,stage_entered_at=now(),outcome=outcome_value,lifecycle_status=CASE WHEN outcome_value IS NOT NULL THEN 'closed' WHEN p_stage='waiting' THEN 'parked' ELSE 'active' END,closed_at=CASE WHEN outcome_value IS NOT NULL THEN now() ELSE NULL END,version=version+1 WHERE id=p_id RETURNING to_jsonb(deals) INTO result;
 PERFORM crm_security.business_log('deal',p_id,'stage',oldrow,result,p_reason); RETURN jsonb_build_object('id',p_id,'version',result->'version');
END $fn$;
CREATE FUNCTION public.crm_deal_amount_scoped_v2(p_id uuid,p_amount bigint,p_version integer,p_reason text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
DECLARE oldrow jsonb; result jsonb; BEGIN
 oldrow:=crm_security.business_lock('deal',p_id,p_version::text);
 IF p_amount IS NULL OR p_amount<0 OR p_amount>9007199254740991 THEN RAISE EXCEPTION 'invalid amount' USING ERRCODE='22023'; END IF;
 UPDATE public.deals SET amount=p_amount,version=version+1 WHERE id=p_id RETURNING to_jsonb(deals) INTO result;
 PERFORM crm_security.business_log('deal',p_id,'amount',oldrow,result,p_reason); RETURN jsonb_build_object('id',p_id,'version',result->'version');
END $fn$;
CREATE FUNCTION public.crm_activity_add_scoped_v2(p_kind text,p_id uuid,p_type text,p_note text,p_token text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
DECLARE oldrow jsonb; a record; eid uuid; BEGIN
 oldrow:=crm_security.business_lock(p_kind,p_id,p_token); SELECT * INTO a FROM crm_security.actor();
 IF p_type IS NULL OR p_type NOT IN('전화','미팅','업무','메모') THEN RAISE EXCEPTION 'invalid activity type' USING ERRCODE='22023'; END IF;
 IF p_kind='deal' THEN UPDATE public.deals SET last_activity_at=now(),last_customer_contact_at=CASE WHEN p_type IN('전화','미팅') THEN now() ELSE last_customer_contact_at END,version=version+1 WHERE id=p_id;
 ELSE UPDATE public.inquiries SET updated_at=clock_timestamp() WHERE id=p_id; END IF;
 eid:=crm_security.business_log(p_kind,p_id,'activity',oldrow,jsonb_build_object('type',p_type,'note',p_note),p_note);
 RETURN jsonb_build_object('id',eid,'saved',true);
END $fn$;
CREATE FUNCTION public.crm_next_add_scoped_v2(p_kind text,p_id uuid,p_type text,p_title text,p_due timestamptz,p_token text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
DECLARE oldrow jsonb; na jsonb; owner_name text; BEGIN
 oldrow:=crm_security.business_lock(p_kind,p_id,p_token);
 IF p_title IS NULL OR length(trim(p_title))<2 OR length(p_title)>500 OR p_due IS NULL OR NOT isfinite(p_due) OR p_type IS NULL OR p_type NOT IN('전화','미팅','업무','후속확인') THEN RAISE EXCEPTION 'invalid next action' USING ERRCODE='22023'; END IF;
 SELECT name INTO owner_name FROM public.users WHERE user_id=CASE WHEN p_kind='deal' THEN (oldrow->>'owner_id')::uuid ELSE (oldrow->>'assigned_to')::uuid END;
 IF owner_name IS NULL THEN RAISE EXCEPTION 'No UUID owner' USING ERRCODE='42501'; END IF;
 INSERT INTO public.next_actions(deal_id,inquiry_id,action_type,title,due_at,assignee_name) VALUES(CASE WHEN p_kind='deal' THEN p_id END,CASE WHEN p_kind='inquiry' THEN p_id END,p_type,p_title,p_due,owner_name) RETURNING to_jsonb(next_actions) INTO na;
 IF p_kind='deal' THEN UPDATE public.deals SET next_action=p_title,next_action_date=(p_due AT TIME ZONE 'Asia/Seoul')::date,version=version+1 WHERE id=p_id;
 ELSE UPDATE public.inquiries SET next_action_date=(p_due AT TIME ZONE 'Asia/Seoul')::date,updated_at=clock_timestamp() WHERE id=p_id; END IF;
 PERFORM crm_security.business_log(p_kind,p_id,'next_action',oldrow,na,p_title); RETURN jsonb_build_object('id',na->'id','saved',true);
END $fn$;
CREATE FUNCTION public.crm_today_scoped_v2(p_day date DEFAULT (now() AT TIME ZONE 'Asia/Seoul')::date) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $fn$
DECLARE tasks jsonb; missed jsonb; events jsonb; n bigint; m bigint; BEGIN
 IF NOT EXISTS(SELECT 1 FROM crm_security.actor()) THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;
 IF p_day IS NULL THEN RAISE EXCEPTION 'invalid day' USING ERRCODE='22023'; END IF;
 SELECT count(*) INTO n FROM public.next_actions na WHERE na.status='open' AND (crm_security.can_deal(na.deal_id,false) OR crm_security.can_inquiry(na.inquiry_id));
 SELECT coalesce(jsonb_agg(to_jsonb(q) ORDER BY q.due_at,q.id),'[]') INTO tasks FROM(
 SELECT na.id,CASE WHEN na.deal_id IS NULL THEN 'inquiry' ELSE 'deal' END entity_kind,coalesce(na.deal_id,na.inquiry_id) object_id,na.title,na.action_type,na.due_at,na.status,
 CASE WHEN (na.due_at AT TIME ZONE 'Asia/Seoul')::date<p_day THEN 'overdue' WHEN (na.due_at AT TIME ZONE 'Asia/Seoul')::date=p_day THEN 'today' ELSE 'upcoming' END bucket
 FROM public.next_actions na WHERE na.status='open' AND (crm_security.can_deal(na.deal_id,false) OR crm_security.can_inquiry(na.inquiry_id)) ORDER BY due_at,id LIMIT 100) q;
 SELECT coalesce(jsonb_agg(to_jsonb(q) ORDER BY q.id),'[]') INTO missed FROM(SELECT i.id,i.site_name,'inquiry'::text entity_kind FROM public.inquiries i WHERE crm_security.can_inquiry(i.id) AND i.first_response_at IS NULL AND coalesce(i.status,'')<>'종료' ORDER BY id LIMIT 100) q;
 SELECT count(*) INTO m FROM public.inquiries i WHERE crm_security.can_inquiry(i.id) AND i.first_response_at IS NULL AND coalesce(i.status,'')<>'종료';
 SELECT coalesce(jsonb_agg(to_jsonb(q) ORDER BY q.created_at DESC),'[]') INTO events FROM(
 SELECT * FROM (SELECT e.id,e.entity_kind,e.object_id,e.action,e.actor_name,e.reason,e.created_at FROM crm_security.business_events e WHERE (e.entity_kind='deal' AND crm_security.can_deal(e.object_id,false)) OR (e.entity_kind='inquiry' AND crm_security.can_inquiry(e.object_id))
 UNION ALL SELECT a.id,'deal',a.deal_id,a.type,a.actor_name,coalesce(a.detail->>'note',a.type),a.occurred_at FROM public.activities a WHERE crm_security.can_deal(a.deal_id,false)) all_events ORDER BY created_at DESC,id LIMIT 30) q;
 RETURN jsonb_build_object('contract_version',3,'coverage',CASE WHEN n>100 OR m>100 THEN 'partial' ELSE 'complete' END,'scope','authorized_only','tasks',tasks,'unresponded',missed,'recent_activity',events,'day',p_day);
END $fn$;
CREATE FUNCTION public.crm_next_complete_scoped_v2(p_action_id uuid,p_token text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
DECLARE na public.next_actions%ROWTYPE; k text; target uuid; oldrow jsonb; BEGIN
 SELECT * INTO na FROM public.next_actions WHERE id=p_action_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;
 k:=CASE WHEN na.deal_id IS NULL THEN 'inquiry' ELSE 'deal' END; target:=coalesce(na.deal_id,na.inquiry_id);
 oldrow:=crm_security.business_lock(k,target,p_token);
 UPDATE public.next_actions SET status='completed',completed_at=now() WHERE id=p_action_id AND status='open';
 IF NOT FOUND THEN RAISE EXCEPTION 'action already closed' USING ERRCODE='PT409'; END IF;
 IF k='deal' THEN UPDATE public.deals SET version=version+1 WHERE id=target; ELSE UPDATE public.inquiries SET updated_at=clock_timestamp() WHERE id=target; END IF;
 PERFORM crm_security.business_log(k,target,'next_complete',to_jsonb(na),jsonb_build_object('id',p_action_id,'status','completed'),'다음 행동 완료'); RETURN jsonb_build_object('id',p_action_id,'saved',true);
END $fn$;
