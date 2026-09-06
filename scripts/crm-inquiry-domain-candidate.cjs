'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const direct=require('./crm-inquiry-direct-assign.cjs');
const dir=path.resolve(__dirname,'../sql/inquiry-domain/20260906');
const candidate=fs.readFileSync(path.join(dir,'candidate.sql'),'utf8');
const rollback=fs.readFileSync(path.join(dir,'rollback.sql'),'utf8');

function build(){
 const sha256=file=>crypto.createHash('sha256').update(fs.readFileSync(path.join(dir,file))).digest('hex');
 const manifest={
  project_ref:'rprechiaglyjaydkmxsu',
  status:'DERIVED_SAFE_LOCAL_CANDIDATE_NOT_APPLIED',
  derived_safe:['inquiry_unassign'],
  blocked:['inquiry_status','inquiry_trash','inquiry_restore','inquiry_consultant','inquiry_followup','response_update','branch_handoff','branch_owner_assign'],
  files:Object.fromEntries(['candidate.sql','rollback.sql','review.md'].map(file=>[file,sha256(file)]))
 };
 fs.writeFileSync(path.join(dir,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
 return manifest;
}

async function setup(){
 const db=await direct.setup();
 await db.exec(direct.approval+direct.candidate);
 return db;
}

module.exports={setup,candidate,rollback,dir,build};
if(require.main===module)console.log(JSON.stringify(build()));
