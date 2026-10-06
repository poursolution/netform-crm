/* Persistent consultation links: selected inquiry only, reviewed RPC visibility.
   Memory cache is identity scoped; no timers, whole-sheet reads or new UI. */
(function(root){
 'use strict';
 const RPC='crm_inquiry_consultation_list_v1',TTL=60000;
 const rows=new Map(),pending=new Map(),stamp=new Map(),errors=new Map(),versions=new Map();
 let epoch=0,identity='';
 const id=v=>String(v||'').toLowerCase();
 const who=()=>{const p=root.Phase1&&root.Phase1.profile;return p?JSON.stringify([p.auth_uid,p.user_id,p.role,p.permission_role]):'';};
 function reset(){epoch++;rows.clear();pending.clear();stamp.clear();errors.clear();versions.clear();identity=who();}
 function sync(){if(who()!==identity)reset();}
 const ready=()=>!!(root.Phase1&&root.Phase1.profile&&root.Phase1.rpc&&
  (root.CRM_RPC_ALLOW||[]).includes(RPC)&&root.CRMRelease&&root.CRMRelease.has(RPC)===true);
 function changed(){root.dispatchEvent(new CustomEvent('inquiry-consultation:changed'));}
 function load(value,force){
  sync();const key=id(value);if(!key||!ready())return Promise.resolve(false);
  if(pending.has(key))return pending.get(key);
  if(!force&&stamp.has(key)&&Date.now()-stamp.get(key)<TTL)return Promise.resolve(rows.has(key));
  const generation=epoch,owner=identity,version=versions.get(key)||0;stamp.set(key,Date.now());
  const task=Promise.resolve().then(()=>root.Phase1.rpc(RPC,{p_inquiry:key,p_after:null})).then(r=>{
   sync();if(generation!==epoch||owner!==identity||version!==(versions.get(key)||0))return false;
   if(r&&r.error)throw r.error;
   const data=r&&r.data!==undefined?r.data:r;
   if(!data||data.ok!==true||!Array.isArray(data.items))throw Error('INVALID_LINK_INDEX');
   rows.set(key,data.items.map(x=>({partner_id:id(x.id),at:x.at||'',by:x.by||''})));
   errors.delete(key);changed();return true;
  }).catch(e=>{
   sync();if(generation===epoch&&owner===identity&&version===(versions.get(key)||0)){rows.delete(key);errors.set(key,e);if(e&&e.code==='PGRST202')root.CRMRelease.noteMissing(RPC);}
   return false;
  }).finally(()=>{if(pending.get(key)===task)pending.delete(key);});
  pending.set(key,task);return task;
 }
 root.InquiryConsultationIndex={
  of(value){sync();const list=rows.get(id(value));return list&&list[0]||null;},
  loaded(value){sync();return rows.has(id(value));},
  error(value){sync();return errors.get(id(value))||null;},
  load,reset,
  invalidate(values){sync();for(const value of values){const key=id(value);versions.set(key,(versions.get(key)||0)+1);rows.delete(key);stamp.delete(key);pending.delete(key);}changed();}
 };
 root.addEventListener('phase1:identity-cleared',()=>{reset();changed();});
 root.addEventListener('phase1:profile',()=>{reset();changed();});
 root.addEventListener('focus',()=>{stamp.clear();changed();});
})(window);
