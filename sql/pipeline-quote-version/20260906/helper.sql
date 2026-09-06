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
