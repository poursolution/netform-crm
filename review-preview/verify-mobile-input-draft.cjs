'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const factory=require('../mobile-input-draft.js'),modelFactory=require('../mobile-input-review-model.js');
const ID='11111111-1111-4111-8111-111111111111',OTHER='22222222-2222-4222-8222-222222222222',checks=[];
function rig(shared,initialEpoch=0){
 const data=shared||new Map(),events=new Map();let at=1000000,epoch=initialEpoch,io=0,failSet=false,failRemove=false,verifyBad=false;
 const storage={get length(){return data.size;},key:i=>[...data.keys()][i]??null,getItem:key=>data.get(key)??null,setItem(key,value){if(failSet)throw Error('Quota');data.set(key,verifyBad?'unverified':String(value));},removeItem(key){if(failRemove)throw Error('Storage unavailable');data.delete(key);}};
 const root={Phase1:{profile:{auth_uid:ID,user_id:ID}},G:{user:'담당자',mode:'rep',deal:ID},DEMO:true,sessionStorage:storage,addEventListener:(key,fn)=>{if(!events.has(key))events.set(key,new Set());events.get(key).add(fn);},removeEventListener:(key,fn)=>events.get(key)?.delete(fn),fetch(){io++;throw Error('No network');},pushWrite(){io++;throw Error('No operations');}};
 const owner=()=>{const p=root.Phase1.profile;return p?p.auth_uid+':'+p.user_id:'';};root.MobileSaveJournal={owner,session:()=>owner()?owner()+':'+epoch:''};
 const deal={id:ID,version:3,code:'consulting',site_id:OTHER,contacts:[],nextAction:{id:OTHER,text:'기존 방문',due:'2026-10-15'}},deals=[deal];root.myDeals=()=>deals;
 root.MobileInputReviewModel=modelFactory(root);const api=factory(root,{now:()=>at});
 const bind=()=>root.MobileInputReviewModel.bind(deal),create=()=>api.create(deal,bind());
 return {root,deal,deals,data,storage,api,bind,create,io:()=>io,event:key=>[...(events.get(key)||[])].forEach(fn=>fn()),at:n=>{at=n;},epoch:n=>{epoch=n;},failSet:v=>{failSet=v;},failRemove:v=>{failRemove=v;},verifyBad:v=>{verifyBad=v;},listeners:()=>[...events.values()].reduce((sum,set)=>sum+set.size,0)};
}
const input=(extra={})=>({screen:'I-2',draft:{transcript:'기존 초안에 반영 전인 말하기 결과',manuallyEdited:true,selectedIds:['candidate-0']},session:{state:'ended',text:'담당자가 말한 후보',truncated:false},originStamp:'{"memo":"기존 상담","mode":"keep"}',...extra});
function record(r){return JSON.parse([...r.data.values()][0]);}
{
 const r=rig(),handle=r.create(),before=JSON.stringify(r.deals),raw='직접 수정할 긴 후보 '.repeat(80);assert(handle.ok);assert.equal(r.data.size,0);
 const value=input({draft:{transcript:raw,fields:{phone:'O'.repeat(180)},selectedIds:['candidate-0','candidate-1'],manuallyEdited:true}});assert(raw.length>300);assert(handle.write(value).ok);
 const got=handle.read();assert(got.ok);assert.equal(got.value.draft.transcript,raw);assert.deepEqual(got.value.draft.fields,value.draft.fields);assert.deepEqual(got.value.draft.selectedIds,value.draft.selectedIds);assert.equal(got.value.originStamp,value.originStamp);assert.equal(got.kind,'unsent-input-draft');assert.equal(got.pendingOperation,false);assert.equal(got.status,'unsent');assert.equal(record(r).expiresAt-record(r).at,1800000);assert.equal(JSON.stringify(r.deals),before);assert.equal(r.io(),0);
 got.value.draft.transcript='외부 수정';assert.equal(handle.read().value.draft.transcript,raw);
 checks.push('Text above300 characters, raw invalid fields, selected IDs, I screen and D origin stamp round-trip in an unsent tab draft without touching data, work or requests');
}
{
 const r=rig(),handle=r.create();assert(handle.write(input()).ok);r.event('pagehide');assert.equal(r.data.size,1);
 assert(handle.release().ok);assert.equal(handle.write(input()).error,'INPUT_DRAFT_DISPOSED');assert.equal(r.data.size,1);
 const reload=rig(r.data),restored=reload.create().read();assert(restored.ok);assert.equal(restored.value.draft.transcript,input().draft.transcript);assert.equal(restored.value.originStamp,input().originStamp);
 // Runtime epochs are not durable authentication sessions: mismatch is rejected, never rebound.
 const changed=rig(r.data,1),next=changed.create();assert(next.ok);assert.equal(next.read().error,'INPUT_DRAFT_CONTEXT_CHANGED');assert.equal(r.data.size,0);
 checks.push('Same-account same-session reload recovers text; page exit alone keeps it, while a different runtime session token is rejected rather than silently rebound');
}
{
 const r=rig(),handle=r.create();handle.write(input());r.at(2800000);const expired=handle.read();assert.equal(expired.ok,true);assert.equal(expired.value,null);assert.equal(expired.expired,true);assert.equal(r.data.size,0);
 const x=rig(),h=x.create();h.write(input());x.at(2000000);h.read();x.at(2800000);assert.equal(h.read().expired,true);
 checks.push('Draft TTL is30minutes after the last write; reads do not extend it and expired text is removed');
}
{
 for(const session of [{state:'listening',text:'말하던 중',interimText:'끝나지 않은 부분'},{state:'stopping',text:'멈추는 중',finalText:'완료 조각'},{state:'error',text:'부분 결과',partialSpeech:true,needsReview:true}]){
  const r=rig(),h=r.create();assert(h.write(input({session})).ok);const got=h.read();assert(got.ok);assert.equal(got.value.session.state,'error');assert.equal(got.value.session.error,'VOICE_DRAFT_INTERRUPTED');assert.equal(got.value.session.partialSpeech,true);assert.equal(got.value.session.needsReview,true);assert.equal(got.value.draft.manuallyEdited,false);assert.equal(got.value.session.truncated,undefined);
 }
 const r=rig(),h=r.create();h.write(input({session:{state:'ended',text:'잘린 결과',truncated:true}}));assert.equal(h.read().value.session.truncated,true);
 checks.push('In-progress and partial dictation recovers as interrupted, explicitly requiring review; it never fabricates completion, date confirmation or a truncation reason');
}
{
 for(const type of ['version','schedule','removed']){
  const r=rig(),h=r.create();h.write(input());const before=[...r.data];if(type==='version')r.deal.version++;if(type==='schedule')r.deal.nextAction.due='2026-10-16';if(type==='removed')r.deals.length=0;
  assert.equal(h.read().error,'INPUT_DRAFT_BINDING_STALE',type);assert.equal(h.write(input()).error,'INPUT_DRAFT_BINDING_STALE',type);assert.equal(h.drop().error,'INPUT_DRAFT_BINDING_STALE',type);assert.deepEqual([...r.data],before);
  if(type!=='removed'){
   const newer=r.create();assert.equal(newer.read().error,'INPUT_DRAFT_CONTEXT_CHANGED');assert.deepEqual([...r.data],before);
   assert.equal(newer.write(input({draft:{transcript:'새 화면의 빈 초안'}})).error,'INPUT_DRAFT_CONTEXT_CHANGED');assert.equal(newer.drop().error,'INPUT_DRAFT_CONFLICT');assert.equal(newer.dispose().error,'INPUT_DRAFT_CONFLICT');assert.deepEqual([...r.data],before);
   // A failed dispose must not close the handle. Re-reading still reports the
   // scope mismatch, rather than discarding the preserved text or the handle.
   assert.equal(newer.read().error,'INPUT_DRAFT_CONTEXT_CHANGED');assert(newer.release().ok);assert.deepEqual([...r.data],before);
   // Expiry remains effective even when the current deal fingerprint differs.
   r.at(2800000);const afterExpiry=r.create();assert.equal(afterExpiry.read().expired,true);assert.equal(r.data.size,0);assert(afterExpiry.write(input()).ok);const newText=[...r.data];assert.equal(h.drop().error,'INPUT_DRAFT_BINDING_STALE');assert.deepEqual([...r.data],newText);
  }
 }
 checks.push('Changed deal version/schedule preserves unsent text on reopen while read/write/drop/dispose reject adoption or replacement; stale handles cannot delete it, and30minute expiry still clears it');
}
{
 for(const type of ['event-owner','silent-owner','same-owner-session','logout']){
  const r=rig(),h=r.create();h.write(input());r.data.set('crm:mobile-save:v1:unrelated','preserve');
  if(type==='same-owner-session'){r.epoch(2);r.event('phase1:profile');}
  else if(type==='logout'){r.root.Phase1.profile=null;r.event('phase1:identity-cleared');}
  else{r.root.Phase1.profile={auth_uid:OTHER,user_id:OTHER};if(type==='event-owner')r.event('phase1:profile');else h.read();}
  assert.equal([...r.data.keys()].filter(k=>k.startsWith(r.api.prefix)).length,0,type);assert.equal(r.data.get('crm:mobile-save:v1:unrelated'),'preserve');assert.equal(h.write(input()).ok,false);
 }
 checks.push('Account switches, same-account session changes and logout clear only this input-draft namespace and invalidate old writers');
}
{
 const r=rig(),a=r.create(),b=r.create();assert(a.write(input()).ok);assert.equal(b.write(input({draft:{transcript:'오래된 화면'}})).error,'INPUT_DRAFT_CONFLICT');assert.equal(b.drop().error,'INPUT_DRAFT_CONFLICT');assert(b.read().ok);assert(b.write(input({draft:{transcript:'읽은 뒤 명시적 변경'}})).ok);assert.equal(a.write(input()).error,'INPUT_DRAFT_CONFLICT');
 assert(b.dispose().ok);assert.equal(r.data.size,0);assert.equal(b.write(input()).error,'INPUT_DRAFT_DISPOSED');assert(r.api.dispose().ok);assert.equal(r.listeners(),0);assert.equal(r.api.create(r.deal,r.bind()).error,'INPUT_DRAFT_DISPOSED');
 checks.push('Concurrent stale writers and removers cannot replace a newer draft; explicit disposal removes its draft and closes the writer');
}
{
 const r=rig(),a=r.create(),b=r.create();assert(a.write(input()).ok);assert(b.read().ok);assert(b.write(input({draft:{transcript:'다른 핸들의 최신 입력'}})).ok);
 assert.equal(a.dispose().error,'INPUT_DRAFT_CONFLICT');assert.equal(a.read().value.draft.transcript,'다른 핸들의 최신 입력');assert(a.write(input({draft:{transcript:'최신 입력을 읽은 후 고친 내용'}})).ok);
 const preserved=[...r.data];assert(a.release().ok);assert.deepEqual([...r.data],preserved);assert.equal(a.read().error,'INPUT_DRAFT_DISPOSED');
 checks.push('A failed concurrent dispose keeps the handle usable for an explicit refresh/retry; release closes it without removing the preserved draft');
}
{
 const r=rig(),h=r.create();assert(h.write(input()).ok);const before=[...r.data];r.failRemove(true);
 assert.equal(h.dispose().error,'INPUT_DRAFT_STORAGE_UNAVAILABLE');assert.deepEqual([...r.data],before);assert.equal(h.read().value.draft.transcript,input().draft.transcript);
 r.failRemove(false);assert(h.dispose().ok);assert.equal(r.data.size,0);assert.equal(h.read().error,'INPUT_DRAFT_DISPOSED');
 checks.push('Storage removal failure retains both the draft and a usable handle; retrying explicit disposal succeeds after storage recovers');
}
{
 const r=rig(),speech=r.create(),card=r.api.create(r.deal,r.bind(),{kind:'card'}),recognized={name:'홍길동',role:'관리과장',mobile:'010-12O4-5678',office:'031-000-0000',email:'office@example.test',note:'명함에서 읽은 후보'};
 assert(speech.write(input()).ok);const value={screen:'I-3',draft:{fields:{phone:'01012345678'},recognized},session:{state:'idle'}};assert(card.write(value).ok);assert.equal(r.data.size,2);
 assert.equal(speech.read().value.draft.transcript,input().draft.transcript);assert.deepEqual(card.read().value.draft.recognized,recognized);assert.equal(card.read().value.draft.fields.phone,'01012345678');
 assert.equal(speech.write(value).error,'INPUT_DRAFT_VALUE_INVALID');assert.equal(card.write(input()).error,'INPUT_DRAFT_VALUE_INVALID');
 const before=[...r.data];for(const changed of [{company:'추가 필드 금지'},{image:'data:image/png;base64,AA=='},{name:'가'.repeat(501)},{note:'가'.repeat(2001)}]){assert.equal(card.write({...value,draft:{recognized:{...recognized,...changed}}}).error,'INPUT_DRAFT_VALUE_INVALID');assert.deepEqual([...r.data],before);}
 speech.release();card.release();const reload=rig(r.data);assert.equal(reload.create().read().value.draft.transcript,input().draft.transcript);assert.deepEqual(reload.api.create(reload.deal,reload.bind(),{kind:'card'}).read().value.draft.recognized,recognized);
 const restoredSpeech=reload.create();assert(restoredSpeech.dispose().ok);assert.equal(r.data.size,1);assert(reload.api.create(reload.deal,reload.bind(),{kind:'card'}).read().ok);
 checks.push('Speech and card drafts for one deal remain independent across reload/disposal; recognized card text stays distinct from manual changes and accepts only six bounded text fields');
}
{
 const r=rig(),h=r.create();assert(h.write(input()).ok);const before=[...r.data];
 for(const invalid of [input({audio:new Uint8Array([1])}),input({image:'data:image/png;base64,AA=='}),input({draft:{transcript:'가'.repeat(10001)}}),input({draft:{fields:{phone:'0'.repeat(2001)}}}),input({draft:{selectedIds:['same','same']}}),input({draft:{dateConfirmed:true,confirmedDate:'2026-10-15'}}),input({session:{state:'listening',rawAudio:'abc'}}),input({originStamp:'x'.repeat(20001)}),input({screen:'D'})]){assert.equal(h.write(invalid).error,'INPUT_DRAFT_VALUE_INVALID');assert.deepEqual([...r.data],before);}
 checks.push('Only bounded text, field candidates, IDs and review flags are persisted; audio/images, opaque handles, dates, duplicate IDs and oversized payloads are rejected without replacing the prior draft');
}
{
 const r=rig(),h=r.create();h.write(input());const before=[...r.data];r.failSet(true);assert.equal(h.write(input({draft:{transcript:'저장 실패 후보'}})).error,'INPUT_DRAFT_STORAGE_UNAVAILABLE');assert.deepEqual([...r.data],before);r.failSet(false);assert.equal(h.read().value.draft.transcript,input().draft.transcript);
 const x=rig(),bad=x.create();x.verifyBad(true);assert.equal(bad.write(input()).error,'INPUT_DRAFT_VERIFY_FAILED');assert.equal(bad.read().error,'INPUT_DRAFT_CORRUPT');
 const z=rig(),zh=z.create();zh.write(input());const key=[...z.data.keys()][0],row=record(z);row.owner=OTHER;z.data.set(key,JSON.stringify(row));assert.equal(zh.read().error,'INPUT_DRAFT_CORRUPT');assert.equal(zh.write(input()).error,'INPUT_DRAFT_CONFLICT');
 checks.push('Storage quota/readback and corrupted records fail explicitly; an unverified or foreign payload is never reported as recovered or overwritten silently');
}
{
 const r=rig(),h=r.create(),base=r.storage.setItem;r.storage.setItem=(key,value)=>{base(key,value);r.root.Phase1.profile={auth_uid:OTHER,user_id:OTHER};};
 assert.equal(h.write(input()).error,'INPUT_DRAFT_CONTEXT_CHANGED');assert.equal(r.data.size,0);assert.equal(r.io(),0);
 checks.push('An identity change during the storage operation invalidates the write and removes the draft instead of returning a false saved acknowledgement');
}
const report={at:new Date().toISOString(),passed:checks.length,checks,boundary:'Focused tests use synthetic sessionStorage, identity, authorized deal and the actual input read-model. No microphone, audio/image, OCR, server write, work queue, UI or deployment. Runtime MobileSaveJournal epochs are not persisted; changed epochs intentionally reject recovery.'};
fs.writeFileSync(path.join(__dirname,'mobile-input-draft-verification.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
