const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const sql=fs.readFileSync(path.join(__dirname,'../sql/site-linked-history-api.sql'),'utf8'),js=fs.readFileSync(path.join(__dirname,'../site-linked-history.js'),'utf8');
assert.match(sql,/l\.site_id=p_site and l\.resolution in \('linked','separate'\)/);assert.match(sql,/crm_security\.can_read_legacy_note/);assert.match(sql,/permission_role='admin'/);assert.match(sql,/security invoker set search_path=''/);assert.match(js,/String\(s\.key\)\.startsWith\('id:'\)/);assert.match(js,/crm_site_linked_history_v1/);assert.doesNotMatch(js,/s\.norm/);
assert.match(sql,/crm_security\.site_linked_assets_v1\(\)/);assert.match(sql,/linked_organization_count/);assert.match(sql,/legacy_note_count/);
console.log('PASS canonical Site detail reads explicitly reviewed authorized history');
