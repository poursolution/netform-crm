/* 파이프라인 · 관계관리 단계 화면 (2026-10-05 디자인 핸드오프 'design_handoff_relationship' — 관계관리 세분화.dc.html · README '확정 배치')
   제목 줄 → 3칸 카드(집중 · 일반 · 대기: 건수 · 기준 · 기준 지킴 막대 · 기준 넘긴 건, 누르면 아래가 그 칸으로)
   → 아래 2단: 왼쪽 340px(단계 진단 숫자 2칸 · 왜 멈춰 있나 5줄 · 그래서 뭘 해야 하나 3상자 + 자동 이동 규칙) / 오른쪽(확인할 현장 + 칩 + 리스트 · 보드)
   분류 · 사유 · 줄 문구는 relationship-segment.js 가 계산한다(PipelineStageB.model — 관리팀 KPI '단계별 기준'과 같은 함수). 숫자는 전부 지금 자료에서 센다(시안의 예시 숫자는 쓰지 않는다).
   견적 발송일이 없는 건은 분류하지 않고 카드 아래 '데이터 확인 필요' 한 줄로 따로 모은다(README 지시 · 시안에는 없는 요소).
   [발송일 입력] · [집중관리로] = 지금 단계 정보에 날짜 한 칸 저장(기존 서버 함수 crm_deal_stage_fields_update_v1 · 서버 확인 뒤에만 반영). 그 밖의 버튼은 기존 상세(연락 결과 · 다음 할 일 · 단계 바꾸기).
   끄기: G.relSegOff=true → 예전 관계관리 화면(단계 이름 기준) */
