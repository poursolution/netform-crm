// Offline exchange contract only. No storage, network, or OS writes.
'use strict';
function validate(x){
 const e=[],str=v=>typeof v==='string'&&v.trim().length>0,ref=v=>v&&str(v.system)&&str(v.id);
 if(!x||typeof x!=='object')return ['object required'];
 if(x.schema!=='OS_STAFF_HANDOFF_V1'||x.schemaVersion!==1)e.push('schema');
 if(!['fixture','prepared'].includes(x.mode))e.push('mode');
 if(!str(x.handoffKey))e.push('handoffKey');
 if(!ref(x.source)||!str(x.targetSystem))e.push('source/target');
 if(!Array.isArray(x.receiptRefs))e.push('receiptRefs');
 else x.receiptRefs.forEach(r=>{if(!r||!str(r.sourceSystem)||!str(r.typeKey)||!str(r.sourceId)||!('osInternalId' in r)||!('displayNo' in r))e.push('receipt identity');
 if(r&&r.osInternalId!==null&&!str(r.osInternalId))e.push('osInternalId');if(r&&r.displayNo!==null&&!str(r.displayNo))e.push('displayNo');});
 if(!Array.isArray(x.unresolved)||!x.unresolved.every(str))e.push('unresolved');
 if(x.caseRef===null){if(!x.unresolved?.length)e.push('unbound reason');}
 else{const c=x.caseRef;if(!c||!str(c.caseId)||!str(c.siteId)||!Number.isInteger(c.scope)||c.scope<1||!['bid','direct'].includes(c.route))e.push('caseRef');
 if(c?.route==='direct'&&x.targetSystem==='bid')e.push('direct route cannot target bid');}
 if(!Array.isArray(x.documents))e.push('documents');else x.documents.forEach(d=>{if(!d||!str(d.id)||!str(d.version)||!str(d.purpose))e.push('document');});
 if(!x.result||!str(x.result.status))e.push('result');
 return e;
}
module.exports={validate};
