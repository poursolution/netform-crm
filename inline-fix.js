/* 빠진 정보를 그 자리에서 보완 (2026-10-10 design_handoff_after_deploy 13 · 시안 '그 자리에서 보완 · 후속 연결 시안.dc.html' 1번)
   파이프라인 단계 목록에서 [증빙 확인] · [일정 입력] · [정보 입력]을 누르면 상세 창을 열지 않고 **그 줄 아래만** 펼친다. 새 메뉴 없음.
   5단계: ① 기존 기록 · 이력에서 후보 → [이걸로]  ② 값 + 근거 등록  ③ 경과일 · 기준 판정(목록과 같은 함수)  ④ 후속 업무 제안(담당이 확인 후 저장)  ⑤ 저장 → 영업건 · 오늘 업무 · 진단 동시 반영(실패한 것만 재시도)
   [확인 불가] = 날짜를 지어내지 않는다 — '확인 불가' 표시와 확인한 곳만 남기고 판정은 계속 '판정 불가'.
   종류 3가지(같은 틀): 자료 발송 = 발송일 · 자료 · 수신자 / 경쟁 · 입찰 = 입찰 · 결정 일정 / 계약 = 계약일 · 계약금액(계약 단계에 있는 건만 — 지난 단계 정보는 서버 함수가 받지 않는다).
   저장 길은 기존 것 그대로: 단계 정보 = crm_deal_stage_fields_update_v1(DealDetailV3.stageFields) · 후속 업무 = 다음 할 일 등록(DealDetailV3.next).
   단계 정보에 새로 쓰는 칸: sent_basis · sent_date_check / schedule_basis · schedule_check / contract_basis · contract_check (근거 · 확인 불가 표시).
   끄기: G.inlineFixOff=true → 예전처럼 상세의 '이 단계 필수 정보'로. */
