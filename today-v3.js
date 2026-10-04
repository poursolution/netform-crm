/* 오늘 업무 v3 — 역할별 5화면 (2026-10-04 디자인 핸드오프 'design_handoff_today_v3')
   구조는 모두 같고 내용만 로그인 역할(영업관리 · 대표 · 상무 · 팀장 · 영업사원)에 따라 바뀐다:
   큰 숫자 하나(오늘 할 일 n건 · 묶음 수 + 막대) → 얇은 띠 2줄(단계 · 담당자, 누르면 목록이 좁혀짐) → 묶음 3개(첫 묶음 = 카드 한 줄 4장, 나머지 = 목록)
   → 밀린 건 정리(90일 넘게 기록 없음 · 오늘 할 일과 따로 · 접힘) + 오른쪽(오늘 일정 · 이번 주 마감 · 이번 주 기준).
   큰 숫자 = 묶음 합계 = 목록 줄 수 — 전부 같은 항목 목록에서 센다. 사유는 묶음 제목에 한 번만, 빨강은 첫 묶음에만.
   놓침 판정 · 일정 · 마감 · 기준 계산은 관제탑(today-tower.js)의 것을 그대로 쓴다(시간 기준은 운영 기준 CRMRules → OPS_RULES).
   열기 · 저장은 기존 경로(TodayWorkQueue.open → 상세, 단계 전환 창). 끄기: G.todayV3Off=true → 이전 오늘 업무(관제탑) */
