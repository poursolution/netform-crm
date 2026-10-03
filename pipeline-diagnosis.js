/* 단계 진단 영역 — "배우는" 구성 (2026-10-01 디자인 핸드오프 'design_handoff_pipeline' ②)
   단계 목록 위에 진단 → 행동 블록: 숫자 4개 · 분석 카드 3개(왜 / 어디서·무엇을 / 누구) · 행동 카드(근거에서 나온 과제 제안).
   숫자는 전부 지금 목록(공통 필터가 걸린 행)에서 계산한다. 기록되지 않은 항목은 '미기록'으로 세어 그대로 보여 준다(추정하지 않는다).
   render(model) 은 단계와 무관한 공통 그리기 — 확장관리 등 다른 화면도 같은 모양으로 쓴다. */
(function(root){
 'use strict';
 const h=v=>root.esc(String(v==null?'':v)),attr=v=>root.escAttr(String(v==null?'':v));
 const money=v=>{const n=Number(v)||0;if(!n)return '–';if(n>=1e8)return (Math.round(n/1e7)/10)+'억';if(n>=1e4)return Math.round(n/1e4).toLocaleString('ko-KR')+'만';return n.toLocaleString('ko-KR');};
 const sum=(list,f)=>list.reduce((s,x)=>s+(Number(f(x))||0),0),amt=x=>x.row.amount;
 const pct=(n,d)=>d?Math.round(n*100/d):0;
 const days=v=>{if(!v)return null;const n=root.daysTo(v);return Number.isFinite(n)?n:null;};
 /* 조건별 건수·금액 — [라벨, 조건] 목록을 건수 큰 순으로. 0건은 뺀다 */
 function reasons(items,defs){return defs.map(([label,test])=>{const hit=items.filter(test);return [label,hit.length,money(sum(hit,amt)),hit];}).filter(x=>x[1]>0).sort((a,b)=>b[1]-a[1]).slice(0,5);}
 /* 값별 건수 — 빈 값은 emptyLabel 로 모은다 */
 function tally(items,keyFn,emptyLabel,limit){const map=new Map();items.forEach(x=>{let ks=keyFn(x);if(!Array.isArray(ks))ks=[ks];ks=ks.map(k=>String(k||'').trim()).filter(Boolean);if(!ks.length)ks=[emptyLabel];ks.forEach(k=>map.set(k,(map.get(k)||0)+1));});return [...map].sort((a,b)=>(a[0]===emptyLabel)-(b[0]===emptyLabel)||b[1]-a[1]).slice(0,limit||5);}
 /* 담당자별 건수 + 그 담당자에게 가장 많은 사유 */
 function owners(items,defs){const map=new Map();items.forEach(x=>{const o=x.row.owner||'미배정';(map.get(o)||map.set(o,[]).get(o)).push(x);});return [...map].map(([o,list])=>{const top=defs.map(([label,test])=>[label,list.filter(test).length]).sort((a,b)=>b[1]-a[1])[0];return [o,list.length,top&&top[1]?top[0]:'정상 진행'];}).sort((a,b)=>b[1]-a[1]).slice(0,5);}
 const origin=x=>x.row.item.originChannel||x.row.item.origin_channel||'';
 const fieldsOf=(x,code)=>x.row.item.stage_contexts?.[code]?.fields||{};
 const competitorOf=x=>x.values.competitor||fieldsOf(x,'compete').competitor||fieldsOf(x,'lost').competitor||'';
 const quarterStart=()=>{const d=new Date();return new Date(d.getFullYear(),Math.floor(d.getMonth()/3)*3,1).toLocaleDateString('en-CA');};
 /* 근거(사유 라벨) → 과제 제안 문구. 시안의 과제를 사유에 묶어 둔 것 — 사람이 보고 등록한다 */
 const TODO={
  '고객 요구 미확인':['첫 통화 체크리스트(공종 · 범위 · 시기)를 연락 기록에 붙이기','영업팀 · 이번 주'],
  '견적 예정일 미지정':['요구 확인 시 견적 예정일을 함께 입력','영업팀'],
  '담당자 미배정':['오늘 업무 미배정 알림으로 매일 배정','관리자 · 매일'],
  '다음 할 일 없음':['상세의 [다음 할 일 · 날짜]로 다음 연락일 등록','담당자 · 이번 주'],
  '공종 미분류':['요구 확인 시 공종을 함께 선택','영업팀'],
  '후속 기한 초과':['발송 7일 안 후속 연락을 다음 할 일로 등록','담당자 · 이번 주'],
  '후속일 미지정':['자료 발송 시 후속 확인일을 함께 입력','영업팀'],
  '고객 반응 미확인':['통화 시 고객 반응(검토중 · 추가자료 · 가격협의)을 기록','담당자'],
  '발송 자료 기록 없음':['보낸 자료를 발송 기록에 남기기','담당자'],
  '연락 초과':['다음 연락일이 지난 건부터 재통화','담당자 · 이번 주'],
  '다음 연락 미지정':['관계관리 건마다 다음 연락일 지정','담당자'],
  '사유 미입력':['관계관리 진입 사유를 기록','담당자'],
  '장기 무응답':['전화 대신 문자 · 카카오로 채널 바꾸기','영업팀'],
  '결정 예정일 없음':['결정 예정일(PT · 입찰 마감 · 계약 예정)부터 등록','담당자 · 이번 주'],
  '경쟁사 미기록':['경쟁사와 강점을 기록해 실주 분석과 연결','담당자'],
  '준비 현황 미기록':['PT 자료 · 비교표 · 가격 검토 준비 현황 기록','담당자'],
  '계약일 미입력':['계약 단계에서 계약일 · 금액 확인','담당자 · 이번 주'],
  '계약 금액 미입력':['계약 금액을 확인해 입력','담당자 · 이번 주'],
  '착공일 미정':['시공 일정 담당 지정 · 착공일 입력','관리자'],
  '이긴 이유 미기록':['수주 처리 시 이긴 이유를 한 줄 남기기','영업팀'],
  '계약 정보 미기록':['계약일 · 금액을 확인해 기록','담당자 · 이번 주'],
  '사유 미기록':['실주 사유를 담당자에게 기록 요청','관리자 · 이번 주'],
  '가격 열세':['경쟁·입찰 PT에 하자보수 기간 · 유지비 비교표 넣기','영업팀'],
  /* 2026-10-04 운영 기준의 실주 원인 */
  '가격':['경쟁·입찰 PT에 하자보수 기간 · 유지비 비교표 넣기','영업팀'],
  /* 실주 원인 4분류 */
  '가격 · 가격 경쟁':['경쟁·입찰 PT에 하자보수 기간 · 유지비 비교표 넣기','영업팀'],
  '관계 · 경쟁업체 기존 관계':['같은 규모 단지 시공 사례를 PT에 첨부','영업팀'],
  '관계 · 관리소장 변경':['새 관리소장에게 기존 견적 · 공법 · 관계를 다시 확인','담당자 · 이번 주'],
  '공법 · 타 공법 선호':['공법 비교자료(하자보수 · 유지비)를 제안서에 넣기','영업팀'],
  '경쟁사 관계':['같은 규모 단지 시공 사례를 PT에 첨부','영업팀'],
  '관리소장 변경':['새 관리소장에게 기존 견적 · 공법 · 관계를 다시 확인','담당자 · 이번 주'],
  '타사 선정 (경쟁 패배)':['같은 규모 단지 시공 사례를 PT에 첨부','영업팀'],
  '견적 후 후속 지연':['발송 7일 안 후속 연락을 다음 할 일로 등록','영업팀'],
  '우리가 연락 못 함':['다음 연락일이 지난 건을 오늘 업무에서 먼저 처리','영업팀'],
  '담당자 부재·인수인계 누락':['담당자 변경 시 인수인계 메모를 남기기','관리자']
 };
 function tasks(list){return list.filter(x=>x[1]>0).slice(0,4).map(([label,n])=>{const t=TODO[label]||['이 사유가 반복되는 원인을 확인하고 대응 정하기','관리자'];return {basis:label+' '+n+'건',todo:t[0],who:t[1],label,count:n};});}
 const K=(label,value,sub,tone)=>({label,value,sub:sub||'',tone:tone||''});
 /* 단계별 모델 */
 function model(key,items){
  const n=items.length,total=money(sum(items,amt)),inGroup=g=>items.filter(x=>x.shape.group===g);
  if(key==='consulting'){
   const defs=[['고객 요구 미확인',x=>!x.values.needs],['견적 예정일 미지정',x=>!x.values.quoteDue],['담당자 미배정',x=>!x.row.owner||x.row.owner==='미배정'],['다음 할 일 없음',x=>x.row.flags.includes('missing')],['공종 미분류',x=>!x.values.work||/미분류|미기록/.test(x.values.work)]];
   const stalls=items.map(x=>x.row.stall).filter(v=>v!=null),avg=stalls.length?Math.round(stalls.reduce((a,b)=>a+b,0)/stalls.length):null,none=inGroup('none').length,over=inGroup('over').length,why=reasons(items,defs);
   return {accent:'blue',kpis:[K('이 단계',n+'건','진행 금액 '+total),K('평균 체류',avg==null?'–':avg+'일','이 단계에 머문 평균 일수',avg!=null&&avg>30?'bad':''),K('다음 할 일 없음',none+'건',pct(none,n)+'% — 다음 할 일이 비어 있음',none?'bad':''),K('다음 업무 기한 초과',over+'건','기한이 지난 다음 업무',over?'bad':'')],
    cards:[{title:'왜 멈춰 있나',desc:'정체 사유 · 상위 5개',bars:why},{title:'어디서 들어왔나',desc:'유입 경로',bars:tally(items,origin,'경로 미기록')},{title:'누구에게 쌓였나',desc:'담당자 · 주된 정체',rows:owners(items,defs)}],
    action:{title:'그래서 뭘 해야 하나',desc:'이 단계 병목에서 나온 과제',tasks:tasks(why)}};
  }
  if(key==='sent'){
   const defs=[['후속 기한 초과',x=>x.shape.group==='over'],['후속일 미지정',x=>x.shape.group==='nodate'],['고객 반응 미확인',x=>!x.values.reaction||x.values.reaction==='확인 전'],['발송 자료 기록 없음',x=>!x.values.materials]];
   const over=inGroup('over'),late=over.map(x=>-days(x.values.followup)).filter(v=>v>0),avg=late.length?Math.round(late.reduce((a,b)=>a+b,0)/late.length):0,seen=items.filter(x=>x.values.reaction&&x.values.reaction!=='확인 전').length,nod=inGroup('nodate').length,why=reasons(items,defs);
   return {accent:'blue',kpis:[K('이 단계',n+'건','진행 금액 '+total),K('후속 기한 초과',over.length+'건',over.length?'평균 '+avg+'일 지남':'지난 건 없음',over.length?'bad':''),K('고객 반응 확인',seen+'건',n-seen?(n-seen)+'건 확인 전':'모두 확인',n&&!seen?'bad':''),K('후속일 미지정',nod+'건','후속 확인 날짜 없음',nod?'warn':'')],
    cards:[{title:'왜 반응이 없나',desc:'후속 정체 사유',bars:why},{title:'무엇을 보냈나',desc:'발송 자료',bars:tally(items,x=>{const m=x.row.fields.materials;return Array.isArray(m)?m:String(m||'').split(/\s*[·,]\s*/);},'기록 없음')},{title:'누구에게 쌓였나',desc:'담당자 · 주된 정체',rows:owners(items,defs)}],
    action:{title:'그래서 뭘 해야 하나',desc:'후속 연락 병목에서 나온 과제',tasks:tasks(why)}};
  }
  if(key==='relationship'){
   const reasonOf=x=>x.row.fields.relationship_reason||x.row.fields.reason||x.row.item.waitingReason||'';
   const defs=[['연락 초과',x=>x.shape.group==='over'],['다음 연락 미지정',x=>x.shape.group==='nodate'],['사유 미입력',x=>!reasonOf(x)],['장기 무응답',x=>x.row.contactDays!=null&&x.row.contactDays>=29]];
   const over=inGroup('over').length,silent=items.filter(x=>!['rapport','waiting'].includes(x.row.code)).length,nod=inGroup('nodate').length;
   const when=x=>{const d=days(x.row.due);if(d==null)return '미정';if(d<0)return '이미 지남';const t=new Date(),due=new Date(String(x.row.due).slice(0,10)),m=(due.getFullYear()-t.getFullYear())*12+due.getMonth()-t.getMonth();return m<=0?'이번 달':m===1?'다음 달':m<=3?'분기 내':'그 이후';};
   const order=['이미 지남','이번 달','다음 달','분기 내','그 이후','미정'],whenBars=tally(items,when,'미정',6).sort((a,b)=>order.indexOf(a[0])-order.indexOf(b[0]));
   return {accent:'blue',kpis:[K('이 단계',n+'건','진행 금액 '+total),K('연락 초과',over+'건','다음 연락일 지남',over?'bad':''),K('침묵관리',silent+'건','장기 무응답 관리',silent?'warn':''),K('다음 연락 미지정',nod+'건','다음 연락 날짜 없음',nod?'warn':'')],
    cards:[{title:'왜 연락이 끊겼나',desc:'관계관리 사유',bars:tally(items,reasonOf,'사유 미입력').map(([k,c])=>[k,c,money(sum(items.filter(x=>(reasonOf(x)||'사유 미입력')===k),amt))])},{title:'언제 다시 움직이나',desc:'다음 연락 시점',bars:whenBars},{title:'누구에게 쌓였나',desc:'담당자 · 주된 정체',rows:owners(items,defs)}],
    action:{title:'그래서 뭘 해야 하나',desc:'관계 유지에서 나온 과제',tasks:tasks(reasons(items,defs))}};
  }
  if(key==='competition'){
   const defs=[['결정 예정일 없음',x=>!x.values.decisionDate],['경쟁사 미기록',x=>!x.values.competitor],['준비 현황 미기록',x=>!x.values.preparation],['다음 할 일 없음',x=>x.row.flags.includes('missing')]];
   const nod=inGroup('nodate').length,noRival=items.filter(x=>!x.values.competitor).length,near=items.filter(x=>{const d=days(x.values.decisionDate);return d!=null&&d>=0&&d<=3;}).length,why=reasons(items,defs);
   const kind={compete:'경쟁 (PT)',imminent:'계약 임박',bidding:'입찰'},rivals=new Map();items.forEach(x=>{const c=x.values.competitor||'미기록',v=rivals.get(c)||{n:0,pos:''};v.n++;v.pos=v.pos||x.row.fields.position||'';rivals.set(c,v);});
   return {accent:'blue',kpis:[K('이 단계',n+'건','진행 금액 '+total),K('결정일 미등록',nod+'건',nod===n&&n?'모두 일정 없음':'결정 예정일 없음',nod?'bad':''),K('경쟁사 미기록',noRival+'건','누구와 붙는지 모름',noRival?'bad':''),K('3일 안 결정',near+'건','PT · 입찰 · 계약 예정',near?'warn':'')],
    cards:[{title:'무엇이 준비 안 됐나',desc:'준비 공백',bars:why},{title:'어떤 방식인가',desc:'경쟁 방식',bars:tally(items,x=>kind[x.row.code]||'경쟁 (PT)','')},{title:'누구와 붙었나',desc:'경쟁사 · 우리 위치',rows:[...rivals].sort((a,b)=>(a[0]==='미기록')-(b[0]==='미기록')||b[1].n-a[1].n).slice(0,5).map(([c,v])=>[c,v.n,c==='미기록'?'모름':v.pos||'위치 미기록'])}],
    action:{title:'그래서 뭘 해야 하나',desc:'입찰 준비에서 나온 과제',tasks:tasks(why)}};
  }
  if(key==='construction'){
   const defs=[['계약일 미입력',x=>!x.values.contractDate],['계약 금액 미입력',x=>!Number(x.values.contractAmount)],['착공일 미정',x=>!x.values.startDate]];
   const wait=inGroup('wait').length,noStart=items.filter(x=>!x.values.startDate).length,done=items.filter(x=>x.row.code==='completion').length,why=reasons(items,defs),kind={contract:'계약',construction:'시공',completion:'준공'};
   return {accent:'blue',kpis:[K('이 단계',n+'건','진행 금액 '+total),K('계약 확인 필요',wait+'건','계약일 · 금액 확인',wait?'bad':''),K('착공일 미정',noStart+'건','시공 일정 없음',noStart?'warn':''),K('준공 단계',done+'건','준공 확인 대상')],
    cards:[{title:'무엇이 비어 있나',desc:'계약 정보 공백',bars:why},{title:'어디까지 왔나',desc:'진행 상태',bars:tally(items,x=>kind[x.row.code]||'계약','')},{title:'누가 챙기나',desc:'담당자 · 주된 공백',rows:owners(items,defs)}],
    action:{title:'그래서 뭘 해야 하나',desc:'계약 · 시공 관리 과제',tasks:tasks(why)}};
  }
  if(key==='won'){
   const q=quarterStart(),dateOf=x=>String(x.values.contractDate||x.row.item.closed_at||'').slice(0,10),thisQ=items.filter(x=>dateOf(x)>=q),whyOf=x=>fieldsOf(x,'won').win_reason||'',need=inGroup('need').length,exp=inGroup('exp').length;
   const amount=x=>Number(x.values.contractAmount)||Number(x.row.amount)||0,rivals=new Map();items.forEach(x=>{const c=competitorOf(x);if(!c)return;const v=rivals.get(c)||{n:0,why:''};v.n++;v.why=v.why||whyOf(x);rivals.set(c,v);});
   const recorded=items.filter(whyOf).length,whyBars=tally(items.filter(whyOf),whyOf,'').map(([k,c])=>[k,c,money(sum(items.filter(x=>whyOf(x)===k),amount))]),gaps=[['이긴 이유 미기록',n-recorded],['계약 정보 미기록',need]];
   return {accent:'green',kpis:[K('이번 분기 수주',thisQ.length+'건','전체 '+n+'건','good'),K('수주 금액',money(sum(items,amount)),n?'평균 '+money(sum(items,amount)/n):''),K('확장 기회',exp+'건','준공 후 추가 제안 대상'),K('계약 정보 미기록',pct(need,n)+'%',need+'건 — 기록해야 반복할 수 있어요',need?'warn':'')],
    cards:[{title:'왜 이겼나',desc:'수주 요인 · 기록된 '+recorded+'건',bars:whyBars,empty:'이긴 이유가 기록된 건이 아직 없습니다'},{title:'어디서 왔나',desc:'첫 유입 경로',bars:tally(items,origin,'경로 미기록')},{title:'누구를 이겼나',desc:'경쟁사 · 이긴 이유',rows:[...rivals].sort((a,b)=>b[1].n-a[1].n).slice(0,5).map(([c,v])=>[c,v.n,v.why||'이유 미기록']),empty:'경쟁사가 기록된 수주 건이 없습니다'}],
    action:{title:'그래서 뭘 반복할까',desc:'수주 패턴에서 나온 실행 과제',tasks:tasks(whyBars.map(([k,c])=>[k,c]).concat(gaps)).map(t=>TODO[t.label]?t:Object.assign(t,{todo:'«'+t.label+'»로 이긴 방식을 다음 제안에도 반복하기',who:'영업팀'}))}};
  }
  /* 실주 */
  const q=quarterStart(),thisQ=items.filter(x=>String(x.values.lossDate||'').slice(0,10)>=q),reasonOf=x=>x.values.lossReason&&x.values.lossReason!=='미기록'?x.values.lossReason:'',recorded=items.filter(reasonOf),none=n-recorded.length;
  const whyBars=tally(recorded,reasonOf,'').map(([k,c])=>[k,c,money(sum(recorded.filter(x=>reasonOf(x)===k),amt))]),top=whyBars[0],where=x=>{const c=x.shape.cells[1];return c.tag||'';};
  const rivals=new Map();items.forEach(x=>{const c=competitorOf(x);if(!c)return;const v=rivals.get(c)||{n:0,why:new Map()};v.n++;const r=reasonOf(x);if(r)v.why.set(r,(v.why.get(r)||0)+1);rivals.set(c,v);});
  return {accent:'red',kpis:[K('이번 분기 실주',thisQ.length+'건','전체 '+n+'건',thisQ.length?'bad':''),K('실주 금액',total,'기록된 예상 금액 합'),K('가장 많은 사유',top?top[0]+' '+pct(top[1],recorded.length)+'%':'–',top?top[1]+'건 · 사유 기록 '+recorded.length+'건 중':'기록된 사유 없음',top?'bad':''),K('사유 미기록',pct(none,n)+'%',none+'건 — 기록해야 배울 수 있어요',none?'warn':'')],
   cards:[{title:'왜 졌나',desc:'실주 사유 · 기록된 '+recorded.length+'건',bars:whyBars,empty:'실주 사유가 기록된 건이 없습니다'},{title:'어디서 졌나',desc:'실주 직전 단계',bars:tally(items,where,'단계 미기록',6)},{title:'누구에게 졌나',desc:'경쟁사 · 주된 이유',rows:[...rivals].sort((a,b)=>b[1].n-a[1].n).slice(0,5).map(([c,v])=>[c,v.n,[...v.why].sort((a,b)=>b[1]-a[1])[0]?.[0]||'이유 미기록']),empty:'경쟁사가 기록된 실주 건이 없습니다'}],
   action:{title:'그래서 뭘 해야 하나',desc:'실주 패턴에서 나온 개선 과제',tasks:tasks(whyBars.map(([k,c])=>[k,c]).concat(none?[['사유 미기록',none]]:[]).sort((a,b)=>b[1]-a[1]))}};
 }
 /* 공통 그리기 */
 function bars(card){
  const list=card.bars||[];if(!list.length)return '<p class="pd-none">'+h(card.empty||'해당하는 건이 없습니다')+'</p>';
  const max=Math.max(1,...list.map(b=>b[1])),top=list.reduce((m,b)=>b[1]>m?b[1]:m,0);
  return list.map(b=>'<div class="pd-bar'+(b[1]===top?' top':'')+'"><span title="'+attr(b[0])+'">'+h(b[0])+'</span><i><em style="width:'+Math.max(4,Math.round(b[1]*100/max))+'%"></em></i><b>'+b[1]+'</b>'+(b[2]?'<small>'+h(b[2])+'</small>':'')+'</div>').join('');
 }
 function rowsHtml(card){const list=card.rows||[];if(!list.length)return '<p class="pd-none">'+h(card.empty||'해당하는 건이 없습니다')+'</p>';return list.map(r=>'<div class="pd-who"><span title="'+attr(r[0])+'">'+h(r[0])+'</span><em>'+h(r[2])+'</em><b>'+r[1]+'</b></div>').join('');}
 function render(m,opts){
  const o=opts||{},open=o.open!==false,IT=o.scope?root.ImprovementTasks:null,taskButton=o.taskButton||(IT?x=>IT.buttonHtml(o.scope,x):null);
  const kpis='<div class="pd-kpis">'+m.kpis.map(k=>'<div class="pd-kpi"><span>'+h(k.label)+'</span><b class="'+k.tone+'">'+h(k.value)+'</b><small>'+h(k.sub)+'</small></div>').join('')+'</div>';
  const cards='<div class="pd-cards">'+m.cards.map(c=>'<section class="pd-card"><header><b>'+h(c.title)+'</b><span>'+h(c.desc)+'</span></header>'+(c.rows||(!c.bars&&c.empty)?rowsHtml(c):bars(c))+(c.foot||'')+'</section>').join('')+'</div>';
  const t=m.action.tasks||[];
  const action='<section class="pd-action"><header><b>'+h(m.action.title)+'</b><span>'+h(m.action.desc)+'</span>'+(IT?IT.countHtml(o.scope):'')+'</header>'+(t.length?'<div class="pd-tasks">'+t.map((x,i)=>'<article class="pd-task" data-pd-task="'+i+'"><em>'+h(x.basis)+'</em><b>'+h(x.todo)+'</b><span>'+h(x.who)+'</span>'+(taskButton?taskButton(x,i):'')+'</article>').join('')+'</div>':'<p class="pd-none">지금 조건에서는 따로 챙길 병목이 없습니다</p>')+'</section>';
  return '<div class="pd pd-'+(m.accent||'blue')+(open?'':' shut')+'">'+(o.noToggle?'':'<button type="button" class="pd-toggle" data-pd="toggle" aria-expanded="'+open+'">단계 진단 '+(open?'접기':'펼치기')+'</button>')+kpis+(open?cards+action:'')+'</div>';
 }
 function stage(key,items,opts){try{return render(model(key,items),Object.assign({scope:'pipeline:'+key},opts||{}));}catch(e){console.warn('[진단]',e);return '';}}
 root.PipelineDiagnosis={model,render,stage,tally,reasons,money};
})(window);
