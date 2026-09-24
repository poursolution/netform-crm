'use strict';
// Added independently of existing Modusign/Jandi/Make handlers.
const crypto = require('node:crypto');
const pick = (object, keys) => Object.fromEntries(keys.filter(k => object?.[k] !== undefined).map(k => [k, object[k]]));
function projectData(p) {
  return {
    ...pick(p, ['aptName','constructionName','companyName','companyManager','managerName','status','contractDate','contractDocumentType','consultingContractAmount']),
    modusign: pick(p.modusign, ['documentId','mock']),
    paymentStages: (p.paymentStages || []).map(s => pick(s, ['name','pct','condition'])),
    contractRecords: (p.contractRecords || []).map(r => pick(r, ['documentId','type','contractAmount','status','sentAt','completedAt','documentUrl','previousDocumentId','rootDocumentId','mock'])),
    contractHistoryEvents: (p.contractHistoryEvents || []).map(r => pick(r, ['documentId','event','completedAt']))
  };
}
async function deliver(snapshot, { url, secret, fetchImpl = fetch, now = Date.now }) {
  // Disabled unless explicitly configured. No secret or customer payload in logs.
  if (!url || !secret) throw new Error('CRM_SYNC_NOT_CONFIGURED');
  const target = new URL(url);
  if (target.protocol !== 'https:' || target.username || target.password || target.search || target.hash ||
      !['ymfbmpnizxvqsamnczow.supabase.co','rprechiaglyjaydkmxsu.supabase.co'].includes(target.hostname) ||
      target.pathname !== '/functions/v1/technical-advisory-ingest') throw new Error('CRM_TARGET_NOT_ALLOWED');
  if (!snapshot.exists) throw new Error('CRM_SOURCE_MISSING');
  const stamp = snapshot.updateTime;
  const revision = (BigInt(stamp.seconds) * 1000000000n + BigInt(stamp.nanoseconds)).toString();
  const body = JSON.stringify({ projectId: snapshot.id, revision, data: projectData(snapshot.data()) });
  const timestamp = String(Math.floor(now() / 1000));
  const signature = crypto.createHmac('sha256', secret).update(timestamp + '.' + body).digest('hex');
  const result = await fetchImpl(url, { method:'POST', redirect:'error', signal:AbortSignal.timeout(20000),
    headers:{'content-type':'application/json','x-crm-timestamp':timestamp,'x-crm-signature':signature}, body });
  if (!result.ok) throw new Error('CRM_SYNC_HTTP_' + result.status);
  const ack = await result.json();
  if (ack.ok !== true || ack.project_id !== snapshot.id || ack.revision !== revision) throw new Error('CRM_SYNC_INVALID_ACK');
  return ack;
}
function register(functions, db) {
  // Scheduled read-back also brings in historical contracts and repairs missed events.
  // No Firestore writes or modifications to existing alert recipients.
  return {
    crmContractSync: functions.runWith({failurePolicy:true,timeoutSeconds:60}).firestore.document('projects/{projectId}').onWrite(async (change) => {
      if (process.env.CRM_CONTRACT_SYNC_ENABLED !== 'true') return null;
      // Preserve CRM history on source deletion; surface deletion separately before enabling delete mirroring.
      if (!change.after.exists) { console.warn('CRM_SOURCE_DELETED_REVIEW_REQUIRED'); return null; }
      return deliver(change.after, {url:process.env.CRM_CONTRACT_SYNC_URL,secret:process.env.CRM_CONTRACT_SYNC_SECRET});
    }),
    crmContractReconcile: functions.runWith({timeoutSeconds:540}).pubsub.schedule('every 60 minutes').onRun(async () => {
      if (process.env.CRM_CONTRACT_SYNC_ENABLED !== 'true') return null;
      let cursor;
      do {
        let query = db.collection('projects').orderBy('__name__').limit(50);
        if (cursor) query = query.startAfter(cursor);
        const page = await query.get();
        if (page.empty) break;
        for (const doc of page.docs) await deliver(doc,{url:process.env.CRM_CONTRACT_SYNC_URL,secret:process.env.CRM_CONTRACT_SYNC_SECRET});
        cursor = page.docs[page.docs.length - 1];
        if (page.size < 50) break;
      } while (true);
      return null;
    })
  };
}
module.exports = {register, deliver, projectData};
