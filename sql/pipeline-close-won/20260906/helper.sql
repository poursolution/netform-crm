SET LOCAL crm.close_won_ref='rprechiaglyjaydkmxsu';
SET LOCAL search_path=pg_catalog;
SET LOCAL lock_timeout='3s';
SET LOCAL statement_timeout='90s';

DO $guard$ BEGIN
 IF current_user<>'postgres'
  OR current_setting('crm.close_won_ref',true) IS DISTINCT FROM 'rprechiaglyjaydkmxsu'
  OR to_regprocedure('public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)') IS NULL
  OR to_regprocedure('public.crm_operational_source_v1(text,uuid,integer)') IS NULL
  OR to_regprocedure('crm_security.crm_deal_close_nonwon_command_v1(uuid,uuid,integer,jsonb)') IS NULL
  OR to_regprocedure('crm_security.crm_attachment_command_v1(uuid,text,uuid,jsonb)') IS NULL
  OR to_regclass('crm_security.deal_attachments') IS NULL
  OR (SELECT pg_get_constraintdef(oid,true)
      FROM pg_constraint
      WHERE conrelid='crm_security.command_receipts'::regclass
        AND conname='command_receipts_operation_check') IS DISTINCT FROM $expected$CHECK (operation = ANY (ARRAY['opportunity_work_set'::text, 'inquiry_assign'::text, 'service_change'::text, 'inquiry_unassign'::text, 'favorite_set'::text, 'opportunity_touch'::text, 'next_action'::text, 'activity'::text, 'quote_version'::text, 'next_action_complete'::text, 'stage_check'::text, 'transition'::text, 'close'::text, 'amount'::text, 'waiting_context'::text, 'inquiry_reclassify'::text, 'inquiry_status'::text, 'inquiry_trash'::text, 'inquiry_restore'::text, 'inquiry_purge'::text, 'inquiry_followup'::text, 'opportunity_create'::text, 'lineage_link'::text, 'attachment_prepare'::text, 'attachment_complete'::text]))$expected$
  OR to_regclass('crm_security.deal_won_events') IS NOT NULL
  OR to_regclass('crm_security.expansion_pool') IS NOT NULL
  OR EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='deals' AND column_name IN ('won_amount','completion_date'))
  OR EXISTS(SELECT 1 FROM public.deals WHERE outcome='won' OR stage_code='won' OR lifecycle_status='closed' AND outcome IS DISTINCT FROM 'lost')
  OR to_regprocedure('crm_security.crm_deal_close_won_command_v1(uuid,uuid,integer,jsonb)') IS NOT NULL
  OR to_regprocedure('crm_security.crm_write_command_v2_pre_close_won_20260906(uuid,text,uuid,integer,jsonb)') IS NOT NULL
  OR to_regprocedure('crm_security.crm_operational_source_v1_pre_close_won_20260906(text,uuid,integer)') IS NOT NULL
 THEN RAISE EXCEPTION 'closed-won compatibility prerequisite drift'; END IF;
END $guard$;

ALTER FUNCTION public.crm_write_command_v2(uuid,text,uuid,integer,jsonb) RENAME TO crm_write_command_v2_pre_close_won_20260906;
ALTER FUNCTION public.crm_write_command_v2_pre_close_won_20260906(uuid,text,uuid,integer,jsonb) SET SCHEMA crm_security;
REVOKE EXECUTE ON FUNCTION crm_security.crm_write_command_v2_pre_close_won_20260906(uuid,text,uuid,integer,jsonb) FROM PUBLIC,anon,authenticated,service_role;

ALTER FUNCTION public.crm_operational_source_v1(text,uuid,integer) RENAME TO crm_operational_source_v1_pre_close_won_20260906;
ALTER FUNCTION public.crm_operational_source_v1_pre_close_won_20260906(text,uuid,integer) SET SCHEMA crm_security;
REVOKE EXECUTE ON FUNCTION crm_security.crm_operational_source_v1_pre_close_won_20260906(text,uuid,integer) FROM PUBLIC,anon,authenticated,service_role;

