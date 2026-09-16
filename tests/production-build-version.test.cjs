const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const build=require('../scripts/build-production-ui.cjs');
const source=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
assert.match(source,/var APP_BUILD\s*=\s*'source';/);
assert.doesNotMatch(source,/var APP_BUILD\s*=\s*'20\d{6}/);
const output=build.productionText(source,'index.html');
assert.match(output,new RegExp(`var APP_BUILD\\s*=\\s*'${build.buildId}';`));
assert.equal(build.buildId,build.sourceCommit.slice(0,12));
console.log(`PASS production build version derives from commit ${build.buildId}`);
