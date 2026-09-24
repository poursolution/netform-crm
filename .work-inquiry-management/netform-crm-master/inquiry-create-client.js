(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.InquiryCreateClient=api})(typeof window==='object'?window:globalThis,function(){
 'use strict';
 const KEY='manual-inquiry-pending-v1',UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
 const fields=['brand','site_name','contact_name','phone','address','work_type','message','channel'];
 function validate(payload){
  if(!payload||Object.keys(payload).length!==fields.length||fields.some(k=>typeof payload[k]!=='string'))throw Error('INVALID_FIELDS');
  if(!['석민이앤씨','POUR솔루션','POUR공법','아파트스퀘어'].includes(payload.brand)||!['전화','문자','카카오','이메일','방문','기타'].includes(payload.channel))throw Error('INVALID_FIELDS');
  for(const [k,max] of [['site_name',200],['contact_name',100],['phone',50],['address',500],['work_type',200],['message',10000]])if(payload[k].length>max)throw Error('INVALID_FIELDS');
  if(!payload.site_name.trim()||payload.message.trim().length<2||(!payload.contact_name.trim()&&!payload.phone.trim()))throw Error('REQUIRED_FIELDS');
  if(payload.phone&&(!/^[0-9+(). -]+$/.test(payload.phone)||!/^\d{9,15}$/.test(payload.phone.replace(/\D/g,''))))throw Error('INVALID_PHONE');
  return payload;
 }
 function ackValid(a,p){return a?.ok===true&&a.contract_version===1&&a.operation==='inquiry_manual_create'&&a.request_id===p.request_id&&a.actor_auth_uid===p.auth_uid&&a.actor_user_id===p.user_id&&UUID.test(a.inquiry_id)&&a.status==='접수'&&a.assigned_to===null&&typeof a.replayed==='boolean'&&Number.isFinite(Date.parse(a.server_at));}
 function create({profile,storage,rpc,readback,uuid}){
  let busy=false;
  function actor(){const a=profile();if(!UUID.test(a?.auth_uid)||!UUID.test(a?.user_id))throw Error('AUTH_REQUIRED');return a;}
  function pending(){const a=actor(),raw=storage.getItem(KEY);if(!raw)return null;const p=JSON.parse(raw);if(p?.auth_uid!==a.auth_uid||p.user_id!==a.user_id||!UUID.test(p.request_id))throw Error('PENDING_INVALID');validate(p.payload);if(p.ack&&!ackValid(p.ack,p))throw Error('PENDING_INVALID');return p;}
  function same(p){const a=actor();if(a.auth_uid!==p.auth_uid||a.user_id!==p.user_id)throw Error('IDENTITY_CHANGED');}
  async function submit(payload){
   if(busy)throw Error('BUSY');busy=true;
   try{
    let p=pending();if(!p){const a=actor();p={request_id:uuid(),auth_uid:a.auth_uid,user_id:a.user_id,payload:validate(payload)};if(!UUID.test(p.request_id))throw Error('INVALID_REQUEST');storage.setItem(KEY,JSON.stringify(p));}
    if(!p.ack){const a=await rpc('crm_inquiry_manual_create_v1',{p_request_id:p.request_id,p_payload:p.payload});same(p);if(!ackValid(a,p))throw Error('INVALID_ACK');p.ack=a;storage.setItem(KEY,JSON.stringify(p));}
    const found=await readback(p.ack.inquiry_id);same(p);if(!found)throw Error('READBACK_PENDING');storage.removeItem(KEY);return p.ack;
   }finally{busy=false;}
  }
  return {pending,submit};
 }
 return {create,validate,ackValid};
});
