/* 연락 판정 하나 — 같은 현장 · 같은 문의는 어느 화면에서나 같은 줄 (2026-10-05 대표 핸드오프 design_handoff_consistency ① 상태 충돌 해소)
   무엇이 문제였나: 강변삼부아파트가 오늘 업무 한 줄에는 '첫 연락 기록 없음', 다른 줄에는 '첫 연락 2026.9.21' 로 나왔다.
     운영 자료를 보니 ① 같은 문의가 1~3초 차이로 두 번 들어온 복제 줄(시트에서 온 줄 + 접수 양식에서 바로 온 줄)이 있고
     ② 같은 현장이 며칠 뒤 다시 문의한 줄이 따로 있는데, 통화 기록은 그중 한 줄에만 붙어 있었다. 화면은 줄마다 따로 판정했다.
   여기서 정하는 것(판정 함수 하나 — 오늘 업무 · 견적문의 · 파이프라인 · 상세가 같이 쓴다):
     · 복제 줄(shadows): 같은 현장 · 같은 브랜드 · 같은 전화 · 접수 시각 60초 안 · 담당도 응대도 없는 '접수' 줄 → 원래 줄의 그림자. 목록 · 건수에서 뺀다(자료는 지우지 않는다 — 정리 보관 쪽으로만).
     · 같은 건(siblings): 같은 현장 · 같은 브랜드의 다른 문의. 그 문의에 남긴 연락도 이 문의의 연락이다 — 단, 이 문의가 접수된 뒤의 연락만(InquiryFlow.state 가 합친다).
     · 세 줄(lines): 연락 시도 · 실제 연결 · 다음 행동. 한 줄 요약(recent)도 같은 값에서 만든다.
     · 기록이 없을 때: '연락 안 함'으로 단정하지 않는다 → "CRM 연락 기록 없음 (이관 전 기록 확인 필요)". 운영 시작일(Live) 뒤에 들어온 건은 이관 자료가 아니므로 괄호 없이 "CRM 연락 기록 없음".
   영업건: 영업건의 활동 + 넘어온 문의(origin_inquiry_id)의 연락 + 마지막 의미 있는 연락(relationshipMeta)을 같이 본다.
   끄기: G.contactStateOff=true → 예전처럼 줄마다 따로 판정. */