ALTER TABLE public.deals ADD COLUMN won_amount bigint;
ALTER TABLE public.deals ADD COLUMN completion_date date;
ALTER TABLE public.deals ADD CONSTRAINT deals_won_amount_positive CHECK(won_amount IS NULL OR won_amount>0);
ALTER TABLE public.deals ADD CONSTRAINT deals_won_truth_consistent CHECK(
 (outcome='won' AND lifecycle_status='closed' AND stage_code='won' AND won_amount IS NOT NULL AND completion_date IS NOT NULL)
 OR (outcome IS DISTINCT FROM 'won' AND won_amount IS NULL)
);

CREATE TABLE crm_security.expansion_pool(
 source_deal_id uuid PRIMARY KEY REFERENCES public.deals(id) ON DELETE RESTRICT,
 site_id uuid REFERENCES public.sites(site_id) ON DELETE RESTRICT,
 owner_id uuid REFERENCES public.users(user_id) ON DELETE SET NULL,
 source_work_summary text,
 source_won_amount bigint NOT NULL CHECK(source_won_amount>0),
 completion_date date NOT NULL,
 next_contact_at date NOT NULL,
 candidate_work_items jsonb NOT NULL DEFAULT '["타공종 확인"]'::jsonb CHECK(jsonb_typeof(candidate_work_items)='array'),
 relationship_state text NOT NULL DEFAULT '기존고객' CHECK(relationship_state='기존고객'),
 expansion_status text NOT NULL DEFAULT '신규 대상' CHECK(expansion_status IN ('신규 대상','접촉 예정','관계 관리중','추가 니즈 확인','신규 영업기회 생성','보류/휴면')),
 created_at timestamptz NOT NULL,
 updated_at timestamptz NOT NULL
);
CREATE INDEX expansion_pool_next_contact_idx ON crm_security.expansion_pool(next_contact_at,source_deal_id);
ALTER TABLE crm_security.expansion_pool ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON crm_security.expansion_pool FROM PUBLIC,anon,authenticated,service_role;

CREATE TABLE crm_security.deal_won_events(
 event_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 request_id uuid NOT NULL UNIQUE,
 deal_id uuid NOT NULL REFERENCES public.deals(id) ON DELETE RESTRICT,
 from_stage text NOT NULL CHECK(from_stage='completion'),
 completion_date date NOT NULL,
 completion_checks jsonb NOT NULL CHECK(jsonb_typeof(completion_checks)='array'),
 won_amount bigint NOT NULL CHECK(won_amount>0),
 actor_auth_uid uuid NOT NULL,
 actor_user_id uuid NOT NULL REFERENCES public.users(user_id) ON DELETE RESTRICT,
 recorded_at timestamptz NOT NULL,
 stage_history_id uuid NOT NULL REFERENCES public.stage_history(id) ON DELETE RESTRICT,
 activity_id uuid NOT NULL REFERENCES public.activities(id) ON DELETE RESTRICT,
 completed_action_ids jsonb NOT NULL CHECK(jsonb_typeof(completed_action_ids)='array')
);
ALTER TABLE crm_security.deal_won_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON crm_security.deal_won_events FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION crm_security.crm_deal_close_won_command_v1(
 p_request_id uuid,p_object_id uuid,p_expected_version integer,p_payload jsonb
) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $fn$
DECLARE
 a record; receipt crm_security.command_receipts%ROWTYPE; oldrow public.deals%ROWTYPE; newrow public.deals%ROWTYPE;
 canonical jsonb; ack jsonb; audit_id uuid; won_event_id uuid; history_id uuid; activity_id uuid;
 completion_value date; transition_value date; amount_value bigint; checks_value jsonb; note_value text; memo_value text;
 server_at timestamptz; effective_at timestamptz; contexts jsonb; completed_ids jsonb:='[]'::jsonb; actor_email_value text;
