const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {JSDOM}=require('../../crm-security-lab/node_modules/jsdom');
const pc=fs.readFileSync(path.join(__dirname,'../crm.html'),'utf8');
const mobile=fs.readFileSync(path.join(__dirname,'../mobile.html'),'utf8');
const Export=require('../crm-export');
test('XSS: inquiry matrix treats DB assignee as data in an inline JavaScript attribute',()=>{
 const d=dom(pc),w=d.window;
 try{
  w.G={};w.FLOW_STEPS=['a','b','c','d','e','f'];w.repN=x=>x;w.paint=()=>{};
  w.eval(line(pc,'ctlMatrix'));
  for(const value of payloads){
   w.allAssignees=()=>[value];
   w.document.getElementById('root').innerHTML=w.ctlMatrix([{q:{assignee:value},stage:0,p:{rank:1}}]);
   w.document.querySelectorAll('.mc')[6].click();
   assert.equal(w.G.rep,value);noInjection(w);
  }
 }finally{w.close();}
});
// Later declarations replace earlier legacy renderers in the actual page.
function line(source,name){const found=source.split(/\r?\n/).filter(x=>x.startsWith('function '+name+'(')).at(-1);assert.ok(found,name);return found;}
function dom(source){const d=new JSDOM('<main id="root"></main>',{runScripts:'dangerously',url:'https://fixture.invalid/'});for(const name of ['esc','escAttr','jsAttr'])d.window.eval(line(source,name));return d;}
const payloads=["' onmouseover='window.XSS=1' data-x='", "');window.XSS=1;//", '</textarea><img src=x onerror="window.XSS=1">','&lt;img src=x onerror=window.XSS=1&gt;', '" & \\ 한빛아파트'];
function noInjection(w){assert.equal(w.XSS,undefined);assert.equal(w.document.querySelectorAll('script,img,[onerror],[onmouseover]').length,0);}
test('XSS: PC Deal renderer keeps hostile customer strings out of executable attributes',()=>{
 const d=dom(pc),w=d.window;
 try{
  w.priorityInfo=()=>({cls:'ok',label:'ok'});w.itemPatch=()=>({});w.actionObj=()=>null;w.age=()=>0;
  w.fmtAmt=()=>'';w.repN=x=>x;w.subStatus=x=>x.note;w.dealWorkSummary=x=>x.work;
  w.drwDeal=x=>{w.opened=JSON.parse(x)};w.eval(line(pc,'denseCard'));
  for(const value of payloads){
   const record={site:value,assignee:value,note:value,work:value};
   w.document.getElementById('root').innerHTML=w.denseCard(record);
   w.document.querySelector('.dense-card').click();
   assert.deepEqual(JSON.parse(JSON.stringify(w.opened)),record);noInjection(w);
   assert.equal(w.document.querySelector('.site').textContent,value);
  }
 }finally{w.close();}
});
test('XSS: mobile contact key remains data after HTML entity decoding and click',()=>{
 const d=dom(mobile),w=d.window;
 try{
  w.phoneN=x=>x;w.phoneFmt=x=>x;w.callContactM=(kind,key)=>{w.received=key};
  w.eval(line(mobile,'contactCardM'));
  for(const value of payloads){
   w.siteContactsM=()=>[{personKey:value,name:value,role:value,mobile:'01000000000',officeTel:'020000000'}];
   w.document.getElementById('root').innerHTML=w.contactCardM({nm:value});
   w.document.querySelector('.mcontact-num button').click();
   assert.equal(w.received,value);noInjection(w);
  }
 }finally{w.close();}
});
test('XSS: mobile call memo renders the DB contact name as text',()=>{
 const d=dom(mobile),w=d.window;
 try{
  w.eval(line(mobile,'intro'));w.eval(line(mobile,'callMemoSheetM'));
  w.DEALS=[{id:'a'}];w.G={deal:'a'};w.IC={mic:'<b>icon</b>'};w.mReason=()=>'';w.mrGate=()=>{};w.mrMode=()=>{};
  w.openSheet=(intro,body)=>{w.document.getElementById('root').innerHTML=intro+body;};
  for(const value of payloads){w.contactInfoM=()=>({name:value});w.callMemoSheetM();noInjection(w);assert.equal(w.document.querySelector('.t').textContent,value+' 통화 완료');}
 }finally{w.close();}
});
test('escaping round trips DB strings in text/textarea/attributes without double encoding',()=>{
 for(const source of [pc,mobile]){const d=dom(source),w=d.window;try{
  for(const value of payloads){w.document.getElementById('root').innerHTML='<textarea>'+w.esc(value)+'</textarea><input value="'+w.escAttr(value)+'">';assert.equal(w.document.querySelector('textarea').value,value);assert.equal(w.document.querySelector('input').value,value);noInjection(w);}
 }finally{w.close();}}
});
test('export fails closed on server denial, aal1, wrong actor, missing audit and account switch',async()=>{
 let calls=0,sessionCalls=0,level='aal1';const response={ok:true,actor_id:'u',audit_id:'a',columns:['site'],rows:[]};
 const client={auth:{getSession:async()=>({data:{session:{user:{id:++sessionCalls>1?'other':'u'}}}}),mfa:{getAuthenticatorAssuranceLevel:async()=>({data:{currentLevel:level}})}},rpc:async()=>{calls++;return {data:response}}};
 await assert.rejects(Export.request(client,{}),/MFA/);assert.equal(calls,0);
 level='aal2';sessionCalls=0;await assert.rejects(Export.request(client,{}),/계정/);
 client.auth.getSession=async()=>({data:{session:{user:{id:'u'}}}});
 for(const invalid of [{...response,actor_id:'spoof'},{...response,audit_id:null},{...response,rows:Array(101).fill({})}]){client.rpc=async()=>({data:invalid});await assert.rejects(Export.request(client,{}),/확인/);}
 client.rpc=async()=>({error:{message:'permission denied'}});await assert.rejects(Export.request(client,{}),/권한/);
 client.rpc=async()=>({data:response});assert.deepEqual(await Export.request(client,{}),response);
});
test('PC no longer exposes a full B/LOCAL/WRITE_Q export serializer',()=>{
 assert.doesNotMatch(pc,/function buildFullExport|netform-crm-full-export|netform-crm-full-/);
 assert.match(pc,/CrmExport\.open\(SB\)/);
});
