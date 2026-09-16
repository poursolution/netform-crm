const {test}=require('node:test');
const assert=require('node:assert/strict');
const api=require('../pc-manager-requests.js');
test('inquiry signals debounce and identity cleanup cancels the subscription',()=>{
 let signal,stops=0,next=0;const timers=new Map(),events=new Map();
 const w={paintInq(){},paintTodayHome(){},G:{page:'today'},document:{querySelector(){return null}},
  Phase1:{subscribe(resource,cb){assert.equal(resource,'operational_core');signal=cb;return ()=>stops++;}},
  setTimeout(cb){timers.set(++next,cb);return next;},clearTimeout(id){timers.delete(id);},
  addEventListener(name,cb){events.set(name,cb);},removeEventListener(name){events.delete(name);}};
 const dispose=api.install(w,{list:async()=>[],create:async()=>({})});
 signal({table:'deals'});assert.equal(timers.size,0);
 signal({table:'inquiries'});signal({table:'inquiries'});assert.equal(timers.size,1);
 events.get('phase1:identity-cleared')();assert.equal(timers.size,0);assert.equal(stops,1);
 dispose();assert.equal(stops,1);assert.equal(events.size,0);
});

test('inquiry page keeps request creation controls without mounting another inbox',()=>{
 let lists=0,appends=0;const events=new Map();
 const detachedHost={replaceChildren(){},classList:{add(){}}};
 const panel={append(){appends++;},querySelectorAll(){return [];}};
 const w={paintInq(){},paintTodayHome(){},inqCtlRoleView(){return 'admin';},G:{page:'inq'},document:{
  querySelector(selector){return selector==='#sg-panel'?panel:null;},
  createElement(tag){assert.equal(tag,'section');return detachedHost;}
 },Phase1:{subscribe(){return ()=>{};}},setTimeout,clearTimeout,
  addEventListener(name,cb){events.set(name,cb);},removeEventListener(name){events.delete(name);}};
 const dispose=api.install(w,{list:async()=>{lists++;return [];},create:async()=>({})});
 w.paintInq();assert.equal(appends,0);assert.equal(lists,0);
 dispose();assert.equal(events.size,0);
});
