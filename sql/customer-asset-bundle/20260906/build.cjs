'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const dir=__dirname,root=path.resolve(dir,'../../..'),sha=x=>crypto.createHash('sha256').update(x).digest('hex');
function build(){const names=['candidate.sql','rollback.sql','preflight.sql','staging-apply-checklist.md','adapter-contract.js','fixtures.json','review.md','contract.test.cjs','db.test.cjs'];const manifest={project_ref:'rprechiaglyjaydkmxsu',status:'LOCAL_STAGING_READY_PENDING_LIVE_PREFLIGHT_NOT_APPLIED',connected_operations:[],business_data_dml:false,live_preflight:{status:'LIVE_PREFLIGHT_REQUIRED',oid:null,do_not_guess_oid:true,comparison:'LF_NORMALIZED_DEFINITION_MD5',expected_definition_md5:'1a58be86503cb53bdc3a9a784eb4add2',expected_candidate_definition_md5:'7e811c93e73ba945a0dfea164da55fcd',expected_can_deal_definition_md5:'05d51a3c77344504a05a0e932cfcb15d',expected_owner:'postgres',expected_acl:'{postgres=X/postgres,authenticated=X/postgres}',expected_config:['search_path=""']},write_verdicts:{contact_upsert:'NEEDS_VERIFICATION',contact_relationship:'NEEDS_VERIFICATION',contact_move:'NEEDS_VERIFICATION'},read_verdicts:{deal_contact_timeline:'DERIVED_SAFE_LOCAL_READ',site_1n_timeline:'NEEDS_VERIFICATION'},files_sha256:Object.fromEntries(names.map(n=>[n,sha(fs.readFileSync(path.join(dir,n)))])),source_sha256:{golden_pc:sha(fs.readFileSync(path.join(root,'crm.html'))),golden_mobile:sha(fs.readFileSync(path.join(root,'mobile.html'))),staging_snapshot:sha(fs.readFileSync(path.join(root,'sql/inquiry-direct-assign/20260906/after.json'))),staging_preflight_dispatcher_read_only:sha(fs.readFileSync(path.join(root,'docs/operational-cutover-20260906/staging-preflight-20260906.json')))}};fs.writeFileSync(path.join(dir,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');return manifest;}
const buildBase=build;
function buildWithLiveEvidence(){
 const manifest=buildBase(),evidencePath=path.join(dir,'staging-preflight.json');
 if(fs.existsSync(evidencePath)){
  const evidence=JSON.parse(fs.readFileSync(evidencePath,'utf8'));
  manifest.status=evidence.matches_expected?'LOCAL_STAGING_READY_LIVE_PREFLIGHT_PASS_NOT_APPLIED':'STAGING_PREFLIGHT_DRIFT_BLOCKED_NOT_APPLIED';
  manifest.live_preflight.status=evidence.matches_expected?'PASS':'DRIFT_DETECTED';
  manifest.live_preflight.oid=evidence.function?.oid??null;
  manifest.live_preflight.actual_definition_md5=evidence.function?.definition_md5??null;
  manifest.live_preflight.actual_definition_md5_lf=evidence.function?.definition_md5_lf??null;
  manifest.live_preflight.actual_can_deal_definition_md5=evidence.can_deal_definition_md5??null;
  manifest.live_preflight.actual_can_deal_definition_md5_lf=evidence.can_deal_definition_md5_lf??null;
  manifest.live_preflight.raw_definition_diff_explained=evidence.raw_definition_diff_explained??null;
  manifest.read_verdicts.deal_contact_timeline=evidence.matches_expected?'DERIVED_SAFE_LOCAL_READ':'DERIVED_SAFE_LOCAL_READ_STAGING_DRIFT_BLOCKED';
  manifest.files_sha256['staging-preflight.json']=sha(fs.readFileSync(evidencePath));
  fs.writeFileSync(path.join(dir,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
 }
 return manifest;
}
if(require.main===module){const manifest=buildWithLiveEvidence();console.log(`Customer asset manifest: ${manifest.status}.`);}
module.exports={build:buildWithLiveEvidence};
