/* Structured projection of original collaboration memos. No markup or styles. */
(function(root){
 'use strict';
 const RPC='crm_activity_context_v1',rows=new Map(),times=new Map(),pending=new Set();
 let epoch=0,identity='',job=null,scheduled=false;
 const who=()=>JSON.stringify(root.Phase1?.profile||root.ME||null);
 const enabled=()=>!root.FIELD_DEMO&&root.CRMRelease?.has?.(RPC)===true&&!!root.OpsStore?.has?.(RPC);
 function clear(){epoch++;identity=who();rows.clear();times.clear();pending.clear();}
 function sync(){if(identity!==who())clear();}
 function of(d){
  sync();const id=String(d?.id||'');if(!enabled()||! /^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(id))return null;
  if(!times.has(id)||Date.now()-times.get(id)>60000){pending.add(id);schedule();}
  return rows.get(id)||null;
 }
 function schedule(){if(scheduled||job)return;scheduled=true;Promise.resolve().then(()=>{scheduled=false;load();});}
 function load(){
  sync();if(job)return job;if(!enabled()||!pending.size)return Promise.resolve(false);
  const gen=epoch,owner=identity;
  const task=(async()=>{
   while(pending.size&&gen===epoch){const ids=[...pending].slice(0,200);ids.forEach(id=>{pending.delete(id);times.set(id,Date.now());});
    try{const r=await root.OpsStore.rpc(RPC,{deal_ids:ids});if(r?.ok!==true||!r.items||Array.isArray(r.items))throw Error('협업 기록 응답을 확인할 수 없습니다');
     sync();if(gen!==epoch||owner!==identity)return false;
     ids.forEach(id=>{const x=r.items[id];if(x&&Array.isArray(x.dec)&&Array.isArray(x.prg)&&Array.isArray(x.def)&&x.chk&&'wait' in x)rows.set(id,x);else rows.delete(id);});
    }catch(e){sync();if(gen!==epoch)return false;ids.forEach(id=>rows.delete(id));if(e?.code==='PGRST202')root.CRMRelease?.noteMissing?.(RPC);root.toast?.('협업 기록 조회 실패: '+String(e?.message||e),'warn');}
   }
   if(gen===epoch){root.dispatchEvent(new CustomEvent('activity-context:changed'));return true;}return false;
  })().finally(()=>{if(job===task)job=null;if(pending.size)schedule();});job=task;return task;
 }
 root.addEventListener('phase1:profile',clear);root.addEventListener('phase1:identity-cleared',clear);
 root.addEventListener('crm:read-state',e=>{if(e.detail?.ready)clear();});
 root.ActivityContext={of,load,clear,enabled};
})(window);
