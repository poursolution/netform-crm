'use strict';

const fs=require('node:fs'),path=require('node:path'),preflight=require('./preflight.cjs');
const dir=__dirname;

function main(argv=process.argv.slice(2)){
 if(argv.length!==1)throw Error('usage: node validate-staging-readonly-preflight.cjs <captured-preflight-result.json>');
 const resultPath=path.resolve(process.cwd(),argv[0]);
 const result=JSON.parse(fs.readFileSync(resultPath,'utf8'));
 const manifest=JSON.parse(fs.readFileSync(path.join(dir,'manifest.json'),'utf8'));
 const apply=fs.readFileSync(path.join(dir,'staging-apply.sql'),'utf8');
 const expected=preflight.inventory(apply,manifest.candidate_inventory.archive_schemas);
 const verdict=preflight.validate(result,manifest,expected);
 process.stdout.write(JSON.stringify(verdict,null,2)+'\n');
 if(verdict.status!=='PASS')process.exitCode=1;
 return verdict;
}

if(require.main===module){try{main();}catch(error){process.stderr.write(String(error.stack||error)+'\n');process.exitCode=1;}}
module.exports={main};
