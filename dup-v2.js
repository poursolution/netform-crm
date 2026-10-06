/* 데이터 정리 · 검토 v2 (2026-10-02 디자인 핸드오프 'design_handoff_dup') — 데이터 정리 · 검토 메뉴(#p=dup)만.
   목록: 안내 줄(확실 · 애매 · 다른 건 · 처리 완료) → 진단(숫자 4 · 카드 3 · '다시 안 생기게' 과제) → 판단 띠 → 묶음 표(확실 → 애매 → 다른 건)
   비교 창(760px): 판단 박스 + A | B 비교 표(다른 값은 노란 칸) + [그대로 두기] [연결만] [합치기]
   후보 계산 · "왜 잡혔나요" 근거 · [후보 다시 계산] · 처리 이력은 기존 그대로(CleanupCore · DataCleanupUI).
   ※ 판단은 지금은 규칙(근거 조합)이다 — 확률(%)을 지어내지 않고 확실 / 애매 / 다른 건으로만 나눈다. Claude API 판단은 서버 함수 설치 뒤에 바꿔 끼운다(결과는 저장만).
   ※ 실제 합치기 · 연결은 기존 서버 경로(미리보기 → 확인 → 처리)가 운영에서 켜졌을 때만, 한 건씩, 사유를 적고 한다. 한 번에 승인 · 30일 되돌리기는 구조 확인 뒤에 연다(지금은 잠김).
   끄기: G.dupV2Off=true → 예전 화면. */