(function(root){
 'use strict';
 const NONE='CRM 연락 기록 없음',NONE_OLD='CRM 연락 기록 없음 (이관 전 기록 확인 필요)',NOT_YET='아직 없음',SHADOW_MS=60000;
 const on=()=>!(root.G&&root.G.contactStateOff);
 const live=()=>String(root.OPS_RULES&&root.OPS_RULES.liveFrom||'2026-10-01');
 const tOf=v=>{const n=Date.parse(v||'');return Number.isFinite(n)?n:NaN;};
 const min=(a,b)=>!a?b||'':!b?a:(tOf(a)<=tOf(b)?a:b),max=(a,b)=>!a?b||'':!b?a:(tOf(a)>=tOf(b)?a:b);
 const digits=v=>String(v==null?'':v).replace(/\D/g,'');
 const norm=s=>typeof root.normSite==='function'?root.normSite(s):String(s||'').replace(/\[[^\]]*\]/g,'').replace(/\s+/g,'').replace(/아파트|현장/g,'').toLowerCase();
 const idOf=q=>String(q&&(q.id||q.row||[q.site,q.at].join('|'))||'');
 const recvAt=q=>q.received_at||q.at||q.created_at||q.created||'';
 const phoneOf=q=>digits((q.detail&&q.detail.phone)||q.phone||q.contact_phone||q.mobile);
 /* 묶음 열쇠 = 현장 이름(지역 표시 · 띄어쓰기 · '아파트' 제외) + 브랜드. 이름이 없거나 '-' · '미입력' 같은 자리 채움이면 묶지 않는다(서로 다른 고객이 한 건으로 합쳐지지 않게) */
 const JUNK=/^(?:-+|없음|미입력|미정|모름|확인불가|확인중|(?:현장)?명미입력|(?:현장)?명미제공)$/;/* 이름 정리(norm)가 '현장'을 떼므로 '명미입력' 꼴도 본다 */
 const caseKey=q=>{const k=norm(q&&(q.site||q.site_name));return k&&k.length>=2&&!JUNK.test(k)?k+'|'+String(q.brand||'').trim():'';};
 const call=(name,arg,d)=>{try{return typeof root[name]==='function'?root[name](arg):d;}catch(e){return d;}};
 /* 날짜: 2026.9.21 / 10.6 (서울 날짜) */
 const KST=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'});
 const dayKey=v=>{const s=String(v||'');if(/^\d{4}-\d{2}-\d{2}$/.test(s))return s;const t=tOf(s);return Number.isFinite(t)?KST.format(new Date(t)):'';};
 const ymd=v=>{const m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(dayKey(v));return m?+m[1]+'.'+(+m[2])+'.'+(+m[3]):'';};
 const md=v=>{const m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(dayKey(v));return m?(+m[2])+'.'+(+m[3]):'';};

 /* ── 복제 줄 · 같은 건 ── */
 const gone=q=>!q||typeof q!=='object'||call('inqCtlPurged',q,false)||call('inqCtlDeleted',q,false)||call('isTechnicalInquiry',q,false)||['merged','activity'].includes(q.duplicate_resolution);
 /* 아무도 손대지 않은 줄: 담당 없음 · 상태 접수 · 응대 시각 · 기록 · 영업건 연결 없음. '따로 두기'로 정한 줄은 그림자로 보지 않는다 */
 function untouched(q){
  if(q.duplicate_resolution==='keep_separate')return false;
  if(['접수','신규',''].indexOf(String(q.status||''))<0)return false;
  if(call('inquiryRoutedOwner',q,q.assignee||q.assignee_name||''))return false;
  if(q.responded_at||q.respondedAt||q.first_response_at||q.deal_id||q.opportunity_id||q.attached_deal_id)return false;
  return !((q.activities&&q.activities.length)||(q.responses&&q.responses.length));
 }
 function groups(list){const by=new Map();(list||[]).forEach(q=>{if(gone(q))return;const k=caseKey(q);if(!k)return;const a=by.get(k);if(a)a.push(q);else by.set(k,[q]);});return by;}
 /* 목록 → 그림자 줄(id → 원래 줄). 둘 다 손대지 않은 줄이면 먼저 들어온 줄(같은 시각이면 시트에서 온 줄)이 원래 줄 */
 function shadows(list){
  const out=new Map();if(!on())return out;
  groups(list).forEach(arr=>{if(arr.length<2)return;
   arr.sort((a,b)=>(tOf(recvAt(a))-tOf(recvAt(b)))||((b.sheet_row!=null)-(a.sheet_row!=null))||idOf(a).localeCompare(idOf(b)));
   arr.forEach((b,bi)=>{if(!untouched(b))return;const tb=tOf(recvAt(b));if(!Number.isFinite(tb))return;
    const p=arr.find((a,ai)=>a!==b&&!out.has(idOf(a))&&phoneOf(a)===phoneOf(b)&&Math.abs(tOf(recvAt(a))-tb)<=SHADOW_MS&&(!untouched(a)||ai<bi));
    if(p)out.set(idOf(b),p);});
  });
  return out;
 }
 /* 지금 열려 있는 문의 목록의 묶음(잠깐 기억: 한 번 그리는 동안 여러 번 불린다) */
 let IDX=null;
 function index(){
  const list=root.B&&Array.isArray(root.B.inquiries)?root.B.inquiries:[];
  if(IDX&&IDX.list===list&&IDX.len===list.length&&Date.now()-IDX.at<1500)return IDX;
  const sh=shadows(list),by=groups(list.filter(q=>!sh.has(idOf(q))));
  IDX={list,len:list.length,at:Date.now(),by,sh};return IDX;
 }
 const shadowOf=q=>on()&&q?index().sh.get(idOf(q))||null:null;
 /* 같은 현장 · 같은 브랜드의 다른 문의(그림자 줄 제외). 그림자 줄에게는 원래 줄이 같은 건이다 */
 function siblings(q){
  if(!on()||!q)return [];const I=index(),k=caseKey(q);if(!k)return [];const id=idOf(q);
  return (I.by.get(k)||[]).filter(x=>x!==q&&idOf(x)!==id);
 }

 /* ── 판정 ── */
 const patchOf=(it,kind)=>{try{return (root.itemPatch&&root.itemPatch(it,kind))||{};}catch(e){return {};}};
 function nextOf(it,kind){let a=null;try{a=root.actionObj?root.actionObj(it,patchOf(it,kind)):null;}catch(e){}return a&&(a.text||a.due)?{text:String(a.text||'').trim(),due:a.due||a.due_at||''}:null;}
 function ofInq(q){
  const F=root.InquiryFlow,v=F&&F.on&&F.on()?F.state(q):null;
  let fa='',fc='',la='',lc='',n=0,res='';
  if(v){fa=v.firstAttemptAt||'';fc=v.firstConnectedAt||'';n=v.attempts||0;
   (v.logs||[]).forEach(l=>{if(l.kind==='attempt'){la=max(la,l.at);if(!res)res=l.res||'';}else if(l.kind==='connected')lc=max(lc,l.at);});
   la=max(la,fa);lc=max(lc,fc);}
  else{fc=call('inqCtlFirstResponseAt',q,'')||'';lc=fc;}
  return {kind:'inq',firstAttemptAt:fa,firstConnectedAt:fc,lastAttemptAt:la,lastConnectedAt:lc,attempts:n,attemptRes:res,next:nextOf(q,'inq'),legacy:dayKey(recvAt(q))<live()};
 }
 function refsOf(d){let ids=[];try{ids=root.dealInquiryRefs?root.dealInquiryRefs(d):[d.origin_inquiry_id,d.originInquiryId,d.fromInquiry].filter(Boolean).map(String);}catch(e){}
  if(!ids.length)return [];const L=(root.B&&root.B.inquiries||[]).concat(root.B&&root.B.inquiryCleanupArchived||[]);return ids.map(id=>L.find(q=>String(q.id)===String(id))).filter(Boolean);}
 function ofDeal(d){
  const F=root.InquiryFlow,p=patchOf(d,'deal'),seen=new Set();let fa='',fc='',la='',lc='',n=0,res='';
  [].concat(d.activities||[],p.activities||[]).forEach(a=>{const k=a&&(a.id||[a.at,a.type,a.note,a.result].join('|'));if(!a||seen.has(k))return;seen.add(k);let l=null;try{l=F&&F.logOf?F.logOf(a):null;}catch(e){}if(!l)return;
   if(l.kind==='attempt'){fa=min(fa,l.at);if(tOf(l.at)>=tOf(la||0)||!la){la=max(la,l.at);res=l.res||res;}n++;}else if(l.kind==='connected'){fc=min(fc,l.at);lc=max(lc,l.at);}});
  /* 문의에서 넘어온 건: 문의 때의 연락도 이 영업건의 연락 */
  refsOf(d).forEach(q=>{const v=ofInq(q);fa=min(fa,v.firstAttemptAt);fc=min(fc,v.firstConnectedAt);la=max(la,v.lastAttemptAt);lc=max(lc,v.lastConnectedAt);if(!res)res=v.attemptRes;n+=v.attempts||0;});
  /* 마지막 의미 있는 연락 · 마지막 발신(예전 자료는 이 칸에만 남아 있다) */
  let m=null;try{m=root.relationshipMeta?root.relationshipMeta(d):null;}catch(e){}
  if(m&&m.meaningfulAt){lc=max(lc,m.meaningfulAt);fc=min(fc,m.meaningfulAt);}
  if(m&&m.outboundAt){la=max(la,m.outboundAt);fa=min(fa,m.outboundAt);}
  return {kind:'deal',firstAttemptAt:fa,firstConnectedAt:fc,lastAttemptAt:la,lastConnectedAt:lc,attempts:n,attemptRes:res,next:nextOf(d,'deal'),legacy:dayKey(d.created||d.created_at||d.opened_at)<live()};
 }
 /* Customer-asset contact dates require evidence on this record. Do not use
    generic timestamps, inferred first response, sibling-name matching or queued patches. */
 function contactDates(item,type){
  if(!item||typeof item!=='object')return [];
  const dates=new Set(),F=root.InquiryFlow;
  const add=at=>{const t=tOf(at);if(Number.isFinite(t)&&t<=Date.now())dates.add(String(at));};
  (Array.isArray(item.activities)?item.activities:[]).forEach(a=>{
   if(!a)return;
   const kind=String(a.type||''),res=String(a.contact_result||a.result||''),note=String(a.note||'');
   if(/메모|시스템|단계|배정|수정|체크|이관/.test(kind))return;
   // A scheduled visit/call is not a completed contact, even if the type contains 방문/전화.
   if(/예정|예약|계획|요청|취소/.test(kind)||(!res&&!a.flow&&/예정|예약|계획|하기로|취소/.test(note)))return;
   let l=null;try{l=F&&F.logOf?F.logOf(a):null;}catch(e){}
   if(l&&l.kind==='connected')add(l.at);
  });
  if(type==='inq'||type==='inquiry'){
   let s=null;try{s=F&&F.server?F.server(item):null;}catch(e){}
   (s&&Array.isArray(s.logs)?s.logs:[]).forEach(l=>{if(l&&l.kind==='connected')add(l.occurred_at||l.at);});
   try{if(root.InquiryMemo&&root.InquiryMemo.confirmedCallDay)add(root.InquiryMemo.confirmedCallDay(item));}catch(e){}
  }else{
   // These fields explicitly store customer contact; contactAt/lastActivity may be imported timestamps.
   [item.lastMeaningfulContactAt,item.last_meaningful_contact_at,item.last_customer_contact_at].forEach(add);
   refsOf(item).forEach(q=>contactDates(q,'inq').forEach(add));
  }
  return [...dates].sort((a,b)=>tOf(a)-tOf(b));
 }
 const contactRevision=()=>[root.InquiryFlow&&root.InquiryFlow.revision?root.InquiryFlow.revision():0,root.InquiryMemo&&root.InquiryMemo.revision?root.InquiryMemo.revision():0].join('|');
 const isInq=type=>type==='inq'||type==='inquiry';
 function of(item,type){
  if(!item||typeof item!=='object')return {kind:isInq(type)?'inq':'deal',firstAttemptAt:'',firstConnectedAt:'',lastAttemptAt:'',lastConnectedAt:'',attempts:0,attemptRes:'',next:null,legacy:false};
  return isInq(type)?ofInq(item):ofDeal(item);
 }
 const noneOf=v=>v.legacy?NONE_OLD:NONE;
 const none=(item,type)=>noneOf(of(item,type));
 /* 세 줄: 연락 시도 · 실제 연결 · 다음 행동. 문의 = 처음(첫 응대 기준), 영업건 = 가장 최근 */
 function lines(item,type){
  const v=of(item,type),inq=v.kind==='inq',att=inq?v.firstAttemptAt:v.lastAttemptAt,con=inq?v.firstConnectedAt:v.lastConnectedAt;
  /* 시도 줄의 날짜: 연결이 곧 시도이기도 하다. 문의는 둘 중 이른 날, 영업건은 늦은 날 */
  const tryAt=inq?min(att,con):max(att,con),byCon=!!con&&(!att||(inq?tOf(con)<=tOf(att):tOf(con)>=tOf(att)));
  const tryText=tryAt?[ymd(tryAt),byCon?'연결됨':(v.attemptRes||''),(!byCon&&v.attempts>1)?v.attempts+'회':''].filter(Boolean).join(' · '):noneOf(v);
  const nx=v.next?[v.next.text||'다음 행동',v.next.due?md(v.next.due):'날짜 없음'].join(' · '):'없음';
  return [{k:'attempt',label:'연락 시도',text:tryText,empty:!tryAt},{k:'connected',label:'실제 연결',text:con?ymd(con):NOT_YET,empty:!con},{k:'next',label:'다음 행동',text:nx,empty:!v.next}];
 }
 /* 한 줄 요약(목록 · 카드의 '지난 기록' 칸) */
 function recent(item,type){
  const v=of(item,type),inq=v.kind==='inq',con=inq?v.firstConnectedAt:v.lastConnectedAt,att=inq?v.firstAttemptAt:v.lastAttemptAt;
  if(con)return (inq?'실제 연결 ':'최근 연락 ')+ymd(con);
  if(att)return ['연락 시도 '+ymd(att),v.attemptRes||'',v.attempts>1?v.attempts+'회':'','실제 연결 '+NOT_YET].filter(Boolean).join(' · ');
  return noneOf(v);
 }
 root.ContactState={on,NONE,NONE_OLD,NOT_YET,caseKey,shadows,shadowOf,siblings,of,lines,recent,none,contactDates,contactRevision,ymd,md,_reset(){IDX=null;}};
})(typeof window!=='undefined'?window:globalThis);
