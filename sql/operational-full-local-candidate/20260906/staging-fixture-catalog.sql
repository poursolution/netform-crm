-- POST-APPLY READ-ONLY CATALOG PLAN. Exact Staging only; no DDL/DML and no fixture setup.
-- Execute only after the approved 31-operation apply and before any mutation E2E fixture write.
BEGIN READ ONLY;
SET LOCAL search_path=pg_catalog;
SET LOCAL statement_timeout='60s';
SET LOCAL lock_timeout='3s';
SET LOCAL crm.operational_fixture_catalog_ref='rprechiaglyjaydkmxsu';
DO $fixture_catalog_guard$
DECLARE missing text; insecure text; f record;
BEGIN
 IF current_setting('transaction_read_only')<>'on' OR current_user<>'postgres' OR current_setting('crm.operational_fixture_catalog_ref',true)<>'rprechiaglyjaydkmxsu' THEN RAISE EXCEPTION 'project/role/read-only guard failed'; END IF;
 SELECT * INTO f FROM pg_proc WHERE oid=to_regprocedure('crm_security.crm_write_command_v2_frozen_20260906(uuid,text,uuid,integer,jsonb)');
 IF NOT FOUND OR f.oid<>18077 OR md5(pg_get_functiondef(f.oid))<>'1ad250f71a5af65317ab3362239752e8' OR pg_get_userbyid(f.proowner)<>'postgres' OR NOT f.prosecdef OR f.proconfig IS DISTINCT FROM ARRAY['search_path=""'] OR coalesce(f.proacl::text,'')<>'{postgres=X/postgres}' THEN RAISE EXCEPTION 'frozen baseline identity drift'; END IF;
 IF (SELECT pg_get_constraintdef(oid,true) FROM pg_constraint WHERE conrelid='crm_security.command_receipts'::regclass AND conname='command_receipts_operation_check') IS DISTINCT FROM $expected$CHECK (operation = ANY (ARRAY['opportunity_work_set'::text, 'inquiry_assign'::text, 'service_change'::text, 'inquiry_unassign'::text, 'favorite_set'::text, 'opportunity_touch'::text, 'next_action'::text, 'activity'::text, 'quote_version'::text, 'next_action_complete'::text, 'stage_check'::text, 'transition'::text, 'close'::text, 'amount'::text, 'waiting_context'::text, 'inquiry_reclassify'::text, 'inquiry_status'::text, 'inquiry_trash'::text, 'inquiry_restore'::text, 'inquiry_purge'::text, 'inquiry_followup'::text, 'opportunity_create'::text, 'lineage_link'::text, 'attachment_prepare'::text, 'attachment_complete'::text, 'expansion_pool_update'::text, 'expansion_note'::text, 'customer_support_action'::text, 'message_log'::text, 'relationship_hold'::text, 'relationship_response'::text]))$expected$ THEN RAISE EXCEPTION 'post-apply receipt operation drift'; END IF;
 SELECT string_agg(x,', ' ORDER BY x) INTO missing FROM unnest(ARRAY['public.activities','public.assignment_history','public.contact_assignments','public.contacts','public.deals','public.inquiries','public.next_actions','public.organizations','public.sites','public.stage_history','public.users','crm_security.access_review','crm_security.audit_events','crm_security.command_receipts','crm_security.inquiry_audit_events','crm_security.object_scope','crm_security.attachment_audit_events','crm_security.customer_support_actions','crm_security.deal_attachments','crm_security.deal_close_events','crm_security.deal_won_events','crm_security.expansion_pool','crm_security.expansion_pool_events','crm_security.message_outcomes','crm_security.message_reminders','crm_security.next_action_postponements','crm_security.quote_versions','crm_security.relationship_events','crm_security.stage_transition_events','crm_security.user_opportunity_state','storage.buckets','storage.objects']::text[]) x WHERE to_regclass(x) IS NULL;
 IF missing IS NOT NULL THEN RAISE EXCEPTION 'fixture catalog relation missing: %',missing; END IF;
 SELECT string_agg(x,', ' ORDER BY x) INTO missing FROM unnest(ARRAY['public.deals.stage_checklist','public.deals.stage_contexts','public.deals.won_amount','public.deals.completion_date']::text[]) x WHERE NOT EXISTS(SELECT 1 FROM information_schema.columns c WHERE c.table_schema||'.'||c.table_name||'.'||c.column_name=x);
 IF missing IS NOT NULL THEN RAISE EXCEPTION 'post-apply candidate column missing: %',missing; END IF;
 SELECT string_agg(x,', ' ORDER BY x) INTO missing FROM unnest(ARRAY['public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)','public.crm_operational_source_v1(text,uuid,integer)','public.crm_expansion_note(jsonb)','public.crm_expansion_context(jsonb)']::text[]) x WHERE to_regprocedure(x) IS NULL;
 IF missing IS NOT NULL THEN RAISE EXCEPTION 'public entrypoint missing: %',missing; END IF;
 SELECT string_agg(x,', ' ORDER BY x) INTO insecure FROM unnest(ARRAY['public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)','public.crm_operational_source_v1(text,uuid,integer)','public.crm_expansion_note(jsonb)','public.crm_expansion_context(jsonb)']::text[]) x WHERE NOT has_function_privilege('authenticated',x,'EXECUTE') OR has_function_privilege('anon',x,'EXECUTE');
 IF insecure IS NOT NULL THEN RAISE EXCEPTION 'public entrypoint ACL drift: %',insecure; END IF;
 SELECT string_agg(n.nspname||'.'||c.relname,', ' ORDER BY n.nspname,c.relname) INTO insecure
 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
 WHERE n.nspname='crm_security' AND c.relname=ANY(ARRAY['attachment_audit_events','customer_support_actions','deal_attachments','deal_close_events','deal_won_events','expansion_pool','expansion_pool_events','message_outcomes','message_reminders','next_action_postponements','quote_versions','relationship_events','stage_transition_events','user_opportunity_state']::text[]) AND (NOT c.relrowsecurity OR has_table_privilege('authenticated',c.oid,'SELECT,INSERT,UPDATE,DELETE') OR has_table_privilege('anon',c.oid,'SELECT,INSERT,UPDATE,DELETE'));
 IF insecure IS NOT NULL THEN RAISE EXCEPTION 'candidate private relation ACL/RLS drift: %',insecure; END IF;
