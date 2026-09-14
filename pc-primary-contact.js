(function(root){
 'use strict';
 const pending=new Map();
 const original=root.contactDirectoryHTML;
 if(typeof original!=='function')return;
 root.contactDirectoryHTML=function(item,p){
  const box=document.createElement('div');box.innerHTML=original(item,p);
  const contacts=root.siteContacts(item,p),primary=root.contactInfo(item,p);
  box.querySelectorAll('.pc-contact-directory>article').forEach((row,i)=>{
   const c=contacts[i];if(!c)return;
   const phone=root.phoneN(c.mobile),key=c.personKey||phone;
   if(phone===root.phoneN(primary.mobile))return;
   const button=document.createElement('button');button.type='button';
   const entry=pending.get(item.id),retry=!entry?.form&&entry?.status==='uncertain'&&entry.payload.person_key==='mobile:'+phone;
   button.textContent=retry?'대표 지정 재시도':entry?'지정 확인 중':'대표 지정';
   button.disabled=!!entry&&!retry||!/^010\d{8}$/.test(phone);
   button.setAttribute('onclick','pcSetPrimaryContact('+JSON.stringify(key)+')');
   row.querySelector('.pc-contact-actions').appendChild(button);
  });
  return box.innerHTML;
 };
 function repaint(item,message,success=true){
  if(root.CUR_DETAIL?.item?.id!==item.id)return;
  root.renderDetail();root.showDetailErr(message,success);
 }
 function sync(){
  if(!root.Phase1?.queue)return;
  const queue=root.Phase1.queue.list();
  pending.forEach((entry,id)=>{
   const q=queue.find(q=>q.request_id===entry.requestId);
   if(q&&['uncertain','rejected','conflict'].includes(q.status)&&entry.status!==q.status){
    entry.status=q.status;
    if(q.status!=='uncertain')pending.delete(id);
    if(entry.form&&root.QUICK_CONTACT===entry.form)root.quickContactErr(q.status==='uncertain'?'서버 응답이 불확실합니다. 저장을 다시 누르면 동일한 요청을 확인합니다.':'저장 요청이 거절되었거나 충돌했습니다. 입력 내용은 유지됩니다.');
    repaint(entry.item,q.status==='uncertain'?'서버 응답을 확인하지 못했습니다. 기존 대표를 유지하며, 재시도 시 같은 요청을 확인합니다.':'대표 지정 요청이 거절되었거나 충돌했습니다. 기존 대표는 유지됩니다. 최신 정보와 권한을 확인해 주세요.',false);
   }
   if(!q||q.status!=='done'||!q.ack)return;
   const {item,c,payload}=entry;
   // The queue validates the full RPC receipt before marking it done.
   if(q.operation!=='contact_upsert'||q.object_id!==id||q.ack.person_key!==payload.person_key)return;
   const contact=Object.assign({},c,{managerName:c.name,managerMobile:c.mobile,managerRole:c.role,personKey:payload.person_key});
   if(entry.raw){
    item.contacts=Array.isArray(item.contacts)?item.contacts:[];
    const index=item.contacts.findIndex(x=>x.person_key===payload.person_key);
    if(index<0)item.contacts.push(entry.raw);else item.contacts[index]=Object.assign({},item.contacts[index],entry.raw);
   }
   if(payload.is_primary||payload.manager_role==='관리소장'){
   root.itemPatch(item,'deal').contact=contact;item.contact=contact;
   Object.assign(item,{manager_name:c.name,manager_mobile:c.mobile,manager_role:c.role,person_key:payload.person_key,contact_id:q.ack.contact_id});
   if(payload.office_phone)item.office_phone=payload.office_phone;
   if(payload.office_email)item.office_email=payload.office_email;
   }
   if(entry.form&&root.QUICK_CONTACT===entry.form)root.closeQuickContact();
   pending.delete(id);root.saveLocal();repaint(item,entry.form?'연락처가 서버에 저장되었습니다.':'대표 연락처가 서버에 저장되었습니다.');
  });
 }
 root.pcSetPrimaryContact=function(key){
  const item=root.CUR_DETAIL?.kind==='deal'&&root.CUR_DETAIL.item;
  if(!item)return;
  const entry=pending.get(item.id);
  if(entry){
   if(entry.form)return;
   if(entry.status!=='uncertain'||String(key)!==String(entry.c.personKey||root.phoneN(entry.c.mobile)))return;
   entry.status='sending';repaint(item,'동일한 대표 지정 요청을 다시 확인하고 있습니다.');
   root.Phase1.queue.flush().catch(()=>{}).finally(sync);return;
  }
  const c=root.siteContacts(item,root.itemPatch(item,'deal')).find(c=>String(c.personKey||root.phoneN(c.mobile))===String(key));
  if(!c||!/^010\d{8}$/.test(root.phoneN(c.mobile))){root.showDetailErr('등록된 휴대폰 연락처를 확인해 주세요.');return;}
  const payload={opportunity_id:item.id,person_key:'mobile:'+root.phoneN(c.mobile),site_name:item.site,
   office_phone:c.officeTel||null,office_email:c.officeEmail||null,manager_name:c.name,manager_mobile:c.mobile,
   manager_role:c.role,is_primary:true,sms_consent:c.smsConsent,kakao_consent:c.kakaoConsent,
   consent_at:c.consentAt||null,opt_out_at:c.optOutAt||null,send_blocked:c.sendBlocked,send_blocked_reason:c.sendBlockedReason||null};
  try{
   if(!root.Phase1?.queue)throw new Error('저장 연결을 확인해 주세요.');
   const requestId=root.pushWrite('contact_upsert',payload);
   if(typeof requestId!=='string')throw new Error('서버 저장 요청을 확인할 수 없습니다.');
   pending.set(item.id,{item,c:Object.assign({},c),payload,requestId});
   repaint(item,'대표 지정 요청을 확인 중입니다. 실패하거나 지연되면 동기화 상태에서 확인해 주세요.');sync();
  }catch(e){root.showDetailErr('대표 연락처를 변경하지 못했습니다. '+e.message);}
 };
 root.saveQuickContact=function(){
  const form=root.QUICK_CONTACT;if(!form)return;
  const item=form.item,entry=pending.get(item.id);
  if(entry){
   if(entry.form!==form){root.quickContactErr('진행 중인 연락처 저장을 먼저 확인해 주세요.');return;}
   if(entry.status==='uncertain'){entry.status='sending';root.Phase1.queue.flush().catch(()=>{}).finally(sync);}
   return;
  }
  const value=id=>document.getElementById(id).value.trim(),checked=id=>document.getElementById(id).checked;
  if(value('qc-decision-role')!==form.pcDecision||value('qc-relation-tone')!==form.pcTone){root.quickContactErr('관계정보 변경은 현재 서버 저장 경로에 연결되어 있지 않습니다. 기존 값으로 되돌린 뒤 연락처를 저장해 주세요.');return;}
  const mobile=root.phoneN(value('qc-mobile')),name=value('qc-name'),role=value('qc-role'),old=form.pcOriginal||{};
  if(!name||!/^010\d{8}$/.test(mobile)){root.quickContactErr('성명과 010으로 시작하는 11자리 휴대폰 번호를 확인해 주세요.');return;}
  let consentAt=old.consentAt||null;
  if(value('qc-consent-at')!==form.pcConsentInput){
   const input=value('qc-consent-at');
   if(input&&!Number.isFinite(Date.parse(input))){root.quickContactErr('동의 확인 일시를 확인해 주세요.');return;}
   consentAt=input?new Date(input).toISOString():null;
  }
  const blocked=checked('qc-block'),sms=!blocked&&checked('qc-sms'),kakao=!blocked&&checked('qc-kakao');
  if((sms||kakao)&&!consentAt){root.quickContactErr('수신 동의 확인 일시를 입력해 주세요.');return;}
  const key='mobile:'+mobile,primary=root.contactInfo(item,root.itemPatch(item,'deal'));
  const payload={opportunity_id:item.id,person_key:key,site_name:item.site,office_phone:value('qc-office')||null,office_email:value('qc-email')||null,
   manager_name:name,manager_mobile:mobile,manager_role:role,is_primary:role==='관리소장'||(form.mode!=='new'&&root.phoneN(primary.mobile)===root.phoneN(old.mobile)),
   sms_consent:sms,kakao_consent:kakao,consent_at:consentAt,opt_out_at:blocked?(old.optOutAt||new Date().toISOString()):null,send_blocked:blocked,send_blocked_reason:value('qc-block-reason')||null};
  const raw={person_key:key,name,mobile,role,office_phone:payload.office_phone,office_email:payload.office_email,sms_consent:sms,kakao_consent:kakao,consent_at:consentAt,opt_out_at:payload.opt_out_at,send_blocked:blocked,send_blocked_reason:payload.send_blocked_reason};
  const c={name,mobile,role,personKey:key,officeTel:payload.office_phone,officeEmail:payload.office_email,smsConsent:sms,kakaoConsent:kakao,consentAt,optOutAt:payload.opt_out_at,sendBlocked:blocked,sendBlockedReason:payload.send_blocked_reason};
  try{
   if(!root.Phase1?.queue)throw Error('저장 연결을 확인해 주세요.');
   const requestId=root.pushWrite('contact_upsert',payload);
   if(typeof requestId!=='string')throw Error('저장 요청을 확인할 수 없습니다.');
   pending.set(item.id,{item,c,payload,raw,form,requestId});root.quickContactErr('서버 저장을 확인 중입니다.');sync();
  }catch(e){root.quickContactErr('저장하지 못했습니다. '+e.message);}
 };
 root.addEventListener('phase1:queue',sync);
 root.addEventListener('phase1:identity-cleared',()=>pending.clear());
})(window);
