'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const dir=__dirname,root=path.resolve(dir,'../../..');
const names=['candidate.sql','rollback.sql','adapter-contract.js','review.md','contract.test.cjs','db.test.cjs'];
const sha=value=>crypto.createHash('sha256').update(value).digest('hex');
function build(){
 const manifest={
  project_ref:'rprechiaglyjaydkmxsu',
  status:'T01_BLOCKED_T02_CONTRACT_ONLY_T03_LOCAL_CANDIDATE_NOT_APPLIED',
  public_dispatcher_changed:false,operational_ui_changed:false,remote_calls:0,user_file_uploads:0,
  classification:{
   T01:'BLOCKED_STORAGE_PATH_ACL_SIGNER_CLEANUP',
   T02:'DERIVED_SAFE_CONTRACT_ONLY_BLOCKED_METADATA_RELATION',
   T03:'DERIVED_SAFE_LOCAL_PRIVATE_HELPER'
  },
  connected_operations:[],local_private_operations:['favorite_set','opportunity_touch'],
  files_sha256:Object.fromEntries(names.map(name=>[name,sha(fs.readFileSync(path.join(dir,name)))])),
  source_sha256:{
   golden_pc:sha(fs.readFileSync(path.join(root,'crm.html'))),
   golden_mobile:sha(fs.readFileSync(path.join(root,'mobile.html'))),
   staging_snapshot:sha(fs.readFileSync(path.join(root,'sql/inquiry-direct-assign/20260906/after.json'))),
   historical_candidate:sha(fs.readFileSync(path.join(root,'sql/20260905_attachments_favorites.sql'))),
   attachment_contract:sha(fs.readFileSync(path.join(root,'docs/operational-cutover-20260906/attachment-contracts.md')))
  }
 };
 fs.writeFileSync(path.join(dir,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');return manifest;
}
if(require.main===module){build();console.log('Attachment/state partial local candidate manifest generated; no deploy SQL generated.');}
module.exports={build};
