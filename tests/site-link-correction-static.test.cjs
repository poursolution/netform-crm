const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const sql=fs.readFileSync(path.join(__dirname,'../sql/site-link-correction-v1.sql'),'utf8');
const transport=fs.readFileSync(path.join(__dirname,'../pc-manager-transport.js'),'utf8');
assert.match(sql,/site_link_correction_events/);assert.match(sql,/previous_site_id/);assert.match(sql,/new_site_id/);assert.match(sql,/correction reason required/);
assert.match(sql,/permission_role='admin'/);assert.match(sql,/source link drift/);assert.match(sql,/security invoker set search_path=''/);
assert.match(sql,/revoke all on function public\.crm_site_identity_relink_v1/);assert.match(sql,/revoke all on function public\.crm_site_record_relink_v1/);
assert.match(transport,/crm_site_identity_relink_v1/);assert.match(transport,/crm_site_record_relink_v1/);
console.log('PASS Site link corrections are explicit, audited, drift-safe and admin-only');
