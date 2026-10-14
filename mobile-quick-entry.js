/* 모바일 기록 · 등록(E) — '사진 · 자료 올리기'와 '일정 등록'을 실제로 연결 (2026-10-14)
   · 사진 · 자료: 현장을 고르면 기존 사진 · 자료 입력(분류 · 메모)이 열리고, 올리기는 기존 저장 길(uploadAttachmentM → Phase1.uploadAttachment)을 쓴다.
     현장 이력 한 줄은 연락 입력 전용 경로(queueMobileContactOperation · standalone)로 남긴다 — 이 줄이 실패해도 올린 파일은 그대로(따로 알린다).
   · 일정 등록: 현장을 고르면 종류(방문 · 현설 · PT · 통화) · 날짜 · 시각 · 고객과 약속 여부 → PC와 같은 일정 저장 계약(ScheduleContract · crm_schedule_write_v1).
     같은 요청 번호로 영수증을 먼저 확인하고(receipt) 없을 때만 쓴다. 기존 일정은 바꾸지 않고 새 일정 하나를 더한다.
   종류 → 서버 칸(action_type): 방문 · 현설 = 방문, 통화 = 전화, PT = 기타(제목에 PT) — 서버가 받는 값은 전화 · 방문 · 후속접촉 · 기타. */
