-- STAGING ONLY: common UUID compatibility bundle for the remaining reachable CRM writes.
-- Target: netform-crm-staging / rprechiaglyjaydkmxsu. Production and n8n are forbidden.
BEGIN;
SET LOCAL search_path=pg_catalog;
SET LOCAL lock_timeout='3s';
SET LOCAL statement_timeout='180s';
SET LOCAL crm.operational_go_ref='rprechiaglyjaydkmxsu';

DO $guard$ DECLARE w record; r record; BEGIN
 SELECT * INTO w FROM pg_proc WHERE oid='public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)'::regprocedure;
 SELECT * INTO r FROM pg_proc WHERE oid='public.crm_operational_source_v1(text,uuid,integer)'::regprocedure;
 IF current_user<>'postgres'
  OR current_setting('crm.operational_go_ref',true) IS DISTINCT FROM 'rprechiaglyjaydkmxsu'
  OR md5(pg_get_functiondef(w.oid)) IS DISTINCT FROM '432d79d939cd782a318034089fbb6c95'
  OR md5(pg_get_functiondef(r.oid)) IS DISTINCT FROM '3883c86d284982544eb9e9cb380ca7c3'
  OR to_regprocedure('crm_security.crm_write_command_v2_pre_go_20260907(uuid,text,uuid,integer,jsonb)') IS NOT NULL
  OR to_regprocedure('crm_security.crm_operational_source_v1_pre_go_20260907(text,uuid,integer)') IS NOT NULL
  OR to_regclass('crm_security.user_capabilities') IS NOT NULL
  OR to_regclass('crm_security.inquiry_routing') IS NOT NULL
  OR to_regclass('crm_security.contact_compat_state') IS NOT NULL
  OR to_regclass('crm_security.rep_manager_comments') IS NOT NULL
 THEN RAISE EXCEPTION 'operational GO candidate target or catalog drift'; END IF;
END $guard$;

ALTER FUNCTION public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)
 RENAME TO crm_write_command_v2_pre_go_20260907;
ALTER FUNCTION public.crm_write_command_v2_pre_go_20260907(uuid,text,uuid,integer,jsonb)
 SET SCHEMA crm_security;
ALTER FUNCTION public.crm_operational_source_v1(text,uuid,integer)
 RENAME TO crm_operational_source_v1_pre_go_20260907;
ALTER FUNCTION public.crm_operational_source_v1_pre_go_20260907(text,uuid,integer)
 SET SCHEMA crm_security;
REVOKE EXECUTE ON FUNCTION crm_security.crm_write_command_v2_pre_go_20260907(uuid,text,uuid,integer,jsonb) FROM PUBLIC,anon,authenticated,service_role;
REVOKE EXECUTE ON FUNCTION crm_security.crm_operational_source_v1_pre_go_20260907(text,uuid,integer) FROM PUBLIC,anon,authenticated,service_role;

CREATE TABLE crm_security.user_capabilities(
 user_id uuid PRIMARY KEY REFERENCES public.users(user_id) ON DELETE CASCADE,
 routing_group text NOT NULL CHECK(routing_group IN('head_office','gyeongnam')),
 pipeline_assignable boolean NOT NULL DEFAULT false,
 inquiry_assignable boolean NOT NULL DEFAULT false,
 inquiry_consultable boolean NOT NULL DEFAULT false,
 branch_owner boolean NOT NULL DEFAULT false,
 performance_included boolean NOT NULL DEFAULT false,
 reviewed_at timestamptz NOT NULL DEFAULT now(),
 reviewed_by text NOT NULL
);
ALTER TABLE crm_security.user_capabilities ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON crm_security.user_capabilities FROM PUBLIC,anon,authenticated,service_role;

INSERT INTO crm_security.user_capabilities(
 user_id,routing_group,pipeline_assignable,inquiry_assignable,inquiry_consultable,
 branch_owner,performance_included,reviewed_by)
SELECT u.user_id,
 CASE WHEN ar.permission_role='branch' THEN 'gyeongnam' ELSE 'head_office' END,
 ar.permission_role IN('rep','branch'),
 ar.permission_role='rep',
 ar.permission_role IN('rep','branch','consultation'),
 ar.permission_role='branch',
 ar.permission_role IN('rep','branch'),
 'Staging reviewed permission_role compatibility seed'
FROM public.users u JOIN crm_security.access_review ar ON ar.user_id=u.user_id
WHERE u.active AND ar.approved AND ar.reviewed_auth_uid=u.auth_uid
 AND ar.source_role=u.role AND ar.expires_at>now();

