/* 수주 유형 (2026-10-04 디자인 핸드오프 'design_handoff_rules' 2-1 · 수주 처리 · 수주유형.dc.html)
   단계 바꾸기 → [수주]를 누르면 먼저 유형을 고른다: 직접 수주 / 협약시공사 수주 · 기술자문 / 타사 이관 수주.
   실적 금액 = 낙찰금액(VAT 별도). 기술자문 계약금액 · POUR 계약금액은 더하지 않고 '연결 계약'으로 따로 저장한다.
   직접 수주의 실적은 계속 계약실적 원장(계약 체결일 기준)에서 읽는다 — 여기서는 유형 · 계약 업체를 남기고 계약 단계 창으로 이어 준다.
   협약시공사 수주에서 기술자문 발생 = 예 → 서버가 기술자문 관리 건을 자동으로 만든다(crm_deal_win_register_v1 — sql/deal-win-type-v1-20261004.sql).
   타사 이관 수주는 타사 이관 흐름(deal-transfer.js: 등록 → 낙찰결과 → 관리자 실적 인정)으로 이어 준다.
   상세 머리: 영업 경로(브랜드) / 영업 담당 / 결과 / 낙찰 시공사 · 낙찰금액 + 연결 계약 — 브랜드 하나만 보여 낙찰업체로 오해되지 않게.
   집계(주간 브리핑 · 대시보드 · 리포트 공통): partnerIn = 협약시공사 수주 · 기술자문(이 화면에서 확정한 건 + 확정된 기술자문 낙찰실적, 겹치는 건은 한 번만).
   저장은 서버가 확인한 뒤에만 화면에 반영한다. 끄기: G.dealWinOff=true */