(function(root){
 'use strict';
 const h=v=>root.esc(String(v==null?'':v)),attr=v=>root.escAttr(String(v==null?'':v));
 const T=()=>root.TodayWorkQueue,TT=()=>root.TodayTower;
 const enabled=()=>!root.G.todayV3Off&&!!T()&&!!TT()&&!!TT()._week;
 const st=()=>root.G.today3||(root.G.today3={open:{},more:{},back:false,backOwner:'',fStage:null,fWho:null});
 const RULES=()=>root.OPS_RULES||{};
 const BACK=()=>Number(RULES().longContactDays)||90,STALL_BIG=()=>Number(RULES().todayBigStallDays)||14;
 const CARDS=4,PER=8;
 const BRAND={'석민이앤씨':'#e8590c','POUR솔루션':'#1f9d55','POUR공법':'#7048e8','아파트스퀘어':'#3b6ce4'};
 const STG=[['inq','견적문의'],['cons','컨설팅 설계'],['sent','자료 발송'],['rel','관계관리'],['bid','경쟁·입찰'],['con','계약·시공'],['won','수주·확장']],SNAME=Object.fromEntries(STG);
 const HERO={mgr:'오늘 손댈 것',ceo:'오늘 결정 · 확인할 것',vp:'오늘 할 일',lead:'오늘 할 일',rep:'오늘 할 일'};
 const SUB={mgr:'영업관리 · 팀 전체',ceo:'대표 · 결정과 큰 흐름만',vp:'상무 · 본인 영업 + 결정',lead:'팀장 · 본인 영업 + 팀원 코칭',rep:'내 영업만'};
 const money=n=>{n=Number(n)||0;if(!n)return '';if(n>=1e8)return (Math.round(n/1e7)/10)+'억';if(n>=1e4)return Math.round(n/1e4).toLocaleString('ko-KR')+'만';return n.toLocaleString('ko-KR');};
 const siteShort=s=>String(s||'').replace(/^\s*\[[^\]]*\]\s*/,'');
 const toast=(m,k)=>{if(typeof root.toast==='function')root.toast(m,k);};
 /* 밀린 건: 마지막 기록 뒤 기준 일수(운영 기준 · 기본 90일)를 넘긴 건 — 마감 · 결정 · 배정 · 오늘 약속이 걸린 건은 오늘 할 일에 남긴다 */
 const KEEP=['deadline','decide','assign','tfapprove','transfer'];
 const isBack=i=>i.days>BACK()&&!KEEP.includes(i.rk)&&!(i.x.dueDays!==null&&i.x.dueDays!==undefined&&i.x.dueDays>=0);
 const tier=i=>i.rk==='decide'?0:i.rk==='assign'?0.5:(i.rk==='deadline'||i.rk==='contract'||i.rk==='tfapprove')?1:i.rk==='stallbig'?2:i.urg==='now'?3:i.urg==='today'?4:5;
 const byUrgent=(a,b)=>tier(a)-tier(b)||(a.deadline&&b.deadline?a.deadline.n-b.deadline.n:0)||(b.amt||0)-(a.amt||0)||a.days-b.days;
 /* 과거 영업 정리(이관분) 줄 → 밀린 건 한 줄 */
 function legacyDays(x){let n=null;try{n=root.relationshipMeta(x.item).days;}catch(e){}if(n==null){try{n=root.activityAge(x.item);}catch(e){}}if(n==null){try{n=root.stageAge(x.item);}catch(e){}}return Number(n)||0;}
 /* ── 역할별 묶음 ── */
 function build(X,rows,legacy){
  const W=TT(),role=W.roleOf(X),team=role!=='rep',me=root.repN(root.ME&&root.ME.name),A=W._acts;
  root.G._towerRole=role;
  const M=W.model(X,rows,role),own=i=>i.x.owner===me;
  const fix=i=>{if(own(i)||!team){i.act=A.rep[i.rk]||'전화';i.done=A.done[i.act]||A.done['전화'];}return i;};
  let mine=M.mine.map(fix),teamAll=[];
  if(role==='ceo'||role==='vp')teamAll=W.model(X,rows,'lead').mine;/* 결정 요청 · 큰 금액 정체는 팀 전체에서 본다 */
  const live=mine.filter(i=>!isBack(i)),G=(t,why,bulk,items)=>({t,why,bulk:bulk||'',items});
  let groups=[],backSrc=mine.filter(isBack);
  if(role==='mgr'){
   const g1=live.filter(i=>['assign','first','tfapprove','transfer'].includes(i.rk)||i.x.dueDays===0),s1=new Set(g1.map(i=>i.key));
   const g3=live.filter(i=>!s1.has(i.key)&&i.rk==='contract'),s3=new Set(g3.map(i=>i.key));
   const g2=live.filter(i=>!s1.has(i.key)&&!s3.has(i.key)).sort((a,b)=>((a.days>=7&&a.days<=30)?0:1)-((b.days>=7&&b.days<=30)?0:1)||a.days-b.days);
   groups=[G('오늘 안 넘기면 놓침','배정 '+(root.CRMRules?root.CRMRules.get('assign_minutes'):30)+'분 · 첫 연락 '+(root.CRMRules?root.CRMRules.get('first_contact_hours'):2)+'시간 · 오늘 마감','모두 담당에게 알림',g1.sort(byUrgent)),G('이번 주 새로 멈춘 건','7~30일 사이 기록 없음 · 지금 잡으면 살아남','담당별 코멘트',g2),G('계약 정보 빠짐','계약 · 시공 단계인데 계약일 · 금액 없음 — 실적에 안 잡힘','입력 요청 보내기',g3.sort((a,b)=>(b.amt||0)-(a.amt||0)))];
  }else if(role==='ceo'){
   const g1=teamAll.filter(i=>i.rk==='decide'||i.rk==='tfapprove'),s1=new Set(g1.map(i=>i.key));
   const g2=teamAll.filter(i=>!s1.has(i.key)&&(i.amt||0)>=W._big()&&(i.days>=STALL_BIG()||i.rk==='contract'||i.rk==='stallbig')),s2=new Set(g2.map(i=>i.key));
   const g3=live.filter(i=>own(i)&&!s1.has(i.key)&&!s2.has(i.key));
   groups=[G('대표님 결정 요청','팀이 결정을 기다리는 것 · 미루면 영업이 멈춤','',g1.sort(byUrgent)),G('큰 금액인데 멈춘 건',money(W._big())+' 이상 · '+STALL_BIG()+'일 넘게 진전 없음','',g2.sort((a,b)=>(b.amt||0)-(a.amt||0))),G('본인 영업','대표님이 직접 맡은 현장','',g3.sort(byUrgent))];
   backSrc=mine.filter(i=>own(i)&&isBack(i)&&!s2.has(i.key));
  }else if(role==='vp'){
   const g2=mine.filter(i=>i.rk==='decide').concat(teamAll.filter(i=>i.rk==='tfapprove')),s2=new Set(g2.map(i=>i.key));
   const g3=live.filter(i=>own(i)&&i.rk==='contract'&&!s2.has(i.key)),s3=new Set(g3.map(i=>i.key));
   const g1=live.filter(i=>own(i)&&!s2.has(i.key)&&!s3.has(i.key));
   groups=[G('오늘 연락할 곳','본인 담당 · 오늘 넘기면 놓침','',g1.sort(byUrgent)),G('상무님 결정 요청','팀이 결정을 기다리는 것','',g2.sort(byUrgent)),G('본인 계약 정보 빠짐','실적에 안 잡힘','',g3)];
   backSrc=mine.filter(i=>own(i)&&isBack(i));
  }else if(role==='lead'){
   groups=[G('본인 영업 · 오늘','본인 담당 · 오늘 넘기면 놓침','',live.filter(own).sort(byUrgent)),G('팀원 코칭 · 입찰 준비','팀원이 막힌 곳 · 팀장이 같이 봐야 함','팀원에게 코멘트',live.filter(i=>!own(i)).sort(byUrgent))];
  }else{
   const INFO=['data','stall','contract'],g3=live.filter(i=>INFO.includes(i.rk)),g1=live.filter(i=>!INFO.includes(i.rk)&&(i.urg==='now'||i.urg==='today')),g2=live.filter(i=>!INFO.includes(i.rk)&&i.urg==='week');
   groups=[G('오늘 연락할 곳','오늘 넘기면 놓침','',g1.sort(byUrgent)),G('이번 주 안에','기한 전 미리 챙기기','',g2.sort(byUrgent)),G('정보 채우기','빠지면 실적 · 견적에 안 잡힘','',g3)];
  }
  /* 밀린 건: 기준 일수를 넘긴 항목 + 과거 영업 정리(이관분). 영업관리 · 팀장 = 팀 전체, 그 밖 = 본인 */
  const teamBack=role==='mgr'||role==='lead',seen=new Set();
  const back=backSrc.map(i=>({key:i.key,owner:i.x.owner||'미배정',days:i.days,site:i.i.site,stage:i.sName,amt:i.amt||0,x:i.x}))
   .concat((legacy||[]).filter(x=>teamBack||root.repN(x.owner)===me||!team).map(x=>{let amt=0;try{amt=Number(root.oppAmt(x.item))||0;}catch(e){}return {key:x.key,owner:x.owner||'미배정',days:legacyDays(x),site:x.item.site||x.item.site_name||'현장명 미입력',stage:x.stage||'',amt,x};}))
   .filter(b=>{if(seen.has(b.key))return false;seen.add(b.key);return true;});
  const inGroup=new Set();groups.forEach(g=>{g.items=g.items.filter(i=>{if(inGroup.has(i.key))return false;inGroup.add(i.key);return true;});});
  return {role,team,me,groups,back:back.filter(b=>!inGroup.has(b.key)),teamBack,mine,teamAll};
 }

 /* ── 실행 모드(2026-10-04 시안 갱신 · 운영 기준 4차 1 '영업 실행 큐') ──
    보기 모드와 같은 목록 · 같은 순서를 한 건씩. 저장은 상세와 같은 함수(영업건 = DealDetailV3.record, 문의 = iqApply) → 같은 응대 이력 1줄 + 같은 다음 행동.
    관리자 · 대표가 남의 건을 볼 때는 결과 칩이 '처리함 · 담당에게 보냄 · 담당 확인함 · 보류 · 해당 없음'으로 바뀌고, 영업건이면 내부 메모 한 줄로 남는다(담당의 다음 행동은 건드리지 않음).
    5줄 브리핑 · 다음 행동 제안의 AI 표식, 단계별 확인할 것 5개와 선배 팁은 시안 그대로(문구 = 운영 기준 CRMRules.PHASE4 · 운영하며 조정). 체크는 그 건의 기록에 값이 있을 때만 */
 let EXQ=[];const EPROG={};
 const ORES=[['연결됨','연결됨'],['부재','부재'],['검토중','검토중'],['자료요청','자료요청'],['회신대기','회신대기'],['실주','실주']],MRES=['처리함','담당에게 보냄','담당 확인함','보류','해당 없음'];
 const MNEXT={'처리함':'완료 · 다음 건','담당에게 보냄':'담당 처리 확인 · 내일','담당 확인함':'완료 기준 충족 확인 · 2일 후','보류':'재확인 · 7일 후','해당 없음':'목록에서 제외 (사유 기록)'};
 const ROLE_L={mgr:'영업관리',lead:'팀장',vp:'상무',ceo:'대표',rep:'영업사원'};
 const LINKED=['오늘 업무 카드 · 목록 (보기 모드)','파이프라인 / 견적문의 상세 응대 이력','컨트롤타워 담당자 × 문제 표','영업 대시보드 숫자 · 주간 브리핑','모바일 오늘'];
 const NXT=()=>(root.DealDetailV3&&root.DealDetailV3.NXT)||{'연결됨':['다시 연락',3],'부재':['다시 전화',1],'검토중':['결과 확인',7],'자료요청':['자료 보내기',1],'회신대기':['회신 확인',3]};
 const dayL=n=>n===0?'오늘':n===1?'내일':n+'일 후';
 const hot=v=>/없음|오늘|D-|지남|미입력|미발송|미공유|안 함|안 됨/.test(v||'');
 const startExec=V=>{EXQ=V.groups.flatMap((g,gi)=>g.items.map(i=>({i,g:g.t,first:gi===0})));const S=st();S.exec=true;S.ed={};S.er='';S.em='';S.eerr='';S.ek=EXQ.length?EXQ[0].i.key:'';};
 /* 이 단계에서 확인할 것(최대 5개): 그 건의 기록에 값이 있는지 그대로 본다 */
 function playOf(i){
  const x=i.x,d=x.item,sc=k=>{const c=d&&d.stage_contexts&&d.stage_contexts[k];return c&&c.fields||{};},has=v=>v!=null&&String(v).trim()!==''&&!(Array.isArray(v)&&!v.length),nextOk=!!(x.next&&x.due),tel=!!(i.i&&i.i.digits);
  const raw=d&&d.raw&&typeof d.raw==='object'?d.raw:{},acts=(d&&Array.isArray(d.activities)?d.activities:[]),met=acts.some(a=>/방문|미팅|실측|실사/.test(String(a.type||'')+' '+String(a.note||''))),year=has(sc('first_contact').expected_timing)||has(d&&d.construction_year)||has(raw['공사 시기']),keyman=has(raw['결정권자'])||has(d&&d.keyman);
  let files=0;try{files=x.type==='deal'&&root.execAttachments?(root.execAttachments(d)||[]).length:0;}catch(e){}
  let ok;
  if(x.type==='inq'){let N=[];try{N=root.InquiryListV3&&root.InquiryListV3.need9?root.InquiryListV3.need9(d):[];}catch(e){}const n9=l=>{const r=N.find(n=>n.l===l);return r?!!r.ok:false;};ok=[tel&&!!i.i.name,n9('현재 문제'),n9('공사 범위'),n9('공사 시기'),/방문/.test(String(d.status||'')+' '+String(x.next||''))];}
  else if(i.st==='cons')ok=[met,has(sc('consulting').quote_request)||has(sc('first_contact').work_scope),files>0,year,has(sc('consulting').quote_due)||has(sc('consulting').quote_request)];
  else if(i.st==='sent')ok=[has(sc('sent').sent_date)&&has(sc('sent').recipient),has(sc('sent').reaction)&&sc('sent').reaction!=='확인 전',keyman,has(sc('compete').competitor),has(sc('sent').followup_date)||nextOk];
  else if(i.st==='rel')ok=[nextOk,year,keyman,false,false];
  else if(i.st==='bid')ok=[has(sc('bidding').briefing_date),has(sc('compete').meeting_date),has(sc('compete').competitor)||sc('compete').competition_type==='타공법 비교',keyman,has(sc('bidding').bid_plan)];
  else if(i.st==='con')ok=[has(sc('contract').contract_date)||has(d&&d.contract_date),has(sc('contract').contract_amount)||has(d&&d.contract_amount),has(sc('contract').special_terms),sc('construction').handover==='완료',has(sc('construction').start_date)];
  else ok=[has(sc('completion').completion_date)||has(d&&d.completion_date),nextOk,false,false,has(sc('completion').warranty)];
  const P4=(root.CRMRules&&root.CRMRules.PHASE4)||{playbook:{},playbook_tips:{}},key=x.type==='inq'?'inq':(i.st==='inq'?'cons':i.st),labels=P4.playbook[key]||[];
  return {rows:labels.map((l,n)=>[l,!!ok[n]]),tip:P4.playbook_tips[key]||''};
 }
 function execHtml(V){
  const S=st(),W=TT(),role=V.role,me=V.me,total=EXQ.length,done=EXQ.filter(x=>S.ed[x.i.key]).length,allDone=total>0&&done>=total;
  let idx=EXQ.findIndex(x=>x.i.key===S.ek);if(idx<0){idx=Math.max(0,EXQ.findIndex(x=>!S.ed[x.i.key]));S.ek=EXQ[idx]?EXQ[idx].i.key:'';}
  const bar='<div class="tv3-exbar"><b>실행 모드</b><span>오늘 할 일을 급한 순서대로 한 건씩 · 다 끝나면 목록으로 돌아옵니다</span><u></u><button type="button" data-t3="exit">← 목록으로</button></div>';
  const side='<aside class="tv3-exlist"><div class="hd"><b>오늘 순서 · 위 묶음 그대로</b><b>'+done+' / '+total+'</b></div>'+EXQ.map((x,n)=>{const on=n===idx&&!allDone,dn=!!S.ed[x.i.key];return '<button type="button" class="'+(on?'on':'')+(dn?' dn':'')+'" data-t3="epick" data-key="'+attr(x.i.key)+'"><i>'+(dn?'✓':n+1)+'</i><span><b>'+h(x.i.i.site)+'</b><small'+(x.first?' class="r"':'')+'>'+h(x.i.missTxt)+'</small></span></button>';}).join('')+'</aside>';
  if(allDone)return '<div class="tv3 tv3-ex" data-role="'+role+'" data-exec="done">'+bar+'<div class="tv3-exbody">'+side+'<section class="tv3-exmain"><div class="tv3-exdone"><b>오늘 할 일 끝 · '+total+' / '+total+'</b><span>같은 기록이 상세 · 대시보드 · 브리핑에 그대로 반영됩니다</span><button type="button" data-t3="exit">← 목록으로</button></div></section></div></div>';
  const cur=EXQ[idx],i=cur.i,own=i.x.owner===me,manage=V.team&&!own,k=attr(i.key),contact=[[i.i.name,i.i.role].filter(Boolean).join(' '),i.i.phone].filter(Boolean).join(' · ')||'연락처 확인 필요';
  const nextV=i.rk==='deadline'&&i.deadline?'D-'+i.deadline.n+' '+i.deadline.what:i.x.due?String(i.x.due).slice(5,10).replace('-','.').replace(/^0/,'')+' · '+(i.x.next||'다음 행동'):'없음 · 오늘 잡아야 함';
  const brief=[['마지막 연락',i.support?'[지원 요청] '+i.support.note:i.i.recent||'최근 연락 기록 없음'],['고객 요구',i.i.want||'기록 없음'],['미해결',i.missTxt+(i.short&&!/^(0일|오늘)$/.test(i.short)&&i.rk!=='contract'?' · '+i.short:'')],['담당 · 연락처',(i.x.owner||'미배정')+' · '+contact],['다음 일정',nextV]];
  const res=manage?MRES.map(l=>[l,l]):ORES,nx=!manage&&S.er&&S.er!=='실주'?NXT()[S.er]:null,nextTxt=!S.er?(manage?'담당 처리 확인 · 내일':'통화 결과를 고르면 제안'):manage?MNEXT[S.er]:S.er==='실주'?'실주 처리 · 원인 4분류(관계 / 공법 / 가격 / 사업)':nx?nx[0]+' · '+dayL(nx[1]):'';
  const play=playOf(i);
  const main='<section class="tv3-exmain">'
   +'<div class="tv3-excard" style="border-left-color:'+i.bc+'"><div class="r"><em class="no">'+(idx+1)+' / '+total+'</em><span style="color:'+i.bc+'">'+h(i.brand||'브랜드 미입력')+'</span><em class="st">'+h(SNAME[i.st]||i.sName)+'</em><small>'+h(cur.g)+'</small><u></u><small>'+h((manage?(i.x.owner||'미배정'):([i.i.name,i.i.role].filter(Boolean).join(' ')||'고객 미등록'))+' · '+(i.amt?money(i.amt):'금액 미정'))+'</small></div><b class="site">'+h(i.i.site)+'</b><span class="why">'+h(i.missTxt+(i.short&&!/^(0일|오늘)$/.test(i.short)&&i.rk!=='contract'&&i.rk!=='decide'?' · '+i.short:''))+'</span></div>'
   +'<div class="tv3-brief"><div class="hd"><em class="ai">AI</em><b>'+(manage?'처리 전 5줄':'전화 걸기 전 5줄')+'</b><u></u>'+(manage?'<button type="button" data-t3="act" data-key="'+k+'" data-act="'+attr(i.act)+'"'+(i.i.digits?' data-tel="'+attr(i.i.digits)+'"':'')+'>'+h(i.act)+'</button>':'<button type="button" data-t3="edial" data-tel="'+attr(i.i.digits||'')+'"'+(i.i.digits?'':' disabled')+'>'+(i.i.digits?'전화':'전화번호 없음')+'</button>')+'</div>'
   +brief.map(([l,v])=>{const hh=hot(v)&&l!=='담당 · 연락처';return '<div class="ln"><span>'+l+'</span><span'+(hh?' class="hot"':'')+'>'+h(v)+'</span></div>';}).join('')
   +'<div class="say"><b>'+(manage?'보낼 말':'첫마디')+'</b>'+h(W._line(i,role,me))+'</div></div>'
   +'<div class="tv3-exrec"><div class="tabs"><span class="on">응대 기록</span><button type="button" data-t3="enext" data-key="'+k+'">다음 행동</button><u></u><button type="button" class="more" data-t3="open" data-key="'+k+'">+ 작업</button></div>'
   +'<div class="chips">'+res.map(([l,v])=>'<button type="button" data-t3="eres" data-v="'+attr(v)+'" aria-pressed="'+(S.er===v)+'"'+(S.ebusy?' disabled':'')+'>'+l+'</button>').join('')+'</div>'
   +'<input class="memo" data-t3in="em" value="'+attr(S.em||'')+'" placeholder="무슨 일이 있었는지 한 줄 (선택)" aria-label="한 줄 메모"'+(S.ebusy?' disabled':'')+'>'
   +'<div class="nx"><em class="ai">AI</em><b>다음 행동</b> '+h(nextTxt)+'</div>'+(S.eerr?'<p class="err" role="alert">'+h(S.eerr)+'</p>':'')
   +'<div class="ft"><button type="button" class="save'+(S.er?' on':'')+'" data-t3="esave"'+(S.ebusy?' disabled':'')+'>'+(S.ebusy?'저장 확인 중…':'저장하고 다음 건 →')+'</button></div></div></section>';
  const right='<aside class="tv3-exside"><section><b>이 단계에서 확인할 것 <small>'+h(SNAME[i.st]||i.sName)+'</small></b>'+play.rows.map(([l,ok])=>'<div class="ck'+(ok?' ok':'')+'"><i>'+(ok?'✓':'')+'</i><span>'+h(l)+'</span></div>').join('')+(play.tip?'<span class="tip"><b>선배 팁</b> '+h(play.tip)+'</span>':'')+'</section><section><b>이 건은 여기서도 같이 바뀝니다</b>'+LINKED.map(l=>'<span class="lk">· '+l+'</span>').join('')+'</section></aside>';
  return '<div class="tv3 tv3-ex" data-role="'+role+'" data-exec="on" data-total="'+total+'">'+bar+'<div class="tv3-exbody">'+side+main+right+'</div></div>';
 }
 /* 문의 저장 = 목록의 줄 안 결과 기록과 같은 함수(InquiryListV3.record) */
 function saveInquiry(q,res,memo){
  const nx=NXT()[res];if(!nx)throw Error('결과를 골라 주세요.');
  const d=new Date();d.setDate(d.getDate()+nx[1]);const due=d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
  /* 첫 응대 = 단계 진행, 이미 응대한 문의 = 다음 할 일 등록(상태는 그대로) — InquiryListV3.record 한 길 */
  if(!root.InquiryListV3||typeof root.InquiryListV3.record!=='function')throw Error('현재 단계는 상세 창에서 처리해 주세요.');
  const ok=root.InquiryListV3.record(q,{res:('[전화 · '+res+'] '+String(memo||'').trim()).trim(),next:nx[0],due})===true;
  if(!ok)throw Error((document.getElementById('iq-msg')||{}).textContent||'저장하지 못했습니다.');
 }
 async function execSave(){
  const S=st(),idx=EXQ.findIndex(x=>x.i.key===S.ek);if(idx<0||!S.er||S.ebusy)return;
  const cur=EXQ[idx],i=cur.i,me=root.repN(root.ME&&root.ME.name),role=root.G._towerRole||'rep',manage=role!=='rep'&&i.x.owner!==me,D=root.DealDetailV3,rerender=()=>root.TodayV2.render();
  S.ebusy=true;S.eerr='';rerender();
  try{
   const P=EPROG[i.key]||(EPROG[i.key]={});
   if(manage){if(i.x.type==='deal'&&D&&D.memo)await D.memo(i.x.item,'['+ROLE_L[role]+' · '+S.er+'] '+i.missTxt+(String(S.em||'').trim()?' — '+String(S.em).trim():''),P);}
   else if(S.er==='실주'){if(i.x.type==='deal'){root.G._detailPopup=true;root.drwDeal(JSON.stringify(i.x.item));setTimeout(()=>{try{root.StageTransitionUI.open(i.x.item,false,'lost');}catch(e){}},350);}else openKey(i.key);}
   else if(i.x.type==='deal'){if(!D||!D.record)throw Error('상세 저장 기능을 불러오지 못했습니다.');await D.record(i.x.item,{ch:'전화',res:S.er,memo:S.em,P});}
   else if(i.x.type==='inq')saveInquiry(i.x.item,S.er,S.em);
   else{openKey(i.key,'contact');}
   S.ed[i.key]=true;delete EPROG[i.key];
   let nx=idx;for(let n=1;n<=EXQ.length;n++){const j=(idx+n)%EXQ.length;if(!S.ed[EXQ[j].i.key]){nx=j;break;}}
   S.ek=EXQ[nx].i.key;S.er='';S.em='';
  }catch(e){S.eerr='저장하지 못했습니다: '+String(e.message||e);}
  S.ebusy=false;rerender();
 }
 /* ── 오른쪽 '회사 이번 주'(대표): 이번 달 수주실적 · 메이드율 · 계약 임박 — 대시보드 · 주간 브리핑과 같은 함수 ── */
 function companyWeek(){
  try{
   const D=root.DashB,B=root.BriefB&&root.BriefB.lib;if(!D||!B)return null;const C=D.core(),P=C.P,pad=n=>String(n).padStart(2,'0'),mk=(y,m)=>{const d=new Date(y,m-1,1);return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-01';};
   const perf=(a,b)=>B.contractsIn(C.L,a,b).net+(C.DW?C.DW.partnerIn(a,b,C.target).amount:0)+(C.DT?C.DT.wonIn(a,b,C.target).amount:0);
   const cur=C.L.ready?perf(mk(P.ty,P.tm),mk(P.ty,P.tm+1)):null,prev=C.L.ready?perf(mk(P.ty,P.tm-1),mk(P.ty,P.tm)):null,pm=new Date(P.ty,P.tm-2,1).getMonth()+1;
   const N=D.nearList(C),hot=N.filter(n=>n.hot).length,sum=N.reduce((s,n)=>s+(n.amount||0),0);
   return [
    {label:'이번 달 수주실적',v:cur===null?'불러오는 중':cur>0?money(cur):'아직 없음',pct:cur&&prev>0?Math.min(100,Math.round(cur/prev*100)):0,bad:cur!==null&&!(prev>0&&cur/prev>=0.5),goal:pm+'월 '+(prev>0?money(prev):'없음')+' · '+P.tm+'월 '+P.td+'일째'},
    {label:'영업 메이드율',v:C.made===null?'아직 없음':C.made.toFixed(1)+'%',pct:C.made||0,bad:C.made!==null&&C.made<50,goal:P.label+' · 배드핏 제외'},
    {label:'계약 임박',v:N.length+'건'+(sum>0?' · '+money(sum):''),pct:Math.min(100,N.length*10),bad:false,goal:'이번 주 기한 '+hot+'건'}];
  }catch(e){return null;}
 }
 /* ── 그리기 ── */
 function html(X,rows,legacy){
  const S=st(),W=TT(),V=build(X,rows,legacy),role=V.role,team=V.team,me=V.me;
  const all=V.groups.flatMap(g=>g.items),total=all.length,gN=V.groups.filter(g=>g.items.length).length,backN=V.back.length;
  if(S.exec){if(!EXQ.length)S.exec=false;else{const d0=new Date();root.G.todayV3Sub=(d0.getMonth()+1)+'월 '+d0.getDate()+'일 ('+'일월화수목금토'[d0.getDay()]+') · '+SUB[role]+' · 실행 모드';return execHtml(V);}}
  const d=new Date();root.G.todayV3Sub=(d.getMonth()+1)+'월 '+d.getDate()+'일 ('+'일월화수목금토'[d.getDay()]+') · '+SUB[role];
  /* 큰 숫자 + 막대 */
  const SEG=['#15171c','#6b7280','#9aa0ab'],segs=V.groups.map((g,i)=>[g.t,g.items.length,SEG[i]||'#9aa0ab',true]).concat([['밀린 건',backN,'#e3e6ec',false]]),sum=segs.reduce((s,x)=>s+x[1],0);
  const hero='<div class="tv3-hero"><div class="n"><span>'+HERO[role]+'</span><b>'+total+'건 <small>· '+gN+'묶음</small></b></div><div class="bar"><div class="track">'+segs.map(s=>'<span style="width:'+(sum?(s[1]/sum*100).toFixed(1):0)+'%;background:'+s[2]+'"></span>').join('')+'</div><div class="leg">'+segs.map(s=>'<span class="'+(s[3]?'on':'')+'">'+h(s[0])+' '+s[1]+'</span>').join('')+'<span class="mut">· 위 '+total+'건 = 앞 묶음 합계</span></div></div>'+(total?'<button type="button" class="tv3-go" data-t3="exec"><span>실행 모드로 처리 →</span><small>한 건씩 · 저장하면 다음 건</small></button>':'')+'</div>';
  /* 띠 2줄: 단계 · 담당자 — 목록에서 센다 */
  const showPeople=role==='mgr'||role==='lead',owners=[...new Set(all.map(i=>i.x.owner||'미배정'))].map(o=>[o,all.filter(i=>(i.x.owner||'미배정')===o).length]).sort((a,b)=>(a[0]==='미배정'?-1:0)-(b[0]==='미배정'?-1:0)||b[1]-a[1]);
  if(S.fStage&&!all.some(i=>i.st===S.fStage))S.fStage=null;if(S.fWho&&(!showPeople||!owners.some(o=>o[0]===S.fWho)))S.fWho=null;
  const strip='<div class="tv3-strip"><div class="ln"><b>단계</b>'+STG.map(([k,l])=>{const n=all.filter(i=>i.st===k).length;return '<button type="button" data-t3="fstage" data-v="'+k+'" aria-pressed="'+(S.fStage===k)+'"'+(n?'':' class="zero"')+'><span>'+l+'</span><b>'+n+'</b></button>';}).join('')+'</div>'
   +(showPeople?'<div class="ln"><b>담당자</b>'+owners.map(([o,n])=>'<button type="button" data-t3="fwho" data-v="'+attr(o)+'" aria-pressed="'+(S.fWho===o)+'"'+(o==='미배정'?' class="un"':'')+'><span>'+h(o)+'</span><b>'+n+'</b></button>').join('')+'</div>':'')
   +'<div class="ft"><span>숫자 = '+HERO[role]+' (합계 '+total+') · 누르면 아래 목록이 좁혀짐</span>'+(S.fStage||S.fWho?'<button type="button" data-t3="clear">'+h(S.fStage?SNAME[S.fStage]:S.fWho)+' · 해제</button>':'')+'</div></div>';
  const pass=i=>(!S.fStage||i.st===S.fStage)&&(!S.fWho||(i.x.owner||'미배정')===S.fWho);
  /* 카드(첫 묶음 · 한 줄 4장) */
  const whoLine=i=>{const own=i.x.owner===me,c=[i.i.name,i.i.role].filter(Boolean).join(' ');return team&&!own?'담당 '+(i.x.owner||'미배정')+' · '+([c,i.i.phone].filter(Boolean).join(' · ')||'연락처 확인 필요'):'담당 '+(c||'고객 미등록')+' · '+(i.i.phone||'연락처 확인 필요');};
  const reasonOf=i=>i.missTxt+(i.rk!=='decide'&&i.short&&!/^(0일|오늘)$/.test(i.short)&&i.rk!=='contract'?' · '+i.short:'');
  const card=(i,n)=>{const open=!!S.open[i.key],k=attr(i.key),own=i.x.owner===me,far=team&&!own;
   return '<article class="tv3-card" data-key="'+k+'" style="border-left-color:'+i.bc+'"><header><i>'+(n+1)+'</i><b title="'+attr(reasonOf(i))+'">'+h(reasonOf(i))+'</b><em>'+h(SNAME[i.st]||i.sName)+'</em></header>'
    +'<div class="who"><span style="color:'+i.bc+'">'+h(i.brand||'브랜드 미입력')+'</span><b title="'+attr(i.i.site)+'">'+h(i.i.site)+'</b><small>'+h(whoLine(i))+'</small></div>'
    +'<dl><dt>원한 것</dt><dd>'+h(i.i.want||'기록 없음')+'</dd><dt>지난 기록</dt><dd>'+h(i.support?'[지원 요청] '+i.support.note:i.i.recent||'최근 연락 기록 없음')+'</dd><dt>금액</dt><dd>'+h(i.amt?money(i.amt):'금액 미정')+'</dd></dl>'
    +'<div class="fold"><button type="button" data-t3="fold" data-key="'+k+'"><span>'+(far?'담당에게 보낼 말 · 놓치면':'첫마디 · 놓치면')+'</span><span>'+(open?'접기 ▴':'펼치기 ▾')+'</span></button>'+(open?'<div class="open"><span>'+h(W._line(i,role,me))+'</span><p><b>놓치면</b> '+h(i.loss)+'</p></div>':'')+'<p class="done"><b>완료 기준</b> <span>'+h(i.done)+'</span></p></div>'
    +'<div class="btns"><button type="button" class="main" data-t3="act" data-key="'+k+'" data-act="'+attr(i.act)+'"'+(i.i.digits?' data-tel="'+attr(i.i.digits)+'"':'')+'>'+h(i.act)+'</button><button type="button" data-t3="'+(far?'reassign':'sms')+'" data-key="'+k+'">'+(far?'재배정':'문자')+'</button><button type="button" data-t3="'+(far?'owner':'result')+'" data-key="'+k+'" data-v="'+attr(i.x.owner||'')+'">'+(far?'담당 화면':'결과 기록')+'</button></div></article>';};
  /* 목록 줄(② ③ · 첫 묶음의 5번째부터) */
  const row=(i,hot)=>{const k=attr(i.key),own=i.x.owner===me,far=team&&!own,who=far?(i.x.owner||'미배정'):([i.i.name,i.i.role].filter(Boolean).join(' ')||(team?i.x.owner:'고객 미등록')),noDay=i.rk==='contract'||i.rk==='data';
   return '<div class="tv3-row" role="button" tabindex="0" data-t3="open" data-key="'+k+'"><span class="bd" style="color:'+i.bc+'">'+h(i.brand||'미입력')+'</span><span class="c"><b>'+h(i.i.site)+'</b><small>'+h([who,i.amt?money(i.amt):'금액 미정',i.missTxt].filter(Boolean).join(' · '))+'</small></span><span class="d"><b'+(hot?' class="r"':'')+'>'+h(noDay?'-':i.short)+'</b><small>'+h(noDay?'':i.rk==='deadline'?(i.deadline?i.deadline.what:'마감'):i.dLabel)+'</small></span><button type="button" data-t3="act" data-key="'+k+'" data-act="'+attr(i.act)+'"'+(i.i.digits?' data-tel="'+attr(i.i.digits)+'"':'')+'>'+h(i.act)+'</button></div>';};
  const groupsHtml=V.groups.map((g,gi)=>{const items=g.items.filter(pass);if(!items.length)return '';const first=gi===0,cards=first?items.slice(0,CARDS):[],rest=first?items.slice(CARDS):items,open=!!S.more[gi],shown=open?rest:rest.slice(0,PER);
   return '<section class="tv3-group'+(first?' first':'')+'" data-g="'+(gi+1)+'"><header><i>'+(gi+1)+'</i><b>'+h(g.t)+'</b><b class="n">'+items.length+'건</b><span>'+h(g.why)+'</span><u></u>'+(g.bulk&&team?'<button type="button" data-t3="bulk" data-v="'+gi+'">'+h(g.bulk)+'</button>':'')+'</header>'
    +(first?'<div class="tv3-cards">'+cards.map(card).join('')+'</div>':'')+shown.map(i=>row(i,first)).join('')
    +(rest.length>PER?'<button type="button" class="tv3-more" data-t3="more" data-v="'+gi+'">'+(open?'접기 ▴':'나머지 '+(rest.length-PER)+'건 더 보기 ▾')+'</button>':'')+'</section>';}).join('');
  const empty=!total?'<div class="tv3-empty">'+(backN?'오늘 손댈 건은 없습니다. 아래 밀린 건만 정리하면 됩니다.':'오늘 처리할 건이 없습니다.')+'</div>':(!groupsHtml?'<div class="tv3-empty">이 조건에 해당하는 건이 없습니다.</div>':'');
  /* 밀린 건 정리 */
  let backHtml='';
  if(backN){
   const by=new Map();V.back.forEach(b=>{const v=by.get(b.owner)||{n:0,old:0,list:[]};v.n++;v.old=Math.max(v.old,b.days||0);v.list.push(b);by.set(b.owner,v);});
   const list=[...by].sort((a,b)=>b[1].n-a[1].n),max=Math.max(1,...list.map(x=>x[1].n)),selfOnly=!V.teamBack;
   const title=(role==='mgr'?'밀린 건 정리':role==='lead'?'팀 밀린 건':role==='rep'?'내 밀린 건':'본인 밀린 건')+' '+backN+'건';
   const subT=BACK()+'일 넘게 기록 없음 · '+(V.teamBack?'오늘 할 일과 따로 · 담당자에게 정리(진행 / 보류 / 실주 / 배드핏) 요청':'진행 / 보류 / 실주 / 배드핏으로 정리하면 오늘 업무가 가벼워집니다');
   if(S.backOwner&&!by.has(S.backOwner))S.backOwner='';
   const tri=b=>{const k=attr(b.key),deal=b.x.type==='deal';return '<div class="tv3-brow"><button type="button" class="o" data-t3="open" data-key="'+k+'"><b>'+h(b.site)+'</b><small>'+h([b.stage,b.amt?money(b.amt):'',b.days?b.days+'일째':''].filter(Boolean).join(' · '))+'</small></button>'+(deal?'<span>'+[['keep','진행'],['hold','보류'],['lost','실주'],['badfit','배드핏']].map(a=>'<button type="button" data-t3="tri" data-key="'+k+'" data-v="'+a[0]+'">'+a[1]+'</button>').join('')+'</span>':'')+'</div>';};
   backHtml='<section class="tv3-back'+(S.back?' open':'')+'"><button type="button" class="hd" data-t3="back" aria-expanded="'+!!S.back+'"><b>'+h(title)+'</b><span>'+h(subT)+'</span><u></u><em>'+(S.back?'접기 ▲':'보기 ▼')+'</em></button>'
    +(S.back?'<div class="bd">'+list.map(([n,v])=>{const mineRow=selfOnly||n===me,on=S.backOwner===n;return '<div class="tv3-bl"><b>'+h(n)+'</b><span class="bar"><i style="width:'+Math.round(v.n/max*100)+'%"></i></span><b class="c">'+v.n+'건</b><small>최장 '+v.old+'일</small><button type="button" data-t3="'+(mineRow?'backdo':'backreq')+'" data-v="'+attr(n)+'">'+(mineRow?(on?'접기':'정리하기'):'정리 요청')+'</button>'+(!mineRow?'<button type="button" class="s" data-t3="backdo" data-v="'+attr(n)+'">'+(on?'접기':'목록')+'</button>':'')+'</div>'
      +(on?'<div class="tv3-bls">'+v.list.slice().sort((a,b)=>b.amt-a.amt||b.days-a.days).slice(0,10).map(tri).join('')+(v.list.length>10?'<p>금액 큰 순 10건 · 정리하면 다음 건이 올라옵니다 (남은 '+(v.list.length-10)+'건)</p>':'')+'</div>':'');}).join('')+'</div>':'')+'</section>';
  }
  /* 오른쪽: 일정 · 마감 · 기준 */
  const rowsMine=role==='ceo'||role==='vp'?rows.filter(x=>x.owner===me):rows,teamSched=role==='mgr'||role==='lead';
  const sc=W._sched(rowsMine,V.mine,teamSched),du=W._dues(role==='mgr'||role==='lead'||role==='ceo'?(V.teamAll.length?V.teamAll:W.model(X,rows,'lead').mine):V.mine.filter(i=>i.x.owner===me||!team));
  const wk=role==='ceo'?(companyWeek()||W._week(X,role)):W._week(X,role==='vp'?'rep':role);
  const schedT=teamSched?'오늘 팀 일정':'오늘 일정',dueT=teamSched?'이번 주 팀 마감':role==='ceo'?'이번 주 결정 마감':'이번 주 마감',weekT=teamSched?'팀 이번 주 기준':role==='ceo'?'회사 이번 주':role==='vp'?'본인 이번 주':'내 이번 주';
  const side='<aside class="tv3-side"><section><header><b>'+schedT+'</b><span>지금 '+new Date().toTimeString().slice(0,5)+'</span></header>'+(sc.length?sc.map(e=>'<div class="tv3-ev" role="button" tabindex="0" data-t3="open" data-key="'+attr(e.key)+'"><b>'+h(e.t)+'</b><i></i><div><small>'+h(e.kind)+'</small><b>'+h(e.site)+'</b><span>'+h(e.note)+'</span>'+(e.risk?'<em>'+h(e.risk)+'</em>':'')+'</div></div>').join(''):'<p class="none">오늘 날짜로 잡힌 일정이 없습니다</p>')+'</section>'
   +'<section><header><b>'+dueT+'</b></header>'+(du.length?du.map(x=>'<div class="tv3-due"><span class="'+(x.hot?'hot':'')+'">'+h(x.dd)+'</span><p><b>'+h(siteShort(x.site))+'</b> <small>'+h(x.what)+'</small></p></div>').join(''):'<p class="none">7일 안 마감(입찰 · 결정 일정)이 없습니다</p>')+'</section>'
   +'<section><header><b>'+weekT+'</b></header>'+wk.map(w=>{const red=w.bad&&w.pct<50;return '<div class="tv3-wk"><div><span>'+h(w.label)+'</span><b'+(red?' class="r"':'')+'>'+h(w.v)+'</b></div><u><i style="width:'+Math.max(1,Math.round(w.pct))+'%;background:'+(red?'#d14a3f':'#15171c')+'"></i></u><small>'+h(w.goal)+'</small></div>';}).join('')+'</section></aside>';
  const badge=document.getElementById('todayBadge');if(badge){badge.textContent=total||'';badge.style.display=total?'':'none';}
  return '<div class="tv3" data-role="'+role+'" data-total="'+total+'" data-back="'+backN+'">'+hero+strip+'<div class="tv3-body"><div class="tv3-main">'+groupsHtml+empty+backHtml+'</div>'+side+'</div></div>';
 }
 /* ── 동작: 전부 기존 경로 ── */
 function dial(digits){if(!digits){toast('전화번호가 없습니다 — 상세에서 연락처를 등록해 주세요','warn');return;}const a=document.createElement('a');a.href='tel:'+digits;a.style.display='none';document.body.append(a);a.click();a.remove();}
 const openKey=(key,action)=>T().open(key,action);
 function current(){const X=T().data(),G=root.G,owner=X.admin?(G.todayQueueOwner||'전체'):'전체',q=String(G.todayQueueSearch||'').trim().toLowerCase(),brand=G.brand&&G.brand!=='전체'?G.brand:'';
  const scoped=x=>(owner==='전체'||x.owner===owner)&&(!brand||String(x.item.brand||'')===brand)&&(!q||[x.item.site,x.item.site_name,x.owner,x.reason,x.next,x.item.contact_name,x.item.phone].join(' ').toLowerCase().includes(q));
  return build(X,X.rows.filter(scoped),(X.backlog||[]).filter(scoped));}
 function copy(text,done){const ok=()=>toast(done);try{if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(text).then(ok,()=>toast('복사하지 못했습니다 — 브라우저 권한을 확인해 주세요','warn'));return;}}catch(e){}const ta=document.createElement('textarea');ta.value=text;document.body.append(ta);ta.select();try{document.execCommand('copy');ok();}catch(e){toast('복사하지 못했습니다','warn');}ta.remove();}
 function triage(b,act){
  if(!b||b.x.type!=='deal')return;root.G._detailPopup=true;root.drwDeal(JSON.stringify(b.x.item));
  setTimeout(()=>{if(act==='keep'){if(typeof root.briefNextAction==='function')root.briefNextAction();else if(typeof root.dccGoActivity==='function')root.dccGoActivity();return;}
   const target=act==='hold'?'waiting':act==='badfit'?'badfit_lead':'lost';try{root.StageTransitionUI.open(b.x.item,false,target);}catch(e){}},350);
 }
 function onClick(e){
  const b=e.target.closest('#today-v2 .tv3 [data-t3]');if(!b)return;e.stopPropagation();
  const S=st(),a=b.dataset.t3,v=b.dataset.v,key=b.dataset.key,rerender=()=>root.TodayV2.render();
  if(a==='exec'){startExec(current());return rerender();}
  if(a==='exit'){S.exec=false;EXQ=[];return root.paint();}
  if(a==='epick'){S.ek=key;S.er='';S.em='';S.eerr='';return rerender();}
  if(a==='eres'){S.er=S.er===v?'':v;S.eerr='';return rerender();}
  if(a==='esave')return execSave();
  if(a==='edial')return dial(b.dataset.tel);
  if(a==='enext')return openKey(key,'next');
  if(a==='fstage'){S.fStage=S.fStage===v?null:v;S.fWho=null;return rerender();}
  if(a==='fwho'){S.fWho=S.fWho===v?null:v;S.fStage=null;return rerender();}
  if(a==='clear'){S.fStage=null;S.fWho=null;return rerender();}
  if(a==='fold'){S.open[key]=!S.open[key];return rerender();}
  if(a==='more'){S.more[v]=!S.more[v];return rerender();}
  if(a==='back'){S.back=!S.back;if(!S.back)S.backOwner='';return rerender();}
  if(a==='backdo'){S.backOwner=S.backOwner===v?'':v;return rerender();}
  if(a==='backreq'){const V=current(),l=V.back.filter(x=>x.owner===v),old=Math.max(0,...l.map(x=>x.days||0));return copy(v+'님, '+BACK()+'일 넘게 기록이 없는 영업건이 '+l.length+'건 있습니다(최장 '+old+'일). 오늘 업무 → 밀린 건 정리에서 진행 / 보류 / 실주 / 배드핏으로 정리해 주세요.','정리 요청 문구를 복사했습니다 — 잔디 · 문자로 보내 주세요');}
  if(a==='tri'){const V=current();return triage(V.back.find(x=>x.key===key),v);}
  if(a==='bulk'){const V=current(),g=V.groups[Number(v)];if(!g||!g.items.length)return;const by=new Map();g.items.forEach(i=>{const o=i.x.owner||'미배정';(by.get(o)||by.set(o,[]).get(o)).push(i);});
   return copy([...by].map(([o,l])=>'['+o+'] '+g.t+' '+l.length+'건\n'+l.map(i=>'· '+siteShort(i.i.site)+' — '+i.missTxt+(i.short&&!/^(0일|오늘)$/.test(i.short)&&i.rk!=='contract'?' · '+i.short:'')).join('\n')).join('\n\n'),'담당자 '+by.size+'명 · '+g.items.length+'건 문구를 복사했습니다 — 잔디 · 문자로 보내 주세요');}
  if(a==='owner'){if(root.CommonFilterBar)root.CommonFilterBar.setOwner(v);else root.G.todayQueueOwner=v;return root.paint();}
  if(a==='reassign')return openKey(key);
  if(a==='result')return openKey(key,'contact');
  if(a==='sms'){openKey(key);setTimeout(()=>{const tab=document.querySelector('dialog[open] [data-idv="tab"][data-v="sms"], .inq-dialog [data-idv="tab"][data-v="sms"]');if(tab)tab.click();else if(root.CUR_DETAIL&&root.CUR_DETAIL.kind==='deal'&&typeof root.contactSms==='function')root.contactSms();},400);return;}
  if(a==='act'){const act=b.dataset.act;
   if(act==='전화'){dial(b.dataset.tel);return openKey(key,'contact');}
   if(act==='다음 할 일')return openKey(key,'next');
   /* 배정 창은 문의 번호만 받는다('inq:' 머리 없이) — 머리를 붙인 채 넘기면 "먼저 처리할 견적문의를 선택해 주세요"만 뜬다 */
   if(act==='배정'&&/^inq:/.test(key)&&typeof root.todayAssignInquiry==='function')return root.todayAssignInquiry(key.replace(/^inq:/,''));
   if(['독촉','코멘트','결과 기록','정기 연락','관계 연락','현장 확인'].includes(act))return openKey(key,'contact');
   return openKey(key);}
  if(a==='open'&&(!e.target.closest('button')||b.tagName==='BUTTON'))return openKey(key);
 }
 document.addEventListener('click',onClick,true);
 document.addEventListener('input',e=>{const t=e.target;if(t&&t.matches&&t.matches('#today-v2 .tv3 [data-t3in="em"]'))st().em=t.value;},true);
 document.addEventListener('keydown',e=>{if((e.key==='Enter'||e.key===' ')&&e.target.matches&&e.target.matches('#today-v2 .tv3 [data-t3="open"]')){e.preventDefault();openKey(e.target.dataset.key);}});
 root.TodayV3={enabled,html,build,isBack,STG,execQueue:()=>EXQ.map(x=>x.i.key)};
})(window);
