/* 결정 일정 · 견적팀 협업 · 진척 ≠ 접촉 · 하자 · 정보 확인 상태 (2026-10-07 design_handoff_decision_collab ①~⑤ · 시안 '결정 일정 · 협업 시안.dc.html')
   배치 · 디자인은 기존 그대로 — 상세 오른쪽 '이 단계 필수 정보' 아래에 상자 하나(.dcb)를 덧붙인다. 저장은 기존 내부 메모 경로(DealDetailV3.memo) + 기록 머리 표식 · 새 저장소 없음.
   표식: '[결정 일정] 종류 | 날짜 | 확인됨·추정·미확인 | 출처' / '[막힌 곳] 고객·내부 · 견적팀·내부 · 자료 부족 | 상태 | 담당 | 기한 | 견적팀 단계' · '[막힌 곳 해제]'
         '[진척] 종류 | 날짜' / '[하자] 내용 | 접수 날짜 | 담당 | 약속 날짜 | 미해결·해결' / '[확인] 항목 | 확인됨·추정·미확인 | 출처 | 날짜'
   ① 결정 일정 타임라인 + 회의 기준 자동 할 일(D-5 자료 준비 · D-3 발송 + 수신 확인 · D+1 결과 확인) · 회의 전은 '고객 합의 대기'(PipelineJudge · 무연락 경고 없음)
   ② 막힌 곳 꼬리표(목록 '현재 상황' 앞) · 내부면 고객 미응대로 안 셈 · 견적팀 5단계(요청 → 자료 확인 → 보완 요청 → 검토 → 발행) · [견적팀에 확인] = 문구 복사
   ③ 진척 이벤트(방문 확정 · 예산 확인 · 견적 요청 · 결정권자 확인 · 회의 상정 — 단계 필드에서 자동 + 직접 기록) ≠ 접촉 · 목록 꼬리표 '연락 n회 · 진척 없음 n일'(주황)
   ④ 하자 · 불만 — 미해결이면 확장관리 재영업 대신 '하자 먼저' · 해결 기록이면 자동 해제   ⑤ 정보 확인 상태(주소 · 예상 금액 · 공사 예정 · 결정권자) 확인됨 / 추정 / 미확인 + 출처 · 확인일 · 6개월 지나면 '다시 확인'
   끄기: G.decisionCollabOff=true */
