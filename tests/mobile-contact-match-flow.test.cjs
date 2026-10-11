'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const makeModel=require('../mobile-input-review-model.js');
const code=fs.readFileSync(path.join(__dirname,'../mobile-input-flow.js'),'utf8');
const ID='11111111-1111-4111-8111-111111111111',OTHER='22222222-2222-4222-8222-222222222222',SITE='33333333-3333-4333-8333-333333333333',CONTACT='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const clone=x=>JSON.parse(JSON.stringify(x)),tick=()=>new Promise(r=>setImmediate(r));
function deferred(){let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};}
function fixture({demo=false,recovered=null}={}){
 const d={id:ID,version:1,code:'consulting',nm:'합성 현장',work_type:'외벽 재도장',site_id:SITE,contacts:[]},other={...clone(d),id:OTHER,nm:'다른 합성 현장'},note={textContent:'처음 상태'},timers=new Map(),events={},calls=[],ocrCalls=[],persisted=[],pickers=[];
 let sequence=0,epoch=0,paintCount=0,rendered;
 const root={DEMO:demo,LIVE:!demo,G:{mode:'rep',user:{nm:'합성 담당'},deal:ID},Phase1:{profile:{auth_uid:ID,user_id:ID}},myDeals:()=>[d,other],MobileGuideShell:{state:{detailView:'input'}},isSecureContext:true,
  MobileApprovedInputSource:{'I-1':true,'I-2':true,'I-3':true},MobileApprovedInput:{render:(screen,m)=>{rendered=m;return JSON.stringify(m);}},MobileVoiceSession:{create(){throw Error('No speech may start in contact lookup tests');}},
  MobileInputDraft:{create:()=>({ok:true,read:()=>({ok:true,value:recovered?clone(recovered):null}),write:value=>{persisted.push(clone(value));return{ok:true};},dispose(){},release(){}})},
  setTimeout:fn=>{const id=++sequence;timers.set(id,fn);return id;},clearTimeout:id=>timers.delete(id),addEventListener:(name,fn)=>events[name]=fn,toast(){},closeSheet(){},
  document:{querySelector:selector=>selector==='[data-contact-match-note]'?note:null,body:{append(){}},createElement(){const node={files:[],handlers:{},setAttribute(){},addEventListener:(name,fn)=>node.handlers[name]=fn,remove(){node.removed=true;},click(){}};pickers.push(node);return node;}},
  ContactMatchReader:{read:args=>{const pending=deferred(),call={args,pending};calls.push(call);return pending.promise;}},
  MobileCardRecognition:{capabilities:()=>({supported:true}),recognize:args=>{const pending=deferred();ocrCalls.push({args,pending});return pending.promise;}},
  fetch(){throw Error('Network is forbidden in these tests');},pushWrite(){throw Error('Business writes are forbidden in these tests');}
 };
 root.MobileSaveJournal={owner:()=>root.Phase1.profile.auth_uid+':'+root.Phase1.profile.user_id,session:()=>root.MobileSaveJournal.owner()+':'+epoch};
 root.MobileInputReviewModel=makeModel(root);root.render=()=>{paintCount++;root.MobileInputFlow.render(root.myDeals().find(x=>x.id===root.G.deal));};
 vm.runInNewContext(code,{window:root,AbortController,console});
 const flow=root.MobileInputFlow;
 assert.equal(flow.open(d,'I-3'),true);
 const read=()=>{const html=flow.render(root.myDeals().find(x=>x.id===root.G.deal));return html?JSON.parse(html):null;};
 const input=(value,key='phone')=>{const result=flow.input(d,key,value);if(result.model)note.textContent=result.model.duplicateNote;return result;};
 const flush=async()=>{for(const [id,fn]of [...timers]){timers.delete(id);void fn();}await tick();};
 const reply=(call,total=1,overrides={})=>({ok:true,status:'ready',contract:'contact-match-read-v1',actor_auth_uid:ID,actor_user_id:ID,object_id:call.args.dealId,object_version:call.args.expectedVersion,phone:call.args.phone,scope:'authorized_deals_only',page:1,page_size:20,total,has_more:false,candidates:total?[{contactId:CONTACT,name:'합성 일치 후보',sites:[],canLink:false}]:[],...overrides});
 const photo=()=>{assert.equal(flow.handle(d,'input-card-photo').ok,true);const picker=pickers.at(-1);picker.files=[{name:'synthetic-card.png'}];picker.handlers.change();};
 return {root,d,other,note,timers,calls,ocrCalls,persisted,flow,read,input,flush,reply,photo,events,paintCount:()=>paintCount,nextEpoch:()=>epoch++,rendered:()=>rendered};
}
test('valid phone lookup is debounced, normalized and read-only, while invalid input never queries',async()=>{
 const x=fixture();x.input('010-12O4-5678');await x.flush();assert.equal(x.calls.length,0);assert.match(x.read().duplicateNote,/번호를 확인/);
 x.input('01011112222');x.input('+82 10-3333-4444');assert.equal(x.calls.length,0);assert.equal(x.timers.size,1);assert.match(x.read().duplicateNote,/확인하는 중/);
 await x.flush();assert.equal(x.calls.length,1);const call=x.calls[0];assert.equal(call.args.phone,'01033334444');assert.equal(call.args.dealId,ID);assert.equal(call.args.expectedVersion,1);assert.equal(call.args.page,1);assert.equal(call.args.isCurrent(),true);
 const before=x.paintCount();call.pending.resolve(x.reply(call));await tick();assert.equal(x.read().duplicates.length,1);assert.match(x.note.textContent,/후보 1명/);assert.equal(x.paintCount(),before);assert.equal(x.read().canSave,false);assert.deepEqual(x.d.contacts,[]);
});
test('phone changes invalidate visible old candidates immediately and reject out-of-order completion',async()=>{
 const x=fixture();x.input('01011112222');await x.flush();const a=x.calls[0];a.pending.resolve(x.reply(a,2));await tick();assert.match(x.read().duplicateNote,/2명/);
 const result=x.input('01033334444');assert.equal(result.model.duplicates.length,0);assert.match(result.model.duplicateNote,/확인하는 중/);await x.flush();const b=x.calls[1];
 x.input('01055556666');assert.equal(b.args.signal.aborted,true);assert.equal(b.args.isCurrent(),false);await x.flush();const c=x.calls[2];c.pending.resolve(x.reply(c,1));await tick();const current=x.note.textContent;b.pending.resolve(x.reply(b,9));await tick();assert.equal(x.note.textContent,current);assert.equal(x.read().duplicates.length,1);assert.match(x.read().duplicateNote,/1명/);
});
test('changing display punctuation of the same normalized phone neither clears nor repeats lookup',async()=>{
 const x=fixture();x.input('01011112222');await x.flush();const call=x.calls[0];x.input('+82 10-1111-2222');await x.flush();assert.equal(x.calls.length,1);assert.equal(call.args.signal.aborted,false);
 call.pending.resolve(x.reply(call));await tick();x.input('010 1111 2222');await x.flush();assert.equal(x.calls.length,1);assert.match(x.read().duplicateNote,/후보 1명/);
});
test('clearing or invalidating a phone cancels the lookup and cannot report no duplicates',async()=>{
 for(const value of ['', '010-11O1-2222', '01011112222'+' '.repeat(50)]){
  const x=fixture();x.input('01011112222');await x.flush();const call=x.calls[0];const output=x.input(value);assert.equal(call.args.signal.aborted,true);assert.equal(output.model.duplicates.length,0);assert.equal(output.model.coverage,'unknown');const before=x.note.textContent;
  call.pending.resolve(x.reply(call));await tick();assert.equal(x.note.textContent,before);assert.equal(x.read().canSave,false);assert.equal(x.timers.size,0);
 }
});
for(const [name,change]of Object.entries({
 'account swap without event':x=>{x.root.Phase1.profile={auth_uid:OTHER,user_id:OTHER};},
 'session epoch change':x=>x.nextEpoch(),
 'deal version change':x=>x.d.version++,
 'another active deal':x=>{x.root.G.deal=OTHER;},
 'leave input route':x=>{x.root.MobileGuideShell.state.detailView='';},
 'explicit reset':x=>x.flow.reset({discard:true}),
 'identity-cleared event':x=>x.events['phase1:identity-cleared'](),
 'pagehide':x=>x.events.pagehide()
}))test('late lookup cannot update the note after '+name,async()=>{
 const x=fixture();x.input('01011112222');await x.flush();const call=x.calls[0];change(x);const before=x.note.textContent,paints=x.paintCount();assert.equal(call.args.isCurrent(),false);
 call.pending.resolve(x.reply(call,7));await tick();assert.equal(x.note.textContent,before);assert.equal(x.paintCount(),paints);
});
test('closing and reopening the same deal rejects the previous flow instance',async()=>{
 const x=fixture();x.input('01011112222');await x.flush();const old=x.calls[0];x.flow.reset({discard:true});assert.equal(x.flow.open(x.d,'I-3'),true);x.input('01011112222');await x.flush();const current=x.calls[1];
 old.pending.resolve(x.reply(old,8));await tick();assert.match(x.read().duplicateNote,/확인하는 중/);current.pending.resolve(x.reply(current,0));await tick();assert.match(x.note.textContent,/후보 0명/);assert.match(x.note.textContent,/全|전체 연락처가 없다는 뜻은 아닙니다/);
});
test('failed, thrown and malformed receipts stay unknown rather than showing zero matches',async()=>{
 for(const failure of ['failure','throw','wrong-target','wrong-actor','wrong-phone']){
  const x=fixture();x.input('01011112222');await x.flush();const call=x.calls[0];
  if(failure==='throw')call.pending.reject(Error('offline'));
  else call.pending.resolve(failure==='failure'?{ok:false,error:'OFFLINE'}:x.reply(call,0,failure==='wrong-target'?{object_id:OTHER}:failure==='wrong-actor'?{actor_auth_uid:OTHER}:{phone:'01099998888'}));
  await tick();const m=x.read();assert.equal(m.coverage,'unknown',failure);assert.equal(m.duplicates.length,0);assert.doesNotMatch(m.duplicateNote,/후보 0명/);assert.equal(m.canSave,false);
 }
});
test('lookup result is never stored in the input draft or recovered as a checked match',async()=>{
 const x=fixture();x.input('01011112222');await x.flush();const call=x.calls[0],before=clone(x.persisted);call.pending.resolve(x.reply(call));await tick();assert.deepEqual(x.persisted,before);
 x.input('직접 수정한 이름','name');x.flow.reset();assert.doesNotMatch(JSON.stringify(x.persisted),/contactMatch|authorized_deals_only|합성 일치 후보/);
 const y=fixture({recovered:x.persisted.at(-1)});assert.match(y.read().duplicateNote,/확인하는 중/);await y.flush();assert.equal(y.calls.length,1);assert.equal(y.calls[0].args.phone,'01011112222');
});
test('DEMO never calls the reader; only canonical contact UUIDs count in loaded examples',async()=>{
 const x=fixture({demo:true});x.flow.reset({discard:true});x.d.contacts=[{id:CONTACT,mobile:'01011112222',name:'같은 사람'},{id:CONTACT.toUpperCase(),mobile:'01011112222',name:'같은 사람 대문자'},{person_key:'mobile:01011112222',mobile:'01011112222',name:'ID 없는 투영'}];x.other.contacts=[{contact_id:CONTACT,mobile:'01011112222',name:'다른 현장 같은 사람'}];assert.equal(x.flow.open(x.d,'I-3'),true);
 x.input('01011112222');await x.flush();assert.equal(x.calls.length,0);const m=x.read();assert.equal(m.duplicates.length,1);assert.equal(m.duplicates[0].sites.length,2);assert.equal(m.duplicates[0].contactId,CONTACT);assert.match(m.duplicateNote,/예시/);assert.equal(m.canSave,false);
});
test('re-OCR aborts the old phone result, retains explicit edits and starts a fresh candidate read',async()=>{
 const x=fixture();x.input('직접 확인한 이름','name');x.input('01011112222');await x.flush();const old=x.calls[0];x.photo();assert.equal(old.args.signal.aborted,true);assert.equal(x.ocrCalls.length,1);assert.equal(x.read().duplicates.length,0);assert.equal(x.read().busy,true);
 const prior=x.note.textContent;old.pending.resolve(x.reply(old,9));await tick();assert.equal(x.note.textContent,prior);
 x.ocrCalls[0].pending.resolve({ok:true,suggestion:{name:'새 사진 이름',role:'관리소장',mobile:'01033334444',note:''}});await tick();const m=x.read();assert.equal(m.fields.find(f=>f.id==='name').value,'직접 확인한 이름');assert.equal(m.fields.find(f=>f.id==='phone').value,'01011112222');assert.match(m.helper,/직접 고친 값은 유지/);assert.equal(m.canSave,false);
 await x.flush();assert.equal(x.calls.length,2);assert.equal(x.calls[1].args.phone,'01011112222');x.calls[1].pending.resolve(x.reply(x.calls[1]));await tick();assert.match(x.note.textContent,/후보 1명/);
});
test('late OCR after leaving cannot launch a new duplicate lookup',async()=>{
 const x=fixture();x.photo();const ocr=x.ocrCalls[0];x.flow.handle(x.d,'input-cancel');assert.equal(ocr.args.signal.aborted,true);ocr.pending.resolve({ok:true,suggestion:{name:'늦은 후보',role:'관리소장',mobile:'01011112222'}});await tick();await x.flush();assert.equal(x.calls.length,0);assert.equal(x.flow.snapshot(),null);
});
