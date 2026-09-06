'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{createRequire}=require('node:module');
const {JSDOM}=createRequire(path.resolve(__dirname,'../../crm-security-lab/package.json'))('jsdom');
const source=fs.readFileSync(path.resolve(__dirname,'../staging-phase1/transport.js'),'utf8');
function fixture(ref='rprechiaglyjaydkmxsu'){
 const dom=new JSDOM('',{url:'http://127.0.0.1:4179',runScripts:'outside-only'}),w=dom.window;
 const config=w.PHASE1_CONFIG={project_ref:ref,url:`https://${ref}.supabase.co`,publishable_key:'TEST_PUBLIC_KEY',accounts:[]};
 let session={user:{id:'test-auth-A'},access_token:'TEST_ONLY'},opts,count=0,drop=false,forged=false;const receipts=new Map();
 w.AbortController=AbortController;w.BroadcastChannel=undefined;
 w.fetch=async(url,init)=>{const args=JSON.parse(init.body||'{}'),name=new URL(url).pathname.split('/').at(-1);let data;
  if(name==='crm_profile_scoped_v2')data={contract_version:2,user_id:'crm-'+session.user.id,auth_uid:session.user.id,source_role:'rep',permission_role:'rep',name:'TEST',allowed_modes:['rep']};
  else if(name==='crm_write_command_v2'){
   data=receipts.get(args.p_request_id);if(data)data={...data,replayed:true};else{count++;data={contract_version:1,ok:true,operation:args.p_operation,request_id:args.p_request_id,object_id:args.p_object_id,actor_auth_uid:session.user.id,actor_user_id:'crm-'+session.user.id,previous_version:args.p_expected_version,version:args.p_expected_version+1,audit_event_id:'TEST_AUDIT',replayed:false};receipts.set(args.p_request_id,data);}
   if(drop){drop=false;throw Error('TEST_LOST_ACK');}if(forged)data={...data,actor_auth_uid:'OTHER_AUTH'};
  }else throw Error('unexpected route');return {ok:true,status:200,json:async()=>data};};
 w.supabase={createClient(url,key,options){opts=options;return {auth:{getSession:async()=>({data:{session}}),onAuthStateChange(){},signOut:async()=>{}},rpc(){}};}};
 w.eval(source);const p=w.Phase1;p.createClient(config.url,config.publishable_key);
 return {dom,w,p,get count(){return count;},get opts(){return opts;},set drop(v){drop=v;},set forged(v){forged=v;},async login(id='test-auth-A'){session={user:{id},access_token:'TEST_ONLY'};return p.admit(session);}};
}
const body={primary_work:'TEST',work_items:['TEST'],reason:'TEST reason'};
test('wrong project blocked before client startup',()=>assert.throws(()=>fixture('not-staging'),/WRONG_ENVIRONMENT/));
test('purpose read never fabricates a whole bundle',async()=>{const f=fixture();try{await f.login();const r=await f.p.read('dashboard');assert.equal(r.coverage,'unavailable');assert.equal(r.data,null);}finally{f.dom.window.close();}});
test('production, legacy, n8n and direct table paths denied before fetch',async()=>{const f=fixture();try{for(const url of ['https://ymfbmpnizxvqsamnczow.supabase.co/rest/v1/users','https://rprechiaglyjaydkmxsu.supabase.co/rest/v1/rpc/crm_bundle','https://rprechiaglyjaydkmxsu.supabase.co/rest/v1/users','https://n8n.example.invalid/crm-write'])await assert.rejects(f.w.fetch(url),/DENIED/);assert.equal(f.p.requests.length,0);}finally{f.dom.window.close();}});
test('account switch removes previous application cache and queue',async()=>{const f=fixture();try{await f.login();f.p.storage.setItem('cache','TEST_A');f.p.queue.enqueue('opportunity_work_set','TEST_DEAL',1,body);await f.login('test-auth-B');assert.equal(f.p.storage.getItem('cache'),null);assert.equal(f.p.queue.list().length,0);assert.equal(f.w.localStorage.length,0);}finally{f.dom.window.close();}});
test('relogin clears current queue/cache; logout removes tokens',async()=>{const f=fixture();try{await f.login();f.p.storage.setItem('cache','TEST');f.opts.auth.storage.setItem('sdk',JSON.stringify({user:{id:'test-auth-A'},access_token:'TEST'}));f.p.beginLogin();assert.equal(f.w.localStorage.length,0);assert.equal(f.w.sessionStorage.length,0);await f.login();await f.p.signOut();assert.equal(f.p.profile,null);}finally{f.dom.window.close();}});
test('old unnamespaced production storage remains unread, untouched',async()=>{const f=fixture();try{f.w.localStorage.setItem('nf_pc_write_q_v1','PRODUCTION_MARKER');await f.login();assert.equal(f.p.storage.getItem('nf_pc_write_q_v1'),null);await f.p.signOut();assert.equal(f.w.localStorage.getItem('nf_pc_write_q_v1'),'PRODUCTION_MARKER');}finally{f.dom.window.close();}});
test('lost ACK retries same request once without duplicate mutation',async()=>{const f=fixture();try{await f.login();const q=f.p.queue.enqueue('opportunity_work_set','TEST_DEAL',1,body);f.drop=true;await assert.rejects(f.p.queue.flush(),/LOST_ACK/);assert.equal(f.p.queue.list()[0].status,'uncertain');await f.p.queue.flush();assert.equal(f.p.queue.list()[0].status,'done');assert.equal(f.p.queue.list()[0].request_id,q.request_id);assert.equal(f.count,1);}finally{f.dom.window.close();}});
test('forged ACK cannot mark queue completed',async()=>{const f=fixture();try{await f.login();f.p.queue.enqueue('opportunity_work_set','TEST_DEAL',1,body);f.forged=true;await assert.rejects(f.p.queue.flush(),/ACK_CONTRACT_MISMATCH/);assert.equal(f.p.queue.list()[0].status,'uncertain');}finally{f.dom.window.close();}});
test('unsupported operations and admin mode fail closed',async()=>{const f=fixture();try{await f.login();assert.throws(()=>f.p.queue.enqueue('purge','X',1,{}),/UNAVAILABLE/);assert.throws(()=>f.p.mode('admin'),/DENIED/);}finally{f.dom.window.close();}});