(function(root){
 'use strict';
 const h=v=>root.esc(String(v==null?'':v)),attr=v=>root.escAttr(String(v==null?'':v));
 const on=()=>!(root.G&&root.G.decisionCollabOff);
 const KST=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'});
 const today=()=>KST.format(new Date()),dayKey=v=>{const s=String(v||'');if(/^\d{4}-\d{2}-\d{2}$/.test(s))return s;const t=Date.parse(s);return Number.isFinite(t)?KST.format(new Date(t)):'';};
 const addDays=(k,n)=>{const d=new Date(k+'T00:00:00');d.setDate(d.getDate()+n);return KST.format(d);};
 const daysBetween=(a,b)=>Math.round((Date.parse(b+'T00:00:00')-Date.parse(a+'T00:00:00'))/864e5);
 const md=k=>{const m=/^(\d{4})-(\d{2})(?:-(\d{2}))?/.exec(String(k||''));return m?(m[3]?(+m[2])+'.'+(+m[3]):m[1]+'.'+(+m[2])):String(k||'');};
 const dot=k=>{const m=/^(\d{4})-(\d{2})-(\d{2})/.exec(String(k||''));return m?m[1]+'.'+(+m[2])+'.'+(+m[3]):String(k||'');};
 const DEC_TYPES=['관리소장 변경','대표회의 상정','입대의 회의','예산 편성','현설','입찰','공사 예정'],MEET=['대표회의 상정','입대의 회의','현설','입찰'];
 const CONF=['확인됨','추정','미확인'],BLOCK=['고객','내부 · 견적팀','내부 · 자료 부족'],QSTEP=['요청','자료 확인','보완 요청','검토','발행'],PRG=['방문 확정','예산 확인','견적 요청','결정권자 확인','회의 상정'],INFO=['주소','예상 금액','공사 예정','결정권자'];
 const toast=(m,k)=>{if(typeof root.toast==='function')root.toast(m,k);};
 const acts=d=>{let p={};try{p=root.itemPatch?root.itemPatch(d,'deal')||{}:{};}catch(e){}return [].concat(d.activities||[],p.activities||[]).filter(a=>a&&a.note).map(a=>({note:String(a.note),at:dayKey(a.at||a.occurred_at||a.created_at)||'',id:a.id||''}));};
 const parts=s=>String(s).split('|').map(x=>x.trim());
 /* ── 읽기 ── */
 function list(d){
  const out={dec:[],blk:null,blkAt:'',prg:[],def:[],chk:{}};if(!d)return out;const stored=root.ActivityContext?.of?.(d);if(stored)return stored;
  acts(d).sort((a,b)=>a.at.localeCompare(b.at)).forEach(a=>{const n=a.note.replace(/\s*\[연결 [^\]]*\]/g,'');
   let m;
   if((m=/^\[결정 일정\]\s*(.*)$/.exec(n))){const p=parts(m[1]);if(p[0])out.dec.push({type:p[0],date:p[1]||'미정',conf:CONF.includes(p[2])?p[2]:'미확인',src:p[3]||'',at:a.at});return;}
   if(/^\[막힌 곳 해제\]/.test(n)){out.blk=null;out.blkAt=a.at;return;}
   if((m=/^\[막힌 곳\]\s*(.*)$/.exec(n))){const p=parts(m[1]);out.blk={who:BLOCK.includes(p[0])?p[0]:'고객',st:p[1]||'',owner:p[2]||'',due:p[3]&&p[3]!=='없음'?p[3]:'',step:QSTEP.includes(p[4])?p[4]:'',at:a.at};out.blkAt=a.at;return;}
   if((m=/^\[진척\]\s*(.*)$/.exec(n))){const p=parts(m[1]);if(p[0])out.prg.push({type:p[0],date:p[1]||a.at,at:a.at,manual:true});return;}
   if((m=/^\[하자\]\s*(.*)$/.exec(n))){const p=parts(m[1]);if(p[0])out.def.push({text:p[0],recv:(p[1]||'').replace(/^접수\s*/,''),owner:(p[2]||'').replace(/^담당\s*/,''),due:(p[3]||'').replace(/^약속\s*/,''),state:/해결$/.test(p[4]||'')&&!/미해결/.test(p[4]||'')?'해결':'미해결',at:a.at});return;}
   if((m=/^\[확인\]\s*(.*)$/.exec(n))){const p=parts(m[1]);if(INFO.includes(p[0]))out.chk[p[0]]={conf:CONF.includes(p[1])?p[1]:'미확인',src:p[2]||'',date:p[3]||a.at};return;}
  });
  /* 같은 종류의 결정 일정은 가장 나중 기록이 정본 */
  const byType=new Map();out.dec.forEach(x=>byType.set(x.type,x));out.dec=[...byType.values()].sort((a,b)=>String(a.date).localeCompare(String(b.date)));
  /* 하자는 같은 내용의 마지막 상태 */
  const byDef=new Map();out.def.forEach(x=>byDef.set(x.text,x));out.def=[...byDef.values()];
  return out;
 }
 /* ① 회의 전 = 고객 합의 대기: 가장 가까운 앞으로의 회의 · 입찰 일정(확인됨 · 추정) */
 function decWaiting(d){
  if(!on()||!d)return null;const t=today();
  const up=list(d).dec.filter(x=>MEET.includes(x.type)&&/^\d{4}-\d{2}-\d{2}$/.test(x.date)&&x.date>=t&&x.conf!=='미확인').sort((a,b)=>a.date.localeCompare(b.date))[0];
  return up?{label:up.type,date:up.date,conf:up.conf}:null;
 }
 const autoTodos=w=>w?[[addDays(w.date,-5),'회의 자료 준비 (견적 · 시공 사례)'],[addDays(w.date,-3),'자료 발송 + 수신 확인'],[addDays(w.date,1),'회의 결과 확인 → 진행 · 보류 · 종결 판단']]:[];
 /* ③ 진척 이벤트: 단계 필드에서 자동 + 직접 기록 */
 function progress(d){
  const L=list(d),c=d.stage_contexts||{},f=(s,k)=>{const x=c[s];return x&&x.fields?x.fields[k]:'';},anyF=k=>{let v='';Object.keys(c).some(s=>{const x=c[s]&&c[s].fields&&c[s].fields[k];if(x){v=x;return true;}return false;});return v;};
  const ev=[];const push=(type,date)=>{const k=dayKey(date)||'';ev.push({type,date:k});};
  const mt=f('consulting','meeting_date')||f('first_contact','meeting_date');if(mt)push('방문 확정',mt);
  if(f('consulting','quote_request')||f('consulting','quote_due'))push('견적 요청',f('consulting','quote_due')||'');
  if(anyF('speaker')||d.decision_maker)push('결정권자 확인','');
  L.dec.filter(x=>MEET.includes(x.type)).forEach(x=>push('회의 상정 · '+x.type,x.date));
  L.prg.forEach(x=>push(x.type,x.date));
  const seen=new Set();return ev.filter(x=>{const k=x.type+'|'+x.date;if(seen.has(k))return false;seen.add(k);return true;}).sort((a,b)=>String(a.date).localeCompare(String(b.date)));
 }
 function touches(d){let L=[];try{const CS=root.ContactState,v=CS?CS.of(d,'deal'):null;L=v&&Array.isArray(v.logs)?v.logs:[];}catch(e){}if(!L.length){try{L=acts(d).filter(a=>!/^\[/.test(a.note)).map(a=>({at:a.at}));}catch(e){}}return L;}
 /* 목록 꼬리표 */
 function tags(d){
  if(!on()||!d)return {block:'',stale:'',defect:false};
  const L=list(d),block=L.blk?L.blk.who:'';
  const P=progress(d),T=touches(d),n=T.length,lastP=P.map(x=>x.date).filter(Boolean).sort().pop()||'',lastT=T.map(x=>dayKey(x.at||x.lastAt||'')).filter(Boolean).sort().pop()||'';
  let stale='';const since=lastP?daysBetween(lastP,today()):(lastT?daysBetween(dayKey(d.created||d.created_at)||lastT,today()):null);
  if(n>=3&&(!lastP||since>=30)&&since!==null)stale='연락 '+n+'회 · 진척 없음 '+since+'일';
  return {block,stale,defect:L.def.some(x=>x.state==='미해결'),blk:L.blk};
 }
 const openDefect=d=>list(d).def.find(x=>x.state==='미해결')||null;
 /* ⑤ 정보 확인 상태 */
 function infoRows(d){
  const L=list(d),c=d.stage_contexts||{},anyF=k=>{let v='';Object.keys(c).some(s=>{const x=c[s]&&c[s].fields&&c[s].fields[k];if(x){v=x;return true;}return false;});return v;};
  let addr='';try{addr=String(d.address||d.site_address||d.addr||'');}catch(e){}
  let amt='';try{const a=Number(root.oppAmt?root.oppAmt(d):d.amount||d.amt);amt=a>0?(root.fmtAmt?root.fmtAmt(a):String(a)):'';}catch(e){}
  const decW=L.dec.find(x=>x.type==='공사 예정'),when=decW?decW.date:(anyF('expected_timing')||anyF('expected_contract')||d.construction_year||d.relate_planned_construction_year||'');
  const who=anyF('speaker')||d.decision_maker||'';
  const vals={'주소':addr,'예상 금액':amt,'공사 예정':String(when||''),'결정권자':String(who||'')};
  return INFO.map(k=>{const v=vals[k],c0=L.chk[k]||(k==='공사 예정'&&decW?{conf:decW.conf,src:decW.src,date:decW.at}:null);let conf=c0?c0.conf:(v?'추정':'미확인'),note=c0?(c0.src?c0.src+' · ':'')+dot(c0.date):(v?'출처 미기록':'근거 없음');
   if(c0&&c0.conf==='확인됨'&&c0.date&&daysBetween(c0.date,today())>183){conf='다시 확인';note='확인한 지 6개월 지남 · '+note;}
   return {k,v:v||'미입력',conf,note};});
 }
 /* ⑥ 바꾼 기록(단계 · 담당 · 변화 이벤트의 금액) 전 → 후 · 누가 · 언제 · 이유 + [되돌리기](단계 = 전환 창으로 · 담당 = 담당 정하는 칸에 이전 담당 미리 넣음 · 금액 = 관리자 승인 요청). 되돌리기도 기록으로 남는다(같은 저장 경로) */
 function changes(d){
  const out=[];
  try{(d.stageHistory||[]).forEach(x=>{if(!x||!x.to)return;out.push({kind:'stage',f:'단계',a:x.from?(root.stageLabel?root.stageLabel(x.from):x.from):'',b:root.stageLabel?root.stageLabel(x.to):x.to,raw:x,who:[dot(dayKey(x.at)),x.actor||x.actor_name||''].filter(Boolean).join(' · '),at:dayKey(x.at)});});}catch(e){}
  try{const DO=root.DealOwner;(DO&&DO.history?DO.history(d):[]).forEach(x=>{const m=/^담당 변경 (.+?) → (.+?)(?: · 사유: (.*?))?(?: · (귀속.*))?$/.exec(String(x.t||''));if(!m)return;out.push({kind:'owner',f:'담당',a:m[1],b:m[2],who:[dot(x.k),m[3]||''].filter(Boolean).join(' · '),at:x.k||''});});}catch(e){}
  try{const CE=root.ChangeEvent;(CE&&CE.list?CE.list(d):[]).forEach(e=>{const money=/금액|예산/.test(e.type);out.push({kind:money?'amount':'event',f:e.type,a:e.from&&e.from!=='미기록'?e.from:'',b:e.to,who:[dot(e.date),e.act?'확인: '+e.act:''].filter(Boolean).join(' · '),at:e.date});});}catch(e){}
  return out.sort((a,b)=>String(b.at).localeCompare(String(a.at))).slice(0,6);
 }
 function revert(d,c){
  if(c.kind==='stage'){const from=c.raw&&c.raw.from;if(!from)return toast('이전 단계 기록이 없어 되돌릴 수 없습니다','warn');try{const T=root.StageTransition,cur=root.dealStage(d);if(!T.choices(cur).includes(from))return toast('지금 단계에서 '+c.a+'(으)로 바로 옮길 수 없습니다 — 단계 바꾸기에서 사유와 함께 옮겨 주세요','warn');root.StageTransitionUI.open(d,false,from);toast('되돌리기 = 단계 바꾸기 창 · 사유에 "되돌리기"를 적어 저장하면 기록으로 남습니다');}catch(e){toast('단계 바꾸기 창을 열지 못했습니다','warn');}return;}
  if(c.kind==='owner'){try{const S=root.DealOwnerV2&&root.DealOwnerV2.state?root.DealOwnerV2.state():null;if(S){S.to=c.a;S.why='';S.more='되돌리기';}root.DealDetailV3.openFrom('owner');toast('이전 담당 '+c.a+'을(를) 미리 넣었습니다 — 사유를 고르고 저장하면 기록으로 남습니다');}catch(e){toast('담당 정하는 칸을 열지 못했습니다','warn');}return;}
  if(c.kind==='amount'){try{if(root.ApprovalRequest&&root.ApprovalRequest.open){root.ApprovalRequest.open();toast('실적 · 계약 금액 되돌리기는 관리자 승인이 필요합니다 — 승인 요청에 "'+c.f+' '+c.b+' → '+c.a+' 되돌리기"를 적어 주세요');}else toast('실적 · 계약 금액 되돌리기는 관리자 승인이 필요합니다','warn');}catch(e){}return;}
  toast('이 변화는 응대 기록에서 새 변화 이벤트로 바로잡아 주세요');
 }
 /* ── 상세 오른쪽 상자 ── */
 const pill=c=>'<em class="dcb-c '+(c==='확인됨'?'ok':c==='추정'?'est':c==='다시 확인'?'re':'')+'">'+h(c)+'</em>';
 function html(d){
  const L=list(d),W=decWaiting(d),T=today(),S=st(d);
  const dec=L.dec.length?L.dec.map(x=>{const past=/^\d{4}-\d{2}-\d{2}$/.test(x.date)&&x.date<T;return '<div class="dcb-dec'+(past?' past':'')+'"><b>'+h(/^\d{4}-\d{2}/.test(x.date)?md(x.date):x.date)+'</b><i></i><div><b>'+h(x.type)+'</b><span>'+h(x.src||'출처 미기록')+'</span></div>'+pill(x.conf)+'</div>';}).join(''):'<p class="dcb-none">아직 기록된 결정 일정이 없습니다 — 소장 변경 · 대표회의 · 입대의 회의 · 예산 편성 · 공사 예정을 적어 두면 할 일이 자동으로 잡힙니다</p>';
  const todos=W?'<div class="dcb-auto"><b>'+h(W.label+' '+md(W.date)+' 기준 자동 할 일')+'</b>'+autoTodos(W).map(t=>'<span>'+h(md(t[0]))+' · '+h(t[1])+'</span>').join('')+'<small>회의 전까지 \'고객 합의 대기\' · 7일 무연락 경고 없음</small></div>':'';
  const decForm=S.dec?'<div class="dcb-form"><select data-dcf="type">'+DEC_TYPES.map(t=>'<option>'+t+'</option>').join('')+'</select><input type="date" data-dcf="date" aria-label="날짜"><select data-dcf="conf">'+CONF.map(c=>'<option>'+c+'</option>').join('')+'</select><input data-dcf="src" maxlength="60" placeholder="출처 (예: 관리소장 통화 10.1)"><div class="dcb-fb"><button type="button" data-dc="dec-cancel">취소</button><button type="button" class="go" data-dc="dec-save">추가</button></div></div>':'<button type="button" class="dcb-add" data-dc="dec-open">+ 결정 일정 추가</button>';
  /* ② 막힌 곳 */
  const B=L.blk,blk=B?'<div class="dcb-blk"><em class="dcb-who'+(B.who==='고객'?'':' in')+'">'+h(B.who)+'</em><b>'+h(B.st||'막힌 곳')+'</b><span>'+h([B.owner,B.due?md(B.due)+'까지':''].filter(Boolean).join(' · ')||'담당 · 기한 미기록')+(B.who!=='고객'?' · 고객 미응대 아님':'')+'</span></div>'
   +(B.who==='내부 · 견적팀'?'<div class="dcb-steps">'+QSTEP.map((s,i)=>{const cur=QSTEP.indexOf(B.step),k=i<cur?'done':i===cur?'cur':'';return '<div class="'+k+'"><span></span><b>'+h(s)+'</b></div>';}).join('')+'</div><div class="dcb-fb"><button type="button" data-dc="blk-ask">견적팀에 확인</button><button type="button" data-dc="blk-clear">해제</button></div>':'<div class="dcb-fb"><button type="button" data-dc="blk-clear">해제</button></div>'):'';
  const blkForm=S.blk?'<div class="dcb-form"><select data-dcf="who">'+BLOCK.map(t=>'<option>'+t+'</option>').join('')+'</select><input data-dcf="st" maxlength="80" placeholder="상태 한 줄 (예: 견적 검토 대기 3일)"><input data-dcf="owner" maxlength="30" placeholder="담당"><input type="date" data-dcf="due" aria-label="기한"><select data-dcf="step"><option value="">견적팀 단계 (해당 시)</option>'+QSTEP.map(s=>'<option>'+s+'</option>').join('')+'</select><div class="dcb-fb"><button type="button" data-dc="blk-cancel">취소</button><button type="button" class="go" data-dc="blk-save">저장</button></div></div>':(B?'':'<button type="button" class="dcb-add" data-dc="blk-open">+ 막힌 곳 표시</button>');
  /* ③ 진척 · 접촉 */
  const P=progress(d),TC=touches(d),tg=tags(d);
  const prg='<div class="dcb-two"><div><span>접촉 · 연락함</span>'+(TC.length?'<b>'+TC.length+'회</b><small>'+h(TC.map(x=>dayKey(x.at||x.lastAt||'')).filter(Boolean).sort().slice(-3).map(md).join(' · '))+'</small>':'<small>CRM 연락 기록 없음</small>')+'</div><div class="pg"><span>진척 · 움직임</span>'+(P.length?P.map(x=>'<b>✓ '+h(x.type)+(x.date?' '+h(md(x.date)):'')+'</b>').join(''):'<small>아직 움직임 기록 없음</small>')+'</div></div>'+(tg.stale?'<span class="dcb-stale">'+h(tg.stale)+' — 연락은 많은데 영업이 멈춘 건</span>':'')
   +(S.prg?'<div class="dcb-form"><select data-dcf="ptype">'+PRG.map(t=>'<option>'+t+'</option>').join('')+'<option>기타</option></select><input data-dcf="pnote" maxlength="40" placeholder="기타일 때 내용"><input type="date" data-dcf="pdate" aria-label="날짜" value="'+T+'"><div class="dcb-fb"><button type="button" data-dc="prg-cancel">취소</button><button type="button" class="go" data-dc="prg-save">기록</button></div></div>':'<button type="button" class="dcb-add" data-dc="prg-open">+ 진척 기록</button>');
  /* ④ 하자 */
  const defs=L.def.length?L.def.map(x=>'<div class="dcb-def'+(x.state==='미해결'?' open':'')+'"><b>'+h(x.text)+'</b><span>'+h([x.recv?'접수 '+md(x.recv):'',x.owner?'담당 '+x.owner:'',x.due?'약속 '+md(x.due):''].filter(Boolean).join(' · '))+'</span><em>'+h(x.state)+'</em>'+(x.state==='미해결'?'<button type="button" data-dc="def-done" data-v="'+attr(x.text)+'">해결</button>':'')+'</div>').join(''):'';
  const defForm=S.def?'<div class="dcb-form"><input data-dcf="dtext" maxlength="80" placeholder="내용 (예: 101동 옥상 배수구 주변 들뜸)"><input type="date" data-dcf="drecv" aria-label="접수일" value="'+T+'"><input data-dcf="downer" maxlength="30" placeholder="처리 담당"><input type="date" data-dcf="ddue" aria-label="약속 기한"><div class="dcb-fb"><button type="button" data-dc="def-cancel">취소</button><button type="button" class="go" data-dc="def-save">등록</button></div></div>':'<button type="button" class="dcb-add" data-dc="def-open">+ 하자 · 불만 등록</button>';
  /* ⑤ 정보 확인 상태 */
  const info='<div class="dcb-info">'+infoRows(d).map(r=>'<button type="button" data-dc="chk" data-v="'+attr(r.k)+'" title="누르면 확인 상태 · 출처 입력"><span>'+h(r.k)+'</span><b>'+h(r.v)+'</b>'+pill(r.conf)+'<small>'+h(r.note)+'</small></button>').join('')+'</div>'
   +(S.chk?'<div class="dcb-form"><b class="dcb-fl">'+h(S.chk)+'</b><select data-dcf="cconf">'+CONF.map(c=>'<option>'+c+'</option>').join('')+'</select><input data-dcf="csrc" maxlength="60" placeholder="출처 (예: 관리소장 통화 10.1)"><div class="dcb-fb"><button type="button" data-dc="chk-cancel">취소</button><button type="button" class="go" data-dc="chk-save">저장</button></div></div>':'');
  /* ⑥ 바꾼 기록 */
  const CH=changes(d),chg=CH.length?CH.map((c,i)=>'<div class="dcb-chg"><span><b>'+h(c.f)+'</b> '+(c.a?'<s>'+h(c.a)+'</s> → ':'')+'<b>'+h(c.b)+'</b></span><button type="button" data-dc="revert" data-i="'+i+'"'+(c.kind==='event'?' disabled title="변화 이벤트는 새 기록으로 바로잡습니다"':'')+'>'+(c.kind==='amount'?'승인 요청':'되돌리기')+'</button><small>'+h(c.who||'기록 시각 없음')+'</small></div>').join('')+'<small class="dcb-fn">되돌리기도 기록으로 남음 · 실적 · 계약 금액은 관리자 승인 필요</small>':'<p class="dcb-none">아직 바뀐 기록이 없습니다</p>';
  return '<h3>고객 결정 일정'+(W?' <span class="dcb-wait">고객 합의 대기 · '+h(W.label+' '+md(W.date))+'</span>':'')+'</h3>'+dec+todos+decForm
   +'<h4>막힌 곳 · 고객인가 내부인가</h4>'+blk+blkForm
   +'<h4>진척과 접촉 따로</h4>'+prg
   +'<h4>미해결 불만 · 하자</h4>'+(defs||'<p class="dcb-none">미해결 하자 · 불만이 없습니다</p>')+defForm
   +'<h4>정보 확인 상태</h4>'+info
   +'<h4>바꾼 기록 · 전후 비교 · 되돌리기</h4>'+chg+(S.err?'<p class="dcb-err">'+h(S.err)+'</p>':'');
 }
 const st=d=>{const k=String(d&&d.id||'');const S=root.G.dcb||(root.G.dcb={});if(S.id!==k)Object.assign(S,{id:k,dec:false,blk:false,prg:false,def:false,chk:'',err:'',busy:false});return S;};
 function mount(right,d,after){
  if(!on()||!right||!d)return;let sec=right.querySelector(':scope>.dcb');
  const anchor=(after&&after.nextElementSibling&&after.nextElementSibling.classList.contains('dv3-slot'))?after.nextElementSibling:after;
  if(!sec){sec=document.createElement('section');sec.className='dcard dv3-made dcb';if(anchor)anchor.after(sec);else right.append(sec);}
  const html_=html(d);if(sec.__h!==html_){sec.__h=html_;sec.innerHTML=html_;}
 }
 const paint=()=>{try{root.DealDetailV3&&root.DealDetailV3.apply();}catch(e){}try{root.paint();}catch(e){}};
 async function save(d,text){const S=st(d);if(S.busy)return;S.busy=true;S.err='';try{await root.DealDetailV3.memo(d,text,{});root.ActivityContext?.clear?.();S.busy=false;S.dec=S.blk=S.prg=S.def=false;S.chk='';toast('기록했습니다');paint();}catch(e){S.busy=false;S.err=String(e&&e.message||e);paint();}}
 root.addEventListener?.('activity-context:changed',()=>{const d=root.CUR_DETAIL?.kind==='deal'&&root.CUR_DETAIL.item,sec=document.querySelector('#detailView .dcb');if(d&&sec&&!sec.querySelector('.dcb-form')){const next=html(d);if(sec.__h!==next){sec.__h=next;sec.innerHTML=next;}}else if(!root.CUR_DETAIL&&!document.activeElement?.matches?.('input,textarea,select,[contenteditable]')){try{root.paint?.();}catch(e){}}});
 const val=(sec,k)=>{const n=sec.querySelector('[data-dcf="'+k+'"]');return n?String(n.value||'').trim():'';};
 document.addEventListener('click',e=>{
  const b=e.target.closest('.dcb [data-dc]');if(!b)return;const cur=root.CUR_DETAIL,d=cur&&cur.kind==='deal'?cur.item:null;if(!d)return;const a=b.dataset.dc,sec=b.closest('.dcb'),S=st(d);e.preventDefault();e.stopPropagation();
  if(a==='dec-open'){S.dec=true;return paint();}if(a==='dec-cancel'){S.dec=false;return paint();}
  if(a==='dec-save'){const t=val(sec,'type'),dt=val(sec,'date')||'미정',c=val(sec,'conf'),s=val(sec,'src');return save(d,'[결정 일정] '+t+' | '+dt+' | '+c+' | '+(s||'출처 미기록'));}
  if(a==='blk-open'){S.blk=true;return paint();}if(a==='blk-cancel'){S.blk=false;return paint();}
  if(a==='blk-save'){const w=val(sec,'who'),t=val(sec,'st'),o=val(sec,'owner'),du=val(sec,'due'),sp=val(sec,'step');if(!t){S.err='상태 한 줄을 적어 주세요.';return paint();}return save(d,'[막힌 곳] '+w+' | '+t+' | '+(o||'담당 미기록')+' | '+(du||'없음')+' | '+(sp||'없음'));}
  if(a==='blk-clear')return save(d,'[막힌 곳 해제] 풀림 · '+today());
  if(a==='blk-ask'){const B=list(d).blk||{},txt=(B.owner||'견적팀')+'님, '+String(d.site||'')+' 견적 '+(B.step?B.step+' 단계':'')+' 진행 확인 부탁드립니다'+(B.due?' ('+md(B.due)+'까지)':'');try{navigator.clipboard&&navigator.clipboard.writeText(txt);}catch(e){}toast('견적팀 확인 문구를 복사했습니다 — 잔디 · 문자로 보내 주세요');return;}
  if(a==='prg-open'){S.prg=true;return paint();}if(a==='prg-cancel'){S.prg=false;return paint();}
  if(a==='prg-save'){let t=val(sec,'ptype');const n=val(sec,'pnote'),dt=val(sec,'pdate')||today();if(t==='기타')t='기타: '+(n||'내용 미기록');return save(d,'[진척] '+t+' | '+dt);}
  if(a==='def-open'){S.def=true;return paint();}if(a==='def-cancel'){S.def=false;return paint();}
  if(a==='def-save'){const t=val(sec,'dtext');if(!t){S.err='하자 · 불만 내용을 적어 주세요.';return paint();}return save(d,'[하자] '+t+' | 접수 '+(val(sec,'drecv')||today())+' | 담당 '+(val(sec,'downer')||'미지정')+' | 약속 '+(val(sec,'ddue')||'없음')+' | 미해결');}
  if(a==='def-done'){const x=list(d).def.find(y=>y.text===b.dataset.v);if(!x)return;return save(d,'[하자] '+x.text+' | 접수 '+(x.recv||'미기록')+' | 담당 '+(x.owner||'미지정')+' | 약속 '+(x.due||'없음')+' | 해결');}
  if(a==='revert'){const c=changes(d)[Number(b.dataset.i)];if(c)revert(d,c);return;}
  if(a==='chk'){S.chk=b.dataset.v;return paint();}if(a==='chk-cancel'){S.chk='';return paint();}
  if(a==='chk-save'){const k=S.chk,c=val(sec,'cconf'),s=val(sec,'csrc');return save(d,'[확인] '+k+' | '+c+' | '+(s||'출처 미기록')+' | '+today());}
 },true);
 /* ⑦ 같은 고객 경고 묶음: 오늘 업무가 쓴다 — 다음 알림 기준(처리 = 끔 / 보류 · 대기 = 재개일 / 기한 변경 = 새 기한 하루 전 / 같은 내용 하루 1회) */
 function nextAlert(d){
  if(!d)return '같은 내용 하루 1회';
  try{const J=root.PipelineJudge,b=J&&J.on()?J.basis(d):null;if(b&&(b.src==='wait'||b.src==='decide'))return '다음 알림 '+md(b.due)+' (재개 · 회의일)';if(b&&b.kind==='date'&&b.due&&b.n>1)return '다음 알림 '+md(addDays(b.due,-1))+' (기한 하루 전)';}catch(e){}
  return '처리하면 끔 · 같은 내용 하루 1회';
 }
 root.DecisionCollab={on,list,decWaiting,autoTodos,progress,touches,tags,openDefect,infoRows,changes,revert,nextAlert,html,mount,DEC_TYPES,MEET,CONF,BLOCK,QSTEP,PRG,INFO};
})(window);
