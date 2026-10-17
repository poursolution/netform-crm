/* 견적문의 흐름 v5 (2026-10-13 대표 핸드오프 design_handoff_inquiry_flow_v5 · 시안 '견적문의 흐름 v5.dc.html') — 흐름이 보이게
   무엇이 문제였나: 견적문의가 어디까지 왔는지(흐름) · 어디가 늦거나 빠졌는지(경고) · 지금 뭘 하는지(할 일)가 한 목록에 섞여 흐름이 안 보였다.
   여기서 하는 것(공사 견적문의 탭만 — 위쪽 제목 · 탭 · 브랜드 칩 · 검색, 협약문의 · B2B, 다른 메뉴는 그대로):
     · 화살표 띠 4칸: 01 접수 → 02 담당 배정 → 03 접촉 · 상담 → 04 현장방문 / 견적. 건수 + 단계명, 오른쪽으로 갈수록 진하게. 누르면 그 단계만(나머지 흐림).
     · 확인 필요 칩: 미배정(배정 기준 넘김) · 첫 연락 지연 · 정보 부족 · 대표회의 D-3 · 후속 지연. 누르면 해당 카드만 진한 테두리 · 나머지 흐림(단계 자리는 그대로, 칸 안에서는 해당 카드가 먼저).
     · 보드 4칸: 칸 제목 = 단계명 + 건수 + '→ 다음 조건'. 카드 = 브랜드 · 현장 · 근거 · 다음 할 일 · 기한(늦으면 빨강) · 경고 꼬리표. 기한 급한 순 · 칸마다 8건 + '외 n건' + 쪽 번호(list-pager). 줄 펼침 없음.
     · 카드 클릭 = 기존 견적문의 상세 창(3단 그대로). 진행 막대만 4칸 근거 막대(stepsHtml)로 바뀐다.
   단계는 사람이 고르지 않는다 — 기록에서 계산(stageOf):
     01 접수 = 담당 없음 / 02 담당 배정 = 담당 있음 · 실제 연결 없음(부재는 시도로만) / 03 접촉 · 상담 = 실제 연결 1회 이상 /
     04 현장방문 / 견적 = 방문 일정 · 방문 완료 · 견적 요청(발송 예정 · 견적 버전 · 견적요청 결과) 중 하나.
   파이프라인 전환 칸은 없다. 견적 발송 완료를 저장하면 기존 전환 경로(autoPromote → 서버 전환 명령)가 영업건을 만든다(문의 원본 · 이력 연결). 방문 완료만으로는 넘기지 않는다(inquiry-flow.js).
   만들어지는 단계는 서버 · 전송 계층의 기존 규칙(견적 발송 완료 → 자료 발송완료)을 따른다 — 화면 문구도 그 이름을 읽어서 쓴다(promoStage). 시안의 '컨설팅 설계'로 바꾸려면 전송 계층(operational-adapter promotionStage)과 서버 전환 명령을 같이 바꿔야 한다.
   숫자: 띠 4칸의 합 = 위 탭 = 브랜드 '전체' = 진행 중(InquiryV4.base — 종결 · 휴지통 · 영업건으로 넘긴 문의 제외). 늦음 판정은 목록 · 오늘 업무와 같은 것(InquiryListV3.model 의 late).
   끄기: G.inqV5Off=true → 견적문의 v4(상태 탭 + 목록 옆 상세). */
