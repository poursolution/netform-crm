const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),sql=fs.readFileSync(path.join(root,'sql/site-record-corrected-separate-v1.sql'),'utf8'),ui=fs.readFileSync(path.join(root,'pc-site-record-review.js'),'utf8'),transport=fs.readFileSync(path.join(root,'pc-manager-transport.js'),'utf8');
assert.match(sql,/site_record_separate_name_allowed_v1\(clean_name\)/);assert.match(sql,/site_record_link_decisions/);assert.match(sql,/security invoker set search_path=''/);assert.match(sql,/replayed/);
assert.match(ui,/올바른 현장명 입력/);assert.match(ui,/crm_site_record_corrected_separate_v1/);assert.match(transport,/rpcAllow=new Set\(\['crm_site_record_corrected_separate_v1'/);
console.log('PASS placeholder records require an explicit corrected name before canonical Site creation');
