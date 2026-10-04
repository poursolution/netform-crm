/* 승인 요청 창 (2026-10-04 design_handoff_rules/승인 요청 창.dc.html · 같은 날 '승인 요청 창 보완')
   영업건 상세 [··· 기타 처리] → '승인 요청' → 종류 6개(중복 리드 정산 · 전략수주 · 특별 인센티브 · 결과 수정 · 귀속 변경 · 타사 이관 실적)마다 정해진 칸 + 근거 + 증빙.
   보내면 예외 승인함 대기 + 상세 머리 '승인 대기 · 종류' 꼬리표. 승인 전에는 실적 · 귀속 · 결과를 바꾸지 않는다(이 창은 요청만 올린다).
   날짜는 실제 일어난 날로 받는다(승인한 날로 대신하지 않는다): 타사 이관 = 이관일 · 낙찰일 / 결과 수정 = 낙찰일 · 계약일.
   승인되면 시안의 안내대로 반영(서버): 타사 이관 실적 = 낙찰일 기준 실적 인정 / 결과 수정 = 결과 · 낙찰일 · 금액, 직접 수주는 계약 전환까지 한 번에
   / 중복 리드 정산 = 실적 나눔 비율(합 100%)로 귀속 + 정산 내역 / 특별 인센티브 = 정산 내역 별도 항목 / 귀속 변경 = 실적 귀속 / 전략수주 = 승인 기록.
   승인자 = 운영 기준의 '예외 승인자'(기본 이승우 · 황윤선) 중 한 사람. 승인 · 반려 결과는 응대 이력의 시스템 기록 + 요청자에게 알림(approval-inbox.js).
   증빙 파일 = 그 영업건 자료(기존 첨부 경로)에 올리고 요청에는 파일 이름만 붙인다.
   종류 · 칸 이름 · 안내 문구 = 운영 기준(CRMRules.PHASE2.approval_request). 끄기: G.approvalRequestOff=true */
