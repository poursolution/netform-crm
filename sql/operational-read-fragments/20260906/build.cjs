'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const dir=__dirname,root=path.resolve(dir,'../../..'),sha=x=>crypto.createHash('sha256').update(x).digest('hex');
function build(){
 const names=['candidate.sql','rollback.sql','contract.js','fixtures.json','review.md','contract.test.cjs','db.test.cjs'];
 const manifest={project_ref:'rprechiaglyjaydkmxsu',status:'LOCAL_PRIVATE_FRAGMENTS_NOT_APPLIED',connected_operations:[],connected_reads:[],
  verdicts:{pc_dashboard_source:'DERIVED_SAFE_PRIVATE_FRAGMENT',mobile_mine:'DERIVED_SAFE_PRIVATE_FRAGMENT',pc_dashboard_kpi:'NEEDS_VERIFICATION',pc_performance:'NEEDS_VERIFICATION',pc_report:'NEEDS_VERIFICATION',pc_gyeongnam:'NEEDS_VERIFICATION',mobile_today:'NEEDS_VERIFICATION',mobile_control:'NEEDS_VERIFICATION',mobile_search:'NEEDS_VERIFICATION',c03_full_read:'NEEDS_VERIFICATION'},
  files_sha256:Object.fromEntries(names.map(n=>[n,sha(fs.readFileSync(path.join(dir,n)))])),
  source_sha256:{golden_pc:sha(fs.readFileSync(path.join(root,'crm.html'))),golden_mobile:sha(fs.readFileSync(path.join(root,'mobile.html'))),staging_snapshot:sha(fs.readFileSync(path.join(root,'sql/inquiry-direct-assign/20260906/after.json')))}};
 fs.writeFileSync(path.join(dir,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');return manifest;
}
if(require.main===module){build();console.log('Operational private read fragment manifest generated; no deploy SQL generated.');}
module.exports={build};
