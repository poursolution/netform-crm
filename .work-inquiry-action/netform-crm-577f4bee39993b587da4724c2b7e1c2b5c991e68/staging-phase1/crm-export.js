/* Downloads only the server-authorized projection; never serializes B/LOCAL/WRITE_Q. */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.CrmExport=api;
})(typeof window==='undefined'?this:window,function(){
  'use strict';
  async function request(client,filters){
    if(!client)throw Error('로그인이 필요합니다.');
    const initial=await client.auth.getSession();
    const uid=initial.data?.session?.user?.id;
    if(initial.error||!uid)throw Error('로그인이 필요합니다.');
    // The DB validates membership and aal2 again; this is only early UI feedback.
    const assurance=await client.auth.mfa.getAuthenticatorAssuranceLevel();
    if(assurance.error||assurance.data?.currentLevel!=='aal2')throw Error('관리자 MFA 인증 후 다시 요청해 주세요.');
    const {data,error}=await client.rpc('crm_export_create',{p:filters});
    if(error)throw Error('내보내기 권한 또는 요청 범위를 확인해 주세요.');
    if(!data||data.ok!==true||data.actor_id!==uid||!data.audit_id||!Array.isArray(data.rows)||
       !Array.isArray(data.columns)||data.rows.length>100)throw Error('서버 내보내기 확인에 실패했습니다.');
    const latest=await client.auth.getSession();
    if(latest.error||latest.data?.session?.user?.id!==uid)throw Error('계정이 변경되어 다운로드를 취소했습니다.');
    return data;
  }
  function open(client){
    if(document.getElementById('secure-export-dialog'))return;
    const dialog=document.createElement('dialog');dialog.id='secure-export-dialog';
    const form=document.createElement('form');form.method='dialog';
    const title=document.createElement('h3');title.textContent='관리자 내보내기 · MFA 인증 필요';form.append(title);
    const fields={};
    for(const [key,label,type] of [['from','시작일','date'],['to','종료일','date'],['brand','사업유형(정확한 이름)','text'],['reason','내보내기 사유','text']]){
      const row=document.createElement('label');row.textContent=label;row.style.display='block';
      const input=document.createElement('input');input.type=type;input.required=true;fields[key]=input;row.append(input);form.append(row);
    }
    const notice=document.createElement('p');notice.textContent='최대 31일·100건. 현장명/사업유형/단계/생성일만 내려받으며 요청은 서버에 기록됩니다.';form.append(notice);
    const error=document.createElement('p');error.setAttribute('role','alert');form.append(error);
    const cancel=document.createElement('button');cancel.type='button';cancel.textContent='닫기';cancel.onclick=()=>dialog.close();form.append(cancel);
    const submit=document.createElement('button');submit.type='submit';submit.textContent='내보내기 요청';form.append(submit);
    form.addEventListener('submit',async event=>{
      event.preventDefault();submit.disabled=true;error.textContent='';
      try{
        const filters=Object.fromEntries(Object.entries(fields).map(([k,input])=>[k,input.value]));
        filters.columns=['site','brand','stage','created'];filters.limit=100;
        const result=await request(client,filters);
        const blob=new Blob([JSON.stringify(result,null,2)],{type:'application/json'});
        const url=URL.createObjectURL(blob),a=document.createElement('a');
        a.href=url;a.download='crm-authorized-export.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);dialog.close();
      }catch(e){error.textContent=e.message;}finally{submit.disabled=false;}
    });
    dialog.addEventListener('close',()=>dialog.remove());dialog.append(form);document.body.append(dialog);dialog.showModal();
  }
  return {request,open};
});
