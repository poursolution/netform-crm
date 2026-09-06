'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const root=path.resolve(__dirname,'..');
const read=(...p)=>fs.readFileSync(path.join(root,...p),'utf8');
const pc=read('crm.html');
const mobile=read('mobile.html');
const legacy=read('sql','20260905_attachments_favorites.sql');
const snapshot=JSON.parse(read('sql','inquiry-direct-assign','20260906','after.json'));
const contract=read('docs','operational-cutover-20260906','attachment-contracts.md');
const preflight=JSON.parse(read('docs','operational-cutover-20260906','staging-attachment-preflight-20260906.json'));

test('PC and mobile expose the same prepare PUT complete upload sequence',()=>{
 for(const source of [pc,mobile]){
  assert.match(source,/['"]attachment_prepare['"]/);
  assert.match(source,/fetch\(url,\{method:'PUT'/);
  assert.match(source,/['"]attachment_complete['"]/);
  assert.match(source,/20\*1024\*1024|ATTACH_MAX_M/);
 }
});

test('current clients send display actor and repeated metadata, so the server must not trust them',()=>{
 for(const source of [pc,mobile]){
  assert.match(source,/uploaded_by:/);
  assert.match(source,/object_path:prep\.object_path/);
  assert.match(source,/file_name:meta\.file_name/);
  assert.match(source,/mime_type:meta\.mime_type/);
 }
 assert.match(contract,/클라이언트가 재전송한 file\/path\/actor 값은 권한 또는 정본으로 쓰지 않는다/);
});

test('legacy attachment SQL is evidence, not a can_deal or signed URL implementation',()=>{
 assert.match(legacy,/insert into storage\.buckets/);
 assert.match(legacy,/status text not null default 'pending'/);
 assert.match(legacy,/status in \('pending','ready','failed'\)/);
 assert.doesNotMatch(legacy,/can_deal\s*\(/i);
 assert.doesNotMatch(legacy,/upload_url|signed_url|createSignedUploadUrl/i);
 assert.match(contract,/과거 SQL은 현재 권한·receipt·Storage 계약을 충족하지 않는 후보/);
});

test('actual Staging snapshot has no public attachment metadata relation or functions',()=>{
 const relations=(snapshot.public.relations||[]).map(x=>x.name);
 const signatures=(snapshot.public.functions||[]).map(x=>x.signature);
 assert.equal(relations.includes('crm_attachments'),false);
 assert.equal(signatures.some(x=>/^public\.crm_attachment/.test(x)),false);
 assert.equal(signatures.some(x=>/^public\.crm_deal_attachments/.test(x)),false);
 assert.deepEqual(Object.keys(snapshot).sort(),['private','public']);
});

test('actual Staging read-only preflight proves there is no attachment storage foundation',()=>{
 assert.equal(preflight.project_ref,'rprechiaglyjaydkmxsu');
 assert.equal(preflight.mode,'READ_ONLY');
 assert.equal(preflight.verified.storage_bucket_count,0);
 assert.deepEqual(preflight.verified.attachment_metadata_relations,[]);
 assert.deepEqual(preflight.verified.attachment_functions,[]);
 assert.deepEqual(preflight.verified.storage_object_policies,[]);
 assert.equal(preflight.conclusion.t01_upload_ready,false);
 assert.equal(preflight.conclusion.t02_list_ready,false);
 assert.equal(preflight.writes_performed,0);
 assert.equal(preflight.production_requests,0);
 assert.equal(preflight.n8n_requests,0);
});

test('contract keeps can_deal and private on-demand URL boundaries explicit',()=>{
 assert.match(contract,/can_deal\(opportunity_id, true\)/);
 assert.match(contract,/can_deal\(opportunity_id, false\)/);
 assert.match(contract,/private bucket/);
 assert.match(contract,/on demand/);
 assert.match(contract,/목록에 `object_path`, raw Storage metadata, 영구 URL 또는 signed URL을 싣지 않는다/);
});

test('contract does not pretend activity or storage byte upload is DB-atomic',()=>{
 assert.match(contract,/Storage byte PUT은 이 transaction 밖/);
 assert.match(contract,/ready \+ audit \+ complete receipt/);
 assert.match(contract,/batch ID\/finalize/);
 assert.match(contract,/일부만 성공/);
});

test('download is not generally reachable in current attachment galleries',()=>{
 assert.match(pc,/function contextualOpenQuoteFile\(\)/);
 assert.match(pc,/download_url\|\|f\.downloadUrl\|\|f\.signed_url/);
 assert.doesNotMatch(mobile,/download_url|window\.open\(/);
 assert.match(contract,/NEEDS_VERIFICATION \/ reachable 아님/);
});

test('20 MiB and MIME remain multi-layer verification blockers',()=>{
 assert.match(legacy,/20971520/);
 assert.match(legacy,/allowed_mime_types/);
 assert.match(pc,/accept="image\/\*/);
 assert.match(mobile,/accept="image\/\*/);
 assert.match(contract,/`image\/\*`는 GIF\/SVG 등 더 넓/);
});
