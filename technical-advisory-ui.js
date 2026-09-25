/* Read-only contract mirror in the canonical Deal inspector. */
(function(root){
'use strict';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const kinds={initial_contract:'최초 계약',change_contract:'변경 계약',post_settlement_recontract:'정산 후 재계약'};
const statuses={completed:'서명 완료',document_all_signed:'서명 완료',document_started:'서명 진행 중',sent:'발송',draft:'작성 중',cancelled:'취소'};
function url(value){try{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password?u.href:null;}catch{return null;}}
function fmtAmt(n){if(!Number.isSafeInteger(n)||n<0)return null;if(n>=1e8)return (Math.round(n/1e6)/100).toLocaleString('ko-KR')+'억';if(n>=1e4)return Math.round(n/1e4).toLocaleString('ko-KR')+'만원';return n.toLocaleString('ko-KR')+'원';}
function statusChip(s){const done=['completed','document_all_signed'].includes(s);return '<span class="adv-chip '+(done?'g':s==='cancelled'?'x':'b')+'">'+esc(statuses[s]||s||'미확인')+'</span>';}
function html(items){
 const rows=items.flatMap(p=>Array.isArray(p.contracts)?p.contracts:[]);
 if(!rows.length)return '<p>연결된 기술자문 계약이 없습니다.</p>';
 return '<p class="adv-note"><span class="adv-chip n">실적 합산 안 함</span><span class="adv-chip n">체결일 별도 확인</span> 원본 계약 표시이며, 실적은 성과 분석·컨트롤타워 [기술자문 낙찰실적 확정]에서 낙찰금액 기준으로 확정합니다.</p>'+rows.map(c=>{
  const link=url(c.document_url),amount=Number.isSafeInteger(c.document_amount)&&c.document_amount>=0?c.document_amount.toLocaleString('ko-KR')+'원':'금액 미확인';
  const conditions=(c.current_project_payment_conditions||[]).map(p=>[p.name,p.percent==null?'':p.percent+'%',p.condition].filter(Boolean).join(' · ')).join(' / ');
  const legacy=c.source_structure==='legacy_modusign';
  return '<article class="advisory-contract">'
   +'<div class="adv-line"><b>'+esc(kinds[c.contract_kind]||(legacy?'과거 전자계약':'종류 확인 필요'))+'</b>'
   +'<span class="adv-amt"'+(amount!=='금액 미확인'?' title="'+esc(amount)+'"':'')+'>'+esc(fmtAmt(Number.isSafeInteger(c.document_amount)?c.document_amount:NaN)||'금액 미확인')+'</span>'
   +statusChip(c.source_status)
   +(link?'<a target="_blank" rel="noopener noreferrer" href="'+esc(link)+'">계약서 ↗</a>':'')+'</div>'
   +'<div class="adv-sub">'+esc(c.company_name||'업체 미기록')+(c.work_name?' · '+esc(c.work_name):'')+(c.source_printed_contract_date?' · '+esc(c.source_printed_contract_date):'')+'</div>'
   +'<button type="button" class="adv-more-toggle">상세 정보 ▾</button><div class="adv-more" hidden><dl>'+[
    ['서명 완료 수신',c.completion_observed_at],['원본 현재 담당자',c.current_source_manager],['현재 지급 조건',conditions]
   ].map(([label,value])=>'<dt>'+esc(label)+'</dt><dd>'+esc(value||'미기록')+'</dd>').join('')
   +'</dl>'+(legacy?'<p>계약 당시 금액·종류는 계약서 원본으로 확인이 필요합니다.</p>':'')+'</div></article>';
  }).join('');
}
function mount(host,dealId){
 if(!host||!dealId)return;
 let panel=host.querySelector('.technical-advisory');
 if(panel?.dataset.dealId===String(dealId))return;
 panel?.remove();panel=document.createElement('section');panel.className='technical-advisory';panel.dataset.dealId=String(dealId);
 panel.innerHTML='<div class="adv-fold"><button type="button" class="adv-fold-toggle" aria-expanded="false">▸ 현장 공통 · 기술자문 계약 <small>펼쳐서 확인 — 실적과 합산하지 않는 별도 계약</small></button><div class="adv-fold-body" hidden><div class="advisory-content" aria-live="polite">조회 중…</div><button type="button" class="dact">새로고침</button></div></div>';
 host.append(panel);let sequence=0;
 panel.addEventListener('click',e=>{
  const ft=e.target.closest('.adv-fold-toggle');
  if(ft){const b=panel.querySelector('.adv-fold-body');b.hidden=!b.hidden;ft.setAttribute('aria-expanded',String(!b.hidden));ft.firstChild.textContent=(b.hidden?'▸ ':'▾ ')+'현장 공통 · 기술자문 계약 ';return;}
  const mt=e.target.closest('.adv-more-toggle');
  if(mt){const m=mt.nextElementSibling;if(m){m.hidden=!m.hidden;mt.textContent=m.hidden?'상세 정보 ▾':'상세 정보 ▴';}}
 });
 const content=panel.querySelector('.advisory-content'),button=panel.querySelector('button.dact');
 async function read(){
  const ticket=++sequence;button.disabled=true;content.textContent='조회 중…';
  try{
   if(!root.SB?.rpc)throw new Error('UNAVAILABLE');
   const response=await root.SB.rpc('crm_advisory_site_read_v1',{p_deal_id:String(dealId)});
   if(response.error||response.data?.ok!==true||!Array.isArray(response.data.items))throw new Error('READ_FAILED');
   if(ticket!==sequence||!panel.isConnected||String(root.CUR_DETAIL?.item?.id)!==String(dealId))return;
   content.innerHTML=html(response.data.items);
  }catch{
   if(ticket===sequence&&panel.isConnected)content.textContent='기술자문 계약을 조회하지 못했습니다. 연동 상태와 조회 권한을 확인해 주세요.';
  }finally{if(ticket===sequence)button.disabled=false;}
 }
 button.onclick=read;read();
}
function installLibrary(){
 const host=document.getElementById?.('pg-sites');
 if(!host||host.querySelector('.advisory-library'))return;
 const panel=document.createElement('section');panel.className='technical-advisory advisory-library';
 panel.innerHTML='<h3>기술자문 계약</h3><p>영업건 등록 여부와 관계없이 조회 권한이 있는 원본 계약을 확인합니다.</p><button type="button" class="dact">계약 조회</button><div class="advisory-library-items" aria-live="polite"></div>';
 host.prepend(panel);
 const button=panel.querySelector('button'),content=panel.querySelector('.advisory-library-items');
 let cursor=null,rows=[];
 button.onclick=async()=>{
  button.disabled=true;
  try{
   const response=await root.SB.rpc('crm_advisory_library_read_v1',{p_after:cursor});
   if(response.error||response.data?.ok!==true||!Array.isArray(response.data.items))throw Error('READ_FAILED');
   rows=cursor?rows.concat(response.data.items):response.data.items;
   cursor=response.data.next_cursor||null;
   content.innerHTML=rows.length?'<p>'+rows.length+'건 · 현장을 선택하면 원본 계약이 열립니다.</p><div class="advisory-library-list">'+rows.map((row,i)=>'<button type="button" class="dact" data-contract-index="'+i+'">'+esc(row.site_name||'현장명 미기록')+' · '+esc(row.contracts?.[0]?.work_name||'공사명 미기록')+(row.site_linked?'':' · 현장 연결 검토 필요')+'</button>').join('')+'</div><div class="advisory-library-detail"></div>':'<p>조회 권한이 있는 동기화 계약이 없습니다.</p>';
   content.querySelectorAll('[data-contract-index]').forEach(b=>{b.onclick=()=>{
    const row=rows[Number(b.dataset.contractIndex)];
    content.querySelector('.advisory-library-detail').innerHTML='<h4>'+esc(row.site_name)+'</h4>'+html([row]);
   };});
   button.textContent=cursor?'계약 더 보기':'새로고침';
  }catch{content.textContent='계약을 조회하지 못했습니다. 다시 시도해 주세요.';}
  finally{button.disabled=false;}
 };
}
root.TechnicalAdvisoryUI={mount,html,installLibrary};
installLibrary();
})(window);
