-- Local-only candidate. Not approved for Staging or Production execution.
-- Adds only the DERIVED_SAFE inquiry_unassign command. The frozen dispatcher is guarded and untouched.
SET crm.inquiry_domain_ref='rprechiaglyjaydkmxsu';
BEGIN;
SET LOCAL search_path=pg_catalog;
SET LOCAL lock_timeout='3s';
SET LOCAL statement_timeout='60s';

DO $guard$
DECLARE dispatcher text;
BEGIN
 IF current_user<>'postgres'
  OR current_setting('crm.inquiry_domain_ref',true) IS DISTINCT FROM 'rprechiaglyjaydkmxsu'
 THEN RAISE EXCEPTION 'Staging inquiry-domain candidate approval required'; END IF;

 SELECT pg_get_functiondef('public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)'::regprocedure)
 INTO dispatcher;
 IF md5(dispatcher) IS DISTINCT FROM '0febf128445d3fe539d0d1f2bc63e3d7'
 THEN RAISE EXCEPTION 'Frozen crm_write_command_v2 drift'; END IF;

 IF to_regclass('public.inquiries') IS NULL
  OR to_regclass('public.assignment_history') IS NULL
  OR to_regclass('crm_security.command_receipts') IS NULL
  OR to_regclass('crm_security.inquiry_audit_events') IS NULL
  OR NOT EXISTS (
   SELECT 1 FROM pg_attribute
   WHERE attrelid='public.inquiries'::regclass AND attname='assigned_to'
    AND format_type(atttypid,atttypmod)='uuid' AND NOT attisdropped)
  OR NOT EXISTS (
   SELECT 1 FROM pg_attribute
   WHERE attrelid='public.inquiries'::regclass AND attname='assigned_at'
    AND format_type(atttypid,atttypmod)='timestamp with time zone' AND NOT attisdropped)
  OR NOT EXISTS (
   SELECT 1 FROM pg_attribute
   WHERE attrelid='public.inquiries'::regclass AND attname='status'
    AND format_type(atttypid,atttypmod)='text' AND NOT attisdropped)
  OR NOT EXISTS (
   SELECT 1 FROM pg_attribute
   WHERE attrelid='public.inquiries'::regclass AND attname='first_response_at'
    AND format_type(atttypid,atttypmod)='timestamp with time zone' AND NOT attisdropped)
  OR NOT EXISTS (
   SELECT 1 FROM pg_attribute
   WHERE attrelid='public.inquiries'::regclass AND attname='responded_at'
    AND format_type(atttypid,atttypmod)='timestamp with time zone' AND NOT attisdropped)
 THEN RAISE EXCEPTION 'Required inquiry_unassign schema is absent or drifted'; END IF;

 IF (SELECT pg_get_constraintdef(oid,true) FROM pg_constraint
     WHERE conrelid='crm_security.command_receipts'::regclass
       AND conname='command_receipts_operation_check')
      IS DISTINCT FROM 'CHECK (operation = ANY (ARRAY[''opportunity_work_set''::text, ''inquiry_assign''::text]))'
  OR (SELECT pg_get_constraintdef(oid,true) FROM pg_constraint
      WHERE conrelid='crm_security.inquiry_audit_events'::regclass
        AND conname='inquiry_audit_events_action_check')
      IS DISTINCT FROM 'CHECK (action = ANY (ARRAY[''direct_assign''::text, ''direct_reassign''::text]))'
 THEN RAISE EXCEPTION 'Receipt or inquiry audit constraint drift'; END IF;
END $guard$;

ALTER TABLE crm_security.command_receipts
 DROP CONSTRAINT command_receipts_operation_check;
ALTER TABLE crm_security.command_receipts
 ADD CONSTRAINT command_receipts_operation_check
 CHECK(operation IN ('opportunity_work_set','inquiry_assign','inquiry_unassign'));

ALTER TABLE crm_security.inquiry_audit_events
 DROP CONSTRAINT inquiry_audit_events_action_check;
ALTER TABLE crm_security.inquiry_audit_events
 ADD CONSTRAINT inquiry_audit_events_action_check
 CHECK(action IN ('direct_assign','direct_reassign','inquiry_unassign'));

CREATE FUNCTION public.crm_inquiry_unassign_command_v1(
 p_request_id uuid,
 p_inquiry_id uuid,
 p_payload jsonb
) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $fn$
DECLARE
 a record;
 receipt crm_security.command_receipts%ROWTYPE;
 oldrow public.inquiries%ROWTYPE;
 newrow public.inquiries%ROWTYPE;
 audit_event uuid;
 from_name text;
 reason_value text;
 changed_at_value timestamptz;
 changed boolean;
 canonical_payload jsonb;
 ack jsonb;
