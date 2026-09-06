SET crm.expected_amount_ref='rprechiaglyjaydkmxsu';
BEGIN;SET LOCAL search_path=pg_catalog;SET LOCAL lock_timeout='3s';SET LOCAL statement_timeout='60s';
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
COMMIT;