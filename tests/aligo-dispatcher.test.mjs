import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {AligoDispatcher} from '../server/aligo/dispatcher.mjs';
import {AligoError} from '../server/aligo/client.mjs';
const request='419a9ac6-b679-4f05-b99e-155f0d88f8a2';
const job={receiver:'01011112222',message:'Synthetic test',mode:'live'};
test('parallel and restarted dispatches share one provider call',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'aligo-test-'));let calls=0;
 const client={identity:'synthetic',send:async()=>{calls++;return {status:'submitted',messageId:'42'}}};
 let d=new AligoDispatcher(join(dir,'ledger.sqlite'),client);
 try{
  const results=await Promise.all([d.dispatch(request,job),d.dispatch(request,job)]);
  assert.equal(calls,1);assert.equal(results[0].status,'submitted');assert.equal(results[1].replayed,true);
  d.close();d=new AligoDispatcher(join(dir,'ledger.sqlite'),client);
  assert.equal((await d.dispatch(request,job)).messageId,'42');assert.equal(calls,1);
  await assert.rejects(d.dispatch(request,{...job,message:'different'}),/REQUEST_ID_REUSE/);
  await assert.rejects(d.dispatch(request,{...job,mode:'test'}),/REQUEST_ID_REUSE/);
 }finally{d.close();rmSync(dir,{recursive:true,force:true})}
});
test('ambiguous sends are quarantined across retries',async()=>{
 let calls=0;const d=new AligoDispatcher(':memory:',{identity:'synthetic',send:async()=>{calls++;throw new AligoError('ALIGO_SEND_OUTCOME_UNKNOWN',true)}});
 try{assert.equal((await d.dispatch(request,job)).status,'unknown');assert.equal((await d.dispatch(request,job)).status,'unknown');assert.equal(calls,1)}finally{d.close()}
});
test('delivery requires reconciliation against the original request',async()=>{
 const d=new AligoDispatcher(':memory:',{identity:'synthetic',send:async()=>({status:'submitted',messageId:'42'}),delivery:async()=>({status:'sent'})});
 try{
  assert.equal((await d.dispatch(request,job)).status,'submitted');
  await assert.rejects(d.reconcile(request,{...job,receiver:'01099998888'}),/REQUEST_ID_REUSE/);
  assert.equal((await d.reconcile(request,job)).status,'sent');
  assert.equal((await d.dispatch(request,job)).status,'sent');
 }finally{d.close()}
});
