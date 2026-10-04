/* 관리팀 KPI (2026-10-03 디자인 핸드오프 'design_handoff_kpi') — 관리팀 KPI 메뉴만. 보는 사람: 영업관리 한 명. 측정 + 할 일을 한 화면에서.
   제목 한 줄 → 왼쪽 KPI 표 8줄(이번 주 · 지난주 ▲▼ · 4주 추이 · 목표 · 내 조치) / 오른쪽 선택 지표 패널(장기 추이 12주·6개월·1년 · 조치한 주 점 · 내가 할 일) → 아래 담당별(선택 지표 기준 · 측정 불가 묶음).
   ■ '내가 할 일'은 따로 만들지 않는다 — 견적문의(managementStats 미배정 · 무응답)와 파이프라인 단계별 B안의 '관리자 할 일' 사유(PipelineStageB.model → rs)를 그대로 쓴다. 어느 화면에서 처리해도 양쪽이 같이 줄어든다.
   ■ [요청] = kpi_actions 기록(crm_kpi_action_log_v1) + 담당자의 이번 주 관리자 한마디(rep_manager_comment, 기존 저장 경로)에 한 줄 추가 → 담당자 오늘 업무(모바일 '관리자 한마디')에 뜬다.
     8번 '관리팀 조치 → 처리율' = 최근 28일 요청 중 그 대상이 지금 할 일 목록에서 사라진 것(처리됨) ÷ 요청.
   ■ 주간 저장: kpi_weekly(promise_key 'kpi:n')에 [이번 주 결과 저장] 또는 금요일 18시 이후 처음 열 때 자동 저장(관리자, 주 1회). 지난주 · 4주 · 장기 추이는 이 값. 조치 점은 kpi_actions 의 주.
   ■ 기록이 없는 사람은 0%가 아니라 '측정 불가'. 색: 빨강 = 목표 미달, 화살표 초록/빨강 = 변화 방향. 브랜드 색 없음.
   끄기: G.kpiBOff=true → 관리팀 KPI v2. */
