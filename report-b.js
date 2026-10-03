/* 대표 월간 리포트 — 한 페이지 (2026-10-03 디자인 핸드오프 'design_handoff_monthly_report') — 리포트 메뉴(#p=report)만.
   기본 기간 = 직전에 끝난 달(10월 초에 열면 9월 보고). 위에서 아래로: 결론 → 성과 흐름 → 놓친 것 → 6개월 추이 → 다음 달 전망 → 담당자별 → 대표님 결정 요청 → 용어.
   문장 속 숫자는 전부 자료에서 계산한다(손으로 쓴 숫자 없음). 정의는 주간 브리핑과 같다(BriefB.lib):
    · 계약실적 = 계약실적 원장(계약 체결일 기준 · 변경 · 취소는 발생일 반영) — 원장을 못 읽으면 숫자를 내지 않는다
    · 영업 메이드율 = 수주 ÷ (수주 + 파이프라인 실주) — 배드핏 · 진행 중 제외
    · 배드핏 = 견적문의 단계에서 영업건이 되지 않고 종결된 문의
    · 계약 임박 = 진행 건 중 경쟁 · 입찰 / 공사임박 / 계약(체결 예정) 단계, '이번 주에 갈리는 건' = 기한이 오늘부터 7일 안인 건
   대표님 결정 요청: 규칙으로 뽑은 안건(근거 숫자 포함)에 선택 2개 — 고르면 월간 스냅샷(report_snapshots · kind=monthly · 열쇠=YYYY-MM)에 저장한다.
   분기 · 연간, 지난달 결정 → 결과는 후속. [대표님께 보내기] = 서버 함수 crm-jandi 로 요약을 잔디에 발송하고 보낸 시각을 스냅샷에 남긴다.
   끄기: G.reportBOff=true → 이전 리포트(report-v2). */
