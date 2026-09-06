'use strict';

const fs=require('node:fs');
const path=require('node:path');
const compiler=require('./disposable-fixture.cjs');
const dir=__dirname;
const root=path.resolve(dir,'../../..');

function main(argv=process.argv.slice(2)){
 if(argv.length!==3)throw Error('usage: node build-staging-disposable-fixture.cjs <captured-catalog.json> <run-id> <empty-output-dir>');
 const [captureFile,runId,outputArg]=argv;
 const absoluteCapture=path.resolve(process.cwd(),captureFile),output=path.resolve(process.cwd(),outputArg);
 if(!fs.existsSync(absoluteCapture))throw Error('captured catalog is required');
 if(fs.existsSync(output)&&fs.readdirSync(output).length)throw Error('output directory must be empty');
 const catalogRaw=fs.readFileSync(absoluteCapture,'utf8'),capture=JSON.parse(catalogRaw);
 const manifestFile=path.join(dir,'manifest.json'),manifestRaw=fs.readFileSync(manifestFile,'utf8');
 const manifest=JSON.parse(manifestRaw);
 const fixture=JSON.parse(fs.readFileSync(path.join(root,'sql','baseline','20260905','synthetic','fixture.json'),'utf8'));
 const mutationPlan=JSON.parse(fs.readFileSync(path.join(root,'docs','operational-cutover-20260906','staging-mutation-e2e-plan.json'),'utf8'));
 const artifacts=compiler.build({capture,catalogRaw,manifest,manifestRaw,fixture,mutationPlan,runId});
 fs.mkdirSync(output,{recursive:true});
 fs.writeFileSync(path.join(output,'fixture-plan.json'),JSON.stringify(artifacts.plan,null,2)+'\n');
 fs.writeFileSync(path.join(output,'setup.sql'),artifacts.setup);
 fs.writeFileSync(path.join(output,'cleanup.sql'),artifacts.cleanup);
 fs.writeFileSync(path.join(output,'storage-cleanup-plan.json'),JSON.stringify(artifacts.storage,null,2)+'\n');
 process.stdout.write(JSON.stringify({status:'GENERATED_NOT_APPROVED_NOT_RUN',output,run_id:runId,catalog_sha256:artifacts.plan.catalog_sha256,fixture_counts:artifacts.plan.fixture_counts},null,2)+'\n');
 return artifacts;
}

if(require.main===module){try{main();}catch(error){process.stderr.write(String(error.stack||error)+'\n');process.exitCode=1;}}
module.exports={main};
