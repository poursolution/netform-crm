'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const dir=__dirname,root=path.resolve(dir,'../../..'),sha=x=>crypto.createHash('sha256').update(x).digest('hex');
function build(){
 const files=['candidate.sql','rollback.sql','adapter-contract.js','fixtures.json','review.md','contract.test.cjs','db.test.cjs'];
 const manifest={project_ref:'rprechiaglyjaydkmxsu',status:'PUBLIC_CONNECT_BLOCKED_SELECTOR_REQUIRED',public_signature:'crm_read_scoped_v2(uuid,integer,uuid,uuid)',public_function_changed:false,connected_reads:[],
  proposed_discriminator:{name:'resource',values:['dashboard_source','mine_source'],applied:false},
  markers:{scope_completeness:'actor_authorized_rows_only',pagination:['complete','partial','has_more','next_cursor']},
  files_sha256:Object.fromEntries(files.map(n=>[n,sha(fs.readFileSync(path.join(dir,n)))])),
  source_sha256:{transport:sha(fs.readFileSync(path.join(root,'staging-operational/transport.js'))),overlay:sha(fs.readFileSync(path.join(root,'staging-operational/operational-overlay.js'))),private_fragment_candidate:sha(fs.readFileSync(path.join(root,'sql/operational-read-fragments/20260906/candidate.sql')))}};
 fs.writeFileSync(path.join(dir,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');return manifest;
}
if(require.main===module){build();console.log('Operational read compatibility gate generated; public connection remains blocked.');}
module.exports={build};
