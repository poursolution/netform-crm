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
 panel.innerHTML='<h3>기술자문 원본 자료</h3><p>영업건 등록 여부와 관계없이 조회 권한이 있는 원본 계약을 확인합니다.</p><button type="button" class="dact">계약 조회</button><div class="advisory-library-items" aria-live="polite"></div>';
 host.prepend(panel);
 const button=panel.querySelector('button'),content=panel.querySelector('.advisory-library-items');
 let cursor=null,rows=[],page=1;
 /* 쪽 번호(2026-10-05 전체 지침): 받아 온 계약은 한 쪽 20건씩 — 서버에서 다음 묶음을 받는 버튼은 '다음 계약 불러오기' */
 const draw=()=>{
  const pg=root.ListPager.cut(rows,page);page=pg.page;
  content.innerHTML=rows.length?'<p>'+rows.length+'건 · 현장을 선택하면 원본 계약이 열립니다.</p><div class="advisory-library-list">'+pg.rows.map((row,i)=>'<button type="button" class="dact" data-contract-index="'+(pg.from+i)+'">'+esc(row.site_name||'현장명 미기록')+' · '+esc(row.contracts?.[0]?.work_name||'공사명 미기록')+(row.site_linked?'':' · 현장 연결 검토 필요')+'</button>').join('')+'</div>'+root.ListPager.html(pg,{ns:'advlib'})+'<div class="advisory-library-detail"></div>':'<p>조회 권한이 있는 동기화 계약이 없습니다.</p>';
  content.querySelectorAll('[data-contract-index]').forEach(b=>{b.onclick=()=>{
   const row=rows[Number(b.dataset.contractIndex)];
   content.querySelector('.advisory-library-detail').innerHTML='<h4>'+esc(row.site_name)+'</h4>'+html([row]);
  };});
  content.querySelectorAll('[data-advlib="page"]').forEach(b=>{b.onclick=()=>{page=Number(b.dataset.page)||1;draw();};});
 };
 button.onclick=async()=>{
  button.disabled=true;
  try{
   const response=await root.SB.rpc('crm_advisory_library_read_v1',{p_after:cursor});
   if(response.error||response.data?.ok!==true||!Array.isArray(response.data.items))throw Error('READ_FAILED');
   const had=cursor?rows.length:0;
   rows=cursor?rows.concat(response.data.items):response.data.items;
   cursor=response.data.next_cursor||null;
   page=had?Math.floor(had/root.ListPager.SIZE)+1:1;draw();
   button.textContent=cursor?'다음 계약 불러오기':'새로고침';
  }catch{content.textContent='계약을 조회하지 못했습니다. 다시 시도해 주세요.';}
  finally{button.disabled=false;}
 };
}
/* ── 프로젝트 기본 정보(원본) — 2026-10-06 표시 위치 결정(Claude · docs/ADVISORY_PROJECT_DISPLAY_DECISION_20261006.md)
   어디서: 고객 자산 → 제목 줄 [기술자문 원본 자료] → 화면 아래 칸의 [프로젝트 기본 정보] 탭(옆 탭 = 기존 [계약 문서]).
   무엇을: 기술자문 플랫폼에서 받은 원본 프로젝트. 계약 문서가 없는 프로젝트도 보인다 — '문서 없음'은 미체결 확정도, 원본 정보 없음도 아니다.
   여기는 화면만 그린다. 조회(권한 · RPC · 커서)는 projects.connect(loader) 로 넘겨받는다(Codex).
     loader({after}) → {items:[…], next_cursor:null|string}   · 권한 없음 = code '42501' 인 오류   · 한 번에 최대 20건
     items[i] = crm_advisory_project_read_v1 의 한 줄 + (있으면) has_contract_document:true|false — 이 값이 없으면 문서 꼬리표를 달지 않는다(추정하지 않는다).
   연결되기 전에는 탭이 생기지 않고 계약 문서 칸만 보인다. 빈 값은 '미기록' — 0원 · 미진행 · 미체결로 추정하지 않는다. */
