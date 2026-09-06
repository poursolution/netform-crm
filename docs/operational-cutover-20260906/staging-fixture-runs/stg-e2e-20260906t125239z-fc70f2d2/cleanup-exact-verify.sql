-- EXACT DISPOSABLE FIXTURE CLEANUP VERIFICATION. READ ONLY.
-- Project: netform-crm-staging / rprechiaglyjaydkmxsu
-- Run: stg-e2e-20260906t125239z-fc70f2d2
-- Run only after exact Storage removal, temporary policy rollback and cleanup-exact.sql.
BEGIN TRANSACTION READ ONLY;
SET LOCAL search_path = pg_catalog;
SET LOCAL statement_timeout = '30s';
WITH fixture_ids(kind,id) AS (VALUES
  ('inquiry', 'ccfc33db-fc51-4e13-9111-891313a499f1'::uuid),
  ('inquiry', '2b9bce22-914d-4cd0-bedc-ea9722f42616'::uuid),
  ('inquiry', 'b79fb6e0-3908-485b-9537-aa2fc882d223'::uuid),
  ('inquiry', 'd70aa910-a33e-47fd-a507-252c7a6be328'::uuid),
  ('inquiry', '41d2e79e-7b4f-4590-95c9-f671f6f99c8e'::uuid),
  ('inquiry', 'd965c2af-7481-48dd-b5e5-317f9ce2c034'::uuid),
  ('inquiry', '4313599b-d2ee-4596-8b92-bd8b1c9b8749'::uuid),
  ('inquiry', 'a689d826-f218-4d7c-b70f-94cf61f72123'::uuid),
  ('inquiry', 'a5335f1c-14be-42b3-a57d-ed207351bc93'::uuid),
  ('inquiry', '91854d17-e918-4af6-a4a6-56a41c130b24'::uuid),
  ('inquiry', '31dd3be3-3669-442b-853d-1940e3833742'::uuid),
  ('deal', '5bb70f48-a50c-4e61-8dc7-3d31f6f67662'::uuid),
  ('inquiry', '6acccf98-4386-4ced-82e5-342a944c5ffa'::uuid),
  ('inquiry', '4f072f1e-b5c3-44fc-b6d3-20d1ff577610'::uuid),
  ('inquiry', '2019fc9c-eb09-49ff-83ab-585c05c0d8d1'::uuid),
  ('inquiry', '83431ea5-a506-40e9-b2ef-ae11985de0c7'::uuid),
  ('deal', '11f1f9ea-a9f0-4a43-9773-268e0db227aa'::uuid),
  ('deal', '1099e4b4-c32b-4ccf-89ef-8012a6be7299'::uuid),
  ('deal', 'c13bd255-2f95-49ea-ae7c-99906d7ff95d'::uuid),
  ('deal', '66293c72-b8f2-4c47-9bb8-f5da0bb4e856'::uuid),
  ('deal', '959e82c5-2f86-4690-a0b6-2549010bc5c3'::uuid),
  ('deal', '6b2a3525-6ffd-4547-abb7-18dbec119fc5'::uuid),
  ('deal', '915bc4b8-68b4-4a65-bd4c-29625c2b34fc'::uuid),
  ('deal', '69cc37b7-78ef-429a-83a3-0d2096d43ed3'::uuid),
  ('deal', '58121fd2-a84a-4d28-939d-b0b8c9eec3b0'::uuid),
  ('inquiry', 'a609fc20-cbc5-4fcc-a704-492234f10084'::uuid),
  ('inquiry', 'a38d1a16-e20d-45fd-9776-1d8f594970cb'::uuid),
  ('deal', 'faf4ecd1-6f5c-4d88-8371-47864de7b4d5'::uuid),
  ('deal', '8511166f-63a0-459f-bab1-6bd39eaa9b3d'::uuid),
  ('deal', '525cd3ef-e1dc-4063-8bd7-fc516f82d5c3'::uuid),
  ('deal', 'c22ff98e-ccbd-47f7-9ef6-ac4ac5c3680e'::uuid),
  ('deal', '5edce355-4bb6-4ca2-8891-7d3e8a77d8e8'::uuid),
  ('deal', 'a4b44ec2-daff-49fb-86e2-f82ace1efe14'::uuid),
  ('deal', 'b4535768-98bb-4ca5-9e41-4e154b31286a'::uuid),
  ('deal', '431d2489-6e72-44c3-a8d4-41e95d0f0804'::uuid),
  ('deal', 'a259455f-7a3f-4dfb-bd42-317d97db68ac'::uuid),
  ('deal', 'e0c191b0-f077-4e5e-a117-2046ecf24ef3'::uuid),
  ('deal', 'b813e370-6d00-4bc9-b0f6-9ddff7f2b160'::uuid),
  ('deal', '4f7c8107-6962-4159-add4-e576aef838be'::uuid),
  ('inquiry', '19bfd7d5-0814-46cb-a4c9-bdb988c21c6c'::uuid),
  ('deal', '808201e1-30d9-40b9-b287-34ba7c0c9094'::uuid)
), fixture_requests(id) AS (VALUES
  ('f5e6ab81-2b64-4b2f-8f1f-db5cf0972bf6'::uuid),
  ('29a372c0-ba6f-48ba-bcdf-ce90f92dbfa3'::uuid),
  ('9173bad1-60a7-4165-a9f9-af1111ea3a84'::uuid),
  ('e5ce34c9-8aa4-43d7-9036-6aa5d9345273'::uuid),
  ('5c53fb10-dc6c-4cee-9857-def0dbd8f556'::uuid),
  ('77c9a480-43d6-4b17-9042-a67fe5340e1c'::uuid),
  ('29c5eec7-c6e7-4954-98b5-cef215a2e495'::uuid),
  ('d816b97b-915a-465d-adf3-80659268c107'::uuid),
  ('7ca74f27-3c84-4c1e-ad57-48285f15c6b6'::uuid),
  ('47fb009d-68c0-4732-a151-e13103684775'::uuid),
  ('48191e74-ac31-460d-ac30-d0a5b1ddec6f'::uuid),
  ('9a9de620-8bcc-4b6b-b467-378526541d10'::uuid),
  ('793147ee-876c-4331-99c4-6088df0daa8e'::uuid),
  ('4628b8f1-72dc-434d-a200-8886d039a1fa'::uuid),
  ('700a6d86-488f-483f-a6d4-b609c965d804'::uuid),
  ('db17047f-6bd5-4278-bb18-819ebab43a04'::uuid),
  ('d6ad7943-69d5-41c1-a80c-340bd4fd4bf9'::uuid),
  ('0e9a4b99-c258-4454-8364-57cc9b3a11b2'::uuid),
  ('bd119767-4907-4548-80ac-68852c237e96'::uuid),
  ('e4f71381-79d6-4689-9a4e-a197e28c5a44'::uuid),
  ('13ce1da8-c979-4d9f-85ab-ddafe9937c8d'::uuid),
  ('9cee27ee-3440-4386-81ce-8d3a6bfa3771'::uuid),
  ('563ee87d-6fea-4b8e-afcf-9f966b6b0acf'::uuid),
  ('aa229fe4-56c3-4197-b7f6-cc709814df31'::uuid),
  ('7384f3fc-2f04-41d7-b292-0bd501f03f50'::uuid),
  ('0a1118be-f591-4d58-ab39-9dd63b30879a'::uuid),
  ('d4b2d2a7-4046-4df6-b1f7-3e4366135114'::uuid),
  ('0fc6ef36-b61f-4d0d-808d-367ce28e6f3b'::uuid),
  ('8c38c1de-3044-499f-aa92-5ab4a28e041a'::uuid),
  ('32f96aab-8484-4d2e-aa0c-b2a40399dd04'::uuid),
  ('b60aa140-1790-4243-9868-62eac559107f'::uuid),
  ('78b2185e-06ac-458d-ae9a-c1212df5126e'::uuid),
  ('c6ab941d-0df4-46f6-ac96-666fcee1bde0'::uuid),
  ('46362318-31b1-40c7-b3b0-4ff8b3c0ca69'::uuid),
  ('e541bae5-9515-44dc-b362-725acb1b117d'::uuid),
  ('77797c07-1f25-4488-b2af-d95dd23a08b8'::uuid),
  ('4c6a4642-30fa-453a-bf52-8416420da845'::uuid),
  ('4dbe7bce-3f2c-493d-815b-1bff74927a4a'::uuid),
  ('51408247-c185-4046-bc9d-01b445effa2f'::uuid),
  ('32b92a13-503f-4283-a058-8aa3edaa71d1'::uuid),
  ('884949c1-d0cd-4ae4-a510-a4fb2a3dcd5f'::uuid),
  ('7608c2ea-aafa-4044-a1d7-17ddc157e473'::uuid),
  ('34ba5455-2028-413d-88f2-93e5d4397442'::uuid),
  ('60578ff6-d139-4c38-bde3-9f8d05169ec0'::uuid),
  ('69487678-e4d4-4083-af3c-fd624973f4a5'::uuid),
  ('309f2d5e-b3b2-4828-a487-0dad0db1f2d3'::uuid),
  ('5edfe72e-4729-4445-baf9-d0d191404823'::uuid),
  ('ed2de8ed-5983-4739-b178-16d2ff3d5538'::uuid),
  ('17641440-1675-4d01-9eba-778c3a86157c'::uuid),
  ('95ce046b-dd5f-4d4a-8c31-2b4c356ec832'::uuid),
  ('983183c0-894f-4dfd-b6dd-ba17d1ffbd6e'::uuid),
  ('e793166a-76d0-41dd-9e7b-498c345a2122'::uuid),
  ('06a13996-3327-4c84-a8c7-b5a81e877dab'::uuid),
  ('db3e8414-e193-4871-8c1a-9342c4add00c'::uuid),
  ('3895a2b0-ee25-4a15-b971-e9586ee3e24f'::uuid),
  ('88106f2b-a7db-4922-b2c5-5d2b3dccfab2'::uuid),
  ('a3bcb6d6-9f04-45c0-b6db-b7df61e5b1c7'::uuid),
  ('08b89a21-3f0f-4a50-bf9a-8a751a4a8e5f'::uuid),
  ('560b0de3-eb23-4ad5-b175-b46a15fcd6b2'::uuid),
  ('14337218-12d8-4de9-9e00-ab6ac3c53de7'::uuid),
  ('0907a075-4a04-4ba0-9e9c-fc0e26bf0187'::uuid),
  ('8d9a49b8-05ac-45b0-b102-0a03087aed60'::uuid),
  ('e6b2e355-f363-4554-a7b4-7276fe61212e'::uuid),
  ('7c9a7eb1-8274-489f-8e0c-a5218f631b2f'::uuid),
  ('ef5c8241-7ee5-4b55-8423-e5e4997f1a8f'::uuid),
  ('4868fb42-3168-41dd-ba71-5fe531362ac3'::uuid),
  ('c78f6b73-4065-4b2b-bcaa-aecc9f8c29d5'::uuid)
), remaining_counts(table_name,row_count) AS (
 SELECT 'public.assignment_history',count(*) FROM public.assignment_history WHERE opportunity_id IN (SELECT id FROM fixture_ids WHERE kind='deal') OR inquiry_id IN (SELECT id FROM fixture_ids WHERE kind='inquiry')
 UNION ALL SELECT 'public.contact_assignments',count(*) FROM public.contact_assignments WHERE opportunity_id IN (SELECT id FROM fixture_ids WHERE kind='deal')
 UNION ALL SELECT 'crm_security.audit_events',count(*) FROM crm_security.audit_events WHERE deal_id IN (SELECT id FROM fixture_ids WHERE kind='deal')
 UNION ALL SELECT 'crm_security.command_receipts',count(*) FROM crm_security.command_receipts WHERE request_id IN (SELECT id FROM fixture_requests) OR object_id IN (SELECT id FROM fixture_ids)
 UNION ALL SELECT 'crm_security.inquiry_audit_events',count(*) FROM crm_security.inquiry_audit_events WHERE inquiry_id IN (SELECT id FROM fixture_ids WHERE kind='inquiry')
 UNION ALL SELECT 'crm_security.object_scope',count(*) FROM crm_security.object_scope WHERE deal_id IN (SELECT id FROM fixture_ids WHERE kind='deal') OR inquiry_id IN (SELECT id FROM fixture_ids WHERE kind='inquiry')
 UNION ALL SELECT 'crm_security.attachment_audit_events',count(*) FROM crm_security.attachment_audit_events WHERE deal_id IN (SELECT id FROM fixture_ids WHERE kind='deal')
 UNION ALL SELECT 'crm_security.customer_support_actions',count(*) FROM crm_security.customer_support_actions WHERE target_id IN (SELECT id FROM fixture_ids)
 UNION ALL SELECT 'crm_security.deal_attachments',count(*) FROM crm_security.deal_attachments WHERE deal_id IN (SELECT id FROM fixture_ids WHERE kind='deal')
 UNION ALL SELECT 'crm_security.deal_close_events',count(*) FROM crm_security.deal_close_events WHERE deal_id IN (SELECT id FROM fixture_ids WHERE kind='deal')
 UNION ALL SELECT 'crm_security.deal_won_events',count(*) FROM crm_security.deal_won_events WHERE deal_id IN (SELECT id FROM fixture_ids WHERE kind='deal')
 UNION ALL SELECT 'crm_security.expansion_pool_events',count(*) FROM crm_security.expansion_pool_events WHERE source_deal_id IN (SELECT id FROM fixture_ids WHERE kind='deal')
 UNION ALL SELECT 'crm_security.expansion_pool',count(*) FROM crm_security.expansion_pool WHERE source_deal_id IN (SELECT id FROM fixture_ids WHERE kind='deal')
 UNION ALL SELECT 'crm_security.message_reminders',count(*) FROM crm_security.message_reminders WHERE deal_id IN (SELECT id FROM fixture_ids WHERE kind='deal')
 UNION ALL SELECT 'crm_security.next_action_postponements',count(*) FROM crm_security.next_action_postponements WHERE deal_id IN (SELECT id FROM fixture_ids WHERE kind='deal')
 UNION ALL SELECT 'crm_security.quote_versions',count(*) FROM crm_security.quote_versions WHERE deal_id IN (SELECT id FROM fixture_ids WHERE kind='deal')
 UNION ALL SELECT 'crm_security.relationship_events',count(*) FROM crm_security.relationship_events WHERE deal_id IN (SELECT id FROM fixture_ids WHERE kind='deal')
 UNION ALL SELECT 'crm_security.message_outcomes',count(*) FROM crm_security.message_outcomes WHERE deal_id IN (SELECT id FROM fixture_ids WHERE kind='deal')
 UNION ALL SELECT 'crm_security.stage_transition_events',count(*) FROM crm_security.stage_transition_events WHERE deal_id IN (SELECT id FROM fixture_ids WHERE kind='deal')
 UNION ALL SELECT 'public.next_actions',count(*) FROM public.next_actions WHERE deal_id IN (SELECT id FROM fixture_ids WHERE kind='deal') OR inquiry_id IN (SELECT id FROM fixture_ids WHERE kind='inquiry')
 UNION ALL SELECT 'public.activities',count(*) FROM public.activities WHERE deal_id IN (SELECT id FROM fixture_ids WHERE kind='deal')
 UNION ALL SELECT 'public.stage_history',count(*) FROM public.stage_history WHERE opportunity_id IN (SELECT id FROM fixture_ids WHERE kind='deal') OR inquiry_id IN (SELECT id FROM fixture_ids WHERE kind='inquiry')
 UNION ALL SELECT 'crm_security.user_opportunity_state',count(*) FROM crm_security.user_opportunity_state WHERE deal_id IN (SELECT id FROM fixture_ids WHERE kind='deal')
 UNION ALL SELECT 'public.inquiries',count(*) FROM public.inquiries WHERE deal_id IN (SELECT id FROM fixture_ids WHERE kind='deal') OR opportunity_id IN (SELECT id FROM fixture_ids WHERE kind='deal') OR id IN (SELECT id FROM fixture_ids WHERE kind='inquiry')
 UNION ALL SELECT 'public.deals',count(*) FROM public.deals WHERE id IN (SELECT id FROM fixture_ids WHERE kind='deal')
), facts AS (
 SELECT
  (SELECT coalesce(sum(row_count),0) FROM remaining_counts) AS fixture_rows,
  (SELECT count(*) FROM storage.objects WHERE id='c5838a9b-7aee-44fd-af88-58331d88f772'::uuid OR (bucket_id='crm-site-files' AND name='deals/431d2489-6e72-44c3-a8d4-41e95d0f0804/31b422c8-ad61-4336-b161-b8c00432d6db')) AS storage_objects,
  (SELECT count(*) FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname IN ('crm_fixture_cleanup_select_20260906','crm_fixture_cleanup_delete_20260906')) AS temporary_policies,
  (SELECT count(*) FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='crm_attachment_insert_v1' AND permissive='PERMISSIVE' AND roles=ARRAY['authenticated']::name[] AND cmd='INSERT' AND qual IS NULL AND with_check LIKE '%crm-site-files%' AND with_check LIKE '%crm_attachment_object_insert_allowed%') AS permanent_insert_policy,
  (SELECT count(*) FROM public.inquiries WHERE raw->>'fixture_run_id' IS DISTINCT FROM 'stg-e2e-20260906t125239z-fc70f2d2') AS canonical_inquiries,
  (SELECT count(*) FROM public.deals WHERE list_fields->>'fixture_run_id' IS DISTINCT FROM 'stg-e2e-20260906t125239z-fc70f2d2') AS canonical_deals,
  (SELECT md5(coalesce(string_agg(to_jsonb(i)::text,'|' ORDER BY i.id),'')) FROM public.inquiries i WHERE i.raw->>'fixture_run_id' IS DISTINCT FROM 'stg-e2e-20260906t125239z-fc70f2d2') AS canonical_inquiries_md5,
  (SELECT md5(coalesce(string_agg(to_jsonb(d)::text,'|' ORDER BY d.id),'')) FROM public.deals d WHERE d.list_fields->>'fixture_run_id' IS DISTINCT FROM 'stg-e2e-20260906t125239z-fc70f2d2') AS canonical_deals_md5
)
SELECT jsonb_build_object(
 'project_ref','rprechiaglyjaydkmxsu',
 'project_name','netform-crm-staging',
 'run_id','stg-e2e-20260906t125239z-fc70f2d2',
 'status',CASE WHEN fixture_rows=0 AND storage_objects=0 AND temporary_policies=0 AND permanent_insert_policy=1
   AND canonical_inquiries=5
   AND canonical_deals=5
   AND canonical_inquiries_md5='d15e22087063729eedf6e5211d4ff327'
   AND canonical_deals_md5='30b2067a1a74de986aa33a36b9c0942b' THEN 'PASS' ELSE 'FAIL' END,
 'table_counts',(SELECT jsonb_object_agg(table_name,row_count ORDER BY table_name) FROM remaining_counts),
 'verified_fixture_db_rows_remaining',fixture_rows,
 'storage_objects_remaining',storage_objects,
 'temporary_storage_policies_remaining',temporary_policies,
 'permanent_insert_policy_count',permanent_insert_policy,
 'canonical_inquiries',canonical_inquiries,
 'canonical_deals',canonical_deals,
 'canonical_inquiries_md5',canonical_inquiries_md5,
 'canonical_deals_md5',canonical_deals_md5,
 'transaction_mode','READ ONLY',
 'production_requests',0,
 'n8n_requests',0
) AS cleanup_verification FROM facts;
ROLLBACK;
