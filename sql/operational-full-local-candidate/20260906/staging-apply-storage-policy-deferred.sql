-- LOCAL FULL OPERATIONS REVIEW CANDIDATE ONLY. Separate Staging approval is required.
-- Target: netform-crm-staging / rprechiaglyjaydkmxsu. Production and n8n are forbidden.
BEGIN;
SET LOCAL search_path=pg_catalog;
SET LOCAL lock_timeout='3s';
SET LOCAL statement_timeout='360s';
SET LOCAL crm.operational_full_local_ref='rprechiaglyjaydkmxsu';
DO $full_local_guard$ BEGIN IF current_user<>'postgres' OR current_setting('crm.operational_full_local_ref',true) IS DISTINCT FROM 'rprechiaglyjaydkmxsu' THEN RAISE EXCEPTION 'operational full local project/role guard failed';END IF;END $full_local_guard$;
-- ===== APPLY operational_cutover =====
-- LOCAL CUMULATIVE REVIEW CANDIDATE ONLY. Separate Staging approval is required.
-- Target: netform-crm-staging / rprechiaglyjaydkmxsu. Production and external workflow endpoints are forbidden.

SET LOCAL search_path=pg_catalog;
SET LOCAL lock_timeout='3s';
SET LOCAL statement_timeout='240s';
SET LOCAL crm.customer_asset_ref='rprechiaglyjaydkmxsu';
-- ===== APPLY REACHABLE 21-OP BUNDLE =====
-- LOCAL REVIEW CANDIDATE ONLY. Staging execution requires separate explicit approval.
-- Target project: netform-crm-staging / rprechiaglyjaydkmxsu. Production is forbidden.

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
-- ===== APPLY DIRECT OPPORTUNITY CREATE =====
SET LOCAL crm.opportunity_create_ref='rprechiaglyjaydkmxsu';
SET LOCAL search_path=pg_catalog;SET LOCAL lock_timeout='3s';SET LOCAL statement_timeout='60s';
DO $guard$ BEGIN IF current_user<>'postgres' OR current_setting('crm.opportunity_create_ref',true) IS DISTINCT FROM 'rprechiaglyjaydkmxsu'
 OR to_regprocedure('public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)') IS NULL
 OR to_regprocedure('crm_security.crm_inquiry_followup_command_v1(uuid,uuid,jsonb)') IS NULL
 OR to_regprocedure('crm_security.crm_operational_source_fragment_v1(text,uuid,integer)') IS NULL
 OR to_regprocedure('crm_security.crm_write_command_v2_inquiry_followup_20260906(uuid,text,uuid,integer,jsonb)') IS NOT NULL
 OR to_regprocedure('crm_security.crm_operational_source_fragment_pre_opportunity_create_20260906(text,uuid,integer)') IS NOT NULL
 OR to_regprocedure('crm_security.crm_opportunity_create_command_v1(uuid,uuid,jsonb)') IS NOT NULL
 OR (SELECT pg_get_constraintdef(oid,true) FROM pg_constraint WHERE conrelid='crm_security.command_receipts'::regclass AND conname='command_receipts_operation_check') IS DISTINCT FROM $expected$CHECK (operation = ANY (ARRAY['opportunity_work_set'::text, 'inquiry_assign'::text, 'service_change'::text, 'inquiry_unassign'::text, 'favorite_set'::text, 'opportunity_touch'::text, 'next_action'::text, 'activity'::text, 'quote_version'::text, 'next_action_complete'::text, 'stage_check'::text, 'transition'::text, 'close'::text, 'amount'::text, 'waiting_context'::text, 'inquiry_reclassify'::text, 'inquiry_status'::text, 'inquiry_trash'::text, 'inquiry_restore'::text, 'inquiry_purge'::text, 'inquiry_followup'::text]))$expected$
 THEN RAISE EXCEPTION 'opportunity create prerequisite drift';END IF;END $guard$;
LOCK TABLE crm_security.command_receipts IN ACCESS EXCLUSIVE MODE;
ALTER FUNCTION public.crm_write_command_v2(uuid,text,uuid,integer,jsonb) RENAME TO crm_write_command_v2_inquiry_followup_20260906;
ALTER FUNCTION public.crm_write_command_v2_inquiry_followup_20260906(uuid,text,uuid,integer,jsonb) SET SCHEMA crm_security;
REVOKE EXECUTE ON FUNCTION crm_security.crm_write_command_v2_inquiry_followup_20260906(uuid,text,uuid,integer,jsonb) FROM PUBLIC,anon,authenticated,service_role;
ALTER FUNCTION crm_security.crm_operational_source_fragment_v1(text,uuid,integer) RENAME TO crm_operational_source_fragment_pre_opportunity_create_20260906;
REVOKE EXECUTE ON FUNCTION crm_security.crm_operational_source_fragment_pre_opportunity_create_20260906(text,uuid,integer) FROM PUBLIC,anon,authenticated,service_role;
ALTER TABLE crm_security.command_receipts DROP CONSTRAINT command_receipts_operation_check;
ALTER TABLE crm_security.command_receipts ADD CONSTRAINT command_receipts_operation_check CHECK(operation IN ('opportunity_work_set','inquiry_assign','service_change','inquiry_unassign','favorite_set','opportunity_touch','next_action','activity','quote_version','next_action_complete','stage_check','transition','close','amount','waiting_context','inquiry_reclassify','inquiry_status','inquiry_trash','inquiry_restore','inquiry_purge','inquiry_followup','opportunity_create'));
CREATE FUNCTION crm_security.crm_site_common_key_v1(p_name text) RETURNS text
LANGUAGE sql IMMUTABLE STRICT SET search_path='' AS $fn$
 SELECT pg_catalog.lower(pg_catalog.regexp_replace(
  pg_catalog.replace(pg_catalog.regexp_replace(pg_catalog.btrim(p_name),'\[[^]]*\]','','g'),'아파트',''),
  '[[:space:]]+','','g'))
$fn$;

CREATE FUNCTION crm_security.crm_site_pc_key_v1(p_name text) RETURNS text
LANGUAGE sql IMMUTABLE STRICT SET search_path='' AS $fn$
 SELECT pg_catalog.replace(crm_security.crm_site_common_key_v1(p_name),'현장','')
$fn$;

CREATE FUNCTION crm_security.crm_site_mobile_key_v1(p_name text) RETURNS text
LANGUAGE sql IMMUTABLE STRICT SET search_path='' AS $fn$
 SELECT pg_catalog.regexp_replace(
  pg_catalog.regexp_replace(crm_security.crm_site_common_key_v1(p_name),'apt','','gi'),
  '[-_.,]','','g')
$fn$;

REVOKE EXECUTE ON FUNCTION crm_security.crm_site_common_key_v1(text) FROM PUBLIC,anon,authenticated,service_role;
REVOKE EXECUTE ON FUNCTION crm_security.crm_site_pc_key_v1(text) FROM PUBLIC,anon,authenticated,service_role;
REVOKE EXECUTE ON FUNCTION crm_security.crm_site_mobile_key_v1(text) FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION crm_security.crm_opportunity_create_command_v1(
 p_request_id uuid,p_object_id uuid,p_payload jsonb
) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $fn$
DECLARE
 a record; target_user record; target_count integer; receipt crm_security.command_receipts%ROWTYPE;
 server_at timestamptz:=pg_catalog.clock_timestamp(); common_key text; pc_key text; mobile_key text;
 site_ids uuid[]; site_target uuid; site_row public.sites%ROWTYPE; broad_count integer; supplied_site uuid;
 contact_target uuid; assignment_target uuid; deal_target uuid:=gen_random_uuid(); activity_target uuid; next_target uuid;
 audit_target uuid; office_digits text; mobile_digits text; item_count integer; normalized jsonb; ack jsonb;
 target_review_expires timestamptz;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;
 SELECT * INTO a FROM crm_security.actor();
 IF NOT FOUND THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;
 IF p_request_id IS NULL OR p_object_id IS DISTINCT FROM p_request_id OR jsonb_typeof(p_payload) IS DISTINCT FROM 'object'
  OR EXISTS(SELECT 1 FROM jsonb_object_keys(p_payload) k WHERE k NOT IN
   ('surface','site_id','name','work_name','work_type','primary_work','work_items','work_scope_type','work_summary',
    'brand','owner','amount','address','reason','reason_source','office_phone','office_email','manager_name',
    'manager_mobile','manager_role','person_key','client_ref'))
  OR NOT p_payload ?& ARRAY['surface','name','work_name','work_type','primary_work','work_items','work_scope_type','work_summary',
    'brand','owner','reason','office_phone','manager_name','manager_mobile','manager_role','person_key','client_ref']
 THEN RAISE EXCEPTION 'invalid opportunity create contract' USING ERRCODE='22023'; END IF;

 IF p_payload->>'surface' NOT IN ('pc','mobile')
  OR jsonb_typeof(p_payload->'name') IS DISTINCT FROM 'string' OR length(btrim(p_payload->>'name')) NOT BETWEEN 1 AND 300
  OR jsonb_typeof(p_payload->'work_name') IS DISTINCT FROM 'string' OR length(btrim(p_payload->>'work_name')) NOT BETWEEN 1 AND 500
  OR jsonb_typeof(p_payload->'work_type') IS DISTINCT FROM 'string' OR length(btrim(p_payload->>'work_type')) NOT BETWEEN 1 AND 200
  OR jsonb_typeof(p_payload->'primary_work') IS DISTINCT FROM 'string' OR length(btrim(p_payload->>'primary_work')) NOT BETWEEN 1 AND 100
  OR jsonb_typeof(p_payload->'work_items') IS DISTINCT FROM 'array'
  OR jsonb_typeof(p_payload->'work_summary') IS DISTINCT FROM 'string' OR length(btrim(p_payload->>'work_summary')) NOT BETWEEN 1 AND 2000
  OR p_payload->>'work_scope_type' NOT IN ('single','multi')
  OR p_payload->>'brand' NOT IN ('POUR솔루션','아파트스퀘어','석민이앤씨','기술자문')
  OR jsonb_typeof(p_payload->'owner') IS DISTINCT FROM 'string' OR length(btrim(p_payload->>'owner')) NOT BETWEEN 1 AND 100
  OR jsonb_typeof(p_payload->'reason') IS DISTINCT FROM 'string' OR length(btrim(p_payload->>'reason')) NOT BETWEEN 5 AND 2000
  OR jsonb_typeof(p_payload->'office_phone') IS DISTINCT FROM 'string'
  OR jsonb_typeof(p_payload->'manager_name') IS DISTINCT FROM 'string' OR length(btrim(p_payload->>'manager_name')) NOT BETWEEN 1 AND 200
  OR jsonb_typeof(p_payload->'manager_mobile') IS DISTINCT FROM 'string'
  OR p_payload->>'manager_role' IS DISTINCT FROM '관리소장'
  OR jsonb_typeof(p_payload->'person_key') IS DISTINCT FROM 'string'
  OR jsonb_typeof(p_payload->'client_ref') IS DISTINCT FROM 'string' OR length(btrim(p_payload->>'client_ref')) NOT BETWEEN 1 AND 200
  OR (p_payload ? 'amount' AND jsonb_typeof(p_payload->'amount') NOT IN ('number','null'))
  OR (p_payload ? 'address' AND jsonb_typeof(p_payload->'address') NOT IN ('string','null'))
  OR (p_payload ? 'reason_source' AND jsonb_typeof(p_payload->'reason_source') NOT IN ('string','null'))
  OR (p_payload ? 'office_email' AND jsonb_typeof(p_payload->'office_email') NOT IN ('string','null'))
  OR (p_payload ? 'site_id' AND jsonb_typeof(p_payload->'site_id') NOT IN ('string','null'))
 THEN RAISE EXCEPTION 'invalid opportunity create values' USING ERRCODE='22023'; END IF;

 item_count:=jsonb_array_length(p_payload->'work_items');
 IF item_count NOT BETWEEN 1 AND 30
  OR EXISTS(SELECT 1 FROM jsonb_array_elements(p_payload->'work_items') x WHERE jsonb_typeof(x)<>'string')
  OR EXISTS(SELECT 1 FROM jsonb_array_elements_text(p_payload->'work_items') x WHERE length(btrim(x)) NOT BETWEEN 1 AND 100)
  OR (SELECT count(DISTINCT x) FROM jsonb_array_elements_text(p_payload->'work_items') x)<>item_count
  OR NOT ((p_payload->'work_items') ? (p_payload->>'primary_work'))
  OR (item_count=1 AND p_payload->>'work_scope_type'<>'single')
  OR (item_count>1 AND p_payload->>'work_scope_type'<>'multi')
 THEN RAISE EXCEPTION 'invalid opportunity work contract' USING ERRCODE='22023'; END IF;

 IF p_payload->>'amount' IS NOT NULL AND ((p_payload->>'amount') !~ '^[0-9]+$' OR (p_payload->>'amount')::numeric>9007199254740991)
 THEN RAISE EXCEPTION 'invalid opportunity amount' USING ERRCODE='22023'; END IF;
 IF length(coalesce(p_payload->>'address',''))>1000 OR length(coalesce(p_payload->>'reason_source',''))>200
  OR length(coalesce(p_payload->>'office_email',''))>320
 THEN RAISE EXCEPTION 'invalid opportunity optional values' USING ERRCODE='22023'; END IF;

 office_digits:=regexp_replace(p_payload->>'office_phone','[^0-9]','','g');
 mobile_digits:=regexp_replace(p_payload->>'manager_mobile','[^0-9]','','g');
 IF length(office_digits) NOT BETWEEN 8 AND 20 OR length(mobile_digits) NOT BETWEEN 10 AND 20
  OR p_payload->>'person_key' IS DISTINCT FROM 'mobile:'||mobile_digits
 THEN RAISE EXCEPTION 'invalid contact identity' USING ERRCODE='22023'; END IF;

 normalized:=jsonb_strip_nulls(jsonb_build_object(
  'surface',p_payload->>'surface','site_id',p_payload->'site_id','name',btrim(p_payload->>'name'),
  'work_name',btrim(p_payload->>'work_name'),'work_type',btrim(p_payload->>'work_type'),
  'primary_work',btrim(p_payload->>'primary_work'),'work_items',p_payload->'work_items',
  'work_scope_type',p_payload->>'work_scope_type','work_summary',btrim(p_payload->>'work_summary'),
  'brand',p_payload->>'brand','owner',btrim(p_payload->>'owner'),'amount',p_payload->'amount',
  'address',nullif(btrim(coalesce(p_payload->>'address','')),''),'reason',btrim(p_payload->>'reason'),
  'reason_source',nullif(btrim(coalesce(p_payload->>'reason_source','')),''),'office_phone',office_digits,
  'office_email',nullif(btrim(coalesce(p_payload->>'office_email','')),''),'manager_name',btrim(p_payload->>'manager_name'),
  'manager_mobile',mobile_digits,'manager_role','관리소장','person_key','mobile:'||mobile_digits,
  'client_ref',btrim(p_payload->>'client_ref')));

 PERFORM pg_advisory_xact_lock(hashtextextended(a.auth_uid::text||p_request_id::text,0));
 SELECT * INTO receipt FROM crm_security.command_receipts r WHERE r.actor_auth_uid=a.auth_uid AND r.request_id=p_request_id;
 IF FOUND THEN
  IF receipt.actor_user_id IS DISTINCT FROM a.user_id OR receipt.operation IS DISTINCT FROM 'opportunity_create'
   OR receipt.object_id IS DISTINCT FROM p_object_id OR receipt.expected_version IS DISTINCT FROM 0 OR receipt.payload IS DISTINCT FROM normalized
  THEN RAISE EXCEPTION 'REQUEST_ID_REUSE' USING ERRCODE='PT409'; END IF;
  RETURN receipt.ack||jsonb_build_object('replayed',true);
 END IF;

 SELECT count(*) INTO target_count FROM public.users u JOIN crm_security.access_review r ON r.user_id=u.user_id
  WHERE u.name=normalized->>'owner' AND u.active AND u.auth_uid IS NOT NULL AND r.reviewed_auth_uid=u.auth_uid
   AND r.source_role=u.role AND r.approved AND r.expires_at>server_at;
 IF target_count<>1 THEN RAISE EXCEPTION 'invalid or ambiguous owner' USING ERRCODE='22023'; END IF;
 SELECT u.user_id,u.name,u.email,r.permission_role,r.expires_at INTO target_user
  FROM public.users u JOIN crm_security.access_review r ON r.user_id=u.user_id
  WHERE u.name=normalized->>'owner' AND u.active AND u.auth_uid IS NOT NULL AND r.reviewed_auth_uid=u.auth_uid
   AND r.source_role=u.role AND r.approved AND r.expires_at>server_at;
 target_review_expires:=target_user.expires_at;
 IF a.permission_role IN ('rep','admin') THEN
  IF target_user.permission_role<>'rep' THEN RAISE EXCEPTION 'owner is not an approved head-office rep' USING ERRCODE='42501'; END IF;
 ELSIF a.permission_role='branch' THEN
  IF target_user.permission_role<>'branch' OR target_user.user_id<>a.user_id THEN RAISE EXCEPTION 'branch create must be self-owned' USING ERRCODE='42501'; END IF;
 ELSE RAISE EXCEPTION 'creator role cannot create direct opportunities' USING ERRCODE='42501';
 END IF;

 common_key:=crm_security.crm_site_common_key_v1(normalized->>'name');
 pc_key:=crm_security.crm_site_pc_key_v1(normalized->>'name');
 mobile_key:=crm_security.crm_site_mobile_key_v1(normalized->>'name');
 IF common_key='' THEN RAISE EXCEPTION 'empty site identity' USING ERRCODE='22023'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('site:'||common_key,0));

 IF normalized ? 'site_id' THEN
  BEGIN supplied_site:=(normalized->>'site_id')::uuid; EXCEPTION WHEN invalid_text_representation THEN RAISE EXCEPTION 'invalid site id' USING ERRCODE='22023'; END;
 END IF;
 IF supplied_site IS NOT NULL THEN
  SELECT * INTO site_row FROM public.sites s WHERE s.site_id=supplied_site FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'site not found' USING ERRCODE='22023'; END IF;
  IF crm_security.crm_site_common_key_v1(site_row.site_name) IS DISTINCT FROM common_key
  THEN RAISE EXCEPTION 'SITE_ID_NAME_MISMATCH' USING ERRCODE='PT409'; END IF;
  site_target:=site_row.site_id;
  UPDATE public.sites SET address=coalesce(nullif(address,''),normalized->>'address') WHERE site_id=site_target;
 ELSE
  SELECT array_agg(s.site_id ORDER BY s.site_id) INTO site_ids FROM public.sites s
   WHERE crm_security.crm_site_common_key_v1(s.site_name)=common_key;
  IF coalesce(array_length(site_ids,1),0)>1 THEN RAISE EXCEPTION 'SITE_NORMALIZATION_AMBIGUOUS' USING ERRCODE='PT409'; END IF;
  IF coalesce(array_length(site_ids,1),0)=1 THEN site_target:=site_ids[1];
  ELSE
   SELECT count(*) INTO broad_count FROM public.sites s WHERE
    crm_security.crm_site_pc_key_v1(s.site_name)=pc_key OR crm_security.crm_site_mobile_key_v1(s.site_name)=mobile_key
    OR s.norm_name='crm:v1:'||common_key;
   IF broad_count>0 THEN RAISE EXCEPTION 'SITE_MATCH_REQUIRES_EXPLICIT_SELECTION' USING ERRCODE='PT409'; END IF;
   INSERT INTO public.sites(site_name,norm_name,address) VALUES(normalized->>'name','crm:v1:'||common_key,normalized->>'address')
    RETURNING site_id INTO site_target;
  END IF;
 END IF;

 IF normalized->>'surface'='mobile' AND EXISTS(
  SELECT 1 FROM public.deals d WHERE d.site_id=site_target AND btrim(coalesce(d.list_fields->>'work_name',''))=normalized->>'work_name'
   AND btrim(coalesce(d.work_summary,''))=normalized->>'work_summary')
 THEN RAISE EXCEPTION 'SEMANTIC_DUPLICATE' USING ERRCODE='PT409'; END IF;

 PERFORM pg_advisory_xact_lock(hashtextextended('contact:'||(normalized->>'person_key'),0));
 UPDATE public.contacts SET name=normalized->>'manager_name',title='관리소장',phone=normalized->>'manager_mobile',
  mobile=normalized->>'manager_mobile',role='관리소장',current_site=(SELECT site_name FROM public.sites WHERE site_id=site_target),updated_at=server_at
  WHERE person_key=normalized->>'person_key' RETURNING id INTO contact_target;
 IF contact_target IS NULL THEN
  INSERT INTO public.contacts(name,title,phone,mobile,role,person_key,current_site,created_at,updated_at)
  VALUES(normalized->>'manager_name','관리소장',normalized->>'manager_mobile',normalized->>'manager_mobile','관리소장',
   normalized->>'person_key',(SELECT site_name FROM public.sites WHERE site_id=site_target),server_at,server_at)
  RETURNING id INTO contact_target;
 END IF;

 INSERT INTO public.deals(id,contact_id,brand,list_name,stage_code,assignee_name,assignee_email,amount,source,list_fields,
  created_at,updated_at,site_id,owner_id,lifecycle_status,stage_entered_at,last_activity_at,opened_at,version,
  service_type,origin_business,current_business,office_phone,office_email,manager_name,manager_mobile,person_key,
  manager_role,manager_current_site,manager_started_at,manager_status,primary_work,work_items,work_scope_type,work_summary)
 VALUES(deal_target,contact_target,normalized->>'brand',normalized->>'brand','first_contact',target_user.name,target_user.email,
  CASE WHEN normalized ? 'amount' THEN (normalized->>'amount')::bigint ELSE NULL END,'direct_ui',
  jsonb_strip_nulls(jsonb_build_object('work_name',normalized->>'work_name','reason_source',normalized->>'reason_source',
   'create_surface',normalized->>'surface','client_ref',normalized->>'client_ref')),
  server_at,server_at,site_target,target_user.user_id,'active',server_at,server_at,server_at,1,
  normalized->>'brand',normalized->>'brand',normalized->>'brand',normalized->>'office_phone',normalized->>'office_email',
  normalized->>'manager_name',normalized->>'manager_mobile',normalized->>'person_key','관리소장',
  (SELECT site_name FROM public.sites WHERE site_id=site_target),server_at::date,'current',normalized->>'primary_work',
  normalized->'work_items',normalized->>'work_scope_type',normalized->>'work_summary');

 INSERT INTO public.contact_assignments(person_key,opportunity_id,site_name,office_phone,started_at,status,reason)
 VALUES(normalized->>'person_key',deal_target,(SELECT site_name FROM public.sites WHERE site_id=site_target),
  normalized->>'office_phone',server_at::date,'current','영업 등록')
 ON CONFLICT(person_key,site_name) WHERE ended_at IS NULL DO UPDATE SET office_phone=excluded.office_phone,status='current'
 RETURNING id INTO assignment_target;

 INSERT INTO public.activities(deal_id,actor_email,actor_name,type,detail,occurred_at)
 VALUES(deal_target,(SELECT email FROM public.users WHERE user_id=a.user_id),a.display_name,'영업등록',
  jsonb_strip_nulls(jsonb_build_object('note',(normalized->>'work_name')||' ('||(normalized->>'work_summary')||')',
   'result',normalized->>'reason','surface',normalized->>'surface','reason_source',normalized->>'reason_source')),server_at)
 RETURNING id INTO activity_target;
 IF normalized->>'surface'='mobile' THEN
  INSERT INTO public.next_actions(deal_id,action_type,title,due_at,assignee_name,status,source_activity_id,created_at,updated_at)
  VALUES(deal_target,'첫통화','등록 후 첫 통화',(server_at::date+1)::timestamptz,target_user.name,'open',activity_target,server_at,server_at)
  RETURNING id INTO next_target;
 END IF;

 IF a.permission_role IN ('branch','admin') THEN
  INSERT INTO crm_security.object_scope(scope_id,user_id,deal_id,can_write,reviewed_by,expires_at)
  VALUES(gen_random_uuid(),a.user_id,deal_target,true,'opportunity_create:'||p_request_id::text,
   (SELECT expires_at FROM crm_security.access_review WHERE user_id=a.user_id));
 END IF;

 INSERT INTO crm_security.audit_events(actor_auth_uid,actor_user_id,actor_name,deal_id,action,before_data,after_data,reason,created_at)
 VALUES(a.auth_uid,a.user_id,a.display_name,deal_target,'opportunity_create','{}'::jsonb,
  jsonb_build_object('site_id',site_target,'owner_id',target_user.user_id,'contact_id',contact_target,'surface',normalized->>'surface',
   'primary_work',normalized->>'primary_work','work_items',normalized->'work_items','work_summary',normalized->>'work_summary',
   'activity_id',activity_target,'next_action_id',next_target),normalized->>'reason',server_at)
 RETURNING event_id INTO audit_target;

 ack:=jsonb_build_object('contract_version',1,'ok',true,'request_id',p_request_id,'operation','opportunity_create',
  'object_id',p_object_id,'new_opportunity_id',deal_target,'site_id',site_target,'owner_id',target_user.user_id,
  'contact_id',contact_target,'contact_assignment_id',assignment_target,'activity_id',activity_target,
  'next_action_id',next_target,'audit_event_id',audit_target,'version',1,'server_at',server_at,'replayed',false);
 INSERT INTO crm_security.command_receipts(actor_auth_uid,request_id,actor_user_id,operation,object_id,expected_version,payload,ack,created_at)
 VALUES(a.auth_uid,p_request_id,a.user_id,'opportunity_create',p_object_id,0,normalized,ack,server_at);
 RETURN ack;
END $fn$;

REVOKE EXECUTE ON FUNCTION crm_security.crm_opportunity_create_command_v1(uuid,uuid,jsonb) FROM PUBLIC,anon,authenticated,service_role;

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
    d.stage_code,d.stage_raw,d.stage_group,d.brand,d.list_name,d.list_fields->>'work_name' AS work_name,d.list_fields->>'work_name' AS work,
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
CREATE FUNCTION public.crm_write_command_v2(p_request_id uuid,p_operation text,p_object_id uuid,p_expected_version integer,p_payload jsonb) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $fn$ BEGIN
 IF p_operation='opportunity_create' THEN IF p_expected_version IS DISTINCT FROM 0 OR p_object_id IS DISTINCT FROM p_request_id THEN RAISE EXCEPTION 'invalid create sentinel' USING ERRCODE='22023';END IF;RETURN crm_security.crm_opportunity_create_command_v1(p_request_id,p_object_id,p_payload);END IF;
 RETURN crm_security.crm_write_command_v2_inquiry_followup_20260906(p_request_id,p_operation,p_object_id,p_expected_version,p_payload);END $fn$;
REVOKE EXECUTE ON FUNCTION public.crm_write_command_v2(uuid,text,uuid,integer,jsonb) FROM PUBLIC,anon,authenticated,service_role;GRANT EXECUTE ON FUNCTION public.crm_write_command_v2(uuid,text,uuid,integer,jsonb) TO authenticated;
DO $post$ BEGIN IF has_function_privilege('anon','public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)','EXECUTE') OR NOT has_function_privilege('authenticated','public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)','EXECUTE') OR has_function_privilege('service_role','public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)','EXECUTE')
 OR has_function_privilege('authenticated','crm_security.crm_opportunity_create_command_v1(uuid,uuid,jsonb)','EXECUTE')
 OR has_function_privilege('authenticated','crm_security.crm_site_common_key_v1(text)','EXECUTE')
 OR (SELECT pg_get_constraintdef(oid,true) FROM pg_constraint WHERE conrelid='crm_security.command_receipts'::regclass AND conname='command_receipts_operation_check') IS DISTINCT FROM $expected$CHECK (operation = ANY (ARRAY['opportunity_work_set'::text, 'inquiry_assign'::text, 'service_change'::text, 'inquiry_unassign'::text, 'favorite_set'::text, 'opportunity_touch'::text, 'next_action'::text, 'activity'::text, 'quote_version'::text, 'next_action_complete'::text, 'stage_check'::text, 'transition'::text, 'close'::text, 'amount'::text, 'waiting_context'::text, 'inquiry_reclassify'::text, 'inquiry_status'::text, 'inquiry_trash'::text, 'inquiry_restore'::text, 'inquiry_purge'::text, 'inquiry_followup'::text, 'opportunity_create'::text]))$expected$
 THEN RAISE EXCEPTION 'opportunity create post-apply drift';END IF;END $post$;
-- ===== APPLY DEAL CONTACT READ =====
-- LOCAL READ CANDIDATE ONLY. No DML and no public write Dispatcher change.

SET LOCAL search_path=pg_catalog;
SET LOCAL lock_timeout='3s';
SET LOCAL statement_timeout='60s';

DO $guard$ DECLARE p record; BEGIN
 SELECT * INTO p FROM pg_proc WHERE oid='public.crm_contacts_scoped_v2(uuid)'::regprocedure;
 IF current_setting('crm.customer_asset_ref',true) IS DISTINCT FROM 'rprechiaglyjaydkmxsu'
  OR p.oid IS NULL OR md5(replace(replace(pg_get_functiondef(p.oid),chr(13)||chr(10),chr(10)),chr(13),chr(10)))<>'1a58be86503cb53bdc3a9a784eb4add2'
  OR pg_get_userbyid(p.proowner)<>'postgres' OR NOT p.prosecdef
  OR p.prolang<>(SELECT oid FROM pg_language WHERE lanname='plpgsql')
  OR p.provolatile<>'s' OR p.proisstrict OR p.proparallel<>'u' OR p.proleakproof
  OR p.proconfig IS DISTINCT FROM ARRAY['search_path=""']
  OR coalesce(p.proacl::text,'')<>'{postgres=X/postgres,authenticated=X/postgres}'
  OR md5(replace(replace(pg_get_functiondef('crm_security.can_deal(uuid,boolean)'::regprocedure),chr(13)||chr(10),chr(10)),chr(13),chr(10)))<>'05d51a3c77344504a05a0e932cfcb15d'
  OR to_regclass('public.deals') IS NULL OR to_regclass('public.contacts') IS NULL
  OR to_regclass('public.contact_assignments') IS NULL OR to_regclass('public.sites') IS NULL
 THEN RAISE EXCEPTION 'customer asset read baseline drift'; END IF;
 PERFORM set_config('crm.customer_asset_previous_oid',p.oid::text,true);
END $guard$;

DO $columns$ DECLARE missing text; BEGIN
 SELECT string_agg(x.rel||'.'||x.col,', ' ORDER BY x.rel,x.col) INTO missing
 FROM (VALUES
  ('deals','id','uuid'),('deals','contact_id','uuid'),('deals','person_key','text'),('deals','site_id','uuid'),
  ('contacts','id','uuid'),('contacts','person_key','text'),('contacts','name','text'),('contacts','role','text'),
  ('contacts','title','text'),('contacts','phone','text'),('contacts','mobile','text'),('contacts','current_site','text'),
  ('contact_assignments','id','uuid'),('contact_assignments','person_key','text'),('contact_assignments','opportunity_id','uuid'),
  ('contact_assignments','site_name','text'),('contact_assignments','office_phone','text'),
  ('contact_assignments','started_at','date'),('contact_assignments','ended_at','date'),('contact_assignments','status','text'),
  ('sites','site_id','uuid'),('sites','site_name','text')
 ) x(rel,col,typ)
 WHERE NOT EXISTS(SELECT 1 FROM pg_attribute a
  WHERE a.attrelid=('public.'||x.rel)::regclass AND a.attname=x.col AND NOT a.attisdropped
    AND format_type(a.atttypid,a.atttypmod)=x.typ);
 IF missing IS NOT NULL THEN RAISE EXCEPTION 'customer asset dependency drift: %',missing; END IF;
END $columns$;