(function(root){
 'use strict';
 const h=v=>root.esc(String(v==null?'':v)),attr=v=>root.escAttr(String(v==null?'':v));
 const on=()=>!root.G.inlineFixOff&&!!(root.DealDetailV3&&root.DealDetailV3.stageFields&&root.StageTransition&&root.StageTransition.definitions);
 const today=()=>new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Seoul'});
 const dayKey=v=>{if(!v)return '';const J=root.PipelineJudge;let k='';try{k=J&&J.dayKey?J.dayKey(v):'';}catch(e){}if(!k){const m=/^(\d{4})-(\d{2})-(\d{2})/.exec(String(v));k=m?m[0]:'';}return k;};
 const ms=k=>{const m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(String(k||''));return m?Date.UTC(+m[1],+m[2]-1,+m[3]):NaN;};
 const diff=(a,b)=>Math.round((ms(b)-ms(a))/864e5);/* a → b 며칠 */
 const add=(k,n)=>{const t=ms(k);return Number.isFinite(t)?new Date(t+n*864e5).toISOString().slice(0,10):'';};
 const WD=['일','월','화','수','목','금','토'];
 const wd=k=>{const t=ms(k);return Number.isFinite(t)?WD[new Date(t).getUTCDay()]:'';};
 /* 내부 계획일은 월~금 — 주말이면 다음 월요일 */
 const weekday=k=>{let x=k;for(let i=0;i<3;i++){const g=new Date(ms(x)).getUTCDay();if(g===0||g===6)x=add(x,1);else break;}return x;};
 const dot=k=>{const m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(String(k||''));return m?+m[1]+'.'+(+m[2])+'.'+(+m[3]):'';};
 const md=k=>{const m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(String(k||''));return m?(+m[2])+'.'+(+m[3]):'';};
 const clip=(s,n)=>{s=String(s||'').replace(/\s+/g,' ').trim();return s.length>n?s.slice(0,n-1)+'…':s;};
 const patchOf=d=>{try{return root.itemPatch(d,'deal')||{};}catch(e){return {};}};
 const codeOf=d=>{try{return String(root.dealStage(d)||'');}catch(e){return String(d.stage_code||d.code||'');}};
 const curFields=d=>{const c=(d.stage_contexts||patchOf(d).stage_contexts||{})[codeOf(d)];return (c&&c.fields)||{};};
 const curCtx=d=>(d.stage_contexts||patchOf(d).stage_contexts||{})[codeOf(d)]||{};
 const defOf=(code,key)=>{const D=root.StageTransition.definitions[code];return D?D.fields.find(f=>f.key===key):null;};
 const rules=()=>{try{return root.PipelineStageB.rules();}catch(e){return {follow:7};}};
 const D7=()=>Number((root.OPS_RULES||{}).bidPrepDays)||7;
 /* ── 종류 ── */
 const KIND={
  sent:{name:'발송 증빙 확인',steps:['기존 첨부 · 이력 확인','발송일 · 수신자 등록','경과일 계산','후속 업무 제안','저장 · 반영'],
   re:/견적|제안서|공법\s*자료|자료|메일|송부|발송|보냄|보냈|전달/,basisKey:'sent_basis',checkKey:'sent_date_check',unkBtn:'발송 확인 불가',unkWord:'발송 확인 불가',find:'발송',
   keys:()=>['sent_date','materials','recipient'],need:()=>['sent_date','materials','recipient'],past:['sent_date'],
   reason:'목록에서 발송 증빙 확인',unReason:'목록에서 발송 확인 불가 표시'},
  schedule:{name:'입찰 · 결정 일정 확인',steps:['기존 기록 · 이력 확인','입찰 · 결정 일정 등록','남은 날 계산','준비 업무 제안','저장 · 반영'],
   re:/입찰|현설|현장\s*설명|PT|개찰|마감|대표\s*회의|입대의|결정|투찰/,basisKey:'schedule_basis',checkKey:'schedule_check',unkBtn:'일정 확인 불가',unkWord:'일정 확인 불가',find:'일정',
   keys:code=>code==='bidding'?['bid_deadline','briefing_date','decision_date']:['meeting_date','decision_date'],need:()=>[],any:true,past:[],
   reason:'목록에서 입찰 · 결정 일정 등록',unReason:'목록에서 일정 확인 불가 표시'},
  contract:{name:'계약 정보 확인',steps:['기존 기록 · 이력 확인','계약일 · 계약금액 등록','계약 정보 판정','후속 업무 제안','저장 · 반영'],
   re:/계약|체결|낙찰|수의/,basisKey:'contract_basis',checkKey:'contract_check',unkBtn:'계약 정보 확인 불가',unkWord:'계약 정보 확인 불가',find:'계약',
   keys:()=>['contract_status','contract_date','contract_amount'],need:()=>['contract_date','contract_amount'],past:[],
   reason:'목록에서 계약 정보 등록',unReason:'목록에서 계약 정보 확인 불가 표시'}
 };
 /* 이 줄이 그 자리 보완 대상인가 — 판정을 막는 빠진 정보가 있는 줄만(단계 화면의 사유 코드 그대로) */
 function kindOf(stage,x){
  if(!on()||!x||!x.row)return '';const rs=x.rs||[],code=String(x.row.code||'');
  if(stage==='sent'&&rs.includes('nosent')&&code==='sent')return 'sent';
  if(stage==='competition'&&rs.includes('nodate')&&['compete','bidding'].includes(code))return 'schedule';
  if(stage==='construction'&&rs.includes('cinfo')&&code==='contract')return 'contract';
  return '';
 }
 const st=()=>root.G.ifx||null;
 const openKey=()=>{const S=st();return S?S.key:'';};
 /* ── ① 기존 기록에서 후보 ── */
 function explicitDate(text,base){/* 글 속에 적힌 날짜(10/20 · 10월 20일) — 연도는 기록한 날 기준, 기록일보다 한 달 넘게 앞이면 다음 해 */
  const m=/(?:^|[^\d])(\d{1,2})\s*(?:\/|월)\s*(\d{1,2})\s*일?/.exec(String(text||''));if(!m||!base)return '';
  const mo=+m[1],da=+m[2];if(mo<1||mo>12||da<1||da>31)return '';let y=+base.slice(0,4),k=y+'-'+String(mo).padStart(2,'0')+'-'+String(da).padStart(2,'0');
  if(!Number.isFinite(ms(k)))return '';if(diff(k,base)>31)k=(y+1)+k.slice(4);return k;
 }
 function candidates(d,kind){
  const K=KIND[kind],out=[],seen=new Set(),t0=today();
  const push=(src,text,at)=>{const date=dayKey(at);text=String(text||'').replace(/\s+/g,' ').trim();if(!date||date>t0||!text||!K.re.test(text))return;const k=date+'|'+text.slice(0,40);if(seen.has(k))return;seen.add(k);out.push({src,text:clip(text,48),date,when:kind==='schedule'?explicitDate(text,date):'',raw:text});};
  const acts=[].concat(Array.isArray(d.activities)?d.activities:[],Array.isArray(patchOf(d).activities)?patchOf(d).activities:[]);
  acts.forEach(a=>{if(!a||a.type==='단계정보')return;push(String(a.type||'기록'),[a.note,a.result].filter(Boolean).join(' · '),a.occurred_at||a.at||a.created_at);});
  (Array.isArray(d.legacy_notes)?d.legacy_notes:[]).forEach(n=>{if(n)push('과거 메모',n.body,n.occurred_at||n.recorded_at);});
  return out.sort((a,b)=>a.date<b.date?1:a.date>b.date?-1:0).slice(0,5);
 }
 /* ── 값 읽기 ── */
 function fieldsOf(kind,code){return KIND[kind].keys(code).map(k=>defOf(code,k)).filter(Boolean);}
 function start(stage,x,kind){
  const d=x.row.item,code=codeOf(d),cur=curFields(d),draft={};
  fieldsOf(kind,code).forEach(f=>{const v=cur[f.key];draft[f.key]=f.type==='multi'?(Array.isArray(v)?v.slice():[]):v==null?'':String(v);});
  root.G.ifx={key:x.row.key,stage,kind,code,step:1,draft,basis:String(cur[KIND[kind].basisKey]||''),pick:-1,cands:candidates(d,kind),unk:false,unkNote:'',follow:null,P:{},saved:{fields:false,next:false},busy:false,err:'',done:false,sync:[]};
 }
 const moneyNum=v=>{try{return root.MoneyInput.parse(String(v||''));}catch(e){const n=Number(String(v||'').replace(/[^\d.-]/g,''));return Number.isFinite(n)?n:NaN;}};
 /* ② 검사: 빠진 것 · 틀린 것 한 줄 */
 function check(S){
  const K=KIND[S.kind],F=fieldsOf(S.kind,S.code),t0=today(),D=S.draft;
  for(const f of F){const v=D[f.key],empty=f.type==='multi'?!(v&&v.length):String(v||'').trim()==='';
   if(K.need(S.code).includes(f.key)&&empty)return f.label.replace(/\(원\)/,'')+'을(를) 넣어 주세요';
   if(!empty&&f.type==='date'){if(!/^\d{4}-\d{2}-\d{2}$/.test(v)||!Number.isFinite(ms(v)))return f.label+' 날짜를 확인해 주세요';if(K.past.includes(f.key)&&v>t0)return f.label+'은(는) 오늘까지의 날짜로 넣어 주세요';}
   if(!empty&&f.type==='money'){const n=moneyNum(v);if(!Number.isFinite(n)||n<=0)return f.label.replace(/\(원\)/,'')+'은 원 단위 숫자로 적어 주세요';}}
  if(K.any&&!F.some(f=>f.type==='date'&&String(D[f.key]||'').trim()))return '입찰 마감 · PT · 결정 일정 중 하나는 넣어 주세요';
  if(!String(S.basis||'').trim())return '근거(어디서 확인했는지)를 적어 주세요';
  return '';
 }
 /* ③ 판정 — 목록 · 진단 칸과 같은 계산 */
 function judge(S,d){
  const D=S.draft,t0=today();
  if(S.kind==='sent'){const q=rules(),B=root.PipelineStageB;let e=null;try{e=B.sentEvidence({fields:{sent_date:D.sent_date},item:d},{reaction:curFields(d).reaction});}catch(x){}
   const age=diff(D.sent_date,t0),followed=!!(e&&e.followed),late=!followed&&age>q.follow;
   return {head:'발송 '+dot(D.sent_date)+' → 오늘',big:age+'일',rule:'기준 '+q.follow+'일',state:followed?'done':late?'late':'wait',
    text:followed?'후속 확인 기록 있음':late?'후속 연락 필요 · '+(age-q.follow)+'일 지남':'기한 안 · '+(q.follow-age)+'일 남음',bad:late};}
  if(S.kind==='schedule'){/* 기준 날짜의 순서는 판정 함수(PipelineJudge) · 목록 줄과 같다: 입찰 마감 → 결정 일정 → 현설 → PT · 협의 */
   const ds=['bid_deadline','decision_date','briefing_date','meeting_date'].filter(k=>D[k]).map(k=>({l:(defOf(S.code,k)||{label:k}).label.replace('입찰마감','입찰 마감').replace('PT·협의일','PT · 협의일'),k:D[k]})),x=ds[0],n=diff(t0,x.k),d7=D7();
   return {head:x.l+' '+dot(x.k)+' ('+wd(x.k)+')',big:n>=0?'D-'+n:'D+'+(-n),rule:'준비 기준 D-'+d7,state:n<0?'past':n<=d7?'near':'run',target:x.k,
    text:n<0?'일정 지남 · 결과 확인':n<=d7?'마감 D-'+d7+' 이내 · 제안서 · 가격 확정':'진행 중 · 준비 시작 '+md(add(x.k,-d7)),bad:n>=0&&n<=d7};}
  const amt=moneyNum(D.contract_amount),done=D.contract_status==='체결 완료';
  return {head:'계약 '+dot(D.contract_date)+' · '+(Number.isFinite(amt)?amt.toLocaleString('ko-KR')+'원':''),big:done?'체결 완료':(D.contract_status||'상태 미정'),rule:'계약서 · 원장 확인 전',state:'check',
   text:'계약 정보 입력됨 · 증빙 확인 필요',note:'수주실적(낙찰금액 · VAT 별도)과는 무관 · 계약 실적은 계약서 · 원장 확인 뒤',bad:false};
 }
 /* ④ 후속 업무 제안 — 담당이 확인 후 저장. 이미 잡힌 다음 업무 · 같은 영업건의 열린 요청이 있으면 새로 만들지 않는다 */
 function openRequests(d){try{return root.DealUnits&&root.DealUnits.requests?root.DealUnits.requests(d):[];}catch(e){return [];}}
 function propose(S,x){
  const d=x.row.item,r=x.row,J=judge(S,d),t0=today(),owner=String(root.repN?root.repN(d.assignee)||'':d.assignee||'')||String(r.owner||'');
  let text='',due='',type='전화';
  if(S.kind==='sent'){text='견적 수신 · 검토 여부 확인 전화';due=J.state==='late'?t0:add(S.draft.sent_date,rules().follow);if(due<t0)due=t0;}
  else if(S.kind==='schedule'){type='후속접촉';if(J.state==='past'){text='입찰 · 결정 결과 확인 · 등록';due=t0;}else if(J.state==='near'){text='제안서 팀장 공유 · 가격 확정';due=t0;}else{text='입찰 준비 점검 · 제안서 초안';due=add(J.target,-D7());if(due<t0)due=t0;}}
  else{type='후속접촉';text=S.draft.contract_status==='체결 완료'?'계약서 수령 · 착공일 확인':'계약 체결 확인';due=S.draft.contract_date&&S.draft.contract_date>t0?S.draft.contract_date:t0;}
  due=weekday(due);
  const hasNext=!!(r.next&&r.next.text&&r.due),reqs=openRequests(d),none=S.kind==='sent'&&J.state==='done';
  return {type,text,due,owner,hasNext,next:hasNext?{text:String(r.next.text),due:dayKey(r.due)}:null,reqs,mode:none?'none':reqs.length||hasNext?'keep':'new',none};
 }
 /* ── 그리기 ── */
 function fieldHtml(f,S){
  const v=S.draft[f.key],lab=f.label.replace(/^무엇을 발송했나요\?$/,'자료').replace(/\(원\)/,'').replace('계약예정·체결일','계약일').replace('입찰마감','입찰 마감').replace('PT·협의일','PT · 협의일');
  let inp;
  if(f.type==='multi')inp='<div class="ifx-chips">'+(f.options||[]).map(o=>'<button type="button" data-ifx="chip" data-k="'+attr(f.key)+'" data-v="'+attr(o)+'" aria-pressed="'+(v||[]).includes(o)+'">'+h(o)+'</button>').join('')+'</div>';
  else if(f.type==='select')inp='<div class="ifx-chips">'+(f.options||[]).map(o=>'<button type="button" data-ifx="pick1" data-k="'+attr(f.key)+'" data-v="'+attr(o)+'" aria-pressed="'+(v===o)+'">'+h(o)+'</button>').join('')+'</div>';
  else if(f.type==='date')inp='<input type="date" data-ifxf="'+attr(f.key)+'" value="'+attr(v||'')+'"'+(KIND[S.kind].past.includes(f.key)?' max="'+today()+'"':'')+' aria-label="'+attr(lab)+'">';
  else inp='<input type="text" data-ifxf="'+attr(f.key)+'" value="'+attr(v||'')+'" maxlength="80" aria-label="'+attr(lab)+'"'+(f.type==='money'?' inputmode="numeric" placeholder="원 단위 숫자"':f.key==='recipient'?' placeholder="직책 · 이름 · 받은 곳"':'')+'>';
  return '<label class="ifx-f"><span>'+h(lab)+'</span>'+inp+'</label>';
 }
 function diagNow(){const b=document.querySelector('#pipeline-stage-v3 .ps3-jd');return b?{ok:Number(b.dataset.ok)||0,all:Number(b.dataset.all)||0,label:(b.querySelector(':scope>span')||{}).textContent||''}:null;}
 function body(S,x){
  const K=KIND[S.kind],d=x.row.item,F=fieldsOf(S.kind,S.code);
  if(S.done&&S.unk)return '<div class="ifx-done unk"><b>확인 불가로 남김</b><ul><li>영업건 · '+h(K.unkWord)+' · 확인한 곳 '+h(S.unkNote)+'</li><li>임의 날짜를 넣지 않음</li><li>진단 · 계속 판정 불가'+(S.diag?' (판정 가능 '+S.diag.ok+' / '+S.diag.all+')':'')+'</li></ul></div>';
  if(S.done)return '<div class="ifx-done"><b>✓ 저장됨 · 한 번에 반영</b><ul>'+S.sync.map(y=>'<li>'+h(y)+'</li>').join('')+'</ul></div>';
  if(S.unk)return '<div class="ifx-unk"><b>'+h(K.unkWord)+'</b><p>확인 못 하면 \'확인 불가\'로 남김 · 임의 날짜 넣지 않음 · 지표는 계속 판정 불가</p><label class="ifx-f"><span>확인한 곳</span><input type="text" data-ifxf="__unk" value="'+attr(S.unkNote)+'" maxlength="80" placeholder="예: 메일함 · 잔디 · 담당 확인 — 기록 없음" aria-label="확인한 곳"></label></div>';
  if(S.step===1)return '<div class="ifx-s1"><b>기존 첨부 · 이력에서 찾음</b>'+(S.cands.length?S.cands.map((c,i)=>'<div class="ifx-cand'+(S.pick===i?' on':'')+'"><span title="'+attr(c.raw)+'"><i>'+h(c.src)+'</i> '+h(c.text)+'</span><em>'+h(dot(c.date))+(c.when?' · 글 속 일정 '+h(md(c.when)):'')+'</em><button type="button" data-ifx="use" data-v="'+i+'">이걸로</button></div>').join(''):'<p class="ifx-none">이 영업건의 응대 기록 · 과거 메모에서 '+h(K.find)+' 관련 기록을 찾지 못했습니다 — 메일함 · 잔디를 확인해 직접 넣거나 [확인 불가]로 남겨 주세요</p>')+'</div>';
  if(S.step===2)return '<div class="ifx-s2">'+F.map(f=>fieldHtml(f,S)).join('')+'<label class="ifx-f wide"><span>근거</span><input type="text" data-ifxf="__basis" value="'+attr(S.basis)+'" maxlength="120" placeholder="어디서 확인했는지 — 예: 9.12 이메일 발송 기록" aria-label="근거"></label></div>';
  const J=judge(S,d);
  if(S.step===3){const dg=diagNow();return '<div class="ifx-s3"><span>'+h(J.head)+'</span><b>'+h(J.big)+'</b><span>· '+h(J.rule)+'</span><em class="'+(J.bad?'r':'')+'">'+h(J.text)+'</em><small>'+(S.kind==='contract'?h(J.note):'이제 판정 가능'+(dg?' · 저장하면 진단 칸 \'판정 가능 '+(dg.ok+1)+' / '+dg.all+'\'':''))+'</small></div>';}
  const P=S.follow||(S.follow=propose(S,x));
  if(S.step===4){
   const keepTxt=P.reqs.length?'같은 영업건에 열린 요청 '+P.reqs.length+'건 — 새 업무를 만들지 않고 그 요청으로 처리':P.hasNext?'이미 등록된 다음 업무 \''+clip(P.next.text,24)+'\' · '+md(P.next.due)+' — 그대로 둠':'';
   return '<div class="ifx-s4"><b>후속 업무 제안 · 담당이 확인 후 저장</b>'+(P.none?'<p class="ifx-keep">후속 확인 기록이 있어 새 업무를 제안하지 않습니다</p>':'')+(keepTxt?'<p class="ifx-keep">'+h(keepTxt)+'</p>':'')
    +'<div class="ifx-modes" role="group" aria-label="후속 업무">'+(P.reqs.length||P.hasNext||P.none?'<button type="button" data-ifx="mode" data-v="'+(P.none&&!P.hasNext&&!P.reqs.length?'none':'keep')+'" aria-pressed="'+(P.mode!=='new')+'">'+(P.hasNext||P.reqs.length?'기존 업무 유지':'등록 안 함')+'</button>':'')+'<button type="button" data-ifx="mode" data-v="new" aria-pressed="'+(P.mode==='new')+'">'+(P.hasNext?'새 후속 업무로 바꾸기':'후속 업무 등록')+'</button>'+(!P.reqs.length&&!P.hasNext&&!P.none?'<button type="button" data-ifx="mode" data-v="none" aria-pressed="'+(P.mode==='none')+'">등록 안 함</button>':'')+'</div>'
    +(P.mode==='new'?'<div class="ifx-s2"><label class="ifx-f wide"><span>목적</span><input type="text" data-ifxf="__ftext" value="'+attr(P.text)+'" maxlength="60" aria-label="목적"></label><label class="ifx-f"><span>예정일</span><input type="date" data-ifxf="__fdue" value="'+attr(P.due)+'" min="'+today()+'" aria-label="예정일"></label><span class="ifx-ro"><span>내부 계획</span>'+h(dot(P.due))+' ('+h(wd(P.due))+')</span><span class="ifx-ro"><span>담당</span>'+h(P.owner||'미배정')+'</span></div>':'')+'</div>';}
  return '';
 }
 function html(stage,x,moved){
  const S=st();if(!S||!x||S.key!==x.row.key)return '';const K=KIND[S.kind],r=x.row,d=r.item,bc=(root.PipelineRowV11&&{'석민이앤씨':'#e8590c','POUR솔루션':'#1f9d55','POUR공법':'#7048e8','아파트스퀘어':'#3b6ce4'}[d.brand])||'#e3e6ec';
  const step=S.done?5:S.step,steps=K.steps.map((l,i)=>{const k=i+1;return '<button type="button" class="'+(k<step?'past':k===step?'now':'')+'" data-ifx="step" data-v="'+k+'"'+(S.done||S.unk||k>step?' disabled':'')+'><i></i>'+h(l)+'</button>';}).join('');
  const err=S.err?'<p class="ifx-err" role="alert">'+h(S.err)+(S.saved.fields&&!S.done?' — 등록한 정보는 저장됐습니다 · 후속 업무만 다시 시도합니다':'')+'</p>':'';
  let foot;
  if(S.done)foot='<i></i><button type="button" class="pri" data-ifx="close">닫기</button>';
  else if(S.unk)foot='<button type="button" data-ifx="unkback">돌아가기</button><i></i><button type="button" class="pri" data-ifx="unksave"'+(S.busy?' disabled':'')+'>'+(S.busy?'확인 중…':'확인 불가로 남기기')+'</button>';
  else foot=(step<=2?'<button type="button" class="unk" data-ifx="unk">'+h(K.unkBtn)+'</button>':'<button type="button" data-ifx="prev">이전</button>')+'<i></i><button type="button" class="pri" data-ifx="'+(step===4?'save':'next')+'"'+(S.busy?' disabled':'')+'>'+(S.busy?'확인 중…':step===4?(S.err?'재시도':'저장'):'다음')+'</button>';
  return '<div class="ifx'+(moved?' moved':'')+'" data-ifx-panel="'+attr(r.key)+'" data-kind="'+S.kind+'" data-step="'+step+'" role="region" aria-label="'+attr(K.name)+'" style="border-left-color:'+bc+'">'
   +(moved?'<div class="ifx-moved"><b>'+h(r.site)+'</b><span>'+h(S.done?'저장되어 목록의 다른 칸으로 옮겨졌습니다':'지금 목록 조건에 보이지 않는 줄입니다')+'</span></div>':'')
   +'<div class="ifx-top"><b>'+h(K.name)+'</b><span>단계 '+step+' / 5</span><div class="ifx-steps">'+steps+'</div></div><div class="ifx-body">'+body(S,x)+'</div>'+err+'<div class="ifx-foot">'+foot+'</div></div>';
 }
 /* ── 동작 ── */
 let finder=null;/* 단계 화면이 넘겨 주는 '키 → 그 줄' 찾기 */
 const rowX=()=>{const S=st();return S&&finder?finder(S.key):null;};
 function redraw(){const S=st(),p=document.querySelector('[data-ifx-panel]');if(!S||!p)return repaint();const x=rowX();if(!x)return repaint();const moved=p.classList.contains('moved'),t=document.createElement('div');t.innerHTML=html(S.stage,x,moved);if(t.firstChild)p.replaceWith(t.firstChild);}
 function repaint(){try{root.paint();}catch(e){}}
 function toggle(stage,x,kind){const S=st();if(S&&S.key===x.row.key){if(S.busy)return;root.G.ifx=null;return repaint();}if(S&&S.busy)return;start(stage,x,kind);repaint();}
 function payload(S){
  const K=KIND[S.kind],out={};fieldsOf(S.kind,S.code).forEach(f=>{const v=S.draft[f.key];if(f.type==='multi')out[f.key]=Array.isArray(v)?v:[];else if(f.type==='money'){const s=String(v||'').trim();out[f.key]=s===''?null:moneyNum(s);}else{const s=String(v||'').trim();out[f.key]=s===''?null:s;}});
  out[K.basisKey]=String(S.basis).trim();out[K.checkKey]=null;return out;
 }
 async function save(){
  const S=st(),x=rowX();if(!S||!x||S.busy)return;const d=x.row.item,K=KIND[S.kind],DV=root.DealDetailV3,P=S.follow||(S.follow=propose(S,x));
  if(P.mode==='new'){if(!String(P.text||'').trim()){S.err='후속 업무의 목적을 적어 주세요';return redraw();}if(!/^\d{4}-\d{2}-\d{2}$/.test(P.due)||P.due<today()){S.err='예정일은 오늘 이후로 정해 주세요';return redraw();}}
  S.busy=true;S.err='';redraw();
  try{
   if(!S.saved.fields){await DV.stageFields(d,payload(S),K.reason);S.saved.fields=true;}
   if(P.mode==='new'&&!S.saved.next){await DV.next(d,{type:P.type,text:String(P.text).trim(),due:P.due,P:S.P});S.saved.next=true;}
   const J=judge(S,d);
   S.sync=[S.kind==='sent'?'영업건 · 발송일 '+dot(S.draft.sent_date)+' · 수신자 등록':S.kind==='schedule'?'영업건 · '+J.head+' 등록':'영업건 · 계약일 '+dot(S.draft.contract_date)+' · 계약금액 등록 (증빙 확인 필요)',
    P.mode==='new'?'오늘 업무 · "'+String(P.text).trim()+'" '+md(P.due)+' 추가':P.reqs.length?'오늘 업무 · 열린 요청 '+P.reqs.length+'건으로 처리 · 새 업무 없음':P.hasNext?'오늘 업무 · 기존 다음 업무 유지':'오늘 업무 · 새 업무 없음'];
   S.done=true;S.busy=false;
   try{root.saveLocal&&root.saveLocal();}catch(e){}try{root.TodayWorkQueue&&root.TodayWorkQueue.render&&root.TodayWorkQueue.render();}catch(e){}
   repaint();const dg=diagNow();if(dg){S.sync.push('진단 · 판정 가능 '+dg.ok+' / '+dg.all+(S.kind==='sent'?' · '+J.text:''));redraw();}
  }catch(e){S.busy=false;S.err=String(e&&e.message||e||'저장 실패');redraw();}
 }
 async function saveUnknown(){
  const S=st(),x=rowX();if(!S||!x||S.busy)return;const K=KIND[S.kind],note=String(S.unkNote||'').trim();
  if(!note){S.err='어디를 확인했는지 적어 주세요';return redraw();}
  S.busy=true;S.err='';redraw();
  try{await root.DealDetailV3.stageFields(x.row.item,{[K.checkKey]:'확인 불가',[K.basisKey]:note},K.unReason);S.done=true;S.busy=false;try{root.saveLocal&&root.saveLocal();}catch(e){}repaint();S.diag=diagNow();redraw();}
  catch(e){S.busy=false;S.err=String(e&&e.message||e||'저장 실패');redraw();}
 }
 function onClick(e){
  const b=e.target.closest('[data-ifx]');if(!b||b.disabled||!b.closest('[data-ifx-panel]'))return;const S=st();if(!S)return;e.stopPropagation();const a=b.dataset.ifx,v=b.dataset.v,x=rowX();
  if(a==='close'){root.G.ifx=null;return repaint();}
  if(S.busy)return;S.err='';
  if(a==='use'){const c=S.cands[+v];if(!c)return;S.pick=+v;S.basis=md(c.date)+' '+c.src+' 기록에서 가져옴';
   if(S.kind==='sent'){S.draft.sent_date=c.date;if(!(S.draft.materials||[]).length){const m=[];if(/견적/.test(c.raw))m.push('견적서');if(/제안/.test(c.raw))m.push('제안서');if(/공법/.test(c.raw))m.push('공법자료');S.draft.materials=m;}}
   else if(S.kind==='schedule'&&c.when){const k=KIND.schedule.keys(S.code)[0];if(!S.draft[k])S.draft[k]=c.when;}
   S.step=2;return redraw();}
  if(a==='step'){const k=+v;if(k<S.step){S.step=k;if(k<4)S.follow=null;}return redraw();}
  if(a==='prev'){S.step=Math.max(1,S.step-1);if(S.step<4)S.follow=null;return redraw();}
  if(a==='next'){if(S.step===2){const m=check(S);if(m){S.err=m;return redraw();}}if(S.step===1&&S.pick<0){/* 후보 없이 직접 입력 */}S.step=Math.min(4,S.step+1);return redraw();}
  if(a==='chip'){const k=b.dataset.k,L=Array.isArray(S.draft[k])?S.draft[k]:[],i=L.indexOf(v);if(i<0)L.push(v);else L.splice(i,1);S.draft[k]=L;return redraw();}
  if(a==='pick1'){S.draft[b.dataset.k]=S.draft[b.dataset.k]===v?'':v;return redraw();}
  if(a==='mode'){if(S.follow)S.follow.mode=v;return redraw();}
  if(a==='unk'){S.unk=true;return redraw();}
  if(a==='unkback'){S.unk=false;return redraw();}
  if(a==='unksave')return saveUnknown();
  if(a==='save')return save();
 }
 function onInput(e){
  const i=e.target.closest&&e.target.closest('[data-ifxf]');if(!i||!i.closest('[data-ifx-panel]'))return;const S=st();if(!S)return;const k=i.dataset.ifxf,v=i.value;
  if(k==='__basis')S.basis=v;else if(k==='__unk')S.unkNote=v;else if(k==='__ftext'){if(S.follow)S.follow.text=v;}else if(k==='__fdue'){if(S.follow){S.follow.due=v;if(e.type==='change')redraw();}}else S.draft[k]=v;
 }
 if(root.document){root.document.addEventListener('click',onClick,true);root.document.addEventListener('input',onInput,true);root.document.addEventListener('change',onInput,true);
  root.document.addEventListener('keydown',e=>{if(e.target.closest&&e.target.closest('[data-ifx-panel]'))e.stopPropagation();},true);}
 /* 목록 줄에 남기는 한 줄: 확인 불가로 남긴 건 */
 function unknownNote(x){
  if(!on()||!x||!x.row)return '';const d=x.row.item,f=curFields(d),c=curCtx(d);
  for(const k of Object.keys(KIND)){const K=KIND[k];if(f[K.checkKey]==='확인 불가')return K.unkWord+(c.edited_at?' · '+md(dayKey(c.edited_at))+' 확인':'')+' · 판정 불가 유지';}
  return '';
 }
 root.InlineFix={on,kindOf,openKey,toggle,html,candidates,judge,propose,check,unknownNote,KIND,setFinder:f=>{finder=f;},_explicitDate:explicitDate,_weekday:weekday};
})(window);
