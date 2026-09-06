-- LOCAL REVIEW CANDIDATE ONLY. Staging execution requires separate explicit approval.
-- Target project: netform-crm-staging / rprechiaglyjaydkmxsu. Production is forbidden.
BEGIN;
SET LOCAL search_path=pg_catalog;
SET LOCAL lock_timeout='3s';
SET LOCAL statement_timeout='180s';
SET LOCAL crm.reachable_operations_bundle_ref='rprechiaglyjaydkmxsu';
DO $reachable_bundle_guard$ BEGIN
 IF current_user<>'postgres'
  OR current_setting('crm.reachable_operations_bundle_ref',true) IS DISTINCT FROM 'rprechiaglyjaydkmxsu'
 THEN RAISE EXCEPTION 'reachable operations bundle project/role guard failed'; END IF;
END $reachable_bundle_guard$;
-- ===== APPLY personal_state =====
SET LOCAL crm.personal_state_ref='rprechiaglyjaydkmxsu';
SET LOCAL crm.personal_state_ref='rprechiaglyjaydkmxsu';
-- LOCAL COMPOSITION CANDIDATE. Do not run remotely without generating and
-- reviewing staging-apply.sql and its exact live OID/hash guards.

SET LOCAL search_path=pg_catalog;
SET LOCAL lock_timeout='3s';
SET LOCAL statement_timeout='60s';

DO $approval$ BEGIN
 IF current_user<>'postgres'
  OR current_setting('crm.personal_state_ref',true) IS DISTINCT FROM 'rprechiaglyjaydkmxsu'
  OR to_regprocedure('public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)') IS NULL
  OR to_regprocedure('public.crm_read_scoped_v2(uuid,integer,uuid,uuid)') IS NULL
  OR to_regprocedure('crm_security.crm_write_command_v2_frozen_20260906(uuid,text,uuid,integer,jsonb)') IS NULL
  OR to_regprocedure('crm_security.crm_inquiry_unassign_command_v1(uuid,uuid,jsonb)') IS NULL
  OR to_regprocedure('crm_security.crm_write_command_v2_operational_20260906(uuid,text,uuid,integer,jsonb)') IS NOT NULL
  OR to_regprocedure('crm_security.crm_user_opportunity_state_command_v2(uuid,text,uuid,integer,jsonb)') IS NOT NULL
  OR to_regclass('crm_security.user_opportunity_state') IS NOT NULL
  OR to_regnamespace('crm_personal_state_archive') IS NOT NULL
 THEN RAISE EXCEPTION 'personal-state compatibility approval/drift failure'; END IF;
END $approval$;

DO $live_baseline$ DECLARE w record; r record; f record; u record; BEGIN
 SELECT * INTO w FROM pg_proc WHERE oid='public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)'::regprocedure;
 SELECT * INTO r FROM pg_proc WHERE oid='public.crm_read_scoped_v2(uuid,integer,uuid,uuid)'::regprocedure;
 SELECT * INTO f FROM pg_proc WHERE oid='crm_security.crm_write_command_v2_frozen_20260906(uuid,text,uuid,integer,jsonb)'::regprocedure;
 SELECT * INTO u FROM pg_proc WHERE oid='crm_security.crm_inquiry_unassign_command_v1(uuid,uuid,jsonb)'::regprocedure;
 IF w.oid<>18115 OR md5(pg_get_functiondef(w.oid)) IS DISTINCT FROM '04ad2b922c42ca79c6ec854f79c19583'
  OR pg_get_userbyid(w.proowner)<>'postgres' OR NOT w.prosecdef
  OR w.proconfig IS DISTINCT FROM ARRAY['search_path=""']
  OR coalesce(w.proacl::text,'')<>'{postgres=X/postgres,authenticated=X/postgres}'
  OR r.oid<>18064 OR md5(pg_get_functiondef(r.oid)) IS DISTINCT FROM 'd1cde3372f07295076fc62bf28d12a01'
  OR pg_get_userbyid(r.proowner)<>'postgres' OR NOT r.prosecdef
  OR r.proconfig IS DISTINCT FROM ARRAY['search_path=""']
  OR coalesce(r.proacl::text,'')<>'{postgres=X/postgres,authenticated=X/postgres}'
  OR f.oid<>18077 OR md5(pg_get_functiondef(f.oid)) IS DISTINCT FROM '1ad250f71a5af65317ab3362239752e8'
  OR pg_get_userbyid(f.proowner)<>'postgres' OR NOT f.prosecdef
  OR f.proconfig IS DISTINCT FROM ARRAY['search_path=""']
  OR coalesce(f.proacl::text,'')<>'{postgres=X/postgres}'
  OR u.oid<>18112 OR md5(pg_get_functiondef(u.oid)) IS DISTINCT FROM '803074f7a3974777c766fe4487069fb0'
  OR pg_get_userbyid(u.proowner)<>'postgres' OR NOT u.prosecdef
  OR u.proconfig IS DISTINCT FROM ARRAY['search_path=""']
  OR coalesce(u.proacl::text,'')<>'{postgres=X/postgres}'
  OR (SELECT pg_get_constraintdef(oid,true) FROM pg_constraint
      WHERE conrelid='crm_security.command_receipts'::regclass
       AND conname='command_receipts_operation_check')
     IS DISTINCT FROM $expected$CHECK (operation = ANY (ARRAY['opportunity_work_set'::text, 'inquiry_assign'::text, 'service_change'::text, 'inquiry_unassign'::text]))$expected$
 THEN RAISE EXCEPTION 'deployed operational bundle OID/definition/ACL/config drift'; END IF;
END $live_baseline$;
-- Target-scoped live guard above replaces cross-engine snapshot MD5.

CREATE TEMP TABLE personal_state_apply_guard(
 old_dispatcher_oid oid NOT NULL,
 old_dispatcher_source text NOT NULL,
 old_dispatcher_config text[] NOT NULL,
 old_dispatcher_acl text NOT NULL,
 old_read_oid oid NOT NULL,
 old_read_definition text NOT NULL
) ON COMMIT DROP;

INSERT INTO personal_state_apply_guard
SELECT w.oid,w.prosrc,w.proconfig,coalesce(w.proacl::text,''),r.oid,pg_get_functiondef(r.oid)
FROM pg_proc w,pg_proc r
WHERE w.oid='public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)'::regprocedure
 AND r.oid='public.crm_read_scoped_v2(uuid,integer,uuid,uuid)'::regprocedure;

LOCK TABLE crm_security.command_receipts IN ACCESS EXCLUSIVE MODE;
ALTER TABLE crm_security.command_receipts
 DROP CONSTRAINT command_receipts_operation_check;
ALTER TABLE crm_security.command_receipts
 ADD CONSTRAINT command_receipts_operation_check
 CHECK(operation IN (
  'opportunity_work_set','inquiry_assign','service_change','inquiry_unassign',
  'favorite_set','opportunity_touch'));

CREATE TABLE crm_security.user_opportunity_state(
 actor_user_id uuid NOT NULL REFERENCES public.users(user_id) ON DELETE CASCADE,
 deal_id uuid NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,
 favorite boolean NOT NULL DEFAULT false,
 last_viewed_at timestamptz,
 last_worked_at timestamptz,
 view_count bigint NOT NULL DEFAULT 0 CHECK(view_count>=0),
 updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(actor_user_id,deal_id)
);
CREATE INDEX user_opportunity_state_recent_idx
 ON crm_security.user_opportunity_state(
  actor_user_id,last_viewed_at DESC,last_worked_at DESC);
ALTER TABLE crm_security.user_opportunity_state ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON crm_security.user_opportunity_state
 FROM PUBLIC,anon,authenticated,service_role;

ALTER FUNCTION public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)
 RENAME TO crm_write_command_v2_operational_20260906;
ALTER FUNCTION public.crm_write_command_v2_operational_20260906(uuid,text,uuid,integer,jsonb)
 SET SCHEMA crm_security;
REVOKE EXECUTE ON FUNCTION
 crm_security.crm_write_command_v2_operational_20260906(uuid,text,uuid,integer,jsonb)
 FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION crm_security.crm_user_opportunity_state_command_v2(
 p_request_id uuid,p_operation text,p_object_id uuid,
 p_expected_version integer,p_payload jsonb
) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $fn$
DECLARE
 a record;
 receipt crm_security.command_receipts%ROWTYPE;
 state crm_security.user_opportunity_state%ROWTYPE;
 canonical jsonb;
 ack jsonb;
 favorite_value boolean;
 kind_value text;
 server_at timestamptz;
BEGIN
 IF p_request_id IS NULL OR p_object_id IS NULL
  OR p_expected_version IS DISTINCT FROM 0
  OR p_operation NOT IN ('favorite_set','opportunity_touch')
  OR jsonb_typeof(p_payload) IS DISTINCT FROM 'object'
 THEN RAISE EXCEPTION 'invalid personal-state envelope' USING ERRCODE='22023'; END IF;
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;
 PERFORM 1 FROM public.users u WHERE u.auth_uid=auth.uid() FOR SHARE;
 PERFORM 1 FROM crm_security.access_review r
  WHERE r.reviewed_auth_uid=auth.uid() FOR SHARE;
 SELECT * INTO a FROM crm_security.actor();
 IF NOT FOUND THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;
 PERFORM 1 FROM crm_security.object_scope s
  WHERE s.user_id=a.user_id AND s.deal_id=p_object_id FOR SHARE;
 PERFORM 1 FROM public.deals d WHERE d.id=p_object_id FOR SHARE;
 IF NOT FOUND OR NOT crm_security.can_deal(p_object_id,false)
 THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;

 IF p_payload ? 'opportunity_id' AND
    (jsonb_typeof(p_payload->'opportunity_id')<>'string'
     OR p_payload->>'opportunity_id'<>p_object_id::text)
 THEN RAISE EXCEPTION 'object mismatch' USING ERRCODE='22023'; END IF;
 IF p_payload ? 'user_key' AND
    (jsonb_typeof(p_payload->'user_key') NOT IN ('string','null')
     OR (jsonb_typeof(p_payload->'user_key')='string'
         AND length(p_payload->>'user_key')>500))
 THEN RAISE EXCEPTION 'invalid display user key' USING ERRCODE='22023'; END IF;

 IF p_operation='favorite_set' THEN
  IF EXISTS(SELECT 1 FROM jsonb_object_keys(p_payload) k
             WHERE k NOT IN ('opportunity_id','user_key','favorite'))
   OR jsonb_typeof(p_payload->'favorite') IS DISTINCT FROM 'boolean'
  THEN RAISE EXCEPTION 'invalid favorite payload' USING ERRCODE='22023'; END IF;
  favorite_value:=(p_payload->>'favorite')::boolean;
  canonical:=jsonb_build_object('favorite',favorite_value);
 ELSE
  IF EXISTS(SELECT 1 FROM jsonb_object_keys(p_payload) k
             WHERE k NOT IN ('opportunity_id','user_key','touch_kind','touched_at'))
   OR jsonb_typeof(p_payload->'touch_kind') IS DISTINCT FROM 'string'
   OR p_payload->>'touch_kind' NOT IN ('view','work')
   OR (p_payload ? 'touched_at' AND
       (jsonb_typeof(p_payload->'touched_at') NOT IN ('string','null')
        OR (jsonb_typeof(p_payload->'touched_at')='string'
            AND length(p_payload->>'touched_at')>64)))
  THEN RAISE EXCEPTION 'invalid touch payload' USING ERRCODE='22023'; END IF;
  kind_value:=p_payload->>'touch_kind';
  canonical:=jsonb_build_object('touch_kind',kind_value);
 END IF;

 PERFORM pg_catalog.pg_advisory_xact_lock(
  pg_catalog.hashtextextended(a.auth_uid::text||p_request_id::text,0));
 SELECT * INTO receipt FROM crm_security.command_receipts r
  WHERE r.actor_auth_uid=a.auth_uid AND r.request_id=p_request_id;
 IF FOUND THEN
  IF receipt.actor_user_id IS DISTINCT FROM a.user_id
   OR receipt.operation IS DISTINCT FROM p_operation
   OR receipt.object_id IS DISTINCT FROM p_object_id
   OR receipt.expected_version IS DISTINCT FROM 0
   OR receipt.payload IS DISTINCT FROM canonical
  THEN RAISE EXCEPTION 'REQUEST_ID_REUSE' USING ERRCODE='PT409'; END IF;
  RETURN receipt.ack||jsonb_build_object('replayed',true);
 END IF;

 server_at:=clock_timestamp();
 IF p_operation='favorite_set' THEN
  INSERT INTO crm_security.user_opportunity_state(
   actor_user_id,deal_id,favorite,updated_at)
  VALUES(a.user_id,p_object_id,favorite_value,server_at)
  ON CONFLICT(actor_user_id,deal_id) DO UPDATE SET
   favorite=excluded.favorite,updated_at=excluded.updated_at
  RETURNING * INTO state;
 ELSE
  INSERT INTO crm_security.user_opportunity_state(
   actor_user_id,deal_id,last_viewed_at,last_worked_at,view_count,updated_at)
  VALUES(a.user_id,p_object_id,
   CASE WHEN kind_value='view' THEN server_at END,
   CASE WHEN kind_value='work' THEN server_at END,
   CASE WHEN kind_value='view' THEN 1 ELSE 0 END,server_at)
  ON CONFLICT(actor_user_id,deal_id) DO UPDATE SET
   last_viewed_at=CASE WHEN kind_value='view' THEN excluded.last_viewed_at
                       ELSE crm_security.user_opportunity_state.last_viewed_at END,
   last_worked_at=CASE WHEN kind_value='work' THEN excluded.last_worked_at
                       ELSE crm_security.user_opportunity_state.last_worked_at END,
   view_count=crm_security.user_opportunity_state.view_count+
              CASE WHEN kind_value='view' THEN 1 ELSE 0 END,
   updated_at=excluded.updated_at
  RETURNING * INTO state;
 END IF;

 ack:=jsonb_build_object(
  'contract_version',1,'ok',true,'request_id',p_request_id,
  'operation',p_operation,'object_id',p_object_id,
  'actor_auth_uid',a.auth_uid,'actor_user_id',a.user_id,
  'favorite',state.favorite,'touch_kind',kind_value,
  'last_viewed_at',state.last_viewed_at,
  'last_worked_at',state.last_worked_at,
  'view_count',state.view_count,'server_at',server_at,'replayed',false);
 INSERT INTO crm_security.command_receipts(
  actor_auth_uid,request_id,actor_user_id,operation,object_id,
  expected_version,payload,ack)
 VALUES(a.auth_uid,p_request_id,a.user_id,p_operation,p_object_id,0,canonical,ack);
 RETURN ack;
END $fn$;

REVOKE EXECUTE ON FUNCTION
 crm_security.crm_user_opportunity_state_command_v2(uuid,text,uuid,integer,jsonb)
 FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION public.crm_write_command_v2(
 p_request_id uuid,p_operation text,p_object_id uuid,
 p_expected_version integer,p_payload jsonb
) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $fn$
BEGIN
 IF p_operation IN ('favorite_set','opportunity_touch') THEN
  RETURN crm_security.crm_user_opportunity_state_command_v2(
   p_request_id,p_operation,p_object_id,p_expected_version,p_payload);
 END IF;
 RETURN crm_security.crm_write_command_v2_operational_20260906(
  p_request_id,p_operation,p_object_id,p_expected_version,p_payload);
END $fn$;

REVOKE EXECUTE ON FUNCTION public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)
 FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)
 TO authenticated;

CREATE OR REPLACE FUNCTION public.crm_read_scoped_v2(
 p_after uuid DEFAULT NULL::uuid,p_limit integer DEFAULT 100,
 p_deal_id uuid DEFAULT NULL::uuid,p_inquiry_id uuid DEFAULT NULL::uuid
) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $fn$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM crm_security.actor())
  OR (p_deal_id IS NOT NULL AND NOT crm_security.can_deal(p_deal_id,false))
  OR (p_inquiry_id IS NOT NULL AND NOT crm_security.can_inquiry(p_inquiry_id))
 THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;
 IF p_limit IS NULL OR p_limit<1 OR p_limit>100
 THEN RAISE EXCEPTION 'invalid limit' USING ERRCODE='22023'; END IF;
 RETURN jsonb_build_object('contract_version',2,
 'deals',coalesce((SELECT jsonb_agg(to_jsonb(q) ORDER BY q.id) FROM(
  SELECT d.id,d.site_id,d.owner_id,d.stage_code,d.brand,
   d.primary_work,d.work_items,d.work_scope_type,d.work_summary,d.version,
   coalesce(s.favorite,false) AS favorite,
   s.last_viewed_at,s.last_worked_at,coalesce(s.view_count,0) AS view_count
  FROM public.deals d
  CROSS JOIN LATERAL (SELECT a.user_id FROM crm_security.actor() a) actor_row
  LEFT JOIN crm_security.user_opportunity_state s
   ON s.actor_user_id=actor_row.user_id AND s.deal_id=d.id
  WHERE crm_security.can_deal(d.id,false)
   AND (p_after IS NULL OR d.id>p_after)
   AND (p_deal_id IS NULL OR d.id=p_deal_id)
  ORDER BY d.id LIMIT p_limit) q),'[]'::jsonb),
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
   AND (p_after IS NULL OR i.id>p_after)
   AND (p_inquiry_id IS NULL OR i.id=p_inquiry_id)
  ORDER BY i.id LIMIT p_limit) q),'[]'::jsonb));
END $fn$;

DO $verify$ DECLARE
 prior record; moved record; public_fn record; helper record; read_fn record;
BEGIN
 SELECT * INTO prior FROM personal_state_apply_guard;
 SELECT * INTO moved FROM pg_proc WHERE oid=
  'crm_security.crm_write_command_v2_operational_20260906(uuid,text,uuid,integer,jsonb)'::regprocedure;
 SELECT * INTO public_fn FROM pg_proc WHERE oid=
  'public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)'::regprocedure;
 SELECT * INTO helper FROM pg_proc WHERE oid=
  'crm_security.crm_user_opportunity_state_command_v2(uuid,text,uuid,integer,jsonb)'::regprocedure;
 SELECT * INTO read_fn FROM pg_proc WHERE oid=
  'public.crm_read_scoped_v2(uuid,integer,uuid,uuid)'::regprocedure;
 IF moved.oid IS DISTINCT FROM prior.old_dispatcher_oid
  OR moved.prosrc IS DISTINCT FROM prior.old_dispatcher_source
  OR moved.proconfig IS DISTINCT FROM prior.old_dispatcher_config
  OR pg_get_userbyid(moved.proowner)<>'postgres' OR NOT moved.prosecdef
  OR has_function_privilege('anon',moved.oid,'EXECUTE')
  OR has_function_privilege('authenticated',moved.oid,'EXECUTE')
  OR has_function_privilege('service_role',moved.oid,'EXECUTE')
  OR EXISTS(SELECT 1 FROM aclexplode(moved.proacl) x WHERE x.grantee=0)
  OR public_fn.oid IS NULL OR public_fn.oid=moved.oid
  OR pg_get_userbyid(public_fn.proowner)<>'postgres' OR NOT public_fn.prosecdef
  OR public_fn.proconfig IS DISTINCT FROM ARRAY['search_path=""']
  OR coalesce(public_fn.proacl::text,'')<>'{postgres=X/postgres,authenticated=X/postgres}'
  OR helper.oid IS NULL OR pg_get_userbyid(helper.proowner)<>'postgres'
  OR NOT helper.prosecdef OR helper.proconfig IS DISTINCT FROM ARRAY['search_path=""']
  OR has_function_privilege('anon',helper.oid,'EXECUTE')
  OR has_function_privilege('authenticated',helper.oid,'EXECUTE')
  OR has_function_privilege('service_role',helper.oid,'EXECUTE')
  OR EXISTS(SELECT 1 FROM aclexplode(helper.proacl) x WHERE x.grantee=0)
  OR read_fn.oid IS DISTINCT FROM prior.old_read_oid
  OR pg_get_userbyid(read_fn.proowner)<>'postgres' OR NOT read_fn.prosecdef
  OR read_fn.proconfig IS DISTINCT FROM ARRAY['search_path=""']
  OR coalesce(read_fn.proacl::text,'')<>'{postgres=X/postgres,authenticated=X/postgres}'
 THEN RAISE EXCEPTION 'personal-state post-apply OID/ACL/config drift'; END IF;
END $verify$;

DO $target_post_guard$ DECLARE w record; r record; h record; moved record; state_rel record; BEGIN
 SELECT * INTO w FROM pg_proc WHERE oid='public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)'::regprocedure;
 SELECT * INTO r FROM pg_proc WHERE oid='public.crm_read_scoped_v2(uuid,integer,uuid,uuid)'::regprocedure;
 SELECT * INTO h FROM pg_proc WHERE oid='crm_security.crm_user_opportunity_state_command_v2(uuid,text,uuid,integer,jsonb)'::regprocedure;
 SELECT * INTO moved FROM pg_proc WHERE oid='crm_security.crm_write_command_v2_operational_20260906(uuid,text,uuid,integer,jsonb)'::regprocedure;
 SELECT * INTO state_rel FROM pg_class WHERE oid='crm_security.user_opportunity_state'::regclass;
 IF md5(pg_get_functiondef(w.oid))<>'5bbfeae44207a639d80474f882b25e47'
  OR md5(pg_get_functiondef(r.oid))<>'5fe13081a33bcfee6a4e989f4680b3b4'
  OR md5(pg_get_functiondef(h.oid))<>'ba6945da818aff8a26f86037ff06b32a'
  OR moved.oid<>18115
  OR pg_get_userbyid(state_rel.relowner)<>'postgres' OR NOT state_rel.relrowsecurity
  OR has_table_privilege('public',state_rel.oid,'SELECT,INSERT,UPDATE,DELETE')
  OR has_table_privilege('anon',state_rel.oid,'SELECT,INSERT,UPDATE,DELETE')
  OR has_table_privilege('authenticated',state_rel.oid,'SELECT,INSERT,UPDATE,DELETE')
  OR has_table_privilege('service_role',state_rel.oid,'SELECT,INSERT,UPDATE,DELETE')
  OR (SELECT pg_get_constraintdef(oid,true) FROM pg_constraint
      WHERE conrelid='crm_security.command_receipts'::regclass
       AND conname='command_receipts_operation_check')
     IS DISTINCT FROM $expected$CHECK (operation = ANY (ARRAY['opportunity_work_set'::text, 'inquiry_assign'::text, 'service_change'::text, 'inquiry_unassign'::text, 'favorite_set'::text, 'opportunity_touch'::text]))$expected$
 THEN RAISE EXCEPTION 'personal-state targeted post-apply drift'; END IF;
END $target_post_guard$;
-- ===== APPLY pipeline_action =====
SET LOCAL crm.pipeline_action_ref='rprechiaglyjaydkmxsu';
SET LOCAL crm.pipeline_action_ref='rprechiaglyjaydkmxsu';

SET LOCAL search_path=pg_catalog;
SET LOCAL lock_timeout='3s';
SET LOCAL statement_timeout='60s';
DO $guard$ BEGIN
 IF current_user<>'postgres'
  OR current_setting('crm.pipeline_action_ref',true) IS DISTINCT FROM 'rprechiaglyjaydkmxsu'
  OR to_regprocedure('public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)') IS NULL
  OR to_regprocedure('crm_security.crm_write_command_v2_operational_20260906(uuid,text,uuid,integer,jsonb)') IS NULL
  OR to_regprocedure('crm_security.crm_user_opportunity_state_command_v2(uuid,text,uuid,integer,jsonb)') IS NULL
  OR to_regclass('crm_security.user_opportunity_state') IS NULL
  OR to_regprocedure('crm_security.crm_write_command_v2_personal_20260906(uuid,text,uuid,integer,jsonb)') IS NOT NULL
  OR to_regprocedure('crm_security.crm_pipeline_action_command_v1(uuid,text,uuid,integer,jsonb)') IS NOT NULL
  OR to_regnamespace('crm_pipeline_action_archive') IS NOT NULL
  OR (SELECT pg_get_constraintdef(oid,true) FROM pg_constraint
      WHERE conrelid='crm_security.command_receipts'::regclass
       AND conname='command_receipts_operation_check') IS DISTINCT FROM $expected$CHECK (operation = ANY (ARRAY['opportunity_work_set'::text, 'inquiry_assign'::text, 'service_change'::text, 'inquiry_unassign'::text, 'favorite_set'::text, 'opportunity_touch'::text]))$expected$
 THEN RAISE EXCEPTION 'pipeline-action after-personal prerequisite drift'; END IF;
END $guard$;
LOCK TABLE crm_security.command_receipts IN ACCESS EXCLUSIVE MODE;
ALTER FUNCTION public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)
 RENAME TO crm_write_command_v2_personal_20260906;
ALTER FUNCTION public.crm_write_command_v2_personal_20260906(uuid,text,uuid,integer,jsonb)
 SET SCHEMA crm_security;
REVOKE EXECUTE ON FUNCTION crm_security.crm_write_command_v2_personal_20260906(uuid,text,uuid,integer,jsonb)
 FROM PUBLIC,anon,authenticated,service_role;
ALTER TABLE crm_security.command_receipts DROP CONSTRAINT command_receipts_operation_check;
ALTER TABLE crm_security.command_receipts ADD CONSTRAINT command_receipts_operation_check
 CHECK(operation IN ('opportunity_work_set','inquiry_assign','service_change','inquiry_unassign','favorite_set','opportunity_touch','next_action','activity'));
CREATE FUNCTION crm_security.crm_pipeline_action_command_v1(
 p_request_id uuid,p_operation text,p_object_id uuid,p_expected_version integer,p_payload jsonb
) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $fn$
DECLARE
 a record; receipt crm_security.command_receipts%ROWTYPE;
 oldrow public.deals%ROWTYPE; newrow public.deals%ROWTYPE;
 canonical jsonb; ack jsonb; event uuid; created_id uuid;
 type_value text; text_value text; result_value text; assignee_value text;
 due_value date; occurred_value timestamptz; meaningful_value boolean;
 actor_email_value text; changed_at_value timestamptz;
 cancelled_ids jsonb:='[]'::jsonb;
BEGIN
 IF p_operation NOT IN ('next_action','activity') THEN
  RAISE EXCEPTION 'operation not handled by pipeline action helper' USING ERRCODE='22023';
 END IF;
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;
 PERFORM 1 FROM public.users u WHERE u.auth_uid=auth.uid() FOR SHARE;
 PERFORM 1 FROM crm_security.access_review r WHERE r.reviewed_auth_uid=auth.uid() FOR SHARE;
 SELECT * INTO a FROM crm_security.actor();
 IF NOT FOUND THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;
 IF p_request_id IS NULL OR p_object_id IS NULL OR p_expected_version IS NULL OR p_expected_version<0
  OR jsonb_typeof(p_payload) IS DISTINCT FROM 'object'
 THEN RAISE EXCEPTION 'invalid pipeline action envelope' USING ERRCODE='22023'; END IF;

 IF p_operation='next_action' THEN
  IF EXISTS(SELECT 1 FROM jsonb_object_keys(p_payload) k WHERE k NOT IN ('type','text','due_at','assignee'))
   OR NOT p_payload ?& ARRAY['type','text','due_at']
   OR jsonb_typeof(p_payload->'type') IS DISTINCT FROM 'string'
   OR length(trim(p_payload->>'type'))<1 OR length(p_payload->>'type')>100
   OR jsonb_typeof(p_payload->'text') IS DISTINCT FROM 'string'
   OR length(trim(p_payload->>'text'))<1 OR length(p_payload->>'text')>500
   OR jsonb_typeof(p_payload->'due_at') IS DISTINCT FROM 'string'
   OR p_payload->>'due_at' !~ '^\d{4}-\d{2}-\d{2}$'
   OR (p_payload ? 'assignee' AND jsonb_typeof(p_payload->'assignee') NOT IN ('string','null'))
   OR (jsonb_typeof(p_payload->'assignee')='string' AND
       (length(trim(p_payload->>'assignee'))<1 OR length(p_payload->>'assignee')>100))
  THEN RAISE EXCEPTION 'invalid next_action base payload' USING ERRCODE='22023'; END IF;
  BEGIN due_value:=(p_payload->>'due_at')::date;
  EXCEPTION WHEN datetime_field_overflow OR invalid_datetime_format THEN
   RAISE EXCEPTION 'invalid next_action due date' USING ERRCODE='22023'; END;
  type_value:=trim(p_payload->>'type'); text_value:=trim(p_payload->>'text');
  assignee_value:=nullif(trim(p_payload->>'assignee'),'');
  canonical:=jsonb_build_object('type',type_value,'text',text_value,'due_at',due_value::text)
   ||CASE WHEN assignee_value IS NULL THEN '{}'::jsonb ELSE jsonb_build_object('assignee',assignee_value) END;
 ELSE
  IF EXISTS(SELECT 1 FROM jsonb_object_keys(p_payload) k WHERE k NOT IN ('type','note','result','occurred_at','meaningful_contact'))
   OR NOT p_payload ?& ARRAY['type','note','occurred_at']
   OR jsonb_typeof(p_payload->'type') IS DISTINCT FROM 'string'
   OR length(trim(p_payload->>'type'))<1 OR length(p_payload->>'type')>100
   OR jsonb_typeof(p_payload->'note') IS DISTINCT FROM 'string'
   OR length(trim(p_payload->>'note'))<1 OR length(p_payload->>'note')>4000
   OR (p_payload ? 'result' AND jsonb_typeof(p_payload->'result') NOT IN ('string','null'))
   OR length(coalesce(p_payload->>'result',''))>8000
   OR jsonb_typeof(p_payload->'occurred_at') IS DISTINCT FROM 'string'
   OR (p_payload ? 'meaningful_contact' AND jsonb_typeof(p_payload->'meaningful_contact')<>'boolean')
  THEN RAISE EXCEPTION 'invalid activity base payload' USING ERRCODE='22023'; END IF;
  BEGIN occurred_value:=(p_payload->>'occurred_at')::timestamptz;
  EXCEPTION WHEN datetime_field_overflow OR invalid_datetime_format THEN
   RAISE EXCEPTION 'invalid activity occurred_at' USING ERRCODE='22023'; END;
  IF NOT isfinite(occurred_value) THEN RAISE EXCEPTION 'invalid activity occurred_at' USING ERRCODE='22023'; END IF;
  type_value:=trim(p_payload->>'type'); text_value:=trim(p_payload->>'note');
  result_value:=trim(coalesce(p_payload->>'result',''));
  meaningful_value:=CASE WHEN p_payload ? 'meaningful_contact' THEN (p_payload->>'meaningful_contact')::boolean
   WHEN type_value||' '||text_value||' '||result_value ~ '전화\s*시도|작성\s*시작|발송|카카오톡\s*연락\s*준비|부재|못\s*받|무응답|수신거부|실패' THEN false
   ELSE type_value||' '||text_value||' '||result_value ~ '통화\s*완료|통화\s*[—-]\s*진행|고객\s*요청|회신|답변|응답|면담|미팅|현장\s*방문|방문\s*완료|자료\s*수신|문의\s*접수' END;
  canonical:=jsonb_build_object('type',type_value,'note',text_value,'result',result_value,
   'occurred_at',p_payload->>'occurred_at','meaningful_contact',meaningful_value);
 END IF;

 PERFORM 1 FROM crm_security.object_scope s WHERE s.user_id=a.user_id AND s.deal_id=p_object_id FOR SHARE;
 SELECT * INTO oldrow FROM public.deals d WHERE d.id=p_object_id FOR UPDATE;
 IF NOT FOUND OR a.permission_role NOT IN ('rep','branch','admin') OR NOT crm_security.can_deal(p_object_id,true)
 THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(a.auth_uid::text||p_request_id::text,0));
 SELECT * INTO receipt FROM crm_security.command_receipts r WHERE r.actor_auth_uid=a.auth_uid AND r.request_id=p_request_id;
 IF FOUND THEN
  IF receipt.actor_user_id IS DISTINCT FROM a.user_id OR receipt.operation IS DISTINCT FROM p_operation
   OR receipt.object_id IS DISTINCT FROM p_object_id OR receipt.expected_version IS DISTINCT FROM p_expected_version
   OR receipt.payload IS DISTINCT FROM canonical
  THEN RAISE EXCEPTION 'REQUEST_ID_REUSE' USING ERRCODE='PT409'; END IF;
  RETURN receipt.ack||jsonb_build_object('replayed',true);
 END IF;
 IF oldrow.version IS DISTINCT FROM p_expected_version THEN RAISE EXCEPTION 'version conflict' USING ERRCODE='PT409'; END IF;
 changed_at_value:=clock_timestamp();

 IF p_operation='next_action' THEN
  IF assignee_value IS NULL THEN
   SELECT u.name INTO assignee_value FROM public.users u JOIN crm_security.access_review r ON r.user_id=u.user_id
    WHERE u.user_id=oldrow.owner_id AND u.active AND r.approved AND r.expires_at>now()
      AND r.permission_role IN ('rep','branch','admin');
  ELSE
   IF (SELECT count(*) FROM public.users u JOIN crm_security.access_review r ON r.user_id=u.user_id
       WHERE u.name=assignee_value AND u.active AND r.approved AND r.expires_at>now()
        AND r.permission_role IN ('rep','branch','admin'))<>1
   THEN RAISE EXCEPTION 'invalid next action assignee' USING ERRCODE='22023'; END IF;
  END IF;
  IF assignee_value IS NULL THEN RAISE EXCEPTION 'No approved UUID owner' USING ERRCODE='42501'; END IF;
  SELECT coalesce(jsonb_agg(id ORDER BY created_at),'[]'::jsonb) INTO cancelled_ids
   FROM public.next_actions WHERE deal_id=p_object_id AND status='open';
  UPDATE public.next_actions SET status='cancelled',updated_at=changed_at_value
   WHERE deal_id=p_object_id AND status='open';
  INSERT INTO public.next_actions(deal_id,action_type,title,due_at,assignee_name,status,created_at,updated_at)
  VALUES(p_object_id,type_value,text_value,due_value::timestamp AT TIME ZONE 'UTC',assignee_value,'open',changed_at_value,changed_at_value)
  RETURNING id INTO created_id;
  UPDATE public.deals SET next_action=text_value,next_action_date=due_value,updated_at=changed_at_value,version=version+1
   WHERE id=p_object_id AND version=p_expected_version RETURNING * INTO newrow;
 ELSE
  SELECT u.email INTO actor_email_value FROM public.users u WHERE u.user_id=a.user_id;
  INSERT INTO public.activities(deal_id,organization_id,actor_email,actor_name,type,detail,occurred_at)
  VALUES(p_object_id,oldrow.organization_id,actor_email_value,a.display_name,type_value,
   jsonb_build_object('note',text_value,'result',result_value,'meaningful_contact',meaningful_value),occurred_value)
  RETURNING id INTO created_id;
  UPDATE public.deals SET last_activity_at=greatest(last_activity_at,occurred_value),
   last_customer_contact_at=CASE WHEN meaningful_value THEN greatest(last_customer_contact_at,occurred_value) ELSE last_customer_contact_at END,
   updated_at=changed_at_value,version=version+1
   WHERE id=p_object_id AND version=p_expected_version RETURNING * INTO newrow;
 END IF;
 IF NOT FOUND THEN RAISE EXCEPTION 'unexpected version mutation' USING ERRCODE='PT409'; END IF;

 INSERT INTO crm_security.audit_events(actor_auth_uid,actor_user_id,actor_name,deal_id,action,before_data,after_data,reason,created_at)
 VALUES(a.auth_uid,a.user_id,a.display_name,p_object_id,p_operation,
  jsonb_build_object('version',oldrow.version,'next_action',oldrow.next_action,'next_action_date',oldrow.next_action_date,
   'last_activity_at',oldrow.last_activity_at,'last_customer_contact_at',oldrow.last_customer_contact_at),
  jsonb_build_object('version',newrow.version,'next_action',newrow.next_action,'next_action_date',newrow.next_action_date,
   'last_activity_at',newrow.last_activity_at,'last_customer_contact_at',newrow.last_customer_contact_at,
   'created_id',created_id,'cancelled_action_ids',cancelled_ids,'meaningful_contact',meaningful_value),
  CASE WHEN p_operation='next_action' THEN text_value ELSE type_value||': '||text_value END,changed_at_value)
 RETURNING event_id INTO event;
 ack:=jsonb_build_object('contract_version',1,'ok',true,'operation',p_operation,'request_id',p_request_id,
  'object_id',p_object_id,'actor_auth_uid',a.auth_uid,'actor_user_id',a.user_id,
  'previous_version',p_expected_version,'version',newrow.version,'audit_event_id',event,'replayed',false)
  ||CASE WHEN p_operation='next_action' THEN jsonb_build_object('next_action_id',created_id,'cancelled_action_ids',cancelled_ids,'due_at',due_value,'assignee_name',assignee_value)
         ELSE jsonb_build_object('activity_id',created_id,'meaningful_contact',meaningful_value,'occurred_at',occurred_value) END;
 INSERT INTO crm_security.command_receipts(actor_auth_uid,request_id,actor_user_id,operation,object_id,expected_version,payload,ack)
 VALUES(a.auth_uid,p_request_id,a.user_id,p_operation,p_object_id,p_expected_version,canonical,ack);
 RETURN ack;
