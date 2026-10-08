/* 영업건 상세 · 같은 정보 같은 판단 (2026-10-08 대표 핸드오프 design_handoff_deal_same_info · 시안 '영업건 상세 · 같은 정보 같은 판단 시안')
   목록 · 상세 · 진척이 같은 계약 정보와 같은 판단을 쓰게 한 곳에 모은다(읽기 전용 · 저장은 기존 경로 그대로).
    ① contract(d, ledger) — 계약일 · 금액 · 업체의 한 가지 근거. 확정 원장 > 계약 단계 필드 > 영업건 값 > 수주 확정(낙찰).
       입력됐지만 증빙(원장 · 계약서 수령 · 계약관련 첨부)이 없으면 '없음'이 아니라 '확인 필요'(state 'check'), 둘 다 있으면 'ok', 계약일 · 금액이 없으면 'none'.
    ② lastProgress(d) — 진척 = 단계 이동 · 낙찰 · 계약 체결 · 직접 기록한 진척. '진척 없음 n일'을 쓰지 않고 '마지막 진척 날짜 · 내용'.
    ③ special(d) — 특이조건 [없음 / 있음 / 확인 필요]. 비어 있으면 '확인 필요'(구두 약속 미기록으로 단정하지 않는다).
    ④ histKind — 이력 한 줄을 고객 접촉 / 내부 변경으로. 접촉 수 = 고객 접촉만.
    ⑤ stamp — 같은 사건의 날짜 · 시간 표기를 'YYYY.M.D HH:MM'(한국 시간)으로.
   끄기: G.dealSameOff=true → 상세는 정돈안 그대로, 목록 · 판정은 예전 값. */
