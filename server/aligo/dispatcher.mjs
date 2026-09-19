import {DatabaseSync} from 'node:sqlite';
import {createHash} from 'node:crypto';
import {AligoError} from './client.mjs';

// The caller must use an owner-only, persistent directory outside the web root.
export class AligoDispatcher {
 constructor(path,client) {
  if(!client.identity) throw new AligoError('ALIGO_IDENTITY_REQUIRED');
  this.client=client;this.db=new DatabaseSync(path);
  this.db.exec("PRAGMA busy_timeout=5000; CREATE TABLE IF NOT EXISTS aligo_dispatch (request_id TEXT PRIMARY KEY, fingerprint TEXT NOT NULL, status TEXT NOT NULL, message_id TEXT, error_code TEXT, updated_at TEXT NOT NULL)");
 }
 close(){this.db.close();}
 fingerprint(job){return createHash('sha256').update(JSON.stringify({
  identity:this.client.identity,receiver:job.receiver,message:job.message,type:job.type||'SMS',mode:job.mode||'test',scheduledAt:job.scheduledAt||null
 })).digest('hex');}
 row(requestId){return this.db.prepare('SELECT request_id, fingerprint, status, message_id, error_code FROM aligo_dispatch WHERE request_id=?').get(requestId);}
 publicResult(row,replayed){return {requestId:row.request_id,status:row.status==='inflight'?'unknown':row.status,
  messageId:row.message_id||null,errorCode:row.error_code||null,replayed};}
 async dispatch(requestId,job) {
  if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(requestId)) throw new AligoError('INVALID_REQUEST_ID');
  const fingerprint=this.fingerprint(job);
  const inserted=this.db.prepare("INSERT INTO aligo_dispatch(request_id,fingerprint,status,updated_at) VALUES(?,?,'inflight',?) ON CONFLICT(request_id) DO NOTHING")
   .run(requestId,fingerprint,new Date().toISOString()).changes;
  const row=this.row(requestId);
  if(row.fingerprint!==fingerprint) throw new AligoError('REQUEST_ID_REUSE');
  if(!inserted) return this.publicResult(row,true);
  try {
   const result=await this.client.send(job);
   this.db.prepare('UPDATE aligo_dispatch SET status=?, message_id=?, updated_at=? WHERE request_id=?')
    .run(result.status,result.messageId,new Date().toISOString(),requestId);
  } catch(e) {
   // Unknown exceptions include persistence problems after provider acceptance.
   const known=e instanceof AligoError&&!e.ambiguous;
   this.db.prepare('UPDATE aligo_dispatch SET status=?,error_code=?,updated_at=? WHERE request_id=?')
    .run(known?'failed':'unknown',e instanceof AligoError?e.code:'ALIGO_SEND_OUTCOME_UNKNOWN',new Date().toISOString(),requestId);
  }
  return this.publicResult(this.row(requestId),false);
 }
 async reconcile(requestId,job) {
  const row=this.row(requestId);
  if(!row||row.fingerprint!==this.fingerprint(job)) throw new AligoError('REQUEST_ID_REUSE');
  if(row.status!=='submitted'||!row.message_id) return this.publicResult(row,true);
  const result=await this.client.delivery({messageId:row.message_id,receiver:job.receiver});
  // A pending response cannot downgrade a concurrent final result.
  if(['sent','failed'].includes(result.status)) this.db.prepare("UPDATE aligo_dispatch SET status=?,updated_at=? WHERE request_id=? AND status='submitted'")
   .run(result.status,new Date().toISOString(),requestId);
  return this.publicResult(this.row(requestId),true);
 }
}
