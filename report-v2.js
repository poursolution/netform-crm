/* 리포트 v2 (2026-10-02 디자인 핸드오프 'design_handoff_report') — 리포트 메뉴(#p=report)만. 대표님 보고용 슬라이드 8장 + 한 페이지.
   한 장에 메시지 하나: 표지 → 지금 상황 → 그래도 쌓인 것 → 담당자별 → 지난 기간과 비교 → 숫자 뒤의 진짜 모습 → 부탁 한 가지 → 약속.
   집계는 기존 리포트와 같은 함수(reportRawDeals · reportOpenDeals · reportWonIn · wonAmt/wonDate(계약 체결일 기준) · weightedAmount · reportAdvancedBetween · managementStats).
   지난 기간 비교는 날짜가 남아 있는 사건(수주 · 신규 · 단계 변경 · 종료)으로 지금 계산한다 — 스냅샷이 없어도 된다.
   ※ 저장이 필요한 것(매월 1일 스냅샷, 대표 응답, 지난달 약속 결과, Claude API 문장, 잔디 보내기)은 저장소 · 서버 함수 설치 뒤에 붙인다.
      그 전까지 문장은 규칙으로 만들고, 응답 · 보내기 버튼은 잠겨 있다. [편집]으로 고친 문장은 이 화면을 떠나면 사라진다(저장 안 함).
   기존 상세 표는 [상세 표 보기]로 그대로 연다. 끄기: G.reportV2Off=true → 예전 화면. */
