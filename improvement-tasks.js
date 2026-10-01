/* 개선 과제 등록 (2026-10-01 디자인 핸드오프 pipeline ② — 진단 영역의 '그래서 뭘 해야 하나')
   진단 컴포넌트(PipelineDiagnosis.render)의 과제 카드에 [과제 등록]/[수정]과 '등록된 과제 N'을 붙이고, 등록 창(520px)을 띄운다.
   저장소 = public.improvement_tasks + crm_improvement_task_save_v1 / crm_improvement_task_list_v1 (sql/improvement-tasks-v1-20261001.sql).
   설치 전에는(릴리스 계약) 버튼을 보이지 않는다. 등록·수정은 관리자만, 읽기는 로그인 사용자. */
(function(root){
 'use strict';
 const SAVE='crm_improvement_task_save_v1',LIST='crm_improvement_task_list_v1';
 const h=v=>root.esc(String(v==null?'':v)),attr=v=>root.escAttr(String(v==null?'':v));
 const SCOPE={'pipeline:consulting':'컨설팅 설계','pipeline:sent':'자료 발송완료','pipeline:relationship':'관계관리','pipeline:competition':'경쟁·입찰','pipeline:construction':'계약·시공','pipeline:won':'수주','pipeline:lost':'실주',expansion:'확장관리',gyeongnam:'경남지사',asset:'고객 자산',sms:'문자메시지',reps:'영업사원 관리',kpi:'관리팀 KPI',work:'공종 분석',brief:'주간 브리핑'};
 const NOTIFY=[['today','오늘 업무'],['brief','주간 브리핑'],['kpi','관리팀 KPI']];
 let tasks=[],state='idle',unavailable=false;
 const admin=()=>{try{return !!root.todayIsAdmin?.();}catch(e){return false;}};
 const installed=()=>!unavailable&&!(root.CRMRelease&&(root.CRMRelease.has(SAVE)===false||root.CRMRelease.has(LIST)===false));
 const enabled=()=>installed()&&!!root.SB&&typeof root.SB.rpc==='function'&&!!root.ME;
 const keyOf=x=>String(x.label||x.todo||x.basis||'').trim();
 const find=(scope,x)=>tasks.find(t=>t.scope===scope&&t.basis_key===keyOf(x)&&t.status!=='dropped');
 const toast=(m,t)=>{if(typeof root.toast==='function')root.toast(m,t);};
 function missing(e){if(e&&(e.code==='PGRST202'||/CONTRACT_UNAVAILABLE|PHASE1_RPC_DENIED/.test(String(e.message||e)))){unavailable=true;root.CRMRelease?.noteMissing?.(SAVE);return true;}return false;}
 async function load(force){
  if(!enabled()||state==='loading'||(state==='ready'&&!force))return;
  state='loading';
  try{const r=await root.SB.rpc(LIST,{p:{}});if(r.error){if(missing(r.error)){state='ready';repaint();return;}throw r.error;}if(r.data?.ok===true&&Array.isArray(r.data.tasks)){tasks=r.data.tasks;state='ready';repaint();}else state='failed';}
  catch(e){if(missing(e)){state='ready';repaint();}else state='failed';}
 }
 function repaint(){try{root.paint?.();}catch(e){}}
 /* 진단 컴포넌트가 부른다 */
 function buttonHtml(scope,x){
  /* 목록 조회가 한 번 성공해야(=저장소 설치 확인) 버튼을 보인다 */
  if(!enabled())return '';if(state!=='ready'){if(state==='idle')load();return '';}
  const t=find(scope,x),data='data-scope="'+attr(scope)+'" data-key="'+attr(keyOf(x))+'" data-basis="'+attr(x.basis)+'" data-todo="'+attr(x.todo)+'" data-who="'+attr(x.who)+'" data-count="'+attr(x.count==null?'':x.count)+'"';
  if(t)return (admin()?'<button type="button" class="it-btn ghost" data-it="edit" '+data+'>수정</button>':'')+'<small class="it-done'+(t.status==='done'?' fin':'')+'">'+(t.status==='done'?'완료':'등록됨')+' · '+h(t.owner)+' · '+h(String(t.due).slice(5).replace('-','/'))+'까지</small>';
  return admin()?'<button type="button" class="it-btn" data-it="new" '+data+'>과제 등록</button>':'';
 }
 function countHtml(scope){if(!enabled()||state!=='ready')return '';const n=tasks.filter(t=>t.scope===scope&&t.status==='open').length;return '<button type="button" class="it-count" data-it="list" data-scope="'+attr(scope)+'">등록된 과제 <b>'+n+'</b></button>';}
 /* ── 등록 창 ── */
 const ymd=d=>d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
 function defaultDue(who){const d=new Date();if(/오늘|매일/.test(who))return ymd(d);if(/이번 주/.test(who)){d.setDate(d.getDate()+((5-d.getDay()+7)%7||7));return ymd(d);}const m=/(\d{1,2})월/.exec(who);if(m){const y=d.getFullYear()+(Number(m[1])<d.getMonth()+1?1:0);return ymd(new Date(y,Number(m[1]),0));}d.setDate(d.getDate()+14);return ymd(d);}
 function close(){document.getElementById('itDialog')?.remove();}
 function open(d,existing){
  close();
  const who=String(d.who||''),owner=existing?existing.owner:(who.split('·')[0]||'').trim()||'영업팀',n=Number(d.count)||0,label=d.key||'';
  const goal=existing?existing.goal||'':n>1?'다음 분기 «'+label+'» '+Math.ceil(n/2)+'건 이하로':'';
  const notify=existing?existing.notify||[]:['today'];
  const layer=document.createElement('div');layer.id='itDialog';layer.className='it-layer';
  layer.innerHTML='<section class="it-box" role="dialog" aria-modal="true" aria-labelledby="itTitle"><header><small>개선 과제 '+(existing?'수정':'등록')+' · '+h(SCOPE[d.scope]||d.scope)+'</small><h2 id="itTitle">'+h(existing?existing.title:d.todo)+'</h2></header>'
   +'<div class="it-body"><div class="it-basis"><span>근거</span><b>'+h(d.basis)+'</b></div>'
   +'<label>과제 <i>*</i><textarea id="it-title" rows="2" maxlength="500">'+h(existing?existing.title:d.todo)+'</textarea></label>'
   +'<div class="it-two"><label>담당 <i>*</i><input id="it-owner" maxlength="100" value="'+attr(owner)+'"></label><label>기한 <i>*</i><input id="it-due" type="date" value="'+attr(existing?String(existing.due).slice(0,10):defaultDue(who))+'"></label></div>'
   +'<label>이렇게 되면 성공<input id="it-goal" maxlength="500" value="'+attr(goal)+'" placeholder="예: 다음 분기 사유 미기록 5건 이하로"><small>다음 분기에 이 숫자로 효과를 확인해요</small></label>'
   +'<fieldset><legend>어디에 알릴까</legend>'+NOTIFY.map(([v,t])=>'<label class="it-check"><input type="checkbox" name="it-notify" value="'+v+'"'+(notify.includes(v)?' checked':'')+'> '+t+'</label>').join('')+'</fieldset>'
   +(existing?'<label class="it-check"><input type="checkbox" id="it-done"'+(existing.status==='done'?' checked':'')+'> 완료 처리</label>':'')
   +'<div class="it-err" id="it-err" role="alert"></div></div>'
   +'<footer><button type="button" class="it-btn ghost" data-itd="cancel">취소</button><button type="button" class="it-btn" data-itd="save">'+(existing?'저장':'과제 등록')+'</button></footer></section>';
  layer.addEventListener('mousedown',e=>{if(e.target===layer)close();});
  layer.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();close();}});
  layer.addEventListener('click',e=>{const b=e.target.closest('[data-itd]');if(!b)return;if(b.dataset.itd==='cancel')close();else save(layer,d,existing,b);});
  document.body.append(layer);layer.querySelector('#it-title').focus();
 }
 async function save(layer,d,existing,btn){
  const get=id=>layer.querySelector('#'+id)?.value.trim()||'',err=layer.querySelector('#it-err');
  const p={scope:d.scope,basis_key:d.key,basis:d.basis,title:get('it-title'),owner:get('it-owner'),due:get('it-due'),goal:get('it-goal'),notify:[...layer.querySelectorAll('[name="it-notify"]:checked')].map(x=>x.value),status:layer.querySelector('#it-done')?.checked?'done':'open'};
  if(existing)p.id=existing.id;
  err.textContent='';if(!p.title||!p.owner||!p.due){err.textContent='과제 · 담당 · 기한을 모두 입력해 주세요.';return;}
  btn.disabled=true;const was=btn.textContent;btn.textContent='서버 저장 확인 중…';
  try{
   const r=await root.SB.rpc(SAVE,{p});
   if(r.error){if(missing(r.error))throw Error('과제 저장소가 아직 설치되지 않았습니다(서버 적용 대기).');throw Error(r.error.message||'저장 실패');}
   if(!r.data||r.data.ok!==true||!r.data.task)throw Error('서버 확인 응답이 올바르지 않습니다.');
   const t=r.data.task;tasks=tasks.filter(x=>x.id!==t.id).concat(t);close();repaint();
   const where=NOTIFY.filter(n=>(t.notify||[]).includes(n[0])).map(n=>n[1]).join(' · ');
   toast('과제 '+(existing?'수정':'등록')+' · '+t.owner+' · '+String(t.due).slice(5).replace('-','/')+(where?' · '+where+'에 표시':''));
  }catch(e){err.textContent=String(e.message||e);btn.disabled=false;btn.textContent=was;}
 }
 /* 등록된 과제 모아 보기(화면별) */
 function openList(scope){
  close();const list=tasks.filter(t=>t.scope===scope).sort((a,b)=>String(a.status).localeCompare(String(b.status))||String(a.due).localeCompare(String(b.due)));
  const layer=document.createElement('div');layer.id='itDialog';layer.className='it-layer';
  layer.innerHTML='<section class="it-box" role="dialog" aria-modal="true" aria-labelledby="itTitle"><header><small>등록된 과제 · '+h(SCOPE[scope]||scope)+'</small><h2 id="itTitle">'+list.filter(t=>t.status==='open').length+'건 진행 중</h2></header><div class="it-body">'
   +(list.length?list.map(t=>'<article class="it-row'+(t.status==='done'?' fin':'')+'"><em>'+h(t.basis)+'</em><b>'+h(t.title)+'</b><span>'+h(t.owner)+' · '+h(String(t.due).slice(0,10))+'까지'+(t.goal?' · 목표: '+h(t.goal):'')+(t.status==='done'?' · 완료':'')+'</span></article>').join(''):'<p class="it-none">아직 등록된 과제가 없습니다.</p>')
   +'</div><footer><button type="button" class="it-btn ghost" data-itd="cancel">닫기</button></footer></section>';
  layer.addEventListener('mousedown',e=>{if(e.target===layer)close();});
  layer.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();close();}});
  layer.addEventListener('click',e=>{if(e.target.closest('[data-itd]'))close();});
  document.body.append(layer);layer.querySelector('button').focus();
 }
 document.addEventListener('click',e=>{
  const b=e.target.closest('[data-it]');if(!b)return;e.stopPropagation();
  const d=b.dataset;
  if(d.it==='list')return openList(d.scope);
  const x={scope:d.scope,key:d.key,basis:d.basis,todo:d.todo,who:d.who,count:d.count};
  open(x,d.it==='edit'?tasks.find(t=>t.scope===d.scope&&t.basis_key===d.key&&t.status!=='dropped'):null);
 });
 root.addEventListener('phase1:identity-cleared',()=>{tasks=[];state='idle';unavailable=false;close();});
 root.addEventListener('crm-release:changed',()=>repaint());
 root.ImprovementTasks={enabled,installed,load,buttonHtml,countHtml,open,list:()=>tasks.slice(),SCOPE};
})(window);