(function(root,factory){const api=factory(root);if(typeof module==='object'&&module.exports)module.exports=api;else root.DealSame=api;})(typeof window==='undefined'?globalThis:window,function(root){
 'use strict';
 const TZ='Asia/Seoul';
 const fDay=new Intl.DateTimeFormat('en-CA',{timeZone:TZ,year:'numeric',month:'2-digit',day:'2-digit'});
 const fHm=new Intl.DateTimeFormat('en-GB',{timeZone:TZ,hour:'2-digit',minute:'2-digit',hour12:false});
 const on=()=>!(root.G&&root.G.dealSameOff);
 const ms=v=>v instanceof Date?v.getTime():typeof v==='number'?v:Date.parse(v);
 const day=v=>{const s=String(v||'');if(/^\d{4}-\d{2}-\d{2}$/.test(s))return s;const n=ms(v);return Number.isFinite(n)?fDay.format(new Date(n)):'';};
 const dot=k=>{const m=/^(\d{4})-(\d{2})-(\d{2})/.exec(String(k||''));return m?m[1]+'.'+(+m[2])+'.'+(+m[3]):'';};
 const md=k=>{const m=/^(\d{4})-(\d{2})-(\d{2})/.exec(String(k||''));return m?(+m[2])+'.'+(+m[3]):'';};
 /* 날짜만 있는 값은 시간 없이, 시각이 있는 값은 한국 시간으로 'YYYY.M.D HH:MM' */
 function stamp(v){
  const s=String(v||'').trim();if(!s)return '';
  if(/^\d{4}-\d{2}-\d{2}$/.test(s))return dot(s);
  const n=ms(s);if(!Number.isFinite(n))return s;
  return dot(fDay.format(new Date(n)))+' '+fHm.format(new Date(n));
 }
 /* 억 단위(소수 자릿수까지, 끝의 0은 뗀다): 10.439억 · 4.3365억 · 11.2억 */
 function eok(n,dec){n=Number(n)||0;if(!n)return '';const a=Math.abs(n);if(a>=1e8)return String(+(n/1e8).toFixed(dec==null?3:dec))+'억';if(a>=1e4)return Math.round(n/1e4).toLocaleString('ko-KR')+'만';return n.toLocaleString('ko-KR')+'원';}
 const num=v=>{const n=Number(String(v==null?'':v).replace(/[^\d.-]/g,''));return Number.isFinite(n)&&n>0?n:0;};
 const fields=(d,s)=>{const c=d&&d.stage_contexts&&d.stage_contexts[s];return c&&c.fields?c.fields:{};};
 const patchOf=d=>{try{return root.itemPatch?root.itemPatch(d,'deal')||{}:{};}catch(e){return {};}};
 const ledgerOf=d=>{try{const L=root.ContractSalesData&&root.ContractSalesData.state?root.ContractSalesData.state():null;return L&&L.items?L.items.find(c=>String(c.deal_id)===String(d&&d.id))||null:null;}catch(e){return null;}};
 /* ── ① 계약 정보 ── */
 function contract(d,ledger){
  if(!d)return {state:'none',date:'',amount:0,company:'',proof:false,text:'',sub:'',status:''};
  const L=ledger===undefined?ledgerOf(d):ledger,p=patchOf(d),cf=Object.assign({},fields(d,'contract'),(p.stage_contexts&&p.stage_contexts.contract&&p.stage_contexts.contract.fields)||{}),w=d.win&&typeof d.win==='object'&&d.win.win_status==='confirmed'?d.win:null;
  const date=day((L&&L.contract_date)||cf.contract_date||d.contract_date||''),amount=num(L&&L.balance)||num(cf.contract_amount)||num(d.contract_amount)||num(d.won_amount)||(w?num(w.award_amount):0),company=String((w&&w.award_company)||(L&&L.contract_company)||'');
  let files=0;try{files=(root.execAttachments?root.execAttachments(d):[]).filter(x=>/계약/.test(String(x.category||''))).length;}catch(e){}
  const proof=!!L||cf.contract_document==='수령'||files>0,status=String(cf.contract_status||(date&&date<=day(Date.now())?'체결 완료':'')||'');
  const input=!!date&&amount>0,state=!input?'none':proof?'ok':'check';
  const head=(status==='체결 예정'?'계약 예정':'계약 체결')+(date?' · '+dot(date):'')+(amount?' · '+eok(amount,2):'');
  return {state,date,amount,company,proof,status,files,ledger:!!L,text:input||date||amount?head:'',sub:state==='check'?'계약 정보 입력됨 · 증빙 확인 필요':state==='none'?(date||amount?'계약일 · 금액 중 빠진 것이 있음':'계약일 · 금액 없음'):''};
 }
 /* ── ③ 특이조건 ── */
 const SPECIAL=['없음','있음','확인 필요'];
 function special(d){
  const p=patchOf(d),cf=Object.assign({},fields(d,'contract'),(p.stage_contexts&&p.stage_contexts.contract&&p.stage_contexts.contract.fields)||{}),v=String(cf.special_terms==null?'':cf.special_terms).trim();
  if(!v)return {v:'확인 필요',text:'',set:false};
  if(v==='없음')return {v:'없음',text:'',set:true};
  if(v==='확인 필요')return {v:'확인 필요',text:'',set:true};
  const t=v.replace(/^있음\s*[·:\-]?\s*/,'');return {v:'있음',text:t,set:true};
 }
 const GN={consulting:'컨설팅 설계',sent:'자료 발송완료',relationship:'관계관리',competition:'경쟁 · 입찰',construction:'계약 · 시공',won:'수주',lost:'실주'};
 function groupName(code){try{const k=root.PipelineStages&&root.PipelineStages.group?root.PipelineStages.group(code,null):'';return GN[k]||'';}catch(e){return '';}}
 /* ── ② 진척 ── */
 function progressEvents(d){
  const out=[];if(!d)return out;
  const push=(date,text,kind)=>{const k=day(date);if(k)out.push({date:k,text,kind});};
  try{(d.stageHistory||[]).forEach(x=>{if(!x||!x.to)return;const label=groupName(x.to)||(root.stageLabel?root.stageLabel(x.to):x.to);push(x.at||x.stage_entered_at,(label||x.to)+' 이동','stage');});}catch(e){}
  try{const w=d.win&&d.win.win_status==='confirmed'?d.win:null;if(w&&w.award_date)push(w.award_date,'낙찰'+(w.award_company?' · '+w.award_company:''),'win');}catch(e){}
  try{const c=contract(d);if(c.date&&c.state!=='none'&&c.status!=='체결 예정')push(c.date,'계약 체결','contract');}catch(e){}
  try{const DC=root.DecisionCollab;if(DC&&DC.on&&DC.on())DC.progress(d).forEach(x=>{if(x.date)push(x.date,x.type,'event');});}catch(e){}
  const seen=new Set();return out.filter(x=>{const k=x.date+'|'+x.text;if(seen.has(k))return false;seen.add(k);return true;}).sort((a,b)=>b.date.localeCompare(a.date));
 }
 function lastProgress(d){
  const E=progressEvents(d),last=E[0]||null;
  return {last,events:E,text:last?'마지막 진척 '+md(last.date)+' · '+last.text:'진척 기록 없음',line:E.slice(0,3).map(x=>md(x.date)+' '+x.text).join(' · ')};
 }
 /* ── ④ 이력 한 줄 분류 ── */
 const CUSTOMER=/전화|통화|방문|문자|SMS|카카오|이메일|메일|미팅|PT|현장설명|입찰|회의|견적\s*(발송|전달)|자료\s*전달|수신/i;
 function histKind(a){
  if(!a)return 'internal';
  const t=String(a.type||''),n=String(a.note||'');
  if(/^\[(내부|막힌 곳|결정 일정|진척|하자|확인|연결)/.test(n)||/메모|기타|시스템|변경|단계|담당|금액/.test(t)&&!CUSTOMER.test(t))return 'internal';
  return CUSTOMER.test(t)?'customer':'internal';
 }
 /* ── 화면 조각(상세가 끼워 쓴다 · 저장은 전부 상세의 기존 경로) ── */
 const esc=v=>{const s=String(v==null?'':v);return root.esc?root.esc(s):s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));};
 const attr=v=>root.escAttr?root.escAttr(String(v==null?'':v)):esc(v);
 const pf=n=>Number(n||0).toLocaleString('ko-KR');
 const todayKey=()=>fDay.format(new Date());
 const dayNo=s=>{const m=/^(\d{4})-(\d{2})-(\d{2})/.exec(String(s||''));return m?Math.round(Date.UTC(+m[1],+m[2]-1,+m[3])/864e5):NaN;};
 const diffDays=(from,to)=>dayNo(to)-dayNo(from);
 /* 머리 둘째 줄: 영업 경로 · 낙찰(확정) · 기술자문(확정) · 예상(참고) · 기존 고객 */
 function winInfo(d){
  let res=null,w={type:''};try{res=root.DealWin&&root.DealWin.resultOf?root.DealWin.resultOf(d):null;}catch(e){}try{w=root.CRMRules&&root.CRMRules.winOf?root.CRMRules.winOf(d):{type:''};}catch(e){}
  const award=res&&res.amount?{label:(res.type==='own'?'계약':'낙찰')+(res.done===false?' (대기)':' (확정)'),amount:res.amount,company:res.company||''}:null;
  return {award,tech:w&&w.tech&&w.techAmount?{amount:w.techAmount,company:w.techCompany||''}:null};
 }
 function line2(d,o){
  o=o||{};const W=winInfo(d),amt=Number(d&&(d.amount??d.amt))||0,parts=[];
  parts.push('<span class="dvs-ch" style="color:'+attr(o.color||'#15171c')+'" title="영업 경로">'+esc(o.brand||'브랜드 미입력')+'</span>');
  if(W.award)parts.push('<span class="dvs-w"><span>'+esc(W.award.label)+'</span> <b>'+esc(eok(W.award.amount,4))+'</b>'+(W.award.company?' · '+esc(W.award.company):'')+'</span>');
  if(W.tech)parts.push('<span class="dvs-w"><span>기술자문 (확정)</span> <b>'+esc(eok(W.tech.amount,4))+'</b>'+(W.tech.company?' · '+esc(W.tech.company):'')+'</span>');
  parts.push('<span class="dvs-est">'+(amt>0?'예상 '+esc(eok(amt,2))+(W.award?' · 참고':''):'예상 금액 미정')+'</span>');
  if(o.won)parts.push('<span class="dvt-won">✓ 기존 고객 · '+esc(o.won.year?o.won.year+' ':'')+'수주 '+esc(o.won.n||1)+'</span>');
  return '<div class="dvs-line2">'+parts.join('')+'</div>';
 }
 /* 등록된 다음 업무(맨 위): 업무 · 기한 · 확인됨 · 확인할 것 · 완료 조건 */
 function nextTask(d){
  let a=null;try{a=root.actionObj?root.actionObj(d,patchOf(d)):null;}catch(e){}
  const text=a&&a.text?String(a.text).trim():'',due=day(a&&(a.due||a.due_at)||''),n=due?diffDays(todayKey(),due):null;
  return {text,due,days:n,dueText:!text?'다음 업무를 등록하세요':due?md(due)+' · '+(n<0?(-n)+'일 지남':n===0?'오늘':n+'일 남음'):'날짜 미등록',late:!!text&&n!==null&&n<0,none:!text};
 }
 function facts(d,ctx){
  const code=String(root.dealStage?root.dealStage(d):''),T=nextTask(d);
  if(code==='contract'||/계약/.test(T.text)&&['contract','construction'].includes(code)){
   const cs=contract(d),sp=special(d);
   const done=cs.state==='none'?'계약일 · 금액 미입력':(cs.status==='체결 예정'?'체결 예정':'체결 완료')+' · '+dot(cs.date)+' · '+pf(cs.amount)+'원';
   const todo=[!cs.proof?'계약서 미첨부':'',cs.state==='check'?'실제 체결':'',cs.state==='check'?'자료 확인':'',cs.state==='none'?'계약일 · 금액 입력':''].filter(Boolean).join(' · ')||'없음';
   const cond=[!cs.proof?'계약서 첨부':'',!sp.set?'특이조건 선택':''].filter(Boolean).join(' + ')||'결과 기록';
   return {done,todo,cond,warn:todo!=='없음'};
  }
  const R=ctx&&ctx.req||{miss:[],total:0};
  return {done:R.total?'필수 정보 '+(R.total-R.miss.length)+' / '+R.total+' 입력':'단계 필수 정보 없음',todo:R.miss.length?R.miss.slice(0,3).join(' · ')+(R.miss.length>3?' 외 '+(R.miss.length-3)+'개':''):'없음',cond:R.miss.length?'빠진 정보 입력 + 결과 기록':'결과 기록',warn:!!R.miss.length};
 }
 function taskHtml(d,ctx){
  ctx=ctx||{};const T=nextTask(d),F=facts(d,ctx),closed=!!ctx.closed,tel=!!ctx.tel;
  const btns=closed?'':'<div class="dvs-btns"><button type="button" class="fill" data-dv3="callnow"'+(tel?'':' disabled title="휴대폰 번호가 없습니다"')+'>연락하기</button><button type="button" data-dv3="rec" aria-pressed="'+!!ctx.calling+'">결과 기록</button><button type="button" data-dv3="nextonly">다음 업무</button></div>'+(ctx.nextHtml||'');
  const aux=[ctx.guide?'<span><b>지침</b> '+esc(ctx.guide)+'</span>':'',ctx.reco?'<span><b>추천</b> '+esc(ctx.reco)+'</span>':''].filter(Boolean).join('');
  return '<span class="lb">등록된 다음 업무</span><div class="dvs-tt"><b>'+esc(T.none?'등록된 업무 없음':T.text)+'</b><span class="'+(T.late||T.none?'red':'')+'">'+esc(T.dueText)+'</span></div>'
   +'<div class="dvs-kv"><span>확인됨</span><span>'+esc(F.done)+'</span><span>확인할 것</span><span class="'+(F.warn?'warn':'')+'">'+esc(F.todo)+'</span><span>완료 조건</span><span>'+esc(F.cond)+'</span></div>'
   +btns+(aux?'<div class="dvs-aux">'+aux+'</div>':'');
 }
 /* 특이조건 칩 [없음 / 있음 / 확인 필요] — 비어 있으면 '확인 필요'(구두 약속 미기록으로 단정하지 않는다) */
 function specialHtml(d,closed,editing,draft){
  const sp=special(d);
  return '<div class="dvs-sp"><span>특이조건</span>'+SPECIAL.map(l=>'<button type="button" data-dv3="spick" data-v="'+attr(l)+'" aria-pressed="'+(sp.v===l)+'"'+(closed?' disabled':'')+'>'+esc(l)+'</button>').join('')
   +(sp.v==='있음'&&!closed?(editing?'<input class="dv3-in" data-dv3in="stage" data-key="special_terms" value="'+attr(draft!=null?draft:sp.text)+'" placeholder="어떤 조건인가요 (예: 하자보증 2년 구두 약속)" aria-label="특이조건 내용">':'<button type="button" class="dvs-sptx'+(sp.text?'':' empty')+'" data-dv3="sptext">'+esc(sp.text||'내용 적기')+'</button>'):'')+'</div>';
 }
 /* 이력 탭 [전체 · 고객 접촉 · 내부 변경] — 접촉 수 = 고객 접촉만 */
 function histBar(counts,active){
  const T=[['all','전체',counts.all],['cust','고객 접촉',counts.cust],['sys','내부 변경',counts.sys]];
  return '<div class="dvs-htabs" role="group" aria-label="이력 구분">'+T.map(([k,l,n])=>'<button type="button" data-dv3="htab" data-v="'+k+'" aria-pressed="'+(active===k)+'">'+esc(l)+' '+n+'</button>').join('')+'</div><span class="dvs-hnote">고객 접촉 = 연락 시도 <b>'+counts.tries+'</b> · 실제 연결 <b>'+counts.conn+'</b> · 내부 변경은 따로</span>';
 }
 return {on,day,dot,md,stamp,eok,contract,special,SPECIAL,progressEvents,lastProgress,histKind,CUSTOMER,nextTask,facts,winInfo,line2,taskHtml,specialHtml,histBar};
});