CREATE OR REPLACE FUNCTION public.crm_contacts_scoped_v2(p_opportunity_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $fn$
BEGIN
 IF p_opportunity_id IS NULL OR NOT crm_security.can_deal(p_opportunity_id,false)
 THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;

 RETURN coalesce((
  SELECT jsonb_agg(jsonb_build_object(
   'id',c.id,
   'person_key',c.person_key,
   'name',c.name,
   'role',coalesce(nullif(c.role,''),nullif(c.title,''),'담당자'),
   'phone',c.phone,
   'mobile',coalesce(c.mobile,c.phone),
   'current_site',c.current_site,
   'site_id',d.site_id,
   'site_name',s.site_name,
   'is_primary',coalesce(c.id=d.contact_id OR c.person_key=d.person_key,false),
   'office_phone',cur.office_phone,
   'started_at',cur.started_at,
   'ended_at',cur.ended_at,
   'status',coalesce(cur.status,'current'),
   'assignment_history',coalesce((
    SELECT jsonb_agg(jsonb_build_object(
     'site_name',h.site_name,
     'office_phone',h.office_phone,
     'started_at',h.started_at,
     'ended_at',h.ended_at,
     'status',coalesce(h.status,CASE WHEN h.ended_at IS NULL THEN 'current' ELSE 'ended' END)
    ) ORDER BY h.started_at DESC,h.id)
    FROM public.contact_assignments h
    WHERE h.person_key=c.person_key AND h.opportunity_id IS NOT NULL
      AND crm_security.can_deal(h.opportunity_id,false)
   ),'[]'::jsonb)
  ) ORDER BY coalesce(c.id=d.contact_id OR c.person_key=d.person_key,false) DESC,c.name,c.id)
  FROM public.deals d
  LEFT JOIN public.sites s ON s.site_id=d.site_id
  JOIN public.contacts c ON c.id=d.contact_id OR EXISTS(
   SELECT 1 FROM public.contact_assignments x
   WHERE x.person_key=c.person_key AND x.opportunity_id=d.id)
  LEFT JOIN LATERAL(
   SELECT x.office_phone,x.started_at,x.ended_at,x.status
   FROM public.contact_assignments x
   WHERE x.person_key=c.person_key AND x.opportunity_id=d.id
   ORDER BY (x.ended_at IS NULL) DESC,x.started_at DESC,x.id DESC LIMIT 1
  ) cur ON true
  WHERE d.id=p_opportunity_id
 ),'[]'::jsonb);
END $fn$;

REVOKE EXECUTE ON FUNCTION public.crm_contacts_scoped_v2(uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.crm_contacts_scoped_v2(uuid) TO authenticated;

DO $verify$ DECLARE p record; BEGIN
 SELECT * INTO p FROM pg_proc WHERE oid='public.crm_contacts_scoped_v2(uuid)'::regprocedure;
 IF p.oid::text IS DISTINCT FROM current_setting('crm.customer_asset_previous_oid',true)
  OR md5(pg_get_functiondef(p.oid))<>'7e811c93e73ba945a0dfea164da55fcd'
  OR pg_get_userbyid(p.proowner)<>'postgres' OR NOT p.prosecdef
  OR p.prolang<>(SELECT oid FROM pg_language WHERE lanname='plpgsql')
  OR p.provolatile<>'s' OR p.proisstrict OR p.proparallel<>'u' OR p.proleakproof
  OR p.proconfig IS DISTINCT FROM ARRAY['search_path=""']
  OR coalesce(p.proacl::text,'')<>'{postgres=X/postgres,authenticated=X/postgres}'
  OR has_function_privilege('public',p.oid,'EXECUTE')
  OR has_function_privilege('anon',p.oid,'EXECUTE')
  OR has_function_privilege('service_role',p.oid,'EXECUTE')
 THEN RAISE EXCEPTION 'customer asset read ACL/config drift'; END IF;
END $verify$;
-- ===== APPLY INQUIRY RESPONSE PROGRESS =====
-- LOCAL REVIEW CANDIDATE ONLY. Staging approval is required.

-- LOCAL CANDIDATE ONLY. Adds the three reachable mobile response outcomes carried by inquiry_assign.
SET LOCAL crm.inquiry_response_ref='rprechiaglyjaydkmxsu';
SET LOCAL search_path=pg_catalog;
SET LOCAL lock_timeout='3s';
SET LOCAL statement_timeout='60s';

DO $guard$ BEGIN
 IF current_user<>'postgres'
  OR current_setting('crm.inquiry_response_ref',true) IS DISTINCT FROM 'rprechiaglyjaydkmxsu'
  OR to_regprocedure('public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)') IS NULL
  OR to_regprocedure('crm_security.crm_opportunity_create_command_v1(uuid,uuid,jsonb)') IS NULL
  OR to_regprocedure('crm_security.crm_operational_source_fragment_v1(text,uuid,integer)') IS NULL
  OR to_regprocedure('crm_security.crm_write_command_v2_opportunity_create_20260906(uuid,text,uuid,integer,jsonb)') IS NOT NULL
  OR to_regprocedure('crm_security.crm_operational_source_fragment_pre_inquiry_response_20260906(text,uuid,integer)') IS NOT NULL
  OR to_regprocedure('crm_security.crm_inquiry_response_command_v1(uuid,uuid,jsonb)') IS NOT NULL
  OR (SELECT pg_get_constraintdef(oid,true) FROM pg_constraint
      WHERE conrelid='crm_security.command_receipts'::regclass
       AND conname='command_receipts_operation_check') IS DISTINCT FROM $expected$CHECK (operation = ANY (ARRAY['opportunity_work_set'::text, 'inquiry_assign'::text, 'service_change'::text, 'inquiry_unassign'::text, 'favorite_set'::text, 'opportunity_touch'::text, 'next_action'::text, 'activity'::text, 'quote_version'::text, 'next_action_complete'::text, 'stage_check'::text, 'transition'::text, 'close'::text, 'amount'::text, 'waiting_context'::text, 'inquiry_reclassify'::text, 'inquiry_status'::text, 'inquiry_trash'::text, 'inquiry_restore'::text, 'inquiry_purge'::text, 'inquiry_followup'::text, 'opportunity_create'::text]))$expected$
  OR (SELECT pg_get_constraintdef(oid,true) FROM pg_constraint
      WHERE conrelid='crm_security.inquiry_audit_events'::regclass
       AND conname='inquiry_audit_events_action_check') IS DISTINCT FROM $expected$CHECK (action = ANY (ARRAY['direct_assign'::text, 'direct_reassign'::text, 'inquiry_unassign'::text, 'inquiry_reclassify'::text, 'inquiry_hold'::text, 'inquiry_trash'::text, 'inquiry_restore'::text, 'inquiry_purge'::text, 'inquiry_followup'::text]))$expected$
 THEN RAISE EXCEPTION 'inquiry response prerequisite drift'; END IF;
END $guard$;

LOCK TABLE crm_security.command_receipts,crm_security.inquiry_audit_events IN ACCESS EXCLUSIVE MODE;
ALTER FUNCTION public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)
 RENAME TO crm_write_command_v2_opportunity_create_20260906;
ALTER FUNCTION public.crm_write_command_v2_opportunity_create_20260906(uuid,text,uuid,integer,jsonb)
 SET SCHEMA crm_security;
REVOKE EXECUTE ON FUNCTION crm_security.crm_write_command_v2_opportunity_create_20260906(uuid,text,uuid,integer,jsonb)
 FROM PUBLIC,anon,authenticated,service_role;
ALTER FUNCTION crm_security.crm_operational_source_fragment_v1(text,uuid,integer)
 RENAME TO crm_operational_source_fragment_pre_inquiry_response_20260906;
REVOKE EXECUTE ON FUNCTION crm_security.crm_operational_source_fragment_pre_inquiry_response_20260906(text,uuid,integer)
 FROM PUBLIC,anon,authenticated,service_role;

ALTER TABLE crm_security.inquiry_audit_events DROP CONSTRAINT inquiry_audit_events_action_check;
ALTER TABLE crm_security.inquiry_audit_events ADD CONSTRAINT inquiry_audit_events_action_check
 CHECK(action IN ('direct_assign','direct_reassign','inquiry_unassign','inquiry_reclassify','inquiry_hold','inquiry_trash','inquiry_restore','inquiry_purge','inquiry_followup','inquiry_response_progress','inquiry_response_next_week_retry','inquiry_response_missed_retry'));

CREATE FUNCTION crm_security.crm_inquiry_response_command_v1(
 p_request_id uuid,p_inquiry_id uuid,p_payload jsonb
) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $fn$
DECLARE
 a record; receipt crm_security.command_receipts%ROWTYPE;
 oldrow public.inquiries%ROWTYPE; newrow public.inquiries%ROWTYPE;
 canonical jsonb; ack jsonb; response_event uuid; server_at timestamptz:=clock_timestamp();
 latest_management text; intent_value text; response_value text; status_value text;
 due_value date; today_kst date; audit_action text;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;
 PERFORM 1 FROM public.users u WHERE u.auth_uid=auth.uid() FOR SHARE;
 PERFORM 1 FROM crm_security.access_review r WHERE r.reviewed_auth_uid=auth.uid() FOR SHARE;
 SELECT * INTO a FROM crm_security.actor();
 IF NOT FOUND THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;
 IF p_request_id IS NULL OR p_inquiry_id IS NULL OR jsonb_typeof(p_payload) IS DISTINCT FROM 'object'
  OR EXISTS(SELECT 1 FROM jsonb_object_keys(p_payload) k WHERE k NOT IN ('intent','response'))
 THEN RAISE EXCEPTION 'invalid inquiry response payload' USING ERRCODE='22023'; END IF;
 intent_value:=p_payload->>'intent'; response_value:=p_payload->>'response';
 IF (intent_value,response_value) NOT IN (
  ('response_progress','진행됨 — 다음 잡음'),
  ('response_next_week_retry','다음주 다시'),
  ('response_missed_retry','못 받으심 (내일 재시도)')
 ) THEN RAISE EXCEPTION 'invalid inquiry response payload' USING ERRCODE='22023'; END IF;
 canonical:=jsonb_build_object('intent',intent_value,'response',response_value);
 today_kst:=(server_at AT TIME ZONE 'Asia/Seoul')::date;
 IF intent_value='response_progress' THEN
  status_value:='전화응대 완료'; audit_action:='inquiry_response_progress'; due_value:=NULL;
 ELSIF intent_value='response_next_week_retry' THEN
  status_value:='응대중'; audit_action:='inquiry_response_next_week_retry'; due_value:=today_kst+7;
 ELSE
  status_value:='배정완료'; audit_action:='inquiry_response_missed_retry'; due_value:=today_kst+1;
 END IF;

 PERFORM 1 FROM crm_security.object_scope s WHERE s.user_id=a.user_id AND s.inquiry_id=p_inquiry_id FOR SHARE;
 SELECT * INTO oldrow FROM public.inquiries i WHERE i.id=p_inquiry_id FOR UPDATE;
 IF NOT FOUND OR NOT crm_security.can_inquiry(p_inquiry_id)
  OR a.permission_role NOT IN ('rep','consultation') OR oldrow.assigned_to IS DISTINCT FROM a.user_id
 THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;
 SELECT e.action INTO latest_management FROM crm_security.inquiry_audit_events e
  WHERE e.inquiry_id=p_inquiry_id AND e.action IN ('inquiry_trash','inquiry_restore','inquiry_purge')
  ORDER BY e.created_at DESC,e.event_id DESC LIMIT 1;
 IF latest_management IN ('inquiry_trash','inquiry_purge')
  OR coalesce(oldrow.status,'') IN ('수주','실주','배드핏','연락두절','종결','종료')
 THEN RAISE EXCEPTION 'inquiry response state conflict' USING ERRCODE='PT409'; END IF;

 PERFORM pg_advisory_xact_lock(hashtextextended(a.auth_uid::text||p_request_id::text,0));
 SELECT * INTO receipt FROM crm_security.command_receipts r
  WHERE r.actor_auth_uid=a.auth_uid AND r.request_id=p_request_id;
 IF FOUND THEN
  IF receipt.actor_user_id IS DISTINCT FROM a.user_id OR receipt.operation IS DISTINCT FROM 'inquiry_assign'
   OR receipt.object_id IS DISTINCT FROM p_inquiry_id OR receipt.expected_version IS DISTINCT FROM 0
   OR receipt.payload IS DISTINCT FROM canonical
  THEN RAISE EXCEPTION 'REQUEST_ID_REUSE' USING ERRCODE='PT409'; END IF;
  RETURN receipt.ack||jsonb_build_object('replayed',true);
 END IF;

 UPDATE public.inquiries i SET
  first_response_at=CASE WHEN intent_value='response_missed_retry' THEN i.first_response_at ELSE coalesce(i.first_response_at,server_at) END,
  responded_at=CASE WHEN intent_value='response_missed_retry' THEN i.responded_at ELSE server_at END,
  next_action_date=CASE WHEN due_value IS NULL THEN i.next_action_date ELSE due_value END,
  status=status_value,updated_at=server_at
 WHERE i.id=p_inquiry_id RETURNING * INTO newrow;
 INSERT INTO crm_security.inquiry_audit_events(
  actor_auth_uid,actor_user_id,inquiry_id,action,before_data,after_data,reason,created_at)
 VALUES(a.auth_uid,a.user_id,p_inquiry_id,audit_action,
  jsonb_build_object('status',oldrow.status,'first_response_at',oldrow.first_response_at,'responded_at',oldrow.responded_at,'next_action_date',oldrow.next_action_date),
  jsonb_build_object('status',newrow.status,'first_response_at',newrow.first_response_at,
   'responded_at',newrow.responded_at,'next_action_date',newrow.next_action_date,'actor',a.display_name),
  response_value,server_at) RETURNING event_id INTO response_event;
 ack:=jsonb_build_object('contract_version',1,'ok',true,'request_id',p_request_id,
  'operation','inquiry_assign','object_id',p_inquiry_id,'intent',intent_value,
  'response',response_value,'status',newrow.status,
  'first_response_at',newrow.first_response_at,'responded_at',newrow.responded_at,
  'next_action_date',newrow.next_action_date,
  'updated_at',newrow.updated_at,
  'actor_auth_uid',a.auth_uid,'actor_user_id',a.user_id,
  'inquiry_audit_event_id',response_event,'changed',true,'replayed',false);
 INSERT INTO crm_security.command_receipts(
  actor_auth_uid,request_id,actor_user_id,operation,object_id,expected_version,payload,ack,created_at)
 VALUES(a.auth_uid,p_request_id,a.user_id,'inquiry_assign',p_inquiry_id,0,canonical,ack,server_at);
 RETURN ack;
END $fn$;
REVOKE EXECUTE ON FUNCTION crm_security.crm_inquiry_response_command_v1(uuid,uuid,jsonb)
 FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION crm_security.crm_operational_source_fragment_v1(
 p_domain text,p_after uuid DEFAULT NULL,p_limit integer DEFAULT 100
) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $fn$
DECLARE base jsonb; projected jsonb;
BEGIN
 base:=crm_security.crm_operational_source_fragment_pre_inquiry_response_20260906(p_domain,p_after,p_limit);
 IF p_domain<>'inquiry_core' THEN RETURN base; END IF;
 SELECT coalesce(jsonb_agg(item||jsonb_build_object('response_history',coalesce((
  SELECT jsonb_agg(jsonb_build_object(
   'id',e.event_id,'response',e.reason,'status',e.after_data->>'status',
   'first_response_at',e.after_data->>'first_response_at','responded_at',e.after_data->>'responded_at',
   'next_action_date',e.after_data->>'next_action_date',
   'at',e.created_at,'actor',e.after_data->>'actor') ORDER BY e.created_at,e.event_id)
  FROM crm_security.inquiry_audit_events e
  WHERE e.inquiry_id=(item->>'id')::uuid AND e.action IN ('inquiry_response_progress','inquiry_response_next_week_retry','inquiry_response_missed_retry')
 ),'[]'::jsonb)) ORDER BY item->>'id'),'[]'::jsonb) INTO projected
 FROM jsonb_array_elements(base->'items') item;
 RETURN jsonb_set(base,'{items}',projected,true);
END $fn$;
REVOKE EXECUTE ON FUNCTION crm_security.crm_operational_source_fragment_v1(text,uuid,integer)
 FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION public.crm_write_command_v2(
 p_request_id uuid,p_operation text,p_object_id uuid,p_expected_version integer,p_payload jsonb
) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $fn$
BEGIN
 IF p_operation='inquiry_assign' AND p_payload->>'intent' IN ('response_progress','response_next_week_retry','response_missed_retry') THEN
  IF p_expected_version IS DISTINCT FROM 0 THEN
   RAISE EXCEPTION 'invalid inquiry response version sentinel' USING ERRCODE='22023';
  END IF;
  RETURN crm_security.crm_inquiry_response_command_v1(p_request_id,p_object_id,p_payload);
 END IF;
 RETURN crm_security.crm_write_command_v2_opportunity_create_20260906(
  p_request_id,p_operation,p_object_id,p_expected_version,p_payload);
END $fn$;
REVOKE EXECUTE ON FUNCTION public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)
 FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.crm_write_command_v2(uuid,text,uuid,integer,jsonb) TO authenticated;

DO $post$ BEGIN
 IF has_function_privilege('public','public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)','EXECUTE')
  OR has_function_privilege('anon','public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)','EXECUTE')
  OR NOT has_function_privilege('authenticated','public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)','EXECUTE')
  OR has_function_privilege('service_role','public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)','EXECUTE')
  OR has_function_privilege('authenticated','crm_security.crm_inquiry_response_command_v1(uuid,uuid,jsonb)','EXECUTE')
  OR has_function_privilege('authenticated','crm_security.crm_operational_source_fragment_v1(text,uuid,integer)','EXECUTE')
  OR (SELECT pg_get_constraintdef(oid,true) FROM pg_constraint
      WHERE conrelid='crm_security.inquiry_audit_events'::regclass
       AND conname='inquiry_audit_events_action_check') IS DISTINCT FROM $expected$CHECK (action = ANY (ARRAY['direct_assign'::text, 'direct_reassign'::text, 'inquiry_unassign'::text, 'inquiry_reclassify'::text, 'inquiry_hold'::text, 'inquiry_trash'::text, 'inquiry_restore'::text, 'inquiry_purge'::text, 'inquiry_followup'::text, 'inquiry_response_progress'::text, 'inquiry_response_next_week_retry'::text, 'inquiry_response_missed_retry'::text]))$expected$
 THEN RAISE EXCEPTION 'inquiry response post-apply drift'; END IF;
END $post$;
-- ===== APPLY INQUIRY PIPELINE + LINEAGE =====
-- LOCAL REVIEW CANDIDATE ONLY. Staging approval is required.

-- LOCAL CANDIDATE ONLY. Connects ordinary head-office inquiry promotion and manual lineage.
SET LOCAL crm.inquiry_pipeline_ref='rprechiaglyjaydkmxsu';
SET LOCAL search_path=pg_catalog;
SET LOCAL lock_timeout='3s';
SET LOCAL statement_timeout='60s';

DO $guard$ BEGIN
 IF current_user<>'postgres'
  OR current_setting('crm.inquiry_pipeline_ref',true) IS DISTINCT FROM 'rprechiaglyjaydkmxsu'
  OR to_regprocedure('public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)') IS NULL
  OR to_regprocedure('crm_security.crm_opportunity_create_command_v1(uuid,uuid,jsonb)') IS NULL
  OR to_regprocedure('crm_security.crm_deal_transition_command_v1(uuid,uuid,integer,jsonb)') IS NULL
  OR to_regprocedure('crm_security.crm_site_common_key_v1(text)') IS NULL
  OR to_regprocedure('crm_security.crm_write_command_v2_inquiry_response_20260906(uuid,text,uuid,integer,jsonb)') IS NOT NULL
  OR to_regprocedure('crm_security.crm_inquiry_pipeline_promote_command_v1(uuid,text,uuid,integer,jsonb)') IS NOT NULL
  OR to_regprocedure('crm_security.crm_inquiry_lineage_link_command_v1(uuid,uuid,integer,jsonb)') IS NOT NULL
  OR EXISTS(SELECT 1 FROM public.deals WHERE origin_inquiry_id IS NOT NULL GROUP BY origin_inquiry_id HAVING count(*)>1)
  OR (SELECT pg_get_constraintdef(oid,true) FROM pg_constraint
      WHERE conrelid='crm_security.command_receipts'::regclass AND conname='command_receipts_operation_check')
     IS DISTINCT FROM $expected$CHECK (operation = ANY (ARRAY['opportunity_work_set'::text, 'inquiry_assign'::text, 'service_change'::text, 'inquiry_unassign'::text, 'favorite_set'::text, 'opportunity_touch'::text, 'next_action'::text, 'activity'::text, 'quote_version'::text, 'next_action_complete'::text, 'stage_check'::text, 'transition'::text, 'close'::text, 'amount'::text, 'waiting_context'::text, 'inquiry_reclassify'::text, 'inquiry_status'::text, 'inquiry_trash'::text, 'inquiry_restore'::text, 'inquiry_purge'::text, 'inquiry_followup'::text, 'opportunity_create'::text]))$expected$
  OR (SELECT pg_get_constraintdef(oid,true) FROM pg_constraint
      WHERE conrelid='crm_security.inquiry_audit_events'::regclass AND conname='inquiry_audit_events_action_check')
     IS DISTINCT FROM $expected$CHECK (action = ANY (ARRAY['direct_assign'::text, 'direct_reassign'::text, 'inquiry_unassign'::text, 'inquiry_reclassify'::text, 'inquiry_hold'::text, 'inquiry_trash'::text, 'inquiry_restore'::text, 'inquiry_purge'::text, 'inquiry_followup'::text, 'inquiry_response_progress'::text, 'inquiry_response_next_week_retry'::text, 'inquiry_response_missed_retry'::text]))$expected$
 THEN RAISE EXCEPTION 'inquiry pipeline prerequisite drift or duplicate lineage'; END IF;
END $guard$;

LOCK TABLE crm_security.command_receipts,crm_security.inquiry_audit_events IN ACCESS EXCLUSIVE MODE;
ALTER FUNCTION public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)
 RENAME TO crm_write_command_v2_inquiry_response_20260906;
ALTER FUNCTION public.crm_write_command_v2_inquiry_response_20260906(uuid,text,uuid,integer,jsonb)
 SET SCHEMA crm_security;
REVOKE EXECUTE ON FUNCTION crm_security.crm_write_command_v2_inquiry_response_20260906(uuid,text,uuid,integer,jsonb)
 FROM PUBLIC,anon,authenticated,service_role;

ALTER TABLE crm_security.command_receipts DROP CONSTRAINT command_receipts_operation_check;
ALTER TABLE crm_security.command_receipts ADD CONSTRAINT command_receipts_operation_check CHECK(operation IN (
 'opportunity_work_set','inquiry_assign','service_change','inquiry_unassign','favorite_set','opportunity_touch',
 'next_action','activity','quote_version','next_action_complete','stage_check','transition','close','amount',
 'waiting_context','inquiry_reclassify','inquiry_status','inquiry_trash','inquiry_restore','inquiry_purge',
 'inquiry_followup','opportunity_create','lineage_link'));
ALTER TABLE crm_security.inquiry_audit_events DROP CONSTRAINT inquiry_audit_events_action_check;
ALTER TABLE crm_security.inquiry_audit_events ADD CONSTRAINT inquiry_audit_events_action_check CHECK(action IN (
 'direct_assign','direct_reassign','inquiry_unassign','inquiry_reclassify','inquiry_hold','inquiry_trash',
 'inquiry_restore','inquiry_purge','inquiry_followup','inquiry_response_progress','inquiry_response_next_week_retry',
 'inquiry_response_missed_retry','inquiry_pipeline_promote','inquiry_lineage_link'));

CREATE FUNCTION crm_security.crm_inquiry_pipeline_stage_v1(p_status text) RETURNS text
LANGUAGE sql IMMUTABLE STRICT SET search_path='' AS $fn$
 SELECT CASE WHEN p_status ~ '견적.*발송[[:space:]]*완료' THEN 'sent' ELSE 'consulting' END
$fn$;
CREATE FUNCTION crm_security.crm_inquiry_pipeline_reason_v1(p_status text) RETURNS text
LANGUAGE sql IMMUTABLE STRICT SET search_path='' AS $fn$
 SELECT CASE
  WHEN p_status ~ '견적.*발송[[:space:]]*완료' THEN '견적 발송완료로 파이프라인 인계'
  WHEN p_status ~ '견적.*발송' THEN '견적 준비 단계로 파이프라인 인계'
  ELSE btrim(p_status)||' 상태로 파이프라인 인계' END
$fn$;
REVOKE EXECUTE ON FUNCTION crm_security.crm_inquiry_pipeline_stage_v1(text) FROM PUBLIC,anon,authenticated,service_role;
REVOKE EXECUTE ON FUNCTION crm_security.crm_inquiry_pipeline_reason_v1(text) FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION crm_security.crm_inquiry_pipeline_promote_command_v1(
 p_request_id uuid,p_operation text,p_object_id uuid,p_expected_version integer,p_payload jsonb
) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $fn$
DECLARE
 a record; receipt crm_security.command_receipts%ROWTYPE;
 inquiry_row public.inquiries%ROWTYPE; deal_row public.deals%ROWTYPE; new_deal public.deals%ROWTYPE;
 canonical jsonb; ack jsonb; server_at timestamptz:=clock_timestamp(); mode_value text; status_value text;
 desired_stage text; reason_value text; inquiry_id_value uuid; opportunity_id_value uuid; amount_value bigint; site_target uuid;
 site_ids uuid[]; common_key text; broad_count integer; deal_target uuid:=gen_random_uuid();
 history_id uuid; activity_id uuid; audit_id uuid; inquiry_audit_id uuid; owner_review record;
 old_status text; old_stage text; old_version integer; is_create boolean:=p_operation='opportunity_create';
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;
 SELECT * INTO a FROM crm_security.actor();
 IF NOT FOUND OR a.permission_role<>'admin' THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;
 IF p_request_id IS NULL OR p_object_id IS NULL OR p_expected_version IS NULL OR p_expected_version<0
  OR p_operation NOT IN ('opportunity_create','transition') OR jsonb_typeof(p_payload) IS DISTINCT FROM 'object'
  OR NOT p_payload ?& ARRAY['intent','inquiry_id','promotion_mode','inquiry_status','owner','from','to','note']
  OR EXISTS(SELECT 1 FROM jsonb_object_keys(p_payload) k WHERE k NOT IN
   ('intent','inquiry_id','promotion_mode','inquiry_status','owner','from','to','note','amount','name','work_name','brand','site_id','client_ref','opportunity_id'))
 THEN RAISE EXCEPTION 'invalid inquiry promotion payload' USING ERRCODE='22023'; END IF;
 IF NOT is_create THEN
  BEGIN opportunity_id_value:=(p_payload->>'opportunity_id')::uuid;
  EXCEPTION WHEN invalid_text_representation THEN RAISE EXCEPTION 'invalid opportunity id' USING ERRCODE='22023'; END;
 END IF;
 IF (is_create AND (p_payload->>'intent'<>'inquiry_promote_create' OR p_object_id<>p_request_id OR p_expected_version<>0))
  OR (NOT is_create AND p_payload->>'intent'<>'inquiry_promote_existing')
  OR (NOT is_create AND opportunity_id_value IS DISTINCT FROM p_object_id)
 THEN RAISE EXCEPTION 'invalid inquiry promotion intent' USING ERRCODE='22023'; END IF;
 BEGIN inquiry_id_value:=(p_payload->>'inquiry_id')::uuid; EXCEPTION WHEN invalid_text_representation THEN RAISE EXCEPTION 'invalid inquiry id' USING ERRCODE='22023'; END;
 mode_value:=p_payload->>'promotion_mode';status_value:=btrim(p_payload->>'inquiry_status');
 IF mode_value NOT IN ('auto','manual') OR length(status_value) NOT BETWEEN 1 AND 100 OR status_value !~ '견적.*발송'
  OR p_payload->>'to' IS DISTINCT FROM crm_security.crm_inquiry_pipeline_stage_v1(status_value)
  OR length(coalesce(p_payload->>'owner','')) NOT BETWEEN 1 AND 100
  OR length(coalesce(p_payload->>'note','')) NOT BETWEEN 1 AND 2000
 THEN RAISE EXCEPTION 'invalid inquiry promotion values' USING ERRCODE='22023'; END IF;
 IF p_payload ? 'amount' AND jsonb_typeof(p_payload->'amount') NOT IN ('number','null') THEN RAISE EXCEPTION 'invalid inquiry promotion amount' USING ERRCODE='22023'; END IF;
 IF p_payload->>'amount' IS NOT NULL THEN
  IF (p_payload->>'amount') !~ '^[0-9]+$' OR (p_payload->>'amount')::numeric>9007199254740991 THEN RAISE EXCEPTION 'invalid inquiry promotion amount' USING ERRCODE='22023'; END IF;
  amount_value:=(p_payload->>'amount')::bigint;
 END IF;
 desired_stage:=crm_security.crm_inquiry_pipeline_stage_v1(status_value);
 reason_value:=crm_security.crm_inquiry_pipeline_reason_v1(status_value);
 IF p_payload->>'note' IS DISTINCT FROM reason_value THEN RAISE EXCEPTION 'promotion reason conflict' USING ERRCODE='PT409'; END IF;
 canonical:=jsonb_strip_nulls(jsonb_build_object('intent',p_payload->>'intent','inquiry_id',inquiry_id_value,
  'promotion_mode',mode_value,'inquiry_status',status_value,'owner',btrim(p_payload->>'owner'),
  'from',p_payload->>'from','to',desired_stage,'note',reason_value,'amount',p_payload->'amount',
  'name',nullif(btrim(coalesce(p_payload->>'name','')),''),'work_name',nullif(btrim(coalesce(p_payload->>'work_name','')),''),
  'brand',nullif(btrim(coalesce(p_payload->>'brand','')),''),'site_id',p_payload->'site_id',
  'client_ref',nullif(btrim(coalesce(p_payload->>'client_ref','')),'')));

 PERFORM pg_advisory_xact_lock(hashtextextended('inquiry-pipeline:'||inquiry_id_value::text,0));
 PERFORM 1 FROM crm_security.object_scope s WHERE s.user_id=a.user_id AND s.inquiry_id=inquiry_id_value FOR SHARE;
 SELECT * INTO inquiry_row FROM public.inquiries i WHERE i.id=inquiry_id_value FOR UPDATE;
 IF NOT FOUND OR NOT crm_security.can_inquiry(inquiry_id_value)
  OR coalesce(inquiry_row.brand,'')='기술자문' OR coalesce(inquiry_row.inquiry_type,'') ~ '기술자문'
  OR coalesce(inquiry_row.status,'') IN ('수주','실주','배드핏','연락두절','종결','종료')
  OR inquiry_row.assigned_to IS NULL
 THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;
 SELECT u.user_id,u.name,u.email,r.permission_role INTO owner_review
 FROM public.users u JOIN crm_security.access_review r ON r.user_id=u.user_id AND r.reviewed_auth_uid=u.auth_uid
 WHERE u.user_id=inquiry_row.assigned_to AND u.active AND u.auth_uid IS NOT NULL AND r.source_role=u.role
  AND r.approved AND r.expires_at>server_at;
 IF NOT FOUND OR owner_review.permission_role<>'rep' OR owner_review.name IS DISTINCT FROM btrim(p_payload->>'owner')
 THEN RAISE EXCEPTION 'inquiry owner is not an approved head-office rep' USING ERRCODE='42501'; END IF;
 IF mode_value='manual' AND inquiry_row.status IS DISTINCT FROM status_value THEN RAISE EXCEPTION 'inquiry status conflict' USING ERRCODE='PT409'; END IF;
 old_status:=inquiry_row.status;

 PERFORM pg_advisory_xact_lock(hashtextextended(a.auth_uid::text||p_request_id::text,0));
 SELECT * INTO receipt FROM crm_security.command_receipts r WHERE r.actor_auth_uid=a.auth_uid AND r.request_id=p_request_id;
 IF FOUND THEN
  IF receipt.actor_user_id IS DISTINCT FROM a.user_id OR receipt.operation IS DISTINCT FROM p_operation
   OR receipt.object_id IS DISTINCT FROM p_object_id OR receipt.expected_version IS DISTINCT FROM p_expected_version
   OR receipt.payload IS DISTINCT FROM canonical
  THEN RAISE EXCEPTION 'REQUEST_ID_REUSE' USING ERRCODE='PT409'; END IF;
  RETURN receipt.ack||jsonb_build_object('replayed',true);
 END IF;

 IF is_create THEN
  IF EXISTS(SELECT 1 FROM public.deals d WHERE d.origin_inquiry_id=inquiry_id_value)
   OR inquiry_row.deal_id IS NOT NULL OR inquiry_row.opportunity_id IS NOT NULL
  THEN RAISE EXCEPTION 'inquiry already linked' USING ERRCODE='PT409'; END IF;
  IF coalesce(p_payload->>'from','')<>'' THEN RAISE EXCEPTION 'invalid create source stage' USING ERRCODE='22023'; END IF;
  IF inquiry_row.site_id IS NOT NULL THEN
   SELECT s.site_id INTO site_target FROM public.sites s WHERE s.site_id=inquiry_row.site_id FOR UPDATE;
   IF site_target IS NULL THEN RAISE EXCEPTION 'inquiry site not found' USING ERRCODE='PT409'; END IF;
  ELSE
   common_key:=crm_security.crm_site_common_key_v1(inquiry_row.site_name);
   IF common_key='' THEN RAISE EXCEPTION 'empty inquiry site identity' USING ERRCODE='22023'; END IF;
   PERFORM pg_advisory_xact_lock(hashtextextended('site:'||common_key,0));
   SELECT array_agg(s.site_id ORDER BY s.site_id) INTO site_ids FROM public.sites s
    WHERE crm_security.crm_site_common_key_v1(s.site_name)=common_key;
   IF coalesce(array_length(site_ids,1),0)>1 THEN RAISE EXCEPTION 'SITE_NORMALIZATION_AMBIGUOUS' USING ERRCODE='PT409'; END IF;
   IF coalesce(array_length(site_ids,1),0)=1 THEN site_target:=site_ids[1];
   ELSE
    SELECT count(*) INTO broad_count FROM public.sites s WHERE
     crm_security.crm_site_pc_key_v1(s.site_name)=crm_security.crm_site_pc_key_v1(inquiry_row.site_name)
     OR crm_security.crm_site_mobile_key_v1(s.site_name)=crm_security.crm_site_mobile_key_v1(inquiry_row.site_name)
     OR s.norm_name='crm:v1:'||common_key;
    IF broad_count>0 THEN RAISE EXCEPTION 'SITE_MATCH_REQUIRES_EXPLICIT_SELECTION' USING ERRCODE='PT409'; END IF;
    INSERT INTO public.sites(site_name,norm_name,address) VALUES(inquiry_row.site_name,'crm:v1:'||common_key,inquiry_row.address)
     RETURNING site_id INTO site_target;
   END IF;
  END IF;
  IF p_payload->>'site_id' IS NOT NULL AND (p_payload->>'site_id')::uuid IS DISTINCT FROM site_target
  THEN RAISE EXCEPTION 'inquiry site conflict' USING ERRCODE='PT409'; END IF;
  IF nullif(btrim(coalesce(p_payload->>'name','')),'') IS DISTINCT FROM btrim(inquiry_row.site_name)
   OR nullif(btrim(coalesce(p_payload->>'brand','')),'') IS DISTINCT FROM inquiry_row.brand
  THEN RAISE EXCEPTION 'inquiry snapshot conflict' USING ERRCODE='PT409'; END IF;
  INSERT INTO public.deals(id,brand,list_name,stage_code,stage_raw,stage_group,assignee_name,assignee_email,amount,
   source,list_fields,created_at,updated_at,site_id,owner_id,origin_inquiry_id,lifecycle_status,stage_entered_at,
   last_activity_at,opened_at,version,service_type,origin_business,current_business)
  VALUES(deal_target,inquiry_row.brand,inquiry_row.brand,desired_stage,desired_stage,
   CASE WHEN desired_stage='sent' THEN 'sent' ELSE 'design' END,owner_review.name,owner_review.email,amount_value,
   'inquiry_promotion',jsonb_strip_nulls(jsonb_build_object('work_name',coalesce(nullif(btrim(coalesce(p_payload->>'work_name','')),''),inquiry_row.work_type),
    'create_surface','pc','client_ref',p_payload->>'client_ref','promotion_mode',mode_value)),server_at,server_at,
   site_target,owner_review.user_id,inquiry_id_value,'active',server_at,server_at,server_at,1,
   inquiry_row.brand,inquiry_row.brand,inquiry_row.brand) RETURNING * INTO new_deal;
  old_stage:=NULL;old_version:=0;
 ELSE
  SELECT * INTO deal_row FROM public.deals d WHERE d.id=p_object_id FOR UPDATE;
  IF NOT FOUND OR NOT crm_security.can_deal(p_object_id,true) OR deal_row.outcome IS NOT NULL OR deal_row.lifecycle_status='closed'
   OR deal_row.version IS DISTINCT FROM p_expected_version OR deal_row.stage_code IS DISTINCT FROM p_payload->>'from'
   OR deal_row.owner_id IS DISTINCT FROM inquiry_row.assigned_to
   OR deal_row.origin_inquiry_id IS NOT NULL AND deal_row.origin_inquiry_id IS DISTINCT FROM inquiry_id_value
   OR EXISTS(SELECT 1 FROM public.deals d WHERE d.origin_inquiry_id=inquiry_id_value AND d.id<>p_object_id)
  THEN RAISE EXCEPTION 'promotion deal state conflict' USING ERRCODE='PT409'; END IF;
  IF inquiry_row.site_id IS NOT NULL AND deal_row.site_id IS DISTINCT FROM inquiry_row.site_id
  THEN RAISE EXCEPTION 'promotion site conflict' USING ERRCODE='PT409'; END IF;
  IF (CASE desired_stage WHEN 'consulting' THEN 2 WHEN 'sent' THEN 3 ELSE 0 END) <=
     (CASE deal_row.stage_code WHEN 'first_contact' THEN 1 WHEN 'consulting' THEN 2 WHEN 'sent' THEN 3
      WHEN 'rapport' THEN 4 WHEN 'silent' THEN 5 WHEN 'compete' THEN 6 WHEN 'imminent' THEN 7 WHEN 'bidding' THEN 8
      WHEN 'contract' THEN 9 WHEN 'construction' THEN 10 WHEN 'completion' THEN 11 ELSE 99 END)
  THEN RAISE EXCEPTION 'promotion is not forward' USING ERRCODE='PT409'; END IF;
  old_stage:=deal_row.stage_code;old_version:=deal_row.version;deal_target:=deal_row.id;site_target:=deal_row.site_id;
  UPDATE public.deals SET origin_inquiry_id=coalesce(origin_inquiry_id,inquiry_id_value),stage_code=desired_stage,
   stage_raw=desired_stage,stage_group=CASE WHEN desired_stage='sent' THEN 'sent' ELSE 'design' END,
   amount=coalesce(amount_value,amount),stage_entered_at=server_at,last_activity_at=server_at,updated_at=server_at,
   version=version+1 WHERE id=p_object_id AND version=p_expected_version RETURNING * INTO new_deal;
  IF NOT FOUND THEN RAISE EXCEPTION 'unexpected version mutation' USING ERRCODE='PT409'; END IF;
 END IF;

 IF mode_value='auto' THEN UPDATE public.inquiries SET status=status_value,qualified_at=coalesce(qualified_at,server_at),updated_at=server_at WHERE id=inquiry_id_value;
 ELSE UPDATE public.inquiries SET qualified_at=coalesce(qualified_at,server_at),updated_at=server_at WHERE id=inquiry_id_value; END IF;
 INSERT INTO public.stage_history(opportunity_id,inquiry_id,from_stage,to_stage,reason,actor_id,actor_name,changed_at)
 VALUES(deal_target,inquiry_id_value,old_stage,desired_stage,reason_value,a.user_id,a.display_name,server_at) RETURNING id INTO history_id;
 INSERT INTO public.activities(deal_id,organization_id,actor_email,actor_name,type,detail,occurred_at)
 VALUES(deal_target,new_deal.organization_id,(SELECT email FROM public.users WHERE user_id=a.user_id),a.display_name,'파이프라인 인계',
  jsonb_build_object('note',reason_value,'result',CASE WHEN is_create THEN '신규 Deal 생성' ELSE '기존 Deal 단계 전환' END,
   'origin_inquiry_id',inquiry_id_value,'promotion_mode',mode_value,'meaningful_contact',false),server_at) RETURNING id INTO activity_id;
 INSERT INTO crm_security.audit_events(actor_auth_uid,actor_user_id,actor_name,deal_id,action,before_data,after_data,reason,created_at)
 VALUES(a.auth_uid,a.user_id,a.display_name,deal_target,'inquiry_pipeline_promote',
  jsonb_build_object('inquiry_status',old_status,'stage_code',old_stage,'version',old_version),
  jsonb_build_object('inquiry_id',inquiry_id_value,'inquiry_status',CASE WHEN mode_value='auto' THEN status_value ELSE old_status END,
   'stage_code',new_deal.stage_code,'version',new_deal.version,'site_id',site_target,'owner_id',new_deal.owner_id,
   'stage_history_id',history_id,'activity_id',activity_id,'promotion_mode',mode_value),reason_value,server_at)
 RETURNING event_id INTO audit_id;
 INSERT INTO crm_security.inquiry_audit_events(actor_auth_uid,actor_user_id,inquiry_id,action,before_data,after_data,reason,created_at)
 VALUES(a.auth_uid,a.user_id,inquiry_id_value,'inquiry_pipeline_promote',
  jsonb_build_object('status',old_status),jsonb_build_object('status',CASE WHEN mode_value='auto' THEN status_value ELSE old_status END,
   'deal_id',deal_target,'stage_code',new_deal.stage_code,'stage_history_id',history_id,'activity_id',activity_id),reason_value,server_at)
 RETURNING event_id INTO inquiry_audit_id;
 IF a.permission_role='admin' THEN
  INSERT INTO crm_security.object_scope(scope_id,user_id,deal_id,can_write,reviewed_by,expires_at)
  VALUES(gen_random_uuid(),a.user_id,deal_target,true,'inquiry_pipeline:'||p_request_id::text,
   (SELECT expires_at FROM crm_security.access_review WHERE user_id=a.user_id)) ON CONFLICT DO NOTHING;
 END IF;
 ack:=jsonb_build_object('contract_version',1,'ok',true,'request_id',p_request_id,'operation',p_operation,'object_id',p_object_id,
  'intent',p_payload->>'intent','inquiry_id',inquiry_id_value,'new_opportunity_id',CASE WHEN is_create THEN deal_target ELSE NULL END,
  'opportunity_id',deal_target,'site_id',site_target,'owner_id',new_deal.owner_id,'from_stage',old_stage,'to_stage',new_deal.stage_code,
  'previous_version',old_version,'version',new_deal.version,'inquiry_status',CASE WHEN mode_value='auto' THEN status_value ELSE old_status END,
  'stage_history_id',history_id,'activity_id',activity_id,'audit_event_id',audit_id,'inquiry_audit_event_id',inquiry_audit_id,
  'server_at',server_at,'actor_auth_uid',a.auth_uid,'actor_user_id',a.user_id,'replayed',false);
 INSERT INTO crm_security.command_receipts(actor_auth_uid,request_id,actor_user_id,operation,object_id,expected_version,payload,ack,created_at)
 VALUES(a.auth_uid,p_request_id,a.user_id,p_operation,p_object_id,p_expected_version,canonical,ack,server_at);
 RETURN ack;