(function(root){
 'use strict';
 const R=root,h=v=>R.esc(String(v==null?'':v)),attr=v=>R.escAttr(String(v==null?'':v));
 const AI=()=>R.ApprovalInbox;
 const SPEC=()=>(R.CRMRules&&R.CRMRules.PHASE2&&R.CRMRules.PHASE2.approval_request)||{order:[],types:{},hint:''};
 const enabled=()=>!R.G.approvalRequestOff&&!!AI()&&AI().enabled()&&!!R.CRMRules;
 const available=()=>enabled()&&!!R.OpsStore&&R.OpsStore.has(AI().RPC.request);
 const st=()=>R.G.approvalRequest||(R.G.approvalRequest={dlg:null});
 const me=()=>{try{return R.repN(R.ME&&R.ME.name)||'';}catch(e){return '';}};
 const names=()=>{try{return R.CRMRules.approvers().join(' · ');}catch(e){return '';}};
 function cur(){const c=R.CUR_DETAIL;return c&&c.kind==='deal'&&c.item?c.item:null;}
 const comma=n=>Number(n||0).toLocaleString('ko-KR');
 const kstKey=v=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(v));
 const md=v=>{const m=/^(\d{4})-(\d{2})-(\d{2})/.exec(kstKey(v));return m?Number(m[2])+'.'+Number(m[3]):'';};
 const dot=k=>{const m=/^(\d{4})-(\d{2})-(\d{2})/.exec(String(k||''));return m?m[1]+'.'+Number(m[2])+'.'+Number(m[3]):'';};
 const known=()=>{try{return (R.SALES_PEOPLE_MASTER||[]).filter(x=>x&&x.active!==false).map(x=>R.repN(x.name)).concat((R.B&&R.B.users||[]).map(x=>R.repN(x.name||x.displayName||x.full_name))).filter(Boolean);}catch(e){return [];}};
 /* ── 읽기: 금액 · 날짜 · 결과 · 나눔 · 인센티브 방식 ── */
 /* 금액: '380,000,000원' · '3.8억' · '1억 2,000만' · '9,850만' → 원 */
 function parseWon(text){
  const s=String(text||'').replace(/\(.*?\)/g,' ').replace(/\s+/g,'');let total=0,hit=false;
  const eok=/([\d,]+(?:\.\d+)?)억/.exec(s);if(eok){total+=Math.round(parseFloat(eok[1].replace(/,/g,''))*1e8);hit=true;}
  const man=/([\d,]+(?:\.\d+)?)만/.exec(s);if(man){total+=Math.round(parseFloat(man[1].replace(/,/g,''))*1e4);hit=true;}
  if(!hit){const m=/(\d[\d,]{3,})/.exec(s);if(m){total=Number(m[1].replace(/,/g,''));hit=true;}}
  return hit&&Number.isSafeInteger(total)&&total>0?total:0;
 }
 /* 날짜: '2026.10.3' · '2026-10-03' · '2026/10/3' → 2026-10-03 (실제 있는 날 · 오늘까지) */
 function parseDate(text){
  const m=/(\d{4})\s*[.\-\/년]\s*(\d{1,2})\s*[.\-\/월]\s*(\d{1,2})/.exec(String(text||''));if(!m)return '';
  const y=Number(m[1]),mo=Number(m[2]),d=Number(m[3]),t=new Date(Date.UTC(y,mo-1,d));
  if(t.getUTCFullYear()!==y||t.getUTCMonth()!==mo-1||t.getUTCDate()!==d)return '';
  return y+'-'+String(mo).padStart(2,'0')+'-'+String(d).padStart(2,'0');
 }
 const future=k=>!!k&&k>kstKey(Date.now());
 /* 바꿀 결과: '수주 · 직접' / '수주 · 협약시공사(기술자문)' / '실주' */
 function parseResult(text){
  const s=String(text||'');
  if(/타사\s*이관/.test(s))return {err:"타사 이관 수주는 요청 종류 '타사 이관 실적'으로 올려 주세요."};
  if(/수주/.test(s))return {to_result:/협약|기술자문/.test(s)?'won_partner_tech':'won_own'};
  if(/실주/.test(s))return {to_result:'lost'};
  return {err:'바꿀 결과는 "수주 · 직접" · "수주 · 협약시공사" · "실주" 중 하나로 적어 주세요.'};
 }
 /* 실적 나눔: '황윤선 60% · 정정훈 40%' → [{name,ratio}] (합 100) */
 function parseShares(text){
  const out=[];String(text||'').split(/[·,\/]/).forEach(p=>{const m=/^\s*(.+?)\s*(\d{1,3}(?:\.\d{1,2})?)\s*%\s*$/.exec(p);if(m)out.push({name:R.repN(m[1].trim())||m[1].trim(),ratio:Number(m[2])});});
  return out;
 }
 /* 인센티브 방식: '비율 1%' · '수주실적의 1%' → ratio / '금액 180만원' · '1,800,000원' → amount */
 function parseIncentive(text){
  const s=String(text||'');const pct=/(\d{1,3}(?:\.\d{1,2})?)\s*%/.exec(s);
  if(pct)return {mode:'ratio',value:Number(pct[1])};
  const won=parseWon(s);return won?{mode:'amount',value:won}:null;
 }
 /* 지급 월: '2026.11 정산' → 2026-11 */
 function parseMonth(text){const m=/(\d{4})\s*[.\-\/년]\s*(\d{1,2})/.exec(String(text||''));if(!m)return '';const mo=Number(m[2]);return mo>=1&&mo<=12?m[1]+'-'+String(mo).padStart(2,'0'):'';}
 /* ── 미리 채움: 지금 자료에서 알 수 있는 값만. '(자동)'은 계산해서 넣은 값(고칠 수 없음) ── */
 const perfOwner=d=>{try{if(R.DealOwner&&R.DealOwner.enabled())return R.DealOwner.perf(d)||'';}catch(e){}return R.repN(d.assignee)||'';};
 function acts(d){let p={};try{p=R.itemPatch(d,'deal')||{};}catch(e){}return [...(d.activities||[]),...(p.activities||[])];}
 /* 사람별 첫 연결일: 이 현장(같은 현장의 다른 영업건 포함)의 기록 중 실제로 연결된 가장 이른 접촉 */
 function firstConnects(d){
  let rel=[];try{rel=R.DealDetailV3.related(d)||[];}catch(e){}
  const first=new Map();
  [d,...rel].forEach(x=>acts(x).forEach(a=>{const who=R.repN(a.actor||a.actor_name||x.assignee)||'',at=a.at||a.occurred_at||'';if(!who||!at)return;let ok=false;try{ok=!!R.isMeaningfulContact(a.type,a.note,a.result||'',a.meaningful);}catch(e){}if(!ok)return;const t=Date.parse(at);if(!isFinite(t))return;if(!first.has(who)||t<first.get(who))first.set(who,t);}));
  return [...first.entries()].sort((a,b)=>a[1]-b[1]);
 }
 /* 이 영업건의 확정된 수주실적(낙찰금액) — 인센티브 비율 계산의 바탕 */
 const wonBase=d=>{try{const r=R.DealWin&&R.DealWin.enabled()?R.DealWin.resultOf(d):null;return r&&r.done?Number(r.amount)||0:0;}catch(e){return 0;}};
 function resultText(d){
  let r='';try{r=R.CRMRules.dealResult(d);}catch(e){}
  const won={won_own:'수주 · 직접',won_partner_tech:'수주 · 협약시공사 · 기술자문',won_transfer:'수주 · 타사 이관'}[r];
  if(won)return won;
  if(r==='lost'){const f=d.stage_contexts&&d.stage_contexts.lost&&d.stage_contexts.lost.fields||{};let why=f.close_reason||d.lost_reason||'';try{why=R.CRMRules.lostReason?R.CRMRules.lostReason(why)||why:why;}catch(e){}return '실주'+(why?' · '+why:'');}
  if(r==='bad_fit')return 'Bad Fit';
  if(r==='transfer_pending')return '타사 이관 · 결과 대기';
  let label='';try{label=R.StageTransition.definitions[R.dealStage(d)].label;}catch(e){}
  return '진행 중'+(label?' · '+label:'');
 }
 /* 인센티브 금액 · 비율 칸(자동): 방식 칸에 적은 값으로 계산 */
 function incentiveText(d,mode){
  const p=parseIncentive(mode);if(!p)return '';
  if(p.mode==='amount')return comma(p.value)+'원 (자동)';
  const base=wonBase(d);return '수주실적의 +'+p.value+'% ('+(base>0?'= '+R.fmtAmt(Math.round(base*p.value/100)):'수주 확정 뒤 계산')+', 자동)';
 }
 function prefill(code,d){
  const owner=R.repN(d.assignee)||'',my=me();
  if(code==='dup_lead'){const fc=firstConnects(d),ppl=[...new Set([owner,my,...fc.map(x=>x[0])].filter(Boolean))].slice(0,4),auto=fc.filter(x=>ppl.includes(x[0]));
   return {f:[ppl.length>1?ppl.join(' · '):'',auto.length?auto.map(x=>x[0]+' '+md(x[1])).join(' · ')+' (자동)':'','','이 영업건 수주실적 (낙찰금액)'],auto:[false,!!auto.length,false,false]};}
  if(code==='special_incentive')return {f:[owner,'','',''],auto:[false,false,true,false]};
  if(code==='result_fix')return {f:[resultText(d),'','','',''],auto:[false,false,false,false,false]};
  if(code==='owner_change'){const p=perfOwner(d);return {f:[p?p+' (주담당)':'',''],auto:[false,false]};}
  if(code==='transfer'){let t=null;try{t=R.DealTransfer&&R.DealTransfer.of(d);}catch(e){}return {f:[t?(t.award_company||t.transfer_company||''):'',t&&t.transfer_date?dot(String(t.transfer_date).slice(0,10)):'',t&&t.award_date?dot(String(t.award_date).slice(0,10)):'',t&&Number(t.award_amount)>0?comma(t.award_amount)+'원 (VAT 별도)':''],auto:[false,false,false,false]};}
  return {f:['',''],auto:[false,false]};
 }
 /* 칸 안의 예시(시안의 예시 값) */
 const PH={dup_lead:['황윤선 · 정정훈','','황윤선 60% · 정정훈 40%',''],strategic_win:['할인 7% · 하자기간 1년 연장','신규 지역 레퍼런스 현장'],special_incentive:['','금액 · 비율 중 하나','','2026.11 정산'],
  result_fix:['','수주 · 직접','2026.10.1','180,000,000원 (VAT 별도)','2026.10.8 · 180,000,000원'],owner_change:['','담당자 이름'],transfer:['','2026.10.3','2026.10.20','380,000,000원 (VAT 별도)']};
 /* ── 보내기 전 확인: 칸에 적은 글을 읽어 승인되면 그대로 반영할 값으로 만든다. {err} 또는 {extra,title} ── */
 function build(code,d,f){
  const site=String(d.site||d.site_name||d.nm||'').trim(),K=known(),isRep=n=>!K.length||K.includes(n),T=(...p)=>(site+' '+p.filter(Boolean).join(' ')).trim().slice(0,120);
  if(code==='dup_lead'){
   const shares=parseShares(f[2]),sum=shares.reduce((a,x)=>a+x.ratio,0);
   if(shares.length<2||shares.some(x=>!isRep(x.name))||new Set(shares.map(x=>x.name)).size!==shares.length)return {err:'실적 나눔은 담당자 이름과 비율로 적어 주세요 (예: 황윤선 60% · 정정훈 40%).'};
   if(Math.round(sum*100)!==10000)return {err:'실적 나눔의 합이 100%여야 합니다 (지금 '+sum+'%).'};
   return {extra:{shares,target:f[3]},title:T(f[0],'동시 접촉',shares.map(x=>x.name+' '+x.ratio+'%').join(' · '))};
  }
  if(code==='strategic_win')return {extra:{},title:T(f[0])};
  if(code==='special_incentive'){
   const target=R.repN(f[0])||f[0],p=parseIncentive(f[1]),month=parseMonth(f[3]);
   if(!isRep(target))return {err:'대상자는 영업담당자 이름으로 적어 주세요.'};
   if(!p)return {err:'방식은 금액 또는 비율 중 하나로 적어 주세요 (예: 비율 1% / 금액 180만원).'};
   if(p.mode==='ratio'&&p.value>100)return {err:'비율은 100% 이하로 적어 주세요.'};
   if(!month)return {err:'지급 월을 적어 주세요 (예: 2026.11 정산).'};
   const base=wonBase(d),amount=p.mode==='amount'?p.value:(base>0?Math.round(base*p.value/100):0);
   return {extra:{target,mode:p.mode,value:String(p.value),base:base>0?String(base):'',amount:amount>0?String(amount):'',pay_month:month},title:T(target,p.mode==='ratio'?'수주실적의 +'+p.value+'%':comma(p.value)+'원',month.replace('-','.')+' 정산')};
  }
  if(code==='result_fix'){
   const r=parseResult(f[1]);if(r.err)return {err:r.err};
   const extra={to_result:r.to_result};
   if(r.to_result!=='lost'){
    const ad=parseDate(f[2]),amt=parseWon(f[3]);
    if(!ad)return {err:'낙찰일을 실제 날짜로 적어 주세요 (예: 2026.10.1).'};if(future(ad))return {err:'낙찰일은 오늘까지의 날짜여야 합니다 — 승인한 날로 대신하지 않습니다.'};
    if(!amt)return {err:'낙찰금액을 숫자로 적어 주세요 (예: 180,000,000원).'};
    extra.award_date=ad;extra.amount=String(amt);
    if(r.to_result==='won_own'){
     const cd=parseDate(f[4]),ca=parseWon(String(f[4]).replace(/\d{4}\s*[.\-\/]\s*\d{1,2}\s*[.\-\/]\s*\d{1,2}/,' '));
     if(!cd||!ca)return {err:'직접 수주는 계약일 · 계약금액을 함께 적어 주세요 (예: 2026.10.8 · 180,000,000원).'};if(future(cd))return {err:'계약일은 오늘까지의 날짜여야 합니다.'};
     extra.contract_date=cd;extra.contract_amount=String(ca);
    }
   }
   return {extra,title:T(String(f[0]).split(' · ')[0]+' → '+f[1],extra.amount?R.fmtAmt(Number(extra.amount)):'')};
  }
  if(code==='owner_change'){
   const from=R.repN(String(f[0]).replace(/\s*\(주담당\)\s*$/,''))||f[0],to=R.repN(f[1])||f[1];
   if(!isRep(to))return {err:'바꿀 귀속은 영업담당자 이름으로 적어 주세요.'};if(to===from)return {err:'바꿀 귀속이 현재 귀속과 같습니다.'};
   return {extra:{from_owner:from,to_owner:to},title:T(from+' → '+to)};
  }
  if(code==='transfer'){
   let s='none';try{const X=R.DealTransfer;s=X&&X.enabled()&&X.of(d)?X.stateOf(d):'none';}catch(e){}
   if(s==='awarded')return {err:'이미 예외 승인함에 올라가 있습니다(실적 인정 대기).'};if(s==='approved')return {err:'이미 실적이 인정된 타사 이관입니다.'};
   const td=parseDate(f[1]),ad=parseDate(f[2]),amt=parseWon(f[3]);
   if(!td)return {err:'이관일을 실제 날짜로 적어 주세요 (예: 2026.10.3).'};if(!ad)return {err:'낙찰일을 실제 날짜로 적어 주세요 (예: 2026.10.20).'};
   if(future(td)||future(ad))return {err:'이관일 · 낙찰일은 오늘까지의 날짜여야 합니다 — 승인한 날로 대신하지 않습니다.'};if(ad<td)return {err:'낙찰일은 이관일보다 앞설 수 없습니다.'};
   if(!amt)return {err:'낙찰금액을 숫자로 적어 주세요 (예: 380,000,000원 또는 3.8억).'};
   return {extra:{company:f[0],amount:String(amt),transfer_date:td,award_date:ad},title:T(f[0],comma(amt)+'원 (VAT 별도)','낙찰 '+dot(ad))};
  }
  return {extra:{},title:T(f[0],f[1])};
 }
 /* ── 창 ── */
 function open(code){
  const d=cur();if(!d||!available())return;
  try{R.DealTransfer&&R.DealTransfer.close();}catch(e){}
  st().dlg={deal:String(d.id),code:'',f:[],auto:[],why:'',file:null,uploaded:null,err:'',busy:false,sent:null,review:false};
  if(code)pick(code);else render();
 }
 function close(){st().dlg=null;document.getElementById('aq-dialog')?.remove();}
 function pick(code){const D=st().dlg,d=cur();if(!D||!d||!SPEC().types[code])return;const p=prefill(code,d);D.code=code;D.f=p.f;D.auto=p.auto;D.err='';render();}
 function render(){
  const D=st().dlg;let ov=document.getElementById('aq-dialog');if(!D){ov?.remove();return;}
  const d=cur();if(!d||String(d.id)!==D.deal){close();return;}
  if(!ov){ov=document.createElement('div');ov.id='aq-dialog';ov.className='aq-shade';document.body.append(ov);ov.addEventListener('click',onClick);ov.addEventListener('input',onInput);ov.addEventListener('change',onFile);ov.addEventListener('mousedown',e=>{if(e.target===ov&&!(st().dlg&&st().dlg.busy))close();});ov.addEventListener('keydown',e=>{if(e.key==='Escape'&&!(st().dlg&&st().dlg.busy)){e.preventDefault();e.stopPropagation();close();}});}
  const S=SPEC(),T=S.types[D.code],L=c=>AI().labelOf(c),nm=names();
  const head='<div class="aq-hd"><b>승인 요청</b><span>승인자'+(nm?'('+h(nm)+')':'')+' 승인 후 반영</span></div>';
  if(D.sent&&!D.review){
   ov.innerHTML='<section class="aq-dlg" role="dialog" aria-modal="true" aria-label="승인 요청">'+head+'<div class="aq-sent"><b>예외 승인함에 올라갔습니다</b><span>'+h(D.sent.label+' · '+(me()||'요청자')+' · 오늘')+'<br>영업건 머리에 "승인 대기" 꼬리표 · 승인 · 반려 결과는 응대 이력에 시스템 기록으로 남고 요청자에게 알림</span><button type="button" data-aq="review">다시 보기</button></div></section>';
   ov.querySelector('[data-aq="review"]')?.focus();return;
  }
  /* [다시 보기] = 보낸 내용을 그대로 다시 본다(고칠 수 없음) */
  const dis=D.busy||D.review?' disabled':'';
  let form='<p class="aq-pick">요청 종류를 먼저 골라 주세요.</p>',effect='';
  if(T){
   const fileName=D.file?D.file.name:D.uploaded?D.uploaded.file_name:'',ph=PH[D.code]||[];
   form='<div class="aq-form">'+T.fields.map((l,i)=>'<span>'+h(l)+' *</span><input data-aq-f="'+i+'" maxlength="120" value="'+attr(D.f[i]||'')+'"'+(ph[i]?' placeholder="'+attr(ph[i])+'"':'')+(D.auto[i]?' readonly class="auto"':'')+dis+'>').join('')
    +'<small class="aq-hint">'+h(S.hint||'')+'</small>'
    +'<span>근거 *</span><input data-aq-f="why" maxlength="300" value="'+attr(D.why)+'"'+dis+'>'
    +'<span>증빙 '+(T.evidence?'*':'(선택)')+'</span><div class="aq-ev"><button type="button" class="aq-file" data-aq="file"'+dis+'>'+(fileName?h(fileName):'+ 파일 첨부')+'</button><input type="file" id="aq-file" hidden></div></div>';
   effect='<span class="aq-effect">'+h(T.effect)+'</span>';
  }
  ov.innerHTML='<section class="aq-dlg" role="dialog" aria-modal="true" aria-label="승인 요청">'+head
   +'<div class="aq-body"><div class="aq-kind"><b>요청 종류 *</b><div class="aq-types">'+S.order.map(c=>'<button type="button" data-aq="type" data-v="'+attr(c)+'" aria-pressed="'+(D.code===c)+'"'+dis+'>'+h(L(c))+'</button>').join('')+'</div></div>'+form+effect
   +(D.err?'<p class="aq-err" role="alert">'+h(D.err)+'</p>':'')+'</div>'
   +'<div class="aq-ft"><button type="button" class="aq-cancel" data-aq="close"'+(D.busy?' disabled':'')+'>취소</button><button type="button" class="aq-send" data-aq="send"'+dis+'>'+(D.busy?'저장 확인 중…':D.review?'승인 대기 중':'승인 요청 보내기')+'</button></div></section>';
 }
 function onInput(e){
  const t=e.target,k=t.dataset&&t.dataset.aqF,D=st().dlg;if(k==null||!D)return;
  if(k==='why')D.why=t.value;else if(!D.auto[Number(k)])D.f[Number(k)]=t.value;
  /* 특별 인센티브: 방식 칸을 적으면 금액 · 비율 칸(자동)을 바로 계산해 보여 준다 */
  if(D.code==='special_incentive'&&k==='1'){const d=cur();D.f[2]=d?incentiveText(d,D.f[1]):'';const el=document.querySelector('#aq-dialog [data-aq-f="2"]');if(el)el.value=D.f[2];}
  if(D.err){D.err='';document.querySelector('#aq-dialog .aq-err')?.remove();}
 }
 function onFile(e){const t=e.target,D=st().dlg;if(!D||t.id!=='aq-file')return;const f=t.files&&t.files[0];if(!f)return;if(!f.size||f.size>20971520){D.err='증빙 파일은 20MB 이하만 올릴 수 있습니다.';D.file=null;}else{D.file=f;D.uploaded=null;D.err='';}render();}
 async function send(){
  const D=st().dlg,d=cur();if(!D||D.busy||D.review||!d)return;const S=SPEC(),T=S.types[D.code];
  if(!T){D.err='요청 종류를 골라 주세요.';return render();}
  const f=T.fields.map((l,i)=>String(D.f[i]||'').trim()),why=String(D.why||'').trim();
  /* 결과 수정: 실주로 바꾸면 날짜 · 금액 칸은 비워도 되고, 협약시공사 수주는 계약 칸을 비워도 된다 */
  let optional=[];if(D.code==='result_fix'){const r=parseResult(f[1]);optional=r.to_result==='lost'?[2,3,4]:r.to_result==='won_partner_tech'?[4]:[];}
  const miss=T.fields.filter((l,i)=>!f[i]&&!optional.includes(i));if(miss.length){D.err=miss.join(' · ')+'을(를) 적어 주세요.';return render();}
  if(!why){D.err='근거를 적어 주세요.';return render();}
  if(T.evidence&&!D.file&&!D.uploaded){D.err='증빙 파일을 첨부해 주세요.';return render();}
  const B=build(D.code,d,f);if(B.err){D.err=B.err;return render();}
  D.busy=true;D.err='';render();
  try{
   /* 증빙: 그 영업건 자료에 올린다(같은 파일을 두 번 올리지 않는다) */
   if(D.file&&!D.uploaded){
    if(typeof R.uploadExecAttachment!=='function')throw Error('로그인 상태에서만 파일을 올릴 수 있습니다.');
    const up=await R.uploadExecAttachment(d,D.file,'기타',['승인 요청 증빙'],AI().labelOf(D.code)+' 승인 요청 증빙');
    D.uploaded={attachment_id:String(up&&(up.id||up.attachment_id)||''),file_name:D.file.name};D.file=null;
   }
   const payload=Object.assign({fields:T.fields.map((l,i)=>({l,v:f[i],auto:!!D.auto[i]})),evidence:D.uploaded||null},B.extra||{});
   const r=await R.OpsStore.rpc(AI().RPC.request,{type:D.code,deal_id:String(d.id),title:B.title,reason:why,payload});
   AI().take(r.request);D.busy=false;D.sent={label:AI().labelOf(D.code)};render();
  }catch(e){D.busy=false;D.err='보내지 못했습니다: '+String(e&&e.message||e);render();return;}
  try{decorate();}catch(e){}try{if(R.G.page==='approvals')AI().render();}catch(e){}
 }
 function onClick(e){
  const b=e.target.closest('[data-aq]');if(!b||b.disabled)return;const a=b.dataset.aq,D=st().dlg;if(!D)return;
  if(a==='close')return close();
  if(a==='type')return pick(b.dataset.v);
  if(a==='file'){document.getElementById('aq-file')?.click();return;}
  if(a==='review'){D.review=true;return render();}
  if(a==='send')return send();
 }
 /* ── 상세: 머리 꼬리표(승인 대기 · 종류 / 승인 완료 · 종류 · 승인자) + 응대 이력의 시스템 기록 ── */
 function decorate(){
  const v=document.getElementById('detailView'),d=cur();if(!v)return;
  v.querySelectorAll('.aq-tag').forEach(n=>n.remove());
  if(!enabled()||!d)return;
  v.querySelectorAll('.idv-thread>.idv-msg').forEach(m=>{const b=m.querySelector('.idv-bubble');if(!b||m.dataset.aq)return;if(!/^\s*\[승인 요청 · /.test(b.textContent))return;m.dataset.aq='1';m.classList.add('aq-ev');const k=m.querySelector('.idv-meta .dv3-kind');if(k)k.textContent='시스템';});
  const chips=v.querySelector('.ddv-chips');
  if(chips){
   const L=AI().forDeal(d.id),brand=chips.querySelector('.idv-brand');let at=brand;
   L.filter(x=>x.state==='pending').concat(L.filter(x=>x.state==='approved')).forEach(x=>{const el=document.createElement('span');el.className='aq-tag '+(x.state==='pending'?'wait':'ok');el.textContent=x.state==='pending'?'승인 대기 · '+AI().labelOf(x.code):'승인 완료 · '+AI().labelOf(x.code)+(x.by?' · '+x.by:'');el.title=x.title;if(at)at.after(el);else chips.prepend(el);at=el;});
  }
  /* 아직 안 읽었으면 한 번 읽고 다시 붙인다 */
  AI().ensure().then(changed=>{if(changed&&cur()&&String(cur().id)===String(d.id)){try{decorate();}catch(e){}}}).catch(()=>{});
 }
 root.ApprovalRequest={enabled,available,open,close,decorate,prefill,build,parseWon,parseDate,parseResult,parseShares,parseIncentive,parseMonth,state:st};
})(window);