(function(root){
 'use strict';
 const h=v=>root.esc(String(v==null?'':v)),attr=v=>root.escAttr(String(v==null?'':v));
 const RED='#d93a3a',INK='#15171c',GREEN='#1f7a4d',GRAY='#9ca3af',BAR='#d5d9e0';
 const enabled=()=>!root.G.kpiBOff&&!root.G.kpiV2Off;
 const O=()=>root.OpsStore;
 const pct=(a,b)=>b?Math.round(a*1000/b)/10:null;
 const fmt=v=>v==null?'–':(Math.round(v*10)/10)+'%';
 const names=()=>(root.PERFORMANCE_TARGET_NAMES||[]).slice();
 const ymd=v=>String(v||'').slice(0,10),md=v=>{const s=ymd(v);return s?Number(s.slice(5,7))+'/'+Number(s.slice(8,10)):'';};
 const ageDays=v=>{const t=Date.parse(v||'');return Number.isFinite(t)?Math.max(0,Math.floor((Date.now()-t)/864e5)):null;};
 const money=v=>{const n=Number(v)||0;if(!n)return '';if(n>=1e8)return (Math.round(n/1e7)/10)+'억';if(n>=1e4)return Math.round(n/1e4).toLocaleString('ko-KR')+'만';return n.toLocaleString('ko-KR');};
 const ST=()=>root.G.kb||(root.G.kb={sel:0,rg:'12w',more:false});
 /* 지표 정의: [이름, 연결 단계 키(파이프라인), 연결 단계 글자, 계산 기준, 목표, 낮을수록 좋음, 올리는 방법] */
 const DEF=[
  ['당일 배정률','inquiry','견적문의','접수 당일 담당 지정 ÷ 접수',95,false,'미배정 견적문의를 오늘 담당 지정. 오래 기다린 순.'],
  ['2시간 첫 연락','inquiry','견적문의','배정 후 2시간 안 첫 연락 기록 ÷ 배정',90,false,'배정됐는데 첫 연락이 없는 건을 담당에게 바로 요청.'],
  ['다음 할 일 등록률','all','전 단계','다음 할 일 + 날짜 있는 진행 건 ÷ 진행 건',95,false,'다음 할 일이 빈 건이 많은 담당부터 등록 요청.'],
  ['활동 기록률','all','전 단계','7일 안 응대 기록 있는 진행 건 ÷ 진행 건',70,false,'통화하면 결과를 남기게 — 기록이 없으면 다른 지표도 측정이 안 됩니다.'],
  ['장기정체 비율','consulting','컨설팅 설계 · 관계관리','같은 단계 30일 이상 ÷ 진행 건',10,true,'큰 금액부터 담당과 상황 확인 → 보류 · 실주 판단.'],
  ['방문 후 3일 견적','consulting','컨설팅 설계','1차 미팅 후 3일 안 견적 요청 ÷ 미팅 완료 건',80,false,'미팅은 했는데 견적 요청이 없는 건 — 견적 요청 등록 확인.'],
  ['실주 사유 입력','lost','실주','사유 · 낙찰사 입력된 실주 ÷ 실주 건',100,false,'사유 없는 실주는 다음 영업에 쓸 수 없음 — 사유 입력 요청.'],
  ['관리팀 조치 → 처리율','mgmt','관리팀','최근 28일 요청 중 담당이 처리한 것 ÷ 요청',80,false,'요청만 하고 끝내지 않기 — 답이 없는 요청을 다시 확인.']];
 const KEY=i=>'kpi:'+(i+1);
 /* ── 저장소: 주간 결과(최대 52주) · 조치 기록(최근 200) ── */
 const W={state:'idle',rows:[],acts:[],actState:'idle',saved:false};
 function load(force){
  const o=O();if(!o)return;
  if(o.has('crm_kpi_weekly_list_v1')&&(W.state==='idle'||(force&&W.state!=='loading'))){W.state='loading';o.rpc('crm_kpi_weekly_list_v1',{weeks:52}).then(r=>{W.rows=(r.rows||[]).filter(x=>/^kpi:\d$/.test(String(x.promise_key)));W.state='ready';repaint();}).catch(e=>{W.state=e&&e.unavailable?'off':'failed';repaint();});}
  if(o.has('crm_kpi_action_list_v1')&&(W.actState==='idle'||(force&&W.actState!=='loading'))){W.actState='loading';o.rpc('crm_kpi_action_list_v1',{limit:200}).then(r=>{W.acts=(r.actions||[]).filter(x=>/^kpi:\d$/.test(String(x.promise_key)));W.actState='ready';repaint();}).catch(()=>{W.actState='failed';});}
 }
 const repaint=()=>{if(root.G.page==='mgmt')try{root.paintMgmt();}catch(e){}};
 const weekRow=(i,offset)=>{const o=O();if(!o)return null;const wk=o.monday(offset);return W.rows.find(x=>ymd(x.week_start)===wk&&x.promise_key===KEY(i))||null;};
 const rateOf=r=>r?pct(r.numerator,r.denominator):null;
 /* ── 파이프라인 단계별 '관리자 할 일'(B안 사유) — 같은 데이터 ── */
 function stageItems(){
  const P=root.PipelineStageB,out=[];if(!P||!root.PipelineWorkspace)return out;
  let rows=[];try{rows=root.PipelineWorkspace.rows();}catch(e){rows=[];}
  Object.keys(P.CFG).forEach(key=>{const list=rows.filter(r=>r.group===key);if(!list.length)return;try{P.model(key,list).items.forEach(it=>out.push(Object.assign({stage:key},it)));}catch(e){}});
  return out;
 }
 const todoKey=(kind,id)=>kind+':'+id;
 /* ── 지표 8개 + 할 일(실제 데이터) ── */
 function compute(){
  const S=root.managementStats(root.targetNameFilter()),items=stageItems(),rk=root.RecordingKPI?root.RecordingKPI.stats('전체',0):{deals:0,activeN:0,activity:null};
  const who=d=>root.repN(d.assignee)||'미배정',inqOwner=q=>root.repN(root.inquiryRoutedOwner?.(q)||q.assignee)||'미배정';
  const T=(kind,id,what,whoTxt,why,label,owner)=>({kind,id:String(id),what,who:whoTxt,why,label,owner:owner||'',tk:todoKey(kind,id)});
  const byOwner=(list,f)=>{const m=new Map();list.forEach(x=>{const o=f(x);m.set(o,(m.get(o)||0)+1);});return [...m].sort((a,b)=>b[1]-a[1]);};
  const open=items.filter(it=>!['won','lost'].includes(it.stage));
  const M=[];
  /* 1 당일 배정 */
  M.push({v:S.assignRate,num:(S.sameDayAssigned||[]).length,den:S.Q.length,todos:S.unassigned.slice().sort((a,b)=>(ageDays(root.inquiryCreatedAt(b))||0)-(ageDays(root.inquiryCreatedAt(a))||0)).map(q=>{const n=ageDays(root.inquiryCreatedAt(q));return T('inq',root.inqKey(q),q.site||'현장명 미입력','미배정',n==null?'접수일 미기록':n===0?'오늘 접수':n+'일째 미배정','담당 정하기');})});
  /* 2 첫 연락 */
  const assigned=S.Q.filter(root.inquiryAssigned);
  M.push({v:S.responseRate,num:(S.responseSla||[]).length,den:assigned.length,todos:S.noResponse.slice().sort((a,b)=>(ageDays(root.inquiryAssignedAt(b))||0)-(ageDays(root.inquiryAssignedAt(a))||0)).map(q=>{const n=ageDays(root.inquiryAssignedAt(q)||root.inquiryCreatedAt(q)),o=inqOwner(q);return T('inq',root.inqKey(q),q.site||'현장명 미입력',o,(n!=null&&n>0?n+'일째 ':'')+'첫 연락 기록 없음',n!=null&&n>=30?'재배정 검토':'담당에게 요청',o);})});
  /* 3 다음 할 일(전 단계) — B안 'nonext' 사유와 같은 건 */
  const nonext=open.filter(it=>it.rs.includes('nonext')),nextMissing=nonext.length?nonext.map(it=>it.row.item):S.nextMissing;
  M.push({v:pct(S.D.length-S.nextMissing.length,S.D.length),num:S.D.length-S.nextMissing.length,den:S.D.length,todos:byOwner(nextMissing,who).map(([o,n])=>T('rep',o,o,n+'건','다음 할 일 없음 '+n+'건','등록 요청',o))});
  /* 4 활동 기록률 */
  const low=names().map(n=>({n,s:root.RecordingKPI?root.RecordingKPI.stats(n,0):{activity:null,deals:0}})).filter(x=>x.s.deals>0&&(x.s.activity==null||x.s.activity<70)).sort((a,b)=>(a.s.activity??-1)-(b.s.activity??-1));
  M.push({v:rk.activity,num:rk.activeN||0,den:rk.deals||0,todos:low.map(x=>T('rep',x.n,x.n,x.s.deals+'건',x.s.activity==null?'기록 없음 · 측정 불가':'7일 기록 '+x.s.activity+'%','기록 요청',x.n))});
  /* 5 장기정체(컨설팅 · 관계관리) — B안 'long' · 'shift' + 30일 체류 */
  const cr=open.filter(it=>it.stage==='consulting'||it.stage==='relationship'),stale=cr.filter(it=>it.rs.includes('long')||it.rs.includes('shift')||(it.stall||0)>=30);
  M.push({v:pct(stale.length,cr.length),num:stale.length,den:cr.length,todos:stale.slice().sort((a,b)=>(Number(b.row.amount)||0)-(Number(a.row.amount)||0)).map(it=>{const r=it.row,amt=money(r.amount),kc=root.DealKeyman?root.DealKeyman.changeOf(r.item):null;return T('deal',r.key,r.site,r.owner||'미배정',[amt,(it.stall||0)+'일 정체',kc?'소장 변경':'',it.row.contactDays!=null?it.row.contactDays+'일 무응답':''].filter(Boolean).join(' · '),(it.stall||0)>=60?'보류 판단':'상황 확인',r.owner);})});
  /* 6 방문 후 3일 견적 — 컨설팅 B안 '미팅 완료 · 견적 준비' 칸, 'nodue' 사유 */
  const met=open.filter(it=>it.stage==='consulting'&&it.bucket==='done'),late=met.filter(it=>it.rs.includes('nodue'));
  M.push({v:pct(met.length-late.length,met.length),num:met.length-late.length,den:met.length,todos:late.map(it=>{const r=it.row;return T('deal',r.key,r.site,r.owner||'미배정',(r.due?'미팅 '+md(r.due)+' · ':'')+'견적 요청 없음 · '+(it.stall||0)+'일','견적 요청 확인',r.owner);})});
  /* 7 실주 사유 — B안 실주 'noreason' · 'nobid' */
  const lost=items.filter(it=>it.stage==='lost'),noR=lost.filter(it=>it.rs.includes('noreason')||it.rs.includes('nobid'));
  M.push({v:pct(lost.length-noR.length,lost.length),num:lost.length-noR.length,den:lost.length,todos:noR.map(it=>{const r=it.row;return T('deal',r.key,r.site,r.owner||'미배정',it.rs.includes('noreason')?'실주 사유 없음':'낙찰사 · 금액 미기록','사유 요청',r.owner);})});
  /* 8 관리팀 조치 → 처리율: 최근 28일 요청, 대상이 지금 할 일 목록에 없으면 처리됨 */
  const now=Date.now(),recent=W.acts.filter(a=>a.promise_key!=='kpi:8'&&now-Date.parse(a.created_at||0)<28*864e5&&a.target_id);
  const live=new Set();M.forEach((m,i)=>m.todos.forEach(t=>live.add(KEY(i)+'|'+t.tk)));
  const seen=new Set(),uniq=recent.filter(a=>{const k=a.promise_key+'|'+a.target_type+':'+a.target_id;if(seen.has(k))return false;seen.add(k);return true;});
  const typeKind=t=>t==='inquiry'?'inq':t==='deal'?'deal':'rep';
  const processed=uniq.filter(a=>!live.has(a.promise_key+'|'+todoKey(typeKind(a.target_type),a.target_id)));
  const pending=uniq.filter(a=>live.has(a.promise_key+'|'+todoKind(a))&&now-Date.parse(a.created_at)>=864e5);
  function todoKind(a){return todoKey(typeKind(a.target_type),a.target_id);}
  M.push({v:pct(processed.length,uniq.length),num:processed.length,den:uniq.length,todos:pending.map(a=>{const i=Number(String(a.promise_key).slice(4))-1;const t=(M[i]&&M[i].todos.find(x=>x.tk===todoKind(a)))||null;return Object.assign(T(typeKind(a.target_type),a.target_id,a.target_name||a.target_id,t?t.who:'',md(a.created_at)+' 요청 · '+(t?t.why:'답 없음'),'다시 확인',t?t.owner:''),{origin:i});})});
  /* 요청함 표시: 이번 주 조치 기록(서버) + 방금 누른 것(이 PC) */
  const mon=O()?O().monday(0):'',done=new Set(W.acts.filter(a=>ymd(a.created_at)>=mon&&a.target_id).map(a=>a.promise_key+'|'+todoKey(typeKind(a.target_type),a.target_id)));
  (root.G.kbDone||[]).forEach(k=>done.add(k));
  M.forEach((m,i)=>{m.i=i;m.def=DEF[i];m.key=KEY(i);m.todos.forEach(t=>{t.done=done.has(m.key+'|'+t.tk);});m.left=m.todos.filter(t=>!t.done).length;m.ok=m.v!=null&&(m.def[5]?m.v<=m.def[4]:m.v>=m.def[4]);
   m.last=rateOf(weekRow(i,-1));const tr=[-3,-2,-1].map(o=>rateOf(weekRow(i,o)));tr.push(m.v);m.trend=tr;});
  return {S,M,items};
 }
 /* ── 그리기 ── */
 function trendTxt(m){
  const tr=m.trend,lower=m.def[5];let d=[];for(let j=1;j<tr.length;j++){if(tr[j]==null||tr[j-1]==null){d.push(null);continue;}d.push(lower?tr[j-1]-tr[j]:tr[j]-tr[j-1]);}
  const last=d[d.length-1];if(last==null)return {t:'기록 쌓는 중',c:GRAY};const sgn=Math.sign(last);if(!sgn)return {t:'변화 없음',c:GRAY};
  let n=0;for(let j=d.length-1;j>=0&&d[j]!=null&&Math.sign(d[j])===sgn;j--)n++;
  return {t:(n>=2?(n+1)+'주째 ':'')+(sgn>0?'개선':'악화'),c:sgn>0?GREEN:RED};
 }
 function tableHtml(C){
  const S=ST();
  const rows=C.M.map(m=>{
   const on=S.sel===m.i,vals=m.trend.filter(x=>x!=null),mx=Math.max(...(vals.length?vals:[0]),m.def[4],1),tt=trendTxt(m);
   const bars=m.trend.map((x,j)=>'<i style="height:'+(x==null?2:Math.max(3,Math.round(x/mx*22)))+'px;background:'+(j===3?(m.ok?INK:RED):x==null?'#eef0f3':BAR)+'"></i>').join('');
   const arrow=m.last==null||m.v==null||m.v===m.last?'':(m.v>m.last?'▲':'▼'),better=m.last!=null&&m.v!=null&&(m.def[5]?m.v<m.last:m.v>m.last);
   return '<div class="kb-row'+(on?' on':'')+'" role="row" tabindex="0" data-kb="pick" data-i="'+m.i+'" aria-selected="'+on+'"><div class="l"><b>'+(m.i+1)+'. '+h(m.def[0])+'</b><span>'+h(m.def[2])+' · '+h(m.def[3])+'</span></div><div class="r"><b class="v" style="color:'+(m.v==null?GRAY:m.ok?INK:RED)+'">'+h(fmt(m.v))+'</b><span class="last">'+h(fmt(m.last))+' <em style="color:'+(better?GREEN:RED)+'">'+arrow+'</em></span><span class="tr"><span class="kb-bars">'+bars+'</span><small style="color:'+tt.c+'">'+h(tt.t)+'</small></span><span class="tg">'+(m.def[5]?'≤':'')+m.def[4]+'%</span><span class="todo" style="color:'+(m.left?INK:GRAY)+'">'+(m.todos.length?(m.left?m.left+'건 남음':'완료'):'없음')+'</span></div></div>';
  }).join('');
  return '<section class="kb-table"><div class="kb-thead"><span class="l">지표 · 연결 단계</span><div class="r"><span class="v">이번 주</span><span class="last">지난주</span><span class="tr">4주 추이</span><span class="tg">목표</span><span class="todo">내 조치</span></div></div>'+rows+'<p class="kb-foot">빨간 숫자 = 목표 미달 · 줄을 누르면 오른쪽에 그 지표를 올리는 할 일이 나옵니다 · 지난주 · 4주 추이는 주간 저장 값'+(W.state==='ready'?'':W.state==='off'?' (저장소 미설치)':' (불러오는 중)')+'</p></section>';
 }
 function chartHtml(m){
  const S=ST(),o=O(),RG=[['12w','12주',12],['6m','6개월',26],['1y','1년',52]],N=RG.find(x=>x[0]===S.rg)[2];
  const series=[];for(let j=N-1;j>=1;j--)series.push({wk:o?o.monday(-j):'',v:rateOf(weekRow(m.i,-j))});series.push({wk:o?o.monday(0):'',v:m.v});
  const actWeeks=new Set(W.acts.filter(a=>a.promise_key===m.key||(m.i===7)).map(a=>{const d=new Date(a.created_at);d.setHours(0,0,0,0);d.setDate(d.getDate()-((d.getDay()+6)%7));return d.toLocaleDateString('en-CA');}));
  const vals=series.map(s=>s.v).filter(x=>x!=null),mx=Math.max(...(vals.length?vals:[0]),m.def[4],1)*1.08;
  const bars=series.map((s,j)=>'<i style="height:'+(s.v==null?2:Math.max(2,Math.round(s.v/mx*74)))+'px;background:'+(j===N-1?(m.ok?INK:RED):s.v==null?'#f0f1f4':BAR)+'" title="'+attr(s.wk+(s.v==null?' · 저장 없음':' · '+fmt(s.v)))+'">'+(actWeeks.has(s.wk)?'<u></u>':'')+'</i>').join('');
  const first=series.find(s=>s.v!=null),lastS=series[series.length-1],savedN=vals.length-(m.v==null?0:1);
  const note=first&&first!==lastS&&lastS.v!=null?RG.find(x=>x[0]===S.rg)[1]+' 전 '+fmt(first.v)+' → 지금 '+fmt(lastS.v)+' · '+((m.def[5]?lastS.v<first.v:lastS.v>first.v)?'개선':first.v===lastS.v?'변화 없음':'악화'):(savedN?'저장된 주 '+savedN:'아직 저장된 주가 없어 이번 주만 보입니다');
  return '<div class="kb-chart"><div class="kb-chhead"><b>장기 추이</b><i></i>'+RG.map(([k,l])=>'<button type="button" data-kb="rg" data-v="'+k+'" aria-pressed="'+(S.rg===k)+'">'+l+'</button>').join('')+'</div><div class="kb-plot" style="--gap:'+(N>26?'1px':N>12?'2px':'4px')+'"><s style="bottom:'+Math.round(m.def[4]/mx*74)+'px"></s><em style="bottom:'+Math.round(m.def[4]/mx*74)+'px">목표 '+(m.def[5]?'≤':'')+m.def[4]+'%</em>'+bars+'</div><div class="kb-axis"><span>'+RG.find(x=>x[0]===S.rg)[1]+' 전</span><span>이번 주</span></div><div class="kb-legend"><span><u></u>관리팀 조치한 주</span><span>'+h(note)+'</span></div></div>';
 }
 function panelHtml(C){
  const m=C.M[ST().sel],stageKey=m.def[1],go=stageKey==='inquiry'?'<a href="#" data-kb="go" data-v="inquiry">견적문의로 이동 →</a>':stageKey==='mgmt'?'':'<a href="#" data-kb="go" data-v="'+(stageKey==='all'?'consulting':stageKey)+'">단계로 이동 →</a>';
  const todos=m.todos.map(t=>'<div class="kb-todo'+(t.done?' done':'')+'"><div class="t" data-kb="open" data-kind="'+t.kind+'" data-id="'+attr(t.id)+'" data-i="'+(t.origin!=null?t.origin:m.i)+'" role="button" tabindex="0"><b>'+h(t.what)+'</b><span style="color:'+(t.done?GRAY:RED)+'">'+h([t.who,t.why].filter(Boolean).join(' · '))+'</span></div><button type="button" data-kb="req" data-i="'+m.i+'" data-kind="'+t.kind+'" data-id="'+attr(t.id)+'" data-owner="'+attr(t.owner)+'" data-label="'+attr(t.label)+'" data-name="'+attr(t.what)+'" data-why="'+attr(t.why)+'"'+(t.done?' class="done" disabled':'')+'>'+h(t.done?(m.i===7?'확인함':'요청함'):t.label)+'</button></div>').join('');
  return '<aside class="kb-panel"><div class="kb-sel"><span>'+(m.i+1)+'번 지표를 올리려면</span><b>'+h(m.def[0])+' <em style="color:'+(m.v==null?GRAY:m.ok?INK:RED)+'">'+h(fmt(m.v))+'</em> <small>→ 목표 '+(m.def[5]?'≤':'')+m.def[4]+'%</small></b><p>'+h(m.def[6])+'</p></div>'+chartHtml(m)
   +'<div class="kb-link"><span>'+(stageKey==='mgmt'?'관리팀 요청 기록(kpi_actions) 기준':'파이프라인 · <b>'+h(m.def[2])+'</b> 의 \'관리자 할 일\'과 같은 목록')+'</span>'+go+'</div>'
   +'<div class="kb-todohead"><b>내가 할 일</b><span>'+m.left+'건 남음 · '+(m.todos.length-m.left)+'건 조치함</span></div>'+(m.todos.length?'<div class="kb-todos">'+todos+'</div>':'<p class="kb-empty">이 지표에 남은 할 일이 없습니다.</p>')
   +'<small class="kb-note">조치하면 담당자 오늘 업무(관리자 한마디)에 요청이 뜨고, 담당자가 처리하면 8번 \'관리팀 조치 → 처리율\'에 반영됩니다.</small></aside>';
 }
 /* ── 담당별(선택 지표 기준) ── */
 const LBL=['당일 배정','2시간 첫 연락','다음 할 일','활동 기록','장기정체','3일 견적','실주 사유'];
 function personVals(n,C){
  const x=root.managementStats(n),rk=root.RecordingKPI?root.RecordingKPI.stats(n,0):{activity:null,deals:0};
  const mine=C.items.filter(it=>it.row.owner===n),open=mine.filter(it=>!['won','lost'].includes(it.stage)),cr=open.filter(it=>it.stage==='consulting'||it.stage==='relationship'),met=open.filter(it=>it.stage==='consulting'&&it.bucket==='done'),lost=mine.filter(it=>it.stage==='lost');
  const measured=(x.D.length+x.Q.length)>0&&(rk.activity!=null||x.Q.length>0);
  if(!measured)return {n,measured:false};
  return {n,measured:true,vals:[x.assignRate,x.responseRate,pct(x.D.length-x.nextMissing.length,x.D.length),rk.activity,pct(cr.filter(it=>it.rs.includes('long')||it.rs.includes('shift')||(it.stall||0)>=30).length,cr.length),pct(met.length-met.filter(it=>it.rs.includes('nodue')).length,met.length),pct(lost.length-lost.filter(it=>it.rs.includes('noreason')||it.rs.includes('nobid')).length,lost.length)]};
 }
 function peopleHtml(C){
  const S=ST(),col=S.sel<7?S.sel:3,P=names().map(n=>personVals(n,C)),measured=P.filter(p=>p.measured),nm=P.filter(p=>!p.measured);
  const rows=measured.map(p=>{const bad=p.vals.map((v,c)=>({c,v,gap:v==null?0:(DEF[c][5]?v-DEF[c][4]:DEF[c][4]-v)})).filter(x=>x.gap>0).sort((a,b)=>b.gap-a.gap);const v=p.vals[col],tg=DEF[col][4],lower=DEF[col][5],ok=v==null?null:(lower?v<=tg:v>=tg);return Object.assign(p,{bad,v,ok,sortKey:v==null?999:(lower?-v:v)});}).sort((a,b)=>a.sortKey-b.sortKey);
  const SHOW=5,shown=S.more?rows:rows.slice(0,SHOW);
  const line=p=>'<div class="kb-person"><div class="who"><b>'+h(p.n)+'</b><span>'+h((()=>{try{const pr=root.repProfile(p.n);return pr.team==='gyeongnam'?'경남지사':'본사 영업';}catch(e){return '본사 영업';}})())+'</span></div><div class="bar"><span><i style="width:'+(p.v==null?0:Math.min(100,p.v))+'%;background:'+(p.ok===false?RED:INK)+'"></i><u style="left:'+Math.min(99,DEF[col][4])+'%"></u></span><b style="color:'+(p.v==null?GRAY:p.ok?INK:RED)+'">'+h(fmt(p.v))+'</b></div><div class="bad"><span>미달 '+p.bad.length+'/7</span>'+p.bad.slice(0,2).map(b=>'<em>'+h(LBL[b.c])+' '+h(fmt(b.v))+'</em>').join('')+'</div><button type="button" data-kb="ask" data-n="'+attr(p.n)+'">요청 보내기</button></div>';
  const sent=!!(root.G.kbNmSent&&root.G.kbNmSent===O()?.monday(0));
  return '<section class="kb-people"><header><b>담당별 · '+h(LBL[col])+' 기준</b><span>위에서 고른 지표로 정렬 · 못 미친 지표는 많은 것 2개만</span><i></i><span>미달 <b style="color:'+RED+'">'+rows.filter(r=>r.ok===false).length+'</b>명 · 전체 '+P.length+'명</span></header>'+(shown.length?shown.map(line).join(''):'<p class="kb-empty">측정 가능한 담당이 없습니다.</p>')
   +(rows.length>SHOW?'<button type="button" class="kb-more" data-kb="more">'+(S.more?'접기':'나머지 '+(rows.length-SHOW)+'명 더 보기')+'</button>':'')
   +(nm.length?'<div class="kb-nm"><b>측정 불가 '+nm.length+'명</b><span>'+h(nm.map(p=>p.n).join(' · '))+' · 기록이 없어 지표가 안 나옴</span><button type="button" data-kb="nm"'+(sent?' class="done" disabled':'')+'>'+(sent?'요청함':'한 번에 기록 시작 요청')+'</button></div>':'')+'</section>';
 }
 function html(){
  const C=compute(),hit=C.M.filter(m=>m.ok).length,total=C.M.reduce((a,m)=>a+m.todos.length,0),left=C.M.reduce((a,m)=>a+m.left,0),o=O(),mon=o?o.monday(0):'',savedThis=W.rows.some(x=>ymd(x.week_start)===mon),period=o?md(mon)+' – '+md(new Date(Date.parse(mon+'T00:00:00')+5*864e5).toLocaleDateString('en-CA')):'';
  const saveBtn=o&&o.admin()&&o.has('crm_kpi_weekly_save_v1')?'<button type="button" class="kb-save" data-kb="save"'+(W.saving?' disabled':'')+'>'+(W.saving?'저장 중…':savedThis?'이번 주 결과 다시 저장':'이번 주 결과 저장')+'</button>':'';
  return '<div id="kpi-b" class="kb" data-workspace="kpi"><div class="kb-title"><h1>지표 8개 중 목표 달성 <em style="color:'+(hit>=4?INK:RED)+'">'+hit+'개</em> · 이번 주 내 조치 <b>'+(total-left)+' / '+total+'</b></h1><span>'+h((root.ME&&root.ME.name)||'')+' · 이번 주 '+h(period)+' · 지표마다 연결된 파이프라인 단계의 \'관리자 할 일\'이 그대로 아래 목록이 됩니다. 처리하면 조치 수와 처리율이 바로 올라갑니다.</span><i></i>'+saveBtn+'</div><div class="kb-body">'+tableHtml(C)+panelHtml(C)+'</div>'+peopleHtml(C)+'</div>';
 }
 /* ── 요청: kpi_actions 기록 + 담당자 이번 주 관리자 한마디에 한 줄(기존 저장 경로) ── */
 function requestLine(ownerName,line){
  if(!ownerName||ownerName==='미배정'||!(root.REP_INTERNAL||[]).includes(ownerName))return false;
  try{
   const week=root.repManagerWeekKey(0),old=root.repManagerComment(ownerName,week),actor=(root.ME&&root.ME.name)||'관리자',at=root.isoNow(),text=((old&&old.comment)?old.comment.trim()+'\n':'')+'· [KPI 요청] '+line;
   const local=root.repManagerLocalComments().filter(x=>!(x.rep_name===ownerName&&x.week_start===week)),row={rep_name:ownerName,week_start:week,comment:text,status:'open',created_by:actor,updated_at:at};
   local.push(row);root.Phase1.storage.setItem(root.REP_MANAGER_COMMENT_KEY||'netform_crm_rep_manager_comments_v1',JSON.stringify(local));
   root.pushWrite('rep_manager_comment',{rep_name:ownerName,week_start:week,comment:text,status:'open',created_by:actor,updated_at:at});return true;
  }catch(e){return false;}
 }
 function request(b){
  const i=Number(b.dataset.i),kind=b.dataset.kind,id=b.dataset.id,owner=b.dataset.owner,label=b.dataset.label,name=b.dataset.name,why=b.dataset.why,o=O();
  const key=KEY(i)+'|'+todoKey(kind,id);root.G.kbDone=(root.G.kbDone||[]).concat(key);
  if(o&&o.has('crm_kpi_action_log_v1'))o.rpc('crm_kpi_action_log_v1',{promise_key:KEY(i),action:label,target_type:kind==='deal'?'deal':kind==='rep'?'person':'inquiry',target_id:String(id).slice(0,80),target_name:String(name).slice(0,200),note:String(why).slice(0,500)}).then(()=>load(true)).catch(()=>{});
  const to=kind==='rep'?id:owner,sent=requestLine(to,DEF[i][0]+' — '+name+(why?' ('+why+')':''));
  if(typeof root.toast==='function')root.toast(sent?to+' 오늘 업무에 요청을 남겼습니다':'요청을 기록했습니다'+(to&&to!=='미배정'?'':' (담당 없음 — 오늘 업무 전달은 배정 뒤)'));
  repaint();
 }
 function openTarget(kind,id){
  if(kind==='inq')return root.InquiryWorkbench.openFrom(id,'mgmt');
  if(kind==='deal'){const d=(root.B.deals||[]).find(x=>root.dealKey(x)===id||String(x.id)===id);if(d){root.G._detailPopup=true;root.drwDeal(JSON.stringify(d));}return;}
  if(kind==='rep'){if(root.RepsV2&&root.RepsV2.enabled()){root.RepsV2.open(id);return;}root.goPerfRep?.(id);}
 }
 function saveWeek(b){
  const o=O(),C=compute(),rows=C.M.filter(m=>m.den>0||m.v!=null).map(m=>({promise_key:m.key,numerator:Math.max(0,Math.min(m.num|0,m.den|0)),denominator:m.den|0})).filter(r=>r.denominator>0);
  if(!rows.length){if(typeof root.toast==='function')root.toast('저장할 지표가 없습니다(분모 0)','warn');return;}
  W.saving=true;if(b){b.disabled=true;b.textContent='저장 중…';}
  o.rpc('crm_kpi_weekly_save_v1',{week_start:o.monday(0),rows}).then(r=>{if(typeof root.toast==='function')root.toast('이번 주 지표 '+r.saved+'개를 저장했습니다');}).catch(e=>{if(typeof root.toast==='function')root.toast(String(e.message||e),'warn');}).finally(()=>{W.saving=false;load(true);});
 }
 /* 금요일 18시 이후 처음 열면 자동 저장(관리자 · 주 1회 · 이 PC 기준) */
 function autoSave(){
  const o=O();if(!o||!o.admin()||!o.has('crm_kpi_weekly_save_v1')||W.state!=='ready')return;
  const d=new Date();if(!(d.getDay()===5&&d.getHours()>=18)&&d.getDay()!==6&&d.getDay()!==0)return;
  const mon=o.monday(0);if(W.rows.some(x=>ymd(x.week_start)===mon))return;
  let flag='';try{flag=root.Phase1.storage.getItem('nf_kpi_autosave')||'';}catch(e){}if(flag===mon)return;
  try{root.Phase1.storage.setItem('nf_kpi_autosave',mon);}catch(e){}saveWeek(null);
 }
 function onClick(e){
  const b=e.target.closest('#kpi-b [data-kb]');if(!b)return;const a=b.dataset.kb,S=ST();
  if(a==='pick'){S.sel=Number(b.dataset.i);S.more=false;return repaint();}
  if(a==='rg'){S.rg=b.dataset.v;return repaint();}
  if(a==='more'){S.more=!S.more;return repaint();}
  if(a==='save')return saveWeek(b);
  if(a==='req')return request(b);
  if(a==='open')return openTarget(b.dataset.kind,b.dataset.id);
  if(a==='ask'){const n=b.dataset.n;if(root.RepsV2&&root.RepsV2.enabled()){root.RepsV2.open(n);setTimeout(()=>(document.querySelector('#repWindow.on [data-rw-f="promise"]')||document.querySelector('#repsDialog textarea'))?.focus(),80);}else root.goPerfRep?.(n);return;}
  if(a==='nm'){const C=compute();const nm=names().map(n=>personVals(n,C)).filter(p=>!p.measured);nm.forEach(p=>{requestLine(p.n,'기록 시작 — 통화 · 방문 결과와 다음 할 일을 CRM에 남겨 주세요');const o=O();if(o&&o.has('crm_kpi_action_log_v1'))o.rpc('crm_kpi_action_log_v1',{promise_key:KEY(3),action:'기록 시작 요청',target_type:'person',target_id:p.n,target_name:p.n}).catch(()=>{});});root.G.kbNmSent=O()?O().monday(0):'1';if(typeof root.toast==='function')root.toast(nm.length+'명에게 기록 시작 요청을 남겼습니다');return repaint();}
  if(a==='go'){e.preventDefault();const v=b.dataset.v;if(v==='inquiry')root.goPage('inq');else root.PipelineWorkspace.open(v);return;}
 }
 function boot(){
  const base=root.paintMgmt;if(typeof base!=='function'||base.__kb)return;
  const wrapped=function(){
   const host=document.getElementById('mgmt-root');
   if(!enabled()||!host)return base.apply(this,arguments);
   try{load();host.innerHTML=html();host.querySelectorAll('.rk-panel').forEach(n=>n.remove());if(!host.__kb){host.__kb=true;host.addEventListener('click',onClick);host.addEventListener('keydown',e=>{if((e.key==='Enter'||e.key===' ')&&e.target.matches&&e.target.matches('#kpi-b [data-kb="pick"],#kpi-b [data-kb="open"]')){e.preventDefault();e.target.click();}});}
    if(root.G.page==='mgmt'){const t=document.getElementById('ptitle'),p=document.getElementById('psub');if(t)t.textContent='관리팀 KPI';if(p)p.textContent='측정 + 할 일을 한 화면에서 — 지표 8개 · 연결 단계의 관리자 할 일 · 담당별';}
    document.getElementById('pg-mgmt')?.classList.add('kb-on');autoSave();
   }catch(e){console.warn('[관리팀 KPI B]',e);return base.apply(this,arguments);}
  };
  wrapped.__kb=true;root.paintMgmt=wrapped;
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
 root.KpiB={enabled,compute,DEF,stageItems};
})(window);