(function(root){
 'use strict';
 const R=root,h=v=>R.esc(String(v==null?'':v)),attr=v=>R.escAttr(String(v==null?'':v));
 const RPC={list:'crm_deal_win_list_v1',reg:'crm_deal_win_register_v1'};
 const BRAND={'석민이앤씨':'#e8590c','POUR솔루션':'#1f9d55','POUR공법':'#7048e8','아파트스퀘어':'#3b6ce4'};
 const TYPES=[['own','직접 수주','자사가 직접 계약 · 시공'],['partner_tech','협약시공사 수주 · 기술자문','우리 영업 → 협약시공사 낙찰 → 기술자문 계약'],['transfer','타사 이관 수주','공식 이관 → 그 업체 낙찰 · 사전 보고 승인']];
 const SHORT={own:'직접 수주',partner_tech:'협약 · 기술자문',transfer:'타사 이관'};
 let rows=null,adv=null,map=new Map(),busy=false,warmed='';
 function st(){const g=R.G;if(!g.dealWin)g.dealWin={dlg:null};return g.dealWin;}
 const enabled=()=>!R.G.dealWinOff&&!!R.OpsStore&&!!R.CRMRules;
 const available=()=>enabled()&&R.OpsStore.has(RPC.list);
 const admin=()=>{try{return !!R.todayIsAdmin();}catch(e){return false;}};
 const toast=m=>{if(typeof R.toast==='function')R.toast(m);};
 const pad=n=>String(n).padStart(2,'0'),todayKey=()=>{const d=new Date();return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());};
 const won=n=>Number(n)>0?R.fmtAmt(Number(n)):'0원';
 const comma=n=>Number(n||0).toLocaleString('ko-KR'),digits=v=>String(v||'').replace(/[^\d]/g,'');
 const siteOf=d=>String(d&&d.site||'').replace(/^\s*\[[^\]]*\]\s*/,'')||'현장명 미확인';
 const DT=()=>R.DealTransfer&&R.DealTransfer.enabled()?R.DealTransfer:null;
 /* ── 자료 ── */
 function attach(){const D=R.B&&R.B.deals||[];D.forEach(d=>{const w=map.get(String(d.id));if(w)d.win=w;else if(d.win)delete d.win;});}
 function take(r){rows=Array.isArray(r&&r.rows)?r.rows:[];adv=Array.isArray(r&&r.advisory)?r.advisory:null;map=new Map(rows.map(x=>[String(x.deal_id),x]));attach();}
 function put(row,dealId){if(row)map.set(String(row.deal_id),row);else map.delete(String(dealId));rows=[...map.values()];attach();}
 async function load(){if(!available()||busy)return rows||[];busy=true;try{take(await R.OpsStore.rpc(RPC.list,{}));}catch(e){rows=rows||[];}finally{busy=false;}return rows;}
 function warm(){const me=R.ME&&String(R.ME.id||R.ME.name||'');if(!me||warmed===me||!available())return;warmed=me;load().then(()=>{if((rows&&rows.length)||(adv&&adv.length)){try{R.paint();}catch(e){}}});}
 const of=d=>d&&map.get(String(d.id))||null;
 const dealOf=id=>(R.B&&R.B.deals||[]).find(d=>String(d.id)===String(id))||null;
 const ledgerOf=d=>{try{const key=String(R.dealKey?R.dealKey(d):d.id);return (R.ContractSalesData.state().items||[]).find(r=>String(r.deal_id)===key&&!r.cancelled&&Number(r.balance)>0)||null;}catch(e){return null;}};
 /* 확정된 기술자문 낙찰실적: 서버가 준 목록(전 직원), 서버 함수 설치 전에는 관리자 화면의 기존 목록 */
 function advRows(){
  if(Array.isArray(adv))return adv;
  let l=null;try{l=R.SalesInsights&&R.SalesInsights.advisory?R.SalesInsights.advisory():null;}catch(e){}
  return Array.isArray(l)?l.filter(x=>x&&x.attribution&&x.attribution.decision==='confirmed').map(x=>Object.assign({advisory_id:x.advisory_id,site_name:x.site_name,contractor:x.contractor,advisory_fee:null,pour_amount:null},x.attribution)):[];
 }
 function partnerMeta(){
  const meta=new Map();
  (rows||[]).forEach(w=>{if(w.won_type==='partner_tech')meta.set(String(w.deal_id),{company:w.award_company,tech:w.tech_advisory===true,site:dealOf(w.deal_id)?.site,revenue:(Number(w.tech_advisory_amount)||0)+(Number(w.pour_contract_amount)||0),revKnown:true})});
  advRows().forEach(t=>{if(t.decision==='confirmed'&&t.source_deal_id&&!meta.has(String(t.source_deal_id)))meta.set(String(t.source_deal_id),{company:t.contractor,tech:true,site:t.site_name,revenue:(Number(t.advisory_fee)||0)+(Number(t.pour_amount)||0),revKnown:t.advisory_fee!=null||t.pour_amount!=null})});
  return meta;
 }
 function isPartnerDeal(id){return enabled()&&partnerMeta().has(String(id))}
 /* [a,b) contract event dates. Fees stay separate; no award-date fallback. */
 function partnerIn(a,b,owner){
  const selected=R.ContractSalesData?.entries?.({owner:owner||'전체',brand:R.G.brand||'전체'}),out=[],meta=partnerMeta();
  if(selected)(selected||[]).forEach(r=>{
   const advisory=r.advisory_id&&advRows().find(t=>String(t.advisory_id)===String(r.advisory_id));
   const m=r.advisory_id?{company:advisory?.contractor,tech:true,site:r.site,revenue:(Number(advisory?.advisory_fee)||0)+(Number(advisory?.pour_amount)||0),revKnown:advisory?.advisory_fee!=null||advisory?.pour_amount!=null}:meta.get(String(r.deal_id));if(!m)return;
   const events=(r.events||[]).filter(e=>e.effective_date>=a&&e.effective_date<b);if(!events.length)return;
   const d=dealOf(r.deal_id);
   out.push({src:'contract',key:events[0].effective_date,owner:r.sales_owner_name,brand:r.brand,company:m.company||'시공사 미기록',amount:events.reduce((s,e)=>s+e.amount_delta,0),signedCount:events.filter(e=>e.kind==='signed').length,site:d?siteOf(d):m.site||r.site_name||'현장명 미확인',tech:m.tech,revenue:events.some(e=>e.kind==='signed')?m.revenue:0,revKnown:m.revKnown&&events.every(e=>e.kind==='signed'),deal:d,dealId:String(r.deal_id),events});
  });
  return {ready:!!selected,count:out.reduce((s,x)=>s+x.signedCount,0),amount:out.reduce((s,x)=>s+x.amount,0),revenue:out.reduce((s,x)=>s+x.revenue,0),unknown:out.filter(x=>!x.revKnown).length,list:out};
 }
 /* ── 상세 머리: 영업 경로 / 영업 담당 / 결과 / 낙찰 시공사 · 낙찰금액 + 연결 계약 ── */
 function cur(){const c=R.CUR_DETAIL;return c&&c.kind==='deal'&&c.item?c.item:null;}
 function resultOf(d){
  attach();const T=DT(),ts=T?T.stateOf(d):'none',t=T?T.of(d):null,w=R.CRMRules.winOf(d);
  if(t&&(ts==='approved'||ts==='awarded'))return {type:'transfer',done:ts==='approved',text:ts==='approved'?'타사 이관 수주':'타사 이관 수주 · 실적 인정 대기',label:'낙찰 시공사 · 낙찰금액',company:String(t.award_company||t.transfer_company||''),amount:Number(t.award_amount)||0,owner:R.repN(t.performance_owner)};
  if(w.type==='partner_tech')return {type:'partner_tech',done:true,text:w.tech?'수주 · 기술자문':'협약시공사 수주',label:'낙찰 시공사 · 낙찰금액',company:w.company,amount:w.amount,owner:R.repN(w.owner),w};
  const L=ledgerOf(d);
  if(w.type==='own')return {type:'own',done:true,text:'직접 수주',label:'계약 업체 · 금액',company:w.company,amount:L?Number(L.balance)||w.amount:w.amount,owner:R.repN(w.owner),w};
  if(L)return {type:'own',done:true,text:'직접 수주',label:'계약 업체 · 금액',company:String(d.brand||''),amount:Number(L.balance)||0,owner:R.repN(L.sales_owner_name||d.assignee)};
  return null;
 }
 function headHtml(d){
  const r=resultOf(d);if(!r)return '';
  const br=String(r.w&&r.w.brand||d.brand||'').trim(),c=BRAND[br]||'#15171c',own=r.owner||R.repN(d.assignee)||'미배정',now=R.repN(d.assignee),w=r.w;
  const box=(l,v,cls)=>'<div class="'+(cls||'')+'"><span>'+h(l)+'</span>'+v+'</div>';
  return '<div class="wn-boxes">'+box('영업 경로 (브랜드)','<b class="wn-br" style="color:'+c+'"><i style="background:'+c+'"></i>'+h(br||'브랜드 미기록')+'</b>')
   +box('영업 담당','<b>'+h(own)+(now&&now!==own?' <small>현재 '+h(now)+'</small>':'')+'</b>')
   +box('결과','<b>'+h(r.text)+'</b>',r.done?'wn-ok':'wn-wait')
   +box(r.label,'<b>'+h((r.company||'업체 미기록')+(r.amount>0?' · '+won(r.amount):''))+'</b>')+'</div>'
   +(w&&w.tech?'<div class="wn-links"><span class="wn-lt">연결 계약</span><span>기술자문 <b>'+h(won(w.techAmount))+'</b> · '+h(w.techCompany)+'</span>'+(w.pourAmount>0?'<i>|</i><span>POUR 계약 <b>'+h(won(w.pourAmount))+'</b></span>':'')+(admin()&&R.ContractSalesUI&&R.ContractSalesUI.advisorySync?'<button type="button" data-wn="advisory">기술자문 관리에서 보기 →</button>':'')+(canEdit(d)?'<button type="button" class="wn-ed" data-wn="open">수주 정보 고치기</button>':'')+'</div>':w&&canEdit(d)?'<div class="wn-links"><button type="button" class="wn-ed" data-wn="open">수주 정보 고치기</button></div>':'');
 }
 function decorate(){
  document.getElementById('wn-head')?.remove();
  const d=cur(),row=document.querySelector('#detailView .dv3-subrow');if(!enabled()||!d||!row)return;
  const html=headHtml(d);if(!html)return;
  const el=document.createElement('div');el.id='wn-head';el.className='wn-head';el.innerHTML=html;row.after(el);
 }
 const canEdit=d=>admin()||R.repN(d.assignee)===R.repN(R.ME&&R.ME.name)||(of(d)&&R.repN(of(d).performance_owner)===R.repN(R.ME&&R.ME.name));
 /* 단계 띠의 [수주]: 준공 단계의 '수주 · 준공 완료'는 예전 그대로, 그 앞 단계에서는 수주 처리 창을 연다 */
 function intercept(d){
  if(!available()||!d)return false;let stage='';try{stage=R.dealStage(d);}catch(e){}
  if(stage==='completion')return false;try{if(R.StageTransition.terminal.includes(R.outcomeOf(d))||!R.isOpen(d))return false;}catch(e){}
  openDlg(d);return true;
 }
 /* ── 수주 처리 창 ── */
 function openDlg(d){
  d=d||cur();if(!d||!available())return;attach();const w=of(d),T=DT(),t=T?T.of(d):null,type=t&&T.stateOf(d)!=='none'?'transfer':w&&w.win_status==='confirmed'?w.won_type:'own';
  st().dlg={deal:String(d.id),done:null,err:'',busy:false,f:{type,
   company:{own:w&&w.won_type==='own'?w.award_company:String(d.brand||''),partner_tech:w&&w.won_type==='partner_tech'?w.award_company:'',transfer:t?String(t.award_company||t.transfer_company||''):''},
   amount:w?String(Math.round(Number(w.award_amount))):t&&t.award_amount?String(Math.round(Number(t.award_amount))):'',date:w?String(w.award_date).slice(0,10):t&&t.award_date?String(t.award_date).slice(0,10):todayKey(),
   tech:w&&w.won_type==='partner_tech'?w.tech_advisory===true:true,tech_company:w&&w.tech_advisory_company||'',tech_touched:!!(w&&w.tech_advisory_company),tech_amount:w&&w.tech_advisory_amount?String(Math.round(Number(w.tech_advisory_amount))):'',pour_amount:w&&w.pour_contract_amount?String(Math.round(Number(w.pour_contract_amount))):''}};
  renderDlg();
 }
 function closeDlg(){st().dlg=null;document.getElementById('wn-dialog')?.remove();}
 function noteOf(f){
  const a=Number(f.amount)>0?' '+comma(f.amount)+'원':'';
  if(f.type==='own')return '실적 금액 = 낙찰금액'+a+'. 계약 · 시공 단계로 이어집니다.';
  if(f.type==='partner_tech')return '실적 금액 = 낙찰금액'+a+'. '+(f.tech?'기술자문'+(Number(f.tech_amount)>0?' '+comma(f.tech_amount)+'원':'')+(Number(f.pour_amount)>0?' · POUR '+comma(f.pour_amount)+'원':'')+'은 더하지 않고 연결 계약으로 따로 저장합니다. 저장하면 기술자문 관리 건이 자동으로 생깁니다.':'기술자문 계약이 없으면 낙찰금액만 실적으로 남습니다.');
  return '실적 금액 = 낙찰금액. 사전 보고된 이관 건만, 관리자 승인 후 실적에 들어갑니다.';
 }
 /* 타사 이관 수주: 지금 상태에 맞는 다음 걸음 [버튼 글자, 누를 수 있나, 사전 보고 줄] */
 function transferStep(d){
  const T=DT();if(!T||!T.available())return ['타사 이관 등록',false,'타사 이관 기능이 서버에 적용된 뒤에 쓸 수 있습니다'];
  const t=T.of(d),s=T.stateOf(d),rep=t?(t.transfer_reported?'보고 완료'+(t.transfer_reported_at?' ('+String(t.transfer_reported_at).slice(5,10).replace('-','.')+')':'')+(t.transfer_memo?' · '+t.transfer_memo:''):'미보고 — 인센티브 실적으로 인정되지 않습니다'):'';
  if(!t||s==='none')return ['타사 이관 등록부터',true,'아직 타사 이관 등록이 없습니다 — 등록(사전 보고 포함)부터 합니다'];
  if(s==='awarded')return [admin()?'실적 인정':'관리자 승인 대기',admin(),rep];
  if(s==='approved')return ['실적 반영됨',false,rep];
  return ['수주 확정',true,rep];
 }
 function renderDlg(){
  const S=st(),D=S.dlg;let ov=document.getElementById('wn-dialog');if(!D){ov?.remove();return;}
  const d=dealOf(D.deal);if(!d){closeDlg();return;}const f=D.f,w=of(d),own=R.repN(w?w.performance_owner:d.assignee)||'미배정';
  if(!ov){ov=document.createElement('div');ov.id='wn-dialog';ov.className='wn-shade';document.body.append(ov);ov.addEventListener('click',onClick);ov.addEventListener('input',onInput);ov.addEventListener('mousedown',e=>{if(e.target===ov)closeDlg();});ov.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();closeDlg();}});}
  let body='',foot='';
  if(D.done){
   const x=D.done;
   body='<div class="wn-done"><span>수주 확정 후 자동 생성</span><b>기술자문 관리 건 · '+h(siteOf(d))+'</b><div class="wn-kv"><span>계약 상대</span><span>'+h(x.tech_advisory_company)+'</span><span>기술자문</span><b>'+h(comma(x.tech_advisory_amount))+'원</b>'+(Number(x.pour_contract_amount)>0?'<span>POUR 계약</span><span>'+h(comma(x.pour_contract_amount))+'원</span>':'')+'<span>이어서</span><span>계약 → 현장 → 대금 → 완료 (기술자문 관리)</span></div><small>영업실적은 공사 계약 체결 확인 후 반영합니다. 시공 · 대금은 기술자문 관리에서 이어갑니다.</small></div>'
    +'<div class="wn-note">낙찰금액 '+h(comma(x.award_amount))+'원(VAT 별도)을 저장했습니다. 공사 계약일·공사금액·당시 실적 귀속자 확인 후 계약 원장에서 실적을 반영합니다. 기술자문 · POUR 계약금액은 별도 관리합니다.</div>';
   foot='<button type="button" class="wn-dark" data-wn="close">닫기</button>';
  }else{
   const tp=f.type,isT=tp==='transfer',step=isT?transferStep(d):null;
   body='<div class="wn-types">'+TYPES.map(([k,l,s])=>'<button type="button" data-wn="type" data-v="'+k+'" aria-pressed="'+(tp===k)+'"><span><i><u></u></i><b>'+h(l)+'</b></span><small>'+h(s)+'</small></button>').join('')+'</div>'
    +'<div class="wn-form"><label>'+(tp==='own'?'계약 업체':'낙찰 시공사')+' *</label><input data-wn-f="company" maxlength="80" value="'+attr(f.company[tp])+'" placeholder="'+(tp==='own'?'예: 석민이앤씨':'예: 코지건설')+'">'
    +'<label>낙찰금액 *</label><div class="wn-amt wn-big"><input data-wn-f="amount" inputmode="numeric" value="'+attr(f.amount?comma(f.amount):'')+'" placeholder="0"><span>원 · VAT 별도</span></div>'
    +'<label>낙찰일 *</label><input type="date" data-wn-f="date" max="'+todayKey()+'" value="'+attr(f.date)+'">'
    +'<label>실적 귀속</label><span>'+h(own)+' <small>주담당 자동</small></span>'
    +(tp==='partner_tech'?'<label>기술자문 발생 *</label><div class="wn-yn"><button type="button" data-wn="tech" data-v="1" aria-pressed="'+(f.tech===true)+'">예</button><button type="button" data-wn="tech" data-v="0" aria-pressed="'+(f.tech===false)+'">아니오</button></div>'
      +(f.tech?'<label>기술자문 계약</label><div class="wn-two"><input class="wn-co" data-wn-f="tech_company" maxlength="80" value="'+attr(f.tech_touched?f.tech_company:f.company.partner_tech)+'" placeholder="계약 상대" aria-label="기술자문 계약 상대"><input data-wn-f="tech_amount" inputmode="numeric" value="'+attr(f.tech_amount?comma(f.tech_amount):'')+'" placeholder="기술자문 계약금액" aria-label="기술자문 계약금액"><span>원</span></div>'
       +'<label>POUR 계약</label><div class="wn-amt"><input data-wn-f="pour_amount" inputmode="numeric" value="'+attr(f.pour_amount?comma(f.pour_amount):'')+'" placeholder="0" aria-label="POUR 계약금액"><span>원 · 선택</span></div>':''):'')
    +(isT?'<label>사전 보고</label><span>'+h(step[2])+' <small>관리자 승인 후 실적 반영</small></span>':'')+'</div>'
    +'<div class="wn-note">'+h(noteOf(f))+'</div>';
   foot='<button type="button" data-wn="close">취소</button>'+(w&&!isT&&w.won_type===tp&&admin()?'<button type="button" data-wn="undo"'+(D.busy?' disabled':'')+'>확정 거두기</button>':'')+'<button type="button" class="wn-dark" data-wn="save"'+(D.busy||(isT&&!step[1])?' disabled':'')+'>'+(D.busy?'저장 중…':isT?h(step[0]):'수주 확정')+'</button>';
  }
  ov.innerHTML='<section class="wn-dlg" role="dialog" aria-modal="true" aria-label="수주 처리"><header><b>수주 처리</b><span>'+(D.done?'수주 확정 후':'단계 바꾸기 → 수주 를 누르면 먼저 유형을 고릅니다')+'</span><i></i><button type="button" class="wn-x" data-wn="close" aria-label="닫기">✕</button></header>'+body+(D.err?'<div class="wn-err">'+h(D.err)+'</div>':'')+'<footer>'+foot+'</footer></section>';
 }
 function onInput(e){
  const el=e.target,k=el.dataset&&el.dataset.wnF,D=st().dlg;if(!k||!D)return;const f=D.f;
  if(k==='amount'||k==='tech_amount'||k==='pour_amount'){const n=digits(el.value);f[k]=n;const shown=n?comma(n):'';if(el.value!==shown)el.value=shown;}
  else if(k==='company')f.company[f.type]=el.value;else{f[k]=el.value;if(k==='tech_company')f.tech_touched=true;}
  const note=document.querySelector('#wn-dialog .wn-note');if(note)note.textContent=noteOf(f);
  if(k==='company'&&f.type==='partner_tech'&&!f.tech_touched){const tc=document.querySelector('#wn-dialog [data-wn-f="tech_company"]');if(tc)tc.value=el.value;}
 }
 async function send(payload,done){
  const D=st().dlg;if(!D||D.busy)return;D.busy=true;D.err='';renderDlg();
  try{const r=await R.OpsStore.rpc(RPC.reg,payload);put(r.win||null,payload.deal_id);D.busy=false;done(r);}
  catch(e){D.busy=false;D.err='저장하지 못했습니다: '+(e.message||e);renderDlg();return;}
  try{R.paint();}catch(e){}try{R.DealDetailV3&&R.DealDetailV3.apply();}catch(e){}
  load().then(()=>{try{R.paint();}catch(e){}});/* 새로 생긴 기술자문 관리 건까지 다시 읽는다 */
 }
 function onClick(e){
  const b=e.target.closest('[data-wn]');if(!b||b.disabled)return;const a=b.dataset.wn,D=st().dlg;if(!D)return;const f=D.f,id=D.deal,d=dealOf(id);
  if(a==='close')return closeDlg();
  if(a==='type'){f.type=b.dataset.v;D.err='';return renderDlg();}
  if(a==='tech'){f.tech=b.dataset.v==='1';D.err='';return renderDlg();}
  if(a==='undo'){if(!D.confirm){D.confirm=true;D.err='확정을 거두면 이 영업건의 수주 유형 · 실적이 빠집니다(만들어진 기술자문 관리 건은 남습니다). 한 번 더 누르면 거둡니다.';return renderDlg();}return send({deal_id:id,cancel:true},()=>{toast('수주 확정을 거뒀습니다');closeDlg();});}
  if(a!=='save'||!d)return;
  const tp=f.type,company=String(f.company[tp]||'').trim();
  if(tp==='transfer'){
   const T=DT(),s=T?T.stateOf(d):'none';closeDlg();if(!T)return;
   if(!T.of(d)||s==='none')return T.open('reg');
   if(s==='awarded')return T.open('approve');
   return T.open('award',{result:'transferred_won',company:company||undefined,amount:f.amount||undefined,date:f.date||undefined});
  }
  if(!company){D.err=(tp==='own'?'계약 업체':'낙찰 시공사')+'를 적어 주세요.';return renderDlg();}
  if(!(Number(f.amount)>0)){D.err='낙찰금액(VAT 별도)을 넣어 주세요.';return renderDlg();}
  if(!f.date||f.date>todayKey()){D.err='낙찰일은 오늘까지의 날짜로 넣어 주세요.';return renderDlg();}
  const p={deal_id:id,type:tp,company,amount:Number(f.amount),date:f.date,site_name:siteOf(d)};
  if(tp==='partner_tech'){
   if(f.tech!==true&&f.tech!==false){D.err='기술자문 발생 여부를 골라 주세요.';return renderDlg();}
   p.tech=f.tech;
   if(f.tech){const tc=String(f.tech_touched?f.tech_company:company).trim();if(!tc){D.err='기술자문 계약 상대를 적어 주세요.';return renderDlg();}if(!(Number(f.tech_amount)>0)){D.err='기술자문 계약금액을 넣어 주세요.';return renderDlg();}p.tech_company=tc;p.tech_amount=Number(f.tech_amount);p.pour_amount=f.pour_amount||'';}
   return send(p,r=>{if(r.win.tech_advisory){toast(r.advisory_created?'수주를 확정했습니다 — 기술자문 관리 건이 생겼습니다':'수주 정보를 저장했습니다 — 기술자문 관리 건에 반영했습니다');st().dlg.done=r.win;renderDlg();}else{toast('협약시공사 수주로 확정했습니다 — 수주실적 '+won(r.win.award_amount));closeDlg();}});
  }
  return send(p,()=>{toast('직접 수주로 확정했습니다 — 계약 · 시공 단계로 이어집니다');closeDlg();
   /* 계약 단계 앞이면 계약 창(낙찰결과 · 계약금액 · 체결일)으로 이어 준다 — 계약실적 원장은 그 경로 그대로 */
   try{const T=R.StageTransition,UI=R.StageTransitionUI;if(T.choices(R.dealStage(d)).includes('contract')&&R.PipelineStages.group(R.dealStage(d))!=='construction')UI.open(d,false,'contract');}catch(err){}});
 }
 /* 상세 안의 버튼 */
 document.addEventListener('click',e=>{
  if(!enabled())return;const b=e.target.closest('[data-wn]');if(!b||b.closest('#wn-dialog'))return;const a=b.dataset.wn;
  if(a==='open')return openDlg();
  if(a==='advisory'){try{R.ContractSalesUI.advisorySync();}catch(err){}}
 });
 /* 계약 단계 창의 계약금액 미리 채움에 쓰는 낙찰금액 */
 const amountOf=d=>{const w=of(d);return w&&w.win_status==='confirmed'?Number(w.award_amount)||0:0;};
 const basePaint=R.paint;if(typeof basePaint==='function')R.paint=function(){try{attach();}catch(e){}const r=basePaint.apply(this,arguments);try{warm();}catch(e){}return r;};
 root.DealWin={enabled,available,load,of,resultOf,partnerIn,isPartnerDeal,advisoryOf:id=>advRows().find(t=>t&&t.decision==='confirmed'&&String(t.source_deal_id)===String(id))||null,/* 그 영업건에 연결된 확정 기술자문 줄(성과 분석 기술자문 탭) */headHtml,decorate,intercept,open:openDlg,close:closeDlg,amountOf,TYPES,SHORT,RPC,_take:take};
})(window);
