-- EXACT GENERATED FIXTURE RESIDUAL VERIFICATION. READ ONLY.
BEGIN TRANSACTION READ ONLY;
SET LOCAL search_path = pg_catalog;
SET LOCAL statement_timeout = '30s';
WITH residue(table_name,row_count) AS (
 SELECT 'public.deals',count(*) FROM public.deals WHERE id IN (
  '383d827a-e481-44c9-ad2e-22c50cc80181'::uuid,'5f4abbf5-52a8-466a-878b-f2d81a98c51f'::uuid,'9c2530cb-71db-4135-8ccf-664897e5ce9d'::uuid)
 UNION ALL SELECT 'public.activities',count(*) FROM public.activities WHERE id IN (
  '0a4d6233-d917-4ecf-ad26-b45baab3c71c'::uuid,'497f1a02-dcce-461a-9f17-0e43ee66463e'::uuid,'a9f3c4fc-0b2c-4cd5-b451-2f27602ce2ee'::uuid)
 UNION ALL SELECT 'crm_security.audit_events',count(*) FROM crm_security.audit_events WHERE event_id IN (
  '6322d867-48bd-4efa-a224-4a3dea53ed34'::uuid,'8ea43025-7865-43dd-b4a9-1685920a73d7'::uuid,
  'ab659eea-967c-4bf1-8155-c53c977a1cf6'::uuid,'b79848e4-bc55-44ad-a87b-e474cd07a53e'::uuid)
 UNION ALL SELECT 'crm_security.object_scope',count(*) FROM crm_security.object_scope WHERE scope_id IN (
  'a38614e6-e8da-484c-a05d-ee97ccc43708'::uuid,'72127a30-90e0-4fd2-bc87-8abeff014bae'::uuid)
 UNION ALL SELECT 'public.contact_assignments',count(*) FROM public.contact_assignments WHERE id='a93eb161-9c82-4330-b873-ce98fd918628'::uuid
 UNION ALL SELECT 'public.contacts',count(*) FROM public.contacts WHERE id='79de1cc9-4934-4e96-90c3-3e0c6fbe35d2'::uuid
 UNION ALL SELECT 'public.sites',count(*) FROM public.sites WHERE site_id='e2594dc8-3f78-4758-be2d-ee0f906fb910'::uuid
), facts AS (
 SELECT
  (SELECT coalesce(sum(row_count),0) FROM residue) AS residue_rows,
  (SELECT count(*) FROM public.deals) AS canonical_deals,
  (SELECT md5(coalesce(string_agg(to_jsonb(d)::text,'|' ORDER BY d.id),'')) FROM public.deals d) AS canonical_deals_md5,
  (SELECT count(*) FROM public.inquiries) AS canonical_inquiries,
  (SELECT md5(coalesce(string_agg(to_jsonb(i)::text,'|' ORDER BY i.id),'')) FROM public.inquiries i) AS canonical_inquiries_md5
)
SELECT jsonb_build_object(
 'project_ref','rprechiaglyjaydkmxsu',
 'status',CASE WHEN residue_rows=0 AND canonical_deals=5
   AND canonical_deals_md5='30b2067a1a74de986aa33a36b9c0942b'
   AND canonical_inquiries=5 AND canonical_inquiries_md5='d15e22087063729eedf6e5211d4ff327'
   THEN 'PASS' ELSE 'FAIL' END,
 'table_counts',(SELECT jsonb_object_agg(table_name,row_count ORDER BY table_name) FROM residue),
 'generated_residual_rows_remaining',residue_rows,
 'canonical_deals',canonical_deals,
 'canonical_deals_md5',canonical_deals_md5,
 'canonical_inquiries',canonical_inquiries,
 'canonical_inquiries_md5',canonical_inquiries_md5,
 'transaction_mode','READ ONLY',
 'production_requests',0,
 'n8n_requests',0
) AS cleanup_verification FROM facts;
ROLLBACK;
