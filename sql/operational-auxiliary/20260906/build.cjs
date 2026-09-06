'use strict';
const crypto=require('node:crypto'),fs=require('node:fs'),path=require('node:path');
const dir=__dirname,root=path.resolve(dir,'../../..');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const files=['adapter-contract.js','candidate.sql','rollback.sql','review.md','contract.test.cjs'];
const manifest={
  project_ref:'rprechiaglyjaydkmxsu',
  status:'LOCAL_CONTRACT_REVIEW_NOT_DEPLOYED',
  connected_operations:[],
  database_candidates:[],
  safe_local_contracts:['O03'],
  verdicts:{X01:'NEEDS_VERIFICATION',X02:'NEEDS_VERIFICATION',X03:'NEEDS_VERIFICATION',A05:'NEEDS_VERIFICATION',O01:'NEEDS_VERIFICATION',O02:'NEEDS_VERIFICATION',O03:'CONFIRMED_LOCAL_ONLY',O04:'NEEDS_VERIFICATION',O05:'NEEDS_VERIFICATION_REACHABLE_MOCK',O06:'NEEDS_VERIFICATION_REACHABLE_MOCK'},
  files_sha256:Object.fromEntries(files.map(n=>[n,sha(fs.readFileSync(path.join(dir,n)))])),
  evidence_sha256:{
    golden_pc:sha(fs.readFileSync(path.join(root,'crm.html'))),
    golden_mobile:sha(fs.readFileSync(path.join(root,'mobile.html'))),
    expansion_pool:sha(fs.readFileSync(path.join(root,'expansion-pool.js'))),
    expansion_flow:sha(fs.readFileSync(path.join(root,'expansion-flow.js'))),
    cleanup_ui:sha(fs.readFileSync(path.join(root,'data-cleanup-ui.js'))),
    export_ui:sha(fs.readFileSync(path.join(root,'crm-export.js'))),
    staging_snapshot:sha(fs.readFileSync(path.join(root,'sql/inquiry-direct-assign/20260906/after.json')))
  }
};
fs.writeFileSync(path.join(dir,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
console.log(JSON.stringify(manifest,null,2));
