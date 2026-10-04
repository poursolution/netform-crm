-- One contract event ledger, independent of operational Deal existence.
-- No business records or historical dates are inferred by this migration.
BEGIN;
ALTER TABLE crm_security.contract_sales ADD COLUMN contract_id uuid;
UPDATE crm_security.contract_sales SET contract_id=deal_id;
ALTER TABLE crm_security.contract_sales ALTER COLUMN contract_id SET NOT NULL;
ALTER TABLE crm_security.contract_sales_events DROP CONSTRAINT contract_sales_events_deal_id_fkey;
ALTER TABLE crm_security.contract_sales DROP CONSTRAINT contract_sales_pkey;
ALTER TABLE crm_security.contract_sales ALTER COLUMN deal_id DROP NOT NULL;
ALTER TABLE crm_security.contract_sales ADD PRIMARY KEY(contract_id);
ALTER TABLE crm_security.contract_sales ADD UNIQUE(deal_id);
ALTER TABLE crm_security.contract_sales ADD COLUMN advisory_id uuid UNIQUE REFERENCES public.advisory_deals(advisory_id);
ALTER TABLE crm_security.contract_sales ADD COLUMN construction_contract_key text UNIQUE;
ALTER TABLE crm_security.contract_sales ADD CONSTRAINT contract_sales_source_check CHECK(
 (deal_id IS NOT NULL AND advisory_id IS NULL) OR
 (deal_id IS NULL AND advisory_id IS NOT NULL AND nullif(btrim(construction_contract_key),'') IS NOT NULL)
);
ALTER TABLE crm_security.contract_sales_events ADD COLUMN contract_id uuid;
UPDATE crm_security.contract_sales_events SET contract_id=deal_id;
ALTER TABLE crm_security.contract_sales_events ALTER COLUMN contract_id SET NOT NULL;
ALTER TABLE crm_security.contract_sales_events ADD FOREIGN KEY(contract_id) REFERENCES crm_security.contract_sales(contract_id);
ALTER TABLE crm_security.contract_sales_events ALTER COLUMN deal_id DROP NOT NULL;
ALTER TABLE crm_security.contract_sales_events ADD FOREIGN KEY(deal_id) REFERENCES crm_security.contract_sales(deal_id);
ALTER TABLE crm_security.contract_sales_events ADD UNIQUE(contract_id,sequence);