END $fn$;
REVOKE EXECUTE ON FUNCTION crm_security.crm_inquiry_pipeline_promote_command_v1(uuid,text,uuid,integer,jsonb)
 FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION crm_security.crm_inquiry_lineage_link_command_v1(
 p_request_id uuid,p_object_id uuid,p_expected_version integer,p_payload jsonb
) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $fn$
DECLARE a record; receipt crm_security.command_receipts%ROWTYPE; inquiry_row public.inquiries%ROWTYPE;
 old_deal public.deals%ROWTYPE; new_deal public.deals%ROWTYPE; inquiry_id_value uuid; canonical jsonb; ack jsonb;
 server_at timestamptz:=clock_timestamp(); audit_id uuid; inquiry_audit_id uuid;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;
 SELECT * INTO a FROM crm_security.actor();IF NOT FOUND OR a.permission_role<>'admin' THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;
 IF p_request_id IS NULL OR p_object_id IS NULL OR p_expected_version IS NULL OR p_expected_version<0
  OR jsonb_typeof(p_payload) IS DISTINCT FROM 'object' OR NOT p_payload ? 'inquiry_id'
  OR EXISTS(SELECT 1 FROM jsonb_object_keys(p_payload) k WHERE k NOT IN ('intent','inquiry_id','site_id','inquiry_site'))
  OR coalesce(p_payload->>'intent','lineage_link')<>'lineage_link'
 THEN RAISE EXCEPTION 'invalid lineage link payload' USING ERRCODE='22023'; END IF;
 BEGIN inquiry_id_value:=(p_payload->>'inquiry_id')::uuid; EXCEPTION WHEN invalid_text_representation THEN RAISE EXCEPTION 'invalid inquiry id' USING ERRCODE='22023'; END;
 canonical:=jsonb_build_object('intent','lineage_link','inquiry_id',inquiry_id_value);
 PERFORM pg_advisory_xact_lock(hashtextextended('inquiry-pipeline:'||inquiry_id_value::text,0));
 PERFORM 1 FROM crm_security.object_scope s WHERE s.user_id=a.user_id AND s.inquiry_id=inquiry_id_value FOR SHARE;
 PERFORM 1 FROM crm_security.object_scope s WHERE s.user_id=a.user_id AND s.deal_id=p_object_id FOR SHARE;
 SELECT * INTO inquiry_row FROM public.inquiries i WHERE i.id=inquiry_id_value FOR UPDATE;
 SELECT * INTO old_deal FROM public.deals d WHERE d.id=p_object_id FOR UPDATE;
 IF inquiry_row.id IS NULL OR old_deal.id IS NULL OR NOT crm_security.can_inquiry(inquiry_id_value) OR NOT crm_security.can_deal(p_object_id,true)
  OR inquiry_row.site_id IS NULL OR old_deal.site_id IS DISTINCT FROM inquiry_row.site_id
  OR old_deal.created_at<coalesce(inquiry_row.received_at,inquiry_row.created_at)
  OR old_deal.origin_inquiry_id IS NOT NULL AND old_deal.origin_inquiry_id IS DISTINCT FROM inquiry_id_value
  OR EXISTS(SELECT 1 FROM public.deals d WHERE d.origin_inquiry_id=inquiry_id_value AND d.id<>p_object_id)
  OR inquiry_row.deal_id IS NOT NULL AND inquiry_row.deal_id<>p_object_id
  OR inquiry_row.opportunity_id IS NOT NULL AND inquiry_row.opportunity_id<>p_object_id
 THEN RAISE EXCEPTION 'lineage link conflict' USING ERRCODE='PT409'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(a.auth_uid::text||p_request_id::text,0));
 SELECT * INTO receipt FROM crm_security.command_receipts r WHERE r.actor_auth_uid=a.auth_uid AND r.request_id=p_request_id;
 IF FOUND THEN
  IF receipt.actor_user_id IS DISTINCT FROM a.user_id OR receipt.operation<>'lineage_link' OR receipt.object_id<>p_object_id
   OR receipt.expected_version<>p_expected_version OR receipt.payload IS DISTINCT FROM canonical
  THEN RAISE EXCEPTION 'REQUEST_ID_REUSE' USING ERRCODE='PT409'; END IF;
  RETURN receipt.ack||jsonb_build_object('replayed',true);
 END IF;
 IF old_deal.version<>p_expected_version THEN RAISE EXCEPTION 'version conflict' USING ERRCODE='PT409'; END IF;
 IF old_deal.origin_inquiry_id IS NULL THEN
  UPDATE public.deals SET origin_inquiry_id=inquiry_id_value,updated_at=server_at,version=version+1
  WHERE id=p_object_id AND version=p_expected_version RETURNING * INTO new_deal;
 ELSE new_deal:=old_deal; END IF;
 INSERT INTO crm_security.audit_events(actor_auth_uid,actor_user_id,actor_name,deal_id,action,before_data,after_data,reason,created_at)
 VALUES(a.auth_uid,a.user_id,a.display_name,p_object_id,'inquiry_lineage_link',
  jsonb_build_object('origin_inquiry_id',old_deal.origin_inquiry_id,'version',old_deal.version),
  jsonb_build_object('origin_inquiry_id',inquiry_id_value,'version',new_deal.version),'관리자 확인 lineage 연결',server_at)
 RETURNING event_id INTO audit_id;
 INSERT INTO crm_security.inquiry_audit_events(actor_auth_uid,actor_user_id,inquiry_id,action,before_data,after_data,reason,created_at)
 VALUES(a.auth_uid,a.user_id,inquiry_id_value,'inquiry_lineage_link','{}'::jsonb,
  jsonb_build_object('deal_id',p_object_id,'version',new_deal.version),'관리자 확인 lineage 연결',server_at)
 RETURNING event_id INTO inquiry_audit_id;
 ack:=jsonb_build_object('contract_version',1,'ok',true,'request_id',p_request_id,'operation','lineage_link','object_id',p_object_id,
  'intent','lineage_link','inquiry_id',inquiry_id_value,'opportunity_id',p_object_id,'previous_version',old_deal.version,
  'version',new_deal.version,'changed',old_deal.origin_inquiry_id IS NULL,'audit_event_id',audit_id,
  'inquiry_audit_event_id',inquiry_audit_id,'server_at',server_at,'actor_auth_uid',a.auth_uid,'actor_user_id',a.user_id,'replayed',false);
 INSERT INTO crm_security.command_receipts(actor_auth_uid,request_id,actor_user_id,operation,object_id,expected_version,payload,ack,created_at)
 VALUES(a.auth_uid,p_request_id,a.user_id,'lineage_link',p_object_id,p_expected_version,canonical,ack,server_at);
 RETURN ack;
END $fn$;
REVOKE EXECUTE ON FUNCTION crm_security.crm_inquiry_lineage_link_command_v1(uuid,uuid,integer,jsonb)
 FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION public.crm_write_command_v2(
 p_request_id uuid,p_operation text,p_object_id uuid,p_expected_version integer,p_payload jsonb
) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $fn$
BEGIN
 IF p_operation IN ('opportunity_create','transition') AND p_payload->>'intent' IN ('inquiry_promote_create','inquiry_promote_existing')
 THEN RETURN crm_security.crm_inquiry_pipeline_promote_command_v1(p_request_id,p_operation,p_object_id,p_expected_version,p_payload); END IF;
 IF p_operation='lineage_link' THEN
  RETURN crm_security.crm_inquiry_lineage_link_command_v1(p_request_id,p_object_id,p_expected_version,p_payload); END IF;
 RETURN crm_security.crm_write_command_v2_inquiry_response_20260906(p_request_id,p_operation,p_object_id,p_expected_version,p_payload);
END $fn$;
REVOKE EXECUTE ON FUNCTION public.crm_write_command_v2(uuid,text,uuid,integer,jsonb) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.crm_write_command_v2(uuid,text,uuid,integer,jsonb) TO authenticated;

DO $post$ BEGIN
 IF has_function_privilege('public','public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)','EXECUTE')
  OR has_function_privilege('anon','public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)','EXECUTE')
  OR NOT has_function_privilege('authenticated','public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)','EXECUTE')
  OR has_function_privilege('service_role','public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)','EXECUTE')
  OR has_function_privilege('authenticated','crm_security.crm_inquiry_pipeline_promote_command_v1(uuid,text,uuid,integer,jsonb)','EXECUTE')
  OR has_function_privilege('authenticated','crm_security.crm_inquiry_lineage_link_command_v1(uuid,uuid,integer,jsonb)','EXECUTE')
 THEN RAISE EXCEPTION 'inquiry pipeline post-apply ACL drift'; END IF;
END $post$;
-- ===== APPLY PC INQUIRY STAGE PROGRESS =====
-- LOCAL REVIEW CANDIDATE ONLY. Staging approval is required.

-- LOCAL CANDIDATE ONLY. Connects the reachable PC inquiry non-terminal progress form.
SET LOCAL crm.inquiry_stage_progress_ref='rprechiaglyjaydkmxsu';
SET LOCAL search_path=pg_catalog;
SET LOCAL lock_timeout='3s';
SET LOCAL statement_timeout='60s';

DO $guard$ BEGIN
 IF current_user<>'postgres'
  OR current_setting('crm.inquiry_stage_progress_ref',true) IS DISTINCT FROM 'rprechiaglyjaydkmxsu'
  OR to_regprocedure('public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)') IS NULL
  OR to_regprocedure('crm_security.crm_inquiry_pipeline_promote_command_v1(uuid,text,uuid,integer,jsonb)') IS NULL
  OR to_regprocedure('crm_security.crm_operational_source_fragment_v1(text,uuid,integer)') IS NULL
  OR to_regprocedure('crm_security.crm_write_command_v2_inquiry_pipeline_20260906(uuid,text,uuid,integer,jsonb)') IS NOT NULL
  OR to_regprocedure('crm_security.crm_operational_source_fragment_pre_inquiry_stage_progress_20260906(text,uuid,integer)') IS NOT NULL
  OR to_regprocedure('crm_security.crm_inquiry_stage_progress_command_v1(uuid,uuid,jsonb)') IS NOT NULL
  OR (SELECT pg_get_constraintdef(oid,true) FROM pg_constraint
      WHERE conrelid='crm_security.command_receipts'::regclass AND conname='command_receipts_operation_check')
     IS DISTINCT FROM $expected$CHECK (operation = ANY (ARRAY['opportunity_work_set'::text, 'inquiry_assign'::text, 'service_change'::text, 'inquiry_unassign'::text, 'favorite_set'::text, 'opportunity_touch'::text, 'next_action'::text, 'activity'::text, 'quote_version'::text, 'next_action_complete'::text, 'stage_check'::text, 'transition'::text, 'close'::text, 'amount'::text, 'waiting_context'::text, 'inquiry_reclassify'::text, 'inquiry_status'::text, 'inquiry_trash'::text, 'inquiry_restore'::text, 'inquiry_purge'::text, 'inquiry_followup'::text, 'opportunity_create'::text, 'lineage_link'::text]))$expected$
  OR (SELECT pg_get_constraintdef(oid,true) FROM pg_constraint
      WHERE conrelid='crm_security.inquiry_audit_events'::regclass AND conname='inquiry_audit_events_action_check')
     IS DISTINCT FROM $expected$CHECK (action = ANY (ARRAY['direct_assign'::text, 'direct_reassign'::text, 'inquiry_unassign'::text, 'inquiry_reclassify'::text, 'inquiry_hold'::text, 'inquiry_trash'::text, 'inquiry_restore'::text, 'inquiry_purge'::text, 'inquiry_followup'::text, 'inquiry_response_progress'::text, 'inquiry_response_next_week_retry'::text, 'inquiry_response_missed_retry'::text, 'inquiry_pipeline_promote'::text, 'inquiry_lineage_link'::text]))$expected$
 THEN RAISE EXCEPTION 'inquiry stage progress prerequisite drift'; END IF;
END $guard$;

LOCK TABLE crm_security.command_receipts,crm_security.inquiry_audit_events IN ACCESS EXCLUSIVE MODE;
ALTER FUNCTION public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)
 RENAME TO crm_write_command_v2_inquiry_pipeline_20260906;
ALTER FUNCTION public.crm_write_command_v2_inquiry_pipeline_20260906(uuid,text,uuid,integer,jsonb)
 SET SCHEMA crm_security;
REVOKE EXECUTE ON FUNCTION crm_security.crm_write_command_v2_inquiry_pipeline_20260906(uuid,text,uuid,integer,jsonb)
 FROM PUBLIC,anon,authenticated,service_role;
ALTER FUNCTION crm_security.crm_operational_source_fragment_v1(text,uuid,integer)
 RENAME TO crm_operational_source_fragment_pre_inquiry_stage_progress_20260906;
REVOKE EXECUTE ON FUNCTION crm_security.crm_operational_source_fragment_pre_inquiry_stage_progress_20260906(text,uuid,integer)
 FROM PUBLIC,anon,authenticated,service_role;

ALTER TABLE crm_security.inquiry_audit_events DROP CONSTRAINT inquiry_audit_events_action_check;
ALTER TABLE crm_security.inquiry_audit_events ADD CONSTRAINT inquiry_audit_events_action_check CHECK(action IN (
 'direct_assign','direct_reassign','inquiry_unassign','inquiry_reclassify','inquiry_hold','inquiry_trash',
 'inquiry_restore','inquiry_purge','inquiry_followup','inquiry_response_progress','inquiry_response_next_week_retry',
 'inquiry_response_missed_retry','inquiry_pipeline_promote','inquiry_lineage_link','inquiry_stage_progress'));

CREATE FUNCTION crm_security.crm_inquiry_stage_progress_command_v1(
 p_request_id uuid,p_inquiry_id uuid,p_payload jsonb
) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $fn$
DECLARE
 a record; receipt crm_security.command_receipts%ROWTYPE;
 oldrow public.inquiries%ROWTYPE; newrow public.inquiries%ROWTYPE;
 canonical jsonb; ack jsonb; server_at timestamptz:=clock_timestamp(); today_kst date;
 from_status_value text; target_value text; to_status_value text; from_stage_value text; to_stage_value text;
 did_value text; result_value text; next_value text; due_value date; owner_name_value text;
 history_id uuid; next_id uuid; audit_id uuid; cancelled_ids jsonb:='[]'::jsonb; latest_management text;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;
 PERFORM 1 FROM public.users u WHERE u.auth_uid=auth.uid() FOR SHARE;
 PERFORM 1 FROM crm_security.access_review r WHERE r.reviewed_auth_uid=auth.uid() FOR SHARE;
 SELECT * INTO a FROM crm_security.actor();
 IF NOT FOUND THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;
 IF p_request_id IS NULL OR p_inquiry_id IS NULL OR jsonb_typeof(p_payload) IS DISTINCT FROM 'object'
  OR EXISTS(SELECT 1 FROM jsonb_object_keys(p_payload) k WHERE k NOT IN ('intent','from_status','target','did','result','next','due'))
  OR NOT p_payload ?& ARRAY['intent','from_status','target','did','result','next','due']
 THEN RAISE EXCEPTION 'invalid inquiry stage progress payload' USING ERRCODE='22023'; END IF;
 from_status_value:=btrim(p_payload->>'from_status');target_value:=p_payload->>'target';
 did_value:=btrim(p_payload->>'did');result_value:=btrim(p_payload->>'result');next_value:=btrim(p_payload->>'next');
 IF p_payload->>'intent'<>'progress' OR target_value !~ '^step:[0-5]$'
  OR length(from_status_value)<1 OR length(from_status_value)>200
  OR length(did_value)<1 OR length(did_value)>8000 OR length(result_value)<1 OR length(result_value)>8000
  OR length(next_value)<1 OR length(next_value)>500 OR p_payload->>'due' !~ '^\d{4}-\d{2}-\d{2}$'
 THEN RAISE EXCEPTION 'invalid inquiry stage progress payload' USING ERRCODE='22023'; END IF;
 BEGIN due_value:=(p_payload->>'due')::date; EXCEPTION WHEN datetime_field_overflow THEN RAISE EXCEPTION 'invalid inquiry next date' USING ERRCODE='22023'; END;
 IF due_value::text<>p_payload->>'due' THEN RAISE EXCEPTION 'invalid inquiry next date' USING ERRCODE='22023'; END IF;
 today_kst:=(server_at AT TIME ZONE 'Asia/Seoul')::date;
 IF due_value<today_kst OR due_value>today_kst+3650 THEN RAISE EXCEPTION 'invalid inquiry next date' USING ERRCODE='22023'; END IF;
 to_status_value:=(ARRAY['접수','전화응대 완료','견적서 발송완료','초기 집중관리','경쟁·임박·입찰','계약·공사 예정'])[substring(target_value from 6)::integer+1];
 to_stage_value:=(ARRAY['견적문의 접수','응대·컨설팅','견적서 발송','영업·관리 (유대·대기)','경쟁·임박','계약·시공'])[substring(target_value from 6)::integer+1];
 canonical:=jsonb_build_object('intent','progress','from_status',from_status_value,'target',target_value,
  'did',did_value,'result',result_value,'next',next_value,'due',due_value);

 PERFORM 1 FROM crm_security.object_scope s WHERE s.user_id=a.user_id AND s.inquiry_id=p_inquiry_id FOR SHARE;
 SELECT * INTO oldrow FROM public.inquiries i WHERE i.id=p_inquiry_id FOR UPDATE;
 IF NOT FOUND OR NOT crm_security.can_inquiry(p_inquiry_id)
  OR a.permission_role NOT IN ('rep','consultation','admin')
  OR (a.permission_role<>'admin' AND oldrow.assigned_to IS DISTINCT FROM a.user_id)
  OR coalesce(oldrow.inquiry_type,'')='기술자문' OR coalesce(oldrow.brand,'')='기술자문'
 THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;
 SELECT e.action INTO latest_management FROM crm_security.inquiry_audit_events e
  WHERE e.inquiry_id=p_inquiry_id AND e.action IN ('inquiry_trash','inquiry_restore','inquiry_purge')
  ORDER BY e.created_at DESC,e.event_id DESC LIMIT 1;
 IF latest_management IN ('inquiry_trash','inquiry_purge')
  OR coalesce(oldrow.status,'') IN ('수주','실주','배드핏','연락두절','종결','종료','보류')
 THEN RAISE EXCEPTION 'inquiry stage state conflict' USING ERRCODE='PT409'; END IF;

 PERFORM pg_advisory_xact_lock(hashtextextended(a.auth_uid::text||p_request_id::text,0));
 SELECT * INTO receipt FROM crm_security.command_receipts r WHERE r.actor_auth_uid=a.auth_uid AND r.request_id=p_request_id;
 IF FOUND THEN
  IF receipt.actor_user_id IS DISTINCT FROM a.user_id OR receipt.operation IS DISTINCT FROM 'inquiry_status'
   OR receipt.object_id IS DISTINCT FROM p_inquiry_id OR receipt.expected_version IS DISTINCT FROM 0
   OR receipt.payload IS DISTINCT FROM canonical
  THEN RAISE EXCEPTION 'REQUEST_ID_REUSE' USING ERRCODE='PT409'; END IF;
  RETURN receipt.ack||jsonb_build_object('replayed',true);
 END IF;
 IF oldrow.status IS DISTINCT FROM from_status_value OR oldrow.status=to_status_value
 THEN RAISE EXCEPTION 'inquiry stage state conflict' USING ERRCODE='PT409'; END IF;
 from_stage_value:=CASE
  WHEN oldrow.status ~ '견적.*발송[[:space:]]*완료' THEN '견적서 발송'
  WHEN oldrow.status ~ '초기|유대|침묵|보류' THEN '영업·관리 (유대·대기)'
  WHEN oldrow.status ~ '경쟁|임박|입찰|PT' THEN '경쟁·임박'
  WHEN oldrow.status ~ '계약|공사|시공' THEN '계약·시공'
  WHEN oldrow.status ~ '전화|현장|방문|응대|견적' THEN '응대·컨설팅'
  ELSE '견적문의 접수' END;
 SELECT coalesce(u.name,oldrow.assignee_name) INTO owner_name_value FROM public.users u WHERE u.user_id=oldrow.assigned_to;
 IF owner_name_value IS NULL THEN RAISE EXCEPTION 'No approved UUID inquiry owner' USING ERRCODE='42501'; END IF;
 SELECT coalesce(jsonb_agg(id ORDER BY created_at,id),'[]'::jsonb) INTO cancelled_ids
  FROM public.next_actions WHERE inquiry_id=p_inquiry_id AND status='open';
 UPDATE public.next_actions SET status='cancelled',updated_at=server_at WHERE inquiry_id=p_inquiry_id AND status='open';
 INSERT INTO public.next_actions(inquiry_id,action_type,title,due_at,assignee_name,status,created_at,updated_at)
 VALUES(p_inquiry_id,'전화',next_value,due_value::timestamp AT TIME ZONE 'Asia/Seoul',owner_name_value,'open',server_at,server_at)
 RETURNING id INTO next_id;
 INSERT INTO public.stage_history(inquiry_id,from_stage,to_stage,reason,actor_id,actor_name,changed_at)
 VALUES(p_inquiry_id,from_stage_value,to_stage_value,result_value,a.user_id,a.display_name,server_at) RETURNING id INTO history_id;
 UPDATE public.inquiries SET status=to_status_value,first_response_at=coalesce(first_response_at,server_at),
  responded_at=server_at,next_action_date=due_value,updated_at=server_at WHERE id=p_inquiry_id RETURNING * INTO newrow;
 INSERT INTO crm_security.inquiry_audit_events(actor_auth_uid,actor_user_id,inquiry_id,action,before_data,after_data,reason,created_at)
 VALUES(a.auth_uid,a.user_id,p_inquiry_id,'inquiry_stage_progress',
  jsonb_build_object('status',oldrow.status,'first_response_at',oldrow.first_response_at,'responded_at',oldrow.responded_at,
   'next_action_date',oldrow.next_action_date),
  jsonb_build_object('status',newrow.status,'first_response_at',newrow.first_response_at,'responded_at',newrow.responded_at,
   'next_action_date',newrow.next_action_date,'from_stage',from_stage_value,'to_stage',to_stage_value,'did',did_value,
   'result',result_value,'next',next_value,'stage_history_id',history_id,'next_action_id',next_id,
   'cancelled_action_ids',cancelled_ids,'actor',a.display_name),result_value,server_at) RETURNING event_id INTO audit_id;
 ack:=jsonb_build_object('contract_version',1,'ok',true,'request_id',p_request_id,'operation','inquiry_status',
  'object_id',p_inquiry_id,'intent','progress','from_status',oldrow.status,'to_status',newrow.status,
  'from_stage',from_stage_value,'to_stage',to_stage_value,'first_response_at',newrow.first_response_at,
  'responded_at',newrow.responded_at,'next_action_date',newrow.next_action_date,'stage_history_id',history_id,
  'next_action_id',next_id,'cancelled_action_ids',cancelled_ids,'inquiry_audit_event_id',audit_id,
  'server_at',server_at,'actor_auth_uid',a.auth_uid,'actor_user_id',a.user_id,'replayed',false);
 INSERT INTO crm_security.command_receipts(actor_auth_uid,request_id,actor_user_id,operation,object_id,expected_version,payload,ack,created_at)
 VALUES(a.auth_uid,p_request_id,a.user_id,'inquiry_status',p_inquiry_id,0,canonical,ack,server_at);
 RETURN ack;
END $fn$;
REVOKE EXECUTE ON FUNCTION crm_security.crm_inquiry_stage_progress_command_v1(uuid,uuid,jsonb)
 FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION crm_security.crm_operational_source_fragment_v1(
 p_domain text,p_after uuid DEFAULT NULL,p_limit integer DEFAULT 100
) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $fn$
DECLARE base jsonb; projected jsonb;
BEGIN
 base:=crm_security.crm_operational_source_fragment_pre_inquiry_stage_progress_20260906(p_domain,p_after,p_limit);
 IF p_domain<>'inquiry_core' THEN RETURN base; END IF;
 SELECT coalesce(jsonb_agg(item||jsonb_build_object(
  'stage_history',coalesce((SELECT jsonb_agg(jsonb_build_object('id',h.id,'from',h.from_stage,'to',h.to_stage,
    'reason',h.reason,'actor',h.actor_name,'at',h.changed_at) ORDER BY h.changed_at,h.id)
    FROM public.stage_history h WHERE h.inquiry_id=(item->>'id')::uuid),'[]'::jsonb),
  'activities',coalesce((SELECT jsonb_agg(jsonb_build_object('id',e.event_id,'type','단계전환',
    'note',e.after_data->>'did','result',e.after_data->>'result','actor',e.after_data->>'actor',
    'stage',e.after_data->>'to_stage','at',e.created_at) ORDER BY e.created_at,e.event_id)
    FROM crm_security.inquiry_audit_events e WHERE e.inquiry_id=(item->>'id')::uuid AND e.action='inquiry_stage_progress'),'[]'::jsonb),
  'next_action',coalesce((SELECT jsonb_build_object('id',n.id,'type',n.action_type,'text',n.title,'due',n.due_at,
    'due_at',n.due_at,'assignee',n.assignee_name,'status',n.status) FROM public.next_actions n
    WHERE n.inquiry_id=(item->>'id')::uuid AND n.status='open' ORDER BY n.due_at,n.id LIMIT 1),'null'::jsonb)
 ) ORDER BY item->>'id'),'[]'::jsonb) INTO projected FROM jsonb_array_elements(base->'items') item;
 RETURN jsonb_set(base,'{items}',projected,true);
END $fn$;
REVOKE EXECUTE ON FUNCTION crm_security.crm_operational_source_fragment_v1(text,uuid,integer)
 FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION public.crm_write_command_v2(
 p_request_id uuid,p_operation text,p_object_id uuid,p_expected_version integer,p_payload jsonb
) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $fn$
BEGIN
 IF p_operation='inquiry_status' AND p_payload->>'intent'='progress' THEN
  IF p_expected_version IS DISTINCT FROM 0 THEN RAISE EXCEPTION 'invalid inquiry progress version sentinel' USING ERRCODE='22023'; END IF;
  RETURN crm_security.crm_inquiry_stage_progress_command_v1(p_request_id,p_object_id,p_payload);
 END IF;
 RETURN crm_security.crm_write_command_v2_inquiry_pipeline_20260906(p_request_id,p_operation,p_object_id,p_expected_version,p_payload);
END $fn$;
REVOKE EXECUTE ON FUNCTION public.crm_write_command_v2(uuid,text,uuid,integer,jsonb) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.crm_write_command_v2(uuid,text,uuid,integer,jsonb) TO authenticated;

DO $post$ BEGIN
 IF has_function_privilege('public','public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)','EXECUTE')
  OR has_function_privilege('anon','public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)','EXECUTE')
  OR NOT has_function_privilege('authenticated','public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)','EXECUTE')
  OR has_function_privilege('service_role','public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)','EXECUTE')
  OR has_function_privilege('authenticated','crm_security.crm_inquiry_stage_progress_command_v1(uuid,uuid,jsonb)','EXECUTE')
  OR has_function_privilege('authenticated','crm_security.crm_operational_source_fragment_v1(text,uuid,integer)','EXECUTE')
 THEN RAISE EXCEPTION 'inquiry stage progress post-apply ACL drift'; END IF;
END $post$;
-- ===== APPLY PC INQUIRY NEXT + COMPLETE + CHECK =====
-- LOCAL REVIEW CANDIDATE ONLY. Staging approval is required.

-- LOCAL CANDIDATE ONLY. Connects reachable PC inquiry Next/complete/check actions.
SET LOCAL crm.inquiry_action_check_ref='rprechiaglyjaydkmxsu';
SET LOCAL search_path=pg_catalog;
SET LOCAL lock_timeout='3s';
SET LOCAL statement_timeout='60s';

DO $guard$ BEGIN
 IF current_user<>'postgres'
  OR current_setting('crm.inquiry_action_check_ref',true) IS DISTINCT FROM 'rprechiaglyjaydkmxsu'
  OR to_regprocedure('public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)') IS NULL
  OR to_regprocedure('crm_security.crm_inquiry_stage_progress_command_v1(uuid,uuid,jsonb)') IS NULL
  OR to_regprocedure('crm_security.crm_operational_source_fragment_v1(text,uuid,integer)') IS NULL
  OR to_regprocedure('crm_security.crm_write_command_v2_inquiry_stage_progress_20260906(uuid,text,uuid,integer,jsonb)') IS NOT NULL
  OR to_regprocedure('crm_security.crm_operational_source_fragment_pre_inquiry_action_check_20260906(text,uuid,integer)') IS NOT NULL
  OR to_regprocedure('crm_security.crm_inquiry_action_command_v1(uuid,text,uuid,jsonb)') IS NOT NULL
  OR (SELECT pg_get_constraintdef(oid,true) FROM pg_constraint
      WHERE conrelid='crm_security.inquiry_audit_events'::regclass AND conname='inquiry_audit_events_action_check')
     IS DISTINCT FROM $expected$CHECK (action = ANY (ARRAY['direct_assign'::text, 'direct_reassign'::text, 'inquiry_unassign'::text, 'inquiry_reclassify'::text, 'inquiry_hold'::text, 'inquiry_trash'::text, 'inquiry_restore'::text, 'inquiry_purge'::text, 'inquiry_followup'::text, 'inquiry_response_progress'::text, 'inquiry_response_next_week_retry'::text, 'inquiry_response_missed_retry'::text, 'inquiry_pipeline_promote'::text, 'inquiry_lineage_link'::text, 'inquiry_stage_progress'::text]))$expected$
 THEN RAISE EXCEPTION 'inquiry action/check prerequisite drift'; END IF;
END $guard$;

LOCK TABLE crm_security.command_receipts,crm_security.inquiry_audit_events IN ACCESS EXCLUSIVE MODE;
ALTER FUNCTION public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)
 RENAME TO crm_write_command_v2_inquiry_stage_progress_20260906;
ALTER FUNCTION public.crm_write_command_v2_inquiry_stage_progress_20260906(uuid,text,uuid,integer,jsonb)
 SET SCHEMA crm_security;
REVOKE EXECUTE ON FUNCTION crm_security.crm_write_command_v2_inquiry_stage_progress_20260906(uuid,text,uuid,integer,jsonb)
 FROM PUBLIC,anon,authenticated,service_role;
ALTER FUNCTION crm_security.crm_operational_source_fragment_v1(text,uuid,integer)
 RENAME TO crm_operational_source_fragment_pre_inquiry_action_check_20260906;
REVOKE EXECUTE ON FUNCTION crm_security.crm_operational_source_fragment_pre_inquiry_action_check_20260906(text,uuid,integer)
 FROM PUBLIC,anon,authenticated,service_role;

ALTER TABLE crm_security.inquiry_audit_events DROP CONSTRAINT inquiry_audit_events_action_check;
ALTER TABLE crm_security.inquiry_audit_events ADD CONSTRAINT inquiry_audit_events_action_check CHECK(action IN (
 'direct_assign','direct_reassign','inquiry_unassign','inquiry_reclassify','inquiry_hold','inquiry_trash',
 'inquiry_restore','inquiry_purge','inquiry_followup','inquiry_response_progress','inquiry_response_next_week_retry',
 'inquiry_response_missed_retry','inquiry_pipeline_promote','inquiry_lineage_link','inquiry_stage_progress',
 'inquiry_next_set','inquiry_next_complete','inquiry_check'));

CREATE FUNCTION crm_security.crm_inquiry_action_command_v1(
 p_request_id uuid,p_operation text,p_inquiry_id uuid,p_payload jsonb
) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $fn$
DECLARE
 a record; receipt crm_security.command_receipts%ROWTYPE; oldrow public.inquiries%ROWTYPE;
 actionrow public.next_actions%ROWTYPE; canonical jsonb; ack jsonb; server_at timestamptz:=clock_timestamp();
 intent_value text; text_value text; type_value text; due_value date; action_id_value uuid;
 item_value integer; item_label text; checked_value boolean; prior_checked boolean;
 owner_name_value text; audit_id uuid; next_id uuid; cancelled_ids jsonb:='[]'::jsonb;
 next_due date; checks_value jsonb; latest_management text;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;
 PERFORM 1 FROM public.users u WHERE u.auth_uid=auth.uid() FOR SHARE;
 PERFORM 1 FROM crm_security.access_review r WHERE r.reviewed_auth_uid=auth.uid() FOR SHARE;
 SELECT * INTO a FROM crm_security.actor();
 IF NOT FOUND THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;
 IF p_request_id IS NULL OR p_inquiry_id IS NULL OR p_operation NOT IN ('next_action','next_action_complete','stage_check')
  OR jsonb_typeof(p_payload) IS DISTINCT FROM 'object'
 THEN RAISE EXCEPTION 'invalid inquiry action command' USING ERRCODE='22023'; END IF;
 intent_value:=p_payload->>'intent';
 IF p_operation='next_action' THEN
  IF intent_value<>'inquiry_next_set'
   OR EXISTS(SELECT 1 FROM jsonb_object_keys(p_payload) k WHERE k NOT IN ('intent','type','text','due_at'))
   OR NOT p_payload ?& ARRAY['intent','type','text','due_at'] OR p_payload->>'type'<>'전화'
  THEN RAISE EXCEPTION 'invalid inquiry next set payload' USING ERRCODE='22023'; END IF;
  type_value:='전화';text_value:=btrim(p_payload->>'text');
  IF length(text_value)<1 OR length(text_value)>500 OR p_payload->>'due_at' !~ '^\d{4}-\d{2}-\d{2}$'
  THEN RAISE EXCEPTION 'invalid inquiry next set payload' USING ERRCODE='22023'; END IF;
  BEGIN due_value:=(p_payload->>'due_at')::date; EXCEPTION WHEN datetime_field_overflow THEN RAISE EXCEPTION 'invalid inquiry next date' USING ERRCODE='22023'; END;
  IF due_value::text<>p_payload->>'due_at' OR due_value<(server_at AT TIME ZONE 'Asia/Seoul')::date
   OR due_value>(server_at AT TIME ZONE 'Asia/Seoul')::date+3650
  THEN RAISE EXCEPTION 'invalid inquiry next date' USING ERRCODE='22023'; END IF;
  canonical:=jsonb_build_object('intent',intent_value,'type',type_value,'text',text_value,'due_at',due_value);
 ELSIF p_operation='next_action_complete' THEN
  IF intent_value<>'inquiry_next_complete'
   OR EXISTS(SELECT 1 FROM jsonb_object_keys(p_payload) k WHERE k NOT IN ('intent','action_id'))
   OR NOT p_payload ?& ARRAY['intent','action_id']
  THEN RAISE EXCEPTION 'invalid inquiry next completion payload' USING ERRCODE='22023'; END IF;
  BEGIN action_id_value:=(p_payload->>'action_id')::uuid; EXCEPTION WHEN invalid_text_representation THEN RAISE EXCEPTION 'invalid inquiry action id' USING ERRCODE='22023'; END;
  canonical:=jsonb_build_object('intent',intent_value,'action_id',action_id_value);
 ELSE
  IF intent_value<>'inquiry_check'
   OR EXISTS(SELECT 1 FROM jsonb_object_keys(p_payload) k WHERE k NOT IN ('intent','item_index','checked'))
   OR NOT p_payload ?& ARRAY['intent','item_index','checked']
   OR jsonb_typeof(p_payload->'item_index') IS DISTINCT FROM 'number'
   OR jsonb_typeof(p_payload->'checked') IS DISTINCT FROM 'boolean'
  THEN RAISE EXCEPTION 'invalid inquiry check payload' USING ERRCODE='22023'; END IF;
  BEGIN item_value:=(p_payload->>'item_index')::integer;checked_value:=(p_payload->>'checked')::boolean;
  EXCEPTION WHEN invalid_text_representation OR numeric_value_out_of_range THEN RAISE EXCEPTION 'invalid inquiry check payload' USING ERRCODE='22023'; END;
  item_label:=(ARRAY['최초 연락 완료','현장 조건 확인','의사결정권자 확인','견적서 발송 확인','다음 행동일 확정','후속 통화 기록'])[item_value+1];
  IF item_label IS NULL THEN RAISE EXCEPTION 'invalid inquiry check item' USING ERRCODE='22023'; END IF;
  canonical:=jsonb_build_object('intent',intent_value,'item_index',item_value,'checked',checked_value);
 END IF;

 PERFORM 1 FROM crm_security.object_scope s WHERE s.user_id=a.user_id AND s.inquiry_id=p_inquiry_id FOR SHARE;
 SELECT * INTO oldrow FROM public.inquiries i WHERE i.id=p_inquiry_id FOR UPDATE;
 IF NOT FOUND OR NOT crm_security.can_inquiry(p_inquiry_id)
  OR a.permission_role NOT IN ('rep','consultation','admin')
  OR (a.permission_role<>'admin' AND oldrow.assigned_to IS DISTINCT FROM a.user_id)
  OR coalesce(oldrow.inquiry_type,'')='기술자문' OR coalesce(oldrow.brand,'')='기술자문'
 THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;
 SELECT e.action INTO latest_management FROM crm_security.inquiry_audit_events e
  WHERE e.inquiry_id=p_inquiry_id AND e.action IN ('inquiry_trash','inquiry_restore','inquiry_purge')
  ORDER BY e.created_at DESC,e.event_id DESC LIMIT 1;
 IF latest_management IN ('inquiry_trash','inquiry_purge') OR coalesce(oldrow.status,'') IN ('수주','실주','배드핏','연락두절','종결','종료')
 THEN RAISE EXCEPTION 'inquiry action state conflict' USING ERRCODE='PT409'; END IF;

 PERFORM pg_advisory_xact_lock(hashtextextended(a.auth_uid::text||p_request_id::text,0));
 SELECT * INTO receipt FROM crm_security.command_receipts r WHERE r.actor_auth_uid=a.auth_uid AND r.request_id=p_request_id;
 IF FOUND THEN
  IF receipt.actor_user_id IS DISTINCT FROM a.user_id OR receipt.operation IS DISTINCT FROM p_operation
   OR receipt.object_id IS DISTINCT FROM p_inquiry_id OR receipt.expected_version IS DISTINCT FROM 0
   OR receipt.payload IS DISTINCT FROM canonical
  THEN RAISE EXCEPTION 'REQUEST_ID_REUSE' USING ERRCODE='PT409'; END IF;
  RETURN receipt.ack||jsonb_build_object('replayed',true);
 END IF;

 IF p_operation='next_action' THEN
  SELECT coalesce(u.name,oldrow.assignee_name) INTO owner_name_value FROM public.users u WHERE u.user_id=oldrow.assigned_to;
  IF owner_name_value IS NULL THEN RAISE EXCEPTION 'No approved UUID inquiry owner' USING ERRCODE='42501'; END IF;
  SELECT coalesce(jsonb_agg(id ORDER BY created_at,id),'[]'::jsonb) INTO cancelled_ids
   FROM public.next_actions WHERE inquiry_id=p_inquiry_id AND status='open';
  UPDATE public.next_actions SET status='cancelled',updated_at=server_at WHERE inquiry_id=p_inquiry_id AND status='open';
  INSERT INTO public.next_actions(inquiry_id,action_type,title,due_at,assignee_name,status,created_at,updated_at)
  VALUES(p_inquiry_id,type_value,text_value,due_value::timestamp AT TIME ZONE 'Asia/Seoul',owner_name_value,'open',server_at,server_at)
  RETURNING id INTO next_id;
  UPDATE public.inquiries SET next_action_date=due_value,updated_at=server_at WHERE id=p_inquiry_id;
  INSERT INTO crm_security.inquiry_audit_events(actor_auth_uid,actor_user_id,inquiry_id,action,before_data,after_data,reason,created_at)
  VALUES(a.auth_uid,a.user_id,p_inquiry_id,'inquiry_next_set',jsonb_build_object('next_action_date',oldrow.next_action_date,'cancelled_action_ids',cancelled_ids),
   jsonb_build_object('next_action_id',next_id,'type',type_value,'text',text_value,'next_action_date',due_value,'assignee_name',owner_name_value,'actor',a.display_name),text_value,server_at)
  RETURNING event_id INTO audit_id;
  ack:=jsonb_build_object('contract_version',1,'ok',true,'request_id',p_request_id,'operation',p_operation,'object_id',p_inquiry_id,
   'intent',intent_value,'next_action_id',next_id,'cancelled_action_ids',cancelled_ids,'next_action_date',due_value,
   'assignee_name',owner_name_value,'inquiry_audit_event_id',audit_id,'server_at',server_at,'actor_name',a.display_name,
   'actor_auth_uid',a.auth_uid,'actor_user_id',a.user_id,'replayed',false);
 ELSIF p_operation='next_action_complete' THEN
  SELECT * INTO actionrow FROM public.next_actions n WHERE n.id=action_id_value AND n.inquiry_id=p_inquiry_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;
  IF actionrow.status IS DISTINCT FROM 'open' THEN RAISE EXCEPTION 'inquiry next action state conflict' USING ERRCODE='PT409'; END IF;
  UPDATE public.next_actions SET status='completed',completed_at=server_at,updated_at=server_at WHERE id=actionrow.id AND status='open';
  SELECT n.due_at::date INTO next_due FROM public.next_actions n WHERE n.inquiry_id=p_inquiry_id AND n.status='open' ORDER BY n.due_at,n.id LIMIT 1;
  UPDATE public.inquiries SET next_action_date=next_due,updated_at=server_at WHERE id=p_inquiry_id;
  INSERT INTO crm_security.inquiry_audit_events(actor_auth_uid,actor_user_id,inquiry_id,action,before_data,after_data,reason,created_at)
  VALUES(a.auth_uid,a.user_id,p_inquiry_id,'inquiry_next_complete',jsonb_build_object('next_action_id',actionrow.id,'status',actionrow.status,'next_action_date',oldrow.next_action_date),
   jsonb_build_object('next_action_id',actionrow.id,'status','completed','completed_at',server_at,'completed_title',actionrow.title,'next_action_date',next_due,'actor',a.display_name),actionrow.title,server_at)
  RETURNING event_id INTO audit_id;
  ack:=jsonb_build_object('contract_version',1,'ok',true,'request_id',p_request_id,'operation',p_operation,'object_id',p_inquiry_id,
   'intent',intent_value,'next_action_id',actionrow.id,'action_status','completed','completed_title',actionrow.title,
   'completed_at',server_at,'next_action_date',next_due,'inquiry_audit_event_id',audit_id,'server_at',server_at,'actor_name',a.display_name,
   'actor_auth_uid',a.auth_uid,'actor_user_id',a.user_id,'replayed',false);
 ELSE
  SELECT coalesce((SELECT (e.after_data->>'checked')::boolean FROM crm_security.inquiry_audit_events e
   WHERE e.inquiry_id=p_inquiry_id AND e.action='inquiry_check' AND (e.after_data->>'item_index')::integer=item_value
   ORDER BY e.created_at DESC,e.event_id DESC LIMIT 1),false) INTO prior_checked;
  IF prior_checked=checked_value THEN RAISE EXCEPTION 'inquiry check state conflict' USING ERRCODE='PT409'; END IF;
  UPDATE public.inquiries SET updated_at=server_at WHERE id=p_inquiry_id;
  INSERT INTO crm_security.inquiry_audit_events(actor_auth_uid,actor_user_id,inquiry_id,action,before_data,after_data,reason,created_at)
  VALUES(a.auth_uid,a.user_id,p_inquiry_id,'inquiry_check',jsonb_build_object('item_index',item_value,'item_text',item_label,'checked',prior_checked),
   jsonb_build_object('item_index',item_value,'item_text',item_label,'checked',checked_value,'actor',a.display_name),item_label,server_at)
  RETURNING event_id INTO audit_id;
  SELECT jsonb_agg(coalesce((SELECT (e.after_data->>'checked')::boolean FROM crm_security.inquiry_audit_events e
    WHERE e.inquiry_id=p_inquiry_id AND e.action='inquiry_check' AND (e.after_data->>'item_index')::integer=g.i
    ORDER BY e.created_at DESC,e.event_id DESC LIMIT 1),false) ORDER BY g.i)
   INTO checks_value FROM generate_series(0,5) g(i);
  ack:=jsonb_build_object('contract_version',1,'ok',true,'request_id',p_request_id,'operation',p_operation,'object_id',p_inquiry_id,
   'intent',intent_value,'item_index',item_value,'item_text',item_label,'checked',checked_value,'checks',checks_value,
   'inquiry_audit_event_id',audit_id,'server_at',server_at,'actor_name',a.display_name,
   'actor_auth_uid',a.auth_uid,'actor_user_id',a.user_id,'replayed',false);
 END IF;
 INSERT INTO crm_security.command_receipts(actor_auth_uid,request_id,actor_user_id,operation,object_id,expected_version,payload,ack,created_at)
 VALUES(a.auth_uid,p_request_id,a.user_id,p_operation,p_inquiry_id,0,canonical,ack,server_at);
 RETURN ack;
