/* Read-only contract mirror in the canonical Deal inspector. */
(function(root){
'use strict';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const kinds={initial_contract:'최초 계약',change_contract:'변경 계약',post_settlement_recontract:'정산 후 재계약'};
const statuses={completed:'서명 완료',document_all_signed:'서명 완료',document_started:'서명 진행 중',sent:'발송',draft:'작성 중',cancelled:'취소'};
function url(value){try{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password?u.href:null;}catch{return null;}}
function html(items){
 const rows=items.flatMap(p=>Array.isArray(p.contracts)?p.contracts:[]);
 if(!rows.length)return '<p>연결된 기술자문 계약이 없습니다.</p>';
 return '<p>기술자문 원본 계약입니다. 계약실적 반영 여부는 별도로 확인합니다.</p>'+rows.map(c=>{
  const link=url(c.document_url),amount=Number.isSafeInteger(c.document_amount)&&c.document_amount>=0?c.document_amount.toLocaleString('ko-KR')+'원':'금액 미확인';
  const conditions=(c.current_project_payment_conditions||[]).map(p=>[p.name,p.percent==null?'':p.percent+'%',p.condition].filter(Boolean).join(' · ')).join(' / ');
  const legacy=c.source_structure==='legacy_modusign';
  return '<article class="advisory-contract"><h4>'+esc(kinds[c.contract_kind]||(legacy?'과거 전자계약 · 종류 확인 필요':'종류 확인 필요'))+' · '+esc(amount)+'</h4>'+(legacy?'<p>원본 문서와 서명 상태를 확인했습니다. 계약 당시 금액과 계약 종류는 추가 확인이 필요합니다.</p>':'')+'<dl>'+[
   ['계약 업체',c.company_name],['공사명',c.work_name],['문서 상태',statuses[c.source_status]||c.source_status||'미확인'],
   ['계약서 표시일',c.source_printed_contract_date],['서명 완료 수신시각',c.completion_observed_at],
   ['원본 현재 담당자',c.current_source_manager],['현재 지급 조건',conditions]
  ].map(([label,value])=>'<dt>'+esc(label)+'</dt><dd>'+esc(value||'미기록')+'</dd>').join('')+'</dl><p>표시일·수신시각은 실적 인정일이 아니며, 현재 담당자는 계약 당시 실적 귀속자와 다를 수 있습니다.</p>'+(link?'<a target="_blank" rel="noopener noreferrer" href="'+esc(link)+'">계약서 보기</a>':'')+'</article>';
 }).join('');
}
function mount(host,dealId){
 if(!host||!dealId)return;
 let panel=host.querySelector('.technical-advisory');
 if(panel?.dataset.dealId===String(dealId))return;
 panel?.remove();panel=document.createElement('section');panel.className='technical-advisory';panel.dataset.dealId=String(dealId);
 panel.innerHTML='<h3>현장 공통 · 기술자문 계약</h3><p>같은 현장의 별도 계약입니다. 현재 영업건의 계약금액·실적과 합산하지 않습니다.</p><div class="advisory-content" aria-live="polite">조회 중…</div><button type="button" class="dact">새로고침</button>';
 host.append(panel);let sequence=0;
 const content=panel.querySelector('.advisory-content'),button=panel.querySelector('button');
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
