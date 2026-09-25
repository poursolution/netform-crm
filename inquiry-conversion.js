/* 문의 → 영업 전환 대기 (2026-09-25 · 대표 결정: 문의가 '견적서 발송' 상태가 되면 영업건으로 전환)
   상태를 CRM에서 '견적 발송'으로 바꾸는 순간의 자동 전환은 기존 autoPromote(QUALIFY_ST=/견적.*발송/)가 한다.
   이 모듈은 그 전에 이미 '견적 발송' 상태로 들어와(이관·외부 입력) 전환 기회가 없었던 문의를 관리자가 모아 전환하게 한다.
   계보 정본 = deals.origin_inquiry_id — 서버 전환 명령(crm_inquiry_pipeline_promote_command_v1)이 이력·감사까지 기록한다.
   서버 조건: 관리자 실행 · 담당자가 승인된 본사 영업담당 · 지사/기술자문 문의 제외 — 조건 밖은 목록에서 이유를 보여 주고 버튼을 막는다. */
(function(root){
 'use strict';
 const esc=v=>root.esc?root.esc(String(v??'')):String(v??'');
 let shade=null,focusBefore=null;
 function candidates(){
  const all=typeof root.operationalInquiries==='function'?root.operationalInquiries(root.B?.inquiries||[]):(root.B?.inquiries||[]);
  const qualify=root.QUALIFY_ST instanceof RegExp?root.QUALIFY_ST:/견적.*발송/,closed=root.CLOSED_ST||[];
  return all.filter(q=>qualify.test(String(q.status||''))&&closed.indexOf(q.status)<0&&!(root.linkedDeal&&root.linkedDeal(q))&&!(root.promotedInfo&&root.promotedInfo(q)?.linked))
   .map(q=>{
    const owner=root.inquiryRoutedOwner?root.inquiryRoutedOwner(q):String(q.assignee||'');
    const tech=q.brand==='기술자문'||(root.isTechnicalInquiry&&root.isTechnicalInquiry(q));
    const branch=root.itemOwnerTeam&&root.itemOwnerTeam(q)==='gyeongnam';
    const prof=owner&&root.repProfile?root.repProfile(owner):null;
    const why=tech?'기술자문 문의 — 기술자문 연동으로 관리':branch?'경남지사 건 — 지사 흐름에서 처리'
     :!owner?'영업담당 배정 필요':prof&&prof.salesRep===false?'본사 영업담당이 아님('+owner+') — 담당 변경 필요'
     :root.inquiryLinkUnresolved&&root.inquiryLinkUnresolved(q)?'연결 확인 필요':'';
    return {q,owner,ok:!why,why};
   });
 }
 function style(){
  if(document.getElementById('icv-style'))return;
  const s=document.createElement('style');s.id='icv-style';
  s.textContent='.icv{width:min(880px,100%);max-height:90vh;display:flex;flex-direction:column}'
   +'.icv header{display:flex;justify-content:space-between;align-items:center;gap:12px}.icv h2{margin:0;font-size:18px;color:#0f172a}'
   +'.icv-desc{margin:8px 0 10px;font-size:12px;color:#5b6b85;line-height:1.55}.icv-desc b{color:#1e50b3}'
   +'.icv-bar{display:flex;align-items:center;gap:10px;flex-wrap:wrap;border:1px solid #e2e8f1;border-radius:10px;background:#fbfcfe;padding:9px 12px;font-size:12.5px;color:#33415e;margin-bottom:8px}'
   +'.icv-bar button{margin-left:auto;border:0;border-radius:9px;background:#3B6CE4;color:#fff;padding:8px 13px;font:inherit;font-size:12.5px;font-weight:850;cursor:pointer}.icv-bar button[disabled]{opacity:.5;cursor:default}'
   +'.icv-list{overflow:auto;display:grid;gap:6px;min-height:0}'
   +'.icv-row{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:4px 12px;align-items:center;border:1px solid #e2e8f1;border-left:3px solid #3B6CE4;border-radius:9px;background:#fff;padding:9px 12px;font-size:12px}'
   +'.icv-row.no{border-left-color:#94a3b8;background:#fafbfc}.icv-row.done{border-left-color:#15803d;background:#f5fbf7}'
   +'.icv-row b{font-size:13px;color:#0f172a}.icv-row span{color:#5b6b85}.icv-row em{grid-column:1/-1;font-style:normal;font-size:11.5px;color:#b45309}.icv-row.done em{color:#15803d}'
   +'.icv-row button{border:1px solid #3B6CE4;border-radius:8px;background:#fff;color:#3B6CE4;padding:7px 11px;font:inherit;font-size:12px;font-weight:850;cursor:pointer;white-space:nowrap}.icv-row button[disabled]{opacity:.5;cursor:default}';
  document.head.append(s);
 }
 function close(){shade?.remove();shade=null;if(focusBefore?.isConnected)focusBefore.focus();focusBefore=null;}
 function convert(x){
  if(typeof root.autoPromote!=='function')throw Error('전환 기능을 찾지 못했습니다.');
  return root.autoPromote(x.q);
 }
 function open(){
  close();focusBefore=document.activeElement;style();
  const rows=candidates(),ready=rows.filter(x=>x.ok);
  shade=document.createElement('div');shade.className='contract-sales-shade';
  shade.innerHTML='<section class="contract-sales-dialog icv" role="dialog" aria-modal="true" aria-labelledby="icv-title"><header><h2 id="icv-title">견적 발송 · 영업 미전환 문의</h2><button type="button" data-close aria-label="닫기">✕ 닫기</button></header>'
   +'<p class="icv-desc">문의가 <b>견적서 발송</b> 상태가 되면 영업건으로 넘어가야 합니다(대표 결정). 아래는 이미 견적 발송 상태인데 영업건이 없는 문의입니다. 전환하면 현장·브랜드·담당자·문의 연결이 그대로 승계되고 이력이 남습니다.</p>'
   +'<div class="icv-bar"><span>전체 <b>'+rows.length+'</b>건 · 바로 전환 가능 <b data-ready>'+ready.length+'</b>건</span><button type="button" data-all'+(ready.length?'':' disabled')+'>전환 가능 '+ready.length+'건 모두 전환</button></div>'
   +'<div class="icv-list">'+(rows.map((x,i)=>'<div class="icv-row'+(x.ok?'':' no')+'" data-i="'+i+'"><div><b>'+esc(x.q.site||'현장명 미입력')+'</b> <span>'+esc(x.q.brand||'브랜드 미지정')+' · '+esc(x.q.status||'')+' · '+esc(x.owner||'담당 미배정')+'</span></div>'
    +'<button type="button" data-one'+(x.ok?'':' disabled')+'>영업건으로 전환</button>'+(x.why?'<em>'+esc(x.why)+'</em>':'<em hidden></em>')+'</div>').join('')||'<p class="icv-desc">전환이 필요한 문의가 없습니다.</p>')+'</div></section>';
  document.body.append(shade);
  shade.querySelector('[data-close]').onclick=close;
  shade.onkeydown=e=>{if(e.key==='Escape')close();};
  const run=(row)=>{
   const x=rows[Number(row.dataset.i)],em=row.querySelector('em'),btn=row.querySelector('[data-one]');
   if(!x.ok||row.classList.contains('done'))return false;
   btn.disabled=true;
   try{const msg=convert(x);row.classList.add('done');em.hidden=false;em.textContent='✓ '+String(msg||'전환 요청을 보냈습니다')+' — 서버 확인 후 파이프라인에 반영됩니다.';return true;}
   catch(err){
    em.hidden=false;
    /* 전환 요청이 이미 대기열에 들어간 뒤의 예외면 다시 누르지 못하게 완료 처리(중복 생성 방지 — 서버도 'inquiry already linked'로 거절) */
    if(root.promotedInfo&&root.promotedInfo(x.q)?.linked){row.classList.add('done');em.textContent='전환 요청을 보냈습니다 — 확인 필요: '+String(err.message||err);return true;}
    btn.disabled=false;em.textContent=String(err.message||err);return false;}
  };
  shade.querySelectorAll('[data-one]').forEach(b=>b.onclick=()=>{run(b.closest('.icv-row'));root.paint?.();});
  const all=shade.querySelector('[data-all]');
  if(all)all.onclick=()=>{
   const targets=[...shade.querySelectorAll('.icv-row')].filter(r=>rows[Number(r.dataset.i)].ok&&!r.classList.contains('done'));
   if(!targets.length)return;
   if(!confirm('견적 발송 상태 문의 '+targets.length+'건을 영업건으로 전환합니다. 계속할까요?'))return;
   all.disabled=true;let n=0;targets.forEach(r=>{if(run(r))n++;});
   all.textContent=n+'건 전환 요청 완료';root.paint?.();
  };
  shade.querySelector('[data-close]').focus();
 }
 root.InquiryConversion={candidates,open};
 root.addEventListener('phase1:identity-cleared',close);
})(window);