END $fn$;

REVOKE EXECUTE ON FUNCTION crm_security.crm_pipeline_action_command_v1(uuid,text,uuid,integer,jsonb)
 FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION public.crm_write_command_v2(
 p_request_id uuid,p_operation text,p_object_id uuid,p_expected_version integer,p_payload jsonb
) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $fn$
BEGIN
 IF p_operation IN ('next_action','activity') THEN
  RETURN crm_security.crm_pipeline_action_command_v1(p_request_id,p_operation,p_object_id,p_expected_version,p_payload);
 END IF;
 RETURN crm_security.crm_write_command_v2_personal_20260906(p_request_id,p_operation,p_object_id,p_expected_version,p_payload);
END $fn$;
REVOKE EXECUTE ON FUNCTION public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)
 FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.crm_write_command_v2(uuid,text,uuid,integer,jsonb) TO authenticated;
DO $post$ BEGIN
 IF to_regprocedure('crm_security.crm_write_command_v2_personal_20260906(uuid,text,uuid,integer,jsonb)') IS NULL
  OR to_regprocedure('crm_security.crm_pipeline_action_command_v1(uuid,text,uuid,integer,jsonb)') IS NULL
  OR has_function_privilege('public','public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)','EXECUTE')
  OR has_function_privilege('anon','public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)','EXECUTE')
  OR NOT has_function_privilege('authenticated','public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)','EXECUTE')
  OR has_function_privilege('service_role','public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)','EXECUTE')
  OR has_function_privilege('authenticated','crm_security.crm_pipeline_action_command_v1(uuid,text,uuid,integer,jsonb)','EXECUTE')
  OR has_function_privilege('service_role','crm_security.crm_pipeline_action_command_v1(uuid,text,uuid,integer,jsonb)','EXECUTE')
  OR (SELECT pg_get_constraintdef(oid,true) FROM pg_constraint
      WHERE conrelid='crm_security.command_receipts'::regclass
       AND conname='command_receipts_operation_check') IS DISTINCT FROM $expected$CHECK (operation = ANY (ARRAY['opportunity_work_set'::text, 'inquiry_assign'::text, 'service_change'::text, 'inquiry_unassign'::text, 'favorite_set'::text, 'opportunity_touch'::text, 'next_action'::text, 'activity'::text]))$expected$
 THEN RAISE EXCEPTION 'pipeline-action targeted post-apply drift'; END IF;
END $post$;
-- ===== APPLY quote_version =====
SET LOCAL crm.quote_version_ref='rprechiaglyjaydkmxsu';
SET LOCAL crm.quote_version_ref='rprechiaglyjaydkmxsu';

SET LOCAL search_path=pg_catalog;
SET LOCAL lock_timeout='3s';
SET LOCAL statement_timeout='60s';
DO $guard$ BEGIN
 IF current_user<>'postgres' OR current_setting('crm.quote_version_ref',true) IS DISTINCT FROM 'rprechiaglyjaydkmxsu'
  OR to_regprocedure('public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)') IS NULL
  OR to_regprocedure('crm_security.crm_write_command_v2_personal_20260906(uuid,text,uuid,integer,jsonb)') IS NULL
  OR to_regprocedure('crm_security.crm_pipeline_action_command_v1(uuid,text,uuid,integer,jsonb)') IS NULL
  OR to_regprocedure('crm_security.crm_write_command_v2_action_20260906(uuid,text,uuid,integer,jsonb)') IS NOT NULL
  OR to_regprocedure('crm_security.crm_quote_version_command_v1(uuid,uuid,integer,jsonb)') IS NOT NULL
  OR to_regclass('crm_security.quote_versions') IS NOT NULL
  OR (SELECT pg_get_constraintdef(oid,true) FROM pg_constraint WHERE conrelid='crm_security.command_receipts'::regclass AND conname='command_receipts_operation_check') IS DISTINCT FROM $expected$CHECK (operation = ANY (ARRAY['opportunity_work_set'::text, 'inquiry_assign'::text, 'service_change'::text, 'inquiry_unassign'::text, 'favorite_set'::text, 'opportunity_touch'::text, 'next_action'::text, 'activity'::text]))$expected$
 THEN RAISE EXCEPTION 'quote-version after-action prerequisite drift'; END IF;
END $guard$;
ALTER FUNCTION public.crm_write_command_v2(uuid,text,uuid,integer,jsonb) RENAME TO crm_write_command_v2_action_20260906;
ALTER FUNCTION public.crm_write_command_v2_action_20260906(uuid,text,uuid,integer,jsonb) SET SCHEMA crm_security;
REVOKE EXECUTE ON FUNCTION crm_security.crm_write_command_v2_action_20260906(uuid,text,uuid,integer,jsonb) FROM PUBLIC,anon,authenticated,service_role;
ALTER TABLE crm_security.command_receipts DROP CONSTRAINT command_receipts_operation_check;
ALTER TABLE crm_security.command_receipts ADD CONSTRAINT command_receipts_operation_check CHECK(operation IN ('opportunity_work_set','inquiry_assign','service_change','inquiry_unassign','favorite_set','opportunity_touch','next_action','activity','quote_version'));
CREATE TABLE crm_security.quote_versions(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 deal_id uuid NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,
 version_no integer NOT NULL CHECK(version_no>0),
 amount bigint NOT NULL CHECK(amount>0),
 reason text NOT NULL CHECK(length(trim(reason))>=2),
 actor_auth_uid uuid NOT NULL,
 actor_user_id uuid NOT NULL REFERENCES public.users(user_id),
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(deal_id,version_no)
);
CREATE INDEX quote_versions_deal_version_idx ON crm_security.quote_versions(deal_id,version_no);
ALTER TABLE crm_security.quote_versions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON crm_security.quote_versions FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION crm_security.crm_quote_version_command_v1(
 p_request_id uuid,p_object_id uuid,p_expected_version integer,p_payload jsonb
) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $fn$
DECLARE a record; receipt crm_security.command_receipts%ROWTYPE;
 oldrow public.deals%ROWTYPE; newrow public.deals%ROWTYPE;
 canonical jsonb; ack jsonb; event uuid; quote_id uuid;
 amount_value bigint; reason_value text; server_version integer; server_at timestamptz;
BEGIN
 IF p_request_id IS NULL OR p_object_id IS NULL OR p_expected_version IS NULL OR p_expected_version<0
  OR jsonb_typeof(p_payload) IS DISTINCT FROM 'object'
  OR EXISTS(SELECT 1 FROM jsonb_object_keys(p_payload) k
     WHERE k NOT IN ('amount','reason','version_no','created_at','created_by'))
  OR NOT p_payload ?& ARRAY['amount','reason']
  OR jsonb_typeof(p_payload->'amount') NOT IN ('number','string')
  OR jsonb_typeof(p_payload->'reason') IS DISTINCT FROM 'string'
  OR length(trim(p_payload->>'reason'))<2 OR length(p_payload->>'reason')>2000
  OR (p_payload ? 'version_no' AND jsonb_typeof(p_payload->'version_no') NOT IN ('number','string'))
  OR (p_payload ? 'created_at' AND jsonb_typeof(p_payload->'created_at') NOT IN ('string','null'))
  OR (p_payload ? 'created_by' AND jsonb_typeof(p_payload->'created_by') NOT IN ('string','null'))
 THEN RAISE EXCEPTION 'invalid quote version payload' USING ERRCODE='22023'; END IF;
 BEGIN amount_value:=(p_payload->>'amount')::bigint;
 EXCEPTION WHEN invalid_text_representation OR numeric_value_out_of_range THEN
  RAISE EXCEPTION 'invalid quote amount' USING ERRCODE='22023'; END;
 IF amount_value<=0 THEN RAISE EXCEPTION 'invalid quote amount' USING ERRCODE='22023'; END IF;
 reason_value:=trim(p_payload->>'reason');
 canonical:=jsonb_build_object('amount',amount_value,'reason',reason_value);

 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;
 PERFORM 1 FROM public.users u WHERE u.auth_uid=auth.uid() FOR SHARE;
 PERFORM 1 FROM crm_security.access_review r WHERE r.reviewed_auth_uid=auth.uid() FOR SHARE;
 SELECT * INTO a FROM crm_security.actor();
 IF NOT FOUND THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;
 PERFORM 1 FROM crm_security.object_scope s WHERE s.user_id=a.user_id AND s.deal_id=p_object_id FOR SHARE;
 SELECT * INTO oldrow FROM public.deals d WHERE d.id=p_object_id FOR UPDATE;
 IF NOT FOUND OR a.permission_role NOT IN ('rep','branch','admin') OR NOT crm_security.can_deal(p_object_id,true)
 THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(a.auth_uid::text||p_request_id::text,0));
 SELECT * INTO receipt FROM crm_security.command_receipts r
  WHERE r.actor_auth_uid=a.auth_uid AND r.request_id=p_request_id;
 IF FOUND THEN
  IF receipt.actor_user_id IS DISTINCT FROM a.user_id OR receipt.operation IS DISTINCT FROM 'quote_version'
   OR receipt.object_id IS DISTINCT FROM p_object_id OR receipt.expected_version IS DISTINCT FROM p_expected_version
   OR receipt.payload IS DISTINCT FROM canonical
  THEN RAISE EXCEPTION 'REQUEST_ID_REUSE' USING ERRCODE='PT409'; END IF;
  RETURN receipt.ack||jsonb_build_object('replayed',true);
 END IF;
 IF oldrow.version IS DISTINCT FROM p_expected_version
 THEN RAISE EXCEPTION 'version conflict' USING ERRCODE='PT409'; END IF;

 SELECT coalesce(max(q.version_no),0)+1 INTO server_version
 FROM crm_security.quote_versions q WHERE q.deal_id=p_object_id;
 server_at:=clock_timestamp();
 INSERT INTO crm_security.quote_versions(deal_id,version_no,amount,reason,actor_auth_uid,actor_user_id,created_at)
 VALUES(p_object_id,server_version,amount_value,reason_value,a.auth_uid,a.user_id,server_at)
 RETURNING id INTO quote_id;
 UPDATE public.deals SET updated_at=server_at,version=version+1
  WHERE id=p_object_id AND version=p_expected_version RETURNING * INTO newrow;
 IF NOT FOUND THEN RAISE EXCEPTION 'unexpected version mutation' USING ERRCODE='PT409'; END IF;
 INSERT INTO crm_security.audit_events(actor_auth_uid,actor_user_id,actor_name,deal_id,action,before_data,after_data,reason,created_at)
 VALUES(a.auth_uid,a.user_id,a.display_name,p_object_id,'quote_version',
  jsonb_build_object('version',oldrow.version,'latest_quote_version',server_version-1),
  jsonb_build_object('version',newrow.version,'quote_version_id',quote_id,'version_no',server_version,'amount',amount_value),
  reason_value,server_at) RETURNING event_id INTO event;
 ack:=jsonb_build_object('contract_version',1,'ok',true,'request_id',p_request_id,
  'operation','quote_version','object_id',p_object_id,'actor_auth_uid',a.auth_uid,
  'actor_user_id',a.user_id,'previous_version',p_expected_version,'version',newrow.version,
  'quote_version_id',quote_id,'version_no',server_version,'amount',amount_value,
  'audit_event_id',event,'server_at',server_at,'replayed',false);
 INSERT INTO crm_security.command_receipts(actor_auth_uid,request_id,actor_user_id,operation,object_id,expected_version,payload,ack)
 VALUES(a.auth_uid,p_request_id,a.user_id,'quote_version',p_object_id,p_expected_version,canonical,ack);
 RETURN ack;
END $fn$;

REVOKE EXECUTE ON FUNCTION crm_security.crm_quote_version_command_v1(uuid,uuid,integer,jsonb)
 FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION public.crm_write_command_v2(p_request_id uuid,p_operation text,p_object_id uuid,p_expected_version integer,p_payload jsonb)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $fn$
BEGIN
 IF p_operation='quote_version' THEN RETURN crm_security.crm_quote_version_command_v1(p_request_id,p_object_id,p_expected_version,p_payload); END IF;
 RETURN crm_security.crm_write_command_v2_action_20260906(p_request_id,p_operation,p_object_id,p_expected_version,p_payload);
END $fn$;
REVOKE EXECUTE ON FUNCTION public.crm_write_command_v2(uuid,text,uuid,integer,jsonb) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.crm_write_command_v2(uuid,text,uuid,integer,jsonb) TO authenticated;
DO $post$ BEGIN
 IF has_function_privilege('anon','public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)','EXECUTE')
  OR NOT has_function_privilege('authenticated','public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)','EXECUTE')
  OR has_function_privilege('service_role','public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)','EXECUTE')
  OR has_function_privilege('authenticated','crm_security.crm_quote_version_command_v1(uuid,uuid,integer,jsonb)','EXECUTE')
  OR has_table_privilege('authenticated','crm_security.quote_versions','SELECT,INSERT,UPDATE,DELETE')
  OR (SELECT pg_get_constraintdef(oid,true) FROM pg_constraint WHERE conrelid='crm_security.command_receipts'::regclass AND conname='command_receipts_operation_check') IS DISTINCT FROM $expected$CHECK (operation = ANY (ARRAY['opportunity_work_set'::text, 'inquiry_assign'::text, 'service_change'::text, 'inquiry_unassign'::text, 'favorite_set'::text, 'opportunity_touch'::text, 'next_action'::text, 'activity'::text, 'quote_version'::text]))$expected$
 THEN RAISE EXCEPTION 'quote-version post-apply drift'; END IF;
END $post$;
-- ===== APPLY operational_source =====
SET LOCAL crm.operational_source_ref='rprechiaglyjaydkmxsu';
-- LOCAL CHAIN CANDIDATE AFTER personal-state, action and quote-version layers.
-- Adds a new authenticated, domain-paged operational source. Existing public
-- read/write functions are captured and verified unchanged.

SET LOCAL search_path=pg_catalog;
SET LOCAL lock_timeout='3s';
SET LOCAL statement_timeout='60s';

DO $approval$ BEGIN
 IF current_user<>'postgres'
  OR current_setting('crm.operational_source_ref',true) IS DISTINCT FROM 'rprechiaglyjaydkmxsu'
  OR to_regprocedure('public.crm_read_scoped_v2(uuid,integer,uuid,uuid)') IS NULL
  OR to_regprocedure('public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)') IS NULL
  OR to_regclass('crm_security.user_opportunity_state') IS NULL
  OR to_regclass('crm_security.quote_versions') IS NULL
  OR to_regclass('public.sites') IS NULL
  OR to_regclass('public.contacts') IS NULL
  OR to_regprocedure('crm_security.crm_operational_source_fragment_v1(text,uuid,integer)') IS NOT NULL
  OR to_regprocedure('public.crm_operational_source_v1(text,uuid,integer)') IS NOT NULL
 THEN RAISE EXCEPTION 'operational source prerequisite drift'; END IF;
END $approval$;

CREATE TEMP TABLE operational_source_guard AS
SELECT p.oid,p.prosrc,p.proconfig,coalesce(p.proacl::text,'') acl
FROM pg_proc p
WHERE p.oid IN (
 'public.crm_read_scoped_v2(uuid,integer,uuid,uuid)'::regprocedure,
 'public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)'::regprocedure);

CREATE FUNCTION crm_security.crm_operational_source_fragment_v1(
 p_domain text,p_after uuid,p_limit integer
) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $fn$
DECLARE raw_items jsonb; items jsonb; next_cursor uuid; has_more boolean; a record;
BEGIN
 SELECT * INTO a FROM crm_security.actor();
 IF NOT FOUND THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;
 IF p_domain NOT IN ('deal_core','inquiry_core')
 THEN RAISE EXCEPTION 'unsupported operational source domain' USING ERRCODE='22023'; END IF;
 IF p_limit IS NULL OR p_limit<1 OR p_limit>100
 THEN RAISE EXCEPTION 'invalid limit' USING ERRCODE='22023'; END IF;

 IF p_domain='deal_core' THEN
  SELECT coalesce(jsonb_agg(to_jsonb(q) ORDER BY q.id),'[]'::jsonb) INTO raw_items FROM(
   SELECT d.id,d.site_id,
    coalesce(s.site_name,o.name,nullif(d.list_fields->>'site_name',''),nullif(d.list_fields->>'name','')) AS site_name,
    coalesce(s.site_name,o.name,nullif(d.list_fields->>'site_name',''),nullif(d.list_fields->>'name','')) AS site,
    d.owner_id,coalesce(u.name,d.assignee_name) AS owner_name,coalesce(u.name,d.assignee_name) AS assignee,
    d.stage_code,d.stage_raw,d.stage_group,d.brand,d.list_name,
    d.amount,d.amount AS amt,d.amount_unknown_reason,
    d.created_at,d.created_at AS created,d.updated_at,d.updated_at AS updated,d.closed_at,d.closed_at AS closed,d.opened_at,
    d.lifecycle_status,d.outcome,d.wake_up_at,d.stage_entered_at,
    d.last_activity_at,d.last_activity_at AS "lastActivity",d.last_customer_contact_at,
    d.stage_entered_at AS "stageAt",d.origin_inquiry_id,d.origin_channel,
    d.source,d.outbound_channel,d.lost_reason,d.lost_kind,d.badfit_type,
    d.service_type,d.service_history,d.origin_business,d.current_business,d.business_history,
    d.primary_work,d.work_items,d.work_scope_type,d.work_summary,d.version,
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
    coalesce((SELECT jsonb_agg(jsonb_build_object('from',h.from_stage,'to',h.to_stage,'changed_at',h.changed_at) ORDER BY h.changed_at,h.id)
     FROM public.stage_history h WHERE h.opportunity_id=d.id),'[]'::jsonb) AS stage_history,
    coalesce((SELECT jsonb_agg(jsonb_build_object('id',ac.id,'type',ac.type,'occurred_at',ac.occurred_at) ORDER BY ac.occurred_at,ac.id)
     FROM public.activities ac WHERE ac.deal_id=d.id),'[]'::jsonb) AS activity_signals
   FROM public.deals d
   LEFT JOIN public.sites s ON s.site_id=d.site_id
   LEFT JOIN public.organizations o ON o.id=d.organization_id
   LEFT JOIN public.users u ON u.user_id=d.owner_id
   LEFT JOIN public.contacts c ON c.id=d.contact_id
   LEFT JOIN crm_security.user_opportunity_state ps ON ps.actor_user_id=a.user_id AND ps.deal_id=d.id
   WHERE crm_security.can_deal(d.id,false) AND (p_after IS NULL OR d.id>p_after)
   ORDER BY d.id LIMIT p_limit+1
  )q;
 ELSE
  SELECT coalesce(jsonb_agg(to_jsonb(q) ORDER BY q.id),'[]'::jsonb) INTO raw_items FROM(
   SELECT i.id,i.site_id,i.site_name,i.brand,i.inquiry_type,i.work_type,i.source_channel,i.channel,
    i.assigned_to,coalesce(u.name,i.assignee_name) AS assignee_name,ar.permission_role AS assignee_permission_role,
    i.status,i.deal_id,i.opportunity_id,i.received_at,i.created_at,i.updated_at,i.assigned_at,
    i.first_response_at,i.responded_at,i.next_action_date,i.contact_name,i.phone
   FROM public.inquiries i
   LEFT JOIN public.users u ON u.user_id=i.assigned_to
   LEFT JOIN crm_security.access_review ar ON ar.user_id=i.assigned_to AND ar.approved AND ar.expires_at>now()
   WHERE crm_security.can_inquiry(i.id) AND (p_after IS NULL OR i.id>p_after)
   ORDER BY i.id LIMIT p_limit+1
  )q;
 END IF;

 has_more:=jsonb_array_length(raw_items)>p_limit;
 items:=CASE WHEN has_more THEN raw_items-p_limit ELSE raw_items END;
 next_cursor:=CASE WHEN has_more AND jsonb_array_length(items)>0
  THEN (items->(jsonb_array_length(items)-1)->>'id')::uuid ELSE NULL END;
 RETURN jsonb_build_object(
  'contract_version',1,'resource','operational_source','domain',p_domain,
  'scope_completeness','actor_authorized_rows_only',
  'actor_user_id',a.user_id,'actor_permission_role',a.permission_role,
  'items',items,'pagination',jsonb_build_object(
   'completeness',CASE WHEN has_more THEN 'partial' ELSE 'complete' END,
   'has_more',has_more,'next_cursor',next_cursor));
END $fn$;

REVOKE EXECUTE ON FUNCTION crm_security.crm_operational_source_fragment_v1(text,uuid,integer)
 FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION public.crm_operational_source_v1(
 p_domain text,p_after uuid DEFAULT NULL::uuid,p_limit integer DEFAULT 100
) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $fn$
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;
 RETURN crm_security.crm_operational_source_fragment_v1(p_domain,p_after,p_limit);
END $fn$;

REVOKE EXECUTE ON FUNCTION public.crm_operational_source_v1(text,uuid,integer)
 FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.crm_operational_source_v1(text,uuid,integer)
 TO authenticated;

DO $verify$ DECLARE helper record; public_fn record; changed integer; BEGIN
 SELECT * INTO helper FROM pg_proc WHERE oid='crm_security.crm_operational_source_fragment_v1(text,uuid,integer)'::regprocedure;
 SELECT * INTO public_fn FROM pg_proc WHERE oid='public.crm_operational_source_v1(text,uuid,integer)'::regprocedure;
 SELECT count(*) INTO changed FROM operational_source_guard g JOIN pg_proc p ON p.oid=g.oid
  WHERE p.prosrc IS DISTINCT FROM g.prosrc OR p.proconfig IS DISTINCT FROM g.proconfig
   OR coalesce(p.proacl::text,'') IS DISTINCT FROM g.acl;
 IF changed<>0
  OR helper.oid IS NULL OR pg_get_userbyid(helper.proowner)<>'postgres' OR NOT helper.prosecdef
  OR helper.provolatile<>'s' OR helper.proconfig IS DISTINCT FROM ARRAY['search_path=""']
  OR has_function_privilege('anon',helper.oid,'EXECUTE')
  OR has_function_privilege('authenticated',helper.oid,'EXECUTE')
  OR has_function_privilege('service_role',helper.oid,'EXECUTE')
  OR EXISTS(SELECT 1 FROM aclexplode(helper.proacl)x WHERE x.grantee=0)
  OR public_fn.oid IS NULL OR pg_get_userbyid(public_fn.proowner)<>'postgres' OR NOT public_fn.prosecdef
  OR public_fn.provolatile<>'s' OR public_fn.proconfig IS DISTINCT FROM ARRAY['search_path=""']
  OR has_function_privilege('public',public_fn.oid,'EXECUTE')
  OR has_function_privilege('anon',public_fn.oid,'EXECUTE')
  OR NOT has_function_privilege('authenticated',public_fn.oid,'EXECUTE')
  OR has_function_privilege('service_role',public_fn.oid,'EXECUTE')
 THEN RAISE EXCEPTION 'operational source ACL/config/identity drift'; END IF;
END $verify$;
-- ===== APPLY next_complete =====
SET LOCAL crm.next_complete_ref='rprechiaglyjaydkmxsu';
SET LOCAL crm.next_complete_ref='rprechiaglyjaydkmxsu';

SET LOCAL search_path=pg_catalog;
SET LOCAL lock_timeout='3s';
SET LOCAL statement_timeout='60s';
DO $guard$ BEGIN
 IF current_user<>'postgres' OR current_setting('crm.next_complete_ref',true) IS DISTINCT FROM 'rprechiaglyjaydkmxsu'
  OR to_regprocedure('public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)') IS NULL
  OR to_regprocedure('crm_security.crm_write_command_v2_action_20260906(uuid,text,uuid,integer,jsonb)') IS NULL
  OR to_regprocedure('crm_security.crm_quote_version_command_v1(uuid,uuid,integer,jsonb)') IS NULL
  OR to_regclass('crm_security.quote_versions') IS NULL
  OR to_regprocedure('public.crm_operational_source_v1(text,uuid,integer)') IS NULL
  OR to_regprocedure('crm_security.crm_write_command_v2_quote_20260906(uuid,text,uuid,integer,jsonb)') IS NOT NULL
  OR to_regprocedure('crm_security.crm_next_action_complete_command_v1(uuid,uuid,integer,jsonb)') IS NOT NULL
  OR (SELECT pg_get_constraintdef(oid,true) FROM pg_constraint WHERE conrelid='crm_security.command_receipts'::regclass AND conname='command_receipts_operation_check') IS DISTINCT FROM $expected$CHECK (operation = ANY (ARRAY['opportunity_work_set'::text, 'inquiry_assign'::text, 'service_change'::text, 'inquiry_unassign'::text, 'favorite_set'::text, 'opportunity_touch'::text, 'next_action'::text, 'activity'::text, 'quote_version'::text]))$expected$
 THEN RAISE EXCEPTION 'next-complete after-operational-source prerequisite drift'; END IF;
END $guard$;
ALTER FUNCTION public.crm_write_command_v2(uuid,text,uuid,integer,jsonb) RENAME TO crm_write_command_v2_quote_20260906;
ALTER FUNCTION public.crm_write_command_v2_quote_20260906(uuid,text,uuid,integer,jsonb) SET SCHEMA crm_security;
REVOKE EXECUTE ON FUNCTION crm_security.crm_write_command_v2_quote_20260906(uuid,text,uuid,integer,jsonb) FROM PUBLIC,anon,authenticated,service_role;
ALTER TABLE crm_security.command_receipts DROP CONSTRAINT command_receipts_operation_check;
ALTER TABLE crm_security.command_receipts ADD CONSTRAINT command_receipts_operation_check CHECK(operation IN ('opportunity_work_set','inquiry_assign','service_change','inquiry_unassign','favorite_set','opportunity_touch','next_action','activity','quote_version','next_action_complete'));
CREATE FUNCTION crm_security.crm_next_action_complete_command_v1(
 p_request_id uuid,p_object_id uuid,p_expected_version integer,p_payload jsonb
) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $fn$
DECLARE a record; receipt crm_security.command_receipts%ROWTYPE;
 oldrow public.deals%ROWTYPE; newrow public.deals%ROWTYPE; actionrow public.next_actions%ROWTYPE;
 canonical jsonb; ack jsonb; event uuid; activity_id uuid; server_at timestamptz;
 next_title text; next_due date; actor_email_value text;
BEGIN
 IF p_request_id IS NULL OR p_object_id IS NULL OR p_expected_version IS NULL OR p_expected_version<0
  OR jsonb_typeof(p_payload) IS DISTINCT FROM 'object'
  OR EXISTS(SELECT 1 FROM jsonb_object_keys(p_payload) k WHERE k<>'action_id')
  OR NOT p_payload ? 'action_id' OR jsonb_typeof(p_payload->'action_id') IS DISTINCT FROM 'string'
 THEN RAISE EXCEPTION 'invalid next action completion payload' USING ERRCODE='22023'; END IF;
 BEGIN canonical:=jsonb_build_object('action_id',(p_payload->>'action_id')::uuid);
 EXCEPTION WHEN invalid_text_representation THEN
  RAISE EXCEPTION 'invalid next action id' USING ERRCODE='22023'; END;

 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;
 PERFORM 1 FROM public.users u WHERE u.auth_uid=auth.uid() FOR SHARE;
 PERFORM 1 FROM crm_security.access_review r WHERE r.reviewed_auth_uid=auth.uid() FOR SHARE;
 SELECT * INTO a FROM crm_security.actor();
 IF NOT FOUND THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;
 PERFORM 1 FROM crm_security.object_scope s WHERE s.user_id=a.user_id AND s.deal_id=p_object_id FOR SHARE;
 SELECT * INTO oldrow FROM public.deals d WHERE d.id=p_object_id FOR UPDATE;
 IF NOT FOUND OR a.permission_role NOT IN ('rep','branch','admin') OR NOT crm_security.can_deal(p_object_id,true)
 THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;

 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(a.auth_uid::text||p_request_id::text,0));
 SELECT * INTO receipt FROM crm_security.command_receipts r
  WHERE r.actor_auth_uid=a.auth_uid AND r.request_id=p_request_id;
 IF FOUND THEN
  IF receipt.actor_user_id IS DISTINCT FROM a.user_id OR receipt.operation IS DISTINCT FROM 'next_action_complete'
   OR receipt.object_id IS DISTINCT FROM p_object_id OR receipt.expected_version IS DISTINCT FROM p_expected_version
   OR receipt.payload IS DISTINCT FROM canonical
  THEN RAISE EXCEPTION 'REQUEST_ID_REUSE' USING ERRCODE='PT409'; END IF;
  RETURN receipt.ack||jsonb_build_object('replayed',true);
 END IF;
 IF oldrow.version IS DISTINCT FROM p_expected_version
 THEN RAISE EXCEPTION 'version conflict' USING ERRCODE='PT409'; END IF;

 SELECT * INTO actionrow FROM public.next_actions n
  WHERE n.id=(canonical->>'action_id')::uuid AND n.deal_id=p_object_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;
 IF actionrow.status IS DISTINCT FROM 'open'
 THEN RAISE EXCEPTION 'next action state conflict' USING ERRCODE='PT409'; END IF;

 server_at:=clock_timestamp();
 UPDATE public.next_actions SET status='completed',completed_at=server_at,updated_at=server_at
  WHERE id=actionrow.id AND status='open';
 SELECT n.title,n.due_at::date INTO next_title,next_due FROM public.next_actions n
  WHERE n.deal_id=p_object_id AND n.status='open' ORDER BY n.due_at NULLS LAST,n.id LIMIT 1;
 SELECT u.email INTO actor_email_value FROM public.users u WHERE u.user_id=a.user_id;
 INSERT INTO public.activities(deal_id,organization_id,actor_email,actor_name,type,detail,occurred_at)
 VALUES(p_object_id,oldrow.organization_id,actor_email_value,a.display_name,'다음 행동 완료',
  jsonb_build_object('note',actionrow.title,'result','다음 행동 완료','action_id',actionrow.id,'meaningful_contact',false),server_at)
 RETURNING id INTO activity_id;
 UPDATE public.deals SET next_action=next_title,next_action_date=next_due,last_activity_at=server_at,
  updated_at=server_at,version=version+1
  WHERE id=p_object_id AND version=p_expected_version RETURNING * INTO newrow;
 IF NOT FOUND THEN RAISE EXCEPTION 'unexpected version mutation' USING ERRCODE='PT409'; END IF;

 INSERT INTO crm_security.audit_events(actor_auth_uid,actor_user_id,actor_name,deal_id,action,before_data,after_data,reason,created_at)
 VALUES(a.auth_uid,a.user_id,a.display_name,p_object_id,'next_action_complete',
  jsonb_build_object('version',oldrow.version,'action_id',actionrow.id,'action_status',actionrow.status,
   'next_action',oldrow.next_action,'next_action_date',oldrow.next_action_date),
  jsonb_build_object('version',newrow.version,'action_id',actionrow.id,'action_status','completed',
   'completed_at',server_at,'activity_id',activity_id,'next_action',newrow.next_action,'next_action_date',newrow.next_action_date),
  actionrow.title,server_at) RETURNING event_id INTO event;
 ack:=jsonb_build_object('contract_version',1,'ok',true,'request_id',p_request_id,
  'operation','next_action_complete','object_id',p_object_id,'actor_auth_uid',a.auth_uid,
  'actor_user_id',a.user_id,'previous_version',p_expected_version,'version',newrow.version,
  'next_action_id',actionrow.id,'activity_id',activity_id,'completed_at',server_at,
  'audit_event_id',event,'replayed',false);
 INSERT INTO crm_security.command_receipts(actor_auth_uid,request_id,actor_user_id,operation,object_id,expected_version,payload,ack)
 VALUES(a.auth_uid,p_request_id,a.user_id,'next_action_complete',p_object_id,p_expected_version,canonical,ack);
 RETURN ack;
