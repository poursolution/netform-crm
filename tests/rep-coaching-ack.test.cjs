const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const html=fs.readFileSync(path.join(__dirname,'../crm.html'),'utf8');
const source=html.slice(html.indexOf('var REP_MANAGER_COMMENT_PENDING='),html.indexOf('function repManagerFlowRow'));
function setup(){
 const memory=new Map(),B={repManagerComments:[]},calls=[],toasts=[];
 let finish,fail;const el={value:'new coaching',isConnected:true};
 const c={Set,Error,ME:{id:'admin',name:'manager'},B,REP_INTERNAL:['rep'],REP_MANAGER_ROWS:[{nm:'rep'}],REP_MANAGER_COMMENT_KEY:'comments',
  Phase1:{storage:{getItem:k=>memory.get(k),setItem:(k,v)=>memory.set(k,v)}},
  repManagerLocalComments:()=>JSON.parse(memory.get('comments')||'[]'),repManagerWeekKey:()=> '2026-10-05',
  repManagerComment:()=>B.repManagerComments.at(-1),$ :()=>el,paintRepManagement:()=>calls.push('paint'),repManagerOpenDrawer:()=>calls.push('drawer'),toast:m=>toasts.push(m),
  OpsStore:{has:()=>true,rpc:(name,p)=>{calls.push([name,p]);return new Promise((resolve,reject)=>{finish=resolve;fail=reject;});}}
 };c.window=c;vm.createContext(c);vm.runInContext(source,c);
 const ack=(changes={})=>finish({ok:true,comment:{rep_name:'rep',week_start:'2026-10-05',comment:'new coaching',status:'open',updated_at:'2026-10-10T01:00:00Z',...changes}});
 return {c,B,el,calls,toasts,memory,ack,fail:e=>fail(e)};
}
test('no local or rendered success before acknowledgement; accept server timestamp',async()=>{
 const x=setup(),p=x.c.repManagerSaveComment('rep','card');assert.equal(x.B.repManagerComments.length,0);assert.equal(x.memory.size,0);assert.equal(x.calls.length,1);
 x.ack();assert.equal(await p,true);assert.equal(x.B.repManagerComments[0].updated_at,'2026-10-10T01:00:00Z');assert.equal(x.calls.at(-1),'paint');
});
test('rejection preserves draft and old completion state; retry is available',async()=>{
 const x=setup();x.B.repManagerComments.push({rep_name:'rep',comment:'old',status:'done'});
 const p=x.c.repManagerSaveComment('rep','drawer');x.fail(Error('offline'));assert.equal(await p,false);assert.equal(x.el.value,'new coaching');assert.equal(x.B.repManagerComments[0].status,'done');assert.equal(x.calls.length,1);
 const retry=x.c.repManagerSaveComment('rep','drawer');x.ack({status:'done'});assert.equal(await retry,true);
});
test('double click does not issue a second write',async()=>{
 const x=setup(),p=x.c.repManagerSaveComment('rep','card');assert.equal(await x.c.repManagerSaveComment('rep','card'),false);assert.equal(x.calls.length,1);x.ack();await p;
});
for(const [label,fields] of Object.entries({owner:{rep_name:'other'},week:{week_start:'2026-10-12'},text:{comment:'wrong'},status:{status:'done'},timestamp:{updated_at:null}})){
 test('reject mismatched '+label+' acknowledgement',async()=>{const x=setup(),p=x.c.repManagerSaveComment('rep','card');x.ack(fields);assert.equal(await p,false);assert.equal(x.B.repManagerComments.length,0);assert.equal(x.memory.size,0);});
}
test('account switch does not cache another account response',async()=>{
 const x=setup(),p=x.c.repManagerSaveComment('rep','card');x.c.ME={id:'different'};x.ack();assert.equal(await p,false);assert.equal(x.memory.size,0);assert.equal(x.B.repManagerComments.length,0);
});
test('new edits or replaced input are not repainted by a late acknowledgement',async()=>{
 for(const replace of [false,true]){const x=setup(),p=x.c.repManagerSaveComment('rep','drawer');if(replace)x.el.isConnected=false;else x.el.value='newer draft';x.ack();assert.equal(await p,true);assert.equal(x.calls.length,1);}
});
test('completion toggle waits and uses server completion evidence',async()=>{
 const x=setup();x.B.repManagerComments.push({rep_name:'rep',week_start:'2026-10-05',comment:'new coaching',status:'open'});
 const p=x.c.repManagerToggleComment('rep');assert.equal(x.B.repManagerComments[0].status,'open');x.ack({status:'done',completed_at:'2026-10-10T01:00:00Z'});assert.equal(await p,true);assert.equal(x.B.repManagerComments[0].status,'done');
 const retry=x.c.repManagerToggleComment('rep');x.fail(Error('offline'));assert.equal(await retry,false);assert.equal(x.B.repManagerComments[0].status,'done');
});
test('disabled backend refuses write; cache failure after ACK is not a failed server save',async()=>{
 const x=setup();x.c.OpsStore.has=()=>false;assert.equal(await x.c.repManagerSaveComment('rep','card'),false);assert.equal(x.calls.length,0);
 x.c.OpsStore.has=()=>true;x.c.Phase1.storage.setItem=()=>{throw Error('quota')};const p=x.c.repManagerSaveComment('rep','card');x.ack();assert.equal(await p,true);assert.equal(x.B.repManagerComments[0].comment,'new coaching');
});
