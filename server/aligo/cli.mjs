import {readFileSync,mkdirSync,chmodSync,realpathSync} from 'node:fs';
import {resolve,join,relative,isAbsolute,sep} from 'node:path';
import {pathToFileURL,fileURLToPath} from 'node:url';
import {createAligoClient,AligoError} from './client.mjs';
import {AligoDispatcher} from './dispatcher.mjs';

export async function run(action,job,env=process.env,fetchImpl=fetch) {
 const client=createAligoClient({key:env.ALIGO_API_KEY,userId:env.ALIGO_USER_ID,sender:env.ALIGO_SENDER,fetchImpl});
 if(action==='balance') return {provider:'aligo',balance:await client.balance()};
 if(!['send','status'].includes(action)||!job||typeof job!=='object') throw new AligoError('INVALID_COMMAND');
 if(!env.ALIGO_STATE_DIR) throw new AligoError('PRIVATE_STATE_DIR_REQUIRED');
 if(action==='send') {
  if(job.mode==='live'&&env.ALIGO_LIVE_ENABLED!=='true') throw new AligoError('LIVE_SEND_DISABLED');
  const allowed=String(env.ALIGO_ALLOWED_RECEIVERS||'').split(',').map(x=>x.replace(/[-\s]/g,'')).filter(Boolean);
  if(!allowed.includes(String(job.receiver||'').replace(/[-\s]/g,''))) throw new AligoError('RECEIVER_NOT_ALLOWLISTED');
 }
 const state=resolve(env.ALIGO_STATE_DIR);
 mkdirSync(state,{recursive:true,mode:0o700});
 // Refuse to put a private ledger anywhere in the source/deploy tree.
 const sourceRoot=fileURLToPath(new URL('../..',import.meta.url));
 const rel=relative(realpathSync(sourceRoot),realpathSync(state));
 if(rel===''||(!isAbsolute(rel)&&rel!=='..'&&!rel.startsWith('..'+sep))) throw new AligoError('STATE_DIR_MUST_BE_OUTSIDE_SOURCE');
 const path=join(state,'aligo-dispatch.sqlite');
 const dispatch=new AligoDispatcher(path,client);
 try{
  if(process.platform!=='win32') chmodSync(path,0o600);
  return await (action==='send'?dispatch.dispatch(job.requestId,job):dispatch.reconcile(job.requestId,job));
 }finally{dispatch.close()}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href) {
 try{
  const action=process.argv[2];
  const job=action==='balance'?null:JSON.parse(readFileSync(0,'utf8'));
  process.stdout.write(JSON.stringify(await run(action,job))+'\n');
 }catch(e){
  process.stderr.write(JSON.stringify({ok:false,code:e instanceof AligoError?e.code:'ALIGO_COMMAND_FAILED'})+'\n');
  process.exitCode=1;
 }
}