(function(root){
 'use strict';
 const h=v=>root.esc(String(v==null?'':v)),attr=v=>root.escAttr(String(v==null?'':v));
 const enabled=()=>!root.G.reportBOff&&!!(root.BriefB&&root.BriefB.lib);
 const pad=n=>String(n).padStart(2,'0');
 const toast=(m,k)=>{if(typeof root.toast==='function')root.toast(m,k);};
 const NAVY='#111a2e';
 const eok=n=>{n=Number(n)||0;if(!n)return '0';const v=n/1e8;return (Math.abs(v)>=10?v.toFixed(1):v.toFixed(1)).replace(/\.0$/,'')+'억';};
 function period(){
  const now=new Date();let y,m;const f=String(root.G.reportBMonth||'');
  if(/^\d{4}-\d{2}$/.test(f)){y=Number(f.slice(0,4));m=Number(f.slice(5));}else{const d=new Date(now.getFullYear(),now.getMonth()-1,1);y=d.getFullYear();m=d.getMonth()+1;}
  const k=(yy,mm)=>{const d=new Date(yy,mm-1,1);return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-01';},nx=new Date(y,m,1);
  return {y,m,ym:y+'-'+pad(m),a:k(y,m),b:k(y,m+1),p:k(y,m-1),pm:new Date(y,m-2,1).getMonth()+1,nm:nx.getMonth()+1,last:new Date(y,m,0).getDate(),k,
   today:now.getFullYear()+'-'+pad(now.getMonth()+1)+'-'+pad(now.getDate())};
 }
 const dot=k=>Number(k.slice(0,4))+'.'+Number(k.slice(5,7))+'.'+Number(k.slice(8,10)),md=k=>Number(k.slice(5,7))+'/'+Number(k.slice(8,10));
 /* ── 월간 스냅샷(결정 저장) ── */
 const SN={state:'idle',map:{}},MEM={},UI={edit:false,edits:{},sent:'',detail:false};
 const canStore=()=>{const O=root.OpsStore;return !!(O&&O.has('crm_report_snapshot_get_v1')&&O.has('crm_report_snapshot_save_v1'));};
 function loadSnaps(){
  const O=root.OpsStore;if(!canStore()){SN.state='off';return;}if(SN.state!=='idle')return;SN.state='loading';
  O.rpc('crm_report_snapshot_get_v1',{kind:'monthly',limit:6}).then(r=>{(r.snapshots||[]).forEach(s=>{SN.map[s.period_key]=s;});SN.state='ready';if(root.G.page==='report')root.paintReport();}).catch(()=>{SN.state='failed';});
 }
 const decisionsOf=ym=>{const s=SN.map[ym];return Object.assign({},s&&s.payload&&s.payload.decisions||{},MEM[ym]||{});};
 /* ── 자료 ── */
 function data(){
  const R=root,B=R.BriefB.lib,K=B.K,P=period(),target=R.targetNameFilter(),AD=R.briefScopeDeals(target,false),AQ=R.briefScopeInquiries(target,false),OPEN=AD.filter(R.isOpen),L=B.ledger(target);
  const names=target?[target]:(R.PERFORMANCE_TARGET_NAMES||[]),inR=(k,a,b)=>!!k&&k>=a&&k<b,dealAmt=d=>Number(d.amount||d.amt||0);
  /* 타사 이관 수주(관리자 인정분 · 낙찰일 기준) — 수주실적에 합산, 화면에서는 자사와 나눠 적는다 */
  const DT=R.DealTransfer&&R.DealTransfer.enabled()?R.DealTransfer:null;
  const stat=(a,b)=>{const q=AQ.filter(x=>inR(K(R.inquiryCreatedAt(x)),a,b)),bad=q.filter(B.badfit),loss=AD.filter(d=>B.isLoss(d)&&inR(B.closedKey(d),a,b));
   return {q,bad,fit:q.length-bad.length,quotes:AD.filter(d=>B.quoteIn(d,a,b)),conv:AD.filter(d=>inR(K(d.created),a,b)),con:B.contractsIn(L,a,b),loss,lossAmt:loss.reduce((s,d)=>s+dealAmt(d),0),tf:DT?DT.wonIn(a,b,target):{count:0,amount:0,list:[]},tfLost:DT?DT.lostIn(a,b,target):0};};
  const cur=stat(P.a,P.b),prev=stat(P.p,P.a),made=s=>L.ready?B.made(s.con.count,s.loss.length+s.tfLost,s.tf.count):null;
  /* 확정 전환율(코호트): 보고 달의 2달 전 달 문의 */
  const cy=P.k(P.y,P.m-2).slice(0,7),cohort=AQ.filter(q=>K(R.inquiryCreatedAt(q)).slice(0,7)===cy),cwon=cohort.filter(q=>B.inquiryContract(q,L,AD)).length,linked=cohort.length;
  /* 6개월 */
  const trend=[];for(let i=5;i>=0;i--){const a=P.k(P.y,P.m-i),b=P.k(P.y,P.m-i+1),c=B.contractsIn(L,a,b),l=AD.filter(d=>B.isLoss(d)&&inR(B.closedKey(d),a,b)).length;trend.push({m:Number(a.slice(5,7)),net:c.net,count:c.count,made:L.ready?B.made(c.count,l):null,cur:i===0});}
  /* 다음 달 전망: 계약 임박 */
  const fld=(d,c,k)=>{const p=R.itemPatch(d,'deal')||{},x=(d.stage_contexts||p.stage_contexts||{})[c];return x&&x.fields?x.fields[k]:'';};
  const near=OPEN.filter(d=>{const c=R.dealStage(d);return ['compete','imminent','bidding'].includes(c)||(c==='contract'&&fld(d,'contract','contract_status')!=='체결 완료');}).map(d=>{
   const c=R.dealStage(d),raw=c==='bidding'?['입찰 마감',fld(d,'bidding','bid_deadline')]:c==='compete'?['PT · 협의',fld(d,'compete','meeting_date')]:c==='imminent'?['계약 예정',fld(d,'imminent','expected_contract')]:['계약 예정',fld(d,'contract','contract_date')],k=K(raw[1]);
   const amount=Number(fld(d,'contract','contract_amount')||0)||dealAmt(d),hot=!!k&&k>=P.today&&B.between(P.today,k)<=7,work=R.dealWorkSummary(d);
   return {d,amount,dueKey:k,due:k?raw[0]+' '+md(k):R.stageLabel(c)+' · 기한 미등록',hot,late:!!k&&k<P.today,sub:[work&&!/미분류|미기록/.test(work)?work:'',R.repN(d.assignee)||'미배정'].filter(Boolean).join(' · ')};
  }).sort((a,b)=>b.amount-a.amount);
  const nearAmt=near.reduce((s,n)=>s+n.amount,0),hot=near.filter(n=>n.hot),hotAmt=hot.reduce((s,n)=>s+n.amount,0),top=near.slice(0,4),topAmt=top.reduce((s,n)=>s+n.amount,0);
  /* 담당자별 */
  const people=names.map(n=>{const q=cur.q.filter(x=>R.inquirySalesOwner(x)===n).length,e=cur.quotes.filter(d=>R.repN(d.assignee)===n).length,c=B.contractsIn(L,P.a,P.b,n),l=cur.loss.filter(d=>R.repN(d.assignee)===n),t=DT?DT.wonIn(P.a,P.b,n):{count:0,amount:0};return {n,q,e,w:c.count+t.count,net:c.net,tf:t.amount,l:l.length,loss:l,made:L.ready?B.made(c.count,l.length,t.count):null};});
  /* 결정 요청(규칙 · 근거 숫자는 위 자료에서) */
  const chgOf=d=>{try{return R.DealKeyman?R.DealKeyman.changeOf(d):null;}catch(e){return null;}};
  const lossChg=cur.loss.filter(d=>/소장/.test(B.lossReason(d))||!!chgOf(d)),openChg=OPEN.filter(d=>{const c=chgOf(d);return !!c&&!c.after;}),lossPrice=cur.loss.filter(d=>/가격/.test(B.lossReason(d)));
  const sumAmt=l=>l.reduce((s,d)=>s+dealAmt(d),0),asks=[];
  if(lossChg.length||openChg.length)asks.push({k:'mgrchg',t:'관리소장 변경 현장 — 재견적 정책을 정해 주세요',why:P.m+'월 실주 '+cur.loss.length+'건 중 '+lossChg.length+'건('+eok(sumAmt(lossChg))+')이 관리소장 변경과 겹칩니다. 지금 진행 중 '+openChg.length+'건에서도 소장 변경 뒤 첫 응대가 없습니다.',opts:['변경 즉시 재방문 · 재견적','기존 조건 유지']});
  if(lossPrice.length)asks.push({k:'price',t:'가격 사유 실주 '+lossPrice.length+'건 — 가격 조정 기준을 손볼까요',why:P.m+'월 실주 '+cur.loss.length+'건 중 '+lossPrice.length+'건('+eok(sumAmt(lossPrice))+')의 사유가 가격입니다. 회의 지침의 신입 가격 재량은 기준가 ±10%, 넘으면 팀장 협의입니다.',opts:['재량 폭 확대 검토','현행 유지']});
  const low=people.filter(p=>p.made!=null&&p.made<50&&p.w+p.l>=2).sort((a,b)=>a.made-b.made)[0];
  if(low)asks.push({k:'low:'+low.n,t:low.n+' 메이드율 '+low.made.toFixed(1)+'% — 견적 지원을 붙일까요',why:'문의 '+low.q+' · 견적 '+low.e+' · 수주 '+low.w+' · 실주 '+low.l+'건'+(low.loss.length?' (사유: '+B.tallyText(B.tally(low.loss,B.lossReason))+')':'')+'입니다.',opts:['견적 지원 우선 배정','코칭만 유지']});
  const stale=OPEN.filter(d=>(R.activityAge(d)||0)>B.STALE());
  if(asks.length<3&&stale.length)asks.push({k:'stale',t:B.STALE()+'일 넘게 접촉 없는 진행 '+stale.length+'건 — 정리 기준을 정해 주세요',why:'진행 '+OPEN.length+'건 중 '+stale.length+'건('+eok(sumAmt(stale))+')이 '+B.STALE()+'일 넘게 연락 기록이 없습니다. 회의 지침은 대기 고객도 2개월에 1회 연락입니다.',opts:['대기 전환 · 정리','담당 재배정']});
  return {P,L,cur,prev,made:made(cur),madeP:made(prev),cy,cohort,linked,cwon,trend,near,nearAmt,hot,hotAmt,top,topAmt,people,asks:asks.slice(0,3),lossChg,OPEN};
 }
 /* 한 줄 결론: 숫자는 전부 계산값 */
 function headline(x){
  const P=x.P,L=x.L;if(!L.ready)return {t:P.m+'월 계약실적 원장을 읽는 중입니다',s:'원장을 읽은 뒤에 계약 · 메이드율 문장을 채웁니다.'};
  const nets=x.trend.map(t=>t.net),me=x.cur.con.net,rank=nets.filter(v=>v>me).length+1,pos=x.trend.some(t=>!t.cur&&t.count)?(rank===1?'6개월 중 최고':rank===nets.length?'6개월 중 최저':'6개월 중 '+rank+'번째'):'비교할 지난달 계약 기록 없음';
  const mt=x.made==null?'메이드율은 수주 · 실주가 없어 계산하지 않았습니다':'메이드율'+(x.madeP==null?'은 ':x.made>x.madeP?'도 ':'은 ')+x.made.toFixed(1)+'%'+(x.madeP==null?'입니다':x.made>x.madeP?'로 올랐습니다':x.made<x.madeP?'로 내렸습니다':'로 전월과 같습니다');
  const t=P.m+'월 계약 '+x.cur.con.count+'건 · '+eok(me)+' — '+pos+', '+mt;
  const B=root.BriefB.lib,top=B.tally(x.cur.loss,B.lossReason)[0];
  const s=P.nm+'월은 계약 임박 '+x.near.length+'건 · '+eok(x.nearAmt)+(x.near.length?' 중 '+x.hot.length+'건('+eok(x.hotAmt)+')이 이번 주에 갈립니다.':'입니다.')
   +(x.cur.loss.length?' 실주 '+x.cur.loss.length+'건 중 '+(x.lossChg.length?x.lossChg.length+'건이 관리소장 변경과 겹쳐 대응 정책 결정이 필요합니다.':top[1]+'건이 ‘'+top[0]+'’ 사유입니다.'):' 이번 달 파이프라인 실주는 없습니다.');
  return {t,s};
 }
 function summaryText(x){
  const P=x.P,H=headline(x),B=root.BriefB.lib,dec=decisionsOf(P.ym),line='━━━━━━━━━━━━━━';
  return ['['+P.y+'년 '+P.m+'월 영업 보고]',H.t,H.s,line,'견적문의 '+x.cur.q.length+' → 적합 '+x.cur.fit+' → 견적 발송 '+x.cur.quotes.length+' → 파이프라인 전환 '+x.cur.conv.length+(x.L.ready?' → 계약 '+x.cur.con.count+'건 · '+eok(x.cur.con.net):''),
   '영업 메이드율 '+B.pctText(x.made)+' · 문의 적합률 '+B.pctText(B.pct(x.cur.fit,x.cur.q.length)),'배드핏 '+x.cur.bad.length+'건(메이드율 제외) · 파이프라인 실주 '+x.cur.loss.length+'건 · '+eok(x.cur.lossAmt),line,
   '대표님 결정 요청 '+x.asks.length+'건'].concat(x.asks.map((q,i)=>(i+1)+'. '+q.t+(dec[q.k]!=null?' → '+q.opts[dec[q.k]]:''))).join('\n');
 }
 /* ── 그리기 ── */
 let CUR=null;
 function html(x){
  const R=root,B=R.BriefB.lib,P=x.P,L=x.L,con=L.ready,c=x.cur,p=x.prev,H=headline(x),dec=decisionsOf(P.ym),admin=!!(R.OpsStore&&R.OpsStore.admin()),jd=(SN.map[P.ym]&&SN.map[P.ym].payload&&SN.map[P.ym].payload.jandi)||{},sentAt=jd.resent_at||jd.auto_sent_at||'';
  const ed=k=>UI.edit?' contenteditable="true" data-rbk="'+k+'"':'',tx=(k,v)=>h(UI.edits[P.ym+k]!=null?UI.edits[P.ym+k]:v);
  const dl=(a,b)=>a===b?'전월과 같음 ('+b+')':(a>b?'▲'+(a-b):'▼'+(b-a))+' ('+b+')',dc=(a,b)=>a>b?'up':a<b?'down':'';
  const fn=[['신규 견적문의',c.q.length+'건',dl(c.q.length,p.q.length),dc(c.q.length,p.q.length)],['적합 문의',c.fit+'건','배드핏 '+c.bad.length+' 제외',''],['견적 발송',c.quotes.length+'건',dl(c.quotes.length,p.quotes.length),dc(c.quotes.length,p.quotes.length)],['파이프라인 전환',c.conv.length+'건',dl(c.conv.length,p.conv.length),dc(c.conv.length,p.conv.length)],
   ['수주실적',con?(c.con.count+c.tf.count)+'건 · '+eok(c.con.net+c.tf.amount):'원장 확인 중',con?(c.tf.count?'자사 '+c.con.count+'건 '+eok(c.con.net)+' · 타사 이관 '+c.tf.count+'건 '+eok(c.tf.amount):((c.con.count>=p.con.count?'▲':'▼')+Math.abs(c.con.count-p.con.count)+'건 · '+(c.con.net>=p.con.net?'+':'-')+eok(Math.abs(c.con.net-p.con.net)))):'계약실적 원장을 읽는 중','up']];
  const fitR=B.pct(c.fit,c.q.length),fitP=B.pct(p.fit,p.q.length),conv=con?B.pct(c.con.count,c.q.length):null,convP=con?B.pct(p.con.count,p.q.length):null,coh=x.linked?B.pct(x.cwon,x.cohort.length):null,cm=Number(x.cy.slice(5));
  const pp=(a,b)=>a==null||b==null?'':(a>=b?'▲':'▼')+Math.abs(Math.round((a-b)*10)/10).toFixed(1)+'%p';
  const rates=[['영업 메이드율',B.pctText(x.made),pp(x.made,x.madeP),con?(c.tf.count||c.tfLost?'(자사 '+c.con.count+' + 타사 이관 '+c.tf.count+') ÷ (자사 '+c.con.count+' + 타사 이관 '+c.tf.count+' + 실주 '+(c.loss.length+c.tfLost)+') · 배드핏 제외':'수주 '+c.con.count+' ÷ (수주 '+c.con.count+' + 실주 '+c.loss.length+') · 배드핏 제외'):'계약실적 원장을 읽은 뒤 계산합니다',1],
   ['문의 적합률',B.pctText(fitR),pp(fitR,fitP),'적합 '+c.fit+' ÷ 문의 '+c.q.length+' · 문의 품질',0],
   ['문의 → 계약 전환율',B.pctText(conv),pp(conv,convP),con?'계약 '+c.con.count+' ÷ 문의 '+c.q.length+' · 이번 달 활동 비율':'계약실적 원장을 읽은 뒤 계산합니다',0],
   ['확정 전환율 ('+cm+'월 문의)',B.pctText(coh),'',x.cohort.length?cm+'월 문의 '+x.cohort.length+'건 중 지금까지 계약 '+x.cwon+'건':cm+'월에 접수된 문의가 없습니다',0]];
  const bars=(t,cls)=>{const mx=Math.max(1,...t.map(r=>r[1]));return t.length?t.slice(0,6).map(r=>'<div class="rb-bar '+cls+'"><span'+(/소장/.test(r[0])?' class="b"':'')+'>'+h(r[0])+'</span><span class="tr"><i style="width:'+Math.round(r[1]/mx*100)+'%"></i></span><b>'+r[1]+'</b></div>').join(''):'<span class="rb-none">해당 없음</span>';};
  const tmx=Math.max(1,...x.trend.map(t=>t.net));
  const rowsP=x.people.map(q=>'<span class="l b">'+h(q.n)+'</span><span>'+q.q+'</span><span>'+q.e+'</span><span class="b">'+(con?q.w:'—')+'</span><span class="b">'+(con?(q.net?eok(q.net):'-'):'—')+'</span><span>'+(q.tf?eok(q.tf):'-')+'</span><span>'+q.l+'</span><span class="b'+(q.made!=null&&q.made<50?' r':'')+'">'+(q.made==null?'-':q.made.toFixed(1)+'%')+'</span>').join('');
  const sum=k=>x.people.reduce((s,q)=>s+q[k],0),noOwner=c.q.length-sum('q');
  /* 합계 줄은 위 흐름 숫자와 같아야 한다 — 담당이 없는 문의는 '미배정' 줄로 드러낸다 */
  const unassigned=noOwner>0?'<span class="l">미배정</span><span>'+noOwner+'</span><span>0</span><span>-</span><span>-</span><span>-</span><span>0</span><span>-</span>':'';
  const total=unassigned+'<span class="l t">합계</span><span class="t">'+c.q.length+'</span><span class="t">'+sum('e')+'</span><span class="t">'+(con?sum('w'):'—')+'</span><span class="t">'+(con?eok(sum('net')):'—')+'</span><span class="t">'+(sum('tf')?eok(sum('tf')):'-')+'</span><span class="t">'+sum('l')+'</span><span class="t">'+B.pctText(con?B.pct(sum('w'),sum('w')+sum('l')):null)+'</span>';
  const rest=x.near.length-x.top.length;
  return '<div class="rb-bar0"><b>리포트</b><div class="rb-seg"><span class="on">월간</span><span title="분기 보기는 후속 작업입니다">분기</span><span title="연간 보기는 후속 작업입니다">연간</span></div><span class="g">자동 취합 · '+dot(P.today)+'</span><i></i>'
    +'<button type="button" data-rb="edit" aria-pressed="'+UI.edit+'">'+(UI.edit?'편집 끝':'편집')+'</button><button type="button" data-rb="pdf">PDF로 저장</button><button type="button" class="pri" data-rb="send"'+(admin&&!UI.busy?'':' disabled'+(admin?'':' title="관리자만 보낼 수 있습니다"'))+'>'+(UI.busy?'보내는 중…':'대표님께 보내기')+'</button></div>'+(UI.err?'<p class="rb-err">'+h(UI.err)+'</p>':'')
   +'<article class="rb-page" data-screen-label="월간 리포트">'
   +'<div class="rb-head"><div><span>넷폼 영업 보고 · 월간</span><h1>'+P.y+'년 '+P.m+'월 영업 보고</h1></div><p>'+dot(P.a)+' – '+P.m+'.'+P.last+' · '+dot(P.today)+' 자동 취합<br>보고 '+h((R.ME&&R.ME.name)||'')+' · 수신 대표님'+(sentAt?' · '+h(B.stamp(sentAt))+' 잔디 발송':'')+'</p></div>'
   +'<div class="rb-band"><div><b'+ed('t')+'>'+tx('t',H.t)+'</b><span'+ed('s')+'>'+tx('s',H.s)+'</span></div><div class="ask"><span>결정 요청</span><b>'+x.asks.length+'건</b></div></div>'
   +'<section class="rb-sec"><div class="rb-h"><b>1. 견적문의가 계약까지</b><span>괄호는 '+P.pm+'월</span></div><div class="rb-funnel">'+fn.map((u,i)=>'<div class="'+(i===fn.length-1?'last':'')+'"><span>'+h(u[0])+'</span><b>'+h(u[1])+'</b><em class="'+u[3]+'">'+h(u[2])+'</em></div>').join('')+'</div>'
    +'<div class="rb-rates">'+rates.map(t=>'<div class="'+(t[4]?'k':'')+'"><span>'+h(t[0])+'</span><p><b>'+h(t[1])+'</b><em class="'+(/^▼/.test(t[2])?'down':'up')+'">'+h(t[2])+'</em></p><small>'+h(t[3])+'</small></div>').join('')+'</div></section>'
   +'<div class="rb-g3"><section class="rb-sec"><div class="rb-h"><b>2. 놓친 것 — 두 종류로 나눔</b></div>'
     +'<div class="rb-box bad"><p><b>견적문의 배드핏 '+c.bad.length+'건</b><span>우리와 맞지 않는 문의 · 영업 실패 아님 · 메이드율 제외</span></p>'+bars(B.tally(c.bad,B.badfitReason),'g')+'</div>'
     +'<div class="rb-box loss"><p><b>파이프라인 실주 '+c.loss.length+'건 · '+eok(c.lossAmt)+'</b><span>영업기회 상실 · 메이드율에 포함</span></p>'+bars(B.tally(c.loss,B.lossReason),'r')+'</div></section>'
    +'<section class="rb-sec"><div class="rb-h"><b>3. 6개월 계약실적</b><span>계약 체결일 기준</span></div>'+(con?'<div class="rb-trend">'+x.trend.map(t=>'<div><span class="'+(t.cur?'c':'')+'">'+eok(t.net)+'</span><i style="height:'+Math.max(2,Math.round(t.net/tmx*112))+'px;background:'+(t.cur?NAVY:'#c9cdd5')+'"></i></div>').join('')+'</div><div class="rb-tl">'+x.trend.map(t=>'<div><span>'+t.m+'월</span><small>'+(t.made==null?'-':t.made.toFixed(t.made%1?1:0)+'%')+'</small></div>').join('')+'</div><span class="rb-note">아래 작은 숫자 = 그 달 영업 메이드율</span>':'<span class="rb-none">계약실적 원장을 읽는 중입니다 — 읽지 못하면 숫자를 내지 않습니다.</span>')+'</section>'
    +'<section class="rb-sec"><div class="rb-h"><b>4. '+P.nm+'월 전망</b><span>계약 임박 '+x.near.length+'건 · '+eok(x.nearAmt)+'</span></div>'+(x.top.length?x.top.map(n=>'<div class="rb-near"><i style="background:'+(B.BRAND[n.d.brand]||'#9aa0ab')+'"></i><div><b>'+h(n.d.site||'현장명 미입력')+'</b><span>'+h(n.sub)+'</span></div><div class="r"><b>'+eok(n.amount)+'</b><span class="'+(n.hot||n.late?'hot':'')+'">'+h(n.due+(n.late?' (지남)':''))+'</span></div></div>').join('')
      +'<span class="rb-note">위 '+x.top.length+'건 '+eok(x.topAmt)+(rest>0?' + 나머지 '+rest+'건 '+eok(x.nearAmt-x.topAmt):'')+' = '+eok(x.nearAmt)+' · 이번 주(7일 안) 기한 '+x.hot.length+'건 '+eok(x.hotAmt)+'</span>':'<span class="rb-none">경쟁 · 입찰 · 계약 단계에 있는 진행 건이 없습니다.</span>')+'</section></div>'
   +'<div class="rb-g2"><section class="rb-sec"><div class="rb-h"><b>5. 담당자별 — 얼마나 했고, 얼마나 땄고, 얼마나 놓쳤나</b></div><div class="rb-table"><span class="l th">담당</span><span class="th">문의</span><span class="th">견적</span><span class="th">수주</span><span class="th">계약실적</span><span class="th">타사 이관</span><span class="th">실주</span><span class="th">메이드율</span>'+rowsP+total+'</div><span class="rb-note">수주 = 자사 수주 + 인정된 타사 이관 수주 · 메이드율 = 수주 ÷ (수주 + 파이프라인 실주) · 배드핏 · 진행 중 · 낙찰결과 대기 제외</span></section>'
    +'<section class="rb-sec"><div class="rb-h"><b>6. 대표님 결정 요청</b></div>'+(x.asks.length?x.asks.map((q,i)=>'<div class="rb-ask"><div><b class="n">'+(i+1)+'</b><b>'+h(q.t)+'</b></div><span>'+h(q.why)+'</span><div class="o">'+q.opts.map((o,k)=>'<button type="button" data-rb="pick" data-k="'+attr(q.k)+'" data-v="'+k+'" aria-pressed="'+(dec[q.k]===k)+'"'+(admin?'':' disabled')+'>'+h(o)+'</button>').join('')+'</div></div>').join(''):'<span class="rb-none">이번 달 자료에서 결정이 필요한 항목이 잡히지 않았습니다.</span>')+'</section></div>'
   +'<div class="rb-foot"><span>계약실적 = 계약 체결일 기준 계약금액 (회계 매출 아님)</span><span>배드핏 = 견적문의 단계 부적합 종결 · 파이프라인 실주 = 영업기회 상실</span><span>확정 전환율 = 해당 월 접수 문의 중 현재까지 계약 비율</span></div>'
   +'</article><div class="rb-under"><button type="button" class="lnk" data-rb="detail">'+(UI.detail?'상세 표 닫기':'상세 표 보기')+'</button>'+(canStore()?'':'<span>저장소 연결 전 — 결정 선택은 이 화면에서만 유지됩니다</span>')+'</div>';
 }
 function host(){
  const pg=document.getElementById('pg-report'),master=document.getElementById('report-master');if(!pg||!master)return null;
  let el=document.getElementById('report-b');
  if(!el){el=document.createElement('div');el.id='report-b';el.className='rb';master.before(el);el.addEventListener('click',onClick);el.addEventListener('input',e=>{const t=e.target.closest('[data-rbk]');if(t&&CUR)UI.edits[CUR.P.ym+t.dataset.rbk]=t.textContent;});}
  return el;
 }
 function render(){const el=host();if(!el)return;el.hidden=false;loadSnaps();CUR=data();el.innerHTML=html(CUR);const m=document.getElementById('report-master'),v2=document.getElementById('report-v2');if(m)m.hidden=!UI.detail;if(v2)v2.hidden=true;}
 function save(x,dec,done){
  const O=root.OpsStore,ym=x.P.ym;
  if(!canStore()){MEM[ym]=dec;toast('저장소 연결 전 — 이 화면에서만 유지됩니다','warn');done&&done(true);render();return;}
  const prev=SN.map[ym],H=headline(x);MEM[ym]=dec;render();
  O.rpc('crm_report_snapshot_save_v1',{kind:'monthly',period_key:ym,payload:Object.assign({},prev&&prev.payload||{},{basis:'monthly-b',headline:H.t,sub:H.s,decisions:dec,asks:x.asks.map(q=>({k:q.k,t:q.t,why:q.why,opts:q.opts})),summary:summaryText(x)}),promises:prev&&Array.isArray(prev.promises)?prev.promises:[]})
   .then(()=>{SN.map[ym]=Object.assign({},prev||{kind:'monthly',period_key:ym},{payload:Object.assign({},prev&&prev.payload||{},{decisions:dec})});delete MEM[ym];done&&done(true);})
   .catch(e=>{delete MEM[ym];toast(String(e.message||e),'warn');done&&done(false);render();});
 }
 function pdf(){
  document.getElementById('rbPrint')?.remove();const s=document.createElement('style');s.id='rbPrint';s.textContent='@page{size:A4 landscape;margin:6mm}';document.head.append(s);
  document.body.classList.add('rb-printing');const done=()=>{document.body.classList.remove('rb-printing');window.removeEventListener('afterprint',done);};window.addEventListener('afterprint',done);
  window.print();setTimeout(done,1500);
 }
 function onClick(e){
  const b=e.target.closest('[data-rb]');if(!b||b.disabled||!CUR)return;const a=b.dataset.rb,x=CUR;
  if(a==='edit'){UI.edit=!UI.edit;return render();}
  if(a==='detail'){UI.detail=!UI.detail;render();if(UI.detail)document.getElementById('report-master')?.scrollIntoView({behavior:'smooth',block:'start'});return;}
  if(a==='pdf')return pdf();
  if(a==='pick'){const dec=decisionsOf(x.P.ym),k=b.dataset.k,v=Number(b.dataset.v);if(dec[k]===v)delete dec[k];else dec[k]=v;UI.sent='';save(x,dec,ok=>{if(ok&&canStore())toast('결정을 저장했습니다');});return;}
  if(a==='send'){
   if(UI.busy)return;const B=root.BriefB.lib,text=summaryText(x),ym=x.P.ym,H=headline(x),dec=decisionsOf(ym),prev=SN.map[ym];UI.busy=true;UI.err='';render();
   B.jandiSend('monthly',ym,text,false,{payload:Object.assign({},prev&&prev.payload||{},{basis:'monthly-b',headline:H.t,sub:H.s,decisions:dec,asks:x.asks.map(q=>({k:q.k,t:q.t,why:q.why,opts:q.opts})),summary:text})})
    .then(j=>{if(j.snapshot)SN.map[ym]=Object.assign({},SN.map[ym]||{},j.snapshot);delete MEM[ym];toast('대표님께 잔디로 보냈습니다');})
    .catch(e=>{UI.err=String(e.message||e)+' — 요약 글은 복사해 두었습니다';try{navigator.clipboard&&navigator.clipboard.writeText(text).catch(()=>{});}catch(err){}toast(String(e.message||e),'warn');})
    .finally(()=>{UI.busy=false;if(root.G.page==='report')render();});
   return;}
 }
 function boot(){
  const base=root.paintReport;if(typeof base!=='function')return;
  root.paintReport=function(){
   /* 이 화면이 켜져 있는 동안은 이전 슬라이드 리포트(report-v2)를 끈다(← → 키로 다시 나타나지 않게). 끄면 원래 값으로 되돌린다 */
   const G=root.G;
   if(enabled()){if(G.reportV2Off!==true){G.__rbV2=G.reportV2Off;G.reportV2Off=true;}}
   else if('__rbV2' in G){G.reportV2Off=G.__rbV2;delete G.__rbV2;}
   const r=base.apply(this,arguments),el=document.getElementById('report-b');
   if(!enabled()){if(el)el.hidden=true;return r;}
   try{render();}catch(e){console.warn('[리포트 B]',e);if(el)el.hidden=true;const m=document.getElementById('report-master');if(m)m.hidden=false;}
   return r;
  };
  root.addEventListener('contract-sales:changed',()=>{try{if(root.G.page==='report'&&enabled())root.paintReport();}catch(e){}});
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
 root.ReportB={enabled,period,data,headline,summaryText};
})(window);
