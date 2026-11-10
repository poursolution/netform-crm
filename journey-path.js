/* 문의 → 영업 → 계약 → 시공 경로 한 줄 (2026-11-05 대표 "영업부터 계약까지 여정이 안 보이고 힘들다" → 1 · 2번부터)
   무엇이 문제였나: 문의 상세는 문의 4칸, 영업건 상세는 영업 6칸만 보여 줘서 한 건이 지금 전체 경로의 어디에 있는지 안 보였고, 영업건에서 원래 문의로 돌아갈 길이 없었다.
   여기서 하는 것: 두 상세의 진행 띠 위에 네 칸 한 줄을 덧붙인다. 기존 띠 · 버튼 · 저장은 그대로이고 이 줄은 읽기 + 이동만 한다.
     · 칸의 뜻: 끝남 = done / 지금 = cur / 아직 · 해당 없음 = todo / 닫힘(실주 · Bad Fit 등) = end
     · 없는 사실은 적지 않는다 — 날짜가 없으면 '미기록', 계약일 · 금액이 없으면 '기록 없음'.
   원래 문의를 찾는 근거: ① 영업건에 적힌 문의 번호(origin_inquiry_id 등) ② 문의에 적힌 영업건 번호 ③ '같은 공사'로 붙인 문의. 이것이 '연결된 문의'다.
     연결 기록이 없을 때 같은 현장 ID 의 문의는 후보일 뿐이라 '연결 기록 없음 · 같은 현장 문의 n건'으로 구분해 적는다(같은 현장에 다른 공사가 여러 건 있을 수 있다).
   끄기: G.journeyPathOff=true → 예전처럼 띠만. */
