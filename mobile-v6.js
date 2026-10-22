/* 모바일 v6 1단계 (2026-10-22 docs/CLAUDE_MOBILE_DIRECTION_20261022.md · 대표 "파트너스 앱 흐름 차용 — 그대로 말고 흐름만")
   흐름 = 홈에서 숫자로 상황 → 누르면 그 목록 → 상세 맨 위에서 지금 몇 단계 · 언제 누가 바꿨나. 색 · 용어 · 판정은 지금 CRM 것 그대로.
   ① 오늘 맨 위 요약: 기한 지남 · 내 담당 · 오늘 방문(+관리자 겸직만 미배정). 숫자는 화면에 이미 있는 자료에서만, 0 이면 '아직 없음'. 붉은 계열은 기한 지남만.
   ② 영업건 상세 진행: CRM 진행상태 6칸(PipelineStages 컨설팅 설계 → … → 수주) 바 + 단계 이력(stage_history: 바뀐 단계 · 시각 · 누가 · 사유).
      실주는 바 대신 '실주' 표시. 가벼운 첫 조회(crm_mobile_today_v1 · mobile_today_partial)만 온 동안은 '불러오는 중'.
   끄기: G.mobileV6Off=true → 요약 · 진행 칸 없이 지금 v5 화면 그대로. */
(function(root,factory){const api=factory(root);if(typeof module==='object'&&module.exports)module.exports=api;else root.MobileV6=api;})(typeof window!=='undefined'?window:globalThis,function(w){
 'use strict';
 const h=v=>String(v==null?'':v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const on=()=>!(w.G&&w.G.mobileV6Off);
 const STEPS=['consulting','sent','relationship','competition','construction','won'];
 const HISTORY_MAX=5;

 /* ── ① 오늘 요약 ── n = {late, mine, visit, unassigned(관리자만, 아니면 null)} */
 function summary(n){
  const cell=(key,label,v,go,red)=>({key,label,value:Number(v)||0,go,red:!!red&&Number(v)>0});
  /* 기한 지남 = 바로 아래 카드 · 줄이 그 목록(누를 곳 없음). 내 담당 → 내 현장 탭, 오늘 방문 → 오늘 동선 */
  const cells=[cell('late','기한 지남',n.late,null,true),cell('mine','내 담당',n.mine,{gs:'tab',tab:'mine'}),cell('visit','오늘 방문',n.visit,{mr:'view',v:'route'})];
  if(n.unassigned!=null)cells.push(cell('unassigned','미배정',n.unassigned,null));
  return {cells};
 }
 function summaryHtml(m){
  const go=g=>!g?'':g.mr?' data-mr="'+h(g.mr)+'" data-v="'+h(g.v)+'" role="button" tabindex="0"':' data-gs="'+h(g.gs)+'"'+(g.tab?' data-tab="'+h(g.tab)+'"':'')+(g.value?' data-value="'+h(g.value)+'"':'')+' role="button" tabindex="0"';
  return '<div class="mv6-sum" style="grid-template-columns:repeat('+m.cells.length+',1fr)" aria-label="오늘의 업무 현황">'+m.cells.map(c=>'<span class="mv6-cell'+(c.red?' red':'')+(c.value?'':' none')+'" data-v6="'+h(c.key)+'"'+go(c.go)+'><b>'+(c.value?h(c.value):'아직 없음')+'</b><small>'+h(c.label)+'</small></span>').join('')+'</div>';
 }

 /* ── ② 상세 진행 ── */
 const P=()=>w.PipelineStages;
 function stageName(code){
  const S=P(),def=S&&S.definition(S.group(code));
  if(def)return def.label;
  try{return w.stageLabel?w.stageLabel(code):String(code||'');}catch(e){return String(code||'');}
 }
 /* PC deal-prep.js history() 와 같은 정리: 같은 단계 · 같은 날은 한 번, 최근 것 먼저 */
 function history(d){
  const raw=[].concat(Array.isArray(d.stageHistory)?d.stageHistory:[],Array.isArray(d.stage_history)?d.stage_history:[]),seen=new Set();
  return raw.filter(x=>x&&(x.to||x.to_stage)).map(x=>({to:String(x.to||x.to_stage),at:String(x.at||x.changed_at||''),who:String(x.actor||x.actor_name||''),why:String(x.reason||'')}))
   .filter(x=>{const k=x.to+'|'+x.at.slice(0,10);if(seen.has(k))return false;seen.add(k);return true;})
   .sort((a,b)=>b.at.localeCompare(a.at)).map(x=>Object.assign(x,{label:stageName(x.to)}));
 }
 function progress(d){
  const S=P();if(!S||!d)return null;
  const key=S.group(d.code,d.outcome),lost=key==='lost',cur=key==='expansion'?STEPS.length-1:STEPS.indexOf(key);
  const steps=STEPS.map((k,i)=>({key:k,label:S.definition(k).label,state:lost||cur<0?'':i<cur?'done':i===cur?'cur':''}));
  const all=history(d),loading=!all.length&&d.mobile_today_partial===true;
  const since=!all.length&&!loading&&d.stage_entered_at?[{to:d.code,at:String(d.stage_entered_at),who:'',why:'',label:stageName(d.code),entered:true}]:[];
  const rows=(all.length?all:since).slice(0,HISTORY_MAX);
  return {lost,current:lost?S.definition('lost').label:cur>=0?steps[cur].label:stageName(d.code),steps,rows,older:Math.max(0,all.length-HISTORY_MAX),loading};
 }
 const day=v=>{const s=String(v||'').slice(0,10);return /^\d{4}-\d{2}-\d{2}$/.test(s)?s.slice(0,4)+'.'+s.slice(5,7)+'.'+s.slice(8,10):'';};
 const time=v=>{const n=Date.parse(v);if(!/T\d/.test(String(v))||!Number.isFinite(n))return '';const t=new Date(n+9*36e5);return String(t.getUTCHours()).padStart(2,'0')+':'+String(t.getUTCMinutes()).padStart(2,'0');};
 function progressHtml(m){
  if(!m)return '';
  const bar=m.lost?'<span class="mv6-lost">실주로 끝난 영업건입니다</span>':'<ol class="mv6-bar">'+m.steps.map(s=>'<li class="'+s.state+'"'+(s.state==='cur'?' aria-current="step"':'')+'><i></i><span>'+h(s.label)+'</span></li>').join('')+'</ol>';
  const rows=m.loading?'<p class="mv6-none">단계 이력을 불러오는 중입니다</p>':m.rows.length?'<ul class="mv6-tl">'+m.rows.map(r=>'<li><b>'+h(r.label)+(r.entered?' 진입':'')+'</b><span>'+h([day(r.at)+(time(r.at)?' '+time(r.at):''),r.who].filter(Boolean).join(' · ')||'날짜 미기록')+'</span>'+(r.why?'<small>'+h(r.why)+'</small>':'')+'</li>').join('')+'</ul>'+(m.older?'<p class="mv6-none">이전 '+m.older+'건은 PC 상세 \'단계 이력\'에 있습니다</p>':''):'<p class="mv6-none">단계 변경 기록이 없습니다</p>';
  return '<section class="mv6-prog" aria-label="진행 단계"><header><b>진행 단계</b><span>'+h(m.current)+'</span></header>'+bar+rows+'</section>';
 }
 return Object.freeze({on,summary,summaryHtml,progress,progressHtml,history,STEPS});
});
