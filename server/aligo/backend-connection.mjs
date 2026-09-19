import {randomUUID} from 'node:crypto';
import {createQueueClient,QueueError} from './campaign-worker.mjs';

export const CRM_BACKEND_URL='https://ymfbmpnizxvqsamnczow.supabase.co';
const PROJECT_REF='ymfbmpnizxvqsamnczow';
export function validateBackendKey(value) {
 const key=typeof value==='string'?value.trim():'';
 if(/^sb_secret_[A-Za-z0-9_-]{20,200}$/.test(key))return key;
 try {
  const parts=key.split('.');
  if(parts.length!==3||key.length>4096)throw Error();
  const claims=JSON.parse(Buffer.from(parts[1],'base64url').toString('utf8'));
  if(claims.role==='service_role'&&claims.ref===PROJECT_REF&&parts.every(x=>/^[A-Za-z0-9_-]+$/.test(x)))return key;
 }catch{}
 throw new QueueError('BACKEND_SERVER_KEY_REQUIRED');
}
export async function checkBackend(config,{fetchImpl=fetch}={}) {
 if(config?.url!==CRM_BACKEND_URL)throw new QueueError('BACKEND_PROJECT_MISMATCH');
 const key=validateBackendKey(config.key);
 const result=await createQueueClient({url:CRM_BACKEND_URL,key,fetchImpl}).call('crm_sms_worker_pending_v1',{p_worker_id:randomUUID()});
 if(result.contract_version!==1||!Array.isArray(result.items)||result.items.length!==0)
  throw new QueueError('BACKEND_READ_CONTRACT_MISMATCH');
 return {ok:true,operation:'backend_read_check',pending:0,automaticSending:false};
}
export async function connectBackend(key,{path,protect,unprotect,exists,fetchImpl=fetch}) {
 if(exists(path))throw new QueueError('BACKEND_ALREADY_CONFIGURED');
 const config={url:CRM_BACKEND_URL,key:validateBackendKey(key)};
 await checkBackend(config,{fetchImpl});
 protect(path,config);
 const restored=unprotect(path);
 if(restored.url!==config.url||restored.key!==config.key)throw new QueueError('BACKEND_STORAGE_CHECK_FAILED');
 return {ok:true,operation:'backend_connect',encrypted:true,automaticSending:false};
}
