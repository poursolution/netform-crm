/* 고객 자산 · 월간 리포트 새 기준 연결 (2026-10-07 design_handoff_asset_report · 시안 '고객 자산 · 리포트 기준 연결 시안.dc.html')
   배치는 그대로 — 숫자 · 판단 문구 · 단계명만.
   ① AssetReport  고객 자산 관계 기준을 관계관리 상태별 주기(relationship_v12 와 같은 함수 RelV12.state · PipelineJudge.basis)로 — '진행 중 단지 30일 안에 한 번 연락' 삭제.
        재접촉 필요 = 진행 중 영업건 가운데 상태별 기한(고객 약속일 우선)을 넘긴 단지 · 분류가 안 된(미확인) 건은 재접촉 대상에서 빼고 '분류 보완'
        관계위험 → '반복 실주'(같은 단지 실주 2회 이상 · 수주 없음) · '관계위험'은 실주 원인이 관계 · 소장 변경으로 입력된 곳만
   ② ReportCheck  월간 리포트 내보내기(PDF · 잔디) 전 보고서 검증 5가지: 집계 기준 일치 · 미확인 데이터 포함 · 표본 부족 · 공식 단계명 · 판단 문구 근거.
        걸린 항목은 [문장 보기] → 리포트 안 해당 문장에 노란 밑줄 · [고친 뒤 다시 확인] · [주의 표시 붙여 보내기](주의 문구가 보고서 하단 · 보내는 글 끝에 붙음)
   끄기: G.assetReportOff=true → 예전 기준 */
