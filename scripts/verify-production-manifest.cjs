'use strict';

const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const childProcess=require('node:child_process');

const root=path.resolve(__dirname,'..');
const hash=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');

function verify(base=root){
 const manifestPath=path.join(base,'production-ui-manifest.json');
 const manifest=JSON.parse(fs.readFileSync(manifestPath,'utf8'));
 const head=childProcess.execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim();
 const errors=[];
 if(manifest.source_commit!==head)errors.push(`SOURCE_COMMIT_MISMATCH:${manifest.source_commit}:${head}`);
 if(manifest.build_id!==head.slice(0,12))errors.push(`BUILD_ID_MISMATCH:${manifest.build_id||'missing'}:${head.slice(0,12)}`);
 for(const [name,expected] of Object.entries(manifest.files_sha256||{})){
  const file=path.join(base,name);
  if(!fs.existsSync(file))errors.push(`MISSING_RUNTIME_FILE:${name}`);
  else if(hash(file)!==expected)errors.push(`FILE_HASH_MISMATCH:${name}`);
 }
 const index=fs.readFileSync(path.join(base,'index.html'),'utf8');
 if(!index.includes(`var APP_BUILD  = '${manifest.build_id}';`))errors.push('INDEX_BUILD_ID_MISMATCH');
 if(errors.length)throw Error(errors.join('\n'));
 return {status:'PASS',source_commit:head,build_id:manifest.build_id,files:Object.keys(manifest.files_sha256||{}).length};
}

if(require.main===module)console.log(JSON.stringify(verify(process.argv[2]?path.resolve(process.argv[2]):root),null,2));
module.exports={verify};
