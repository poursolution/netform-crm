(function(root){
 'use strict';
 let capability=null,epoch=0,dialog=null,client=null,returnFocus=null;
 const names={brand:'유입 브랜드',channel:'접수 경로',site_name:'현장명',work_type:'공종',contact_name:'문의자',phone:'연락처',address:'현장 주소',message:'문의 내용'};
 function allowed(){return capability?.can_create===true&&capability.contract_version===1&&root.inqCtlRoleView?.()==='admin';}
 function paintButton(){const heading=document.querySelector('.inq-inbox-heading');if(!heading)return;heading.querySelector('.inq-create-trigger')?.remove();if(!allowed())return;const b=document.createElement('button');b.type='button';b.className='inq-create-trigger';b.textContent='+ 문의 등록';b.onclick=open;heading.prepend(b);}
 async function refresh(){const version=++epoch;capability=null;paintButton();if(!root.Phase1?.profile||!root.Phase1?.rpc)return;try{const value=await root.Phase1.rpc('crm_inquiry_manual_capability_v1',{});if(version===epoch){capability=value;paintButton();}}catch{}}
 function close(){dialog?.remove();dialog=null;returnFocus?.focus();}
 function message(e){if(e.message==='INVALID_PHONE')return '연락처를 확인해 주세요. 숫자 9~15자리로 입력할 수 있습니다.';if(['REQUIRED_FIELDS','INVALID_FIELDS'].includes(e.message))return '현장명, 문의 내용, 문의자 또는 연락처를 입력해 주세요.';if(e.message==='READBACK_PENDING')return '등록은 확인됐습니다. 목록을 다시 불러오려면 아래 버튼을 눌러 주세요.';if(e.message==='ADMIN_REQUIRED'||e.code==='42501')return '현재 계정에는 문의 등록 권한이 없습니다. 입력한 요청은 보관되어 있습니다.';return '등록 결과를 아직 확인하지 못했습니다. 같은 요청으로 다시 확인해 주세요. 새 문의는 추가로 만들지 않습니다.';}
 function open(){
  if(!allowed()||dialog)return;returnFocus=document.activeElement;
  client=root.InquiryCreateClient.create({profile:()=>root.Phase1.profile,storage:root.Phase1.storage,rpc:(n,a)=>root.Phase1.rpc(n,a),uuid:()=>crypto.randomUUID(),readback:async id=>{const response=await root.Phase1.read('operational',{domains:['inquiry_core']});if(!response?.data?.inquiries?.some(q=>q.id===id))return false;await root.loadData();return !!root.B?.inquiries?.some(q=>q.id===id);}});
  dialog=document.createElement('dialog');dialog.className='inq-create-dialog';dialog.setAttribute('aria-labelledby','inq-create-title');
  dialog.innerHTML='<form><header><div><h2 id="inq-create-title">신규 문의 등록</h2><p>등록된 문의는 미배정 목록에서 담당자를 배정할 수 있습니다.</p></div><button type="button" data-close aria-label="닫기">×</button></header><fieldset class="inq-create-fields"></fieldset><p class="inq-create-status" role="status" aria-live="polite"></p><footer><button type="button" data-close>닫기</button><button type="submit" class="primary">문의 등록</button></footer></form>';
  const form=dialog.querySelector('form'),fieldset=dialog.querySelector('fieldset'),status=dialog.querySelector('[role=status]'),submit=dialog.querySelector('[type=submit]');
  for(const key of Object.keys(names)){const label=document.createElement('label');label.textContent=names[key]+(['brand','channel','site_name','message'].includes(key)?' *':'');const input=document.createElement(key==='brand'||key==='channel'?'select':key==='message'?'textarea':'input');input.name=key;input.setAttribute('aria-label',names[key]);if(key==='brand'||key==='channel'){for(const value of key==='brand'?['석민이앤씨','POUR솔루션','POUR공법','아파트스퀘어']:['전화','문자','카카오','이메일','방문','기타']){const option=document.createElement('option');option.value=option.textContent=value;input.append(option);}}else{input.maxLength={site_name:200,contact_name:100,phone:50,address:500,work_type:200,message:10000}[key];if(key==='site_name'||key==='message')input.required=true;if(key==='message'){input.minLength=2;input.rows=5;}if(key==='phone')input.type='tel';}if(key==='message'||key==='address')label.className='full';label.append(input);fieldset.append(label);}
  const hint=document.createElement('small');hint.className='full';hint.textContent='문의자 또는 연락처 중 하나는 입력해 주세요.';fieldset.append(hint);
  let busy=false,blocked=false;
  function restore(){try{const p=client.pending();if(p){for(const key of Object.keys(names))form.elements[key].value=p.payload[key];fieldset.disabled=true;submit.textContent=p.ack?'목록 다시 확인':'같은 요청으로 확인';return p;}}catch{blocked=true;fieldset.disabled=true;submit.disabled=true;status.textContent='보관된 요청을 읽을 수 없습니다. 기존 등록 내역을 확인하기 전에는 새 요청을 보내지 않습니다.';}return null;}
  restore();
  dialog.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>{if(!busy)close();});dialog.addEventListener('cancel',e=>{if(busy)e.preventDefault();else close();});
  form.onsubmit=async e=>{e.preventDefault();if(busy||blocked)return;const payload=Object.fromEntries(Object.keys(names).map(k=>[k,form.elements[k].value.trim()]));busy=true;submit.disabled=true;status.textContent='등록 결과를 확인하고 있습니다…';
   try{root.InquiryCreateClient.validate(payload);fieldset.disabled=true;await client.submit(payload);close();root.G.inqBrands=[];root.G.brand='전체';root.G.rep='전체';root.G.workFilter='전체';root.G.q='';root.G.inqPeriodMode='snapshot';root.G.inqPage=1;root.InquiryWorkbench.set('unassigned');root.toast?.('문의가 등록됐습니다. 담당자를 배정해 주세요.');}
   catch(error){if(dialog){status.textContent=message(error);if(!restore()&&!blocked)fieldset.disabled=false;}}
   finally{busy=false;if(dialog)submit.disabled=blocked;}
  };
  document.body.append(dialog);dialog.showModal();form.elements.site_name.focus();
 }
 const original=root.paintInq;root.paintInq=function(){const result=original.apply(this,arguments);paintButton();return result;};
 root.addEventListener('phase1:profile',refresh);root.addEventListener('phase1:identity-cleared',()=>{epoch++;capability=null;close();paintButton();});
 root.InquiryCreate={refresh,open};refresh();
})(window);