END $fn$;

REVOKE EXECUTE ON FUNCTION crm_security.crm_next_action_complete_command_v1(uuid,uuid,integer,jsonb)
 FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION public.crm_write_command_v2(p_request_id uuid,p_operation text,p_object_id uuid,p_expected_version integer,p_payload jsonb)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $fn$
BEGIN
 IF p_operation='next_action_complete' THEN RETURN crm_security.crm_next_action_complete_command_v1(p_request_id,p_object_id,p_expected_version,p_payload); END IF;
 RETURN crm_security.crm_write_command_v2_quote_20260906(p_request_id,p_operation,p_object_id,p_expected_version,p_payload);
END $fn$;
REVOKE EXECUTE ON FUNCTION public.crm_write_command_v2(uuid,text,uuid,integer,jsonb) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.crm_write_command_v2(uuid,text,uuid,integer,jsonb) TO authenticated;
DO $post$ BEGIN
 IF has_function_privilege('anon','public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)','EXECUTE')
  OR NOT has_function_privilege('authenticated','public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)','EXECUTE')
  OR has_function_privilege('service_role','public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)','EXECUTE')
  OR has_function_privilege('authenticated','crm_security.crm_next_action_complete_command_v1(uuid,uuid,integer,jsonb)','EXECUTE')
  OR (SELECT pg_get_constraintdef(oid,true) FROM pg_constraint WHERE conrelid='crm_security.command_receipts'::regclass AND conname='command_receipts_operation_check') IS DISTINCT FROM $expected$CHECK (operation = ANY (ARRAY['opportunity_work_set'::text, 'inquiry_assign'::text, 'service_change'::text, 'inquiry_unassign'::text, 'favorite_set'::text, 'opportunity_touch'::text, 'next_action'::text, 'activity'::text, 'quote_version'::text, 'next_action_complete'::text]))$expected$
 THEN RAISE EXCEPTION 'next-complete post-apply drift'; END IF;
END $post$;
-- ===== APPLY stage_check =====
SET LOCAL crm.stage_check_ref='rprechiaglyjaydkmxsu';
SET LOCAL crm.stage_check_ref='rprechiaglyjaydkmxsu';

SET LOCAL search_path=pg_catalog;
SET LOCAL lock_timeout='3s';
SET LOCAL statement_timeout='60s';
DO $guard$ BEGIN
 IF current_user<>'postgres' OR current_setting('crm.stage_check_ref',true) IS DISTINCT FROM 'rprechiaglyjaydkmxsu'
  OR to_regprocedure('public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)') IS NULL
  OR to_regprocedure('crm_security.crm_write_command_v2_quote_20260906(uuid,text,uuid,integer,jsonb)') IS NULL
  OR to_regprocedure('crm_security.crm_next_action_complete_command_v1(uuid,uuid,integer,jsonb)') IS NULL
  OR to_regprocedure('public.crm_operational_source_v1(text,uuid,integer)') IS NULL
  OR to_regprocedure('crm_security.crm_operational_source_fragment_v1(text,uuid,integer)') IS NULL
  OR to_regprocedure('crm_security.crm_write_command_v2_next_complete_20260906(uuid,text,uuid,integer,jsonb)') IS NOT NULL
  OR to_regprocedure('crm_security.crm_operational_source_fragment_pre_stage_20260906(text,uuid,integer)') IS NOT NULL
  OR to_regprocedure('crm_security.crm_stage_check_command_v1(uuid,uuid,integer,jsonb)') IS NOT NULL
  OR EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='deals' AND column_name='stage_checklist')
  OR (SELECT pg_get_constraintdef(oid,true) FROM pg_constraint WHERE conrelid='crm_security.command_receipts'::regclass AND conname='command_receipts_operation_check') IS DISTINCT FROM $expected$CHECK (operation = ANY (ARRAY['opportunity_work_set'::text, 'inquiry_assign'::text, 'service_change'::text, 'inquiry_unassign'::text, 'favorite_set'::text, 'opportunity_touch'::text, 'next_action'::text, 'activity'::text, 'quote_version'::text, 'next_action_complete'::text]))$expected$
 THEN RAISE EXCEPTION 'stage-check after-next-complete prerequisite drift'; END IF;
END $guard$;
CREATE TEMP TABLE stage_check_source_guard AS SELECT p.oid,p.prosrc,p.proconfig,coalesce(p.proacl::text,'') acl FROM pg_proc p WHERE p.oid='public.crm_operational_source_v1(text,uuid,integer)'::regprocedure;
ALTER FUNCTION public.crm_write_command_v2(uuid,text,uuid,integer,jsonb) RENAME TO crm_write_command_v2_next_complete_20260906;
ALTER FUNCTION public.crm_write_command_v2_next_complete_20260906(uuid,text,uuid,integer,jsonb) SET SCHEMA crm_security;
REVOKE EXECUTE ON FUNCTION crm_security.crm_write_command_v2_next_complete_20260906(uuid,text,uuid,integer,jsonb) FROM PUBLIC,anon,authenticated,service_role;
ALTER FUNCTION crm_security.crm_operational_source_fragment_v1(text,uuid,integer) RENAME TO crm_operational_source_fragment_pre_stage_20260906;
REVOKE EXECUTE ON FUNCTION crm_security.crm_operational_source_fragment_pre_stage_20260906(text,uuid,integer) FROM PUBLIC,anon,authenticated,service_role;
ALTER TABLE public.deals ADD COLUMN stage_checklist jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE crm_security.command_receipts DROP CONSTRAINT command_receipts_operation_check;
ALTER TABLE crm_security.command_receipts ADD CONSTRAINT command_receipts_operation_check CHECK(operation IN ('opportunity_work_set','inquiry_assign','service_change','inquiry_unassign','favorite_set','opportunity_touch','next_action','activity','quote_version','next_action_complete','stage_check'));
CREATE FUNCTION crm_security.crm_stage_check_command_v1(
 p_request_id uuid,p_object_id uuid,p_expected_version integer,p_payload jsonb
) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $fn$
DECLARE a record; receipt crm_security.command_receipts%ROWTYPE;
 oldrow public.deals%ROWTYPE; newrow public.deals%ROWTYPE;
 canonical jsonb; ack jsonb; event uuid; server_at timestamptz;
 stage_value text; item_value integer; checked_value boolean; item_label text;
 prior_json jsonb; prior_value boolean;
BEGIN
 IF p_request_id IS NULL OR p_object_id IS NULL OR p_expected_version IS NULL OR p_expected_version<0
  OR jsonb_typeof(p_payload) IS DISTINCT FROM 'object'
  OR EXISTS(SELECT 1 FROM jsonb_object_keys(p_payload) k WHERE k NOT IN ('stage_code','item_index','checked'))
  OR NOT p_payload ?& ARRAY['stage_code','item_index','checked']
  OR jsonb_typeof(p_payload->'stage_code') IS DISTINCT FROM 'string'
  OR jsonb_typeof(p_payload->'item_index') IS DISTINCT FROM 'number'
  OR jsonb_typeof(p_payload->'checked') IS DISTINCT FROM 'boolean'
 THEN RAISE EXCEPTION 'invalid stage check payload' USING ERRCODE='22023'; END IF;
 BEGIN
  stage_value:=p_payload->>'stage_code';
  item_value:=(p_payload->>'item_index')::integer;
  checked_value:=(p_payload->>'checked')::boolean;
 EXCEPTION WHEN invalid_text_representation OR numeric_value_out_of_range THEN
  RAISE EXCEPTION 'invalid stage check payload' USING ERRCODE='22023';
 END;
 item_label:=CASE stage_value
  WHEN 'first_contact' THEN CASE item_value WHEN 1 THEN '공사 예정시기 확인' WHEN 3 THEN '예산·견적 필요 여부 확인' END
  WHEN 'consulting' THEN CASE item_value WHEN 3 THEN '견적 작성 요청' END
  WHEN 'sent' THEN CASE item_value WHEN 1 THEN '자료 수신 확인' WHEN 2 THEN '검토 일정 확인' END
  WHEN 'rapport' THEN CASE item_value WHEN 2 THEN '예산·회의 시점 확인' END
  WHEN 'silent' THEN CASE item_value WHEN 1 THEN '진행·보류 여부 확인' END
  WHEN 'waiting' THEN CASE item_value WHEN 0 THEN '대기 사유 기록' WHEN 1 THEN '재개 조건 확인' END
  WHEN 'compete' THEN CASE item_value WHEN 0 THEN '경쟁업체 여부 확인' WHEN 1 THEN 'PT·현설 일정 확인' END
  WHEN 'imminent' THEN CASE item_value WHEN 0 THEN '공사 예정일 확인' WHEN 1 THEN '현설·회의 일정 확인' END
  WHEN 'bidding' THEN CASE item_value WHEN 0 THEN '입찰조건 확인' WHEN 1 THEN '제출서류 확인' WHEN 2 THEN '예상 낙찰가 확인' END
  WHEN 'contract' THEN CASE item_value WHEN 0 THEN '계약조건 확인' WHEN 3 THEN '착수 일정 확인' END
  WHEN 'construction' THEN CASE item_value WHEN 1 THEN '현장 이슈 확인' END
  WHEN 'completion' THEN CASE item_value WHEN 0 THEN '준공검사 확인' WHEN 2 THEN '미해결 사항 확인' END
  ELSE NULL END;
 IF item_label IS NULL THEN RAISE EXCEPTION 'stage check item is not manually writable' USING ERRCODE='22023'; END IF;
 canonical:=jsonb_build_object('stage_code',stage_value,'item_index',item_value,'checked',checked_value);

 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;
 PERFORM 1 FROM public.users u WHERE u.auth_uid=auth.uid() FOR SHARE;
 PERFORM 1 FROM crm_security.access_review r WHERE r.reviewed_auth_uid=auth.uid() FOR SHARE;
 SELECT * INTO a FROM crm_security.actor();
 IF NOT FOUND THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;
 PERFORM 1 FROM crm_security.object_scope s WHERE s.user_id=a.user_id AND s.deal_id=p_object_id FOR SHARE;
 SELECT * INTO oldrow FROM public.deals d WHERE d.id=p_object_id FOR UPDATE;
 IF NOT FOUND OR a.permission_role NOT IN ('rep','branch','admin') OR NOT crm_security.can_deal(p_object_id,true)
 THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;

 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(a.auth_uid::text||p_request_id::text,0));
 SELECT * INTO receipt FROM crm_security.command_receipts r
  WHERE r.actor_auth_uid=a.auth_uid AND r.request_id=p_request_id;
 IF FOUND THEN
  IF receipt.actor_user_id IS DISTINCT FROM a.user_id OR receipt.operation IS DISTINCT FROM 'stage_check'
   OR receipt.object_id IS DISTINCT FROM p_object_id OR receipt.expected_version IS DISTINCT FROM p_expected_version
   OR receipt.payload IS DISTINCT FROM canonical
  THEN RAISE EXCEPTION 'REQUEST_ID_REUSE' USING ERRCODE='PT409'; END IF;
  RETURN receipt.ack||jsonb_build_object('replayed',true);
 END IF;
 IF oldrow.version IS DISTINCT FROM p_expected_version
 THEN RAISE EXCEPTION 'version conflict' USING ERRCODE='PT409'; END IF;
 IF oldrow.stage_code IS DISTINCT FROM stage_value
 THEN RAISE EXCEPTION 'stage check stage conflict' USING ERRCODE='PT409'; END IF;
 IF oldrow.stage_checklist ? stage_value AND jsonb_typeof(oldrow.stage_checklist->stage_value) IS DISTINCT FROM 'object'
 THEN RAISE EXCEPTION 'stage checklist shape conflict' USING ERRCODE='PT409'; END IF;
 prior_json:=oldrow.stage_checklist->stage_value->(item_value::text);
 IF prior_json IS NOT NULL AND jsonb_typeof(prior_json) IS DISTINCT FROM 'boolean'
 THEN RAISE EXCEPTION 'stage checklist shape conflict' USING ERRCODE='PT409'; END IF;
 prior_value:=coalesce((prior_json#>>'{}')::boolean,false);
 IF prior_value=checked_value
 THEN RAISE EXCEPTION 'stage check state conflict' USING ERRCODE='PT409'; END IF;

 server_at:=clock_timestamp();
 UPDATE public.deals SET
  stage_checklist=jsonb_set(
   jsonb_set(coalesce(stage_checklist,'{}'::jsonb),ARRAY[stage_value],'{}'::jsonb,true),
   ARRAY[stage_value,item_value::text],to_jsonb(checked_value),true),
  updated_at=server_at,version=version+1
 WHERE id=p_object_id AND version=p_expected_version RETURNING * INTO newrow;
 IF NOT FOUND THEN RAISE EXCEPTION 'unexpected version mutation' USING ERRCODE='PT409'; END IF;

 INSERT INTO crm_security.audit_events(actor_auth_uid,actor_user_id,actor_name,deal_id,action,before_data,after_data,reason,created_at)
 VALUES(a.auth_uid,a.user_id,a.display_name,p_object_id,'stage_check',
  jsonb_build_object('version',oldrow.version,'stage_code',stage_value,'item_index',item_value,'item_text',item_label,'checked',prior_value),
  jsonb_build_object('version',newrow.version,'stage_code',stage_value,'item_index',item_value,'item_text',item_label,'checked',checked_value),
  item_label,server_at) RETURNING event_id INTO event;
 ack:=jsonb_build_object('contract_version',1,'ok',true,'request_id',p_request_id,
  'operation','stage_check','object_id',p_object_id,'actor_auth_uid',a.auth_uid,
  'actor_user_id',a.user_id,'previous_version',p_expected_version,'version',newrow.version,
  'stage_code',stage_value,'item_index',item_value,'item_text',item_label,'checked',checked_value,
  'stage_checklist',newrow.stage_checklist,'audit_event_id',event,'server_at',server_at,'replayed',false);
 INSERT INTO crm_security.command_receipts(actor_auth_uid,request_id,actor_user_id,operation,object_id,expected_version,payload,ack)
 VALUES(a.auth_uid,p_request_id,a.user_id,'stage_check',p_object_id,p_expected_version,canonical,ack);
 RETURN ack;
END $fn$;

REVOKE EXECUTE ON FUNCTION crm_security.crm_stage_check_command_v1(uuid,uuid,integer,jsonb)
 FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION crm_security.crm_operational_source_fragment_v1(
 p_domain text,p_after uuid,p_limit integer
) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $fn$
DECLARE raw_items jsonb; items jsonb; next_cursor uuid; has_more boolean; a record;
BEGIN
 SELECT * INTO a FROM crm_security.actor();
 IF NOT FOUND THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;
 IF p_domain NOT IN ('deal_core','inquiry_core')
 THEN RAISE EXCEPTION 'unsupported operational source domain' USING ERRCODE='22023'; END IF;
 IF p_limit IS NULL OR p_limit<1 OR p_limit>100
 THEN RAISE EXCEPTION 'invalid limit' USING ERRCODE='22023'; END IF;

 IF p_domain='deal_core' THEN
  SELECT coalesce(jsonb_agg(to_jsonb(q) ORDER BY q.id),'[]'::jsonb) INTO raw_items FROM(
   SELECT d.id,d.site_id,
    coalesce(s.site_name,o.name,nullif(d.list_fields->>'site_name',''),nullif(d.list_fields->>'name','')) AS site_name,
    coalesce(s.site_name,o.name,nullif(d.list_fields->>'site_name',''),nullif(d.list_fields->>'name','')) AS site,
    d.owner_id,coalesce(u.name,d.assignee_name) AS owner_name,coalesce(u.name,d.assignee_name) AS assignee,
    d.stage_code,d.stage_raw,d.stage_group,d.brand,d.list_name,
    d.amount,d.amount AS amt,d.amount_unknown_reason,
    d.created_at,d.created_at AS created,d.updated_at,d.updated_at AS updated,d.closed_at,d.closed_at AS closed,d.opened_at,
    d.lifecycle_status,d.outcome,d.wake_up_at,d.stage_entered_at,
    d.last_activity_at,d.last_activity_at AS "lastActivity",d.last_customer_contact_at,
    d.stage_entered_at AS "stageAt",d.origin_inquiry_id,d.origin_channel,
    d.source,d.outbound_channel,d.lost_reason,d.lost_kind,d.badfit_type,
    d.service_type,d.service_history,d.origin_business,d.current_business,d.business_history,
    d.primary_work,d.work_items,d.work_scope_type,d.work_summary,d.stage_checklist,d.version,
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
    coalesce((SELECT jsonb_agg(jsonb_build_object('from',h.from_stage,'to',h.to_stage,'changed_at',h.changed_at) ORDER BY h.changed_at,h.id)
     FROM public.stage_history h WHERE h.opportunity_id=d.id),'[]'::jsonb) AS stage_history,
    coalesce((SELECT jsonb_agg(jsonb_build_object('id',ac.id,'type',ac.type,'occurred_at',ac.occurred_at) ORDER BY ac.occurred_at,ac.id)
     FROM public.activities ac WHERE ac.deal_id=d.id),'[]'::jsonb) AS activity_signals
   FROM public.deals d
   LEFT JOIN public.sites s ON s.site_id=d.site_id
   LEFT JOIN public.organizations o ON o.id=d.organization_id
   LEFT JOIN public.users u ON u.user_id=d.owner_id
   LEFT JOIN public.contacts c ON c.id=d.contact_id
   LEFT JOIN crm_security.user_opportunity_state ps ON ps.actor_user_id=a.user_id AND ps.deal_id=d.id
   WHERE crm_security.can_deal(d.id,false) AND (p_after IS NULL OR d.id>p_after)
   ORDER BY d.id LIMIT p_limit+1
  )q;
 ELSE
  SELECT coalesce(jsonb_agg(to_jsonb(q) ORDER BY q.id),'[]'::jsonb) INTO raw_items FROM(
   SELECT i.id,i.site_id,i.site_name,i.brand,i.inquiry_type,i.work_type,i.source_channel,i.channel,
    i.assigned_to,coalesce(u.name,i.assignee_name) AS assignee_name,ar.permission_role AS assignee_permission_role,
    i.status,i.deal_id,i.opportunity_id,i.received_at,i.created_at,i.updated_at,i.assigned_at,
    i.first_response_at,i.responded_at,i.next_action_date,i.contact_name,i.phone
   FROM public.inquiries i
   LEFT JOIN public.users u ON u.user_id=i.assigned_to
   LEFT JOIN crm_security.access_review ar ON ar.user_id=i.assigned_to AND ar.approved AND ar.expires_at>now()
   WHERE crm_security.can_inquiry(i.id) AND (p_after IS NULL OR i.id>p_after)
   ORDER BY i.id LIMIT p_limit+1
  )q;
 END IF;

 has_more:=jsonb_array_length(raw_items)>p_limit;
 items:=CASE WHEN has_more THEN raw_items-p_limit ELSE raw_items END;
 next_cursor:=CASE WHEN has_more AND jsonb_array_length(items)>0
  THEN (items->(jsonb_array_length(items)-1)->>'id')::uuid ELSE NULL END;
 RETURN jsonb_build_object(
  'contract_version',1,'resource','operational_source','domain',p_domain,
  'scope_completeness','actor_authorized_rows_only',
  'actor_user_id',a.user_id,'actor_permission_role',a.permission_role,
  'items',items,'pagination',jsonb_build_object(
   'completeness',CASE WHEN has_more THEN 'partial' ELSE 'complete' END,
   'has_more',has_more,'next_cursor',next_cursor));
END $fn$;


REVOKE EXECUTE ON FUNCTION crm_security.crm_operational_source_fragment_v1(text,uuid,integer) FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION public.crm_write_command_v2(p_request_id uuid,p_operation text,p_object_id uuid,p_expected_version integer,p_payload jsonb)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $fn$
BEGIN
 IF p_operation='stage_check' THEN RETURN crm_security.crm_stage_check_command_v1(p_request_id,p_object_id,p_expected_version,p_payload); END IF;
 RETURN crm_security.crm_write_command_v2_next_complete_20260906(p_request_id,p_operation,p_object_id,p_expected_version,p_payload);
END $fn$;
REVOKE EXECUTE ON FUNCTION public.crm_write_command_v2(uuid,text,uuid,integer,jsonb) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.crm_write_command_v2(uuid,text,uuid,integer,jsonb) TO authenticated;
DO $post$ DECLARE changed integer; BEGIN
 SELECT count(*) INTO changed FROM stage_check_source_guard g JOIN pg_proc p ON p.oid=g.oid WHERE p.prosrc IS DISTINCT FROM g.prosrc OR p.proconfig IS DISTINCT FROM g.proconfig OR coalesce(p.proacl::text,'') IS DISTINCT FROM g.acl;
 IF changed<>0 OR has_function_privilege('anon','public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)','EXECUTE')
  OR NOT has_function_privilege('authenticated','public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)','EXECUTE')
  OR has_function_privilege('service_role','public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)','EXECUTE')
  OR has_function_privilege('authenticated','crm_security.crm_stage_check_command_v1(uuid,uuid,integer,jsonb)','EXECUTE')
  OR has_function_privilege('authenticated','crm_security.crm_operational_source_fragment_v1(text,uuid,integer)','EXECUTE')
  OR (SELECT pg_get_constraintdef(oid,true) FROM pg_constraint WHERE conrelid='crm_security.command_receipts'::regclass AND conname='command_receipts_operation_check') IS DISTINCT FROM $expected$CHECK (operation = ANY (ARRAY['opportunity_work_set'::text, 'inquiry_assign'::text, 'service_change'::text, 'inquiry_unassign'::text, 'favorite_set'::text, 'opportunity_touch'::text, 'next_action'::text, 'activity'::text, 'quote_version'::text, 'next_action_complete'::text, 'stage_check'::text]))$expected$
 THEN RAISE EXCEPTION 'stage-check post-apply drift'; END IF;
END $post$;
-- ===== APPLY transition =====
SET LOCAL crm.transition_ref='rprechiaglyjaydkmxsu';
SET LOCAL crm.transition_ref='rprechiaglyjaydkmxsu';

SET LOCAL search_path=pg_catalog;SET LOCAL lock_timeout='3s';SET LOCAL statement_timeout='60s';
DO $guard$ BEGIN
 IF current_user<>'postgres' OR current_setting('crm.transition_ref',true) IS DISTINCT FROM 'rprechiaglyjaydkmxsu'
  OR to_regprocedure('public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)') IS NULL
  OR to_regprocedure('crm_security.crm_stage_check_command_v1(uuid,uuid,integer,jsonb)') IS NULL
  OR to_regprocedure('crm_security.crm_operational_source_fragment_v1(text,uuid,integer)') IS NULL
  OR NOT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='deals' AND column_name='stage_checklist')
  OR EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='deals' AND column_name='stage_contexts')
  OR to_regprocedure('crm_security.crm_write_command_v2_stage_check_20260906(uuid,text,uuid,integer,jsonb)') IS NOT NULL
  OR to_regprocedure('crm_security.crm_operational_source_fragment_pre_transition_20260906(text,uuid,integer)') IS NOT NULL
  OR to_regprocedure('crm_security.crm_deal_transition_command_v1(uuid,uuid,integer,jsonb)') IS NOT NULL
  OR to_regclass('crm_security.stage_transition_events') IS NOT NULL
  OR (SELECT pg_get_constraintdef(oid,true) FROM pg_constraint WHERE conrelid='crm_security.command_receipts'::regclass AND conname='command_receipts_operation_check') IS DISTINCT FROM $expected$CHECK (operation = ANY (ARRAY['opportunity_work_set'::text, 'inquiry_assign'::text, 'service_change'::text, 'inquiry_unassign'::text, 'favorite_set'::text, 'opportunity_touch'::text, 'next_action'::text, 'activity'::text, 'quote_version'::text, 'next_action_complete'::text, 'stage_check'::text]))$expected$
 THEN RAISE EXCEPTION 'transition after-stage-check prerequisite drift'; END IF;
END $guard$;
CREATE TEMP TABLE transition_source_guard AS SELECT p.oid,p.prosrc,p.proconfig,coalesce(p.proacl::text,'') acl FROM pg_proc p WHERE p.oid='public.crm_operational_source_v1(text,uuid,integer)'::regprocedure;
ALTER FUNCTION public.crm_write_command_v2(uuid,text,uuid,integer,jsonb) RENAME TO crm_write_command_v2_stage_check_20260906;
ALTER FUNCTION public.crm_write_command_v2_stage_check_20260906(uuid,text,uuid,integer,jsonb) SET SCHEMA crm_security;
REVOKE EXECUTE ON FUNCTION crm_security.crm_write_command_v2_stage_check_20260906(uuid,text,uuid,integer,jsonb) FROM PUBLIC,anon,authenticated,service_role;
ALTER FUNCTION crm_security.crm_operational_source_fragment_v1(text,uuid,integer) RENAME TO crm_operational_source_fragment_pre_transition_20260906;
REVOKE EXECUTE ON FUNCTION crm_security.crm_operational_source_fragment_pre_transition_20260906(text,uuid,integer) FROM PUBLIC,anon,authenticated,service_role;
ALTER TABLE public.deals ADD COLUMN stage_contexts jsonb NOT NULL DEFAULT '{}'::jsonb;
CREATE TABLE crm_security.stage_transition_events(
 event_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),request_id uuid NOT NULL UNIQUE,deal_id uuid NOT NULL REFERENCES public.deals(id) ON DELETE RESTRICT,
 from_stage text NOT NULL,to_stage text NOT NULL,transition_date date NOT NULL,fields jsonb NOT NULL CHECK(jsonb_typeof(fields)='object'),skip_reason text,memo text,
 actor_auth_uid uuid NOT NULL,actor_user_id uuid NOT NULL REFERENCES public.users(user_id) ON DELETE RESTRICT,recorded_at timestamptz NOT NULL,
 stage_history_id uuid NOT NULL REFERENCES public.stage_history(id) ON DELETE RESTRICT,activity_id uuid NOT NULL REFERENCES public.activities(id) ON DELETE RESTRICT,next_action_id uuid REFERENCES public.next_actions(id) ON DELETE RESTRICT);
ALTER TABLE crm_security.stage_transition_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON crm_security.stage_transition_events FROM PUBLIC,anon,authenticated,service_role;
ALTER TABLE crm_security.command_receipts DROP CONSTRAINT command_receipts_operation_check;
ALTER TABLE crm_security.command_receipts ADD CONSTRAINT command_receipts_operation_check CHECK(operation IN ('opportunity_work_set','inquiry_assign','service_change','inquiry_unassign','favorite_set','opportunity_touch','next_action','activity','quote_version','next_action_complete','stage_check','transition'));
CREATE FUNCTION crm_security.crm_transition_field_date_v1(
 p_fields jsonb,p_key text,p_required boolean
) RETURNS date LANGUAGE plpgsql IMMUTABLE SECURITY INVOKER SET search_path='' AS $fn$
DECLARE value text; parsed date;
BEGIN
 value:=p_fields->>p_key;
 IF value IS NULL OR value='' THEN
  IF p_required THEN RAISE EXCEPTION 'missing transition date field: %',p_key USING ERRCODE='22023'; END IF;
  RETURN NULL;
 END IF;
 IF jsonb_typeof(p_fields->p_key) IS DISTINCT FROM 'string' OR value !~ '^\d{4}-\d{2}-\d{2}$'
 THEN RAISE EXCEPTION 'invalid transition date field: %',p_key USING ERRCODE='22023'; END IF;
 BEGIN parsed:=value::date; EXCEPTION WHEN datetime_field_overflow THEN RAISE EXCEPTION 'invalid transition date field: %',p_key USING ERRCODE='22023'; END;
 IF parsed::text<>value THEN RAISE EXCEPTION 'invalid transition date field: %',p_key USING ERRCODE='22023'; END IF;
 RETURN parsed;
END $fn$;

CREATE FUNCTION crm_security.crm_transition_validate_v1(
 p_to text,p_fields jsonb,p_transition_date date
) RETURNS void LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path='' AS $fn$
DECLARE allowed text[]; sent_date date; followup date; contact_date date; last_contact date;
 start_date date; contract_date date; completion_date date; support jsonb; checks jsonb;