END $fn$;
REVOKE EXECUTE ON FUNCTION crm_security.crm_inquiry_action_command_v1(uuid,text,uuid,jsonb)
 FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION crm_security.crm_operational_source_fragment_v1(
 p_domain text,p_after uuid DEFAULT NULL,p_limit integer DEFAULT 100
) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $fn$
DECLARE base jsonb; projected jsonb;
BEGIN
 base:=crm_security.crm_operational_source_fragment_pre_inquiry_action_check_20260906(p_domain,p_after,p_limit);
 IF p_domain<>'inquiry_core' THEN RETURN base; END IF;
 SELECT coalesce(jsonb_agg(item||jsonb_build_object(
  'checks',(SELECT jsonb_agg(coalesce((SELECT (e.after_data->>'checked')::boolean FROM crm_security.inquiry_audit_events e
    WHERE e.inquiry_id=(item->>'id')::uuid AND e.action='inquiry_check' AND (e.after_data->>'item_index')::integer=g.i
    ORDER BY e.created_at DESC,e.event_id DESC LIMIT 1),false) ORDER BY g.i) FROM generate_series(0,5) g(i)),
  'activities',coalesce(item->'activities','[]'::jsonb)||coalesce((SELECT jsonb_agg(jsonb_build_object(
    'id',e.event_id,'type',CASE e.action WHEN 'inquiry_next_set' THEN '다음행동등록' WHEN 'inquiry_next_complete' THEN '행동완료' ELSE '체크' END,
    'note',CASE e.action WHEN 'inquiry_next_set' THEN e.after_data->>'text' WHEN 'inquiry_next_complete' THEN e.after_data->>'completed_title' ELSE e.after_data->>'item_text' END,
    'result',CASE e.action WHEN 'inquiry_next_set' THEN '기한 '||(e.after_data->>'next_action_date') WHEN 'inquiry_next_complete' THEN '완료 처리' ELSE CASE WHEN (e.after_data->>'checked')::boolean THEN '확인' ELSE '해제' END END,
    'actor',e.after_data->>'actor','at',e.created_at) ORDER BY e.created_at,e.event_id)
    FROM crm_security.inquiry_audit_events e WHERE e.inquiry_id=(item->>'id')::uuid
     AND e.action IN ('inquiry_next_set','inquiry_next_complete','inquiry_check')),'[]'::jsonb),
  'next_action',coalesce((SELECT jsonb_build_object('id',n.id,'type',n.action_type,'text',n.title,'due',n.due_at,
    'due_at',n.due_at,'assignee',n.assignee_name,'status',n.status) FROM public.next_actions n
    WHERE n.inquiry_id=(item->>'id')::uuid AND n.status='open' ORDER BY n.due_at,n.id LIMIT 1),'null'::jsonb)
 ) ORDER BY item->>'id'),'[]'::jsonb) INTO projected FROM jsonb_array_elements(base->'items') item;
 RETURN jsonb_set(base,'{items}',projected,true);
END $fn$;
REVOKE EXECUTE ON FUNCTION crm_security.crm_operational_source_fragment_v1(text,uuid,integer)
 FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION public.crm_write_command_v2(
 p_request_id uuid,p_operation text,p_object_id uuid,p_expected_version integer,p_payload jsonb
) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $fn$
BEGIN
 IF (p_operation='next_action' AND p_payload->>'intent'='inquiry_next_set')
  OR (p_operation='next_action_complete' AND p_payload->>'intent'='inquiry_next_complete')
  OR (p_operation='stage_check' AND p_payload->>'intent'='inquiry_check') THEN
  IF p_expected_version IS DISTINCT FROM 0 THEN RAISE EXCEPTION 'invalid inquiry action version sentinel' USING ERRCODE='22023'; END IF;
  RETURN crm_security.crm_inquiry_action_command_v1(p_request_id,p_operation,p_object_id,p_payload);
 END IF;
 RETURN crm_security.crm_write_command_v2_inquiry_stage_progress_20260906(p_request_id,p_operation,p_object_id,p_expected_version,p_payload);
END $fn$;
REVOKE EXECUTE ON FUNCTION public.crm_write_command_v2(uuid,text,uuid,integer,jsonb) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.crm_write_command_v2(uuid,text,uuid,integer,jsonb) TO authenticated;

DO $post$ BEGIN
 IF has_function_privilege('public','public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)','EXECUTE')
  OR has_function_privilege('anon','public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)','EXECUTE')
  OR NOT has_function_privilege('authenticated','public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)','EXECUTE')
  OR has_function_privilege('service_role','public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)','EXECUTE')
  OR has_function_privilege('authenticated','crm_security.crm_inquiry_action_command_v1(uuid,text,uuid,jsonb)','EXECUTE')
  OR has_function_privilege('authenticated','crm_security.crm_operational_source_fragment_v1(text,uuid,integer)','EXECUTE')
 THEN RAISE EXCEPTION 'inquiry action/check post-apply ACL drift'; END IF;
END $post$;
-- ===== APPLY TECHNICAL INQUIRY TRANSFER =====
-- LOCAL REVIEW CANDIDATE ONLY. Staging approval is required.

-- LOCAL CANDIDATE ONLY. Connects the reachable PC technical-inquiry transfer.
SET LOCAL crm.technical_inquiry_transfer_ref='rprechiaglyjaydkmxsu';
SET LOCAL search_path=pg_catalog;
SET LOCAL lock_timeout='3s';
SET LOCAL statement_timeout='60s';

DO $guard$ BEGIN
 IF current_user<>'postgres'
  OR current_setting('crm.technical_inquiry_transfer_ref',true) IS DISTINCT FROM 'rprechiaglyjaydkmxsu'
  OR to_regprocedure('public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)') IS NULL
  OR to_regprocedure('crm_security.crm_inquiry_action_command_v1(uuid,text,uuid,jsonb)') IS NULL
  OR to_regprocedure('crm_security.crm_write_command_v2_inquiry_action_check_20260906(uuid,text,uuid,integer,jsonb)') IS NOT NULL
  OR to_regprocedure('crm_security.crm_technical_inquiry_transfer_command_v1(uuid,uuid,jsonb)') IS NOT NULL
  OR (SELECT pg_get_constraintdef(oid,true) FROM pg_constraint
      WHERE conrelid='crm_security.inquiry_audit_events'::regclass AND conname='inquiry_audit_events_action_check')
     IS DISTINCT FROM $expected$CHECK (action = ANY (ARRAY['direct_assign'::text, 'direct_reassign'::text, 'inquiry_unassign'::text, 'inquiry_reclassify'::text, 'inquiry_hold'::text, 'inquiry_trash'::text, 'inquiry_restore'::text, 'inquiry_purge'::text, 'inquiry_followup'::text, 'inquiry_response_progress'::text, 'inquiry_response_next_week_retry'::text, 'inquiry_response_missed_retry'::text, 'inquiry_pipeline_promote'::text, 'inquiry_lineage_link'::text, 'inquiry_stage_progress'::text, 'inquiry_next_set'::text, 'inquiry_next_complete'::text, 'inquiry_check'::text]))$expected$
 THEN RAISE EXCEPTION 'technical inquiry transfer prerequisite drift'; END IF;
END $guard$;

LOCK TABLE crm_security.command_receipts,crm_security.inquiry_audit_events IN ACCESS EXCLUSIVE MODE;
ALTER FUNCTION public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)
 RENAME TO crm_write_command_v2_inquiry_action_check_20260906;
ALTER FUNCTION public.crm_write_command_v2_inquiry_action_check_20260906(uuid,text,uuid,integer,jsonb)
 SET SCHEMA crm_security;
REVOKE EXECUTE ON FUNCTION crm_security.crm_write_command_v2_inquiry_action_check_20260906(uuid,text,uuid,integer,jsonb)
 FROM PUBLIC,anon,authenticated,service_role;

ALTER TABLE crm_security.inquiry_audit_events DROP CONSTRAINT inquiry_audit_events_action_check;
ALTER TABLE crm_security.inquiry_audit_events ADD CONSTRAINT inquiry_audit_events_action_check CHECK(action IN (
 'direct_assign','direct_reassign','inquiry_unassign','inquiry_reclassify','inquiry_hold','inquiry_trash',
 'inquiry_restore','inquiry_purge','inquiry_followup','inquiry_response_progress','inquiry_response_next_week_retry',
 'inquiry_response_missed_retry','inquiry_pipeline_promote','inquiry_lineage_link','inquiry_stage_progress',
 'inquiry_next_set','inquiry_next_complete','inquiry_check','technical_inquiry_transfer'));

CREATE FUNCTION crm_security.crm_technical_inquiry_transfer_command_v1(
 p_request_id uuid,p_object_id uuid,p_payload jsonb
) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $fn$
DECLARE
 a record; receipt crm_security.command_receipts%ROWTYPE; inquiry_row public.inquiries%ROWTYPE;
 owner_review record; canonical jsonb; ack jsonb; server_at timestamptz:=clock_timestamp();
 inquiry_id_value uuid; deal_target uuid:=gen_random_uuid(); site_target uuid; owner_target uuid;
 owner_name text; owner_email text; history_id uuid; activity_id uuid; audit_id uuid; inquiry_audit_id uuid;
 review_expires timestamptz; latest_management text;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;
 SELECT * INTO a FROM crm_security.actor();
 IF NOT FOUND OR a.permission_role<>'admin' THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;
 IF p_request_id IS NULL OR p_object_id IS DISTINCT FROM p_request_id OR jsonb_typeof(p_payload) IS DISTINCT FROM 'object'
  OR NOT p_payload ?& ARRAY['intent','inquiry_id','client_ref']
  OR EXISTS(SELECT 1 FROM jsonb_object_keys(p_payload) k WHERE k NOT IN ('intent','inquiry_id','client_ref'))
  OR p_payload->>'intent'<>'technical_inquiry_transfer'
  OR length(coalesce(p_payload->>'client_ref','')) NOT BETWEEN 12 AND 200
  OR p_payload->>'client_ref' !~ '^local-tech-[A-Za-z0-9._:-]+$'
 THEN RAISE EXCEPTION 'invalid technical inquiry transfer payload' USING ERRCODE='22023'; END IF;
 BEGIN inquiry_id_value:=(p_payload->>'inquiry_id')::uuid;
 EXCEPTION WHEN invalid_text_representation THEN RAISE EXCEPTION 'invalid inquiry id' USING ERRCODE='22023'; END;
 canonical:=jsonb_build_object('intent','technical_inquiry_transfer','inquiry_id',inquiry_id_value,'client_ref',p_payload->>'client_ref');

 PERFORM pg_advisory_xact_lock(hashtextextended(a.auth_uid::text||p_request_id::text,0));
 SELECT * INTO receipt FROM crm_security.command_receipts r WHERE r.actor_auth_uid=a.auth_uid AND r.request_id=p_request_id;
 IF FOUND THEN
  IF receipt.actor_user_id IS DISTINCT FROM a.user_id OR receipt.operation IS DISTINCT FROM 'opportunity_create'
   OR receipt.object_id IS DISTINCT FROM p_object_id OR receipt.expected_version IS DISTINCT FROM 0
   OR receipt.payload IS DISTINCT FROM canonical
  THEN RAISE EXCEPTION 'REQUEST_ID_REUSE' USING ERRCODE='PT409'; END IF;
  RETURN receipt.ack||jsonb_build_object('replayed',true);
 END IF;

 PERFORM pg_advisory_xact_lock(hashtextextended('technical-inquiry:'||inquiry_id_value::text,0));
 PERFORM 1 FROM crm_security.object_scope s WHERE s.user_id=a.user_id AND s.inquiry_id=inquiry_id_value FOR SHARE;
 SELECT * INTO inquiry_row FROM public.inquiries i WHERE i.id=inquiry_id_value FOR UPDATE;
 IF NOT FOUND OR NOT crm_security.can_inquiry(inquiry_id_value)
  OR NOT (coalesce(inquiry_row.brand,'')='기술자문' OR coalesce(inquiry_row.inquiry_type,'') ~ '기술자문')
 THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;
 SELECT e.action INTO latest_management FROM crm_security.inquiry_audit_events e
  WHERE e.inquiry_id=inquiry_id_value AND e.action IN ('inquiry_trash','inquiry_restore','inquiry_purge')
  ORDER BY e.created_at DESC,e.event_id DESC LIMIT 1;
 IF latest_management IN ('inquiry_trash','inquiry_purge')
  OR EXISTS(SELECT 1 FROM public.deals d WHERE d.origin_inquiry_id=inquiry_id_value)
  OR inquiry_row.deal_id IS NOT NULL OR inquiry_row.opportunity_id IS NOT NULL
 THEN RAISE EXCEPTION 'technical inquiry already linked or unavailable' USING ERRCODE='PT409'; END IF;

 IF inquiry_row.site_id IS NOT NULL THEN
  SELECT s.site_id INTO site_target FROM public.sites s WHERE s.site_id=inquiry_row.site_id FOR SHARE;
 END IF;
 IF inquiry_row.assigned_to IS NOT NULL THEN
  SELECT u.user_id,u.name,u.email INTO owner_review
   FROM public.users u JOIN crm_security.access_review r ON r.user_id=u.user_id AND r.reviewed_auth_uid=u.auth_uid
   WHERE u.user_id=inquiry_row.assigned_to AND u.active AND u.auth_uid IS NOT NULL AND r.source_role=u.role
    AND r.approved AND r.expires_at>server_at AND r.permission_role='rep';
  IF FOUND THEN owner_target:=owner_review.user_id;owner_name:=owner_review.name;owner_email:=owner_review.email; END IF;
 END IF;

 INSERT INTO public.deals(id,brand,list_name,stage_code,stage_raw,stage_group,assignee_name,assignee_email,amount,
  source,list_fields,created_at,updated_at,site_id,owner_id,origin_inquiry_id,lifecycle_status,stage_entered_at,
  last_activity_at,opened_at,version,service_type,origin_business,current_business)
 VALUES(deal_target,'기술자문','기술자문','first_contact','first_contact','design',owner_name,owner_email,NULL,
  'technical_inquiry_transfer',jsonb_strip_nulls(jsonb_build_object('site_name',nullif(btrim(coalesce(inquiry_row.site_name,'')),''),
   'work_name',nullif(btrim(coalesce(inquiry_row.work_type,'')),''),'client_ref',p_payload->>'client_ref','origin_source','기존 기술자문 문의 검토')),
  server_at,server_at,site_target,owner_target,inquiry_id_value,'active',server_at,server_at,server_at,1,
  '기술자문','기술자문','기술자문');
 UPDATE public.inquiries SET status='영업전환',qualified_at=coalesce(qualified_at,server_at),updated_at=server_at,
  deal_id=deal_target,opportunity_id=deal_target WHERE id=inquiry_id_value;
 INSERT INTO public.stage_history(opportunity_id,inquiry_id,from_stage,to_stage,reason,actor_id,actor_name,changed_at)
 VALUES(deal_target,inquiry_id_value,NULL,'first_contact','기존 기술자문 문의를 Pipeline 영업기회로 이관',a.user_id,a.display_name,server_at)
 RETURNING id INTO history_id;
 INSERT INTO public.activities(deal_id,actor_email,actor_name,type,detail,occurred_at)
 VALUES(deal_target,(SELECT email FROM public.users WHERE user_id=a.user_id),a.display_name,'파이프라인 인계',
  jsonb_build_object('note','기존 기술자문 문의 검토','result','기술자문 영업기회 생성','origin_inquiry_id',inquiry_id_value,
   'owner_id',owner_target,'site_id',site_target,'meaningful_contact',false),server_at) RETURNING id INTO activity_id;
 INSERT INTO crm_security.audit_events(actor_auth_uid,actor_user_id,actor_name,deal_id,action,before_data,after_data,reason,created_at)
 VALUES(a.auth_uid,a.user_id,a.display_name,deal_target,'technical_inquiry_transfer','{}'::jsonb,
  jsonb_build_object('inquiry_id',inquiry_id_value,'stage_code','first_contact','version',1,'owner_id',owner_target,
   'site_id',site_target,'stage_history_id',history_id,'activity_id',activity_id),
  '기존 기술자문 문의를 Pipeline 영업기회로 이관',server_at) RETURNING event_id INTO audit_id;
 INSERT INTO crm_security.inquiry_audit_events(actor_auth_uid,actor_user_id,inquiry_id,action,before_data,after_data,reason,created_at)
 VALUES(a.auth_uid,a.user_id,inquiry_id_value,'technical_inquiry_transfer',
  jsonb_build_object('status',inquiry_row.status,'deal_id',inquiry_row.deal_id,'opportunity_id',inquiry_row.opportunity_id),
  jsonb_build_object('status','영업전환','deal_id',deal_target,'opportunity_id',deal_target,'stage_code','first_contact',
   'stage_history_id',history_id,'activity_id',activity_id),
  '기존 기술자문 문의를 Pipeline 영업기회로 이관',server_at) RETURNING event_id INTO inquiry_audit_id;
 SELECT r.expires_at INTO review_expires FROM crm_security.access_review r
  WHERE r.user_id=a.user_id AND r.reviewed_auth_uid=a.auth_uid AND r.approved AND r.expires_at>server_at;
 IF review_expires IS NULL THEN RAISE EXCEPTION 'admin review expired' USING ERRCODE='42501'; END IF;
 INSERT INTO crm_security.object_scope(scope_id,user_id,deal_id,can_write,reviewed_by,expires_at)
 VALUES(gen_random_uuid(),a.user_id,deal_target,true,'technical_inquiry_transfer:'||p_request_id::text,review_expires)
 ON CONFLICT DO NOTHING;

 ack:=jsonb_build_object('contract_version',1,'ok',true,'request_id',p_request_id,'operation','opportunity_create',
  'object_id',p_object_id,'intent','technical_inquiry_transfer','inquiry_id',inquiry_id_value,
  'new_opportunity_id',deal_target,'opportunity_id',deal_target,'site_id',site_target,'owner_id',owner_target,
  'to_stage','first_contact','version',1,'stage_history_id',history_id,'activity_id',activity_id,
  'audit_event_id',audit_id,'inquiry_audit_event_id',inquiry_audit_id,'server_at',server_at,
  'actor_auth_uid',a.auth_uid,'actor_user_id',a.user_id,'replayed',false);
 INSERT INTO crm_security.command_receipts(actor_auth_uid,request_id,actor_user_id,operation,object_id,expected_version,payload,ack,created_at)
 VALUES(a.auth_uid,p_request_id,a.user_id,'opportunity_create',p_object_id,0,canonical,ack,server_at);
 RETURN ack;
END $fn$;
REVOKE EXECUTE ON FUNCTION crm_security.crm_technical_inquiry_transfer_command_v1(uuid,uuid,jsonb)
 FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION public.crm_write_command_v2(
 p_request_id uuid,p_operation text,p_object_id uuid,p_expected_version integer,p_payload jsonb
) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $fn$
BEGIN
 IF p_operation='opportunity_create' AND p_payload->>'intent'='technical_inquiry_transfer' THEN
  IF p_expected_version IS DISTINCT FROM 0 OR p_object_id IS DISTINCT FROM p_request_id
  THEN RAISE EXCEPTION 'invalid technical inquiry transfer sentinel' USING ERRCODE='22023'; END IF;
  RETURN crm_security.crm_technical_inquiry_transfer_command_v1(p_request_id,p_object_id,p_payload);
 END IF;
 RETURN crm_security.crm_write_command_v2_inquiry_action_check_20260906(p_request_id,p_operation,p_object_id,p_expected_version,p_payload);
END $fn$;
REVOKE EXECUTE ON FUNCTION public.crm_write_command_v2(uuid,text,uuid,integer,jsonb) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.crm_write_command_v2(uuid,text,uuid,integer,jsonb) TO authenticated;

DO $post$ BEGIN
 IF has_function_privilege('public','public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)','EXECUTE')
  OR has_function_privilege('anon','public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)','EXECUTE')
  OR NOT has_function_privilege('authenticated','public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)','EXECUTE')
  OR has_function_privilege('service_role','public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)','EXECUTE')
  OR has_function_privilege('authenticated','crm_security.crm_technical_inquiry_transfer_command_v1(uuid,uuid,jsonb)','EXECUTE')
 THEN RAISE EXCEPTION 'technical inquiry transfer post-apply ACL drift'; END IF;
END $post$;
-- ===== APPLY ATTACHMENT PREPARE COMPLETE + READY READ =====
-- LOCAL REVIEW CANDIDATE ONLY. Staging approval is required.

-- LOCAL REVIEW CANDIDATE ONLY. Separate Staging approval is required.
SET LOCAL crm.attachment_compat_ref='rprechiaglyjaydkmxsu';
SET LOCAL search_path=pg_catalog;
SET LOCAL lock_timeout='3s';
SET LOCAL statement_timeout='90s';

