/* Consultation command client. No DOM, polling, automatic writes or inquiry mutation. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.InquiryConsultationClient=factory();})(typeof window==='object'?window:globalThis,function(){
 'use strict';
 const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
 const PREVIEW='crm_inquiry_consultation_preview_v1',WRITE='crm_inquiry_consultation_write_v1';
 const copy=v=>JSON.parse(JSON.stringify(v));
 function fail(code){const e=Error(code);e.code=code;throw e;}
 function pair(left,right){if(!UUID.test(left)||!UUID.test(right)||left.toLowerCase()===right.toLowerCase())fail('INVALID_PAIR');return [left.toLowerCase(),right.toLowerCase()].sort();}
 function version(v,left,right){return v&&Number.isSafeInteger(v.relationship_version)&&v.relationship_version>=0&&v.relationship_version<2147483647&&v.rows&&Object.keys(v.rows).length===2&&[left,right].every(id=>typeof v.rows[id]==='string'&&v.rows[id].length>0&&v.rows[id].length<=256);}
 function checkedPreview(v,left,right){
  if(!v||v.ok!==true||v.left_id!==left||v.right_id!==right||typeof v.active!=='boolean'||!version(v.expected,left,right)||!Array.isArray(v.inquiries)||v.inquiries.length!==2||v.inquiries.map(i=>i.id).sort().join(',')!==[left,right].join(','))fail('INVALID_PREVIEW');
  return copy(v);
 }
 function ackValid(a,p){return a?.ok===true&&a.request_id===p.args.p_request_id&&a.left_id===p.args.p_left&&a.right_id===p.args.p_right&&a.operation===p.args.p_operation&&a.active===(a.operation==='link')&&UUID.test(a.event_id)&&a.version===p.args.p_expected.relationship_version+1&&typeof a.saved_at==='string'&&Number.isFinite(Date.parse(a.saved_at));}
 function create({profile,storage,rpc,uuid}){
  let running=null;
  function actor(){const a=profile();if(!UUID.test(a?.auth_uid)||!UUID.test(a?.user_id))fail('AUTH_REQUIRED');return {auth_uid:a.auth_uid.toLowerCase(),user_id:a.user_id.toLowerCase()};}
  const key=a=>'inquiry-consultation-pending-v1:'+a.auth_uid+':'+a.user_id;
  function same(a){if(JSON.stringify(actor())!==JSON.stringify(a))fail('IDENTITY_CHANGED');}
  function pending(a=actor()){
   const raw=storage.getItem(key(a));if(!raw)return null;
   let p;try{p=JSON.parse(raw);}catch{fail('PENDING_INVALID');}
   const x=p?.args;if(!x||p.auth_uid!==a.auth_uid||p.user_id!==a.user_id||!UUID.test(x.p_request_id)||!UUID.test(x.p_left)||!UUID.test(x.p_right)||x.p_left>=x.p_right||!['link','unlink'].includes(x.p_operation)||typeof x.p_reason!=='string'||!x.p_reason.trim()||x.p_reason.length>2000||!version(x.p_expected,x.p_left,x.p_right)||(p.ack&&!ackValid(p.ack,p)))fail('PENDING_INVALID');
   return p;
  }
  async function preview(left,right){const a=actor(),[l,r]=pair(left,right);const value=await rpc(PREVIEW,{p_left:l,p_right:r});same(a);return checkedPreview(value,l,r);}
  function store(p,a){same(a);storage.setItem(key(a),JSON.stringify(p));}
  function execute(p,a){
   if(running){if(running.key!==key(a)||running.request_id!==p.args.p_request_id)fail('PENDING_REQUEST_EXISTS');return running.promise;}
   const promise=(async()=>{
    same(a);
    if(!p.ack){
     let ack;
     try{ack=await rpc(WRITE,copy(p.args));}
     catch(e){
      same(a);
      // Only explicit database rejection can release the pending command.
      // Transport failures and ambiguous responses retain the exact request.
      if((e.code==='PT409'&&['STALE_PREVIEW','RELATIONSHIP_UNCHANGED'].includes(e.message))||(e.code==='42501'&&e.message==='forbidden')||(e.code==='22023'&&e.message==='INVALID_REQUEST'))storage.removeItem(key(a));
      throw e;
     }
     same(a);if(!ackValid(ack,p))fail('INVALID_ACK');p.ack=copy(ack);store(p,a);
    }
    let current;
    try{current=await rpc(PREVIEW,{p_left:p.args.p_left,p_right:p.args.p_right});}
    catch{same(a);return {saved:true,verified:false,receipt:copy(p.ack),code:'READBACK_PENDING'};}
    same(a);
    current=checkedPreview(current,p.args.p_left,p.args.p_right);
    const v=current.expected.relationship_version;
    if(v<p.ack.version||(v===p.ack.version&&current.active!==p.ack.active))fail('READBACK_MISMATCH');
    storage.removeItem(key(a));
    return {saved:true,verified:true,receipt:copy(p.ack),current,superseded:v>p.ack.version};
   })();
   running={key:key(a),request_id:p.args.p_request_id,promise};
   promise.finally(()=>{if(running?.promise===promise)running=null;}).catch(()=>{});
   return promise;
  }
  function save(read,operation,reason){
   const a=actor(),[l,r]=pair(read?.left_id,read?.right_id),v=checkedPreview(read,l,r);
   if(!['link','unlink'].includes(operation)||typeof reason!=='string'||!reason.trim()||reason.trim().length>2000)fail('INVALID_REQUEST');
   if(v.active===(operation==='link'))fail('RELATIONSHIP_UNCHANGED');
   const args={p_left:l,p_right:r,p_operation:operation,p_reason:reason.trim(),p_expected:{rows:{[l]:v.expected.rows[l],[r]:v.expected.rows[r]},relationship_version:v.expected.relationship_version}};
   let p=pending(a);
   if(p){const old=copy(p.args);delete old.p_request_id;if(JSON.stringify(old)!==JSON.stringify(args))fail('PENDING_REQUEST_EXISTS');}
   else {const request=uuid();if(!UUID.test(request))fail('INVALID_REQUEST_ID');p={...a,args:{...args,p_request_id:request}};store(p,a);}
   return execute(p,a);
  }
  function retry(){const a=actor(),p=pending(a);if(!p)fail('NO_PENDING_REQUEST');return execute(p,a);}
  return Object.freeze({preview,save,retry,pending:()=>copy(pending())});
 }
 return Object.freeze({create});
});
