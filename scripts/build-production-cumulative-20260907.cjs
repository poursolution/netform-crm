'use strict';
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const prod='ymfbmpnizxvqsamnczow';
const staging='rprechiaglyjaydkmxsu';
const sources=[
 ['sql/phase1/staging-apply.sql',['metadata_guard']],
 ['sql/work-compat/20260906/staging-apply.sql',['metadata_guard']],
 ['sql/inquiry-direct-assign/20260906/staging-apply.sql',['metadata_guard']],
 ['sql/operational-bundle/20260906/staging-apply.sql',['live_baseline','metadata_guard']],
 ['sql/operational-full-local-candidate/20260906/staging-apply.sql',['approval','columns','cutover_candidate_post','full_local_guard','full_local_post','guard','live_baseline','post','reachable_bundle_guard','reachable_bundle_post','target_post_guard','verify']],
 ['sql/operational-go-candidate/20260907/staging-apply.sql',['guard']]
];
function strip(sql,tags){
 for(const tag of tags){
  const escaped=tag.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  sql=sql.replace(new RegExp(`DO \\$${escaped}\\$[\\s\\S]*?\\$${escaped}\\$;`,'g'),'');
 }
 return sql.replace(/^BEGIN;\s*$/gm,'').replace(/^COMMIT;\s*$/gm,'').replaceAll(staging,prod)
  .replace("ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;\nCREATE POLICY crm_attachment_insert_v1 ON storage.objects FOR INSERT TO authenticated\n WITH CHECK(bucket_id='crm-site-files' AND public.crm_attachment_object_insert_allowed(bucket_id,name));",
   '-- storage.objects is owned by the managed Storage role; apply crm_attachment_insert_v1 separately through the Storage policy editor.')
  .replace(
   "ALTER TABLE public.deals ADD COLUMN won_amount bigint;\nALTER TABLE public.deals ADD COLUMN completion_date date;\nALTER TABLE public.deals ADD CONSTRAINT deals_won_amount_positive CHECK(won_amount IS NULL OR won_amount>0);",
   "ALTER TABLE public.deals ADD COLUMN won_amount bigint;\nALTER TABLE public.deals ADD COLUMN completion_date date;\n-- Approved legacy parity: preserve the 149 existing won rows exactly, including nine amount=0 rows.\nUPDATE public.deals SET won_amount=amount,completion_date=closed_at::date WHERE outcome='won';\nALTER TABLE public.deals ADD CONSTRAINT deals_won_amount_positive CHECK(won_amount IS NULL OR won_amount>=0);"
  );
}
const guard=`BEGIN;
SET LOCAL search_path=pg_catalog;
SET LOCAL lock_timeout='3s';
SET LOCAL statement_timeout='360s';
SET LOCAL crm.cutover_ref='${prod}';
DO $production_guard$
BEGIN
 IF current_user<>'postgres' OR current_setting('crm.cutover_ref',true) IS DISTINCT FROM '${prod}'
    OR md5(pg_get_functiondef('crm_security.actor()'::regprocedure))<>'5c364f061f22cb0c3264c7752325325d'
    OR md5(pg_get_functiondef('crm_security.can_deal(uuid,boolean)'::regprocedure))<>'6c2b8f5c67e5a099adbd3c6757e66100'
    OR md5(pg_get_functiondef('crm_security.can_inquiry(uuid)'::regprocedure))<>'dd68144f48bbbb66f59c5a4cf9699aab'
    OR md5(pg_get_functiondef('public.crm_profile_scoped_v2()'::regprocedure))<>'46b271971e6290c964e2d5100e9a54c3'
    OR md5(pg_get_functiondef('public.crm_read_scoped_v2(uuid,integer,uuid,uuid)'::regprocedure))<>'1428ec31acf45c700696e3cf41d2e67c'
    OR md5(pg_get_functiondef('public.crm_contacts_scoped_v2(uuid)'::regprocedure))<>'5c7e8c5699b7a87a7915bdcf42aa9251'
    OR md5(pg_get_functiondef('public.crm_work_set_scoped_v2(uuid,text,jsonb,text,integer,text)'::regprocedure))<>'6971dfc1309ccff50515f8f0fd5002e7'
    OR (SELECT count(*) FROM public.users)<>12 OR (SELECT count(*) FROM public.deals)<>1549 OR (SELECT count(*) FROM public.inquiries)<>389
    OR (SELECT count(*) FROM crm_security.access_review)<>8
    OR (SELECT count(*) FROM crm_security.access_review WHERE permission_role='rep')<>5
    OR (SELECT count(*) FROM crm_security.access_review WHERE permission_role='admin')<>3
    OR EXISTS(SELECT 1 FROM crm_security.audit_events) OR EXISTS(SELECT 1 FROM crm_security.object_scope)
    OR to_regclass('crm_security.command_receipts') IS NOT NULL
    OR to_regprocedure('public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)') IS NOT NULL
 THEN RAISE EXCEPTION 'production cumulative foundation/data drift'; END IF;
END $production_guard$;
`;
const body=sources.map(([file,tags])=>`\n-- SOURCE ${file}\n${strip(fs.readFileSync(path.join(root,file),'utf8'),tags)}`).join('\n');
const post=`
DO $production_post$
DECLARE f record;
BEGIN
 IF to_regprocedure('public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)') IS NULL
    OR to_regprocedure('public.crm_operational_source_v1(text,uuid,integer)') IS NULL
    OR to_regclass('crm_security.user_capabilities') IS NULL
    OR to_regclass('crm_security.inquiry_routing') IS NULL
    OR to_regclass('crm_security.contact_compat_state') IS NULL
    OR (SELECT pg_get_constraintdef(oid,true) FROM pg_constraint
        WHERE conrelid='crm_security.command_receipts'::regclass AND conname='command_receipts_operation_check')
       IS DISTINCT FROM $expected$CHECK (operation = ANY (ARRAY['opportunity_work_set'::text, 'inquiry_assign'::text, 'service_change'::text, 'inquiry_unassign'::text, 'favorite_set'::text, 'opportunity_touch'::text, 'next_action'::text, 'activity'::text, 'quote_version'::text, 'next_action_complete'::text, 'stage_check'::text, 'transition'::text, 'close'::text, 'amount'::text, 'waiting_context'::text, 'inquiry_reclassify'::text, 'inquiry_status'::text, 'inquiry_trash'::text, 'inquiry_restore'::text, 'inquiry_purge'::text, 'inquiry_followup'::text, 'opportunity_create'::text, 'lineage_link'::text, 'attachment_prepare'::text, 'attachment_complete'::text, 'expansion_pool_update'::text, 'expansion_note'::text, 'customer_support_action'::text, 'message_log'::text, 'relationship_hold'::text, 'relationship_response'::text, 'inquiry_consultant'::text, 'assign'::text, 'contact_upsert'::text, 'contact_relationship'::text, 'contact_move'::text, 'rep_manager_comment'::text]))$expected$
    OR (SELECT count(*) FROM public.users)<>12 OR (SELECT count(*) FROM public.deals)<>1549 OR (SELECT count(*) FROM public.inquiries)<>389
    OR (SELECT count(*) FROM crm_security.access_review)<>8
 THEN RAISE EXCEPTION 'production cumulative postcondition failed'; END IF;
 FOR f IN SELECT p.oid,n.nspname FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname='crm_security'
 LOOP
  IF has_function_privilege('anon',f.oid,'EXECUTE') OR has_function_privilege('authenticated',f.oid,'EXECUTE')
     OR has_function_privilege('service_role',f.oid,'EXECUTE')
     OR EXISTS(SELECT 1 FROM aclexplode((SELECT proacl FROM pg_proc WHERE oid=f.oid)) a WHERE a.grantee=0 AND a.privilege_type='EXECUTE')
  THEN RAISE EXCEPTION 'private function ACL exposed'; END IF;
 END LOOP;
 IF has_function_privilege('anon','public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)','EXECUTE')
    OR NOT has_function_privilege('authenticated','public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)','EXECUTE')
    OR has_function_privilege('service_role','public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)','EXECUTE')
    OR has_schema_privilege('authenticated','crm_security','USAGE')
    OR EXISTS(SELECT 1 FROM pg_class c WHERE c.relnamespace='crm_security'::regnamespace AND c.relkind='r'
      AND (NOT c.relrowsecurity OR has_table_privilege('authenticated',c.oid,'SELECT,INSERT,UPDATE,DELETE') OR has_table_privilege('anon',c.oid,'SELECT,INSERT,UPDATE,DELETE')))
 THEN RAISE EXCEPTION 'production cumulative ACL/RLS failed'; END IF;
END $production_post$;
COMMIT;
`;
const out=path.join(root,'sql/production-cutover/20260907/production-cumulative-31-op.sql');
fs.writeFileSync(out,guard+body+post);
console.log(JSON.stringify({out:path.relative(root,out),bytes:fs.statSync(out).size,sources:sources.map(x=>x[0])}));
