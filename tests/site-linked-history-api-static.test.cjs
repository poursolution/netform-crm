const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const sql=fs.readFileSync(path.join(__dirname,'../sql/site-linked-history-api.sql'),'utf8'),js=fs.readFileSync(path.join(__dirname,'../site-linked-history.js'),'utf8');
assert.match(sql,/l\.site_id=p_site and l\.resolution in \('linked','separate'\)/);assert.match(sql,/crm_security\.can_read_legacy_note/);assert.match(sql,/permission_role='admin'/);assert.match(sql,/security invoker set search_path=''/);assert.match(js,/String\(s\.key\)\.startsWith\('id:'\)/);assert.match(js,/crm_site_linked_history_v1/);assert.doesNotMatch(js,/s\.norm/);
assert.match(sql,/'contract_version',2/);assert.match(sql,/'contacts'/);assert.match(sql,/l\.organization_id=c\.organization_id/);assert.match(sql,/ca\.person_key=c\.person_key and d\.site_id=p_site/);assert.match(sql,/d\.contact_id=c\.id and d\.site_id=p_site/);assert.match(js,/data\.contacts/);assert.match(js,/확정 연결된 담당자/);
assert.match(sql,/crm_security\.site_linked_assets_v1\(\)/);assert.match(sql,/linked_organization_count/);assert.match(sql,/legacy_note_count/);
console.log('PASS canonical Site detail reads explicitly reviewed authorized history');
