'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const factory=require('../contact-match-reader.js');
const ID='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',AUTH='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',USER='cccccccc-cccc-4ccc-8ccc-cccccccccccc',CONTACT='dddddddd-dddd-4ddd-8ddd-dddddddddddd',SITE='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',OTHER='ffffffff-ffff-4fff-8fff-ffffffffffff';
const BASE='https://ymfbmpnizxvqsamnczow.supabase.co',PHONE='01012345678',clone=x=>JSON.parse(JSON.stringify(x));
const pending=()=>{let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return {promise,resolve,reject};};
const tick=()=>new Promise(resolve=>setImmediate(resolve));
function candidate(extra={}){return {contact_id:CONTACT,person_key:'mobile:'+PHONE,name:'합성 고객',role:'관리소장',matched_phone:PHONE,linked_to_target:true,links:[{opportunity_id:ID,site_id:SITE,site_name:'합성 현장'}],link_total:1,links_truncated:false,can_link:false,...extra};}
function body(extra={}){return {contract:'contact-match-read-v1',actor_auth_uid:AUTH,actor_user_id:USER,object_id:ID,object_version:7,phone:PHONE,scope:'authorized_deals_only',page:1,page_size:20,total:1,has_more:false,candidates:[candidate()],...extra};}
function response(data=body(),status=200,extra={}){return {ok:status>=200&&status<300,status,headers:{get:()=>null},text:async()=>JSON.stringify(data),...extra};}
function rig(fetcher,options={}){
 const calls=[],events=new Map(),timers=new Map();let timerId=0,writeCount=0,storageCount=0,current=true;
 const root={LIVE:true,DEMO:false,TOKEN:'SYNTHETIC_TOKEN',AbortController,
  Phase1:{profile:{auth_uid:AUTH,user_id:USER},config:{project_ref:'ymfbmpnizxvqsamnczow',url:BASE,publishable_key:'SYNTHETIC_KEY'},queue:{enqueue(){writeCount++;throw Error('NO_WRITES');}},rpc(){throw Error('Use the direct scoped read contract');}},
  localStorage:{setItem(){storageCount++;throw Error('NO_CACHE');}},sessionStorage:{setItem(){storageCount++;throw Error('NO_CACHE');}},
  addEventListener(name,fn){if(!events.has(name))events.set(name,new Set());events.get(name).add(fn);},removeEventListener(name,fn){events.get(name)?.delete(fn);},
  async fetch(url,init){calls.push({url,init});return fetcher?fetcher(url,init):response();}
 };
 if(options.clock){root.setTimeout=(fn,ms)=>{timers.set(++timerId,{fn,ms});return timerId;};root.clearTimeout=id=>timers.delete(id);}
 const api=factory(root),args=(extra={})=>({dealId:ID,expectedVersion:7,phone:PHONE,isCurrent:()=>current,...extra});
 return {root,api,calls,args,events,timers,current(value){current=value;},emit(name){for(const fn of [...events.get(name)||[]])fn();},writes:()=>writeCount,storage:()=>storageCount,listeners:()=>[...events.values()].reduce((n,set)=>n+set.size,0)};
}

test('strict phone normalization matches existing 010/+82 input policy without guessing OCR letters',()=>{
 const api=factory({});
 for(const value of ['01012345678','010-1234-5678',' (010) 1234 5678 ']){
  // Parenthesized prefix is not accepted by the existing strict model.
  assert.equal(api.normalizePhone(value),value.trim().startsWith('(')?'':PHONE);
 }
 for(const value of ['+82 10-1234-5678',' 010 (1234) 5678 ','+82(10)1234-5678'])assert.equal(api.normalizePhone(value),PHONE);
 for(const value of [null,1012345678,'','0101234567','01112345678','O1012345678','01012345678 내선1','+82 (0)10 1234 5678','01012345678 / 01087654321','01012345678@x','+8210123456789'])assert.equal(api.normalizePhone(value),'',String(value));
});

