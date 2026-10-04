/* 파이프라인 상세 · 문자 보내기 v2 (2026-10-04 design_handoff_pipeline_sms · 파이프라인 문자 보내기 v2.dc.html) — 문자 보내기 창만.
   머리(받는 사람 · 번호 · 수신 동의 꼬리표 · [문자 | 카카오]) → 무엇을 보낼까(AI 추천 3개) → 보낼 문구(바로 수정 · 바이트 · 넣기 칩) → 언제 [지금 | 예약] · 보낸 뒤(다음 확인 자동 등록)
   + 오른쪽 폰 미리보기(카카오는 노란 말풍선) + 아래 [취소] [문구 복사] [보내기]. 가운데 패널 한 화면에 스크롤 없이.
   없앤 것: 발송 목적 · 연락 목적 선택, 채널 · 실행 방식 중복, 점수 · 단계 문구, 정보성 안내 상자, '발송 전 확인' 상자.
   ■ 추천 문구 · 발송 제한(수신거부 · 광고성 동의 · 발송 가능 시간) · 기록은 기존 엔진 그대로(relationshipTemplates · relationshipGuard · relationshipChannelHandoff · relationshipConfirm · relationshipSchedule).
     기존 본문(#kakaoBody)은 패널 안에 숨겨 두고, 보내기 직전에 이 화면의 값을 거기에 옮긴 뒤 기존 함수를 부른다.
   ■ 보내면 한 번에: 문자 앱(또는 카카오 복사) 실행 + 발송 기록(message_log) + 응대 이력 '문자' + 다음 확인 할 일.
   끄기: G.dealSmsV2Off=true → 예전 메시지 창 본문. */
