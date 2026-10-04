/* 견적문의 · 협약문의 B2B 탭 (2026-10-04 design_handoff_b2b · 협약문의 B2B.dc.html) — 협약문의 탭과 처리 화면만. 공사 견적문의 목록 · 공통 틀은 그대로.
   협약문의는 영업이 아니라 단건 처리 후 종료: 원문 · 처리 기록만 남긴다. 다음 행동 · 놓침 · 후속 · 실행 큐 · 실적 집계 대상이 아니다.
   위: [공사 견적문의 →] [협약문의 · B2B n] + "담당 조재연 · B2B팀 · 영업 아님 · 단건 처리 후 종료"
   왼쪽 목록: [처리할 것 n] [처리 끝 n] · 업체명 / 협약 종류 · 요약 / 담당 / 상태 · 접수일 · 접수 오래된 순
   오른쪽 처리: 종류 · 접수일 · 채널 / 업체 · 담당자 · 연락처 / 원문 → 결과 3개(협약완료 · 해결완료 · 종결) → 한 줄 메모(종결은 사유 필수) → [처리 완료] = 서버 확인 뒤 종료 + 다음 미처리 건
   ■ 분류 · 상태 · 저장은 코덱스의 InquiryB2B(isAgreement · state · complete — 결과 이름은 잔디 · 동기화 서버와 같은 3개) 한 길. 서버가 저장을 확인하기 전에는 처리 완료로 표시하지 않는다.
   끄기: G.inquiryB2BOff=true */