BEGIN
 IF jsonb_typeof(p_fields) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'transition fields must be an object' USING ERRCODE='22023'; END IF;
 allowed:=CASE p_to
  WHEN 'first_contact' THEN ARRAY['needs','work_scope','expected_timing']
  WHEN 'consulting' THEN ARRAY['quote_request','required_materials','quote_due']
  WHEN 'sent' THEN ARRAY['materials','quote_version','recipient','sent_date','reaction','followup_date']
  WHEN 'rapport' THEN ARRAY['reaction','likelihood','contact_date']
  WHEN 'silent' THEN ARRAY['reason','last_contact','contact_date']
  WHEN 'waiting' THEN ARRAY['reason','last_contact','speaker','statement','resume_date','contact_date']
  WHEN 'compete' THEN ARRAY['competition_type','competitor','meeting_date','position','support']
  WHEN 'imminent' THEN ARRAY['final_terms','expected_contract','customer_intent','remaining_issues']
  WHEN 'bidding' THEN ARRAY['announcement_date','briefing_date','bid_deadline','bid_terms','bid_plan']
  WHEN 'contract' THEN ARRAY['bid_result','contract_amount','contract_status','contract_date','special_terms']
  WHEN 'construction' THEN ARRAY['start_date','contract_amount','handover','requests']
  WHEN 'completion' THEN ARRAY['completion_date','completion_checks','contract_amount','completion_documents','warranty','payment','customer_handover']
  ELSE NULL END;
 IF allowed IS NULL OR EXISTS(SELECT 1 FROM jsonb_object_keys(p_fields) k WHERE NOT k=ANY(allowed))
 THEN RAISE EXCEPTION 'invalid transition fields' USING ERRCODE='22023'; END IF;

 IF p_to='first_contact' THEN
  IF length(trim(coalesce(p_fields->>'needs','')))<1 OR length(trim(coalesce(p_fields->>'work_scope','')))<1 THEN RAISE EXCEPTION 'required first contact fields missing' USING ERRCODE='22023'; END IF;
 ELSIF p_to='consulting' THEN
  IF length(trim(coalesce(p_fields->>'quote_request','')))<1 THEN RAISE EXCEPTION 'quote request is required' USING ERRCODE='22023'; END IF;
  PERFORM crm_security.crm_transition_field_date_v1(p_fields,'quote_due',true);
 ELSIF p_to='sent' THEN
  IF jsonb_typeof(p_fields->'materials') IS DISTINCT FROM 'array' OR jsonb_array_length(p_fields->'materials')<1
   OR EXISTS(SELECT 1 FROM jsonb_array_elements_text(p_fields->'materials') x WHERE x NOT IN ('견적서','제안서','공법자료','기타자료'))
   OR length(trim(coalesce(p_fields->>'recipient','')))<1
  THEN RAISE EXCEPTION 'invalid sent fields' USING ERRCODE='22023'; END IF;
  IF (p_fields->'materials') ? '견적서' AND coalesce(p_fields->>'quote_version','') !~ '^\d+$'
  THEN RAISE EXCEPTION 'quote version is required' USING ERRCODE='22023'; END IF;
  IF coalesce(p_fields->>'reaction','')<>'' AND p_fields->>'reaction' NOT IN ('확인 전','검토중','추가자료 요청','가격협의') THEN RAISE EXCEPTION 'invalid reaction' USING ERRCODE='22023'; END IF;
  sent_date:=crm_security.crm_transition_field_date_v1(p_fields,'sent_date',true);
  followup:=crm_security.crm_transition_field_date_v1(p_fields,'followup_date',true);
  IF sent_date>p_transition_date OR followup<sent_date THEN RAISE EXCEPTION 'invalid sent date sequence' USING ERRCODE='22023'; END IF;
 ELSIF p_to='rapport' THEN
  IF length(trim(coalesce(p_fields->>'reaction','')))<1 OR (coalesce(p_fields->>'likelihood','')<>'' AND p_fields->>'likelihood' NOT IN ('높음','보통','낮음','미확인')) THEN RAISE EXCEPTION 'invalid rapport fields' USING ERRCODE='22023'; END IF;
  PERFORM crm_security.crm_transition_field_date_v1(p_fields,'contact_date',true);
 ELSIF p_to IN ('silent','waiting') THEN
  IF length(trim(coalesce(p_fields->>'reason','')))<1 THEN RAISE EXCEPTION 'waiting reason is required' USING ERRCODE='22023'; END IF;
  last_contact:=crm_security.crm_transition_field_date_v1(p_fields,'last_contact',false);
  contact_date:=crm_security.crm_transition_field_date_v1(p_fields,'contact_date',true);
  IF last_contact IS NOT NULL AND last_contact>p_transition_date THEN RAISE EXCEPTION 'last contact is after transition' USING ERRCODE='22023'; END IF;
  IF p_to='waiting' THEN PERFORM crm_security.crm_transition_field_date_v1(p_fields,'resume_date',false); END IF;
 ELSIF p_to='compete' THEN
  IF p_fields->>'competition_type' NOT IN ('PT','경쟁견적','가격협상','타공법 비교') OR (coalesce(p_fields->>'position','')<>'' AND p_fields->>'position' NOT IN ('우세','비슷','열세','모름')) THEN RAISE EXCEPTION 'invalid competition fields' USING ERRCODE='22023'; END IF;
  PERFORM crm_security.crm_transition_field_date_v1(p_fields,'meeting_date',false);
  support:=p_fields->'support';
  IF support IS NOT NULL AND (jsonb_typeof(support) IS DISTINCT FROM 'array' OR EXISTS(SELECT 1 FROM jsonb_array_elements_text(support)x WHERE x NOT IN ('PT자료','비교자료','가격검토','임원지원','없음')) OR (support ? '없음' AND jsonb_array_length(support)>1)) THEN RAISE EXCEPTION 'invalid support fields' USING ERRCODE='22023'; END IF;
 ELSIF p_to='imminent' THEN
  IF length(trim(coalesce(p_fields->>'final_terms','')))<1 THEN RAISE EXCEPTION 'final terms are required' USING ERRCODE='22023'; END IF;
  PERFORM crm_security.crm_transition_field_date_v1(p_fields,'expected_contract',true);
 ELSIF p_to='bidding' THEN
  IF length(trim(coalesce(p_fields->>'bid_terms','')))<1 THEN RAISE EXCEPTION 'bid terms are required' USING ERRCODE='22023'; END IF;
  PERFORM crm_security.crm_transition_field_date_v1(p_fields,'announcement_date',false);PERFORM crm_security.crm_transition_field_date_v1(p_fields,'briefing_date',false);PERFORM crm_security.crm_transition_field_date_v1(p_fields,'bid_deadline',true);
 ELSIF p_to='contract' THEN
  IF p_fields->>'bid_result' NOT IN ('낙찰','우선협상','수의계약','확인중') OR p_fields->>'contract_status' NOT IN ('체결 예정','체결 완료') OR jsonb_typeof(p_fields->'contract_amount') IS DISTINCT FROM 'number' OR (p_fields->>'contract_amount')::numeric<=0 THEN RAISE EXCEPTION 'invalid contract fields' USING ERRCODE='22023'; END IF;
  contract_date:=crm_security.crm_transition_field_date_v1(p_fields,'contract_date',true);
  IF p_fields->>'contract_status'='체결 완료' AND contract_date>p_transition_date THEN RAISE EXCEPTION 'contract date is after transition' USING ERRCODE='22023'; END IF;
 ELSIF p_to='construction' THEN
  IF jsonb_typeof(p_fields->'contract_amount') IS DISTINCT FROM 'number' OR (p_fields->>'contract_amount')::numeric<=0 OR (coalesce(p_fields->>'handover','')<>'' AND p_fields->>'handover' NOT IN ('완료','진행중','미완료')) THEN RAISE EXCEPTION 'invalid construction fields' USING ERRCODE='22023'; END IF;
  start_date:=crm_security.crm_transition_field_date_v1(p_fields,'start_date',true);IF start_date>p_transition_date THEN RAISE EXCEPTION 'start date is after transition' USING ERRCODE='22023'; END IF;
 ELSIF p_to='completion' THEN
  completion_date:=crm_security.crm_transition_field_date_v1(p_fields,'completion_date',true);IF completion_date>p_transition_date THEN RAISE EXCEPTION 'completion date is after transition' USING ERRCODE='22023'; END IF;
  checks:=p_fields->'completion_checks';
  IF jsonb_typeof(checks) IS DISTINCT FROM 'array' OR NOT checks ?& ARRAY['공사 완료','준공검사 완료'] OR EXISTS(SELECT 1 FROM jsonb_array_elements_text(checks)x WHERE x NOT IN ('공사 완료','준공검사 완료','하자보증서 전달','준공서류 전달')) THEN RAISE EXCEPTION 'invalid completion checks' USING ERRCODE='22023'; END IF;
  IF p_fields ? 'contract_amount' AND p_fields->>'contract_amount'<>'' AND (jsonb_typeof(p_fields->'contract_amount') IS DISTINCT FROM 'number' OR (p_fields->>'contract_amount')::numeric<0) THEN RAISE EXCEPTION 'invalid completion amount' USING ERRCODE='22023'; END IF;
  IF coalesce(p_fields->>'payment','')<>'' AND p_fields->>'payment' NOT IN ('청구전','청구완료','일부수금','완납') THEN RAISE EXCEPTION 'invalid payment' USING ERRCODE='22023'; END IF;
  IF coalesce(p_fields->>'customer_handover','')<>'' AND p_fields->>'customer_handover' NOT IN ('완료','확인필요') THEN RAISE EXCEPTION 'invalid customer handover' USING ERRCODE='22023'; END IF;
 END IF;
END $fn$;

REVOKE EXECUTE ON FUNCTION crm_security.crm_transition_field_date_v1(jsonb,text,boolean) FROM PUBLIC,anon,authenticated,service_role;
REVOKE EXECUTE ON FUNCTION crm_security.crm_transition_validate_v1(text,jsonb,date) FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION crm_security.crm_deal_transition_command_v1(
 p_request_id uuid,p_object_id uuid,p_expected_version integer,p_payload jsonb
) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $fn$
DECLARE a record; receipt crm_security.command_receipts%ROWTYPE;
 oldrow public.deals%ROWTYPE; newrow public.deals%ROWTYPE;
 canonical jsonb; ack jsonb; audit_id uuid; transition_event_id uuid; history_id uuid; activity_id uuid; next_id uuid;
 from_value text; to_value text; transition_value date; fields_value jsonb; skip_value text; memo_value text; note_value text;
 effective_at timestamptz; server_at timestamptz; group_value text; lifecycle_value text; actor_email_value text; owner_name_value text;
 next_due date; next_title text; cancelled_ids jsonb:='[]'::jsonb; contexts jsonb; standard boolean;
BEGIN
 IF p_request_id IS NULL OR p_object_id IS NULL OR p_expected_version IS NULL OR p_expected_version<0
  OR jsonb_typeof(p_payload) IS DISTINCT FROM 'object'
  OR EXISTS(SELECT 1 FROM jsonb_object_keys(p_payload) k WHERE k NOT IN ('from','to','transition_date','fields','skip_reason','memo','note'))
  OR NOT p_payload ?& ARRAY['from','to','transition_date','fields','skip_reason','memo','note']
  OR jsonb_typeof(p_payload->'from') IS DISTINCT FROM 'string' OR jsonb_typeof(p_payload->'to') IS DISTINCT FROM 'string'
  OR jsonb_typeof(p_payload->'transition_date') IS DISTINCT FROM 'string' OR jsonb_typeof(p_payload->'fields') IS DISTINCT FROM 'object'
  OR jsonb_typeof(p_payload->'skip_reason') IS DISTINCT FROM 'string' OR jsonb_typeof(p_payload->'memo') IS DISTINCT FROM 'string'
  OR jsonb_typeof(p_payload->'note') IS DISTINCT FROM 'string'
 THEN RAISE EXCEPTION 'invalid structured transition payload' USING ERRCODE='22023'; END IF;
 from_value:=p_payload->>'from';to_value:=p_payload->>'to';fields_value:=p_payload->'fields';
 skip_value:=trim(p_payload->>'skip_reason');memo_value:=trim(p_payload->>'memo');note_value:=trim(p_payload->>'note');
 IF length(skip_value)>2000 OR length(memo_value)>8000 OR length(note_value)<1 OR length(note_value)>16000
  OR p_payload->>'transition_date' !~ '^\d{4}-\d{2}-\d{2}$'
 THEN RAISE EXCEPTION 'invalid structured transition payload' USING ERRCODE='22023'; END IF;
 BEGIN transition_value:=(p_payload->>'transition_date')::date; EXCEPTION WHEN datetime_field_overflow THEN RAISE EXCEPTION 'invalid transition date' USING ERRCODE='22023'; END;
 IF transition_value::text<>p_payload->>'transition_date' OR transition_value>(clock_timestamp() AT TIME ZONE 'Asia/Seoul')::date
 THEN RAISE EXCEPTION 'invalid transition date' USING ERRCODE='22023'; END IF;
 IF from_value IN ('won','lost','badfit','badfit_lead','badfit_pipe','nocontact') OR to_value IN ('won','lost','badfit','badfit_lead','badfit_pipe','nocontact') OR from_value=to_value
  OR to_value NOT IN ('first_contact','consulting','sent','rapport','silent','waiting','compete','imminent','bidding','contract','construction','completion')
 THEN RAISE EXCEPTION 'terminal or invalid transition is not connected' USING ERRCODE='22023'; END IF;
 standard:=CASE from_value
  WHEN 'first_contact' THEN to_value='consulting' WHEN 'consulting' THEN to_value='sent'
  WHEN 'sent' THEN to_value IN ('rapport','silent','compete') WHEN 'rapport' THEN to_value IN ('silent','compete')
  WHEN 'silent' THEN to_value IN ('rapport','compete') WHEN 'compete' THEN to_value IN ('imminent','bidding')
  WHEN 'imminent' THEN to_value IN ('bidding','contract') WHEN 'bidding' THEN to_value='contract'
  WHEN 'contract' THEN to_value='construction' WHEN 'construction' THEN to_value='completion'
  WHEN 'waiting' THEN to_value IN ('first_contact','rapport','silent') ELSE false END;
 IF to_value<>'waiting' AND NOT standard AND length(skip_value)<5
 THEN RAISE EXCEPTION 'transition exception reason is required' USING ERRCODE='22023'; END IF;
 PERFORM crm_security.crm_transition_validate_v1(to_value,fields_value,transition_value);
 canonical:=jsonb_build_object('from',from_value,'to',to_value,'transition_date',transition_value,'fields',fields_value,'skip_reason',skip_value,'memo',memo_value,'note',note_value);

 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;
 PERFORM 1 FROM public.users u WHERE u.auth_uid=auth.uid() FOR SHARE;
 PERFORM 1 FROM crm_security.access_review r WHERE r.reviewed_auth_uid=auth.uid() FOR SHARE;
 SELECT * INTO a FROM crm_security.actor();IF NOT FOUND THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;
 PERFORM 1 FROM crm_security.object_scope s WHERE s.user_id=a.user_id AND s.deal_id=p_object_id FOR SHARE;
 SELECT * INTO oldrow FROM public.deals d WHERE d.id=p_object_id FOR UPDATE;
 IF NOT FOUND OR a.permission_role NOT IN ('rep','branch','admin') OR NOT crm_security.can_deal(p_object_id,true)
 THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;

 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(a.auth_uid::text||p_request_id::text,0));
 SELECT * INTO receipt FROM crm_security.command_receipts r WHERE r.actor_auth_uid=a.auth_uid AND r.request_id=p_request_id;
 IF FOUND THEN
  IF receipt.actor_user_id IS DISTINCT FROM a.user_id OR receipt.operation IS DISTINCT FROM 'transition'
   OR receipt.object_id IS DISTINCT FROM p_object_id OR receipt.expected_version IS DISTINCT FROM p_expected_version OR receipt.payload IS DISTINCT FROM canonical
  THEN RAISE EXCEPTION 'REQUEST_ID_REUSE' USING ERRCODE='PT409'; END IF;
  RETURN receipt.ack||jsonb_build_object('replayed',true);
 END IF;
 IF oldrow.version IS DISTINCT FROM p_expected_version THEN RAISE EXCEPTION 'version conflict' USING ERRCODE='PT409'; END IF;
 IF oldrow.stage_code IS DISTINCT FROM from_value OR oldrow.outcome IS NOT NULL OR oldrow.lifecycle_status='closed'
 THEN RAISE EXCEPTION 'stage state conflict' USING ERRCODE='PT409'; END IF;
 IF jsonb_typeof(oldrow.stage_contexts) IS DISTINCT FROM 'object'
 THEN RAISE EXCEPTION 'stage contexts state conflict' USING ERRCODE='PT409'; END IF;
 IF to_value='sent' AND (fields_value->'materials') ? '견적서' AND NOT EXISTS(
  SELECT 1 FROM crm_security.quote_versions q WHERE q.deal_id=p_object_id AND q.version_no=(fields_value->>'quote_version')::integer)
 THEN RAISE EXCEPTION 'quote version not found' USING ERRCODE='22023'; END IF;

 server_at:=clock_timestamp();effective_at:=transition_value::timestamp AT TIME ZONE 'Asia/Seoul';
 group_value:=CASE WHEN to_value IN ('first_contact','consulting') THEN 'design' WHEN to_value='sent' THEN 'sent' WHEN to_value IN ('rapport','silent','waiting') THEN 'rel' WHEN to_value IN ('compete','imminent','bidding') THEN 'comp' ELSE 'con' END;
 lifecycle_value:=CASE WHEN to_value='waiting' THEN 'parked' ELSE 'active' END;
 contexts:=jsonb_set(coalesce(oldrow.stage_contexts,'{}'::jsonb),ARRAY[to_value],jsonb_build_object('transition_date',transition_value,'skip_reason',skip_value,'memo',memo_value,'fields',fields_value,'from',from_value,'to',to_value,'recorded_at',server_at,'actor',a.display_name,'terminal',false),true);
 next_due:=CASE WHEN to_value='sent' THEN nullif(fields_value->>'followup_date','')::date WHEN to_value IN ('rapport','silent','waiting') THEN nullif(fields_value->>'contact_date','')::date ELSE NULL END;
 next_title:=CASE WHEN next_due IS NULL THEN NULL WHEN to_value='sent' THEN '발송자료 검토 여부 확인' ELSE '고객 재접촉' END;
 SELECT u.email,u.name INTO actor_email_value,owner_name_value FROM public.users u WHERE u.user_id=a.user_id;
 IF next_due IS NOT NULL THEN
  SELECT coalesce(jsonb_agg(id ORDER BY created_at),'[]'::jsonb) INTO cancelled_ids FROM public.next_actions WHERE deal_id=p_object_id AND status='open';
  UPDATE public.next_actions SET status='cancelled',updated_at=server_at WHERE deal_id=p_object_id AND status='open';
  SELECT coalesce(u.name,oldrow.assignee_name) INTO owner_name_value FROM public.users u WHERE u.user_id=oldrow.owner_id;
  IF owner_name_value IS NULL THEN RAISE EXCEPTION 'No approved UUID owner' USING ERRCODE='42501'; END IF;
  INSERT INTO public.next_actions(deal_id,action_type,title,due_at,assignee_name,status,created_at,updated_at)
  VALUES(p_object_id,'후속접촉',next_title,next_due::timestamp AT TIME ZONE 'Asia/Seoul',owner_name_value,'open',server_at,server_at) RETURNING id INTO next_id;
 END IF;
 INSERT INTO public.stage_history(opportunity_id,from_stage,to_stage,reason,actor_id,actor_name,changed_at)
 VALUES(p_object_id,from_value,to_value,coalesce(nullif(skip_value,''),note_value),a.user_id,a.display_name,effective_at) RETURNING id INTO history_id;
 INSERT INTO public.activities(deal_id,organization_id,actor_email,actor_name,type,detail,occurred_at)
 VALUES(p_object_id,oldrow.organization_id,actor_email_value,a.display_name,'단계전환',jsonb_build_object('note',to_value,'result',note_value,'from_stage',from_value,'to_stage',to_value,'meaningful_contact',false),effective_at) RETURNING id INTO activity_id;
 INSERT INTO crm_security.stage_transition_events(request_id,deal_id,from_stage,to_stage,transition_date,fields,skip_reason,memo,actor_auth_uid,actor_user_id,recorded_at,stage_history_id,activity_id,next_action_id)
 VALUES(p_request_id,p_object_id,from_value,to_value,transition_value,fields_value,nullif(skip_value,''),nullif(memo_value,''),a.auth_uid,a.user_id,server_at,history_id,activity_id,next_id) RETURNING event_id INTO transition_event_id;
 UPDATE public.deals SET stage_code=to_value,stage_raw=to_value,stage_group=group_value,lifecycle_status=lifecycle_value,
  stage_entered_at=effective_at,stage_contexts=contexts,last_activity_at=effective_at,
  next_action=CASE WHEN next_id IS NULL THEN next_action ELSE next_title END,
  next_action_date=CASE WHEN next_id IS NULL THEN next_action_date ELSE next_due END,
  updated_at=server_at,version=version+1
 WHERE id=p_object_id AND version=p_expected_version RETURNING * INTO newrow;
 IF NOT FOUND THEN RAISE EXCEPTION 'unexpected version mutation' USING ERRCODE='PT409'; END IF;
 INSERT INTO crm_security.audit_events(actor_auth_uid,actor_user_id,actor_name,deal_id,action,before_data,after_data,reason,created_at)
 VALUES(a.auth_uid,a.user_id,a.display_name,p_object_id,'transition',
  jsonb_build_object('version',oldrow.version,'stage_code',oldrow.stage_code,'stage_group',oldrow.stage_group,'lifecycle_status',oldrow.lifecycle_status,'next_action',oldrow.next_action,'next_action_date',oldrow.next_action_date),
  jsonb_build_object('version',newrow.version,'stage_code',newrow.stage_code,'stage_group',newrow.stage_group,'lifecycle_status',newrow.lifecycle_status,'transition_event_id',transition_event_id,'stage_history_id',history_id,'activity_id',activity_id,'next_action_id',next_id,'cancelled_action_ids',cancelled_ids,'next_action',newrow.next_action,'next_action_date',newrow.next_action_date),
  coalesce(nullif(skip_value,''),note_value),server_at) RETURNING event_id INTO audit_id;
 ack:=jsonb_build_object('contract_version',1,'ok',true,'request_id',p_request_id,'operation','transition','object_id',p_object_id,
  'actor_auth_uid',a.auth_uid,'actor_user_id',a.user_id,'previous_version',p_expected_version,'version',newrow.version,
  'from_stage',from_value,'to_stage',to_value,'transition_date',transition_value,'stage_entered_at',effective_at,
  'stage_contexts',newrow.stage_contexts,'transition_event_id',transition_event_id,'stage_history_id',history_id,
  'activity_id',activity_id,'next_action_id',next_id,'cancelled_action_ids',cancelled_ids,'audit_event_id',audit_id,'server_at',server_at,'replayed',false);
 INSERT INTO crm_security.command_receipts(actor_auth_uid,request_id,actor_user_id,operation,object_id,expected_version,payload,ack)
 VALUES(a.auth_uid,p_request_id,a.user_id,'transition',p_object_id,p_expected_version,canonical,ack);
 RETURN ack;
END $fn$;

REVOKE EXECUTE ON FUNCTION crm_security.crm_deal_transition_command_v1(uuid,uuid,integer,jsonb) FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION crm_security.crm_operational_source_fragment_v1(
 p_domain text,p_after uuid,p_limit integer
) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $fn$
DECLARE raw_items jsonb; items jsonb; next_cursor uuid; has_more boolean; a record;
BEGIN
 SELECT * INTO a FROM crm_security.actor();
 IF NOT FOUND THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;
 IF p_domain NOT IN ('deal_core','inquiry_core')
 THEN RAISE EXCEPTION 'unsupported operational source domain' USING ERRCODE='22023'; END IF;
 IF p_limit IS NULL OR p_limit<1 OR p_limit>100
 THEN RAISE EXCEPTION 'invalid limit' USING ERRCODE='22023'; END IF;

 IF p_domain='deal_core' THEN
  SELECT coalesce(jsonb_agg(to_jsonb(q) ORDER BY q.id),'[]'::jsonb) INTO raw_items FROM(
   SELECT d.id,d.site_id,
    coalesce(s.site_name,o.name,nullif(d.list_fields->>'site_name',''),nullif(d.list_fields->>'name','')) AS site_name,
    coalesce(s.site_name,o.name,nullif(d.list_fields->>'site_name',''),nullif(d.list_fields->>'name','')) AS site,
    d.owner_id,coalesce(u.name,d.assignee_name) AS owner_name,coalesce(u.name,d.assignee_name) AS assignee,
    d.stage_code,d.stage_raw,d.stage_group,d.brand,d.list_name,
    d.amount,d.amount AS amt,d.amount_unknown_reason,
    d.created_at,d.created_at AS created,d.updated_at,d.updated_at AS updated,d.closed_at,d.closed_at AS closed,d.opened_at,
    d.lifecycle_status,d.outcome,d.wake_up_at,d.stage_entered_at,
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
    coalesce((SELECT jsonb_agg(jsonb_build_object('id',ac.id,'type',ac.type,'occurred_at',ac.occurred_at) ORDER BY ac.occurred_at,ac.id)
     FROM public.activities ac WHERE ac.deal_id=d.id),'[]'::jsonb) AS activity_signals
   FROM public.deals d
   LEFT JOIN public.sites s ON s.site_id=d.site_id
   LEFT JOIN public.organizations o ON o.id=d.organization_id
   LEFT JOIN public.users u ON u.user_id=d.owner_id
   LEFT JOIN public.contacts c ON c.id=d.contact_id
   LEFT JOIN crm_security.user_opportunity_state ps ON ps.actor_user_id=a.user_id AND ps.deal_id=d.id
   WHERE crm_security.can_deal(d.id,false) AND (p_after IS NULL OR d.id>p_after)
   ORDER BY d.id LIMIT p_limit+1
  )q;
 ELSE
  SELECT coalesce(jsonb_agg(to_jsonb(q) ORDER BY q.id),'[]'::jsonb) INTO raw_items FROM(
   SELECT i.id,i.site_id,i.site_name,i.brand,i.inquiry_type,i.work_type,i.source_channel,i.channel,
    i.assigned_to,coalesce(u.name,i.assignee_name) AS assignee_name,ar.permission_role AS assignee_permission_role,
    i.status,i.deal_id,i.opportunity_id,i.received_at,i.created_at,i.updated_at,i.assigned_at,
    i.first_response_at,i.responded_at,i.next_action_date,i.contact_name,i.phone
   FROM public.inquiries i
   LEFT JOIN public.users u ON u.user_id=i.assigned_to
   LEFT JOIN crm_security.access_review ar ON ar.user_id=i.assigned_to AND ar.approved AND ar.expires_at>now()
   WHERE crm_security.can_inquiry(i.id) AND (p_after IS NULL OR i.id>p_after)
   ORDER BY i.id LIMIT p_limit+1
  )q;
 END IF;

 has_more:=jsonb_array_length(raw_items)>p_limit;
 items:=CASE WHEN has_more THEN raw_items-p_limit ELSE raw_items END;
 next_cursor:=CASE WHEN has_more AND jsonb_array_length(items)>0
  THEN (items->(jsonb_array_length(items)-1)->>'id')::uuid ELSE NULL END;
 RETURN jsonb_build_object(
  'contract_version',1,'resource','operational_source','domain',p_domain,
  'scope_completeness','actor_authorized_rows_only',
  'actor_user_id',a.user_id,'actor_permission_role',a.permission_role,
  'items',items,'pagination',jsonb_build_object(
   'completeness',CASE WHEN has_more THEN 'partial' ELSE 'complete' END,
   'has_more',has_more,'next_cursor',next_cursor));
END $fn$;


REVOKE EXECUTE ON FUNCTION crm_security.crm_operational_source_fragment_v1(text,uuid,integer) FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION public.crm_write_command_v2(p_request_id uuid,p_operation text,p_object_id uuid,p_expected_version integer,p_payload jsonb)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $fn$
BEGIN
 IF p_operation='transition' THEN RETURN crm_security.crm_deal_transition_command_v1(p_request_id,p_object_id,p_expected_version,p_payload); END IF;
 RETURN crm_security.crm_write_command_v2_stage_check_20260906(p_request_id,p_operation,p_object_id,p_expected_version,p_payload);
END $fn$;
REVOKE EXECUTE ON FUNCTION public.crm_write_command_v2(uuid,text,uuid,integer,jsonb) FROM PUBLIC,anon,authenticated,service_role;GRANT EXECUTE ON FUNCTION public.crm_write_command_v2(uuid,text,uuid,integer,jsonb) TO authenticated;
DO $post$ DECLARE changed integer; BEGIN
 SELECT count(*) INTO changed FROM transition_source_guard g JOIN pg_proc p ON p.oid=g.oid WHERE p.prosrc IS DISTINCT FROM g.prosrc OR p.proconfig IS DISTINCT FROM g.proconfig OR coalesce(p.proacl::text,'') IS DISTINCT FROM g.acl;
 IF changed<>0 OR has_function_privilege('anon','public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)','EXECUTE') OR NOT has_function_privilege('authenticated','public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)','EXECUTE') OR has_function_privilege('service_role','public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)','EXECUTE')
  OR has_function_privilege('authenticated','crm_security.crm_deal_transition_command_v1(uuid,uuid,integer,jsonb)','EXECUTE') OR has_function_privilege('authenticated','crm_security.crm_transition_validate_v1(text,jsonb,date)','EXECUTE') OR has_table_privilege('authenticated','crm_security.stage_transition_events','SELECT') OR NOT (SELECT relrowsecurity FROM pg_class WHERE oid='crm_security.stage_transition_events'::regclass)
  OR (SELECT pg_get_constraintdef(oid,true) FROM pg_constraint WHERE conrelid='crm_security.command_receipts'::regclass AND conname='command_receipts_operation_check') IS DISTINCT FROM $expected$CHECK (operation = ANY (ARRAY['opportunity_work_set'::text, 'inquiry_assign'::text, 'service_change'::text, 'inquiry_unassign'::text, 'favorite_set'::text, 'opportunity_touch'::text, 'next_action'::text, 'activity'::text, 'quote_version'::text, 'next_action_complete'::text, 'stage_check'::text, 'transition'::text]))$expected$
 THEN RAISE EXCEPTION 'transition post-apply drift'; END IF;
END $post$;
-- ===== APPLY close_nonwon =====
SET LOCAL crm.close_nonwon_ref='rprechiaglyjaydkmxsu';
SET LOCAL crm.close_nonwon_ref='rprechiaglyjaydkmxsu';
SET LOCAL search_path=pg_catalog;SET LOCAL lock_timeout='3s';SET LOCAL statement_timeout='60s';
DO $guard$ BEGIN IF current_user<>'postgres' OR current_setting('crm.close_nonwon_ref',true) IS DISTINCT FROM 'rprechiaglyjaydkmxsu'
 OR to_regprocedure('public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)') IS NULL OR to_regprocedure('crm_security.crm_deal_transition_command_v1(uuid,uuid,integer,jsonb)') IS NULL
 OR to_regprocedure('crm_security.crm_operational_source_fragment_v1(text,uuid,integer)') IS NULL OR NOT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='deals' AND column_name='stage_contexts')
 OR to_regprocedure('crm_security.crm_write_command_v2_transition_20260906(uuid,text,uuid,integer,jsonb)') IS NOT NULL OR to_regprocedure('crm_security.crm_operational_source_fragment_pre_close_nonwon_20260906(text,uuid,integer)') IS NOT NULL
 OR to_regprocedure('crm_security.crm_deal_close_nonwon_command_v1(uuid,uuid,integer,jsonb)') IS NOT NULL OR to_regclass('crm_security.deal_close_events') IS NOT NULL
 OR (SELECT pg_get_constraintdef(oid,true) FROM pg_constraint WHERE conrelid='crm_security.command_receipts'::regclass AND conname='command_receipts_operation_check') IS DISTINCT FROM $expected$CHECK (operation = ANY (ARRAY['opportunity_work_set'::text, 'inquiry_assign'::text, 'service_change'::text, 'inquiry_unassign'::text, 'favorite_set'::text, 'opportunity_touch'::text, 'next_action'::text, 'activity'::text, 'quote_version'::text, 'next_action_complete'::text, 'stage_check'::text, 'transition'::text]))$expected$
 THEN RAISE EXCEPTION 'close nonwon after-transition prerequisite drift';END IF;END $guard$;
CREATE TEMP TABLE close_source_guard AS SELECT p.oid,p.prosrc,p.proconfig,coalesce(p.proacl::text,'') acl FROM pg_proc p WHERE p.oid='public.crm_operational_source_v1(text,uuid,integer)'::regprocedure;
ALTER FUNCTION public.crm_write_command_v2(uuid,text,uuid,integer,jsonb) RENAME TO crm_write_command_v2_transition_20260906;ALTER FUNCTION public.crm_write_command_v2_transition_20260906(uuid,text,uuid,integer,jsonb) SET SCHEMA crm_security;
REVOKE EXECUTE ON FUNCTION crm_security.crm_write_command_v2_transition_20260906(uuid,text,uuid,integer,jsonb) FROM PUBLIC,anon,authenticated,service_role;
ALTER FUNCTION crm_security.crm_operational_source_fragment_v1(text,uuid,integer) RENAME TO crm_operational_source_fragment_pre_close_nonwon_20260906;REVOKE EXECUTE ON FUNCTION crm_security.crm_operational_source_fragment_pre_close_nonwon_20260906(text,uuid,integer) FROM PUBLIC,anon,authenticated,service_role;
CREATE TABLE crm_security.deal_close_events(event_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),request_id uuid NOT NULL UNIQUE,deal_id uuid NOT NULL REFERENCES public.deals(id) ON DELETE RESTRICT,from_stage text NOT NULL,outcome text NOT NULL CHECK(outcome IN ('lost','badfit','nocontact')),closed_date date NOT NULL,category text NOT NULL,detail text NOT NULL,reason_source text NOT NULL,actor_auth_uid uuid NOT NULL,actor_user_id uuid NOT NULL REFERENCES public.users(user_id) ON DELETE RESTRICT,recorded_at timestamptz NOT NULL,stage_history_id uuid NOT NULL REFERENCES public.stage_history(id) ON DELETE RESTRICT,activity_id uuid NOT NULL REFERENCES public.activities(id) ON DELETE RESTRICT,completed_action_ids jsonb NOT NULL CHECK(jsonb_typeof(completed_action_ids)='array'));
ALTER TABLE crm_security.deal_close_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON crm_security.deal_close_events FROM PUBLIC,anon,authenticated,service_role;
ALTER TABLE crm_security.command_receipts DROP CONSTRAINT command_receipts_operation_check;ALTER TABLE crm_security.command_receipts ADD CONSTRAINT command_receipts_operation_check CHECK(operation IN ('opportunity_work_set','inquiry_assign','service_change','inquiry_unassign','favorite_set','opportunity_touch','next_action','activity','quote_version','next_action_complete','stage_check','transition','close'));
CREATE FUNCTION crm_security.crm_deal_close_nonwon_command_v1(
 p_request_id uuid,p_object_id uuid,p_expected_version integer,p_payload jsonb
) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $fn$
DECLARE a record;receipt crm_security.command_receipts%ROWTYPE;oldrow public.deals%ROWTYPE;newrow public.deals%ROWTYPE;
 canonical jsonb;ack jsonb;audit_id uuid;close_event_id uuid;history_id uuid;activity_id uuid;
 from_value text;outcome_value text;category_value text;detail_value text;source_value text;note_value text;lost_kind_value text;
 closed_date_value date;server_at timestamptz;effective_at timestamptz;contexts jsonb;completed_ids jsonb:='[]'::jsonb;actor_email_value text;