BEGIN
 IF p_request_id IS NULL OR p_object_id IS NULL OR p_expected_version IS NULL OR p_expected_version<0
  OR jsonb_typeof(p_payload) IS DISTINCT FROM 'object'
  OR EXISTS(SELECT 1 FROM jsonb_object_keys(p_payload) k WHERE k NOT IN ('from','outcome','transition_date','completion_date','completion_checks','won_amount','note','memo'))
  OR NOT p_payload ?& ARRAY['from','outcome','transition_date','completion_date','completion_checks','won_amount','note','memo']
  OR p_payload->>'from'<>'completion' OR p_payload->>'outcome'<>'won'
  OR jsonb_typeof(p_payload->'transition_date') IS DISTINCT FROM 'string'
  OR jsonb_typeof(p_payload->'completion_date') IS DISTINCT FROM 'string'
  OR jsonb_typeof(p_payload->'completion_checks') IS DISTINCT FROM 'array'
  OR jsonb_typeof(p_payload->'won_amount') IS DISTINCT FROM 'number'
  OR jsonb_typeof(p_payload->'note') IS DISTINCT FROM 'string'
  OR jsonb_typeof(p_payload->'memo') NOT IN ('string','null')
 THEN RAISE EXCEPTION 'invalid closed-won payload' USING ERRCODE='22023'; END IF;
 IF p_payload->>'transition_date' !~ '^\d{4}-\d{2}-\d{2}$' OR p_payload->>'completion_date' !~ '^\d{4}-\d{2}-\d{2}$'
 THEN RAISE EXCEPTION 'invalid closed-won date' USING ERRCODE='22023'; END IF;
 BEGIN transition_value:=(p_payload->>'transition_date')::date;completion_value:=(p_payload->>'completion_date')::date;
 EXCEPTION WHEN datetime_field_overflow THEN RAISE EXCEPTION 'invalid closed-won date' USING ERRCODE='22023'; END;
 IF transition_value::text<>p_payload->>'transition_date' OR completion_value::text<>p_payload->>'completion_date'
 THEN RAISE EXCEPTION 'invalid closed-won date' USING ERRCODE='22023'; END IF;
 amount_value:=(p_payload->>'won_amount')::bigint; checks_value:=p_payload->'completion_checks';note_value:=trim(p_payload->>'note');memo_value:=nullif(trim(p_payload->>'memo'),'');
 IF amount_value<=0 OR completion_value>transition_value OR length(note_value)<1 OR length(note_value)>16000 OR length(coalesce(memo_value,''))>8000
  OR NOT checks_value ?& ARRAY['공사 완료','준공검사 완료']
  OR EXISTS(SELECT 1 FROM jsonb_array_elements(checks_value) x WHERE jsonb_typeof(x)<>'string' OR x#>>'{}' NOT IN ('공사 완료','준공검사 완료'))
  OR (SELECT count(*) FROM jsonb_array_elements(checks_value))<>2
 THEN RAISE EXCEPTION 'invalid closed-won evidence' USING ERRCODE='22023'; END IF;
 canonical:=jsonb_build_object('from','completion','outcome','won','transition_date',transition_value,'completion_date',completion_value,'completion_checks',checks_value,'won_amount',amount_value,'note',note_value,'memo',memo_value);

 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501';END IF;
 PERFORM 1 FROM public.users u WHERE u.auth_uid=auth.uid() FOR SHARE;
 PERFORM 1 FROM crm_security.access_review r WHERE r.reviewed_auth_uid=auth.uid() FOR SHARE;
 SELECT * INTO a FROM crm_security.actor();IF NOT FOUND THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501';END IF;
 PERFORM 1 FROM crm_security.object_scope s WHERE s.user_id=a.user_id AND s.deal_id=p_object_id FOR SHARE;
 SELECT * INTO oldrow FROM public.deals d WHERE d.id=p_object_id FOR UPDATE;
 IF NOT FOUND OR a.permission_role NOT IN ('rep','branch','admin') OR NOT crm_security.can_deal(p_object_id,true)
 THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501';END IF;
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(a.auth_uid::text||p_request_id::text,0));
 SELECT * INTO receipt FROM crm_security.command_receipts r WHERE r.actor_auth_uid=a.auth_uid AND r.request_id=p_request_id;
 IF FOUND THEN
  IF receipt.actor_user_id IS DISTINCT FROM a.user_id OR receipt.operation IS DISTINCT FROM 'close' OR receipt.object_id IS DISTINCT FROM p_object_id OR receipt.expected_version IS DISTINCT FROM p_expected_version OR receipt.payload IS DISTINCT FROM canonical
  THEN RAISE EXCEPTION 'REQUEST_ID_REUSE' USING ERRCODE='PT409';END IF;
  RETURN receipt.ack||jsonb_build_object('replayed',true);
 END IF;
 IF oldrow.version IS DISTINCT FROM p_expected_version THEN RAISE EXCEPTION 'version conflict' USING ERRCODE='PT409';END IF;
 IF oldrow.stage_code IS DISTINCT FROM 'completion' OR oldrow.outcome IS NOT NULL OR oldrow.lifecycle_status<>'active'
  OR jsonb_typeof(oldrow.stage_contexts) IS DISTINCT FROM 'object' OR NOT oldrow.stage_contexts ? 'completion'
 THEN RAISE EXCEPTION 'closed-won state conflict' USING ERRCODE='PT409';END IF;
 server_at:=clock_timestamp();
 IF transition_value>(server_at AT TIME ZONE 'Asia/Seoul')::date THEN RAISE EXCEPTION 'future close date' USING ERRCODE='22023';END IF;
 effective_at:=transition_value::timestamp AT TIME ZONE 'Asia/Seoul';
 contexts:=jsonb_set(oldrow.stage_contexts,'{won}',jsonb_build_object('transition_date',transition_value,'fields',jsonb_build_object('completion_date',completion_value,'completion_checks',checks_value,'contract_amount',amount_value),'from','completion','to','won','recorded_at',server_at,'actor',a.display_name,'terminal',true,'memo',memo_value),true);
 SELECT coalesce(jsonb_agg(id ORDER BY created_at),'[]'::jsonb) INTO completed_ids FROM public.next_actions WHERE deal_id=p_object_id AND status='open';
 UPDATE public.next_actions SET status='completed',completed_at=server_at,updated_at=server_at WHERE deal_id=p_object_id AND status='open';
 SELECT u.email INTO actor_email_value FROM public.users u WHERE u.user_id=a.user_id;
 INSERT INTO public.stage_history(opportunity_id,from_stage,to_stage,reason,actor_id,actor_name,changed_at)
 VALUES(p_object_id,'completion','won',note_value,a.user_id,a.display_name,effective_at) RETURNING id INTO history_id;
 INSERT INTO public.activities(deal_id,organization_id,actor_email,actor_name,type,detail,occurred_at)
 VALUES(p_object_id,oldrow.organization_id,actor_email_value,a.display_name,'단계전환',jsonb_build_object('note','Closed Won · 준공 완료','result',note_value,'completion_date',completion_value,'won_amount',amount_value,'meaningful_contact',false),effective_at) RETURNING id INTO activity_id;
 UPDATE public.deals SET stage_code='won',lifecycle_status='closed',outcome='won',won_amount=amount_value,completion_date=completion_value,closed_at=effective_at,stage_entered_at=effective_at,stage_contexts=contexts,last_activity_at=effective_at,next_action=NULL,next_action_date=NULL,updated_at=server_at,version=version+1
 WHERE id=p_object_id AND version=p_expected_version RETURNING * INTO newrow;
 IF NOT FOUND THEN RAISE EXCEPTION 'unexpected version mutation' USING ERRCODE='PT409';END IF;
 INSERT INTO crm_security.expansion_pool(source_deal_id,site_id,owner_id,source_work_summary,source_won_amount,completion_date,next_contact_at,candidate_work_items,relationship_state,expansion_status,created_at,updated_at)
 VALUES(p_object_id,newrow.site_id,newrow.owner_id,newrow.work_summary,amount_value,completion_value,completion_value+30,'["타공종 확인"]'::jsonb,'기존고객','신규 대상',server_at,server_at);
 INSERT INTO crm_security.deal_won_events(request_id,deal_id,from_stage,completion_date,completion_checks,won_amount,actor_auth_uid,actor_user_id,recorded_at,stage_history_id,activity_id,completed_action_ids)
 VALUES(p_request_id,p_object_id,'completion',completion_value,checks_value,amount_value,a.auth_uid,a.user_id,server_at,history_id,activity_id,completed_ids) RETURNING event_id INTO won_event_id;
 INSERT INTO crm_security.audit_events(actor_auth_uid,actor_user_id,actor_name,deal_id,action,before_data,after_data,reason,created_at)
 VALUES(a.auth_uid,a.user_id,a.display_name,p_object_id,'close',jsonb_build_object('version',oldrow.version,'stage_code',oldrow.stage_code,'outcome',oldrow.outcome,'lifecycle_status',oldrow.lifecycle_status,'amount',oldrow.amount),jsonb_build_object('version',newrow.version,'stage_code',newrow.stage_code,'outcome',newrow.outcome,'lifecycle_status',newrow.lifecycle_status,'won_amount',newrow.won_amount,'completion_date',newrow.completion_date,'won_event_id',won_event_id,'stage_history_id',history_id,'activity_id',activity_id,'completed_action_ids',completed_ids),note_value,server_at) RETURNING event_id INTO audit_id;
 ack:=jsonb_build_object('contract_version',1,'ok',true,'request_id',p_request_id,'operation','close','object_id',p_object_id,'actor_auth_uid',a.auth_uid,'actor_user_id',a.user_id,'previous_version',p_expected_version,'version',newrow.version,'from_stage','completion','stage_code','won','outcome','won','lifecycle_status','closed','closed_at',newrow.closed_at,'completion_date',newrow.completion_date,'won_amount',newrow.won_amount,'stage_contexts',newrow.stage_contexts,'close_event_id',won_event_id,'won_event_id',won_event_id,'stage_history_id',history_id,'activity_id',activity_id,'completed_action_ids',completed_ids,'audit_event_id',audit_id,'expansion_source_deal_id',p_object_id,'expansion_next_contact_at',completion_value+30,'server_at',server_at,'replayed',false);
 INSERT INTO crm_security.command_receipts(actor_auth_uid,request_id,actor_user_id,operation,object_id,expected_version,payload,ack)
 VALUES(a.auth_uid,p_request_id,a.user_id,'close',p_object_id,p_expected_version,canonical,ack);
 RETURN ack;
