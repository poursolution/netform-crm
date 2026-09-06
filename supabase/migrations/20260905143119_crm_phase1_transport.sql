-- Phase 1 only: Staging approval wrapper supplies strict before/after catalog guards.
BEGIN;
SET LOCAL search_path=public,pg_catalog;
SET LOCAL lock_timeout='3s';
SET LOCAL statement_timeout='60s';
DO $$ BEGIN
 IF current_user<>'postgres' OR current_setting('crm.phase1_ref',true) IS DISTINCT FROM 'rprechiaglyjaydkmxsu'
 THEN RAISE EXCEPTION 'Explicit Staging Phase 1 approval required'; END IF;
 IF to_regclass('crm_security.command_receipts') IS NOT NULL OR to_regnamespace('crm_phase1_archive') IS NOT NULL
 THEN RAISE EXCEPTION 'Existing Phase 1 state; do not overwrite'; END IF;
END $$;

CREATE OR REPLACE FUNCTION public.crm_profile_scoped_v2() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $fn$
DECLARE a record; sr text; modes jsonb; BEGIN
 SELECT * INTO a FROM crm_security.actor();
 IF NOT FOUND THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;
 SELECT u.role INTO sr FROM public.users u WHERE u.user_id=a.user_id;
 IF sr NOT IN ('rep','admin','dual','viewer') OR a.permission_role NOT IN ('rep','consultation','branch','admin')
 THEN RAISE EXCEPTION 'unsupported role mapping' USING ERRCODE='42501'; END IF;
 -- Mode is presentation, never a substitute for the approved permission/scope ledger.
 modes:=CASE WHEN a.permission_role='admin' AND sr IN ('admin','dual') THEN '["rep","admin"]'::jsonb ELSE '["rep"]'::jsonb END;
 RETURN jsonb_build_object('contract_version',2,'user_id',a.user_id,'auth_uid',a.auth_uid,
  'name',a.display_name,'permission_role',a.permission_role,'source_role',sr,'allowed_modes',modes);
END $fn$;

CREATE TABLE crm_security.command_receipts(
 actor_auth_uid uuid NOT NULL,request_id uuid NOT NULL,actor_user_id uuid NOT NULL,
 operation text NOT NULL CHECK(operation='opportunity_work_set'),object_id uuid NOT NULL,
 expected_version integer NOT NULL,payload jsonb NOT NULL,ack jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(actor_auth_uid,request_id)
);
ALTER TABLE crm_security.command_receipts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE crm_security.command_receipts FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION public.crm_write_command_v2(p_request_id uuid,p_operation text,p_object_id uuid,p_expected_version integer,p_payload jsonb) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $fn$
DECLARE a record; receipt crm_security.command_receipts%ROWTYPE; result jsonb; ack jsonb; BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;
 -- Approval, identity and explicit scope cannot be revoked midway through a replay.
 PERFORM 1 FROM public.users u WHERE u.auth_uid=auth.uid() FOR SHARE;
 PERFORM 1 FROM crm_security.access_review r WHERE r.reviewed_auth_uid=auth.uid() FOR SHARE;
 SELECT * INTO a FROM crm_security.actor();
 IF NOT FOUND THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;
 PERFORM 1 FROM crm_security.object_scope s WHERE s.user_id=a.user_id AND s.deal_id=p_object_id FOR SHARE;
 PERFORM 1 FROM public.deals d WHERE d.id=p_object_id FOR UPDATE;
 IF NOT crm_security.can_deal(p_object_id,true) THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;
 IF p_request_id IS NULL OR p_object_id IS NULL OR p_expected_version IS NULL OR p_expected_version<0
 OR p_operation IS DISTINCT FROM 'opportunity_work_set' OR jsonb_typeof(p_payload) IS DISTINCT FROM 'object'
 THEN RAISE EXCEPTION 'unsupported command' USING ERRCODE='22023'; END IF;
 IF EXISTS(SELECT 1 FROM jsonb_object_keys(p_payload) k WHERE k NOT IN ('primary_work','work_items','reason'))
 OR NOT p_payload ?& ARRAY['primary_work','work_items','reason']
 OR jsonb_typeof(p_payload->'primary_work') IS DISTINCT FROM 'string'
 OR jsonb_typeof(p_payload->'reason') IS DISTINCT FROM 'string'
 THEN RAISE EXCEPTION 'invalid payload; actor is server-owned' USING ERRCODE='22023'; END IF;
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(a.auth_uid::text||p_request_id::text,0));
 SELECT * INTO receipt FROM crm_security.command_receipts r WHERE r.actor_auth_uid=a.auth_uid AND r.request_id=p_request_id;
 IF FOUND THEN
  IF receipt.actor_user_id IS DISTINCT FROM a.user_id OR receipt.operation IS DISTINCT FROM p_operation
  OR receipt.object_id IS DISTINCT FROM p_object_id OR receipt.expected_version IS DISTINCT FROM p_expected_version
  OR receipt.payload IS DISTINCT FROM p_payload
  THEN RAISE EXCEPTION 'REQUEST_ID_REUSE' USING ERRCODE='PT409'; END IF;
  RETURN receipt.ack||jsonb_build_object('replayed',true);
 END IF;
 result:=public.crm_work_set_scoped_v2(p_object_id,p_payload->>'primary_work',p_payload->'work_items',p_payload->>'reason',p_expected_version,NULL);
 ack:=jsonb_build_object('contract_version',1,'ok',true,'operation',p_operation,'request_id',p_request_id,
  'actor_auth_uid',a.auth_uid,'actor_user_id',a.user_id,'object_id',result->'id',
  'previous_version',p_expected_version,'version',result->'version','audit_event_id',result->'audit_event_id','replayed',false);
 INSERT INTO crm_security.command_receipts(actor_auth_uid,request_id,actor_user_id,operation,object_id,expected_version,payload,ack)
 VALUES(a.auth_uid,p_request_id,a.user_id,p_operation,p_object_id,p_expected_version,p_payload,ack);
 RETURN ack;
END $fn$;
REVOKE EXECUTE ON FUNCTION public.crm_profile_scoped_v2(),public.crm_write_command_v2(uuid,text,uuid,integer,jsonb) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.crm_profile_scoped_v2(),public.crm_write_command_v2(uuid,text,uuid,integer,jsonb) TO authenticated;
DO $$ DECLARE p record; BEGIN
 FOR p IN SELECT * FROM pg_proc WHERE oid IN ('public.crm_profile_scoped_v2()'::regprocedure,'public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)'::regprocedure) LOOP
  IF pg_get_userbyid(p.proowner)<>'postgres' OR p.proconfig IS DISTINCT FROM ARRAY['search_path=""']
   OR has_function_privilege('anon',p.oid,'EXECUTE') OR NOT has_function_privilege('authenticated',p.oid,'EXECUTE')
   OR EXISTS(SELECT 1 FROM aclexplode(p.proacl) x WHERE x.grantee=0 AND x.privilege_type='EXECUTE')
  THEN RAISE EXCEPTION 'Phase 1 function owner/config/effective ACL mismatch'; END IF;
 END LOOP;
 IF (SELECT pg_get_userbyid(relowner) FROM pg_class WHERE oid='crm_security.command_receipts'::regclass)<>'postgres'
 OR has_table_privilege('anon','crm_security.command_receipts','SELECT')
 OR has_table_privilege('authenticated','crm_security.command_receipts','SELECT')
 THEN RAISE EXCEPTION 'Phase 1 private table mismatch'; END IF;
END $$;
COMMIT;