BEGIN
 IF p_request_id IS NULL OR p_object_id IS NULL OR p_expected_version IS NULL OR p_expected_version<0 OR jsonb_typeof(p_payload) IS DISTINCT FROM 'object'
  OR EXISTS(SELECT 1 FROM jsonb_object_keys(p_payload) k WHERE k NOT IN ('from','outcome','closed_date','category','detail','reason_source','note'))
  OR NOT p_payload ?& ARRAY['from','outcome','closed_date','category','detail','reason_source','note']
  OR jsonb_typeof(p_payload->'from') IS DISTINCT FROM 'string' OR jsonb_typeof(p_payload->'outcome') IS DISTINCT FROM 'string'
  OR jsonb_typeof(p_payload->'category') IS DISTINCT FROM 'string' OR jsonb_typeof(p_payload->'detail') IS DISTINCT FROM 'string'
  OR jsonb_typeof(p_payload->'reason_source') IS DISTINCT FROM 'string' OR jsonb_typeof(p_payload->'note') IS DISTINCT FROM 'string'
  OR jsonb_typeof(p_payload->'closed_date') NOT IN ('string','null')
 THEN RAISE EXCEPTION 'invalid non-won close payload' USING ERRCODE='22023'; END IF;
 from_value:=p_payload->>'from';outcome_value:=p_payload->>'outcome';category_value:=trim(p_payload->>'category');detail_value:=trim(p_payload->>'detail');source_value:=trim(p_payload->>'reason_source');note_value:=trim(p_payload->>'note');
 IF outcome_value NOT IN ('lost','badfit','nocontact') OR from_value IN ('won','lost','badfit','badfit_lead','badfit_pipe','nocontact')
  OR length(category_value)<1 OR length(category_value)>500 OR length(detail_value)<5 OR length(detail_value)>8000 OR length(source_value)<1 OR length(source_value)>50 OR length(note_value)<1 OR length(note_value)>16000
 THEN RAISE EXCEPTION 'invalid non-won close payload' USING ERRCODE='22023'; END IF;
 IF outcome_value='lost' AND category_value NOT IN ('타사 선정 (경쟁 패배)','가격 열세','기술·공법 열세','우리가 연락 못 함','견적 후 후속 지연','담당자 부재·인수인계 누락','고객 예산 무산','공사 시기 연기·취소','가격','일정','타업체 선정','내부 사정','기타')
  OR outcome_value='badfit' AND category_value NOT IN ('지역 밖','공사 범위 밖','공사범위 밖','규모 미달','예산 수준 불일치','스팸·기타','기타')
  OR outcome_value='nocontact' AND category_value NOT IN ('3회 이상 시도 무응답','3회 이상 시도','문자·카카오까지 무응답','문자·카톡까지 무응답','번호 결번·변경','담당자 퇴사·교체')
 THEN RAISE EXCEPTION 'invalid close category' USING ERRCODE='22023'; END IF;
 IF p_payload->>'closed_date' IS NOT NULL THEN
  IF p_payload->>'closed_date' !~ '^\d{4}-\d{2}-\d{2}$' THEN RAISE EXCEPTION 'invalid close date' USING ERRCODE='22023'; END IF;
  BEGIN closed_date_value:=(p_payload->>'closed_date')::date;EXCEPTION WHEN datetime_field_overflow THEN RAISE EXCEPTION 'invalid close date' USING ERRCODE='22023';END;
  IF closed_date_value::text<>p_payload->>'closed_date' THEN RAISE EXCEPTION 'invalid close date' USING ERRCODE='22023'; END IF;
 END IF;
 canonical:=jsonb_build_object('from',from_value,'outcome',outcome_value,'closed_date',closed_date_value,'category',category_value,'detail',detail_value,'reason_source',source_value,'note',note_value);
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501';END IF;
 PERFORM 1 FROM public.users u WHERE u.auth_uid=auth.uid() FOR SHARE;PERFORM 1 FROM crm_security.access_review r WHERE r.reviewed_auth_uid=auth.uid() FOR SHARE;
 SELECT * INTO a FROM crm_security.actor();IF NOT FOUND THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501';END IF;
 PERFORM 1 FROM crm_security.object_scope s WHERE s.user_id=a.user_id AND s.deal_id=p_object_id FOR SHARE;
 SELECT * INTO oldrow FROM public.deals d WHERE d.id=p_object_id FOR UPDATE;
 IF NOT FOUND OR a.permission_role NOT IN ('rep','branch','admin') OR NOT crm_security.can_deal(p_object_id,true) THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501';END IF;
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(a.auth_uid::text||p_request_id::text,0));
 SELECT * INTO receipt FROM crm_security.command_receipts r WHERE r.actor_auth_uid=a.auth_uid AND r.request_id=p_request_id;
 IF FOUND THEN
  IF receipt.actor_user_id IS DISTINCT FROM a.user_id OR receipt.operation IS DISTINCT FROM 'close' OR receipt.object_id IS DISTINCT FROM p_object_id OR receipt.expected_version IS DISTINCT FROM p_expected_version OR receipt.payload IS DISTINCT FROM canonical THEN RAISE EXCEPTION 'REQUEST_ID_REUSE' USING ERRCODE='PT409';END IF;
  RETURN receipt.ack||jsonb_build_object('replayed',true);
 END IF;
 IF oldrow.version IS DISTINCT FROM p_expected_version THEN RAISE EXCEPTION 'version conflict' USING ERRCODE='PT409';END IF;
 IF oldrow.stage_code IS DISTINCT FROM from_value OR oldrow.outcome IS NOT NULL OR oldrow.lifecycle_status='closed' THEN RAISE EXCEPTION 'close state conflict' USING ERRCODE='PT409';END IF;
 IF jsonb_typeof(oldrow.stage_contexts) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'stage contexts state conflict' USING ERRCODE='PT409';END IF;
 server_at:=clock_timestamp();closed_date_value:=coalesce(closed_date_value,(server_at AT TIME ZONE 'Asia/Seoul')::date);
 IF closed_date_value>(server_at AT TIME ZONE 'Asia/Seoul')::date THEN RAISE EXCEPTION 'future close date' USING ERRCODE='22023';END IF;
 effective_at:=closed_date_value::timestamp AT TIME ZONE 'Asia/Seoul';
 lost_kind_value:=CASE WHEN category_value IN ('타사 선정 (경쟁 패배)','가격 열세','기술·공법 열세','가격','타업체 선정') THEN '뺏김' WHEN category_value IN ('우리가 연락 못 함','견적 후 후속 지연','담당자 부재·인수인계 누락') THEN '놓침' WHEN outcome_value='lost' THEN '기타' END;
 contexts:=jsonb_set(oldrow.stage_contexts,ARRAY[outcome_value],jsonb_build_object('transition_date',closed_date_value,'fields',jsonb_build_object('close_reason',category_value,'close_detail',detail_value),'from',from_value,'to',outcome_value,'recorded_at',server_at,'actor',a.display_name,'terminal',true,'reason_source',source_value),true);
 SELECT coalesce(jsonb_agg(id ORDER BY created_at),'[]'::jsonb) INTO completed_ids FROM public.next_actions WHERE deal_id=p_object_id AND status='open';
 UPDATE public.next_actions SET status='completed',completed_at=server_at,updated_at=server_at WHERE deal_id=p_object_id AND status='open';
 SELECT u.email INTO actor_email_value FROM public.users u WHERE u.user_id=a.user_id;
 INSERT INTO public.stage_history(opportunity_id,from_stage,to_stage,reason,actor_id,actor_name,changed_at) VALUES(p_object_id,from_value,outcome_value,category_value||' · '||detail_value,a.user_id,a.display_name,effective_at) RETURNING id INTO history_id;
 INSERT INTO public.activities(deal_id,organization_id,actor_email,actor_name,type,detail,occurred_at) VALUES(p_object_id,oldrow.organization_id,actor_email_value,a.display_name,'종료',jsonb_build_object('note',outcome_value,'result',note_value,'category',category_value,'detail',detail_value,'meaningful_contact',false),effective_at) RETURNING id INTO activity_id;
 INSERT INTO crm_security.deal_close_events(request_id,deal_id,from_stage,outcome,closed_date,category,detail,reason_source,actor_auth_uid,actor_user_id,recorded_at,stage_history_id,activity_id,completed_action_ids)
 VALUES(p_request_id,p_object_id,from_value,outcome_value,closed_date_value,category_value,detail_value,source_value,a.auth_uid,a.user_id,server_at,history_id,activity_id,completed_ids) RETURNING event_id INTO close_event_id;
 UPDATE public.deals SET lifecycle_status='closed',outcome=outcome_value,closed_at=effective_at,stage_contexts=contexts,last_activity_at=effective_at,
  lost_reason=CASE WHEN outcome_value='lost' THEN category_value ELSE lost_reason END,lost_kind=CASE WHEN outcome_value='lost' THEN lost_kind_value ELSE lost_kind END,badfit_type=CASE WHEN outcome_value='badfit' THEN category_value ELSE badfit_type END,
  next_action=NULL,next_action_date=NULL,updated_at=server_at,version=version+1 WHERE id=p_object_id AND version=p_expected_version RETURNING * INTO newrow;
 IF NOT FOUND THEN RAISE EXCEPTION 'unexpected version mutation' USING ERRCODE='PT409';END IF;
 INSERT INTO crm_security.audit_events(actor_auth_uid,actor_user_id,actor_name,deal_id,action,before_data,after_data,reason,created_at)
 VALUES(a.auth_uid,a.user_id,a.display_name,p_object_id,'close',jsonb_build_object('version',oldrow.version,'stage_code',oldrow.stage_code,'outcome',oldrow.outcome,'lifecycle_status',oldrow.lifecycle_status,'next_action',oldrow.next_action,'next_action_date',oldrow.next_action_date),jsonb_build_object('version',newrow.version,'stage_code',newrow.stage_code,'outcome',newrow.outcome,'lifecycle_status',newrow.lifecycle_status,'close_event_id',close_event_id,'stage_history_id',history_id,'activity_id',activity_id,'completed_action_ids',completed_ids),category_value||' · '||detail_value,server_at) RETURNING event_id INTO audit_id;
 ack:=jsonb_build_object('contract_version',1,'ok',true,'request_id',p_request_id,'operation','close','object_id',p_object_id,'actor_auth_uid',a.auth_uid,'actor_user_id',a.user_id,'previous_version',p_expected_version,'version',newrow.version,'from_stage',from_value,'stage_code',newrow.stage_code,'outcome',newrow.outcome,'lifecycle_status',newrow.lifecycle_status,'closed_at',newrow.closed_at,'stage_contexts',newrow.stage_contexts,'lost_reason',newrow.lost_reason,'lost_kind',newrow.lost_kind,'badfit_type',newrow.badfit_type,'close_event_id',close_event_id,'stage_history_id',history_id,'activity_id',activity_id,'completed_action_ids',completed_ids,'audit_event_id',audit_id,'server_at',server_at,'replayed',false);
 INSERT INTO crm_security.command_receipts(actor_auth_uid,request_id,actor_user_id,operation,object_id,expected_version,payload,ack) VALUES(a.auth_uid,p_request_id,a.user_id,'close',p_object_id,p_expected_version,canonical,ack);
 RETURN ack;
END $fn$;
REVOKE EXECUTE ON FUNCTION crm_security.crm_deal_close_nonwon_command_v1(uuid,uuid,integer,jsonb) FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION crm_security.crm_operational_source_fragment_v1(
 p_domain text,p_after uuid,p_limit integer
) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $fn$
DECLARE raw_items jsonb; items jsonb; next_cursor uuid; has_more boolean; a record;
BEGIN
 SELECT * INTO a FROM crm_security.actor();
 IF NOT FOUND THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;
 IF p_domain NOT IN ('deal_core','inquiry_core')
 THEN RAISE EXCEPTION 'unsupported operational source domain' USING ERRCODE='22023'; END IF;
 IF p_limit IS NULL OR p_limit<1 OR p_limit>100
 THEN RAISE EXCEPTION 'invalid limit' USING ERRCODE='22023'; END IF;

 IF p_domain='deal_core' THEN
  SELECT coalesce(jsonb_agg(to_jsonb(q) ORDER BY q.id),'[]'::jsonb) INTO raw_items FROM(
   SELECT d.id,d.site_id,
    coalesce(s.site_name,o.name,nullif(d.list_fields->>'site_name',''),nullif(d.list_fields->>'name','')) AS site_name,
    coalesce(s.site_name,o.name,nullif(d.list_fields->>'site_name',''),nullif(d.list_fields->>'name','')) AS site,
    d.owner_id,coalesce(u.name,d.assignee_name) AS owner_name,coalesce(u.name,d.assignee_name) AS assignee,
    d.stage_code,d.stage_raw,d.stage_group,d.brand,d.list_name,
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
    coalesce((SELECT jsonb_agg(jsonb_build_object('id',ac.id,'type',ac.type,'occurred_at',ac.occurred_at) ORDER BY ac.occurred_at,ac.id)
     FROM public.activities ac WHERE ac.deal_id=d.id),'[]'::jsonb) AS activity_signals
   FROM public.deals d
   LEFT JOIN public.sites s ON s.site_id=d.site_id
   LEFT JOIN public.organizations o ON o.id=d.organization_id
   LEFT JOIN public.users u ON u.user_id=d.owner_id
   LEFT JOIN public.contacts c ON c.id=d.contact_id
   LEFT JOIN crm_security.user_opportunity_state ps ON ps.actor_user_id=a.user_id AND ps.deal_id=d.id
   WHERE crm_security.can_deal(d.id,false) AND (p_after IS NULL OR d.id>p_after)
   ORDER BY d.id LIMIT p_limit+1
  )q;
 ELSE
  SELECT coalesce(jsonb_agg(to_jsonb(q) ORDER BY q.id),'[]'::jsonb) INTO raw_items FROM(
   SELECT i.id,i.site_id,i.site_name,i.brand,i.inquiry_type,i.work_type,i.source_channel,i.channel,
    i.assigned_to,coalesce(u.name,i.assignee_name) AS assignee_name,ar.permission_role AS assignee_permission_role,
    i.status,i.deal_id,i.opportunity_id,i.received_at,i.created_at,i.updated_at,i.assigned_at,
    i.first_response_at,i.responded_at,i.next_action_date,i.contact_name,i.phone
   FROM public.inquiries i
   LEFT JOIN public.users u ON u.user_id=i.assigned_to
   LEFT JOIN crm_security.access_review ar ON ar.user_id=i.assigned_to AND ar.approved AND ar.expires_at>now()
   WHERE crm_security.can_inquiry(i.id) AND (p_after IS NULL OR i.id>p_after)
   ORDER BY i.id LIMIT p_limit+1
  )q;
 END IF;

 has_more:=jsonb_array_length(raw_items)>p_limit;
 items:=CASE WHEN has_more THEN raw_items-p_limit ELSE raw_items END;
 next_cursor:=CASE WHEN has_more AND jsonb_array_length(items)>0
  THEN (items->(jsonb_array_length(items)-1)->>'id')::uuid ELSE NULL END;
 RETURN jsonb_build_object(
  'contract_version',1,'resource','operational_source','domain',p_domain,
  'scope_completeness','actor_authorized_rows_only',
  'actor_user_id',a.user_id,'actor_permission_role',a.permission_role,
  'items',items,'pagination',jsonb_build_object(
   'completeness',CASE WHEN has_more THEN 'partial' ELSE 'complete' END,
   'has_more',has_more,'next_cursor',next_cursor));
END $fn$;


REVOKE EXECUTE ON FUNCTION crm_security.crm_operational_source_fragment_v1(text,uuid,integer) FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION public.crm_write_command_v2(p_request_id uuid,p_operation text,p_object_id uuid,p_expected_version integer,p_payload jsonb) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $fn$ BEGIN IF p_operation='close' THEN RETURN crm_security.crm_deal_close_nonwon_command_v1(p_request_id,p_object_id,p_expected_version,p_payload);END IF;RETURN crm_security.crm_write_command_v2_transition_20260906(p_request_id,p_operation,p_object_id,p_expected_version,p_payload);END $fn$;
REVOKE EXECUTE ON FUNCTION public.crm_write_command_v2(uuid,text,uuid,integer,jsonb) FROM PUBLIC,anon,authenticated,service_role;GRANT EXECUTE ON FUNCTION public.crm_write_command_v2(uuid,text,uuid,integer,jsonb) TO authenticated;
DO $post$ DECLARE changed integer;BEGIN SELECT count(*) INTO changed FROM close_source_guard g JOIN pg_proc p ON p.oid=g.oid WHERE p.prosrc IS DISTINCT FROM g.prosrc OR p.proconfig IS DISTINCT FROM g.proconfig OR coalesce(p.proacl::text,'') IS DISTINCT FROM g.acl;
 IF changed<>0 OR has_function_privilege('anon','public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)','EXECUTE') OR NOT has_function_privilege('authenticated','public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)','EXECUTE') OR has_function_privilege('service_role','public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)','EXECUTE') OR has_function_privilege('authenticated','crm_security.crm_deal_close_nonwon_command_v1(uuid,uuid,integer,jsonb)','EXECUTE') OR has_table_privilege('authenticated','crm_security.deal_close_events','SELECT') OR NOT (SELECT relrowsecurity FROM pg_class WHERE oid='crm_security.deal_close_events'::regclass) OR (SELECT pg_get_constraintdef(oid,true) FROM pg_constraint WHERE conrelid='crm_security.command_receipts'::regclass AND conname='command_receipts_operation_check') IS DISTINCT FROM $expected$CHECK (operation = ANY (ARRAY['opportunity_work_set'::text, 'inquiry_assign'::text, 'service_change'::text, 'inquiry_unassign'::text, 'favorite_set'::text, 'opportunity_touch'::text, 'next_action'::text, 'activity'::text, 'quote_version'::text, 'next_action_complete'::text, 'stage_check'::text, 'transition'::text, 'close'::text]))$expected$ THEN RAISE EXCEPTION 'close nonwon post-apply drift';END IF;END $post$;
-- ===== APPLY expected_amount =====
SET LOCAL crm.expected_amount_ref='rprechiaglyjaydkmxsu';
SET LOCAL crm.expected_amount_ref='rprechiaglyjaydkmxsu';
SET LOCAL search_path=pg_catalog;SET LOCAL lock_timeout='3s';SET LOCAL statement_timeout='60s';
DO $guard$ BEGIN IF current_user<>'postgres' OR current_setting('crm.expected_amount_ref',true) IS DISTINCT FROM 'rprechiaglyjaydkmxsu'
 OR to_regprocedure('public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)') IS NULL OR to_regprocedure('crm_security.crm_deal_close_nonwon_command_v1(uuid,uuid,integer,jsonb)') IS NULL OR to_regclass('crm_security.deal_close_events') IS NULL OR to_regclass('crm_security.quote_versions') IS NULL
 OR to_regprocedure('crm_security.crm_write_command_v2_close_nonwon_20260906(uuid,text,uuid,integer,jsonb)') IS NOT NULL OR to_regprocedure('crm_security.crm_deal_expected_amount_command_v1(uuid,uuid,integer,jsonb)') IS NOT NULL
 OR (SELECT pg_get_constraintdef(oid,true) FROM pg_constraint WHERE conrelid='crm_security.command_receipts'::regclass AND conname='command_receipts_operation_check') IS DISTINCT FROM $expected$CHECK (operation = ANY (ARRAY['opportunity_work_set'::text, 'inquiry_assign'::text, 'service_change'::text, 'inquiry_unassign'::text, 'favorite_set'::text, 'opportunity_touch'::text, 'next_action'::text, 'activity'::text, 'quote_version'::text, 'next_action_complete'::text, 'stage_check'::text, 'transition'::text, 'close'::text]))$expected$
 THEN RAISE EXCEPTION 'expected amount after-close prerequisite drift';END IF;END $guard$;
ALTER FUNCTION public.crm_write_command_v2(uuid,text,uuid,integer,jsonb) RENAME TO crm_write_command_v2_close_nonwon_20260906;ALTER FUNCTION public.crm_write_command_v2_close_nonwon_20260906(uuid,text,uuid,integer,jsonb) SET SCHEMA crm_security;
REVOKE EXECUTE ON FUNCTION crm_security.crm_write_command_v2_close_nonwon_20260906(uuid,text,uuid,integer,jsonb) FROM PUBLIC,anon,authenticated,service_role;
ALTER TABLE crm_security.command_receipts DROP CONSTRAINT command_receipts_operation_check;ALTER TABLE crm_security.command_receipts ADD CONSTRAINT command_receipts_operation_check CHECK(operation IN ('opportunity_work_set','inquiry_assign','service_change','inquiry_unassign','favorite_set','opportunity_touch','next_action','activity','quote_version','next_action_complete','stage_check','transition','close','amount'));
CREATE FUNCTION crm_security.crm_deal_expected_amount_command_v1(
 p_request_id uuid,p_object_id uuid,p_expected_version integer,p_payload jsonb
) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $fn$
DECLARE a record;receipt crm_security.command_receipts%ROWTYPE;oldrow public.deals%ROWTYPE;newrow public.deals%ROWTYPE;
 canonical jsonb;ack jsonb;audit_id uuid;amount_value bigint;submitted_quote bigint;latest_quote bigint;server_at timestamptz;
BEGIN
 IF p_request_id IS NULL OR p_object_id IS NULL OR p_expected_version IS NULL OR p_expected_version<0
  OR jsonb_typeof(p_payload) IS DISTINCT FROM 'object'
  OR EXISTS(SELECT 1 FROM jsonb_object_keys(p_payload) k WHERE k NOT IN ('amount','quote_amount','won_amount'))
  OR NOT p_payload ?& ARRAY['amount','quote_amount','won_amount']
  OR jsonb_typeof(p_payload->'amount') NOT IN ('number','string')
  OR jsonb_typeof(p_payload->'quote_amount') NOT IN ('number','string','null')
  OR jsonb_typeof(p_payload->'won_amount') IS DISTINCT FROM 'null'
 THEN RAISE EXCEPTION 'invalid expected amount payload' USING ERRCODE='22023';END IF;
 BEGIN amount_value:=(p_payload->>'amount')::bigint;EXCEPTION WHEN invalid_text_representation OR numeric_value_out_of_range THEN RAISE EXCEPTION 'invalid expected amount' USING ERRCODE='22023';END;
 IF amount_value<0 THEN RAISE EXCEPTION 'invalid expected amount' USING ERRCODE='22023';END IF;
 IF p_payload->>'quote_amount' IS NOT NULL THEN
  BEGIN submitted_quote:=(p_payload->>'quote_amount')::bigint;EXCEPTION WHEN invalid_text_representation OR numeric_value_out_of_range THEN RAISE EXCEPTION 'invalid quote snapshot' USING ERRCODE='22023';END;
  IF submitted_quote<=0 THEN RAISE EXCEPTION 'invalid quote snapshot' USING ERRCODE='22023';END IF;
 END IF;
 canonical:=jsonb_build_object('amount',amount_value,'quote_amount',submitted_quote,'won_amount',NULL);
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501';END IF;
 PERFORM 1 FROM public.users u WHERE u.auth_uid=auth.uid() FOR SHARE;PERFORM 1 FROM crm_security.access_review r WHERE r.reviewed_auth_uid=auth.uid() FOR SHARE;
 SELECT * INTO a FROM crm_security.actor();IF NOT FOUND THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501';END IF;
 PERFORM 1 FROM crm_security.object_scope s WHERE s.user_id=a.user_id AND s.deal_id=p_object_id FOR SHARE;
 SELECT * INTO oldrow FROM public.deals d WHERE d.id=p_object_id FOR UPDATE;
 IF NOT FOUND OR a.permission_role NOT IN ('rep','branch','admin') OR NOT crm_security.can_deal(p_object_id,true) THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501';END IF;
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(a.auth_uid::text||p_request_id::text,0));
 SELECT * INTO receipt FROM crm_security.command_receipts r WHERE r.actor_auth_uid=a.auth_uid AND r.request_id=p_request_id;
 IF FOUND THEN
  IF receipt.actor_user_id IS DISTINCT FROM a.user_id OR receipt.operation IS DISTINCT FROM 'amount' OR receipt.object_id IS DISTINCT FROM p_object_id OR receipt.expected_version IS DISTINCT FROM p_expected_version OR receipt.payload IS DISTINCT FROM canonical THEN RAISE EXCEPTION 'REQUEST_ID_REUSE' USING ERRCODE='PT409';END IF;
  RETURN receipt.ack||jsonb_build_object('replayed',true);
 END IF;
 IF oldrow.version IS DISTINCT FROM p_expected_version THEN RAISE EXCEPTION 'version conflict' USING ERRCODE='PT409';END IF;
 IF oldrow.outcome IS NOT NULL OR oldrow.lifecycle_status='closed' THEN RAISE EXCEPTION 'expected amount state conflict' USING ERRCODE='PT409';END IF;
 SELECT q.amount INTO latest_quote FROM crm_security.quote_versions q WHERE q.deal_id=p_object_id ORDER BY q.version_no DESC LIMIT 1;
 IF submitted_quote IS DISTINCT FROM latest_quote THEN RAISE EXCEPTION 'quote amount state conflict' USING ERRCODE='PT409';END IF;
 server_at:=clock_timestamp();
 UPDATE public.deals SET amount=amount_value,updated_at=server_at,version=version+1 WHERE id=p_object_id AND version=p_expected_version RETURNING * INTO newrow;
 IF NOT FOUND THEN RAISE EXCEPTION 'unexpected version mutation' USING ERRCODE='PT409';END IF;
 INSERT INTO crm_security.audit_events(actor_auth_uid,actor_user_id,actor_name,deal_id,action,before_data,after_data,reason,created_at)
 VALUES(a.auth_uid,a.user_id,a.display_name,p_object_id,'amount',jsonb_build_object('version',oldrow.version,'amount',oldrow.amount,'quote_amount',latest_quote),jsonb_build_object('version',newrow.version,'amount',newrow.amount,'quote_amount',latest_quote),'expected amount update',server_at) RETURNING event_id INTO audit_id;
 ack:=jsonb_build_object('contract_version',1,'ok',true,'request_id',p_request_id,'operation','amount','object_id',p_object_id,'actor_auth_uid',a.auth_uid,'actor_user_id',a.user_id,'previous_version',p_expected_version,'version',newrow.version,'amount',newrow.amount,'quote_amount',latest_quote,'won_amount',NULL,'audit_event_id',audit_id,'server_at',server_at,'replayed',false);
 INSERT INTO crm_security.command_receipts(actor_auth_uid,request_id,actor_user_id,operation,object_id,expected_version,payload,ack) VALUES(a.auth_uid,p_request_id,a.user_id,'amount',p_object_id,p_expected_version,canonical,ack);
 RETURN ack;
END $fn$;
REVOKE EXECUTE ON FUNCTION crm_security.crm_deal_expected_amount_command_v1(uuid,uuid,integer,jsonb) FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION public.crm_write_command_v2(p_request_id uuid,p_operation text,p_object_id uuid,p_expected_version integer,p_payload jsonb) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $fn$ BEGIN IF p_operation='amount' THEN RETURN crm_security.crm_deal_expected_amount_command_v1(p_request_id,p_object_id,p_expected_version,p_payload);END IF;RETURN crm_security.crm_write_command_v2_close_nonwon_20260906(p_request_id,p_operation,p_object_id,p_expected_version,p_payload);END $fn$;
REVOKE EXECUTE ON FUNCTION public.crm_write_command_v2(uuid,text,uuid,integer,jsonb) FROM PUBLIC,anon,authenticated,service_role;GRANT EXECUTE ON FUNCTION public.crm_write_command_v2(uuid,text,uuid,integer,jsonb) TO authenticated;
DO $post$ BEGIN IF has_function_privilege('anon','public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)','EXECUTE') OR NOT has_function_privilege('authenticated','public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)','EXECUTE') OR has_function_privilege('service_role','public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)','EXECUTE') OR has_function_privilege('authenticated','crm_security.crm_deal_expected_amount_command_v1(uuid,uuid,integer,jsonb)','EXECUTE') OR (SELECT pg_get_constraintdef(oid,true) FROM pg_constraint WHERE conrelid='crm_security.command_receipts'::regclass AND conname='command_receipts_operation_check') IS DISTINCT FROM $expected$CHECK (operation = ANY (ARRAY['opportunity_work_set'::text, 'inquiry_assign'::text, 'service_change'::text, 'inquiry_unassign'::text, 'favorite_set'::text, 'opportunity_touch'::text, 'next_action'::text, 'activity'::text, 'quote_version'::text, 'next_action_complete'::text, 'stage_check'::text, 'transition'::text, 'close'::text, 'amount'::text]))$expected$ THEN RAISE EXCEPTION 'expected amount post-apply drift';END IF;END $post$;
-- ===== APPLY waiting_context =====
SET LOCAL crm.waiting_context_ref='rprechiaglyjaydkmxsu';
SET LOCAL crm.waiting_context_ref='rprechiaglyjaydkmxsu';
SET LOCAL search_path=pg_catalog;SET LOCAL lock_timeout='3s';SET LOCAL statement_timeout='60s';
DO $guard$ BEGIN IF current_user<>'postgres' OR current_setting('crm.waiting_context_ref',true) IS DISTINCT FROM 'rprechiaglyjaydkmxsu' OR to_regprocedure('public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)') IS NULL OR to_regprocedure('crm_security.crm_deal_expected_amount_command_v1(uuid,uuid,integer,jsonb)') IS NULL OR to_regprocedure('crm_security.crm_write_command_v2_close_nonwon_20260906(uuid,text,uuid,integer,jsonb)') IS NULL OR NOT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='deals' AND column_name IN ('stage_contexts','wake_up_at') GROUP BY table_schema,table_name HAVING count(*)=2) OR to_regprocedure('crm_security.crm_write_command_v2_expected_amount_20260906(uuid,text,uuid,integer,jsonb)') IS NOT NULL OR to_regprocedure('crm_security.crm_deal_waiting_context_command_v1(uuid,uuid,integer,jsonb)') IS NOT NULL OR (SELECT pg_get_constraintdef(oid,true) FROM pg_constraint WHERE conrelid='crm_security.command_receipts'::regclass AND conname='command_receipts_operation_check') IS DISTINCT FROM $expected$CHECK (operation = ANY (ARRAY['opportunity_work_set'::text, 'inquiry_assign'::text, 'service_change'::text, 'inquiry_unassign'::text, 'favorite_set'::text, 'opportunity_touch'::text, 'next_action'::text, 'activity'::text, 'quote_version'::text, 'next_action_complete'::text, 'stage_check'::text, 'transition'::text, 'close'::text, 'amount'::text]))$expected$ THEN RAISE EXCEPTION 'waiting context after-amount prerequisite drift';END IF;END $guard$;
ALTER FUNCTION public.crm_write_command_v2(uuid,text,uuid,integer,jsonb) RENAME TO crm_write_command_v2_expected_amount_20260906;ALTER FUNCTION public.crm_write_command_v2_expected_amount_20260906(uuid,text,uuid,integer,jsonb) SET SCHEMA crm_security;REVOKE EXECUTE ON FUNCTION crm_security.crm_write_command_v2_expected_amount_20260906(uuid,text,uuid,integer,jsonb) FROM PUBLIC,anon,authenticated,service_role;
ALTER TABLE crm_security.command_receipts DROP CONSTRAINT command_receipts_operation_check;ALTER TABLE crm_security.command_receipts ADD CONSTRAINT command_receipts_operation_check CHECK(operation IN ('opportunity_work_set','inquiry_assign','service_change','inquiry_unassign','favorite_set','opportunity_touch','next_action','activity','quote_version','next_action_complete','stage_check','transition','close','amount','waiting_context'));
CREATE FUNCTION crm_security.crm_deal_waiting_context_command_v1(
 p_request_id uuid,p_object_id uuid,p_expected_version integer,p_payload jsonb
) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $fn$
DECLARE a record;receipt crm_security.command_receipts%ROWTYPE;oldrow public.deals%ROWTYPE;newrow public.deals%ROWTYPE;
 canonical jsonb;ack jsonb;audit_id uuid;activity_id uuid;next_id uuid;cancelled_ids jsonb:='[]'::jsonb;
 reason_value text;speaker_value text;statement_value text;evidence_value text;wake_value date;resume_value date;server_at timestamptz;due_at timestamptz;contexts jsonb;actor_email text;
