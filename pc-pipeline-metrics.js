/* 파이프라인 3지표 (2026-10-01 컨설턴트 영업 관점 2항 — 대시보드 260억/148건 · 주간 브리핑 50.7억/58건 · 가중 11.2억,
   "그래서 우리 파이프라인이 얼마냐"에 화면마다 다른 답이 나왔다)
   한 가지 정의로 3개 숫자만 만든다. 주간 브리핑·성과 분석·영업사원 관리 맨 위에 같은 띠로 보이고, 파이프라인 메뉴 숫자와 건수가 같다.
   · 전체 진행: 진행 중 영업건(수주·실주·확장 제외, 모든 연도), 예상금액 합
   · 가중 예상: 같은 건에 단계별 성사 확률(forecastProbability)을 곱한 합
   · 확정 임박: 경쟁·임박·입찰, 계약·시공 단계 건
   기존 화면의 기간별 숫자는 그대로 두고, 이 띠가 '공통 기준' 역할을 한다. 집계만 하고 저장하지 않는다. */
(function(root){
 'use strict';
 const PAGES=['brief','perf','repmanage'],NEAR=['competition','construction'];
 const h=v=>root.esc?root.esc(String(v??'')):String(v??'');
 /* filters({brand,owner})를 주면 그 화면의 필터로, 없으면 현재 전역 필터로 — 정의(진행 판정·금액·확률)는 하나 */
 function rows(filters){try{return (root.PipelineWorkspace?.rows?.(filters)||[]).filter(r=>!['won','lost','expansion'].includes(r.group));}catch(e){return [];}}
 function summary(filters){
  const live=rows(filters),amt=r=>Number(r.amount)||0,code=r=>r.code||root.dealStage?.(r.item)||'';
  const total=live.reduce((s,r)=>s+amt(r),0);
  const weighted=live.reduce((s,r)=>s+amt(r)*(Number(root.forecastProbability?.(code(r)))||0),0);
  const near=live.filter(r=>NEAR.includes(r.group));
  return {count:live.length,total,weighted,nearCount:near.length,near:near.reduce((s,r)=>s+amt(r),0),noAmount:live.filter(r=>!amt(r)).length};
 }
 const money=n=>root.fmtAmt?root.fmtAmt(n):String(n);
 function basis(){const f=root.SalesScope?.state?.()||{},b=root.G?.brand&&root.G.brand!=='전체'?root.G.brand:'전체 브랜드',o=f.owner&&f.owner!=='전체'?f.owner:'전체 담당자';return '기준: 진행 중 영업건 · 수주·실주·확장 제외 · 모든 연도 · '+b+' · '+o;}
 function html(){const s=summary(),b=basis();
  return '<span class="pm-title">파이프라인 공통 기준</span>'
   +'<div title="'+h(b)+'"><span>전체 진행</span><b>'+h(money(s.total))+'</b><small>'+s.count+'건'+(s.noAmount?' · 금액 미입력 '+s.noAmount+'건':'')+'</small></div>'
   +'<div title="'+h(b+' · 단계별 성사 확률 적용')+'"><span>가중 예상</span><b>'+h(money(s.weighted))+'</b><small>단계 확률 적용</small></div>'
   +'<div title="'+h(b+' · 경쟁·임박·입찰, 계약·시공 단계')+'"><span>확정 임박</span><b>'+h(money(s.near))+'</b><small>'+s.nearCount+'건 · 경쟁·입찰~계약</small></div>'
   +'<em>'+h(b.replace('기준: ',''))+'</em>';}
 function style(){if(document.getElementById('pm-style'))return;const s=document.createElement('style');s.id='pm-style';s.textContent='.pm-strip{display:flex;flex-wrap:wrap;align-items:stretch;gap:10px;background:#fff;border:1px solid #e2e8f1;border-radius:14px;padding:12px 14px;margin:0 0 4px}.pm-strip .pm-title{flex-basis:100%;font-size:11.5px;font-weight:800;color:#3B6CE4;letter-spacing:.02em}.pm-strip>div{flex:1 1 160px;min-width:0;border-left:3px solid #e2e8f1;padding-left:12px}.pm-strip span{display:block;font-size:11.5px;color:#596579;font-weight:700}.pm-strip b{display:block;font-size:20px;font-weight:900;font-variant-numeric:tabular-nums;margin-top:2px}.pm-strip small{display:block;font-size:11.5px;color:#727E91;margin-top:2px}.pm-strip em{flex-basis:100%;font-style:normal;font-size:11px;color:#8a97ab}';document.head.append(s);}
 /* 영업사원 관리 · 주간 브리핑 새 화면은 자체 숫자 4개가 이 띠를 대신한다 — 같은 화면에 다른 숫자가 두 번 나오지 않게 여기서만 뺀다 */
 const replaced=page=>(page==='repmanage'&&!!root.RepsV2?.enabled?.()&&root.G?.repManagerView!=='team')||(page==='brief'&&!!root.BriefV2?.enabled?.());
 function mount(page){const pg=document.getElementById('pg-'+page);if(!pg||!pg.classList.contains('on')||!root.B)return;if(replaced(page)){pg.querySelector(':scope>.pm-strip')?.remove();return;}style();let el=pg.querySelector(':scope>.pm-strip');const next=html();if(!el){el=document.createElement('section');el.className='pm-strip';el.setAttribute('aria-label','파이프라인 공통 기준');pg.prepend(el);}if(el.__html!==next){el.__html=next;el.innerHTML=next;}}
 let timer=null;
 function schedule(){if(timer)return;timer=setTimeout(()=>{timer=null;PAGES.forEach(mount);},120);}
 function boot(){PAGES.forEach(p=>{const pg=document.getElementById('pg-'+p);if(pg)new MutationObserver(schedule).observe(pg,{childList:true,subtree:true,attributes:true,attributeFilter:['class']});});schedule();}
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
 root.PipelineMetrics={summary,basis};
})(window);