END $fn$;
REVOKE EXECUTE ON FUNCTION crm_security.crm_deal_close_won_command_v1(uuid,uuid,integer,jsonb) FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION public.crm_write_command_v2(p_request_id uuid,p_operation text,p_object_id uuid,p_expected_version integer,p_payload jsonb)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $fn$
BEGIN
 IF p_operation='close' AND p_payload->>'outcome'='won'
 THEN RETURN crm_security.crm_deal_close_won_command_v1(p_request_id,p_object_id,p_expected_version,p_payload); END IF;
 RETURN crm_security.crm_write_command_v2_pre_close_won_20260906(p_request_id,p_operation,p_object_id,p_expected_version,p_payload);
END $fn$;
REVOKE EXECUTE ON FUNCTION public.crm_write_command_v2(uuid,text,uuid,integer,jsonb) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.crm_write_command_v2(uuid,text,uuid,integer,jsonb) TO authenticated;

CREATE FUNCTION public.crm_operational_source_v1(p_domain text,p_after uuid DEFAULT NULL,p_limit integer DEFAULT 100)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $fn$
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
REVOKE EXECUTE ON FUNCTION public.crm_operational_source_v1(text,uuid,integer) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.crm_operational_source_v1(text,uuid,integer) TO authenticated;

DO $post$ BEGIN
 IF has_function_privilege('anon','public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)','EXECUTE')
  OR NOT has_function_privilege('authenticated','public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)','EXECUTE')
  OR has_function_privilege('service_role','public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)','EXECUTE')
  OR NOT has_function_privilege('authenticated','public.crm_operational_source_v1(text,uuid,integer)','EXECUTE')
  OR has_function_privilege('authenticated','crm_security.crm_deal_close_won_command_v1(uuid,uuid,integer,jsonb)','EXECUTE')
  OR has_table_privilege('authenticated','crm_security.expansion_pool','SELECT')
  OR has_table_privilege('authenticated','crm_security.deal_won_events','SELECT')
  OR NOT (SELECT relrowsecurity FROM pg_class WHERE oid='crm_security.expansion_pool'::regclass)
  OR NOT (SELECT relrowsecurity FROM pg_class WHERE oid='crm_security.deal_won_events'::regclass)
 THEN RAISE EXCEPTION 'closed-won compatibility post-apply drift'; END IF;
END $post$;