DO $guard$ BEGIN
 IF current_user<>'postgres'
  OR current_setting('crm.attachment_compat_ref',true) IS DISTINCT FROM 'rprechiaglyjaydkmxsu'
  OR to_regprocedure('public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)') IS NULL
  OR to_regprocedure('public.crm_operational_source_v1(text,uuid,integer)') IS NULL
  OR to_regprocedure('crm_security.crm_technical_inquiry_transfer_command_v1(uuid,uuid,jsonb)') IS NULL
  OR to_regclass('storage.buckets') IS NULL OR to_regclass('storage.objects') IS NULL
  OR to_regclass('crm_security.deal_attachments') IS NOT NULL
  OR to_regprocedure('crm_security.crm_attachment_command_v1(uuid,text,uuid,jsonb)') IS NOT NULL
  OR to_regprocedure('public.crm_attachment_object_insert_allowed(text,text)') IS NOT NULL
  OR EXISTS(SELECT 1 FROM storage.buckets WHERE id='crm-site-files' AND
    (name<>'crm-site-files' OR public OR file_size_limit IS DISTINCT FROM 20971520
     OR allowed_mime_types IS DISTINCT FROM ARRAY[
      'image/*','application/pdf','application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-powerpoint','application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'application/octet-stream']))
  OR EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='crm_attachment_insert_v1')
 THEN RAISE EXCEPTION 'attachment compatibility prerequisite drift'; END IF;
END $guard$;

LOCK TABLE crm_security.command_receipts IN ACCESS EXCLUSIVE MODE;
ALTER FUNCTION public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)
 RENAME TO crm_write_command_v2_technical_transfer_20260906;
ALTER FUNCTION public.crm_write_command_v2_technical_transfer_20260906(uuid,text,uuid,integer,jsonb)
 SET SCHEMA crm_security;
REVOKE EXECUTE ON FUNCTION crm_security.crm_write_command_v2_technical_transfer_20260906(uuid,text,uuid,integer,jsonb)
 FROM PUBLIC,anon,authenticated,service_role;

ALTER FUNCTION public.crm_operational_source_v1(text,uuid,integer)
 RENAME TO crm_operational_source_v1_technical_transfer_20260906;
ALTER FUNCTION public.crm_operational_source_v1_technical_transfer_20260906(text,uuid,integer)
 SET SCHEMA crm_security;
REVOKE EXECUTE ON FUNCTION crm_security.crm_operational_source_v1_technical_transfer_20260906(text,uuid,integer)
 FROM PUBLIC,anon,authenticated,service_role;

ALTER TABLE crm_security.command_receipts DROP CONSTRAINT command_receipts_operation_check;
ALTER TABLE crm_security.command_receipts ADD CONSTRAINT command_receipts_operation_check CHECK(operation IN (
 'opportunity_work_set','inquiry_assign','service_change','inquiry_unassign','favorite_set','opportunity_touch',
 'next_action','activity','quote_version','next_action_complete','stage_check','transition','close','amount',
 'waiting_context','inquiry_reclassify','inquiry_status','inquiry_trash','inquiry_restore','inquiry_purge',
 'inquiry_followup','opportunity_create','lineage_link','attachment_prepare','attachment_complete'));

CREATE TABLE crm_security.deal_attachments(
 attachment_id uuid PRIMARY KEY,
 deal_id uuid NOT NULL REFERENCES public.deals(id) ON DELETE RESTRICT,
 bucket_id text NOT NULL DEFAULT 'crm-site-files' CHECK(bucket_id='crm-site-files'),
 object_path text NOT NULL UNIQUE,
 file_name text NOT NULL CHECK(length(file_name) BETWEEN 1 AND 255),
 mime_type text NOT NULL CHECK(length(mime_type) BETWEEN 3 AND 200),
 size_bytes bigint NOT NULL CHECK(size_bytes BETWEEN 1 AND 20971520),
 category text NOT NULL CHECK(category IN ('현장사진','견적자료','도면','회의자료','계약관련','기타')),
 tags text[] NOT NULL DEFAULT '{}',
 memo text,
 uploaded_by_user_id uuid NOT NULL REFERENCES public.users(user_id),
 uploaded_by_name text NOT NULL,
 status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','ready','failed')),
 pending_expires_at timestamptz NOT NULL,
 created_at timestamptz NOT NULL,
 ready_at timestamptz,
 failed_at timestamptz,
 failure_reason text,
 CHECK(cardinality(tags)<=20),
 CHECK(memo IS NULL OR length(memo)<=4000)
);
CREATE INDEX deal_attachments_ready_idx ON crm_security.deal_attachments(deal_id,created_at DESC)
 WHERE status='ready';
CREATE INDEX deal_attachments_pending_idx ON crm_security.deal_attachments(pending_expires_at)
 WHERE status='pending';

CREATE TABLE crm_security.attachment_audit_events(
 event_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 actor_auth_uid uuid NOT NULL,
 actor_user_id uuid NOT NULL REFERENCES public.users(user_id),
 deal_id uuid NOT NULL REFERENCES public.deals(id),
 attachment_id uuid NOT NULL REFERENCES crm_security.deal_attachments(attachment_id),
 action text NOT NULL CHECK(action IN ('attachment_prepare','attachment_complete')),
 before_data jsonb NOT NULL CHECK(jsonb_typeof(before_data)='object'),
 after_data jsonb NOT NULL CHECK(jsonb_typeof(after_data)='object'),
 created_at timestamptz NOT NULL
);
ALTER TABLE crm_security.deal_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_security.attachment_audit_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON crm_security.deal_attachments,crm_security.attachment_audit_events
 FROM PUBLIC,anon,authenticated,service_role;

-- Bucket creation by SQL is supported by Supabase; objects remain API-owned/read-only.
INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
VALUES('crm-site-files','crm-site-files',false,20971520,ARRAY[
 'image/*','application/pdf','application/msword',
 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
 'application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
 'application/vnd.ms-powerpoint','application/vnd.openxmlformats-officedocument.presentationml.presentation',
 'application/octet-stream']) ON CONFLICT(id) DO NOTHING;

CREATE FUNCTION public.crm_attachment_object_insert_allowed(p_bucket_id text,p_name text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $fn$
 SELECT p_bucket_id='crm-site-files' AND EXISTS(
  SELECT 1 FROM crm_security.actor() a
  JOIN crm_security.deal_attachments x ON x.uploaded_by_user_id=a.user_id
  WHERE x.bucket_id=p_bucket_id AND x.object_path=p_name AND x.status='pending'
   AND x.pending_expires_at>clock_timestamp() AND crm_security.can_deal(x.deal_id,true))
$fn$;
REVOKE EXECUTE ON FUNCTION public.crm_attachment_object_insert_allowed(text,text)
 FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.crm_attachment_object_insert_allowed(text,text) TO authenticated;

-- storage.objects already has RLS enabled. Policy creation is deferred to the
-- Supabase Staging Storage policy editor because the migration role is not the table owner.

CREATE FUNCTION crm_security.crm_attachment_command_v1(
 p_request_id uuid,p_operation text,p_object_id uuid,p_payload jsonb
) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $fn$
DECLARE
 a record; prior crm_security.command_receipts%ROWTYPE; x crm_security.deal_attachments%ROWTYPE;
 canonical jsonb; ack jsonb; audit_id uuid; attachment_target uuid; server_at timestamptz:=clock_timestamp();
 filename_value text; mime_value text; category_value text; memo_value text; size_value bigint;
 tags_value text[]; object_size bigint; object_mime text; object_owner text;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;
 SELECT * INTO a FROM crm_security.actor();
 IF NOT FOUND OR p_request_id IS NULL OR p_object_id IS NULL
  OR p_operation NOT IN ('attachment_prepare','attachment_complete')
  OR jsonb_typeof(p_payload) IS DISTINCT FROM 'object'
  OR NOT crm_security.can_deal(p_object_id,true)
 THEN RAISE EXCEPTION 'forbidden or invalid attachment command' USING ERRCODE='42501'; END IF;

 IF p_operation='attachment_prepare' THEN
  IF NOT p_payload ?& ARRAY['file_name','mime_type','size_bytes','category','tags']
   OR EXISTS(SELECT 1 FROM jsonb_object_keys(p_payload) k WHERE k NOT IN ('file_name','mime_type','size_bytes','category','tags','memo'))
   OR jsonb_typeof(p_payload->'file_name')<>'string' OR length(btrim(p_payload->>'file_name')) NOT BETWEEN 1 AND 255
   OR p_payload->>'file_name' ~ '[[:cntrl:]/\\]'
   OR jsonb_typeof(p_payload->'mime_type')<>'string'
   OR jsonb_typeof(p_payload->'size_bytes')<>'number'
   OR jsonb_typeof(p_payload->'category')<>'string'
   OR jsonb_typeof(p_payload->'tags')<>'array'
   OR jsonb_array_length(p_payload->'tags')>20
   OR EXISTS(SELECT 1 FROM jsonb_array_elements(p_payload->'tags') e
             WHERE jsonb_typeof(e)<>'string' OR length(btrim(e#>>'{}')) NOT BETWEEN 1 AND 100)
   OR (p_payload ? 'memo' AND jsonb_typeof(p_payload->'memo') NOT IN ('string','null'))
  THEN RAISE EXCEPTION 'invalid attachment prepare payload' USING ERRCODE='22023'; END IF;
  BEGIN size_value:=(p_payload->>'size_bytes')::bigint;
  EXCEPTION WHEN OTHERS THEN RAISE EXCEPTION 'invalid attachment size' USING ERRCODE='22023'; END;
  filename_value:=btrim(p_payload->>'file_name'); mime_value:=lower(btrim(p_payload->>'mime_type'));
  category_value:=p_payload->>'category'; memo_value:=nullif(btrim(coalesce(p_payload->>'memo','')),'');
  SELECT coalesce(array_agg(v ORDER BY ord),'{}') INTO tags_value
   FROM (SELECT DISTINCT btrim(value#>>'{}') v,min(ordinality) ord
         FROM jsonb_array_elements(p_payload->'tags') WITH ORDINALITY GROUP BY btrim(value#>>'{}')) q;
  IF size_value NOT BETWEEN 1 AND 20971520
   OR category_value NOT IN ('현장사진','견적자료','도면','회의자료','계약관련','기타')
   OR length(coalesce(memo_value,''))>4000
   OR NOT (mime_value ~ '^image/[a-z0-9.+-]+$' OR mime_value IN (
    'application/pdf','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint','application/vnd.openxmlformats-officedocument.presentationml.presentation')
    OR (mime_value='application/octet-stream' AND filename_value ~* '\.(jpe?g|png|webp|heic|heif|gif|pdf|docx?|xlsx?|pptx?)$'))
  THEN RAISE EXCEPTION 'unsupported attachment file' USING ERRCODE='22023'; END IF;
  canonical:=jsonb_build_object('file_name',filename_value,'mime_type',mime_value,'size_bytes',size_value,
   'category',category_value,'tags',to_jsonb(tags_value),'memo',memo_value);
 ELSE
  IF NOT p_payload ? 'attachment_id'
   OR EXISTS(SELECT 1 FROM jsonb_object_keys(p_payload) k WHERE k<>'attachment_id')
  THEN RAISE EXCEPTION 'invalid attachment complete payload' USING ERRCODE='22023'; END IF;
  BEGIN attachment_target:=(p_payload->>'attachment_id')::uuid;
  EXCEPTION WHEN invalid_text_representation THEN RAISE EXCEPTION 'invalid attachment id' USING ERRCODE='22023'; END;
  canonical:=jsonb_build_object('attachment_id',attachment_target);
 END IF;

 PERFORM pg_advisory_xact_lock(hashtextextended(a.auth_uid::text||p_request_id::text,0));
 SELECT * INTO prior FROM crm_security.command_receipts r WHERE r.actor_auth_uid=a.auth_uid AND r.request_id=p_request_id;
 IF FOUND THEN
  IF prior.actor_user_id IS DISTINCT FROM a.user_id OR prior.operation IS DISTINCT FROM p_operation
   OR prior.object_id IS DISTINCT FROM p_object_id OR prior.expected_version IS DISTINCT FROM 0
   OR prior.payload IS DISTINCT FROM canonical
  THEN RAISE EXCEPTION 'REQUEST_ID_REUSE' USING ERRCODE='PT409'; END IF;
  RETURN prior.ack||jsonb_build_object('replayed',true);
 END IF;

 IF p_operation='attachment_prepare' THEN
  attachment_target:=gen_random_uuid();
  INSERT INTO crm_security.deal_attachments(attachment_id,deal_id,object_path,file_name,mime_type,size_bytes,
   category,tags,memo,uploaded_by_user_id,uploaded_by_name,pending_expires_at,created_at)
  VALUES(attachment_target,p_object_id,'deals/'||p_object_id::text||'/'||attachment_target::text,
   filename_value,mime_value,size_value,category_value,tags_value,memo_value,a.user_id,a.display_name,
   server_at+interval '24 hours',server_at) RETURNING * INTO x;
  INSERT INTO crm_security.attachment_audit_events(actor_auth_uid,actor_user_id,deal_id,attachment_id,action,before_data,after_data,created_at)
  VALUES(a.auth_uid,a.user_id,p_object_id,x.attachment_id,'attachment_prepare','{}',
   jsonb_build_object('status','pending','bucket_id',x.bucket_id,'object_path',x.object_path,'size_bytes',x.size_bytes,'mime_type',x.mime_type),server_at)
  RETURNING event_id INTO audit_id;
  ack:=jsonb_build_object('contract_version',1,'ok',true,'request_id',p_request_id,'operation',p_operation,
   'object_id',p_object_id,'attachment_id',x.attachment_id,'bucket_id',x.bucket_id,'object_path',x.object_path,
   'status','pending','pending_expires_at',x.pending_expires_at,'audit_event_id',audit_id,
   'actor_auth_uid',a.auth_uid,'actor_user_id',a.user_id,'server_at',server_at,'replayed',false);
 ELSE
  SELECT * INTO x FROM crm_security.deal_attachments WHERE attachment_id=attachment_target FOR UPDATE;
  IF NOT FOUND OR x.deal_id IS DISTINCT FROM p_object_id OR x.uploaded_by_user_id IS DISTINCT FROM a.user_id
   OR x.status NOT IN ('pending','ready') OR (x.status='pending' AND x.pending_expires_at<=server_at)
  THEN RAISE EXCEPTION 'attachment unavailable' USING ERRCODE='42501'; END IF;
  IF x.status='pending' THEN
   SELECT CASE WHEN coalesce(o.metadata->>'size','')~'^[0-9]+$' THEN (o.metadata->>'size')::bigint
               WHEN coalesce(o.metadata->>'contentLength','')~'^[0-9]+$' THEN (o.metadata->>'contentLength')::bigint END,
          lower(coalesce(o.metadata->>'mimetype','')),o.owner_id
    INTO object_size,object_mime,object_owner
    FROM storage.objects o WHERE o.bucket_id=x.bucket_id AND o.name=x.object_path;
   IF object_size IS DISTINCT FROM x.size_bytes OR object_mime IS DISTINCT FROM x.mime_type
    OR object_owner IS DISTINCT FROM a.auth_uid::text
   THEN RAISE EXCEPTION 'storage object mismatch' USING ERRCODE='PT409'; END IF;
   UPDATE crm_security.deal_attachments SET status='ready',ready_at=server_at WHERE attachment_id=x.attachment_id RETURNING * INTO x;
   INSERT INTO crm_security.attachment_audit_events(actor_auth_uid,actor_user_id,deal_id,attachment_id,action,before_data,after_data,created_at)
   VALUES(a.auth_uid,a.user_id,p_object_id,x.attachment_id,'attachment_complete',jsonb_build_object('status','pending'),
    jsonb_build_object('status','ready','size_bytes',x.size_bytes,'mime_type',x.mime_type),server_at)
   RETURNING event_id INTO audit_id;
  ELSE
   SELECT event_id INTO audit_id FROM crm_security.attachment_audit_events
    WHERE attachment_id=x.attachment_id AND action='attachment_complete' ORDER BY created_at DESC LIMIT 1;
  END IF;
  ack:=jsonb_build_object('contract_version',1,'ok',true,'request_id',p_request_id,'operation',p_operation,
   'object_id',p_object_id,'attachment_id',x.attachment_id,'status','ready','audit_event_id',audit_id,
   'attachment',jsonb_build_object('id',x.attachment_id,'file_name',x.file_name,'mime_type',x.mime_type,
    'size_bytes',x.size_bytes,'category',x.category,'tags',to_jsonb(x.tags),'memo',x.memo,
    'uploaded_by',x.uploaded_by_name,'status','ready','created_at',x.created_at),
   'actor_auth_uid',a.auth_uid,'actor_user_id',a.user_id,'server_at',server_at,'replayed',false);
 END IF;
 INSERT INTO crm_security.command_receipts(actor_auth_uid,request_id,actor_user_id,operation,object_id,expected_version,payload,ack,created_at)
 VALUES(a.auth_uid,p_request_id,a.user_id,p_operation,p_object_id,0,canonical,ack,server_at);
 RETURN ack;
END $fn$;
REVOKE EXECUTE ON FUNCTION crm_security.crm_attachment_command_v1(uuid,text,uuid,jsonb)
 FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION public.crm_write_command_v2(
 p_request_id uuid,p_operation text,p_object_id uuid,p_expected_version integer,p_payload jsonb
) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $fn$
BEGIN
 IF p_operation IN ('attachment_prepare','attachment_complete') THEN
  IF p_expected_version IS DISTINCT FROM 0 THEN RAISE EXCEPTION 'invalid attachment version sentinel' USING ERRCODE='22023'; END IF;
  RETURN crm_security.crm_attachment_command_v1(p_request_id,p_operation,p_object_id,p_payload);
 END IF;
 RETURN crm_security.crm_write_command_v2_technical_transfer_20260906(p_request_id,p_operation,p_object_id,p_expected_version,p_payload);
END $fn$;
REVOKE EXECUTE ON FUNCTION public.crm_write_command_v2(uuid,text,uuid,integer,jsonb) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.crm_write_command_v2(uuid,text,uuid,integer,jsonb) TO authenticated;

CREATE FUNCTION public.crm_operational_source_v1(p_domain text,p_after uuid DEFAULT NULL,p_limit integer DEFAULT 100)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $fn$
DECLARE base jsonb; rows jsonb;
BEGIN
 base:=crm_security.crm_operational_source_v1_technical_transfer_20260906(p_domain,p_after,p_limit);
 IF p_domain<>'deal_core' THEN RETURN base; END IF;
 SELECT coalesce(jsonb_agg(item||jsonb_build_object('attachments',coalesce((
   SELECT jsonb_agg(jsonb_build_object('id',x.attachment_id,'file_name',x.file_name,'mime_type',x.mime_type,
    'size_bytes',x.size_bytes,'category',x.category,'tags',to_jsonb(x.tags),'memo',x.memo,
    'uploaded_by',x.uploaded_by_name,'status','ready','created_at',x.created_at) ORDER BY x.created_at DESC,x.attachment_id)
   FROM crm_security.deal_attachments x WHERE x.deal_id=(item->>'id')::uuid AND x.status='ready'),'[]'::jsonb))),'[]'::jsonb)
 INTO rows FROM jsonb_array_elements(coalesce(base->'items','[]'::jsonb)) item;
 RETURN jsonb_set(base,'{items}',rows,false);
END $fn$;
REVOKE EXECUTE ON FUNCTION public.crm_operational_source_v1(text,uuid,integer) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.crm_operational_source_v1(text,uuid,integer) TO authenticated;

DO $post$ BEGIN
 IF has_function_privilege('anon','public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)','EXECUTE')
  OR NOT has_function_privilege('authenticated','public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)','EXECUTE')
  OR has_function_privilege('service_role','public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)','EXECUTE')
  OR NOT has_function_privilege('authenticated','public.crm_operational_source_v1(text,uuid,integer)','EXECUTE')
  OR has_function_privilege('authenticated','crm_security.crm_attachment_command_v1(uuid,text,uuid,jsonb)','EXECUTE')
  OR has_table_privilege('authenticated','crm_security.deal_attachments','SELECT')
  OR has_table_privilege('authenticated','crm_security.attachment_audit_events','SELECT')
  OR NOT (SELECT relrowsecurity FROM pg_class WHERE oid='crm_security.deal_attachments'::regclass)
  OR NOT (SELECT relrowsecurity FROM pg_class WHERE oid='crm_security.attachment_audit_events'::regclass)
 THEN RAISE EXCEPTION 'attachment compatibility post-apply drift'; END IF;
END $post$;
DO $cutover_candidate_post$ BEGIN
 IF to_regprocedure('public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)') IS NULL
  OR to_regprocedure('public.crm_operational_source_v1(text,uuid,integer)') IS NULL
  OR to_regprocedure('crm_security.crm_opportunity_create_command_v1(uuid,uuid,jsonb)') IS NULL
  OR to_regprocedure('crm_security.crm_inquiry_response_command_v1(uuid,uuid,jsonb)') IS NULL
  OR to_regprocedure('crm_security.crm_inquiry_pipeline_promote_command_v1(uuid,text,uuid,integer,jsonb)') IS NULL OR to_regprocedure('crm_security.crm_inquiry_lineage_link_command_v1(uuid,uuid,integer,jsonb)') IS NULL
  OR to_regprocedure('crm_security.crm_inquiry_stage_progress_command_v1(uuid,uuid,jsonb)') IS NULL
  OR to_regprocedure('crm_security.crm_inquiry_action_command_v1(uuid,text,uuid,jsonb)') IS NULL
  OR to_regprocedure('crm_security.crm_technical_inquiry_transfer_command_v1(uuid,uuid,jsonb)') IS NULL
  OR to_regprocedure('crm_security.crm_attachment_command_v1(uuid,text,uuid,jsonb)') IS NULL OR to_regclass('crm_security.deal_attachments') IS NULL
  OR to_regprocedure('public.crm_contacts_scoped_v2(uuid)') IS NULL
  OR md5(pg_get_functiondef('public.crm_contacts_scoped_v2(uuid)'::regprocedure))<>'7e811c93e73ba945a0dfea164da55fcd'
  OR (SELECT pg_get_constraintdef(oid,true) FROM pg_constraint WHERE conrelid='crm_security.command_receipts'::regclass AND conname='command_receipts_operation_check') IS DISTINCT FROM $expected$CHECK (operation = ANY (ARRAY['opportunity_work_set'::text, 'inquiry_assign'::text, 'service_change'::text, 'inquiry_unassign'::text, 'favorite_set'::text, 'opportunity_touch'::text, 'next_action'::text, 'activity'::text, 'quote_version'::text, 'next_action_complete'::text, 'stage_check'::text, 'transition'::text, 'close'::text, 'amount'::text, 'waiting_context'::text, 'inquiry_reclassify'::text, 'inquiry_status'::text, 'inquiry_trash'::text, 'inquiry_restore'::text, 'inquiry_purge'::text, 'inquiry_followup'::text, 'opportunity_create'::text, 'lineage_link'::text, 'attachment_prepare'::text, 'attachment_complete'::text]))$expected$
  OR has_function_privilege('authenticated','crm_security.crm_opportunity_create_command_v1(uuid,uuid,jsonb)','EXECUTE')
  OR NOT has_function_privilege('authenticated','public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)','EXECUTE')
 THEN RAISE EXCEPTION 'operational cutover cumulative apply drift'; END IF;
END $cutover_candidate_post$;
-- ===== APPLY close_won =====
-- LOCAL REVIEW CANDIDATE ONLY. Separate Staging approval is required.

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
-- ===== APPLY expansion_pool_update =====
-- LOCAL REVIEW CANDIDATE ONLY. Separate Staging approval is required.

SET LOCAL crm.expansion_update_ref='rprechiaglyjaydkmxsu';
SET LOCAL search_path=pg_catalog;
SET LOCAL lock_timeout='3s';
SET LOCAL statement_timeout='90s';

DO $guard$ BEGIN
 IF current_user<>'postgres'
  OR current_setting('crm.expansion_update_ref',true) IS DISTINCT FROM 'rprechiaglyjaydkmxsu'
  OR to_regprocedure('public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)') IS NULL
  OR to_regprocedure('public.crm_operational_source_v1(text,uuid,integer)') IS NULL
  OR to_regprocedure('crm_security.crm_deal_close_won_command_v1(uuid,uuid,integer,jsonb)') IS NULL
  OR to_regclass('crm_security.expansion_pool') IS NULL
  OR to_regclass('crm_security.deal_won_events') IS NULL
  OR EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='crm_security' AND table_name='expansion_pool' AND column_name='version')
  OR to_regclass('crm_security.expansion_pool_events') IS NOT NULL
  OR to_regprocedure('crm_security.crm_expansion_pool_update_command_v1(uuid,uuid,integer,jsonb)') IS NOT NULL
  OR to_regprocedure('crm_security.crm_write_command_v2_pre_expansion_update_20260906(uuid,text,uuid,integer,jsonb)') IS NOT NULL
  OR to_regprocedure('crm_security.crm_operational_source_v1_pre_expansion_update_20260906(text,uuid,integer)') IS NOT NULL
  OR (SELECT pg_get_constraintdef(oid,true) FROM pg_constraint
      WHERE conrelid='crm_security.command_receipts'::regclass
        AND conname='command_receipts_operation_check') IS DISTINCT FROM $expected$CHECK (operation = ANY (ARRAY['opportunity_work_set'::text, 'inquiry_assign'::text, 'service_change'::text, 'inquiry_unassign'::text, 'favorite_set'::text, 'opportunity_touch'::text, 'next_action'::text, 'activity'::text, 'quote_version'::text, 'next_action_complete'::text, 'stage_check'::text, 'transition'::text, 'close'::text, 'amount'::text, 'waiting_context'::text, 'inquiry_reclassify'::text, 'inquiry_status'::text, 'inquiry_trash'::text, 'inquiry_restore'::text, 'inquiry_purge'::text, 'inquiry_followup'::text, 'opportunity_create'::text, 'lineage_link'::text, 'attachment_prepare'::text, 'attachment_complete'::text]))$expected$
 THEN RAISE EXCEPTION 'expansion pool update prerequisite drift'; END IF;
END $guard$;

ALTER FUNCTION public.crm_write_command_v2(uuid,text,uuid,integer,jsonb) RENAME TO crm_write_command_v2_pre_expansion_update_20260906;
ALTER FUNCTION public.crm_write_command_v2_pre_expansion_update_20260906(uuid,text,uuid,integer,jsonb) SET SCHEMA crm_security;
REVOKE EXECUTE ON FUNCTION crm_security.crm_write_command_v2_pre_expansion_update_20260906(uuid,text,uuid,integer,jsonb) FROM PUBLIC,anon,authenticated,service_role;

ALTER FUNCTION public.crm_operational_source_v1(text,uuid,integer) RENAME TO crm_operational_source_v1_pre_expansion_update_20260906;
ALTER FUNCTION public.crm_operational_source_v1_pre_expansion_update_20260906(text,uuid,integer) SET SCHEMA crm_security;
REVOKE EXECUTE ON FUNCTION crm_security.crm_operational_source_v1_pre_expansion_update_20260906(text,uuid,integer) FROM PUBLIC,anon,authenticated,service_role;

ALTER TABLE crm_security.command_receipts DROP CONSTRAINT command_receipts_operation_check;
ALTER TABLE crm_security.command_receipts ADD CONSTRAINT command_receipts_operation_check CHECK(operation IN (
 'opportunity_work_set','inquiry_assign','service_change','inquiry_unassign','favorite_set','opportunity_touch',
 'next_action','activity','quote_version','next_action_complete','stage_check','transition','close','amount',
 'waiting_context','inquiry_reclassify','inquiry_status','inquiry_trash','inquiry_restore','inquiry_purge',
 'inquiry_followup','opportunity_create','lineage_link','attachment_prepare','attachment_complete','expansion_pool_update'
));

ALTER TABLE crm_security.expansion_pool ADD COLUMN version integer NOT NULL DEFAULT 1;
ALTER TABLE crm_security.expansion_pool ADD CONSTRAINT expansion_pool_version_positive CHECK(version>0);

CREATE TABLE crm_security.expansion_pool_events(
 event_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 request_id uuid NOT NULL UNIQUE,
 source_deal_id uuid NOT NULL REFERENCES public.deals(id) ON DELETE RESTRICT,
 kind text NOT NULL CHECK(kind IN ('status_change','next_contact_change','status_and_next_contact','note')),
 note text,
 before_status text NOT NULL,
 after_status text NOT NULL,
 before_next_contact_at date NOT NULL,
 after_next_contact_at date NOT NULL,
 actor_auth_uid uuid NOT NULL,
 actor_user_id uuid NOT NULL REFERENCES public.users(user_id) ON DELETE RESTRICT,
 actor_name text NOT NULL,
 occurred_at timestamptz NOT NULL,
 CONSTRAINT expansion_pool_event_note_shape CHECK((kind='note')=(note IS NOT NULL))
);
CREATE INDEX expansion_pool_events_source_idx ON crm_security.expansion_pool_events(source_deal_id,occurred_at,event_id);
ALTER TABLE crm_security.expansion_pool_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON crm_security.expansion_pool_events FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION crm_security.crm_expansion_pool_update_command_v1(
 p_request_id uuid,p_source_deal_id uuid,p_expected_version integer,p_payload jsonb
) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $fn$
DECLARE
 a record; prior crm_security.command_receipts%ROWTYPE; oldrow crm_security.expansion_pool%ROWTYPE;
 newrow crm_security.expansion_pool%ROWTYPE; target_status text; target_next date; canonical jsonb;
 event_kind text; event_id_value uuid; audit_id uuid; ack jsonb; server_at timestamptz;
BEGIN
 IF p_request_id IS NULL OR p_source_deal_id IS NULL OR p_expected_version IS NULL OR p_expected_version<1
  OR jsonb_typeof(p_payload) IS DISTINCT FROM 'object'
  OR EXISTS(SELECT 1 FROM jsonb_object_keys(p_payload) k WHERE k NOT IN ('expansion_status','next_contact_at'))
  OR NOT p_payload ?& ARRAY['expansion_status','next_contact_at']
  OR jsonb_typeof(p_payload->'expansion_status') IS DISTINCT FROM 'string'
  OR jsonb_typeof(p_payload->'next_contact_at') IS DISTINCT FROM 'string'
 THEN RAISE EXCEPTION 'invalid expansion pool update payload' USING ERRCODE='22023'; END IF;
 target_status:=p_payload->>'expansion_status';
 IF target_status NOT IN ('신규 대상','접촉 예정','관계 관리중','추가 니즈 확인','보류/휴면')
  OR p_payload->>'next_contact_at' !~ '^\d{4}-\d{2}-\d{2}$'
 THEN RAISE EXCEPTION 'invalid expansion pool update value' USING ERRCODE='22023'; END IF;
 BEGIN target_next:=(p_payload->>'next_contact_at')::date;
 EXCEPTION WHEN datetime_field_overflow THEN RAISE EXCEPTION 'invalid expansion next contact date' USING ERRCODE='22023'; END;
 IF target_next::text<>p_payload->>'next_contact_at' THEN RAISE EXCEPTION 'invalid expansion next contact date' USING ERRCODE='22023'; END IF;
 canonical:=jsonb_build_object('expansion_status',target_status,'next_contact_at',target_next);

 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;
 PERFORM 1 FROM public.users u WHERE u.auth_uid=auth.uid() FOR SHARE;
 PERFORM 1 FROM crm_security.access_review r WHERE r.reviewed_auth_uid=auth.uid() FOR SHARE;
 SELECT * INTO a FROM crm_security.actor(); IF NOT FOUND THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;
 PERFORM 1 FROM crm_security.object_scope s WHERE s.user_id=a.user_id AND s.deal_id=p_source_deal_id FOR SHARE;
 IF a.permission_role NOT IN ('rep','branch','admin') OR NOT crm_security.can_deal(p_source_deal_id,true)
 THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(a.auth_uid::text||p_request_id::text,0));
 SELECT * INTO oldrow FROM crm_security.expansion_pool x WHERE x.source_deal_id=p_source_deal_id FOR UPDATE;
 IF NOT FOUND OR NOT EXISTS(SELECT 1 FROM public.deals d WHERE d.id=p_source_deal_id AND d.outcome='won' AND d.stage_code='won' AND d.lifecycle_status='closed')
 THEN RAISE EXCEPTION 'expansion pool state conflict' USING ERRCODE='PT409'; END IF;
 SELECT * INTO prior FROM crm_security.command_receipts r WHERE r.actor_auth_uid=a.auth_uid AND r.request_id=p_request_id;
 IF FOUND THEN
  IF prior.actor_user_id IS DISTINCT FROM a.user_id OR prior.operation IS DISTINCT FROM 'expansion_pool_update'
   OR prior.object_id IS DISTINCT FROM p_source_deal_id OR prior.expected_version IS DISTINCT FROM p_expected_version
   OR prior.payload IS DISTINCT FROM canonical
  THEN RAISE EXCEPTION 'REQUEST_ID_REUSE' USING ERRCODE='PT409'; END IF;
  RETURN prior.ack||jsonb_build_object('replayed',true);
 END IF;
 IF oldrow.version IS DISTINCT FROM p_expected_version THEN RAISE EXCEPTION 'version conflict' USING ERRCODE='PT409'; END IF;
 IF oldrow.expansion_status=target_status AND oldrow.next_contact_at=target_next
 THEN RAISE EXCEPTION 'expansion pool no-op' USING ERRCODE='PT409'; END IF;
 event_kind:=CASE WHEN oldrow.expansion_status IS DISTINCT FROM target_status AND oldrow.next_contact_at IS DISTINCT FROM target_next THEN 'status_and_next_contact' WHEN oldrow.expansion_status IS DISTINCT FROM target_status THEN 'status_change' ELSE 'next_contact_change' END;
 server_at:=clock_timestamp();
 UPDATE crm_security.expansion_pool SET expansion_status=target_status,next_contact_at=target_next,updated_at=server_at,version=version+1
 WHERE source_deal_id=p_source_deal_id AND version=p_expected_version RETURNING * INTO newrow;
 IF NOT FOUND THEN RAISE EXCEPTION 'unexpected expansion version mutation' USING ERRCODE='PT409'; END IF;
 INSERT INTO crm_security.expansion_pool_events(request_id,source_deal_id,kind,before_status,after_status,before_next_contact_at,after_next_contact_at,actor_auth_uid,actor_user_id,actor_name,occurred_at)
 VALUES(p_request_id,p_source_deal_id,event_kind,oldrow.expansion_status,newrow.expansion_status,oldrow.next_contact_at,newrow.next_contact_at,a.auth_uid,a.user_id,a.display_name,server_at)
 RETURNING event_id INTO event_id_value;
 INSERT INTO crm_security.audit_events(actor_auth_uid,actor_user_id,actor_name,deal_id,action,before_data,after_data,reason,created_at)
 VALUES(a.auth_uid,a.user_id,a.display_name,p_source_deal_id,'expansion_pool_update',jsonb_build_object('version',oldrow.version,'expansion_status',oldrow.expansion_status,'next_contact_at',oldrow.next_contact_at),jsonb_build_object('version',newrow.version,'expansion_status',newrow.expansion_status,'next_contact_at',newrow.next_contact_at,'expansion_event_id',event_id_value),event_kind,server_at)
 RETURNING event_id INTO audit_id;
 ack:=jsonb_build_object('contract_version',1,'ok',true,'request_id',p_request_id,'operation','expansion_pool_update','object_id',p_source_deal_id,'source_opportunity_id',p_source_deal_id,'actor_auth_uid',a.auth_uid,'actor_user_id',a.user_id,'actor_name',a.display_name,'previous_version',p_expected_version,'version',newrow.version,'expansion_status',newrow.expansion_status,'next_contact_at',newrow.next_contact_at,'kind',event_kind,'expansion_event_id',event_id_value,'audit_event_id',audit_id,'server_at',server_at,'replayed',false);
 INSERT INTO crm_security.command_receipts(actor_auth_uid,request_id,actor_user_id,operation,object_id,expected_version,payload,ack)
 VALUES(a.auth_uid,p_request_id,a.user_id,'expansion_pool_update',p_source_deal_id,p_expected_version,canonical,ack);
 RETURN ack;
END $fn$;
REVOKE EXECUTE ON FUNCTION crm_security.crm_expansion_pool_update_command_v1(uuid,uuid,integer,jsonb) FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION public.crm_write_command_v2(p_request_id uuid,p_operation text,p_object_id uuid,p_expected_version integer,p_payload jsonb)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $fn$
BEGIN
 IF p_operation='expansion_pool_update' THEN RETURN crm_security.crm_expansion_pool_update_command_v1(p_request_id,p_object_id,p_expected_version,p_payload); END IF;
 RETURN crm_security.crm_write_command_v2_pre_expansion_update_20260906(p_request_id,p_operation,p_object_id,p_expected_version,p_payload);
END $fn$;
REVOKE EXECUTE ON FUNCTION public.crm_write_command_v2(uuid,text,uuid,integer,jsonb) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.crm_write_command_v2(uuid,text,uuid,integer,jsonb) TO authenticated;

CREATE FUNCTION public.crm_operational_source_v1(p_domain text,p_after uuid DEFAULT NULL,p_limit integer DEFAULT 100)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $fn$
DECLARE base jsonb; rows jsonb;
BEGIN
 base:=crm_security.crm_operational_source_v1_pre_expansion_update_20260906(p_domain,p_after,p_limit);
 IF p_domain<>'expansion_pool' THEN RETURN base; END IF;
 SELECT coalesce(jsonb_agg(item||jsonb_build_object('version',x.version,'events',coalesce((
   SELECT jsonb_agg(jsonb_build_object('id',e.event_id,'source_opportunity_id',e.source_deal_id,'kind',e.kind,'note',CASE e.kind WHEN 'note' THEN e.note WHEN 'status_change' THEN e.before_status||' → '||e.after_status WHEN 'next_contact_change' THEN '다음 접촉 '||e.before_next_contact_at||' → '||e.after_next_contact_at ELSE e.before_status||' → '||e.after_status||' · 다음 접촉 '||e.after_next_contact_at END,'actor',e.actor_name,'occurred_at',e.occurred_at,'created_at',e.occurred_at) ORDER BY e.occurred_at,e.event_id)
   FROM crm_security.expansion_pool_events e WHERE e.source_deal_id=x.source_deal_id),'[]'::jsonb)) ORDER BY (item->>'id')::uuid),'[]'::jsonb)
 INTO rows FROM jsonb_array_elements(coalesce(base->'items','[]'::jsonb)) item JOIN crm_security.expansion_pool x ON x.source_deal_id=(item->>'id')::uuid;
 RETURN jsonb_set(base,'{items}',rows,false);
END $fn$;
REVOKE EXECUTE ON FUNCTION public.crm_operational_source_v1(text,uuid,integer) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.crm_operational_source_v1(text,uuid,integer) TO authenticated;

DO $post$ BEGIN
 IF has_function_privilege('anon','public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)','EXECUTE')
  OR NOT has_function_privilege('authenticated','public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)','EXECUTE')
  OR has_function_privilege('service_role','public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)','EXECUTE')
  OR has_function_privilege('authenticated','crm_security.crm_expansion_pool_update_command_v1(uuid,uuid,integer,jsonb)','EXECUTE')
  OR has_table_privilege('authenticated','crm_security.expansion_pool_events','SELECT')
  OR NOT (SELECT relrowsecurity FROM pg_class WHERE oid='crm_security.expansion_pool_events'::regclass)
  OR (SELECT pg_get_constraintdef(oid,true) FROM pg_constraint WHERE conrelid='crm_security.command_receipts'::regclass AND conname='command_receipts_operation_check') IS DISTINCT FROM $expected$CHECK (operation = ANY (ARRAY['opportunity_work_set'::text, 'inquiry_assign'::text, 'service_change'::text, 'inquiry_unassign'::text, 'favorite_set'::text, 'opportunity_touch'::text, 'next_action'::text, 'activity'::text, 'quote_version'::text, 'next_action_complete'::text, 'stage_check'::text, 'transition'::text, 'close'::text, 'amount'::text, 'waiting_context'::text, 'inquiry_reclassify'::text, 'inquiry_status'::text, 'inquiry_trash'::text, 'inquiry_restore'::text, 'inquiry_purge'::text, 'inquiry_followup'::text, 'opportunity_create'::text, 'lineage_link'::text, 'attachment_prepare'::text, 'attachment_complete'::text, 'expansion_pool_update'::text]))$expected$
 THEN RAISE EXCEPTION 'expansion pool update post-apply drift'; END IF;
END $post$;
-- ===== APPLY expansion_note_context =====
-- LOCAL REVIEW CANDIDATE ONLY. Separate Staging approval is required.

SET LOCAL crm.expansion_note_ref='rprechiaglyjaydkmxsu';
SET LOCAL search_path=pg_catalog;
SET LOCAL lock_timeout='3s';
SET LOCAL statement_timeout='90s';

DO $guard$ BEGIN
 IF current_user<>'postgres' OR current_setting('crm.expansion_note_ref',true) IS DISTINCT FROM 'rprechiaglyjaydkmxsu'
  OR to_regprocedure('public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)') IS NULL
  OR to_regprocedure('crm_security.crm_expansion_pool_update_command_v1(uuid,uuid,integer,jsonb)') IS NULL
  OR to_regclass('crm_security.expansion_pool') IS NULL OR to_regclass('crm_security.expansion_pool_events') IS NULL
  OR to_regprocedure('public.crm_expansion_note(jsonb)') IS NOT NULL OR to_regprocedure('public.crm_expansion_context(jsonb)') IS NOT NULL
  OR (SELECT pg_get_constraintdef(oid,true) FROM pg_constraint WHERE conrelid='crm_security.expansion_pool_events'::regclass AND conname='expansion_pool_events_kind_check') IS DISTINCT FROM $expected$CHECK (kind = ANY (ARRAY['status_change'::text, 'next_contact_change'::text, 'status_and_next_contact'::text, 'note'::text]))$expected$
  OR (SELECT pg_get_constraintdef(oid,true) FROM pg_constraint WHERE conrelid='crm_security.command_receipts'::regclass AND conname='command_receipts_operation_check') IS DISTINCT FROM $expected$CHECK (operation = ANY (ARRAY['opportunity_work_set'::text, 'inquiry_assign'::text, 'service_change'::text, 'inquiry_unassign'::text, 'favorite_set'::text, 'opportunity_touch'::text, 'next_action'::text, 'activity'::text, 'quote_version'::text, 'next_action_complete'::text, 'stage_check'::text, 'transition'::text, 'close'::text, 'amount'::text, 'waiting_context'::text, 'inquiry_reclassify'::text, 'inquiry_status'::text, 'inquiry_trash'::text, 'inquiry_restore'::text, 'inquiry_purge'::text, 'inquiry_followup'::text, 'opportunity_create'::text, 'lineage_link'::text, 'attachment_prepare'::text, 'attachment_complete'::text, 'expansion_pool_update'::text]))$expected$
 THEN RAISE EXCEPTION 'expansion note/context prerequisite drift'; END IF;
END $guard$;

ALTER TABLE crm_security.command_receipts DROP CONSTRAINT command_receipts_operation_check;
ALTER TABLE crm_security.command_receipts ADD CONSTRAINT command_receipts_operation_check CHECK(operation IN (
 'opportunity_work_set','inquiry_assign','service_change','inquiry_unassign','favorite_set','opportunity_touch',
 'next_action','activity','quote_version','next_action_complete','stage_check','transition','close','amount',
 'waiting_context','inquiry_reclassify','inquiry_status','inquiry_trash','inquiry_restore','inquiry_purge',
 'inquiry_followup','opportunity_create','lineage_link','attachment_prepare','attachment_complete',
 'expansion_pool_update','expansion_note'
));

CREATE FUNCTION public.crm_expansion_note(p jsonb) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $fn$
DECLARE
 source_id uuid; request_id_value uuid; note_value text; canonical jsonb; a record;
 pool crm_security.expansion_pool%ROWTYPE; prior crm_security.command_receipts%ROWTYPE;
 event_id_value uuid; audit_id uuid; server_at timestamptz; event_value jsonb; ack jsonb;
BEGIN
 IF jsonb_typeof(p) IS DISTINCT FROM 'object'
  OR EXISTS(SELECT 1 FROM jsonb_object_keys(p) k WHERE k NOT IN ('source_opportunity_id','note','request_id'))
  OR NOT p ?& ARRAY['source_opportunity_id','note','request_id']
  OR jsonb_typeof(p->'source_opportunity_id') IS DISTINCT FROM 'string'
  OR jsonb_typeof(p->'note') IS DISTINCT FROM 'string'
  OR jsonb_typeof(p->'request_id') IS DISTINCT FROM 'string'
 THEN RAISE EXCEPTION 'invalid expansion note payload' USING ERRCODE='22023'; END IF;
 BEGIN source_id:=(p->>'source_opportunity_id')::uuid; request_id_value:=(p->>'request_id')::uuid;
 EXCEPTION WHEN invalid_text_representation THEN RAISE EXCEPTION 'invalid expansion note identity' USING ERRCODE='22023'; END;
 note_value:=trim(p->>'note');
 IF length(note_value)<1 OR length(note_value)>8000 THEN RAISE EXCEPTION 'invalid expansion note' USING ERRCODE='22023'; END IF;
 canonical:=jsonb_build_object('note',note_value);
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;
 PERFORM 1 FROM public.users u WHERE u.auth_uid=auth.uid() FOR SHARE;
 PERFORM 1 FROM crm_security.access_review r WHERE r.reviewed_auth_uid=auth.uid() FOR SHARE;
 SELECT * INTO a FROM crm_security.actor(); IF NOT FOUND THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;
 PERFORM 1 FROM crm_security.object_scope s WHERE s.user_id=a.user_id AND s.deal_id=source_id FOR SHARE;
 IF a.permission_role NOT IN ('rep','branch','admin') OR NOT crm_security.can_deal(source_id,true)
 THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(a.auth_uid::text||request_id_value::text,0));
 SELECT * INTO pool FROM crm_security.expansion_pool x WHERE x.source_deal_id=source_id FOR UPDATE;
 IF NOT FOUND OR NOT EXISTS(SELECT 1 FROM public.deals d WHERE d.id=source_id AND d.outcome='won' AND d.stage_code='won' AND d.lifecycle_status='closed')
 THEN RAISE EXCEPTION 'expansion pool state conflict' USING ERRCODE='PT409'; END IF;
 SELECT * INTO prior FROM crm_security.command_receipts r WHERE r.actor_auth_uid=a.auth_uid AND r.request_id=request_id_value;
 IF FOUND THEN
  IF prior.actor_user_id IS DISTINCT FROM a.user_id OR prior.operation IS DISTINCT FROM 'expansion_note' OR prior.object_id IS DISTINCT FROM source_id OR prior.expected_version IS DISTINCT FROM 0 OR prior.payload IS DISTINCT FROM canonical
  THEN RAISE EXCEPTION 'REQUEST_ID_REUSE' USING ERRCODE='PT409'; END IF;
  RETURN prior.ack||jsonb_build_object('replayed',true);
 END IF;
 server_at:=clock_timestamp();
 INSERT INTO crm_security.expansion_pool_events(request_id,source_deal_id,kind,note,before_status,after_status,before_next_contact_at,after_next_contact_at,actor_auth_uid,actor_user_id,actor_name,occurred_at)
 VALUES(request_id_value,source_id,'note',note_value,pool.expansion_status,pool.expansion_status,pool.next_contact_at,pool.next_contact_at,a.auth_uid,a.user_id,a.display_name,server_at)
 RETURNING event_id INTO event_id_value;
 INSERT INTO crm_security.audit_events(actor_auth_uid,actor_user_id,actor_name,deal_id,action,before_data,after_data,reason,created_at)
 VALUES(a.auth_uid,a.user_id,a.display_name,source_id,'expansion_note',jsonb_build_object('pool_version',pool.version),jsonb_build_object('pool_version',pool.version,'expansion_event_id',event_id_value),note_value,server_at)
 RETURNING event_id INTO audit_id;
 event_value:=jsonb_build_object('id',event_id_value,'source_opportunity_id',source_id,'kind','접촉·니즈 기록','note',note_value,'actor',a.display_name,'created_at',server_at,'occurred_at',server_at);
 ack:=jsonb_build_object('contract_version',1,'ok',true,'request_id',request_id_value,'operation','crm_expansion_note','source_opportunity_id',source_id,'actor_auth_uid',a.auth_uid,'actor_user_id',a.user_id,'event',event_value,'audit_event_id',audit_id,'server_at',server_at,'replayed',false);
 INSERT INTO crm_security.command_receipts(actor_auth_uid,request_id,actor_user_id,operation,object_id,expected_version,payload,ack)
 VALUES(a.auth_uid,request_id_value,a.user_id,'expansion_note',source_id,0,canonical,ack);
 RETURN ack;
END $fn$;
REVOKE EXECUTE ON FUNCTION public.crm_expansion_note(jsonb) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.crm_expansion_note(jsonb) TO authenticated;

CREATE FUNCTION public.crm_expansion_context(p jsonb) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $fn$
DECLARE source_id uuid; a record; events_value jsonb;
BEGIN
 IF jsonb_typeof(p) IS DISTINCT FROM 'object'
  OR EXISTS(SELECT 1 FROM jsonb_object_keys(p) k WHERE k<>'source_opportunity_id')
  OR NOT p ? 'source_opportunity_id' OR jsonb_typeof(p->'source_opportunity_id') IS DISTINCT FROM 'string'
 THEN RAISE EXCEPTION 'invalid expansion context payload' USING ERRCODE='22023'; END IF;
 BEGIN source_id:=(p->>'source_opportunity_id')::uuid;
 EXCEPTION WHEN invalid_text_representation THEN RAISE EXCEPTION 'invalid expansion context identity' USING ERRCODE='22023'; END;
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;
 SELECT * INTO a FROM crm_security.actor();
 IF NOT FOUND OR a.permission_role NOT IN ('rep','branch','admin') OR NOT crm_security.can_deal(source_id,false)
  OR NOT EXISTS(SELECT 1 FROM crm_security.expansion_pool x WHERE x.source_deal_id=source_id)
 THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;
 SELECT coalesce(jsonb_agg(jsonb_build_object('id',e.event_id,'source_opportunity_id',e.source_deal_id,'kind',CASE e.kind WHEN 'note' THEN '접촉·니즈 기록' WHEN 'status_change' THEN '상태 변경' WHEN 'next_contact_change' THEN '다음 접촉일 변경' ELSE '상태·다음 접촉일 변경' END,'note',CASE e.kind WHEN 'note' THEN e.note WHEN 'status_change' THEN e.before_status||' → '||e.after_status WHEN 'next_contact_change' THEN '다음 접촉 '||e.before_next_contact_at||' → '||e.after_next_contact_at ELSE e.before_status||' → '||e.after_status||' · 다음 접촉 '||e.after_next_contact_at END,'actor',e.actor_name,'created_at',e.occurred_at,'occurred_at',e.occurred_at) ORDER BY e.occurred_at,e.event_id),'[]'::jsonb)
 INTO events_value FROM crm_security.expansion_pool_events e WHERE e.source_deal_id=source_id;
 RETURN jsonb_build_object('contract_version',1,'ok',true,'source_opportunity_id',source_id,'events',events_value,'dispatches','[]'::jsonb,'dispatch_completeness','unavailable_until_X03');
END $fn$;
REVOKE EXECUTE ON FUNCTION public.crm_expansion_context(jsonb) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.crm_expansion_context(jsonb) TO authenticated;

DO $post$ BEGIN
 IF has_function_privilege('anon','public.crm_expansion_note(jsonb)','EXECUTE') OR has_function_privilege('anon','public.crm_expansion_context(jsonb)','EXECUTE')
  OR NOT has_function_privilege('authenticated','public.crm_expansion_note(jsonb)','EXECUTE') OR NOT has_function_privilege('authenticated','public.crm_expansion_context(jsonb)','EXECUTE')
  OR has_function_privilege('service_role','public.crm_expansion_note(jsonb)','EXECUTE') OR has_function_privilege('service_role','public.crm_expansion_context(jsonb)','EXECUTE')
  OR has_table_privilege('authenticated','crm_security.expansion_pool_events','SELECT')
  OR (SELECT pg_get_constraintdef(oid,true) FROM pg_constraint WHERE conrelid='crm_security.command_receipts'::regclass AND conname='command_receipts_operation_check') IS DISTINCT FROM $expected$CHECK (operation = ANY (ARRAY['opportunity_work_set'::text, 'inquiry_assign'::text, 'service_change'::text, 'inquiry_unassign'::text, 'favorite_set'::text, 'opportunity_touch'::text, 'next_action'::text, 'activity'::text, 'quote_version'::text, 'next_action_complete'::text, 'stage_check'::text, 'transition'::text, 'close'::text, 'amount'::text, 'waiting_context'::text, 'inquiry_reclassify'::text, 'inquiry_status'::text, 'inquiry_trash'::text, 'inquiry_restore'::text, 'inquiry_purge'::text, 'inquiry_followup'::text, 'opportunity_create'::text, 'lineage_link'::text, 'attachment_prepare'::text, 'attachment_complete'::text, 'expansion_pool_update'::text, 'expansion_note'::text]))$expected$
 THEN RAISE EXCEPTION 'expansion note/context post-apply drift'; END IF;
END $post$;
-- ===== APPLY message_reminder =====
-- LOCAL REVIEW CANDIDATE ONLY. Separate Staging approval is required.

SET LOCAL crm.message_reminder_ref='rprechiaglyjaydkmxsu';
SET LOCAL search_path=pg_catalog;
SET LOCAL lock_timeout='3s';
SET LOCAL statement_timeout='90s';

DO $guard$ BEGIN
 IF current_user<>'postgres' OR current_setting('crm.message_reminder_ref',true) IS DISTINCT FROM 'rprechiaglyjaydkmxsu'
  OR to_regprocedure('public.crm_expansion_note(jsonb)') IS NULL OR to_regprocedure('public.crm_expansion_context(jsonb)') IS NULL
  OR to_regprocedure('crm_security.crm_pipeline_action_command_v1(uuid,text,uuid,integer,jsonb)') IS NULL
  OR to_regprocedure('crm_security.crm_pipeline_action_command_v1_pre_message_reminder_20260906(uuid,text,uuid,integer,jsonb)') IS NOT NULL
  OR to_regprocedure('crm_security.crm_message_reminder_command_v1(uuid,uuid,integer,jsonb)') IS NOT NULL
  OR to_regprocedure('public.crm_operational_source_v1(text,uuid,integer)') IS NULL
  OR to_regprocedure('crm_security.crm_operational_source_v1_pre_message_reminder_20260906(text,uuid,integer)') IS NOT NULL
  OR to_regclass('crm_security.message_reminders') IS NOT NULL
  OR (SELECT pg_get_constraintdef(oid,true) FROM pg_constraint WHERE conrelid='crm_security.command_receipts'::regclass AND conname='command_receipts_operation_check') IS DISTINCT FROM $expected$CHECK (operation = ANY (ARRAY['opportunity_work_set'::text, 'inquiry_assign'::text, 'service_change'::text, 'inquiry_unassign'::text, 'favorite_set'::text, 'opportunity_touch'::text, 'next_action'::text, 'activity'::text, 'quote_version'::text, 'next_action_complete'::text, 'stage_check'::text, 'transition'::text, 'close'::text, 'amount'::text, 'waiting_context'::text, 'inquiry_reclassify'::text, 'inquiry_status'::text, 'inquiry_trash'::text, 'inquiry_restore'::text, 'inquiry_purge'::text, 'inquiry_followup'::text, 'opportunity_create'::text, 'lineage_link'::text, 'attachment_prepare'::text, 'attachment_complete'::text, 'expansion_pool_update'::text, 'expansion_note'::text]))$expected$
 THEN RAISE EXCEPTION 'message reminder prerequisite drift'; END IF;
END $guard$;

CREATE TABLE crm_security.message_reminders(
 next_action_id uuid PRIMARY KEY REFERENCES public.next_actions(id) ON DELETE CASCADE,
 request_id uuid NOT NULL UNIQUE,
 deal_id uuid NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,
 scheduled_at timestamptz NOT NULL,
 channel text NOT NULL CHECK(channel IN ('sms','kakao')),
 template_key text NOT NULL CHECK(length(template_key) BETWEEN 1 AND 100),
 draft_body text NOT NULL CHECK(length(draft_body) BETWEEN 1 AND 8000),
 actor_auth_uid uuid NOT NULL,
 actor_user_id uuid NOT NULL REFERENCES public.users(user_id),
 actor_name text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
ALTER TABLE crm_security.message_reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_security.message_reminders FORCE ROW LEVEL SECURITY;
REVOKE ALL ON crm_security.message_reminders FROM PUBLIC,anon,authenticated,service_role;

ALTER FUNCTION crm_security.crm_pipeline_action_command_v1(uuid,text,uuid,integer,jsonb)
 RENAME TO crm_pipeline_action_command_v1_pre_message_reminder_20260906;
REVOKE EXECUTE ON FUNCTION crm_security.crm_pipeline_action_command_v1_pre_message_reminder_20260906(uuid,text,uuid,integer,jsonb)
 FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION crm_security.crm_message_reminder_command_v1(
 p_request_id uuid,p_object_id uuid,p_expected_version integer,p_payload jsonb
) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $fn$
DECLARE
 a record; oldrow public.deals%ROWTYPE; newrow public.deals%ROWTYPE; prior crm_security.command_receipts%ROWTYPE;
 scheduled_value timestamptz; due_value date; type_value text; text_value text; channel_value text;
 template_value text; draft_value text; owner_name text; actor_email text; server_at timestamptz;
 next_id uuid; activity_id uuid; audit_id uuid; cancelled_ids jsonb:='[]'::jsonb; canonical jsonb; ack jsonb;
BEGIN
 IF p_request_id IS NULL OR p_object_id IS NULL OR p_expected_version IS NULL OR p_expected_version<0
  OR jsonb_typeof(p_payload) IS DISTINCT FROM 'object'
  OR EXISTS(SELECT 1 FROM jsonb_object_keys(p_payload) k WHERE k NOT IN ('intent','type','text','due_at','scheduled_at','channel','template_key','draft_body'))
  OR NOT p_payload ?& ARRAY['intent','type','text','due_at','scheduled_at','channel','template_key','draft_body']
  OR p_payload->>'intent'<>'message_reminder' OR p_payload->>'type'<>'메시지발송'
  OR p_payload->>'due_at' !~ '^\d{4}-\d{2}-\d{2}$'
  OR p_payload->>'channel' NOT IN ('sms','kakao')
  OR length(btrim(p_payload->>'text'))<1 OR length(p_payload->>'text')>500
  OR length(btrim(p_payload->>'template_key'))<1 OR length(p_payload->>'template_key')>100
  OR length(btrim(p_payload->>'draft_body'))<1 OR length(p_payload->>'draft_body')>8000
 THEN RAISE EXCEPTION 'invalid message reminder payload' USING ERRCODE='22023'; END IF;
 BEGIN
  due_value:=(p_payload->>'due_at')::date;
  scheduled_value:=(p_payload->>'scheduled_at')::timestamptz;
 EXCEPTION WHEN datetime_field_overflow OR invalid_datetime_format THEN
  RAISE EXCEPTION 'invalid message reminder schedule' USING ERRCODE='22023';
 END;
 IF NOT isfinite(scheduled_value) OR due_value IS DISTINCT FROM (scheduled_value AT TIME ZONE 'Asia/Seoul')::date
 THEN RAISE EXCEPTION 'message reminder date mismatch' USING ERRCODE='22023'; END IF;
 type_value:='메시지발송'; text_value:=btrim(p_payload->>'text'); channel_value:=p_payload->>'channel';
 template_value:=btrim(p_payload->>'template_key'); draft_value:=btrim(p_payload->>'draft_body');
 canonical:=jsonb_build_object('intent','message_reminder','type',type_value,'text',text_value,'due_at',due_value,
  'scheduled_at',scheduled_value,'channel',channel_value,'template_key',template_value,'draft_body',draft_value);
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;
 PERFORM 1 FROM public.users u WHERE u.auth_uid=auth.uid() FOR SHARE;
 PERFORM 1 FROM crm_security.access_review r WHERE r.reviewed_auth_uid=auth.uid() FOR SHARE;
 SELECT * INTO a FROM crm_security.actor();
 IF NOT FOUND OR a.permission_role NOT IN ('rep','branch','admin') THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;
 PERFORM 1 FROM crm_security.object_scope s WHERE s.user_id=a.user_id AND s.deal_id=p_object_id FOR SHARE;
 SELECT * INTO oldrow FROM public.deals d WHERE d.id=p_object_id FOR UPDATE;
 IF NOT FOUND OR NOT crm_security.can_deal(p_object_id,true) THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(a.auth_uid::text||p_request_id::text,0));
 SELECT * INTO prior FROM crm_security.command_receipts r WHERE r.actor_auth_uid=a.auth_uid AND r.request_id=p_request_id;
 IF FOUND THEN
  IF prior.actor_user_id IS DISTINCT FROM a.user_id OR prior.operation IS DISTINCT FROM 'next_action'
   OR prior.object_id IS DISTINCT FROM p_object_id OR prior.expected_version IS DISTINCT FROM p_expected_version
   OR prior.payload IS DISTINCT FROM canonical
  THEN RAISE EXCEPTION 'REQUEST_ID_REUSE' USING ERRCODE='PT409'; END IF;
  RETURN prior.ack||jsonb_build_object('replayed',true);
 END IF;
 IF oldrow.version IS DISTINCT FROM p_expected_version THEN RAISE EXCEPTION 'version conflict' USING ERRCODE='PT409'; END IF;
 server_at:=clock_timestamp();
 IF scheduled_value<=server_at THEN RAISE EXCEPTION 'message reminder must be future' USING ERRCODE='22023'; END IF;
 SELECT u.name,u.email INTO owner_name,actor_email
 FROM public.users u JOIN crm_security.access_review r ON r.user_id=u.user_id
 WHERE u.user_id=oldrow.owner_id AND u.active AND r.approved AND r.expires_at>now()
  AND r.permission_role IN ('rep','branch','admin');
 SELECT u.email INTO actor_email FROM public.users u WHERE u.user_id=a.user_id;
 IF owner_name IS NULL OR actor_email IS NULL THEN RAISE EXCEPTION 'No approved UUID owner' USING ERRCODE='42501'; END IF;
 SELECT coalesce(jsonb_agg(id ORDER BY created_at,id),'[]'::jsonb) INTO cancelled_ids
 FROM public.next_actions WHERE deal_id=p_object_id AND status='open';
 UPDATE public.next_actions SET status='cancelled',updated_at=server_at WHERE deal_id=p_object_id AND status='open';
 INSERT INTO public.next_actions(deal_id,action_type,title,due_at,assignee_name,status,created_at,updated_at)
 VALUES(p_object_id,type_value,text_value,scheduled_value,owner_name,'open',server_at,server_at) RETURNING id INTO next_id;
 INSERT INTO crm_security.message_reminders(next_action_id,request_id,deal_id,scheduled_at,channel,template_key,draft_body,actor_auth_uid,actor_user_id,actor_name,created_at)
 VALUES(next_id,p_request_id,p_object_id,scheduled_value,channel_value,template_value,draft_value,a.auth_uid,a.user_id,a.display_name,server_at);
 INSERT INTO public.activities(deal_id,organization_id,actor_email,actor_name,type,detail,occurred_at)
 VALUES(p_object_id,oldrow.organization_id,actor_email,a.display_name,'예약',
  jsonb_build_object('note',CASE channel_value WHEN 'sms' THEN '문자' ELSE '카카오' END||' 발송 알림 예약','result',text_value||' · '||scheduled_value,'meaningful_contact',false,'next_action_id',next_id),server_at)
 RETURNING id INTO activity_id;
 UPDATE public.deals SET next_action=text_value,next_action_date=due_value,last_activity_at=greatest(last_activity_at,server_at),updated_at=server_at,version=version+1
 WHERE id=p_object_id AND version=p_expected_version RETURNING * INTO newrow;
 IF NOT FOUND THEN RAISE EXCEPTION 'unexpected version mutation' USING ERRCODE='PT409'; END IF;
 INSERT INTO crm_security.audit_events(actor_auth_uid,actor_user_id,actor_name,deal_id,action,before_data,after_data,reason,created_at)
 VALUES(a.auth_uid,a.user_id,a.display_name,p_object_id,'message_reminder',
  jsonb_build_object('version',oldrow.version,'next_action',oldrow.next_action,'next_action_date',oldrow.next_action_date),
  jsonb_build_object('version',newrow.version,'intent','message_reminder','next_action_id',next_id,'activity_id',activity_id,'cancelled_action_ids',cancelled_ids,'scheduled_at',scheduled_value,'channel',channel_value,'template_key',template_value),text_value,server_at)
 RETURNING event_id INTO audit_id;
 ack:=jsonb_build_object('contract_version',1,'ok',true,'request_id',p_request_id,'operation','next_action','object_id',p_object_id,
  'intent','message_reminder','actor_auth_uid',a.auth_uid,'actor_user_id',a.user_id,'previous_version',p_expected_version,'version',newrow.version,
  'next_action_id',next_id,'activity_id',activity_id,'audit_event_id',audit_id,'cancelled_action_ids',cancelled_ids,
  'due_at',due_value,'scheduled_at',scheduled_value,'channel',channel_value,'template_key',template_value,'assignee_name',owner_name,'server_at',server_at,'replayed',false);
 INSERT INTO crm_security.command_receipts(actor_auth_uid,request_id,actor_user_id,operation,object_id,expected_version,payload,ack,created_at)
 VALUES(a.auth_uid,p_request_id,a.user_id,'next_action',p_object_id,p_expected_version,canonical,ack,server_at);
 RETURN ack;
END $fn$;
REVOKE EXECUTE ON FUNCTION crm_security.crm_message_reminder_command_v1(uuid,uuid,integer,jsonb) FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION crm_security.crm_pipeline_action_command_v1(
 p_request_id uuid,p_operation text,p_object_id uuid,p_expected_version integer,p_payload jsonb
) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $fn$
BEGIN
 IF p_operation='next_action' AND p_payload->>'intent'='message_reminder'
 THEN RETURN crm_security.crm_message_reminder_command_v1(p_request_id,p_object_id,p_expected_version,p_payload); END IF;
 RETURN crm_security.crm_pipeline_action_command_v1_pre_message_reminder_20260906(p_request_id,p_operation,p_object_id,p_expected_version,p_payload);
END $fn$;
REVOKE EXECUTE ON FUNCTION crm_security.crm_pipeline_action_command_v1(uuid,text,uuid,integer,jsonb) FROM PUBLIC,anon,authenticated,service_role;

ALTER FUNCTION public.crm_operational_source_v1(text,uuid,integer) RENAME TO crm_operational_source_v1_pre_message_reminder_20260906;
ALTER FUNCTION public.crm_operational_source_v1_pre_message_reminder_20260906(text,uuid,integer) SET SCHEMA crm_security;
REVOKE EXECUTE ON FUNCTION crm_security.crm_operational_source_v1_pre_message_reminder_20260906(text,uuid,integer) FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION public.crm_operational_source_v1(p_domain text,p_after uuid DEFAULT NULL,p_limit integer DEFAULT 100)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $fn$
DECLARE base jsonb; projected jsonb;
BEGIN
 base:=crm_security.crm_operational_source_v1_pre_message_reminder_20260906(p_domain,p_after,p_limit);
 IF p_domain<>'deal_core' THEN RETURN base; END IF;
 SELECT coalesce(jsonb_agg(CASE WHEN r.next_action_id IS NULL THEN item ELSE jsonb_set(item,'{next_action}',
  (item->'next_action')||jsonb_build_object('scheduled_at',r.scheduled_at,'scheduledAt',r.scheduled_at,'channel',r.channel,'template_key',r.template_key,'templateKey',r.template_key,'draft_body',r.draft_body,'draftBody',r.draft_body),false) END
  ORDER BY (item->>'id')::uuid),'[]'::jsonb)
 INTO projected FROM jsonb_array_elements(coalesce(base->'items','[]'::jsonb)) item
 LEFT JOIN crm_security.message_reminders r ON r.next_action_id=nullif(item->'next_action'->>'id','')::uuid;
 RETURN jsonb_set(base,'{items}',projected,false);
END $fn$;
REVOKE EXECUTE ON FUNCTION public.crm_operational_source_v1(text,uuid,integer) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.crm_operational_source_v1(text,uuid,integer) TO authenticated;

DO $post$ BEGIN
 IF has_function_privilege('anon','public.crm_operational_source_v1(text,uuid,integer)','EXECUTE')
  OR NOT has_function_privilege('authenticated','public.crm_operational_source_v1(text,uuid,integer)','EXECUTE')
  OR has_function_privilege('service_role','public.crm_operational_source_v1(text,uuid,integer)','EXECUTE')
  OR has_function_privilege('authenticated','crm_security.crm_message_reminder_command_v1(uuid,uuid,integer,jsonb)','EXECUTE')
  OR has_function_privilege('authenticated','crm_security.crm_pipeline_action_command_v1(uuid,text,uuid,integer,jsonb)','EXECUTE')
  OR has_table_privilege('authenticated','crm_security.message_reminders','SELECT')
 THEN RAISE EXCEPTION 'message reminder post-apply drift'; END IF;
END $post$;
-- ===== APPLY next_action_postpone =====
-- LOCAL REVIEW CANDIDATE ONLY. Separate Staging approval is required.

SET LOCAL crm.next_postpone_ref='rprechiaglyjaydkmxsu';
SET LOCAL search_path=pg_catalog;
SET LOCAL lock_timeout='3s';
SET LOCAL statement_timeout='90s';

DO $guard$ BEGIN
 IF current_user<>'postgres' OR current_setting('crm.next_postpone_ref',true) IS DISTINCT FROM 'rprechiaglyjaydkmxsu'
  OR to_regclass('crm_security.message_reminders') IS NULL
  OR to_regprocedure('crm_security.crm_pipeline_action_command_v1(uuid,text,uuid,integer,jsonb)') IS NULL
  OR to_regprocedure('crm_security.crm_pipeline_action_command_v1_pre_next_postpone_20260906(uuid,text,uuid,integer,jsonb)') IS NOT NULL
  OR to_regprocedure('crm_security.crm_next_action_postpone_command_v1(uuid,uuid,integer,jsonb)') IS NOT NULL
  OR to_regprocedure('public.crm_operational_source_v1(text,uuid,integer)') IS NULL
  OR to_regprocedure('crm_security.crm_operational_source_v1_pre_next_postpone_20260906(text,uuid,integer)') IS NOT NULL
  OR to_regclass('crm_security.next_action_postponements') IS NOT NULL
  OR (SELECT pg_get_constraintdef(oid,true) FROM pg_constraint WHERE conrelid='crm_security.command_receipts'::regclass AND conname='command_receipts_operation_check') IS DISTINCT FROM $expected$CHECK (operation = ANY (ARRAY['opportunity_work_set'::text, 'inquiry_assign'::text, 'service_change'::text, 'inquiry_unassign'::text, 'favorite_set'::text, 'opportunity_touch'::text, 'next_action'::text, 'activity'::text, 'quote_version'::text, 'next_action_complete'::text, 'stage_check'::text, 'transition'::text, 'close'::text, 'amount'::text, 'waiting_context'::text, 'inquiry_reclassify'::text, 'inquiry_status'::text, 'inquiry_trash'::text, 'inquiry_restore'::text, 'inquiry_purge'::text, 'inquiry_followup'::text, 'opportunity_create'::text, 'lineage_link'::text, 'attachment_prepare'::text, 'attachment_complete'::text, 'expansion_pool_update'::text, 'expansion_note'::text]))$expected$
 THEN RAISE EXCEPTION 'next postpone prerequisite drift'; END IF;
END $guard$;

CREATE TABLE crm_security.next_action_postponements(
 event_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 request_id uuid NOT NULL UNIQUE,
 event_kind text NOT NULL DEFAULT 'postpone' CHECK(event_kind IN ('postpone','today_next_week')),
 next_action_id uuid NOT NULL REFERENCES public.next_actions(id) ON DELETE CASCADE,
 replacement_action_id uuid REFERENCES public.next_actions(id) ON DELETE SET NULL,
 deal_id uuid NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,
 before_due_at date NOT NULL,
 after_due_at date NOT NULL,
 postpone_count integer NOT NULL CHECK(postpone_count>0),
 actor_auth_uid uuid NOT NULL,
 actor_user_id uuid NOT NULL REFERENCES public.users(user_id),
 actor_name text NOT NULL,
 changed_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 CHECK(after_due_at>before_due_at)
);
CREATE UNIQUE INDEX next_action_postponements_deal_count_uq ON crm_security.next_action_postponements(deal_id,postpone_count);
ALTER TABLE crm_security.next_action_postponements ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_security.next_action_postponements FORCE ROW LEVEL SECURITY;
REVOKE ALL ON crm_security.next_action_postponements FROM PUBLIC,anon,authenticated,service_role;

ALTER FUNCTION crm_security.crm_pipeline_action_command_v1(uuid,text,uuid,integer,jsonb)
 RENAME TO crm_pipeline_action_command_v1_pre_next_postpone_20260906;
REVOKE EXECUTE ON FUNCTION crm_security.crm_pipeline_action_command_v1_pre_next_postpone_20260906(uuid,text,uuid,integer,jsonb)
 FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION crm_security.crm_next_action_postpone_command_v1(
 p_request_id uuid,p_object_id uuid,p_expected_version integer,p_payload jsonb
) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $fn$
DECLARE
 a record; oldrow public.deals%ROWTYPE; newrow public.deals%ROWTYPE; actionrow public.next_actions%ROWTYPE;
 prior crm_security.command_receipts%ROWTYPE; action_id_value uuid; due_value date; before_due date;
 count_value integer; event_value uuid; activity_value uuid; audit_value uuid; actor_email text;
 server_at timestamptz; canonical jsonb; ack jsonb;
BEGIN
 IF p_request_id IS NULL OR p_object_id IS NULL OR p_expected_version IS NULL OR p_expected_version<0
  OR jsonb_typeof(p_payload) IS DISTINCT FROM 'object'
  OR EXISTS(SELECT 1 FROM jsonb_object_keys(p_payload) k WHERE k NOT IN ('intent','action_id','due_at'))
  OR NOT p_payload ?& ARRAY['intent','action_id','due_at'] OR p_payload->>'intent'<>'postpone'
  OR p_payload->>'due_at' !~ '^\d{4}-\d{2}-\d{2}$'
 THEN RAISE EXCEPTION 'invalid next postpone payload' USING ERRCODE='22023'; END IF;
 BEGIN action_id_value:=(p_payload->>'action_id')::uuid;due_value:=(p_payload->>'due_at')::date;
 EXCEPTION WHEN invalid_text_representation OR datetime_field_overflow OR invalid_datetime_format THEN
  RAISE EXCEPTION 'invalid next postpone identity/date' USING ERRCODE='22023';
 END;
 canonical:=jsonb_build_object('intent','postpone','action_id',action_id_value,'due_at',due_value);
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;
 PERFORM 1 FROM public.users u WHERE u.auth_uid=auth.uid() FOR SHARE;
 PERFORM 1 FROM crm_security.access_review r WHERE r.reviewed_auth_uid=auth.uid() FOR SHARE;
 SELECT * INTO a FROM crm_security.actor();
 IF NOT FOUND OR a.permission_role NOT IN ('rep','branch','admin') THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;
 PERFORM 1 FROM crm_security.object_scope s WHERE s.user_id=a.user_id AND s.deal_id=p_object_id FOR SHARE;
 SELECT * INTO oldrow FROM public.deals d WHERE d.id=p_object_id FOR UPDATE;
 IF NOT FOUND OR NOT crm_security.can_deal(p_object_id,true) THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;
 SELECT * INTO actionrow FROM public.next_actions n WHERE n.id=action_id_value AND n.deal_id=p_object_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'next action not found' USING ERRCODE='PT409'; END IF;
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(a.auth_uid::text||p_request_id::text,0));
 SELECT * INTO prior FROM crm_security.command_receipts r WHERE r.actor_auth_uid=a.auth_uid AND r.request_id=p_request_id;
 IF FOUND THEN
  IF prior.actor_user_id IS DISTINCT FROM a.user_id OR prior.operation IS DISTINCT FROM 'next_action'
   OR prior.object_id IS DISTINCT FROM p_object_id OR prior.expected_version IS DISTINCT FROM p_expected_version
   OR prior.payload IS DISTINCT FROM canonical
  THEN RAISE EXCEPTION 'REQUEST_ID_REUSE' USING ERRCODE='PT409'; END IF;
  RETURN prior.ack||jsonb_build_object('replayed',true);
 END IF;
 IF oldrow.version IS DISTINCT FROM p_expected_version OR actionrow.status<>'open'
 THEN RAISE EXCEPTION 'next postpone state conflict' USING ERRCODE='PT409'; END IF;
 before_due:=(actionrow.due_at AT TIME ZONE 'Asia/Seoul')::date;
 server_at:=clock_timestamp();
 IF due_value<=before_due OR due_value<=(server_at AT TIME ZONE 'Asia/Seoul')::date
 THEN RAISE EXCEPTION 'next postpone must move later' USING ERRCODE='PT409'; END IF;
 SELECT coalesce(max(e.postpone_count),0)+1 INTO count_value
 FROM crm_security.next_action_postponements e WHERE e.deal_id=p_object_id;
 UPDATE public.next_actions SET due_at=due_value::timestamp AT TIME ZONE 'UTC',updated_at=server_at
 WHERE id=action_id_value AND deal_id=p_object_id AND status='open';
 INSERT INTO crm_security.next_action_postponements(request_id,event_kind,next_action_id,deal_id,before_due_at,after_due_at,postpone_count,actor_auth_uid,actor_user_id,actor_name,changed_at)
 VALUES(p_request_id,'postpone',action_id_value,p_object_id,before_due,due_value,count_value,a.auth_uid,a.user_id,a.display_name,server_at)
 RETURNING event_id INTO event_value;
 SELECT u.email INTO actor_email FROM public.users u WHERE u.user_id=a.user_id;
 INSERT INTO public.activities(deal_id,organization_id,actor_email,actor_name,type,detail,occurred_at)
 VALUES(p_object_id,oldrow.organization_id,actor_email,a.display_name,'연기',jsonb_build_object('note','오늘 할 일 연기','result',due_value||' · '||count_value||'회','meaningful_contact',false,'next_action_id',action_id_value,'postpone_event_id',event_value),server_at)
 RETURNING id INTO activity_value;
 UPDATE public.deals SET next_action=actionrow.title,next_action_date=due_value,last_activity_at=greatest(last_activity_at,server_at),updated_at=server_at,version=version+1
 WHERE id=p_object_id AND version=p_expected_version RETURNING * INTO newrow;
 IF NOT FOUND THEN RAISE EXCEPTION 'unexpected version mutation' USING ERRCODE='PT409'; END IF;
 INSERT INTO crm_security.audit_events(actor_auth_uid,actor_user_id,actor_name,deal_id,action,before_data,after_data,reason,created_at)
 VALUES(a.auth_uid,a.user_id,a.display_name,p_object_id,'next_action_postpone',
  jsonb_build_object('version',oldrow.version,'next_action_id',action_id_value,'due_at',before_due),
  jsonb_build_object('version',newrow.version,'intent','postpone','next_action_id',action_id_value,'due_at',due_value,'postpone_count',count_value,'postpone_event_id',event_value,'activity_id',activity_value),
  '오늘 할 일 연기',server_at) RETURNING event_id INTO audit_value;
 ack:=jsonb_build_object('contract_version',1,'ok',true,'request_id',p_request_id,'operation','next_action','object_id',p_object_id,
  'intent','postpone','actor_auth_uid',a.auth_uid,'actor_user_id',a.user_id,'previous_version',p_expected_version,'version',newrow.version,
  'next_action_id',action_id_value,'previous_due_at',before_due,'due_at',due_value,'postpone_count',count_value,
  'postpone_event_id',event_value,'activity_id',activity_value,'audit_event_id',audit_value,'server_at',server_at,'replayed',false);
 INSERT INTO crm_security.command_receipts(actor_auth_uid,request_id,actor_user_id,operation,object_id,expected_version,payload,ack,created_at)
 VALUES(a.auth_uid,p_request_id,a.user_id,'next_action',p_object_id,p_expected_version,canonical,ack,server_at);
 RETURN ack;
END $fn$;
REVOKE EXECUTE ON FUNCTION crm_security.crm_next_action_postpone_command_v1(uuid,uuid,integer,jsonb) FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION crm_security.crm_pipeline_action_command_v1(
 p_request_id uuid,p_operation text,p_object_id uuid,p_expected_version integer,p_payload jsonb
) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $fn$
BEGIN
 IF p_operation='next_action' AND p_payload->>'intent'='postpone'
 THEN RETURN crm_security.crm_next_action_postpone_command_v1(p_request_id,p_object_id,p_expected_version,p_payload); END IF;
 RETURN crm_security.crm_pipeline_action_command_v1_pre_next_postpone_20260906(p_request_id,p_operation,p_object_id,p_expected_version,p_payload);
END $fn$;
REVOKE EXECUTE ON FUNCTION crm_security.crm_pipeline_action_command_v1(uuid,text,uuid,integer,jsonb) FROM PUBLIC,anon,authenticated,service_role;

ALTER FUNCTION public.crm_operational_source_v1(text,uuid,integer) RENAME TO crm_operational_source_v1_pre_next_postpone_20260906;
ALTER FUNCTION public.crm_operational_source_v1_pre_next_postpone_20260906(text,uuid,integer) SET SCHEMA crm_security;
REVOKE EXECUTE ON FUNCTION crm_security.crm_operational_source_v1_pre_next_postpone_20260906(text,uuid,integer) FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION public.crm_operational_source_v1(p_domain text,p_after uuid DEFAULT NULL,p_limit integer DEFAULT 100)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $fn$
DECLARE base jsonb; projected jsonb;
BEGIN
 base:=crm_security.crm_operational_source_v1_pre_next_postpone_20260906(p_domain,p_after,p_limit);
 IF p_domain<>'deal_core' THEN RETURN base; END IF;
 SELECT coalesce(jsonb_agg(CASE WHEN nullif(item->'next_action'->>'id','') IS NULL THEN item ELSE jsonb_set(item,'{next_action}',
  (item->'next_action')||jsonb_build_object('postpone_count',(SELECT count(*)::integer FROM crm_security.next_action_postponements e WHERE e.deal_id=(item->>'id')::uuid),'postponeCount',(SELECT count(*)::integer FROM crm_security.next_action_postponements e WHERE e.deal_id=(item->>'id')::uuid)),false) END
  ORDER BY (item->>'id')::uuid),'[]'::jsonb)
 INTO projected FROM jsonb_array_elements(coalesce(base->'items','[]'::jsonb)) item;
 RETURN jsonb_set(base,'{items}',projected,false);
END $fn$;
REVOKE EXECUTE ON FUNCTION public.crm_operational_source_v1(text,uuid,integer) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.crm_operational_source_v1(text,uuid,integer) TO authenticated;

DO $post$ BEGIN
 IF has_function_privilege('anon','public.crm_operational_source_v1(text,uuid,integer)','EXECUTE')
  OR NOT has_function_privilege('authenticated','public.crm_operational_source_v1(text,uuid,integer)','EXECUTE')
  OR has_function_privilege('service_role','public.crm_operational_source_v1(text,uuid,integer)','EXECUTE')
  OR has_function_privilege('authenticated','crm_security.crm_next_action_postpone_command_v1(uuid,uuid,integer,jsonb)','EXECUTE')
  OR has_table_privilege('authenticated','crm_security.next_action_postponements','SELECT')
 THEN RAISE EXCEPTION 'next postpone post-apply drift'; END IF;
END $post$;
-- ===== APPLY mobile_today_outcome =====
-- LOCAL REVIEW CANDIDATE ONLY. Separate Staging approval is required.

SET LOCAL crm.mobile_today_ref='rprechiaglyjaydkmxsu';
SET LOCAL search_path=pg_catalog;
SET LOCAL lock_timeout='3s';
SET LOCAL statement_timeout='90s';

DO $guard$ BEGIN
 IF current_user<>'postgres' OR current_setting('crm.mobile_today_ref',true) IS DISTINCT FROM 'rprechiaglyjaydkmxsu'
  OR to_regclass('crm_security.next_action_postponements') IS NULL
  OR to_regprocedure('public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)') IS NULL
  OR to_regprocedure('crm_security.crm_write_command_v2_pre_mobile_today_20260906(uuid,text,uuid,integer,jsonb)') IS NOT NULL
  OR to_regprocedure('crm_security.crm_mobile_today_outcome_command_v1(uuid,text,uuid,integer,jsonb)') IS NOT NULL
  OR NOT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='crm_security' AND table_name='next_action_postponements' AND column_name='event_kind')
  OR NOT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='crm_security' AND table_name='next_action_postponements' AND column_name='replacement_action_id')
  OR (SELECT pg_get_constraintdef(oid,true) FROM pg_constraint WHERE conrelid='crm_security.command_receipts'::regclass AND conname='command_receipts_operation_check') IS DISTINCT FROM $expected$CHECK (operation = ANY (ARRAY['opportunity_work_set'::text, 'inquiry_assign'::text, 'service_change'::text, 'inquiry_unassign'::text, 'favorite_set'::text, 'opportunity_touch'::text, 'next_action'::text, 'activity'::text, 'quote_version'::text, 'next_action_complete'::text, 'stage_check'::text, 'transition'::text, 'close'::text, 'amount'::text, 'waiting_context'::text, 'inquiry_reclassify'::text, 'inquiry_status'::text, 'inquiry_trash'::text, 'inquiry_restore'::text, 'inquiry_purge'::text, 'inquiry_followup'::text, 'opportunity_create'::text, 'lineage_link'::text, 'attachment_prepare'::text, 'attachment_complete'::text, 'expansion_pool_update'::text, 'expansion_note'::text]))$expected$
 THEN RAISE EXCEPTION 'mobile Today outcome prerequisite drift'; END IF;
END $guard$;

LOCK TABLE crm_security.command_receipts IN ACCESS EXCLUSIVE MODE;
ALTER FUNCTION public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)
 RENAME TO crm_write_command_v2_pre_mobile_today_20260906;
ALTER FUNCTION public.crm_write_command_v2_pre_mobile_today_20260906(uuid,text,uuid,integer,jsonb)
 SET SCHEMA crm_security;
REVOKE EXECUTE ON FUNCTION crm_security.crm_write_command_v2_pre_mobile_today_20260906(uuid,text,uuid,integer,jsonb)
 FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION crm_security.crm_mobile_today_outcome_command_v1(
 p_request_id uuid,p_operation text,p_object_id uuid,p_expected_version integer,p_payload jsonb
) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $fn$
DECLARE
 a record; oldrow public.deals%ROWTYPE; newrow public.deals%ROWTYPE; actionrow public.next_actions%ROWTYPE;
 prior crm_security.command_receipts%ROWTYPE; action_id_value uuid; replacement_id uuid; activity_id uuid; audit_id uuid; postpone_event_id uuid;
 outcome_value text; action_type_value text; note_value text; result_value text; next_type_value text; next_title_value text;
 meaningful_value boolean; delay_days integer; due_value date; before_due date; count_value integer; actor_email text; owner_name text;
 server_at timestamptz; canonical jsonb; ack jsonb; cancelled_ids jsonb;
BEGIN
 IF p_request_id IS NULL OR p_object_id IS NULL OR p_expected_version IS NULL OR p_expected_version<0
  OR p_operation IS DISTINCT FROM 'next_action_complete' OR jsonb_typeof(p_payload) IS DISTINCT FROM 'object'
  OR EXISTS(SELECT 1 FROM jsonb_object_keys(p_payload) k WHERE k NOT IN ('intent','action_id','outcome'))
  OR NOT p_payload ?& ARRAY['intent','action_id','outcome'] OR p_payload->>'intent'<>'today_outcome'
  OR p_payload->>'outcome' NOT IN ('progress','next_week','missed')
 THEN RAISE EXCEPTION 'invalid mobile Today outcome payload' USING ERRCODE='22023'; END IF;
 BEGIN action_id_value:=(p_payload->>'action_id')::uuid;
 EXCEPTION WHEN invalid_text_representation THEN RAISE EXCEPTION 'invalid mobile Today action identity' USING ERRCODE='22023'; END;
 outcome_value:=p_payload->>'outcome';
 canonical:=jsonb_build_object('intent','today_outcome','action_id',action_id_value,'outcome',outcome_value);
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;
 PERFORM 1 FROM public.users u WHERE u.auth_uid=auth.uid() FOR SHARE;
 PERFORM 1 FROM crm_security.access_review r WHERE r.reviewed_auth_uid=auth.uid() FOR SHARE;
 SELECT * INTO a FROM crm_security.actor();
 IF NOT FOUND OR a.permission_role NOT IN ('rep','branch','admin') THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;
 PERFORM 1 FROM crm_security.object_scope s WHERE s.user_id=a.user_id AND s.deal_id=p_object_id FOR SHARE;
 SELECT * INTO oldrow FROM public.deals d WHERE d.id=p_object_id FOR UPDATE;
 IF NOT FOUND OR NOT crm_security.can_deal(p_object_id,true) THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;
 SELECT * INTO actionrow FROM public.next_actions n WHERE n.id=action_id_value AND n.deal_id=p_object_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'next action not found' USING ERRCODE='PT409'; END IF;
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(a.auth_uid::text||p_request_id::text,0));
 SELECT * INTO prior FROM crm_security.command_receipts r WHERE r.actor_auth_uid=a.auth_uid AND r.request_id=p_request_id;
 IF FOUND THEN
  IF prior.actor_user_id IS DISTINCT FROM a.user_id OR prior.operation IS DISTINCT FROM p_operation
   OR prior.object_id IS DISTINCT FROM p_object_id OR prior.expected_version IS DISTINCT FROM p_expected_version
   OR prior.payload IS DISTINCT FROM canonical
  THEN RAISE EXCEPTION 'REQUEST_ID_REUSE' USING ERRCODE='PT409'; END IF;
  RETURN prior.ack||jsonb_build_object('replayed',true);
 END IF;
 IF oldrow.version IS DISTINCT FROM p_expected_version OR actionrow.status<>'open'
  OR action_id_value IS DISTINCT FROM (SELECT n.id FROM public.next_actions n WHERE n.deal_id=p_object_id AND n.status='open' ORDER BY n.due_at NULLS LAST,n.id LIMIT 1)
 THEN RAISE EXCEPTION 'mobile Today action state conflict' USING ERRCODE='PT409'; END IF;
 SELECT u.name INTO owner_name FROM public.users u JOIN crm_security.access_review r ON r.user_id=u.user_id
 WHERE u.user_id=oldrow.owner_id AND u.active AND r.approved AND r.expires_at>now() AND r.permission_role IN ('rep','branch','admin');
 IF owner_name IS NULL THEN RAISE EXCEPTION 'No approved UUID owner' USING ERRCODE='42501'; END IF;
 server_at:=clock_timestamp();before_due:=(actionrow.due_at AT TIME ZONE 'UTC')::date;
 IF outcome_value='progress' THEN action_type_value:='전화';note_value:='통화 — 진행됨';result_value:='다음 일정 협의';meaningful_value:=true;next_type_value:='후속확인';next_title_value:='통화 후속 확인';delay_days:=3;
 ELSIF outcome_value='next_week' THEN action_type_value:='전화';note_value:='고객 요청으로 후속 연기';meaningful_value:=true;next_type_value:='재연락';next_title_value:='고객 요청 재연락';delay_days:=7;
 ELSE action_type_value:='부재';note_value:='전화 부재 — 못 받으심';result_value:='';meaningful_value:=false;next_type_value:='재통화';next_title_value:='재통화 시도';delay_days:=1;
 END IF;
 due_value:=(server_at AT TIME ZONE 'Asia/Seoul')::date+delay_days;
 SELECT coalesce(jsonb_agg(n.id ORDER BY n.due_at NULLS LAST,n.id),'[]'::jsonb) INTO cancelled_ids
 FROM public.next_actions n WHERE n.deal_id=p_object_id AND n.status='open' AND n.id<>action_id_value;
 UPDATE public.next_actions SET status='completed',completed_at=server_at,updated_at=server_at WHERE id=action_id_value AND status='open';
 UPDATE public.next_actions SET status='cancelled',updated_at=server_at WHERE deal_id=p_object_id AND status='open';
 INSERT INTO public.next_actions(deal_id,action_type,title,due_at,assignee_name,status,created_at,updated_at)
 VALUES(p_object_id,next_type_value,next_title_value,due_value::timestamp AT TIME ZONE 'UTC',owner_name,'open',server_at,server_at)
 RETURNING id INTO replacement_id;
 SELECT coalesce(max(e.postpone_count),0) INTO count_value FROM crm_security.next_action_postponements e WHERE e.deal_id=p_object_id;
 IF outcome_value='next_week' THEN
  count_value:=count_value+1;
  INSERT INTO crm_security.next_action_postponements(request_id,event_kind,next_action_id,replacement_action_id,deal_id,before_due_at,after_due_at,postpone_count,actor_auth_uid,actor_user_id,actor_name,changed_at)
  VALUES(p_request_id,'today_next_week',action_id_value,replacement_id,p_object_id,before_due,due_value,count_value,a.auth_uid,a.user_id,a.display_name,server_at)
  RETURNING event_id INTO postpone_event_id;
  result_value:='재연락 요청 (연기 '||count_value||'회)';
 END IF;
 SELECT u.email INTO actor_email FROM public.users u WHERE u.user_id=a.user_id;
 INSERT INTO public.activities(deal_id,organization_id,actor_email,actor_name,type,detail,occurred_at)
 VALUES(p_object_id,oldrow.organization_id,actor_email,a.display_name,action_type_value,
  jsonb_build_object('note',note_value,'result',result_value,'meaningful_contact',meaningful_value,'completed_action_id',action_id_value,'next_action_id',replacement_id,'postpone_event_id',postpone_event_id),server_at)
 RETURNING id INTO activity_id;
 UPDATE public.deals SET next_action=next_title_value,next_action_date=due_value,last_activity_at=greatest(last_activity_at,server_at),
  last_customer_contact_at=CASE WHEN meaningful_value THEN greatest(last_customer_contact_at,server_at) ELSE last_customer_contact_at END,
  updated_at=server_at,version=version+1 WHERE id=p_object_id AND version=p_expected_version RETURNING * INTO newrow;
 IF NOT FOUND THEN RAISE EXCEPTION 'unexpected version mutation' USING ERRCODE='PT409'; END IF;
 INSERT INTO crm_security.audit_events(actor_auth_uid,actor_user_id,actor_name,deal_id,action,before_data,after_data,reason,created_at)
 VALUES(a.auth_uid,a.user_id,a.display_name,p_object_id,'next_action_today_outcome',
  jsonb_build_object('version',oldrow.version,'action_id',action_id_value,'action_status',actionrow.status,'due_at',before_due),
  jsonb_build_object('version',newrow.version,'intent','today_outcome','outcome',outcome_value,'completed_action_id',action_id_value,'next_action_id',replacement_id,'due_at',due_value,'postpone_count',count_value,'postpone_event_id',postpone_event_id,'activity_id',activity_id,'cancelled_action_ids',cancelled_ids),
  outcome_value,server_at) RETURNING event_id INTO audit_id;
 ack:=jsonb_build_object('contract_version',1,'ok',true,'request_id',p_request_id,'operation',p_operation,'object_id',p_object_id,
  'intent','today_outcome','outcome',outcome_value,'actor_auth_uid',a.auth_uid,'actor_user_id',a.user_id,
  'previous_version',p_expected_version,'version',newrow.version,'completed_action_id',action_id_value,'action_status','completed',
  'next_action_id',replacement_id,'due_at',due_value,'postpone_count',count_value,'postpone_event_id',postpone_event_id,
  'activity_id',activity_id,'audit_event_id',audit_id,'cancelled_action_ids',cancelled_ids,'completed_at',server_at,'server_at',server_at,'replayed',false);
 INSERT INTO crm_security.command_receipts(actor_auth_uid,request_id,actor_user_id,operation,object_id,expected_version,payload,ack,created_at)
 VALUES(a.auth_uid,p_request_id,a.user_id,p_operation,p_object_id,p_expected_version,canonical,ack,server_at);
 RETURN ack;