BEGIN
 IF p_request_id IS NULL OR p_object_id IS NULL OR p_expected_version IS NULL OR p_expected_version<0 OR jsonb_typeof(p_payload) IS DISTINCT FROM 'object'
  OR EXISTS(SELECT 1 FROM jsonb_object_keys(p_payload) k WHERE k NOT IN ('waiting_reason','waiting_speaker','waiting_customer_statement','wake_up_at','waiting_evidence','expected_resume_at'))
  OR NOT p_payload ?& ARRAY['waiting_reason','waiting_speaker','waiting_customer_statement','wake_up_at','waiting_evidence','expected_resume_at']
  OR EXISTS(SELECT 1 FROM jsonb_each(p_payload) e WHERE jsonb_typeof(e.value) IS DISTINCT FROM 'string')
 THEN RAISE EXCEPTION 'invalid waiting context payload' USING ERRCODE='22023';END IF;
 reason_value:=trim(p_payload->>'waiting_reason');speaker_value:=trim(p_payload->>'waiting_speaker');statement_value:=trim(p_payload->>'waiting_customer_statement');evidence_value:=trim(p_payload->>'waiting_evidence');
 IF length(reason_value)<2 OR length(reason_value)>2000 OR length(speaker_value)<1 OR length(speaker_value)>500 OR length(statement_value)<2 OR length(statement_value)>8000 OR length(evidence_value)<2 OR length(evidence_value)>4000 OR p_payload->>'wake_up_at' !~ '^\d{4}-\d{2}-\d{2}$' OR p_payload->>'expected_resume_at' !~ '^\d{4}-\d{2}-\d{2}$' THEN RAISE EXCEPTION 'invalid waiting context payload' USING ERRCODE='22023';END IF;
 BEGIN wake_value:=(p_payload->>'wake_up_at')::date;resume_value:=(p_payload->>'expected_resume_at')::date;EXCEPTION WHEN datetime_field_overflow THEN RAISE EXCEPTION 'invalid waiting dates' USING ERRCODE='22023';END;
 IF wake_value::text<>p_payload->>'wake_up_at' OR resume_value::text<>p_payload->>'expected_resume_at' THEN RAISE EXCEPTION 'invalid waiting dates' USING ERRCODE='22023';END IF;
 canonical:=jsonb_build_object('waiting_reason',reason_value,'waiting_speaker',speaker_value,'waiting_customer_statement',statement_value,'wake_up_at',wake_value,'waiting_evidence',evidence_value,'expected_resume_at',resume_value);
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501';END IF;
 PERFORM 1 FROM public.users u WHERE u.auth_uid=auth.uid() FOR SHARE;PERFORM 1 FROM crm_security.access_review r WHERE r.reviewed_auth_uid=auth.uid() FOR SHARE;
 SELECT * INTO a FROM crm_security.actor();IF NOT FOUND THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501';END IF;
 PERFORM 1 FROM crm_security.object_scope s WHERE s.user_id=a.user_id AND s.deal_id=p_object_id FOR SHARE;
 SELECT * INTO oldrow FROM public.deals d WHERE d.id=p_object_id FOR UPDATE;
 IF NOT FOUND OR a.permission_role NOT IN ('rep','branch','admin') OR NOT crm_security.can_deal(p_object_id,true) THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501';END IF;
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(a.auth_uid::text||p_request_id::text,0));
 SELECT * INTO receipt FROM crm_security.command_receipts r WHERE r.actor_auth_uid=a.auth_uid AND r.request_id=p_request_id;
 IF FOUND THEN
  IF receipt.actor_user_id IS DISTINCT FROM a.user_id OR receipt.operation IS DISTINCT FROM 'waiting_context' OR receipt.object_id IS DISTINCT FROM p_object_id OR receipt.expected_version IS DISTINCT FROM p_expected_version OR receipt.payload IS DISTINCT FROM canonical THEN RAISE EXCEPTION 'REQUEST_ID_REUSE' USING ERRCODE='PT409';END IF;
  RETURN receipt.ack||jsonb_build_object('replayed',true);
 END IF;
 IF oldrow.version IS DISTINCT FROM p_expected_version THEN RAISE EXCEPTION 'version conflict' USING ERRCODE='PT409';END IF;
 IF oldrow.stage_code IS DISTINCT FROM 'waiting' OR oldrow.outcome IS NOT NULL OR oldrow.lifecycle_status='closed' OR jsonb_typeof(oldrow.stage_contexts) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'waiting context state conflict' USING ERRCODE='PT409';END IF;
 server_at:=clock_timestamp();due_at:=wake_value::timestamp AT TIME ZONE 'Asia/Seoul';
 contexts:=jsonb_set(oldrow.stage_contexts,ARRAY['waiting'],jsonb_build_object('from','waiting','to','waiting','recorded_at',server_at,'actor',a.display_name,'fields',jsonb_build_object('reason',reason_value,'speaker',speaker_value,'statement',statement_value,'contact_date',wake_value,'resume_date',resume_value,'evidence',evidence_value)),true);
 SELECT coalesce(jsonb_agg(id ORDER BY created_at),'[]'::jsonb) INTO cancelled_ids FROM public.next_actions WHERE deal_id=p_object_id AND status='open';
 UPDATE public.next_actions SET status='cancelled',updated_at=server_at WHERE deal_id=p_object_id AND status='open';
 INSERT INTO public.next_actions(deal_id,action_type,title,due_at,assignee_name,status,created_at,updated_at) VALUES(p_object_id,'전화','대기 사유 확인 후 재접촉',due_at,a.display_name,'open',server_at,server_at) RETURNING id INTO next_id;
 SELECT u.email INTO actor_email FROM public.users u WHERE u.user_id=a.user_id;
 INSERT INTO public.activities(deal_id,organization_id,actor_email,actor_name,type,detail,occurred_at) VALUES(p_object_id,oldrow.organization_id,actor_email,a.display_name,'대기정보',jsonb_build_object('note',reason_value,'result',speaker_value||' · 재접촉 '||wake_value::text||' · '||evidence_value,'customer_statement',statement_value,'expected_resume_at',resume_value,'meaningful_contact',false),server_at) RETURNING id INTO activity_id;
 UPDATE public.deals SET wake_up_at=due_at,stage_contexts=contexts,next_action='대기 사유 확인 후 재접촉',next_action_date=wake_value,last_activity_at=server_at,updated_at=server_at,version=version+1 WHERE id=p_object_id AND version=p_expected_version RETURNING * INTO newrow;
 IF NOT FOUND THEN RAISE EXCEPTION 'unexpected version mutation' USING ERRCODE='PT409';END IF;
 INSERT INTO crm_security.audit_events(actor_auth_uid,actor_user_id,actor_name,deal_id,action,before_data,after_data,reason,created_at)
 VALUES(a.auth_uid,a.user_id,a.display_name,p_object_id,'waiting_context',jsonb_build_object('version',oldrow.version,'wake_up_at',oldrow.wake_up_at,'waiting',oldrow.stage_contexts->'waiting','next_action',oldrow.next_action,'next_action_date',oldrow.next_action_date),jsonb_build_object('version',newrow.version,'wake_up_at',newrow.wake_up_at,'waiting',newrow.stage_contexts->'waiting','next_action_id',next_id,'activity_id',activity_id,'cancelled_action_ids',cancelled_ids),reason_value,server_at) RETURNING event_id INTO audit_id;
 ack:=jsonb_build_object('contract_version',1,'ok',true,'request_id',p_request_id,'operation','waiting_context','object_id',p_object_id,'actor_auth_uid',a.auth_uid,'actor_user_id',a.user_id,'previous_version',p_expected_version,'version',newrow.version,'wake_up_at',wake_value,'expected_resume_at',resume_value,'waiting_context',newrow.stage_contexts->'waiting','next_action_id',next_id,'activity_id',activity_id,'cancelled_action_ids',cancelled_ids,'audit_event_id',audit_id,'server_at',server_at,'replayed',false);
 INSERT INTO crm_security.command_receipts(actor_auth_uid,request_id,actor_user_id,operation,object_id,expected_version,payload,ack) VALUES(a.auth_uid,p_request_id,a.user_id,'waiting_context',p_object_id,p_expected_version,canonical,ack);
 RETURN ack;
END $fn$;
REVOKE EXECUTE ON FUNCTION crm_security.crm_deal_waiting_context_command_v1(uuid,uuid,integer,jsonb) FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION public.crm_write_command_v2(p_request_id uuid,p_operation text,p_object_id uuid,p_expected_version integer,p_payload jsonb) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $fn$ BEGIN IF p_operation='waiting_context' THEN RETURN crm_security.crm_deal_waiting_context_command_v1(p_request_id,p_object_id,p_expected_version,p_payload);END IF;RETURN crm_security.crm_write_command_v2_expected_amount_20260906(p_request_id,p_operation,p_object_id,p_expected_version,p_payload);END $fn$;
REVOKE EXECUTE ON FUNCTION public.crm_write_command_v2(uuid,text,uuid,integer,jsonb) FROM PUBLIC,anon,authenticated,service_role;GRANT EXECUTE ON FUNCTION public.crm_write_command_v2(uuid,text,uuid,integer,jsonb) TO authenticated;
DO $post$ BEGIN IF has_function_privilege('anon','public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)','EXECUTE') OR NOT has_function_privilege('authenticated','public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)','EXECUTE') OR has_function_privilege('service_role','public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)','EXECUTE') OR has_function_privilege('authenticated','crm_security.crm_deal_waiting_context_command_v1(uuid,uuid,integer,jsonb)','EXECUTE') OR (SELECT pg_get_constraintdef(oid,true) FROM pg_constraint WHERE conrelid='crm_security.command_receipts'::regclass AND conname='command_receipts_operation_check') IS DISTINCT FROM $expected$CHECK (operation = ANY (ARRAY['opportunity_work_set'::text, 'inquiry_assign'::text, 'service_change'::text, 'inquiry_unassign'::text, 'favorite_set'::text, 'opportunity_touch'::text, 'next_action'::text, 'activity'::text, 'quote_version'::text, 'next_action_complete'::text, 'stage_check'::text, 'transition'::text, 'close'::text, 'amount'::text, 'waiting_context'::text]))$expected$ THEN RAISE EXCEPTION 'waiting context post-apply drift';END IF;END $post$;
-- ===== APPLY inquiry_reclassify =====
SET LOCAL crm.inquiry_reclassify_ref='rprechiaglyjaydkmxsu';
SET LOCAL crm.inquiry_reclassify_ref='rprechiaglyjaydkmxsu';
SET LOCAL search_path=pg_catalog;SET LOCAL lock_timeout='3s';SET LOCAL statement_timeout='60s';
DO $guard$ BEGIN IF current_user<>'postgres' OR current_setting('crm.inquiry_reclassify_ref',true) IS DISTINCT FROM 'rprechiaglyjaydkmxsu' OR to_regprocedure('public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)') IS NULL OR to_regprocedure('crm_security.crm_deal_waiting_context_command_v1(uuid,uuid,integer,jsonb)') IS NULL OR to_regprocedure('crm_security.crm_operational_source_fragment_v1(text,uuid,integer)') IS NULL OR to_regprocedure('crm_security.crm_write_command_v2_waiting_context_20260906(uuid,text,uuid,integer,jsonb)') IS NOT NULL OR to_regprocedure('crm_security.crm_operational_source_fragment_pre_inquiry_reclassify_20260906(text,uuid,integer)') IS NOT NULL OR to_regprocedure('crm_security.crm_inquiry_reclassify_command_v1(uuid,uuid,jsonb)') IS NOT NULL OR (SELECT pg_get_constraintdef(oid,true) FROM pg_constraint WHERE conrelid='crm_security.command_receipts'::regclass AND conname='command_receipts_operation_check') IS DISTINCT FROM $expected$CHECK (operation = ANY (ARRAY['opportunity_work_set'::text, 'inquiry_assign'::text, 'service_change'::text, 'inquiry_unassign'::text, 'favorite_set'::text, 'opportunity_touch'::text, 'next_action'::text, 'activity'::text, 'quote_version'::text, 'next_action_complete'::text, 'stage_check'::text, 'transition'::text, 'close'::text, 'amount'::text, 'waiting_context'::text]))$expected$ OR (SELECT pg_get_constraintdef(oid,true) FROM pg_constraint WHERE conrelid='crm_security.inquiry_audit_events'::regclass AND conname='inquiry_audit_events_action_check') IS DISTINCT FROM $expected$CHECK (action = ANY (ARRAY['direct_assign'::text, 'direct_reassign'::text, 'inquiry_unassign'::text]))$expected$ THEN RAISE EXCEPTION 'inquiry reclassify after-waiting prerequisite drift';END IF;END $guard$;
CREATE TEMP TABLE inquiry_reclassify_source_guard AS SELECT p.oid,p.prosrc,p.proconfig,coalesce(p.proacl::text,'') acl FROM pg_proc p WHERE p.oid='public.crm_operational_source_v1(text,uuid,integer)'::regprocedure;
ALTER FUNCTION public.crm_write_command_v2(uuid,text,uuid,integer,jsonb) RENAME TO crm_write_command_v2_waiting_context_20260906;ALTER FUNCTION public.crm_write_command_v2_waiting_context_20260906(uuid,text,uuid,integer,jsonb) SET SCHEMA crm_security;REVOKE EXECUTE ON FUNCTION crm_security.crm_write_command_v2_waiting_context_20260906(uuid,text,uuid,integer,jsonb) FROM PUBLIC,anon,authenticated,service_role;
ALTER FUNCTION crm_security.crm_operational_source_fragment_v1(text,uuid,integer) RENAME TO crm_operational_source_fragment_pre_inquiry_reclassify_20260906;REVOKE EXECUTE ON FUNCTION crm_security.crm_operational_source_fragment_pre_inquiry_reclassify_20260906(text,uuid,integer) FROM PUBLIC,anon,authenticated,service_role;
ALTER TABLE crm_security.command_receipts DROP CONSTRAINT command_receipts_operation_check;ALTER TABLE crm_security.command_receipts ADD CONSTRAINT command_receipts_operation_check CHECK(operation IN ('opportunity_work_set','inquiry_assign','service_change','inquiry_unassign','favorite_set','opportunity_touch','next_action','activity','quote_version','next_action_complete','stage_check','transition','close','amount','waiting_context','inquiry_reclassify'));
ALTER TABLE crm_security.inquiry_audit_events DROP CONSTRAINT inquiry_audit_events_action_check;ALTER TABLE crm_security.inquiry_audit_events ADD CONSTRAINT inquiry_audit_events_action_check CHECK(action IN ('direct_assign','direct_reassign','inquiry_unassign','inquiry_reclassify'));
CREATE FUNCTION crm_security.crm_inquiry_reclassify_command_v1(
 p_request_id uuid,p_inquiry_id uuid,p_payload jsonb
) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $fn$
DECLARE a record;receipt crm_security.command_receipts%ROWTYPE;oldrow public.inquiries%ROWTYPE;newrow public.inquiries%ROWTYPE;
 canonical jsonb;ack jsonb;audit_id uuid;target_brand text;server_at timestamptz;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501';END IF;
 PERFORM 1 FROM public.users u WHERE u.auth_uid=auth.uid() FOR SHARE;
 PERFORM 1 FROM crm_security.access_review r WHERE r.reviewed_auth_uid=auth.uid() FOR SHARE;
 SELECT * INTO a FROM crm_security.actor();IF NOT FOUND THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501';END IF;
 IF p_request_id IS NULL OR p_inquiry_id IS NULL OR jsonb_typeof(p_payload) IS DISTINCT FROM 'object'
  OR EXISTS(SELECT 1 FROM jsonb_object_keys(p_payload) k WHERE k<>'to_brand')
  OR NOT p_payload ? 'to_brand' OR jsonb_typeof(p_payload->'to_brand') IS DISTINCT FROM 'string'
  OR length(trim(p_payload->>'to_brand'))<1 OR length(p_payload->>'to_brand')>100
 THEN RAISE EXCEPTION 'invalid inquiry reclassify payload; actor, source brand and time are server-owned' USING ERRCODE='22023';END IF;
 target_brand:=trim(p_payload->>'to_brand');canonical:=jsonb_build_object('to_brand',target_brand);
 IF target_brand='기술자문' OR NOT(target_brand IN ('석민이앤씨','POUR솔루션','POUR공법','아파트스퀘어')
  OR EXISTS(SELECT 1 FROM public.inquiries x WHERE x.brand=target_brand AND x.brand<>'기술자문'))
 THEN RAISE EXCEPTION 'invalid inquiry brand' USING ERRCODE='22023';END IF;
 PERFORM 1 FROM crm_security.object_scope s WHERE s.user_id=a.user_id AND s.inquiry_id=p_inquiry_id FOR SHARE;
 SELECT * INTO oldrow FROM public.inquiries i WHERE i.id=p_inquiry_id FOR UPDATE;
 IF NOT FOUND OR a.permission_role<>'admin' OR NOT crm_security.can_inquiry(p_inquiry_id)
 THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501';END IF;
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(a.auth_uid::text||p_request_id::text,0));
 SELECT * INTO receipt FROM crm_security.command_receipts r WHERE r.actor_auth_uid=a.auth_uid AND r.request_id=p_request_id;
 IF FOUND THEN
  IF receipt.actor_user_id IS DISTINCT FROM a.user_id OR receipt.operation IS DISTINCT FROM 'inquiry_reclassify'
   OR receipt.object_id IS DISTINCT FROM p_inquiry_id OR receipt.expected_version IS DISTINCT FROM 0
   OR receipt.payload IS DISTINCT FROM canonical
  THEN RAISE EXCEPTION 'REQUEST_ID_REUSE' USING ERRCODE='PT409';END IF;
  RETURN receipt.ack||jsonb_build_object('replayed',true);
 END IF;
 IF oldrow.brand IS DISTINCT FROM '기술자문' THEN RAISE EXCEPTION 'inquiry classification conflict' USING ERRCODE='PT409';END IF;
 IF oldrow.deal_id IS NOT NULL OR oldrow.opportunity_id IS NOT NULL
  OR EXISTS(SELECT 1 FROM public.deals d WHERE d.origin_inquiry_id=p_inquiry_id)
 THEN RAISE EXCEPTION 'linked technical inquiry cannot be reclassified' USING ERRCODE='PT409';END IF;
 server_at:=clock_timestamp();
 UPDATE public.inquiries SET brand=target_brand,updated_at=server_at WHERE id=p_inquiry_id RETURNING * INTO newrow;
 INSERT INTO crm_security.inquiry_audit_events(actor_auth_uid,actor_user_id,inquiry_id,action,before_data,after_data,reason,created_at)
 VALUES(a.auth_uid,a.user_id,p_inquiry_id,'inquiry_reclassify',
  jsonb_build_object('brand',oldrow.brand,'review_status',NULL),
  jsonb_build_object('brand',newrow.brand,'review_status','reclassified','reviewed_at',server_at,'reviewed_by',a.display_name),
  '기존 기술자문 문의 → '||target_brand,server_at) RETURNING event_id INTO audit_id;
 ack:=jsonb_build_object('contract_version',1,'ok',true,'request_id',p_request_id,'operation','inquiry_reclassify',
  'object_id',p_inquiry_id,'actor_auth_uid',a.auth_uid,'actor_user_id',a.user_id,'from_brand','기술자문',
  'to_brand',target_brand,'review_status','reclassified','reviewed_at',server_at,'reviewed_by',a.display_name,
  'inquiry_audit_event_id',audit_id,'replayed',false);
 INSERT INTO crm_security.command_receipts(actor_auth_uid,request_id,actor_user_id,operation,object_id,expected_version,payload,ack)
 VALUES(a.auth_uid,p_request_id,a.user_id,'inquiry_reclassify',p_inquiry_id,0,canonical,ack);
 RETURN ack;
END $fn$;
REVOKE EXECUTE ON FUNCTION crm_security.crm_inquiry_reclassify_command_v1(uuid,uuid,jsonb) FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION crm_security.crm_operational_source_fragment_v1(
 p_domain text,p_after uuid,p_limit integer
) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $fn$
DECLARE raw_items jsonb; items jsonb; next_cursor uuid; has_more boolean; a record;
BEGIN
 SELECT * INTO a FROM crm_security.actor();
 IF NOT FOUND THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;
 IF p_domain NOT IN ('deal_core','inquiry_core')
 THEN RAISE EXCEPTION 'unsupported operational source domain' USING ERRCODE='22023'; END IF;
 IF p_limit IS NULL OR p_limit<1 OR p_limit>100
 THEN RAISE EXCEPTION 'invalid limit' USING ERRCODE='22023'; END IF;

 IF p_domain='deal_core' THEN
  SELECT coalesce(jsonb_agg(to_jsonb(q) ORDER BY q.id),'[]'::jsonb) INTO raw_items FROM(
   SELECT d.id,d.site_id,
    coalesce(s.site_name,o.name,nullif(d.list_fields->>'site_name',''),nullif(d.list_fields->>'name','')) AS site_name,
    coalesce(s.site_name,o.name,nullif(d.list_fields->>'site_name',''),nullif(d.list_fields->>'name','')) AS site,
    d.owner_id,coalesce(u.name,d.assignee_name) AS owner_name,coalesce(u.name,d.assignee_name) AS assignee,
    d.stage_code,d.stage_raw,d.stage_group,d.brand,d.list_name,
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
    coalesce((SELECT jsonb_agg(jsonb_build_object('id',ac.id,'type',ac.type,'occurred_at',ac.occurred_at) ORDER BY ac.occurred_at,ac.id)
     FROM public.activities ac WHERE ac.deal_id=d.id),'[]'::jsonb) AS activity_signals
   FROM public.deals d
   LEFT JOIN public.sites s ON s.site_id=d.site_id
   LEFT JOIN public.organizations o ON o.id=d.organization_id
   LEFT JOIN public.users u ON u.user_id=d.owner_id
   LEFT JOIN public.contacts c ON c.id=d.contact_id
   LEFT JOIN crm_security.user_opportunity_state ps ON ps.actor_user_id=a.user_id AND ps.deal_id=d.id
   WHERE crm_security.can_deal(d.id,false) AND (p_after IS NULL OR d.id>p_after)
   ORDER BY d.id LIMIT p_limit+1
  )q;
 ELSE
  SELECT coalesce(jsonb_agg(to_jsonb(q) ORDER BY q.id),'[]'::jsonb) INTO raw_items FROM(
   SELECT i.id,i.site_id,i.site_name,i.brand,i.inquiry_type,i.work_type,i.source_channel,i.channel,
    i.assigned_to,coalesce(u.name,i.assignee_name) AS assignee_name,ar.permission_role AS assignee_permission_role,
    i.status,i.deal_id,i.opportunity_id,i.received_at,i.created_at,i.updated_at,i.assigned_at,
    i.first_response_at,i.responded_at,i.next_action_date,i.contact_name,i.phone,
    (SELECT e.after_data->>'review_status' FROM crm_security.inquiry_audit_events e WHERE e.inquiry_id=i.id AND e.action='inquiry_reclassify' ORDER BY e.created_at DESC,e.event_id DESC LIMIT 1) AS legacy_review_status,
    (SELECT e.after_data->>'reviewed_at' FROM crm_security.inquiry_audit_events e WHERE e.inquiry_id=i.id AND e.action='inquiry_reclassify' ORDER BY e.created_at DESC,e.event_id DESC LIMIT 1) AS legacy_reviewed_at,
    (SELECT e.after_data->>'reviewed_by' FROM crm_security.inquiry_audit_events e WHERE e.inquiry_id=i.id AND e.action='inquiry_reclassify' ORDER BY e.created_at DESC,e.event_id DESC LIMIT 1) AS legacy_reviewed_by,
    coalesce((SELECT jsonb_agg(jsonb_build_object('id',e.event_id,'type','데이터정리','note',coalesce(e.before_data->>'brand','기술자문')||' → '||coalesce(e.after_data->>'brand',''),'result','정상 견적문의로 재분류','at',e.created_at,'actor',e.after_data->>'reviewed_by') ORDER BY e.created_at,e.event_id) FROM crm_security.inquiry_audit_events e WHERE e.inquiry_id=i.id AND e.action='inquiry_reclassify'),'[]'::jsonb) AS activities
   FROM public.inquiries i
   LEFT JOIN public.users u ON u.user_id=i.assigned_to
   LEFT JOIN crm_security.access_review ar ON ar.user_id=i.assigned_to AND ar.approved AND ar.expires_at>now()
   WHERE crm_security.can_inquiry(i.id) AND (p_after IS NULL OR i.id>p_after)
   ORDER BY i.id LIMIT p_limit+1
  )q;
 END IF;

 has_more:=jsonb_array_length(raw_items)>p_limit;
 items:=CASE WHEN has_more THEN raw_items-p_limit ELSE raw_items END;
 next_cursor:=CASE WHEN has_more AND jsonb_array_length(items)>0
  THEN (items->(jsonb_array_length(items)-1)->>'id')::uuid ELSE NULL END;
 RETURN jsonb_build_object(
  'contract_version',1,'resource','operational_source','domain',p_domain,
  'scope_completeness','actor_authorized_rows_only',
  'actor_user_id',a.user_id,'actor_permission_role',a.permission_role,
  'items',items,'pagination',jsonb_build_object(
   'completeness',CASE WHEN has_more THEN 'partial' ELSE 'complete' END,
   'has_more',has_more,'next_cursor',next_cursor));
END $fn$;


REVOKE EXECUTE ON FUNCTION crm_security.crm_operational_source_fragment_v1(text,uuid,integer) FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION public.crm_write_command_v2(p_request_id uuid,p_operation text,p_object_id uuid,p_expected_version integer,p_payload jsonb) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $fn$ BEGIN IF p_operation='inquiry_reclassify' THEN IF p_expected_version IS DISTINCT FROM 0 THEN RAISE EXCEPTION 'invalid inquiry reclassify version sentinel' USING ERRCODE='22023';END IF;RETURN crm_security.crm_inquiry_reclassify_command_v1(p_request_id,p_object_id,p_payload);END IF;RETURN crm_security.crm_write_command_v2_waiting_context_20260906(p_request_id,p_operation,p_object_id,p_expected_version,p_payload);END $fn$;
REVOKE EXECUTE ON FUNCTION public.crm_write_command_v2(uuid,text,uuid,integer,jsonb) FROM PUBLIC,anon,authenticated,service_role;GRANT EXECUTE ON FUNCTION public.crm_write_command_v2(uuid,text,uuid,integer,jsonb) TO authenticated;
DO $post$ DECLARE changed integer;BEGIN SELECT count(*) INTO changed FROM inquiry_reclassify_source_guard g JOIN pg_proc p ON p.oid=g.oid WHERE p.prosrc IS DISTINCT FROM g.prosrc OR p.proconfig IS DISTINCT FROM g.proconfig OR coalesce(p.proacl::text,'') IS DISTINCT FROM g.acl;IF changed<>0 OR has_function_privilege('anon','public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)','EXECUTE') OR NOT has_function_privilege('authenticated','public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)','EXECUTE') OR has_function_privilege('service_role','public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)','EXECUTE') OR has_function_privilege('authenticated','crm_security.crm_inquiry_reclassify_command_v1(uuid,uuid,jsonb)','EXECUTE') OR (SELECT pg_get_constraintdef(oid,true) FROM pg_constraint WHERE conrelid='crm_security.command_receipts'::regclass AND conname='command_receipts_operation_check') IS DISTINCT FROM $expected$CHECK (operation = ANY (ARRAY['opportunity_work_set'::text, 'inquiry_assign'::text, 'service_change'::text, 'inquiry_unassign'::text, 'favorite_set'::text, 'opportunity_touch'::text, 'next_action'::text, 'activity'::text, 'quote_version'::text, 'next_action_complete'::text, 'stage_check'::text, 'transition'::text, 'close'::text, 'amount'::text, 'waiting_context'::text, 'inquiry_reclassify'::text]))$expected$ OR (SELECT pg_get_constraintdef(oid,true) FROM pg_constraint WHERE conrelid='crm_security.inquiry_audit_events'::regclass AND conname='inquiry_audit_events_action_check') IS DISTINCT FROM $expected$CHECK (action = ANY (ARRAY['direct_assign'::text, 'direct_reassign'::text, 'inquiry_unassign'::text, 'inquiry_reclassify'::text]))$expected$ THEN RAISE EXCEPTION 'inquiry reclassify post-apply drift';END IF;END $post$;
-- ===== APPLY inquiry_hold =====
SET LOCAL crm.inquiry_hold_ref='rprechiaglyjaydkmxsu';
SET LOCAL crm.inquiry_hold_ref='rprechiaglyjaydkmxsu';
SET LOCAL search_path=pg_catalog;SET LOCAL lock_timeout='3s';SET LOCAL statement_timeout='60s';
DO $guard$ BEGIN IF current_user<>'postgres' OR current_setting('crm.inquiry_hold_ref',true) IS DISTINCT FROM 'rprechiaglyjaydkmxsu' OR to_regprocedure('public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)') IS NULL OR to_regprocedure('crm_security.crm_inquiry_reclassify_command_v1(uuid,uuid,jsonb)') IS NULL OR to_regprocedure('crm_security.crm_operational_source_fragment_v1(text,uuid,integer)') IS NULL OR to_regprocedure('crm_security.crm_write_command_v2_inquiry_reclassify_20260906(uuid,text,uuid,integer,jsonb)') IS NOT NULL OR to_regprocedure('crm_security.crm_operational_source_fragment_pre_inquiry_hold_20260906(text,uuid,integer)') IS NOT NULL OR to_regprocedure('crm_security.crm_inquiry_hold_command_v1(uuid,uuid,jsonb)') IS NOT NULL OR (SELECT pg_get_constraintdef(oid,true) FROM pg_constraint WHERE conrelid='crm_security.command_receipts'::regclass AND conname='command_receipts_operation_check') IS DISTINCT FROM $expected$CHECK (operation = ANY (ARRAY['opportunity_work_set'::text, 'inquiry_assign'::text, 'service_change'::text, 'inquiry_unassign'::text, 'favorite_set'::text, 'opportunity_touch'::text, 'next_action'::text, 'activity'::text, 'quote_version'::text, 'next_action_complete'::text, 'stage_check'::text, 'transition'::text, 'close'::text, 'amount'::text, 'waiting_context'::text, 'inquiry_reclassify'::text]))$expected$ OR (SELECT pg_get_constraintdef(oid,true) FROM pg_constraint WHERE conrelid='crm_security.inquiry_audit_events'::regclass AND conname='inquiry_audit_events_action_check') IS DISTINCT FROM $expected$CHECK (action = ANY (ARRAY['direct_assign'::text, 'direct_reassign'::text, 'inquiry_unassign'::text, 'inquiry_reclassify'::text]))$expected$ THEN RAISE EXCEPTION 'inquiry hold after-reclassify prerequisite drift';END IF;END $guard$;
CREATE TEMP TABLE inquiry_hold_source_guard AS SELECT p.oid,p.prosrc,p.proconfig,coalesce(p.proacl::text,'') acl FROM pg_proc p WHERE p.oid='public.crm_operational_source_v1(text,uuid,integer)'::regprocedure;
ALTER FUNCTION public.crm_write_command_v2(uuid,text,uuid,integer,jsonb) RENAME TO crm_write_command_v2_inquiry_reclassify_20260906;ALTER FUNCTION public.crm_write_command_v2_inquiry_reclassify_20260906(uuid,text,uuid,integer,jsonb) SET SCHEMA crm_security;REVOKE EXECUTE ON FUNCTION crm_security.crm_write_command_v2_inquiry_reclassify_20260906(uuid,text,uuid,integer,jsonb) FROM PUBLIC,anon,authenticated,service_role;
ALTER FUNCTION crm_security.crm_operational_source_fragment_v1(text,uuid,integer) RENAME TO crm_operational_source_fragment_pre_inquiry_hold_20260906;REVOKE EXECUTE ON FUNCTION crm_security.crm_operational_source_fragment_pre_inquiry_hold_20260906(text,uuid,integer) FROM PUBLIC,anon,authenticated,service_role;
ALTER TABLE crm_security.command_receipts DROP CONSTRAINT command_receipts_operation_check;ALTER TABLE crm_security.command_receipts ADD CONSTRAINT command_receipts_operation_check CHECK(operation IN ('opportunity_work_set','inquiry_assign','service_change','inquiry_unassign','favorite_set','opportunity_touch','next_action','activity','quote_version','next_action_complete','stage_check','transition','close','amount','waiting_context','inquiry_reclassify','inquiry_status'));
ALTER TABLE crm_security.inquiry_audit_events DROP CONSTRAINT inquiry_audit_events_action_check;ALTER TABLE crm_security.inquiry_audit_events ADD CONSTRAINT inquiry_audit_events_action_check CHECK(action IN ('direct_assign','direct_reassign','inquiry_unassign','inquiry_reclassify','inquiry_hold'));
CREATE FUNCTION crm_security.crm_inquiry_hold_command_v1(
 p_request_id uuid,p_inquiry_id uuid,p_payload jsonb
) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $fn$
DECLARE a record;receipt crm_security.command_receipts%ROWTYPE;oldrow public.inquiries%ROWTYPE;newrow public.inquiries%ROWTYPE;
 canonical jsonb;ack jsonb;audit_id uuid;hold_reason text;server_at timestamptz;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501';END IF;
 PERFORM 1 FROM public.users u WHERE u.auth_uid=auth.uid() FOR SHARE;
 PERFORM 1 FROM crm_security.access_review r WHERE r.reviewed_auth_uid=auth.uid() FOR SHARE;
 SELECT * INTO a FROM crm_security.actor();IF NOT FOUND THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501';END IF;
 IF p_request_id IS NULL OR p_inquiry_id IS NULL OR jsonb_typeof(p_payload) IS DISTINCT FROM 'object'
  OR EXISTS(SELECT 1 FROM jsonb_object_keys(p_payload) k WHERE k NOT IN ('intent','reason'))
  OR p_payload->>'intent' IS DISTINCT FROM 'hold' OR jsonb_typeof(p_payload->'reason') IS DISTINCT FROM 'string'
  OR length(trim(p_payload->>'reason'))<1 OR length(p_payload->>'reason')>2000
 THEN RAISE EXCEPTION 'invalid inquiry hold payload; current status, actor and time are server-owned' USING ERRCODE='22023';END IF;
 hold_reason:=trim(p_payload->>'reason');canonical:=jsonb_build_object('intent','hold','reason',hold_reason);
 PERFORM 1 FROM crm_security.object_scope s WHERE s.user_id=a.user_id AND s.inquiry_id=p_inquiry_id FOR SHARE;
 SELECT * INTO oldrow FROM public.inquiries i WHERE i.id=p_inquiry_id FOR UPDATE;
 IF NOT FOUND OR a.permission_role<>'admin' OR NOT crm_security.can_inquiry(p_inquiry_id)
 THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501';END IF;
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(a.auth_uid::text||p_request_id::text,0));
 SELECT * INTO receipt FROM crm_security.command_receipts r WHERE r.actor_auth_uid=a.auth_uid AND r.request_id=p_request_id;
 IF FOUND THEN
  IF receipt.actor_user_id IS DISTINCT FROM a.user_id OR receipt.operation IS DISTINCT FROM 'inquiry_status'
   OR receipt.object_id IS DISTINCT FROM p_inquiry_id OR receipt.expected_version IS DISTINCT FROM 0
   OR receipt.payload IS DISTINCT FROM canonical
  THEN RAISE EXCEPTION 'REQUEST_ID_REUSE' USING ERRCODE='PT409';END IF;
  RETURN receipt.ack||jsonb_build_object('replayed',true);
 END IF;
 IF oldrow.status IS NOT DISTINCT FROM '보류' THEN RAISE EXCEPTION 'inquiry already held' USING ERRCODE='PT409';END IF;
 server_at:=clock_timestamp();
 UPDATE public.inquiries SET status='보류',updated_at=server_at WHERE id=p_inquiry_id RETURNING * INTO newrow;
 INSERT INTO crm_security.inquiry_audit_events(actor_auth_uid,actor_user_id,inquiry_id,action,before_data,after_data,reason,created_at)
 VALUES(a.auth_uid,a.user_id,p_inquiry_id,'inquiry_hold',
  jsonb_build_object('status',oldrow.status),
  jsonb_build_object('status',newrow.status,'hold_reason',hold_reason,'held_at',server_at,'held_by',a.display_name),
  hold_reason,server_at) RETURNING event_id INTO audit_id;
 ack:=jsonb_build_object('contract_version',1,'ok',true,'request_id',p_request_id,'operation','inquiry_status',
  'object_id',p_inquiry_id,'intent','hold','actor_auth_uid',a.auth_uid,'actor_user_id',a.user_id,
  'from_status',coalesce(oldrow.status,''),'to_status','보류','hold_reason',hold_reason,'held_at',server_at,
  'held_by',a.display_name,'inquiry_audit_event_id',audit_id,'replayed',false);
 INSERT INTO crm_security.command_receipts(actor_auth_uid,request_id,actor_user_id,operation,object_id,expected_version,payload,ack)
 VALUES(a.auth_uid,p_request_id,a.user_id,'inquiry_status',p_inquiry_id,0,canonical,ack);
 RETURN ack;
