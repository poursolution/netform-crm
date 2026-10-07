const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const D='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',KEY='deal:'+D;
function env(rpc){const events=[],handlers={},root={G:{},ME:{id:'one'},B:{deals:[],inquiries:[]},CUR_DETAIL:{kind:'deal',item:{id:D}},CRMRelease:{has:()=>true},OpsStore:{has:()=>true,rpc},addEventListener:(n,f)=>handlers[n]=f,dispatchEvent:e=>events.push(e),toast:()=>{},esc:String,escAttr:String};
 const ctx={window:root,Intl,Date,Map,Set,Promise,CustomEvent:class{constructor(type,o){this.type=type;this.detail=o.detail;}}};vm.runInNewContext(fs.readFileSync(new URL('../contact-link.js',`file://${__filename.replace(/\\/g,'/')}`),'utf8'),ctx);return {root,C:root.ContactLink,events,handlers};}
test('activity link index pages only selected target, caches, and never scans loaded other records',async()=>{
 const calls=[],{root,C}=env(async(n,p)=>{calls.push([n,p]);return {ok:true,items:[{text:p.after?'second':'first'}],next_cursor:p.after?null:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'};});
 root.B.deals=[{id:'other',get activities(){throw Error('must not scan');}}];
 assert.deepEqual(Array.from(C.linkedInto('deal:cccccccc-cccc-4ccc-8ccc-cccccccccccc')),[]);assert.equal(calls.length,0);
 C.linkedInto(KEY);await C.loadLinks(KEY);assert.equal(calls.length,2);
 assert.deepEqual(Array.from(C.linkedInto(KEY),x=>x.text),['first','second']);await C.loadLinks(KEY);assert.equal(calls.length,2);
});
test('activity link cache rejects old identity response and clears data after permission failure',async()=>{
 let resolve;const {root,C,handlers}=env(()=>new Promise(r=>resolve=r));const p=C.loadLinks(KEY);root.ME={id:'two'};handlers['phase1:profile']();
 resolve({ok:true,items:[{text:'private'}]});await p;
 root.OpsStore.rpc=async()=>{throw Object.assign(Error('forbidden'),{code:'42501'});};await C.loadLinks(KEY,true);
 assert.deepEqual(Array.from(C.linkedInto(KEY)),[]);
});
