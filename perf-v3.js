/* 영업 대시보드 · 성과 분석 v3 (2026-10-04 design_handoff_performance_v3 · 성과 분석 v3.dc.html) — 성과 분석 화면만. 전체 현황 · 컨트롤타워 · 공통 틀(필터줄 · 연도 · 분기 줄)은 그대로.
   ① 판정 카드(흰 배경): 팀 메이드율 도넛 + 한 줄 판정(필터 반영 자동 문장) + 숫자 4개(수주실적 · 회사 매출 · 메이드율 · 이번 달 "아직 없음 · 전월 n")
   ② 누가 얼마나 · 얼마나 이기나(카드 3열 · 수주실적 순): 순위 꼬리표 · 이름 · 최근 활동일 / 큰 도넛(메이드율) + 수주실적 · 수주 · 실주 · 진행 / 막힌 곳 한 줄(주의인 사람만 빨강)
   ③ 브랜드별 · 문의가 수주까지: 문의 → 적합 → 수주 막대 1개 + 메이드율(수주 0 = "수주 없음")
   ④ 탭 4개 중 하나만: 유입 브랜드 → 낙찰사 · 매출 / 접수 월별 전환(수주가 견적문의와 연결 안 됐으면 빨간 경고) / 유입경로(상위 4 + 기타 n개) / 기술자문(현장 · 공종 · 낙찰 시공사 · 낙찰일 · 기술자문 계약일 · 낙찰금액 · 회사 매출 · 상태)
   ⑤ 아직 판단 못 하는 것: 한 줄(n/10)
   없앤 것: "0% 월평균 대비" 게이지 · 담당자 카드의 긴 빨간 문장 · 표 4개를 세로로 다 펼치던 구조.
   ■ 숫자는 전부 영업 대시보드와 같은 계산(DashB.core · people · lib — 수주실적 = 낙찰금액(계약 원장 · 계약 체결일 기준), 메이드율 = 수주 ÷ (수주 + 실주) · 배드핏 · 협약문의 제외). 문장 속 숫자도 자료에서만.
   ■ 기술자문 탭의 공종 · 기술자문 계약일 · 상태는 서버 읽기 함수(crm_deal_win_list_v1)가 그 칸을 내려줄 때만 표시한다(sql/deal-win-list-advisory-fields-20261004.sql). 상태 = 계약일 없음 → 계약 전 / 정산액 ≥ 기술자문료 → 정산 완료 / 그 밖 → 진행 중(서버 계산 · 금액은 내려오지 않는다).
   끄기: G.perfV3Off=true → 예전 성과 분석 */