BEGIN
 IF auth.uid() IS NULL THEN
  RAISE EXCEPTION 'forbidden' USING ERRCODE='42501';
 END IF;
 PERFORM 1 FROM public.users u WHERE u.auth_uid=auth.uid() FOR SHARE;
 PERFORM 1 FROM crm_security.access_review r WHERE r.reviewed_auth_uid=auth.uid() FOR SHARE;
 SELECT * INTO a FROM crm_security.actor();
 IF NOT FOUND THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;

 IF p_request_id IS NULL OR p_inquiry_id IS NULL
  OR jsonb_typeof(p_payload) IS DISTINCT FROM 'object'
  OR NOT p_payload ? 'reason'
  OR EXISTS(SELECT 1 FROM jsonb_object_keys(p_payload) k WHERE k<>'reason')
  OR jsonb_typeof(p_payload->'reason') IS DISTINCT FROM 'string'
  OR length(trim(p_payload->>'reason'))<1
  OR length(p_payload->>'reason')>2000
 THEN RAISE EXCEPTION 'invalid inquiry_unassign payload; actor, status and time are server-owned'
  USING ERRCODE='22023';
 END IF;
 reason_value:=trim(p_payload->>'reason');
 canonical_payload:=jsonb_build_object('reason',reason_value);

 PERFORM 1 FROM crm_security.object_scope s
  WHERE s.user_id=a.user_id AND s.inquiry_id=p_inquiry_id FOR SHARE;
 SELECT * INTO oldrow FROM public.inquiries i WHERE i.id=p_inquiry_id FOR UPDATE;
 IF NOT FOUND OR a.permission_role<>'admin' OR NOT crm_security.can_inquiry(p_inquiry_id)
 THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;

 PERFORM pg_catalog.pg_advisory_xact_lock(
  pg_catalog.hashtextextended(a.auth_uid::text||p_request_id::text,0));
 SELECT * INTO receipt FROM crm_security.command_receipts r
  WHERE r.actor_auth_uid=a.auth_uid AND r.request_id=p_request_id;
 IF FOUND THEN
  IF receipt.actor_user_id IS DISTINCT FROM a.user_id
   OR receipt.operation IS DISTINCT FROM 'inquiry_unassign'
   OR receipt.object_id IS DISTINCT FROM p_inquiry_id
   OR receipt.expected_version IS DISTINCT FROM 0
   OR receipt.payload IS DISTINCT FROM canonical_payload
  THEN RAISE EXCEPTION 'REQUEST_ID_REUSE' USING ERRCODE='PT409'; END IF;
  RETURN receipt.ack||jsonb_build_object('replayed',true);
 END IF;

 changed:=oldrow.assigned_to IS NOT NULL;
 IF changed THEN
  changed_at_value:=clock_timestamp();
  SELECT u.name INTO from_name FROM public.users u WHERE u.user_id=oldrow.assigned_to;
  from_name:=coalesce(from_name,oldrow.assignee_name,'미배정');
  UPDATE public.inquiries i
  SET assigned_to=NULL,
      assigned_at=NULL,
      status=CASE
       WHEN oldrow.first_response_at IS NULL AND oldrow.responded_at IS NULL THEN '접수'
       ELSE oldrow.status
      END,
      updated_at=changed_at_value
  WHERE i.id=p_inquiry_id
  RETURNING * INTO newrow;

  INSERT INTO public.assignment_history(
   inquiry_id,from_owner,to_owner,reason,actor_name,changed_at)
  VALUES(p_inquiry_id,from_name,'미배정',reason_value,a.display_name,changed_at_value);

  INSERT INTO crm_security.inquiry_audit_events(
   actor_auth_uid,actor_user_id,inquiry_id,action,before_data,after_data,reason,created_at)
  VALUES(
   a.auth_uid,a.user_id,p_inquiry_id,'inquiry_unassign',
   jsonb_build_object(
    'assigned_to',oldrow.assigned_to,'assigned_at',oldrow.assigned_at,
    'status',oldrow.status,'first_response_at',oldrow.first_response_at,
    'responded_at',oldrow.responded_at),
   jsonb_build_object(
    'assigned_to',newrow.assigned_to,'assigned_at',newrow.assigned_at,
    'status',newrow.status,'first_response_at',newrow.first_response_at,
    'responded_at',newrow.responded_at),
   reason_value,changed_at_value)
  RETURNING event_id INTO audit_event;
 ELSE
  newrow:=oldrow;
 END IF;

 ack:=jsonb_build_object(
  'contract_version',1,
  'ok',true,
  'operation','inquiry_unassign',
  'request_id',p_request_id,
  'actor_auth_uid',a.auth_uid,
  'actor_user_id',a.user_id,
  'object_id',p_inquiry_id,
  'assigned_to',newrow.assigned_to,
  'status',coalesce(newrow.status,''),
  'changed',changed,
  'inquiry_audit_event_id',audit_event,
  'replayed',false);

 INSERT INTO crm_security.command_receipts(
  actor_auth_uid,request_id,actor_user_id,operation,object_id,expected_version,payload,ack)
 VALUES(a.auth_uid,p_request_id,a.user_id,'inquiry_unassign',p_inquiry_id,0,canonical_payload,ack);
 RETURN ack;
END $fn$;

REVOKE EXECUTE ON FUNCTION public.crm_inquiry_unassign_command_v1(uuid,uuid,jsonb)
 FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.crm_inquiry_unassign_command_v1(uuid,uuid,jsonb)
 TO authenticated;

DO $verify$
DECLARE p record; dispatcher text;
BEGIN
 SELECT * INTO p FROM pg_proc
 WHERE oid='public.crm_inquiry_unassign_command_v1(uuid,uuid,jsonb)'::regprocedure;
 SELECT pg_get_functiondef('public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)'::regprocedure)
 INTO dispatcher;
 IF pg_get_userbyid(p.proowner)<>'postgres' OR NOT p.prosecdef
  OR p.proconfig IS DISTINCT FROM ARRAY['search_path=""']
  OR has_function_privilege('anon',p.oid,'EXECUTE')
  OR has_function_privilege('service_role',p.oid,'EXECUTE')
  OR NOT has_function_privilege('authenticated',p.oid,'EXECUTE')
  OR EXISTS(SELECT 1 FROM aclexplode(p.proacl) x WHERE x.grantee=0)
  OR md5(dispatcher) IS DISTINCT FROM '0febf128445d3fe539d0d1f2bc63e3d7'
 THEN RAISE EXCEPTION 'inquiry_unassign candidate verification failed'; END IF;
END $verify$;
COMMIT;