(function(root){
 'use strict';
 const h=v=>root.esc(String(v==null?'':v)),attr=v=>root.escAttr(String(v==null?'':v));
 const enabled=()=>!root.G.dealSmsV2Off&&!!root.DealPanelsV2&&typeof root.relationshipGuard==='function';
 const panel=()=>{const p=document.getElementById('ddvPanel');return p&&p.classList.contains('dp-sms')?p:null;};
 const old=id=>document.getElementById(id);
 const DAYS=[1,2,3,7];
 const bytes=s=>[...String(s||'')].reduce((n,ch)=>n+(ch.charCodeAt(0)>127?2:1),0);
 const st=()=>{const M=root.REL_MSG;if(!M)return null;return M.ds2||(M.ds2={t:Math.min(2,M.index||0),body:null,days:null});};
 const tpls=()=>((root.REL_MSG&&root.REL_MSG.templates)||[]).slice(0,3);
 const cur=()=>tpls()[st().t]||tpls()[0];
 const daysOf=()=>{const S=st();return S.days||Number(cur().nextDays)||3;};
 const ownerOf=()=>{const M=root.REL_MSG;return root.repN(M.item.assignee)||'';};
 const ownerPhone=()=>{try{const m=/01[016789][-\s.]?\d{3,4}[-\s.]?\d{4}/.exec(String(root.relSignature(root.REL_MSG.item)||''));return m?m[0]:'';}catch(e){return '';}};
 const text=()=>{const S=st();return S.body!=null?S.body:String(cur().body||'');};
 const fill=s=>String(s).replace(/\{현장명\}/g,root.REL_MSG.item.site||'현장').replace(/\{담당자\}/g,ownerOf()).replace(/\{담당 연락처\}/g,ownerPhone());
 /* 이 화면의 값을 기존 본문(숨김)에 옮긴다 — 기존 검사 · 발송 · 기록 함수가 거기서 읽는다 */
 function sync(){
  const M=root.REL_MSG,S=st(),t=cur(),home=old('kakaoBody')||document.body;if(!M||!t)return;
  M.index=S.t;
  const mk=(tag,id,type)=>{let n=old(id);if(!n){n=document.createElement(tag);n.id=id;if(type)n.type=type;n.hidden=true;home.append(n);}return n;};
  const b=mk('textarea','rm-body');b.value=fill(text());b.dataset.edited='1';
  if(t.kind==='info')mk('input','rm-info-confirm','checkbox').checked=true;
  mk('input','rm-next','checkbox').checked=true;
  const nd=mk('select','rm-next-days'),d=String(daysOf());if(![...nd.options].some(o=>o.value===d)){const o=document.createElement('option');o.value=d;o.textContent=d+'일 뒤';nd.append(o);}nd.value=d;
  /* 지금 쓰이는 기록 함수는 다음 확인 날짜(REL_MSG.nextDate · #ctx-next-date)와 발송 목적(REL_MSG.purpose · #ctx-purpose)을 읽는다 */
  const due=new Date(Date.now()+daysOf()*864e5).toISOString().slice(0,10);M.nextDate=due;const dx=old('ctx-next-date');if(dx)dx.value=due;
  let pur=t.purpose;try{if(!pur&&typeof root.contextualMessagePurpose==='function')pur=root.contextualMessagePurpose(M.item,t);}catch(e){}if(pur){M.purpose=pur;const px=old('ctx-purpose');if(px){if(![...px.options].some(o=>o.value===pur)){const o=document.createElement('option');o.value=pur;o.textContent=pur;px.append(o);}px.value=pur;}}
 }
 function guard(){sync();try{return root.relationshipGuard();}catch(e){return {ok:false,msg:'발송 조건을 확인하지 못했습니다.'};}}
 const whenLabel=()=>{const s=String(root.REL_MSG.scheduleAt||root.relationshipDefaultSchedule()),d=new Date(s),tm=new Date(Date.now()+864e5),same=d.toDateString()===tm.toDateString();return (same?'내일':(d.getMonth()+1)+'.'+d.getDate())+' '+s.slice(11,16);};
 function html(){
  const M=root.REL_MSG,S=st(),c=M.contact,ch=M.channel==='kakao'?'kakao':'sms',t=cur(),T=tpls(),g=guard(),body=text();
  const has=ch==='sms'?!!c.smsConsent:!!c.kakaoConsent,blocked=!!(c.sendBlocked||c.optOutAt),chName=ch==='sms'?'문자':'카카오';
  const tag=blocked?'수신 거부':chName+(has?' 수신 동의':' 미동의'),good=has&&!blocked,b=bytes(fill(body));
  const stageName=root.stageLabel(root.dealStage(M.item)),hint=(()=>{try{const x=root.DealDetailV3&&document.querySelector('#detailView .dv3-subrow .over');return x?x.textContent.replace(/^·\s*/,''):'';}catch(e){return '';}})();
  const seg=on=>on?' aria-pressed="true"':' aria-pressed="false"';
  const follow=t.title+' 확인 전화 · '+daysOf()+'일 후 (자동 등록)';
  const sendL=g.ok?(M.mode==='schedule'?'예약 알림 등록':ch==='sms'?'휴대폰 문자앱으로 보내기':'카카오톡으로 보내기'):'보낼 수 없음';
  const foot=g.ok?(M.mode==='schedule'?'자동 발송이 아니라, 정한 시각에 보내기를 알려 주는 알림을 등록합니다':'보내면 응대 이력에 "'+chName+' · 회신대기"로 남고, 다음 확인이 오늘 업무에 잡힙니다'):g.msg;
  const brandC={'석민이앤씨':'#e8590c','POUR솔루션':'#1f9d55','POUR공법':'#7048e8','아파트스퀘어':'#3b6ce4'}[String(M.item.brand||'').trim()]||'#15171c';
  return '<div class="ds2-hd"><button type="button" class="ds2-back" data-ds="cancel" aria-label="뒤로">‹</button><b>'+chName+' 보내기</b><span>'+h((c.name||'고객')+(c.role?' '+String(c.role).replace(/^관리/,''):'')+' · '+root.phoneFmt(c.mobile))+'</span><em class="'+(good?'ok':'bad')+'">'+h(tag)+'</em><i></i><div class="ds2-seg" role="group" aria-label="채널"><button type="button" data-ds="ch" data-v="sms"'+seg(ch==='sms')+'>문자</button><button type="button" data-ds="ch" data-v="kakao"'+seg(ch==='kakao')+'>카카오</button></div></div>'
   +'<div class="ds2-body"><div class="ds2-main">'
   +'<div class="ds2-blk"><span class="ds2-lb">무엇을 보낼까 <small><b>AI</b>'+h([stageName,hint].filter(Boolean).join(' · '))+' 기준</small></span><div class="ds2-tpls">'+T.map((x,i)=>'<button type="button" data-ds="pick" data-i="'+i+'"'+seg(S.t===i)+'><b>'+h(x.title)+'</b><span>'+h(i===0?'추천 · 지금 단계':x.kind==='info'?'정보성':(x.why||'관계 · 안부'))+'</span></button>').join('')+'</div></div>'
   +'<div class="ds2-blk"><div class="ds2-row"><b>보낼 문구</b><span class="ds2-bytes">'+b+'byte · '+(b>90?'LMS':'SMS')+'</span></div><textarea class="ds2-text" data-ds-f="body" aria-label="보낼 문구">'+h(body)+'</textarea><div class="ds2-vars">'+['현장명','담당자','담당 연락처'].map(l=>'<button type="button" data-ds="var" data-v="'+l+'"'+(l==='담당 연락처'&&!ownerPhone()?' disabled title="담당 연락처가 서명에 없습니다"':'')+'>+ '+l+'</button>').join('')+'</div></div>'
   +'<div class="ds2-when"><b>언제</b><div class="ds2-seg" role="group" aria-label="언제"><button type="button" data-ds="when" data-v="now"'+seg(M.mode!=='schedule')+'>지금</button><button type="button" data-ds="when" data-v="schedule"'+seg(M.mode==='schedule')+'>예약 · '+h(whenLabel())+'</button></div><u></u><b>보낸 뒤</b><span>'+h(follow)+'</span><button type="button" class="ds2-lnk" data-ds="days">바꾸기</button></div>'
   +'</div><div class="ds2-phone"><div class="ds2-dev"><div class="ds2-scr"><div class="ds2-bar"><span>'+h(new Date().toTimeString().slice(0,5))+'</span><span class="notch"></span><span>LTE</span></div><div class="ds2-from"><span style="background:'+brandC+'">'+h(String(M.item.brand||'넷폼').trim().slice(0,1))+'</span><small>'+h((String(M.item.brand||'').trim()||'넷폼')+' · '+ownerOf())+'</small></div><div class="ds2-chat"><div class="ds2-bubble'+(ch==='kakao'?' kk':'')+'">'+h(previewText())+'</div></div><div class="ds2-home"></div></div></div><span>고객 폰에 보이는 모습</span></div></div>'
   +'<div class="ds2-ft"><span class="'+(g.ok?'':'bad')+'">'+h(foot)+'</span><button type="button" data-ds="cancel">취소</button><button type="button" class="b" data-ds="copy">문구 복사</button><button type="button" class="go" data-ds="send"'+(g.ok?'':' disabled')+'>'+h(sendL)+'</button></div>';
 }
 function previewText(){sync();try{return root.relationshipBody()||fill(text());}catch(e){return fill(text());}}
 function render(keepFocus){
  const p=panel();if(!p||!root.REL_MSG)return;
  let box=p.querySelector(':scope>.ds2');if(!box){box=document.createElement('div');box.className='ds2';p.append(box);box.addEventListener('click',onClick);box.addEventListener('input',onInput);}
  p.classList.add('ds2-on');
  const ta=keepFocus&&box.querySelector('.ds2-text'),pos=ta?[ta.selectionStart,ta.selectionEnd]:null;
  box.innerHTML=html();
  if(pos){const n=box.querySelector('.ds2-text');if(n){n.focus();try{n.setSelectionRange(pos[0],pos[1]);}catch(e){}}}
 }
 function onInput(e){
  if(!e.target.matches('[data-ds-f="body"]'))return;const S=st();S.body=e.target.value;
  /* 입력 중에는 다시 그리지 않고 미리보기 · 바이트만 갱신한다(포커스 유지) */
  const box=e.currentTarget,b=bytes(fill(S.body)),bt=box.querySelector('.ds2-bytes'),pv=box.querySelector('.ds2-bubble');if(bt)bt.textContent=b+'byte · '+(b>90?'LMS':'SMS');if(pv)pv.textContent=previewText();
 }
 function copy(s,done){try{const p=navigator.clipboard&&navigator.clipboard.writeText(s);if(p&&p.then){p.then(done).catch(done);return;}}catch(e){}done();}
 function onClick(e){
  const b=e.target.closest('[data-ds]');if(!b||b.disabled)return;const a=b.dataset.ds,M=root.REL_MSG,S=st();if(!M)return;
  if(a==='cancel'){root.closeKakaoModal();return;}
  if(a==='pick'){S.t=Number(b.dataset.i);S.body=null;S.days=null;render();return;}
  if(a==='ch'){M.channel=b.dataset.v;M.launched=false;render();return;}
  if(a==='when'){M.mode=b.dataset.v==='schedule'?'schedule':'now';if(M.mode==='schedule'&&!M.scheduleAt)M.scheduleAt=root.relationshipDefaultSchedule();M.launched=false;render();return;}
  if(a==='days'){const d=daysOf(),i=DAYS.indexOf(d);S.days=DAYS[(i+1)%DAYS.length];render();return;}
  if(a==='var'){const ta=e.currentTarget.querySelector('.ds2-text'),tok='{'+b.dataset.v+'}',v=ta.value,s=ta.selectionStart==null?v.length:ta.selectionStart,en=ta.selectionEnd==null?s:ta.selectionEnd;S.body=v.slice(0,s)+tok+v.slice(en);render();const n=e.currentTarget.querySelector('.ds2-text');if(n){n.focus();try{n.setSelectionRange(s+tok.length,s+tok.length);}catch(x){}}return;}
  if(a==='copy'){copy(previewText(),()=>root.toast&&root.toast('문구를 복사했습니다'));return;}
  if(a==='send'){
   const g=guard();if(!g.ok){render();return;}
   if(M.mode==='schedule'){root.relationshipSchedule();return;}/* 예약 = 보내기 알림(다음 할 일) 등록 */
   root.relationshipChannelHandoff();/* 문자 앱 실행(카카오는 번호 · 문구 복사) */
   root.relationshipConfirm('sent');/* 발송 기록 + 응대 이력 + 다음 확인 할 일 → 창 닫힘 */
  }
 }
 function boot(){
  const om=root.openRelationshipMessage;if(typeof om!=='function'||om.__ds2)return;
  const w=function(){const r=om.apply(this,arguments);try{const p=panel();if(p){if(enabled()&&root.REL_MSG)render();else{p.classList.remove('ds2-on');p.querySelector(':scope>.ds2')?.remove();}}}catch(e){if(root.console)root.console.warn('[문자 보내기 v2]',e);const p=panel();if(p){p.classList.remove('ds2-on');p.querySelector(':scope>.ds2')?.remove();}}return r;};
  w.__ds2=true;root.openRelationshipMessage=w;
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
 root.DealSmsV2={enabled,render,bytes};
})(window);
