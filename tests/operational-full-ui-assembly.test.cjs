'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const builder=require('../scripts/build-operational-full-ui.cjs');

const hash=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');

test('31-op UI assembly preserves sources and removes n8n/Production endpoints',()=>{
 const sourceHashes=Object.fromEntries(['index.html','crm.html','mobile.html'].map(file=>[file,hash(path.join(builder.base,file))]));
 const manifest=builder.build();
 assert.equal(manifest.status,'LOCAL_31_OP_UI_ASSEMBLED_NOT_DEPLOYED');
 assert.equal(manifest.operation_count,31);
 assert.equal(new Set(manifest.connected_operations).size,31);
 assert.deepEqual(manifest.forbidden_references,{n8n:0,production_ref:0});
 for(const file of ['index.html','crm.html','mobile.html'])assert.equal(hash(path.join(builder.base,file)),sourceHashes[file]);
 assert.match(fs.readFileSync(path.join(builder.out,'crm.html'),'utf8'),/function inquiryTextOf\(q\).*rawText/);
});

test('assembled pages load config, full adapter, transport and overlay in safe order',()=>{
 const manifest=builder.build();
 for(const file of ['index.html','crm.html','mobile.html']){
  const html=fs.readFileSync(path.join(builder.out,file),'utf8'),page=manifest.pages[file];
  assert.ok(page.config_index<page.adapter_index&&page.adapter_index<page.transport_index);
  assert.doesNotMatch(html,/nfrnd\.app\.n8n\.cloud|ymfbmpnizxvqsamnczow/);
  if(file==='index.html')assert.equal(page.overlay_index,null);
  else assert.ok(page.transport_index<page.overlay_index&&page.overlay_index<page.body_end);
 }
});

test('assembled assets are byte-identical to the Staging-tested 31-op candidate',()=>{
 const manifest=builder.build();
 for(const key of ['adapter','overlay','transport'])assert.equal(manifest.output_sha256[key],manifest.source_sha256[key]);
 const adapter=require('../sql/operational-full-local-candidate/20260906/operational-adapter.candidate.js');
 assert.equal(adapter.operations.length,30);
 for(const operation of manifest.connected_operations.filter(operation=>operation!=='expansion_note'))assert.ok(adapter.operations.includes(operation),operation);
 assert.match(fs.readFileSync(path.join(builder.out,'transport.js'),'utf8'),/'crm_expansion_note'/);
 assert.equal(manifest.local_browser_revalidation_required,true);
 assert.equal(manifest.staging_deployment_performed,false);
 assert.equal(manifest.production_accessed,false);
 assert.equal(manifest.n8n_accessed,false);
});

test('pipeline keeps the two-revisions-back surface while preserving compatibility handlers',()=>{
 const manifest=builder.build();
 const source=fs.readFileSync(path.join(builder.base,'crm.html'),'utf8');
 const assembled=fs.readFileSync(path.join(builder.out,'crm.html'),'utf8');
 for(const html of [source,assembled]){
  assert.match(html,/pipeFiltered=function\(\)\{return _rmPipeFiltered\(\)\}/);
  assert.match(html,/paintPipe=function\(\)\{_rmPaintPipe\(\)\}/);
  assert.match(html,/function relationshipKb5Card\(/);
  assert.match(html,/detailTabFocus=_dccDetailTabFocus/);
  assert.match(html,/renderDetail=_dccRenderDetail/);
  assert.match(html,/G\.page==='pipe'\?'':'<span class="work-filter">/);
  assert.match(html,/D\.slice\(0,120\)\.map\(function\(d\)/);
  assert.match(html,/우선순위 상위 120건 표시/);
  const quick=html.slice(html.indexOf('function quickPanelHTML'),html.indexOf('function paintSplit()',html.indexOf('function quickPanelHTML')));
  assert.doesNotMatch(quick,/dealWorkSummary/);
  assert.match(quick,/<\/p><strong>/);
  assert.match(html,/function relationshipFilterBar\(/);
  assert.match(html,/function dccDecorateDetail\(/);
 }
 assert.equal(manifest.status,'LOCAL_31_OP_UI_ASSEMBLED_NOT_DEPLOYED');
});
