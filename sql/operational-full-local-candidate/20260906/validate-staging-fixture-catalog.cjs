'use strict';

const fs=require('node:fs');
const path=require('node:path');
const catalog=require('./fixture-catalog.cjs');
const dir=__dirname;
const root=path.resolve(dir,'../../..');

function main(argv=process.argv.slice(2)){
 if(argv.length!==1)throw Error('usage: node validate-staging-fixture-catalog.cjs <captured-fixture-catalog-result.json>');
 const result=JSON.parse(fs.readFileSync(path.resolve(process.cwd(),argv[0]),'utf8'));
 const manifest=JSON.parse(fs.readFileSync(path.join(dir,'manifest.json'),'utf8'));
 const fixture=JSON.parse(fs.readFileSync(path.join(root,'sql','baseline','20260905','synthetic','fixture.json'),'utf8'));
 const verdict=catalog.validate(result,{candidateRelations:manifest.candidate_inventory.relation_names,fixture});
 process.stdout.write(JSON.stringify(verdict,null,2)+'\n');
 if(verdict.status!=='PASS')process.exitCode=1;
 return verdict;
}

if(require.main===module){try{main();}catch(error){process.stderr.write(String(error.stack||error)+'\n');process.exitCode=1;}}
module.exports={main};
