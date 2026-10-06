/* 이 단지 영업 이력 (2026-10-05 design_handoff_site_history · 시안 '같은 현장 다른 영업 v2.dc.html')
   영업건 상세 왼쪽 '같은 현장 다른 영업' 칸을 바꾼다 — 다른 칸 · 화면은 건드리지 않는다.
   보기: 제목 "이 단지 영업 이력 n건" + [+ 이력 추가] · 요약(누적 수주 = 수주 줄 금액 합 · 건수 / 진행 중 건수 — 저장하면 다시 계산)
        세로 타임라인(최신 → 과거) · 지금 보는 건이 맨 위 · 검은 점 · '지금 보는 건 · 결과' 꼬리표 · 줄 = 공종(굵게) + 결과 꼬리표 / 날짜 · 금액(없으면 '금액 미정') · 담당 / 설명 한 줄
        지난 건(CRM 영업건)을 누르면 그 영업건 상세 · 아래 AI 한 줄(지난 이력으로 이번 통화에서 먼저 꺼낼 말 — 이력에 있는 사실만으로 만든다)
   수정: 줄마다 [수정] → 그 자리 편집(공종 · 결과 칩 · 날짜 · 금액 · 담당 · 설명) → [취소] [저장] · [삭제]는 지난 건만 · [+ 이력 추가] = CRM 밖 과거 공사 수기 등록('수기' 표시)
        저장 · 삭제 · 추가 = 서버 함수 crm_site_history_write_v1 → 응대 이력에 '이력 수정' 시스템 기록(누가 · 언제 · 무엇 전 → 후). 결과가 실주면 실주 원인(4분류 → 세부 사유) 필수, 수주면 금액 = 낙찰금액.
   저장되는 것은 '이력에 보이는 모습'이다 — CRM 영업건 줄을 고쳐도 그 영업건의 단계 · 종료 상태 · 금액 · 담당 · 계약 원장은 바뀌지 않는다(삭제 = 이력에서 숨김).
   서버 함수가 아직 없으면(CRMRelease) 타임라인만 보여 주고 수정 · 추가 버튼은 내지 않는다. 끄기: G.siteHistoryOff=true → 예전 '같은 현장 다른 영업' */
