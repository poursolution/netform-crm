import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {run} from '../server/aligo/cli.mjs';
const job={requestId:'419a9ac6-b679-4f05-b99e-155f0d88f8a2',receiver:'01011112222',message:'TEST',mode:'live'};
const env={ALIGO_API_KEY:'synthetic',ALIGO_USER_ID:'synthetic',ALIGO_SENDER:'0211112222',ALIGO_ALLOWED_RECEIVERS:'01011112222'};
test('operator runner blocks live mode and unapproved recipients before network',async()=>{
 let calls=0;const fetchImpl=async()=>{calls++;throw Error('unexpected')};
 await assert.rejects(run('send',job,{...env,ALIGO_STATE_DIR:tmpdir()},fetchImpl),/LIVE_SEND_DISABLED/);
 await assert.rejects(run('send',{...job,receiver:'01099998888'},{...env,ALIGO_STATE_DIR:tmpdir(),ALIGO_LIVE_ENABLED:'true'},fetchImpl),/RECEIVER_NOT_ALLOWLISTED/);
 assert.equal(calls,0);
});
test('private state and repeated approved test request persist across runner restarts',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'aligo-run-'));let calls=0;
 const fetchImpl=async()=>{calls++;return {ok:true,json:async()=>({result_code:1,msg_id:'42',success_cnt:1,error_cnt:0})}};
 const config={...env,ALIGO_STATE_DIR:dir};
 try{
  assert.equal((await run('send',{...job,mode:'test'},config,fetchImpl)).status,'test_accepted');
  assert.equal((await run('send',{...job,mode:'test'},config,fetchImpl)).replayed,true);
  assert.equal(calls,1);
 }finally{rmSync(dir,{recursive:true,force:true})}
});
