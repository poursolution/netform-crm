/* 견적문의 상세 모달 v2 (2026-10-01 디자인 핸드오프 'design_handoff_today_inquiry' ③)
   기존 상세(InquiryWorkbench.dialog)가 그려진 직후 그 창을 새 3열 배치로 바꿔 끼운다.
   저장은 전부 기존 함수를 부른다 —
     배정: inqCtlAssignInline → inqCtlChooseRep → inqCtlConfirmAssign / inqCtlConfirmBranchHandoff
     통화 기록: InquiryWorkbench.saveProcess(=iqApply, #iq-did·#iq-res·#iq-next·#iq-due)
     문자 기록·내부 메모: splitSaveLog(#spLogType·#spLogNote)
     확인 항목: splitCheck(i, checked)
     현장방문·견적(→ 파이프라인 자동 유입): splitSaveNext + splitSaveStatus(#spStatus)
   그래서 서버 전송·권한·자동 유입 규칙은 그대로다. DB·서버 권한은 건드리지 않는다.
   끄기: G.inqDetailV2Off=true (예전 창 그대로). */
(function(root){
 'use strict';
 const h=v=>root.esc(String(v==null?'':v)),attr=v=>root.escAttr(String(v==null?'':v));
 const W=()=>root.InquiryWorkbench,DAY=864e5;
 const CHECKS=['최초 연락 완료','현장 조건 확인','의사결정권자 확인','견적서 발송 확인','다음 할 일 날짜 확정','후속 통화 기록'];
 const ui={};/* 문의별 입력 상태(다시 그려져도 유지) */
 function st(key){return ui[key]||(ui[key]={tab:'call',text:'',next:'',due:'',open:false,rep:'',reason:'',showAll:false,reassign:false,step:'',visitDate:'',visitTime:'',quoteMode:'예정',quoteAmt:'',quoteDate:''});}
 const today=()=>{const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');};
 const fmt=t=>{const d=new Date(t);if(!Number.isFinite(d.getTime()))return '';const p=n=>String(n).padStart(2,'0');return (d.getMonth()+1)+'/'+d.getDate()+' '+p(d.getHours())+':'+p(d.getMinutes());};
 function acts(q){const p=root.itemPatch(q,'inq')||{},seen=new Set();return [...(q.activities||[]),...(p.activities||[])].filter(a=>{const at=a.at||a.occurred_at||a.created_at,k=a.id||[at,a.type,a.note,a.result].join('|');if(seen.has(k)||!Number.isFinite(Date.parse(at)))return false;seen.add(k);return true;}).sort((a,b)=>Date.parse(a.at||a.occurred_at||a.created_at)-Date.parse(b.at||b.occurred_at||b.created_at));}
 function bubbleKind(a){const t=String(a.type||'');if(a.direction==='inbound'||a.source==='customer'||/수신|고객\s*(회신|응답)/.test(t))return 'in';if(/전화|통화|방문|문자|SMS|카카오|이메일|메일/i.test(t))return 'out';if(/기타|메모/.test(t))return 'memo';return 'sys';}
 function bubbles(q){
  const created=root.inquiryCreatedAt(q),d=q.detail&&typeof q.detail==='object'?q.detail:{},r=q.raw&&typeof q.raw==='object'?q.raw:{},channel=d.channel||q.channel||r['상담채널']||'';
  const list=[{kind:'sys',tag:'접수',who:channel?channel+' 접수':'문의 접수',at:created,text:'견적문의가 접수되었습니다.'}];
  acts(q).forEach(a=>{if(a.type==='체크')return;/* '연락 결과'는 기존 저장 형식상 단계전환 기록(한 일='고객 응대 기록')으로 남는다 — 통화 말풍선으로 보여 준다 */const call=/^고객 응대 기록/.test(String(a.note||''))&&a.result;const kind=call?'out':bubbleKind(a),text=call?String(a.result):[a.note,a.result].filter(v=>v&&String(v).trim()).join('\n');list.push({kind,tag:call?'통화 기록':a.type||'기록',who:a.actor||a.actor_name||'',at:a.at||a.occurred_at||a.created_at,text:text||a.type||''});});
  return list;
 }
 function stepsOf(q){const assigned=root.inquiryAssigned(q),visit=/현장\s*방문|견적.*발송/.test(String(q.status||'')),handed=root.inqCtlConverted(q);const done=[true,assigned,visit||handed,handed],names=['접수','담당 배정','현장방문 · 견적','파이프라인 인계'],cur=done.indexOf(false);return names.map((n,i)=>({name:n,done:done[i],cur:i===cur}));}
 function header(q){
  const owner=root.inquiryRoutedOwner(q),created=Date.parse(root.inquiryCreatedAt(q)||''),days=Number.isFinite(created)?Math.floor((Date.now()-created)/DAY):null,handed=root.inqCtlConverted(q);
  const pill=handed?'<span class="idv-pill ok">파이프라인 인계됨</span>':owner?'<span class="idv-pill">'+h(root.repDisplay(owner))+' 배정됨</span>':'<span class="idv-pill red">미배정'+(days?' · '+days+'일 지남':'')+'</span>';
  const customer=[q.detail?.customerType||q.raw?.['고객유형'],q.contact_name||q.contact].filter(v=>v&&String(v).trim()).join(' · ')||'고객 미입력';
  return '<div class="idv-top"><div class="idv-top1"><span class="idv-brand">'+h(q.brand||root.inquiryBrandOf?.(q)||'브랜드 미지정')+'</span><span class="idv-type">'+h(W().gist(q)||root.inqCtlWorkLabel(q))+'</span><span class="idv-spacer"></span>'+pill+'<button type="button" class="inq-dialog-close idv-close" aria-label="닫기" onclick="InquiryWorkbench.close()">✕</button></div>'
   +'<h2 id="inq-dialog-title">'+h(q.site||'현장명 미입력')+'</h2><p class="idv-sub">'+h(customer)+' · '+h(root.dateTimeLabel?root.dateTimeLabel(root.inquiryCreatedAt(q)):fmt(created))+' 접수</p>'
   +'<div class="idv-steps">'+stepsOf(q).map(s=>'<div class="'+(s.done?'done':s.cur?'cur':'')+'"><i></i><span>'+(s.cur?'지금 · ':'')+h(s.name)+'</span></div>').join('')+'</div></div>';
 }
 function col1(q){
  const map={'문의자':'문의자','문의자 연락처':'연락처','업체·고객정보':'업체','건물주소':'현장 주소','공사유형':'공종','상담채널':'상담 채널','유입경로':'유입 경로','전화 응대자':'전화 응대'},order=['문의자','문의자 연락처','업체·고객정보','건물주소','공사유형','상담채널','유입경로','전화 응대자'];
  const f=new Map(W().sourceFields(q)),rows=order.map(k=>[map[k],f.get(k)||'미입력']),missing=rows.filter(r=>r[1]==='미입력').map(r=>r[0]);
  return '<div class="idv-label">고객 문의 원문</div><blockquote class="idv-quote">'+h(W().originalText(q)||'저장된 문의 원문이 없습니다.')+'</blockquote>'
   +'<div class="idv-label">문의 정보</div><dl class="idv-info">'+rows.map(r=>'<div><dt>'+h(r[0])+'</dt><dd class="'+(r[1]==='미입력'?'warn':'')+'">'+h(r[1])+'</dd></div>').join('')+'</dl>'
   +(missing.length?'<div class="idv-missing">보완 필요 '+missing.length+'개 · '+h(missing.join(' · '))+'</div>':'');
 }
 function col2(q,s){
  const list=bubbles(q),na=root.actionObj(q,root.itemPatch(q,'inq')),contacts=list.filter(b=>b.kind==='out'||b.kind==='in'),last=contacts[contacts.length-1];
  const checks=(root.itemPatch(q,'inq')||{}).checks||[],doneN=CHECKS.filter((_,i)=>checks[i]).length,lastOut=[...list].reverse().find(b=>b.kind==='out');
  const tag={sys:'sys',in:'in',out:'out',memo:'memo'};
  const body=list.map(b=>'<div class="idv-msg '+tag[b.kind]+'"><div class="idv-meta"><em>'+h(b.tag)+'</em>'+(b.who?'<span>'+h(b.who)+'</span>':'')+'<span>'+h(fmt(b.at))+'</span></div><div class="idv-bubble">'+h(b.text)+'</div>'+(b===lastOut&&na&&na.text?'<div class="idv-next">→ 다음 할 일: '+h(na.text)+(na.due?' ('+h(na.due)+')':'')+'</div>':'')+'</div>').join('')
   +(!lastOut&&na&&na.text?'<div class="idv-msg sys"><div class="idv-next">→ 다음 할 일: '+h(na.text)+(na.due?' ('+h(na.due)+')':'')+'</div></div>':'');
  const assignedNow=root.inquiryAssigned(q),tabs=[['call','통화 기록'],['sms','문자 보내기'],['memo','내부 메모']],canWrite=true/* 2026-10-02 대표: 배정 전에도 통화·문자·메모 기록을 남긴다 */,phone=String(q.phone||q.contact_phone||q.raw?.['문의자 연락처']||'').trim();
  const ph={call:'고객과 통화한 내용과 결과를 적어 주세요',sms:'고객에게 보낼 문자를 적어 주세요',memo:'내부에서만 보는 메모'}[s.tab];
  const grow=s.open||s.text;
  const composer=canWrite?'<div class="idv-composer" data-tab="'+s.tab+'"><div class="idv-ctabs"><div role="tablist">'+tabs.map(t=>'<button type="button" role="tab" data-idv="tab" data-v="'+t[0]+'" aria-selected="'+(s.tab===t[0])+'">'+t[1]+'</button>').join('')+'</div><button type="button" class="idv-toggle" data-idv="toggle">'+(s.open?'접기':'확인 항목 '+doneN+'/6 · 다음 할 일')+'</button></div>'
    +'<div class="idv-input"><textarea id="'+(s.tab==='call'?'iq-res':'spLogNote')+'" rows="'+(grow?3:1)+'" data-idv="text" placeholder="'+attr(ph)+'">'+h(s.text)+'</textarea><button type="button" class="idv-save'+(s.text.trim()?' on':'')+'" data-idv="save">저장</button></div>'
    +(s.tab==='call'?'<input type="hidden" id="iq-did" value="고객 응대 기록">':'<select id="spLogType" hidden><option'+(s.tab==='sms'?' selected':'')+'>메일·메시지</option><option'+(s.tab==='memo'?' selected':'')+'>기타</option></select>')
    +'<div class="idv-more"'+(s.open?'':' hidden')+'><div class="idv-checks">'+CHECKS.map((c,i)=>'<button type="button" class="'+(checks[i]?'on':'')+'" data-idv="check" data-v="'+i+'" aria-pressed="'+!!checks[i]+'">'+(checks[i]?'✓ ':'+ ')+h(c)+'</button>').join('')+'</div>'
    +(s.tab==='call'&&assignedNow?'<div class="idv-nextrow"><input id="iq-next" data-idv="next" placeholder="다음 할 일 (예: 견적 확인 전화)" value="'+attr(s.next)+'"><input id="iq-due" data-idv="due" type="date" value="'+attr(s.due)+'"></div>':'')+'</div>'
    +(s.tab==='sms'?'<div class="idv-smsrow"><span>받는 번호 <b>'+h(phone||'연락처 없음')+'</b></span><button type="button" data-idv="sms-copy">문구 복사</button><button type="button" class="go" data-idv="sms-open"'+(phone?'':' disabled')+'>문자 앱으로 열기</button><small>문자 앱에서 보낸 뒤 [저장]을 누르면 대화에 «문자»로 남습니다 · 견적문의 회신은 정보성 안내입니다</small></div>':'')+(s.tab==='call'&&!assignedNow?'<small class="idv-hintline">배정 전 기록입니다 — 다음 할 일은 담당자를 배정한 뒤 정할 수 있습니다</small>':'')+'<div class="spmsg idv-err" id="iq-msg"></div></div>':'<div class="idv-composer idv-locked">담당자를 배정하면 여기에 통화·문자·메모를 남길 수 있습니다.</div>';
  return '<div class="idv-chead"><b>고객과 주고받은 내용</b><span>'+list.length+'건</span><em>'+(last?'마지막 연락 '+h(fmt(last.at))+' · '+h(last.tag):'연락 기록 없음')+'</em></div><div class="idv-thread">'+body+'</div>'+composer;
 }
 /* 배정 목록: 기존 배정 칸(inqCtlAssignInline)이 만든 추천·업무량·근거를 읽어 라디오 행으로 보여 준다 */
 function assignModel(q){
  const box=document.createElement('div');box.innerHTML=root.inqCtlAssignInline(q);
  return [...box.querySelectorAll('.inq-ctl-group')].map(g=>({title:(g.querySelector('.inq-ctl-group-title')?.childNodes[0]?.textContent||'').trim(),count:g.querySelectorAll('.inq-ctl-rep').length,branch:!!g.querySelector('.inq-branch-handoff'),
   reps:[...g.querySelectorAll('.inq-ctl-rep')].map(b=>{const small=(b.querySelector('small')?.textContent||'').split(' · ').map(x=>x.trim()),level=small.find(x=>['여유','보통','과다','실담당 지정 대기'].includes(x))||'';return {name:b.dataset.r,label:(b.querySelector('strong')?.childNodes[0]?.textContent||b.dataset.r).trim(),rec:b.classList.contains('recommended'),level,why:small.filter(x=>x!==level).join(' · ')};})}));
 }
 function col3(q,s){
  const key=root.inqKey(q),admin=root.inqCtlIsAdmin?.(),assigned=root.inquiryAssigned(q),owner=root.inquiryRoutedOwner(q),gn=root.itemOwnerTeam?.(q)==='gyeongnam',handed=root.inqCtlConverted(q);
  if((!assigned||s.reassign)&&admin&&!handed){
   const groups=assignModel(q),all=groups.flatMap(g=>g.reps),hasRec=all.some(r=>r.rec),hiddenN=all.filter(r=>!r.rec).length;
   const lv={'여유':['여유','g'],'보통':['보통','b'],'과다':['많음','r'],'실담당 지정 대기':['지정 대기','b']};
   const row=r=>'<button type="button" class="idv-rep'+(s.rep===r.name?' on':'')+'" role="radio" aria-checked="'+(s.rep===r.name)+'" data-idv="rep" data-v="'+attr(r.name)+'"><i class="idv-radio"></i><span class="idv-repmain"><b>'+h(r.label)+'</b>'+(lv[r.level]?'<em class="'+lv[r.level][1]+'">'+lv[r.level][0]+'</em>':'')+(r.rec?'<u>추천</u>':'')+'<small>'+h(r.why)+'</small></span></button>';
   const list=groups.filter(g=>!g.branch).map(g=>{const reps=g.reps.filter(r=>s.showAll||!hasRec||r.rec||r.name===s.rep);return reps.length?'<div class="idv-group"><div class="idv-gtitle">'+h(g.title)+'<span>'+g.count+'명</span></div>'+reps.map(row).join('')+'</div>':'';}).join('');
   const btn=s.rep==='__branch__'?'경남지사로 인계':s.rep?(all.find(r=>r.name===s.rep)?.label||s.rep)+'에게 배정':'담당자를 선택하세요';
   return '<div class="idv-now red">지금 할 일</div><h3>'+(s.reassign?'담당 변경':'담당자 배정')+'</h3><p class="idv-hint">공종 경험 · 업무량 · 지역 기준 추천</p><div class="idv-assign" role="radiogroup" aria-label="담당자">'+list
    +(hasRec&&hiddenN?'<button type="button" class="idv-link" data-idv="showall">'+(s.showAll?'추천만 보기':'다른 담당자 '+hiddenN+'명 보기')+'</button>':'')
    +'<div class="idv-group"><div class="idv-gtitle">지사</div><button type="button" class="idv-rep'+(s.rep==='__branch__'?' on':'')+'" role="radio" aria-checked="'+(s.rep==='__branch__')+'" data-idv="rep" data-v="__branch__"><i class="idv-radio"></i><span class="idv-repmain"><b>경남지사로 인계</b><small>인계 후 경남지사에서 실담당자를 지정합니다</small></span></button></div></div>'
    +'<div class="idv-foot"><input id="inq-ctl-reason" data-idv="reason" placeholder="배정 사유 '+(s.reassign?'(필수)':'(선택)')+'" value="'+attr(s.reason)+'"><div class="modalerr" id="inq-ctl-error"></div><button type="button" class="idv-primary'+(s.rep?' on':'')+'" data-idv="assign"'+(s.rep?'':' disabled')+'>'+h(btn)+'</button>'+(s.reassign?'<button type="button" class="idv-link" data-idv="cancel-reassign">취소</button>':'')+'</div>';
  }
  if(!assigned)return '<div class="idv-now red">지금 할 일</div><h3>담당자 배정 대기</h3><p class="idv-hint">관리자가 담당자를 배정하면 연락을 시작할 수 있습니다.</p>';
  const head=gn?'<div class="idv-now ok">인계 완료</div><h3>경남지사</h3><p class="idv-hint">경남지사에서 실담당자를 지정합니다.</p>':'<div class="idv-now ok">배정 완료</div><h3>'+h(root.repDisplay(owner))+' 담당</h3><p class="idv-hint">담당자가 연락하면 왼쪽 기록에 쌓입니다</p>';
  let next='';
  if(handed){const d=root.linkedDeal?.(q);next='<div class="idv-card done"><b>파이프라인 인계 완료</b><p>'+h(d?root.stageNoLabel(root.dealStage(d))+' 단계에 등록됨':'영업건으로 전환되었습니다')+(d&&root.oppAmt(d)?' · '+h(root.fmtAmt(root.oppAmt(d))):'')+'</p>'+(d?'<button type="button" class="idv-link" data-idv="goto-deal">파이프라인에서 보기 →</button>':'')+'</div>';}
  else if(!gn){
   const ok=s.step==='visit'?!!s.visitDate:s.step==='quote'?!!(s.quoteAmt||s.quoteDate):false;
   next='<div class="idv-card step"><small>다음 단계</small><b>현장방문 · 견적</b><p>둘 중 하나를 저장하면 파이프라인 ‘컨설팅 설계’ 단계로 자동 등록됩니다</p><div class="idv-two"><button type="button" data-idv="step" data-v="visit" aria-pressed="'+(s.step==='visit')+'">현장방문 일정</button><button type="button" data-idv="step" data-v="quote" aria-pressed="'+(s.step==='quote')+'">견적서 발송</button></div>'
    +(s.step==='visit'?'<div class="idv-fields"><input type="date" data-idv="visitDate" aria-label="방문 날짜" value="'+attr(s.visitDate)+'"><input type="time" data-idv="visitTime" aria-label="방문 시간" value="'+attr(s.visitTime)+'"></div><p class="idv-note">상태가 ‘현장방문 예정’으로 바뀝니다</p>':'')
    +(s.step==='quote'?'<div class="idv-two small"><button type="button" data-idv="quoteMode" data-v="예정" aria-pressed="'+(s.quoteMode==='예정')+'">발송 예정</button><button type="button" data-idv="quoteMode" data-v="완료" aria-pressed="'+(s.quoteMode==='완료')+'">발송 완료</button></div><div class="idv-fields"><input inputmode="numeric" data-idv="quoteAmt" aria-label="예상 금액(만원)" placeholder="예상 금액 (만원)" value="'+attr(s.quoteAmt)+'"><input type="date" data-idv="quoteDate" aria-label="견적 날짜" value="'+attr(s.quoteDate)+'"></div>':'')
    +(s.step?'<button type="button" class="idv-primary'+(ok?' on':'')+'" data-idv="handoff"'+(ok?'':' disabled')+'>저장하고 파이프라인으로</button><div class="idv-err" data-idv-err></div>':'')+'</div>';
  }
  /* 근처 현장: 이미 있는 같은 지역 현장 로직(지역 표기·주소 기준). 거리·지도 자료는 없어 '같은 지역'으로 적는다 */
  let near='';
  if(!gn){const n=W().related(q),list=(n.list||[]).slice(0,5);if(n.region){near='<div class="idv-near"><div class="idv-nhead"><b>근처 현장 '+list.length+'곳</b><span>'+h(n.region)+' · 같은 지역</span></div>'+(list.length?list.map(x=>{const d=x.d,issue=root.issueSet?root.issueSet(d):[],hint=issue.includes('overdue')?'같이 방문 권장':issue.includes('nextMissing')?'방문 시 같이 챙기기':'',amt=root.oppAmt(d);return '<button type="button" class="idv-ncard mine" data-idv="near" data-v="'+attr(root.dealKey(d))+'"><span class="n1"><b>'+h(String(d.site||'').replace(/^\s*\[[^\]]*\]\s*/,''))+'</b><em>(본인)</em></span><span class="n2"><i></i>'+h(root.stageNoLabel(root.dealStage(d)))+' · '+h(root.repN(d.assignee))+(amt?' · '+h(root.fmtAmt(amt)):'')+'</span>'+(hint?'<span class="n3">'+hint+'</span>':'')+'</button>';}).join(''):'<p class="idv-hint">이 지역에 진행 중인 담당 현장이 없습니다.</p>')+'</div>';}}
  return head+next+near+(admin&&!handed?'<button type="button" class="idv-link idv-change" data-idv="reassign">담당 변경</button>':'');
 }
 let curKey=null;
 function reskin(){
  const overlay=document.getElementById('inq-inbox-dialog');if(!overlay||root.G.inqDetailV2Off||overlay.classList.contains('inq-store-view'))return;
  const key=root.G.inqSelKey,q=root.inqCtlFind?.(key,false);if(!q)return;curKey=key;const s=st(key);
  const scroll=overlay.querySelector('.idv-thread')?.scrollTop;
  const dlg=overlay.querySelector('.inq-dialog');if(!dlg)return;
  overlay.classList.add('idv');
  dlg.innerHTML=header(q)+'<div class="idv-body"><aside class="idv-c1" aria-label="문의자와 현장">'+col1(q)+'</aside><main class="idv-c2" aria-label="문의와 응대">'+col2(q,s)+'</main><aside class="idv-c3" aria-label="문의 업무 관리">'+col3(q,s)+'</aside></div>';
  /* 경남지사로 넘긴 문의(본사 관리자): 머리 막대·오른쪽 칸을 '지사 진행 확인'으로 — 담당 변경을 고르는 중에는 기존 배정 칸 그대로 */
  if(!s.reassign){try{root.GyeongnamV2?.decorate?.(dlg,q);}catch(e){}}
  /* 배정 칸을 다시 만들면 기존 배정 상태가 초기화되므로 고른 담당자를 다시 알려 준다 */
  if(s.rep&&s.rep!=='__branch__'&&dlg.querySelector('.idv-assign')){try{root.inqCtlChooseRep(s.rep);}catch(e){}}
  const th=dlg.querySelector('.idv-thread');if(th)th.scrollTop=scroll==null?th.scrollHeight:scroll;
  if(!overlay.__idv){overlay.__idv=true;overlay.addEventListener('click',onClick);overlay.addEventListener('input',onInput);overlay.addEventListener('mousedown',e=>{if(e.target===overlay)W().close();});}
 }
 function repaintLocal(){reskinFrom();}
 function reskinFrom(){const overlay=document.getElementById('inq-inbox-dialog');if(overlay)reskin();}
 function toast(msg,undo){
  document.getElementById('idv-toast')?.remove();const t=document.createElement('div');t.id='idv-toast';t.setAttribute('role','status');t.innerHTML='<span>'+h(msg)+'</span>'+(undo?'<button type="button">되돌리기</button>':'');document.body.append(t);
  if(undo)t.querySelector('button').onclick=()=>{t.remove();undo();};setTimeout(()=>t.remove(),4000);
 }
 function fail(msg){toast(msg);}
 function onInput(e){const k=e.target.dataset?.idv,s=st(curKey);if(!k)return;if(k==='text'){const was=!!s.text.trim();s.text=e.target.value;if(was!==!!s.text.trim())e.target.closest('.idv-input').querySelector('.idv-save').classList.toggle('on',!!s.text.trim());if(e.target.rows<3)e.target.rows=3;}
  else if(['next','due','reason','visitDate','visitTime','quoteDate'].includes(k)){s[k]=e.target.value;if(['visitDate','quoteDate'].includes(k))reskinFrom();}
  else if(k==='quoteAmt'){s.quoteAmt=e.target.value.replace(/[^\d]/g,'');if(e.target.value!==s.quoteAmt)e.target.value=s.quoteAmt;const b=document.querySelector('#inq-inbox-dialog [data-idv="handoff"]');if(b){const ok=!!(s.quoteAmt||s.quoteDate);b.disabled=!ok;b.classList.toggle('on',ok);}}}
 function tempField(tag,id,value){document.getElementById(id)?.remove();const el=document.createElement(tag);el.id=id;el.hidden=true;if(tag==='select'){const o=document.createElement('option');o.value=o.textContent=value;el.append(o);}el.value=value;document.getElementById('inq-inbox-dialog').append(el);return el;}
 function onClick(e){
  const b=e.target.closest('[data-idv]');if(!b||!curKey)return;const k=b.dataset.idv,v=b.dataset.v,s=st(curKey),q=root.inqCtlFind(curKey,false);if(!q)return;
  if(k==='tab'){s.tab=v;return reskinFrom();}
  if(k==='toggle'){s.open=!s.open;return reskinFrom();}
  if(k==='text'){if(e.target.rows<3)e.target.rows=3;return;}
  if(k==='check'){const i=Number(v),cur=((root.itemPatch(q,'inq')||{}).checks||[])[i];root.splitCheck(i,!cur);return;}
  if(k==='rep'){s.rep=v;if(v!=='__branch__'){try{root.inqCtlChooseRep(v);}catch(err){}}return reskinFrom();}
  if(k==='showall'){s.showAll=!s.showAll;return reskinFrom();}
  if(k==='reassign'){s.reassign=true;s.rep='';s.reason='';return reskinFrom();}
  if(k==='cancel-reassign'){s.reassign=false;s.rep='';return reskinFrom();}
  if(k==='step'){s.step=s.step===v?'':v;return reskinFrom();}
  if(k==='quoteMode'){s.quoteMode=v;return reskinFrom();}
  if(k==='near')return W().openRelated(v);
  if(k==='goto-deal')return root.openPromotedDeal();
  if(k==='sms-copy'||k==='sms-open'){const text=s.text.trim(),num=String(q.phone||q.contact_phone||q.raw?.['문의자 연락처']||'').replace(/\D/g,'');if(!text){root.iqMsg('보낼 문구를 먼저 적어 주세요.');return;}const done=()=>toast(k==='sms-copy'?'문구를 복사했습니다':'문자 앱을 엽니다 — 보낸 뒤 [저장]으로 기록을 남겨 주세요');try{const p=navigator.clipboard&&navigator.clipboard.writeText(text);if(p&&p.then)p.then(done).catch(done);else done();}catch(err){done();}if(k==='sms-open'&&num)setTimeout(()=>{location.href='sms:'+num+'?body='+encodeURIComponent(text);},120);return;}
  if(k==='save')return save(q,s);
  if(k==='assign')return assign(q,s);
  if(k==='handoff')return handoff(q,s,b);
 }
 function save(q,s){
  const text=s.text.trim();if(!text)return;
  /* 배정 전 통화 기록: 단계 처리(다음 할 일 필수) 대신 기록만 남긴다 */
  if(s.tab==='call'&&!root.inquiryAssigned(q)){tempField('select','spLogType','전화');tempField('textarea','spLogNote',text);root.splitSaveLog();stampActor(q);s.text='';s.open=false;reskinFrom();toast('통화 기록을 저장했습니다');return;}
  if(s.tab==='call'){
   if(!s.next.trim()||!s.due){s.open=true;reskinFrom();root.iqMsg('다음 할 일과 날짜를 함께 적어 주세요 — 날짜가 없으면 다시 챙길 수 없습니다.');return;}
   const ok=W().saveProcess();if(ok===true){s.text='';s.next='';s.due='';s.open=false;reskinFrom();toast('통화 기록을 저장했습니다');}
   return;
  }
  root.splitSaveLog();stampActor(q);const kind=s.tab==='sms'?'문자 기록':'내부 메모';s.text='';s.open=false;reskinFrom();toast(kind+'을 저장했습니다');
 }
 /* 기록자는 지금 로그인한 사람으로(배정 전에는 담당자가 없다) */
 function stampActor(q){try{const a=(root.itemPatch(q,'inq')||{}).activities,last=a&&a[a.length-1],me=root.repN(root.ME?.name);if(last&&me&&me!=='미배정'&&(!last.actor||last.actor==='미배정'))last.actor=me;root.saveLocal?.();}catch(e){}}
 function assign(q,s){
  if(!s.rep)return;const wasReassign=s.reassign||root.inquiryAssigned(q),key=curKey,site=q.site||'문의';
  if(s.rep==='__branch__'){const M=root.INQ_CTL_MODAL;if(!M)return;M.mode='branch_handoff';M.rep='경남지사';M.team='gyeongnam';M.reportingGroup='external';s.reassign=false;const name=s.rep;s.rep='';root.inqCtlConfirmBranchHandoff();if(root.itemOwnerTeam?.(root.inqCtlFind(key,false))==='gyeongnam'){W().open(key,'none');toast(site+' → 경남지사 인계');}else{s.rep=name;}return;}
  const rep=s.rep,director=!!root.repProfile(rep).directorAssignable;
  try{root.inqCtlChooseRep(rep);root.inqCtlConfirmAssign();}catch(err){fail('배정을 저장하지 못했습니다: '+(err.message||err));return;}
  /* 영업이사는 서버 확인 뒤 반영(기존 규칙) — 그 외는 바로 반영된다 */
  const after=()=>{const now=root.inqCtlFind(key,false);if(now&&root.repN(root.inquiryRoutedOwner(now))===root.repN(rep)){s.reassign=false;s.rep='';s.reason='';if(document.getElementById('inq-inbox-dialog'))reskinFrom();toast(site+' → '+root.repDisplay(rep)+' 배정',wasReassign||director?null:()=>undoAssign(key));return true;}return false;};
  if(!after()&&director){let n=0;const t=setInterval(()=>{if(after()||++n>20)clearInterval(t);},300);}
 }
 function undoAssign(key){
  try{root.INQ_CTL_MODAL={mode:'unassign',keys:[key]};tempField('textarea','inq-ctl-reason','배정 되돌리기');root.inqCtlConfirmReason();toast('배정을 되돌렸습니다');if(root.inqCtlFind(key,false))W().open(key);}
  catch(e){fail('되돌리지 못했습니다. 더보기의 미배정 회수를 이용해 주세요.');}
 }
 function handoff(q,s,btn){
  const key=curKey,site=q.site||'문의',err=document.querySelector('#inq-inbox-dialog [data-idv-err]');
  try{
   let status,text,due;
   if(s.step==='visit'){status='현장방문예정';text='현장방문'+(s.visitTime?' '+s.visitTime:'');due=s.visitDate;}
   else{status=s.quoteMode==='완료'?'견적서 발송완료':'견적서 발송예정';text='견적서 '+(s.quoteMode==='완료'?'발송 후 확인 연락':'발송')+(s.quoteAmt?' · 예상 '+Number(s.quoteAmt).toLocaleString('ko-KR')+'만원':'');due=s.quoteDate||today();}
   if(due&&due>=today()){tempField('input','spNextText',text);tempField('input','spNextDue',due);if(root.splitSaveNext()===false)throw Error('다음 할 일을 저장하지 못했습니다.');}
   if(!document.getElementById('inq-inbox-dialog'))W().open(key,'none');
   if(String(root.inqCtlFind(key,false)?.status||'')!==status){tempField('select','spStatus',status);root.splitSaveStatus();}
   const now=root.inqCtlFind(key,false);s.step='';s.visitDate='';s.visitTime='';s.quoteAmt='';s.quoteDate='';
   if(document.getElementById('inq-inbox-dialog'))reskinFrom();else W().open(key,'none');
   toast(now&&root.inqCtlConverted(now)?site+' → 파이프라인 등록':site+' · 상태를 «'+status+'»(으)로 저장했습니다');
  }catch(e){if(err)err.textContent=e.message||'저장하지 못했습니다.';fail('저장하지 못했습니다: '+(e.message||''));}
 }
 const base=root.paintInq;
 if(typeof base==='function')root.paintInq=function(){const r=base.apply(this,arguments);try{reskin();}catch(err){document.getElementById('inq-inbox-dialog')?.classList.remove('idv');if(root.console)root.console.warn('inquiry detail v2: '+err.message);}return r;};
 root.InquiryDetailV2={reskin,state:st,bubbles};
})(window);
