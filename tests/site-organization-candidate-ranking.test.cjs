const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),sql=fs.readFileSync(path.join(root,'sql/site-organization-candidate-ranking-v2.sql'),'utf8'),ui=fs.readFileSync(path.join(root,'pc-organization-history.js'),'utf8');
assert.match(sql,/contract_version',2/);assert.match(sql,/least\([^\n]+\)>=7/);assert.match(sql,/>=0\.65/);assert.match(sql,/limit 8/);
assert.doesNotMatch(sql,/pg_catalog\.(least|greatest)/);assert.doesNotMatch(sql,/insert into crm_security\.site_identity_links/);assert.doesNotMatch(sql,/update public\./);assert.match(ui,/\[1,2,3\]\.includes\(data\?\.contract_version\)/);
console.log('PASS orphan organization candidates are conservative, bounded and review-only');