(function(root){
 'use strict';
 const R=root,h=v=>R.esc(String(v==null?'':v));
 const on=()=>!(R.G&&R.G.assetReportOff);
 const J=()=>R.PipelineJudge&&R.PipelineJudge.on()?R.PipelineJudge:null;
 /* ── ① 관계 기준 · 단지 건강 ── */
 function cycleRows(){
  let q={focusMonths:1,focus:7,month:30,wait:60};try{q=R.RelV12.rules();}catch(e){}
  return [['집중','견적 후 '+q.focus+'일 후속'],['일반','월 1회'],['대기',Math.round(q.wait/30)+'개월 1회'],['보류','재검토일'],['미확인','분류 보완 · 재접촉 대상에서 제외']];
 }
 let WS=null;
 const wsMap=()=>{if(WS&&Date.now()-WS.at<1500)return WS.map;const m=new Map();try{R.PipelineWorkspace.rows({unscoped:true}).forEach(r=>m.set(String(r.key),r));}catch(e){}WS={at:Date.now(),map:m};return m;};
 /* 한 단지의 열린 영업건이 상태별 주기를 넘겼나(late) · 분류 보완 대상인가(fix) */
 function relOf(s){
  let late=0,fix=0;const j=J(),map=wsMap();
  (s.open||[]).forEach(d=>{
   let g='';try{g=R.PipelineStages.group(R.dealStage(d))||'';}catch(e){}
   if(g==='relationship'){const row=map.get(String(d.id||R.dealKey(d)));if(row){try{const st=R.RelV12.state(row);if(st.key==='unk')fix++;else if(st.od)late++;}catch(e){}}return;}
   try{if(j&&j.isLate(j.basis(d,g)))late++;}catch(e){}
  });
  return {late,fix};
 }
 /* 단지 건강(siteHealth)을 새 기준으로 다시 가린다. 한 번 가린 단지는 표시(__ar)를 달아 다시 하지 않는다 — 자료가 바뀌면 단지 목록이 새로 만들어진다 */
 function adjust(rows){
  if(!on()||!rows)return rows;
  rows.forEach(s=>{
   if(!s||s.__ar)return;s.__ar=1;
   const rep=(s.lost||[]).length>=2&&!(s.won||[]).length;s.repeatLoss=rep;
   const r=(s.open||[]).length?relOf(s):{late:0,fix:0};s.relLate=r.late;s.relFix=r.fix;s.baseHealth=s.health;
   if(s.health==='risk'&&!rep)s.health=r.late?'recontact':(s.open||[]).length?'active':'dormant';/* '관계위험'은 반복 실주만 — 열린 건 90일 무활동은 상태별 주기로 판단 */
   else if(s.health==='recontact'&&(s.open||[]).length&&!r.late)s.health='active';/* 30일 규칙으로 재접촉이던 단지는 상태별 기한을 안 넘겼으면 활성 */
   else if(s.health==='active'&&r.late)s.health='recontact';
  });
  return rows;
 }
 function bootAsset(){
  const base=R.siteMasterData;if(typeof base!=='function'||base.__ar)return;
  const w=function(){const rows=base.apply(this,arguments);try{adjust(rows);}catch(e){console.warn('[고객 자산 기준]',e);}return rows;};w.__ar=true;R.siteMasterData=w;
 }
 /* ── ② 보고서 검증 ── */
 const OLD_STAGE=/입찰단계|공사\s?임박|경쟁\(PT\)|착공\s?준비|초기\s?집중관리|응대·현장파악|견적서 발송완료/;
 const JUDGE=/이탈|관리부하|조치 필요|관계위험/;
 const leafs=art=>[...art.querySelectorAll('span,b,p,small,div,em,h1')].filter(n=>!n.children.length&&n.textContent.trim());
 /* 괄호 안 세부 상태는 단계명이 아니다 — 괄호를 걷어 낸 글에서 옛 이름을 찾는다 */
 const noParen=s=>String(s||'').replace(/\([^)]*\)/g,'');
 function run(x,art){
  const out=[],c=x.cur,P=x.P,B=R.BriefB.lib;
  /* 1 집계 기준 일치 */
  let dq=null;try{dq=R.DashB&&R.DashB.monthQ?R.DashB.monthQ(P.a,P.b):null;}catch(e){}
  const diff=dq==null?0:Math.abs(dq-c.q.length);
  out.push({k:'inq',ok:dq==null||!diff,l:'집계 기준 일치',d:dq==null?P.m+'월 문의 리포트 '+c.q.length+'건 · 대시보드 값을 읽지 못해 비교 못 함':P.m+'월 문의 대시보드 '+dq+' · 리포트 '+c.q.length+(diff?' · 차이 '+diff:' · 같은 조건'),sel:['[data-rbs="inq"]']});
  /* 2 미확인 데이터 포함 */
  /* 미확인 데이터: 과거 이관 · 미정리가 전망에 섞임 / 실주 사유 미기록 / 종결 사유 미확인 / 기한 미등록 후반 단계(날짜 확인 전 · 전망 합계 밖) */
  const eok=n=>{n=Number(n)||0;return (n/1e8).toFixed(1).replace(/\.0$/,'')+'억';},sum=l=>l.reduce((s,n)=>s+n.amount,0),lg=(x.near||[]).filter(n=>n.legacy),und=x.undated||[];
  let noReason=0,unkClose=0;try{noReason=(c.loss||[]).filter(d=>/사유 미기록/.test(B.lossReason(d))).length;}catch(e){}try{unkClose=R.ExecWording&&R.ExecWording.on()?R.ExecWording.closeSplit(c.bad||[]).unknown:0;}catch(e){}
  const mp=[lg.length?'과거 이관 · 미정리 '+lg.length+'건('+eok(sum(lg))+')이 전망 합계에 들어감':'',noReason?'실주 사유 미기록 '+noReason+'건':'',unkClose?'종결 사유 미확인 '+unkClose+'건':'',und.length?'기한 미등록 후반 단계 '+und.length+'건('+eok(sum(und))+')은 날짜 확인 전 · 전망 합계에서 제외':''].filter(Boolean);
  out.push({k:'near',ok:!mp.length,l:'미확인 데이터 포함',d:mp.length?mp.join(' · '):'미확인 데이터 없음 · 전망은 날짜 확인된 건만',sel:['[data-rbs="near"]']});
  /* 3 표본 부족 */
  const low=x.resN<5&&x.made!=null;
  out.push({k:'made',ok:!low,l:'표본 부족',d:x.made==null?'메이드율을 계산할 결과가 없음':'메이드율 · 결과 확정 '+x.resN+'건'+(low?' · 5건 미만 — 추세 판단 제한':''),sel:['[data-rbs="made"]']});
  /* 4 공식 단계명 */
  const bad=art?leafs(art).filter(n=>OLD_STAGE.test(noParen(n.textContent))):[];
  out.push({k:'stage',ok:!bad.length,l:'공식 단계명',d:bad.length?'공식 7단계 이름이 아닌 단계 이름 '+bad.length+'곳 · '+[...new Set(bad.map(n=>(OLD_STAGE.exec(noParen(n.textContent))||[''])[0]))].join(' · '):'7단계 이름만 사용',els:bad});
  /* 5 판단 문구 근거 */
  const jd=art?leafs(art).filter(n=>JUDGE.test(n.textContent)&&!n.closest('[data-ew-why]')):[];
  out.push({k:'judge',ok:!jd.length,l:'판단 문구 근거',d:jd.length?'근거가 연결되지 않은 판정 문구 '+jd.length+'곳':'모든 판정 문구에 근거 연결됨',els:jd});
  return out;
 }
 const FLAG='rb-flag';
 function clearFlags(art){if(art)art.querySelectorAll('.'+FLAG).forEach(n=>n.classList.remove(FLAG));}
 function mark(art,it){
  clearFlags(art);if(!art||!it)return false;
  const els=it.els&&it.els.length?it.els:(it.sel||[]).flatMap(s=>[...art.querySelectorAll(s)]);
  els.forEach(n=>n.classList.add(FLAG));if(els[0]&&els[0].scrollIntoView)try{els[0].scrollIntoView({block:'center',behavior:'smooth'});}catch(e){}
  return !!els.length;
 }
 const cautionOf=items=>items.filter(i=>!i.ok).map(i=>i.l+' — '+i.d).join(' / ');
 function panelHtml(items,action){
  const bad=items.filter(i=>!i.ok).length;
  return '<section class="rb-check" aria-label="보고서 검증"><div class="rb-ch"><b>보고서 검증 · 내보내기 전</b><span>'+(action==='send'?'[대표님께 보내기]':'[PDF로 저장]')+' 전에 먼저 봅니다 · 문제 문장은 리포트 안에 노란 밑줄</span></div>'
   +items.map((i,n)=>'<div class="rb-cr"><span class="mk '+(i.ok?'ok':'no')+'" aria-hidden="true">'+(i.ok?'✓':'!')+'</span><div><b>'+h(i.l)+'</b><span>'+h(i.d)+'</span></div>'+(i.ok?'':'<button type="button" class="lnk" data-rb="flag" data-i="'+n+'">문장 보기</button>')+'</div>').join('')
   +'<div class="rb-cb"><span>'+(bad?'걸린 항목 '+bad+'개':'모두 통과')+'</span><i></i><button type="button" data-rb="recheck">고친 뒤 다시 확인</button><button type="button" class="pri" data-rb="caution">'+(bad?'주의 표시 붙여 '+(action==='send'?'보내기':'저장'):(action==='send'?'보내기':'저장'))+'</button></div></section>';
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bootAsset);else bootAsset();
 root.AssetReport={on,cycleRows,adjust,relOf};
 root.ReportCheck={run,mark,clearFlags,panelHtml,cautionOf,OLD_STAGE};
})(window);