END $fn$;
REVOKE EXECUTE ON FUNCTION crm_security.crm_inquiry_hold_command_v1(uuid,uuid,jsonb) FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION crm_security.crm_operational_source_fragment_v1(
 p_domain text,p_after uuid,p_limit integer
) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $fn$
DECLARE raw_items jsonb; items jsonb; next_cursor uuid; has_more boolean; a record;
BEGIN
 SELECT * INTO a FROM crm_security.actor();
 IF NOT FOUND THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;
 IF p_domain NOT IN ('deal_core','inquiry_core')
 THEN RAISE EXCEPTION 'unsupported operational source domain' USING ERRCODE='22023'; END IF;
 IF p_limit IS NULL OR p_limit<1 OR p_limit>100
 THEN RAISE EXCEPTION 'invalid limit' USING ERRCODE='22023'; END IF;

 IF p_domain='deal_core' THEN
  SELECT coalesce(jsonb_agg(to_jsonb(q) ORDER BY q.id),'[]'::jsonb) INTO raw_items FROM(
   SELECT d.id,d.site_id,
    coalesce(s.site_name,o.name,nullif(d.list_fields->>'site_name',''),nullif(d.list_fields->>'name','')) AS site_name,
    coalesce(s.site_name,o.name,nullif(d.list_fields->>'site_name',''),nullif(d.list_fields->>'name','')) AS site,
    d.owner_id,coalesce(u.name,d.assignee_name) AS owner_name,coalesce(u.name,d.assignee_name) AS assignee,
    d.stage_code,d.stage_raw,d.stage_group,d.brand,d.list_name,
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
    coalesce((SELECT jsonb_agg(jsonb_build_object('id',ac.id,'type',ac.type,'occurred_at',ac.occurred_at) ORDER BY ac.occurred_at,ac.id)
     FROM public.activities ac WHERE ac.deal_id=d.id),'[]'::jsonb) AS activity_signals
   FROM public.deals d
   LEFT JOIN public.sites s ON s.site_id=d.site_id
   LEFT JOIN public.organizations o ON o.id=d.organization_id
   LEFT JOIN public.users u ON u.user_id=d.owner_id
   LEFT JOIN public.contacts c ON c.id=d.contact_id
   LEFT JOIN crm_security.user_opportunity_state ps ON ps.actor_user_id=a.user_id AND ps.deal_id=d.id
   WHERE crm_security.can_deal(d.id,false) AND (p_after IS NULL OR d.id>p_after)
   ORDER BY d.id LIMIT p_limit+1
  )q;
 ELSE
  SELECT coalesce(jsonb_agg(to_jsonb(q) ORDER BY q.id),'[]'::jsonb) INTO raw_items FROM(
   SELECT i.id,i.site_id,i.site_name,i.brand,i.inquiry_type,i.work_type,i.source_channel,i.channel,
    i.assigned_to,coalesce(u.name,i.assignee_name) AS assignee_name,ar.permission_role AS assignee_permission_role,
    i.status,i.deal_id,i.opportunity_id,i.received_at,i.created_at,i.updated_at,i.assigned_at,
    i.first_response_at,i.responded_at,i.next_action_date,i.contact_name,i.phone,
    (SELECT e.after_data->>'review_status' FROM crm_security.inquiry_audit_events e WHERE e.inquiry_id=i.id AND e.action='inquiry_reclassify' ORDER BY e.created_at DESC,e.event_id DESC LIMIT 1) AS legacy_review_status,
    (SELECT e.after_data->>'reviewed_at' FROM crm_security.inquiry_audit_events e WHERE e.inquiry_id=i.id AND e.action='inquiry_reclassify' ORDER BY e.created_at DESC,e.event_id DESC LIMIT 1) AS legacy_reviewed_at,
    (SELECT e.after_data->>'reviewed_by' FROM crm_security.inquiry_audit_events e WHERE e.inquiry_id=i.id AND e.action='inquiry_reclassify' ORDER BY e.created_at DESC,e.event_id DESC LIMIT 1) AS legacy_reviewed_by,
    (SELECT e.after_data->>'hold_reason' FROM crm_security.inquiry_audit_events e WHERE e.inquiry_id=i.id AND e.action='inquiry_hold' ORDER BY e.created_at DESC,e.event_id DESC LIMIT 1) AS hold_reason,
    (SELECT e.created_at FROM crm_security.inquiry_audit_events e WHERE e.inquiry_id=i.id AND e.action='inquiry_hold' ORDER BY e.created_at DESC,e.event_id DESC LIMIT 1) AS held_at,
    (SELECT e.after_data->>'held_by' FROM crm_security.inquiry_audit_events e WHERE e.inquiry_id=i.id AND e.action='inquiry_hold' ORDER BY e.created_at DESC,e.event_id DESC LIMIT 1) AS held_by,
    coalesce((SELECT jsonb_agg(jsonb_build_object('id',e.event_id,'type','데이터정리','note',coalesce(e.before_data->>'brand','기술자문')||' → '||coalesce(e.after_data->>'brand',''),'result','정상 견적문의로 재분류','at',e.created_at,'actor',e.after_data->>'reviewed_by') ORDER BY e.created_at,e.event_id) FROM crm_security.inquiry_audit_events e WHERE e.inquiry_id=i.id AND e.action='inquiry_reclassify'),'[]'::jsonb)
    ||coalesce((SELECT jsonb_agg(jsonb_build_object('id',e.event_id,'type','상태변경','note','보류','result',e.reason,'at',e.created_at,'actor',e.after_data->>'held_by') ORDER BY e.created_at,e.event_id) FROM crm_security.inquiry_audit_events e WHERE e.inquiry_id=i.id AND e.action='inquiry_hold'),'[]'::jsonb) AS activities
   FROM public.inquiries i
   LEFT JOIN public.users u ON u.user_id=i.assigned_to
   LEFT JOIN crm_security.access_review ar ON ar.user_id=i.assigned_to AND ar.approved AND ar.expires_at>now()
   WHERE crm_security.can_inquiry(i.id) AND (p_after IS NULL OR i.id>p_after)
   ORDER BY i.id LIMIT p_limit+1
  )q;
 END IF;

 has_more:=jsonb_array_length(raw_items)>p_limit;
 items:=CASE WHEN has_more THEN raw_items-p_limit ELSE raw_items END;
 next_cursor:=CASE WHEN has_more AND jsonb_array_length(items)>0
  THEN (items->(jsonb_array_length(items)-1)->>'id')::uuid ELSE NULL END;
 RETURN jsonb_build_object(
  'contract_version',1,'resource','operational_source','domain',p_domain,
  'scope_completeness','actor_authorized_rows_only',
  'actor_user_id',a.user_id,'actor_permission_role',a.permission_role,
  'items',items,'pagination',jsonb_build_object(
   'completeness',CASE WHEN has_more THEN 'partial' ELSE 'complete' END,
   'has_more',has_more,'next_cursor',next_cursor));
END $fn$;


REVOKE EXECUTE ON FUNCTION crm_security.crm_operational_source_fragment_v1(text,uuid,integer) FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION public.crm_write_command_v2(p_request_id uuid,p_operation text,p_object_id uuid,p_expected_version integer,p_payload jsonb) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $fn$ BEGIN IF p_operation='inquiry_status' THEN IF p_expected_version IS DISTINCT FROM 0 THEN RAISE EXCEPTION 'invalid inquiry status version sentinel' USING ERRCODE='22023';END IF;RETURN crm_security.crm_inquiry_hold_command_v1(p_request_id,p_object_id,p_payload);END IF;RETURN crm_security.crm_write_command_v2_inquiry_reclassify_20260906(p_request_id,p_operation,p_object_id,p_expected_version,p_payload);END $fn$;
REVOKE EXECUTE ON FUNCTION public.crm_write_command_v2(uuid,text,uuid,integer,jsonb) FROM PUBLIC,anon,authenticated,service_role;GRANT EXECUTE ON FUNCTION public.crm_write_command_v2(uuid,text,uuid,integer,jsonb) TO authenticated;
DO $post$ DECLARE changed integer;BEGIN SELECT count(*) INTO changed FROM inquiry_hold_source_guard g JOIN pg_proc p ON p.oid=g.oid WHERE p.prosrc IS DISTINCT FROM g.prosrc OR p.proconfig IS DISTINCT FROM g.proconfig OR coalesce(p.proacl::text,'') IS DISTINCT FROM g.acl;IF changed<>0 OR has_function_privilege('anon','public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)','EXECUTE') OR NOT has_function_privilege('authenticated','public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)','EXECUTE') OR has_function_privilege('service_role','public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)','EXECUTE') OR has_function_privilege('authenticated','crm_security.crm_inquiry_hold_command_v1(uuid,uuid,jsonb)','EXECUTE') OR (SELECT pg_get_constraintdef(oid,true) FROM pg_constraint WHERE conrelid='crm_security.command_receipts'::regclass AND conname='command_receipts_operation_check') IS DISTINCT FROM $expected$CHECK (operation = ANY (ARRAY['opportunity_work_set'::text, 'inquiry_assign'::text, 'service_change'::text, 'inquiry_unassign'::text, 'favorite_set'::text, 'opportunity_touch'::text, 'next_action'::text, 'activity'::text, 'quote_version'::text, 'next_action_complete'::text, 'stage_check'::text, 'transition'::text, 'close'::text, 'amount'::text, 'waiting_context'::text, 'inquiry_reclassify'::text, 'inquiry_status'::text]))$expected$ OR (SELECT pg_get_constraintdef(oid,true) FROM pg_constraint WHERE conrelid='crm_security.inquiry_audit_events'::regclass AND conname='inquiry_audit_events_action_check') IS DISTINCT FROM $expected$CHECK (action = ANY (ARRAY['direct_assign'::text, 'direct_reassign'::text, 'inquiry_unassign'::text, 'inquiry_reclassify'::text, 'inquiry_hold'::text]))$expected$ THEN RAISE EXCEPTION 'inquiry hold post-apply drift';END IF;END $post$;
-- ===== APPLY inquiry_trash_restore =====
SET LOCAL crm.inquiry_trash_restore_ref='rprechiaglyjaydkmxsu';
SET LOCAL crm.inquiry_trash_restore_ref='rprechiaglyjaydkmxsu';
SET LOCAL search_path=pg_catalog;SET LOCAL lock_timeout='3s';SET LOCAL statement_timeout='60s';
DO $guard$ BEGIN IF current_user<>'postgres' OR current_setting('crm.inquiry_trash_restore_ref',true) IS DISTINCT FROM 'rprechiaglyjaydkmxsu' OR to_regprocedure('public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)') IS NULL OR to_regprocedure('crm_security.crm_inquiry_hold_command_v1(uuid,uuid,jsonb)') IS NULL OR to_regprocedure('crm_security.crm_operational_source_fragment_v1(text,uuid,integer)') IS NULL OR to_regprocedure('crm_security.crm_write_command_v2_inquiry_hold_20260906(uuid,text,uuid,integer,jsonb)') IS NOT NULL OR to_regprocedure('crm_security.crm_operational_source_fragment_pre_inquiry_trash_restore_20260906(text,uuid,integer)') IS NOT NULL OR to_regprocedure('crm_security.crm_inquiry_trash_command_v1(uuid,uuid,jsonb)') IS NOT NULL OR to_regprocedure('crm_security.crm_inquiry_restore_command_v1(uuid,uuid,jsonb)') IS NOT NULL OR (SELECT pg_get_constraintdef(oid,true) FROM pg_constraint WHERE conrelid='crm_security.command_receipts'::regclass AND conname='command_receipts_operation_check') IS DISTINCT FROM $expected$CHECK (operation = ANY (ARRAY['opportunity_work_set'::text, 'inquiry_assign'::text, 'service_change'::text, 'inquiry_unassign'::text, 'favorite_set'::text, 'opportunity_touch'::text, 'next_action'::text, 'activity'::text, 'quote_version'::text, 'next_action_complete'::text, 'stage_check'::text, 'transition'::text, 'close'::text, 'amount'::text, 'waiting_context'::text, 'inquiry_reclassify'::text, 'inquiry_status'::text]))$expected$ OR (SELECT pg_get_constraintdef(oid,true) FROM pg_constraint WHERE conrelid='crm_security.inquiry_audit_events'::regclass AND conname='inquiry_audit_events_action_check') IS DISTINCT FROM $expected$CHECK (action = ANY (ARRAY['direct_assign'::text, 'direct_reassign'::text, 'inquiry_unassign'::text, 'inquiry_reclassify'::text, 'inquiry_hold'::text]))$expected$ THEN RAISE EXCEPTION 'inquiry trash/restore after-hold prerequisite drift';END IF;END $guard$;
CREATE TEMP TABLE inquiry_trash_restore_source_guard AS SELECT p.oid,p.prosrc,p.proconfig,coalesce(p.proacl::text,'') acl FROM pg_proc p WHERE p.oid='public.crm_operational_source_v1(text,uuid,integer)'::regprocedure;
ALTER FUNCTION public.crm_write_command_v2(uuid,text,uuid,integer,jsonb) RENAME TO crm_write_command_v2_inquiry_hold_20260906;ALTER FUNCTION public.crm_write_command_v2_inquiry_hold_20260906(uuid,text,uuid,integer,jsonb) SET SCHEMA crm_security;REVOKE EXECUTE ON FUNCTION crm_security.crm_write_command_v2_inquiry_hold_20260906(uuid,text,uuid,integer,jsonb) FROM PUBLIC,anon,authenticated,service_role;
ALTER FUNCTION crm_security.crm_operational_source_fragment_v1(text,uuid,integer) RENAME TO crm_operational_source_fragment_pre_inquiry_trash_restore_20260906;REVOKE EXECUTE ON FUNCTION crm_security.crm_operational_source_fragment_pre_inquiry_trash_restore_20260906(text,uuid,integer) FROM PUBLIC,anon,authenticated,service_role;
ALTER TABLE crm_security.command_receipts DROP CONSTRAINT command_receipts_operation_check;ALTER TABLE crm_security.command_receipts ADD CONSTRAINT command_receipts_operation_check CHECK(operation IN ('opportunity_work_set','inquiry_assign','service_change','inquiry_unassign','favorite_set','opportunity_touch','next_action','activity','quote_version','next_action_complete','stage_check','transition','close','amount','waiting_context','inquiry_reclassify','inquiry_status','inquiry_trash','inquiry_restore'));
ALTER TABLE crm_security.inquiry_audit_events DROP CONSTRAINT inquiry_audit_events_action_check;ALTER TABLE crm_security.inquiry_audit_events ADD CONSTRAINT inquiry_audit_events_action_check CHECK(action IN ('direct_assign','direct_reassign','inquiry_unassign','inquiry_reclassify','inquiry_hold','inquiry_trash','inquiry_restore'));
CREATE FUNCTION crm_security.crm_inquiry_trash_command_v1(
 p_request_id uuid,p_inquiry_id uuid,p_payload jsonb
) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $fn$
DECLARE a record;receipt crm_security.command_receipts%ROWTYPE;oldrow public.inquiries%ROWTYPE;latest_action text;
 canonical jsonb;ack jsonb;audit_id uuid;server_at timestamptz;reason_value text;note_value text;protected_value boolean;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501';END IF;
 PERFORM 1 FROM public.users u WHERE u.auth_uid=auth.uid() FOR SHARE;PERFORM 1 FROM crm_security.access_review r WHERE r.reviewed_auth_uid=auth.uid() FOR SHARE;
 SELECT * INTO a FROM crm_security.actor();IF NOT FOUND THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501';END IF;
 IF p_request_id IS NULL OR p_inquiry_id IS NULL OR jsonb_typeof(p_payload) IS DISTINCT FROM 'object'
  OR EXISTS(SELECT 1 FROM jsonb_object_keys(p_payload) k WHERE k NOT IN ('delete_reason','delete_note'))
  OR NOT p_payload ? 'delete_reason' OR jsonb_typeof(p_payload->'delete_reason') IS DISTINCT FROM 'string'
  OR p_payload->>'delete_reason' NOT IN ('중복 문의','테스트 문의','스팸','잘못된 연락처','관련 없는 문의','기타')
  OR (p_payload ? 'delete_note' AND jsonb_typeof(p_payload->'delete_note') NOT IN ('string','null')) OR length(coalesce(p_payload->>'delete_note',''))>2000
 THEN RAISE EXCEPTION 'invalid inquiry trash payload; actor, time, purge and protection are server-owned' USING ERRCODE='22023';END IF;
 reason_value:=p_payload->>'delete_reason';note_value:=nullif(trim(p_payload->>'delete_note'),'');canonical:=jsonb_build_object('delete_reason',reason_value,'delete_note',note_value);
 PERFORM 1 FROM crm_security.object_scope s WHERE s.user_id=a.user_id AND s.inquiry_id=p_inquiry_id FOR SHARE;
 SELECT * INTO oldrow FROM public.inquiries i WHERE i.id=p_inquiry_id FOR UPDATE;
 IF NOT FOUND OR a.permission_role<>'admin' OR NOT crm_security.can_inquiry(p_inquiry_id) THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501';END IF;
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(a.auth_uid::text||p_request_id::text,0));
 SELECT * INTO receipt FROM crm_security.command_receipts r WHERE r.actor_auth_uid=a.auth_uid AND r.request_id=p_request_id;
 IF FOUND THEN IF receipt.actor_user_id IS DISTINCT FROM a.user_id OR receipt.operation IS DISTINCT FROM 'inquiry_trash' OR receipt.object_id IS DISTINCT FROM p_inquiry_id OR receipt.expected_version IS DISTINCT FROM 0 OR receipt.payload IS DISTINCT FROM canonical THEN RAISE EXCEPTION 'REQUEST_ID_REUSE' USING ERRCODE='PT409';END IF;RETURN receipt.ack||jsonb_build_object('replayed',true);END IF;
 SELECT e.action INTO latest_action FROM crm_security.inquiry_audit_events e WHERE e.inquiry_id=p_inquiry_id AND e.action IN ('inquiry_trash','inquiry_restore') ORDER BY e.created_at DESC,e.event_id DESC LIMIT 1;
 IF latest_action='inquiry_trash' THEN RAISE EXCEPTION 'inquiry already trashed' USING ERRCODE='PT409';END IF;
 protected_value:=oldrow.deal_id IS NOT NULL OR oldrow.opportunity_id IS NOT NULL OR EXISTS(SELECT 1 FROM public.deals d WHERE d.origin_inquiry_id=p_inquiry_id);
 server_at:=clock_timestamp();
 INSERT INTO crm_security.inquiry_audit_events(actor_auth_uid,actor_user_id,inquiry_id,action,before_data,after_data,reason,created_at)
 VALUES(a.auth_uid,a.user_id,p_inquiry_id,'inquiry_trash',
  jsonb_build_object('status',oldrow.status,'assigned_to',oldrow.assigned_to,'assigned_at',oldrow.assigned_at,'valid_inquiry',true),
  jsonb_build_object('valid_inquiry',false,'deleted_at',server_at,'deleted_by',a.display_name,'delete_reason',reason_value,'delete_note',note_value,'purge_at',server_at+interval '30 days','archive_protected',protected_value,'archive_reason',CASE WHEN protected_value THEN 'linked_opportunity' ELSE NULL END,'trash_snapshot',jsonb_build_object('status',oldrow.status,'assigned_to',oldrow.assigned_to,'assigned_at',oldrow.assigned_at)),
  reason_value,server_at) RETURNING event_id INTO audit_id;
 ack:=jsonb_build_object('contract_version',1,'ok',true,'request_id',p_request_id,'operation','inquiry_trash','object_id',p_inquiry_id,'actor_auth_uid',a.auth_uid,'actor_user_id',a.user_id,'valid_inquiry',false,'deleted_at',server_at,'deleted_by',a.display_name,'delete_reason',reason_value,'delete_note',note_value,'purge_at',server_at+interval '30 days','archive_protected',protected_value,'archive_reason',CASE WHEN protected_value THEN 'linked_opportunity' ELSE NULL END,'inquiry_audit_event_id',audit_id,'replayed',false);
 INSERT INTO crm_security.command_receipts(actor_auth_uid,request_id,actor_user_id,operation,object_id,expected_version,payload,ack) VALUES(a.auth_uid,p_request_id,a.user_id,'inquiry_trash',p_inquiry_id,0,canonical,ack);RETURN ack;
END $fn$;
REVOKE EXECUTE ON FUNCTION crm_security.crm_inquiry_trash_command_v1(uuid,uuid,jsonb) FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION crm_security.crm_inquiry_restore_command_v1(
 p_request_id uuid,p_inquiry_id uuid,p_payload jsonb
) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $fn$
DECLARE a record;receipt crm_security.command_receipts%ROWTYPE;oldrow public.inquiries%ROWTYPE;trash_event crm_security.inquiry_audit_events%ROWTYPE;latest_action text;
 canonical jsonb:=jsonb_build_object('intent','restore');ack jsonb;audit_id uuid;server_at timestamptz;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501';END IF;
 PERFORM 1 FROM public.users u WHERE u.auth_uid=auth.uid() FOR SHARE;PERFORM 1 FROM crm_security.access_review r WHERE r.reviewed_auth_uid=auth.uid() FOR SHARE;
 SELECT * INTO a FROM crm_security.actor();IF NOT FOUND THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501';END IF;
 IF p_request_id IS NULL OR p_inquiry_id IS NULL OR p_payload IS DISTINCT FROM canonical THEN RAISE EXCEPTION 'invalid inquiry restore payload; actor and time are server-owned' USING ERRCODE='22023';END IF;
 PERFORM 1 FROM crm_security.object_scope s WHERE s.user_id=a.user_id AND s.inquiry_id=p_inquiry_id FOR SHARE;
 SELECT * INTO oldrow FROM public.inquiries i WHERE i.id=p_inquiry_id FOR UPDATE;
 IF NOT FOUND OR a.permission_role<>'admin' OR NOT crm_security.can_inquiry(p_inquiry_id) THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501';END IF;
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(a.auth_uid::text||p_request_id::text,0));
 SELECT * INTO receipt FROM crm_security.command_receipts r WHERE r.actor_auth_uid=a.auth_uid AND r.request_id=p_request_id;
 IF FOUND THEN IF receipt.actor_user_id IS DISTINCT FROM a.user_id OR receipt.operation IS DISTINCT FROM 'inquiry_restore' OR receipt.object_id IS DISTINCT FROM p_inquiry_id OR receipt.expected_version IS DISTINCT FROM 0 OR receipt.payload IS DISTINCT FROM canonical THEN RAISE EXCEPTION 'REQUEST_ID_REUSE' USING ERRCODE='PT409';END IF;RETURN receipt.ack||jsonb_build_object('replayed',true);END IF;
 SELECT e.action INTO latest_action FROM crm_security.inquiry_audit_events e WHERE e.inquiry_id=p_inquiry_id AND e.action IN ('inquiry_trash','inquiry_restore') ORDER BY e.created_at DESC,e.event_id DESC LIMIT 1;
 IF latest_action IS DISTINCT FROM 'inquiry_trash' THEN RAISE EXCEPTION 'inquiry is not trashed' USING ERRCODE='PT409';END IF;
 SELECT * INTO trash_event FROM crm_security.inquiry_audit_events e WHERE e.inquiry_id=p_inquiry_id AND e.action='inquiry_trash' ORDER BY e.created_at DESC,e.event_id DESC LIMIT 1;
 server_at:=clock_timestamp();
 INSERT INTO crm_security.inquiry_audit_events(actor_auth_uid,actor_user_id,inquiry_id,action,before_data,after_data,reason,created_at)
 VALUES(a.auth_uid,a.user_id,p_inquiry_id,'inquiry_restore',trash_event.after_data,jsonb_build_object('valid_inquiry',true,'restored_at',server_at,'restored_by',a.display_name,'status',oldrow.status,'assigned_to',oldrow.assigned_to,'assigned_at',oldrow.assigned_at),'휴지통 복원',server_at) RETURNING event_id INTO audit_id;
 ack:=jsonb_build_object('contract_version',1,'ok',true,'request_id',p_request_id,'operation','inquiry_restore','object_id',p_inquiry_id,'actor_auth_uid',a.auth_uid,'actor_user_id',a.user_id,'valid_inquiry',true,'restored_at',server_at,'restored_by',a.display_name,'inquiry_audit_event_id',audit_id,'replayed',false);
 INSERT INTO crm_security.command_receipts(actor_auth_uid,request_id,actor_user_id,operation,object_id,expected_version,payload,ack) VALUES(a.auth_uid,p_request_id,a.user_id,'inquiry_restore',p_inquiry_id,0,canonical,ack);RETURN ack;
END $fn$;
REVOKE EXECUTE ON FUNCTION crm_security.crm_inquiry_restore_command_v1(uuid,uuid,jsonb) FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION crm_security.crm_operational_source_fragment_v1(
 p_domain text,p_after uuid,p_limit integer
) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $fn$
DECLARE raw_items jsonb; items jsonb; next_cursor uuid; has_more boolean; a record;
BEGIN
 SELECT * INTO a FROM crm_security.actor();
 IF NOT FOUND THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;
 IF p_domain NOT IN ('deal_core','inquiry_core')
 THEN RAISE EXCEPTION 'unsupported operational source domain' USING ERRCODE='22023'; END IF;
 IF p_limit IS NULL OR p_limit<1 OR p_limit>100
 THEN RAISE EXCEPTION 'invalid limit' USING ERRCODE='22023'; END IF;

 IF p_domain='deal_core' THEN
  SELECT coalesce(jsonb_agg(to_jsonb(q) ORDER BY q.id),'[]'::jsonb) INTO raw_items FROM(
   SELECT d.id,d.site_id,
    coalesce(s.site_name,o.name,nullif(d.list_fields->>'site_name',''),nullif(d.list_fields->>'name','')) AS site_name,
    coalesce(s.site_name,o.name,nullif(d.list_fields->>'site_name',''),nullif(d.list_fields->>'name','')) AS site,
    d.owner_id,coalesce(u.name,d.assignee_name) AS owner_name,coalesce(u.name,d.assignee_name) AS assignee,
    d.stage_code,d.stage_raw,d.stage_group,d.brand,d.list_name,
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
    coalesce((SELECT jsonb_agg(jsonb_build_object('id',ac.id,'type',ac.type,'occurred_at',ac.occurred_at) ORDER BY ac.occurred_at,ac.id)
     FROM public.activities ac WHERE ac.deal_id=d.id),'[]'::jsonb) AS activity_signals
   FROM public.deals d
   LEFT JOIN public.sites s ON s.site_id=d.site_id
   LEFT JOIN public.organizations o ON o.id=d.organization_id
   LEFT JOIN public.users u ON u.user_id=d.owner_id
   LEFT JOIN public.contacts c ON c.id=d.contact_id
   LEFT JOIN crm_security.user_opportunity_state ps ON ps.actor_user_id=a.user_id AND ps.deal_id=d.id
   WHERE crm_security.can_deal(d.id,false) AND (p_after IS NULL OR d.id>p_after)
   ORDER BY d.id LIMIT p_limit+1
  )q;
 ELSE
  SELECT coalesce(jsonb_agg(to_jsonb(q) ORDER BY q.id),'[]'::jsonb) INTO raw_items FROM(
   SELECT i.id,i.site_id,i.site_name,i.brand,i.inquiry_type,i.work_type,i.source_channel,i.channel,
    i.assigned_to,coalesce(u.name,i.assignee_name) AS assignee_name,ar.permission_role AS assignee_permission_role,
    i.status,i.deal_id,i.opportunity_id,i.received_at,i.created_at,i.updated_at,i.assigned_at,
    i.first_response_at,i.responded_at,i.next_action_date,i.contact_name,i.phone,
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
    ||coalesce((SELECT jsonb_agg(jsonb_build_object('id',e.event_id,'type','상태변경','note','보류','result',e.reason,'at',e.created_at,'actor',e.after_data->>'held_by') ORDER BY e.created_at,e.event_id) FROM crm_security.inquiry_audit_events e WHERE e.inquiry_id=i.id AND e.action='inquiry_hold'),'[]'::jsonb) AS activities
   FROM public.inquiries i
   LEFT JOIN public.users u ON u.user_id=i.assigned_to
   LEFT JOIN crm_security.access_review ar ON ar.user_id=i.assigned_to AND ar.approved AND ar.expires_at>now()
   WHERE crm_security.can_inquiry(i.id) AND (p_after IS NULL OR i.id>p_after)
   ORDER BY i.id LIMIT p_limit+1
  )q;
 END IF;

 has_more:=jsonb_array_length(raw_items)>p_limit;
 items:=CASE WHEN has_more THEN raw_items-p_limit ELSE raw_items END;
 next_cursor:=CASE WHEN has_more AND jsonb_array_length(items)>0
  THEN (items->(jsonb_array_length(items)-1)->>'id')::uuid ELSE NULL END;
 RETURN jsonb_build_object(
  'contract_version',1,'resource','operational_source','domain',p_domain,
  'scope_completeness','actor_authorized_rows_only',
  'actor_user_id',a.user_id,'actor_permission_role',a.permission_role,
  'items',items,'pagination',jsonb_build_object(
   'completeness',CASE WHEN has_more THEN 'partial' ELSE 'complete' END,
   'has_more',has_more,'next_cursor',next_cursor));
END $fn$;