CREATE TABLE crm_security.contract_sales_imports(
 import_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 contract_id uuid NOT NULL UNIQUE REFERENCES crm_security.contract_sales(contract_id),
 evidence jsonb NOT NULL CHECK(jsonb_typeof(evidence)='object'),
 attribution_snapshot jsonb NOT NULL,
 imported_by text NOT NULL DEFAULT session_user,
 imported_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
ALTER TABLE crm_security.contract_sales_imports ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON crm_security.contract_sales_imports FROM PUBLIC,anon,authenticated,service_role;
ALTER TABLE crm_security.contract_sales_events ADD COLUMN import_id uuid REFERENCES crm_security.contract_sales_imports(import_id);
ALTER TABLE crm_security.contract_sales_events ALTER COLUMN actor_auth_uid DROP NOT NULL;
ALTER TABLE crm_security.contract_sales_events ADD CONSTRAINT contract_sales_event_actor_check CHECK(
 (actor_auth_uid IS NOT NULL AND import_id IS NULL) OR (actor_auth_uid IS NULL AND import_id IS NOT NULL)
);

-- Legacy writers retain real Deal IDs. Independent contracts never create a Deal.
CREATE FUNCTION crm_security.contract_sales_identity() RETURNS trigger
LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
 IF NEW.contract_id IS NULL THEN NEW.contract_id:=coalesce(NEW.deal_id,gen_random_uuid()); END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION crm_security.contract_sales_identity() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER contract_sales_identity BEFORE INSERT ON crm_security.contract_sales
 FOR EACH ROW EXECUTE FUNCTION crm_security.contract_sales_identity();

CREATE FUNCTION crm_security.contract_sales_event_identity() RETURNS trigger
LANGUAGE plpgsql SET search_path='' AS $$
DECLARE h crm_security.contract_sales%rowtype;
BEGIN
 IF NEW.contract_id IS NULL THEN
  SELECT * INTO h FROM crm_security.contract_sales WHERE deal_id=NEW.deal_id;
  NEW.contract_id:=h.contract_id;
 ELSE
  SELECT * INTO h FROM crm_security.contract_sales WHERE contract_id=NEW.contract_id;
 END IF;
 IF h.contract_id IS NULL OR NEW.deal_id IS DISTINCT FROM h.deal_id THEN RAISE EXCEPTION 'CONTRACT_ID_CONFLICT'; END IF;
 IF NEW.import_id IS NOT NULL AND NOT EXISTS(
  SELECT 1 FROM crm_security.contract_sales_imports i WHERE i.import_id=NEW.import_id AND i.contract_id=NEW.contract_id
 ) THEN RAISE EXCEPTION 'IMPORT_CONTRACT_CONFLICT'; END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION crm_security.contract_sales_event_identity() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER contract_sales_event_identity BEFORE INSERT ON crm_security.contract_sales_events
 FOR EACH ROW EXECUTE FUNCTION crm_security.contract_sales_event_identity();

-- Private, invoker-only operator import: never impersonates a logged-in employee.
-- Its input is an audited, verified contract, not a bid-date fallback.
CREATE FUNCTION crm_security.import_advisory_contract_v1(p jsonb) RETURNS jsonb
LANGUAGE plpgsql SET search_path='' AS $$
DECLARE ad public.advisory_deals%rowtype; att crm_security.advisory_attribution%rowtype;
 h crm_security.contract_sales%rowtype; old_import crm_security.contract_sales_imports%rowtype;
 aid uuid; uid uuid; sid uuid; cdate date; amount bigint; cid uuid; iid uuid; eid uuid; label text;
BEGIN
 IF jsonb_typeof(p) IS DISTINCT FROM 'object' OR p->>'target_kind' IS DISTINCT FROM 'independent_advisory'
 OR p->>'contract_kind' IS DISTINCT FROM 'apartment_construction' OR p->'signed' IS DISTINCT FROM 'true'::jsonb
 OR p->>'amount_basis' IS DISTINCT FROM 'construction_vat_exclusive'
 OR p->'existing_deal_search_completed' IS DISTINCT FROM 'true'::jsonb
 OR p->'other_ledger_search_completed' IS DISTINCT FROM 'true'::jsonb
 OR p->'matching_existing_deal_ids' IS DISTINCT FROM '[]'::jsonb
 OR p->'other_matching_ledger_ids' IS DISTINCT FROM '[]'::jsonb
 OR nullif(p->>'target_deal_id','') IS NOT NULL
 THEN RAISE EXCEPTION 'VERIFIED_INDEPENDENT_EVIDENCE_REQUIRED'; END IF;
 IF EXISTS(SELECT 1 FROM unnest(array['signing_evidence','date_evidence','amount_evidence','owner_at_signing_evidence',
 'same_contract_evidence','existing_deal_search_evidence','duplicate_search_evidence','construction_contract_key',
 'source_message_url','reviewed_by','reviewed_on']) k WHERE nullif(btrim(p->>k),'') IS NULL)
 THEN RAISE EXCEPTION 'INCOMPLETE_CONTRACT_EVIDENCE'; END IF;
 aid:=(p->>'advisory_id')::uuid;
 IF aid IS NULL THEN RAISE EXCEPTION 'ADVISORY_REQUIRED'; END IF;
 -- Serialize against attribution edits and repeat imports of the same source.
 SELECT * INTO ad FROM public.advisory_deals WHERE advisory_id=aid FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'ADVISORY_NOT_FOUND'; END IF;
 SELECT * INTO att FROM crm_security.advisory_attribution WHERE advisory_id=aid FOR UPDATE;
 IF NOT FOUND OR att.decision<>'confirmed' OR att.award_type<>'bid'
 OR att.version IS DISTINCT FROM (p->>'attribution_version')::integer
 OR att.source_deal_id IS NOT NULL THEN RAISE EXCEPTION 'ATTRIBUTION_REVIEW_REQUIRED'; END IF;
 SELECT * INTO h FROM crm_security.contract_sales WHERE advisory_id=aid;
 IF FOUND THEN
  SELECT * INTO old_import FROM crm_security.contract_sales_imports WHERE contract_id=h.contract_id;
  IF old_import.evidence IS DISTINCT FROM p THEN RAISE EXCEPTION 'IMPORT_EVIDENCE_CONFLICT'; END IF;
  RETURN jsonb_build_object('ok',true,'contract_id',h.contract_id,'replayed',true);
 END IF;
 IF p->>'contract_date' IS NULL OR p->>'contract_date' !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' THEN RAISE EXCEPTION 'INVALID_CONTRACT_DATE'; END IF;
 cdate:=(p->>'contract_date')::date;
 IF cdate>(now() AT TIME ZONE 'Asia/Seoul')::date THEN RAISE EXCEPTION 'INVALID_CONTRACT_DATE'; END IF;
 IF jsonb_typeof(p->'construction_amount') IS DISTINCT FROM 'number'
 OR (p->>'construction_amount')::numeric<>trunc((p->>'construction_amount')::numeric)
 THEN RAISE EXCEPTION 'INVALID_CONTRACT_AMOUNT'; END IF;
 amount:=(p->>'construction_amount')::bigint;
 IF amount<=0 OR amount>9007199254740991 OR att.bid_amount IS DISTINCT FROM amount
 THEN RAISE EXCEPTION 'CONFIRMED_AMOUNT_CONFLICT'; END IF;
 IF att.performance_owner IS DISTINCT FROM p->>'sales_owner_name'
 OR (SELECT count(*) FROM public.users WHERE name=att.performance_owner)<>1
 THEN RAISE EXCEPTION 'VERIFIED_OWNER_REQUIRED'; END IF;
 SELECT user_id INTO uid FROM public.users WHERE name=att.performance_owner;
 sid:=coalesce(att.site_id,ad.site_id);
 SELECT site_name INTO label FROM public.sites WHERE site_id=sid FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'VERIFIED_SITE_REQUIRED'; END IF;
 -- Conservative guard: existing opportunities require exact-contract review, not auto-linking.
 IF EXISTS(SELECT 1 FROM public.deals WHERE site_id=sid) THEN RAISE EXCEPTION 'EXISTING_DEAL_REVIEW_REQUIRED'; END IF;
 IF EXISTS(SELECT 1 FROM crm_security.contract_sales WHERE construction_contract_key=p->>'construction_contract_key')
 THEN RAISE EXCEPTION 'DUPLICATE_CONSTRUCTION_CONTRACT'; END IF;
 cid:=gen_random_uuid();
 INSERT INTO crm_security.contract_sales(contract_id,deal_id,advisory_id,construction_contract_key,contract_date,
 contract_amount,sales_owner,sales_owner_name,site_snapshot,brand_snapshot,version,balance)
 VALUES(cid,NULL,aid,p->>'construction_contract_key',cdate,amount,uid,att.performance_owner,label,coalesce(att.origin_business,''),1,amount);
 INSERT INTO crm_security.contract_sales_imports(contract_id,evidence,attribution_snapshot)
 VALUES(cid,p,to_jsonb(att)) RETURNING import_id INTO iid;
 INSERT INTO crm_security.contract_sales_events(contract_id,deal_id,sequence,kind,effective_date,amount_delta,reason,actor_auth_uid,import_id)
 VALUES(cid,NULL,1,'signed',cdate,amount,'검증된 과거 아파트 공사계약 이관 · '||(p->>'construction_contract_key'),NULL,iid)
 RETURNING event_id INTO eid;
 RETURN jsonb_build_object('ok',true,'contract_id',cid,'event_id',eid,'import_id',iid,'replayed',false);
END $$;
REVOKE ALL ON FUNCTION crm_security.import_advisory_contract_v1(jsonb) FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION public.crm_contract_sales_read_v2(p_cursor uuid DEFAULT NULL,p_limit integer DEFAULT 200) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE a record; result jsonb; lim integer:=greatest(1,least(coalesce(p_limit,200),500));
BEGIN
 SELECT * INTO a FROM crm_security.actor();
 IF a.user_id IS NULL THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;
 WITH eligible AS (
  SELECT h.* FROM crm_security.contract_sales h
  WHERE (h.sales_owner=a.user_id OR (h.deal_id IS NOT NULL AND crm_security.can_deal(h.deal_id,false))
   OR (h.advisory_id IS NOT NULL AND a.permission_role='admin'))
  AND (p_cursor IS NULL OR h.contract_id>p_cursor)
  ORDER BY h.contract_id LIMIT lim+1
 ), page AS (SELECT * FROM eligible ORDER BY contract_id LIMIT lim), items AS (
  SELECT h.contract_id,jsonb_build_object('contract_id',h.contract_id,'deal_id',h.deal_id,'advisory_id',h.advisory_id,
   'contract_signed',true,'contract_date',h.contract_date,'contract_amount',h.contract_amount,
   'sales_owner',h.sales_owner,'sales_owner_name',h.sales_owner_name,'site',h.site_snapshot,'brand',h.brand_snapshot,
   'version',h.version,'cancelled',h.cancelled,'balance',h.balance,
   'events',(SELECT jsonb_agg(jsonb_build_object('policy','contract-signed-event-v1','contract_id',e.contract_id,
    'deal_id',e.deal_id,'event_id',e.event_id,'sequence',e.sequence,'kind',e.kind,
    'effective_date',e.effective_date,'amount_delta',e.amount_delta,'sales_owner',h.sales_owner,
    'sales_owner_name',h.sales_owner_name,'reason',e.reason,'recorded_at',e.recorded_at) ORDER BY e.sequence)
    FROM crm_security.contract_sales_events e WHERE e.contract_id=h.contract_id)) item FROM page h
 ) SELECT jsonb_build_object('ok',true,'policy','contract-signed-event-v1','items',
 coalesce((SELECT jsonb_agg(item ORDER BY contract_id) FROM items),'[]'::jsonb),
 'has_more',(SELECT count(*)>lim FROM eligible),'next_cursor',(SELECT contract_id FROM page ORDER BY contract_id DESC LIMIT 1)) INTO result;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.crm_contract_sales_read_v2(uuid,integer) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.crm_contract_sales_read_v2(uuid,integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.crm_contract_sales_write_v1(p jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE a record; d record; h crm_security.contract_sales%rowtype; receipt record;
 target uuid; req uuid; k text; at_date date; delta bigint; owner_uid uuid; owner_name text;
 seq integer; event_uid uuid; result jsonb; site_label text;
BEGIN
 SELECT * INTO a FROM crm_security.actor();
 IF a.user_id IS NULL THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;
 IF jsonb_typeof(p)<>'object' OR EXISTS(SELECT 1 FROM jsonb_object_keys(p) x WHERE x NOT IN('deal_id','request_id','kind','effective_date','amount_delta','expected_version','reason')) THEN
  RAISE EXCEPTION 'invalid contract request'; END IF;
 target:=(p->>'deal_id')::uuid; req:=(p->>'request_id')::uuid; k:=p->>'kind';
 IF target IS NULL OR req IS NULL OR NOT crm_security.can_deal(target,true) THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(a.auth_uid::text||req::text,0));
 SELECT * INTO receipt FROM crm_security.contract_sales_receipts WHERE actor_auth_uid=a.auth_uid AND request_id=req;
 IF FOUND THEN
  IF receipt.request IS DISTINCT FROM p THEN RAISE EXCEPTION 'REQUEST_ID_REUSE'; END IF;
  RETURN receipt.ack||'{"replayed":true}'::jsonb;
 END IF;
 SELECT x.* INTO d FROM public.deals x WHERE x.id=target FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'deal not found'; END IF;
 SELECT * INTO h FROM crm_security.contract_sales WHERE deal_id=target FOR UPDATE;
 IF jsonb_typeof(p->'expected_version') IS DISTINCT FROM 'number' OR (p->>'expected_version')::numeric<>coalesce(h.version,0) THEN RAISE EXCEPTION 'CONTRACT_VERSION_CONFLICT'; END IF;
 IF (p->>'effective_date') IS NULL OR (p->>'effective_date')!~'^\d{4}-\d{2}-\d{2}$' THEN RAISE EXCEPTION 'INVALID_CONTRACT_DATE'; END IF;
 at_date:=(p->>'effective_date')::date;
 IF at_date>(now() AT TIME ZONE 'Asia/Seoul')::date THEN RAISE EXCEPTION 'contract event is in future'; END IF;
 IF nullif(btrim(p->>'reason'),'') IS NULL OR length(p->>'reason')>8000 THEN RAISE EXCEPTION 'contract evidence or reason required'; END IF;
 IF k='signed' THEN
  IF h.deal_id IS NOT NULL THEN RAISE EXCEPTION 'CONTRACT_ALREADY_SIGNED'; END IF;
  owner_uid:=d.owner_id;
  SELECT u.name INTO owner_name FROM public.users u WHERE u.user_id=owner_uid AND u.active;
  IF owner_name IS NULL THEN RAISE EXCEPTION 'verified sales owner required'; END IF;
 ELSIF k IN('amended','cancelled') THEN
  IF h.deal_id IS NULL OR h.cancelled THEN RAISE EXCEPTION 'contract missing or cancelled'; END IF;
  IF at_date<(SELECT max(effective_date) FROM crm_security.contract_sales_events WHERE deal_id=target) THEN RAISE EXCEPTION 'event date precedes existing history'; END IF;
 ELSE RAISE EXCEPTION 'invalid contract event kind'; END IF;
 IF k='cancelled' THEN
  IF p ? 'amount_delta' THEN RAISE EXCEPTION 'cancellation amount is server calculated'; END IF;
  delta:=-h.balance;
 ELSE
  IF jsonb_typeof(p->'amount_delta') IS DISTINCT FROM 'number' OR (p->>'amount_delta')::numeric<>trunc((p->>'amount_delta')::numeric) THEN RAISE EXCEPTION 'integer amount required'; END IF;
  delta:=(p->>'amount_delta')::bigint;
  IF delta=0 OR abs(delta::numeric)>9007199254740991 OR (k='signed' AND delta<0) OR (k='amended' AND h.balance::numeric+delta NOT BETWEEN 1 AND 9007199254740991) THEN RAISE EXCEPTION 'invalid contract amount'; END IF;
 END IF;
 seq:=coalesce(h.version,0)+1;
 IF k='signed' THEN
  SELECT coalesce(s.site_name,o.name,nullif(x.list_fields->>'site_name',''),nullif(x.list_fields->>'name',''),'') INTO site_label
  FROM public.deals x LEFT JOIN public.sites s ON s.site_id=x.site_id LEFT JOIN public.organizations o ON o.id=x.organization_id WHERE x.id=target;
  INSERT INTO crm_security.contract_sales(deal_id,contract_signed,contract_date,contract_amount,sales_owner,sales_owner_name,site_snapshot,brand_snapshot,version,balance,cancelled) VALUES(target,true,at_date,delta,owner_uid,owner_name,site_label,coalesce(d.brand,''),seq,delta,false);
 ELSE
  UPDATE crm_security.contract_sales SET version=seq,balance=balance+delta,cancelled=k='cancelled' WHERE deal_id=target;
 END IF;
 INSERT INTO crm_security.contract_sales_events(deal_id,sequence,kind,effective_date,amount_delta,reason,actor_auth_uid)
 VALUES(target,seq,k,at_date,delta,p->>'reason',a.auth_uid) RETURNING event_id INTO event_uid;
 result:=jsonb_build_object('ok',true,'policy','contract-signed-event-v1','deal_id',target,'event_id',event_uid,'version',seq,'kind',k,'amount_delta',delta);
 INSERT INTO crm_security.contract_sales_receipts VALUES(a.auth_uid,req,p,result);
 RETURN result;
END $function$
;
CREATE OR REPLACE FUNCTION public.crm_contract_sales_read_v1(p_cursor uuid DEFAULT NULL::uuid, p_limit integer DEFAULT 200)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE a record; result jsonb; lim integer:=greatest(1,least(coalesce(p_limit,200),500));
BEGIN
 SELECT * INTO a FROM crm_security.actor();
 IF a.user_id IS NULL THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;
 WITH eligible AS (
  SELECT h.* FROM crm_security.contract_sales h
  WHERE h.deal_id IS NOT NULL AND (h.sales_owner=a.user_id OR crm_security.can_deal(h.deal_id,false)) AND (p_cursor IS NULL OR h.deal_id>p_cursor)
  ORDER BY h.deal_id LIMIT lim+1
 ), page AS (SELECT * FROM eligible ORDER BY deal_id LIMIT lim), items AS (
  SELECT h.deal_id,jsonb_build_object('deal_id',h.deal_id,'contract_signed',true,'contract_date',h.contract_date,'contract_amount',h.contract_amount,
   'sales_owner',h.sales_owner,'sales_owner_name',h.sales_owner_name,'site',h.site_snapshot,'brand',h.brand_snapshot,'version',h.version,'cancelled',h.cancelled,'balance',h.balance,
   'events',(SELECT jsonb_agg(jsonb_build_object('policy','contract-signed-event-v1','deal_id',e.deal_id,'event_id',e.event_id,'sequence',e.sequence,'kind',e.kind,
    'effective_date',e.effective_date,'amount_delta',e.amount_delta,'sales_owner',h.sales_owner,'sales_owner_name',h.sales_owner_name,'reason',e.reason,'recorded_at',e.recorded_at) ORDER BY e.sequence)
    FROM crm_security.contract_sales_events e WHERE e.deal_id=h.deal_id)) item FROM page h
 ) SELECT jsonb_build_object('ok',true,'policy','contract-signed-event-v1','items',coalesce((SELECT jsonb_agg(item ORDER BY deal_id) FROM items),'[]'::jsonb),
  'has_more',(SELECT count(*)>lim FROM eligible),'next_cursor',(SELECT deal_id FROM page ORDER BY deal_id DESC LIMIT 1)) INTO result;
 RETURN result;
END $function$
;

-- Signed amendments and cancellation retain original date, amount and attribution.
CREATE FUNCTION public.crm_contract_sales_adjust_v2(p jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE a record; h crm_security.contract_sales%rowtype; receipt record;
 cid uuid; req uuid; k text; dt date; delta bigint; eid uuid; result jsonb;
BEGIN
 SELECT * INTO a FROM crm_security.actor();
 IF a.user_id IS NULL THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;
 IF jsonb_typeof(p) IS DISTINCT FROM 'object' OR EXISTS(SELECT 1 FROM jsonb_object_keys(p) request_key
 WHERE request_key NOT IN('contract_id','request_id','kind','effective_date','amount_delta','expected_version','reason'))
 THEN RAISE EXCEPTION 'invalid contract request'; END IF;
 cid:=(p->>'contract_id')::uuid;req:=(p->>'request_id')::uuid;k:=p->>'kind';
 IF cid IS NULL OR req IS NULL THEN RAISE EXCEPTION 'invalid contract request'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(a.auth_uid::text||req::text,0));
 SELECT * INTO h FROM crm_security.contract_sales WHERE contract_id=cid FOR UPDATE;
 IF NOT FOUND OR (h.advisory_id IS NOT NULL AND a.permission_role<>'admin')
 OR (h.deal_id IS NOT NULL AND NOT crm_security.can_deal(h.deal_id,true))
 THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;
 SELECT * INTO receipt FROM crm_security.contract_sales_receipts WHERE actor_auth_uid=a.auth_uid AND request_id=req;
 IF FOUND THEN
  IF receipt.request IS DISTINCT FROM p THEN RAISE EXCEPTION 'REQUEST_ID_REUSE'; END IF;
  RETURN receipt.ack||'{"replayed":true}'::jsonb;
 END IF;
 IF jsonb_typeof(p->'expected_version') IS DISTINCT FROM 'number' OR (p->>'expected_version')::numeric<>h.version
 THEN RAISE EXCEPTION 'CONTRACT_VERSION_CONFLICT'; END IF;
 IF h.cancelled THEN RAISE EXCEPTION 'contract already cancelled'; END IF;
 IF p->>'effective_date' IS NULL OR p->>'effective_date' !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
 THEN RAISE EXCEPTION 'INVALID_CONTRACT_DATE'; END IF;
 dt:=(p->>'effective_date')::date;
 IF dt>(now() AT TIME ZONE 'Asia/Seoul')::date
 OR dt<(SELECT max(effective_date) FROM crm_security.contract_sales_events WHERE contract_id=cid)
 THEN RAISE EXCEPTION 'INVALID_CONTRACT_DATE'; END IF;
 IF nullif(btrim(p->>'reason'),'') IS NULL OR length(p->>'reason')>8000 THEN RAISE EXCEPTION 'contract evidence or reason required'; END IF;
 IF k='cancelled' THEN
  IF p ? 'amount_delta' THEN RAISE EXCEPTION 'cancellation amount is server calculated'; END IF;
  delta:=-h.balance;
 ELSIF k='amended' THEN
  IF jsonb_typeof(p->'amount_delta') IS DISTINCT FROM 'number'
  OR (p->>'amount_delta')::numeric<>trunc((p->>'amount_delta')::numeric) THEN RAISE EXCEPTION 'integer amount required'; END IF;
  delta:=(p->>'amount_delta')::bigint;
  IF delta=0 OR abs(delta::numeric)>9007199254740991 OR h.balance::numeric+delta NOT BETWEEN 1 AND 9007199254740991
  THEN RAISE EXCEPTION 'invalid contract amount'; END IF;
 ELSE RAISE EXCEPTION 'invalid adjustment kind'; END IF;
 UPDATE crm_security.contract_sales SET version=version+1,balance=balance+delta,cancelled=k='cancelled' WHERE contract_id=cid;
 INSERT INTO crm_security.contract_sales_events(contract_id,deal_id,sequence,kind,effective_date,amount_delta,reason,actor_auth_uid)
 VALUES(cid,h.deal_id,h.version+1,k,dt,delta,p->>'reason',a.auth_uid) RETURNING event_id INTO eid;
 result:=jsonb_build_object('ok',true,'policy','contract-signed-event-v1','contract_id',cid,'deal_id',h.deal_id,
 'event_id',eid,'version',h.version+1,'kind',k,'amount_delta',delta);
 INSERT INTO crm_security.contract_sales_receipts VALUES(a.auth_uid,req,p,result);
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.crm_contract_sales_adjust_v2(jsonb) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.crm_contract_sales_adjust_v2(jsonb) TO authenticated;

COMMIT;