(function(root){
 'use strict';
 const h=v=>root.esc(String(v==null?'':v)),attr=v=>root.escAttr(String(v==null?'':v));
 const RED='#b42318',BAR='#d14a3f',GREY='#9aa0ab';
 const BRAND={'석민이앤씨':'#e8590c','POUR솔루션':'#1f9d55','POUR공법':'#7048e8','아파트스퀘어':'#3b6ce4'};
 const SF_RPC='crm_deal_stage_fields_update_v1';
 const enabled=()=>!root.G.relSegOff&&!!root.RelationshipSegment&&!!root.PipelineStageB;
 const st=()=>root.G.prb||(root.G.prb={sub:null,chip:'all',why:null,rule:false,view:'list',page:1,pop:null});
 const mo=n=>Math.round(n/30);
 const money=v=>{const n=Number(v)||0;if(!n)return '미정';if(n>=1e8)return (Math.round(n/1e7)/10)+'억';if(n>=1e7)return (Math.round(n/1e6)/100)+'억';if(n>=1e4)return Math.round(n/1e4).toLocaleString('ko-KR')+'만';return n.toLocaleString('ko-KR');};
 const sumMoney=v=>{const n=Number(v)||0;if(!n)return '금액 미정';return n>=1e8?(Math.round(n/1e7)/10)+'억':Math.round(n/1e4).toLocaleString('ko-KR')+'만';};
 /* 칸 3개(시안 SUB) + 분류 못 한 건 */
 const SUB=[
  {k:'focus',l:'집중관리',top:'#15171c',range:q=>'견적 후 0–'+q.focusEnd+'일',rule:q=>q.focus+'일 단위 후속 · 대표회의 · 경쟁사 · 가격 확인',over:(q,n)=>q.focus+'일 넘게 연락 없음 '+n+'건',col:'연락 없음',sort:'연락 없는 기간 긴 순',foot:q=>q.focusEnd+'일이 지나면 일반관리로 자동 이동 · 대표회의가 잡히면 경쟁 · 입찰로',chips:q=>[['전체','all'],[q.focus+'일+ 연락 없음','stale'],['대표회의 잡힘','meet']],hint:q=>q.focus+'일 안 연락 · 대표회의 · 경쟁사 확인'},
  {k:'normal',l:'일반관리',top:'#8a909c',range:q=>'견적 후 1–'+mo(q.normalEnd)+'개월',rule:()=>'월 1회 이상 접촉 · 카드뉴스 · 시공 사례 전달',over:(q,n)=>q.month+'일 넘게 접촉 없음 '+n+'건',col:'마지막 접촉',sort:'마지막 접촉 오래된 순',foot:q=>mo(q.normalEnd)+'개월이 지나도 시기 미정이면 대기관리로 자동 이동 + 담당 확인 요청',chips:q=>[['전체','all'],[q.month+'일+ 접촉 없음','stale'],[mo(q.normalEnd)+'개월 도달','m4']],hint:()=>'월 1회 접촉 · 자료 전달'},
  {k:'wait',l:'대기관리',top:'#d5d9e0',range:()=>'공사 시기 내년 이후',rule:q=>mo(q.wait)+'개월마다 안부 · 공사 시기 확인 + 다음 연락일 등록',over:(q,n)=>mo(q.wait)+'개월 연락일 지남 '+n+'건',col:'공사 예정',sort:'공사 예정 가까운 순',foot:()=>'공사 시기가 3개월 안 = 집중관리로 복귀 · 관리소장이 바뀌면 변화 이벤트 생성',chips:()=>[['전체','all'],['연락일 지남','late'],['관리소장 변경','mgr']],hint:q=>mo(q.wait)+'개월마다 안부 · 시기 확인'}];
 const NODATA={k:'nodata',l:'데이터 확인 필요',col:'마지막 접촉',sort:'견적 발송일이 없어 분류하지 못한 건',foot:q=>'견적 발송일을 넣으면 그날부터 집중관리('+q.focusEnd+'일) → 일반관리('+mo(q.normalEnd)+'개월) → 대기관리로 자동 분류됩니다',chips:()=>[['전체','all']]};
 const subOf=k=>SUB.find(s=>s.k===k)||NODATA;
 /* 왜 멈춰 있나 5줄(시안 WHY) — 앞 3줄은 누르면 그 칸으로 */
 const WHY=[['focus7',BAR,'focus'],['month30',BAR,'normal'],['long60',GREY,'wait'],['shift',GREY,null],['nonext',GREY,null]];
 /* 그래서 뭘 해야 하나(시안 TD): 칸마다 사유 3개 — [사유 키, 제목, 할 일, 어떻게] */
 const TD={
  focus:[['focus7','집중관리 7일 넘게 연락 없음','집중관리 고객은 7일 단위 후속 · 대표회의 · 경쟁사 · 가격 변화 확인','D+3 수신 → D+7 반응 → D+14 진행 → D+30 판단 순서'],['shift','30일 판단 임박','견적 후 30일째 수주 가능성 판단','경쟁 · 입찰로 넘기거나 일반관리로'],['nonext','다음 행동 · 날짜 없음','통화 후 다음 행동과 날짜를 꼭 남기기','결과를 고르면 다음 날짜가 자동 제안']],
  normal:[['month30','30일 넘게 접촉 없음','모든 고객 월 1회 이상 접촉 · 자료(카드뉴스 · 사례) 전달','자료 전달도 접촉으로 인정'],['shift','4개월 도달','공사 시기 다시 확인','시기 미정이면 대기관리로 자동 이동'],['nonext','다음 행동 · 날짜 없음','다음 접촉일 등록','월 1회 기준으로 자동 제안']],
  wait:[['long60','대기 2개월 연락일 지남','공사 시기 확인 + 다음 2개월 연락일 등록','짧은 안부 · 예산 · 관리소장 변경 확인'],['shift','공사 시기 3개월 안','집중관리로 복귀 · 견적 다시 확인','오늘 업무 맨 위로 올라감'],['nonext','다음 행동 · 날짜 없음','다음 2개월 연락일 등록','연락하면 자동 등록']],
  nodata:[['nosent','견적 발송일 없음','견적 발송일을 넣으면 자동으로 분류됩니다','줄의 [발송일 입력]에 날짜만 넣으면 됩니다']]};
 const canSF=()=>!!(root.SB&&typeof root.SB.rpc==='function')&&!(root.CRMRelease&&typeof root.CRMRelease.has==='function'&&root.CRMRelease.has(SF_RPC)===false);
 const toast=(m,k)=>{if(typeof root.toast==='function')root.toast(m,k);};
 /* 연락 3회 넘게 닿지 않은 건(실주 · 보류는 담당자가 정한다 — 자동으로 옮기지 않는다) */
 function unreachable(it){try{const m=root.relationshipMeta(it.row.item),n=Number((root.OPS_RULES||{}).unreachableAttempts)||3;return m.attempts>=n&&(!m.meaningfulAt||String(m.outboundAt)>String(m.meaningfulAt));}catch(e){return false;}}
 const sortIn=list=>list.slice().sort((a,b)=>(a.seg.order-b.seg.order)||(Number(b.row.amount)||0)-(Number(a.row.amount)||0)||String(a.row.key).localeCompare(String(b.row.key)));
 function rowHtml(it,pop){
  const r=it.row,c=it.seg,bc=BRAND[r.item.brand]||'#9ca3af',lv=c.level,fill=lv===1;
  return '<div class="prb-row" role="row" tabindex="0" data-prb="open" data-key="'+attr(r.key)+'" data-bucket="'+c.bucket+'"><i style="background:'+bc+'"></i>'
   +'<span class="s"><b title="'+attr(r.site)+'">'+h(r.site)+(root.advisoryBadge?root.advisoryBadge(r.item):'')+'</b><small><em style="color:'+bc+'">'+h(r.item.brand||'브랜드 미지정')+'</em> · '+h(r.owner||'미배정')+'</small></span>'
   +'<span class="d"><b'+(c.dRed?' class="r"':'')+'>'+h(c.d)+'</b><small>'+h(c.ds)+'</small></span>'
   +'<span class="i lv'+(lv===1?'1':lv===0?'0':'n')+'">'+h(c.issue)+'</span>'
   +'<b class="a">'+h(money(r.amount))+'</b>'
   +'<button type="button" class="'+(fill?'fill':'')+'" data-prb="act" data-key="'+attr(r.key)+'" data-v="'+attr(c.btn[1])+'">'+h(c.btn[0])+'</button></div>'
   +(pop&&pop.key===r.key?popHtml(it,pop):'');
 }
 function popHtml(it,P){
  const q=root.PipelineStageB.segRules(),today=root.RelationshipSegment.todayKey();
  const body=P.kind==='sent'
   ?'<label for="prb-date">견적 발송일</label><input id="prb-date" type="date" data-prb-in="date" max="'+today+'" value="'+attr(P.date||'')+'"'+(P.busy?' disabled':'')+'><button type="button" class="ok" data-prb="popsave"'+(P.busy?' disabled':'')+'>'+(P.busy?'저장 확인 중…':'저장')+'</button><button type="button" data-prb="popclose"'+(P.busy?' disabled':'')+'>취소</button><small>넣은 날부터 '+q.focusEnd+'일 집중관리 → '+mo(q.normalEnd)+'개월 일반관리로 자동 분류됩니다</small>'
   :'<span>오늘부터 '+q.focusEnd+'일 동안 집중관리로 옮깁니다 · '+q.focus+'일 단위 후속 · 견적 다시 확인</span><button type="button" class="ok" data-prb="popsave"'+(P.busy?' disabled':'')+'>'+(P.busy?'저장 확인 중…':'집중관리로 옮기기')+'</button><button type="button" data-prb="popclose"'+(P.busy?' disabled':'')+'>취소</button>';
  return '<div class="prb-pop" data-key="'+attr(it.row.key)+'">'+body+(P.err?'<p role="alert">'+h(P.err)+'</p>':'')+'</div>';
 }
 function cardHtml(it){
  const r=it.row,c=it.seg,bc=BRAND[r.item.brand]||'#9ca3af';
  return '<div class="psb-card prb-card" role="button" tabindex="0" data-prb="open" data-key="'+attr(r.key)+'" style="border-left-color:'+bc+'"><div class="t"><b style="color:'+bc+'">'+h(r.item.brand||'브랜드 미지정')+'</b><i></i><b class="'+(c.dRed?'r':'')+'">'+h(c.d)+'</b></div><strong>'+h(r.site)+'</strong><span>'+h(c.ds)+' · '+h(r.owner||'미배정')+' · '+h(money(r.amount))+'</span><div class="b"><em class="lv'+(c.level===1?'1':c.level===0?'0':'n')+'">'+h(c.issue)+'</em><i></i><button type="button" class="'+(c.level===1?'fill':'')+'" data-prb="act" data-key="'+attr(r.key)+'" data-v="'+attr(c.btn[1])+'">'+h(c.btn[0])+'</button></div></div>';
 }
 function html(list,md){
  const S=st(),q=md.q,C=md.C,items=md.items.filter(i=>i.seg),by=k=>items.filter(i=>i.bucket===k),nodata=by('nodata'),classed=items.filter(i=>i.bucket!=='nodata');
  if(!S.sub||(S.sub==='nodata'&&!nodata.length)){S.sub=(SUB.find(s=>by(s.k).length)||(nodata.length?NODATA:SUB[0])).k;S.chip='all';S.why=null;}
  const cur=subOf(S.sub),inSub=by(S.sub);
  /* ① 3칸 카드 */
  const cards=SUB.map(s=>{const l=by(s.k),n=l.length,ov=l.filter(i=>i.seg.over).length,p=n?Math.round((n-ov)/n*100):null,on=S.sub===s.k;
   return '<button type="button" class="prb-sub" data-prb="sub" data-v="'+s.k+'" aria-pressed="'+on+'" style="border-top-color:'+s.top+'"><span class="h"><b>'+s.l+'</b><span>'+h(s.range(q))+'</span><b class="n">'+n+'<span>건</span></b></span><span class="rule">'+h(s.rule(q))+'</span>'
    +'<span class="bar"><i><u style="width:'+(p==null?0:p)+'%;background:'+(p==null?'transparent':p<50?BAR:p<80?'#e8a09a':'#3fb37f')+'"></u></i><span>기준 지킴 <b'+(p!=null&&p<50?' class="r"':'')+'>'+(p==null?'–':p+'%')+'</b></span></span><b class="over'+(ov?'':' none')+'">'+h(s.over(q,ov))+'</b></button>';}).join('');
  const nd=nodata.length?'<button type="button" class="prb-nodata" data-prb="sub" data-v="nodata" aria-pressed="'+(S.sub==='nodata')+'"><b>데이터 확인 필요 <em>'+nodata.length+'건</em></b><span>견적 발송일이 없어 분류하지 못했습니다 · 발송일을 넣으면 자동으로 분류됩니다</span><i></i><u>'+(S.sub==='nodata'?'보는 중':'보기')+'</u></button>':'';
  /* ② 왼쪽: 단계 진단 · 왜 멈춰 있나 · 그래서 뭘 해야 하나 */
  const total=md.items.length,sumAmt=md.items.reduce((a,i)=>a+(Number(i.row.amount)||0),0),avg=total?Math.round(md.items.reduce((a,i)=>a+i.stall,0)/total):0,overN=classed.filter(i=>i.seg.over).length;
  const cnt=k=>classed.filter(i=>i.rs.includes(k)).length,maxB=Math.max(1,...SUB.map(s=>by(s.k).length));
  const diag='<section class="prb-box"><header><b>단계 진단</b><span>'+total+'건 · '+h(sumMoney(sumAmt))+'</span></header><div class="prb-kpis"><div><span>기준 넘김 (빨강)</span><b'+(overN?' class="r"':'')+'>'+overN+'건</b><small>세 칸 합 · 오늘 처리할 것</small></div><div><span>평균 체류</span><b>'+avg+'일</b><small>이 단계에 머문 일수</small></div></div></section>';
  const why='<section class="prb-box prb-why"><header><b>왜 멈춰 있나</b><span>누르면 오른쪽 현장이 걸러짐</span></header>'+WHY.map(([k,col])=>{const n=cnt(k);return '<button type="button" class="prb-reason" data-prb="why" data-v="'+k+'" aria-pressed="'+(S.why===k)+'"><span><span>'+h(C.RS[k][0])+'</span><b style="color:'+col+'">'+n+'</b></span><i><u style="width:'+Math.min(100,Math.round(n/maxB*100))+'%;background:'+col+'"></u></i></button>';}).join('')+'</section>';
  const tdN=k=>inSub.filter(i=>i.rs.includes(k)).length;
  const judgeN=by('focus').filter(i=>i.seg.judge).length,meetN=by('focus').filter(i=>i.seg.meet).length,m4N=by('normal').filter(i=>i.seg.m4).length,nearN=by('wait').filter(i=>i.seg.near).length,goneN=items.filter(unreachable).length;
  const moves=[['집중관리','일반관리','견적 후 '+q.focusEnd+'일 지남',judgeN,'#15171c',''],['집중관리','경쟁 · 입찰','대표회의 · 입찰 일정 잡힘',meetN,'#1f7a4d',''],['일반관리','대기관리','내년 이후 확정 · '+mo(q.normalEnd)+'개월 지남',m4N,'#15171c',''],['대기관리','집중관리','공사 시기 3개월 안',nearN,RED,''],['어디서든','실주 · 보류','담당자가 결과 기록',goneN,'#6b7280','연락 3회 넘게 닿지 않은 건 · 실주 · 보류는 담당자가 정합니다']];
  const todo='<section class="prb-box prb-todo"><header><b>그래서 뭘 해야 하나</b></header>'+(TD[S.sub]||[]).map(([k,t,v,how])=>'<div class="prb-act"><span'+(['focus7','month30','long60'].includes(k)?' class="r"':'')+'>'+h(t)+' '+tdN(k)+'건</span><p>'+h(v)+'</p><small>'+h(how)+'</small></div>').join('')
   +'<button type="button" class="prb-rule" data-prb="rule" aria-expanded="'+!!S.rule+'">자동 이동 규칙 '+(S.rule?'▴':'▾')+'</button>'+(S.rule?'<div class="prb-moves">'+moves.map(([from,to,when,n,col,tip])=>'<div'+(tip?' title="'+attr(tip)+'"':'')+'><span><b>'+from+'</b> → <b>'+to+'</b> <span>'+h(when)+'</span></span><b style="color:'+col+'">'+n+'</b></div>').join('')+'</div>':'')+'</section>';
  /* ③ 오른쪽: 확인할 현장 */
  const chipDefs=cur.chips(q),chipOk=(i,k)=>k==='all'||!!(i.seg.chips&&i.seg.chips[k]);if(!chipDefs.some(c=>c[1]===S.chip))S.chip='all';
  const filtered=sortIn(inSub.filter(i=>chipOk(i,S.chip)&&(!S.why||i.rs.includes(S.why))));
  const chips=chipDefs.map(([l,k])=>'<button type="button" class="prb-chip" data-prb="chip" data-v="'+k+'" aria-pressed="'+(S.chip===k)+'">'+h(l)+' <span>'+inSub.filter(i=>chipOk(i,k)).length+'</span></button>').join('');
  const head='<div class="prb-lhead"><b>확인할 현장 <span>'+cur.l+' '+inSub.length+'곳</span></b>'+(S.view==='list'?chips+'<small>'+h(cur.sort)+(S.why?' · '+h(C.RS[S.why][0])+' '+filtered.length+'곳':'')+'</small>':(S.why?'<small>'+h(C.RS[S.why][0])+'</small>':''))+'<i></i><div class="psb-views"><button type="button" data-prb="view" data-v="list" aria-pressed="'+(S.view==='list')+'">리스트</button><button type="button" data-prb="view" data-v="board" aria-pressed="'+(S.view==='board')+'">보드</button></div></div>';
  let body;
  if(S.view==='board')body='<div class="psb-board prb-board">'+SUB.map(s=>{const l=sortIn(by(s.k).filter(i=>!S.why||i.rs.includes(S.why))),cp=root.ListPager.cut(l,root.ListPager.page(S,'col:'+s.k)),cardsIn=cp.rows;return '<div class="psb-col"><div class="ch"><i style="background:'+s.top+'"></i><b>'+s.l+'</b><span>'+l.length+'</span><em>'+h(s.hint(q))+'</em></div>'+(cardsIn.length?cardsIn.map(cardHtml).join(''):'<p class="psb-none">없음</p>')+root.ListPager.html(cp,{ns:'prb',v:'col:'+s.k,small:true,info:false})+'</div>';}).join('')+'</div>';
  else{const LP=root.ListPager,pg=LP.cut(filtered,LP.page(S)),shown=pg.rows;
   body='<div class="prb-table" role="table" aria-label="'+attr(cur.l)+' 현장"><div class="prb-thead" role="row"><span></span><span>현장 · 담당</span><span>'+h(cur.col)+'</span><span>지금 걸린 것</span><span class="a">금액</span><span></span></div>'
    +(shown.length?shown.map(i=>rowHtml(i,S.pop)).join(''):'<div class="prb-empty">해당하는 현장이 없습니다</div>')
    +LP.html(pg,{ns:'prb',unit:'곳'})
    +'<div class="prb-foot">'+h(cur.foot(q))+'</div></div>';}
  return '<div id="pipeline-stage-b" class="psb prb" data-stage="relationship"><div class="prb-head"><b>'+h(C.name)+'</b><span>'+h(C.desc())+'</span></div><div class="prb-subs">'+cards+'</div>'+nd
   +'<div class="prb-body"><aside class="prb-left">'+diag+why+todo+'</aside><section class="prb-main">'+head+body+'</section></div></div>';
 }
 const rowOf=key=>{try{return root.PipelineWorkspace.rows().find(x=>x.key===key)||root.PipelineWorkspace.rows({unscoped:true}).find(x=>x.key===key)||null;}catch(e){return null;}};
 /* 지금 단계 정보에 날짜 한 칸 저장 — 서버가 확인한 값만 화면에 반영 */
 async function saveDate(P){
  const S=st(),r=rowOf(P.key),G=root.RelationshipSegment,today=G.todayKey();if(!r){S.pop=null;return root.paint();}
  const field=P.kind==='sent'?'sent_date':'focus_from',value=P.kind==='sent'?G.dateKey(P.date):today;
  if(!value||value>today){P.err='오늘까지의 날짜로 넣어 주세요.';return root.paint();}
  if(!canSF()){P.err='저장은 서버에 연결된 뒤에 쓸 수 있습니다.';return root.paint();}
  P.busy=true;P.err='';root.paint();
  try{
   const d=r.item,code=root.dealStage(d),res=await root.SB.rpc(SF_RPC,{p:{deal_id:String(d.id),stage_code:code,fields:{[field]:value},reason:P.kind==='sent'?'관계관리 분류 · 견적 발송일 입력':'공사 시기 3개월 안 · 집중관리 복귀'}});
   if(res.error){if(res.error.code==='PGRST202'&&root.CRMRelease&&root.CRMRelease.noteMissing)root.CRMRelease.noteMissing(SF_RPC);throw Error(res.error.message||'저장 실패');}
   if(!res.data||res.data.ok!==true||!res.data.stage_context)throw Error('서버 확인 응답이 올바르지 않습니다.');
   d.stage_contexts=Object.assign({},d.stage_contexts||{},{[code]:res.data.stage_context});d.stageContexts=d.stage_contexts;try{const p=root.itemPatch(d,'deal');if(p&&p.stage_contexts)p.stage_contexts=d.stage_contexts;}catch(e){}
   if(res.data.version!=null)d.version=res.data.version;try{root.saveLocal&&root.saveLocal();}catch(e){}
   S.pop=null;toast(P.kind==='sent'?'견적 발송일을 저장했습니다 — 자동으로 분류했습니다':'집중관리로 옮겼습니다');root.paint();
  }catch(e){P.busy=false;P.err='저장하지 못했습니다: '+String(e&&e.message||e);root.paint();}
 }
 function onClick(e){
  const b=e.target.closest('#pipeline-stage-b[data-stage="relationship"] [data-prb]');if(!b||!enabled())return;
  const S=st(),a=b.dataset.prb,v=b.dataset.v;
  if(a==='sub'){S.sub=v;S.chip='all';S.why=null;root.ListPager.reset(S);S.pop=null;return root.paint();}
  if(a==='chip'){S.chip=v;S.why=null;root.ListPager.reset(S);return root.paint();}
  if(a==='why'){if(S.why===v){S.why=null;}else{S.why=v;S.chip='all';const to=(WHY.find(w=>w[0]===v)||[])[2];if(to)S.sub=to;}root.ListPager.reset(S);S.pop=null;return root.paint();}
  if(a==='rule'){S.rule=!S.rule;return root.paint();}
  if(a==='view'){S.view=v;S.pop=null;return root.paint();}
  if(a==='page'){root.ListPager.set(S,v,b.dataset.page);S.pop=null;return root.paint();}
  if(a==='popclose'){S.pop=null;return root.paint();}
  if(a==='popsave'){if(S.pop&&!S.pop.busy)saveDate(S.pop);return;}
  e.stopPropagation();
  if(a==='act'){
   if(v==='sent'||v==='focus'){if(S.view!=='list'){S.view='list';const it=rowOf(b.dataset.key);void it;}S.pop=S.pop&&S.pop.key===b.dataset.key&&S.pop.kind===v?null:{key:b.dataset.key,kind:v,date:'',err:'',busy:false};root.paint();const inp=document.getElementById('prb-date');if(inp)inp.focus();return;}
   return root.PipelineStageB.open(b.dataset.key,v);
  }
  if(a==='open'&&!e.target.closest('button,input,label,.prb-pop'))return root.PipelineStageB.open(b.dataset.key);
 }
 document.addEventListener('click',onClick);
 document.addEventListener('input',e=>{const t=e.target;if(t&&t.dataset&&t.dataset.prbIn==='date'&&st().pop)st().pop.date=t.value;});
 document.addEventListener('keydown',e=>{const t=e.target;if(!t||!t.matches)return;
  if(t.matches('#prb-date')){if(e.key==='Enter'){e.preventDefault();const P=st().pop;if(P&&!P.busy){P.date=t.value;saveDate(P);}}if(e.key==='Escape'){e.preventDefault();e.stopPropagation();st().pop=null;root.paint();}return;}
  if((e.key==='Enter'||e.key===' ')&&t.matches('#pipeline-stage-b[data-stage="relationship"] [data-prb="open"]')){e.preventDefault();root.PipelineStageB.open(t.dataset.key);}});
 root.PipelineRelB={enabled,html,SUB,TD,WHY,money};
})(window);