(function(root){
 'use strict';
 const h=v=>root.esc(String(v==null?'':v)),attr=v=>root.escAttr(String(v==null?'':v));
 const enabled=()=>!root.G.dupV2Off&&!!root.DataCleanupUI&&typeof root.DataCleanupUI.active==='function';
 const KIND={site:'현장',inquiry:'문의',contact:'연락처',deal:'영업기회'};
 const BAND={sure:['확실 · 같은 건','g','#30a46c','근거가 겹쳐 같은 건으로 보이는 쌍'],maybe:['애매 · 확인 필요','a','#f5a524','사람이 비교해서 정해야 하는 쌍'],diff:['다른 건','m','#9ca3af','겹쳐 보이지만 따로 두는 것이 맞는 쌍']};
 const SUGGEST={site_merge:'합치기',inquiry_merge:'합치기',deal_review:'비교 후 판단',site_link:'연결만',inquiry_activity:'연결만',contact_move:'사람 · 근무지 확인',separate:'그대로 두기',different_person:'그대로 두기',defer:'정보 보완 뒤 판단'};
 const GRID='minmax(0,1.7fr) 110px minmax(0,1.5fr) 110px 84px';
 const st=()=>root.G.dupV2||(root.G.dupV2={f:'all',more:{}});
 /* 규칙 판단: 근거가 몇 개 겹치는지로 묶음만 정한다 */
 function judge(c){
  const R=c.reasons||[],has=t=>R.some(x=>x.indexOf(t)>=0),strong=[has('주소 동일'),has('관리사무소 전화 동일'),has('현장명 표기 일치'),has('1일 이내 문의 접수'),has('관리소장 휴대전화 동일')].filter(Boolean).length;
  if(c.action==='separate')return 'diff';
  if(c.action==='inquiry_merge')return strong>=2?'sure':'maybe';
  if(c.action==='site_merge')return has('주소 동일')&&(has('관리사무소 전화 동일')||has('현장명 표기 일치'))?'sure':'maybe';
  if(c.action==='site_link')return has('주소 동일')?'sure':'maybe';
  return 'maybe';
 }
 function model(){
  const U=root.DataCleanupUI,cases=U.active().map(c=>({c,i:U.cases().indexOf(c),band:judge(c)})),reviews=((U.state()||{}).reviews||[]).filter(r=>r.action!=='defer');
  return {cases,reviews,readOnly:U.readOnly(),loading:U.loading()};
 }
 const pairKind=c=>{const t=x=>x.ref.type==='inquiry'?'문의':x.ref.type==='deal'?'영업기회':'현장',a=[t(c.a),t(c.b)].sort();return a[0]===a[1]?a[0]+'끼리':a.join(' ↔ ');};
 function diagnosis(m){
  const D=root.PipelineDiagnosis;if(!D)return '';
  const n=k=>m.cases.filter(x=>x.band===k).length,by=(f)=>{const map=new Map();m.cases.forEach(x=>{const k=f(x.c);if(k)map.set(k,(map.get(k)||0)+1);});return [...map].sort((a,b)=>b[1]-a[1]);};
  const why=[['1일 내 재접수',m.cases.filter(x=>x.c.reasons.some(r=>r.includes('1일 이내'))).length],['표기 차이(이름만 비슷)',m.cases.filter(x=>x.c.reasons.some(r=>r.includes('현장명 유사'))).length],['같은 주소로 따로 등록',m.cases.filter(x=>x.c.reasons.some(r=>r.includes('주소 동일'))).length],['같은 전화로 따로 등록',m.cases.filter(x=>x.c.reasons.some(r=>r.includes('전화 동일'))).length]].filter(x=>x[1]>0).sort((a,b)=>b[1]-a[1]);
  const K=(label,value,sub,tone)=>({label,value,sub,tone:tone||''}),inq=m.cases.filter(x=>x.c.type==='inquiry'&&x.c.action==='inquiry_merge').length,site=m.cases.filter(x=>x.c.type==='site').length;
  const tasks=[[inq,'같은 전화 · 1일 내 재접수 '+inq+'건','7일 내 같은 전화로 온 문의는 기존 건에 연결되게 접수 규칙 정하기','관리팀 · 이번 주','문의 재접수'],[site,'현장 겹침 '+site+'건','현장을 등록할 때 주소로 기존 현장을 먼저 찾아보기','영업팀 · 등록할 때','현장 중복 등록'],[n('maybe'),'애매한 건 '+n('maybe')+'건','애매한 건은 주 1회 10분 검토','관리팀 · 매주','애매한 건 검토']].filter(t=>t[0]>0).map(t=>({basis:t[1],todo:t[2],who:t[3],label:t[4],count:t[0]}));
  return D.render({accent:'blue',
   kpis:[K('검토 후보',m.cases.length+'건','쌍 기준 · 지금 불러온 자료'),K('확실',n('sure')+'건','근거가 겹침','good'),K('애매',n('maybe')+'건','사람이 비교',n('maybe')?'warn':''),K('다른 건',n('diff')+'건','따로 두기')],
   cards:[{title:'무엇이 겹치나',desc:'종류별 쌍',bars:by(c=>KIND[c.type]),empty:'겹치는 후보가 없습니다'},{title:'왜 생기나',desc:'잡힌 근거',bars:why,empty:'근거가 없습니다'},{title:'생기는 곳',desc:'어느 자료끼리',bars:by(pairKind),empty:'후보가 없습니다'}],
   action:{title:'다시 안 생기게',desc:'데이터 정리에서 나온 과제',tasks}},{open:true,noToggle:true,scope:'dup'});
 }
 function rowHtml(x){
  const c=x.c,b=BAND[x.band],cta=x.band==='sure'?'승인':x.band==='maybe'?'비교하기':'확인';
  return '<div class="plv-row" role="row" tabindex="0" data-dv="open" data-value="'+x.i+'" style="grid-template-columns:'+GRID+'"><span class="plv-c plv-site"><b title="'+attr(c.a.name+' ↔ '+c.b.name)+'">'+h(c.a.name)+' <i class="dv-arrow">↔</i> '+h(c.b.name)+'</b><small>'+h(KIND[c.type]||c.type)+' · '+h(pairKind(c))+'</small></span>'
   +'<span class="plv-c"><em class="plv-tag '+b[1]+'">'+h(b[0].split(' · ')[0])+'</em></span><span class="plv-c"><span title="'+attr(c.reasons.join(' · '))+'">'+h(c.reasons.join(' · '))+'</span></span><span class="plv-c"><em class="plv-tag m">'+h(SUGGEST[c.action]||c.action)+'</em></span>'
   +'<button type="button" class="plv-cta" data-dv="open" data-value="'+x.i+'">'+cta+'</button></div>';
 }
 function listHtml(m){
  const S=st(),n=k=>m.cases.filter(x=>x.band===k).length;
  const pills='<div class="plv-pills" role="group" aria-label="판단">'+[['all','전체',m.cases.length],['sure','확실 · 같은 건',n('sure')],['maybe','애매 · 확인 필요',n('maybe')],['diff','다른 건',n('diff')],['done','처리 완료',m.reviews.length]].map(([v,t,c])=>'<button type="button" data-dv="filter" data-value="'+v+'" aria-pressed="'+(S.f===v)+'">'+h(t)+' <b>'+c+'</b></button>').join('')+'</div>';
  const intro='<div class="plv-intro"><i style="background:#64748b"></i><b>데이터 정리 · 검토</b><span>먼저 판단해 둡니다 — 확실한 건은 빨리 승인, 애매한 건만 사람이 봅니다</span><div class="plv-spacer"></div>'+pills+'<button type="button" class="sv-ghost" data-dv="refresh">'+(m.loading?'확인 중…':'후보 다시 계산')+'</button></div>';
  const band='<section class="dv-band"><div><b>'+m.cases.length+'건 중 '+n('sure')+'건은 같은 건이 확실해요. 사람이 볼 건 '+n('maybe')+'건입니다</b><span>규칙 판단(근거 조합)입니다 · 승인하기 전에는 데이터가 바뀌지 않습니다'+(m.readOnly?' · 지금은 검토 전용 — 합치기 · 연결은 운영 확인 뒤 관리자만 켭니다':'')+'</span></div><button type="button" disabled title="한 번에 승인과 30일 되돌리기는 구조 확인 뒤에 열립니다">확실한 '+n('sure')+'건 한 번에 승인</button></section>';
  let table;
  if(S.f==='done')table='<div class="plv-table" role="table" aria-label="처리 이력"><div class="plv-ghead"><i style="background:#30a46c"></i><b>처리 완료</b><span>'+m.reviews.length+'건</span><small>· 서버에 남은 처리 이력</small></div>'+(m.reviews.length?m.reviews.map(r=>'<div class="dv-hist"><b>'+h(r.source_name)+' → '+h(r.target_name)+'</b><span>'+h(SUGGEST[r.action]||r.action)+' · '+h(r.actor||'')+' · '+h(String(r.created_at||'').slice(0,10))+'</span><small>'+h(r.note||'')+'</small></div>').join(''):'<div class="plv-empty">서버에 확인된 처리 이력이 없습니다</div>')+'</div>';
  else{
   const head='<div class="plv-thead" role="row" style="grid-template-columns:'+GRID+'"><span>대상 (A ↔ B) · 종류</span><span>판단</span><span>근거</span><span>제안</span><span></span></div>';
   const groups=['sure','maybe','diff'].filter(k=>S.f==='all'||S.f===k).map(k=>{const b=BAND[k],list=m.cases.filter(x=>x.band===k),__pg=root.ListPager.cut(list,(S.more[k]||0)+1),shown=__pg.rows,rest=list.length-shown.length;return '<div class="plv-ghead" data-plv-group="'+k+'"><i style="background:'+b[2]+'"></i><b>'+h(b[0])+'</b><span>'+list.length+'건</span><small>· '+h(b[3])+'</small></div>'+(shown.length?shown.map(rowHtml).join(''):'<div class="plv-empty">해당하는 건이 없습니다</div>')+root.ListPager.html(__pg,{ns:'dv',attrs:'data-value="'+k+'"',small:true});}).join('');
   table='<div class="plv-table" role="table" aria-label="중복 후보">'+head+groups+'</div>';
  }
  return intro+diagnosis(m)+band+table;
 }
 /* ── 비교 창 ── */
 function fields(c){
  const typ=r=>r.ref.type==='inquiry'?'문의':r.ref.type==='deal'?'영업기회':'현장',amt=r=>r.raw&&r.raw.amt!=null&&typeof root.fmtAmt==='function'&&Number(r.raw.amt)?root.fmtAmt(r.raw.amt):'',hh=r=>r.raw&&(r.raw.household_count||r.raw.households||r.raw.unit_count)||'';
  const F=[['종류',typ],['이름',r=>r.name],['주소',r=>r.address],['관리사무소 전화',r=>r.office?root.phoneFmt(r.office):''],['관리소장 · 휴대전화',r=>[r.customer,r.mobile?root.phoneFmt(r.mobile):''].filter(Boolean).join(' · ')],['세대수',hh],['담당',r=>r.owner||r.consultant],['사업유형',r=>r.brand],['공종',r=>(r.works||[]).join(' · ')],['단계',r=>{try{return r.ref.type==='deal'?root.stageLabel(root.dealStage(r.raw)):(r.raw&&(r.raw.status||r.raw.stage_name)||'');}catch(e){return '';}}],['금액',amt],['등록',r=>String(r.at||'').slice(0,10)]];
  return F.map(([label,f])=>{const a=String(f(c.a)||''),b=String(f(c.b)||'');return {label,a,b,diff:root.CleanupCore.norm(a)!==root.CleanupCore.norm(b)};}).filter(x=>x.a||x.b);
 }
 function node(){
  let m=document.getElementById('dupDialog');if(m)return m;
  m=document.createElement('div');m.id='dupDialog';m.className='dv-layer';m.innerHTML='<section class="dv-box" role="dialog" aria-modal="true" aria-labelledby="dvTitle"></section>';
  m.addEventListener('mousedown',e=>{if(e.target===m)close();});m.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();close();}});
  m.addEventListener('click',e=>{const b=e.target.closest('[data-dd]');if(!b||b.disabled)return;const a=b.dataset.dd,i=Number(m.dataset.i);if(a==='close')return close();close();root.DataCleanupUI.open(i,a);});
  document.body.append(m);return m;
 }
 let focusBack=null;
 function close(){const m=document.getElementById('dupDialog');if(m)m.classList.remove('on');const f=focusBack;focusBack=null;if(f&&f.isConnected)f.focus?.({preventScroll:true});}
 function open(i){
  const U=root.DataCleanupUI,c=U.cases()[i];if(!c)return;const band=judge(c),b=BAND[band],ro=U.readOnly(),F=fields(c);
  const act=c.type==='contact'?{keep:'different_person',link:'',merge:'contact_move'}:c.type==='inquiry'?{keep:'separate',link:'inquiry_activity',merge:'inquiry_merge'}:c.type==='deal'?{keep:'separate',link:'site_link',merge:'deal_review'}:{keep:'separate',link:'site_link',merge:'site_merge'};
  const older=Date.parse(c.a.at)<=Date.parse(c.b.at)||!Number.isFinite(Date.parse(c.b.at))?'A':'B';
  const m=node();focusBack=document.activeElement;m.dataset.i=String(i);
  m.querySelector('.dv-box').innerHTML='<header class="dv-head"><div><small>'+h(KIND[c.type]||c.type)+' 비교</small><h2 id="dvTitle">'+h(c.a.name)+' ↔ '+h(c.b.name)+'</h2></div><button type="button" class="xdv-close" data-dd="close" aria-label="닫기">✕</button></header>'
   +'<div class="dv-body"><section class="dv-judge '+b[1]+'"><b>판단 · '+h(b[0])+'</b><span>근거: '+h(c.reasons.join(' · '))+'</span><span>제안: '+h(SUGGEST[c.action]||c.action)+' — '+h(c.text)+'</span><small>규칙 판단입니다(근거 조합). 확률은 표시하지 않습니다.</small>'+(root.OpsStore&&root.OpsStore.aiOn()?'<button type="button" class="dv-ai" data-dd-ai="1">✦ AI 판단 받기</button><span class="dv-aiout" id="dvAiOut"></span>':'')+'</section>'
   +'<div class="dv-cmp" role="table" aria-label="A B 비교"><div class="dv-ch" role="row"><span></span><b>A</b><b>B</b></div>'+F.map(f=>'<div role="row" class="'+(f.diff?'diff':'')+'"><span>'+h(f.label)+'</span><em>'+h(f.a||'–')+'</em><em>'+h(f.b||'–')+'</em></div>').join('')+'</div>'
   +'<p class="dv-note">합치면 '+older+'(먼저 등록)를 남기고 다른 쪽의 기록은 활동으로 옮깁니다. 어떤 원본도 지우지 않습니다.'+(ro?' <b>지금은 검토 전용이라 아래 버튼이 잠겨 있습니다 — 합치기 · 연결이 필요하면 관리자에게 알려 주세요.</b>':' 버튼을 누르면 서버의 최신 원본으로 결과를 미리 본 뒤, 사유를 적고 처리합니다.')+'</p></div>'
   +'<footer class="dv-foot"><button type="button" class="dv-ghost" data-dd="'+act.keep+'"'+(ro?' disabled':'')+'>다른 건 · 그대로 두기</button>'+(act.link?'<button type="button" class="dv-ghost" data-dd="'+act.link+'"'+(ro?' disabled':'')+'>연결만</button>':'')+'<button type="button" class="dv-primary" data-dd="'+act.merge+'"'+(ro?' disabled':'')+'>'+(c.type==='contact'?'같은 사람 · 이동 연결':c.type==='deal'?'같은 건 · 비교 후 처리':'같은 건 · 합치기')+'</button></footer>';
  const aiB=m.querySelector('[data-dd-ai]');if(aiB)aiB.onclick=()=>{const out=m.querySelector('#dvAiOut');aiB.disabled=true;aiB.textContent='AI가 비교하는 중…';const row=k=>Object.fromEntries(F.map(f=>[f.label,f[k]]));
   root.OpsStore.ai('dup_judge','pair',c.key,{a:row('a'),b:row('b'),rule_reasons:c.reasons}).then(s=>{const r=s.suggestion||{};out.textContent='AI 판단 · 같은 건일 가능성 '+r.probability+'% · '+(r.basis||'')+' · 제안: '+({merge:'합치기',link:'연결만',keep:'그대로 두기'}[r.action]||'그대로 두기')+' (참고용 — 처리는 아래 버튼으로 직접)';aiB.textContent='✦ AI 판단 다시 받기';}).catch(e=>{out.textContent=String(e.message||e);aiB.textContent='✦ AI 판단 받기';}).finally(()=>{aiB.disabled=false;});};
  m.classList.add('on');m.querySelector('.xdv-close').focus();
 }
 function host(){
  const base=document.getElementById('dups');if(!base)return null;let el=document.getElementById('dup-v2');
  if(!el){el=document.createElement('div');el.id='dup-v2';el.className='plv';el.dataset.workspace='dup';base.before(el);el.addEventListener('click',onClick);el.addEventListener('keydown',e=>{if((e.key==='Enter'||e.key===' ')&&e.target.classList?.contains('plv-row')){e.preventDefault();e.target.click();}});}
  return el;
 }
 function onClick(e){
  const b=e.target.closest('#dup-v2 [data-dv]');if(!b)return;const S=st(),a=b.dataset.dv,v=b.dataset.value;
  if(a==='filter'){S.f=v;S.more={};return root.DataCleanupUI.render();}
  if(a==='page'){S.more[v]=(Number(b.dataset.page)||1)-1;return root.DataCleanupUI.render();}
  if(a==='refresh')return root.DataCleanupUI.refresh();
  if(a==='open')return open(Number(v));
 }
 function boot(){
  const U=root.DataCleanupUI;if(!U||typeof U.render!=='function'||typeof U.active!=='function')return;
  /* 기존 목록이 그려질 때마다(안에서 다시 그릴 때 포함) 그 위에 새 화면을 그린다 */
  U.afterRender=function(){
   const old=document.getElementById('dups'),el=document.getElementById('dup-v2');
   if(!enabled()||!root.B||!old){if(el)el.hidden=true;old?.classList.remove('dv-on');return;}
   try{const hst=host();hst.hidden=false;hst.innerHTML=listHtml(model());old.classList.add('dv-on');
    if(root.G.page==='dup'){const t=document.getElementById('ptitle'),p=document.getElementById('psub');if(t)t.textContent='데이터 정리 · 검토';if(p)p.textContent='겹쳐 보이는 현장 · 문의 · 연락처를 먼저 판단하고, 애매한 건만 비교합니다';}
   }catch(e){console.warn('[데이터 정리 v2]',e);if(el)el.hidden=true;old.classList.remove('dv-on');}
  };
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
 root.DupV2={enabled,judge,open,close};
})(window);
