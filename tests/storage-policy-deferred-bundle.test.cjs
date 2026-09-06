'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');

const root=path.resolve(__dirname,'..');
const dir=path.join(root,'sql','operational-full-local-candidate','20260906');
const sha=value=>crypto.createHash('sha256').update(value).digest('hex');
const read=name=>fs.readFileSync(path.join(dir,name),'utf8').replace(/\r\n?/g,'\n');

test('deferred bundle removes only owner-only policy DDL and keeps rollback optional',()=>{
 const manifest=JSON.parse(read('storage-policy-deferred-manifest.json'));
 const source=read('staging-apply.sql');
 const deferred=read(manifest.apply_file);
 const sourceRollback=read('rollback.sql');
 const rollback=read(manifest.rollback_file);
 const policy=`ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
CREATE POLICY crm_attachment_insert_v1 ON storage.objects FOR INSERT TO authenticated
 WITH CHECK(bucket_id='crm-site-files' AND public.crm_attachment_object_insert_allowed(bucket_id,name));`;
 const marker=`-- storage.objects already has RLS enabled. Policy creation is deferred to the
-- Supabase Staging Storage policy editor because the migration role is not the table owner.`;
 assert.equal(source.replace(policy,marker),deferred);
 assert.equal(sourceRollback.replace('DROP POLICY crm_attachment_insert_v1 ON storage.objects;','DROP POLICY IF EXISTS crm_attachment_insert_v1 ON storage.objects;'),rollback);
 assert.equal((source.match(/CREATE POLICY crm_attachment_insert_v1/g)||[]).length,1);
 assert.equal((deferred.match(/CREATE POLICY crm_attachment_insert_v1/g)||[]).length,0);
 assert.equal(manifest.project_ref,'rprechiaglyjaydkmxsu');
 assert.equal(manifest.status,'READY_NOT_APPLIED_STORAGE_POLICY_DASHBOARD_REQUIRED');
 assert.equal(manifest.source_apply_sha256,sha(source));
 assert.equal(manifest.source_rollback_sha256,sha(sourceRollback));
 assert.equal(manifest.apply_sha256,sha(deferred));
 assert.equal(manifest.rollback_sha256,sha(rollback));
 assert.equal(manifest.database_behavior_changed,false);
});
