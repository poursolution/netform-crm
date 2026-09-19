import test from 'node:test';
import assert from 'node:assert/strict';
import {CRM_BACKEND_URL,validateBackendKey,checkBackend,connectBackend} from '../server/aligo/backend-connection.mjs';
const key='sb_secret_'+'synthetic'.repeat(4);
const jwt=claims=>Buffer.from('{"alg":"HS256"}').toString('base64url')+'.'+Buffer.from(JSON.stringify(claims)).toString('base64url')+'.synthetic';

test('connection rejects public keys and legacy server credentials for other projects',()=>{
 for(const candidate of ['sb_publishable_'+key,'',jwt({role:'anon',ref:'ymfbmpnizxvqsamnczow'}),jwt({role:'service_role',ref:'other'})])
  assert.throws(()=>validateBackendKey(candidate),/BACKEND_SERVER_KEY_REQUIRED/);
 assert.equal(validateBackendKey(key),key);
 assert.equal(validateBackendKey(jwt({role:'service_role',ref:'ymfbmpnizxvqsamnczow'})),jwt({role:'service_role',ref:'ymfbmpnizxvqsamnczow'}));
});
test('authentication calls only the pinned project pending RPC and persists after success',async()=>{
 const events=[];let saved;
 const result=await connectBackend(key,{path:'synthetic.dpapi',exists:()=>false,
  fetchImpl:async(url,options)=>{
   events.push('read');assert.equal(url,CRM_BACKEND_URL+'/rest/v1/rpc/crm_sms_worker_pending_v1');
   assert.equal(options.headers.apikey,key);assert.equal(options.headers.Authorization,undefined);
   assert.equal(options.redirect,'error');assert.deepEqual(Object.keys(JSON.parse(options.body)),['p_worker_id']);
   return {ok:true,json:async()=>({contract_version:1,items:[]})};
  },protect:(path,config)=>{events.push('protect');saved=config;},unprotect:()=>{events.push('restore');return saved;}});
 assert.deepEqual(events,['read','protect','restore']);
 assert.equal(result.automaticSending,false);assert.equal(JSON.stringify(result).includes(key),false);
});
test('failed authentication never stores a credential or exposes upstream details',async()=>{
 let writes=0;
 await assert.rejects(connectBackend(key,{path:'synthetic',exists:()=>false,protect:()=>{writes++;},unprotect:()=>{},
  fetchImpl:async()=>{throw Error('upstream echoed '+key);}}),/^Error: QUEUE_REQUEST_FAILED$/);
 assert.equal(writes,0);
});
test('existing credential cannot be overwritten and a different project is never contacted',async()=>{
 let calls=0;const fetchImpl=async()=>{calls++;};
 await assert.rejects(connectBackend(key,{path:'synthetic',exists:()=>true,fetchImpl}),/BACKEND_ALREADY_CONFIGURED/);
 await assert.rejects(checkBackend({url:'https://other.supabase.co',key},{fetchImpl}),/BACKEND_PROJECT_MISMATCH/);
 assert.equal(calls,0);
});
test('unexpected read contract and encrypted storage mismatch do not report success',async()=>{
 await assert.rejects(checkBackend({url:CRM_BACKEND_URL,key},{fetchImpl:async()=>({ok:true,json:async()=>({contract_version:2,items:[]})})}),/BACKEND_READ_CONTRACT_MISMATCH/);
 await assert.rejects(connectBackend(key,{path:'synthetic',exists:()=>false,protect:()=>{},unprotect:()=>({url:CRM_BACKEND_URL,key:'wrong'}),
 fetchImpl:async()=>({ok:true,json:async()=>({contract_version:1,items:[]})})}),/BACKEND_STORAGE_CHECK_FAILED/);
});
