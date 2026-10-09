/* 견적문의 v4 (2026-10-06 대표 핸드오프 design_handoff_inquiry_v4 · 시안 '견적문의 v4.dc.html') — 상단 정리 + 목록 옆 상세
   무엇이 문제였나: 같은 것을 세는 숫자가 넷(위 탭 · 브랜드 전체 · 진행 탭 · 목록)이고 탭 7개가 서로 겹쳤다. 줄을 펼쳤다 접으며 한 건씩 보느라 차례로 처리하기 불편했다.
   여기서 하는 것(공사 견적문의 탭만 — 협약문의 · B2B, 다른 메뉴, 공통 틀은 그대로):
     · 숫자는 하나 = 진행 중(종결 · 휴지통 · 영업건으로 넘긴 문의 제외). 위 탭 = 브랜드 '전체' = 진행 중 전체 = 목록 건수(브랜드 · 담당 · 검색을 바꾸면 같이 다시 센다).
     · 상태 탭 5칸(서로 안 겹침): 진행 중 전체 / 배정 필요 / 첫 연락 전 / 후속 연락 필요 / 정상 진행 — 뒤 네 칸의 합 = 전체. 판정은 목록 v3 와 같은 것(InquiryListV3.model).
     · 함께 확인 칩(탭과 함께 걸림): 필수정보 미입력 · 대표회의 · 기한 D-3 · 오늘 들어온 문의.
     · 아래 2단: 왼쪽 목록(경과 기준 라벨 + 경과 + 상태) / 오른쪽 상세(고른 줄이 바로 열린다) — 고객이 남긴 말 → 이 단지 지난 영업 → 빠진 정보 칩(그 자리 입력) → 첫마디 → 응대 기록 → 응대 이력.
     · [저장하고 다음 ↓] = 결과 필수 · 저장은 기존 명령 하나(InquiryListV3.record → InquiryCommand contact_log) · 부재 같은 시도는 연락 시도로만 남는다(최초 응대 아님).
     · 키보드 ↑ ↓ 로 이동(입력 중엔 무시) · 고른 문의는 주소(#p=inq&sel=…)에 남는다 · 목록은 한 쪽 20건 + 쪽 번호(list-pager).
     · '전체 상세 ↗' = 기존 상세 창(단지 이력 · 근처 지도 포함).
   자료 · 권한은 기존 것: 목록 = InquiryListV2.rows()(역할 · 브랜드 · 담당자 · 검색 반영).
   끄기: G.inqV4Off=true → 목록 v3(줄 펼침 · 탭 7개). 견적문의 흐름(InquiryFlow)이 꺼져 있어도 v3 로 돌아간다. */
