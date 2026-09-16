const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const src=fs.readFileSync(path.join(__dirname,'../detail-workspace.js'),'utf8');
assert.match(src,/asset=\{key:s\.key,index:i,tab:'summary'\}/);
assert.match(src,/findIndex\(function\(s\)\{return s\.key===old\.key\}\)/);
assert.doesNotMatch(src,/findIndex\(function\(s\)\{return s\.norm===old\.norm\}\)/);
console.log('PASS customer asset return uses stable Site Master key, never normalized name');
