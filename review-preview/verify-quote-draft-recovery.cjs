'use strict';
// Actual quote controller/model with synthetic tab storage and clock only.
// Does not load/edit HTML or CSS and forbids all server and queue operations.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const base=path.resolve(__dirname,'..'),source=fs.readFileSync(path.join(base,'mobile-quote-flow.js'),'utf8'),makeModel=require('../mobile-quote-review-model.js');
const ID='11111111-1111-4111-8111-111111111111',OTHER='22222222-2222-4222-8222-222222222222',Q='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2',TTL=30*60*1000;
const checks=[],failures=[],rigs=[];
const plain=x=>JSON.parse(JSON.stringify(x));
function shared(){return {data:new Map(),at:Date.UTC(2026,9,11,3),epoch:0,auth:ID,user:ID,failGet:false,failSet:false,failReadAfterSet:false,failNextRead:false,setCount:0,io:[],d:{id:ID,nm:'합성 견적 현장',version:3,code:'consulting',quote_versions:[{id:Q,opportunity_id:ID,version_no:2,base_amount:290000000,status:'final'}],contacts:[],activities:[],work_items:['슁글'],nextAction:{id:OTHER,status:'open',text:'기존 고객 회신 확인',due_on:'2026-10-16',date_basis:'customer_agreed'}}};}
function rig(s=shared()){
 const events=new Map(),profile={};Object.defineProperties(profile,{auth_uid:{get:()=>s.auth},user_id:{get:()=>s.user}});
 const storage={get length(){return s.data.size;},key:i=>[...s.data.keys()][i]??null,getItem(k){if(s.failGet)throw Error('STORAGE_READ_FAILED');if(s.failNextRead){s.failNextRead=false;throw Error('ONCE_READBACK_FAILED');}return s.data.get(k)??null;},setItem(k,v){if(s.failSet)throw Error('QUOTA_EXCEEDED');s.data.set(k,String(v));s.setCount++;if(s.failReadAfterSet){s.failReadAfterSet=false;s.failNextRead=true;}},removeItem:k=>s.data.delete(k)};
 const noIO=kind=>(...args)=>{s.io.push(kind);throw Error('FORBIDDEN_'+kind);};
 const w={DEMO:true,LIVE:false,G:{mode:'rep',user:'합성 담당자',deal:ID},Phase1:{profile,rpc:noIO('rpc'),queue:{enqueue:noIO('queue')}},myDeals:()=>[s.d],sessionStorage:storage,fetch:noIO('fetch'),pushWrite:noIO('write'),MobileGuideShell:{state:{detailView:''}},addEventListener(name,fn){if(!events.has(name))events.set(name,new Set());events.get(name).add(fn);},removeEventListener(name,fn){events.get(name)?.delete(fn);}};
 w.MobileSaveJournal={owner:()=>s.auth+':'+s.user,session:()=>w.MobileSaveJournal.owner()+':'+s.epoch};
 w.__approvedQuoteExample={owner:w.MobileSaveJournal.owner(),dealId:ID,models:{
  'K-1':{works:[{id:'roof',label:'슁글',selected:true},{id:'drain',label:'배수로',selected:false}],quantities:[{id:'area',label:'슁글',value:'약 1200 ㎡',editable:true}],dates:[{id:'next-week',label:'다음 주',selected:false},{id:'none',label:'약속 없음',selected:true}],customerDue:null},
  'K-4':{options:[{id:'A',label:'안 A',value:'확인 필요',selected:true},{id:'B',label:'안 B',value:'확인 필요',selected:false}]}
 }};
 w.MobileQuoteReviewModel=makeModel(w);
 w.MobileApprovedQuoteSource=Object.fromEntries(['K-1','K-2','K-3','K-4','K-5'].map(k=>[k,'approved source sentinel']));
 w.MobileApprovedQuote={render:(screen,model)=>JSON.stringify({screen,...model})};
 w.MobileApprovedQuoteExtraSource={simple:'source',standards:'source',method:'source',markup:'source'};w.MobileApprovedQuoteExtra={render:(kind,model)=>JSON.stringify({kind,...model})};
 class FakeDate extends Date {constructor(...args){super(...(args.length?args:[s.at]));}static now(){return s.at;}}
 vm.runInNewContext(source,{window:w,Date:FakeDate,console,structuredClone});
 const api=w.MobileQuoteFlow,initial=JSON.stringify(s.d),example=JSON.stringify(w.__approvedQuoteExample),sources=JSON.stringify(w.MobileApprovedQuoteSource);
 const r={s,w,api,initial,example,sources,open:(screen='K-1')=>api.open(s.d,screen),model:()=>JSON.parse(api.render(s.d)),snapshot:()=>{assert.equal(typeof api.snapshot,'function','controller exposes read-only snapshot');return plain(api.snapshot());},rows:()=>[...s.data.entries()],event:name=>[...(events.get(name)||[])].forEach(fn=>fn())};rigs.push(r);return r;
}
function test(name,fn){try{fn();checks.push(name);}catch(e){failures.push({name,error:String(e.stack||e)});}}
function selected(m,field){return m[field].filter(x=>x.selected).map(x=>x.id);}

