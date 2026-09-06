const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const read=f=>fs.readFileSync(path.join(__dirname,'..',f),'utf8');

// Source guards supplement execution tests; they do NOT prove live ACL or JWT behavior.
test('hardening requires independently reviewed signature/body/ACL/policy manifest',()=>{
 const s=read('sql/20260905_crm_security_hardening.sql');
 for(const marker of ['Reviewed snapshot manifest required','definition_md5','acl_md5','Policy drift','Function inventory drift','ACL postcondition failed'])assert.ok(s.includes(marker));
 assert.doesNotMatch(s,/position\('auth\.uid\(\)'/);
 assert.match(s,/alter default privileges revoke execute on functions from public,anon,authenticated/);
});
test('snapshot remains read-only and includes approval inputs',()=>{
 const s=read('sql/20260905_crm_security_snapshot.sql');
 assert.doesNotMatch(s.replace(/^\s*--.*$/gm,''),/^\s*(insert|update|delete|truncate|drop|alter|create|grant|revoke)\b/im);
 for(const marker of ['pg_proc','prosecdef','aclexplode','relrowsecurity','pg_policies','storage.buckets','pg_default_acl','acl_md5'])assert.ok(s.includes(marker));
});
test('browser source has no recognized embedded privileged key pattern',()=>{
 const html=read('crm.html')+read('mobile.html')+read('crm-export.js');
 assert.doesNotMatch(html,/sb_secret_[A-Za-z0-9_-]+|service_role\s*[:=]\s*['"][^'"]+/i);
 // Pattern check only: complete secret scan and rotation remain an approval gate.
});
test('attachment bucket creation requests private storage',()=>{
 assert.match(read('sql/20260905_attachments_favorites.sql'),/values\s*\(\s*'crm-site-files','crm-site-files',false/i);
});
test('rollback refuses a missing same-session backup',()=>{
 assert.match(read('sql/20260905_crm_security_rollback.sql'),/Rollback backup missing/);
});
