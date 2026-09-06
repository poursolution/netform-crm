SET crm.personal_state_ref='rprechiaglyjaydkmxsu';
-- LOCAL COMPOSITION CANDIDATE. Do not run remotely without generating and
-- reviewing staging-apply.sql and its exact live OID/hash guards.
BEGIN;
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
COMMIT;
