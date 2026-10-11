const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const build=require('../scripts/build-production-ui.cjs');
const source=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
assert.match(source,/^---\r?\nlayout: null\r?\n---/);
assert.match(source,/var APP_BUILD\s*=\s*'\{\{ site\.github\.build_revision \| default: "source" \}\}';/);
assert.doesNotMatch(source,/var APP_BUILD\s*=\s*'20\d{6}/);
assert.match(source,/loaded !== APP_BUILD\) newBuildBanner\(\)/);
assert.match(source,/addEventListener\('focus', mountCurrentBuild\)/);
assert.match(source,/addEventListener\('pageshow', mountCurrentBuild\)/);
assert.match(source,/visibilityState === 'visible'/);
assert.match(source,/setInterval\(mountCurrentBuild, 300000\)/);
const output=build.productionText(source,'index.html');
assert.match(output,/^<!doctype html>/);
assert.match(output,new RegExp(`var APP_BUILD\\s*=\\s*'${build.buildId}';`));
assert.equal(build.buildId,build.sourceCommit.slice(0,12));
const requestAssets=['pc-manager-transport','pc-error-state','inquiry-flow','work-request'];
const requestHtml=requestAssets.map((name,i)=>`<script data-order="${i}" src="./${name}.js?v=previous"></script>`).join('')+'<script src="./unrelated.js?v=keep"></script>';
const requestBuilt=build.productionText(requestHtml,'crm.html');
assert.equal(requestBuilt,requestHtml.replaceAll('?v=previous',`?v=${build.buildId}`),'all contact/request modules refresh together without changing markup or unrelated assets');
assert.equal(build.productionText(requestHtml,'fixture.js'),requestHtml,'runtime source strings are not rewritten as HTML');
const buildSource=fs.readFileSync(path.join(__dirname,'../scripts/build-production-ui.cjs'),'utf8');
assert.match(buildSource,/\['organization-history-reader\.js', 'organization-history-view\.js'\]/);
assert.match(buildSource,/fs\.unlinkSync\(target\)/);
console.log(`PASS production build version derives from commit ${build.buildId}`);

// Exercise the actual release builder/verifier in a disposable source tree.
// The older operational snapshot deliberately has no fonts directory.
const os=require('node:os'),vm=require('node:vm'),crypto=require('node:crypto');
const tmpPrefix=path.join(os.tmpdir(),'netform-font-build-');
const tmp=fs.mkdtempSync(tmpPrefix),fixtureRoot=path.join(tmp,'repository');
const fontNames=['fonts/PretendardVariable.woff2','fonts/OFL.txt'];
const digest=value=>crypto.createHash('sha256').update(value).digest('hex');
const write=(name,value)=>{const file=path.join(fixtureRoot,name);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,value);};
function loadScript(file){
 const mod={exports:{}};
 const localRequire=id=>id==='./build-operational-full-ui.cjs'?{build(){}}:id==='node:child_process'?{execFileSync:()=>build.sourceCommit}:require(id);
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../scripts',file),'utf8'),{require:localRequire,module:mod,exports:mod.exports,__dirname:path.join(fixtureRoot,'scripts'),process,console},{filename:file});
 return mod.exports;
}
try{
 write('index.html',"<!doctype html><script>var APP_BUILD = 'source';</script>");
 write('transport.js',"const REF='ymfbmpnizxvqsamnczow';const allowed=['poursolution.github.io','127.0.0.1','localhost'].includes(location.hostname);");
 write('mobile-contact-view.css',fs.readFileSync(path.join(__dirname,'../mobile-contact-view.css')));
 for(const name of ['pc-organization-history.js','pc-site-record-review.js','site-linked-history.js','site-link-review.css','today-work-queue.js'])write(name,name==='pc-organization-history.js'?'crm_site_linked_assets_v1':'/* release fixture */');
 write('staging-operational-full/operational-full-ui-manifest.json',JSON.stringify({connected_operations:[]}));
 for(const name of fontNames)write(name,fs.readFileSync(path.join(__dirname,'..',name)));
 assert.equal(fs.existsSync(path.join(fixtureRoot,'staging-operational-full/fonts')),false);
 const fixtureBuild=loadScript('build-production-ui.cjs'),verifier=loadScript('verify-production-manifest.cjs');
 const result=fixtureBuild.build(),manifestFile=path.join(result.output,'production-ui-manifest.json');
 const manifest=JSON.parse(fs.readFileSync(manifestFile,'utf8'));
 assert.equal(verifier.verify(result.output).status,'PASS');
 assert.equal(result.files,Object.keys(manifest.files_sha256).length);
 for(const name of fontNames){
  const expected=fs.readFileSync(path.join(fixtureRoot,name)),released=fs.readFileSync(path.join(result.output,name));
  assert.deepEqual(released,expected,'approved font/license bytes must not be transformed: '+name);
  assert.equal(manifest.files_sha256[name],digest(expected),'binary asset is included in release provenance');
 }
 const css=fs.readFileSync(path.join(result.output,'mobile-contact-view.css'),'utf8');
 const fontReference=css.match(/url\(['"]?(\.\/fonts\/[^'"\)]+)['"]?\)/)?.[1];
 assert.equal(fontReference,'./fonts/PretendardVariable.woff2');
 assert.equal(fs.existsSync(path.resolve(result.output,fontReference)),true,'the shipped CSS resolves to the shipped font');
 for(const name of fontNames){
  const released=path.join(result.output,name),original=fs.readFileSync(released);
  const missingHash=structuredClone(manifest);delete missingHash.files_sha256[name];fs.writeFileSync(manifestFile,JSON.stringify(missingHash));
  assert.throws(()=>verifier.verify(result.output),new RegExp('MISSING_REQUIRED_ASSET_HASH:'+name.replaceAll('.','\\.')));
  fs.writeFileSync(manifestFile,JSON.stringify(manifest));fs.unlinkSync(released);
  assert.throws(()=>verifier.verify(result.output),new RegExp('MISSING_RUNTIME_FILE:'+name.replaceAll('.','\\.')));
  fs.writeFileSync(released,Buffer.concat([original,Buffer.from('tampered')]));
  assert.throws(()=>verifier.verify(result.output),/FILE_HASH_MISMATCH/);
  const forged=structuredClone(manifest);forged.files_sha256[name]=digest(fs.readFileSync(released));fs.writeFileSync(manifestFile,JSON.stringify(forged));
  assert.throws(()=>verifier.verify(result.output),/APPROVED_ASSET_MISMATCH/,'matching a modified manifest must not accept a different approved asset');
  fs.writeFileSync(released,original);fs.writeFileSync(manifestFile,JSON.stringify(manifest));
 }
 for(const name of fontNames){
  const input=path.join(fixtureRoot,name),original=fs.readFileSync(input);fs.unlinkSync(input);
  assert.throws(()=>fixtureBuild.build(),new RegExp('MISSING_APPROVED_ASSET:'+name.replaceAll('.','\\.')),'stale release output must not conceal a missing source asset');
  fs.writeFileSync(input,original);
 }
 console.log('PASS approved font and license are copied byte-for-byte, hashed, required, and checked against source');
}finally{
 assert.ok(path.resolve(tmp).startsWith(path.resolve(tmpPrefix)),'cleanup stays inside the unique font-build temporary directory');
 fs.rmSync(tmp,{recursive:true,force:true});
}
