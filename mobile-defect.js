/* 하자 사진 간이 접수 (2026-10-22 회의록 10/1 · 10/21 '단일 창구'): 영업건 상세 → 더보기 [하자 접수] → 사진 1장 · 부위 · 긴급 · 메모 → [접수]
   · 사진은 저장소 비공개 버킷 defect-photos 에 올리고(경로 <내 auth uid>/<영업건 id>/<시각>.jpg · 1280px 이하 JPEG 로 줄임), 접수는 서버 명령 crm_defect_report_create_v1(같은 request_id = 같은 행).
   · 접수되면 응대 기록에 '[하자] …' 표식이 서버에서 같이 남고(확장관리 '하자 먼저' · PC 상세 하자 칸이 알아봄), 본사 알림은 잔디 사건 알림(crm-jandi event · 켜져 있을 때만 · 실패해도 접수는 끝).
   · 끄기 G.mobileDefectOff. 서버 함수 없으면 [하자 접수] 줄이 안 보인다(CRMRelease.listed). */
(function(root){
 'use strict';
 const PARTS=['옥상','외벽','지하주차장','배수로','기타'],BUCKET='defect-photos',RPC='crm_defect_report_create_v1';
 const h=v=>root.esc?root.esc(String(v==null?'':v)):String(v==null?'':v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 let S=null;
 const on=()=>!(root.G&&root.G.mobileDefectOff)&&!(root.CRMRelease&&root.CRMRelease.listed&&root.CRMRelease.listed(RPC)===false);
 function reset(d){S={dealId:String(d.id),part:'',urgent:false,memo:'',file:null,preview:'',busy:false,err:'',done:null,requestId:(root.crypto&&root.crypto.randomUUID?root.crypto.randomUUID():'')};}
 function state(){return S?JSON.parse(JSON.stringify({dealId:S.dealId,part:S.part,urgent:S.urgent,memo:S.memo,hasPhoto:!!S.file,busy:S.busy,err:S.err,done:S.done})):null;}
 function render(d){
  if(!S||S.dealId!==String(d.id))reset(d);
  const chips=PARTS.map(p=>'<button type="button" class="md-chip'+(S.part===p?' on':'')+'" data-defect="part" data-v="'+h(p)+'" aria-pressed="'+(S.part===p)+'">'+h(p)+'</button>').join('');
  const can=!S.busy&&!!S.part&&(!!S.file||!!S.memo.trim());
  const body=S.done?'<div class="md-done"><b>접수했습니다</b><span>'+h(S.done.note||'')+'</span>'+(S.done.notified?'<small>본사(잔디)에 알렸습니다</small>':'<small>잔디 알림은 꺼져 있거나 보내지 못했습니다 · 접수는 됐습니다</small>')+'<button type="button" class="md-btn md-dark" data-gs="back">현장으로</button></div>':
   '<div class="md-body">'
   +'<label class="md-photo'+(S.preview?' has':'')+'">'+(S.preview?'<img src="'+S.preview+'" alt="하자 사진 미리보기">':'<span>사진 1장 찍기 · 고르기</span>')+'<input type="file" accept="image/*" capture="environment" data-defect="photo" aria-label="하자 사진"></label>'
   +'<b class="md-q">부위 *</b><div class="md-chips">'+chips+'</div>'
   +'<label class="md-urgent"><input type="checkbox" data-defect="urgent"'+(S.urgent?' checked':'')+'> 긴급(누수 진행 중 · 안전)</label>'
   +'<b class="md-q">내용</b><textarea class="md-memo" data-defect="memo" maxlength="500" placeholder="예: 우수관 주변 누수 · 소장님 요청">'+h(S.memo)+'</textarea>'
   +(S.err?'<p class="md-err" role="alert">'+h(S.err)+'</p>':'')
   +'<p class="md-note">접수하면 응대 기록에 [하자] 표식이 남고 본사에 알림이 갑니다. 처리 · 약속은 본사가 정합니다.</p>'
   +'</div><div class="md-foot"><button type="button" class="md-btn md-dark" data-defect="submit"'+(can?'':' disabled')+'>'+(S.busy?'접수 중…':'접수')+'</button></div>';
  return '<div class="approved-bc md-screen"><div class="md-head"><span data-gs="back" role="button" tabindex="0" aria-label="뒤로">‹</span><b>하자 접수 · '+h(d.nm||'현장')+'</b></div>'+body+'</div>';
 }
 /* 사진 줄이기: 긴 변 1280px · JPEG 0.82 — 원본은 올리지 않는다 */
 async function shrink(file){
  let bmp;try{bmp=await root.createImageBitmap(file);}catch(e){throw new Error('사진을 읽지 못했습니다');}
  const max=1280,r=Math.min(1,max/Math.max(bmp.width,bmp.height)),w=Math.max(1,Math.round(bmp.width*r)),ht=Math.max(1,Math.round(bmp.height*r)),c=root.document.createElement('canvas');
  c.width=w;c.height=ht;c.getContext('2d').drawImage(bmp,0,0,w,ht);try{bmp.close&&bmp.close();}catch(e){}
  return new Promise((resolve,reject)=>c.toBlob(b=>b?resolve(b):reject(new Error('사진을 줄이지 못했습니다')),'image/jpeg',0.82));
 }
 async function upload(blob){
  const uid=root.Phase1&&root.Phase1.profile&&root.Phase1.profile.auth_uid;if(!uid||!root.TOKEN||!root.SUPABASE_URL)throw new Error('로그인 상태에서만 올릴 수 있습니다');
  const path=uid+'/'+S.dealId+'/'+Date.now()+'.jpg';
  const r=await root.fetch(root.SUPABASE_URL+'/storage/v1/object/'+BUCKET+'/'+path,{method:'POST',headers:{apikey:root.SUPABASE_ANON,Authorization:'Bearer '+root.TOKEN,'Content-Type':'image/jpeg','x-upsert':'false'},body:blob});
  if(!r.ok){const t=await r.text().catch(()=>'');throw new Error(r.status===404?'사진 저장소(defect-photos)가 아직 없습니다 — 서버 적용 뒤에':'사진을 올리지 못했습니다('+r.status+')'+(t?' '+t.slice(0,80):''));}
  return path;
 }
 async function submit(d,rerender){
  if(!S||S.busy)return;if(!S.part){S.err='부위를 골라 주세요';rerender();return;}if(!S.file&&!S.memo.trim()){S.err='사진이나 내용 중 하나는 있어야 합니다';rerender();return;}
  S.busy=true;S.err='';rerender();
  try{
   let path=null;if(S.file){const blob=await shrink(S.file);path=await upload(blob);}
   const ack=await root.Phase1.rpc(RPC,{p:{request_id:S.requestId,deal_id:S.dealId,part:S.part,urgent:!!S.urgent,memo:S.memo.trim(),photo_path:path}});
   if(!ack||ack.ok!==true||ack.policy!=='defect-report-v1')throw new Error('접수 결과를 확인하지 못했습니다');
   /* 화면 응대 기록에도 같은 표식 한 줄(서버가 남긴 것과 같은 글) */
   try{if(ack.note&&Array.isArray(d.activities))d.activities.unshift({id:ack.activity_id||'defect-'+Date.now(),type:'하자',note:ack.note,result:S.memo.trim(),occurred_at:ack.at||new Date().toISOString(),meaningful_contact:false});}catch(e){}
   let notified=false;try{const J=root.JandiEvents;if(J&&typeof J.defectReported==='function'){const j=await J.defectReported(d,{part:S.part,urgent:S.urgent,memo:S.memo.trim(),by:(root.G&&root.G.user&&root.G.user.nm)||''});notified=!!(j&&j.ok);}}catch(e){}
   S.done={id:ack.id,note:ack.note||'',notified};S.busy=false;
   try{root.toast&&root.toast('하자를 접수했습니다'+(notified?' · 본사에 알림':''));root.navigator&&root.navigator.vibrate&&root.navigator.vibrate(30);}catch(e){}
  }catch(e){S.busy=false;S.err=String(e&&e.message||e);}
  rerender();
 }
 function handle(d,el,rerender){
  const k=el.dataset.defect;if(!k||!S)return false;
  if(k==='part'){S.part=el.dataset.v;S.err='';rerender();return true;}
  if(k==='urgent'){S.urgent=!!el.checked;return true;}
  if(k==='memo'){S.memo=el.value;const b=root.document.querySelector('.md-screen [data-defect="submit"]');if(b)b.disabled=S.busy||!S.part||(!S.file&&!S.memo.trim());return true;}
  if(k==='photo'){const f=el.files&&el.files[0];if(!f)return true;if(!/^image\//.test(f.type)){S.err='사진 파일만 올릴 수 있습니다';rerender();return true;}S.file=f;S.err='';try{if(S.preview)URL.revokeObjectURL(S.preview);S.preview=URL.createObjectURL(f);}catch(e){S.preview='';}rerender();return true;}
  if(k==='submit'){submit(d,rerender);return true;}
  return false;
 }
 /* 화면 이벤트: 이 화면의 요소([data-defect])만 받는다 · 다시 그리기는 공통 render */
 if(typeof root.document==='object'&&root.document&&root.document.addEventListener){
  const deal=()=>S&&(root.DEALS||[]).find(x=>String(x.id)===S.dealId),rerender=()=>{if(typeof root.render==='function')root.render();};
  root.document.addEventListener('click',e=>{const el=e.target.closest&&e.target.closest('[data-defect="part"],[data-defect="submit"]');if(!el)return;const d=deal();if(d)handle(d,el,rerender);});
  root.document.addEventListener('change',e=>{const el=e.target.closest&&e.target.closest('[data-defect="photo"],[data-defect="urgent"]');if(!el)return;const d=deal();if(d)handle(d,el,rerender);});
  root.document.addEventListener('input',e=>{const el=e.target.closest&&e.target.closest('[data-defect="memo"]');if(!el)return;const d=deal();if(d)handle(d,el,rerender);});
 }
 const api={PARTS,BUCKET,RPC,on,render,handle,state,reset:()=>{S=null;},shrink,_set(v){S=Object.assign(S||{},v);}};
 if(typeof module==='object'&&module.exports)module.exports=api;else root.MobileDefect=Object.freeze(api);
})(typeof window==='object'?window:globalThis);
