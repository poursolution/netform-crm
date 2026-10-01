/* 전역 검색 (2026-10-01 컨설턴트 P1-13 — 검색칸이 현재 화면 목록만 거르고, 결과에서 바로 상세로 못 갔다)
   검색칸에 두 글자 이상 치면 현장·문의·담당자·전화번호를 한 번에 찾아 아래에 보여 주고, 고르면 바로 상세(또는 담당자 화면)를 연다.
   기존 동작(현재 화면 목록 거르기)은 그대로 둔다. 권한 범위(관리자=전체, 담당자=내 건)만 보인다. 저장·전송 없음. */
(function(root){
 'use strict';
 const MAX=6;let box,pop,timer,items=[],cursor=-1;
 const h=s=>root.esc?root.esc(String(s??'')):String(s??'');
 const digits=s=>String(s||'').replace(/\D/g,'');
 const norm=s=>String(s||'').toLowerCase().replace(/\s+/g,'');
 function style(){if(document.getElementById('gs-style'))return;const s=document.createElement('style');s.id='gs-style';
  s.textContent='.search{position:relative}.gs-pop{position:absolute;top:calc(100% + 6px);right:0;width:min(520px,calc(100vw - 32px));max-height:min(520px,70vh);overflow:auto;background:#fff;border:1px solid #e2e8f1;border-radius:12px;box-shadow:0 14px 36px rgba(15,23,42,.14);z-index:1200;padding:6px;text-align:left}'
  +'.gs-pop[hidden]{display:none}.gs-group{font-size:11px;font-weight:800;color:#8a97ab;letter-spacing:.06em;padding:8px 10px 4px}'
  +'.gs-item{display:grid;grid-template-columns:1fr auto;gap:2px 10px;align-items:center;width:100%;border:0;background:none;text-align:left;padding:8px 10px;border-radius:9px;font:inherit;color:#171a1f;cursor:pointer}'
  +'.gs-item:hover,.gs-item.on{background:#eef3ff}.gs-item b{font-size:13px;font-weight:700}.gs-item small{grid-column:1/-1;font-size:11.5px;color:#596579}.gs-item em{font-style:normal;font-size:11px;font-weight:800;color:#3b6ce4;background:#eef3ff;border-radius:999px;padding:2px 8px;white-space:nowrap}'
  +'.gs-empty{padding:14px 10px;font-size:12.5px;color:#596579}.gs-hint{padding:6px 10px 4px;font-size:11px;color:#8a97ab;border-top:1px solid #eff1f4;margin-top:4px}';
  document.head.append(s);}
 function admin(){try{return !!root.todayIsAdmin?.();}catch(e){return false;}}
 function mine(owner){return admin()||root.repN(owner)===root.repN(root.ME?.name);}
 function dealPhones(d){try{const c=root.contactInfo(d);return [c.managerMobile,c.officeTel,c.mobile,c.phone].map(digits).filter(Boolean);}catch(e){return [];}}
 function search(q){
  const text=norm(q),num=digits(q),byPhone=num.length>=4&&/^[\d\s\-()]+$/.test(q.trim());if(text.length<2&&!byPhone)return [];
  const out=[],B=root.B||{};
  const hit=(s)=>!!s&&norm(s).includes(text);
  const deals=(B.deals||[]).filter(d=>mine(d.assignee)&&(byPhone?dealPhones(d).some(p=>p.includes(num)):hit(d.site)||hit(d.address)||hit(root.dealWorkSummary?.(d))||hit(root.contactInfo?.(d)?.managerName))).slice(0,MAX);
  deals.forEach(d=>out.push({group:'영업건',title:d.site||'현장명 미입력',sub:[root.stageNoLabel?.(root.dealStage(d))||'',root.repN(d.assignee),root.oppAmt&&root.oppAmt(d)?root.fmtAmt(root.oppAmt(d)):''].filter(Boolean).join(' · '),tag:'상세',go:()=>root.drwDeal(JSON.stringify(d))}));
  const inqs=(root.operationalInquiries?root.operationalInquiries(B.inquiries||[]):(B.inquiries||[])).filter(q=>(!root.inqCtlRoleMatch||root.inqCtlRoleMatch(q))&&(byPhone?digits(q.phone||q.mobile).includes(num):hit(q.site||q.site_name)||hit(q.contact||q.contact_name)||hit(q.address))).slice(0,MAX);
  inqs.forEach(q=>out.push({group:'견적문의',title:q.site||q.site_name||'현장명 미입력',sub:[q.status||'접수',root.repN(root.inquiryRoutedOwner?.(q)||q.assignee)||'미배정',q.contact||q.contact_name||''].filter(Boolean).join(' · '),tag:'문의',go:()=>root.drwInq(JSON.stringify(q))}));
  if(!byPhone&&admin()){const reps=(root.REPS||[]).filter(n=>hit(n)).slice(0,4);reps.forEach(n=>out.push({group:'담당자',title:n,sub:'이 담당자의 영업건으로 파이프라인 열기',tag:'담당자',go:()=>{root.SalesScope?.change?.('owner',n);root.G.rep=n;root.goPage('pipe');}}));}
  return out;
 }
 function render(){
  if(!pop)return;const q=box.value.trim();
  if(!q||(norm(q).length<2&&digits(q).length<4)){pop.hidden=true;items=[];cursor=-1;return;}
  items=search(q);cursor=items.length?0:-1;
  if(!items.length){pop.innerHTML='<div class="gs-empty">일치하는 현장·문의·담당자·전화번호가 없습니다.</div>';pop.hidden=false;return;}
  let html='',last='';items.forEach((it,i)=>{if(it.group!==last){html+='<div class="gs-group">'+h(it.group)+'</div>';last=it.group;}html+='<button type="button" class="gs-item'+(i===cursor?' on':'')+'" data-i="'+i+'"><b>'+h(it.title)+'</b><em>'+h(it.tag)+'</em><small>'+h(it.sub)+'</small></button>';});
  pop.innerHTML=html+'<div class="gs-hint">↑↓ 이동 · Enter 열기 · Esc 닫기 · 목록은 입력한 글자로 계속 걸러집니다</div>';pop.hidden=false;
 }
 function pick(i){const it=items[i];if(!it)return;pop.hidden=true;try{it.go();}catch(e){}}
 function boot(){
  box=document.getElementById('q');if(!box)return;style();const host=box.closest('.search')||box.parentElement;
  pop=document.createElement('div');pop.className='gs-pop';pop.hidden=true;pop.setAttribute('role','listbox');host.append(pop);
  box.setAttribute('autocomplete','off');
  box.addEventListener('input',()=>{clearTimeout(timer);timer=setTimeout(render,120);});
  box.addEventListener('focus',()=>{if(box.value.trim())render();});
  box.addEventListener('keydown',e=>{if(pop.hidden||!items.length){if(e.key==='Escape')pop.hidden=true;return;}
   if(e.key==='ArrowDown'){e.preventDefault();cursor=(cursor+1)%items.length;render();}
   else if(e.key==='ArrowUp'){e.preventDefault();cursor=(cursor-1+items.length)%items.length;render();}
   else if(e.key==='Enter'){e.preventDefault();pick(cursor);}
   else if(e.key==='Escape'){pop.hidden=true;}});
  pop.addEventListener('mousedown',e=>{const b=e.target.closest('.gs-item');if(!b)return;e.preventDefault();pick(Number(b.dataset.i));});
  document.addEventListener('mousedown',e=>{if(!host.contains(e.target))pop.hidden=true;});
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
 root.GlobalSearch={search,render};
})(window);