(function(root){
 'use strict';
 const h=v=>root.esc(String(v==null?'':v)),attr=v=>root.escAttr(String(v==null?'':v));
 const V4=()=>root.InquiryV4,L3=()=>root.InquiryListV3,W=()=>root.InquiryWorkbench,LP=()=>root.ListPager;
 const F=()=>root.InquiryFlow&&root.InquiryFlow.on()?root.InquiryFlow:null;
 const on=()=>!(root.G&&root.G.inqV5Off)&&!!V4()&&V4().on()&&!!LP()&&!!W();
 const RULES=()=>root.OPS_RULES||{},ASSIGN_MIN=()=>Number(RULES().inquiryAssignMinutes)||30,FIRST_H=()=>Number(RULES().towerFirstResponseHours)||2;
 /* 견적 발송 완료로 넘어갈 때 만들어지는 영업건의 단계 이름(기존 전환 규칙에서 읽는다) */
 const promoStage=()=>{try{return String(root.qualifyName('견적서 발송완료')||'')||'자료 발송완료';}catch(e){return '자료 발송완료';}};
 const STG=[['01','접수','담당 지정하면 → 02'],['02','담당 배정','실제 연결되면 → 03'],['03','접촉 · 상담','연결하고 9개 채우면 → 04'],['04','방문 · 견적','']];
 const outOf=i=>i===3?'견적 발송되면 자동으로 파이프라인 · '+promoStage()+'(으)로':STG[i][2];
 const FULL=['접수','담당 배정','접촉 · 상담','현장방문 / 견적'];
 const SHADE=['#e9edf7','#c9d5f1','#94acea','#5d84e0'],SIZE=8;
 const d3=x=>!!x&&x.dd>=0&&x.dd<=3;
 /* 경고 5가지: [열쇠, 칩 이름, 카드 꼬리표, 판정, 칩 설명] — 카드 꼬리표는 위에서부터 하나만 */
 const WARN=[['asg','미배정','배정 지연',m=>m.step===0&&m.late,()=>'접수 후 '+ASSIGN_MIN()+'분이 지나도록 담당이 없는 문의'],
  ['first','첫 연락 지연','첫 연락 지연',m=>m.step===1&&m.late,()=>'배정 후 '+FIRST_H()+'시간이 지나도록 실제 연결이 없는 문의(부재는 시도로만)'],
  ['d3','대표회의 D-3','대표회의 D-3',m=>d3(m.meet),()=>'대표회의가 3일 안'],
  ['follow','후속 지연','후속 지연',m=>!!m.follow&&m.late,()=>'마지막 실제 연결 뒤 기준 일수를 넘긴 문의'],
  ['info','정보 부족','정보 부족',m=>m._s===2&&!!m.follow&&m.miss.length>0,()=>'03 접촉 · 상담 단계인데 필수 확인 9개가 다 차지 않은 문의']];
 const CHIPS=['asg','first','info','d3','follow'];
 const DEF={st:null,wf:''};
 function st(){const g=root.G;if(!g.inqV5||!g.inqV5._v5)g.inqV5=Object.assign({},DEF,g.inqV5||{},{_v5:true});return g.inqV5;}
 const pad=n=>String(n).padStart(2,'0');
 const md=t=>{if(typeof t==='string'&&/^\d{4}-\d{2}-\d{2}/.test(t))return Number(t.slice(5,7))+'.'+Number(t.slice(8,10));const d=new Date(t);return Number.isFinite(d.getTime())?(d.getMonth()+1)+'.'+d.getDate():'';};
 const mdhm=t=>{const d=new Date(t);return Number.isFinite(d.getTime())?(d.getMonth()+1)+'.'+d.getDate()+' '+pad(d.getHours())+':'+pad(d.getMinutes()):'';};
 const todayStr=()=>{const d=new Date();return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());};
 const dayDiff=ymd=>Math.round((Date.parse(ymd+'T00:00:00')-Date.parse(todayStr()+'T00:00:00'))/864e5);
 const actOf=q=>{try{const a=root.actionObj(q,root.itemPatch(q,'inq')||{});return a&&a.text?a:null;}catch(e){return null;}};
 /* 04 단계의 근거: 방문 일정 · 방문 완료 · 견적 요청(발송 예정 · 견적 버전 · 견적요청 결과) · 견적 발송 */
 function facts(q){
  const f=F(),S=f?f.server(q):null,p=root.itemPatch(q,'inq')||{},s=String(q.status||''),a=actOf(q),at=a?String(a.text||''):'',due=a&&a.due?String(a.due).slice(0,10):'';
  const visitDone=String(S&&S.visit_done_at||p.visitDoneAt||'')||(/현장\s*방문\s*완료/.test(s)?'y':'');
  const visitPlan=/현장\s*방문\s*예정/.test(s)||(!visitDone&&/현장\s*방문/.test(at))?(/현장\s*방문/.test(at)&&due?due:'y'):'';
  const quoteSent=String(S&&S.quote_sent_at||p.quoteSentAt||'')||(/견적.*발송\s*완료/.test(s)?'y':'');
  let versions=0,asked=false;try{versions=f?f.quotes(q).length:0;}catch(e){}
  try{asked=!!f&&f.logs(q).some(l=>l.res==='견적요청'||l.contact_result==='견적요청'||l.customer_reaction==='견적요청');}catch(e){}
  const quotePlan=!quoteSent&&(/견적.*발송\s*예정/.test(s)||/견적서?\s*발송/.test(at))?(/견적서?\s*발송/.test(at)&&due?due:'y'):'';
  const quoteReq=!quoteSent&&!quotePlan&&(versions>0||asked||/견적\s*요청/.test(s))?'y':'';
  const any=!!(visitDone||visitPlan||quoteSent||quotePlan||quoteReq);
  const day=v=>v&&v!=='y'?md(v):'';
  const parts=[visitDone?(day(visitDone)?day(visitDone)+' 방문 완료':'방문 완료'):visitPlan?('방문 일정'+(day(visitPlan)?' '+day(visitPlan):'')):'',
   quoteSent?('견적 발송'+(day(quoteSent)?' '+day(quoteSent):'')):quotePlan?('견적 예정'+(day(quotePlan)?' '+day(quotePlan):'')):quoteReq?'견적 요청':'견적 전'].filter(Boolean);
  return {any,visitDone,visitPlan,quoteSent,quotePlan,quoteReq,text:parts.join(' · ')};
 }
 const stageOf=m=>m.step===0?0:facts(m.q).any?3:m.step===1?1:2;
 const warnsOf=m=>WARN.filter(w=>{try{return !!w[3](m);}catch(e){return false;}}).map(w=>w[0]);
 function dueOf(m,s){
  if(m.review&&m.review.required)return {t:'이관 기록 확인 필요',late:false};
  if(m.step===0)return {t:'접수 후 '+m.el+(m.late?' · 기준 '+ASSIGN_MIN()+'분':''),late:!!m.late};
  if(m.step===1&&s!==3)return {t:'배정 후 '+m.el+(m.late?' · 기준 '+FIRST_H()+'시간':''),late:!!m.late};
  if(m.follow&&m.late&&m.sinceLast!=null)return {t:m.sinceLast+'일째 연락 없음',late:true};
  if(m.dueDay){const dd=dayDiff(m.dueDay);return {t:dd<0?md(m.dueDay)+' · '+(-dd)+'일 지남':dd===0?'오늘':md(m.dueDay),late:dd<0};}
  return {t:'기한 없음',late:false};
 }
 function evOf(m,s){
  const q=m.q,f=F();
  if(s===0)return [mdhm(m.x.created),m.channel].filter(Boolean).join(' ');
  if(s===1){let a='';try{a=root.inqCtlAssignedAt(q)||'';}catch(e){}return [a?mdhm(a)+' 배정':'배정됨',m.tries?String(m.tries).split(' · ')[0]+' (부재)':''].filter(Boolean).join(' · ');}
  let n=9;try{n=L3().need9(q).filter(x=>x.ok).length;}catch(e){}
  if(s===2){let fc='';try{fc=f?f.state(q).firstConnectedAt:'';}catch(e){}fc=fc||m.x.first||'';return (fc?'실제 연결 '+md(fc):'실제 연결')+' · 정보 '+n+'/9';}
  return facts(q).text+(m.step===1?' · 실제 연결 전':'');
 }
 function nextOf(m,s){
  const a=actOf(m.q);if(a)return String(a.text);
  if(s===3){const k=facts(m.q);return k.quoteSent?'파이프라인 전환 확인':k.quotePlan?'견적서 발송':k.visitDone?'견적 진행 확인':k.visitPlan?'현장 방문':'견적 준비';}
  return m.act||'후속 연락';
 }
 let VIEW={all:[],cols:[[],[],[],[]],warn:{}};
 function compute(){
  const S=st(),all=V4().base().slice(),cols=[[],[],[],[]],warn={};CHIPS.forEach(k=>{warn[k]=0;});
  all.forEach(m=>{m._s=stageOf(m);m._w=warnsOf(m);m._w.forEach(k=>{warn[k]++;});cols[m._s].push(m);});
  const INF=1e18,hit=m=>S.wf&&m._w.includes(S.wf)?0:1;
  cols.forEach(c=>c.sort((a,b)=>hit(a)-hit(b)||(a.due==null?INF:a.due)-(b.due==null?INF:b.due)||(a.x.created||0)-(b.x.created||0)));
  if(S.st!=null&&!(S.st>=0&&S.st<4))S.st=null;if(S.wf&&!CHIPS.includes(S.wf))S.wf='';
  return (VIEW={all,cols,warn});
 }
 const tri=(i,n)=>i===0?'polygon(0 0,calc(100% - 14px) 0,100% 50%,calc(100% - 14px) 100%,0 100%)':i===n-1?'polygon(0 0,100% 0,100% 100%,0 100%,14px 50%)':'polygon(0 0,calc(100% - 14px) 0,100% 50%,calc(100% - 14px) 100%,0 100%,14px 50%)';
 function cardHtml(m,S){
  const s=m._s,due=dueOf(m,s),tag=(WARN.find(w=>m._w.includes(w[0]))||[])[2]||'',dim=S.wf&&!m._w.includes(S.wf);
  return '<button type="button" class="i5-card'+(dim?' dim':'')+(S.wf&&!dim?' hit':'')+'" data-i5="open" data-v="'+attr(m.key)+'" style="border-left-color:'+attr(m.bc)+'">'
   +'<span class="i5-br" style="color:'+attr(m.bc)+'">'+h(m.brand||'브랜드 미지정')+'</span><b class="i5-site">'+h(m.site)+'</b><span class="i5-ev">'+h(evOf(m,s))+'</span>'
   +'<span class="i5-nx"><i>다음</i> <b>'+h(nextOf(m,s))+'</b></span><span class="i5-due'+(due.late?' late':'')+'">'+h(due.t)+'</span>'+(tag?'<span class="i5-tag">'+h(tag)+'</span>':'')+'</button>';
 }
 function tools(host){
  /* 더보기(일괄 처리 · 예전 목록 · 종결 · 휴지통) = 확인 필요 줄 오른쪽. v4 가 가져다 둔 것을 이 화면으로 옮긴다(v4 는 가려져 있다) */
  const slot=host.querySelector('.i5-more-slot'),t=document.querySelector('#inq-v4 .inq-work-tools, #inq-v3 .inq-work-tools, #inq-v2 .inq-work-tools, #pg-inq .inq-inbox-heading .inq-work-tools')||host.__tools||null;
  if(slot&&t){host.__tools=t;if(t.parentNode!==slot)slot.append(t);}
 }
 function render(){
  const page=document.getElementById('pg-inq');if(!page)return;let host=document.getElementById('inq-v5');
  if(!on()){page.classList.remove('inq-v5');if(host)host.remove();return;}
  page.classList.add('inq-v5');
  if(!host){host=document.createElement('div');host.id='inq-v5';const v4=document.getElementById('inq-v4');if(v4)v4.after(host);else page.append(host);host.addEventListener('click',onClick);}
  const S=st(),V=compute(),keep=host.__tools;if(keep&&host.contains(keep))keep.remove();
  const band='<div class="i5-band" role="group" aria-label="견적문의 단계">'+STG.map((g,i)=>{const o=S.st===i;return '<button type="button" class="i5-step'+(o?' on':'')+'" data-i5="st" data-v="'+i+'" aria-pressed="'+o+'" style="background:'+(o?'#15171c':SHADE[i])+';color:'+(o||i>=2?'#fff':'#15171c')+';clip-path:'+tri(i,4)+'"><b class="i5-n">'+V.cols[i].length+'</b><span><small>'+g[0]+'</small><em>'+h(g[1])+'</em></span></button>';}).join('')+'</div>';
  const chips='<div class="i5-warn"><span class="i5-lb">확인 필요</span>'+CHIPS.map(k=>{const w=WARN.find(x=>x[0]===k),n=V.warn[k],o=S.wf===k;return '<button type="button" class="i5-chip'+(o?' on':'')+(n||o?'':' zero')+'" data-i5="wf" data-v="'+k+'" aria-pressed="'+o+'" title="'+attr(w[4]())+'">'+h(w[1])+' <b>'+n+'</b></button>';}).join('')
   +'<span class="i5-hint">누르면 아래 보드에서 해당 카드만 진하게</span><i></i><span class="i5-more-slot"></span>'+(S.st!=null||S.wf?'<button type="button" class="i5-clear" data-i5="clear">전체 보기</button>':'')+'</div>';
  const board='<div class="i5-board">'+STG.map((g,i)=>{const list=V.cols[i],pg=LP().cut(list,LP().page(S,'c'+i),SIZE),rest=pg.total-pg.rows.length;
   return '<section class="i5-col'+(S.st===i?' on':'')+(S.st!=null&&S.st!==i?' dim':'')+'" aria-label="'+attr(g[0]+' '+g[1])+'"><header><b>'+g[0]+' '+h(g[1])+'</b><span>'+pg.total+'건</span><small>'+h(outOf(i))+'</small></header>'
    +(pg.rows.length?pg.rows.map(m=>cardHtml(m,S)).join(''):'<div class="i5-empty">이 단계에 있는 문의가 없습니다</div>')
    +(rest>0?'<span class="i5-rest">외 '+rest+'건 · 기한 급한 순</span>':'')+LP().html(pg,{ns:'i5',v:i,small:true,info:false})+'</section>';}).join('')+'</div>';
  host.innerHTML=band+chips+board;host.__tools=keep;tools(host);
 }
 function onClick(e){
  const b=e.target.closest('[data-i5]');if(!b||b.disabled)return;const k=b.dataset.i5,v=b.dataset.v,S=st();
  if(k==='open'){const w=W();if(w)w.open(v);return;}
  if(k==='st'){const i=Number(v);S.st=S.st===i?null:i;S.wf='';}
  else if(k==='wf'){S.wf=S.wf===v?'':v;S.st=null;LP().reset(S);}
  else if(k==='clear'){S.st=null;S.wf='';}
  else if(k==='page'){LP().set(S,'c'+v,Number(b.dataset.page)||1);}
  else return;
  render();
 }
 /* 상세 창의 진행 막대(4칸 · 칸마다 근거 한 줄): 끝난 단계 검정 ✓ · 지금 파랑 · 남은 회색 */
 function stepsHtml(q){
  const f=F(),assigned=!!root.inquiryAssigned(q),handed=!!root.inqCtlConverted(q),k=facts(q);let fc='';
  try{fc=f?f.state(q).firstConnectedAt:'';}catch(e){}
  if(!fc){try{fc=(L3().contactAt&&L3().contactAt(q))||'';}catch(e){}}
  let closed=false;try{closed=!!(root.isClosedInq&&root.isClosedInq(q));}catch(e){}
  const cur=handed?4:!assigned?0:k.any?3:!fc?1:2;
  let n=0;try{n=L3().need9(q).filter(x=>x.ok).length;}catch(e){}
  const d=q.detail&&typeof q.detail==='object'?q.detail:{},r=q.raw&&typeof q.raw==='object'?q.raw:{},ch=String(d.channel||q.channel||r['상담채널']||d.inflow||r['유입경로']||'').trim();
  let created='';try{created=root.inquiryDate?root.inquiryDate(q):'';}catch(e){}
  let owner='';try{owner=assigned?root.repDisplay(root.inquiryRoutedOwner(q)):'';}catch(e){}
  const ev=[[created?(/T\d/.test(String(created))?mdhm(created):md(created)):'',ch].filter(Boolean).join(' · ')||'접수됨',assigned?'배정 · '+owner:'담당 지정 전',
   fc?md(fc)+' 연결 · 정보 '+n+' / 9':'실제 연결 전',handed?'견적 발송 → 파이프라인 · '+promoStage():k.any?k.text+(k.quoteSent?' → 파이프라인 전환 대기':''):'현장방문 · 견적 전'];
  return '<div class="idv3-steps i5-mini">'+FULL.map((l,i)=>{const done=i<cur,now=!closed&&i===cur;return '<div class="'+(done?'done':now?'cur':'')+'" style="clip-path:'+tri(i,4)+'"><b>'+(done?'✓ ':'')+STG[i][0]+' '+h(l)+'</b><span>'+h(ev[i])+'</span></div>';}).join('')+'</div>';
 }
 /* v4 가 그린 뒤에 그 자리를 대신한다(v4 는 가려 두고, 끄면 그대로 나온다) */
 const basePaint=root.paintInq;
 if(typeof basePaint==='function')root.paintInq=function(){const r=basePaint.apply(this,arguments);try{render();}catch(err){const p=document.getElementById('pg-inq');if(p)p.classList.remove('inq-v5');const hst=document.getElementById('inq-v5');if(hst)hst.remove();if(root.console)root.console.warn('inquiry v5: '+err.message);}return r;};
 /* 가려진 v4 목록의 ↑ ↓ 이동이 화면 스크롤을 막지 않게 한다 */
 if(root.addEventListener)root.addEventListener('keydown',e=>{if((e.key==='ArrowDown'||e.key==='ArrowUp')&&root.G&&root.G.page==='inq'&&on()){const p=document.getElementById('pg-inq');if(p&&p.classList.contains('inq-v5')&&!p.classList.contains('b2b-on'))e.stopImmediatePropagation();}},true);
 /* v5 에서는 목록 옆 상세가 없으므로 주소에 '고른 문의'를 남기지 않는다 */
 if(V4()&&typeof V4().selected==='function'){const sel=V4().selected;V4().selected=function(){return on()?'':sel.apply(this,arguments);};}
 root.InquiryV5={on,render,compute,stageOf,facts,stepsHtml,promoStage,state:st,STAGES:()=>STG.map(g=>g[0]+' '+g[1]),CHIPS:CHIPS.slice(),
  /* 토스 방식 목록(inquiry-toss.js)이 같은 판정을 쓰도록 내놓는다 — 새로 계산하지 않는다 */
  lib:{dueOf,evOf,nextOf,outOf,warn:k=>{const w=WARN.find(x=>x[0]===k);return w?{key:w[0],chip:w[1],tag:w[2],why:w[4]()}:null;},STG:()=>STG.map(g=>g.slice())}};
})(window);