CREATE TABLE crm_security.inquiry_routing(
 inquiry_id uuid PRIMARY KEY REFERENCES public.inquiries(id) ON DELETE CASCADE,
 consultant_user_id uuid REFERENCES public.users(user_id) ON DELETE SET NULL,
 branch_code text CHECK(branch_code IS NULL OR branch_code='gyeongnam'),
 routing_group text CHECK(routing_group IS NULL OR routing_group IN('head_office','gyeongnam')),
 updated_by_auth_uid uuid NOT NULL,
 updated_by_user_id uuid NOT NULL REFERENCES public.users(user_id),
 updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE crm_security.inquiry_routing ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON crm_security.inquiry_routing FROM PUBLIC,anon,authenticated,service_role;

CREATE TABLE crm_security.contact_compat_state(
 contact_id uuid NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
 deal_id uuid NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,
 decision_role text,
 relationship_tone text,
 sms_consent boolean NOT NULL DEFAULT false,
 kakao_consent boolean NOT NULL DEFAULT false,
 consent_at timestamptz,
 opt_out_at timestamptz,
 send_blocked boolean NOT NULL DEFAULT false,
 send_blocked_reason text,
 updated_by_auth_uid uuid NOT NULL,
 updated_by_user_id uuid NOT NULL REFERENCES public.users(user_id),
 updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(contact_id,deal_id),
 CHECK(decision_role IS NULL OR decision_role IN('의사결정자','핵심담당자','실무자','영향자','정보제공자')),
 CHECK(relationship_tone IS NULL OR relationship_tone IN('우호적','중립','부정적','미확인')),
 CHECK(NOT send_blocked OR (NOT sms_consent AND NOT kakao_consent))
);
ALTER TABLE crm_security.contact_compat_state ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON crm_security.contact_compat_state FROM PUBLIC,anon,authenticated,service_role;

CREATE TABLE crm_security.rep_manager_comments(
 rep_user_id uuid NOT NULL REFERENCES public.users(user_id) ON DELETE CASCADE,
 week_start date NOT NULL,
 comment text NOT NULL CHECK(length(btrim(comment)) BETWEEN 1 AND 8000),
 status text NOT NULL CHECK(status IN('open','done')),
 created_by_auth_uid uuid NOT NULL,
 created_by_user_id uuid NOT NULL REFERENCES public.users(user_id),
 completed_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(rep_user_id,week_start)
);
ALTER TABLE crm_security.rep_manager_comments ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON crm_security.rep_manager_comments FROM PUBLIC,anon,authenticated,service_role;

LOCK TABLE crm_security.command_receipts IN ACCESS EXCLUSIVE MODE;
ALTER TABLE crm_security.command_receipts DROP CONSTRAINT command_receipts_operation_check;
ALTER TABLE crm_security.command_receipts ADD CONSTRAINT command_receipts_operation_check
 CHECK(operation=ANY(ARRAY[
 'opportunity_work_set','inquiry_assign','service_change','inquiry_unassign','favorite_set','opportunity_touch',
 'next_action','activity','quote_version','next_action_complete','stage_check','transition','close','amount',
 'waiting_context','inquiry_reclassify','inquiry_status','inquiry_trash','inquiry_restore','inquiry_purge',
 'inquiry_followup','opportunity_create','lineage_link','attachment_prepare','attachment_complete',
 'expansion_pool_update','expansion_note','customer_support_action','message_log','relationship_hold','relationship_response',
 'inquiry_consultant','assign','contact_upsert','contact_relationship','contact_move','rep_manager_comment'
 ]::text[]));

CREATE OR REPLACE FUNCTION crm_security.crm_operational_go_command_v1(
 p_request_id uuid,p_operation text,p_object_id uuid,p_expected_version integer,p_payload jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
#variable_conflict use_variable
DECLARE
 a record; prior crm_security.command_receipts%ROWTYPE; canonical jsonb; ack jsonb; server_at timestamptz:=now();
 old_deal public.deals%ROWTYPE; new_deal public.deals%ROWTYPE; old_inq public.inquiries%ROWTYPE; new_inq public.inquiries%ROWTYPE;
 target_user public.users%ROWTYPE;
 before_data jsonb; after_data jsonb; audit_id uuid; history_id uuid; activity_id uuid; v_contact_id uuid;
 person_key text; target_name text; reason text; intent text; site_name text; manager_role text; mobile text;
 week_start date; comment_status text; changed boolean:=true;
BEGIN
 SELECT * INTO a FROM crm_security.actor(); IF a.user_id IS NULL THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501';END IF;
 IF p_request_id IS NULL OR p_object_id IS NULL OR p_expected_version<0 OR jsonb_typeof(p_payload)<>'object' THEN RAISE EXCEPTION 'invalid command' USING ERRCODE='22023';END IF;
 canonical:=p_payload;
 SELECT * INTO prior FROM crm_security.command_receipts WHERE actor_auth_uid=a.auth_uid AND request_id=p_request_id;
 IF FOUND THEN
  IF prior.actor_user_id IS DISTINCT FROM a.user_id OR prior.operation IS DISTINCT FROM p_operation OR prior.object_id IS DISTINCT FROM p_object_id OR prior.expected_version IS DISTINCT FROM p_expected_version OR prior.payload IS DISTINCT FROM canonical
  THEN RAISE EXCEPTION 'REQUEST_ID_REUSE' USING ERRCODE='PT409';END IF;
  RETURN prior.ack||jsonb_build_object('replayed',true);
 END IF;

 IF p_operation IN('inquiry_assign','inquiry_consultant') THEN
  SELECT * INTO old_inq FROM public.inquiries WHERE id=p_object_id FOR UPDATE;
  IF NOT FOUND OR NOT crm_security.can_inquiry(p_object_id) THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501';END IF;
  before_data:=to_jsonb(old_inq); intent:=coalesce(p_payload->>'intent',''); reason:=nullif(btrim(coalesce(p_payload->>'reason','')),'');
  IF p_operation='inquiry_consultant' THEN
   target_name:=nullif(btrim(coalesce(p_payload->>'consultant_name','')),'');
   IF target_name IS NOT NULL THEN
    SELECT u.* INTO target_user FROM public.users u JOIN crm_security.user_capabilities c ON c.user_id=u.user_id WHERE u.name=target_name AND u.active AND c.inquiry_consultable;
    IF NOT FOUND THEN RAISE EXCEPTION 'consultant target denied' USING ERRCODE='42501';END IF;
   END IF;
   INSERT INTO crm_security.inquiry_routing(inquiry_id,consultant_user_id,branch_code,routing_group,updated_by_auth_uid,updated_by_user_id,updated_at)
   VALUES(p_object_id,target_user.user_id,NULL,NULL,a.auth_uid,a.user_id,server_at)
   ON CONFLICT(inquiry_id) DO UPDATE SET consultant_user_id=excluded.consultant_user_id,updated_by_auth_uid=excluded.updated_by_auth_uid,updated_by_user_id=excluded.updated_by_user_id,updated_at=excluded.updated_at;
   UPDATE public.inquiries SET updated_at=server_at WHERE id=p_object_id RETURNING * INTO new_inq;
  ELSIF intent IN('branch_handoff','branch_owner_assign','branch_owner_pool') THEN
   IF intent='branch_handoff' THEN
    IF old_inq.assigned_to IS NOT NULL AND reason IS NULL THEN RAISE EXCEPTION 'reassignment reason required' USING ERRCODE='22023';END IF;
    target_user.user_id:=NULL; target_name:='경남지사';
   ELSIF intent='branch_owner_assign' THEN
    target_name:=nullif(btrim(coalesce(p_payload->>'to_name','')),'');
    SELECT u.* INTO target_user FROM public.users u JOIN crm_security.user_capabilities c ON c.user_id=u.user_id WHERE u.name=target_name AND u.active AND c.branch_owner AND c.routing_group='gyeongnam';
    IF NOT FOUND THEN RAISE EXCEPTION 'branch owner target denied' USING ERRCODE='42501';END IF;
    IF old_inq.assigned_to IS NOT NULL AND old_inq.assigned_to IS DISTINCT FROM target_user.user_id AND reason IS NULL THEN RAISE EXCEPTION 'reassignment reason required' USING ERRCODE='22023';END IF;
   ELSE target_user.user_id:=NULL; target_name:='경남지사'; reason:=coalesce(reason,'경남지사 내부 실담당자 미지정 전환'); END IF;
   UPDATE public.inquiries SET assigned_to=target_user.user_id,assignee_name=target_name,assigned_at=server_at,
    status=CASE WHEN coalesce(status,'') ~ '^(접수|신규|영업배정 필요)' THEN '배정완료' ELSE status END,updated_at=server_at
   WHERE id=p_object_id RETURNING * INTO new_inq;
   INSERT INTO crm_security.inquiry_routing(inquiry_id,consultant_user_id,branch_code,routing_group,updated_by_auth_uid,updated_by_user_id,updated_at)
   VALUES(p_object_id,NULL,'gyeongnam','gyeongnam',a.auth_uid,a.user_id,server_at)
   ON CONFLICT(inquiry_id) DO UPDATE SET branch_code='gyeongnam',routing_group='gyeongnam',updated_by_auth_uid=excluded.updated_by_auth_uid,updated_by_user_id=excluded.updated_by_user_id,updated_at=excluded.updated_at;
   INSERT INTO public.assignment_history(inquiry_id,from_owner,to_owner,reason,actor_name,changed_at)
   VALUES(p_object_id,coalesce(old_inq.assignee_name,'미배정'),target_name,reason,a.display_name,server_at) RETURNING id INTO history_id;
  ELSE RAISE EXCEPTION 'inquiry intent not connected' USING ERRCODE='22023'; END IF;
  after_data:=to_jsonb(new_inq)||(SELECT jsonb_build_object('routing',to_jsonb(r)) FROM crm_security.inquiry_routing r WHERE r.inquiry_id=p_object_id);
  INSERT INTO crm_security.inquiry_audit_events(actor_auth_uid,actor_user_id,inquiry_id,action,before_data,after_data,reason,created_at)
   VALUES(a.auth_uid,a.user_id,p_object_id,p_operation,before_data,after_data,reason,server_at) RETURNING event_id INTO audit_id;
  ack:=jsonb_build_object('contract_version',1,'ok',true,'request_id',p_request_id,'operation',p_operation,'object_id',p_object_id,'actor_auth_uid',a.auth_uid,'actor_user_id',a.user_id,'intent',CASE WHEN p_operation='inquiry_consultant' THEN 'consultant' ELSE intent END,'assigned_to',new_inq.assigned_to,'assignee_name',new_inq.assignee_name,'status',new_inq.status,'changed',changed,'assignment_history_id',history_id,'inquiry_audit_event_id',audit_id,'server_at',server_at,'replayed',false);

 ELSIF p_operation IN('assign','contact_upsert','contact_relationship','contact_move') THEN
  SELECT * INTO old_deal FROM public.deals WHERE id=p_object_id FOR UPDATE;
  IF NOT FOUND OR NOT crm_security.can_deal(p_object_id,true) THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501';END IF;
  IF old_deal.version IS DISTINCT FROM p_expected_version THEN RAISE EXCEPTION 'version conflict' USING ERRCODE='PT409';END IF;
  before_data:=to_jsonb(old_deal); reason:=nullif(btrim(coalesce(p_payload->>'reason','')),'');
  IF p_operation='assign' THEN
   IF a.permission_role<>'admin' THEN RAISE EXCEPTION 'admin required' USING ERRCODE='42501';END IF;
   target_name:=nullif(btrim(coalesce(p_payload->>'to_name','')),'');
   SELECT u.* INTO target_user FROM public.users u JOIN crm_security.user_capabilities c ON c.user_id=u.user_id WHERE u.name=target_name AND u.active AND c.pipeline_assignable;
   IF NOT FOUND THEN RAISE EXCEPTION 'pipeline target denied' USING ERRCODE='42501';END IF;
   IF old_deal.owner_id IS NOT NULL AND old_deal.owner_id IS DISTINCT FROM target_user.user_id AND reason IS NULL THEN RAISE EXCEPTION 'reassignment reason required' USING ERRCODE='22023';END IF;
   UPDATE public.deals SET owner_id=target_user.user_id,assignee_name=target_user.name,version=version+1,updated_at=server_at WHERE id=p_object_id AND version=p_expected_version RETURNING * INTO new_deal;
   INSERT INTO public.assignment_history(opportunity_id,from_owner,to_owner,reason,actor_name,changed_at)
    VALUES(p_object_id,coalesce(old_deal.assignee_name,'미배정'),target_user.name,reason,a.display_name,server_at) RETURNING id INTO history_id;
   INSERT INTO public.activities(deal_id,organization_id,actor_name,type,detail,occurred_at)
    VALUES(p_object_id,old_deal.organization_id,a.display_name,'담당자변경',jsonb_build_object('from',old_deal.assignee_name,'to',target_user.name,'reason',reason,'handover_summary',jsonb_build_object('at',server_at,'from',coalesce(old_deal.assignee_name,'미배정'),'to',target_user.name,'reason',reason,'stage_code',old_deal.stage_code,'amount',old_deal.amount,'manager_name',old_deal.manager_name,'next_action',old_deal.next_action,'next_action_date',old_deal.next_action_date)),server_at) RETURNING id INTO activity_id;
  ELSE
   person_key:=nullif(btrim(coalesce(p_payload->>'person_key','')),'');
   IF person_key IS NULL OR length(person_key)>200 THEN RAISE EXCEPTION 'invalid person key' USING ERRCODE='22023';END IF;
   SELECT c.id INTO v_contact_id FROM public.contacts c WHERE c.person_key=person_key ORDER BY c.updated_at DESC NULLS LAST,c.id LIMIT 1 FOR UPDATE;
   IF p_operation='contact_upsert' THEN
    target_name:=nullif(btrim(coalesce(p_payload->>'manager_name','')),''); mobile:=nullif(btrim(coalesce(p_payload->>'manager_mobile','')),''); manager_role:=coalesce(nullif(btrim(p_payload->>'manager_role'),''),'담당자'); site_name:=nullif(btrim(coalesce(p_payload->>'site_name','')),'');
    IF target_name IS NULL OR mobile IS NULL OR site_name IS NULL THEN RAISE EXCEPTION 'invalid contact' USING ERRCODE='22023';END IF;
    IF v_contact_id IS NULL THEN INSERT INTO public.contacts(organization_id,name,title,phone,emails,person_key,mobile,role,current_site,created_at,updated_at)
     VALUES(old_deal.organization_id,target_name,manager_role,mobile,CASE WHEN nullif(p_payload->>'office_email','') IS NULL THEN '[]'::jsonb ELSE jsonb_build_array(p_payload->>'office_email') END,person_key,mobile,manager_role,site_name,server_at,server_at) RETURNING id INTO v_contact_id;
    ELSE UPDATE public.contacts SET organization_id=coalesce(old_deal.organization_id,organization_id),name=target_name,title=manager_role,phone=mobile,mobile=mobile,role=manager_role,current_site=site_name,emails=CASE WHEN nullif(p_payload->>'office_email','') IS NULL THEN emails ELSE jsonb_build_array(p_payload->>'office_email') END,updated_at=server_at WHERE id=v_contact_id; END IF;
    UPDATE public.contact_assignments ca SET site_name=site_name,office_phone=nullif(p_payload->>'office_phone',''),status='current',reason='CRM 연락처 저장'
     WHERE ca.person_key=person_key AND ca.opportunity_id=p_object_id AND ca.ended_at IS NULL;
    IF NOT FOUND THEN
     INSERT INTO public.contact_assignments(person_key,opportunity_id,site_name,office_phone,started_at,status,reason)
      VALUES(person_key,p_object_id,site_name,nullif(p_payload->>'office_phone',''),coalesce(nullif(p_payload->>'started_at','')::date,current_date),'current','CRM 연락처 저장');
    END IF;
    INSERT INTO crm_security.contact_compat_state(contact_id,deal_id,sms_consent,kakao_consent,consent_at,opt_out_at,send_blocked,send_blocked_reason,updated_by_auth_uid,updated_by_user_id,updated_at)
     VALUES(v_contact_id,p_object_id,coalesce((p_payload->>'sms_consent')::boolean,false),coalesce((p_payload->>'kakao_consent')::boolean,false),nullif(p_payload->>'consent_at','')::timestamptz,nullif(p_payload->>'opt_out_at','')::timestamptz,coalesce((p_payload->>'send_blocked')::boolean,false),nullif(btrim(coalesce(p_payload->>'send_blocked_reason','')),''),a.auth_uid,a.user_id,server_at)
     ON CONFLICT(contact_id,deal_id) DO UPDATE SET sms_consent=excluded.sms_consent,kakao_consent=excluded.kakao_consent,consent_at=excluded.consent_at,opt_out_at=excluded.opt_out_at,send_blocked=excluded.send_blocked,send_blocked_reason=excluded.send_blocked_reason,updated_by_auth_uid=excluded.updated_by_auth_uid,updated_by_user_id=excluded.updated_by_user_id,updated_at=excluded.updated_at;
    UPDATE public.deals SET contact_id=CASE WHEN coalesce((p_payload->>'is_primary')::boolean,false) OR manager_role='관리소장' THEN v_contact_id ELSE deals.contact_id END,
     person_key=CASE WHEN coalesce((p_payload->>'is_primary')::boolean,false) OR manager_role='관리소장' THEN person_key ELSE deals.person_key END,
     manager_name=CASE WHEN coalesce((p_payload->>'is_primary')::boolean,false) OR manager_role='관리소장' THEN target_name ELSE manager_name END,
     manager_mobile=CASE WHEN coalesce((p_payload->>'is_primary')::boolean,false) OR manager_role='관리소장' THEN mobile ELSE manager_mobile END,
     manager_role=CASE WHEN coalesce((p_payload->>'is_primary')::boolean,false) OR manager_role='관리소장' THEN manager_role ELSE deals.manager_role END,
     office_phone=coalesce(nullif(p_payload->>'office_phone',''),office_phone),office_email=coalesce(nullif(p_payload->>'office_email',''),office_email),manager_current_site=site_name,manager_status='current',version=version+1,updated_at=server_at
    WHERE id=p_object_id AND version=p_expected_version RETURNING * INTO new_deal;
   ELSIF p_operation='contact_relationship' THEN
    IF v_contact_id IS NULL THEN RAISE EXCEPTION 'contact not found' USING ERRCODE='22023';END IF;
    INSERT INTO crm_security.contact_compat_state(contact_id,deal_id,decision_role,relationship_tone,updated_by_auth_uid,updated_by_user_id,updated_at)
     VALUES(v_contact_id,p_object_id,p_payload->>'decision_role',p_payload->>'relationship_tone',a.auth_uid,a.user_id,server_at)
     ON CONFLICT(contact_id,deal_id) DO UPDATE SET decision_role=excluded.decision_role,relationship_tone=excluded.relationship_tone,updated_by_auth_uid=excluded.updated_by_auth_uid,updated_by_user_id=excluded.updated_by_user_id,updated_at=excluded.updated_at;
    UPDATE public.deals SET version=version+1,updated_at=server_at WHERE id=p_object_id AND version=p_expected_version RETURNING * INTO new_deal;
   ELSE
    IF v_contact_id IS NULL OR reason IS NULL OR nullif(p_payload->>'moved_at','') IS NULL OR nullif(btrim(coalesce(p_payload->>'to_site','')),'') IS NULL THEN RAISE EXCEPTION 'invalid contact move' USING ERRCODE='22023';END IF;
    UPDATE public.contact_assignments ca SET ended_at=(p_payload->>'moved_at')::date,status='ended',reason=reason WHERE ca.person_key=person_key AND ca.opportunity_id=p_object_id AND ca.ended_at IS NULL;
    INSERT INTO public.contact_assignments(person_key,opportunity_id,site_name,office_phone,started_at,status,reason)
     VALUES(person_key,NULL,btrim(p_payload->>'to_site'),nullif(p_payload->>'to_office_phone',''),(p_payload->>'moved_at')::date,'current',reason)
     ON CONFLICT(person_key,site_name) WHERE ended_at IS NULL DO UPDATE SET office_phone=excluded.office_phone,started_at=excluded.started_at,status='current',reason=excluded.reason;
    UPDATE public.contacts SET current_site=btrim(p_payload->>'to_site'),updated_at=server_at WHERE id=v_contact_id;
    UPDATE public.deals SET manager_current_site=btrim(p_payload->>'to_site'),manager_status='moved',manager_left_at=(p_payload->>'moved_at')::date,version=version+1,updated_at=server_at WHERE id=p_object_id AND version=p_expected_version RETURNING * INTO new_deal;
   END IF;
  END IF;
  IF new_deal.id IS NULL THEN RAISE EXCEPTION 'unexpected version mutation' USING ERRCODE='PT409';END IF;
  after_data:=to_jsonb(new_deal);
  INSERT INTO crm_security.audit_events(actor_auth_uid,actor_user_id,actor_name,deal_id,action,before_data,after_data,reason,created_at)
   VALUES(a.auth_uid,a.user_id,a.display_name,p_object_id,p_operation,before_data,after_data,coalesce(reason,p_operation),server_at) RETURNING event_id INTO audit_id;
  ack:=jsonb_build_object('contract_version',1,'ok',true,'request_id',p_request_id,'operation',p_operation,'object_id',p_object_id,'actor_auth_uid',a.auth_uid,'actor_user_id',a.user_id,'previous_version',p_expected_version,'version',new_deal.version,'assigned_to',new_deal.owner_id,'assignee_name',new_deal.assignee_name,'assignment_history_id',history_id,'activity_id',activity_id,'contact_id',v_contact_id,'person_key',person_key,'audit_event_id',audit_id,'server_at',server_at,'replayed',false);

 ELSIF p_operation='rep_manager_comment' THEN
  IF a.permission_role<>'admin' OR p_object_id IS DISTINCT FROM a.user_id THEN RAISE EXCEPTION 'admin required' USING ERRCODE='42501';END IF;
  target_name:=nullif(btrim(coalesce(p_payload->>'rep_name','')),''); week_start:=nullif(p_payload->>'week_start','')::date; comment_status:=coalesce(nullif(p_payload->>'status',''),'open');
  SELECT u.* INTO target_user FROM public.users u JOIN crm_security.user_capabilities c ON c.user_id=u.user_id WHERE u.name=target_name AND u.active AND c.performance_included;
  IF NOT FOUND OR week_start IS NULL OR nullif(btrim(coalesce(p_payload->>'comment','')),'') IS NULL OR comment_status NOT IN('open','done') THEN RAISE EXCEPTION 'invalid rep manager comment' USING ERRCODE='22023';END IF;
  INSERT INTO crm_security.rep_manager_comments(rep_user_id,week_start,comment,status,created_by_auth_uid,created_by_user_id,completed_at,created_at,updated_at)
   VALUES(target_user.user_id,week_start,btrim(p_payload->>'comment'),comment_status,a.auth_uid,a.user_id,CASE WHEN comment_status='done' THEN server_at END,server_at,server_at)
   ON CONFLICT(rep_user_id,week_start) DO UPDATE SET comment=excluded.comment,status=excluded.status,completed_at=excluded.completed_at,updated_at=excluded.updated_at;
  ack:=jsonb_build_object('contract_version',1,'ok',true,'request_id',p_request_id,'operation',p_operation,'object_id',p_object_id,'actor_auth_uid',a.auth_uid,'actor_user_id',a.user_id,'rep_user_id',target_user.user_id,'rep_name',target_user.name,'week_start',week_start,'status',comment_status,'server_at',server_at,'replayed',false);
 ELSE RAISE EXCEPTION 'operation not connected' USING ERRCODE='22023'; END IF;

 INSERT INTO crm_security.command_receipts(actor_auth_uid,request_id,actor_user_id,operation,object_id,expected_version,payload,ack,created_at)
 VALUES(a.auth_uid,p_request_id,a.user_id,p_operation,p_object_id,p_expected_version,canonical,ack,server_at);
 RETURN ack;
END $fn$;

REVOKE EXECUTE ON FUNCTION crm_security.crm_operational_go_command_v1(uuid,text,uuid,integer,jsonb) FROM PUBLIC,anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION public.crm_write_command_v2(
 p_request_id uuid,p_operation text,p_object_id uuid,p_expected_version integer,p_payload jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
BEGIN
 IF p_operation IN('inquiry_consultant','assign','contact_upsert','contact_relationship','contact_move','rep_manager_comment')
  OR (p_operation='inquiry_assign' AND coalesce(p_payload->>'intent','') IN('branch_handoff','branch_owner_assign','branch_owner_pool'))
 THEN RETURN crm_security.crm_operational_go_command_v1(p_request_id,p_operation,p_object_id,p_expected_version,p_payload); END IF;
 RETURN crm_security.crm_write_command_v2_pre_go_20260907(p_request_id,p_operation,p_object_id,p_expected_version,p_payload);
END $fn$;
REVOKE EXECUTE ON FUNCTION public.crm_write_command_v2(uuid,text,uuid,integer,jsonb) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.crm_write_command_v2(uuid,text,uuid,integer,jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.crm_operational_source_v1(p_domain text,p_after uuid DEFAULT NULL,p_limit integer DEFAULT 100)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $fn$
DECLARE base jsonb; items jsonb;
BEGIN
 base:=crm_security.crm_operational_source_v1_pre_go_20260907(p_domain,p_after,p_limit);
 IF p_domain='deal_core' THEN
  SELECT coalesce(jsonb_agg(x.item ORDER BY x.ord),'[]'::jsonb) INTO items FROM (
   SELECT n ord,i||jsonb_build_object('contacts',coalesce((SELECT jsonb_agg(jsonb_build_object(
    'id',c.id,'person_key',c.person_key,'name',c.name,'role',coalesce(c.role,c.title,'담당자'),'mobile',coalesce(c.mobile,c.phone),'current_site',c.current_site,
    'decision_role',s.decision_role,'relationship_tone',s.relationship_tone,'sms_consent',coalesce(s.sms_consent,false),'kakao_consent',coalesce(s.kakao_consent,false),'consent_at',s.consent_at,'opt_out_at',s.opt_out_at,'send_blocked',coalesce(s.send_blocked,false),'send_blocked_reason',s.send_blocked_reason,
    'assignment_history',coalesce((SELECT jsonb_agg(to_jsonb(h) ORDER BY h.started_at DESC,h.id) FROM public.contact_assignments h WHERE h.person_key=c.person_key),'[]'::jsonb)
   ) ORDER BY c.name,c.id) FROM public.contacts c LEFT JOIN crm_security.contact_compat_state s ON s.contact_id=c.id AND s.deal_id=(i->>'id')::uuid WHERE EXISTS(SELECT 1 FROM public.contact_assignments ca WHERE ca.person_key=c.person_key AND ca.opportunity_id=(i->>'id')::uuid) OR c.id=(SELECT d.contact_id FROM public.deals d WHERE d.id=(i->>'id')::uuid)),'[]'::jsonb)) item
   FROM jsonb_array_elements(base->'items') WITH ORDINALITY q(i,n)
  ) x;
  RETURN jsonb_set(base,'{items}',items);
 ELSIF p_domain='inquiry_core' THEN
  SELECT coalesce(jsonb_agg(x.item ORDER BY x.ord),'[]'::jsonb) INTO items FROM (
   SELECT n ord,i||coalesce((SELECT jsonb_build_object('consultant_user_id',r.consultant_user_id,'consultant_name',u.name,'branch_code',r.branch_code,'assignment_group',r.routing_group,'owner_group',r.routing_group,'routing_updated_at',r.updated_at) FROM crm_security.inquiry_routing r LEFT JOIN public.users u ON u.user_id=r.consultant_user_id WHERE r.inquiry_id=(i->>'id')::uuid),'{}'::jsonb) item
   FROM jsonb_array_elements(base->'items') WITH ORDINALITY q(i,n)
  ) x;
  RETURN jsonb_set(base,'{items}',items);
 ELSIF p_domain='rep_manager_comment' THEN
  IF NOT EXISTS(SELECT 1 FROM crm_security.actor() a WHERE a.permission_role='admin') THEN
   RETURN jsonb_build_object('contract_version',1,'resource','operational_source','domain',p_domain,'scope_completeness','actor_authorized_rows_only','items','[]'::jsonb,'pagination',jsonb_build_object('completeness','complete','has_more',false,'next_cursor',NULL));
  END IF;
  SELECT coalesce(jsonb_agg(jsonb_build_object('id',c.rep_user_id::text||':'||c.week_start,'rep_user_id',c.rep_user_id,'rep_name',u.name,'week_start',c.week_start,'comment',c.comment,'status',c.status,'completed_at',c.completed_at,'updated_at',c.updated_at) ORDER BY c.week_start DESC,u.name),'[]'::jsonb) INTO items FROM crm_security.rep_manager_comments c JOIN public.users u ON u.user_id=c.rep_user_id WHERE p_after IS NULL OR c.rep_user_id>p_after LIMIT p_limit;
  RETURN jsonb_build_object('contract_version',1,'resource','operational_source','domain',p_domain,'scope_completeness','actor_authorized_rows_only','items',items,'pagination',jsonb_build_object('completeness','complete','has_more',false,'next_cursor',NULL));
 ELSIF p_domain='user_directory' THEN
  IF NOT EXISTS(SELECT 1 FROM crm_security.actor()) THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501';END IF;
  SELECT coalesce(jsonb_agg(jsonb_build_object('id',u.user_id,'user_id',u.user_id,'name',u.name,'display_name',u.name,'team',c.routing_group,'team_code',c.routing_group,'reporting_group',CASE WHEN c.routing_group='head_office' THEN 'internal' ELSE 'external' END,'role',CASE WHEN c.branch_owner THEN 'branch_sales' WHEN c.inquiry_consultable AND NOT c.pipeline_assignable THEN 'consultation' ELSE 'sales' END,'member_role',CASE WHEN c.branch_owner THEN 'branch_sales' WHEN c.inquiry_consultable AND NOT c.pipeline_assignable THEN 'consultation' ELSE 'sales' END,'sales_rep',c.pipeline_assignable,'inquiry_consultable',c.inquiry_consultable,'inquiry_assignable',c.inquiry_assignable,'performance_included',c.performance_included,'active',true) ORDER BY u.name),'[]'::jsonb) INTO items FROM crm_security.user_capabilities c JOIN public.users u ON u.user_id=c.user_id;
  RETURN jsonb_build_object('contract_version',1,'resource','operational_source','domain',p_domain,'scope_completeness','actor_authorized_rows_only','items',items,'pagination',jsonb_build_object('completeness','complete','has_more',false,'next_cursor',NULL));
 END IF;
 RETURN base;
END $fn$;
REVOKE EXECUTE ON FUNCTION public.crm_operational_source_v1(text,uuid,integer) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.crm_operational_source_v1(text,uuid,integer) TO authenticated;

COMMIT;