(function(root){
 'use strict';
 const h=v=>root.esc(String(v==null?'':v)),attr=v=>root.escAttr(String(v==null?'':v));
 const L3=()=>root.InquiryListV3,L2=()=>root.InquiryListV2,W=()=>root.InquiryWorkbench,DV=()=>root.InquiryDetailV2||{};
 const F=()=>root.InquiryFlow&&root.InquiryFlow.on()?root.InquiryFlow:null,IS=()=>root.InquirySite&&root.InquirySite.on()?root.InquirySite:null;
 const on=()=>!(root.G&&root.G.inqV4Off)&&!!L3()&&L3().enabled()&&!!F()&&!!root.InquiryCommand&&!!root.ListPager;
 const DEF={tab:'all',flag:'',sort:'urgent',sel:'',page:1,res:'',memo:'',when:'',pick:false,edit:'',draft:'',busy:false,err:'',detail:false};
 function st(){const g=root.G;if(!g.inqV4||!g.inqV4._v4)g.inqV4=Object.assign({},DEF,g.inqV4||{},{_v4:true});return g.inqV4;}
 const resetForm=S=>Object.assign(S,{res:'',con:'',rea:'',memo:'',when:'',pick:false,edit:'',draft:'',busy:false,err:'',memoErr:'',find:false,findErr:''});
 const RULES=()=>root.OPS_RULES||{},ASSIGN_MIN=()=>Number(RULES().inquiryAssignMinutes)||30,FIRST_H=()=>Number(RULES().towerFirstResponseHours)||2,FOLLOW_D=()=>Number(RULES().inquiryFollowDays)||7;
 const ST={1:['unassigned','배정 필요'],2:['nofirst','첫 연락 전'],3:['stale','후속 연락 필요'],4:['ok','정상 진행'],5:['nocontact','연락처 보완']};
 const TABS=()=>[['all','진행 중 전체','종결 · 휴지통 제외','#15171c',0],['unassigned','배정 필요',ASSIGN_MIN()+'분 안에 담당 지정','#b42318',1],['nofirst','첫 연락 전','배정 후 '+FIRST_H()+'시간 안 첫 연락','#b42318',2],['stale','후속 연락 필요','첫 연락 후 '+FOLLOW_D()+'일 넘게 연락 없음','#c0392b',3],['ok','정상 진행','마지막 연락 '+FOLLOW_D()+'일 안','#6b7280',4],['nocontact','연락처 보완','연락처 찾기 · 이관 기록 확인','#6b7280',5]];
 const d3=x=>!!x&&x.dd>=0&&x.dd<=3;
 const FLAGS=[['info','필수정보 미입력','#c0392b',m=>m.follow&&m.miss.length>0],['meet','대표회의 · 기한 D-3','#b42318',m=>d3(m.meet)||d3(replyOf(m.q))],['today','오늘 들어온 문의','#2a52b8',m=>m.x.ageDays===0]];
 function replyOf(q){try{return L3().replyOf(q);}catch(e){return null;}}
 const ymd=t=>{const d=new Date(t);return Number.isFinite(d.getTime())?d.getFullYear()+'.'+(d.getMonth()+1)+'.'+d.getDate():'';};
 const kday=d=>d.getFullYear()+'.'+(d.getMonth()+1)+'.'+d.getDate()+'('+'일월화수목금토'[d.getDay()]+')';
 const dayStr=d=>d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
 const span=ms=>{const hr=ms/36e5;if(!(hr>=0))return '—';if(hr<1)return Math.max(1,Math.round(hr*60))+'분';if(hr<24)return Math.floor(hr)+'시간';return Math.floor(hr/24)+'일';};
 const isAdmin=()=>{try{return !!root.inqCtlIsAdmin();}catch(e){return false;}};
 const repName=n=>{try{return root.repDisplay(n);}catch(e){return String(n||'');}};
 /* 기록 한 줄(전화 · 결과 머리)에서 실제 연결인지 읽는다 */
 const lineOf=a=>{const note=String(a.note||''),res=String(a.result||'');return (/^고객 응대 기록/.test(note)&&res)?res:(note||res);};
 const quoteSent=m=>/견적\s*발송/.test(String(m.q.status||''))||(!!m.x.latest&&/견적/.test(String(m.x.latest.type||'')+lineOf(m.x.latest))&&/발송|보냄|전달/.test(lineOf(m.x.latest)));
  /* 상태(다섯 칸 중 하나) · 경과 기준(무엇부터 센 시간인지) · 급한 순 묶음(① 신규 첫 연락 → ② 고객 약속 · 회의 → ③ 후속 기한 → ④ 과거 기록 정리)을 줄마다 같이 둔다.
     연락처가 없는 과거 문의(후속 단계이거나 접수 하루 넘김)는 '후속 연락 필요'에서 빼고 '연락처 보완' 상태 · ④ 묶음으로 보낸다(2026-10-08 inquiry_memo ⑥). 날짜는 한국 날짜 기준(InquiryMemo). */
  const GROUP=['','① 신규 첫 연락','② 고객 약속 · 회의','③ 후속 기한','④ 과거 기록 정리'];
  const K=()=>root.InquiryMemo;
  const dayMs=d=>Date.parse(d+'T00:00:00+09:00');
  const dayNo=d=>Math.round(dayMs(d)/864e5);
  function nextDueOf(q){try{const a=root.actionObj(q,root.itemPatch(q,'inq'));if(a&&a.text&&a.due){const d=String(a.due).slice(0,10);if(/^\d{4}-\d{2}-\d{2}$/.test(d))return d;}}catch(e){}return '';}
  function ext(m){
   const q=m.q,x=m.x,now=Date.now(),k=K(),noPhone=!m.phone&&!!(m.follow||(x.ageDays||0)>=1),s=noPhone?5:m.step===0?1:m.step===1?2:(m.follow&&m.late)?3:4;
   const planned=nextDueOf(q)||!!(m.meet&&m.meet.dd>=0)||!!(replyOf(q)&&replyOf(q).dd>=0);
   const review=m.step===1&&!planned&&!!(k&&k.needsReview&&k.needsReview(q));
   const lastAt=x.latest?Date.parse(x.latest.at||x.latest.occurred_at||x.latest.created_at):x.first?Date.parse(x.first):NaN;
   let basis,from;
   if(s===1){basis='접수 후';from=x.created;}
   else if(s===2){basis='배정 후';let a=NaN;try{a=Date.parse(root.inqCtlAssignedAt(q)||'');}catch(e){}from=Number.isFinite(a)?a:x.created;}
   else{basis=quoteSent(m)?'견적 발송 후':'마지막 연락 후';from=lastAt;}
   let g,due=null,dueDay='';
   if(noPhone||review)g=4;
   else if(m.step<=1){g=1;due=Number.isFinite(from)?from+(m.step===0?ASSIGN_MIN()*60000:FIRST_H()*3600000):null;}
   else{
    const rd=replyOf(q),cand=[];if(m.meet&&m.meet.dd>=0)cand.push(k?k.day(m.meet.date):'');if(rd&&rd.dd>=0)cand.push(k?k.day(rd.date):'');
    const pend=k&&k.on()?k.pendingN(q):0;
    if(cand.length||pend>0){g=2;dueDay=cand.filter(Boolean).sort()[0]||'';}
    else{g=3;dueDay=nextDueOf(q)||(Number.isFinite(lastAt)&&k?k.addDays(k.day(lastAt),FOLLOW_D()):'');}
    due=dueDay?dayMs(dueDay):null;
   }
   const days=Number.isFinite(from)?(k?k.span(from,now):span(now-from)):'—';
   return Object.assign(m,{review,st:s,stLabel:review?'이관 기록 확인 필요':ST[s][1],basis,from,el:days,g,gLabel:GROUP[g],due,dueDay,dc:s===4||s===5?'#6b7280':s===3?'#c0392b':'#b42318'});
  }
  /* 목록 줄 오른쪽 세 줄(묶음 · 지금 상태 · 기한) — 보이는 줄만 계산한다 */
  function remain(ms){const k=K();return ms>=0?k.span(Date.now(),Date.now()+ms)+' 남음':k.span(Date.now()+ms,Date.now())+' 지남';}
  function basisText(m){
   const k=K(),lc=Object.assign({},lastOf(m));let at=Number.isFinite(lc.at)?lc.at:((m.st===3||m.st===4)&&Number.isFinite(m.from)?m.from:NaN);
   /* 메모 속 통화로 실제 연결일을 보완한 문의 = 그 날짜를 실제 연결로 센다(더 늦은 연락 기록이 없을 때) */
   try{const cn=k&&k.on()?k.connection(m.q):null;if(cn&&cn.state==='supplemented'&&cn.day){const t=dayMs(cn.day);if(!Number.isFinite(lc.at)||t>lc.at){at=t;lc.real=true;lc.res='';}}}catch(e){}
   if(!Number.isFinite(at))return '연락 기록 없음';
   const sent=quoteSent(m),label=sent?'견적 발송 후':lc.real?'실제 연결 후':lc.res?'연락 시도 후':'마지막 연락 후',kind=sent?'발송':lc.real?'통화':lc.res||'연락';
   return label+' '+k.span(at)+' · '+k.md(at)+' '+kind;
  }
  function lines(m){
   if(m._ln)return m._ln;const k=K(),q=m.q,now=Date.now();let l2='',l3='',col=m.dc;
   const copy=!!k&&k.copied(q),mc=k?k.memoCallDay(q):'',pend=k&&k.on()?k.pendingN(q):0;
   const copyText='연결일 확인 필요'+(mc?' · 메모에 '+k.md(mc)+' 통화':'');
   if(m.g===1){
    const hhmm=Number.isFinite(m.due)?(k.day(m.due)===k.today()?'오늘':k.md(m.due))+' '+k.hm(m.due)+'까지':'';
    l2=(m.step===0?'배정 기한 ':'첫 연락 기한 ')+(Number.isFinite(m.due)?remain(m.due-now):'—');l3=hhmm;col='#b42318';
   }else if(m.g===4){l2=m.review?'이관 기록 확인 필요'+(mc?' · 메모에 '+k.md(mc)+' 통화':''):'연락처 없음 · 연락처 보완 먼저';l3=m.review?'과거 약속·현재 상태 확인 후 후속 등록':'기한 없음';col='#6b7280';}
   else{
    let due='';
    if(m.dueDay){const dd=dayNo(m.dueDay)-dayNo(k.today());due=k.md(dayMs(m.dueDay))+'까지 · '+(dd===0?'오늘':dd>0?dd+'일 남음':(-dd)+'일 지남');if(dd<0)col='#c0392b';}
    const meet=m.meet&&m.meet.dd>=0?'대표회의 D-'+m.meet.dd+' · '+k.md(m.meet.date):(()=>{const r=replyOf(q);return r&&r.dd>=0?'회신 기한 D-'+r.dd+' · '+k.md(r.date):'';})();
    if(m.g===2){l2=meet||(copy?copyText:basisText(m));l3=pend>0?'메모 약속 '+pend+'건 확인 전':due;col='#c0392b';}
    else{l2=copy?copyText:basisText(m);l3=due||'기한 없음';if(m.late&&m.dueDay===''&&!copy)col='#c0392b';}
   }
   return (m._ln={l1:m.gLabel,l2,l3,col});
  }
 /* 연락 기록 한 줄의 말: 실제 연결 / 연락 시도(부재 · 통화불가 …) — 상세의 응대 이력과 같은 읽기 */
 const conText=e=>{const k=e.res?F().kindOf(e.res):'';return {real:k==='connected',text:(k==='connected'?'실제 연결':k==='attempt'?'연락 시도':'연락')+(e.res?' · '+e.res:'')+(e.text?' · '+e.text:'')};};
 const isCon=e=>e.kind==='contact'||(e.kind==='work'&&!!e.ch);
 /* 줄의 마지막 기록(보이는 줄만 계산한다) */
 function lastOf(m){
  if(m._lc)return m._lc;let e=null;
  try{e=(DV().timeline?DV().timeline(m.q):[]).filter(isCon).sort((a,b)=>(Date.parse(b.at)||0)-(Date.parse(a.at)||0))[0]||null;}catch(err){}
  if(e){const c=conText(e);m._lc={when:ymd(e.at),at:Date.parse(e.at),text:c.text,real:c.real,res:e.res||''};}else m._lc={when:'',at:NaN,text:m.lastText,real:false,res:''};
  const k=K();try{if(k&&k.copied(m.q)&&(!e||k.day(e.at)===k.day(k.connection(m.q).orig))){m._lc={when:'',at:NaN,text:'연결일 확인 필요 · 접수일과 같음',real:false,res:''};}}catch(err){}
  return m._lc;
 }
 /* 진행 중 = 목록 범위(역할 · 브랜드 · 담당 · 검색) 가운데 영업건으로 넘기지 않은 문의. 한 번 그릴 때 여러 곳(위 탭 · 브랜드 칩 · 목록)이 같이 쓰므로 잠깐 담아 둔다 */
 let CACHE={at:0,key:'',rows:[],handed:0};
 const picked=()=>{try{return root.SalesFilterState.state().brands||[];}catch(e){return [];}};
 const cacheKey=()=>{const g=root.G||{};let o='';try{const s=root.SalesScope.state();o=[s.type,s.owner].join('/');}catch(e){}return [picked().join(','),o,g.brand,g.rep,g.q,g.workFilter,g.inqPeriodMode,g.year,g.quarter,(root.B&&root.B.inquiries||[]).length].join('|');};
 function base(){const k=cacheKey(),now=Date.now();if(CACHE.key===k&&now-CACHE.at<250)return CACHE.rows;const M=L2().rows().map(L3().model),rows=M.filter(m=>m.step<4).map(ext);CACHE={at:now,key:k,rows,handed:M.length-rows.length};return rows;}
 const fresh=()=>{CACHE.at=0;};
 const total=()=>{try{return base().length;}catch(e){return 0;}};
 /* 브랜드 칩 건수: 브랜드만 풀고 같은 기준(진행 중)으로 센다 → '전체' = 각 브랜드의 합(브랜드가 비어 있는 문의는 전체에만) */
 let ORIG_BS=null;
 function brandStats(){
  const old=(ORIG_BS?ORIG_BS():[])||[];if(!on())return old;
  /* 목록 범위는 고른 브랜드를 SalesFilterState 에서 읽는다 — 세는 동안만 '고른 브랜드 없음'으로 보이게 한다(담당 · 검색은 그대로 걸린다) */
  const SF=root.SalesFilterState,orig=SF&&SF.state,now=picked();let rows=[];if(typeof orig!=='function')return old;
  try{SF.state=function(){return Object.assign(orig.apply(SF,arguments),{brands:[]});};rows=L2().rows().map(L3().model).filter(m=>m.step<4);}catch(e){return old;}finally{SF.state=orig;}
  const brandOf=m=>{try{return String(root.inquiryBrandOf(m.q)||'');}catch(e){return String(m.q.brand||'');}};
  const names=old.length?old.map(b=>b.name).filter(n=>n!=='전체'):[...new Set(rows.map(brandOf).filter(Boolean))];
  const sel=n=>{const o=old.find(b=>b.name===n);return o?!!o.on:(n==='전체'?!now.length:now.includes(n));};
  return [{name:'전체',n:rows.length,on:sel('전체')}].concat(names.map(n=>({name:n,n:rows.filter(m=>brandOf(m)===n).length,on:sel(n)})));
 }
 let VIEW={all:[],list:[]};
 function compute(){
  const S=st(),all=base(),T=TABS();if(!T.some(t=>t[0]===S.tab))S.tab='all';if(S.flag&&!FLAGS.some(f=>f[0]===S.flag))S.flag='';
  const inTab=S.tab==='all'?all:all.filter(m=>ST[m.st][0]===S.tab),flag=FLAGS.find(f=>f[0]===S.flag)||null;
  const INF=1e18,cmp=S.sort==='urgent'?(a,b)=>a.g-b.g||(a.due==null?INF:a.due)-(b.due==null?INF:b.due)||(a.x.created||0)-(b.x.created||0):S.sort==='old'?(a,b)=>(a.x.created||0)-(b.x.created||0):(a,b)=>(b.x.created||0)-(a.x.created||0);
   const list=(flag?inTab.filter(flag[3]):inTab).slice().sort(cmp);
  return (VIEW={all,inTab,list,T});
 }
 /* ── 왼쪽 목록 한 줄 ── */
 function tagsOf(m){
  const T=[];
  try{const b=IS()&&m.ex.length?IS().badge(m.q):null;if(b)T.push([b.k,b.text.replace(/ · .*$/,'')]);}catch(e){}
  if(d3(m.meet))T.push(['meet','대표회의 D-'+m.meet.dd]);else{const r=replyOf(m.q);if(d3(r))T.push(['meet','회신 기한 D-'+r.dd]);}
  if(m.tries)T.push(['try',m.tries.split(' · ')[0]]);
  return T.map(t=>'<i class="i4-tag '+t[0]+'">'+h(t[1])+'</i>').join('');
 }
 function rowHtml(m,sel){
  const lc=lastOf(m);
  return '<div class="i4-row'+(sel?' on':'')+'" role="button" tabindex="0" data-i4="row" data-key="'+attr(m.key)+'" aria-current="'+sel+'" style="border-left-color:'+m.bc+'">'
   +'<div class="c1"><div class="t"><b style="color:'+m.bc+'">'+h(m.brand||'브랜드 미지정')+'</b><span>'+h(m.channel)+' · '+h(m.owner?repName(m.owner):'미배정')+'</span>'+tagsOf(m)+'</div><b class="site">'+h(m.site)+'</b><span class="sum">'+h([m.work,m.sum].filter(Boolean).join(' · '))+'</span></div>'
   +'<div class="c2"><span class="who"><span>'+h(m.who)+'</span> · <b class="'+(m.phone?'':'none')+'">'+h(m.phone||'연락처 없음')+'</b></span><span class="last"><i class="'+(lc.real?'real':'')+'"></i>'+(lc.when?'<span>'+h(lc.when)+'</span> ':'')+h(lc.text)+'</span></div>'
   +(()=>{const L=lines(m);return '<div class="c3"><span class="g">'+h(L.l1)+'</span><b style="color:'+L.col+'">'+h(L.l2)+'</b><span>'+h(L.l3)+'</span></div></div>';})();
 }
 /* ── 오른쪽 상세 ── */
 const yearOf=v=>(/^(\d{4})/.exec(String(v||''))||[])[1]||'';
 function histBox(q){
  const I=IS();if(!I)return '';let S0=null;try{S0=I.summary(q);}catch(e){return '';}if(!S0||!S0.D.length)return '';
  const x=S0.lost[0]||S0.open[0]||S0.won[0]||S0.D[0],K=(I.KIND[x.k]||['지난 자료'])[0];let why='';
  try{
   if(x.k==='lost'){const f=I.lostFacts(x.d);why=[f.why!=='미기록'?f.why:'실주 사유 미기록',f.win!=='미기록'?'낙찰 '+f.win:''].filter(Boolean).join(' · ');}
   else if(x.k==='won'){const a=root.hasWonAmt(x.d)?Number(root.wonAmt(x.d))||0:0;why='수주'+(a?' '+root.fmtAmt(a):'')+' · 기존 고객';}
   else if(x.k==='open'||x.k==='hold'){why=[root.stageNoLabel?root.stageNoLabel(root.dealStage(x.d)):'',repName(root.repN(x.d.assignee))].filter(Boolean).join(' · ')+' · 같은 공사인지 먼저 확인';}
  }catch(e){}
  return '<div class="i4-hist '+x.k+'"><b>이 단지 지난 영업 · '+h([yearOf(x.date),x.work,K].filter(Boolean).join(' '))+(S0.D.length>1?' 외 '+(S0.D.length-1)+'건':'')+'</b>'+(why?'<span>'+h(why)+'</span>':'')+'</div>';
 }
 /* 빠진 정보 가운데 그 자리에서 바로 적는 칸(상세 창과 같은 저장 길 — InquiryCommand field_set) */
 const FIELD={'공사 시기':['timing','text'],'경쟁사':['competitor','text'],'요청 자료':['requested_material','text'],'결정권자':['keyman','text'],'대표회의 일정':['meeting_date','date'],'자료 회신 기한':['reply_due','date']};
 const canFill=()=>{try{return !!(DV().fieldEditable&&DV().fieldEditable()&&DV().applyField);}catch(e){return false;}};
 function missHtml(m,S){
  let miss=[];try{miss=L3().missing(m.q);}catch(e){}
  const chips=miss.map(l=>{
   if(S.edit===l&&FIELD[l])return '<span class="i4-fill"><input type="'+FIELD[l][1]+'" data-i4f="draft" aria-label="'+attr(l)+'" placeholder="'+attr(l)+' 입력" value="'+attr(S.draft)+'"'+(S.busy?' disabled':'')+'><button type="button" data-i4="miss-save"'+(S.busy?' disabled':'')+'>저장</button><button type="button" class="x" data-i4="miss-cancel"'+(S.busy?' disabled':'')+'>취소</button></span>';
   return '<button type="button" class="i4-miss" data-i4="miss" data-v="'+attr(l)+'">+ '+h(l)+'</button>';}).join('');
  return '<div class="i4-sec"><b class="lb">빠진 정보 <em>'+miss.length+'</em><span> / 9'+(miss.length?' · 누르면 바로 입력':' · 모두 채움')+'</span></b>'+(miss.length?'<div class="i4-chips">'+chips+'</div>':'')+'</div>';
 }
 /* 날짜 3개 · 이관 메모 원문(통화 노랑 · 약속 파랑) · 과거 약속 확인함 — 메모가 있는 문의에만 */
  function memoBlocks(q,S,m){const k=K();if(!k||!k.on())return '';try{return (m&&m.st===5?k.findHtml(q,S.find,canFill(),S.findErr):'')+k.datesHtml(q)+k.memoHtml(q)+k.promiseHtml(q,S.memoErr);}catch(e){return '';}}
  function opener(m){
   try{const k=K(),o=k&&k.opener(m.q,m.owner?repName(m.owner):String(root.ME&&root.ME.name||''));if(o)return o;}catch(e){}
  const q=m.q,who=m.owner?repName(m.owner):String(root.ME&&root.ME.name||''),wl=String(root.inqCtlWorkLabel(q)||''),topic=(wl&&!/미분류/.test(wl)?wl:'')||String(W().gist(q)||'').replace(/\s+/g,' ').slice(0,26)||'견적';let clue='';try{clue=IS()?IS().openerClue(q):'';}catch(e){}
  return '"안녕하세요, 넷폼 '+who+'입니다. '+(clue?clue+' 이번 ':'문의 주신 ')+topic+' 건으로 연락드렸습니다. 지금 통화 괜찮으실까요?"';
 }
 /* 결과 칩 = 결과 마스터(InquiryFlow.RESULTS) — 시안의 여섯 개를 앞에 */
 const RES_ORDER=['연결됨','부재','검토중','자료요청','견적요청','회신대기'];
 const results=()=>{const R=F().RESULTS.slice();return RES_ORDER.filter(r=>R.includes(r)).concat(R.filter(r=>!RES_ORDER.includes(r)));};
 const hasMeet=m=>!!(m.meet&&m.meet.dd>=0);
 const whenOf=(m,S)=>S.when||(S.res?(hasMeet(m)&&F().kindOf(S.res)!=='attempt'?'대표회의 다음날':((F().NEXT[S.res]||[])[1]||'7일 후')):'');
 function dueOf(m,w){if(w==='대표회의 다음날'&&m.meet){const d=new Date(m.meet.date);d.setDate(d.getDate()+1);return d;}const d=new Date();d.setDate(d.getDate()+({'내일':1,'3일 후':3,'7일 후':7}[w]||7));return d;}
 const nextText=r=>(F().NEXT[r]||[])[0]||'다시 연락';
 function recordHtml(m,S){
  if(m.step===0)return '<div class="i4-rec"><b class="ttl">응대 기록</b><div class="i4-assign"><span>담당이 정해지기 전입니다 — 배정 뒤에 응대 기록을 남깁니다.</span>'+(isAdmin()?'<button type="button" data-i4="assign">담당 배정</button>':'')+'</div></div>';
  const w=whenOf(m,S),nd=w?dueOf(m,w):null,att=S.res&&F().kindOf(S.res)==='attempt',opts=['내일','3일 후','7일 후'].concat(hasMeet(m)?['대표회의 다음날']:[]);
  /* 결과 두 줄(2026-10-06 design_handoff_followup4): 연락 결과 → 실제 연결일 때만 고객 반응. 칩 자리만 바뀌고 다른 칸은 그대로 */
  const T=F().TWO,real=T.isReal(S.con),chip=(k,l,on)=>'<button type="button" class="i4-chip'+(on?' on':'')+'" data-i4="'+k+'" data-v="'+attr(l)+'" aria-pressed="'+on+'">'+h(l)+'</button>';
  return '<div class="i4-rec"><b class="ttl">응대 기록</b>'
   +'<div class="i4-res two"><span>연락 결과</span>'+T.CONTACT.map(([l])=>chip('con',l,S.con===l)).join('')+'<small class="i4-rn">실제 연결 = 연결됨 · 회신 받음</small></div>'
   +(real?'<div class="i4-res two"><span>고객 반응</span>'+T.REACTION.map(([l])=>chip('rea',l,S.rea===l)).join('')+'</div>':'')
   +'<small class="i4-rnote">'+h(S.con?(real?'실제 연결 → 최초 응대 시각 기록 · 고객 반응으로 다음 행동 제안':'연락 시도로만 기록 · 고객 반응 줄은 숨김 · 다음 행동은 재연락'):'연락 결과를 고르면 다음 행동을 제안합니다')+'</small>'
   +'<input type="text" class="i4-memo" data-i4f="memo" aria-label="한 줄 메모" placeholder="한 줄 메모 (선택)" maxlength="300" value="'+attr(S.memo)+'">'
   +'<div class="i4-next"><b class="ai">AI</b><span><b>다음 행동</b> '+(S.res?h(nextText(S.res)+' · '+w+' ('+kday(nd)+')'):'결과를 고르면 제안')+'</span>'+(S.res?'<button type="button" class="lnk" data-i4="pick" aria-expanded="'+!!S.pick+'">바꾸기</button>':'')+'</div>'
   +(S.res&&S.pick?'<div class="i4-res when"><span>날짜</span>'+opts.map(o=>'<button type="button" class="i4-chip'+(w===o?' on':'')+'" data-i4="when" data-v="'+attr(o)+'" aria-pressed="'+(w===o)+'">'+h(o)+'</button>').join('')+'</div>':'')
   +(S.err?'<div class="i4-err">'+h(S.err)+'</div>':'')
   +'<div class="i4-save"><span>'+h(att?S.res+' = 연락 시도로만 기록 · 최초 응대 아님':'저장하면 다음 문의가 열립니다')+'</span><button type="button" data-i4="save"'+(S.res&&!S.busy?'':' disabled')+'>저장하고 다음 ↓</button></div></div>';
 }
 function logHtml(q,key){
  let L=[];try{L=(DV().timeline?DV().timeline(q):[]).slice();}catch(e){}
  const T=e=>Date.parse(e.at)||0;L.sort((a,b)=>T(b)-T(a));const shown=L.slice(0,8);
  const line=e=>{const con=isCon(e),c=con?conText(e):null,real=!!(c&&c.real);
   const text=con?c.text:String(e.text||'');
   return '<div class="i4-ev"><i class="'+(real?'real':'')+'"></i><span><span>'+h(ymd(e.at))+(e.who&&e.who!=='자동'?' · '+h(repName(e.who)):'')+'</span> · '+h(text)+'</span></div>';};
  return '<div class="i4-log"><b class="ttl">응대 이력 <span>'+L.length+'건</span></b>'+shown.map(line).join('')+(L.length>shown.length?'<button type="button" class="lnk" data-i4="full">이전 기록 '+(L.length-shown.length)+'건은 전체 상세에서 ↗</button>':'')+'</div>';
 }
 function detailHtml(m,S){
  const q=m.q,raw=String(W().originalText(q)||'').trim();
  return '<header class="i4-dh"><button type="button" class="back" data-i4="back">‹ 목록</button>'
   +'<div class="r1"><i style="background:'+m.bc+'"></i><b style="color:'+m.bc+'">'+h(m.brand||'브랜드 미지정')+'</b><span>'+h(m.channel)+' · 담당 '+h(m.owner?repName(m.owner):'미배정')+'</span><em></em><span class="i4-pill s'+m.st+'">'+h(m.stLabel+' · '+lines(m).l2)+'</span></div>'
   +'<b class="site">'+h(m.site)+'</b>'
   +'<div class="r3"><span>'+h(m.who)+' · <b class="'+(m.phone?'':'none')+'">'+h(m.phone||'연락처 없음')+'</b></span><em></em><button type="button" class="call" data-i4="call"'+(m.digits?' data-tel="'+attr(m.digits)+'"':' disabled')+'>전화</button><button type="button" class="sms" data-i4="sms"'+(m.digits?'':' disabled')+'>문자</button><button type="button" class="lnk" data-i4="full">전체 상세 ↗</button></div></header>'
   +'<div class="i4-db"><div class="i4-sec"><b class="lb">고객이 남긴 말</b><p class="i4-raw">'+h(raw||'저장된 문의 원문이 없습니다.')+'</p></div>'
   +memoBlocks(q,S,m)+histBox(q)+missHtml(m,S)
   +'<div class="i4-line"><b class="ai">AI 첫마디</b>'+h(opener(m))+'</div>'
   +recordHtml(m,S)+logHtml(q,m.key)+'</div>';
 }
 /* ── 그리기 ── */
 let KEEP={tools:null};
 function placeMoved(host,page){
  /* 더보기(일괄 처리 · 예전 목록 · 종결 · 휴지통) = 칩 줄 오른쪽. 기존 화면이 다시 그릴 때마다 새로 만들 수 있다 — 새로 생긴 것이 있으면 그것을 쓰고 예전 것은 치운다(재진입 때 노드가 쌓이지 않게) */
  const now=document.querySelector('#inq-v3 .inq-work-tools, #inq-v2 .inq-work-tools, #pg-inq .inq-inbox-heading .inq-work-tools'),keep=KEEP.tools;
  if(now&&keep&&now!==keep&&keep.parentNode)keep.remove();
  const tools=now||keep||null;if(tools){KEEP.tools=tools;const ms=host.querySelector('.i4-more-slot');if(ms&&tools.parentNode!==ms)ms.append(tools);}
  /* [+ 문의 등록] = 위 탭 줄 오른쪽 끝. 버튼은 문의 등록 모듈(inquiry-create.js)이 권한에 따라 만들고 지운다 — 여기서는 놓일 자리만 둔다.
     자리가 생기기 전에 다른 곳에 만들어진 버튼은 이번 한 번 옮겨 준다(붙잡아 두지 않는다 — 권한이 없어지면 그 모듈이 지운 그대로 사라져야 한다) */
  const bar=page.querySelector(':scope>.b2b-bar');let slot=document.getElementById('i4-create-slot');
  if(!slot){slot=document.createElement('span');slot.id='i4-create-slot';if(bar)bar.after(slot);else page.prepend(slot);}
  const trig=page.querySelector('.inq-create-trigger');if(trig&&trig.parentNode!==slot)slot.append(trig);
 }
 function giveBack(){
  const t=KEEP.tools;if(t){const s=document.querySelector('#inq-v3 .il-more-slot, #inq-v2 .iv-more-slot');if(s)s.append(t);}KEEP.tools=null;
  const slot=document.getElementById('i4-create-slot');if(slot){const trig=slot.querySelector('.inq-create-trigger'),s=document.querySelector('#inq-v3 .il-create-slot, #inq-v2 .iv-create-slot');if(trig&&s)s.append(trig);slot.remove();}
 }
 function fit(){
  const p=document.querySelector('#inq-v4 .i4-panes');if(p){const top=p.getBoundingClientRect().top;p.style.height=Math.max(420,Math.floor(window.innerHeight-top-14))+'px';}
  /* 등록 버튼 자리: 위 탭 줄의 오른쪽 끝(CSS right:0 — 재는 값에 기대지 않는다) · 세로는 탭 줄 높이에 맞춘다 */
  const slot=document.getElementById('i4-create-slot'),page=document.getElementById('pg-inq'),bar=page&&page.querySelector(':scope>.b2b-bar');
  if(slot&&bar){slot.style.top=bar.offsetTop+'px';if(bar.offsetHeight)slot.style.height=bar.offsetHeight+'px';}
 }
 function render(){
  const page=document.getElementById('pg-inq');if(!page)return;let host=document.getElementById('inq-v4');
  if(!on()){if(page.classList.contains('inq-v4')){page.classList.remove('inq-v4');giveBack();}if(host)host.remove();return;}
  page.classList.add('inq-v4');try{const k=K();if(k)k.warm();}catch(e){}
  if(!host){host=document.createElement('div');host.id='inq-v4';const v3=document.getElementById('inq-v3');if(v3)v3.before(host);else page.append(host);host.addEventListener('click',onClick);host.addEventListener('input',onInput);host.addEventListener('keydown',onKeyIn);}
  const S=st(),V=compute(),LP=root.ListPager,list=V.list,prevSel=host.__sel;
  let ix=S.sel?list.findIndex(m=>m.key===S.sel):-1;
  if(ix>=0)S.page=Math.floor(ix/LP.SIZE)+1;
  let pg=LP.cut(list,LP.page(S));
  if(ix<0){S.sel=pg.rows.length?pg.rows[0].key:'';ix=pg.rows.length?pg.from:-1;resetForm(S);S.detail=false;}
  const cur=ix>=0?list[ix]:null;
  const keepList=host.querySelector('.i4-list')?host.querySelector('.i4-list').scrollTop:0,keepDet=host.querySelector('.i4-detail')?host.querySelector('.i4-detail').scrollTop:0;
  const act=document.activeElement,focusF=act&&host.contains(act)&&act.dataset?act.dataset.i4f:'',caret=focusF?act.selectionStart:null;
  const tabs='<div class="i4-tabs" role="group" aria-label="상태 탭">'+V.T.map(t=>{const n=t[4]?V.all.filter(m=>m.st===t[4]).length:V.all.length,o=S.tab===t[0];return '<button type="button" class="i4-tab'+(o?' on':'')+'" data-i4="tab" data-v="'+t[0]+'" aria-pressed="'+o+'"><span><b class="n" style="color:'+(n?t[3]:'#c9cdd5')+'">'+n+'</b><b>'+h(t[1])+'</b></span><small>'+h(t[2])+'</small></button>';}).join('')+'</div>';
  const flags='<div class="i4-flags"><span class="lb">함께 확인</span>'+FLAGS.map(f=>{const n=V.inTab.filter(f[3]).length,o=S.flag===f[0];return '<button type="button" class="i4-flag'+(o?' on':'')+(n||o?'':' zero')+'" data-i4="flag" data-v="'+f[0]+'" aria-pressed="'+o+'">'+h(f[1])+' <b'+(o||!n?'':' style="color:'+f[2]+'"')+'>'+n+'</b></button>';}).join('')
   +'<i></i><span class="i4-more-slot"></span><span class="cnt"'+(CACHE.handed?' title="영업건으로 넘긴(전환 · 기존 영업건에 붙임) 문의 '+CACHE.handed+'건은 진행 중에서 빠집니다"':'')+'><b>'+list.length+'건</b> · '+(S.sort==='urgent'?'급한 순':S.sort==='old'?'오래된 순':'최근 순')+' · ↑ ↓ 이동</span><div class="i4-sorts"><button type="button" data-i4="sort" data-v="urgent" aria-pressed="'+(S.sort==='urgent')+'" title="① 신규 첫 연락 → ② 고객 약속 · 회의 → ③ 후속 기한 → ④ 과거 기록 정리">급한 순</button><button type="button" data-i4="sort" data-v="old" aria-pressed="'+(S.sort==='old')+'">오래된 순</button><button type="button" data-i4="sort" data-v="new" aria-pressed="'+(S.sort==='new')+'">최근 순</button></div></div>';
  const kt=KEEP.tools;if(kt&&host.contains(kt))kt.remove();
  host.innerHTML=tabs+flags+'<div class="i4-panes'+(S.detail&&cur?' show-detail':'')+'"><section class="i4-list" aria-label="문의 목록">'+(pg.rows.length?pg.rows.map(m=>rowHtml(m,m.key===S.sel)).join(''):'<div class="i4-empty">이 조건에 해당하는 문의가 없습니다</div>')+LP.html(pg,{ns:'i4',unit:'건',small:true})+'</section>'
   +'<section class="i4-detail" aria-label="고른 문의">'+(cur?detailHtml(cur,S):'<div class="i4-none">왼쪽에서 문의를 고르면 여기에 열립니다</div>')+'</section></div>';
  KEEP.tools=kt;placeMoved(host,page);fit();
  const ls=host.querySelector('.i4-list'),ds=host.querySelector('.i4-detail');if(ls)ls.scrollTop=keepList;if(ds)ds.scrollTop=prevSel===S.sel?keepDet:0;
  if(prevSel!==S.sel){const r=host.querySelector('.i4-row.on');if(r&&r.scrollIntoView)try{r.scrollIntoView({block:'nearest'});}catch(e){}}
  host.__sel=S.sel;
  if(focusF){const el=host.querySelector('[data-i4f="'+focusF+'"]');if(el){el.focus();try{if(caret!=null&&el.type!=='date')el.setSelectionRange(caret,caret);}catch(e){}}}
  try{root.PCRouter&&root.PCRouter.replace&&root.PCRouter.replace();}catch(e){}
 }
 const find=key=>VIEW.list.find(m=>m.key===key)||base().find(m=>m.key===key)||null;
 function select(key,quiet){const S=st();if(!key||S.sel===key){if(!quiet&&key){S.detail=true;render();}return;}S.sel=key;resetForm(S);S.detail=!quiet;if(on())render();}
 function move(d){const S=st(),L=VIEW.list.map(m=>m.key);if(!L.length)return;const p=L.indexOf(S.sel),n=L[Math.max(0,Math.min(L.length-1,(p<0?0:p)+d))];if(n&&n!==S.sel){S.sel=n;resetForm(S);render();}}
 function dial(d){if(!d)return;const a=document.createElement('a');a.href='tel:'+d;a.style.display='none';document.body.append(a);a.click();a.remove();}
 const toast=(m,k)=>{try{if(typeof root.toast==='function')root.toast(m,k);}catch(e){}};
 /* 응대 기록 저장 → 다음 문의 */
 function save(){
  const S=st(),m=find(S.sel);if(!m||!S.res||S.busy||m.step===0)return;const q=root.inqCtlFind(m.key,false);if(!q)return;
  const order=VIEW.list.map(x=>x.key),p=order.indexOf(m.key),nextKey=order[p+1]||order[p-1]||'';
  const w=whenOf(m,S),nd=dueOf(m,w),nt=nextText(S.res),memo=String(S.memo||'').trim(),line='[전화 · '+S.res+']'+(memo?' '+memo:'');
  const before=JSON.parse(JSON.stringify(q)),patch=root.itemPatch(q,'inq'),beforePatch=JSON.parse(JSON.stringify(patch));
  let ok=false;S.err='';
  try{ok=L3().record(q,Object.assign({res:line,next:nt,due:dayStr(nd)},S.con?{contact_result:root.InquiryFlow.TWO.of(S.con,S.rea).contact_result,customer_reaction:root.InquiryFlow.TWO.of(S.con,S.rea).customer_reaction}:{}))===true;}
  catch(e){Object.keys(q).forEach(k=>delete q[k]);Object.assign(q,before);Object.keys(patch).forEach(k=>delete patch[k]);Object.assign(patch,beforePatch);S.err=e.message||'저장 연결을 확인해 주세요.';}
  if(!ok){if(!S.err)S.err=(document.getElementById('iq-msg')||{}).textContent||'저장하지 못했습니다.';return render();}
  toast(S.res+' → '+nt+' '+kday(nd));resetForm(S);if(nextKey)S.sel=nextKey;fresh();root.paint();
 }
 /* 메모 속 통화 보완 · 과거 약속 판단(InquiryMemo.run → 서버 + 이 PC) */
  function memoAct(a,m,b){
   const S=st(),k=K(),q=root.inqCtlFind(m.key,false);if(!k||!q)return;S.memoErr='';
   try{if(a==='memo-call')k.run('call_supplement',q,{key:b.dataset.v});else k.run('promise',q,{key:b.dataset.key,res:b.dataset.v});}
   catch(e){S.memoErr=String(e&&e.message||'저장하지 못했습니다');return render();}
   toast(a==='memo-call'?'실제 연결일을 보완했습니다':'약속 판단을 저장했습니다');fresh();root.paint();
  }
  /* 연락처 보완: 찾은 번호를 문의 연락처로 저장(상세 창과 같은 저장 길 — InquiryCommand field_set · phone) → 저장된 배정·연락 기록으로 목록 재계산 */
  function savePhone(m,digits){
   const S=st(),q=root.inqCtlFind(m.key,false),value=String(digits||'').trim();if(!q||!value||S.busy)return;
   S.busy=true;S.findErr='';render();
   Promise.resolve().then(()=>root.InquiryCommand.run('field_set',q,{field:'phone',value})).then(done=>{DV().applyField(q,(done&&done.field)||'phone',(done&&done.value)||value,done&&done.rawKey);try{root.saveLocal&&root.saveLocal();}catch(e){}
    Object.assign(S,{busy:false,find:false,findErr:''});toast('연락처를 저장했습니다 — 배정·연락·이관 기록에 따라 할 일을 다시 확인합니다');fresh();root.paint();
   }).catch(e=>{Object.assign(S,{busy:false,findErr:String(e&&e.message||e||'저장하지 못했습니다')});render();});
  }
  /* 빠진 정보 한 칸 저장 */
 function saveMiss(){
  const S=st(),m=find(S.sel),f=FIELD[S.edit];if(!m||!f||S.busy)return;const q=root.inqCtlFind(m.key,false),value=String(S.draft||'').trim();if(!q)return;
  if(!value){S.edit='';S.draft='';return render();}
  S.busy=true;S.err='';render();
  Promise.resolve().then(()=>root.InquiryCommand.run('field_set',q,{field:f[0],value})).then(done=>{DV().applyField(q,(done&&done.field)||f[0],(done&&done.value)||value,done&&done.rawKey);try{root.saveLocal&&root.saveLocal();}catch(e){}
   Object.assign(S,{busy:false,edit:'',draft:''});toast('저장했습니다');fresh();root.paint();
  }).catch(e=>{Object.assign(S,{busy:false,err:String(e&&e.message||e||'저장하지 못했습니다')});render();});
 }
 function openFull(key,act){const w=W();if(!w)return;return act?w.open(key,act):w.open(key);}
 function onClick(e){
  const b=e.target.closest('[data-i4]');if(!b)return;const S=st(),a=b.dataset.i4,v=b.dataset.v;
  if(a==='tab'){S.tab=v;S.flag='';S.page=1;S.sel='';return render();}
  if(a==='flag'){S.flag=S.flag===v?'':v;S.page=1;S.sel='';return render();}
  if(a==='sort'){S.sort=v==='new'?'new':v==='old'?'old':'urgent';S.page=1;S.sel='';return render();}
  if(a==='page'){const pg=root.ListPager.cut(VIEW.list,Number(b.dataset.page)||1);S.page=pg.page;S.sel=pg.rows.length?pg.rows[0].key:'';resetForm(S);S.detail=false;return render();}
  if(a==='row'){const key=b.dataset.key;if(S.sel===key){S.detail=true;return render();}return select(key);}
  if(a==='back'){S.detail=false;return render();}
  const m=find(S.sel);if(!m)return;
  if(a==='call')return dial(b.dataset.tel);
  if(a==='full')return openFull(m.key);
  if(a==='assign')return openFull(m.key,root.inqCtlRoleView&&root.inqCtlRoleView()==='admin'?'rep':undefined);
  if(a==='sms'){openFull(m.key);return setTimeout(()=>{const x=document.querySelector('#inq-inbox-dialog [data-idv="sms-open"]');if(x&&!x.disabled&&x.getAttribute('aria-pressed')!=='true')x.click();else if(!x&&DV().openSms)DV().openSms();},350);}
  if(a==='miss'){if(v==='다음 행동 · 날짜'){const r=document.querySelector('#inq-v4 .i4-rec');if(r&&r.scrollIntoView)r.scrollIntoView({block:'nearest'});return;}if(!FIELD[v]||!canFill())return openFull(m.key);S.edit=v;S.draft='';S.err='';render();const i=document.querySelector('#inq-v4 [data-i4f="draft"]');if(i)i.focus();return;}
  if(a==='miss-cancel'){S.edit='';S.draft='';return render();}
  if(a==='miss-save')return saveMiss();
  if(a==='con'||a==='rea'){const T=F().TWO;if(a==='con'){S.con=S.con===v?'':v;if(!T.isReal(S.con))S.rea='';}else S.rea=S.rea===v?'':v;S.res=T.res(S.con,S.rea);S.when='';S.pick=false;S.err='';return render();}
  if(a==='pick'){S.pick=!S.pick;return render();}
  if(a==='when'){S.when=v;return render();}
  if(a==='save')return save();
   if(a==='memo-call'||a==='promise')return memoAct(a,m,b);
   if(a==='phone-find'){S.find=!S.find;S.findErr='';return render();}
   if(a==='phone-save')return savePhone(m,b.dataset.v);
 }
 function onInput(e){const k=e.target.dataset&&e.target.dataset.i4f;if(!k)return;const S=st();if(k==='memo')S.memo=e.target.value;else if(k==='draft')S.draft=e.target.value;}
 function onKeyIn(e){
  const t=e.target;
  if(t.matches&&t.matches('.i4-row')&&(e.key==='Enter'||e.key===' ')){e.preventDefault();t.click();return;}
  if(t.dataset&&t.dataset.i4f==='draft'){if(e.key==='Enter'){e.preventDefault();saveMiss();}else if(e.key==='Escape'){e.preventDefault();e.stopPropagation();const S=st();S.edit='';S.draft='';render();}}
 }
 /* ↑ ↓ = 이동(입력 중 · 다른 창이 떠 있을 때는 무시) */
 function onKey(e){
  if(e.key!=='ArrowDown'&&e.key!=='ArrowUp')return;if(e.altKey||e.ctrlKey||e.metaKey||e.shiftKey)return;
  if(!root.G||root.G.page!=='inq'||!on())return;const page=document.getElementById('pg-inq');if(!page||!page.classList.contains('inq-v4')||page.classList.contains('b2b-on'))return;
  const t=e.target,tag=t&&t.tagName;if(tag==='INPUT'||tag==='TEXTAREA'||tag==='SELECT'||(t&&t.isContentEditable))return;
  if(document.getElementById('inq-inbox-dialog')||document.querySelector('#detailView.on,.modal.on,dialog[open]'))return;
  e.preventDefault();move(e.key==='ArrowDown'?1:-1);
 }
 if(root.document){root.document.addEventListener('keydown',onKey);root.addEventListener('resize',()=>{try{fit();}catch(e){}});}
 /* 목록 v3 가 그린 뒤에 그 자리를 대신한다(v3 는 가려 두고, 끄면 그대로 나온다) */
 const basePaint=root.paintInq;
 if(typeof basePaint==='function')root.paintInq=function(){fresh();const r=basePaint.apply(this,arguments);try{render();}catch(err){const p=document.getElementById('pg-inq');if(p)p.classList.remove('inq-v4');const hst=document.getElementById('inq-v4');if(hst)hst.remove();try{giveBack();}catch(e){}if(root.console)root.console.warn('inquiry v4: '+err.message);}return r;};
 if(L2()&&typeof L2().brandStats==='function'){ORIG_BS=L2().brandStats;L2().brandStats=brandStats;}
 root.addEventListener('activity-links:changed',e=>{const key=String(st().sel||''),log=document.querySelector('#inq-v4 .i4-log'),q=root.inqCtlFind?.(key,false);if(on()&&q&&log&&e.detail?.key==='inq:'+key)log.outerHTML=logHtml(q,key);});
 root.InquiryV4={on,render,select,move,total,brandStats,base,compute,state:st,fresh,TABS:()=>TABS().map(t=>t[0]),FLAGS:FLAGS.map(f=>f[0]),selected:()=>on()?String(st().sel||''):''};
})(window);