test('reads through shared direct RPC and returns only sanitized authorized data, with no writes/cache',async()=>{
 const h=rig();const got=await h.api.read(h.args({phone:'+82 10-1234-5678'}));
 assert.equal(got.ok,true);assert.equal(got.status,'ready');assert.equal(got.total,1);assert.equal(got.candidates[0].can_link,false);
 assert.equal(h.calls.length,1);const {url,init}=h.calls[0];assert.equal(url,BASE+'/rest/v1/rpc/crm_contact_match_read_v1');assert.equal(init.method,'POST');
 assert.deepEqual(JSON.parse(init.body),{p_opportunity_id:ID,p_phone:PHONE,p_page:1});
 assert.deepEqual(init.headers,{apikey:'SYNTHETIC_KEY',Authorization:'Bearer SYNTHETIC_TOKEN','Content-Type':'application/json'});
 assert.equal(h.writes(),0);assert.equal(h.storage(),0);assert.equal(h.listeners(),0);
 assert.deepEqual(got,{ok:true,status:'ready',...body()});
});

test('accepts canonicalized UUIDs, nullable text, version zero and legacy long text without truncation',async()=>{
 const raw=body({actor_auth_uid:AUTH.toUpperCase(),actor_user_id:USER.toUpperCase(),object_id:ID.toUpperCase(),object_version:0,
  candidates:[candidate({contact_id:CONTACT.toUpperCase(),person_key:null,name:'장'.repeat(4096),role:null,links:[{opportunity_id:ID.toUpperCase(),site_id:null,site_name:null}]})]});
 const h=rig(()=>response(raw));h.root.Phase1.profile.auth_uid=AUTH.toUpperCase();h.root.Phase1.profile.user_id=USER.toUpperCase();
 const got=await h.api.read(h.args({dealId:ID.toUpperCase(),expectedVersion:0}));assert(got.ok);assert.equal(got.object_id,ID);assert.equal(got.actor_auth_uid,AUTH);assert.equal(got.candidates[0].contact_id,CONTACT);assert.equal(got.candidates[0].name.length,4096);assert.equal(got.candidates[0].role,null);
});

test('pagination validates the exact target page, size, count and has_more; zero is only a valid confirmed result',async()=>{
 for(const [page,total,count,hasMore] of [[1,0,0,false],[2,21,1,false],[3,21,0,false]]){
  const h=rig(()=>response(body({page,total,candidates:count?[candidate()]:[],has_more:hasMore}))),got=await h.api.read(h.args({page}));assert(got.ok);assert.equal(got.page,page);assert.equal(got.total,total);assert.equal(got.candidates.length,count);
 }
 const candidates=Array.from({length:20},(_,i)=>candidate({contact_id:`00000000-0000-4000-8000-${String(i).padStart(12,'0')}`}));
 const h=rig(()=>response(body({total:21,has_more:true,candidates})));assert((await h.api.read(h.args())).ok);
});

test('invalid caller/auth/config/current state is rejected before fetch',async()=>{
 const mutations=[h=>{h.root.LIVE=false;},h=>{h.root.DEMO=true;},h=>{delete h.root.DEMO;},h=>{h.root.TOKEN='';},h=>{h.root.Phase1.profile=null;},h=>{h.root.Phase1.profile.auth_uid='bad';},h=>{h.root.Phase1.profile.user_id='bad';},h=>{h.root.Phase1.config.url='https://other.invalid';},h=>{h.root.Phase1.config.project_ref='wrong';},h=>{h.root.Phase1.config.publishable_key=' ';},h=>{h.root.SUPABASE_URL='https://other.invalid';},h=>h.current(false)];
 for(const mutate of mutations){const h=rig();mutate(h);const got=await h.api.read(h.args());assert.equal(got.ok,false);assert.equal(h.calls.length,0);assert.equal('total'in got,false);assert.equal('candidates'in got,false);}
 for(const change of [{dealId:'bad'},{expectedVersion:-1},{expectedVersion:'7'},{expectedVersion:1.5},{phone:'O1012345678'},{page:0},{page:2147483648},{page:'1'},{isCurrent:null},{isCurrent:()=>{throw Error('stale');}},{signal:{}}]){
  const h=rig(),got=await h.api.read(h.args(change));assert.equal(got.ok,false,JSON.stringify(change));assert.equal(h.calls.length,0);
 }
});

