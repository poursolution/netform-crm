/* 원가 기준 관리 (2026-10-11 design_handoff_quote_v3 3번 · 작업 순서 5) — 사이드바 '조직운영 → 원가 기준' · 관리자 전용
   노임(임금실태 조사표 PDF) · 원가 요율(조달청 제비율 xlsx) · 자재 단가(통합관리표 xlsx)가 바뀔 때마다 파일을 올린다 →
   정해진 칸에서 읽어 이전 값과 비교 → [초안으로 저장] → 승인 전 확인 → [승인 · 시행일 적용].
   · 읽기 = QuoteStandards (quote-standards.js) · 엑셀 풀기 = QuoteExcel.unzip/parseBook · PDF 는 pdf.js(cdnjs 3.11.174)를 올릴 때만 불러온다
   · 저장 · 승인은 서버 함수(crm_cost_standard_*_v1)가 한다. 출처가 비어 있는 항목이 있으면 화면도 서버도 승인을 막는다.
   · 승인된 기준은 덮어쓰지 않는다 — 새 시행일의 새 줄. 이미 확정 · 발송한 견적은 기준이 바뀌어도 다시 계산하지 않는다.
   끄기: G.costAdminOff = true (사이드바 항목만 숨김) */
(function(root){
 'use strict';
 const R=root,h=v=>R.esc?R.esc(String(v==null?'':v)):String(v==null?'':v).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])),attr=h;
 const QS=()=>R.QuoteStandards,PAGE=20;
 const KIND={labor:{name:'노임',file:'임금실태 조사표(PDF)',accept:'.pdf,application/pdf',hint:'대한건설협회 임금실태 조사표 · 공표일 열(예 2026.9.1)마다 한 줄씩'},cost:{name:'원가 요율',file:'조달청 제비율 적용기준(xlsx)',accept:'.xlsx',hint:'간접공사비(제비율) 적용기준 · 적용시기 입찰공고분부터'},material:{name:'자재 단가',file:'통합관리표(xlsx)',accept:'.xlsx',hint:'통합관리표의 「단가표(개인)」 시트'},method:{name:'공법 기준',file:'통합관리표(xlsx)',accept:'.xlsx',hint:'통합관리표의 공법별 일위대가 시트(싱글 · 금속기와 · 슬라브 …) — 재료 · 노무 구성'}};
 const CAT={statutory:'법정',company:'회사 기준',needs_check:'확인 필요'};
 const S={list:null,err:'',busy:false,pend:null,page:1,msg:null,tab:'cost'};
 const fmt=n=>n==null?'—':Number(n).toLocaleString('ko-KR');
 const pct=r=>r==null?'—':(Math.round(Number(r)*1e6)/1e4).toString().replace(/\.0+$/,'')+'%';
 const today=()=>new Date(Date.now()+9*36e5).toISOString().slice(0,10);
 function style(){
  if(document.getElementById('ca-style'))return;
  const s=document.createElement('style');s.id='ca-style';
  s.textContent='#cost-admin{padding:20px 24px;max-width:1180px}#cost-admin h2{margin:0 0 4px;font-size:18px}#cost-admin .ca-sub{color:var(--sub);font-size:12.5px;margin:0 0 16px}'
   +'.ca-cards{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}.ca-card{border:1px solid var(--line);border-radius:12px;background:#fff;padding:14px}.ca-card.on{border-color:var(--blue)}.ca-card h3{margin:0 0 6px;font-size:14px}.ca-card .ca-big{font-size:13px;font-weight:800}.ca-card small{display:block;color:var(--sub);font-size:11.5px;margin-top:3px;line-height:1.5}.ca-card .ca-act{margin-top:10px;display:flex;gap:6px;flex-wrap:wrap}'
   +'.ca-pend{margin-top:14px;border:1px solid var(--line);border-radius:12px;background:#fff;padding:14px}.ca-pend h3{margin:0 0 4px;font-size:14px}.ca-fields{display:flex;gap:10px;flex-wrap:wrap;margin:10px 0}.ca-fields label{display:block;font-size:11px;color:var(--sub);margin-bottom:3px}.ca-fields input{border:1px solid var(--line-2);border-radius:8px;padding:7px 9px;font:inherit;font-size:12.5px}'
   +'.ca-chips{display:flex;gap:6px;flex-wrap:wrap;margin:6px 0}.ca-chips i{font-style:normal;border-radius:999px;background:#eef2f7;color:var(--ink-2);padding:3px 9px;font-size:11px;font-weight:800}.ca-chips i.up{background:#fdeceb;color:#c0392b}.ca-chips i.new{background:var(--blue-50);color:var(--blue-dark)}'
   +'.ca-tbl{width:100%;border-collapse:collapse;font-size:12px;margin-top:6px}.ca-tbl th{text-align:left;color:var(--sub);font-weight:800;border-bottom:1px solid var(--line);padding:6px 6px;white-space:nowrap}.ca-tbl td{border-bottom:1px solid var(--line);padding:6px 6px;vertical-align:middle}.ca-tbl td.n{text-align:right;font-variant-numeric:tabular-nums}.ca-tbl .same{color:var(--sub)}.ca-tbl .up{color:#c0392b;font-weight:800}.ca-tbl .down{color:#1d3f99;font-weight:800}.ca-tbl .new{color:#1d3f99}.ca-tbl input{width:100%;min-width:70px;border:1px solid var(--line-2);border-radius:6px;padding:4px 6px;font:inherit;font-size:12px}'
   +'.ca-prob{margin:8px 0;padding:9px 11px;border:1px solid #f6d9b0;border-left:4px solid #e08a00;border-radius:8px;background:#fffaf2;color:#8a4b00;font-size:12px;line-height:1.55}.ca-prob li{margin-left:16px}.ca-msg{margin:10px 0;font-size:12.5px}.ca-msg.cae{color:var(--danger)}.ca-msg.cao{color:var(--ok)}'
   +'.ca-pg{display:flex;gap:4px;margin-top:10px}.ca-pg button{border:1px solid var(--line-2);border-radius:7px;background:#fff;min-width:28px;padding:4px 8px;font:inherit;font-size:12px;cursor:pointer}.ca-pg button[aria-current=page]{background:var(--ink);color:#fff;border-color:var(--ink)}.ca-hist{margin-top:16px;font-size:12px;color:var(--sub)}.ca-hist div{padding:4px 0;border-bottom:1px solid var(--line)}'
   +'@media(max-width:900px){.ca-cards{grid-template-columns:1fr}}';
  document.head.append(s);
 }
 function sb(){const x=R.SB;if(!x||typeof x.rpc!=='function')throw new Error('서버에 연결된 상태에서만 쓸 수 있습니다');return x;}
 async function call(name,p){const r=await sb().rpc(name,{p:p||{}});if(r&&r.error)throw new Error(r.error.message||'서버가 거절했습니다');if(!r||!r.data||r.data.ok!==true)throw new Error('서버 응답을 확인하지 못했습니다');return r.data;}
 async function load(){try{S.err='';S.list=await call('crm_cost_standard_list_v1',{});}catch(e){S.err=String(e.message||e);S.list=S.list||{labor:[],cost:[],material:[],events:[],can_manage:false};}}
 /* ---------- 파일 읽기 ---------- */
 function loadPdfJs(){
  if(R.pdfjsLib)return Promise.resolve(R.pdfjsLib);
  return new Promise((res,rej)=>{const s=document.createElement('script');s.src='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
   s.onload=()=>{R.pdfjsLib.GlobalWorkerOptions.workerSrc='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';res(R.pdfjsLib);};
   s.onerror=()=>rej(new Error('PDF 읽기 도구를 불러오지 못했습니다. 인터넷 연결을 확인해 주세요'));document.head.append(s);});
 }
 async function pdfPages(buf){const lib=await loadPdfJs(),doc=await lib.getDocument({data:new Uint8Array(buf)}).promise,pages=[];
  for(let p=1;p<=doc.numPages;p++){const tc=await(await doc.getPage(p)).getTextContent();pages.push(tc.items.filter(i=>String(i.str).trim()).map(i=>({s:i.str,x:Math.round(i.transform[4]*10)/10,y:Math.round(i.transform[5]*10)/10})));}
  return pages;}
 async function readFile(kind,file){
  if(kind==='method')return readMethod(file);
  const buf=await file.arrayBuffer(),ext=(file.name.split('.').pop()||'').toLowerCase();
  if(kind==='labor'){
   if(ext!=='pdf')throw new Error('노임은 임금실태 조사표 PDF 를 올려 주세요');
   const parsed=QS().parseWageRows(await pdfPages(buf));if(!parsed.rows.length)throw new Error('PDF 에서 직종별 노임을 읽지 못했습니다');
   const source='임금실태 조사표 · '+file.name;return {kind,file:file.name,source,parsed,rows:QS().wageToRows(parsed,source),notes:parsed.notes,dates:parsed.dates};
  }
  if(ext!=='xlsx')throw new Error('엑셀(xlsx) 파일을 올려 주세요');
  const sheets=R.QuoteExcel.parseBook(await R.QuoteExcel.unzip(buf));
  const cells=n=>{const s=sheets[n];return s?Object.fromEntries(Object.entries(s).map(([k,c])=>[k,c.v])):null;};
  if(kind==='cost'){
   const name=Object.keys(sheets).find(n=>/제비율/.test(n));if(!name)throw new Error('「건축제비율」 시트를 찾지 못했습니다. 조달청 간접공사비(제비율) 적용기준 파일이 맞는지 확인해 주세요');
   const parsed=QS().parseCostRates(cells(name));return {kind,file:file.name,source:parsed.source,parsed,rows:parsed.items.map(i=>Object.assign({},i)),notes:parsed.notes,effective:parsed.effective_from};
  }
  const name=Object.keys(sheets).find(n=>/단가표\(개인\)/.test(n));if(!name)throw new Error('「단가표(개인)」 시트를 찾지 못했습니다. 통합관리표 파일이 맞는지 확인해 주세요');
  const parsed=QS().parseMaterialPrices(cells(name));return {kind,file:file.name,source:parsed.source,parsed,rows:parsed.items.map(i=>Object.assign({},i)),notes:parsed.notes,effective:parsed.price_date};
 }
 async function readMethod(file){
  const buf=await file.arrayBuffer();if((file.name.split('.').pop()||'').toLowerCase()!=='xlsx')throw new Error('엑셀(xlsx) 파일을 올려 주세요');
  const sheets=R.QuoteExcel.parseBook(await R.QuoteExcel.unzip(buf));if(!sheets['싱글']&&!sheets['금속기와'])throw new Error('공법별 일위대가 시트(싱글 · 금속기와 …)를 찾지 못했습니다. 통합관리표 파일이 맞는지 확인해 주세요');
  const parsed=QS().parseMethodSpecs(sheets);if(!parsed.specs.length)throw new Error('공법 구성을 읽지 못했습니다');
  return {kind:'method',file:file.name,source:parsed.source,parsed,rows:parsed.specs.map(s=>({method:s.method,composition:s.composition,effective_from:parsed.effective_from,source:parsed.source})),notes:parsed.notes,effective:parsed.effective_from};
 }
 /* ---------- 상태 ---------- */
 const rowsOf=kind=>S.list?S.list[kind]||[]:[];
 const dateKey=kind=>kind==='material'?'price_date':'effective_from';
 function activeSummary(kind){
  const rows=rowsOf(kind).filter(r=>r.status!=='draft'),dk=dateKey(kind),dates=[...new Set(rows.map(r=>r[dk]))].sort().reverse();
  const cur=dates.find(d=>d<=today());if(!cur)return {cur:'',n:0,past:dates.length};
  const keys=new Set(rows.filter(r=>r[dk]<=cur).map(r=>QS().keyOf[kind](r)));
  return {cur,n:keys.size,past:Math.max(0,dates.length-1),src:(rows.find(r=>r[dk]===cur)||{}).source||''};
 }
 const drafts=kind=>rowsOf(kind).filter(r=>r.status==='draft');
 /* ---------- 표 ---------- */
 function changeCell(d){
  if(d.change==='new')return '<span class="new">새 항목</span>';if(d.change==='same')return '<span class="same">같음</span>';
  if(d.change==='blank')return '<span class="up">값 없음</span>';
  return '<span class="'+d.change+'">'+(d.pct>0?'+':'')+d.pct+'%</span>';
 }
 function viewTable(v){
  const kind=v.kind,rows=v.rows,cur=rowsOf(kind).filter(r=>r.status!=='draft');
  const pend=!v.saved;let head='',body='';
  if(kind==='labor'){
   const dates=v.dates||[...new Set(rows.map(r=>r.effective_from))].sort().reverse(),byT={};
   rows.forEach(r=>{(byT[r.trade]=byT[r.trade]||{no:r.trade_no,w:{}}).w[r.effective_from]=r.daily_wage;});
   const trades=Object.keys(byT).sort((a,b)=>String(byT[a].no).localeCompare(String(byT[b].no)));
   const slice=trades.slice((S.page-1)*PAGE,S.page*PAGE);
   head='<tr><th>번호</th><th>직종</th>'+dates.map(d=>'<th>'+h(d)+'</th>').join('')+'</tr>';
   body=slice.map(t=>'<tr><td>'+h(byT[t].no||'')+'</td><td>'+h(t)+'</td>'+dates.map(d=>{const w=byT[t].w[d];if(w==null)return '<td class="n same">—</td>';const prev=QS().latestBefore('labor',cur,t,d),pv=prev&&prev.effective_from===d?prev.daily_wage:null;
     const cls=pv==null?'new':Number(pv)===Number(w)?'same':'up';return '<td class="n '+cls+'" title="'+attr(pv==null?'기존 값 없음':'지금 값 '+fmt(pv))+'">'+fmt(w)+'</td>';}).join('')+'</tr>').join('');
   return {html:'<table class="ca-tbl"><thead>'+head+'</thead><tbody>'+body+'</tbody></table>',total:trades.length};
  }
  const diff=QS().diff(kind,rows,cur),slice=diff.slice((S.page-1)*PAGE,S.page*PAGE);
  if(kind==='method'){
   head='<tr><th>공법</th><th>재료</th><th>노무</th><th>경비(잡재료비 등)</th><th>변화</th></tr>';
   body=slice.map(d=>{const c=d.row.composition||{};return '<tr><td>'+h(d.row.method)+'</td><td>'+h((c.materials||[]).length+'종 · '+(c.materials||[]).slice(0,3).map(m=>m.name).join(', ')+((c.materials||[]).length>3?' …':''))+'</td><td>'+h((c.labor||[]).map(l=>l.name+' '+l.qty+'인').join(' · '))+'</td><td>'+h((c.misc||[]).map(x=>x.name+' '+pct(x.pct)).join(' · '))+'</td><td>'+(d.change==='up'?'<span class="up">변경</span>':changeCell(d))+'</td></tr>';}).join('');
  }else if(kind==='cost'){
   head='<tr><th>항목</th><th>구분</th><th>분류</th><th>계산 대상</th><th>이전 → 새 값</th><th>변화</th>'+(pend?'<th>출처</th>':'')+'</tr>';
   body=slice.map(d=>{const r=d.row,i=rows.indexOf(r),man=pend&&r.manual;
    return '<tr><td>'+h(r.item)+'</td><td>'+h(r.tier||'')+'</td><td>'+h(CAT[r.category]||r.category)+'</td><td>'+h(r.base_of||'')+'</td><td class="n">'
     +(man?'<input data-ca="rate" data-i="'+i+'" inputmode="decimal" placeholder="요율 %" value="'+attr(r.rate==null?'':Math.round(r.rate*1e6)/1e4)+'">':h(pct(d.prev)+' → '+pct(d.next)+(r.fixed_amount?' + '+fmt(r.fixed_amount)+'원':'')))+'</td><td>'+(man?'<span class="up">직접 입력</span>':changeCell(d))+'</td>'
     +(pend?'<td>'+(man?'<input data-ca="src" data-i="'+i+'" placeholder="출처 (필수)" value="'+attr(r.source===v.source?'':r.source||'')+'">':'<span class="same">'+h((r.source||'').slice(0,18))+'</span>')+'</td>':'')+'</tr>';}).join('');
  }else{
   head='<tr><th>품목</th><th>규격</th><th>포장</th><th>이전 → 새 단가</th><th>변화</th></tr>';
   body=slice.map(d=>{const r=d.row;return '<tr><td>'+h(r.item)+'</td><td>'+h(r.spec||'')+'</td><td>'+h(r.pack_size==null?'':r.pack_size+' '+(r.unit||''))+'</td><td class="n">'+fmt(d.prev)+' → '+fmt(d.next)+'원</td><td>'+changeCell(d)+'</td></tr>';}).join('');
  }
  return {html:'<table class="ca-tbl"><thead>'+head+'</thead><tbody>'+body+'</tbody></table>',total:diff.length,diff};
 }
 function pager(total){const n=Math.ceil(total/PAGE);if(n<=1)return '';let b='';for(let i=1;i<=n;i++)b+='<button type="button" data-ca="pg" data-i="'+i+'"'+(i===S.page?' aria-current="page"':'')+'>'+i+'</button>';return '<div class="ca-pg">'+b+'</div>';}
 function chips(v,t){
  if(v.kind==='method')return '<div class="ca-chips"><i>공법 '+t.total+'개</i><i class="new">새 공법 '+(t.diff||[]).filter(d=>d.change==='new').length+'</i><i class="up">변경 '+(t.diff||[]).filter(d=>d.change==='up').length+'</i><i>같음 '+(t.diff||[]).filter(d=>d.change==='same').length+'</i></div>';
  if(v.kind==='labor')return '<div class="ca-chips"><i>직종 '+t.total+'개</i><i>공표일 '+((v.dates||[]).length)+'개</i><i>노임 '+v.rows.length+'줄</i></div>';
  const c={new:0,same:0,up:0,down:0,blank:0};(t.diff||[]).forEach(d=>c[d.change]++);
  return '<div class="ca-chips"><i>항목 '+t.total+'개</i><i class="new">새 항목 '+c.new+'</i><i class="up">오름 '+c.up+'</i><i>내림 '+c.down+'</i><i>같음 '+c.same+'</i></div>';
 }
 /* ---------- 화면 ---------- */
 function currentView(){
  const k=S.tab;
  if(S.pend&&S.pend.kind===k)return Object.assign({saved:false},S.pend);
  const d=drafts(k);if(d.length){const dk=dateKey(k);return {kind:k,saved:true,rows:d,source:(d[0]||{}).source||'',file:'',notes:[],dates:k==='labor'?[...new Set(d.map(r=>r.effective_from))].sort().reverse():null,effective:d.map(r=>r[dk]).sort()[0]};}
  return null;
 }
 function render(){
  const host=document.getElementById('cost-admin');if(!host)return;style();
  if(!S.list&&!S.busy){S.busy=true;load().then(()=>{S.busy=false;render();});host.innerHTML='<h2>원가 기준</h2><p class="ca-sub">불러오는 중…</p>';return;}
  const L=S.list||{},can=!!L.can_manage;
  let html='<h2>원가 기준</h2><p class="ca-sub">노임 · 원가 요율 · 자재 단가가 바뀔 때마다 파일을 올립니다. 읽은 값을 이전 값과 비교해 확인한 뒤 승인하면, 그 시행일 이후 견적의 원가계산서에 적용됩니다. 이미 확정 · 발송한 견적은 다시 계산하지 않습니다.</p>';
  if(S.err)html+='<div class="ca-msg cae">'+h(S.err)+'</div>';
  html+='<div class="ca-cards">'+['cost','labor','material','method'].map(k=>{const a=activeSummary(k),dr=drafts(k).length;
   return '<div class="ca-card'+(S.tab===k?' on':'')+'" data-ca="tab" data-k="'+k+'"><h3>'+KIND[k].name+'</h3><div class="ca-big">'+(a.cur?'사용 중 · 시행일 '+h(a.cur):'승인된 기준 없음')+'</div><small>'+(a.cur?'항목 '+a.n+'개 · 지난 기준 '+a.past+'개'+(a.src?'<br>출처 '+h(a.src.slice(0,46)):''):KIND[k].hint)+'</small>'
    +(dr?'<small style="color:#c0392b;font-weight:800">승인 대기 초안 '+dr+'줄</small>':'')
    +(can?'<div class="ca-act"><label class="dact pri" style="cursor:pointer">파일 올리기<input type="file" data-ca="file" data-k="'+k+'" accept="'+attr(KIND[k].accept)+'" hidden></label></div>':'')+'</div>';}).join('')+'</div>';
  if(S.msg)html+='<div class="ca-msg '+S.msg.cls+'" role="status">'+h(S.msg.text)+'</div>';
  const v=currentView();
  if(v){
   const t=viewTable(v),eff=v.saved?v.effective:(v.kind==='labor'?(v.dates||[])[0]:v.effective);
   const probs=QS().approvalProblems(v.kind,v.rows.map(r=>Object.assign({},r,{source:r.source||''})),eff||'');
   html+='<div class="ca-pend" id="ca-view"><h3>'+KIND[v.kind].name+' · '+(v.saved?'승인 전 확인 (서버에 저장된 초안)':'올린 파일 미리보기')+'</h3><small style="color:var(--sub)">'+h(v.file||'')+(v.source?' · 출처 '+h(v.source):'')+'</small>';
   if(!v.saved){
    html+='<div class="ca-fields">'+(v.kind==='labor'?'':'<div><label>시행일</label><input type="date" data-ca="eff" value="'+attr(v.effective||'')+'"></div>')+'<div style="flex:1;min-width:260px"><label>출처</label><input data-ca="source" style="width:100%" value="'+attr(v.source||'')+'"></div></div>';
   }
   html+=chips(v,t)+((v.notes||[]).length?'<div class="ca-prob">읽는 중 알림<ul>'+v.notes.map(n=>'<li>'+h(n)+'</li>').join('')+'</ul></div>':'')+t.html+pager(t.total);
   if(probs.length)html+='<div class="ca-prob">승인 전에 해결할 것<ul>'+probs.map(n=>'<li>'+h(n)+'</li>').join('')+'</ul></div>';
   html+='<div class="ca-act" style="margin-top:12px;display:flex;gap:8px">'+(v.saved
    ?'<button type="button" class="dact pri" data-ca="approve"'+(probs.length?' disabled':'')+'>승인 · 시행일 적용</button><button type="button" class="dact" data-ca="discard">초안 버리기</button>'
    :'<button type="button" class="dact pri" data-ca="stage"'+(probs.length?' disabled':'')+'>초안으로 저장</button><button type="button" class="dact" data-ca="close">닫기</button>')+'</div></div>';
  }
  const ev=L.events||[];
  if(ev.length)html+='<div class="ca-hist"><b>최근 기록</b>'+ev.slice(0,8).map(e=>'<div>'+h(String(e.created_at).slice(0,16).replace('T',' '))+' · '+h(KIND[e.kind].name)+' '+({stage:'초안 저장',approve:'승인',discard:'초안 버림'}[e.action]||e.action)+' · '+e.row_count+'줄'+(e.skipped_count?' (건너뜀 '+e.skipped_count+')':'')+' · '+h(e.actor_name||'')+'</div>').join('')+'</div>';
  host.innerHTML=html;
 }
 /* ---------- 동작 ---------- */
 const say=(text,cls)=>{S.msg={text,cls:cls==='err'?'cae':'cao'};};
 function pendRows(){return S.pend?S.pend.rows:[];}
 async function onFile(kind,file){
  S.tab=kind;S.msg=null;S.page=1;
  try{S.pend=await readFile(kind,file);say(KIND[kind].name+' 파일을 읽었습니다. 값을 확인하고 [초안으로 저장]을 눌러 주세요.');}catch(e){S.pend=null;say(String(e.message||e),'err');}
  render();
 }
 /* 직접 입력 항목(고용보험료 등)에 이전 값을 제안으로 채운다 — 출처는 직접 입력해야 승인된다 */
 function prefill(p){if(p.kind!=='cost')return;p.rows.forEach(r=>{if(r.manual&&r.rate==null){const prev=QS().latestBefore('cost',rowsOf('cost').filter(x=>x.status!=='draft'),r.item+'|'+(r.tier||''),r.effective_from);if(prev)r.rate=Number(prev.rate);}});}
 function preview(kind,pend){S.tab=kind;S.page=1;S.pend=pend;prefill(pend);render();}
 async function stage(){
  const p=S.pend;if(!p)return;const rows=p.rows.map(r=>Object.assign({},r,{source:r.manual?(r.source||''):(r.source||p.source)}));
  const eff=p.kind==='labor'?'':p.effective;
  const rows2=rows.map(r=>p.kind==='cost'||p.kind==='method'?Object.assign({},r,{effective_from:eff||r.effective_from}):p.kind==='material'?Object.assign({},r,{price_date:eff||r.price_date}):r);
  try{const r=await call('crm_cost_standard_stage_v1',{kind:p.kind,source:p.source,rows:rows2});S.pend=null;await load();
   say('초안 '+r.staged+'줄을 저장했습니다.'+(r.skipped.length?' 같은 시행일에 이미 승인된 '+r.skipped.length+'줄은 건너뛰었습니다.':'')+' 아래에서 확인하고 승인해 주세요.');}catch(e){say(String(e.message||e),'err');}
  render();
 }
 async function approve(){const k=S.tab;try{const r=await call('crm_cost_standard_approve_v1',{kind:k});await load();say(KIND[k].name+' '+r.approved+'줄을 승인했습니다. 시행일 '+(r.effective_from||'')+' 이후 견적부터 적용됩니다.');}catch(e){say(String(e.message||e),'err');}render();}
 async function discard(){const k=S.tab;try{const r=await call('crm_cost_standard_discard_v1',{kind:k});await load();say('초안 '+r.discarded+'줄을 버렸습니다.');}catch(e){say(String(e.message||e),'err');}render();}
 function bind(){
  const host=document.getElementById('cost-admin');if(!host||host.dataset.caBound)return;host.dataset.caBound='1';
  host.addEventListener('change',e=>{const t=e.target,a=t.dataset&&t.dataset.ca;
   if(a==='file'&&t.files&&t.files[0]){onFile(t.dataset.k,t.files[0]);t.value='';}
   else if(a==='eff'&&S.pend){S.pend.effective=t.value;S.pend.rows.forEach(r=>{if(S.pend.kind==='cost'||S.pend.kind==='method')r.effective_from=t.value;else if(S.pend.kind==='material')r.price_date=t.value;});render();}
   else if(a==='source'&&S.pend){S.pend.source=t.value;S.pend.rows.forEach(r=>{if(!r.manual)r.source=t.value;});render();}
   else if(a==='rate'&&S.pend){const r=S.pend.rows[+t.dataset.i],v=Number(String(t.value).replace(/,/g,''));r.rate=t.value.trim()===''||!Number.isFinite(v)?null:Math.round(v*1e6)/1e8;render();}
   else if(a==='src'&&S.pend){S.pend.rows[+t.dataset.i].source=t.value;render();}
  });
  host.addEventListener('click',e=>{const b=e.target.closest('[data-ca]');if(!b)return;const a=b.dataset.ca;
   if(a==='tab'&&!e.target.closest('label,button,input')){S.tab=b.dataset.k;S.page=1;S.msg=null;render();}
   else if(a==='pg'){S.page=+b.dataset.i;render();}
   else if(a==='stage')stage();else if(a==='approve')approve();else if(a==='discard')discard();else if(a==='close'){S.pend=null;render();}
  });
 }
 R.CostAdmin={render(){bind();render();},reload(){S.list=null;S.pend=null;S.msg=null;render();},preview,_state:S};
})(window);