test('K1 quantity/work/relative-date choices survive same-session reentry without a calendar promise',()=>{
 const r=rig();assert.equal(r.open(),true);assert.equal(r.api.quantity(r.s.d,'area','123 ㎡').stored,true);
 assert.equal(r.api.handle(r.s.d,'k1-work',{id:'drain'}).ok,true);assert.equal(r.api.handle(r.s.d,'k1-date',{id:'next-week'}).ok,true);
 r.api.reset();assert.equal(r.open(),true);const m=r.model();assert.equal(m.quantities[0].value,'123 ㎡');assert.deepEqual(selected(m,'works'),['roof','drain']);assert.deepEqual(selected(m,'dates'),['next-week']);assert.equal(m.customerDue,null);assert.match(m.customerDueState,/unconfirmed/);
});
test('K4 explicit empty options survive reload as empty, not the default selected option',()=>{
 const r=rig();assert(r.open('K-4'));assert(r.api.handle(r.s.d,'quote-option',{id:'A'}).ok);r.api.reset();const next=rig(r.s);assert(next.open('K-4'));assert.deepEqual(selected(next.model(),'options'),[]);
 assert(next.api.handle(next.s.d,'quote-option',{id:'B'}).ok);next.api.reset();const again=rig(r.s);assert(again.open('K-4'));assert.deepEqual(selected(again.model(),'options'),['B']);
});
test('a new authentication session never adopts the previous session draft',()=>{
 const r=rig();assert(r.open());r.api.quantity(r.s.d,'area','old-session 987 ㎡');r.s.epoch++;const next=rig(r.s),opened=next.open();if(opened)assert.equal(next.model().quantities[0].value,'약 1200 ㎡');else assert.equal(next.snapshot(),null);
 assert.equal(r.api.quantity(r.s.d,'area','stale 999 ㎡').ok,false);
});
test('another account never reads or overwrites the prior account draft',()=>{
 const r=rig();assert(r.open());r.api.quantity(r.s.d,'area','first-account 777 ㎡');const original=r.rows();r.s.auth=OTHER;r.s.user=OTHER;const next=rig(r.s);if(next.open())assert.equal(next.model().quantities[0].value,'약 1200 ㎡');for(const [k,v] of original)assert.equal(r.s.data.get(k),v);assert.equal(r.api.quantity(r.s.d,'area','stale').ok,false);
});
test('initial storage read failure rejects entry and keeps the existing C route',()=>{
 const r=rig();r.s.failGet=true;assert.equal(r.open(),false);assert.equal(r.w.MobileGuideShell.state.detailView,'');assert.equal(r.snapshot(),null);assert.deepEqual(r.rows(),[]);r.s.failGet=false;assert.equal(r.open(),true);
});
test('damaged JSON rejects entry without deleting or replacing the original',()=>{
 const r=rig();assert(r.open());r.api.quantity(r.s.d,'area','raw 111 ㎡');const [k]=r.rows()[0];r.api.reset({force:true});r.s.data.set(k,'{broken JSON');const next=rig(r.s),before=next.rows();assert.equal(next.open(),false);assert.equal(next.snapshot(),null);assert.equal(next.w.MobileGuideShell.state.detailView,'');assert.deepEqual(next.rows(),before);
});
test('invalid stored draft shape is not treated as an empty editor',()=>{
 const r=rig();assert(r.open());r.api.quantity(r.s.d,'area','valid 112 ㎡');r.api.reset({force:true});const [k,raw]=r.rows()[0],row=JSON.parse(raw);row.draft=[];r.s.data.set(k,JSON.stringify(row));const next=rig(r.s),before=next.rows();assert.equal(next.open(),false);assert.equal(next.snapshot(),null);assert.deepEqual(next.rows(),before);
});
test('first write failure keeps current input and blocks reset until retry succeeds',()=>{
 const r=rig();assert(r.open());r.s.failSet=true;assert.equal(r.api.quantity(r.s.d,'area','unsent 555 ㎡').stored,false);assert.equal(r.model().quantities[0].value,'unsent 555 ㎡');assert.deepEqual(r.rows(),[]);
 assert.equal(r.api.reset().ok,false);assert.equal(r.snapshot().draft.quantities.area,'unsent 555 ㎡');r.s.failSet=false;assert.equal(r.api.reset().ok,true);assert.equal(r.snapshot(),null);assert(r.open());assert.equal(r.model().quantities[0].value,'unsent 555 ㎡');
});
test('later write failure preserves old raw storage and latest RAM without navigation overwrite',()=>{
 const r=rig();assert(r.open());r.api.quantity(r.s.d,'area','old 111 ㎡');const before=r.rows();r.s.failSet=true;r.api.quantity(r.s.d,'area','new 222 ㎡');assert.deepEqual(r.rows(),before);assert.equal(r.model().quantities[0].value,'new 222 ㎡');assert.equal(r.api.reset().ok,false);assert.equal(r.open('K-4'),false);assert.equal(r.snapshot().draft.quantities.area,'new 222 ㎡');assert.deepEqual(r.rows(),before);
 r.s.failSet=false;assert.equal(r.api.reset().ok,true);assert(r.open());assert.equal(r.model().quantities[0].value,'new 222 ㎡');
});
test('a read failure during preservation keeps both latest input and original stored text',()=>{
 const r=rig();assert(r.open());r.api.quantity(r.s.d,'area','old 100 ㎡');const before=r.rows();r.s.failGet=true;assert.equal(r.api.quantity(r.s.d,'area','latest 101 ㎡').stored,false);assert.deepEqual(r.rows(),before);assert.equal(r.api.reset().ok,false);assert.equal(r.snapshot().draft.quantities.area,'latest 101 ㎡');r.s.failGet=false;assert.equal(r.api.reset().ok,true);assert(r.open());assert.equal(r.model().quantities[0].value,'latest 101 ㎡');
});
test('two active handles cannot overwrite each other and failed reset retains the losing local draft',()=>{
 const a=rig(),b=rig(a.s);assert(a.open());assert(b.open());assert.equal(a.api.quantity(a.s.d,'area','writer A 321 ㎡').stored,true);const raw=a.rows();assert.equal(b.api.quantity(b.s.d,'area','writer B 654 ㎡').stored,false);assert.deepEqual(a.rows(),raw);assert.equal(b.api.reset().ok,false);assert.equal(b.snapshot().draft.quantities.area,'writer B 654 ㎡');assert.deepEqual(a.rows(),raw);
 const c=rig(a.s);assert(c.open());assert.equal(c.model().quantities[0].value,'writer A 321 ㎡');
});
test('a successful set followed by one failed readback retries the same draft without duplicate records',()=>{
 const r=rig();assert(r.open());assert.equal(r.api.quantity(r.s.d,'area','old 700 ㎡').stored,true);const old=r.rows(),sets=r.s.setCount;
 r.s.failReadAfterSet=true;assert.equal(r.api.quantity(r.s.d,'area','readback pending 701 ㎡').stored,false);const attempted=r.rows();assert.equal(attempted.length,1);assert.equal(attempted[0][0],old[0][0]);assert.notEqual(attempted[0][1],old[0][1]);assert.equal(JSON.parse(attempted[0][1]).draft.quantities.area,'readback pending 701 ㎡');assert.equal(r.model().quantities[0].value,'readback pending 701 ㎡');assert.equal(r.snapshot().dirty,true);assert.equal(r.s.setCount,sets+1);
 assert.equal(r.api.reset().ok,true);assert.equal(r.snapshot(),null);assert.deepEqual(r.rows(),attempted);assert.equal(r.s.setCount,sets+2);assert(r.open());assert.equal(r.model().quantities[0].value,'readback pending 701 ㎡');assert.equal(r.s.data.size,1);
});
test('another handle removing a key cannot let a stale writer bypass CAS through null attempted',()=>{
 const a=rig();assert(a.open());assert.equal(a.api.quantity(a.s.d,'area','existing 800 ㎡').stored,true);const b=rig(a.s);assert(b.open());const [key]=b.rows()[0];b.w.sessionStorage.removeItem(key);assert.equal(a.s.data.size,0);assert.equal(a.snapshot().attempted,null);
 assert.equal(a.api.quantity(a.s.d,'area','stale 801 ㎡').stored,false);assert.equal(a.s.data.size,0);assert.equal(a.snapshot().draft.quantities.area,'stale 801 ㎡');assert.equal(a.api.reset().ok,false);assert.equal(a.s.data.size,0);
});
test('reset rejects changed authentication even when the current draft is clean',()=>{
 for(const kind of ['account','session']){
  const r=rig();assert(r.open());assert.equal(r.snapshot().dirty,false);if(kind==='account'){r.s.auth=OTHER;r.s.user=OTHER;}else r.s.epoch++;
  assert.equal(r.api.reset().ok,false,kind);assert.notEqual(r.snapshot(),null);assert.deepEqual(r.rows(),[]);assert.equal(r.api.render(r.s.d),'');assert.equal(r.api.reset({force:true}).ok,true);assert.equal(r.snapshot(),null);
 }
});
test('changed deal version cannot reuse or overwrite the protected previous draft',()=>{
 const r=rig();assert(r.open());r.api.quantity(r.s.d,'area','version3 444 ㎡');const before=r.rows();r.s.d.version++;const next=rig(r.s);assert.equal(next.open(),false);assert.deepEqual(next.rows(),before);assert.equal(r.api.quantity(r.s.d,'area','version stale').ok,false);assert.deepEqual(next.rows(),before);
});
test('thirty-minute expiry permits a fresh draft; reads before expiry do not renew the deadline',()=>{
 const r=rig();assert(r.open());r.api.quantity(r.s.d,'area','expires 333 ㎡');const writtenAt=r.s.at;r.s.at=writtenAt+TTL-1;const before=rig(r.s);assert(before.open());assert.equal(before.model().quantities[0].value,'expires 333 ㎡');
 r.s.at=writtenAt+TTL;const after=rig(r.s);assert(after.open());assert.equal(after.model().quantities[0].value,'약 1200 ㎡');
});
test('snapshot is a read-only copy and cannot mutate review state',()=>{
 const r=rig();assert(r.open());r.api.quantity(r.s.d,'area','snapshot 456 ㎡');const snap=r.snapshot();snap.draft.quantities.area='tampered';snap.screen='K-4';assert.equal(r.model().quantities[0].value,'snapshot 456 ㎡');assert.equal(r.snapshot().screen,'K-1');
});
test('all exercised flows issue zero RPC/queue/network writes and leave original deal, fixtures and source strings intact',()=>{
 for(const r of rigs){assert.deepEqual(r.s.io,[]);const current=plain(r.s.d),original=JSON.parse(r.initial);current.version=original.version;assert.deepEqual(current,original);assert.equal(JSON.stringify(r.w.__approvedQuoteExample),r.example);assert.equal(JSON.stringify(r.w.MobileApprovedQuoteSource),r.sources);}
});
const report={at:new Date().toISOString(),ok:failures.length===0,passed:checks.length,failed:failures.length,checks,failures,boundary:'Actual local quote flow and shared quote read-model; synthetic storage/identity/clock/renderer only. No original UI edits, real browser account, production request, quote calculation, send or server/queue write.'};
fs.writeFileSync(path.join(__dirname,'quote-draft-recovery-verification.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));if(failures.length)process.exitCode=1;
