/* Supplied design_handoff_b2b: inquiry-only view. No automatic assignment or closure. */
(function(root){
 'use strict';
 const drafts=new Map(),confirmed=new Map();
 let tab='pending',selected=null,busy=null,actor=null,message='';
 const h=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const api=()=>root.InquiryB2B;
 const date=q=>String(q.received_at||q.at||q.date||q.created_at||q.raw?.['접수일시']||'');
 function data(){
  const identity=root.ME?.id||null;
  if(actor!==identity){actor=identity;drafts.clear();confirmed.clear();selected=null;message='';}
  // Use the same scoped read/filter path as the existing inquiry page; never fetch an unscoped list.
  if(!identity||!root.inqCtlScope||!root.operationalInquiries)return [];
  return root.inqCtlScope(root.operationalInquiries(root.B?.inquiries||[]),false)
   .filter(q=>['pending','done'].includes(api().state(q)))
   .map(q=>{const ack=confirmed.get(q.id);if(api().state(q)==='done'){confirmed.delete(q.id);return q;}return ack?{...q,status:ack.result,raw:{...q.raw,b2b_completion:ack}}:q;})
   .sort((a,b)=>date(a).localeCompare(date(b))||String(a.id).localeCompare(String(b.id)));
 }
 function fields(q){const r=q.raw||{};return {
  org:q.company_name||q.organization_name||r['업체명']||r['고객유형']||q.site||'업체명 미기록',
  kind:q.work_type||q.work||r['공사유형']||'협약문의',
  content:q.inquiry_content||q.inquiry||r['문의내용']||'문의 원문 미기록',
  contact:q.contact_name||q.contact||r['성함']||'담당자 미기록',phone:q.phone||r['연락처']||'연락처 미기록',
  channel:q.source_channel||q.channel||q.detail?.channel||q.consultation_channel||r['상담채널']||'채널 미기록',date:date(q).slice(0,10)||'접수일 미기록'
 };}
 function writable(q){const p=root.Phase1?.profile,role=p?.permission_role||root.ME?.permission_role;
  return !!q&&['admin','rep','consultation'].includes(role)&&(role==='admin'||q.assigned_to===root.ME?.id);
 }
 function draft(q){if(!drafts.has(q.id))drafts.set(q.id,{result:'',note:'',error:''});return drafts.get(q.id);}
 function canSave(q,d){return !busy&&writable(q)&&api().results.includes(d.result)&&(d.result!=='종결'||!!d.note.trim());}
 function detail(q){if(!q)return '<div class="ib-empty">'+(tab==='done'?'처리 완료된 협약문의가 없습니다.':'처리할 협약문의가 없습니다.')+'</div>';
  const f=fields(q),d=draft(q),done=api().state(q)==='done',c=q.raw?.b2b_completion||{},sub=['협약 체결','안내 · 해결','진행 안 함'];
  return '<div class="ib-detail-head"><span>'+h(f.kind)+' · '+h(f.date)+' 접수 · '+h(f.channel)+'</span><b>'+h(f.org)+'</b><div>'+h(f.contact)+' · '+h(f.phone)+'</div></div><div class="ib-original">'+h(f.content)+'</div>'+
   (done?'<div class="ib-closed"><b>'+h(q.status)+' · '+h(String(c.at||c.completed_at||'처리일 미기록').slice(0,19).replace('T',' '))+'</b><span>'+h(c.actor||'처리자 미기록')+'</span><span>'+h(c.note||q.close_reason||'')+'</span></div>':
    '<div class="ib-result"><b>처리 결과 · 고르면 바로 종료</b><div class="ib-results">'+api().results.map((v,i)=>'<button type="button" data-ib="result" data-value="'+h(v)+'" aria-pressed="'+(d.result===v)+'"'+(busy||!writable(q)?' disabled':'')+'><b>'+v+'</b><span>'+sub[i]+'</span></button>').join('')+'</div><input data-ib-note aria-label="처리 내용" maxlength="4000" value="'+h(d.note)+'" placeholder="'+(d.result==='종결'?'종결 사유 (필수)':'처리 내용 한 줄 (선택)')+'"'+(d.result==='종결'?' required':'')+(busy||!writable(q)?' disabled':'')+'><div class="ib-save-row"><span data-ib-hint>'+h(!writable(q)?'현재 담당자 또는 관리자만 처리할 수 있습니다.':d.result==='종결'&&!d.note.trim()?'종결 사유를 입력해 주세요.':!d.result?'결과 하나를 고르세요.':'처리 완료를 누르면 저장됩니다.')+'</span><button type="button" class="ib-save" data-ib="save"'+(!canSave(q,d)?' disabled':'')+'>'+(busy===q.id?'저장 중…':'처리 완료')+'</button></div><div role="alert">'+h(d.error)+'</div></div>')+
   '<div class="ib-footer"><span>· 수주 · 계약실적 · 메이드율 · 인센티브에 들어가지 않습니다</span><span>· 다음 행동 · 놓침 · 후속 순서 대상이 아닙니다</span><span>· 결과는 잔디와 같은 이름으로 동기화됩니다</span></div>';
 }
 function render(){const pg=document.getElementById('pg-inq');if(!pg||!api()||root.G?.page!=='inq')return;
  const rows=data(),active=!!root.G.inqB2B,pending=rows.filter(q=>api().state(q)==='pending'),done=rows.filter(q=>api().state(q)==='done');
  let host=document.getElementById('inquiry-b2b-view');if(!host){host=document.createElement('div');host.id='inquiry-b2b-view';host.addEventListener('click',click);host.addEventListener('input',input);}
  // Reinsert after legacy renderers without changing any common shell or construction renderer.
  const bar=pg.querySelector(':scope > .cf-bar');if(bar)bar.after(host);else pg.prepend(host);
  pg.classList.toggle('inq-b2b-open',active);
  const list=tab==='done'?done:pending;
  if(!list.some(q=>q.id===selected))selected=list[0]?.id||null;
  const cur=list.find(q=>q.id===selected),construction=root.inqCtlScopeActive?.().filter(q=>!api().isAgreement(q)).length||0;
  const focus=document.activeElement?.matches('[data-ib-note]'),start=focus?document.activeElement.selectionStart:null,end=focus?document.activeElement.selectionEnd:null;
  host.innerHTML='<div class="ib-head"><div class="ib-kinds"><button type="button" data-ib="construction" aria-pressed="'+!active+'">공사 견적문의 → <span>'+construction+'</span></button><button type="button" data-ib="b2b" aria-pressed="'+active+'">협약문의 · B2B <span>'+pending.length+'</span></button></div>'+(active?'<span class="ib-owner">담당 <b>조재연</b> · B2B팀 · 영업 아님 · 단건 처리 후 종료</span>':'')+'</div>'+(active?'<div class="ib-message" role="status">'+h(message)+'</div><div class="ib-body"><section class="ib-list"><div class="ib-tabs">'+[['pending','처리할 것',pending.length],['done','처리 끝',done.length]].map(([v,l,n])=>'<button type="button" data-ib="tab" data-value="'+v+'" aria-pressed="'+(tab===v)+'">'+l+' '+n+'</button>').join('')+'<span>접수 오래된 순</span></div>'+list.map(q=>{const f=fields(q);return '<button type="button" class="ib-row" data-ib="select" data-value="'+h(q.id)+'" aria-pressed="'+(q.id===selected)+'"><span><b>'+h(f.org)+'</b><small>'+h(f.kind)+' · '+h(f.content)+'</small></span><span class="ib-contact">'+h(f.contact)+'</span><span class="ib-row-state"><b>'+h(tab==='done'?q.status:'처리 전')+'</b><small>'+h(f.date)+'</small></span></button>';}).join('')+(!list.length?'<div class="ib-empty">'+(tab==='done'?'처리 완료된 협약문의가 없습니다.':'처리할 협약문의가 없습니다.')+'</div>':'')+'</section><aside class="ib-detail">'+detail(cur)+'</aside></div>':'');
  if(focus&&active){const el=host.querySelector('[data-ib-note]');if(el){el.focus();el.setSelectionRange(start,end);}}
 }
 async function save(){const q=data().find(x=>x.id===selected);if(!q)return;const d=draft(q);if(!canSave(q,d))return;
  const user=actor;busy=q.id;d.error='';render();
  try{const ack=await api().complete(q,d.result,d.note);
   if(user!==root.ME?.id)return;
   if(!ack.saved){d.error='저장이 확인되지 않았습니다. 입력 내용은 유지됩니다. 연결 상태를 확인한 후 다시 눌러 주세요.';return;}
   // Only a validated server ACK can move a row; keep it across a delayed/stale read.
   confirmed.set(q.id,{...ack,actor:root.ME?.name||'',at:ack.completed_at});drafts.delete(q.id);selected=null;
   message='처리 완료 · 잔디 연동 시트 반영 대기';
   try{await root.refreshOperationalRows?.([{domain:'inquiry_core',id:q.id}]);}catch(_){message='처리 완료 · 최신 목록 조회는 잠시 후 다시 시도해 주세요.';}
  }catch(e){d.error=/CONFLICT|VERSION/.test(e.message)?'다른 곳에서 변경된 문의입니다. 최신 내용을 확인해 주세요.':/REASON/.test(e.message)?'종결 사유를 입력해 주세요.':'저장하지 못했습니다. 입력 내용을 유지했습니다.';}
  finally{busy=null;render();}
 }
 function click(e){const b=e.target.closest('[data-ib]');if(!b)return;const a=b.dataset.ib,v=b.dataset.value;
  if(a==='construction'||a==='b2b'){root.G.inqB2B=a==='b2b';root.paintInq();return;}
  if(a==='tab'){tab=v;selected=null;render();return;}
  if(a==='select'){selected=v;render();return;}
  const q=data().find(x=>x.id===selected);if(!q)return;
  if(a==='result'&&!busy&&writable(q)){draft(q).result=v;draft(q).error='';render();}
  if(a==='save')return save();
 }
 function input(e){if(!e.target.matches('[data-ib-note]'))return;const q=data().find(x=>x.id===selected);if(!q)return;const d=draft(q);d.note=e.target.value;
  document.querySelector('#inquiry-b2b-view .ib-save').disabled=!canSave(q,d);
  document.querySelector('#inquiry-b2b-view [data-ib-hint]').textContent=d.result==='종결'&&!d.note.trim()?'종결 사유를 입력해 주세요.':d.result?'처리 완료를 누르면 저장됩니다.':'결과 하나를 고르세요.';
 }
 function boot(){const base=root.paintInq;if(typeof base==='function')root.paintInq=function(){const r=base.apply(this,arguments);render();return r;};render();}
 root.InquiryB2BView={render,data,fields,writable};
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})(window);