(function(root){
 'use strict';
 const R=root,h=v=>R.esc(String(v==null?'':v)),attr=v=>R.escAttr(String(v==null?'':v));
 const LIST='crm_site_history_list_v1',WRITE='crm_site_history_write_v1',TAGS=['진행','수주','실주','보류','배드핏'];
 const enabled=()=>!R.G.siteHistoryOff;
 const tidy=()=>{try{return !!(R.DealDetailV3&&R.DealDetailV3.tidy&&R.DealDetailV3.tidy());}catch(e){return false;}};/* 영업건 상세 정돈안(2026-10-06) */
 const rpcOk=n=>!!(R.SB&&typeof R.SB.rpc==='function')&&!(R.CRMRelease&&R.CRMRelease.has(n)===false);
 const canEdit=()=>rpcOk(LIST)&&rpcOk(WRITE);
 const BY={},st=d=>BY[d.id]||(BY[d.id]={state:'idle',entries:[],edit:'',form:null,busy:false,arm:''});
 const toast=(m,k)=>{if(typeof R.toast==='function')R.toast(m,k);};
 const cur=()=>R.CUR_DETAIL&&R.CUR_DETAIL.kind==='deal'?R.CUR_DETAIL.item:null;
 const rep=n=>{try{const v=R.repN(n);return v&&v!=='미배정'?v:'';}catch(e){return String(n||'');}};
 const ym=v=>{const m=/^(\d{4})-(\d{1,2})/.exec(String(v||''));return m?m[1]+'.'+Number(m[2]):'';};
 const sortOf=t=>{const m=/(\d{4})\s*[.\-\/년]\s*(\d{1,2})/.exec(String(t||''))||/(\d{4})/.exec(String(t||''));return m?m[1]+'-'+String(m[2]||'1').padStart(2,'0'):'';};
 const fmt=n=>Number(n)>0?R.fmtAmt(Number(n)):'';
 /* 금액 입력: '450만' · '2,100만' · '1.2억' · 원 단위 숫자. 단위 없는 작은 수(10만 미만)는 만 원으로 읽는다 */
 function parseAmt(s){
  s=String(s==null?'':s).replace(/[,\s원]/g,'');if(!s)return null;
  const e=/([\d.]+)억/.exec(s),m=/([\d.]+)만/.exec(s);
  if(e||m){const v=(e?Number(e[1])*1e8:0)+(m?Number(m[1])*1e4:0);return Number.isFinite(v)&&v>=0?Math.round(v):NaN;}
  if(/^\d+(\.\d+)?$/.test(s)){const n=Number(s);return Math.round(n<1e5?n*1e4:n);}
  return NaN;
 }
 /* 같은 단지 = 단지 ID 기준(중복 현장 연결 포함) — 단지 ID 가 없으면 현장명 */
 function same(d){
  const sid=String(d.cleanup_site_id||d.site_id||d.siteId||''),ns=R.normSite(d.site||'');
  return ((R.B&&R.B.deals)||[]).filter(x=>String(x.id)!==String(d.id)&&(sid?String(x.cleanup_site_id||x.site_id||x.siteId||'')===sid:!!ns&&R.normSite(x.site||'')===ns)).slice(0,40);
 }
 function resultOf(x){
  /* 과거 이관 · 분류 전(예전 리드 단계 값)은 진행도 실주도 아니다 — PipelineScope */
  try{if(R.isWon(x))return '수주';if(R.isLegacyDeal&&R.isLegacyDeal(x))return '과거 이관';if(R.isOpen(x))return R.dealStage(x)==='waiting'?'보류':'진행';}catch(e){}
  return /badfit/.test(String(x.code||x.stage_code||''))||String(x.outcome||'')==='badfit'?'배드핏':'실주';
 }
 function fieldsOf(x){
  let p={};try{p=R.itemPatch?R.itemPatch(x,'deal')||{}:{};}catch(e){}
  const ctx=x.stage_contexts||p.stage_contexts||{};let code='';try{code=R.dealStage(x);}catch(e){}
  return Object.assign({},...Object.values(ctx).map(c=>(c&&c.fields)||{}),(ctx[code]&&ctx[code].fields)||{});
 }
 /* CRM 영업건 → 이력 한 줄(고쳐 적은 것이 없을 때의 기본 모습) */
 function fromDeal(x,isCur){
  const tag=resultOf(x),f=fieldsOf(x);let w='';try{w=R.dealWorkSummary(x)||'';}catch(e){}
  const work=w&&!/미분류|미기록/.test(w)?w:String(x.work||x.work_name||'').trim()||'공종 미분류';
  let date='',label='',amount=null,hint='';
  if(tag==='수주'){date=x.contract_date||f.contract_date||x.closed_at||x.completion_date||'';label='계약';try{amount=R.hasWonAmt(x)?Number(R.wonAmt(x)):Number(x.amount??x.amt??0);}catch(e){amount=Number(x.amount??x.amt??0);}
   const done=ym(x.completion_date||f.completion_date);hint=[done?done+' 준공':'',f.warranty?'하자보증 '+f.warranty:''].filter(Boolean).join(' · ');}
  else if(tag==='실주'||tag==='배드핏'){date=x.closed_at||'';label='종료';amount=Number(x.amount??x.amt??0);
   let why=String(f.close_reason||'');try{if(why&&R.CRMRules&&R.CRMRules.lostReason)why=R.CRMRules.lostReason(why)||why;}catch(e){}
   hint=[why,f.competitor?f.competitor+' 낙찰':'',f.close_detail].filter(Boolean).join(' · ');}
  else{date=x.created||x.created_at||'';label='문의';amount=Number(x.amount??x.amt??0);
   let na=null;try{na=R.actionObj(x,R.itemPatch?R.itemPatch(x,'deal'):{});}catch(e){}
   let sl='';try{sl=tag==='과거 이관'&&R.PipelineScope?'예전 단계 '+R.PipelineScope.oldStage(x):R.stageLabel(R.dealStage(x));}catch(e){}
   hint=[sl,na&&na.text?'다음: '+na.text:(isCur?'다음 할 일 없음':'')].filter(Boolean).join(' · ');}
  const when=ym(date)?ym(date)+' '+label:'';
  return {key:'d:'+x.id,dealId:String(x.id),entryId:'',manual:false,cur:!!isCur,work,tag,when,amount:amount>0?amount:null,who:rep(x.assignee)||'미배정',hint,lost:'',sort:String(date||'').slice(0,7)};
 }
 function rowsOf(d){
  const S=st(d),ov=new Map(S.entries.filter(e=>e.deal_id).map(e=>[String(e.deal_id),e]));
  const fromAny=(x,isCur)=>{const b=fromDeal(x,isCur),e=ov.get(String(x.id));if(!e)return b;if(e.hidden)return isCur?b:null;
   return Object.assign(b,{entryId:String(e.id),edited:true,work:e.work||b.work,tag:e.result||b.tag,when:e.when_text||'',amount:e.amount!=null&&Number(e.amount)>0?Number(e.amount):null,who:e.owner_name||'',hint:e.note||'',lost:e.lost_reason||'',sort:sortOf(e.when_text)||b.sort});};
  const past=same(d).map(x=>fromAny(x,false)).filter(Boolean)
   .concat(S.entries.filter(e=>!e.deal_id&&!e.hidden).map(e=>({key:'e:'+e.id,dealId:'',entryId:String(e.id),manual:true,cur:false,work:e.work||'공종 미기록',tag:e.result||'수주',when:e.when_text||'',amount:e.amount!=null&&Number(e.amount)>0?Number(e.amount):null,who:e.owner_name||'',hint:e.note||'',lost:e.lost_reason||'',sort:sortOf(e.when_text)||String(e.created_at||'').slice(0,7)})))
   .sort((a,b)=>String(b.sort).localeCompare(String(a.sort)));
  return [fromAny(d,true)].concat(past);
 }
 const amtT=r=>fmt(r.amount)||'금액 미정';
 /* 아래 AI 한 줄: 이력에 있는 사실만으로(없는 것을 지어내지 않는다) */
 function aiLine(rows){
  const past=rows.filter(r=>!r.cur),yr=r=>(/(\d{4})/.exec(r.when||r.sort||'')||[])[1]||'';
  const won=past.find(r=>r.tag==='수주'),lost=past.find(r=>r.tag==='실주'),open=past.find(r=>r.tag==='진행'||r.tag==='보류');
  if(won&&/^공종 (미분류|미기록)$/.test(won.work))return (yr(won)?yr(won)+'년 ':'')+'수주한 기존 고객입니다. 지난 공사 뒤 문제 없었는지부터 물어보세요.';
  if(won)return '이 단지는 '+(yr(won)?yr(won)+'년 ':'')+won.work+'를 맡긴 기존 고객입니다. 첫 통화에서 "'+won.work+' 공사 이후 문제 없으셨는지"부터 여쭤보세요.';
  if(lost)return '이 단지는 '+(yr(lost)?yr(lost)+'년 ':'')+lost.work+' 건을 놓친 곳입니다'+(lost.hint?'('+lost.hint+')':'')+'. 첫 통화에서 그때 무엇을 보고 결정하셨는지부터 확인하세요.';
  if(open)return '이 단지에는 진행 중인 다른 영업('+open.work+(open.who?' · '+open.who:'')+')이 있습니다. 같은 공사인지 먼저 확인하세요.';
  return '이 단지와는 이번이 첫 영업입니다. 지난 공사(시공 시기 · 업체)를 먼저 여쭤보고 [+ 이력 추가]로 남겨 두세요.';
 }
 function people(d,curName){
  let list=[];try{list=(R.assignableReps?R.assignableReps('sales_all'):R.inquiryAssignableReps())||[];}catch(e){}
  list=[...new Set(list.map(rep).filter(Boolean))];if(curName&&!list.includes(curName))list.unshift(curName);
  return list;
 }
 function lostGroups(){try{return (R.CRMRules&&R.CRMRules.lostGroups&&R.CRMRules.lostGroups())||[];}catch(e){return [];}}
 function formHtml(d,r,S){
  const F=S.form,isNew=S.edit==='new',groups=lostGroups(),cat=F.lostCat||'',g=groups.find(x=>x[0]===cat);
  const inp=(k,ph)=>'<input class="sth-in" data-sthf="'+k+'" value="'+attr(F[k]||'')+'" placeholder="'+attr(ph)+'" aria-label="'+attr(ph)+'">';
  const lostRow=F.tag==='실주'?'<span>사유</span><div class="sth-lost"><div class="sth-chips">'+groups.map(x=>'<button type="button" data-sth="lcat" data-v="'+attr(x[0])+'" aria-pressed="'+(x[0]===cat)+'">'+h(x[0])+'</button>').join('')+'</div>'
    +(g?'<select class="sth-in" data-sthf="lost" aria-label="실주 세부 사유"><option value="">세부 사유 선택</option>'+g[1].map(o=>'<option value="'+attr(o.v)+'"'+(F.lost===o.v?' selected':'')+'>'+h(o.l)+'</option>').join('')+'</select>':(F.lost&&!cat?'<small>지금: '+h(F.lost)+'</small>':'<small>실주 원인을 고르세요</small>'))+'</div>':'';
  return '<div class="sth-form"><div class="sth-grid">'
   +'<span>공종</span>'+inp('work','공종')
   +'<span>결과</span><div class="sth-chips">'+TAGS.map(l=>'<button type="button" data-sth="tag" data-v="'+l+'" aria-pressed="'+(F.tag===l)+'">'+l+'</button>').join('')+'</div>'
   +lostRow
   +'<span>날짜</span>'+inp('when','2025.11 계약')
   +'<span>금액</span>'+inp('amt',F.tag==='수주'?'낙찰금액 · 450만':'450만')
   +'<span>담당</span><select class="sth-in" data-sthf="who" aria-label="담당"><option value="">미기록</option>'+people(d,F.who).map(p=>'<option'+(p===F.who?' selected':'')+'>'+h(p)+'</option>').join('')+'</select>'
   +'<span>설명</span>'+inp('hint','준공 · 하자 / 실주 사유 · 낙찰사')
   +'</div><div class="sth-foot">'+(!isNew&&r&&!r.cur?'<button type="button" class="sth-del'+(S.arm===r.key?' arm':'')+'" data-sth="del"'+(S.busy?' disabled':'')+'>'+(S.arm===r.key?'한 번 더 누르면 삭제':'삭제')+'</button>':'')
   +'<i></i><button type="button" class="sth-cancel" data-sth="cancel"'+(S.busy?' disabled':'')+'>취소</button><button type="button" class="sth-save" data-sth="save"'+(S.busy?' disabled':'')+'>'+(S.busy?'저장 중…':'저장')+'</button></div>'
   +'<span class="sth-fn">저장하면 응대 이력에 \'이력 수정\' 시스템 기록이 남습니다</span></div>';
 }
 function rowHtml(d,r,i,n,S,edit){
  const ed=S.edit===r.key,ring=r.cur?'#15171c':r.tag==='수주'?'#3fb37f':r.tag==='실주'?'#d14a3f':'#9aa0ab';
  const dot='<span class="sth-dot"><i style="background:'+(r.cur?'#15171c':'#fff')+';border-color:'+ring+'"></i>'+(i<n-1?'<u></u>':'')+'</span>';
  if(ed)return '<div class="sth-row ed" data-key="'+attr(r.key)+'">'+dot+formHtml(d,r,S)+'</div>';
  const open=!r.cur&&r.dealId;
  return '<div class="sth-row'+(r.cur?' cur':' past')+(open?' link':'')+'" data-key="'+attr(r.key)+'"'+(open?' data-sth="open" data-id="'+attr(r.dealId)+'" role="button" tabindex="0"':'')+'>'+dot
   +'<div class="sth-v"><div class="sth-l1"><b>'+h(r.work)+'</b><em class="'+(r.cur?'cur':'t'+TAGS.indexOf(r.tag))+'">'+h(r.cur?'지금 보는 건 · '+r.tag:r.tag)+'</em>'+(r.manual?'<small class="sth-man" title="CRM 밖 과거 공사를 직접 적은 이력">수기</small>':'')+'<i></i>'
   +(edit?'<button type="button" class="sth-edit" data-sth="edit" data-key="'+attr(r.key)+'">수정</button>':'')+'</div>'
   +'<span class="sth-l2">'+h([r.when||'날짜 미기록',amtT(r),r.who||'담당 미기록'].join(' · '))+'</span>'
   +(r.hint?'<span class="sth-l3'+(r.cur&&/없음/.test(r.hint)?' warn':'')+'">'+h(r.hint)+'</span>':'')+'</div></div>';
 }
 /* ── 영업건 상세 정돈안(2026-10-06 design_handoff_deal_detail_tidy): 줄 = 점 · 시기 · 상태 · 금액(오른쪽) + 회색 설명 한 줄(상자 없음).
    같은 단지 수주가 있으면 맨 위에 '✓ YYYY.M 수주 완료 · 금액' 줄. 줄을 누르면 창 전체가 아니라 가운데 칸만 그 영업건 요약으로 바뀐다(지금 보는 줄 = 연파랑 + 왼쪽 파란 띠) ── */
 const TC={'수주':['#1f7a4d','#3fb37f','수주 완료'],'실주':['#b42318','#d14a3f','실주'],'배드핏':['#6b7280','#c9cdd5','배드핏'],'과거 이관':['#6b7280','#c9cdd5','과거 이관'],'보류':['#6b4a00','#d9a400','보류'],'진행':['#2a52b8','#3b6ce4','진행']};
 function rowTidy(d,r,S,edit,peek){
  if(S.edit===r.key)return '<div class="sth-row ed" data-key="'+attr(r.key)+'">'+formHtml(d,r,S)+'</div>';
  const c=r.cur?['#15171c','#15171c','지금 이 건']:(TC[r.tag]||['#6b7280','#c9cdd5',r.tag]),open=!r.cur&&!!r.dealId,on=peek?(!r.cur&&r.dealId===peek):r.cur;
  const work=/^공종 (미분류|미기록)$/.test(r.work)?'공종 미정':r.work,desc=[r.hint,work,r.cur?'':r.who].filter(Boolean).join(' · ');
  return '<div class="sth-row t'+(r.cur?' cur':' past')+(open||r.cur?' link':'')+(on?' on':'')+'" data-key="'+attr(r.key)+'"'+(open?' data-sth="open" data-id="'+attr(r.dealId)+'" role="button" tabindex="0"':r.cur?' data-sth="cur" role="button" tabindex="0"':'')+'>'
   +'<span class="sth-t1"><i style="background:'+c[1]+'"></i><b>'+h(r.when||'날짜 미기록')+'</b><em style="color:'+c[0]+'">'+h(c[2])+'</em>'+(r.manual?'<small class="sth-man" title="CRM 밖 과거 공사를 직접 적은 이력">수기</small>':'')+'<span class="amt">'+h(amtT(r))+'</span></span>'
   +'<span class="sth-t2"><span>'+h(desc)+'</span>'+(edit?'<button type="button" class="sth-edit" data-sth="edit" data-key="'+attr(r.key)+'">수정</button>':'')+'</span></div>';
 }
 function htmlTidy(d,S,rows,edit,isNew,won,sum){
  let peek='',W=null;try{peek=R.DealDetailV3.peekOf(d)||'';W=R.DealDetailV3.wonRow(d);}catch(e){}
  let wt='';try{const x=W&&W.r.dealId?((R.B&&R.B.deals)||[]).find(z=>String(z.id)===W.r.dealId):null,res=x&&R.DealWin&&R.DealWin.enabled()?R.DealWin.resultOf(x):null;wt=res&&res.text?res.text:'';}catch(e){}
  const wl=W?'<div class="sth-won"><b>✓ '+h((W.ym?W.ym+' ':'')+'수주 완료'+(W.r.amount?' · '+fmt(W.r.amount):''))+'</b><span>'+h([wt,W.r.hint,W.r.who].filter(Boolean).join(' · '))+'</span></div>':'';
  const list=rows.map(r=>rowTidy(d,r,S,edit,peek)).join('')+(isNew?'<div class="sth-row ed new" data-key="new">'+formHtml(d,null,S)+'</div>':'');
  return '<section class="dv3-sec sth sth-tidy" data-deal="'+attr(d.id)+'"><header class="sth-hd"><b>이 단지 영업 이력</b><span>'+rows.length+'건'+(won.length?' · 누적 수주 '+h(sum?R.fmtAmt(sum):'금액 미정'):'')+'</span></header>'
   +wl+'<div class="sth-list">'+list+'</div>'
   +'<div class="sth-ai"><b>AI</b>'+h(aiLine(rows))+'</div>'
   +(edit?'<div class="sth-more"><button type="button" class="sth-add" data-sth="add"'+(S.edit?' disabled':'')+'>+ 이력 추가</button></div>':'')+'</section>';/* 제목 줄은 요약이 다 보이게 — 이력 추가는 맨 아래 */
 }
 function html(d){
  const S=st(d),rows=rowsOf(d),edit=canEdit()&&S.state!=='fail',isNew=S.edit==='new'&&S.form;
  if(S.state==='idle')load(d);
  if(S.edit&&S.edit!=='new'&&!rows.some(r=>r.key===S.edit)){S.edit='';S.form=null;}
  const won=rows.filter(r=>r.tag==='수주'),sum=won.reduce((s,r)=>s+(Number(r.amount)||0),0),n=rows.length+(isNew?1:0);
  if(tidy())return htmlTidy(d,S,rows,edit,isNew,won,sum);
  const list=rows.map((r,i)=>rowHtml(d,r,i,n,S,edit)).join('')
   +(isNew?'<div class="sth-row ed new" data-key="new"><span class="sth-dot"><i style="background:#fff;border-color:#9aa0ab"></i></span>'+formHtml(d,null,S)+'</div>':'');
  return '<section class="dv3-sec sth" data-deal="'+attr(d.id)+'"><header class="sth-hd"><b>이 단지 영업 이력</b><span>'+rows.length+'건</span><i></i>'
   +(edit?'<button type="button" class="sth-add" data-sth="add"'+(S.edit?' disabled':'')+'>+ 이력 추가</button>':'')+'</header>'
   +'<span class="sth-sum">누적 수주 <b>'+h(won.length?(sum?R.fmtAmt(sum):'금액 미정')+' ('+won.length+'건)':'없음')+'</b> · 진행 중 <b>'+rows.filter(r=>r.tag==='진행').length+'건</b></span>'
   +'<div class="sth-list">'+list+'</div>'
   +'<div class="sth-ai"><b>AI</b>'+h(aiLine(rows))+'</div></section>';
 }
 function paint(){const d=cur();if(!d||!enabled())return;const n=document.querySelector('#detailView .sth[data-deal="'+String(d.id).replace(/"/g,'')+'"]');if(!n)return;const t=document.createElement('template');t.innerHTML=html(d);n.replaceWith(t.content.firstElementChild);}
 async function load(d){
  const S=st(d);if(S.state!=='idle')return;if(!rpcOk(LIST)){S.state='fail';return;}S.state='loading';
  try{
   const r=await R.SB.rpc(LIST,{p:{deal_id:String(d.id),deal_ids:same(d).map(x=>String(x.id)).filter(x=>/^[0-9a-f-]{36}$/i.test(x))}});
   if(r.error){if(r.error.code==='PGRST202'&&R.CRMRelease&&R.CRMRelease.noteMissing)R.CRMRelease.noteMissing(LIST);throw Error(r.error.message||'읽기 실패');}
   S.entries=r.data&&Array.isArray(r.data.entries)?r.data.entries:[];S.state='ok';
  }catch(e){S.state='fail';}
  if(tidy()&&cur()&&String(cur().id)===String(d.id)){try{R.DealDetailV3.apply();return;}catch(e){}}/* 수기 수주 이력이 있으면 머리의 '기존 고객' 알약도 같이 */
  paint();
 }
 /* 전 → 후 요약(응대 이력 '이력 수정'에 그대로 남는다) */
 function summaryOf(kind,before,after){
  const line=r=>[r.work,r.tag,r.when||'날짜 미기록',r.amtT,r.who||'담당 미기록'].concat(r.hint?[r.hint]:[]).join(' · ');
  if(kind==='add')return '추가 — '+line(after)+' (수기 등록)';
  if(kind==='del')return '삭제 — '+line(before)+(before.manual?'':' (이력에서만 뺌 · 영업건은 그대로)');
  const L=[['공종','work'],['결과','tag'],['날짜','when'],['금액','amtT'],['담당','who'],['설명','hint'],['실주 원인','lost']];
  const diff=L.filter(([,k])=>String(before[k]||'')!==String(after[k]||'')).map(([l,k])=>l+': '+(before[k]||'없음')+' → '+(after[k]||'없음'));
  return diff.length?before.work+' — '+diff.join(' · '):'';
 }
 function applyResult(d,S,data){
  const e=data.entry;if(e){const i=S.entries.findIndex(x=>String(x.id)===String(e.id));if(i>=0)S.entries[i]=e;else S.entries.push(e);}
  const a=data.activity;if(a){if(!Array.isArray(d.activities))d.activities=(d.activity_signals||[]).slice();if(!d.activities.some(x=>String(x.id)===String(a.id)))d.activities.push(a);}
  try{R.saveLocal&&R.saveLocal();}catch(x){}
 }
 async function write(d,payload,okMsg){
  const S=st(d);if(S.busy)return;S.busy=true;paint();
  try{
   const r=await R.SB.rpc(WRITE,{p:Object.assign({deal_id:String(d.id)},payload)});
   if(r.error){if(r.error.code==='PGRST202'&&R.CRMRelease&&R.CRMRelease.noteMissing){R.CRMRelease.noteMissing(WRITE);throw Error('이력 수정은 서버 적용 대기 중입니다 — 적용 뒤 다시 저장해 주세요');}throw Error(r.error.message||'저장 실패');}
   if(!r.data||r.data.ok!==true||!r.data.entry)throw Error('서버 확인 응답이 올바르지 않습니다.');
   applyResult(d,S,r.data);S.busy=false;S.edit='';S.form=null;S.arm='';toast(okMsg);
   if(cur()&&String(cur().id)===String(d.id)){try{R.renderDetail();}catch(e){paint();}}
  }catch(e){S.busy=false;toast(String(e&&e.message||e),'warn');paint();}
 }
 function save(d){
  const S=st(d),F=S.form;if(!F||S.busy)return;const rows=rowsOf(d),r=S.edit==='new'?null:rows.find(x=>x.key===S.edit);if(S.edit!=='new'&&!r)return;
  const work=String(F.work||'').trim(),amount=parseAmt(F.amt);
  if(!work){toast('공종을 적어 주세요','warn');return;}
  if(Number.isNaN(amount)){toast('금액은 450만 · 1.2억 처럼 적어 주세요','warn');return;}
  if(F.tag==='실주'&&!F.lost){toast('실주 원인을 골라 주세요(분류 → 세부 사유)','warn');return;}
  const after={work,tag:F.tag,when:String(F.when||'').trim(),amount,amtT:fmt(amount)||'금액 미정',who:String(F.who||'').trim(),hint:String(F.hint||'').trim(),lost:F.tag==='실주'?F.lost:''};
  const before=r?Object.assign({},r,{amtT:amtT(r)}):null,summary=summaryOf(r?'edit':'add',before,after);
  if(r&&!summary){S.edit='';S.form=null;paint();toast('바뀐 내용이 없습니다');return;}
  const fields={work:after.work,result:after.tag,when_text:after.when||null,amount:after.amount,owner_name:after.who||null,note:after.hint||null,lost_reason:after.lost||null};
  const p={op:'save',fields,summary};if(r){if(r.entryId)p.entry_id=r.entryId;else if(r.dealId)p.target_deal_id=r.dealId;p.before={work:r.work,result:r.tag,when:r.when,amount:r.amount,owner:r.who,note:r.hint};}
  write(d,p,r?'이력을 고쳤습니다 — 응대 이력에 기록됨':'이력을 추가했습니다 — 응대 이력에 기록됨');
 }
 function del(d){
  const S=st(d);if(S.busy)return;const r=rowsOf(d).find(x=>x.key===S.edit);if(!r||r.cur)return;
  if(S.arm!==r.key){S.arm=r.key;paint();return;}/* 한 번 더 눌러야 삭제 */
  const p={op:'delete',summary:summaryOf('del',Object.assign({},r,{amtT:amtT(r)})),before:{work:r.work,result:r.tag,when:r.when,amount:r.amount,owner:r.who,note:r.hint}};
  if(r.entryId)p.entry_id=r.entryId;else p.target_deal_id=r.dealId;
  write(d,p,'이력에서 뺐습니다 — 응대 이력에 기록됨');
 }
 document.addEventListener('click',e=>{
  const b=e.target.closest('#detailView .sth [data-sth]');if(!b||b.disabled)return;const d=cur();if(!d||!enabled())return;const S=st(d),a=b.dataset.sth;
  if(a==='open'||a==='cur'){if(e.target.closest('button'))return;
   if(tidy()&&R.DealDetailV3.peek){R.DealDetailV3.peek(a==='cur'?'':b.dataset.id);return;}/* 정돈안: 가운데 칸만 그 영업건 요약으로 */
   if(a==='cur')return;const x=((R.B&&R.B.deals)||[]).find(z=>String(z.id)===String(b.dataset.id));if(x){R.G._detailPopup=true;R.drwDeal(JSON.stringify(x));}return;}
  e.preventDefault();e.stopPropagation();
  if(a==='add'){if(S.edit)return;S.edit='new';S.arm='';S.form={work:'',tag:'수주',when:'',amt:'',who:rep(d.assignee),hint:'',lost:'',lostCat:''};paint();setTimeout(()=>{const n=document.querySelector('#detailView .sth .sth-row.new [data-sthf="work"]');if(n)n.focus();},0);return;}
  if(a==='edit'){const r=rowsOf(d).find(x=>x.key===b.dataset.key);if(!r)return;let cat='';try{cat=r.lost&&R.CRMRules&&R.CRMRules.lostCategory?R.CRMRules.lostCategory(r.lost)||'':'';}catch(x){}
   S.edit=r.key;S.arm='';S.form={work:r.work==='공종 미분류'?'':r.work,tag:r.tag,when:r.when,amt:fmt(r.amount),who:r.who==='미배정'?'':r.who,hint:r.hint,lost:r.lost,lostCat:cat};paint();return;}
  if(!S.form)return;
  if(a==='tag'){S.form.tag=b.dataset.v;if(S.form.tag!=='실주'){S.form.lost='';S.form.lostCat='';}paint();return;}
  if(a==='lcat'){S.form.lostCat=b.dataset.v;S.form.lost='';paint();return;}
  if(a==='cancel'){S.edit='';S.form=null;S.arm='';paint();return;}
  if(a==='save'){save(d);return;}
  if(a==='del'){del(d);return;}
 },true);
 const onField=e=>{const t=e.target;if(!t||!t.dataset||!t.dataset.sthf||!t.closest('#detailView .sth'))return;const d=cur();if(!d)return;const S=st(d);if(S.form)S.form[t.dataset.sthf]=t.value;};
 document.addEventListener('input',onField);document.addEventListener('change',onField);
 document.addEventListener('keydown',e=>{const t=e.target;if(!t||!t.dataset||!t.dataset.sthf||!t.closest('#detailView .sth'))return;const d=cur();if(!d)return;
  if(e.key==='Enter'&&t.tagName==='INPUT'){e.preventDefault();onField(e);save(d);}
  if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();const S=st(d);S.edit='';S.form=null;S.arm='';paint();}},true);
 root.SiteHistory={enabled,html,paint,rowsOf,parseAmt,state:st,reset:id=>{if(id)delete BY[id];else Object.keys(BY).forEach(k=>delete BY[k]);}};
})(window);
