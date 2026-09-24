(function(root){
 'use strict';
 // Deliberately no queue, RPC, provider request, or customer activity mutation.
 // Enable sending only after a server-side internal-recipient allowlist and
 // idempotent test-only delivery/log endpoint have been verified.
 var draft={channel:'sms',phone:'010-3282-5402',body:'안녕하세요, 관리소장님.\n넷폼입니다.\n\n잘 지내고 계신지 안부차 연락드립니다.\n공사 일정이나 계획이 정해지시면 편하게 말씀 부탁드립니다.\n\n감사합니다.'};
 function open(){
  if(document.getElementById('pc-message-test'))return;
  var focus=document.activeElement,dialog=document.createElement('dialog');dialog.id='pc-message-test';
  dialog.setAttribute('aria-labelledby','pc-message-test-title');
  dialog.innerHTML='<header><h2 id="pc-message-test-title">내부 테스트 발송</h2><button type="button" data-close aria-label="테스트 창 닫기">×</button></header><p class="test-notice">테스트 발송입니다. 고객에게는 발송되지 않습니다.</p><p>예시 고객 문구 · 실제 고객 데이터와 연결하지 않습니다.</p><label>테스트 수신번호<input name="phone" type="tel" readonly></label><label>발송채널<select name="channel"><option value="sms">문자 SMS</option><option value="kakao">카카오</option></select></label><label>메시지<textarea name="body" rows="7"></textarea></label><button type="button" data-preview>미리보기</button><pre class="test-preview" hidden></pre><p role="status" class="test-status"></p><button type="button" data-send disabled>테스트 발송하기 · 연동 대기</button>';
  document.body.appendChild(dialog);
  var phone=dialog.querySelector('[name=phone]'),channel=dialog.querySelector('[name=channel]'),body=dialog.querySelector('[name=body]'),preview=dialog.querySelector('pre'),status=dialog.querySelector('[role=status]');
  phone.value=draft.phone;channel.value=draft.channel;body.value=draft.body;
  function update(){draft.channel=channel.value;draft.body=body.value;preview.hidden=true;status.textContent=channel.value==='sms'?'SMS 내부 테스트 발송 API 연동 필요 · 아직 전송되지 않았습니다.':'카카오 발송 연동 필요 · 아직 전송되지 않았습니다.'}
  channel.onchange=update;body.oninput=update;
  dialog.querySelector('[data-preview]').onclick=function(){preview.textContent=(channel.value==='sms'?'SMS':'카카오')+' 미리보기\n테스트 수신: '+draft.phone+'\n\n'+body.value;preview.classList.toggle('kakao',channel.value==='kakao');preview.hidden=false};
  dialog.querySelector('[data-close]').onclick=function(){dialog.close()};
  dialog.addEventListener('close',function(){dialog.remove();if(focus&&focus.isConnected)focus.focus()});
  update();dialog.showModal();
 }
 var original=root.paintCampaign;
 root.paintCampaign=function(){original.apply(this,arguments);var host=document.getElementById('campaign-root');if(!host)return;var button=document.createElement('button');button.type='button';button.className='cc-btn pc-message-test-entry';button.textContent='내부 번호 테스트 발송';button.onclick=open;host.prepend(button)};
 root.addEventListener('phase1:identity-cleared',function(){var el=document.getElementById('pc-message-test');if(el)el.close()});
})(window);