const PJ={loader:null,rows:[],cursor:null,page:1,sel:'',state:'idle',busy:false,tab:'proj'};
const STATE_TEXT={loading:'조회 중…',failed:'프로젝트 기본 정보를 조회하지 못했습니다. 다시 시도해 주세요.',denied:'이 계정에는 기술자문 프로젝트 조회 권한이 없습니다.',empty:'조회 권한이 있는 기술자문 프로젝트가 없습니다.',more:'다음 쪽을 불러오지 못했습니다. 다시 시도해 주세요.'};
const val=v=>v==null||String(v).trim()===''?'미기록':String(v);
const pid=p=>String(p&&p.source_project_id!=null?p.source_project_id:'');
const docChip=p=>p.has_contract_document===true?'<span class="adv-chip b">계약 문서 있음</span>':p.has_contract_document===false?'<span class="adv-chip x" title="계약 문서가 CRM 에 연결되지 않은 상태입니다 — 미체결 확정이 아닙니다">계약 문서 없음</span>':'';
function projectDetail(p){
 const o=p.operations&&typeof p.operations==='object'?p.operations:{},amt=p.source_consulting_contract_amount==null||p.source_consulting_contract_amount===''?null:fmtAmt(Number(p.source_consulting_contract_amount));
 const done=o.completed===true?'준공 확인됨':o.completed===false?'준공 확인 전':null,rate=o.progress_rate==null||o.progress_rate===''?null:o.progress_rate+'%';
 const rows=[['원본 프로젝트 번호',pid(p)],['업체',p.company_name],['원본 현재 담당자',p.current_source_manager],['원본 프로젝트 상태',p.source_project_status],['원본 계약 문서 유형',p.source_contract_document_type],['원본 문서 표시일',p.source_printed_contract_date],['기술자문 계약금액(원본)',amt],['원본 진행 상태',o.source_status],['공정률(원본)',rate],['시작일(원본)',o.start_date],['준공일(원본 기재)',o.completion_date],['준공 확인(원본)',done],['CRM 수신',p.received_at?String(p.received_at).slice(0,16).replace('T',' '):null]];
 return '<article class="adv-proj-detail"><div class="adv-line"><b>'+esc(val(p.site_name))+'</b>'+docChip(p)+'</div><div class="adv-sub">'+esc(val(p.work_name))+'</div>'
  +'<p class="adv-note"><span class="adv-chip n">원본 기본 정보</span><span class="adv-chip n">실적 합산 안 함</span> 기술자문 플랫폼에서 받은 정보입니다. 기술자문 계약금액은 아파트 공사 계약실적이 아니고, 문서 표시일은 계약 체결일 확정값이 아닙니다.</p>'
  +(p.has_contract_document===false?'<p class="adv-nodoc">연결된 계약 문서가 없습니다 — 미체결 확정이 아닙니다. 문서가 연결되면 [계약 문서] 탭에 나타납니다.</p>':'')
  +'<dl>'+rows.map(([l,v])=>'<dt>'+esc(l)+'</dt><dd>'+esc(val(v))+'</dd>').join('')+'</dl></article>';
}
function projectsHtml(){
 if(PJ.state==='denied')return '<p class="adv-state">'+STATE_TEXT.denied+'</p>';
 if(!PJ.rows.length){
  if(PJ.busy||PJ.state==='loading')return '<p class="adv-state">'+STATE_TEXT.loading+'</p>';
  if(PJ.state==='failed')return '<p class="adv-state bad">'+STATE_TEXT.failed+'</p><button type="button" class="dact" data-advproj="retry">다시 조회</button>';
  if(PJ.state==='ready')return '<p class="adv-state">'+STATE_TEXT.empty+'</p>';
  return '';
 }
 /* 쪽 번호: 받아 온 것은 한 쪽 20건. 다음 묶음이 있으면 그다음 쪽 번호까지만 보여 주고(전체 쪽 수는 마지막 묶음을 받기 전에는 알 수 없다), 그 쪽을 누르면 받아 온다 */
 const LP=root.ListPager,SIZE=LP.SIZE,more=!!PJ.cursor,pad=more?((SIZE-(PJ.rows.length%SIZE))%SIZE)+1:0,pg=LP.cut(PJ.rows.concat(new Array(pad).fill(null)),PJ.page),shown=pg.rows.filter(Boolean);
 const count=new Map();PJ.rows.forEach(p=>{const k=String(p.site_name||'');count.set(k,(count.get(k)||0)+1);});
 const sel=PJ.rows.find(p=>pid(p)===PJ.sel);
 return '<p class="adv-count">받아 온 프로젝트 '+PJ.rows.length+'건'+(more?' · 다음 쪽이 더 있습니다':'')+' · 줄을 누르면 기본 정보가 열립니다</p>'
  +(PJ.state==='failed'?'<p class="adv-state bad">'+STATE_TEXT.more+'</p>':'')
  +(shown.length?'<div class="adv-proj-list">'+shown.map(p=>{const on=pid(p)===PJ.sel,dup=(count.get(String(p.site_name||''))||0)>1;/* 같은 현장명이라도 원본 번호가 다르면 다른 프로젝트 — 번호를 같이 보여 가른다 */
    return '<button type="button" class="adv-proj-row'+(on?' on':'')+'" data-advproj="pick" data-id="'+esc(pid(p))+'" aria-pressed="'+on+'"><span class="s"><b>'+esc(val(p.site_name))+'</b><small>'+esc([p.work_name,p.company_name].filter(v=>v!=null&&String(v).trim()).join(' · ')||'공사 · 업체 미기록')+'</small></span>'+(dup?'<span class="id">원본 '+esc(pid(p))+'</span>':'')+(p.source_project_status?'<span class="adv-chip b2">'+esc(p.source_project_status)+'</span>':'')+docChip(p)+'</button>';}).join('')+'</div>'
   :'<p class="adv-state">'+STATE_TEXT.loading+'</p>')
  +LP.html(pg,{ns:'advproj',info:false})+'<div class="adv-proj-slot">'+(sel?projectDetail(sel):'')+'</div>';
}
const projView=()=>document.querySelector?.('#pg-sites .advisory-library .adv-proj-view');
function drawProjects(){const v=projView();if(v)v.innerHTML=projectsHtml();}
async function projLoad(reset){
 if(!PJ.loader||PJ.busy)return;if(reset){PJ.rows=[];PJ.cursor=null;PJ.page=1;PJ.sel='';}
 const had=PJ.rows.length,after=reset?null:PJ.cursor;PJ.busy=true;PJ.state='loading';drawProjects();
 try{
  const r=await PJ.loader({after});if(!r||!Array.isArray(r.items))throw new Error('READ_FAILED');
  const seen=new Set(PJ.rows.map(pid));r.items.forEach(p=>{if(p&&pid(p)&&!seen.has(pid(p))){seen.add(pid(p));PJ.rows.push(p);}});
  PJ.cursor=r.next_cursor||null;PJ.state='ready';if(had)PJ.page=Math.floor(had/root.ListPager.SIZE)+1;
 }catch(e){PJ.state=e&&(e.code==='42501'||e.code===42501)?'denied':'failed';}
 finally{PJ.busy=false;drawProjects();}
}
function setTab(tab){
 const panel=document.querySelector?.('#pg-sites .advisory-library');if(!panel)return;PJ.tab=tab==='docs'?'docs':'proj';
 panel.querySelectorAll('.adv-tabs [data-advtab]').forEach(b=>b.setAttribute('aria-selected',String(b.dataset.advtab===PJ.tab)));
 panel.querySelectorAll('.adv-pane').forEach(n=>{n.hidden=!n.classList.contains(PJ.tab==='docs'?'adv-docs':'adv-proj');});
 if(PJ.tab==='proj')shown();
}
/* 칸이 눈에 보일 때 처음 한 번 받아 온다(가려져 있는 동안에는 조회하지 않는다) */
function shown(){const panel=document.querySelector?.('#pg-sites .advisory-library');if(!panel||!PJ.loader||PJ.tab!=='proj'||PJ.state!=='idle'||panel.offsetParent===null)return;projLoad(true);}
function onProjClick(e){
 const t=e.target.closest('[data-advtab]');if(t)return setTab(t.dataset.advtab);
 const b=e.target.closest('[data-advproj]');if(!b)return;const a=b.dataset.advproj;
 if(a==='retry')return projLoad(!PJ.rows.length);
 if(a==='pick'){PJ.sel=PJ.sel===b.dataset.id?'':b.dataset.id;return drawProjects();}
 if(a==='page'){const p=Number(b.dataset.page)||1,loaded=Math.max(1,Math.ceil(PJ.rows.length/root.ListPager.SIZE));if(p>loaded&&PJ.cursor)return projLoad(false);PJ.page=p;PJ.sel='';return drawProjects();}
}
function installProjects(){
 const panel=document.querySelector?.('#pg-sites .advisory-library');if(!panel||!PJ.loader||panel.querySelector('.adv-tabs'))return;
 const h3=panel.querySelector('h3'),docs=document.createElement('div'),proj=document.createElement('div'),tabs=document.createElement('div');
 /* 기존 계약 문서 칸(설명 · 조회 버튼 · 목록)은 그대로 한 묶음으로 옮긴다 */
 docs.className='adv-pane adv-docs';[...panel.children].forEach(n=>{if(n!==h3)docs.append(n);});
 tabs.className='adv-tabs';tabs.setAttribute('role','tablist');tabs.setAttribute('aria-label','기술자문 원본 자료');
 tabs.innerHTML='<button type="button" role="tab" data-advtab="proj">프로젝트 기본 정보</button><button type="button" role="tab" data-advtab="docs">계약 문서</button>';
 proj.className='adv-pane adv-proj';proj.innerHTML='<p>기술자문 플랫폼에서 받은 원본 프로젝트입니다. 계약 문서가 없는 프로젝트도 보이며, 계약 체결 · 계약실적과는 별개입니다.</p><div class="adv-proj-view" aria-live="polite"></div>';
 panel.append(tabs,proj,docs);panel.addEventListener('click',onProjClick);setTab(PJ.tab);
}
function connect(loader){PJ.loader=typeof loader==='function'?loader:null;if(PJ.loader){installLibrary();installProjects();shown();}}
root.TechnicalAdvisoryUI={mount,html,installLibrary,libraryLabel:()=>'기술자문 원본 자료',
 projects:{connect,shown,reload:()=>projLoad(true),html:projectsHtml,detailHtml:projectDetail,setTab,STATE_TEXT,_state:PJ,_reset(){Object.assign(PJ,{rows:[],cursor:null,page:1,sel:'',state:'idle',busy:false,tab:'proj'});drawProjects();}}};
installLibrary();

})(window);
