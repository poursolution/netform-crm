const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),sql=fs.readFileSync(path.join(root,'sql/site-record-separate-name-guard-v1.sql'),'utf8'),ui=fs.readFileSync(path.join(root,'pc-site-record-review.js'),'utf8');
for(const label of ['황윤선전체고객','아파트스퀘어','감리'])assert.ok(sql.includes(label));
assert.match(sql,/site name requires correction/);assert.match(sql,/site_record_separate_name_allowed_v1\(item_name\)/);assert.match(ui,/올바른 현장명 입력/);assert.match(ui,/canSeparate\?resolve\('separate',null\):correctedSeparate/);
console.log('PASS aggregate, region-only and placeholder names cannot create canonical Sites');
