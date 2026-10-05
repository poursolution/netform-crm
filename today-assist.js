/* 오늘 업무 · 영업관리 표(2026-10-04 대표 시안 캡처 '담당 배정 안 된 견적문의' + "계약정보빠짐도 마찬가지로 · 이번 주 새로 멈춘 것도 넣어줘")
   영업관리(관리자) 화면의 묶음을 표로: ① 담당 배정 안 된 견적문의(고객이 원한 것 · AI 요약 / AI 추천 담당 · 이유 / [추천대로 배정] [다른 사람] / [추천대로 n건 한 번에 배정])
   ② 오늘 안 넘기면 놓침(카드 그대로 — 첫 연락 · 오늘 마감) ③ 이번 주 새로 멈춘 건(멈춘 이유 · AI 요약 / AI 추천 행동 · 이유) ④ 계약 정보 빠짐(빠진 정보 · AI 요약 / AI 추천 행동 · 이유).
   ■ 추천 담당은 규칙으로 계산한다(자료에 있는 것만): 협약문의 → B2B 담당 / 같은 현장 기존 담당 / 같은 지역 진행 현장이 많은 담당 / 업무량이 가장 적은 담당. 연락처가 없으면 '연락처 먼저 확인'을 붙인다.
     업무량 · 지역 건수는 견적문의 배정 창과 같은 계산(inqCtlRepStats · regionOwnerCounts). 브랜드 담당 표 · 좌표(반경)는 자료가 없어 쓰지 않는다 — 표 아래 '추천 기준' 문구도 실제 순서 그대로 적는다.
   ■ 배정 저장은 기존 경로 그대로(inqCtlRecordAssignment → inquiry_assign). [다른 사람] = 기존 배정 창. 한 번에 배정은 두 번 눌러야 저장된다.
   ■ ③ ④ 의 추천 행동은 오늘 업무가 이미 정한 할 일(독촉 · 코멘트 · 입력 요청) 그대로 — 버튼도 기존 경로.
   끄기: G.todayAssistOff=true → 묶음 3개(카드 + 목록) 그대로 */