END $fixture_catalog_guard$;
WITH target_relations(schema_name,relation_name) AS (VALUES
  ('public','activities'),
  ('public','assignment_history'),
  ('public','contact_assignments'),
  ('public','contacts'),
  ('public','deals'),
  ('public','inquiries'),
  ('public','next_actions'),
  ('public','organizations'),
  ('public','sites'),
  ('public','stage_history'),
  ('public','users'),
  ('crm_security','access_review'),
  ('crm_security','audit_events'),
  ('crm_security','command_receipts'),
  ('crm_security','inquiry_audit_events'),
  ('crm_security','object_scope'),
  ('crm_security','attachment_audit_events'),
  ('crm_security','customer_support_actions'),
  ('crm_security','deal_attachments'),
  ('crm_security','deal_close_events'),
  ('crm_security','deal_won_events'),
  ('crm_security','expansion_pool'),
  ('crm_security','expansion_pool_events'),
  ('crm_security','message_outcomes'),
  ('crm_security','message_reminders'),
  ('crm_security','next_action_postponements'),
  ('crm_security','quote_versions'),
  ('crm_security','relationship_events'),
  ('crm_security','stage_transition_events'),
  ('crm_security','user_opportunity_state'),
  ('storage','buckets'),
  ('storage','objects')
), relation_oids AS (
 SELECT t.schema_name,t.relation_name,c.oid,c.relowner,c.relrowsecurity,c.relforcerowsecurity,c.relacl
 FROM target_relations t JOIN pg_namespace n ON n.nspname=t.schema_name JOIN pg_class c ON c.relnamespace=n.oid AND c.relname=t.relation_name
), canonical_presence AS (
  SELECT 'public.users' AS relation_name, count(*)::integer AS present_count, 6::integer AS expected_count FROM public.users WHERE user_id::text=ANY(ARRAY['f6090500-0001-4000-8000-000000000001','f6090500-0001-4000-8000-000000000002','f6090500-0001-4000-8000-000000000003','f6090500-0001-4000-8000-000000000004','f6090500-0001-4000-8000-000000000005','f6090500-0001-4000-8000-000000000006']::text[])
  UNION ALL
  SELECT 'public.sites' AS relation_name, count(*)::integer AS present_count, 5::integer AS expected_count FROM public.sites WHERE site_id::text=ANY(ARRAY['f6090500-0002-4000-8000-000000000001','f6090500-0002-4000-8000-000000000002','f6090500-0002-4000-8000-000000000003','f6090500-0002-4000-8000-000000000004','f6090500-0002-4000-8000-000000000005']::text[])
  UNION ALL
  SELECT 'public.organizations' AS relation_name, count(*)::integer AS present_count, 5::integer AS expected_count FROM public.organizations WHERE id::text=ANY(ARRAY['f6090500-0003-4000-8000-000000000001','f6090500-0003-4000-8000-000000000002','f6090500-0003-4000-8000-000000000003','f6090500-0003-4000-8000-000000000004','f6090500-0003-4000-8000-000000000005']::text[])
  UNION ALL
  SELECT 'public.contacts' AS relation_name, count(*)::integer AS present_count, 5::integer AS expected_count FROM public.contacts WHERE id::text=ANY(ARRAY['f6090500-0004-4000-8000-000000000001','f6090500-0004-4000-8000-000000000002','f6090500-0004-4000-8000-000000000003','f6090500-0004-4000-8000-000000000004','f6090500-0004-4000-8000-000000000005']::text[])
  UNION ALL
  SELECT 'public.inquiries' AS relation_name, count(*)::integer AS present_count, 5::integer AS expected_count FROM public.inquiries WHERE id::text=ANY(ARRAY['f6090500-0005-4000-8000-000000000001','f6090500-0005-4000-8000-000000000002','f6090500-0005-4000-8000-000000000003','f6090500-0005-4000-8000-000000000004','f6090500-0005-4000-8000-000000000005']::text[])
  UNION ALL
  SELECT 'public.deals' AS relation_name, count(*)::integer AS present_count, 5::integer AS expected_count FROM public.deals WHERE id::text=ANY(ARRAY['f6090500-0006-4000-8000-000000000001','f6090500-0006-4000-8000-000000000002','f6090500-0006-4000-8000-000000000003','f6090500-0006-4000-8000-000000000004','f6090500-0006-4000-8000-000000000005']::text[])
  UNION ALL
  SELECT 'public.contact_assignments' AS relation_name, count(*)::integer AS present_count, 4::integer AS expected_count FROM public.contact_assignments WHERE id::text=ANY(ARRAY['f6090500-0007-4000-8000-000000000001','f6090500-0007-4000-8000-000000000002','f6090500-0007-4000-8000-000000000004','f6090500-0007-4000-8000-000000000005']::text[])
  UNION ALL
  SELECT 'public.activities' AS relation_name, count(*)::integer AS present_count, 5::integer AS expected_count FROM public.activities WHERE id::text=ANY(ARRAY['f6090500-0008-4000-8000-000000000001','f6090500-0008-4000-8000-000000000002','f6090500-0008-4000-8000-000000000003','f6090500-0008-4000-8000-000000000004','f6090500-0008-4000-8000-000000000005']::text[])
  UNION ALL
  SELECT 'public.next_actions' AS relation_name, count(*)::integer AS present_count, 6::integer AS expected_count FROM public.next_actions WHERE id::text=ANY(ARRAY['f6090500-0009-4000-8000-000000000001','f6090500-0009-4000-8000-000000000002','f6090500-0009-4000-8000-000000000003','f6090500-0009-4000-8000-000000000004','f6090500-0009-4000-8000-000000000005','f6090500-0009-4000-8000-000000000006']::text[])
), public_entrypoints(signature) AS (VALUES ('public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)'),('public.crm_operational_source_v1(text,uuid,integer)'),('public.crm_expansion_note(jsonb)'),('public.crm_expansion_context(jsonb)'))
SELECT jsonb_build_object(
 'project_ref','rprechiaglyjaydkmxsu','project_name','netform-crm-staging','mode','READ_ONLY_POST_APPLY_CATALOG','status','PASS',
 'transaction_read_only',current_setting('transaction_read_only')='on','current_user',current_user,
 'target_relations',ARRAY['public.activities','public.assignment_history','public.contact_assignments','public.contacts','public.deals','public.inquiries','public.next_actions','public.organizations','public.sites','public.stage_history','public.users','crm_security.access_review','crm_security.audit_events','crm_security.command_receipts','crm_security.inquiry_audit_events','crm_security.object_scope','crm_security.attachment_audit_events','crm_security.customer_support_actions','crm_security.deal_attachments','crm_security.deal_close_events','crm_security.deal_won_events','crm_security.expansion_pool','crm_security.expansion_pool_events','crm_security.message_outcomes','crm_security.message_reminders','crm_security.next_action_postponements','crm_security.quote_versions','crm_security.relationship_events','crm_security.stage_transition_events','crm_security.user_opportunity_state','storage.buckets','storage.objects']::text[],'candidate_relations',ARRAY['crm_security.attachment_audit_events','crm_security.customer_support_actions','crm_security.deal_attachments','crm_security.deal_close_events','crm_security.deal_won_events','crm_security.expansion_pool','crm_security.expansion_pool_events','crm_security.message_outcomes','crm_security.message_reminders','crm_security.next_action_postponements','crm_security.quote_versions','crm_security.relationship_events','crm_security.stage_transition_events','crm_security.user_opportunity_state']::text[],'candidate_columns',ARRAY['public.deals.stage_checklist','public.deals.stage_contexts','public.deals.won_amount','public.deals.completion_date']::text[],
 'columns',(SELECT coalesce(jsonb_agg(jsonb_build_object('relation',r.schema_name||'.'||r.relation_name,'name',a.attname,'ordinal',a.attnum,'type',format_type(a.atttypid,a.atttypmod),'not_null',a.attnotnull,'identity',a.attidentity,'generated',a.attgenerated,'default',pg_get_expr(d.adbin,d.adrelid)) ORDER BY r.schema_name,r.relation_name,a.attnum),'[]'::jsonb) FROM relation_oids r JOIN pg_attribute a ON a.attrelid=r.oid AND a.attnum>0 AND NOT a.attisdropped LEFT JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum),
 'constraints',(SELECT coalesce(jsonb_agg(jsonb_build_object('relation',r.schema_name||'.'||r.relation_name,'name',c.conname,'type',c.contype,'definition',pg_get_constraintdef(c.oid,true),'referenced_relation',CASE WHEN c.confrelid=0 THEN NULL ELSE c.confrelid::regclass::text END) ORDER BY r.schema_name,r.relation_name,c.conname),'[]'::jsonb) FROM relation_oids r JOIN pg_constraint c ON c.conrelid=r.oid),
 'indexes',(SELECT coalesce(jsonb_agg(jsonb_build_object('relation',r.schema_name||'.'||r.relation_name,'name',ci.relname,'primary',i.indisprimary,'unique',i.indisunique,'definition',pg_get_indexdef(i.indexrelid)) ORDER BY r.schema_name,r.relation_name,ci.relname),'[]'::jsonb) FROM relation_oids r JOIN pg_index i ON i.indrelid=r.oid JOIN pg_class ci ON ci.oid=i.indexrelid),
 'triggers',(SELECT coalesce(jsonb_agg(jsonb_build_object('relation',r.schema_name||'.'||r.relation_name,'name',t.tgname,'definition',pg_get_triggerdef(t.oid,true)) ORDER BY r.schema_name,r.relation_name,t.tgname),'[]'::jsonb) FROM relation_oids r JOIN pg_trigger t ON t.tgrelid=r.oid AND NOT t.tgisinternal),
 'policies',(SELECT coalesce(jsonb_agg(jsonb_build_object('relation',r.schema_name||'.'||r.relation_name,'name',p.polname,'command',p.polcmd,'permissive',p.polpermissive,'roles',p.polroles,'using',pg_get_expr(p.polqual,p.polrelid),'check',pg_get_expr(p.polwithcheck,p.polrelid)) ORDER BY r.schema_name,r.relation_name,p.polname),'[]'::jsonb) FROM relation_oids r JOIN pg_policy p ON p.polrelid=r.oid),
 'table_security',(SELECT jsonb_agg(jsonb_build_object('relation',r.schema_name||'.'||r.relation_name,'owner',pg_get_userbyid(r.relowner),'rls',r.relrowsecurity,'force_rls',r.relforcerowsecurity,'acl',coalesce(r.relacl::text,''),'anon_select',has_table_privilege('anon',r.oid,'SELECT'),'anon_write',has_table_privilege('anon',r.oid,'INSERT,UPDATE,DELETE'),'authenticated_select',has_table_privilege('authenticated',r.oid,'SELECT'),'authenticated_write',has_table_privilege('authenticated',r.oid,'INSERT,UPDATE,DELETE')) ORDER BY r.schema_name,r.relation_name) FROM relation_oids r),
 'public_entrypoints',(SELECT jsonb_agg(jsonb_build_object('signature',e.signature,'owner',pg_get_userbyid(p.proowner),'security_definer',p.prosecdef,'config',p.proconfig,'acl',coalesce(p.proacl::text,''),'anon_execute',has_function_privilege('anon',p.oid,'EXECUTE'),'authenticated_execute',has_function_privilege('authenticated',p.oid,'EXECUTE')) ORDER BY e.signature) FROM public_entrypoints e JOIN pg_proc p ON p.oid=to_regprocedure(e.signature)),
 'canonical_presence',(SELECT jsonb_object_agg(relation_name,jsonb_build_object('present',present_count,'expected',expected_count) ORDER BY relation_name) FROM canonical_presence),
 'staging_ddl_dml_performed',false,'production_accessed',false,'n8n_accessed',false
) AS fixture_catalog_result;
COMMIT;
