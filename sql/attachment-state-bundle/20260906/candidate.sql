-- LOCAL CANDIDATE ONLY.
-- T01/T02 attachment Storage is deliberately absent: current Staging evidence
-- does not prove the bucket, signer, metadata relation, ACL, or cleanup policy.
-- This file implements only Storage-independent T03 per-user Deal state.
BEGIN;
SET LOCAL search_path=pg_catalog;
SET LOCAL lock_timeout='3s';
SET LOCAL statement_timeout='60s';

DO $guard$ BEGIN
 IF current_setting('crm.attachment_state_ref',true) IS DISTINCT FROM 'rprechiaglyjaydkmxsu'
  OR to_regprocedure('public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)') IS NULL
  OR to_regprocedure('crm_security.crm_user_opportunity_state_command_v1(uuid,text,uuid,jsonb)') IS NOT NULL
  OR to_regprocedure('crm_security.crm_user_opportunity_states_v1()') IS NOT NULL
  OR to_regclass('crm_security.user_opportunity_state') IS NOT NULL
  OR to_regclass('crm_security.user_opportunity_state_receipts') IS NOT NULL
  OR to_regclass('public.crm_attachments') IS NOT NULL
  OR to_regprocedure('public.crm_attachment_prepare_meta(jsonb)') IS NOT NULL
  OR to_regprocedure('public.crm_attachment_complete(jsonb)') IS NOT NULL
 THEN RAISE EXCEPTION 'attachment/state local prerequisite drift'; END IF;
END $guard$;

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
 ON crm_security.user_opportunity_state(actor_user_id,last_viewed_at DESC,last_worked_at DESC);

CREATE TABLE crm_security.user_opportunity_state_receipts(
 actor_auth_uid uuid NOT NULL,
 request_id uuid NOT NULL,
 actor_user_id uuid NOT NULL REFERENCES public.users(user_id),
 operation text NOT NULL CHECK(operation IN ('favorite_set','opportunity_touch')),
 object_id uuid NOT NULL REFERENCES public.deals(id),
 payload jsonb NOT NULL CHECK(jsonb_typeof(payload)='object'),
 ack jsonb NOT NULL CHECK(jsonb_typeof(ack)='object'),
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(actor_auth_uid,request_id)
);

REVOKE ALL ON crm_security.user_opportunity_state,
 crm_security.user_opportunity_state_receipts FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION crm_security.crm_user_opportunity_state_command_v1(
 p_request_id uuid,p_operation text,p_object_id uuid,p_payload jsonb
) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $fn$
DECLARE
 a record;
 prior crm_security.user_opportunity_state_receipts%ROWTYPE;
 state crm_security.user_opportunity_state%ROWTYPE;
 canonical jsonb;
 ack jsonb;
 favorite_value boolean;
 kind_value text;
 server_at timestamptz;
BEGIN
 IF p_request_id IS NULL OR p_object_id IS NULL
  OR p_operation NOT IN ('favorite_set','opportunity_touch')
  OR jsonb_typeof(p_payload) IS DISTINCT FROM 'object'
 THEN RAISE EXCEPTION 'invalid user state envelope' USING ERRCODE='22023'; END IF;
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;
 PERFORM 1 FROM public.users u WHERE u.auth_uid=auth.uid() FOR SHARE;
 PERFORM 1 FROM crm_security.access_review r WHERE r.reviewed_auth_uid=auth.uid() FOR SHARE;
 SELECT * INTO a FROM crm_security.actor();
 IF NOT FOUND THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;
 IF NOT crm_security.can_deal(p_object_id,false)
 THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;

 IF p_payload ? 'opportunity_id' AND
    (jsonb_typeof(p_payload->'opportunity_id')<>'string'
     OR p_payload->>'opportunity_id'<>p_object_id::text)
 THEN RAISE EXCEPTION 'object mismatch' USING ERRCODE='22023'; END IF;
 IF p_payload ? 'user_key' AND jsonb_typeof(p_payload->'user_key') NOT IN ('string','null')
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
   OR (p_payload ? 'touched_at' AND jsonb_typeof(p_payload->'touched_at') NOT IN ('string','null'))
  THEN RAISE EXCEPTION 'invalid touch payload' USING ERRCODE='22023'; END IF;
  kind_value:=p_payload->>'touch_kind';
  canonical:=jsonb_build_object('touch_kind',kind_value);
 END IF;

 PERFORM pg_catalog.pg_advisory_xact_lock(
  pg_catalog.hashtextextended(a.auth_uid::text||p_request_id::text,0));
 SELECT * INTO prior FROM crm_security.user_opportunity_state_receipts r
  WHERE r.actor_auth_uid=a.auth_uid AND r.request_id=p_request_id;
 IF FOUND THEN
  IF prior.actor_user_id IS DISTINCT FROM a.user_id
   OR prior.operation IS DISTINCT FROM p_operation
   OR prior.object_id IS DISTINCT FROM p_object_id
   OR prior.payload IS DISTINCT FROM canonical
  THEN RAISE EXCEPTION 'REQUEST_ID_REUSE' USING ERRCODE='PT409'; END IF;
  RETURN prior.ack||jsonb_build_object('replayed',true);
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
  'favorite',state.favorite,'last_viewed_at',state.last_viewed_at,
  'last_worked_at',state.last_worked_at,'view_count',state.view_count,
  'server_at',server_at,'replayed',false);
 INSERT INTO crm_security.user_opportunity_state_receipts(
  actor_auth_uid,request_id,actor_user_id,operation,object_id,payload,ack)
 VALUES(a.auth_uid,p_request_id,a.user_id,p_operation,p_object_id,canonical,ack);
 RETURN ack;
END $fn$;

CREATE FUNCTION crm_security.crm_user_opportunity_states_v1()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $fn$
 SELECT coalesce(jsonb_agg(jsonb_build_object(
  'opportunity_id',s.deal_id,'favorite',s.favorite,
  'last_viewed_at',s.last_viewed_at,'last_worked_at',s.last_worked_at,
  'view_count',s.view_count,'updated_at',s.updated_at)
  ORDER BY greatest(s.last_viewed_at,s.last_worked_at,s.updated_at) DESC),'[]'::jsonb)
 FROM crm_security.actor() a
 JOIN crm_security.user_opportunity_state s ON s.actor_user_id=a.user_id
 WHERE crm_security.can_deal(s.deal_id,false)
$fn$;

REVOKE EXECUTE ON FUNCTION
 crm_security.crm_user_opportunity_state_command_v1(uuid,text,uuid,jsonb),
 crm_security.crm_user_opportunity_states_v1()
 FROM PUBLIC,anon,authenticated,service_role;
COMMIT;