END $fn$;
REVOKE EXECUTE ON FUNCTION crm_security.crm_mobile_today_outcome_command_v1(uuid,text,uuid,integer,jsonb) FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION public.crm_write_command_v2(
 p_request_id uuid,p_operation text,p_object_id uuid,p_expected_version integer,p_payload jsonb
) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $fn$
BEGIN
 IF p_operation='next_action_complete' AND p_payload->>'intent'='today_outcome'
 THEN RETURN crm_security.crm_mobile_today_outcome_command_v1(p_request_id,p_operation,p_object_id,p_expected_version,p_payload); END IF;
 RETURN crm_security.crm_write_command_v2_pre_mobile_today_20260906(p_request_id,p_operation,p_object_id,p_expected_version,p_payload);
END $fn$;
REVOKE EXECUTE ON FUNCTION public.crm_write_command_v2(uuid,text,uuid,integer,jsonb) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.crm_write_command_v2(uuid,text,uuid,integer,jsonb) TO authenticated;

DO $post$ BEGIN
 IF has_function_privilege('authenticated','crm_security.crm_mobile_today_outcome_command_v1(uuid,text,uuid,integer,jsonb)','EXECUTE')
  OR has_function_privilege('authenticated','crm_security.crm_write_command_v2_pre_mobile_today_20260906(uuid,text,uuid,integer,jsonb)','EXECUTE')
  OR NOT has_function_privilege('authenticated','public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)','EXECUTE')
  OR has_function_privilege('anon','public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)','EXECUTE')
  OR has_function_privilege('service_role','public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)','EXECUTE')
  OR has_table_privilege('authenticated','crm_security.next_action_postponements','SELECT')
 THEN RAISE EXCEPTION 'mobile Today outcome post-apply drift'; END IF;
