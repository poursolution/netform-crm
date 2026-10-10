/* 타사 이관 (2026-10-04 디자인 핸드오프 'design_handoff_transfer' · 운영 기준 4단계)
   타사 이관은 영업단계가 아니라 처리 방식(상태값) — 단계는 그대로 두고 상태만 붙인다. 새 단계를 만들지 않는다.
   흐름: 상세 [··· 기타 처리] → 타사 이관 등록(담당자) → 낙찰결과 대기 → 낙찰결과 등록(담당자) → 실적 인정(예외 승인자 중 한 사람) → 수주실적 · 메이드율 반영.
   실적 금액 = 최종 낙찰금액(VAT 별도) 전액. 사전 정식 보고 + 승인자 인정 건만 수주실적 · 메이드율에 들어간다(대기 · 제외 건은 계산에서 빠진다).
   저장은 서버 함수(crm_deal_transfer_*_v1 — sql/deal-transfer-v1-20261004.sql)가 확인한 뒤에만 화면에 반영한다. 영업건의 단계 · 담당 · 계약실적 원장은 건드리지 않는다.
   서버가 준 한 줄을 영업건의 transfer 로 붙여 두면 CRMRules.transferOf · dealResult 가 읽는다. 끄기: G.dealTransferOff=true */
(function(root){
 'use strict';
 const R=root,h=v=>R.esc(String(v==null?'':v)),attr=v=>R.escAttr(String(v==null?'':v));
 const RPC={list:'crm_deal_transfer_list_v1',reg:'crm_deal_transfer_register_v1',award:'crm_deal_transfer_award_v1',approve:'crm_deal_transfer_approve_v1'};
 let rows=null,map=new Map(),busy=false,warmed='';
 function st(){const g=R.G;if(!g.dealTransfer)g.dealTransfer={menu:false,dlg:null};return g.dealTransfer;}
 const enabled=()=>!R.G.dealTransferOff&&!!R.OpsStore&&!!R.CRMRules;
 const available=()=>enabled()&&R.OpsStore.has(RPC.list);
 const admin=()=>{try{return !!R.todayIsAdmin();}catch(e){return false;}};
 /* 실적 인정 = 예외 승인자(운영 기준 · 기본 이승우 · 황윤선) 중 한 사람. 본인 건은 다른 승인자가(서버도 같은 규칙) */
 const approverNames=()=>{try{return R.CRMRules.approvers().join(' · ');}catch(e){return '';}};
 const canApprove=d=>{try{if(!R.CRMRules.isApprover(R.ME&&R.ME.name))return false;const t=of(d),n=R.repN(R.ME&&R.ME.name);return !(t&&n&&(R.repN(t.performance_owner)===n||R.repN(t.created_by_name)===n));}catch(e){return false;}};
 const toast=m=>{if(typeof R.toast==='function')R.toast(m);};
 const pad=n=>String(n).padStart(2,'0'),todayKey=()=>{const d=new Date();return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());};
 const dot=k=>{const m=/^(\d{4})-(\d{2})-(\d{2})/.exec(String(k||''));return m?m[1]+'.'+Number(m[2])+'.'+Number(m[3]):'';};
 const won=n=>Number(n)>0?R.fmtAmt(Number(n)):'0원';
 const comma=n=>Number(n||0).toLocaleString('ko-KR');
 /* ── 자료 ── */
 function attach(){const D=R.B&&R.B.deals||[];D.forEach(d=>{const t=map.get(String(d.id));if(t)d.transfer=t;else if(d.transfer)delete d.transfer;});}
 function take(list){rows=Array.isArray(list)?list:[];map=new Map(rows.map(r=>[String(r.deal_id),r]));attach();}
 function put(row,dealId){if(row)map.set(String(row.deal_id),row);else map.delete(String(dealId));rows=[...map.values()];attach();}
 async function load(){if(!available()||busy)return rows||[];busy=true;try{take((await R.OpsStore.rpc(RPC.list,{})).rows);}catch(e){rows=rows||[];}finally{busy=false;}return rows;}
 function warm(){const me=R.ME&&String(R.ME.id||R.ME.name||'');if(!me||warmed===me||!available())return;warmed=me;load().then(()=>{if(rows&&rows.length){try{R.paint();}catch(e){}}});}
 const of=d=>d&&map.get(String(d.id))||null;
 const stateOf=d=>{attach();return R.CRMRules.transferOf(d).status;};
 const dealOf=id=>((R.DashboardData&&R.DashboardData.active()?R.DashboardData.source():R.B)?.deals||[]).find(d=>String(d.id)===String(id))||null;
 /* 이관 뒤 기준 일수(운영 기준 · 기본 14일)가 지나면 '타사 이관 결과 확인'이 오늘 업무에 뜬다 */
 function checkDue(d){const t=of(d);if(!t||stateOf(d)!=='pending')return false;return R.CRMRules.miss.transferCheck(String(t.transfer_date).slice(0,10)+'T00:00:00');}
 const awaiting=d=>!!of(d)&&stateOf(d)==='awarded';
 /* 집계(주간 브리핑 · 대시보드 · 리포트가 같이 쓴다): 인정된 타사 이관 수주만, 낙찰일 기준. 귀속 = 이관 전 담당자 */
 function scoped(t,owner){if(owner&&R.repN(t.performance_owner)!==owner)return false;const b=R.G.brand;if(b&&b!=='전체'){const d=dealOf(t.deal_id);if(!d||d.brand!==b)return false;}return true;}
 const inR=(k,a,b)=>{k=String(k||'').slice(0,10);return !!k&&k>=a&&k<b;};
 function wonIn(a,b,owner){
  const list=(rows||[]).filter(t=>t.transfer_status==='transferred'&&t.award_result==='transferred_won'&&t.incentive_eligible===true&&inR(t.award_date,a,b)&&scoped(t,owner));
  return {count:list.length,amount:list.reduce((s,t)=>s+(Number(t.award_amount)||0),0),list:list.map(t=>{const d=dealOf(t.deal_id);return {t,d,owner:R.repN(t.performance_owner),site:d&&d.site||'현장명 미확인',brand:d&&d.brand||'',amount:Number(t.award_amount)||0};})};
 }
 /* 타사 이관 뒤 실주(낙찰 실패) — 파이프라인에서 이미 실주로 닫힌 건은 거기서 세므로 뺀다 */
 function lostIn(a,b,owner){return (rows||[]).filter(t=>{if(t.transfer_status!=='transferred'||t.award_result!=='lost'||!inR(t.award_date,a,b)||!scoped(t,owner))return false;const d=dealOf(t.deal_id);let o='open';try{o=d?R.outcomeOf(d):'open';}catch(e){}return !['lost','nocontact','closed'].includes(o);}).length;}
 const pendingList=owner=>(rows||[]).filter(t=>t.transfer_status==='transferred'&&(t.award_result==='pending'||(t.award_result==='transferred_won'&&!t.incentive_eligible&&!t.rejected_reason))&&scoped(t,owner));
 /* ── 꼬리표 ── */
 const BADGE={pending:['타사 이관 · 낙찰결과 대기','#c0392b','#fdeceb'],awarded:['타사 이관 수주 · 실적 인정 대기','#1d3f99','#eef3fe'],approved:['타사 이관 수주','#1f7a4d','#e8f6ee'],rejected:['타사 이관 수주 · 실적 제외','#6b7280','#f3f4f6'],lost:['타사 이관 · 실주','#b42318','#fdecec'],cancelled:['타사 이관 · 입찰 취소 · 보류','#6b7280','#f3f4f6']};
 function badgeOf(d){const s=stateOf(d),b=BADGE[s];if(!b)return null;const t=of(d);return [s==='approved'?'타사 이관 수주 · '+won(t.award_amount)+' 반영':b[0],b[1],b[2]];}
 function tag(d){if(!enabled()||!d)return '';const b=badgeOf(d);return b?'<span class="tf-tag" style="color:'+b[1]+';background:'+b[2]+'">'+h(b[0])+'</span>':'';}
 /* ── 상세: [··· 기타 처리] 메뉴 · 상태 꼬리표 · 이관 정보 상자 ── */
 function cur(){const c=R.CUR_DETAIL;return c&&c.kind==='deal'&&c.item?c.item:null;}
 function nowOf(d){
  const t=of(d),s=stateOf(d),own=R.repN(t.performance_owner)||'담당자',can=canEdit(d);
  if(s==='pending')return ['타사 이관 결과 확인',t.transfer_company+' 낙찰 여부를 확인하고 결과를 등록하세요.',can?['award','낙찰결과 등록']:null];
  if(s==='awarded')return ['승인자 실적 인정 대기','승인자('+approverNames()+') 확인 후 실적에 반영됩니다 · '+won(t.award_amount)+' (VAT 별도)',canApprove(d)?['approve','실적 인정']:null];
  if(s==='approved')return ['완료 · 수주실적 반영',own+' 실적 '+won(t.award_amount)+' · 주간 브리핑 · 대시보드에 반영됨'+(t.approved_by_name?' · '+R.repN(t.approved_by_name)+' 승인 완료'+(t.approved_at?' '+dot(String(t.approved_at).slice(0,10)):''):''),null];
  if(s==='rejected')return ['실적 제외','제외 사유: '+t.rejected_reason,can?['award','낙찰결과 고치기']:null];
  if(s==='lost')return ['타사 이관 실주','타사도 낙찰하지 못했습니다'+(t.award_note?' — '+t.award_note:'')+'. 실적은 0입니다.',['lost','실주 처리']];
  return ['입찰 취소 · 보류','실적 없이 보류 상태입니다'+(t.award_note?' — '+t.award_note:''),can?['award','낙찰결과 다시 등록']:null];
 }
 const canEdit=d=>admin()||R.repN(d.assignee)===R.repN(R.ME&&R.ME.name)||(of(d)&&R.repN(of(d).performance_owner)===R.repN(R.ME&&R.ME.name));
 function cardHtml(d){
  const t=of(d),s=stateOf(d),n=nowOf(d),due=checkDue(d),days=R.CRMRules.get('transfer_result_check_days');
  return '<div class="tf-box"><span>이관 업체</span><b>'+h(t.transfer_company)+'</b><span>이관 사유</span><span>'+h(t.transfer_reason+' · '+dot(t.transfer_date)+' 이관')+'</span><span>사전 보고</span><span class="'+(t.transfer_reported?'':'red')+'">'+h(t.transfer_reported?'보고 완료'+(t.transfer_reported_at?' ('+dot(t.transfer_reported_at)+')':''):'미보고 — 인센티브 실적 인정 안 됨')+(t.transfer_memo?h(' · '+t.transfer_memo):'')+'</span><span>원 담당자</span><span>'+h((R.repN(t.performance_owner)||'미확인')+' · 실적 귀속')+'</span>'
   +(t.award_result==='transferred_won'?'<span>낙찰</span><b>'+h(t.award_company+' · '+dot(t.award_date)+' · '+won(t.award_amount)+' (VAT 별도)')+'</b>':'')+'</div>'
   +'<div class="tf-now"><b>'+h(n[0])+'</b><span>'+h(n[1])+'</span>'+(n[2]?'<button type="button" data-tf="'+n[2][0]+'">'+h(n[2][1])+'</button>':'')+'</div>'
   +(due?'<div class="tf-due"><span>오늘 업무에 뜸 · 이관 후 '+days+'일 지남</span><b>타사 이관 결과 확인 — '+h(String(d.site||'').replace(/^\s*\[[^\]]*\]\s*/,''))+' · '+h(t.transfer_company)+'</b><small>낙찰 공고가 나왔는지 확인하고 결과를 등록하세요</small></div>':'')
   +'<p class="tf-note">타사 이관은 새 영업단계가 아니라 처리 방식입니다. 단계는 그대로 두고 상태만 붙습니다.</p>';
 }
 function decorate(){
  const head=document.querySelector('.dv3-headact'),d=cur();
  document.getElementById('tf-card')?.remove();
  if(!enabled()||!head||!d){if(head)head.classList.remove('tf-on');return;}
  attach();
  const S=st(),t=of(d),ready=available();
  head.classList.add('tf-on');
  let wrap=head.querySelector('.tf-morewrap');if(!wrap){wrap=document.createElement('div');wrap.className='tf-morewrap';head.append(wrap);}
  /* [··· 기타 처리]: 담당자 변경 · 타사 이관 등록 · 승인 요청 · 보류 · 실주 처리. [3] = 서버 준비 여부(없으면 늘 켜짐) */
  const aq=R.ApprovalRequest&&R.ApprovalRequest.enabled()?R.ApprovalRequest:null;
   /* 영업건 상세 정돈안(2026-10-06): 버튼은 [···] 하나, 즐겨찾기 · 소장이 바뀌었어요도 이 메뉴에서 */
   const V3=R.DealDetailV3,T=!!(V3&&V3.tidy&&V3.tidy()),fv=T?document.querySelector('#detailView .exec-favorite'):null;
   const pm=(()=>{try{return V3&&V3.panelMenu?V3.panelMenu(d).map(x=>['p7-'+x[0],x[1]]):[];}catch(e){return [];}})();/* 오른쪽 정리: 오른쪽에서 뺀 상자는 이 메뉴에서 가운데 칸으로 연다 */
   const items=pm.concat(T?[].concat(fv?[['fav',String(fv.textContent||'즐겨찾기').trim()]]:[],V3.canReplace&&V3.canReplace(d)?[['repl','소장이 바뀌었어요']]:[]):[]).concat([['owner','담당자 변경'],[t?'info':'reg',t?'타사 이관 정보':'타사 이관 등록',true,ready]],aq?[['approval','승인 요청',false,aq.available()]]:[],[['hold','보류'],['lost','실주 처리']],R.DealDiscard&&R.DealDiscard.can&&R.DealDiscard.can(d)?[['discard','휴지통으로 보내기']]:[]/* 예전 시스템에서 옮겨 온 열린 건만(deal-discard.js) · 30일 보관 뒤 삭제 */);
   wrap.innerHTML='<button type="button" class="tf-more" data-tf="menu" aria-haspopup="menu" aria-expanded="'+!!S.menu+'"'+(T?' aria-label="기타 처리" title="즐겨찾기 · 소장 바뀜 · 담당 변경 · 실주 처리"':'')+'>'+(T?'···':'··· 기타 처리')+'</button>'+(S.menu?'<div class="tf-menu" role="menu">'+items.map(m=>{const off=m.length>3&&!m[3];return '<button type="button" role="menuitem" data-tf="m-'+m[0]+'" class="'+(m[2]?'hot':'')+'"'+(off?' disabled title="서버 적용 뒤에 쓸 수 있습니다"':'')+'>'+h(m[1])+(off?' <small>서버 적용 대기</small>':'')+'</button>';}).join('')+'</div>':'');
  /* 상태 꼬리표: 단계 칩 옆 */
  const row=head.parentElement;row?.querySelectorAll('.tf-badge').forEach(n=>n.remove());
  const b=t?badgeOf(d):null,chip=row&&row.querySelector('.dv3-stagebadge');
  if(b&&chip){const el=document.createElement('span');el.className='tf-badge';el.style.cssText='color:'+b[1]+';background:'+b[2];el.textContent=b[0];chip.after(el);}
  /* 이관 정보 상자: 오른쪽 '지금 할 일' 위 */
  if(t){const nowCard=document.getElementById('nowCard'),right=nowCard?nowCard.parentElement:document.querySelector('.dw-right');if(right){const card=document.createElement('section');card.id='tf-card';card.className='tf-card';card.innerHTML=cardHtml(d);if(nowCard)nowCard.before(card);else right.prepend(card);}}
 }
 /* ── 창(등록 · 낙찰결과 · 실적 인정) ── */
 const chipB=(k,v,l,on)=>'<button type="button" class="tf-chip'+(on?' on':'')+'" data-tf="pick" data-k="'+k+'" data-v="'+attr(v)+'" aria-pressed="'+!!on+'">'+h(l)+'</button>';
 function openDlg(mode,pre){
  const d=(pre&&pre.dealId&&dealOf(pre.dealId))||cur();if(!d||!available())return;const t=of(d),S=st();S.menu=false;
  if(mode==='reg')S.dlg={mode,deal:String(d.id),f:{company:t?t.transfer_company:'',reason:t?t.transfer_reason:'',date:t?String(t.transfer_date).slice(0,10):todayKey(),reported:t?!!t.transfer_reported:null,reported_at:t&&t.transfer_reported_at?String(t.transfer_reported_at).slice(0,10):'',memo:t&&t.transfer_memo||'',expected:t&&t.expected_amount?String(Math.round(Number(t.expected_amount))):''},err:'',busy:false};
  else if(mode==='award')S.dlg={mode,deal:String(d.id),f:{result:t&&t.award_result!=='pending'?t.award_result:'transferred_won',company:t&&t.award_company||t.transfer_company,date:t&&t.award_date?String(t.award_date).slice(0,10):todayKey(),amount:t&&t.award_amount?String(Math.round(Number(t.award_amount))):'',evidence:t&&t.award_evidence||'',note:t&&t.award_note||''},err:'',busy:false};
  else if(mode==='approve')S.dlg={mode,deal:String(d.id),f:{c:[false,false,false],rej:false,reason:''},err:'',busy:false};
  else S.dlg={mode:'info',deal:String(d.id),f:{},err:'',busy:false};
  /* 수주 처리 창에서 넘어올 때: 적어 둔 낙찰 업체 · 금액 · 낙찰일을 미리 채운다 */
  /* 예외 승인함의 [반려]: 제외 사유 입력부터 */
  if(mode==='approve'&&pre&&pre.reject)S.dlg.f.rej=true;
  if((mode==='award'||mode==='reg')&&pre&&typeof pre==='object')Object.keys(pre).forEach(k=>{if(Object.prototype.hasOwnProperty.call(S.dlg.f,k)&&pre[k]!==undefined&&pre[k]!==null&&pre[k]!=='')S.dlg.f[k]=pre[k];});
  renderDlg();decorate();
 }
 function closeDlg(){st().dlg=null;document.getElementById('tf-dialog')?.remove();}
 function renderDlg(){
  const S=st(),D=S.dlg;let ov=document.getElementById('tf-dialog');if(!D){ov?.remove();return;}
  const d=dealOf(D.deal);if(!d){closeDlg();return;}const t=of(d),f=D.f,own=R.repN(t?t.performance_owner:d.assignee)||'미배정';
  if(!ov){ov=document.createElement('div');ov.id='tf-dialog';ov.className='tf-shade';document.body.append(ov);ov.addEventListener('click',onDlgClick);ov.addEventListener('input',onDlgInput);ov.addEventListener('mousedown',e=>{if(e.target===ov)closeDlg();});ov.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();closeDlg();}});}
  let title='',who='',body='',foot='';
  if(D.mode==='reg'){
   title='타사 이관 등록';who='담당자 · 기타 처리 → 타사 이관 등록';
   body='<div class="tf-form"><label>이관 업체 *</label><input data-tf-f="company" maxlength="80" value="'+attr(f.company)+'" placeholder="예: 코지건설">'
    +'<label>이관 사유 *</label><div class="tf-chips">'+R.CRMRules.reasons('transfer').map(l=>chipB('reason',l,l,f.reason===l)).join('')+'</div>'
    +'<label>원 담당자</label><span>'+h(own)+' <small>자동 · 실적 귀속</small></span>'
    +'<label>이관일 *</label><input type="date" data-tf-f="date" value="'+attr(f.date)+'">'
    +'<label>사전 보고 *</label><div class="tf-two">'+chipB('reported','1','보고 완료',f.reported===true)+chipB('reported','0','미보고',f.reported===false)+(f.reported===true?'<input type="date" data-tf-f="reported_at" value="'+attr(f.reported_at)+'" aria-label="보고일">':'')+'</div>'
    +'<label>보고 · 메모</label><input data-tf-f="memo" maxlength="300" value="'+attr(f.memo)+'" placeholder="예: 10.2 팀장 협의 후 이관">'
    +'<label class="opt">예상 공사금액</label><div class="tf-amt"><input data-tf-f="expected" inputmode="numeric" value="'+attr(f.expected?comma(f.expected):'')+'" placeholder="선택 · 실적에 안 잡힘"><span>원</span></div></div>'
    +(f.reported===false?'<div class="tf-warn">미보고 이관은 등록은 되지만 인센티브 실적으로 인정되지 않습니다. 회의 기준: 사전 정식 보고 건만 인정.</div>':'');
   foot='<span>등록하면 상태가 \'타사 이관 · 낙찰결과 대기\'가 되고 파이프라인에 남습니다</span>'+(t&&t.award_result==='pending'?'<button type="button" class="ghost" data-tf="unreg"'+(D.busy?' disabled':'')+'>등록 거두기</button>':'')+'<button type="button" class="dark" data-tf="save-reg"'+(D.busy?' disabled':'')+'>'+(D.busy?'저장 중…':t?'이관 정보 저장':'이관 등록')+'</button>';
  }else if(D.mode==='award'){
   const res=f.result,isWon=res==='transferred_won';
   title='낙찰결과 등록';who='담당자 · 낙찰 공고 확인 후';
   body='<div class="tf-form"><label>결과 *</label><div class="tf-chips sq">'+chipB('result','transferred_won','타사 이관 수주',isWon)+chipB('result','lost','실주',res==='lost')+chipB('result','cancelled','입찰 취소 · 보류',res==='cancelled')+'</div>'
    +(isWon?'<label>낙찰 업체 *</label><input data-tf-f="company" maxlength="80" value="'+attr(f.company)+'"><label>낙찰일 *</label><input type="date" data-tf-f="date" value="'+attr(f.date)+'"><label>낙찰금액 *</label><div class="tf-amt big"><input data-tf-f="amount" inputmode="numeric" value="'+attr(f.amount?comma(f.amount):'')+'" placeholder="0"><span>원 · VAT 별도</span></div><label>실적 귀속</label><span>'+h(own)+' <small>이관 전 담당자 자동</small></span><label>증빙 *</label><input class="dash" data-tf-f="evidence" maxlength="300" value="'+attr(f.evidence)+'" placeholder="낙찰공고 · 결과자료 (자료에 첨부한 파일 이름 · 공고 번호)">'
     :res==='lost'?'<label>실주 사유 *</label><input data-tf-f="note" maxlength="300" value="'+attr(f.note)+'" placeholder="예: 타사도 낙찰 실패 · 최저가 업체 선정">'
     :'<label>메모</label><input data-tf-f="note" maxlength="300" value="'+attr(f.note)+'" placeholder="예: 입찰 취소 · 내년으로 연기">')+'</div>'
    +'<div class="tf-info">'+h(isWon?'실적 금액은 낙찰금액'+(Number(f.amount)>0?' '+comma(f.amount)+'원':'')+' 그대로 생성됩니다. 기술자문료 · 타사 마진 · 회사 입금액은 실적 금액을 바꾸지 않습니다.':res==='lost'?'타사도 낙찰하지 못했다면 실주로 닫고 실적은 0입니다. 실주 사유를 남겨 주세요.':'입찰이 취소되거나 공사가 보류되면 실적 없이 보류 상태로 둡니다.')+'</div>';
   foot='<span></span><button type="button" class="dark" data-tf="save-award"'+(D.busy?' disabled':'')+'>'+(D.busy?'저장 중…':isWon?'실적 확정 요청':'결과 저장')+'</button>';
  }else if(D.mode==='approve'){
   const CK=[['사전 보고 확인',t.transfer_reported?(t.transfer_reported_at?dot(t.transfer_reported_at)+' ':'')+(t.transfer_memo||'보고 완료'):'미보고 — 인정할 수 없음'],['낙찰결과 확인',t.award_evidence||'증빙 없음'],['낙찰금액 확인',comma(t.award_amount)+'원 · VAT 별도']],all=f.c.every(Boolean)&&t.transfer_reported;
   title='실적 인정';who='승인자 '+approverNames()+' 중 한 사람';
   body='<div class="tf-approve"><div class="amt"><b>'+h(won(t.award_amount))+'</b><span>타사 이관 수주 · '+h(own)+' · 실적 반영 대기</span></div><div class="cks">'+CK.map((c,i)=>'<button type="button" class="'+(f.c[i]?'on':'')+'" data-tf="ck" data-v="'+i+'" aria-pressed="'+!!f.c[i]+'"'+(i===0&&!t.transfer_reported?' disabled':'')+'><i>'+(f.c[i]?'✓':'')+'</i><b>'+c[0]+'</b><span>'+h(c[1])+'</span></button>').join('')+'</div>'
    +(f.rej?'<input data-tf-f="reason" maxlength="300" value="'+attr(f.reason)+'" placeholder="제외 사유 (필수) — 예: 사전 보고 없음 · 단순 중복">':'')+'<small>등록은 담당자가, 인정은 승인자('+h(approverNames())+')가 합니다. 본인 건은 다른 승인자가 처리합니다.</small></div>';
   foot='<span></span><button type="button" class="ghost" data-tf="reject"'+(D.busy?' disabled':'')+'>'+(f.rej?'제외 확정':'제외 (사유 입력)')+'</button><button type="button" class="dark" data-tf="approve-ok"'+(all&&!D.busy?'':' disabled')+'>실적 인정</button>';
  }else{
   const s=stateOf(d),b=badgeOf(d);
   title='타사 이관 · '+(s==='pending'?'낙찰결과 대기':s==='awarded'?'실적 인정 대기':s==='approved'?'실적 반영':s==='lost'?'실주':s==='rejected'?'실적 제외':'보류');who=s==='pending'?'등록 직후 상태':'';
   body='<div class="tf-wait"><div><em style="color:'+b[1]+';background:'+b[2]+'">'+h(b[0])+'</em><span>'+h(dot(t.transfer_date)+' 이관 · '+t.transfer_company)+'</span></div>'
    +(s==='pending'?'<p>실주로 닫지 않습니다. 낙찰 여부를 끝까지 추적해야 하므로 파이프라인과 담당자 \'오늘 업무\'에 그대로 남습니다.</p><div class="three"><div><span>개인 실적</span><b>0원</b><span>아직 없음</span></div><div><span>메이드율</span><b>계산 제외</b><span>진행 중 취급</span></div><div><span>예상금액</span><b>참고만</b><span>실적 아님</span></div></div>':'<p>'+h(nowOf(d)[1])+'</p>')+'</div>';
   foot='<span></span>'+(s==='pending'&&canEdit(d)?'<button type="button" class="ghost" data-tf="edit-reg">이관 정보 고치기</button><button type="button" class="dark" data-tf="award">낙찰결과 등록</button>':s==='awarded'&&canApprove(d)?'<button type="button" class="dark" data-tf="approve">실적 인정</button>':'<button type="button" class="dark" data-tf="close">닫기</button>');
  }
  ov.innerHTML='<section class="tf-dlg" role="dialog" aria-modal="true" aria-label="'+attr(title)+'"><header><b>'+h(title)+'</b><span>'+h(who)+'</span><i></i><button type="button" class="x" data-tf="close" aria-label="닫기">✕</button></header>'+body+(D.err?'<div class="tf-err">'+h(D.err)+'</div>':'')+'<footer>'+foot+'</footer></section>';
 }
 const digits=v=>String(v||'').replace(/[^\d]/g,'');
 function onDlgInput(e){const el=e.target,k=el.dataset&&el.dataset.tfF,D=st().dlg;if(!k||!D)return;if(k==='amount'||k==='expected'){const n=digits(el.value);D.f[k]=n;const shown=n?comma(n):'';if(el.value!==shown)el.value=shown;if(k==='amount'){const info=document.querySelector('#tf-dialog .tf-info');if(info)info.textContent='실적 금액은 낙찰금액'+(Number(n)>0?' '+comma(n)+'원':'')+' 그대로 생성됩니다. 기술자문료 · 타사 마진 · 회사 입금액은 실적 금액을 바꾸지 않습니다.';}}else D.f[k]=el.value;}
 async function send(name,payload,done){
  const D=st().dlg;if(!D||D.busy)return;D.busy=true;D.err='';renderDlg();
  try{const r=await R.OpsStore.rpc(name,payload);put(r.transfer||null,payload.deal_id);D.busy=false;done(r);}
  catch(e){D.busy=false;D.err='저장하지 못했습니다: '+(e.message||e);renderDlg();return;}
  try{R.paint();}catch(e){}try{R.DealDetailV3&&R.DealDetailV3.apply();}catch(e){}
 }
 function onDlgClick(e){
  const b=e.target.closest('[data-tf]');if(!b||b.disabled)return;const a=b.dataset.tf,D=st().dlg;if(!D)return;const f=D.f,id=D.deal;
  if(a==='close')return closeDlg();
  if(a==='pick'){const k=b.dataset.k,v=b.dataset.v;f[k]=k==='reported'?v==='1':v;D.err='';return renderDlg();}
  if(a==='ck'){const i=Number(b.dataset.v);f.c[i]=!f.c[i];return renderDlg();}
  if(a==='award'||a==='approve')return openDlg(a);
  if(a==='edit-reg')return openDlg('reg');
  if(a==='save-reg'){
   if(!String(f.company).trim()){D.err='이관 업체를 적어 주세요.';return renderDlg();}if(!f.reason){D.err='이관 사유를 골라 주세요.';return renderDlg();}if(!f.date){D.err='이관일을 넣어 주세요.';return renderDlg();}if(f.reported===null){D.err='사전 보고 여부를 골라 주세요.';return renderDlg();}
   return send(RPC.reg,{deal_id:id,company:String(f.company).trim(),reason:f.reason,date:f.date,reported:f.reported===true,reported_at:f.reported&&f.reported_at?f.reported_at:'',memo:String(f.memo||'').trim(),expected_amount:f.expected||''},()=>{toast('타사 이관을 등록했습니다 — 낙찰결과 대기');openDlg('info');});
  }
  if(a==='unreg'){if(!D.confirm){D.confirm=true;D.err='등록을 거두면 이관 정보가 사라집니다. 한 번 더 누르면 거둡니다.';return renderDlg();}return send(RPC.reg,{deal_id:id,cancel:true},()=>{toast('타사 이관 등록을 거뒀습니다');closeDlg();});}
  if(a==='save-award'){
   const res=f.result;
   if(res==='transferred_won'){if(!String(f.company).trim()){D.err='낙찰 업체를 적어 주세요.';return renderDlg();}if(!f.date){D.err='낙찰일을 넣어 주세요.';return renderDlg();}if(!(Number(f.amount)>0)){D.err='낙찰금액(VAT 별도)을 넣어 주세요.';return renderDlg();}if(!String(f.evidence).trim()){D.err='증빙(낙찰공고 · 결과자료)을 적어 주세요.';return renderDlg();}
    return send(RPC.award,{deal_id:id,result:res,company:String(f.company).trim(),date:f.date,amount:Number(f.amount),evidence:String(f.evidence).trim()},()=>{toast('낙찰결과를 등록했습니다 — 승인자 실적 인정 대기(예외 승인함)');closeDlg();});}
   if(res==='lost'&&!String(f.note).trim()){D.err='실주 사유를 적어 주세요.';return renderDlg();}
   return send(RPC.award,{deal_id:id,result:res,note:String(f.note||'').trim()},()=>{toast(res==='lost'?'타사 이관 실주로 저장했습니다 — 실적 0':'입찰 취소 · 보류로 저장했습니다');closeDlg();});
  }
  if(a==='approve-ok')return send(RPC.approve,{deal_id:id,decision:'approve',checks:{reported:f.c[0],result:f.c[1],amount:f.c[2]}},r=>{toast((R.repN(r.transfer.approved_by_name)||'승인자')+' 승인 완료 — 수주실적 '+won(r.transfer.award_amount)+' 반영');closeDlg();});
  if(a==='reject'){if(!f.rej){f.rej=true;return renderDlg();}if(!String(f.reason).trim()){D.err='제외 사유를 적어 주세요.';return renderDlg();}return send(RPC.approve,{deal_id:id,decision:'reject',reason:String(f.reason).trim()},()=>{toast('실적에서 제외했습니다');closeDlg();});}
 }
 /* 상세 안의 버튼 · 메뉴 */
 document.addEventListener('click',e=>{
  if(!enabled())return;const b=e.target.closest('[data-tf]'),S=st();
  if(!b||b.closest('#tf-dialog')){if(S.menu&&!e.target.closest('.tf-morewrap')){S.menu=false;decorate();}return;}
  const a=b.dataset.tf,d=cur();if(!d||b.disabled)return;
  if(a==='menu'){S.menu=!S.menu;return decorate();}
  S.menu=false;
  if(a==='m-discard'){decorate();try{R.DealDiscard.ask(d);}catch(err){}return;}
  if(a.indexOf('m-p7-')===0){decorate();try{R.DealDetailV3.openPanel(a.slice(5));}catch(err){}return;}
  if(a==='m-fav'){decorate();document.querySelector('#detailView .exec-favorite')?.click();return;}
  if(a==='m-repl'){decorate();try{R.DealDetailV3.replace();}catch(err){}return;}
  if(a==='m-owner'){decorate();document.querySelector('.dv3-headact [data-dv3="owner"]')?.click();return;}
  if(a==='m-hold'||a==='m-lost'||a==='lost'){decorate();try{R.StageTransitionUI.open(d,false,a==='m-hold'?'waiting':'lost');}catch(err){}return;}
  if(a==='m-approval'){decorate();try{R.ApprovalRequest&&R.ApprovalRequest.open();}catch(err){}return;}
  if(a==='m-reg')return openDlg('reg');
  if(a==='m-info')return openDlg('info');
  if(a==='award'||a==='approve')return openDlg(a);
 });
 /* 목록 꼬리표: 현장명 옆 배지 자리(기술자문 배지와 같은 자리) */
 const ab=R.advisoryBadge;R.advisoryBadge=function(d){let s='';try{s=typeof ab==='function'?ab.apply(this,arguments)||'':'';}catch(e){}return s+tag(d);};
 const basePaint=R.paint;if(typeof basePaint==='function')R.paint=function(){try{attach();}catch(e){}const r=basePaint.apply(this,arguments);try{warm();}catch(e){}return r;};
 root.DealTransfer={enabled,available,load,rows:()=>rows||[],of,stateOf,checkDue,awaiting,wonIn,lostIn,pendingList,tag,decorate,open:openDlg,close:closeDlg,RPC,_take:take};
})(window);