(function(root){
 'use strict';
 const R=root,h=v=>R.esc(String(v==null?'':v)),attr=v=>R.escAttr(String(v==null?'':v));
 const enabled=()=>!R.G.perfV3Off&&!!R.DashB&&!!R.DashB.lib;
 const st=()=>R.G.perfV3||(R.G.perfV3={tab:0});
 const TYPE={'직접 수주':['직접','d'],'협약 · 기술자문':['협약 · 기술자문','p'],'타사 이관':['타사 이관','t']};
 const STATE={before:['계약 전','r'],progress:['진행 중','b'],settled:['정산 완료','g']};
 const b2b=()=>(R.InquiryB2BTab&&R.InquiryB2BTab.OWNER)||'조재연';
 const ymd=v=>{const m=/^(\d{4})-(\d{2})-(\d{2})/.exec(String(v||''));return m?m[1]+'.'+Number(m[2])+'.'+Number(m[3]):'';};
 const mdot=k=>{const m=/^\d{4}-(\d{2})-(\d{2})/.exec(String(k||''));return m?Number(m[1])+'.'+Number(m[2]):'';};
 const ring=(v,low,cls)=>'<div class="pf3-ring'+(cls?' '+cls:'')+'" style="background:conic-gradient('+(low?'#d14a3f':'#3b6ce4')+' 0 '+(v==null?0:Math.max(0,Math.min(100,v)))+'%,#eef0f3 '+(v==null?0:Math.max(0,Math.min(100,v)))+'% 100%)"><div><b class="'+(low?'red':'')+'">'+(v==null?'-':v.toFixed(1)+'%')+'</b><span>메이드율</span></div></div>';
 function html(C){
  const D=R.DashB.lib,{B,P,L,made,q}=C,S=st(),LOW=D.LOWMADE(),MINC=D.MINCLOSED(),MINREC=D.MINREC,eok=D.eok;
  const money=v=>v>0?eok(v):v<0?'-'+eok(-v):'-',amt=v=>v>0?eok(v):'아직 없음';
  const ALL=R.DashB.people(C),PP=ALL.filter(p=>p.prog||p.w||p.l||p.yr>0),ranked=PP.slice().sort((a,b)=>b.yr-a.yr||b.w-a.w),quiet=ALL.filter(p=>!PP.includes(p)).map(p=>p.n);
  const brand=R.G.brand&&R.G.brand!=='전체'?String(R.G.brand):'';
  const perfIn=(a,b)=>B.contractsIn(L,a,b,null,'direct').net+(C.DW?C.DW.partnerIn(a,b,C.target).amount:0)+(C.DT?C.DT.wonIn(a,b,C.target).amount:0);
  const ms=D.mk(P.ty,P.tm),me=D.mk(P.ty,P.tm+1),pms=D.mk(P.ty,P.tm-1),mo=L.ready?perfIn(ms,me):0,prev=L.ready?perfIn(pms,ms):0,pmN=new Date(P.ty,P.tm-2,1).getMonth()+1;
  let sum=0,n=0;if(L.ready)for(let m=1;m<=12;m++){if(P.y>P.ty||(P.y===P.ty&&m>=P.tm))continue;sum+=perfIn(D.mk(P.y,m),D.mk(P.y,m+1));n++;}
  const avg=n?sum/n:0;
  const MX=L.ready?D.matrixRows(C):[],tot=MX.reduce((s,r)=>({n:s.n+r.n,amt:s.amt+r.amt,rev:s.rev+r.rev,unknown:s.unknown+r.unknown}),{n:0,amt:0,rev:0,unknown:0});
  const closed=C.won+C.loss.length+(C.tfLost||0),low=made!==null&&made<LOW;
  /* ── ① 판정 카드 ── */
  const bn=brand?brand+' ':'',scope=P.label;
  const verdict=!L.ready?'계약 원장을 불러오는 중입니다.':C.perf<=0?bn+scope+' 수주실적은 아직 없습니다.'+(C.fit>0?' 적합 문의 '+C.fit+'건이 수주로 넘어가지 않고 있습니다.':''):made===null?bn+scope+' 수주실적 '+eok(C.perf)+' · 결과 난 영업이 아직 없습니다.':bn+scope+' 수주실적 '+eok(C.perf)+' · 결과 난 영업 '+closed+'건 중 '+C.won+'건을 이겼습니다.';
  const drag=C.target||made===null?[]:PP.filter(p=>p.made!==null&&p.made<made&&p.w+p.l>=MINC).map(p=>p.n);
  const verdictS=!L.ready?'':made===null?'메이드율은 결과가 나와야 계산됩니다':'메이드율 '+made.toFixed(1)+'% · 기준 '+LOW+'%'+(low?' 아래':' 이상')+(drag.length?' · '+drag.join(' · ')+'이(가) 팀 평균을 끌어내림':'');
  const kpi=[[(P.q?'분기':'연')+' 수주실적',L.ready?amt(C.perf):'불러오는 중',C.won+'건'+(avg>0?' · 월평균 '+eok(avg):''),C.perf>0?'':'mut'],
   ['회사 매출',L.ready?amt(tot.rev):'불러오는 중','직접 계약 + 기술자문 · POUR',tot.rev>0?'':'mut'],
   ['메이드율',made===null?'-':made.toFixed(1)+'%','기준 '+LOW+'%',low?'red':''],
   [P.tm+'월',L.ready?amt(mo):'불러오는 중',P.td+'일째 · '+pmN+'월 '+(prev>0?eok(prev):'없음'),mo>0?'':'mut']];
  const head='<section class="pf3-verdict">'+ring(made,low,'')+'<div class="tx"><span>한 줄 판정 · '+h(scope)+'</span><b>'+h(verdict)+'</b>'+(verdictS?'<small>'+h(verdictS)+'</small>':'')+'</div><div class="ks">'+kpi.map(k=>'<div><span>'+h(k[0])+'</span><b class="'+k[3]+'">'+h(k[1])+'</b><small>'+h(k[2])+'</small></div>').join('')+'</div></section>';
  /* ── ② 담당자 카드 3열 ── */
  const issue=p=>String(p.why||'').split(' — ')[0]||(p.fix?'손볼 건 '+p.fix+'건':'막힌 곳 없음');
  const card=(p,i)=>{const first=i===0&&p.yr>0,warn=p.sev>0,tag=first?['1위','one']:warn?['주의','warn']:[(i+1)+'위',''],lowM=p.made!==null&&p.made<LOW;
   return '<div class="pf3-pc"><div class="hd"><em class="'+tag[1]+'">'+tag[0]+'</em><button type="button" data-db="person" data-v="'+attr(p.n)+'">'+h(p.n)+'</button><i></i><span>최근 '+h(p.lastK?mdot(p.lastK):'기록 없음')+'</span></div>'
    +'<div class="bd">'+ring(p.made,lowM,'lg')+'<div class="kv"><span>'+(P.thisYear?'올해 수주실적':'기간 수주실적')+'</span><b class="a'+(p.yr>0?'':' mut')+'">'+h(amt(p.yr))+'</b><span>수주 · 실주</span><b>'+p.w+' · '+p.l+'</b><span>진행</span><b>'+p.prog+'건</b></div></div>'
    +'<span class="is'+(warn?' red':'')+'">'+h(issue(p))+'</span></div>';};
  const peopleSec='<section class="pf3-people"><div class="pf3-sh"><b>누가 얼마나 · 얼마나 이기나</b><span>수주실적 순 · 원 = 메이드율(수주 ÷ (수주 + 실주), 배드핏 제외) · '+LOW+'% 미만 빨강</span></div>'+(ranked.length?'<div class="pf3-pcs">'+ranked.map(card).join('')+'</div>':'<p class="pf3-empty">진행 · 수주 기록이 있는 담당자가 없습니다.</p>')+(quiet.length?'<span class="pf3-quiet">아직 기록 없음: '+h(quiet.map(x=>x===b2b()?x+'(B2B 협약 전담 · 영업 집계 제외)':x).join(' · '))+'</span>':'')+'</section>';
  /* ── ③ 브랜드별 · 문의가 수주까지 ── */
  const BRW=D.brandRows(C).filter(b=>!brand||b.name===brand),zero=BRW.filter(b=>b.fit>0&&!b.w);
  const funnel='<section class="pf3-fun"><div class="pf3-sh"><b>브랜드별 · 문의가 수주까지</b></div>'+BRW.map(b=>{const none=!b.w,lowB=!none&&b.made!==null&&b.made<LOW;
    return '<div class="pf3-fr"><div><i style="background:'+b.c+'"></i><b>'+h(b.name)+'</b><u></u><b class="rt'+(none?' mut':lowB?' red':'')+'">'+(none?'수주 없음':b.made===null?'—':b.made.toFixed(1)+'%')+'</b></div><div class="bar'+(b.q||b.fit||b.w?'':' zero')+'"><span style="flex:'+b.q+';background:'+b.c+';opacity:.25"></span><span style="flex:'+b.fit+';background:'+b.c+';opacity:.55"></span><span style="flex:'+Math.max(b.w,1)+';background:'+b.c+'"></span></div><span>문의 '+b.q+' → 적합 '+b.fit+' → 수주 '+(L.ready?b.w:'—')+'</span></div>';}).join('')
   +(zero.length&&L.ready?'<span class="pf3-warn">'+h(zero.map(b=>b.name).join(' · ')+' — 적합 '+zero.reduce((s,b)=>s+b.fit,0)+'건인데 수주 0')+'</span>':'')+'</section>';
  /* ── ④ 탭 ── */
  const TB=[['유입 브랜드 → 낙찰사 · 매출',P.label+' · 수주실적 = 낙찰금액 · 매출 = 회사에 들어오는 돈'],['접수 월별 전환','같은 달 들어온 문의가 결국 몇 건 계약됐나'],['유입경로','어디서 계약되는 문의가 오나'],['기술자문','협약시공사 낙찰 건']];
  const tab=Math.max(0,Math.min(3,Number(S.tab)||0));
  function tMatrix(){
   if(!L.ready)return '<p class="pf3-empty">계약 원장을 불러오는 중입니다.</p>';
   if(!MX.length)return '<p class="pf3-empty">'+h(P.label)+' 수주가 아직 없습니다.</p>';
   const own=MX.filter(r=>r.type==='직접 수주').reduce((s,r)=>s+r.rev,0),ptR=MX.filter(r=>r.type==='협약 · 기술자문'),ptAmt=ptR.reduce((s,r)=>s+r.amt,0),ptRev=ptR.reduce((s,r)=>s+r.rev,0),ratio=(rev,a)=>a>0?Math.round(rev/a*100):null;
   const tops=[['수주실적 (낙찰금액)',money(tot.amt),tot.n+'건 · 인센티브 기준'],['회사 매출',money(tot.rev),'직접 계약 '+money(own)+' + 기술자문 · POUR '+money(ptRev)],['협약 · 기술자문 비중',tot.amt>0?Math.round(ptAmt/tot.amt*100)+'%':'—','수주실적 중 '+money(ptAmt)]];
   const groups=[];MX.forEach(r=>{let g=groups[groups.length-1];if(!g||g.brand!==r.brand){g={brand:r.brand,rows:[]};groups.push(g);}g.rows.push(r);});
   const line=(o)=>'<div class="pf3-mr'+(o.sub===2?' tot':o.sub===1?' sub':'')+'"><span class="pb" style="color:'+(o.c||'#15171c')+'">'+(o.brand?'<i style="background:'+(o.c||'transparent')+'"></i>'+h(o.brand):'')+'</span><span title="'+attr(o.co)+'">'+h(o.co)+'</span><span>'+(o.type?'<em class="'+TYPE[o.type][1]+'">'+TYPE[o.type][0]+'</em>':'')+'</span><span class="r">'+o.n+'</span><span class="r">'+h(o.amt)+'</span><span class="r'+(o.rev==='미입력'?' red':'')+'">'+h(o.rev)+'</span><span class="pc">'+(o.pct==null?'':'<small>'+o.pct+'%</small><u><i style="width:'+Math.max(0,Math.min(100,o.pct))+'%"></i></u>')+'</span></div>';
   const revOf=r=>r.type==='타사 이관'?'-':r.type==='협약 · 기술자문'&&r.unknown===r.n?'미입력':money(r.rev),pctOf=r=>r.type==='타사 이관'||(r.type==='협약 · 기술자문'&&r.unknown===r.n)?null:ratio(r.rev,r.amt);
   const lines=[];groups.forEach(g=>{const c=D.BRC[g.brand]||'#9aa0ab';
    if(g.rows.length===1){const r=g.rows[0];lines.push(line({brand:g.brand,c,co:r.company,type:r.type,n:r.n,amt:money(r.amt),rev:revOf(r),pct:pctOf(r)}));return;}
    const s=g.rows.reduce((a,r)=>({n:a.n+r.n,amt:a.amt+r.amt,rev:a.rev+r.rev}),{n:0,amt:0,rev:0});
    lines.push(line({brand:g.brand,c,co:'소계',type:'',n:s.n,amt:money(s.amt),rev:money(s.rev),pct:ratio(s.rev,s.amt),sub:1}));
    g.rows.forEach(r=>lines.push(line({brand:'',co:'└ '+r.company,type:r.type,n:r.n,amt:money(r.amt),rev:revOf(r),pct:pctOf(r)})));});
   if(groups.length>1)lines.push(line({brand:'합계',co:'',type:'',n:tot.n,amt:money(tot.amt),rev:money(tot.rev),pct:null,sub:2}));
   const miss=MX.filter(r=>r.unknown>0).map(r=>r.company+' '+r.unknown+'건');
   return '<div class="pf3-tb"><div class="pf3-tops">'+tops.map(t=>'<div><span>'+t[0]+'</span><b>'+h(t[1])+'</b><small>'+h(t[2])+'</small></div>').join('')+'</div><div class="pf3-mr hd"><span>유입 브랜드</span><span>낙찰 시공사</span><span>수주 유형</span><span class="r">건수</span><span class="r">수주실적</span><span class="r">매출</span><span>매출 / 수주실적</span></div>'+lines.join('')
    +'<span class="pf3-tn">협약 · 기술자문 수주는 낙찰금액 전액이 수주실적이고, 회사 매출은 기술자문 · POUR 계약만큼만 잡힙니다.'+(miss.length?' <b class="red">'+h(miss.join(' · '))+' 매출 미입력</b>':'')+'</span></div>';
  }
  function tCohort(){
   const after=(R.CRMRules&&R.CRMRules.PHASE2&&R.CRMRules.PHASE2.cohort_compare_after_months)||3,rows=[];
   for(let i=5;i>=0;i--){const d=new Date(P.ty,P.tm-1-i,1),ym=d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0'),qq=C.AQ.filter(x=>C.K(R.inquiryCreatedAt(x)).slice(0,7)===ym),f=qq.map(x=>D.inquiryFate(C,x));rows.push({m:(d.getMonth()+1)+'월',q:qq.length,fit:f.filter(v=>v!=='badfit').length,won:f.filter(v=>v==='won').length,open:f.filter(v=>v==='open').length,lost:f.filter(v=>v==='lost').length,old:i>=after});}
   /* 수주가 견적문의와 연결돼 있나: 기간 수주 건(직접 + 협약 · 기술자문) 중 어느 문의에서든 연결된 영업건인 것 */
   const wonIds=new Set();C.con.list.forEach(x=>wonIds.add(String(x.r.deal_id)));C.pt.list.forEach(x=>wonIds.add(String(x.dealId)));
   const linked=new Set();C.AQ.forEach(x=>{let d=null;try{d=R.linkedDeal(x);}catch(e){}if(d){linked.add(String(d.id));try{linked.add(String(R.dealKey(d)));}catch(e){}}});
   const N=wonIds.size,M=[...wonIds].filter(id=>linked.has(id)).length,cw=rows.reduce((s,r)=>s+r.won,0),warn=L.ready&&N>0&&M<N;
   const box=!warn?'':'<div class="pf3-alert"><b>데이터 확인 필요</b> · '+h(P.label)+' 수주 '+N+'건 중 견적문의와 연결된 건이 '+M+'건입니다'+(cw?'':' — 월별 문의에서 수주로 이어진 건이 0입니다')+'. 수주 건'+(M?' 일부가':' 대부분이')+' 견적문의와 연결되지 않은 채 등록돼 있어, 이 표는 연결을 고친 뒤에 의미가 생깁니다.</div>';
   return '<div class="pf3-tb">'+box+'<div class="pf3-cr hd"><span>접수 월</span><span class="r">문의</span><span class="r">적합</span><span class="r">진행 중</span><span class="r">수주 · 실주</span><span>확정 전환율</span></div>'+rows.map(r=>{const rate=r.q?Math.round(r.won/r.q*1000)/10:null,bad=r.old&&warn&&!r.won;
     const note=!L.ready?'불러오는 중':r.old?(rate===null?'문의 없음':rate.toFixed(1)+'%')+' · '+after+'개월 지남'+(bad?' · 연결 확인 필요':''):(r.won?rate.toFixed(1)+'% · ':'')+'아직 진행 중이 많음 · 판단은 '+after+'개월 뒤';
     return '<div class="pf3-cr"><b>'+r.m+'</b><span class="r">'+r.q+'</span><span class="r">'+r.fit+'</span><span class="r mut2">'+(L.ready?r.open:'—')+'</span><span class="r">'+(L.ready?r.won:'—')+' · '+r.lost+'</span><span class="nt'+(bad?' red':r.old?'':' mut')+'">'+h(note)+'</span></div>';}).join('')+'</div>';
  }
  function tChannel(){
   const m=new Map();q.forEach(x=>{const k=R.DashB.channelOf(x),v=m.get(k)||{l:k,q:0,fit:0,won:0},f=D.inquiryFate(C,x);v.q++;if(f!=='badfit')v.fit++;if(f==='won')v.won++;m.set(k,v);});
   let rows=[...m.values()].sort((a,b)=>b.q-a.q||a.l.localeCompare(b.l));if(!rows.length)return '<p class="pf3-empty">'+h(P.label)+' 접수된 견적문의가 없습니다.</p>';
   const top=rows[0],unk=rows.find(r=>r.l==='유입경로 미기록'),all=q.length;let rest=null;
   if(rows.length>5){const tail=rows.slice(4);rest={l:'기타 '+tail.length+'개',q:tail.reduce((s,r)=>s+r.q,0),fit:tail.reduce((s,r)=>s+r.fit,0),won:tail.reduce((s,r)=>s+r.won,0),k:tail.length};rows=rows.slice(0,4).concat([rest]);}
   const max=Math.max(1,...rows.map(r=>r.q));
   return '<div class="pf3-tb">'+rows.map(r=>'<div class="pf3-ch"><b title="'+attr(r.l)+'">'+h(r.l)+'</b><span class="bar"><i class="q" style="width:'+Math.max(1,Math.round(r.q/max*100))+'%"></i><i class="f" style="width:'+(r.fit?Math.max(1,Math.round(r.fit/max*100)):0)+'%"></i></span><span>문의 '+r.q+' · 적합 '+r.fit+'</span><b class="r">수주 '+(L.ready?r.won:'—')+'</b></div>').join('')
    +'<span class="pf3-tn line">'+h(top.l+'이(가) 문의의 '+Math.round(top.q/all*100)+'%('+top.q+'건)'+(L.ready?' · 수주 '+top.won+'건.':'.')+(rest?' 기타 경로 '+rest.k+'개('+rest.q+'건)는 한 줄로 묶음.':''))+' <b>유입경로 미입력 문의가 많으면 이 표가 틀려집니다</b> — 견적문의 유입경로 칸 채우기 우선.'+(unk?' 지금 미입력 '+unk.q+'건.':'')+'</span></div>';
  }
  function tAdvisory(){
   const list=C.pt.list.slice().sort((a,b)=>String(b.key||'').localeCompare(String(a.key||'')));
   const own=B.tally(list,x=>R.repN(x.owner)||'미지정').map(t=>t[0]+' '+t[1]).join(' · ');
   const advOf=id=>{try{return C.DW&&C.DW.advisoryOf?C.DW.advisoryOf(id):null;}catch(e){return null;}},winOf=id=>{try{return C.DW?C.DW.of({id}):null;}catch(e){return null;}};
   let pendingServer=false;
   const rows=list.map(x=>{const t=advOf(x.dealId),w=winOf(x.dealId);let work='';try{work=x.deal?R.dealWorkSummary(x.deal):'';}catch(e){}if(!work||/미분류|미기록/.test(work))work=String((t&&(t.work_name||t.work_type))||'').trim();
     const awd=ymd((w&&w.award_date)||(t&&t.bid_confirmed_at)),hasCd=!!t&&Object.prototype.hasOwnProperty.call(t,'contract_date'),cd=hasCd?ymd(t.contract_date):'',stt=t&&t.settle_state&&STATE[t.settle_state]?STATE[t.settle_state]:null;if(t&&!hasCd)pendingServer=true;
     const site=String((x.deal&&x.deal.site)||x.site||'현장명 미확인');/* 시안처럼 지역 머리를 포함한 현장명 */return '<div class="pf3-ar"><b title="'+attr(site)+'">'+h(site)+'</b><span class="'+(work?'':'red')+'" title="'+attr(work)+'">'+h(work||'미입력')+'</span><span class="co">'+h(x.company)+'</span><span class="'+(awd?'':'red')+'">'+h(awd||'미입력')+'</span><span class="'+(cd?'':hasCd?'red':'mut')+'">'+h(cd||(hasCd?'미입력':'-'))+'</span><span class="r">'+h(x.amount>0?eok(x.amount):'-')+'</span><span class="r'+(x.revKnown?'':' red')+'">'+h(x.revKnown?money(x.revenue):'미입력')+'</span><span>'+(stt?'<em class="'+stt[1]+'">'+stt[0]+'</em>':'<span class="mut">-</span>')+'</span></div>';}).join('');
   return '<div class="pf3-tb adv"><div class="pf3-big"><span>협약시공사 낙찰 · 수주실적에 포함</span><b class="'+(C.pt.amount>0?'':'mut')+'">'+h(amt(C.pt.amount))+'</b><small>'+C.pt.count+'건'+(own?' · 귀속 '+h(own):'')+'</small></div><div class="pf3-at"><div class="pf3-ar hd"><span>현장</span><span>공종</span><span>낙찰 시공사</span><span>낙찰일</span><span>기술자문 계약일</span><span class="r">낙찰금액</span><span class="r">회사 매출</span><span>상태</span></div>'+(rows||'<p class="pf3-empty">'+h(P.label)+' 협약시공사 낙찰 건이 아직 없습니다.</p>')+(pendingServer?'<span class="pf3-tn">기술자문 계약일 · 상태는 서버 읽기 함수를 갱신한 뒤에 표시됩니다.</span>':'')+'</div></div>';
  }
  const tabs='<section class="pf3-tabs"><div class="th" role="tablist">'+TB.map((t,i)=>'<button type="button" role="tab" data-pf3="tab" data-v="'+i+'" aria-selected="'+(tab===i)+'">'+t[0]+'</button>').join('')+'<i></i><span>'+h(TB[tab][1])+'</span></div>'+(tab===0?tMatrix():tab===1?tCohort():tab===2?tChannel():tAdvisory())+'</section>';
  /* ── ⑤ 아직 판단 못 하는 것 ── */
  const pend=D.pendingStats(),pending='<div class="pf3-pending"><b>아직 판단 못 하는 것</b><span>기록이 '+MINREC+'건 쌓이면 자동으로 보입니다</span>'+pend.map(p=>p[1]>=MINREC?'<span>'+h(p[0])+' <b>'+h(p[2])+'</b> <small>'+p[1]+'건 기준</small></span>':'<span>'+h(p[0])+' <i><u style="width:'+Math.min(100,p[1]*100/MINREC)+'%"></u></i> '+p[1]+'/'+MINREC+'</span>').join('')+'</div>';
  return '<div class="pf3">'+head+'<div class="pf3-mid">'+peopleSec+funnel+'</div>'+tabs+pending+'</div>';
 }
 document.addEventListener('click',e=>{const b=e.target.closest('#si-perf [data-pf3="tab"]');if(!b)return;st().tab=Number(b.dataset.v)||0;try{R.DashB.render();}catch(err){}});
 root.PerfV3={enabled,html,state:st};
})(window);