REVOKE EXECUTE ON FUNCTION crm_security.crm_operational_source_fragment_v1(text,uuid,integer) FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION public.crm_write_command_v2(p_request_id uuid,p_operation text,p_object_id uuid,p_expected_version integer,p_payload jsonb) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $fn$ BEGIN IF p_operation IN ('inquiry_trash','inquiry_restore') THEN IF p_expected_version IS DISTINCT FROM 0 THEN RAISE EXCEPTION 'invalid inquiry management version sentinel' USING ERRCODE='22023';END IF;IF p_operation='inquiry_trash' THEN RETURN crm_security.crm_inquiry_trash_command_v1(p_request_id,p_object_id,p_payload);ELSE RETURN crm_security.crm_inquiry_restore_command_v1(p_request_id,p_object_id,p_payload);END IF;END IF;RETURN crm_security.crm_write_command_v2_inquiry_hold_20260906(p_request_id,p_operation,p_object_id,p_expected_version,p_payload);END $fn$;
REVOKE EXECUTE ON FUNCTION public.crm_write_command_v2(uuid,text,uuid,integer,jsonb) FROM PUBLIC,anon,authenticated,service_role;GRANT EXECUTE ON FUNCTION public.crm_write_command_v2(uuid,text,uuid,integer,jsonb) TO authenticated;
DO $post$ DECLARE changed integer;BEGIN SELECT count(*) INTO changed FROM inquiry_trash_restore_source_guard g JOIN pg_proc p ON p.oid=g.oid WHERE p.prosrc IS DISTINCT FROM g.prosrc OR p.proconfig IS DISTINCT FROM g.proconfig OR coalesce(p.proacl::text,'') IS DISTINCT FROM g.acl;IF changed<>0 OR has_function_privilege('anon','public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)','EXECUTE') OR NOT has_function_privilege('authenticated','public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)','EXECUTE') OR has_function_privilege('service_role','public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)','EXECUTE') OR has_function_privilege('authenticated','crm_security.crm_inquiry_trash_command_v1(uuid,uuid,jsonb)','EXECUTE') OR has_function_privilege('authenticated','crm_security.crm_inquiry_restore_command_v1(uuid,uuid,jsonb)','EXECUTE') OR (SELECT pg_get_constraintdef(oid,true) FROM pg_constraint WHERE conrelid='crm_security.command_receipts'::regclass AND conname='command_receipts_operation_check') IS DISTINCT FROM $expected$CHECK (operation = ANY (ARRAY['opportunity_work_set'::text, 'inquiry_assign'::text, 'service_change'::text, 'inquiry_unassign'::text, 'favorite_set'::text, 'opportunity_touch'::text, 'next_action'::text, 'activity'::text, 'quote_version'::text, 'next_action_complete'::text, 'stage_check'::text, 'transition'::text, 'close'::text, 'amount'::text, 'waiting_context'::text, 'inquiry_reclassify'::text, 'inquiry_status'::text, 'inquiry_trash'::text, 'inquiry_restore'::text]))$expected$ OR (SELECT pg_get_constraintdef(oid,true) FROM pg_constraint WHERE conrelid='crm_security.inquiry_audit_events'::regclass AND conname='inquiry_audit_events_action_check') IS DISTINCT FROM $expected$CHECK (action = ANY (ARRAY['direct_assign'::text, 'direct_reassign'::text, 'inquiry_unassign'::text, 'inquiry_reclassify'::text, 'inquiry_hold'::text, 'inquiry_trash'::text, 'inquiry_restore'::text]))$expected$ THEN RAISE EXCEPTION 'inquiry trash/restore post-apply drift';END IF;END $post$;
-- ===== APPLY inquiry_purge =====
SET LOCAL crm.inquiry_purge_ref='rprechiaglyjaydkmxsu';
SET LOCAL crm.inquiry_purge_ref='rprechiaglyjaydkmxsu';
SET LOCAL search_path=pg_catalog;SET LOCAL lock_timeout='3s';SET LOCAL statement_timeout='60s';
DO $guard$ BEGIN IF current_user<>'postgres' OR current_setting('crm.inquiry_purge_ref',true) IS DISTINCT FROM 'rprechiaglyjaydkmxsu' OR to_regprocedure('public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)') IS NULL OR to_regprocedure('crm_security.crm_inquiry_trash_command_v1(uuid,uuid,jsonb)') IS NULL OR to_regprocedure('crm_security.crm_inquiry_restore_command_v1(uuid,uuid,jsonb)') IS NULL OR to_regprocedure('crm_security.crm_write_command_v2_inquiry_trash_restore_20260906(uuid,text,uuid,integer,jsonb)') IS NOT NULL OR to_regprocedure('crm_security.crm_inquiry_purge_command_v1(uuid,uuid,jsonb)') IS NOT NULL OR (SELECT pg_get_constraintdef(oid,true) FROM pg_constraint WHERE conrelid='crm_security.command_receipts'::regclass AND conname='command_receipts_operation_check') IS DISTINCT FROM $expected$CHECK (operation = ANY (ARRAY['opportunity_work_set'::text, 'inquiry_assign'::text, 'service_change'::text, 'inquiry_unassign'::text, 'favorite_set'::text, 'opportunity_touch'::text, 'next_action'::text, 'activity'::text, 'quote_version'::text, 'next_action_complete'::text, 'stage_check'::text, 'transition'::text, 'close'::text, 'amount'::text, 'waiting_context'::text, 'inquiry_reclassify'::text, 'inquiry_status'::text, 'inquiry_trash'::text, 'inquiry_restore'::text]))$expected$ OR (SELECT pg_get_constraintdef(oid,true) FROM pg_constraint WHERE conrelid='crm_security.inquiry_audit_events'::regclass AND conname='inquiry_audit_events_action_check') IS DISTINCT FROM $expected$CHECK (action = ANY (ARRAY['direct_assign'::text, 'direct_reassign'::text, 'inquiry_unassign'::text, 'inquiry_reclassify'::text, 'inquiry_hold'::text, 'inquiry_trash'::text, 'inquiry_restore'::text]))$expected$ THEN RAISE EXCEPTION 'inquiry purge prerequisite drift';END IF;END $guard$;
ALTER FUNCTION public.crm_write_command_v2(uuid,text,uuid,integer,jsonb) RENAME TO crm_write_command_v2_inquiry_trash_restore_20260906;ALTER FUNCTION public.crm_write_command_v2_inquiry_trash_restore_20260906(uuid,text,uuid,integer,jsonb) SET SCHEMA crm_security;REVOKE EXECUTE ON FUNCTION crm_security.crm_write_command_v2_inquiry_trash_restore_20260906(uuid,text,uuid,integer,jsonb) FROM PUBLIC,anon,authenticated,service_role;
ALTER TABLE crm_security.command_receipts DROP CONSTRAINT command_receipts_operation_check;ALTER TABLE crm_security.command_receipts ADD CONSTRAINT command_receipts_operation_check CHECK(operation IN ('opportunity_work_set','inquiry_assign','service_change','inquiry_unassign','favorite_set','opportunity_touch','next_action','activity','quote_version','next_action_complete','stage_check','transition','close','amount','waiting_context','inquiry_reclassify','inquiry_status','inquiry_trash','inquiry_restore','inquiry_purge'));
ALTER TABLE crm_security.inquiry_audit_events DROP CONSTRAINT inquiry_audit_events_action_check;ALTER TABLE crm_security.inquiry_audit_events ADD CONSTRAINT inquiry_audit_events_action_check CHECK(action IN ('direct_assign','direct_reassign','inquiry_unassign','inquiry_reclassify','inquiry_hold','inquiry_trash','inquiry_restore','inquiry_purge'));
CREATE FUNCTION crm_security.crm_inquiry_purge_command_v1(
 p_request_id uuid,p_inquiry_id uuid,p_payload jsonb
) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $fn$
DECLARE a record;receipt crm_security.command_receipts%ROWTYPE;oldrow public.inquiries%ROWTYPE;trash_event crm_security.inquiry_audit_events%ROWTYPE;
 canonical jsonb:=jsonb_build_object('intent','purge');ack jsonb;audit_id uuid;server_at timestamptz;
 scope_n integer;assignment_n integer;next_n integer;stage_n integer;deleted_n integer;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501';END IF;
 PERFORM 1 FROM public.users u WHERE u.auth_uid=auth.uid() FOR SHARE;PERFORM 1 FROM crm_security.access_review r WHERE r.reviewed_auth_uid=auth.uid() FOR SHARE;
 SELECT * INTO a FROM crm_security.actor();IF NOT FOUND THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501';END IF;
 IF p_request_id IS NULL OR p_inquiry_id IS NULL OR p_payload IS DISTINCT FROM canonical THEN RAISE EXCEPTION 'invalid inquiry purge payload; actor and time are server-owned' USING ERRCODE='22023';END IF;
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(a.auth_uid::text||p_request_id::text,0));
 SELECT * INTO receipt FROM crm_security.command_receipts r WHERE r.actor_auth_uid=a.auth_uid AND r.request_id=p_request_id;
 IF FOUND THEN IF receipt.actor_user_id IS DISTINCT FROM a.user_id OR receipt.operation IS DISTINCT FROM 'inquiry_purge' OR receipt.object_id IS DISTINCT FROM p_inquiry_id OR receipt.expected_version IS DISTINCT FROM 0 OR receipt.payload IS DISTINCT FROM canonical THEN RAISE EXCEPTION 'REQUEST_ID_REUSE' USING ERRCODE='PT409';END IF;RETURN receipt.ack||jsonb_build_object('replayed',true);END IF;
 IF EXISTS(SELECT 1 FROM crm_security.inquiry_audit_events e WHERE e.inquiry_id=p_inquiry_id AND e.action='inquiry_purge') THEN RAISE EXCEPTION 'inquiry already purged' USING ERRCODE='PT409';END IF;
 PERFORM 1 FROM crm_security.object_scope s WHERE s.user_id=a.user_id AND s.inquiry_id=p_inquiry_id FOR SHARE;
 SELECT * INTO oldrow FROM public.inquiries i WHERE i.id=p_inquiry_id FOR UPDATE;
 IF NOT FOUND OR a.permission_role<>'admin' OR NOT crm_security.can_inquiry(p_inquiry_id) THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501';END IF;
 SELECT * INTO trash_event FROM crm_security.inquiry_audit_events e WHERE e.inquiry_id=p_inquiry_id AND e.action IN ('inquiry_trash','inquiry_restore') ORDER BY e.created_at DESC,e.event_id DESC LIMIT 1 FOR UPDATE;
 IF NOT FOUND OR trash_event.action IS DISTINCT FROM 'inquiry_trash' THEN RAISE EXCEPTION 'inquiry is not trashed' USING ERRCODE='PT409';END IF;
 IF coalesce((trash_event.after_data->>'archive_protected')::boolean,false) OR oldrow.deal_id IS NOT NULL OR oldrow.opportunity_id IS NOT NULL OR EXISTS(SELECT 1 FROM public.deals d WHERE d.origin_inquiry_id=p_inquiry_id) THEN RAISE EXCEPTION 'linked inquiry cannot be purged' USING ERRCODE='PT409';END IF;
 SELECT count(*)::integer INTO scope_n FROM crm_security.object_scope WHERE inquiry_id=p_inquiry_id;
 SELECT count(*)::integer INTO assignment_n FROM public.assignment_history WHERE inquiry_id=p_inquiry_id;
 SELECT count(*)::integer INTO next_n FROM public.next_actions WHERE inquiry_id=p_inquiry_id;
 SELECT count(*)::integer INTO stage_n FROM public.stage_history WHERE inquiry_id=p_inquiry_id;
 server_at:=clock_timestamp();
 INSERT INTO crm_security.inquiry_audit_events(actor_auth_uid,actor_user_id,inquiry_id,action,before_data,after_data,reason,created_at)
 VALUES(a.auth_uid,a.user_id,p_inquiry_id,'inquiry_purge',to_jsonb(oldrow)||jsonb_build_object('trash_event_id',trash_event.event_id),jsonb_build_object('purged',true,'purged_at',server_at,'purged_by',a.display_name,'removed_scope_count',scope_n,'cascaded_assignment_history_count',assignment_n,'cascaded_next_action_count',next_n,'cascaded_stage_history_count',stage_n),'관리자 수동 완전삭제',server_at) RETURNING event_id INTO audit_id;
 DELETE FROM crm_security.object_scope WHERE inquiry_id=p_inquiry_id;GET DIAGNOSTICS deleted_n=ROW_COUNT;IF deleted_n<>scope_n THEN RAISE EXCEPTION 'inquiry scope delete mismatch';END IF;
 DELETE FROM public.inquiries WHERE id=p_inquiry_id;GET DIAGNOSTICS deleted_n=ROW_COUNT;IF deleted_n<>1 THEN RAISE EXCEPTION 'inquiry purge delete mismatch';END IF;
 ack:=jsonb_build_object('contract_version',1,'ok',true,'request_id',p_request_id,'operation','inquiry_purge','object_id',p_inquiry_id,'actor_auth_uid',a.auth_uid,'actor_user_id',a.user_id,'purged',true,'purged_at',server_at,'purged_by',a.display_name,'removed_scope_count',scope_n,'cascaded_assignment_history_count',assignment_n,'cascaded_next_action_count',next_n,'cascaded_stage_history_count',stage_n,'inquiry_audit_event_id',audit_id,'replayed',false);
 INSERT INTO crm_security.command_receipts(actor_auth_uid,request_id,actor_user_id,operation,object_id,expected_version,payload,ack) VALUES(a.auth_uid,p_request_id,a.user_id,'inquiry_purge',p_inquiry_id,0,canonical,ack);RETURN ack;
END $fn$;
REVOKE EXECUTE ON FUNCTION crm_security.crm_inquiry_purge_command_v1(uuid,uuid,jsonb) FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION public.crm_write_command_v2(p_request_id uuid,p_operation text,p_object_id uuid,p_expected_version integer,p_payload jsonb) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $fn$ BEGIN IF p_operation='inquiry_purge' THEN IF p_expected_version IS DISTINCT FROM 0 THEN RAISE EXCEPTION 'invalid inquiry management version sentinel' USING ERRCODE='22023';END IF;RETURN crm_security.crm_inquiry_purge_command_v1(p_request_id,p_object_id,p_payload);END IF;RETURN crm_security.crm_write_command_v2_inquiry_trash_restore_20260906(p_request_id,p_operation,p_object_id,p_expected_version,p_payload);END $fn$;
REVOKE EXECUTE ON FUNCTION public.crm_write_command_v2(uuid,text,uuid,integer,jsonb) FROM PUBLIC,anon,authenticated,service_role;GRANT EXECUTE ON FUNCTION public.crm_write_command_v2(uuid,text,uuid,integer,jsonb) TO authenticated;
DO $post$ BEGIN IF has_function_privilege('anon','public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)','EXECUTE') OR NOT has_function_privilege('authenticated','public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)','EXECUTE') OR has_function_privilege('service_role','public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)','EXECUTE') OR has_function_privilege('authenticated','crm_security.crm_inquiry_purge_command_v1(uuid,uuid,jsonb)','EXECUTE') OR (SELECT pg_get_constraintdef(oid,true) FROM pg_constraint WHERE conrelid='crm_security.command_receipts'::regclass AND conname='command_receipts_operation_check') IS DISTINCT FROM $expected$CHECK (operation = ANY (ARRAY['opportunity_work_set'::text, 'inquiry_assign'::text, 'service_change'::text, 'inquiry_unassign'::text, 'favorite_set'::text, 'opportunity_touch'::text, 'next_action'::text, 'activity'::text, 'quote_version'::text, 'next_action_complete'::text, 'stage_check'::text, 'transition'::text, 'close'::text, 'amount'::text, 'waiting_context'::text, 'inquiry_reclassify'::text, 'inquiry_status'::text, 'inquiry_trash'::text, 'inquiry_restore'::text, 'inquiry_purge'::text]))$expected$ OR (SELECT pg_get_constraintdef(oid,true) FROM pg_constraint WHERE conrelid='crm_security.inquiry_audit_events'::regclass AND conname='inquiry_audit_events_action_check') IS DISTINCT FROM $expected$CHECK (action = ANY (ARRAY['direct_assign'::text, 'direct_reassign'::text, 'inquiry_unassign'::text, 'inquiry_reclassify'::text, 'inquiry_hold'::text, 'inquiry_trash'::text, 'inquiry_restore'::text, 'inquiry_purge'::text]))$expected$ THEN RAISE EXCEPTION 'inquiry purge post-apply drift';END IF;END $post$;
-- ===== APPLY inquiry_followup =====
SET LOCAL crm.inquiry_followup_ref='rprechiaglyjaydkmxsu';
SET LOCAL crm.inquiry_followup_ref='rprechiaglyjaydkmxsu';
SET LOCAL search_path=pg_catalog;SET LOCAL lock_timeout='3s';SET LOCAL statement_timeout='60s';
DO $guard$ BEGIN IF current_user<>'postgres' OR current_setting('crm.inquiry_followup_ref',true) IS DISTINCT FROM 'rprechiaglyjaydkmxsu' OR to_regprocedure('public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)') IS NULL OR to_regprocedure('crm_security.crm_inquiry_purge_command_v1(uuid,uuid,jsonb)') IS NULL OR to_regprocedure('crm_security.crm_write_command_v2_inquiry_purge_20260906(uuid,text,uuid,integer,jsonb)') IS NOT NULL OR to_regprocedure('crm_security.crm_inquiry_followup_command_v1(uuid,uuid,jsonb)') IS NOT NULL OR (SELECT pg_get_constraintdef(oid,true) FROM pg_constraint WHERE conrelid='crm_security.command_receipts'::regclass AND conname='command_receipts_operation_check') IS DISTINCT FROM $expected$CHECK (operation = ANY (ARRAY['opportunity_work_set'::text, 'inquiry_assign'::text, 'service_change'::text, 'inquiry_unassign'::text, 'favorite_set'::text, 'opportunity_touch'::text, 'next_action'::text, 'activity'::text, 'quote_version'::text, 'next_action_complete'::text, 'stage_check'::text, 'transition'::text, 'close'::text, 'amount'::text, 'waiting_context'::text, 'inquiry_reclassify'::text, 'inquiry_status'::text, 'inquiry_trash'::text, 'inquiry_restore'::text, 'inquiry_purge'::text]))$expected$ OR (SELECT pg_get_constraintdef(oid,true) FROM pg_constraint WHERE conrelid='crm_security.inquiry_audit_events'::regclass AND conname='inquiry_audit_events_action_check') IS DISTINCT FROM $expected$CHECK (action = ANY (ARRAY['direct_assign'::text, 'direct_reassign'::text, 'inquiry_unassign'::text, 'inquiry_reclassify'::text, 'inquiry_hold'::text, 'inquiry_trash'::text, 'inquiry_restore'::text, 'inquiry_purge'::text]))$expected$ THEN RAISE EXCEPTION 'inquiry followup prerequisite drift';END IF;END $guard$;
ALTER FUNCTION public.crm_write_command_v2(uuid,text,uuid,integer,jsonb) RENAME TO crm_write_command_v2_inquiry_purge_20260906;ALTER FUNCTION public.crm_write_command_v2_inquiry_purge_20260906(uuid,text,uuid,integer,jsonb) SET SCHEMA crm_security;REVOKE EXECUTE ON FUNCTION crm_security.crm_write_command_v2_inquiry_purge_20260906(uuid,text,uuid,integer,jsonb) FROM PUBLIC,anon,authenticated,service_role;
ALTER TABLE crm_security.command_receipts DROP CONSTRAINT command_receipts_operation_check;ALTER TABLE crm_security.command_receipts ADD CONSTRAINT command_receipts_operation_check CHECK(operation IN ('opportunity_work_set','inquiry_assign','service_change','inquiry_unassign','favorite_set','opportunity_touch','next_action','activity','quote_version','next_action_complete','stage_check','transition','close','amount','waiting_context','inquiry_reclassify','inquiry_status','inquiry_trash','inquiry_restore','inquiry_purge','inquiry_followup'));
ALTER TABLE crm_security.inquiry_audit_events DROP CONSTRAINT inquiry_audit_events_action_check;ALTER TABLE crm_security.inquiry_audit_events ADD CONSTRAINT inquiry_audit_events_action_check CHECK(action IN ('direct_assign','direct_reassign','inquiry_unassign','inquiry_reclassify','inquiry_hold','inquiry_trash','inquiry_restore','inquiry_purge','inquiry_followup'));
CREATE FUNCTION crm_security.crm_inquiry_followup_command_v1(
 p_request_id uuid,p_inquiry_id uuid,p_payload jsonb
) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $fn$
DECLARE a record;receipt crm_security.command_receipts%ROWTYPE;oldrow public.inquiries%ROWTYPE;latest_management text;
 canonical jsonb;ack jsonb;audit_id uuid;server_at timestamptz;due_value date;today_kst date;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501';END IF;
 PERFORM 1 FROM public.users u WHERE u.auth_uid=auth.uid() FOR SHARE;PERFORM 1 FROM crm_security.access_review r WHERE r.reviewed_auth_uid=auth.uid() FOR SHARE;
 SELECT * INTO a FROM crm_security.actor();IF NOT FOUND THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501';END IF;
 IF p_request_id IS NULL OR p_inquiry_id IS NULL OR jsonb_typeof(p_payload) IS DISTINCT FROM 'object' OR EXISTS(SELECT 1 FROM jsonb_object_keys(p_payload) k WHERE k NOT IN ('due_at','reason')) OR p_payload->>'reason' IS DISTINCT FROM '담당자 연기' OR coalesce(p_payload->>'due_at','') !~ '^\d{4}-\d{2}-\d{2}$' THEN RAISE EXCEPTION 'invalid inquiry followup payload' USING ERRCODE='22023';END IF;
 BEGIN due_value:=(p_payload->>'due_at')::date;EXCEPTION WHEN datetime_field_overflow OR invalid_datetime_format THEN RAISE EXCEPTION 'invalid inquiry followup date' USING ERRCODE='22023';END;
 today_kst:=(clock_timestamp() AT TIME ZONE 'Asia/Seoul')::date;
 IF due_value<=today_kst OR due_value>today_kst+365 THEN RAISE EXCEPTION 'inquiry followup date must be future and within 365 days' USING ERRCODE='22023';END IF;
 canonical:=jsonb_build_object('due_at',to_char(due_value,'YYYY-MM-DD'),'reason','담당자 연기');
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(a.auth_uid::text||p_request_id::text,0));
 SELECT * INTO receipt FROM crm_security.command_receipts r WHERE r.actor_auth_uid=a.auth_uid AND r.request_id=p_request_id;
 IF FOUND THEN IF receipt.actor_user_id IS DISTINCT FROM a.user_id OR receipt.operation IS DISTINCT FROM 'inquiry_followup' OR receipt.object_id IS DISTINCT FROM p_inquiry_id OR receipt.expected_version IS DISTINCT FROM 0 OR receipt.payload IS DISTINCT FROM canonical THEN RAISE EXCEPTION 'REQUEST_ID_REUSE' USING ERRCODE='PT409';END IF;RETURN receipt.ack||jsonb_build_object('replayed',true);END IF;
 PERFORM 1 FROM crm_security.object_scope s WHERE s.user_id=a.user_id AND s.inquiry_id=p_inquiry_id FOR SHARE;
 SELECT * INTO oldrow FROM public.inquiries i WHERE i.id=p_inquiry_id FOR UPDATE;
 IF NOT FOUND OR oldrow.assigned_to IS DISTINCT FROM a.user_id OR NOT crm_security.can_inquiry(p_inquiry_id) THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501';END IF;
 SELECT e.action INTO latest_management FROM crm_security.inquiry_audit_events e WHERE e.inquiry_id=p_inquiry_id AND e.action IN ('inquiry_trash','inquiry_restore','inquiry_purge') ORDER BY e.created_at DESC,e.event_id DESC LIMIT 1;
 IF latest_management IN ('inquiry_trash','inquiry_purge') THEN RAISE EXCEPTION 'inactive inquiry cannot be postponed' USING ERRCODE='PT409';END IF;
 IF oldrow.next_action_date IS NOT DISTINCT FROM due_value THEN RAISE EXCEPTION 'inquiry followup date unchanged' USING ERRCODE='PT409';END IF;
 server_at:=clock_timestamp();UPDATE public.inquiries SET next_action_date=due_value,updated_at=server_at WHERE id=p_inquiry_id;
 INSERT INTO crm_security.inquiry_audit_events(actor_auth_uid,actor_user_id,inquiry_id,action,before_data,after_data,reason,created_at)
 VALUES(a.auth_uid,a.user_id,p_inquiry_id,'inquiry_followup',jsonb_build_object('next_action_date',oldrow.next_action_date,'status',oldrow.status,'assigned_to',oldrow.assigned_to),jsonb_build_object('next_action_date',due_value,'status',oldrow.status,'assigned_to',oldrow.assigned_to,'updated_at',server_at),'담당자 연기',server_at) RETURNING event_id INTO audit_id;
 ack:=jsonb_build_object('contract_version',1,'ok',true,'request_id',p_request_id,'operation','inquiry_followup','object_id',p_inquiry_id,'actor_auth_uid',a.auth_uid,'actor_user_id',a.user_id,'previous_next_action_date',oldrow.next_action_date,'next_action_date',due_value,'status',oldrow.status,'updated_at',server_at,'inquiry_audit_event_id',audit_id,'replayed',false);
 INSERT INTO crm_security.command_receipts(actor_auth_uid,request_id,actor_user_id,operation,object_id,expected_version,payload,ack) VALUES(a.auth_uid,p_request_id,a.user_id,'inquiry_followup',p_inquiry_id,0,canonical,ack);RETURN ack;
END $fn$;
REVOKE EXECUTE ON FUNCTION crm_security.crm_inquiry_followup_command_v1(uuid,uuid,jsonb) FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION public.crm_write_command_v2(p_request_id uuid,p_operation text,p_object_id uuid,p_expected_version integer,p_payload jsonb) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $fn$ BEGIN IF p_operation='inquiry_followup' THEN IF p_expected_version IS DISTINCT FROM 0 THEN RAISE EXCEPTION 'invalid inquiry management version sentinel' USING ERRCODE='22023';END IF;RETURN crm_security.crm_inquiry_followup_command_v1(p_request_id,p_object_id,p_payload);END IF;RETURN crm_security.crm_write_command_v2_inquiry_purge_20260906(p_request_id,p_operation,p_object_id,p_expected_version,p_payload);END $fn$;
REVOKE EXECUTE ON FUNCTION public.crm_write_command_v2(uuid,text,uuid,integer,jsonb) FROM PUBLIC,anon,authenticated,service_role;GRANT EXECUTE ON FUNCTION public.crm_write_command_v2(uuid,text,uuid,integer,jsonb) TO authenticated;
DO $post$ BEGIN IF has_function_privilege('anon','public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)','EXECUTE') OR NOT has_function_privilege('authenticated','public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)','EXECUTE') OR has_function_privilege('service_role','public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)','EXECUTE') OR has_function_privilege('authenticated','crm_security.crm_inquiry_followup_command_v1(uuid,uuid,jsonb)','EXECUTE') OR (SELECT pg_get_constraintdef(oid,true) FROM pg_constraint WHERE conrelid='crm_security.command_receipts'::regclass AND conname='command_receipts_operation_check') IS DISTINCT FROM $expected$CHECK (operation = ANY (ARRAY['opportunity_work_set'::text, 'inquiry_assign'::text, 'service_change'::text, 'inquiry_unassign'::text, 'favorite_set'::text, 'opportunity_touch'::text, 'next_action'::text, 'activity'::text, 'quote_version'::text, 'next_action_complete'::text, 'stage_check'::text, 'transition'::text, 'close'::text, 'amount'::text, 'waiting_context'::text, 'inquiry_reclassify'::text, 'inquiry_status'::text, 'inquiry_trash'::text, 'inquiry_restore'::text, 'inquiry_purge'::text, 'inquiry_followup'::text]))$expected$ OR (SELECT pg_get_constraintdef(oid,true) FROM pg_constraint WHERE conrelid='crm_security.inquiry_audit_events'::regclass AND conname='inquiry_audit_events_action_check') IS DISTINCT FROM $expected$CHECK (action = ANY (ARRAY['direct_assign'::text, 'direct_reassign'::text, 'inquiry_unassign'::text, 'inquiry_reclassify'::text, 'inquiry_hold'::text, 'inquiry_trash'::text, 'inquiry_restore'::text, 'inquiry_purge'::text, 'inquiry_followup'::text]))$expected$ THEN RAISE EXCEPTION 'inquiry followup post-apply drift';END IF;END $post$;
DO $reachable_bundle_post$ BEGIN
 IF to_regprocedure('public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)') IS NULL
  OR to_regprocedure('public.crm_operational_source_v1(text,uuid,integer)') IS NULL
  OR NOT has_function_privilege('authenticated','public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)','EXECUTE')
  OR has_function_privilege('anon','public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)','EXECUTE')
  OR has_function_privilege('service_role','public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)','EXECUTE')
  OR NOT has_function_privilege('authenticated','public.crm_operational_source_v1(text,uuid,integer)','EXECUTE')
  OR has_function_privilege('anon','public.crm_operational_source_v1(text,uuid,integer)','EXECUTE')
  OR has_function_privilege('service_role','public.crm_operational_source_v1(text,uuid,integer)','EXECUTE')
  OR to_regprocedure('crm_security.crm_user_opportunity_state_command_v2(uuid,text,uuid,integer,jsonb)') IS NULL OR has_function_privilege('authenticated','crm_security.crm_user_opportunity_state_command_v2(uuid,text,uuid,integer,jsonb)','EXECUTE')
  OR to_regprocedure('crm_security.crm_pipeline_action_command_v1(uuid,text,uuid,integer,jsonb)') IS NULL OR has_function_privilege('authenticated','crm_security.crm_pipeline_action_command_v1(uuid,text,uuid,integer,jsonb)','EXECUTE')
  OR to_regprocedure('crm_security.crm_operational_source_fragment_v1(text,uuid,integer)') IS NULL OR has_function_privilege('authenticated','crm_security.crm_operational_source_fragment_v1(text,uuid,integer)','EXECUTE')
  OR to_regprocedure('crm_security.crm_quote_version_command_v1(uuid,uuid,integer,jsonb)') IS NULL OR has_function_privilege('authenticated','crm_security.crm_quote_version_command_v1(uuid,uuid,integer,jsonb)','EXECUTE')
  OR to_regprocedure('crm_security.crm_next_action_complete_command_v1(uuid,uuid,integer,jsonb)') IS NULL OR has_function_privilege('authenticated','crm_security.crm_next_action_complete_command_v1(uuid,uuid,integer,jsonb)','EXECUTE')
  OR to_regprocedure('crm_security.crm_stage_check_command_v1(uuid,uuid,integer,jsonb)') IS NULL OR has_function_privilege('authenticated','crm_security.crm_stage_check_command_v1(uuid,uuid,integer,jsonb)','EXECUTE')
  OR to_regprocedure('crm_security.crm_deal_transition_command_v1(uuid,uuid,integer,jsonb)') IS NULL OR has_function_privilege('authenticated','crm_security.crm_deal_transition_command_v1(uuid,uuid,integer,jsonb)','EXECUTE')
  OR to_regprocedure('crm_security.crm_deal_close_nonwon_command_v1(uuid,uuid,integer,jsonb)') IS NULL OR has_function_privilege('authenticated','crm_security.crm_deal_close_nonwon_command_v1(uuid,uuid,integer,jsonb)','EXECUTE')
  OR to_regprocedure('crm_security.crm_deal_expected_amount_command_v1(uuid,uuid,integer,jsonb)') IS NULL OR has_function_privilege('authenticated','crm_security.crm_deal_expected_amount_command_v1(uuid,uuid,integer,jsonb)','EXECUTE')
  OR to_regprocedure('crm_security.crm_deal_waiting_context_command_v1(uuid,uuid,integer,jsonb)') IS NULL OR has_function_privilege('authenticated','crm_security.crm_deal_waiting_context_command_v1(uuid,uuid,integer,jsonb)','EXECUTE')
  OR to_regprocedure('crm_security.crm_inquiry_reclassify_command_v1(uuid,uuid,jsonb)') IS NULL OR has_function_privilege('authenticated','crm_security.crm_inquiry_reclassify_command_v1(uuid,uuid,jsonb)','EXECUTE')
  OR to_regprocedure('crm_security.crm_inquiry_hold_command_v1(uuid,uuid,jsonb)') IS NULL OR has_function_privilege('authenticated','crm_security.crm_inquiry_hold_command_v1(uuid,uuid,jsonb)','EXECUTE')
  OR to_regprocedure('crm_security.crm_inquiry_trash_command_v1(uuid,uuid,jsonb)') IS NULL OR has_function_privilege('authenticated','crm_security.crm_inquiry_trash_command_v1(uuid,uuid,jsonb)','EXECUTE')
  OR to_regprocedure('crm_security.crm_inquiry_restore_command_v1(uuid,uuid,jsonb)') IS NULL OR has_function_privilege('authenticated','crm_security.crm_inquiry_restore_command_v1(uuid,uuid,jsonb)','EXECUTE')
  OR to_regprocedure('crm_security.crm_inquiry_purge_command_v1(uuid,uuid,jsonb)') IS NULL OR has_function_privilege('authenticated','crm_security.crm_inquiry_purge_command_v1(uuid,uuid,jsonb)','EXECUTE')
  OR to_regprocedure('crm_security.crm_inquiry_followup_command_v1(uuid,uuid,jsonb)') IS NULL OR has_function_privilege('authenticated','crm_security.crm_inquiry_followup_command_v1(uuid,uuid,jsonb)','EXECUTE')
  OR to_regclass('crm_security.user_opportunity_state') IS NULL OR has_table_privilege('authenticated','crm_security.user_opportunity_state','SELECT,INSERT,UPDATE,DELETE')
  OR to_regclass('crm_security.quote_versions') IS NULL OR has_table_privilege('authenticated','crm_security.quote_versions','SELECT,INSERT,UPDATE,DELETE')
  OR to_regclass('crm_security.stage_transition_events') IS NULL OR has_table_privilege('authenticated','crm_security.stage_transition_events','SELECT,INSERT,UPDATE,DELETE')
  OR to_regclass('crm_security.deal_close_events') IS NULL OR has_table_privilege('authenticated','crm_security.deal_close_events','SELECT,INSERT,UPDATE,DELETE')
  OR (SELECT pg_get_constraintdef(oid,true) FROM pg_constraint
      WHERE conrelid='crm_security.command_receipts'::regclass
       AND conname='command_receipts_operation_check')
     IS DISTINCT FROM $expected$CHECK (operation = ANY (ARRAY['opportunity_work_set'::text, 'inquiry_assign'::text, 'service_change'::text, 'inquiry_unassign'::text, 'favorite_set'::text, 'opportunity_touch'::text, 'next_action'::text, 'activity'::text, 'quote_version'::text, 'next_action_complete'::text, 'stage_check'::text, 'transition'::text, 'close'::text, 'amount'::text, 'waiting_context'::text, 'inquiry_reclassify'::text, 'inquiry_status'::text, 'inquiry_trash'::text, 'inquiry_restore'::text, 'inquiry_purge'::text, 'inquiry_followup'::text]))$expected$
 THEN RAISE EXCEPTION 'reachable operations cumulative post-apply drift'; END IF;
END $reachable_bundle_post$;
COMMIT;
