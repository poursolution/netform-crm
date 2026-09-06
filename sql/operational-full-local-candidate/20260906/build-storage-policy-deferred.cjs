'use strict';

const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');

const dir=__dirname;
const sha=value=>crypto.createHash('sha256').update(value).digest('hex');
const read=name=>fs.readFileSync(path.join(dir,name),'utf8').replace(/\r\n?/g,'\n');
const policy=`ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
CREATE POLICY crm_attachment_insert_v1 ON storage.objects FOR INSERT TO authenticated
 WITH CHECK(bucket_id='crm-site-files' AND public.crm_attachment_object_insert_allowed(bucket_id,name));`;
const deferred=`-- storage.objects already has RLS enabled. Policy creation is deferred to the
-- Supabase Staging Storage policy editor because the migration role is not the table owner.`;

function replaceExactlyOnce(source,needle,replacement,label){
 const occurrences=source.split(needle).length-1;
 if(occurrences!==1)throw Error(`${label}: expected one occurrence, got ${occurrences}`);
 return source.replace(needle,replacement);
}

function build(){
 const originalApply=read('staging-apply.sql');
 const originalRollback=read('rollback.sql');
 const apply=replaceExactlyOnce(originalApply,policy,deferred,'storage policy block');
 const rollback=replaceExactlyOnce(
  originalRollback,
  'DROP POLICY crm_attachment_insert_v1 ON storage.objects;',
  'DROP POLICY IF EXISTS crm_attachment_insert_v1 ON storage.objects;',
  'storage policy rollback'
 );
 const applyName='staging-apply-storage-policy-deferred.sql';
 const rollbackName='rollback-storage-policy-optional.sql';
 fs.writeFileSync(path.join(dir,applyName),apply);
 fs.writeFileSync(path.join(dir,rollbackName),rollback);
 const manifest={
  project_ref:'rprechiaglyjaydkmxsu',
  status:'READY_NOT_APPLIED_STORAGE_POLICY_DASHBOARD_REQUIRED',
  source_apply_sha256:sha(originalApply),
  source_rollback_sha256:sha(originalRollback),
  apply_file:applyName,
  apply_sha256:sha(apply),
  rollback_file:rollbackName,
  rollback_sha256:sha(rollback),
  deferred_statement_count:1,
  deferred_policy:{
   schema:'storage',table:'objects',name:'crm_attachment_insert_v1',command:'INSERT',role:'authenticated',
   check:"bucket_id='crm-site-files' AND public.crm_attachment_object_insert_allowed(bucket_id,name)"
  },
  database_behavior_changed:false,
  staging_ddl_dml_performed:false,
  production_accessed:false,
  n8n_accessed:false
 };
 fs.writeFileSync(path.join(dir,'storage-policy-deferred-manifest.json'),JSON.stringify(manifest,null,2)+'\n');
 return manifest;
}

if(require.main===module)console.log(JSON.stringify(build(),null,2));
module.exports={policy,deferred,replaceExactlyOnce,build};