(function(root){
 'use strict';
 const R=root,h=v=>R.esc(String(v==null?'':v)),attr=v=>R.escAttr(String(v==null?'':v));
 const enabled=()=>!R.G.todayAssistOff&&typeof R.inqCtlRecordAssignment==='function'&&typeof R.inquiryAssignableReps==='function';
 const st=()=>R.G.todayAssist||(R.G.todayAssist={confirm:false,busy:false});
 const PER=8;
 const b2bOwner=()=>(R.InquiryB2BTab&&R.InquiryB2BTab.OWNER)||'조재연';
 const rep=v=>{try{return R.repN(v)||'';}catch(e){return String(v||'').trim();}};
 const toast=(m,k)=>{if(typeof R.toast==='function')R.toast(m,k);};
 const md=v=>{const d=new Date(v);return Number.isFinite(d.getTime())?(d.getMonth()+1)+'.'+d.getDate():'';};
 const money=n=>{n=Number(n)||0;if(!n)return '';if(n>=1e8)return (Math.round(n/1e7)/10)+'억';if(n>=1e4)return Math.round(n/1e4).toLocaleString('ko-KR')+'만';return n.toLocaleString('ko-KR');};
 /* 요청 업무(work-request.js): [독촉] 대신 상황별 요청 이름 — 서버 저장소가 없으면 null(예전 버튼 그대로) */
 const WRC=i=>{try{return R.WorkRequest&&R.WorkRequest.enabled()?R.WorkRequest.cell(i,rep(R.ME&&R.ME.name)):null;}catch(e){return null;}};
 const digitsOf=q=>String(q.phone||q.contact_phone||(q.raw&&q.raw['문의자 연락처'])||(q.raw&&q.raw['고객연락처'])||'').replace(/\D/g,'');
 const origOf=q=>{try{return String(R.InquiryWorkbench&&R.InquiryWorkbench.originalText?R.InquiryWorkbench.originalText(q)||'':'').replace(/\s+/g,' ').trim();}catch(e){return '';}};
 const regionOf=q=>{try{return String(R.siteRegionAny({site:R.standardSiteTitle(q.site,R.detailAddress(q)),address:R.detailAddress(q)})||'').trim();}catch(e){return '';}};
 const ns=v=>{try{return R.normSite?String(R.normSite(v||'')):String(v||'').trim();}catch(e){return String(v||'').trim();}};
 /* 같은 현장의 기존 영업건: 현장 ID 가 같거나(있을 때), 현장명이 같은 것 — 추천 근거로만 쓴다(자동으로 합치지 않는다) */
 function sameSiteDeals(q){
  const sid=String(q.cleanup_site_id||q.site_id||q.siteId||''),key=ns(q.site),bare=String(q.site||'').replace(/^\s*\[[^\]]*\]\s*/,'').trim();
  if(!sid&&(!key||/^문의-\d+$/.test(bare)||bare.length<3))return [];
  return ((R.B&&R.B.deals)||[]).filter(d=>sid?String(d.cleanup_site_id||d.site_id||d.siteId||'')===sid:ns(d.site)===key).sort((a,b)=>String(b.closed_at||b.updated||b.created||'').localeCompare(String(a.closed_at||a.updated||a.created||'')));
 }
 /* 추천 담당(규칙) */
 function recFor(q){
  let names=[];try{names=R.inquiryAssignableReps()||[];}catch(e){}
  const noTel=!digitsOf(q),tail=noTel?' · 연락처 먼저 확인':'',B2B=R.InquiryB2B;
  if(B2B&&B2B.isAgreement&&B2B.isAgreement(q)){const o=b2bOwner();return {name:o,label:o+' (B2B)',why:'협약 · 제휴 문의 → B2B 자동 추천',assignable:names.map(rep).includes(rep(o))};}
  const ex=sameSiteDeals(q).find(d=>{const o=rep(d.assignee);return o&&o!=='미배정'&&names.map(rep).includes(o);});
  if(ex){const o=rep(ex.assignee),y=String(ex.closed_at||ex.contract_date||ex.created||'').slice(0,4);let w='같은 현장 기존 담당';try{w+=R.isWon(ex)?' ('+(y?y+' ':'')+'수주)':R.isOpen(ex)?' · 진행 중':'';}catch(e){}return {name:o,label:R.repDisplay?R.repDisplay(o):o,why:w+tail,assignable:true,same:true};}
  let stats=[];try{stats=names.map(r=>R.inqCtlRepStats(r,[q])).sort((a,b)=>a.score-b.score||R.repCompare(a.rep,b.rep));}catch(e){stats=[];}
  if(!stats.length)return null;
  const min=stats[0].score,region=regionOf(q);let near={};try{near=region?R.regionOwnerCounts(region)||{}:{};}catch(e){}
  const nb=stats.filter(s=>near[rep(s.rep)]>0).sort((a,b)=>near[rep(b.rep)]-near[rep(a.rep)]||a.score-b.score)[0];
  if(nb)return {name:nb.rep,label:R.repDisplay?R.repDisplay(nb.rep):nb.rep,why:region+' 진행 현장 '+near[rep(nb.rep)]+'곳'+(nb.score<=min?' · 업무 여유':'')+tail,assignable:true};
  return {name:stats[0].rep,label:R.repDisplay?R.repDisplay(stats[0].rep):stats[0].rep,why:'업무량 가장 적음'+(region?'':' · 지역 확인 필요')+tail,assignable:true};
 }
 /* ── 표 줄 ── */
 const brandCell=i=>'<span class="ta-bd" style="color:'+i.bc+'">'+h(i.brand||'브랜드 미입력')+'</span>';
 const tag=(t,k)=>'<em class="'+(k||'')+'">'+h(t)+'</em>';
 const ai=(text,tags)=>'<span class="ta-sm"><span><i class="ta-ai">AI</i><b>'+h(text)+'</b></span>'+(tags?'<span class="ta-tg">'+tags+'</span>':'')+'</span>';
 const dcell=(i,hot,none)=>'<span class="ta-d"><b'+(hot?' class="r"':'')+'>'+h(none?'-':i.short)+'</b><small>'+h(none?'':i.dLabel||'')+'</small></span>';
 function assignRow(i){
  const q=i.x.item,k=attr(i.key),r=recFor(q),dg=digitsOf(q),orig=origOf(q),region=regionOf(q),raw=q.raw&&typeof q.raw==='object'?q.raw:{};
  let work='';try{work=String(R.inqCtlWorkLabel(q)||'');}catch(e){}
  const ch=String(raw['상담채널']||q.channel||q.source_channel||'').trim(),who=[i.i.name,i.i.role].filter(Boolean).join(' '),acts=Array.isArray(q.activities)?q.activities.filter(a=>/전화|문자|방문|메일|카카오/.test(String(a.type||''))).length:0;
  const sub=[ch,md(R.inquiryCreatedAt(q))+' 접수',!dg?'연락처 없음':who||'',acts?acts+'회 응대':''].filter(Boolean).join(' · ');
  const B2B=R.InquiryB2B,isAg=!!(B2B&&B2B.isAgreement&&B2B.isAgreement(q)),same=sameSiteDeals(q).length>0;
  const tags=[isAg?tag('협약문의','b'):tag(work&&!/미분류/.test(work)?work:'기타 공종'),/자료|카탈로그/.test(orig)&&!isAg?tag('자료 요청'):'',!dg?tag('연락처 없음','r'):'',!region?tag('지역 미상','r'):'',same?tag('같은 현장 기존 건','y'):''].join('');
  const sum=(orig||i.i.want||'남긴 내용 없음').slice(0,34)+((orig||'').length>34?'…':'');
  return '<div class="ta-row" role="button" tabindex="0" data-t3="open" data-key="'+k+'">'+brandCell(i)+'<span class="ta-st"><b title="'+attr(i.i.site)+'">'+h(i.i.site)+'</b><small>'+h(sub)+'</small></span>'+ai(sum,tags)
   +'<span class="ta-rc">'+(r?'<b>'+h(r.label||r.name)+'</b><small>'+h(r.why)+'</small>':'<b class="m">추천 없음</b><small>배정할 수 있는 담당자가 없습니다</small>')+'</span>'+dcell(i,true)
   +'<span class="ta-bt"><button type="button" class="go" data-ta="assign" data-key="'+k+'"'+(r&&r.assignable?'':' disabled title="이 담당자는 여기서 바로 배정할 수 없습니다 — [다른 사람]에서 고르세요"')+'>추천대로 배정</button><button type="button" data-t3="act" data-act="배정" data-key="'+k+'">다른 사람</button></span></div>';
 }
 function stallRow(i){
  const k=attr(i.key),own=i.x.owner||'미배정',last=String(i.support?'[지원 요청] '+i.support.note:i.i.recent||'최근 연락 기록 없음').replace(/\s+/g,' ').slice(0,36),w=WRC(i);
  return '<div class="ta-row" role="button" tabindex="0" data-t3="open" data-key="'+k+'">'+brandCell(i)+'<span class="ta-st"><b title="'+attr(i.i.site)+'">'+h(i.i.site)+'</b><small>'+h([i.sName,i.amt?money(i.amt):'금액 미정'].filter(Boolean).join(' · '))+'</small></span>'+ai(last,tag(i.missTxt)+(i.x.next?'':tag('다음 할 일 없음','y')))
   +'<span class="ta-rc">'+(w?w.rc:'<b>'+h(own+' · '+i.act)+'</b><small>'+h(i.loss||i.done||'')+'</small>')+'</span>'+dcell(i,false)
   +'<span class="ta-bt">'+(w?w.btn:'<button type="button" class="go" data-t3="act" data-act="'+attr(i.act)+'" data-key="'+k+'"'+(i.i.digits?' data-tel="'+attr(i.i.digits)+'"':'')+'>추천대로 '+h(i.act)+'</button>')+(own!=='미배정'?'<button type="button" data-t3="owner" data-key="'+k+'" data-v="'+attr(own)+'">담당 화면</button>':'<button type="button" data-t3="detail" data-key="'+k+'">상세 보기</button>')+'</span></div>';
 }
 /* 오늘 안 넘기면 놓침(첫 연락 · 오늘 마감 · 오늘 약속): ②와 같은 표 줄 — 지난 기록 / 담당 · 할 일 + 놓치면 생기는 일 / 경과(빨강) / [추천대로 …] [담당 화면] */
 function urgentRow(i){
  const k=attr(i.key),own=i.x.owner&&i.x.owner!=='미배정'?i.x.owner:'',last=String(i.support?'[지원 요청] '+i.support.note:i.i.recent||'최근 연락 기록 없음').replace(/\s+/g,' ').slice(0,36),who=[i.i.name,i.i.role].filter(Boolean).join(' '),w=WRC(i);
  return '<div class="ta-row" role="button" tabindex="0" data-t3="open" data-key="'+k+'">'+brandCell(i)+'<span class="ta-st"><b title="'+attr(i.i.site)+'">'+h(i.i.site)+'</b><small>'+h([i.sName,who||'',i.amt?money(i.amt):''].filter(Boolean).join(' · '))+'</small></span>'+ai(last,tag(i.missTxt,'r')+(i.i.want&&!/기록 없음/.test(i.i.want)?tag(i.i.want):''))
   +'<span class="ta-rc">'+(w?w.rc:'<b>'+h((own||'미배정')+' · '+i.act)+'</b><small>'+h(i.loss?'놓치면 '+i.loss:i.done||'')+'</small>')+'</span>'+dcell(i,true,i.rk==='contract')
   +'<span class="ta-bt">'+(w?w.btn:'<button type="button" class="go" data-t3="act" data-act="'+attr(i.act)+'" data-key="'+k+'"'+(i.i.digits?' data-tel="'+attr(i.i.digits)+'"':'')+'>추천대로 '+h(i.act)+'</button>')+(own?'<button type="button" data-t3="owner" data-key="'+k+'" data-v="'+attr(own)+'">담당 화면</button>':'<button type="button" data-t3="detail" data-key="'+k+'">상세 보기</button>')+'</span></div>';
 }
 function contractRow(i){
  const k=attr(i.key),own=i.x.owner||'미배정',d=i.x.item||{},f=(d.stage_contexts&&d.stage_contexts.contract&&d.stage_contexts.contract.fields)||{},miss=[!(f.contract_date||d.contract_date)?'계약일':'',!(Number(f.contract_amount||d.contract_amount)>0)?'계약금액':''].filter(Boolean),w=WRC(i);
  return '<div class="ta-row" role="button" tabindex="0" data-t3="open" data-key="'+k+'">'+brandCell(i)+'<span class="ta-st"><b title="'+attr(i.i.site)+'">'+h(i.i.site)+'</b><small>'+h([i.sName,i.amt?'예상 '+money(i.amt):'금액 미정'].filter(Boolean).join(' · '))+'</small></span>'+ai(i.missTxt,miss.map(m=>tag(m+' 없음','r')).join(''))
   +'<span class="ta-rc">'+(w?w.rc:'<b>'+h(own+' · '+i.act)+'</b><small>'+h(i.loss||'수주실적에 안 잡힙니다')+'</small>')+'</span>'+dcell(i,false,true)
   +'<span class="ta-bt">'+(w?w.btn:'<button type="button" class="go" data-ta="askfill" data-key="'+k+'">입력 요청</button>')+'<button type="button" data-t3="detail" data-key="'+k+'">바로 입력</button></span></div>';
 }
 const HEAD0={urgent:['지난 기록 · AI 요약','AI 추천 행동 · 이유'],assign:['고객이 원한 것 · AI 요약','AI 추천 담당 · 이유'],stall:['멈춘 이유 · AI 요약','AI 추천 행동 · 이유'],contract:['빠진 정보 · AI 요약','AI 추천 행동 · 이유']};
 /* 요청 업무가 켜지면 칸 이름도 시안대로 'AI 추천 요청 · 이유'(배정 표는 그대로) */
 const HEAD=new Proxy(HEAD0,{get:(t,k)=>{const v=t[k];return v&&k!=='assign'&&R.WorkRequest&&R.WorkRequest.enabled()?[v[0],'AI 추천 요청 · 이유']:v;}});
 const NOTE={urgent:()=>'추천 행동 = 오늘 업무가 정한 할 일 그대로 · 아래 줄은 오늘 넘기면 생기는 일 · 줄을 누르면 그 건의 상세',assign:()=>'추천 기준: 같은 현장 기존 담당 > 같은 지역 진행 현장 > 업무량 · 협약문의는 '+b2bOwner()+' 자동 추천 · 연락처 없으면 먼저 확인 표시',stall:()=>'추천 행동 = 오늘 업무가 정한 할 일 그대로 · 줄을 누르면 그 건의 상세',contract:()=>'계약일 · 계약금액이 있어야 수주실적에 잡힙니다 · [입력 요청] = 담당에게 보낼 문구 복사'};
 /* ① 카드 묶음의 카드 아래 나머지 줄: ②와 같은 표 줄(묶음 머리 · 카드 · 더 보기 버튼은 오늘 업무가 그린다) */
 function restHtml(items){return '<div class="ta-box ta-rest"><div class="ta-row hd"><span>브랜드</span><span>현장</span><span>'+HEAD.urgent[0]+'</span><span>'+HEAD.urgent[1]+'</span><span class="ta-d">경과</span><span></span></div>'+items.map(urgentRow).join('')+'</div>';}
 /* 오늘 업무(today-v3)가 묶음마다 부른다 */
 function groupHtml(g,items,gi,no,more){
  const S=st(),kind=g.kind,rowFn=kind==='assign'?assignRow:kind==='urgent'?urgentRow:kind==='stall'?stallRow:contractRow,pg=R.ListPager.cut(items,more,PER),shown=pg.rows;/* more = 이 묶음의 쪽 번호 */
  const recs=kind==='assign'?items.filter(i=>{const r=recFor(i.x.item);return r&&r.assignable;}).length:0;
  const bulk=kind==='assign'?(recs?'<button type="button" class="ta-all'+(S.confirm?' cf':'')+'" data-ta="assign-all"'+(S.busy?' disabled':'')+'>'+(S.busy?'배정하는 중…':S.confirm?'한 번 더 누르면 '+recs+'건 배정':'추천대로 '+recs+'건 한 번에 배정')+'</button>':''):(g.bulk?'<button type="button" data-t3="bulk" data-v="'+gi+'">'+h(g.bulk)+'</button>':'');
  return '<section class="tv3-group ta-group'+(kind==='assign'||kind==='urgent'?' first':'')+'" data-g="'+(gi+1)+'" data-kind="'+kind+'"><header><i>'+no+'</i><b>'+h(g.t)+'</b><b class="n">'+items.length+'건</b><span>'+h(g.why)+'</span><u></u>'+bulk+'</header>'
   +'<div class="ta-box"><div class="ta-row hd"><span>브랜드</span><span>현장</span><span>'+HEAD[kind][0]+'</span><span>'+HEAD[kind][1]+'</span><span class="ta-d">경과</span><span></span></div>'+shown.map(rowFn).join('')
   +R.ListPager.html(pg,{ns:'t3',v:'g'+gi,small:true})+'</div><p class="ta-note">'+h(NOTE[kind]())+'</p></section>';
 }
 /* ── 동작 ── */
 const inqOf=key=>{try{return R.inqCtlFind(String(key).replace(/^inq:/,''),false);}catch(e){return null;}};
 function assignOne(key){
  const q=inqOf(key);if(!q||R.inquiryAssigned(q))return null;const r=recFor(q);if(!r||!r.assignable)return null;
  R.inqCtlRecordAssignment(q,r.name,'오늘 업무 · 추천대로 배정 — '+r.why);
  return rep(R.inquiryRoutedOwner(q))===rep(r.name)?r:null;
 }
 function onClick(e){
  const b=e.target.closest('[data-ta]');if(!b||b.disabled||!b.closest('#pg-today'))return;e.preventDefault();e.stopPropagation();const a=b.dataset.ta,S=st();
  if(a==='assign'){const q=inqOf(b.dataset.key),site=q?String(q.site||'문의'):'문의';let r=null;try{r=assignOne(b.dataset.key);}catch(err){toast('배정을 저장하지 못했습니다: '+String(err&&err.message||err),'warn');return;}
   if(!r){toast('배정하지 못했습니다 — [다른 사람]에서 직접 골라 주세요','warn');return;}try{R.saveLocal&&R.saveLocal();}catch(err){}S.confirm=false;R.paint();toast(site+' → '+(r.label||r.name)+' 배정');return;}
  if(a==='assign-all'){if(!S.confirm){S.confirm=true;R.paint();toast('추천대로 한 번에 배정합니다 — 한 번 더 누르면 저장됩니다');return;}
   S.busy=true;let ok=0,fail=0;const keys=[...document.querySelectorAll('#pg-today .ta-group[data-kind="assign"]')].length?(R.TodayV3&&R.TodayV3.current?R.TodayV3.current().groups.filter(g=>g.kind==='assign').flatMap(g=>g.items.map(i=>i.key)):[]):[];
   keys.forEach(k=>{try{assignOne(k)?ok++:fail++;}catch(err){fail++;}});try{R.saveLocal&&R.saveLocal();}catch(err){}S.busy=false;S.confirm=false;R.paint();toast(ok+'건 배정'+(fail?' · '+fail+'건은 추천 담당이 없어 그대로 둠':''),fail?'warn':undefined);return;}
  if(a==='askfill'){const V=R.TodayV3&&R.TodayV3.current?R.TodayV3.current():null,i=V?V.groups.flatMap(g=>g.items).find(x=>x.key===b.dataset.key):null;if(!i)return;const own=i.x.owner||'담당자';
   const text=own+'님, '+String(i.i.site||'').replace(/^\s*\[[^\]]*\]\s*/,'')+' 계약 정보('+i.missTxt+')가 비어 있어 수주실적에 안 잡힙니다. 오늘 안에 계약일 · 계약금액 입력 부탁드립니다.';
   const done=()=>toast('입력 요청 문구를 복사했습니다 — 잔디 · 문자로 보내 주세요');try{const p=navigator.clipboard&&navigator.clipboard.writeText(text);if(p&&p.then)p.then(done).catch(done);else done();}catch(err){done();}return;}
 }
 document.addEventListener('click',onClick,true);
 /* 다른 곳을 누르면 '한 번 더' 확인을 푼다 */
 document.addEventListener('click',e=>{const S=st();if(S.confirm&&!e.target.closest('[data-ta="assign-all"]')){S.confirm=false;const b=document.querySelector('#pg-today .ta-all.cf');if(b){b.classList.remove('cf');b.textContent=b.textContent.replace(/^한 번 더 누르면 (\d+)건 배정$/,'추천대로 $1건 한 번에 배정');}}});
 root.TodayAssist={enabled,groupHtml,restHtml,recFor,sameSiteDeals,state:st,PER};
})(window);
