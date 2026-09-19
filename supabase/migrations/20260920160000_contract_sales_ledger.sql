-- CRM sales recognition, distinct from accounting revenue and construction completion.
-- No historical backfill: a current owner/closed date is not signing evidence.
BEGIN;
CREATE TABLE crm_security.contract_sales (
 deal_id uuid PRIMARY KEY REFERENCES public.deals(id),
 contract_signed boolean NOT NULL DEFAULT true CHECK(contract_signed),
 contract_date date NOT NULL,
 contract_amount bigint NOT NULL CHECK(contract_amount>0 AND contract_amount<=9007199254740991),
 sales_owner uuid NOT NULL REFERENCES public.users(user_id),
 sales_owner_name text NOT NULL,
 site_snapshot text NOT NULL, brand_snapshot text NOT NULL,
 version integer NOT NULL CHECK(version>0),
 balance bigint NOT NULL CHECK(balance>=0 AND balance<=9007199254740991),
 cancelled boolean NOT NULL DEFAULT false
);
CREATE TABLE crm_security.contract_sales_events (
 event_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 deal_id uuid NOT NULL REFERENCES crm_security.contract_sales(deal_id),
 sequence integer NOT NULL CHECK(sequence>0),
 kind text NOT NULL CHECK(kind IN('signed','amended','cancelled')),
 effective_date date NOT NULL,
 amount_delta bigint NOT NULL CHECK(amount_delta BETWEEN -9007199254740991 AND 9007199254740991),
 reason text NOT NULL CHECK(length(reason)<=8000),
 actor_auth_uid uuid NOT NULL,
 recorded_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(deal_id,sequence)
);
CREATE TABLE crm_security.contract_sales_receipts (
 actor_auth_uid uuid NOT NULL, request_id uuid NOT NULL,
 request jsonb NOT NULL, ack jsonb NOT NULL,
 PRIMARY KEY(actor_auth_uid,request_id)
);
ALTER TABLE crm_security.contract_sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_security.contract_sales_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_security.contract_sales_receipts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON crm_security.contract_sales,crm_security.contract_sales_events,crm_security.contract_sales_receipts FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION public.crm_contract_sales_write_v1(p jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE a record; d record; h crm_security.contract_sales%rowtype; receipt record;
 target uuid; req uuid; k text; at_date date; delta bigint; owner_uid uuid; owner_name text;
 seq integer; event_uid uuid; result jsonb;
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
  INSERT INTO crm_security.contract_sales VALUES(target,true,at_date,delta,owner_uid,owner_name,coalesce(d.site,''),coalesce(d.brand,''),seq,delta,false);
 ELSE
  UPDATE crm_security.contract_sales SET version=seq,balance=balance+delta,cancelled=k='cancelled' WHERE deal_id=target;
 END IF;
 INSERT INTO crm_security.contract_sales_events(deal_id,sequence,kind,effective_date,amount_delta,reason,actor_auth_uid)
 VALUES(target,seq,k,at_date,delta,p->>'reason',a.auth_uid) RETURNING event_id INTO event_uid;
 result:=jsonb_build_object('ok',true,'policy','contract-signed-event-v1','deal_id',target,'event_id',event_uid,'version',seq,'kind',k,'amount_delta',delta);
 INSERT INTO crm_security.contract_sales_receipts VALUES(a.auth_uid,req,p,result);
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.crm_contract_sales_write_v1(jsonb) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.crm_contract_sales_write_v1(jsonb) TO authenticated;

CREATE FUNCTION public.crm_contract_sales_read_v1(p_cursor uuid DEFAULT NULL,p_limit integer DEFAULT 200) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE a record; result jsonb; lim integer:=greatest(1,least(coalesce(p_limit,200),500));
BEGIN
 SELECT * INTO a FROM crm_security.actor();
 IF a.user_id IS NULL THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;
 WITH eligible AS (
  SELECT h.* FROM crm_security.contract_sales h
  WHERE (h.sales_owner=a.user_id OR crm_security.can_deal(h.deal_id,false)) AND (p_cursor IS NULL OR h.deal_id>p_cursor)
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
END $$;
REVOKE ALL ON FUNCTION public.crm_contract_sales_read_v1(uuid,integer) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.crm_contract_sales_read_v1(uuid,integer) TO authenticated;

-- The existing stage-transition command updates stage_contexts in its transaction.
-- Record signing in that SAME transaction; completion never creates another sale.
CREATE FUNCTION crm_security.capture_contract_signing() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE f jsonb; h crm_security.contract_sales%rowtype;
BEGIN
 f:=NEW.stage_contexts->'contract'->'fields';
 IF f->>'contract_status' IS DISTINCT FROM '체결 완료' OR
    f IS NOT DISTINCT FROM (OLD.stage_contexts->'contract'->'fields') THEN RETURN NEW; END IF;
 SELECT * INTO h FROM crm_security.contract_sales WHERE deal_id=NEW.id;
 IF FOUND THEN
  IF h.cancelled OR h.contract_date IS DISTINCT FROM (f->>'contract_date')::date OR h.contract_amount IS DISTINCT FROM (f->>'contract_amount')::bigint THEN
   RAISE EXCEPTION 'use contract amendment history; original signing cannot be overwritten';
  END IF;
 ELSE
  PERFORM public.crm_contract_sales_write_v1(jsonb_build_object('deal_id',NEW.id,'request_id',gen_random_uuid(),'kind','signed',
   'effective_date',f->>'contract_date','amount_delta',f->'contract_amount','expected_version',0,'reason','계약 단계 전환에서 체결 완료 확인'));
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION crm_security.capture_contract_signing() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER capture_contract_signing AFTER UPDATE OF stage_contexts ON public.deals
FOR EACH ROW EXECUTE FUNCTION crm_security.capture_contract_signing();
COMMIT;
