(function (root) {
 'use strict';
 // PC presentation only: move existing controls without replacing their values,
 // IDs, listeners or the existing save/consent validation path.
 var original = root.openQuickContact;
 if (typeof original !== 'function') return;
 root.openQuickContact = function (mode, key) {
  original.apply(this, arguments);
  var body = document.getElementById('quickContactBody');
  if (!body || !body.querySelector('#qc-name')) return;
  body.classList.add('pc-contact-editor');
  var form = body.querySelector('.formgrid');
  if (!form || form.querySelector('.pc-contact-editor-extra')) return;
  var extra = document.createElement('section');
  extra.className = 'pc-contact-editor-extra';
  var summary = document.createElement('strong');
  summary.className = 'pc-contact-editor-extra-label';
  summary.textContent = '사무소 연락처 · 관계정보 · 수신동의';
  extra.appendChild(summary);
  var fields = document.createElement('div');
  fields.className = 'formgrid';
  extra.appendChild(fields);
  ['qc-name', 'qc-role', 'qc-mobile'].forEach(function (id) {
   var input = body.querySelector('#' + id);
   if (input) form.appendChild(input.closest('.field'));
  });
  ['qc-office', 'qc-email', 'qc-decision-role', 'qc-relation-tone'].forEach(function (id) {
   var input = body.querySelector('#' + id);
   if (input) fields.appendChild(input.closest('.field'));
  });
  var consent = body.querySelector('.consentbox');
  if (consent) fields.appendChild(consent);
  form.appendChild(extra);
  var note = body.querySelector('.detailnotice');
  if (note) note.textContent = '이름·역할·휴대폰을 확인해 주세요. 관리소장은 저장 시 대표 연락처로 지정됩니다.';
  var mobile = body.querySelector('#qc-mobile');
  mobile.autocomplete = 'tel';
  var name = body.querySelector('#qc-name');
  name.autocomplete = 'name';
  var context=root.QUICK_CONTACT;
  if(context){
   var current=context.mode==='new'?{}:root.relationshipContact(context.item,context.contactKey);
   var roleInput=body.querySelector('#qc-role');
   ['관리사무소','현장대리인',current.role].filter(Boolean).forEach(function(role){if(!Array.from(roleInput.options).some(function(o){return o.value===role;}))roleInput.add(new Option(role,role));});
   if(current.role)roleInput.value=current.role;
   var raw=(context.item.contacts||[]).find(function(c){return c.person_key===context.contactKey;})||{};
   ['qc-decision-role','qc-relation-tone'].forEach(function(id){
    var input=body.querySelector('#'+id),value=id==='qc-decision-role'?raw.decision_role:raw.relationship_tone;
    if(input&&value){if(!Array.from(input.options).some(function(o){return o.value===value;}))input.add(new Option(value,value));input.value=value;}
    if(input){
     input.disabled=true;
     input.setAttribute('aria-describedby','pc-contact-relation-notice');
    }
   });
   var relationNotice=document.createElement('p');
   relationNotice.id='pc-contact-relation-notice';
   relationNotice.className='field full';
   relationNotice.textContent='관계정보는 현재 조회만 가능합니다. 현장별 저장 연결 전까지 기존 값을 유지하며, 연락처·수신동의는 별도로 저장할 수 있습니다.';
   fields.appendChild(relationNotice);
   if(context.mode!=='new')mobile.value=current.mobile||'';
   var consentAt=body.querySelector('#qc-consent-at');
   if(current.consentAt&&typeof root.localDateTimeValue==='function')consentAt.value=root.localDateTimeValue(current.consentAt);
   context.pcOriginal=current;
   context.pcConsentInput=body.querySelector('#qc-consent-at').value;
   context.pcDecision=body.querySelector('#qc-decision-role').value;
   context.pcTone=body.querySelector('#qc-relation-tone').value;
  }
  // 보조 섹션은 항상 펼쳐져 있어 검증 오류 시 자동 펼침 로직이 필요 없다.
 };
})(window);