(function(root){
 'use strict';
 const h=v=>root.esc(String(v==null?'':v)),attr=v=>root.escAttr(String(v==null?'':v));
 const on=()=>!(root.G&&root.G.journeyPathOff);
 const safe=(f,z)=>{try{const v=f();return v==null?z:v;}catch(e){return z;}};
 const TZ=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'});
 const day=v=>{const s=String(v||'');if(/^\d{4}-\d{2}-\d{2}$/.test(s))return s;const n=Date.parse(s);return Number.isFinite(n)?TZ.format(new Date(n)):'';};
 const dot=k=>{const m=/^(\d{4})-(\d{2})-(\d{2})/.exec(String(k||''));return m?m[1]+'.'+Number(m[2])+'.'+Number(m[3]):'';};
 const DF=()=>root.DealFrame7,L3=()=>root.InquiryListV3||{},W=()=>root.InquiryWorkbench;
 const NONE='—';
 const seg=(name,st,v,extra)=>Object.assign({name,st,v},extra||{});
 const fieldOf=(d,code,key)=>{const p=safe(()=>root.itemPatch(d,'deal')||{},{}),c=Object.assign({},(p.stage_contexts||{}),(d.stage_contexts||{}))[code],v=c&&c.fields?c.fields[key]:'';return v==null?'':v;};
 const inqId=q=>String(q&&(q.id||q.inquiry_id)||''),dealId=d=>String(d&&(d.id||d.opportunity_id)||'');
 const recvOf=q=>day(safe(()=>root.inquiryCreatedAt(q),''));
 const byRecv=(a,b)=>recvOf(a).localeCompare(recvOf(b));
 const attachedTo=q=>{const r=q&&q.raw&&typeof q.raw==='object'?q.raw:{};return String(r['기존 현장 판단']||'')==='같은 공사'?String(r['기존 영업건']||''):'';};
 const toDeal=q=>safe(()=>root.inquiryDealRefs(q),[]);
 /* 목록이 영업건마다 부르므로(handoff) 문의 색인을 한 번만 만든다 — 자료가 바뀌면 다시, 아니어도 3초 뒤 다시(InquiryListV3.siteIndex 와 같은 방식) */
 let IX={src:null,n:-1,at:0,byId:new Map(),byDeal:new Map()};
 function index(){
  const all=(root.B&&root.B.inquiries)||[];if(IX.src===all&&IX.n===all.length&&Date.now()-IX.at<3000)return IX;
  const byId=new Map(),byDeal=new Map(),put=(k,q)=>{if(!k)return;const a=byDeal.get(k);if(a)a.push(q);else byDeal.set(k,[q]);};
  all.forEach(q=>{const id=inqId(q);if(id)byId.set(id,q);toDeal(q).forEach(k=>put(k,q));put(attachedTo(q),q);});
  return IX={src:all,n:all.length,at:Date.now(),byId,byDeal};
 }
 function directOf(d){
  const I=index(),out=new Set();safe(()=>root.dealInquiryRefs(d),[]).forEach(k=>{const q=I.byId.get(String(k));if(q)out.add(q);});
  (I.byDeal.get(dealId(d))||[]).forEach(q=>out.add(q));return [...out].sort(byRecv);
 }
 /* ── 문의에서 이어받는 사실(3번 · 2026-11-06 대표 '컨설팅 설계 시작 규칙 유지'): 전환돼도 컨설팅 설계에서 시작하지만, 문의 때 이미 한 방문 · 견적은 다시 시키지 않는다.
    연결 기록이 있는 문의만 읽고, 영업건 자료에는 쓰지 않는다(읽기 전용). 값이 상태 글에서만 확인되면 날짜는 비워 둔다. 끄면(G.journeyPathOff) null */
 function handoff(d){
  if(!on()||!d)return null;const L=directOf(d);if(!L.length)return null;
  let visit=false,visitAt='',sent=false,sentAt='',quote=null;
  L.forEach(q=>{
   const S=safe(()=>root.InquiryFlow.server(q),null)||{},p=safe(()=>root.itemPatch(q,'inq'),null)||{},st=String(q.status||''),v=day(S.visit_done_at||p.visitDoneAt||''),s=day(S.quote_sent_at||p.quoteSentAt||'');
   if(v||/현장\s*방문\s*완료/.test(st)){visit=true;if(v&&(!visitAt||v<visitAt))visitAt=v;}
   const Q=safe(()=>root.InquiryFlow.quotes(q),[]).filter(x=>x&&Number(x.amount)>0&&x.sent_at);
   if(s||Q.length||/견적.*발송\s*완료/.test(st)){sent=true;const k=s||day((Q[Q.length-1]||{}).sent_at);if(k&&k>sentAt)sentAt=k;}
   if(Q.length){const x=Q[Q.length-1],k=day(x.sent_at);if(!quote||k>quote.day)quote={amount:Number(x.amount),version_no:Number(x.version_no)||Q.length,day:k};}
  });
  return visit||sent?{visit,visitAt,sent,sentAt,quote}:null;
 }
 /* ── 이 영업건의 문의: direct = 연결 기록이 있는 문의 / site = 연결 기록이 없을 때의 같은 현장 후보 ── */
 function inquiriesOf(d){
  const all=(root.B&&root.B.inquiries)||[],direct=directOf(d);
  if(direct.length)return {direct,site:[]};
  const sid=String(d.cleanup_site_id||d.site_id||d.siteId||'');
  const pool=safe(()=>root.operationalInquiries(all),all);
  const site=sid?pool.filter(q=>String(q.cleanup_site_id||q.site_id||q.siteId||'')===sid&&!toDeal(q).length&&!attachedTo(q)).sort(byRecv):[];
  return {direct:[],site};
 }
 /* ── 문의 → 영업건(전환 또는 '같은 공사'로 붙인 건) ── */
 function dealOf(q){return safe(()=>root.linkedDeal(q),null)||safe(()=>L3().attached(q),null);}
 function groupOf(d){return safe(()=>DF().groupOf(d),'');}
 function stageName(d){const g=groupOf(d),s=safe(()=>DF().ST.find(x=>x[0]===g),null);return g==='legacy'?'과거 이관':s?s[1]:'단계 미확인';}
 const outcomeName=d=>{const o=safe(()=>root.outcomeOf(d),'');return o==='badfit'?'Bad Fit':o==='nocontact'?'연락두절':'실주';};
 function salesSeg(d,link){
  const g=groupOf(d),x=link?{deal:d}:{};
  if(g==='won'){const r=safe(()=>root.DealWin.resultOf(d),null),ad=day((r&&r.w&&r.w.award_date)||d.closed_at||d.closed||'');return seg('영업','done','수주'+(ad?' '+dot(ad):' · 날짜 미기록'),x);}
  if(g==='lost'){const cl=day(d.closed_at||d.closed||'');return seg('영업','end',outcomeName(d)+(cl?' '+dot(cl):' · 날짜 미기록'),x);}
  if(g==='legacy')return seg('영업','todo','과거 이관 · 단계 미분류',x);
  if(g==='construction')return seg('영업','done','계약 단계로 넘어감',x);
  return seg('영업',g?'cur':'todo',stageName(d),x);
 }
 function contractSeg(d){
  const g=groupOf(d);if(g==='lost'||g==='legacy')return seg('계약','todo','해당 없음');
  const cs=safe(()=>root.DealSame.contract(d),{state:'none'}),code=String(safe(()=>root.dealStage(d),''));
  if(cs.state==='ok')return seg('계약','done','계약 '+dot(cs.date));
  if(cs.state==='check')return seg('계약','chk','계약 '+dot(cs.date)+' · 증빙 확인 필요');
  if(g==='construction'&&code==='contract')return seg('계약','cur','계약 진행 중');
  if(g==='construction'||g==='won')return seg('계약','todo','기록 없음');
  return seg('계약','todo',NONE);
 }
 function buildSeg(d){
  const g=groupOf(d);if(g==='lost'||g==='legacy')return seg('시공','todo','해당 없음');
  const code=String(safe(()=>root.dealStage(d),'')),sd=day(fieldOf(d,'construction','start_date')||fieldOf(d,'contract','start_date')),cp=day(d.completion_date||fieldOf(d,'won','completion_date')||fieldOf(d,'completion','completion_date')),today=TZ.format(new Date());
  if(cp)return seg('시공','done','준공 '+dot(cp));
  if(sd&&sd<=today)return seg('시공','cur','착공 '+dot(sd));
  if(sd)return seg('시공',code==='construction'?'cur':'todo','착공 예정 '+dot(sd));
  if(code==='construction'||code==='completion')return seg('시공','cur','착공일 미확인');
  if(g==='won')return seg('시공','todo','착공일 미확인');
  return seg('시공','todo',NONE);
 }
 /* ── 칸 네 개 ── */
 function ofDeal(d){
  const I=inquiriesOf(d),L=I.direct.length?I.direct:I.site;let first;
  if(I.direct.length){const r=recvOf(L[0]);first=seg('문의','done',(r?dot(r)+' 접수':'접수일 미기록')+(L.length>1?' · 문의 '+L.length+'건':''),{inqs:L});}
  else if(I.site.length)first=seg('문의','todo','연결 기록 없음 · 같은 현장 문의 '+I.site.length+'건',{inqs:L});
  else first=seg('문의','todo','문의 기록 없음');
  return [first,salesSeg(d,false),contractSeg(d),buildSeg(d)];
 }
 function ofInquiry(q){
  const r=recvOf(q),recv=r?dot(r)+' 접수':'접수일 미기록',d=dealOf(q),conv=safe(()=>!!root.inqCtlConverted(q),false),closed=safe(()=>!!root.isClosedInq(q),false);
  if(d)return [seg('문의','done',recv),salesSeg(d,true),contractSeg(d),buildSeg(d)];
  if(conv)return [seg('문의','done',recv),seg('영업','done','영업건으로 넘어감 · 이 계정에서 안 보임'),seg('계약','todo',NONE),seg('시공','todo',NONE)];
  if(closed){const c=safe(()=>root.InquiryFlow.closeOf(q),null);return [seg('문의','end',recv),seg('영업','end','영업건 없음 · '+((c&&c.label)||'종결')),seg('계약','todo','해당 없음'),seg('시공','todo','해당 없음')];}
  return [seg('문의','cur',recv),seg('영업','todo','전환 전'),seg('계약','todo',NONE),seg('시공','todo',NONE)];
 }
 function cell(s){
  const link=!!s.deal||!!(s.inqs&&s.inqs.length),body='<small>'+h(s.name)+'</small><b title="'+attr(s.v)+'">'+h(s.v)+'</b>',cur=s.st==='cur'?' aria-current="step"':'';
  if(!link)return '<div class="jp-s '+s.st+'"'+cur+'>'+body+'</div>';
  if(s.deal)return '<button type="button" class="jp-s jp-go '+s.st+'"'+cur+' data-jp="deal" data-v="'+attr(root.dealKey(s.deal))+'">'+body+'</button>';
  if(s.inqs.length===1)return '<button type="button" class="jp-s jp-go '+s.st+'"'+cur+' data-jp="inq" data-v="'+attr(root.inqKey(s.inqs[0]))+'">'+body+'</button>';
  return '<button type="button" class="jp-s jp-go '+s.st+'"'+cur+' data-jp="list" aria-expanded="false">'+body+'</button>';
 }
 const inqLine=q=>{const w=safe(()=>root.inqCtlWorkLabel(q)||W().gist(q)||'',''),r=recvOf(q);return [r?dot(r)+' 접수':'접수일 미기록',/미분류/.test(w)?'':w].filter(Boolean).join(' · ');};
 function render(S){
  const multi=S.find(s=>s.inqs&&s.inqs.length>1);
  return '<div class="jp"><nav class="jp-row" aria-label="문의부터 시공까지 경로">'+S.map(cell).join('')+'</nav>'
   +(multi?'<div class="jp-list" hidden>'+multi.inqs.map(q=>'<button type="button" data-jp="inq" data-v="'+attr(root.inqKey(q))+'">'+h(inqLine(q))+'</button>').join('')+'</div>':'')+'</div>';
 }
 /* 2026-11-10 대표 "왜 중복이야?" · "디자인 핏 망가짐": 네 칸 줄은 바로 아래 단계 띠와 같은 말(영업 · 지금 단계)을 한 번 더 적고 시안에 없는 줄이라 기본은 그리지 않는다.
    남기는 것: 영업건 → 원래 문의 이동은 머리 '현재 건' 줄 끝 글 링크 하나(dealLink) · 문의 → 영업건은 문의 상세의 [파이프라인에서 보기 →]가 이미 있다.
    다시 켜기: G.journeyRowOn=true(네 칸 줄) · 이어받기(handoff)는 그대로 G.journeyPathOff 만 본다. */
 const rowOn=()=>on()&&!!(root.G&&root.G.journeyRowOn);
 const dealHtml=d=>rowOn()&&d?render(ofDeal(d)):'';
 const inquiryHtml=q=>rowOn()&&q?render(ofInquiry(q)):'';
 function dealLink(d){
  if(!on()||rowOn()||!d)return '';const L=directOf(d);if(!L.length)return '';
  const r=recvOf(L[0]);return ' · <button type="button" class="jp-lk" data-jp="inq" data-v="'+attr(root.inqKey(L[0]))+'">원래 문의 '+h(r?dot(r).replace(/^\d{4}\./,'')+' 접수':'보기')+(L.length>1?' 외 '+(L.length-1)+'건':'')+' →</button>';
 }
 /* ── 이동: 문의를 닫으면 보던 영업건으로 돌아온다(InquiryWorkbench.openFromDeal) ── */
 document.addEventListener('click',e=>{
  const b=e.target.closest&&e.target.closest('[data-jp]');if(!b)return;const k=b.dataset.jp,v=b.dataset.v;
  if(k==='list'){const box=b.closest('.jp'),L=box&&box.querySelector('.jp-list');if(L){L.hidden=!L.hidden;b.setAttribute('aria-expanded',String(!L.hidden));}return;}
  if(k==='inq'){const d=root.CUR_DETAIL&&root.CUR_DETAIL.kind==='deal'?root.CUR_DETAIL.item:null;if(!W().openFromDeal(v,d)&&typeof root.toast==='function')root.toast('이 계정에서 볼 수 없는 문의입니다','warn');return;}
  if(k==='deal'){const d=((root.B&&root.B.deals)||[]).find(x=>root.dealKey(x)===v);if(d){W().close();L3().openDeal(d);}return;}
 });
 root.JourneyPath={on,rowOn,ofDeal,ofInquiry,inquiriesOf,handoff,dealOf,dealHtml,inquiryHtml,dealLink,stageName};
})(window);
