/* Atomic same-site expansion notes; original note and existing UI are preserved. */
(function(root){
 'use strict';
 const WRITE='crm_expansion_contact_write_v1',READ='crm_expansion_contact_context_v1';
 const receipts=new Map(),cache=new Map(),inflight=new Map();let identity='',epoch=0,readRevision=0;
 const who=()=>JSON.stringify(root.Phase1?.profile||root.ME||null);
 const enabled=n=>!root.FIELD_DEMO&&root.CRMRelease?.has?.(n)===true&&root.OpsStore?.has?.(n)===true;
 function reset(){epoch++;identity=who();receipts.clear();cache.clear();inflight.clear();}
 function sync(){if(identity!==who())reset();}
 function apply(id,data){root.B.expansion_events=(root.B.expansion_events||[]).filter(x=>String(x.source_opportunity_id)!==String(id)).concat(data.events||[]);root.B.expansion_quote_dispatches=(root.B.expansion_quote_dispatches||[]).filter(x=>String(x.source_opportunity_id)!==String(id)).concat(data.dispatches||[]);}
 async function write(id,note,targets){
  sync();const owner=identity,gen=epoch,ids=[...new Set(targets||[])].filter(x=>x!==id).sort();
  if(ids.length&&!enabled(WRITE))throw Error('단지 연결 저장 기능이 아직 준비되지 않았습니다.');
  const key=JSON.stringify([id,note,ids]);if(!receipts.has(key))receipts.set(key,crypto.randomUUID());
  const p={source_opportunity_id:id,note,request_id:receipts.get(key)},atomic=enabled(WRITE);let data;
  if(atomic)data=await root.OpsStore.rpc(WRITE,{...p,target_ids:ids});
  else{const r=await root.SB.rpc('crm_expansion_note',{p});if(r.error)throw r.error;data=r.data;}
  if(data?.ok!==true||!data.event)throw Error('서버 저장을 확인하지 못했습니다.');
  if(atomic&&(data.operation!==WRITE||data.request_id!==p.request_id||data.source_opportunity_id!==id||data.linked_count!==ids.length||JSON.stringify(data.target_ids)!==JSON.stringify(ids)))throw Error('서버 연결 저장 결과가 요청과 다릅니다.');
  sync();if(owner!==identity||gen!==epoch)throw Error('계정이 변경되었습니다. 다시 조회해 주세요.');
  receipts.delete(key);readRevision++;cache.clear();inflight.clear();
  return data;
 }
 function read(id){
  sync();if(!enabled(READ))return Promise.resolve(false);
  if(cache.has(id)&&Date.now()-cache.get(id)<60000)return Promise.resolve(true);
  if(inflight.has(id))return inflight.get(id);const owner=identity,gen=epoch,revision=readRevision;
  const task=root.OpsStore.rpc(READ,{source_opportunity_id:id}).then(data=>{
   if(data?.ok!==true||!Array.isArray(data.events))throw Error('서버 이력을 확인하지 못했습니다.');
   sync();if(owner!==identity||gen!==epoch||revision!==readRevision)return false;apply(id,data);cache.set(id,Date.now());return true;
  }).finally(()=>{if(inflight.get(id)===task)inflight.delete(id);});inflight.set(id,task);return task;
 }
 root.addEventListener('phase1:profile',reset);root.addEventListener('phase1:identity-cleared',reset);
 root.addEventListener('crm:read-state',e=>{if(e.detail?.ready){readRevision++;cache.clear();inflight.clear();}});
 root.ExpansionContact={write,read,enabled:()=>enabled(READ)};
})(window);