(function(w){
 'use strict';
 const esc=s=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
 const KIND=[['방문','방문'],['현설','방문'],['PT','기타'],['통화','전화']];
 const kst=add=>new Date(Date.now()+9*36e5+(add||0)*864e5).toISOString().slice(0,10);
 const deal=()=>(w.DEALS||[]).find(d=>String(d.id)===String(w.G&&w.G.deal));
 let busy=false,pick='방문';
 const chipCss=on=>on?'background:#15171c;color:#fff;border-color:#15171c':'background:#fff;color:#15171c';
 /* ── 사진 · 자료: 기존 저장 함수를 안전한 이력 기록으로 바꿔 끼운다 ── */
 const legacySave=w.saveAttachmentsM;
 async function saveAttachments(){
  const d=deal();if(w.DEMO||!d||typeof w.uploadAttachmentM!=='function')return legacySave&&legacySave.apply(this,arguments);
  const G=w.G,files=G.attachFiles||[],cat=(document.getElementById('attach-cat-m')||{}).value,memo=((document.getElementById('attach-memo-m')||{}).value||'').trim(),tags=(G.attachTags||[]).slice(),btn=document.getElementById('attach-save-m');
  if(!files.length||!cat)return w.toast('파일과 분류를 확인해 주세요');
  if(btn){btn.disabled=true;btn.textContent='올리는 중…';}
  const rows=[];
  try{for(const f of files)rows.push(await w.uploadAttachmentM(d,f,cat,tags,memo));}
  catch(e){if(btn){btn.disabled=false;btn.textContent='다시 올리기';}if(rows.length)d.attachments=(d.attachments||[]).concat(rows);return w.toast('올리지 못했습니다'+(rows.length?' (앞의 '+rows.length+'개는 올라감)':'')+' · '+String(e&&e.message||e));}
  d.attachments=(d.attachments||[]).concat(rows);
  const note=(G.attachKind==='photo'?'현장사진 ':'자료 ')+rows.length+'개 등록 · '+cat+(tags.length?' · '+tags.join(', '):'');let logged=true;
  try{w.queueMobileContactOperation('activity',{opportunity_id:String(d.id),intent:'standalone',type:'파일첨부',note:note+(memo?' — '+memo:''),occurred_at:new Date().toISOString(),meaningful_contact:false});}catch(e){logged=false;}
  G.attachFiles=[];G.attachTags=[];w.closeSheet&&w.closeSheet();
  w.toast(rows.length+'개 파일을 올렸습니다'+(logged?' · 현장 이력에 기록':' · 이력 한 줄은 남기지 못했습니다'));w.render&&w.render();
 }
 if(typeof legacySave==='function')w.saveAttachmentsM=saveAttachments;
 function attach(kind){if(typeof w.openAttachmentPickerM!=='function')return w.toast('사진 · 자료 입력을 열지 못했습니다');w.openAttachmentPickerM(kind==='file'?'file':'photo');}
 /* ── 일정 등록 ── */
 function schedule(){
  const d=deal();if(!d)return;pick='방문';
  const chips=KIND.map(k=>'<button type="button" class="cchip" data-mq-kind="'+k[0]+'" aria-pressed="'+(k[0]===pick)+'" style="'+chipCss(k[0]===pick)+'">'+k[0]+'</button>').join('');
  const inp='width:100%;border:1px solid var(--line-2,#d9dde4);border-radius:12px;padding:12px;font:inherit;font-size:15px;box-sizing:border-box';
  w.openSheet((w.intro?w.intro('var(--blue-50)','var(--blue-dark)',(w.IC&&w.IC.cal)||'',esc(d.nm),'방문 · 현설 · PT · 통화 일정을 더합니다 — 기존 일정은 그대로'):'<b>'+esc(d.nm)+'</b>'),
   '<div class="card"><div class="hint" style="margin-bottom:6px">종류</div><div class="chiprow" id="mq-kinds">'+chips+'</div>'
   +'<div class="hint" style="margin:14px 0 6px">날짜</div><input id="mq-date" type="date" min="'+kst(0)+'" value="'+kst(1)+'" style="'+inp+'">'
   +'<div class="hint" style="margin:14px 0 6px">시각 (선택)</div><input id="mq-time" type="time" style="'+inp+'">'
   +'<div class="hint" style="margin:14px 0 6px">내용 (선택)</div><input id="mq-memo" maxlength="80" placeholder="예: 관리소장 · 옥상 실측" style="'+inp+'">'
   +'<label style="display:flex;align-items:center;gap:8px;margin-top:14px;font-size:14px"><input id="mq-agreed" type="checkbox" style="width:20px;height:20px">고객과 약속한 날짜</label>'
   +'<div id="mq-err" style="margin-top:10px;font-size:13px;color:#b42318"></div>'
   +'<button type="button" class="btn btn-primary" id="mq-save" style="margin-top:14px">일정 저장</button></div>');
 }
 async function saveSchedule(){
  if(busy)return;const d=deal(),sc=w.ScheduleContract,err=document.getElementById('mq-err'),btn=document.getElementById('mq-save'),say=m=>{if(err)err.textContent=m;};
  if(!d)return say('현장을 다시 골라 주세요.');
  const date=(document.getElementById('mq-date')||{}).value||'',time=(document.getElementById('mq-time')||{}).value||'',memo=((document.getElementById('mq-memo')||{}).value||'').trim(),agreed=!!(document.getElementById('mq-agreed')||{}).checked;
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||date<kst(0))return say('날짜는 오늘 이후로 골라 주세요.');
  if(!sc||typeof sc.list!=='function')return say('일정 저장 연결을 찾지 못했습니다.');
  if(w.DEMO)return say('예시 화면에서는 일정을 저장하지 않습니다.');
  const k=KIND.find(x=>x[0]===pick)||KIND[0],title=(k[0]+(time?' '+time:'')+(memo?' · '+memo:'')).slice(0,120);
  busy=true;if(btn){btn.disabled=true;btn.textContent='저장 확인 중…';}
  try{
   const c=await sc.list('deal',String(d.id),1);if(!c.ready)throw Error('일정 저장이 아직 켜져 있지 않습니다');
   const prepared=sc.prepare(c,{operation:'add',action_type:k[1],title,due_on:date,date_basis:agreed?'customer_agreed':'internal_plan'},w.crypto.randomUUID());
   let ack=await sc.receipt(prepared);if(!ack)ack=await sc.write(prepared);
   w.closeSheet&&w.closeSheet();w.toast(date.slice(5).replace('-','.')+' '+k[0]+' 일정을 저장했습니다');w.render&&w.render();
  }catch(e){say('저장하지 못했습니다 — '+String(e&&e.message||e));}
  finally{busy=false;if(btn&&document.body.contains(btn)){btn.disabled=false;btn.textContent='일정 저장';}}
 }
 document.addEventListener('click',e=>{
  const kb=e.target.closest&&e.target.closest('[data-mq-kind]');if(kb){pick=kb.dataset.mqKind;document.querySelectorAll('#mq-kinds [data-mq-kind]').forEach(b=>{const on=b.dataset.mqKind===pick;b.setAttribute('aria-pressed',String(on));b.style.cssText=chipCss(on);});return;}
  if(e.target.closest&&e.target.closest('#mq-save'))saveSchedule();
 });
 w.MobileQuick=Object.freeze({attach,schedule,saveSchedule,saveAttachments,KIND});
})(window);