END $post$;
-- ===== APPLY customer_support_action =====
-- LOCAL REVIEW CANDIDATE ONLY. Separate Staging approval is required.

SET LOCAL crm.customer_support_ref='rprechiaglyjaydkmxsu';
SET LOCAL search_path=pg_catalog;
SET LOCAL lock_timeout='3s';
SET LOCAL statement_timeout='90s';

DO $guard$ BEGIN
 IF current_user<>'postgres' OR current_setting('crm.customer_support_ref',true) IS DISTINCT FROM 'rprechiaglyjaydkmxsu'
  OR to_regprocedure('public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)') IS NULL
  OR to_regprocedure('public.crm_operational_source_v1(text,uuid,integer)') IS NULL
  OR to_regprocedure('crm_security.crm_write_command_v2_pre_customer_support_20260906(uuid,text,uuid,integer,jsonb)') IS NOT NULL
  OR to_regprocedure('crm_security.crm_operational_source_v1_pre_customer_support_20260906(text,uuid,integer)') IS NOT NULL
  OR to_regprocedure('crm_security.crm_customer_support_action_command_v1(uuid,text,uuid,integer,jsonb)') IS NOT NULL
  OR to_regclass('crm_security.customer_support_actions') IS NOT NULL
  OR (SELECT pg_get_constraintdef(oid,true) FROM pg_constraint WHERE conrelid='crm_security.command_receipts'::regclass AND conname='command_receipts_operation_check') IS DISTINCT FROM $expected$CHECK (operation = ANY (ARRAY['opportunity_work_set'::text, 'inquiry_assign'::text, 'service_change'::text, 'inquiry_unassign'::text, 'favorite_set'::text, 'opportunity_touch'::text, 'next_action'::text, 'activity'::text, 'quote_version'::text, 'next_action_complete'::text, 'stage_check'::text, 'transition'::text, 'close'::text, 'amount'::text, 'waiting_context'::text, 'inquiry_reclassify'::text, 'inquiry_status'::text, 'inquiry_trash'::text, 'inquiry_restore'::text, 'inquiry_purge'::text, 'inquiry_followup'::text, 'opportunity_create'::text, 'lineage_link'::text, 'attachment_prepare'::text, 'attachment_complete'::text, 'expansion_pool_update'::text, 'expansion_note'::text]))$expected$
 THEN RAISE EXCEPTION 'customer support action prerequisite drift'; END IF;
END $guard$;

LOCK TABLE crm_security.command_receipts IN ACCESS EXCLUSIVE MODE;

CREATE TABLE crm_security.customer_support_actions(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 request_id uuid NOT NULL UNIQUE,
 client_ref text NOT NULL,
 target_type text NOT NULL CHECK(target_type IN ('deal','inq')),
 target_id uuid NOT NULL,
 site_name text NOT NULL,
 rep_user_id uuid NOT NULL,
 rep_name text NOT NULL,
 action_key text NOT NULL CHECK(action_key IN ('response_request','inquiry_review','call','message','recontact_result','waiting_context','manager_consult','waiting_review','material_support','meeting_check','contact_check','contact_activity','reactivate_review','dormant_review','recontact_schedule','support_detail')),
 action_label text NOT NULL,
 reason text NOT NULL,
 completion_rule text NOT NULL,
 status text NOT NULL DEFAULT 'requested' CHECK(status='requested'),
 requested_by_auth_uid uuid NOT NULL,
 requested_by_user_id uuid NOT NULL,
 requested_by_name text NOT NULL,
 requested_at timestamptz NOT NULL,
 UNIQUE(requested_by_user_id,client_ref)
);
ALTER TABLE crm_security.customer_support_actions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON crm_security.customer_support_actions FROM PUBLIC,anon,authenticated,service_role;

ALTER TABLE crm_security.command_receipts DROP CONSTRAINT command_receipts_operation_check;
ALTER TABLE crm_security.command_receipts ADD CONSTRAINT command_receipts_operation_check CHECK(operation=ANY(ARRAY[
 'opportunity_work_set','inquiry_assign','service_change','inquiry_unassign','favorite_set','opportunity_touch','next_action','activity','quote_version','next_action_complete','stage_check','transition','close','amount','waiting_context','inquiry_reclassify','inquiry_status','inquiry_trash','inquiry_restore','inquiry_purge','inquiry_followup','opportunity_create','lineage_link','attachment_prepare','attachment_complete','expansion_pool_update','expansion_note','customer_support_action'
]::text[]));

ALTER FUNCTION public.crm_write_command_v2(uuid,text,uuid,integer,jsonb) RENAME TO crm_write_command_v2_pre_customer_support_20260906;
ALTER FUNCTION public.crm_write_command_v2_pre_customer_support_20260906(uuid,text,uuid,integer,jsonb) SET SCHEMA crm_security;
REVOKE EXECUTE ON FUNCTION crm_security.crm_write_command_v2_pre_customer_support_20260906(uuid,text,uuid,integer,jsonb) FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION crm_security.crm_customer_support_action_command_v1(
 p_request_id uuid,p_operation text,p_object_id uuid,p_expected_version integer,p_payload jsonb
) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $fn$
DECLARE
 a record; prior crm_security.command_receipts%ROWTYPE; support_id uuid; owner_id_value uuid; site_value text;
 target_type_value text; client_ref_value text; action_key_value text; action_label_value text; reason_value text; completion_value text;
 rep_name_value text; server_at timestamptz; canonical jsonb; ack jsonb;
BEGIN
 IF p_request_id IS NULL OR p_object_id IS NULL OR p_expected_version IS DISTINCT FROM 0
  OR p_operation IS DISTINCT FROM 'customer_support_action' OR jsonb_typeof(p_payload) IS DISTINCT FROM 'object'
  OR EXISTS(SELECT 1 FROM jsonb_object_keys(p_payload) k WHERE k NOT IN ('client_ref','target_type','action_key','action_label','reason','completion_rule'))
  OR NOT p_payload ?& ARRAY['client_ref','target_type','action_key','action_label','reason','completion_rule']
 THEN RAISE EXCEPTION 'invalid customer support action payload' USING ERRCODE='22023'; END IF;
 target_type_value:=p_payload->>'target_type';client_ref_value:=btrim(p_payload->>'client_ref');action_key_value:=p_payload->>'action_key';
 action_label_value:=btrim(p_payload->>'action_label');reason_value:=btrim(p_payload->>'reason');completion_value:=btrim(p_payload->>'completion_rule');
 IF target_type_value NOT IN ('deal','inq') OR client_ref_value!~'^support-[0-9]{10,16}-[a-z0-9]{5}$'
  OR action_key_value NOT IN ('response_request','inquiry_review','call','message','recontact_result','waiting_context','manager_consult','waiting_review','material_support','meeting_check','contact_check','contact_activity','reactivate_review','dormant_review','recontact_schedule','support_detail')
  OR length(action_label_value) NOT BETWEEN 1 AND 200 OR length(reason_value) NOT BETWEEN 1 AND 4000 OR length(completion_value) NOT BETWEEN 1 AND 1000
 THEN RAISE EXCEPTION 'invalid customer support action values' USING ERRCODE='22023'; END IF;
 canonical:=jsonb_build_object('client_ref',client_ref_value,'target_type',target_type_value,'action_key',action_key_value,'action_label',action_label_value,'reason',reason_value,'completion_rule',completion_value);
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;
 PERFORM 1 FROM public.users u WHERE u.auth_uid=auth.uid() FOR SHARE;
 PERFORM 1 FROM crm_security.access_review r WHERE r.reviewed_auth_uid=auth.uid() FOR SHARE;
 SELECT * INTO a FROM crm_security.actor();
 IF NOT FOUND OR a.permission_role<>'admin' THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;
 IF target_type_value='deal' THEN
  SELECT d.owner_id,coalesce(s.site_name,d.list_name,'') INTO owner_id_value,site_value FROM public.deals d LEFT JOIN public.sites s ON s.site_id=d.site_id WHERE d.id=p_object_id FOR UPDATE OF d;
  IF NOT FOUND OR NOT crm_security.can_deal(p_object_id,true) THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;
 ELSE
  SELECT i.assigned_to,coalesce(i.site_name,'') INTO owner_id_value,site_value FROM public.inquiries i WHERE i.id=p_object_id FOR UPDATE;
  IF NOT FOUND OR NOT crm_security.can_inquiry(p_object_id) THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;
 END IF;
 SELECT u.name INTO rep_name_value FROM public.users u JOIN crm_security.access_review r ON r.user_id=u.user_id
 WHERE u.user_id=owner_id_value AND u.active AND r.approved AND r.expires_at>now() AND r.permission_role='rep';
 IF rep_name_value IS NULL THEN RAISE EXCEPTION 'support target has no approved UUID rep' USING ERRCODE='42501'; END IF;
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(a.auth_uid::text||p_request_id::text,0));
 SELECT * INTO prior FROM crm_security.command_receipts r WHERE r.actor_auth_uid=a.auth_uid AND r.request_id=p_request_id;
 IF FOUND THEN
  IF prior.actor_user_id IS DISTINCT FROM a.user_id OR prior.operation IS DISTINCT FROM p_operation OR prior.object_id IS DISTINCT FROM p_object_id
   OR prior.expected_version IS DISTINCT FROM 0 OR prior.payload IS DISTINCT FROM canonical
  THEN RAISE EXCEPTION 'REQUEST_ID_REUSE' USING ERRCODE='PT409'; END IF;
  RETURN prior.ack||jsonb_build_object('replayed',true);
 END IF;
 server_at:=clock_timestamp();
 INSERT INTO crm_security.customer_support_actions(request_id,client_ref,target_type,target_id,site_name,rep_user_id,rep_name,action_key,action_label,reason,completion_rule,status,requested_by_auth_uid,requested_by_user_id,requested_by_name,requested_at)
 VALUES(p_request_id,client_ref_value,target_type_value,p_object_id,site_value,owner_id_value,rep_name_value,action_key_value,action_label_value,reason_value,completion_value,'requested',a.auth_uid,a.user_id,a.display_name,server_at)
 RETURNING id INTO support_id;
 ack:=jsonb_build_object('contract_version',1,'ok',true,'request_id',p_request_id,'operation',p_operation,'object_id',p_object_id,
  'support_action_id',support_id,'client_ref',client_ref_value,'target_type',target_type_value,'target_id',p_object_id,'rep_user_id',owner_id_value,'rep_name',rep_name_value,
  'action_key',action_key_value,'action_label',action_label_value,'status','requested','requested_by_auth_uid',a.auth_uid,'requested_by_user_id',a.user_id,'requested_by_name',a.display_name,'requested_at',server_at,'server_at',server_at,'replayed',false);
 INSERT INTO crm_security.command_receipts(actor_auth_uid,request_id,actor_user_id,operation,object_id,expected_version,payload,ack,created_at)
 VALUES(a.auth_uid,p_request_id,a.user_id,p_operation,p_object_id,0,canonical,ack,server_at);
 RETURN ack;
END $fn$;
REVOKE EXECUTE ON FUNCTION crm_security.crm_customer_support_action_command_v1(uuid,text,uuid,integer,jsonb) FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION public.crm_write_command_v2(p_request_id uuid,p_operation text,p_object_id uuid,p_expected_version integer,p_payload jsonb)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $fn$
BEGIN
 IF p_operation='customer_support_action' THEN
  RETURN crm_security.crm_customer_support_action_command_v1(p_request_id,p_operation,p_object_id,p_expected_version,p_payload);
 END IF;
 RETURN crm_security.crm_write_command_v2_pre_customer_support_20260906(p_request_id,p_operation,p_object_id,p_expected_version,p_payload);
END $fn$;
REVOKE EXECUTE ON FUNCTION public.crm_write_command_v2(uuid,text,uuid,integer,jsonb) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.crm_write_command_v2(uuid,text,uuid,integer,jsonb) TO authenticated;

ALTER FUNCTION public.crm_operational_source_v1(text,uuid,integer) RENAME TO crm_operational_source_v1_pre_customer_support_20260906;
ALTER FUNCTION public.crm_operational_source_v1_pre_customer_support_20260906(text,uuid,integer) SET SCHEMA crm_security;
REVOKE EXECUTE ON FUNCTION crm_security.crm_operational_source_v1_pre_customer_support_20260906(text,uuid,integer) FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION public.crm_operational_source_v1(p_domain text,p_after uuid DEFAULT NULL,p_limit integer DEFAULT 100)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $fn$
DECLARE a record; items jsonb; has_more boolean; next_cursor text;
BEGIN
 IF p_domain<>'customer_support_action' THEN RETURN crm_security.crm_operational_source_v1_pre_customer_support_20260906(p_domain,p_after,p_limit); END IF;
 IF p_limit<1 OR p_limit>100 THEN RAISE EXCEPTION 'invalid operational source limit' USING ERRCODE='22023'; END IF;
 SELECT * INTO a FROM crm_security.actor(); IF NOT FOUND THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;
 IF a.permission_role<>'admin' THEN items:='[]'::jsonb;
 ELSE
  SELECT coalesce(jsonb_agg(x.item ORDER BY x.id),'[]'::jsonb) INTO items FROM (
   SELECT c.id,jsonb_build_object('id',c.id,'client_ref',c.client_ref,'target_type',c.target_type,'target_key',c.target_type||':'||c.target_id,
    'opportunity_id',CASE WHEN c.target_type='deal' THEN c.target_id END,'inquiry_id',CASE WHEN c.target_type='inq' THEN c.target_id END,
    'site_name',c.site_name,'rep_user_id',c.rep_user_id,'rep_name',c.rep_name,'action_key',c.action_key,'action_label',c.action_label,'reason',c.reason,
    'completion_rule',c.completion_rule,'status',c.status,'requested_by',c.requested_by_name,'requested_at',c.requested_at) item
   FROM crm_security.customer_support_actions c WHERE (p_after IS NULL OR c.id>p_after)
    AND ((c.target_type='deal' AND crm_security.can_deal(c.target_id,false)) OR (c.target_type='inq' AND crm_security.can_inquiry(c.target_id)))
   ORDER BY c.id LIMIT p_limit+1
  ) x;
 END IF;
 has_more:=jsonb_array_length(items)>p_limit;
 IF has_more THEN items:=items-p_limit; END IF;
 next_cursor:=CASE WHEN has_more THEN items->(jsonb_array_length(items)-1)->>'id' END;
 RETURN jsonb_build_object('contract_version',1,'resource','operational_source','domain',p_domain,'scope_completeness','actor_authorized_rows_only','items',items,
  'pagination',jsonb_build_object('completeness',CASE WHEN has_more THEN 'partial' ELSE 'complete' END,'has_more',has_more,'next_cursor',next_cursor));
END $fn$;
REVOKE EXECUTE ON FUNCTION public.crm_operational_source_v1(text,uuid,integer) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.crm_operational_source_v1(text,uuid,integer) TO authenticated;

DO $post$ BEGIN
 IF has_table_privilege('authenticated','crm_security.customer_support_actions','SELECT')
  OR has_function_privilege('authenticated','crm_security.crm_customer_support_action_command_v1(uuid,text,uuid,integer,jsonb)','EXECUTE')
  OR has_function_privilege('authenticated','crm_security.crm_write_command_v2_pre_customer_support_20260906(uuid,text,uuid,integer,jsonb)','EXECUTE')
  OR has_function_privilege('authenticated','crm_security.crm_operational_source_v1_pre_customer_support_20260906(text,uuid,integer)','EXECUTE')
  OR NOT has_function_privilege('authenticated','public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)','EXECUTE')
  OR NOT has_function_privilege('authenticated','public.crm_operational_source_v1(text,uuid,integer)','EXECUTE')
  OR has_function_privilege('anon','public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)','EXECUTE')
  OR has_function_privilege('anon','public.crm_operational_source_v1(text,uuid,integer)','EXECUTE')
 THEN RAISE EXCEPTION 'customer support action post-apply drift'; END IF;
END $post$;
-- ===== APPLY message_log =====
-- LOCAL REVIEW CANDIDATE ONLY. Separate Staging approval is required.

SET LOCAL crm.message_log_ref='rprechiaglyjaydkmxsu';
SET LOCAL search_path=pg_catalog;
SET LOCAL lock_timeout='3s';
SET LOCAL statement_timeout='90s';

DO $guard$ BEGIN
 IF current_user<>'postgres' OR current_setting('crm.message_log_ref',true) IS DISTINCT FROM 'rprechiaglyjaydkmxsu'
  OR to_regprocedure('public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)') IS NULL
  OR to_regprocedure('public.crm_operational_source_v1(text,uuid,integer)') IS NULL
  OR to_regprocedure('crm_security.crm_write_command_v2_pre_message_log_20260906(uuid,text,uuid,integer,jsonb)') IS NOT NULL
  OR to_regprocedure('crm_security.crm_operational_source_v1_pre_message_log_20260906(text,uuid,integer)') IS NOT NULL
  OR to_regprocedure('crm_security.crm_message_log_command_v1(uuid,text,uuid,integer,jsonb)') IS NOT NULL
  OR to_regclass('crm_security.message_outcomes') IS NOT NULL
  OR to_regclass('crm_security.quote_versions') IS NULL
  OR to_regclass('crm_security.deal_attachments') IS NULL
  OR (SELECT pg_get_constraintdef(oid,true) FROM pg_constraint WHERE conrelid='crm_security.command_receipts'::regclass AND conname='command_receipts_operation_check') IS DISTINCT FROM $expected$CHECK (operation = ANY (ARRAY['opportunity_work_set'::text, 'inquiry_assign'::text, 'service_change'::text, 'inquiry_unassign'::text, 'favorite_set'::text, 'opportunity_touch'::text, 'next_action'::text, 'activity'::text, 'quote_version'::text, 'next_action_complete'::text, 'stage_check'::text, 'transition'::text, 'close'::text, 'amount'::text, 'waiting_context'::text, 'inquiry_reclassify'::text, 'inquiry_status'::text, 'inquiry_trash'::text, 'inquiry_restore'::text, 'inquiry_purge'::text, 'inquiry_followup'::text, 'opportunity_create'::text, 'lineage_link'::text, 'attachment_prepare'::text, 'attachment_complete'::text, 'expansion_pool_update'::text, 'expansion_note'::text, 'customer_support_action'::text]))$expected$
 THEN RAISE EXCEPTION 'message log prerequisite drift'; END IF;
END $guard$;

LOCK TABLE crm_security.command_receipts IN ACCESS EXCLUSIVE MODE;

CREATE TABLE crm_security.message_outcomes(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 request_id uuid NOT NULL UNIQUE,
 deal_id uuid NOT NULL REFERENCES public.deals(id) ON DELETE RESTRICT,
 contact_id uuid NOT NULL REFERENCES public.contacts(id) ON DELETE RESTRICT,
 person_key text,
 recipient_phone text NOT NULL,
 channel text NOT NULL CHECK(channel IN ('sms','kakao')),
 template_key text NOT NULL,
 template_title text NOT NULL,
 template_kind text NOT NULL CHECK(template_kind IN ('info','promo','mixed')),
 template_grade text,
 purpose text,
 body text NOT NULL,
 message_context text NOT NULL DEFAULT 'deal' CHECK(message_context='deal'),
 quote_version_no integer,
 quote_attachment_id uuid,
 attachment_refs uuid[] NOT NULL DEFAULT '{}',
 status text NOT NULL CHECK(status IN ('sent','failed','cancelled')),
 attestation_kind text NOT NULL DEFAULT 'user_attested' CHECK(attestation_kind='user_attested'),
 actor_auth_uid uuid NOT NULL,
 actor_user_id uuid NOT NULL REFERENCES public.users(user_id),
 actor_name text NOT NULL,
 activity_id uuid REFERENCES public.activities(id),
 next_action_id uuid REFERENCES public.next_actions(id),
 occurred_at timestamptz NOT NULL,
 CHECK(cardinality(attachment_refs)<=10),
 CHECK((status='sent' AND activity_id IS NOT NULL) OR (status<>'sent' AND activity_id IS NULL AND next_action_id IS NULL))
);
CREATE INDEX message_outcomes_deal_time_idx ON crm_security.message_outcomes(deal_id,occurred_at DESC,id DESC);
ALTER TABLE crm_security.message_outcomes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON crm_security.message_outcomes FROM PUBLIC,anon,authenticated,service_role;

ALTER TABLE crm_security.command_receipts DROP CONSTRAINT command_receipts_operation_check;
ALTER TABLE crm_security.command_receipts ADD CONSTRAINT command_receipts_operation_check CHECK(operation=ANY(ARRAY[
 'opportunity_work_set','inquiry_assign','service_change','inquiry_unassign','favorite_set','opportunity_touch','next_action','activity','quote_version','next_action_complete','stage_check','transition','close','amount','waiting_context','inquiry_reclassify','inquiry_status','inquiry_trash','inquiry_restore','inquiry_purge','inquiry_followup','opportunity_create','lineage_link','attachment_prepare','attachment_complete','expansion_pool_update','expansion_note','customer_support_action','message_log'
]::text[]));

ALTER FUNCTION public.crm_write_command_v2(uuid,text,uuid,integer,jsonb) RENAME TO crm_write_command_v2_pre_message_log_20260906;
ALTER FUNCTION public.crm_write_command_v2_pre_message_log_20260906(uuid,text,uuid,integer,jsonb) SET SCHEMA crm_security;
REVOKE EXECUTE ON FUNCTION crm_security.crm_write_command_v2_pre_message_log_20260906(uuid,text,uuid,integer,jsonb) FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION crm_security.crm_message_log_command_v1(
 p_request_id uuid,p_operation text,p_object_id uuid,p_expected_version integer,p_payload jsonb
) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $fn$
DECLARE
 a record; prior crm_security.command_receipts%ROWTYPE; oldrow public.deals%ROWTYPE; newrow public.deals%ROWTYPE;
 canonical jsonb; ack jsonb; outcome_id uuid; activity_id_value uuid; next_id uuid; audit_id uuid;
 contact_count integer; contact_id_value uuid; person_key_value text; phone_source text; phone_value text; actor_email text; owner_name text;
 channel_value text; template_key_value text; template_title_value text; template_kind_value text; template_grade_value text;
 purpose_value text; body_value text; status_value text; quote_version_value integer; quote_attachment_value uuid; attachment_values uuid[];
 next_requested boolean; next_type text; next_text text; next_due_text text; next_due_value timestamptz; cancelled_ids jsonb:='[]'::jsonb;
 server_at timestamptz; attachment_count integer;
BEGIN
 IF p_request_id IS NULL OR p_object_id IS NULL OR p_expected_version IS NULL OR p_expected_version<0
  OR p_operation IS DISTINCT FROM 'message_log' OR jsonb_typeof(p_payload) IS DISTINCT FROM 'object'
  OR EXISTS(SELECT 1 FROM jsonb_object_keys(p_payload) k WHERE k NOT IN
   ('person_key','channel','template_key','template_title','template_kind','template_grade','purpose','body','message_context','quote_version_no','quote_attachment_id','attachment_refs','status','next_action_requested','next_action_type','next_action_text','next_due_at'))
  OR NOT p_payload ?& ARRAY['channel','template_key','template_title','template_kind','body','message_context','attachment_refs','status','next_action_requested']
  OR EXISTS(SELECT 1 FROM (VALUES('channel'),('template_key'),('template_title'),('template_kind'),('body'),('message_context'),('status')) v(k)
     WHERE jsonb_typeof(p_payload->v.k) IS DISTINCT FROM 'string')
  OR jsonb_typeof(p_payload->'next_action_requested') IS DISTINCT FROM 'boolean'
  OR EXISTS(SELECT 1 FROM (VALUES('person_key'),('template_grade'),('purpose'),('next_action_type'),('next_action_text'),('next_due_at')) v(k)
     WHERE p_payload ? v.k AND jsonb_typeof(p_payload->v.k) NOT IN ('string','null'))
  OR (p_payload ? 'quote_version_no' AND jsonb_typeof(p_payload->'quote_version_no') NOT IN ('number','null'))
  OR (p_payload ? 'quote_attachment_id' AND jsonb_typeof(p_payload->'quote_attachment_id') NOT IN ('string','null'))
 THEN RAISE EXCEPTION 'invalid message log payload' USING ERRCODE='22023'; END IF;
 channel_value:=p_payload->>'channel'; template_key_value:=btrim(p_payload->>'template_key'); template_title_value:=btrim(p_payload->>'template_title');
 template_kind_value:=p_payload->>'template_kind'; template_grade_value:=nullif(btrim(p_payload->>'template_grade'),''); purpose_value:=nullif(btrim(p_payload->>'purpose'),'');
 body_value:=btrim(p_payload->>'body'); status_value:=p_payload->>'status'; next_requested:=(p_payload->>'next_action_requested')::boolean;
 next_type:=nullif(btrim(p_payload->>'next_action_type'),''); next_text:=nullif(btrim(p_payload->>'next_action_text'),''); next_due_text:=nullif(p_payload->>'next_due_at','');
 quote_version_value:=CASE WHEN jsonb_typeof(p_payload->'quote_version_no')='number' THEN (p_payload->>'quote_version_no')::integer END;
 IF jsonb_typeof(p_payload->'quote_attachment_id')='string' AND p_payload->>'quote_attachment_id'!~*'^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
 THEN RAISE EXCEPTION 'invalid quote attachment' USING ERRCODE='22023'; END IF;
 quote_attachment_value:=CASE WHEN jsonb_typeof(p_payload->'quote_attachment_id')='string' THEN (p_payload->>'quote_attachment_id')::uuid END;
 IF jsonb_typeof(p_payload->'attachment_refs') IS DISTINCT FROM 'array' OR EXISTS(SELECT 1 FROM jsonb_array_elements(p_payload->'attachment_refs') x WHERE jsonb_typeof(x)<>'string' OR trim(both '"' from x::text)!~*'^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$')
 THEN RAISE EXCEPTION 'invalid attachment refs' USING ERRCODE='22023'; END IF;
 SELECT coalesce(array_agg(x::uuid),'{}'::uuid[]) INTO attachment_values FROM jsonb_array_elements_text(p_payload->'attachment_refs') x;
 IF channel_value NOT IN ('sms','kakao') OR template_kind_value NOT IN ('info','promo','mixed') OR status_value NOT IN ('sent','failed','cancelled')
  OR p_payload->>'message_context'<>'deal' OR length(template_key_value) NOT BETWEEN 1 AND 200 OR length(template_title_value) NOT BETWEEN 1 AND 300
  OR length(body_value) NOT BETWEEN 1 AND 5000 OR (template_grade_value IS NOT NULL AND length(template_grade_value)>100)
  OR (purpose_value IS NOT NULL AND length(purpose_value)>500) OR cardinality(attachment_values)>10 OR (quote_version_value IS NOT NULL AND quote_version_value<1)
  OR (quote_attachment_value IS NOT NULL AND NOT quote_attachment_value=ANY(attachment_values))
  OR (status_value<>'sent' AND next_requested) OR (next_requested AND (next_type IS NULL OR next_text IS NULL OR next_due_text!~'^\d{4}-\d{2}-\d{2}$'))
  OR (NOT next_requested AND (next_type IS NOT NULL OR next_text IS NOT NULL OR next_due_text IS NOT NULL))
 THEN RAISE EXCEPTION 'invalid message log values' USING ERRCODE='22023'; END IF;
 IF next_requested THEN next_due_value:=(next_due_text||' 09:00:00+09')::timestamptz; END IF;
 canonical:=jsonb_build_object('person_key',nullif(btrim(p_payload->>'person_key'),''),'channel',channel_value,'template_key',template_key_value,
  'template_title',template_title_value,'template_kind',template_kind_value,'template_grade',template_grade_value,'purpose',purpose_value,'body',body_value,
  'message_context','deal','quote_version_no',quote_version_value,'quote_attachment_id',quote_attachment_value,'attachment_refs',to_jsonb(attachment_values),
  'status',status_value,'next_action_requested',next_requested,'next_action_type',next_type,'next_action_text',next_text,'next_due_at',next_due_text);
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;
 PERFORM 1 FROM public.users u WHERE u.auth_uid=auth.uid() FOR SHARE;
 PERFORM 1 FROM crm_security.access_review r WHERE r.reviewed_auth_uid=auth.uid() FOR SHARE;
 SELECT * INTO a FROM crm_security.actor();
 IF NOT FOUND OR a.permission_role NOT IN ('rep','branch','admin') THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;
 PERFORM 1 FROM crm_security.object_scope s WHERE s.user_id=a.user_id AND s.deal_id=p_object_id FOR SHARE;
 SELECT * INTO oldrow FROM public.deals d WHERE d.id=p_object_id FOR UPDATE;
 IF NOT FOUND OR NOT crm_security.can_deal(p_object_id,true) THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(a.auth_uid::text||p_request_id::text,0));
 SELECT * INTO prior FROM crm_security.command_receipts r WHERE r.actor_auth_uid=a.auth_uid AND r.request_id=p_request_id;
 IF FOUND THEN
  IF prior.actor_user_id IS DISTINCT FROM a.user_id OR prior.operation IS DISTINCT FROM p_operation OR prior.object_id IS DISTINCT FROM p_object_id
   OR prior.expected_version IS DISTINCT FROM p_expected_version OR prior.payload IS DISTINCT FROM canonical
  THEN RAISE EXCEPTION 'REQUEST_ID_REUSE' USING ERRCODE='PT409'; END IF;
  RETURN prior.ack||jsonb_build_object('replayed',true);
 END IF;
 IF oldrow.version IS DISTINCT FROM p_expected_version THEN RAISE EXCEPTION 'version conflict' USING ERRCODE='PT409'; END IF;
 SELECT count(*)::integer,max(c.id::text)::uuid,max(c.person_key),max(coalesce(nullif(c.mobile,''),nullif(c.phone,'')))
 INTO contact_count,contact_id_value,person_key_value,phone_source
 FROM public.contacts c WHERE
  (nullif(btrim(p_payload->>'person_key'),'') IS NULL OR c.person_key=nullif(btrim(p_payload->>'person_key'),''))
  AND (c.id=oldrow.contact_id OR c.person_key=oldrow.person_key OR EXISTS(
   SELECT 1 FROM public.contact_assignments ca WHERE ca.person_key=c.person_key AND ca.opportunity_id=p_object_id AND ca.status='current' AND ca.ended_at IS NULL));
 phone_value:=regexp_replace(coalesce(phone_source,''),'[^0-9]','','g');
 IF contact_count<>1 OR length(phone_value) NOT BETWEEN 10 AND 15 THEN RAISE EXCEPTION 'unique current Deal contact with phone required' USING ERRCODE='22023'; END IF;
 IF quote_version_value IS NOT NULL AND NOT EXISTS(SELECT 1 FROM crm_security.quote_versions q WHERE q.deal_id=p_object_id AND q.version_no=quote_version_value)
 THEN RAISE EXCEPTION 'quote version not found' USING ERRCODE='22023'; END IF;
 SELECT count(*)::integer INTO attachment_count FROM crm_security.deal_attachments f WHERE f.deal_id=p_object_id AND f.status='ready' AND f.attachment_id=ANY(attachment_values);
 IF attachment_count<>cardinality(attachment_values) THEN RAISE EXCEPTION 'ready Deal attachment required' USING ERRCODE='22023'; END IF;
 SELECT u.email INTO actor_email FROM public.users u WHERE u.user_id=a.user_id;
 SELECT u.name INTO owner_name FROM public.users u JOIN crm_security.access_review r ON r.user_id=u.user_id
 WHERE u.user_id=oldrow.owner_id AND u.active AND r.approved AND r.expires_at>now() AND r.permission_role IN ('rep','branch','admin');
 IF actor_email IS NULL OR owner_name IS NULL THEN RAISE EXCEPTION 'approved UUID actor and owner required' USING ERRCODE='42501'; END IF;
 server_at:=clock_timestamp(); outcome_id:=gen_random_uuid();
 IF status_value='sent' THEN
  INSERT INTO public.activities(deal_id,organization_id,actor_email,actor_name,type,detail,occurred_at)
  VALUES(p_object_id,oldrow.organization_id,actor_email,a.display_name,CASE channel_value WHEN 'sms' THEN '문자' ELSE '카카오' END,
   jsonb_build_object('note',template_title_value||' 발송 · '||coalesce(purpose_value,''),'result',body_value,'meaningful_contact',false,'message_outcome_id',outcome_id,'attestation_kind','user_attested','status','sent'),server_at)
  RETURNING id INTO activity_id_value;
  IF next_requested THEN
   SELECT coalesce(jsonb_agg(id ORDER BY created_at,id),'[]'::jsonb) INTO cancelled_ids FROM public.next_actions WHERE deal_id=p_object_id AND status='open';
   UPDATE public.next_actions SET status='cancelled',updated_at=server_at WHERE deal_id=p_object_id AND status='open';
   INSERT INTO public.next_actions(deal_id,action_type,title,due_at,assignee_name,status,source_activity_id,created_at,updated_at)
   VALUES(p_object_id,next_type,next_text,next_due_value,owner_name,'open',activity_id_value,server_at,server_at) RETURNING id INTO next_id;
  END IF;
 END IF;
 INSERT INTO crm_security.message_outcomes(id,request_id,deal_id,contact_id,person_key,recipient_phone,channel,template_key,template_title,template_kind,template_grade,purpose,body,message_context,quote_version_no,quote_attachment_id,attachment_refs,status,attestation_kind,actor_auth_uid,actor_user_id,actor_name,activity_id,next_action_id,occurred_at)
 VALUES(outcome_id,p_request_id,p_object_id,contact_id_value,person_key_value,phone_value,channel_value,template_key_value,template_title_value,template_kind_value,template_grade_value,purpose_value,body_value,'deal',quote_version_value,quote_attachment_value,attachment_values,status_value,'user_attested',a.auth_uid,a.user_id,a.display_name,activity_id_value,next_id,server_at);
 UPDATE public.deals SET
  next_action=CASE WHEN next_requested THEN next_text ELSE next_action END,
  next_action_date=CASE WHEN next_requested THEN next_due_value::date ELSE next_action_date END,
  last_activity_at=CASE WHEN status_value='sent' THEN greatest(last_activity_at,server_at) ELSE last_activity_at END,
  updated_at=server_at,version=version+1
 WHERE id=p_object_id AND version=p_expected_version RETURNING * INTO newrow;
 IF NOT FOUND THEN RAISE EXCEPTION 'unexpected version mutation' USING ERRCODE='PT409'; END IF;
 INSERT INTO crm_security.audit_events(actor_auth_uid,actor_user_id,actor_name,deal_id,action,before_data,after_data,reason,created_at)
 VALUES(a.auth_uid,a.user_id,a.display_name,p_object_id,'message_log',jsonb_build_object('version',oldrow.version),
  jsonb_build_object('version',newrow.version,'message_log_id',outcome_id,'attestation_kind','user_attested','status',status_value,'activity_id',activity_id_value,'next_action_id',next_id,'cancelled_action_ids',cancelled_ids),purpose_value,server_at)
 RETURNING event_id INTO audit_id;
 ack:=jsonb_build_object('contract_version',1,'ok',true,'request_id',p_request_id,'write_id',p_request_id,'operation',p_operation,'object_id',p_object_id,
  'previous_version',p_expected_version,'version',newrow.version,'message_log_id',outcome_id,'attestation_kind','user_attested','user_attested',true,'status',status_value,
  'contact_id',contact_id_value,'person_key',person_key_value,'recipient_phone',phone_value,'activity_id',activity_id_value,'next_action_id',next_id,
  'cancelled_action_ids',cancelled_ids,'audit_event_id',audit_id,'actor_auth_uid',a.auth_uid,'actor_user_id',a.user_id,'actor_name',a.display_name,'server_at',server_at,'replayed',false);
 INSERT INTO crm_security.command_receipts(actor_auth_uid,request_id,actor_user_id,operation,object_id,expected_version,payload,ack,created_at)
 VALUES(a.auth_uid,p_request_id,a.user_id,p_operation,p_object_id,p_expected_version,canonical,ack,server_at);
 RETURN ack;
