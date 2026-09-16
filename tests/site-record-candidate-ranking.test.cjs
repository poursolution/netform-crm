const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),sql=fs.readFileSync(path.join(root,'sql/site-record-candidate-ranking-v2.sql'),'utf8'),ui=fs.readFileSync(path.join(root,'pc-site-record-review.js'),'utf8');
assert.match(sql,/contract_version',3/);assert.match(sql,/'evidence',evidence/);assert.match(sql,/match_score/);assert.match(sql,/least\([^\n]+\)>=7/);assert.match(sql,/>=0\.65/);assert.match(sql,/limit 8/);
assert.doesNotMatch(sql,/pg_catalog\.(least|greatest)/);
assert.doesNotMatch(sql,/site_id is null and (coalesce|nullif\(q\.site_name)/);
assert.doesNotMatch(sql,/update public\.(deals|inquiries)/);assert.doesNotMatch(sql,/insert into public\.sites/);assert.match(ui,/\[1,2,3\]\.includes\(data\?\.contract_version\)/);assert.match(ui,/Object\.values\(x\.evidence\|\|\{\}\)/);assert.match(ui,/원본 단서/);
console.log('PASS ranked Site candidates are conservative, bounded and review-only');