test('malformed, overbroad, conflicting or mismatched match data fails closed instead of becoming zero',async()=>{
 const changes=[
  x=>{x.contract='old';},x=>{x.actor_auth_uid=OTHER;},x=>{x.actor_user_id=OTHER;},x=>{x.object_id=OTHER;},x=>{x.object_version=8;},x=>{x.object_version='7';},x=>{x.phone='01099999999';},x=>{x.scope='all_contacts';},x=>{x.page=2;},x=>{x.page_size=100;},x=>{x.total=-1;},x=>{x.total=1.5;},x=>{x.has_more=true;},x=>{x.total=2;},x=>{x.candidates.push(clone(x.candidates[0]));x.total=2;},
  x=>{delete x.candidates[0].name;},x=>{x.candidates[0].can_link=true;},x=>{x.candidates[0].phone_number='unapproved-field';},x=>{x.candidates[0].contact_id='bad';},x=>{x.candidates[0].matched_phone='+82 10-1234-5678';},x=>{x.candidates[0].person_key={};},x=>{x.candidates[0].name='a'.repeat(4097);},x=>{x.candidates[0].role=false;},x=>{x.candidates[0].linked_to_target=false;},x=>{x.candidates[0].links[0].opportunity_id=OTHER;},x=>{x.candidates[0].links[0].site_id='bad';},x=>{x.candidates[0].links[0].site_name=1;},x=>{x.candidates[0].links[0].owner='private';},x=>{x.candidates[0].links=[];x.candidates[0].link_total=0;},x=>{x.candidates[0].links_truncated=true;},x=>{x.candidates[0].link_total=2;},x=>{x.candidates[0].links.push(clone(x.candidates[0].links[0]));x.candidates[0].link_total=2;}
 ];
 for(const change of changes){const data=body();change(data);const h=rig(()=>response(data)),got=await h.api.read(h.args());assert.equal(got.ok,false,change.toString());assert.equal(got.error,'CONTACT_MATCH_RESPONSE_INVALID');assert.equal('candidates'in got,false);assert.equal('total'in got,false);assert.equal(h.calls.length,1);}
});

test('truncated authorized links are bounded and correctly reported, without inventing hidden links',async()=>{
 const links=Array.from({length:20},(_,i)=>({opportunity_id:`00000000-0000-4000-8000-${String(i).padStart(12,'0')}`,site_id:null,site_name:'합성 관련 현장'}));
 const h=rig(()=>response(body({candidates:[candidate({links,link_total:21,links_truncated:true,linked_to_target:true})]}))),got=await h.api.read(h.args());assert(got.ok);assert.equal(got.candidates[0].links.length,20);assert.equal(got.candidates[0].link_total,21);assert.equal(got.candidates[0].links.some(x=>x.opportunity_id===ID),false);
});

test('missing RPC, denied access, server/network errors and invalid JSON remain failures and are never retried',async()=>{
 const cases=[()=>response({code:'PGRST202',message:'not installed'},404),()=>response({},403),()=>response({},500),()=>{throw Error('offline');},()=>response(null,200,{text:async()=>'{broken'}),()=>null];
 for(const fetcher of cases){const h=rig(fetcher),got=await h.api.read(h.args());assert.equal(got.ok,false);assert.equal(got.status,'failed');assert.equal(h.calls.length,1);assert.equal('total'in got,false);assert.equal(h.writes(),0);}
 const h=rig(()=>response({code:'PGRST202'},404));assert.equal((await h.api.read(h.args())).error,'CONTACT_MATCH_UNAVAILABLE');
});

