/* External composer/clipboard handoff is not delivery evidence. Never calls a CRM write. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory;else root.InquiryMessageHandoff=factory(root);})(typeof window==='object'?window:globalThis,function(root){
 'use strict';
 async function copy(text){
  const value=String(text||'').trim();if(!value)throw Error('보낼 문구를 먼저 적어 주세요.');
  if(!root.navigator?.clipboard?.writeText)throw Error('이 환경에서는 복사할 수 없습니다. 입력한 문구를 직접 선택해 복사해 주세요.');
  try{await root.navigator.clipboard.writeText(value);}catch(e){throw Error('문구를 복사하지 못했습니다. 입력은 그대로 유지했습니다.');}
  return {copied:true,sent:false};
 }
 async function open({text,phone,channel='sms'}){
  if(!['sms','kakao'].includes(channel))throw Error('메시지 종류를 확인해 주세요.');
  const value=String(text||'').trim();if(!value)throw Error('보낼 문구를 먼저 적어 주세요.');
  const mobile=/Android|iPhone|iPad/i.test(root.navigator?.userAgent||'');
  if(channel==='sms'&&mobile){
   const digits=String(phone||'').replace(/\D/g,'');if(!/^0\d{8,10}$/.test(digits))throw Error('연락처를 확인해 주세요.');
   root.location.href='sms:'+digits+'?body='+encodeURIComponent(value);
   return {opened:true,sent:false,message:'문자 앱으로 이동을 요청했습니다. 실제 발송 여부는 아직 확인되지 않았습니다.'};
  }
  await copy(value);
  return {copied:true,sent:false,message:channel==='kakao'?'카카오에 붙여 넣을 문구를 복사했습니다. 실제 발송 여부는 아직 확인되지 않았습니다.':'문구를 복사했습니다. 실제 발송 여부는 아직 확인되지 않았습니다.'};
 }
 return Object.freeze({copy,open});
});