(function(root){
 'use strict';
 const h=v=>root.esc(String(v==null?'':v)),attr=v=>root.escAttr(String(v==null?'':v));
 const API=()=>root.InquiryB2B;
 const enabled=()=>!root.G.inquiryB2BOff&&!!API();
 const OWNER='조재연';
 const RS={'협약완료':'협약 체결','해결완료':'안내 · 해결','종결':'진행 안 함'};
 const S={tab:'open',sel:null,res:'',note:'',busy:false,msg:''};
 const ymd=v=>{const d=new Date(v);return Number.isFinite(d.getTime())?d.getFullYear()+'.'+(d.getMonth()+1)+'.'+d.getDate():'';};
 const all=()=>((root.B&&root.B.inquiries)||[]).filter(q=>!(q.deleted_at||q.deletedAt)&&API().isAgreement(q)).sort((a,b)=>String(root.inquiryCreatedAt(a)||'').localeCompare(String(root.inquiryCreatedAt(b)||'')));
 const stOf=q=>API().state(q);/* pending · done · review(예전 방식으로 끝난 것) */
 const info=q=>{const d=q.detail&&typeof q.detail==='object'?q.detail:{},r=q.raw&&typeof q.raw==='object'?q.raw:{};
  const msg=String(q.message||(typeof q.detail==='string'?q.detail:d.inquiry)||q.inquiry_content||q.inquiry||q.content||r['문의내용']||'').trim(),kind=String(q.work||q.work_type||d.workType||r['공사유형']||'협약문의').trim();
  return {org:q.site||q.site_name||'업체명 미입력',kind,msg,sum:msg.replace(/\s+/g,' ').slice(0,60),who:String(q.contact_name||q.contact||r['고객성함']||'').trim()||'담당자 미입력',phone:String(q.phone||q.mobile||d.phone||r['고객연락처']||'').trim(),date:ymd(root.inquiryCreatedAt(q)),ch:String(d.channel||q.channel||r['상담채널']||q.source_channel||'').trim()||'채널 미기록',owner:root.inquiryRoutedOwner(q)||''};};
 /* 서버는 close_reason 에 '결과 · 메모'로 남긴다 — 결과 이름은 제목 줄에 이미 있으므로 메모만 */
 const noteOf=q=>{const own=String(q.b2b_note||(q.b2b&&q.b2b.note)||'').trim();if(own)return own;const c=String(q.close_reason||'').trim(),s=String(q.status||'');return c===s?'':s&&c.indexOf(s+' · ')===0?c.slice(s.length+3).trim():c;};
 const doneAt=q=>ymd(q.b2b_completed_at||(q.b2b&&q.b2b.completed_at)||q.completed_at||q.updated_at||'');
 function html(){
  const L=all(),openL=L.filter(q=>stOf(q)==='pending'),doneL=L.filter(q=>stOf(q)!=='pending'),list=S.tab==='open'?openL:doneL;
  if(!L.some(q=>String(q.id)===String(S.sel)))S.sel=null;
  if(S.sel==null&&list.length)S.sel=String(list[0].id);
  const cur=L.find(q=>String(q.id)===String(S.sel))||null;
  const rows=list.map(q=>{const x=info(q),st=stOf(q),on=String(q.id)===String(S.sel);
   return '<button type="button" class="b2b-row'+(on?' on':'')+'" data-b2b="row" data-id="'+attr(q.id)+'"><span class="m"><b>'+h(x.org)+'</b><span>'+h(x.kind+(x.sum?' · '+x.sum:''))+'</span></span><span class="w">'+h(x.owner||OWNER+' · 추천')+'</span><span class="s"><b class="'+(st==='pending'?'':'d')+'">'+h(st==='pending'?'처리 전':q.status||'종료')+'</b><span>'+h(x.date)+'</span></span></button>';}).join('');
  let side='<p class="b2b-none">협약문의를 고르면 여기에서 처리합니다.</p>';
  if(cur){const x=info(cur),st=stOf(cur),need=S.res==='종결',ok=!!S.res&&(!need||S.note.trim().length>0)&&!S.busy;
   side='<div class="b2b-who"><span>'+h(x.kind+' · '+x.date+' 접수 · '+x.ch)+'</span><b>'+h(x.org)+'</b><span class="p">'+h(x.who+(x.phone?' · '+x.phone:''))+'</span></div><div class="b2b-msg">'+h(x.msg||'남긴 내용이 없습니다')+'</div>'
    +(st==='pending'?'<div class="b2b-proc"><b>처리 결과 · 고르면 바로 종료</b><div class="b2b-res">'+Object.keys(RS).map(l=>'<button type="button" data-b2b="res" data-v="'+l+'" aria-pressed="'+(S.res===l)+'"><b>'+l+'</b><span>'+RS[l]+'</span></button>').join('')+'</div><input data-b2b-f="note" class="'+(need?'need':'')+'" maxlength="500" placeholder="'+(need?'종결 사유 (필수)':'처리 내용 한 줄 (선택)')+'" value="'+attr(S.note)+'"><div class="b2b-go"><span class="'+(S.msg?'bad':'')+'">'+h(S.msg||(S.busy?'서버에 저장하는 중입니다…':ok?'저장하면 바로 종료되고 잔디에도 같은 결과로 반영됩니다':need?'종결은 사유를 적어야 저장됩니다':'결과 하나를 고르세요'))+'</span><button type="button" data-b2b="save" class="'+(ok?'':'off')+'" aria-disabled="'+!ok+'">'+(S.busy?'저장 중…':'처리 완료')+'</button></div></div>'
     :'<div class="b2b-done"><b>'+h((cur.status||'종료')+' · '+[doneAt(cur),x.owner||OWNER].filter(Boolean).join(' · '))+'</b><span>'+h(noteOf(cur)||(st==='review'?'예전 방식으로 종료된 건입니다 · 수치에는 영향이 없습니다':'남긴 메모가 없습니다'))+'</span></div>')
    +'<div class="b2b-foot"><span>· 수주 · 계약실적 · 메이드율 · 인센티브에 들어가지 않습니다</span><span>· 다음 행동 · 놓침 · 후속 순서 대상이 아닙니다</span><span>· 결과는 잔디와 같은 이름으로 동기화됩니다</span></div>';}
  return '<section class="b2b-list"><div class="b2b-tabs">'+[['open','처리할 것',openL.length],['done','처리 끝',doneL.length]].map(t=>'<button type="button" data-b2b="tab" data-v="'+t[0]+'" aria-pressed="'+(S.tab===t[0])+'">'+t[1]+' '+t[2]+'</button>').join('')+'<i></i><span>접수 오래된 순</span></div>'+(rows||'<div class="b2b-empty">'+(S.tab==='open'?'처리할 협약문의가 없습니다.':'처리가 끝난 협약문의가 없습니다.')+'</div>')+'</section><aside class="b2b-side">'+side+'</aside>';
 }
 function counts(){let inq=0,b2b=0;try{const L=root.operationalInquiries((root.B&&root.B.inquiries)||[]);inq=L.filter(q=>!API().isAgreement(q)&&!root.isClosedInq(q)).length;b2b=all().filter(q=>stOf(q)==='pending').length;}catch(e){}return {inq,b2b};}
 function sync(){
  const page=document.getElementById('pg-inq');if(!page)return;
  let bar=page.querySelector(':scope>.b2b-bar'),view=page.querySelector(':scope>.b2b-view');
  if(!enabled()){bar?.remove();view?.remove();page.classList.remove('b2b-on');return;}
  if(root.G.page!=='inq')return;
  const on=root.G.inqKind==='b2b',c=counts();
  if(!bar){bar=document.createElement('div');bar.className='b2b-bar';page.prepend(bar);bar.addEventListener('click',e=>{const a=e.target.closest('[data-b2b-kind]');if(!a)return;e.preventDefault();root.G.inqKind=a.dataset.b2bKind;S.msg='';sync();});}
  const bh='<div class="b2b-kinds" role="tablist" aria-label="문의 종류"><a href="#" role="tab" data-b2b-kind="inq" aria-selected="'+!on+'">공사 견적문의'+(on?' →':'')+' <span>'+c.inq+'</span></a><a href="#" role="tab" data-b2b-kind="b2b" aria-selected="'+on+'">협약문의 · B2B <span class="n">'+c.b2b+'</span></a></div><i></i>'+(on?'<span class="b2b-pill">담당 <b>'+OWNER+'</b> · B2B팀 · 영업 아님 · 단건 처리 후 종료</span>':'');
  if(bar.__h!==bh){bar.__h=bh;bar.innerHTML=bh;}
  page.classList.toggle('b2b-on',on);
  if(!on){view?.remove();return;}
  if(!view){view=document.createElement('div');view.className='b2b-view';bar.after(view);view.addEventListener('click',onClick);view.addEventListener('input',e=>{if(e.target.matches('[data-b2b-f="note"]')){S.note=e.target.value;S.msg='';refreshGo(view);}});}
  const el=document.activeElement,keep=el&&view.contains(el)&&el.matches('[data-b2b-f="note"]')?[el.selectionStart,el.selectionEnd]:null;
  view.innerHTML=html();
  if(keep){const n=view.querySelector('[data-b2b-f="note"]');if(n){n.focus();try{n.setSelectionRange(keep[0],keep[1]);}catch(e){}}}
 }
 /* 메모를 적는 동안에는 다시 그리지 않고 안내 문구 · 버튼만 고친다 */
 function refreshGo(view){const need=S.res==='종결',ok=!!S.res&&(!need||S.note.trim().length>0)&&!S.busy,sp=view.querySelector('.b2b-go>span'),bt=view.querySelector('[data-b2b="save"]');if(sp){sp.className='';sp.textContent=ok?'저장하면 바로 종료되고 잔디에도 같은 결과로 반영됩니다':need?'종결은 사유를 적어야 저장됩니다':'결과 하나를 고르세요';}if(bt){bt.classList.toggle('off',!ok);bt.setAttribute('aria-disabled',String(!ok));}}
 const ERR={B2B_STATE_CONFLICT:'이미 처리됐거나 영업으로 넘어간 문의입니다. 새로 고쳐 확인해 주세요.',B2B_CLOSE_REASON_REQUIRED:'종결은 사유를 적어야 저장됩니다.',B2B_READ_VERSION_REQUIRED:'문의를 새로 읽은 뒤 다시 처리해 주세요.',B2B_SERVER_CONNECTION_REQUIRED:'서버 연결을 확인해 주세요.',B2B_PENDING_RESULT_EXISTS:'이 문의에 먼저 보낸 처리가 아직 확인 중입니다.',INVALID_B2B_COMPLETION:'처리 내용을 확인해 주세요.',ACK_CONTRACT_MISMATCH:'서버 응답을 확인하지 못했습니다. 새로 고쳐 결과를 확인해 주세요.'};
 async function save(){
  const q=all().find(x=>String(x.id)===String(S.sel));if(!q||S.busy)return;const res=S.res,note=S.note.trim();
  if(!res||(res==='종결'&&!note))return;
  S.busy=true;S.msg='';sync();
  try{
   const r=await API().complete(q,res,note);
   if(!r||r.saved!==true){S.msg='서버 저장을 확인하지 못했습니다'+(r&&r.queue_status?' ('+r.queue_status+')':'')+' · 처리 완료로 표시하지 않았습니다.';return;}
   /* 서버가 확인한 결과만 화면에 반영한다 */
   q.status=r.result;q.b2b_note=r.note||note;q.b2b_completed_at=r.completed_at||new Date().toISOString();
   if(typeof root.toast==='function')root.toast((q.site||'협약문의')+' · '+r.result+' 처리 완료');
   const next=all().find(x=>stOf(x)==='pending');S.sel=next?String(next.id):String(q.id);S.res='';S.note='';
   try{root.saveLocal&&root.saveLocal();}catch(e){}
  }catch(e){S.msg=ERR[e&&e.message]||('저장하지 못했습니다: '+String(e&&e.message||e));}
  finally{S.busy=false;sync();}
 }
 function onClick(e){
  const b=e.target.closest('[data-b2b]');if(!b)return;const a=b.dataset.b2b;
  if(a==='tab'){S.tab=b.dataset.v;S.sel=null;S.res='';S.note='';S.msg='';sync();return;}
  if(a==='row'){if(S.busy)return;S.sel=b.dataset.id;S.res='';S.note='';S.msg='';sync();return;}
  if(a==='res'){if(S.busy)return;S.res=S.res===b.dataset.v?'':b.dataset.v;S.msg='';sync();if(S.res==='종결')document.querySelector('#pg-inq .b2b-view [data-b2b-f="note"]')?.focus();return;}
  if(a==='save'){if(b.classList.contains('off'))return;save();}
 }
 function boot(){
  const base=root.paint;if(typeof base!=='function'||base.__b2b)return;
  const w=function(){const r=base.apply(this,arguments);try{sync();}catch(e){if(root.console)root.console.warn('[협약문의 B2B]',e);}return r;};
  w.__b2b=true;root.paint=w;
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
 root.InquiryB2BTab={enabled,sync,state:S,RS,OWNER};
})(window);