test('response size is bounded by declared length and actual UTF-8 bytes, without truncating values',async()=>{
 const cases=[response(body(),200,{headers:{get:()=>String(524289)}}),response(body(),200,{text:async()=>'x'.repeat(524289)}),response(body(),200,{text:async()=>JSON.stringify({extra:'한'.repeat(180000)})})];
 for(const reply of cases){const h=rig(()=>reply),got=await h.api.read(h.args());assert.equal(got.error,'CONTACT_MATCH_RESPONSE_TOO_LARGE');assert.equal('total'in got,false);}
});

test('profile, token, configuration or input binding changes while fetch is pending discard the result',async()=>{
 const mutations=[h=>{h.root.TOKEN='ROTATED';},h=>{h.root.Phase1.profile.auth_uid=OTHER;},h=>{h.root.Phase1.profile.user_id=OTHER;},h=>{h.root.Phase1.config.publishable_key='ROTATED';},h=>{h.root.Phase1.config.url='https://other.invalid';},h=>{h.root.Phase1.profile=null;},h=>h.current(false),h=>{h.root.DEMO=true;}];
 for(const change of mutations){const wait=pending(),h=rig(()=>wait.promise),read=h.api.read(h.args());assert.equal(h.calls.length,1);change(h);wait.resolve(response());const got=await read;assert.equal(got.status,'stale');assert.equal('candidates'in got,false);assert.equal(h.listeners(),0);}
});

test('binding is checked again after asynchronous response body parsing',async()=>{
 const wait=pending(),h=rig(()=>response(body(),200,{text:()=>wait.promise})),read=h.api.read(h.args());await tick();h.current(false);wait.resolve(JSON.stringify(body()));const got=await read;assert.equal(got.status,'stale');assert.equal('total'in got,false);
});

test('abort and timeout settle even if fetch ignores AbortSignal; late success never revives a result',async()=>{
 for(const kind of ['abort','timeout','identity']){
  const wait=pending(),h=rig(()=>wait.promise,{clock:true}),controller=new AbortController();const read=h.api.read(h.args({signal:controller.signal}));
  if(kind==='abort')controller.abort();else if(kind==='identity')h.emit('phase1:identity-cleared');else {assert.equal([...h.timers.values()][0].ms,15000);[...h.timers.values()][0].fn();}
  const got=await read;assert.equal(got.status,kind==='abort'?'cancelled':kind==='identity'?'stale':'failed');assert.equal(got.error,kind==='timeout'?'CONTACT_MATCH_TIMEOUT':kind==='identity'?'CONTACT_MATCH_CONTEXT_CHANGED':'CONTACT_MATCH_CANCELLED');
  wait.resolve(response());await tick();assert.equal(got.ok,false);assert.equal(h.calls.length,1);assert.equal(h.listeners(),0);assert.equal(h.timers.size,0);
 }
 const h=rig(),controller=new AbortController();controller.abort();assert.equal((await h.api.read(h.args({signal:controller.signal}))).status,'cancelled');assert.equal(h.calls.length,0);
});

test('abort during text read settles even when the body provider ignores abort',async()=>{
 const wait=pending(),h=rig(()=>response(body(),200,{text:()=>wait.promise})),controller=new AbortController(),read=h.api.read(h.args({signal:controller.signal}));await tick();controller.abort();assert.equal((await read).status,'cancelled');wait.reject(Error('late body failure'));await tick();assert.equal(h.listeners(),0);
});

test('concurrent out-of-order reads use caller bindings and return only the latest matching input',async()=>{
 const first=pending(),second=pending();let generation=1;
 const h=rig((url,init)=>JSON.parse(init.body).p_phone===PHONE?first.promise:second.promise);
 const old=h.api.read(h.args({isCurrent:()=>generation===1}));generation=2;
 const next=h.api.read(h.args({phone:'01087654321',isCurrent:()=>generation===2}));
 second.resolve(response(body({phone:'01087654321',total:0,candidates:[]})));const latest=await next;assert(latest.ok);assert.equal(latest.phone,'01087654321');
 first.resolve(response());const stale=await old;assert.equal(stale.status,'stale');assert.equal('total'in stale,false);assert.equal(h.calls.length,2);assert.equal(h.writes(),0);assert.equal(h.storage(),0);
});
