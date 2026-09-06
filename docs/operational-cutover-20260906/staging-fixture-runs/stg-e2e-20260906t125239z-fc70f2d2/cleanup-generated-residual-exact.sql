-- EXACT GENERATED FIXTURE RESIDUAL CLEANUP. STAGING ONLY.
-- Project: netform-crm-staging / rprechiaglyjaydkmxsu
-- Deletes exactly 15 TEST/E2E rows missed because three Deal UUIDs were server-generated.
BEGIN;
SET LOCAL search_path = pg_catalog;
SET LOCAL statement_timeout = '30s';

DO $preflight$
DECLARE n bigint;
BEGIN
  SELECT count(*) INTO n FROM public.deals
  WHERE (id='383d827a-e481-44c9-ad2e-22c50cc80181'::uuid AND list_fields->>'client_ref'='e2e-stg-e2e-20260906t125239z-fc70f2d2')
     OR (id='5f4abbf5-52a8-466a-878b-f2d81a98c51f'::uuid AND list_fields->>'client_ref'='local-tech-stg-e2e-20260906t125239z-fc70f2d2')
     OR (id='9c2530cb-71db-4135-8ccf-664897e5ce9d'::uuid AND list_fields->>'client_ref'='pc-stg-e2e-20260906t125239z-fc70f2d2');
  IF n<>3 THEN RAISE EXCEPTION 'generated Deal preflight mismatch: %',n; END IF;

  SELECT count(*) INTO n FROM public.activities WHERE id IN (
    '0a4d6233-d917-4ecf-ad26-b45baab3c71c'::uuid,'497f1a02-dcce-461a-9f17-0e43ee66463e'::uuid,'a9f3c4fc-0b2c-4cd5-b451-2f27602ce2ee'::uuid);
  IF n<>3 THEN RAISE EXCEPTION 'activity preflight mismatch: %',n; END IF;

  SELECT count(*) INTO n FROM crm_security.audit_events WHERE event_id IN (
    '6322d867-48bd-4efa-a224-4a3dea53ed34'::uuid,'8ea43025-7865-43dd-b4a9-1685920a73d7'::uuid,
    'ab659eea-967c-4bf1-8155-c53c977a1cf6'::uuid,'b79848e4-bc55-44ad-a87b-e474cd07a53e'::uuid);
  IF n<>4 THEN RAISE EXCEPTION 'audit preflight mismatch: %',n; END IF;

  SELECT count(*) INTO n FROM crm_security.object_scope WHERE scope_id IN (
    'a38614e6-e8da-484c-a05d-ee97ccc43708'::uuid,'72127a30-90e0-4fd2-bc87-8abeff014bae'::uuid);
  IF n<>2 THEN RAISE EXCEPTION 'scope preflight mismatch: %',n; END IF;

  SELECT count(*) INTO n FROM public.contact_assignments
  WHERE id='a93eb161-9c82-4330-b873-ce98fd918628'::uuid
    AND opportunity_id='9c2530cb-71db-4135-8ccf-664897e5ce9d'::uuid
    AND person_key='mobile:01012345678';
  IF n<>1 THEN RAISE EXCEPTION 'contact assignment preflight mismatch: %',n; END IF;

  SELECT count(*) INTO n FROM public.contacts
  WHERE id='79de1cc9-4934-4e96-90c3-3e0c6fbe35d2'::uuid
    AND name='테스트 관리소장' AND person_key='mobile:01012345678';
  IF n<>1 THEN RAISE EXCEPTION 'contact preflight mismatch: %',n; END IF;

  SELECT count(*) INTO n FROM public.sites
  WHERE site_id='e2594dc8-3f78-4758-be2d-ee0f906fb910'::uuid
    AND site_name='E2E 신규 기회' AND address='테스트 주소';
  IF n<>1 THEN RAISE EXCEPTION 'site preflight mismatch: %',n; END IF;
END $preflight$;

DELETE FROM crm_security.audit_events WHERE event_id IN (
  '6322d867-48bd-4efa-a224-4a3dea53ed34'::uuid,'8ea43025-7865-43dd-b4a9-1685920a73d7'::uuid,
  'ab659eea-967c-4bf1-8155-c53c977a1cf6'::uuid,'b79848e4-bc55-44ad-a87b-e474cd07a53e'::uuid);
DELETE FROM crm_security.object_scope WHERE scope_id IN (
  'a38614e6-e8da-484c-a05d-ee97ccc43708'::uuid,'72127a30-90e0-4fd2-bc87-8abeff014bae'::uuid);
DELETE FROM public.contact_assignments WHERE id='a93eb161-9c82-4330-b873-ce98fd918628'::uuid;
DELETE FROM public.activities WHERE id IN (
  '0a4d6233-d917-4ecf-ad26-b45baab3c71c'::uuid,'497f1a02-dcce-461a-9f17-0e43ee66463e'::uuid,'a9f3c4fc-0b2c-4cd5-b451-2f27602ce2ee'::uuid);
DELETE FROM public.deals WHERE id IN (
  '383d827a-e481-44c9-ad2e-22c50cc80181'::uuid,'5f4abbf5-52a8-466a-878b-f2d81a98c51f'::uuid,'9c2530cb-71db-4135-8ccf-664897e5ce9d'::uuid);
DELETE FROM public.contacts WHERE id='79de1cc9-4934-4e96-90c3-3e0c6fbe35d2'::uuid;
DELETE FROM public.sites WHERE site_id='e2594dc8-3f78-4758-be2d-ee0f906fb910'::uuid;

DO $verify$
DECLARE n bigint; deal_hash text; inquiry_hash text;
BEGIN
  SELECT count(*) INTO n FROM public.deals WHERE id IN (
    '383d827a-e481-44c9-ad2e-22c50cc80181'::uuid,'5f4abbf5-52a8-466a-878b-f2d81a98c51f'::uuid,'9c2530cb-71db-4135-8ccf-664897e5ce9d'::uuid);
  IF n<>0 THEN RAISE EXCEPTION 'generated Deal residue remains: %',n; END IF;
  IF EXISTS (SELECT 1 FROM public.contacts WHERE id='79de1cc9-4934-4e96-90c3-3e0c6fbe35d2'::uuid)
     OR EXISTS (SELECT 1 FROM public.sites WHERE site_id='e2594dc8-3f78-4758-be2d-ee0f906fb910'::uuid)
  THEN RAISE EXCEPTION 'generated contact/site residue remains'; END IF;
  SELECT md5(coalesce(string_agg(to_jsonb(d)::text,'|' ORDER BY d.id),'')) INTO deal_hash FROM public.deals d;
  SELECT md5(coalesce(string_agg(to_jsonb(i)::text,'|' ORDER BY i.id),'')) INTO inquiry_hash FROM public.inquiries i;
  IF (SELECT count(*) FROM public.deals)<>5 OR deal_hash<>'30b2067a1a74de986aa33a36b9c0942b'
     OR (SELECT count(*) FROM public.inquiries)<>5 OR inquiry_hash<>'d15e22087063729eedf6e5211d4ff327'
  THEN RAISE EXCEPTION 'canonical baseline mismatch after exact residual cleanup'; END IF;
END $verify$;

SELECT jsonb_build_object(
  'status','PASS','deleted_exact_rows',15,'canonical_deals',5,'canonical_inquiries',5,
  'production_requests',0,'n8n_requests',0
) AS cleanup_result;
COMMIT;