(function(root){
 'use strict';
 const h=v=>root.esc(String(v==null?'':v)),attr=v=>root.escAttr(String(v==null?'':v));
 const enabled=()=>!root.G.reportV2Off;
 const N=8,TITLES=['표지','지금 상황','그래도 쌓인 것','담당자별','지난 기간과 비교','숫자 뒤의 진짜 모습','대표님께 부탁드릴 것','약속은 작게, 결과는 그대로'];
 const st=()=>root.G.reportV2||(root.G.reportV2={mode:'month',view:'slides',i:0,edit:false,edits:{},detail:false});
 const sum=(l,f)=>l.reduce((a,x)=>a+(Number(f(x))||0),0);
 const won=v=>root.reportAmount(v);
 function windows(mode){
  const R=root,n=new Date(),y=n.getFullYear(),m=n.getMonth(),K=d=>R.briefDateKey(d),W=(a,b,label,long)=>({startKey:K(a),endKey:K(b),label,long});
  if(mode==='year')return {kind:'yearly',key:String(y),prevKey:String(y-1),cur:W(new Date(y,0,1),new Date(y+1,0,1),y+'년',y+'년'),prev:W(new Date(y-1,0,1),new Date(y,0,1),'작년',(y-1)+'년'),unit:'올해',prevUnit:'작년'};
  if(mode==='quarter'){const q=Math.floor(m/3),pq=new Date(y,q*3-3,1);return {kind:'quarterly',key:y+'-Q'+(q+1),prevKey:pq.getFullYear()+'-Q'+(Math.floor(pq.getMonth()/3)+1),cur:W(new Date(y,q*3,1),new Date(y,q*3+3,1),(q+1)+'분기',y+'년 '+(q+1)+'분기'),prev:W(new Date(y,q*3-3,1),new Date(y,q*3,1),'지난 분기','지난 분기'),unit:'이번 분기',prevUnit:'지난 분기'};}
  const pm=new Date(y,m-1,1),ym=d=>d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0');
  return {kind:'monthly',key:ym(new Date(y,m,1)),prevKey:ym(pm),cur:W(new Date(y,m,1),new Date(y,m+1,1),(m+1)+'월',y+'년 '+(m+1)+'월'),prev:W(new Date(y,m-1,1),new Date(y,m,1),'지난달','지난달'),unit:'이번 달',prevUnit:'지난달'};
 }
 function data(){
  const R=root,S=st(),P=windows(S.mode),raw=R.reportRawDeals(),open=R.reportOpenDeals(),inW=(v,w)=>R.briefInWindow(v,w.startKey,w.endKey);
  const wonIn=w=>raw.filter(d=>R.isWon(d)&&inW(R.wonDate(d),w)),lostIn=w=>raw.filter(d=>!R.isOpen(d)&&!R.isWon(d)&&inW(d.closed||d.closed_at||d.updated||d.created,w));
  const curWon=wonIn(P.cur),prevWon=wonIn(P.prev),curLost=lostIn(P.cur),prevLost=lostIn(P.prev);
  const near=open.filter(d=>{const r=R.perfStageRank(R.dealStage(d));return r>=7&&r<=10;}),risk=open.filter(R.briefIsRisk).sort((a,b)=>R.reportRiskScore(b)-R.reportRiskScore(a)),critical=risk.filter(R.reportCritical);
  const months=[-5,-4,-3,-2,-1,0].map(n=>{const w=R.reportMonthWindow(n),a=R.reportWonIn(raw,w);return {label:w.label,n:a.length,amt:sum(a,R.wonAmt)};});
  const year=new Date().getFullYear(),qAmt=(y,q)=>sum(raw.filter(d=>{const k=String(R.wonDate(d)||'');return R.isWon(d)&&k.slice(0,4)===String(y)&&Math.ceil(Number(k.slice(5,7))/3)===q;}),R.wonAmt);
  const quarters=[1,2,3,4].map(q=>({q,now:qAmt(year,q),prev:qAmt(year-1,q)})).filter(x=>x.now>x.prev&&x.now>0).sort((a,b)=>(b.now-b.prev)-(a.now-a.prev));
  const groups=[['초기 · 설계',['first_contact','consulting']],['자료 발송',['sent']],['관계관리',['rapport','silent','waiting']],['경쟁 · 입찰',['compete','imminent','bidding']],['계약 · 시공',['contract','construction','completion']]].map(([name,codes])=>{const a=open.filter(d=>codes.includes(R.dealStage(d)));return {name,n:a.length,amt:sum(a,R.oppAmt),w:R.weightedAmount(a)};});
  let ext=[];try{ext=R.externalPerformanceNames();}catch(e){}
  const people=(R.PERFORMANCE_TARGET_NAMES||[]).map(n=>[n,'']).concat(ext.map(n=>[n,(()=>{try{return R.repProfile(n).team==='gyeongnam'?'지사':'외부';}catch(e){return '외부';}})()])).map(([n,tag])=>{
   const own=d=>R.repN(d.assignee)===n,w=curWon.filter(own),l=curLost.filter(own),o=open.filter(own),decided=w.length+l.length;
   return {n,tag,did:w.length+l.length+o.length,won:w.length,lost:l.length,open:o.length,made:sum(w,R.wonAmt),missed:sum(l,R.oppAmt),rate:decided?Math.round(w.length*100/decided):null,decided,pipe:R.weightedAmount(o)};
  }).filter(p=>p.did>0).sort((a,b)=>b.made-a.made||b.did-a.did);
  const adv=w=>raw.filter(d=>R.reportAdvancedBetween(d,w.startKey,w.endKey)).length,created=w=>raw.filter(d=>inW(d.created,w)).length;
  const tracked=raw.some(d=>{try{return R.briefAllStageEvents(d).length>0;}catch(e){return false;}});
  const compare=[{name:'수주',prev:sum(prevWon,R.wonAmt),cur:sum(curWon,R.wonAmt),fmt:won,sub:[prevWon.length+'건',curWon.length+'건'],good:1},{name:'신규 영업기회',prev:created(P.prev),cur:created(P.cur),fmt:v=>v+'건',good:1},{name:'단계 진전',prev:adv(P.prev),cur:adv(P.cur),fmt:v=>v+'건',good:1,na:!tracked},{name:'실주 · 종료',prev:prevLost.length,cur:curLost.length,fmt:v=>v+'건',good:-1}];
  let M=null;try{M=R.managementStats(null);}catch(e){}
  return {P,raw,open,curWon,prevWon,curLost,near,nearAmt:sum(near,R.oppAmt),risk,critical,months,quarters,groups,people,compare,pipeAmt:sum(open,R.oppAmt),forecast:R.weightedAmount(open),wonAmt:sum(curWon,R.wonAmt),M};
 }
 /* 문장: 규칙으로 만든 초안. [편집]으로 고친 값이 있으면 그것을 쓴다 */
 function T(key,text,tag){const S=st(),v=Object.prototype.hasOwnProperty.call(S.edits,key)?S.edits[key]:text;return '<'+(tag||'span')+' class="rp-t" data-key="'+attr(key)+'"'+(S.edit?' contenteditable="true" spellcheck="false"':'')+'>'+h(v)+'</'+(tag||'span')+'>';}
 function ask(x){
  const R=root,d=x.critical[0]||x.near.slice().sort((a,b)=>R.oppAmt(b)-R.oppAmt(a))[0];
  if(!d)return null;
  const rest=x.critical.concat(x.near).filter((v,i,a)=>v!==d&&a.indexOf(v)===i).slice(0,2);
  return {d,title:(d.site||'현장명 미입력')+' — '+R.reportDecisionText(d),why:R.reportRiskReason(d)+' · '+R.stageLabel(R.dealStage(d))+' · '+(R.oppAmt(d)?won(R.oppAmt(d)):'금액 미입력')+' · 담당 '+R.repN(d.assignee),rest};
 }
 function promises(x){
  const out=[],M=x.M;
  if(M&&M.noResponse.length)out.push({what:'배정된 문의는 그날 첫 연락을 한다',who:'영업팀 · 매일 · 건당 5분',where:'관리팀 KPI · 첫 연락',basis:'지금 첫 연락 전 '+M.noResponse.length+'건'});
  if(M&&M.nextMissing.length)out.push({what:'진행 건마다 다음 할 일과 날짜를 적는다',who:'영업팀 · 매주 금요일 · 10분',where:'주간 브리핑 · 다음 할 일 없음',basis:'지금 다음 할 일 없음 '+M.nextMissing.length+'건'});
  if(out.length<2&&M&&M.unassigned.length)out.push({what:'새 문의는 당일 담당을 정한다',who:'관리팀 · 매일 · 5분',where:'관리팀 KPI · 당일 배정',basis:'지금 미배정 '+M.unassigned.length+'건'});
  if(out.length<2&&x.curLost.length)out.push({what:'실주하면 사유와 경쟁사를 그 자리에서 적는다',who:'영업팀 · 종료할 때 · 2분',where:'파이프라인 · 실주',basis:x.P.unit+' 실주 · 종료 '+x.curLost.length+'건'});
  return out.slice(0,2);
 }
 function cover(x){
  const lead=x.near.length?'임박 '+x.near.length+'건을 잡으면 '+won(x.nearAmt)+'이 들어옵니다':x.curWon.length?x.P.unit+' '+x.curWon.length+'건 · '+won(x.wonAmt)+'을 수주했습니다':'진행 '+x.open.length+'건 · '+won(x.pipeAmt)+'을 키우고 있습니다';
  const risk=!x.curWon.length?x.P.unit+' 수주는 아직 0건입니다'+(x.critical.length?' · 지금 봐야 할 현장 '+x.critical.length+'곳':''):x.critical.length?'지금 봐야 할 현장이 '+x.critical.length+'곳 있습니다':'지금 급히 봐야 할 현장은 없습니다';
  return {lead,risk};
 }
 function goods(x){
  const R=root,out=[];
  if(x.near.length)out.push(['계약 임박',x.near.length+'건',won(x.nearAmt)+' · 경쟁·입찰 ~ 계약 단계']);
  if(x.quarters.length){const q=x.quarters[0];out.push(['성장한 분기',q.q+'분기',won(q.now)+' · 작년 같은 분기 '+won(q.prev)]);}
  const top=x.people.find(p=>p.made>0);if(top)out.push(['잘하는 사람',top.n,x.P.unit+' '+won(top.made)+' · '+top.won+'건 수주']);
  if(out.length<3&&x.forecast)out.push(['실제 기대 매출',won(x.forecast),'단계별 확률을 곱한 값']);
  const created=x.compare[1];if(out.length<3&&created.cur)out.push(['새로 생긴 기회',created.cur+'건',x.P.unit+' 등록']);
  if(out.length<3&&x.open.length)out.push(['진행 중인 영업',x.open.length+'건',won(x.pipeAmt)]);
  return out.slice(0,3);
 }
 function peopleNote(x){
  const best=x.people.find(p=>p.made>0),miss=x.people.slice().sort((a,b)=>b.missed-a.missed)[0];
  const a=best?best.n+' — '+won(best.made)+'을 만들었습니다':'',b=miss&&miss.lost?miss.n+' — 실주 '+miss.lost+'건'+(miss.missed?'('+won(miss.missed)+')':'')+', 놓친 이유를 확인할 차례입니다':'';
  return [a,b].filter(Boolean).join(' · ')||'이 기간에 결정된 건이 없어 성공률은 아직 산정 전입니다';
 }
 /* 운영 저장소: 보고 저장 · 대표 응답 · 지난 기간 약속 (설치돼 있을 때만) */
 const STORE={state:'idle',kind:'',snaps:[],busy:false};
 const RESP={yes:'좋습니다',partial:'1곳만',no:'이번 달은 어려움'};
 function loadStore(kind,force){const O=root.OpsStore;if(!O||!O.has('crm_report_snapshot_get_v1')){STORE.state='off';return;}if(STORE.state==='loading'||(STORE.state==='ready'&&STORE.kind===kind&&!force))return;STORE.state='loading';STORE.kind=kind;O.rpc('crm_report_snapshot_get_v1',{kind,limit:6}).then(r=>{STORE.snaps=r.snapshots||[];STORE.state='ready';if(root.G.page==='report')render();}).catch(e=>{STORE.state=e.unavailable?'off':'failed';});}
 const snapOf=key=>STORE.state==='ready'?STORE.snaps.find(s=>s.period_key===key)||null:null;
 const edited=(key,text)=>{const S=st();return Object.prototype.hasOwnProperty.call(S.edits,key)?S.edits[key]:text;};
 function saveSnapshot(btn){
  const O=root.OpsStore,x=data(),c=cover(x),a=ask(x),pr=promises(x);btn.disabled=true;btn.textContent='저장 중…';
  const payload={saved_label:x.P.cur.long,won_amount:x.wonAmt,won_count:x.curWon.length,pipeline_amount:x.pipeAmt,forecast:x.forecast,near_count:x.near.length,near_amount:x.nearAmt,critical_count:x.critical.length,cover:edited('cover',c.lead),risk:edited('coverRisk',c.risk),ask:a?{title:edited('ask',a.title),why:edited('askWhy',a.why),deal_id:String(a.d.id||'')}:null,people:x.people.map(p=>({n:p.n,did:p.did,won:p.won,lost:p.lost,open:p.open,made:p.made,missed:p.missed,rate:p.rate}))};
  O.rpc('crm_report_snapshot_save_v1',{kind:x.P.kind,period_key:x.P.key,payload,promises:pr.map((p,i)=>({what:edited('promise'+i,p.what),who:p.who,where:p.where,basis:p.basis}))}).then(()=>{if(typeof root.toast==='function')root.toast(x.P.cur.long+' 보고를 저장했습니다');loadStore(x.P.kind,true);}).catch(e=>{btn.disabled=false;btn.textContent='이 보고 저장';if(typeof root.toast==='function')root.toast(String(e.message||e),'warn');});
 }
 function saveResponse(v){const O=root.OpsStore,x=data();if(STORE.busy)return;STORE.busy=true;O.rpc('crm_report_response_save_v1',{kind:x.P.kind,period_key:x.P.key,response:v}).then(()=>{if(typeof root.toast==='function')root.toast('대표님 답을 저장했습니다 · '+RESP[v]);loadStore(x.P.kind,true);}).catch(e=>{if(typeof root.toast==='function')root.toast(String(e.message||e),'warn');}).finally(()=>{STORE.busy=false;});}
 /* AI 문장: 지금 화면의 숫자만 넘기고, 받은 문장은 [편집]한 것처럼 채운다 — 저장은 [이 보고 저장]을 눌러야 된다 */
 function aiText(){
  const x=data(),a=ask(x),pr=promises(x),S=st();if(STORE.aiBusy)return;STORE.aiBusy=true;render();
  const input={period:x.P.cur.long,unit:x.P.unit,won_amount:x.wonAmt,won_count:x.curWon.length,prev_won_amount:x.compare[0].prev,pipeline_amount:x.pipeAmt,pipeline_count:x.open.length,forecast:x.forecast,near_count:x.near.length,near_amount:x.nearAmt,critical_count:x.critical.length,lost_count:x.curLost.length,stage_groups:x.groups.map(g=>({name:g.name,count:g.n,amount:g.amt})),people:x.people.slice(0,9).map(p=>({name:p.n,opportunities:p.did,won:p.won,lost:p.lost,made:p.made,missed:p.missed})),ask_candidate:a?{site:a.d.site||'',decision:root.reportDecisionText(a.d),reason:root.reportRiskReason(a.d)}:null,promise_candidates:pr.map(p=>({what:p.what,who:p.who,where:p.where}))};
  root.OpsStore.ai('report_text','report',x.P.kind+':'+x.P.key,input).then(s=>{const r=s.suggestion||{},set=(k,v)=>{if(v&&String(v).trim())S.edits[k]=String(v).trim();};set('cover',r.cover);set('coverRisk',r.risk);set('now',r.now);set('people',r.people);set('real',r.real);if(a){set('ask',r.ask);set('askWhy',r.askWhy);}(r.promises||[]).slice(0,pr.length).forEach((p,i)=>set('promise'+i,p.what));if(typeof root.toast==='function')root.toast('AI 문장을 채웠습니다 — 읽어 보고 [편집]으로 고친 뒤 저장해 주세요');}).catch(e=>{if(typeof root.toast==='function')root.toast(String(e.message||e),'warn');}).finally(()=>{STORE.aiBusy=false;render();});
 }
 function answersHtml(x){
  const O=root.OpsStore,snap=snapOf(x.P.key),can=!!snap&&O&&O.admin();
  const btns='<div class="rp-answers">'+Object.keys(RESP).map(k=>'<button type="button" data-rp="answer" data-value="'+k+'"'+(can?'':' disabled')+(snap&&snap.boss_response===k?' aria-pressed="true"':'')+'>'+RESP[k]+'</button>').join('')+'</div>';
  const note=STORE.state!=='ready'?'대표님 답을 저장하는 곳이 아직 없어 버튼은 잠겨 있습니다(저장소 설치 뒤 켜집니다)':!snap?'먼저 위의 [이 보고 저장]을 누르면 답을 남길 수 있습니다':snap.boss_response?'답을 저장했습니다 · '+RESP[snap.boss_response]+' · '+String(snap.boss_response_at||'').slice(0,10):'대표님 답을 눌러 남기면 다음 보고의 약속 장에 그대로 나옵니다';
  return btns+'<small class="rp-lock">'+note+'</small>';
 }
 function prevHtml(x){
  const snap=snapOf(x.P.prevKey);
  if(!snap)return '<p class="rp-none">'+h(x.P.prevUnit)+' 약속 기록이 없습니다 — 이번 보고부터 저장되면 다음 보고에 지킴 · 못 지킴과 이유가 그대로 나옵니다</p>';
  const pr=Array.isArray(snap.promises)?snap.promises:[],a=snap.payload&&snap.payload.ask;
  return (pr.length?pr.map(p=>'<div class="rp-promise old"><b>'+h(p.what)+'</b><span>'+h(p.who||'')+'</span><small>확인하는 곳: '+h(p.where||'')+(p.basis?' · 그때 '+h(p.basis):'')+'</small></div>').join(''):'<p class="rp-none">'+h(x.P.prevUnit)+'에 저장된 약속이 없습니다</p>')
   +(a?'<div class="rp-promise old"><b>부탁: '+h(a.title)+'</b><span>대표님 답 — '+h(snap.boss_response?RESP[snap.boss_response]:'아직 없음')+'</span></div>':'');
 }
 const peopleHtml=(x,compact)=>x.people.length?'<div class="rp-people'+(compact?' compact':'')+'"><div class="rp-ph"><span>담당</span><span>한 일</span><span>결과</span><span>만든 돈</span><span>놓친 돈</span><span>성공률</span></div>'+x.people.slice(0,compact?7:9).map(p=>{const t=Math.max(1,p.did),bar=(n,c)=>n?'<i class="'+c+'" style="flex:'+n+'">'+n+'</i>':'';return '<div class="rp-pr"><b>'+h(p.n)+(p.tag?' <em>'+p.tag+'</em>':'')+'</b><span>'+p.did+'건</span><span class="rp-bar" title="수주 '+p.won+' · 실주 '+p.lost+' · 진행 '+p.open+'">'+bar(p.won,'g')+bar(p.lost,'r')+bar(p.open,'m')+'</span><span class="'+(p.made?'g':'m')+'">'+won(p.made)+'</span><span class="'+(p.missed?'r':'m')+'">'+won(p.missed)+'</span><span>'+(p.rate==null?'<u>산정 전</u>':p.rate+'% <small>'+p.won+'/'+p.decided+'</small>')+'</span></div>';}).join('')+'</div>':'<p class="rp-none">이 기간에 다룬 영업기회가 없습니다</p>';
 const cmpHtml=x=>'<div class="rp-cmp">'+x.compare.map(c=>{if(c.na)return '<div><b>'+c.name+'</b><span>단계 변경 기록이 없어 비교할 수 없습니다</span><em class="m">–</em></div>';const d=c.cur-c.prev,cls=!d?'m':(d>0)===(c.good>0)?'g':'r';return '<div><b>'+c.name+'</b><span>'+h(c.fmt(c.prev))+(c.sub?' <small>'+c.sub[0]+'</small>':'')+' → <strong>'+h(c.fmt(c.cur))+'</strong>'+(c.sub?' <small>'+c.sub[1]+'</small>':'')+'</span><em class="'+cls+'">'+(!d?'변화 없음':(d>0?'▲ ':'▼ ')+h(c.fmt(Math.abs(d))))+'</em></div>';}).join('')+'</div>';
 const askHtml=(x,a)=>a?'<div class="rp-ask"><small>이번에는 한 가지만</small>'+T('ask',a.title,'h3')+'<p>'+T('askWhy',a.why)+'</p>'+answersHtml(x)+'</div>':'<div class="rp-ask"><small>이번에는</small><h3>부탁드릴 일이 없습니다</h3><p>지금 대표님 결정이 필요한 현장이 없습니다.</p></div>';
 const promiseHtml=l=>l.length?l.map((p,i)=>'<div class="rp-promise"><b>'+T('promise'+i,p.what)+'</b><span>'+h(p.who)+'</span><small>확인하는 곳: '+h(p.where)+' · '+h(p.basis)+'</small></div>').join(''):'<p class="rp-none">지금 숫자에서는 따로 약속할 행동이 없습니다</p>';
 function slides(x){
  const R=root,c=cover(x),g=goods(x),a=ask(x),pr=promises(x),mx=Math.max(1,...x.months.map(m=>m.amt)),gx=Math.max(1,...x.groups.map(v=>v.amt)),today=new Date(),date=today.getFullYear()+'. '+(today.getMonth()+1)+'. '+today.getDate()+'.';
  const head=(n,t)=>'<header class="rp-sh"><i>'+n+'</i><b>'+t+'</b><span>'+h(x.P.cur.long)+'</span></header>';
  const top=x.groups.slice().sort((p,q)=>q.amt-p.amt)[0],late=x.groups[3].amt+x.groups[4].amt;
  return [
   '<section class="rp-slide dark"><div class="rp-cover"><small>넷폼 영업 보고 · '+h(x.P.cur.long)+'</small>'+T('cover',c.lead,'h2')+'<p>'+T('coverRisk',c.risk)+'</p><footer><span>'+h(date)+' 자동 취합</span><span>보고 '+h(root.ME&&root.ME.name||'')+'</span></footer></div></section>',
   '<section class="rp-slide">'+head(1,'지금 상황')+'<div class="rp-now"><div><small>'+h(x.P.unit)+' 수주 · 계약 체결일 기준</small><b class="'+(x.wonAmt?'':'r')+'">'+h(won(x.wonAmt))+'</b><p>'+T('now',x.curWon.length?x.curWon.length+'건을 수주했습니다. '+x.P.prevUnit+'은 '+won(x.compare[0].prev)+'이었습니다.':x.P.unit+'에 체결된 계약이 아직 없습니다. '+x.P.prevUnit+'은 '+won(x.compare[0].prev)+'이었습니다.')+'</p></div><div class="rp-months">'+x.months.map(m=>'<div><span>'+h(m.amt?won(m.amt):'0')+'</span><i class="'+(m.amt?'':'zero')+'" style="height:'+Math.max(4,Math.round(m.amt/mx*100))+'%"></i><small>'+h(m.label)+'</small></div>').join('')+'</div></div></section>',
   '<section class="rp-slide">'+head(2,'그래도 쌓인 것')+(g.length?'<div class="rp-goods">'+g.map(v=>'<div><small>'+h(v[0])+'</small><b>'+h(v[1])+'</b><span>'+h(v[2])+'</span></div>').join('')+'</div>':'<p class="rp-none">이 기간에 보여 드릴 좋은 숫자가 아직 없습니다</p>')+'</section>',
   '<section class="rp-slide">'+head(3,'담당자별 — 한 일과 결과')+peopleHtml(x)+'<p class="rp-note">'+T('people',peopleNote(x))+'</p><p class="rp-legend"><i class="g"></i>수주 <i class="r"></i>실주 <i class="m"></i>진행 · 성공률 = 수주 ÷ 결정 완료(수주 + 실주)</p></section>',
   '<section class="rp-slide">'+head(4,x.P.prev.label+'과 비교')+cmpHtml(x)+'</section>',
   '<section class="rp-slide">'+head(5,'숫자 뒤의 진짜 모습')+'<div class="rp-real"><div class="rp-groups">'+x.groups.map(v=>'<div><span>'+h(v.name)+'</span><i><em style="width:'+Math.max(v.amt?3:0,Math.round(v.amt/gx*100))+'%"></em></i><b>'+h(won(v.amt))+'</b><small>'+v.n+'건</small></div>').join('')+'</div><aside><small>진행 금액</small><b>'+h(won(x.pipeAmt))+'</b><small>실제 기대 (가중)</small><b class="b">'+h(won(x.forecast))+'</b></aside></div><p class="rp-note">'+T('real','진행 '+won(x.pipeAmt)+' 중 계약에 가까운 단계(경쟁 · 입찰 ~ 계약)는 '+won(late)+'입니다. '+(top&&top.amt?'가장 많이 쌓인 곳은 «'+top.name+'» '+won(top.amt)+'이고, ':'')+'단계별 확률을 곱한 실제 기대는 '+won(x.forecast)+'입니다.')+'</p></section>',
   '<section class="rp-slide dark">'+head(6,'대표님께 부탁드릴 것')+'<div class="rp-askwrap">'+askHtml(x,a)+'<aside class="rp-later"><small>아직 부탁드리지 않는 것</small>'+(a&&a.rest.length?a.rest.map(d=>'<div><b>'+h(d.site||'현장명 미입력')+'</b><span>'+h(R.reportDecisionText(d))+' · 다음 보고 때 다시 말씀드립니다</span></div>').join(''):'<div><span>없습니다</span></div>')+'</aside></div></section>',
   '<section class="rp-slide">'+head(7,'약속은 작게, 결과는 그대로')+'<div class="rp-two"><div><small>'+h(x.P.prevUnit)+' 약속 결과</small>'+prevHtml(x)+'</div><div><small>'+h(x.P.unit)+' 행동 약속 · 초안</small>'+promiseHtml(pr)+'</div></div><p class="rp-note">결과(금액 · 수주)는 약속하지 않습니다. 우리가 할 수 있는 행동만 약속하고, 못 지키면 이유와 함께 그대로 보고합니다.</p></section>'
  ];
 }
 function onePage(x){
  const c=cover(x),g=goods(x),a=ask(x),pr=promises(x),today=new Date();
  return '<article class="rp-page"><header><div><h2>넷폼 영업 보고 · '+h(x.P.cur.long)+'</h2><span>'+today.getFullYear()+'. '+(today.getMonth()+1)+'. '+today.getDate()+'. · 보고 '+h(root.ME&&root.ME.name||'')+'</span></div><img src="netform-logo.png" alt="넷폼" height="22"></header>'
   +'<div class="rp-concl">'+T('cover',c.lead,'b')+'<span>'+T('coverRisk',c.risk)+'</span></div>'
   +'<div class="rp-goods small">'+g.map(v=>'<div><small>'+h(v[0])+'</small><b>'+h(v[1])+'</b><span>'+h(v[2])+'</span></div>').join('')+'</div>'
   +'<div class="rp-cols"><div><h3>담당자별</h3>'+peopleHtml(x,true)+'<p class="rp-note">'+T('people',peopleNote(x))+'</p></div><div><h3>'+h(x.P.prev.label)+'과 비교</h3>'+cmpHtml(x)+'</div></div>'
   +'<div class="rp-cols"><div><h3>대표님께 부탁드릴 것</h3>'+(a?'<div class="rp-askmini">'+T('ask',a.title,'b')+'<span>'+T('askWhy',a.why)+'</span></div>':'<p class="rp-none">부탁드릴 일이 없습니다</p>')+'</div><div><h3>'+h(x.P.unit)+' 행동 약속</h3>'+promiseHtml(pr)+'</div></div></article>';
 }
 function html(x){
  const S=st(),seg=(k,list,cur)=>'<div class="rp-seg" role="group">'+list.map(([v,t])=>'<button type="button" data-rp="'+k+'" data-value="'+v+'" aria-pressed="'+(cur===v)+'">'+t+'</button>').join('')+'</div>',d=new Date();
  const bar='<div class="rp-toolbar">'+seg('mode',[['month','월간'],['quarter','분기'],['year','연간']],S.mode)+'<span class="rp-auto">자동 취합 · '+(d.getMonth()+1)+'월 '+d.getDate()+'일</span><div class="plv-spacer"></div>'+seg('view',[['slides','슬라이드'],['page','한 페이지']],S.view)
   +'<button type="button" class="rp-btn'+(S.edit?' on':'')+'" data-rp="edit" aria-pressed="'+S.edit+'">'+(S.edit?'편집 끝내기':'편집')+'</button><button type="button" class="rp-btn" data-rp="detail" aria-pressed="'+S.detail+'">'+(S.detail?'상세 표 접기':'상세 표 보기')+'</button>'+(root.OpsStore&&root.OpsStore.aiOn()&&root.OpsStore.admin()?'<button type="button" class="rp-btn" data-rp="ai"'+(STORE.aiBusy?' disabled':'')+'>'+(STORE.aiBusy?'AI가 쓰는 중…':'✦ AI 문장 받기')+'</button>':'')+(STORE.state==='ready'&&root.OpsStore.admin()?'<button type="button" class="rp-btn" data-rp="snapshot">'+(snapOf(x.P.key)?'이 보고 다시 저장':'이 보고 저장')+'</button>':'')+'<button type="button" class="rp-btn" data-rp="pdf">PDF로 저장</button><button type="button" class="rp-btn pri" disabled title="잔디 발송 연결 뒤에 켜집니다">대표님께 보내기</button></div>'
   +(S.edit?'<p class="rp-editnote">문장을 눌러 바로 고칠 수 있습니다. 고친 문장은 PDF에 그대로 들어가지만 저장되지는 않습니다 — 이 화면을 새로 열면 처음 문장으로 돌아갑니다.</p>':'');
  if(S.view==='page')return bar+onePage(x);
  const L=slides(x);
  return bar+'<div class="rp-deck" data-i="'+S.i+'">'+L.map((s,i)=>s.replace('class="rp-slide','data-slide="'+i+'" aria-label="'+attr((i+1)+' / '+N+' · '+TITLES[i])+'"'+(i===S.i?'':' aria-hidden="true"')+' class="rp-slide'+(i===S.i?' on':''))).join('')+'<div class="rp-progress"><i style="width:'+Math.round((S.i+1)*100/N)+'%"></i></div></div>'
   +'<nav class="rp-nav" aria-label="슬라이드 넘기기"><button type="button" data-rp="prev" aria-label="이전 장"'+(S.i?'':' disabled')+'>‹</button><div>'+L.map((s,i)=>'<button type="button" class="rp-dot'+(i===S.i?' on':'')+'" data-rp="go" data-value="'+i+'" aria-label="'+attr((i+1)+'장 '+TITLES[i])+'"></button>').join('')+'</div><button type="button" data-rp="next" aria-label="다음 장"'+(S.i<N-1?'':' disabled')+'>›</button><span>'+(S.i+1)+' / '+N+' · '+h(TITLES[S.i])+' · ← → 키로 넘기기</span></nav>';
 }
 function host(){
  const pg=document.getElementById('pg-report'),master=document.getElementById('report-master');if(!pg||!master)return null;
  let el=document.getElementById('report-v2');if(!el){el=document.createElement('div');el.id='report-v2';el.className='rp';master.before(el);el.addEventListener('click',onClick);el.addEventListener('input',e=>{const t=e.target.closest('.rp-t');if(t)st().edits[t.dataset.key]=t.textContent;});}
  return el;
 }
 function render(){const el=host();if(!el)return;el.hidden=false;const x=data();loadStore(x.P.kind);el.innerHTML=html(x);const m=document.getElementById('report-master');if(m)m.hidden=!st().detail;}
 function go(i){const S=st();S.i=Math.max(0,Math.min(N-1,i));render();}
 function pdf(){
  const S=st();document.getElementById('rpPrint')?.remove();const s=document.createElement('style');s.id='rpPrint';s.textContent='@page{size:'+(S.view==='page'?'A4 portrait':'A4 landscape')+';margin:'+(S.view==='page'?'10mm':'0')+'}';document.head.append(s);
  document.body.classList.add('rp-printing');const done=()=>{document.body.classList.remove('rp-printing');window.removeEventListener('afterprint',done);};window.addEventListener('afterprint',done);
  window.print();setTimeout(done,1500);
 }
 function onClick(e){
  const b=e.target.closest('[data-rp]');if(!b||b.disabled)return;const S=st(),a=b.dataset.rp,v=b.dataset.value;
  if(a==='mode'){S.mode=v;return render();}
  if(a==='view'){S.view=v;return render();}
  if(a==='edit'){S.edit=!S.edit;return render();}
  if(a==='detail'){S.detail=!S.detail;render();if(S.detail)document.getElementById('report-master')?.scrollIntoView({behavior:'smooth',block:'start'});return;}
  if(a==='pdf')return pdf();
  if(a==='snapshot')return saveSnapshot(b);
  if(a==='ai')return aiText();
  if(a==='answer')return saveResponse(v);
  if(a==='prev')return go(S.i-1);if(a==='next')return go(S.i+1);if(a==='go')return go(Number(v));
 }
 function boot(){
  const base=root.paintReport;if(typeof base!=='function')return;
  root.paintReport=function(){
   const r=base.apply(this,arguments),el=document.getElementById('report-v2'),m=document.getElementById('report-master');
   if(!enabled()){if(el)el.hidden=true;if(m)m.hidden=false;return r;}
   try{render();}catch(e){console.warn('[리포트 v2]',e);if(el)el.hidden=true;if(m)m.hidden=false;}
   return r;
  };
  /* ← → 키로 넘기기: 리포트 슬라이드 보기에서, 입력 중이거나 창이 떠 있지 않을 때만 */
  document.addEventListener('keydown',e=>{
   if(e.key!=='ArrowLeft'&&e.key!=='ArrowRight')return;if(!enabled()||root.G.page!=='report'||st().view!=='slides'||e.ctrlKey||e.metaKey||e.altKey)return;
   const t=e.target;if(t&&(t.isContentEditable||/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)))return;
   if(document.querySelector('.modal.on,#detailView.on,#askDialog.on,#reportDrill.on,.sd-layer.on,.wd-layer.on,.rd-layer.on,.it-layer'))return;
   e.preventDefault();go(st().i+(e.key==='ArrowRight'?1:-1));
  });
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
 root.ReportV2={enabled,data,go};
})(window);