END $fn$;
REVOKE EXECUTE ON FUNCTION crm_security.crm_message_log_command_v1(uuid,text,uuid,integer,jsonb) FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION public.crm_write_command_v2(p_request_id uuid,p_operation text,p_object_id uuid,p_expected_version integer,p_payload jsonb)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $fn$
BEGIN
 IF p_operation='message_log' THEN RETURN crm_security.crm_message_log_command_v1(p_request_id,p_operation,p_object_id,p_expected_version,p_payload); END IF;
 RETURN crm_security.crm_write_command_v2_pre_message_log_20260906(p_request_id,p_operation,p_object_id,p_expected_version,p_payload);
END $fn$;
REVOKE EXECUTE ON FUNCTION public.crm_write_command_v2(uuid,text,uuid,integer,jsonb) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.crm_write_command_v2(uuid,text,uuid,integer,jsonb) TO authenticated;

ALTER FUNCTION public.crm_operational_source_v1(text,uuid,integer) RENAME TO crm_operational_source_v1_pre_message_log_20260906;
ALTER FUNCTION public.crm_operational_source_v1_pre_message_log_20260906(text,uuid,integer) SET SCHEMA crm_security;
REVOKE EXECUTE ON FUNCTION crm_security.crm_operational_source_v1_pre_message_log_20260906(text,uuid,integer) FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION public.crm_operational_source_v1(p_domain text,p_after uuid DEFAULT NULL,p_limit integer DEFAULT 100)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $fn$
DECLARE a record; items jsonb; has_more boolean; next_cursor text;
BEGIN
 IF p_domain<>'message_log' THEN RETURN crm_security.crm_operational_source_v1_pre_message_log_20260906(p_domain,p_after,p_limit); END IF;
 IF p_limit<1 OR p_limit>100 THEN RAISE EXCEPTION 'invalid operational source limit' USING ERRCODE='22023'; END IF;
 SELECT * INTO a FROM crm_security.actor(); IF NOT FOUND THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;
 SELECT coalesce(jsonb_agg(x.item ORDER BY x.id),'[]'::jsonb) INTO items FROM (
  SELECT m.id,jsonb_build_object('id',m.id,'message_log_id',m.id,'opportunity_id',m.deal_id,'contact_id',m.contact_id,'person_key',m.person_key,
   'recipient_phone',m.recipient_phone,'channel',m.channel,'template_key',m.template_key,'template_title',m.template_title,'template_kind',m.template_kind,
   'template_grade',m.template_grade,'purpose',m.purpose,'body',m.body,'message_context',m.message_context,'quote_version_no',m.quote_version_no,
   'quote_attachment_id',m.quote_attachment_id,'attachment_refs',to_jsonb(m.attachment_refs),'status',m.status,'success',m.status='sent',
   'attestation_kind',m.attestation_kind,'user_attested',true,'actor_name',m.actor_name,'activity_id',m.activity_id,'next_action_id',m.next_action_id,
   'occurred_at',m.occurred_at,'sent_at',CASE WHEN m.status='sent' THEN m.occurred_at END,'failed_at',CASE WHEN m.status='failed' THEN m.occurred_at END) item
  FROM crm_security.message_outcomes m WHERE (p_after IS NULL OR m.id>p_after) AND crm_security.can_deal(m.deal_id,false)
  ORDER BY m.id LIMIT p_limit+1
 ) x;
 has_more:=jsonb_array_length(items)>p_limit; IF has_more THEN items:=items-p_limit; END IF;
 next_cursor:=CASE WHEN has_more THEN items->(jsonb_array_length(items)-1)->>'id' END;
 RETURN jsonb_build_object('contract_version',1,'resource','operational_source','domain',p_domain,'scope_completeness','actor_authorized_rows_only','items',items,
  'pagination',jsonb_build_object('completeness',CASE WHEN has_more THEN 'partial' ELSE 'complete' END,'has_more',has_more,'next_cursor',next_cursor));
END $fn$;
REVOKE EXECUTE ON FUNCTION public.crm_operational_source_v1(text,uuid,integer) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.crm_operational_source_v1(text,uuid,integer) TO authenticated;

DO $post$ BEGIN
 IF has_table_privilege('authenticated','crm_security.message_outcomes','SELECT')
  OR has_function_privilege('authenticated','crm_security.crm_message_log_command_v1(uuid,text,uuid,integer,jsonb)','EXECUTE')
  OR has_function_privilege('authenticated','crm_security.crm_write_command_v2_pre_message_log_20260906(uuid,text,uuid,integer,jsonb)','EXECUTE')
  OR has_function_privilege('authenticated','crm_security.crm_operational_source_v1_pre_message_log_20260906(text,uuid,integer)','EXECUTE')
  OR NOT has_function_privilege('authenticated','public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)','EXECUTE')
  OR NOT has_function_privilege('authenticated','public.crm_operational_source_v1(text,uuid,integer)','EXECUTE')
  OR has_function_privilege('anon','public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)','EXECUTE')
  OR has_function_privilege('anon','public.crm_operational_source_v1(text,uuid,integer)','EXECUTE')
 THEN RAISE EXCEPTION 'message log post-apply drift'; END IF;
END $post$;
-- ===== APPLY relationship_cadence =====
-- LOCAL REVIEW CANDIDATE ONLY. Separate Staging approval is required.

SET LOCAL crm.relationship_cadence_ref='rprechiaglyjaydkmxsu';
SET LOCAL search_path=pg_catalog;
SET LOCAL lock_timeout='3s';
SET LOCAL statement_timeout='90s';

DO $guard$ BEGIN
 IF current_user<>'postgres' OR current_setting('crm.relationship_cadence_ref',true) IS DISTINCT FROM 'rprechiaglyjaydkmxsu'
  OR to_regprocedure('public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)') IS NULL
  OR to_regprocedure('public.crm_operational_source_v1(text,uuid,integer)') IS NULL
  OR to_regprocedure('crm_security.crm_write_command_v2_pre_relationship_cadence_20260906(uuid,text,uuid,integer,jsonb)') IS NOT NULL
  OR to_regprocedure('crm_security.crm_operational_source_v1_pre_relationship_cadence_20260906(text,uuid,integer)') IS NOT NULL
  OR to_regprocedure('crm_security.crm_relationship_cadence_command_v1(uuid,text,uuid,integer,jsonb)') IS NOT NULL
  OR to_regclass('crm_security.message_outcomes') IS NULL OR to_regclass('crm_security.relationship_events') IS NOT NULL
  OR EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='crm_security' AND table_name='message_outcomes' AND column_name IN ('response_at','response_kind','response_activity_id'))
  OR (SELECT pg_get_constraintdef(oid,true) FROM pg_constraint WHERE conrelid='crm_security.command_receipts'::regclass AND conname='command_receipts_operation_check') IS DISTINCT FROM $expected$CHECK (operation = ANY (ARRAY['opportunity_work_set'::text, 'inquiry_assign'::text, 'service_change'::text, 'inquiry_unassign'::text, 'favorite_set'::text, 'opportunity_touch'::text, 'next_action'::text, 'activity'::text, 'quote_version'::text, 'next_action_complete'::text, 'stage_check'::text, 'transition'::text, 'close'::text, 'amount'::text, 'waiting_context'::text, 'inquiry_reclassify'::text, 'inquiry_status'::text, 'inquiry_trash'::text, 'inquiry_restore'::text, 'inquiry_purge'::text, 'inquiry_followup'::text, 'opportunity_create'::text, 'lineage_link'::text, 'attachment_prepare'::text, 'attachment_complete'::text, 'expansion_pool_update'::text, 'expansion_note'::text, 'customer_support_action'::text, 'message_log'::text]))$expected$
 THEN RAISE EXCEPTION 'relationship cadence prerequisite drift'; END IF;
END $guard$;

LOCK TABLE crm_security.command_receipts IN ACCESS EXCLUSIVE MODE;
ALTER TABLE crm_security.message_outcomes ADD COLUMN response_at timestamptz,ADD COLUMN response_kind text,ADD COLUMN response_activity_id uuid REFERENCES public.activities(id);
CREATE TABLE crm_security.relationship_events(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),request_id uuid NOT NULL UNIQUE,
 deal_id uuid NOT NULL REFERENCES public.deals(id) ON DELETE RESTRICT,
 contact_id uuid NOT NULL REFERENCES public.contacts(id) ON DELETE RESTRICT,person_key text,
 event_kind text NOT NULL CHECK(event_kind IN ('hold','response')),
 message_outcome_id uuid REFERENCES crm_security.message_outcomes(id) ON DELETE RESTRICT,
 activity_id uuid REFERENCES public.activities(id),next_action_id uuid REFERENCES public.next_actions(id),
 hold_until date,reason text,actor_auth_uid uuid NOT NULL,actor_user_id uuid NOT NULL REFERENCES public.users(user_id),actor_name text NOT NULL,
 business_at timestamptz NOT NULL,created_at timestamptz NOT NULL,
 CHECK((event_kind='hold' AND hold_until IS NOT NULL AND message_outcome_id IS NULL AND activity_id IS NULL AND next_action_id IS NOT NULL)
    OR (event_kind='response' AND hold_until IS NULL AND message_outcome_id IS NOT NULL AND activity_id IS NOT NULL))
);
CREATE INDEX relationship_events_deal_time_idx ON crm_security.relationship_events(deal_id,business_at DESC,id DESC);
ALTER TABLE crm_security.relationship_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON crm_security.relationship_events FROM PUBLIC,anon,authenticated,service_role;

ALTER TABLE crm_security.command_receipts DROP CONSTRAINT command_receipts_operation_check;
ALTER TABLE crm_security.command_receipts ADD CONSTRAINT command_receipts_operation_check CHECK(operation=ANY(ARRAY[
 'opportunity_work_set','inquiry_assign','service_change','inquiry_unassign','favorite_set','opportunity_touch','next_action','activity','quote_version','next_action_complete','stage_check','transition','close','amount','waiting_context','inquiry_reclassify','inquiry_status','inquiry_trash','inquiry_restore','inquiry_purge','inquiry_followup','opportunity_create','lineage_link','attachment_prepare','attachment_complete','expansion_pool_update','expansion_note','customer_support_action','message_log','relationship_hold','relationship_response'
]::text[]));
ALTER FUNCTION public.crm_write_command_v2(uuid,text,uuid,integer,jsonb) RENAME TO crm_write_command_v2_pre_relationship_cadence_20260906;
ALTER FUNCTION public.crm_write_command_v2_pre_relationship_cadence_20260906(uuid,text,uuid,integer,jsonb) SET SCHEMA crm_security;
REVOKE EXECUTE ON FUNCTION crm_security.crm_write_command_v2_pre_relationship_cadence_20260906(uuid,text,uuid,integer,jsonb) FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION crm_security.crm_relationship_cadence_command_v1(p_request_id uuid,p_operation text,p_object_id uuid,p_expected_version integer,p_payload jsonb)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $fn$
DECLARE a record; prior crm_security.command_receipts%ROWTYPE; oldrow public.deals%ROWTYPE; newrow public.deals%ROWTYPE;
 canonical jsonb; ack jsonb; event_id uuid:=gen_random_uuid(); contact_count integer; contact_id_value uuid; person_key_value text;
 server_at timestamptz; business_at timestamptz; owner_name text; actor_email text; next_id uuid; activity_id_value uuid; audit_id uuid;
 hold_value date; reason_value text; next_type text; next_text text; next_due date; cancelled_ids jsonb:='[]'::jsonb;
 response_kind_value text; activity_type_value text; activity_note_value text; activity_result_value text; outcome_id uuid; linked_next_id uuid; linked_cancel_count integer:=0; linked_cancelled boolean:=false;
BEGIN
 IF p_request_id IS NULL OR p_object_id IS NULL OR p_expected_version IS NULL OR p_expected_version<0 OR p_operation NOT IN ('relationship_hold','relationship_response') OR jsonb_typeof(p_payload)<>'object'
 THEN RAISE EXCEPTION 'invalid relationship command' USING ERRCODE='22023'; END IF;
 IF p_operation='relationship_hold' THEN
  IF EXISTS(SELECT 1 FROM jsonb_object_keys(p_payload) k WHERE k NOT IN ('person_key','hold_until','reason','next_action_type','next_action_text','next_due_at'))
   OR NOT p_payload ?& ARRAY['hold_until','reason','next_action_type','next_action_text','next_due_at']
   OR EXISTS(SELECT 1 FROM (VALUES('hold_until'),('reason'),('next_action_type'),('next_action_text'),('next_due_at')) v(k) WHERE jsonb_typeof(p_payload->v.k)<>'string')
  THEN RAISE EXCEPTION 'invalid relationship hold payload' USING ERRCODE='22023'; END IF;
  hold_value:=(p_payload->>'hold_until')::date;reason_value:=btrim(p_payload->>'reason');next_type:=btrim(p_payload->>'next_action_type');next_text:=btrim(p_payload->>'next_action_text');next_due:=(p_payload->>'next_due_at')::date;
  IF p_payload->>'hold_until'!~'^\d{4}-\d{2}-\d{2}$' OR p_payload->>'next_due_at'!~'^\d{4}-\d{2}-\d{2}$' OR hold_value<>next_due OR length(reason_value) NOT BETWEEN 1 AND 2000 OR length(next_type) NOT BETWEEN 1 AND 100 OR length(next_text) NOT BETWEEN 1 AND 500
  THEN RAISE EXCEPTION 'invalid relationship hold values' USING ERRCODE='22023'; END IF;
  canonical:=jsonb_build_object('person_key',nullif(btrim(p_payload->>'person_key'),''),'hold_until',hold_value,'reason',reason_value,'next_action_type',next_type,'next_action_text',next_text,'next_due_at',next_due);
 ELSE
  IF EXISTS(SELECT 1 FROM jsonb_object_keys(p_payload) k WHERE k NOT IN ('person_key','response_kind','activity_type','activity_note','activity_result','activity_occurred_at','cancel_pending_cadence'))
   OR NOT p_payload ?& ARRAY['response_kind','activity_type','activity_note','activity_result','activity_occurred_at','cancel_pending_cadence']
   OR EXISTS(SELECT 1 FROM (VALUES('response_kind'),('activity_type'),('activity_note'),('activity_result'),('activity_occurred_at')) v(k) WHERE jsonb_typeof(p_payload->v.k)<>'string')
   OR jsonb_typeof(p_payload->'cancel_pending_cadence')<>'boolean' OR (p_payload->>'cancel_pending_cadence')::boolean IS NOT TRUE
  THEN RAISE EXCEPTION 'invalid relationship response payload' USING ERRCODE='22023'; END IF;
  response_kind_value:=btrim(p_payload->>'response_kind');activity_type_value:=btrim(p_payload->>'activity_type');activity_note_value:=btrim(p_payload->>'activity_note');activity_result_value:=btrim(p_payload->>'activity_result');
  business_at:=(p_payload->>'activity_occurred_at')::timestamptz;
  IF length(response_kind_value) NOT BETWEEN 1 AND 100 OR activity_type_value<>response_kind_value OR length(activity_note_value) NOT BETWEEN 1 AND 4000 OR length(activity_result_value)>8000
  THEN RAISE EXCEPTION 'invalid relationship response values' USING ERRCODE='22023'; END IF;
  canonical:=jsonb_build_object('person_key',nullif(btrim(p_payload->>'person_key'),''),'response_kind',response_kind_value,'activity_type',activity_type_value,'activity_note',activity_note_value,'activity_result',activity_result_value,'activity_occurred_at',business_at,'cancel_pending_cadence',true);
 END IF;
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;
 PERFORM 1 FROM public.users u WHERE u.auth_uid=auth.uid() FOR SHARE;PERFORM 1 FROM crm_security.access_review r WHERE r.reviewed_auth_uid=auth.uid() FOR SHARE;
 SELECT * INTO a FROM crm_security.actor();IF NOT FOUND OR a.permission_role NOT IN ('rep','branch','admin') THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;
 PERFORM 1 FROM crm_security.object_scope s WHERE s.user_id=a.user_id AND s.deal_id=p_object_id FOR SHARE;
 SELECT * INTO oldrow FROM public.deals WHERE id=p_object_id FOR UPDATE;IF NOT FOUND OR NOT crm_security.can_deal(p_object_id,true) THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;
 SELECT count(*)::integer,max(c.id::text)::uuid,max(c.person_key) INTO contact_count,contact_id_value,person_key_value FROM public.contacts c
 WHERE (nullif(btrim(p_payload->>'person_key'),'') IS NULL OR c.person_key=nullif(btrim(p_payload->>'person_key'),''))
 AND (c.id=oldrow.contact_id OR c.person_key=oldrow.person_key OR EXISTS(SELECT 1 FROM public.contact_assignments ca WHERE ca.person_key=c.person_key AND ca.opportunity_id=p_object_id AND ca.status='current' AND ca.ended_at IS NULL));
 IF contact_count<>1 THEN RAISE EXCEPTION 'unique current Deal contact required' USING ERRCODE='22023'; END IF;
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(a.auth_uid::text||p_request_id::text,0));
 SELECT * INTO prior FROM crm_security.command_receipts WHERE actor_auth_uid=a.auth_uid AND request_id=p_request_id;
 IF FOUND THEN
  IF prior.actor_user_id IS DISTINCT FROM a.user_id OR prior.operation IS DISTINCT FROM p_operation OR prior.object_id IS DISTINCT FROM p_object_id OR prior.expected_version IS DISTINCT FROM p_expected_version OR prior.payload IS DISTINCT FROM canonical
  THEN RAISE EXCEPTION 'REQUEST_ID_REUSE' USING ERRCODE='PT409'; END IF;RETURN prior.ack||jsonb_build_object('replayed',true);
 END IF;
 IF oldrow.version IS DISTINCT FROM p_expected_version THEN RAISE EXCEPTION 'version conflict' USING ERRCODE='PT409'; END IF;
 SELECT u.email INTO actor_email FROM public.users u WHERE u.user_id=a.user_id;
 SELECT u.name INTO owner_name FROM public.users u JOIN crm_security.access_review r ON r.user_id=u.user_id WHERE u.user_id=oldrow.owner_id AND u.active AND r.approved AND r.expires_at>now() AND r.permission_role IN ('rep','branch','admin');
 IF actor_email IS NULL OR owner_name IS NULL THEN RAISE EXCEPTION 'approved UUID actor and owner required' USING ERRCODE='42501'; END IF;
 server_at:=clock_timestamp();
 IF p_operation='relationship_hold' THEN
  IF hold_value<=((server_at AT TIME ZONE 'Asia/Seoul')::date) THEN RAISE EXCEPTION 'hold date must be future' USING ERRCODE='22023'; END IF;
  SELECT coalesce(jsonb_agg(id ORDER BY created_at,id),'[]'::jsonb) INTO cancelled_ids FROM public.next_actions WHERE deal_id=p_object_id AND status='open';
  UPDATE public.next_actions SET status='cancelled',updated_at=server_at WHERE deal_id=p_object_id AND status='open';
  INSERT INTO public.next_actions(deal_id,action_type,title,due_at,assignee_name,status,created_at,updated_at) VALUES(p_object_id,next_type,next_text,(next_due::text||' 09:00:00+09')::timestamptz,owner_name,'open',server_at,server_at) RETURNING id INTO next_id;
  business_at:=server_at;
 ELSE
  IF business_at>server_at+interval '5 minutes' OR business_at<server_at-interval '10 years' THEN RAISE EXCEPTION 'activity time out of range' USING ERRCODE='22023'; END IF;
  SELECT m.id,m.next_action_id INTO outcome_id,linked_next_id FROM crm_security.message_outcomes m
   WHERE m.deal_id=p_object_id AND m.contact_id=contact_id_value AND m.status='sent' AND m.response_at IS NULL AND m.occurred_at<=business_at
   ORDER BY m.occurred_at DESC,m.id DESC LIMIT 1 FOR UPDATE;
  IF outcome_id IS NULL THEN RAISE EXCEPTION 'unresponded user-attested message required' USING ERRCODE='22023'; END IF;
  INSERT INTO public.activities(deal_id,organization_id,actor_email,actor_name,type,detail,occurred_at)
   VALUES(p_object_id,oldrow.organization_id,actor_email,a.display_name,activity_type_value,jsonb_build_object('note',activity_note_value,'result',activity_result_value,'meaningful_contact',true,'message_outcome_id',outcome_id,'relationship_event_id',event_id),business_at)
   RETURNING id INTO activity_id_value;
  IF linked_next_id IS NOT NULL THEN UPDATE public.next_actions SET status='cancelled',updated_at=server_at WHERE id=linked_next_id AND deal_id=p_object_id AND status='open';GET DIAGNOSTICS linked_cancel_count=ROW_COUNT;linked_cancelled:=linked_cancel_count=1;END IF;
  UPDATE crm_security.message_outcomes SET response_at=business_at,response_kind=response_kind_value,response_activity_id=activity_id_value WHERE id=outcome_id;
 END IF;
 INSERT INTO crm_security.relationship_events(id,request_id,deal_id,contact_id,person_key,event_kind,message_outcome_id,activity_id,next_action_id,hold_until,reason,actor_auth_uid,actor_user_id,actor_name,business_at,created_at)
 VALUES(event_id,p_request_id,p_object_id,contact_id_value,person_key_value,CASE WHEN p_operation='relationship_hold' THEN 'hold' ELSE 'response' END,outcome_id,activity_id_value,CASE WHEN p_operation='relationship_hold' THEN next_id ELSE linked_next_id END,hold_value,reason_value,a.auth_uid,a.user_id,a.display_name,business_at,server_at);
 UPDATE public.deals SET wake_up_at=CASE WHEN p_operation='relationship_hold' THEN (hold_value::text||' 09:00:00+09')::timestamptz ELSE wake_up_at END,
  next_action=CASE WHEN p_operation='relationship_hold' THEN next_text WHEN linked_cancelled THEN NULL ELSE next_action END,
  next_action_date=CASE WHEN p_operation='relationship_hold' THEN next_due WHEN linked_cancelled THEN NULL ELSE next_action_date END,
  last_activity_at=CASE WHEN p_operation='relationship_response' THEN greatest(last_activity_at,business_at) ELSE last_activity_at END,
  last_customer_contact_at=CASE WHEN p_operation='relationship_response' THEN greatest(last_customer_contact_at,business_at) ELSE last_customer_contact_at END,
  updated_at=server_at,version=version+1 WHERE id=p_object_id AND version=p_expected_version RETURNING * INTO newrow;
 IF NOT FOUND THEN RAISE EXCEPTION 'unexpected version mutation' USING ERRCODE='PT409'; END IF;
 INSERT INTO crm_security.audit_events AS ae(actor_auth_uid,actor_user_id,actor_name,deal_id,action,before_data,after_data,reason,created_at)
 VALUES(a.auth_uid,a.user_id,a.display_name,p_object_id,p_operation,jsonb_build_object('version',oldrow.version,'wake_up_at',oldrow.wake_up_at),jsonb_build_object('version',newrow.version,'relationship_event_id',event_id,'message_outcome_id',outcome_id,'activity_id',activity_id_value,'next_action_id',next_id,'linked_next_action_id',linked_next_id,'linked_next_cancelled',linked_cancelled,'cancelled_action_ids',cancelled_ids,'hold_until',hold_value),coalesce(reason_value,response_kind_value),server_at) RETURNING ae.event_id INTO audit_id;
 ack:=jsonb_build_object('contract_version',1,'ok',true,'request_id',p_request_id,'write_id',p_request_id,'operation',p_operation,'object_id',p_object_id,'previous_version',p_expected_version,'version',newrow.version,
  'relationship_event_id',event_id,'contact_id',contact_id_value,'person_key',person_key_value,'hold_until',hold_value,'message_log_id',outcome_id,'activity_id',activity_id_value,'next_action_id',coalesce(next_id,linked_next_id),'linked_next_cancelled',linked_cancelled,'cancelled_action_ids',cancelled_ids,'audit_event_id',audit_id,'actor_auth_uid',a.auth_uid,'actor_user_id',a.user_id,'actor_name',a.display_name,'business_at',business_at,'server_at',server_at,'replayed',false);
 INSERT INTO crm_security.command_receipts(actor_auth_uid,request_id,actor_user_id,operation,object_id,expected_version,payload,ack,created_at) VALUES(a.auth_uid,p_request_id,a.user_id,p_operation,p_object_id,p_expected_version,canonical,ack,server_at);
 RETURN ack;
END $fn$;
REVOKE EXECUTE ON FUNCTION crm_security.crm_relationship_cadence_command_v1(uuid,text,uuid,integer,jsonb) FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION public.crm_write_command_v2(p_request_id uuid,p_operation text,p_object_id uuid,p_expected_version integer,p_payload jsonb)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $fn$
BEGIN IF p_operation IN ('relationship_hold','relationship_response') THEN RETURN crm_security.crm_relationship_cadence_command_v1(p_request_id,p_operation,p_object_id,p_expected_version,p_payload);END IF;RETURN crm_security.crm_write_command_v2_pre_relationship_cadence_20260906(p_request_id,p_operation,p_object_id,p_expected_version,p_payload);END $fn$;
REVOKE EXECUTE ON FUNCTION public.crm_write_command_v2(uuid,text,uuid,integer,jsonb) FROM PUBLIC,anon,service_role;GRANT EXECUTE ON FUNCTION public.crm_write_command_v2(uuid,text,uuid,integer,jsonb) TO authenticated;

ALTER FUNCTION public.crm_operational_source_v1(text,uuid,integer) RENAME TO crm_operational_source_v1_pre_relationship_cadence_20260906;
ALTER FUNCTION public.crm_operational_source_v1_pre_relationship_cadence_20260906(text,uuid,integer) SET SCHEMA crm_security;
REVOKE EXECUTE ON FUNCTION crm_security.crm_operational_source_v1_pre_relationship_cadence_20260906(text,uuid,integer) FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION public.crm_operational_source_v1(p_domain text,p_after uuid DEFAULT NULL,p_limit integer DEFAULT 100)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $fn$
DECLARE base jsonb; projected jsonb;
BEGIN
 base:=crm_security.crm_operational_source_v1_pre_relationship_cadence_20260906(p_domain,p_after,p_limit);
 IF p_domain='message_log' THEN
  SELECT coalesce(jsonb_agg(i.item||jsonb_build_object('response_at',m.response_at,'response_kind',m.response_kind,'response_activity_id',m.response_activity_id) ORDER BY i.ord),'[]'::jsonb) INTO projected
  FROM jsonb_array_elements(base->'items') WITH ORDINALITY i(item,ord) LEFT JOIN crm_security.message_outcomes m ON m.id=(i.item->>'id')::uuid;
  RETURN jsonb_set(base,'{items}',projected);
 ELSIF p_domain='deal_core' THEN
  SELECT coalesce(jsonb_agg(i.item||jsonb_build_object(
   'last_outbound_at',(SELECT max(m.occurred_at) FROM crm_security.message_outcomes m WHERE m.deal_id=(i.item->>'id')::uuid AND m.status='sent'),
   'last_customer_response_at',(SELECT max(m.response_at) FROM crm_security.message_outcomes m WHERE m.deal_id=(i.item->>'id')::uuid),
   'outbound_attempts',(SELECT count(*)::integer FROM crm_security.message_outcomes m WHERE m.deal_id=(i.item->>'id')::uuid AND m.status='sent' AND m.occurred_at>coalesce((SELECT max(x.response_at) FROM crm_security.message_outcomes x WHERE x.deal_id=m.deal_id),'-infinity'::timestamptz)),
   'relationship_state',coalesce((SELECT CASE e.event_kind WHEN 'hold' THEN 'hold' ELSE 'active' END FROM crm_security.relationship_events e WHERE e.deal_id=(i.item->>'id')::uuid ORDER BY e.business_at DESC,e.id DESC LIMIT 1),'active'),
   'relationship_hold_until',(SELECT e.hold_until FROM crm_security.relationship_events e WHERE e.deal_id=(i.item->>'id')::uuid AND e.event_kind='hold' ORDER BY e.business_at DESC,e.id DESC LIMIT 1),
   'waiting_reason',(SELECT e.reason FROM crm_security.relationship_events e WHERE e.deal_id=(i.item->>'id')::uuid AND e.event_kind='hold' ORDER BY e.business_at DESC,e.id DESC LIMIT 1)
  ) ORDER BY i.ord),'[]'::jsonb) INTO projected FROM jsonb_array_elements(base->'items') WITH ORDINALITY i(item,ord);
  RETURN jsonb_set(base,'{items}',projected);
 END IF;RETURN base;
END $fn$;
REVOKE EXECUTE ON FUNCTION public.crm_operational_source_v1(text,uuid,integer) FROM PUBLIC,anon,service_role;GRANT EXECUTE ON FUNCTION public.crm_operational_source_v1(text,uuid,integer) TO authenticated;

DO $post$ BEGIN
 IF has_table_privilege('authenticated','crm_security.relationship_events','SELECT') OR has_function_privilege('authenticated','crm_security.crm_relationship_cadence_command_v1(uuid,text,uuid,integer,jsonb)','EXECUTE')
 OR has_function_privilege('authenticated','crm_security.crm_write_command_v2_pre_relationship_cadence_20260906(uuid,text,uuid,integer,jsonb)','EXECUTE') OR has_function_privilege('authenticated','crm_security.crm_operational_source_v1_pre_relationship_cadence_20260906(text,uuid,integer)','EXECUTE')
 OR NOT has_function_privilege('authenticated','public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)','EXECUTE') OR NOT has_function_privilege('authenticated','public.crm_operational_source_v1(text,uuid,integer)','EXECUTE')
 OR has_function_privilege('anon','public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)','EXECUTE') OR has_function_privilege('anon','public.crm_operational_source_v1(text,uuid,integer)','EXECUTE')
 THEN RAISE EXCEPTION 'relationship cadence post-apply drift';END IF;
END $post$;
DO $full_local_post$ BEGIN IF to_regprocedure('public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)') IS NULL OR to_regprocedure('public.crm_operational_source_v1(text,uuid,integer)') IS NULL OR NOT has_function_privilege('authenticated','public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)','EXECUTE') OR has_function_privilege('anon','public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)','EXECUTE') OR NOT has_function_privilege('authenticated','public.crm_operational_source_v1(text,uuid,integer)','EXECUTE') OR has_function_privilege('anon','public.crm_operational_source_v1(text,uuid,integer)','EXECUTE') OR to_regprocedure('crm_security.crm_deal_close_won_command_v1(uuid,uuid,integer,jsonb)') IS NULL OR has_function_privilege('authenticated','crm_security.crm_deal_close_won_command_v1(uuid,uuid,integer,jsonb)','EXECUTE')
  OR to_regprocedure('crm_security.crm_expansion_pool_update_command_v1(uuid,uuid,integer,jsonb)') IS NULL OR has_function_privilege('authenticated','crm_security.crm_expansion_pool_update_command_v1(uuid,uuid,integer,jsonb)','EXECUTE')
  OR to_regprocedure('crm_security.crm_message_reminder_command_v1(uuid,uuid,integer,jsonb)') IS NULL OR has_function_privilege('authenticated','crm_security.crm_message_reminder_command_v1(uuid,uuid,integer,jsonb)','EXECUTE')
  OR to_regprocedure('crm_security.crm_next_action_postpone_command_v1(uuid,uuid,integer,jsonb)') IS NULL OR has_function_privilege('authenticated','crm_security.crm_next_action_postpone_command_v1(uuid,uuid,integer,jsonb)','EXECUTE')
  OR to_regprocedure('crm_security.crm_mobile_today_outcome_command_v1(uuid,text,uuid,integer,jsonb)') IS NULL OR has_function_privilege('authenticated','crm_security.crm_mobile_today_outcome_command_v1(uuid,text,uuid,integer,jsonb)','EXECUTE')
  OR to_regprocedure('crm_security.crm_customer_support_action_command_v1(uuid,text,uuid,integer,jsonb)') IS NULL OR has_function_privilege('authenticated','crm_security.crm_customer_support_action_command_v1(uuid,text,uuid,integer,jsonb)','EXECUTE')
  OR to_regprocedure('crm_security.crm_message_log_command_v1(uuid,text,uuid,integer,jsonb)') IS NULL OR has_function_privilege('authenticated','crm_security.crm_message_log_command_v1(uuid,text,uuid,integer,jsonb)','EXECUTE')
  OR to_regprocedure('crm_security.crm_relationship_cadence_command_v1(uuid,text,uuid,integer,jsonb)') IS NULL OR has_function_privilege('authenticated','crm_security.crm_relationship_cadence_command_v1(uuid,text,uuid,integer,jsonb)','EXECUTE') OR to_regclass('crm_security.expansion_pool') IS NULL OR has_table_privilege('authenticated','crm_security.expansion_pool','SELECT,INSERT,UPDATE,DELETE')
  OR to_regclass('crm_security.deal_won_events') IS NULL OR has_table_privilege('authenticated','crm_security.deal_won_events','SELECT,INSERT,UPDATE,DELETE')
  OR to_regclass('crm_security.expansion_pool_events') IS NULL OR has_table_privilege('authenticated','crm_security.expansion_pool_events','SELECT,INSERT,UPDATE,DELETE')
  OR to_regclass('crm_security.message_reminders') IS NULL OR has_table_privilege('authenticated','crm_security.message_reminders','SELECT,INSERT,UPDATE,DELETE')
  OR to_regclass('crm_security.next_action_postponements') IS NULL OR has_table_privilege('authenticated','crm_security.next_action_postponements','SELECT,INSERT,UPDATE,DELETE')
  OR to_regclass('crm_security.customer_support_actions') IS NULL OR has_table_privilege('authenticated','crm_security.customer_support_actions','SELECT,INSERT,UPDATE,DELETE')
  OR to_regclass('crm_security.message_outcomes') IS NULL OR has_table_privilege('authenticated','crm_security.message_outcomes','SELECT,INSERT,UPDATE,DELETE')
  OR to_regclass('crm_security.relationship_events') IS NULL OR has_table_privilege('authenticated','crm_security.relationship_events','SELECT,INSERT,UPDATE,DELETE') OR (SELECT pg_get_constraintdef(oid,true) FROM pg_constraint WHERE conrelid='crm_security.command_receipts'::regclass AND conname='command_receipts_operation_check') IS DISTINCT FROM $expected$CHECK (operation = ANY (ARRAY['opportunity_work_set'::text, 'inquiry_assign'::text, 'service_change'::text, 'inquiry_unassign'::text, 'favorite_set'::text, 'opportunity_touch'::text, 'next_action'::text, 'activity'::text, 'quote_version'::text, 'next_action_complete'::text, 'stage_check'::text, 'transition'::text, 'close'::text, 'amount'::text, 'waiting_context'::text, 'inquiry_reclassify'::text, 'inquiry_status'::text, 'inquiry_trash'::text, 'inquiry_restore'::text, 'inquiry_purge'::text, 'inquiry_followup'::text, 'opportunity_create'::text, 'lineage_link'::text, 'attachment_prepare'::text, 'attachment_complete'::text, 'expansion_pool_update'::text, 'expansion_note'::text, 'customer_support_action'::text, 'message_log'::text, 'relationship_hold'::text, 'relationship_response'::text]))$expected$ THEN RAISE EXCEPTION 'operational full local post-apply drift';END IF;END $full_local_post$;
COMMIT;
