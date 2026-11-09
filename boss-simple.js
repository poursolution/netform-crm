/* 대표 첫 화면 정리 (2026-11-09 대표 「전부 진행」)
   왜: 대표 의견 — "입력하라는 것도 많고, 하라는 것도 많고, 챙기라는 것도 많아서 한눈에 안 보이고 명확하지 않다".
       대표 계정(영업관리 · 대표 · 상무 · 팀장 화면) 첫 화면에 숫자 칸 30여 개 · 묶음마다 [요청 보내기] · 회사 전체 숫자 · 배지 5개 · 종 3겹이 겹쳐 있었다.
   무엇: ① 맨 위 '오늘 대표님이 정할 것' 3줄(미배정 문의 · 배정 뒤 하루 넘게 첫 연락 없는 문의 · 큰 금액인데 멈춘 건)
         ② 요약 한 줄 ③ 나머지(팀 전체 4구역 · 보낸 요청 · 요청 보내기)는 '팀 전체 보기'에 접어 둔다 — 재촉은 알림봇(하네스 세션)이 맡는다
         ④ 메뉴 배지는 오늘 업무 · 견적문의만, 메뉴 아래 '조치 필요' 문구 숨김 ⑤ 종 빨간 점은 새 알림이 있을 때만
         ⑥ '서버 적용 대기' 배너는 닫으면 그날은 다시 안 뜸 ⑦ 금요일 관리팀 KPI 는 묻지 않고 자동 저장(저장했다고 알림)
   데이터는 지우지 않는다 — 보이는 자리만 바뀐다. 영업담당자 화면은 그대로.
   끄기: G.bossSimpleOff=true → 지금까지 화면 그대로 */
(function(root){
 'use strict';
 const h=v=>root.esc?root.esc(String(v==null?'':v)):String(v==null?'':v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const attr=v=>root.escAttr?root.escAttr(String(v==null?'':v)):h(v);
 const BOSS_ROLES=['mgr','ceo','vp','lead'];
 /* 켜는 조건: 끄기 스위치가 없고, 관리자이고, 오늘 업무 역할이 영업담당(rep)이 아님 */
 function on(role){try{if(root.G&&root.G.bossSimpleOff)return false;if(!(root.todayIsAdmin&&root.todayIsAdmin()))return false;return role?BOSS_ROLES.includes(role):true;}catch(e){return false;}}
 const DAY=864e5;
 const ms=v=>{const t=Date.parse(v||'');return Number.isFinite(t)?t:null;};
 const bigAmount=()=>Number(root.OPS_RULES&&root.OPS_RULES.towerBigAmount)||3e8;
 function inquiries(){try{const all=(root.B&&root.B.inquiries)||[];return (root.operationalInquiries?root.operationalInquiries(all):all).filter(q=>!(root.isClosedInq&&root.isClosedInq(q))&&!(root.inqCtlConverted&&root.inqCtlConverted(q)));}catch(e){return [];}}
 const createdOf=q=>ms(root.inquiryCreatedAt?root.inquiryCreatedAt(q):(q.created_at||q.at));
 const assignedOf=q=>ms(root.inquiryAssignedAt?root.inquiryAssignedAt(q):(q.assigned_at||''));
 function firstConnected(q){try{const v=root.InquiryFlow&&root.InquiryFlow.state?root.InquiryFlow.state(q):null;if(v&&v.firstConnectedAt)return true;}catch(e){}return !!(q.responded_at||q.respondedAt||q.first_response_at);}
 function model(){
  const now=Date.now(),Q=inquiries();
  const un=Q.filter(q=>!(root.inquiryAssigned&&root.inquiryAssigned(q))).sort((a,b)=>(createdOf(a)||0)-(createdOf(b)||0));
  const quiet=Q.filter(q=>root.inquiryAssigned&&root.inquiryAssigned(q)&&!firstConnected(q)).filter(q=>{const t=assignedOf(q)||createdOf(q);return t!==null&&now-t>DAY;}).sort((a,b)=>(assignedOf(a)||createdOf(a)||0)-(assignedOf(b)||createdOf(b)||0));
  let big=[];
  try{const P=root.PipelineScope;big=((root.B&&root.B.deals)||[]).filter(d=>{try{if(root.isOpen&&!root.isOpen(d))return false;if(P&&P.on()&&P.isLegacy(d))return false;const a=root.oppAmt?root.oppAmt(d):Number(d.amt||d.amount||0);return a>=bigAmount()&&typeof root.isStale==='function'&&root.isStale(d);}catch(e){return false;}})
   .sort((a,b)=>(root.oppAmt?root.oppAmt(b)-root.oppAmt(a):0));}catch(e){big=[];}
  return {un,quiet,big};
 }
 const daysAgo=t=>t===null?'':Math.max(0,Math.floor((Date.now()-t)/DAY));
 const site=x=>String(x.site||x.site_name||'현장명 미입력');
 const money=v=>root.fmtAmt?root.fmtAmt(v):String(v);
 function row(kind,key,title,sub,btn){return '<div class="bs-row"><button type="button" class="bs-site" data-bs="'+kind+'" data-key="'+attr(key)+'">'+h(title)+'</button><small>'+h(sub)+'</small><button type="button" class="bs-go" data-bs="'+kind+'" data-key="'+attr(key)+'">'+h(btn)+'</button></div>';}
 function card(n,title,why,list,more){return '<section class="bs-card'+(list.length?'':' done')+'"><header><b>'+title+'</b><em>'+n+'건</em></header><p>'+why+'</p>'+(list.length?list.join('')+(more?'<small class="bs-more-n">그 밖 '+more+'건 · 해당 화면에서</small>':''):'<p class="bs-none">없음</p>')+'</section>';}
 function html(opt){
  const M=model(),o=opt||{};
  const un=M.un.slice(0,3).map(q=>row('assign',root.inqKey?root.inqKey(q):q.id,site(q),(q.brand?q.brand+' · ':'')+'접수 '+daysAgo(createdOf(q))+'일째','배정')),
   quiet=M.quiet.slice(0,3).map(q=>row('inq',root.inqKey?root.inqKey(q):q.id,site(q),(root.repN?root.repN(q.assignee):q.assignee||'')+' · 배정 '+daysAgo(assignedOf(q)||createdOf(q))+'일째 연락 기록 없음','확인')),
   big=M.big.slice(0,3).map(d=>{let a=null;try{a=root.activityAge(d);}catch(e){}return row('deal',root.dealKey?root.dealKey(d):d.id,site(d),money(root.oppAmt?root.oppAmt(d):d.amt)+' · '+(root.repN?root.repN(d.assignee):d.assignee||'')+(a!=null?' · 활동 없음 '+a+'일':''),'보기');});
  const total=M.un.length+M.quiet.length+M.big.length;
  return '<div class="bs" data-bs-total="'+total+'">'
   +'<header class="bs-head"><h2>오늘 대표님이 정할 것</h2><p class="bs-sum">미배정 문의 <b>'+M.un.length+'</b> · 첫 연락 없는 문의 <b>'+M.quiet.length+'</b> · 멈춘 큰 건 <b>'+M.big.length+'</b></p></header>'
   +(o.top||'')
   +'<div class="bs-cards">'
   +card(M.un.length,'미배정 문의','담당을 정하면 끝납니다',un,Math.max(0,M.un.length-3))
   +card(M.quiet.length,'첫 연락 없는 문의','배정 뒤 하루가 지났는데 연락 기록이 없습니다 · 담당 재촉은 알림봇이 합니다',quiet,Math.max(0,M.quiet.length-3))
   +card(M.big.length,'멈춘 큰 건',money(bigAmount())+' 이상 · 영업 활동 '+(root.staleDays?root.staleDays():30)+'일 이상 없음',big,Math.max(0,M.big.length-3))
   +'</div>'
   +(o.rest?'<details class="bs-rest"'+(st().open?' open':'')+'><summary>팀 전체 보기 <small>4구역 · 보낸 요청 · 요청 보내기</small></summary>'+o.rest+'</details>':'')
   +'</div>';
 }
 const st=()=>root.G?(root.G.bossSimple||(root.G.bossSimple={open:false})):{open:false};
 function style(){
  if(document.getElementById('bs-style'))return;const s=document.createElement('style');s.id='bs-style';
  s.textContent='.bs{display:grid;gap:14px}.bs-head{display:flex;align-items:baseline;gap:14px;flex-wrap:wrap}.bs-head h2{font-size:20px;font-weight:900;margin:0}.bs-sum{margin:0;color:var(--sub,#596579);font-size:13.5px}.bs-sum b{color:var(--ink,#171A1F);font-size:15px}'
   +'.bs-cards{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}.bs-card{background:#fff;border:1px solid var(--line2,#E2E5EA);border-radius:14px;padding:14px;display:grid;gap:8px;align-content:start;min-width:0}'
   +'.bs-card header{display:flex;align-items:baseline;justify-content:space-between}.bs-card header b{font-size:15px}.bs-card header em{font-style:normal;font-weight:900;font-size:18px;color:#c0392b}.bs-card.done header em{color:var(--sub,#596579)}'
   +'.bs-card>p{margin:0;font-size:12.5px;color:var(--sub,#596579)}.bs-none{font-size:13px;color:var(--sub2,#727E91)}.bs-more-n{font-size:12px;color:var(--sub2,#727E91)}'
   +'.bs-row{display:flex;align-items:center;gap:8px;border-top:1px solid var(--line,#EFF1F4);padding-top:8px;min-width:0}.bs-row .bs-site{flex:1 1 auto;min-width:0;text-align:left;border:0;background:none;padding:0;font:inherit;font-weight:800;font-size:13.5px;color:var(--ink,#171A1F);cursor:pointer;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}'
   +'.bs-row small{flex:none;max-width:48%;font-size:12px;color:var(--sub,#596579);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.bs-row .bs-go{flex:none;border:1px solid var(--blue,#3366FF);color:var(--blue,#3366FF);background:#fff;border-radius:8px;padding:3px 10px;font:inherit;font-size:12.5px;font-weight:800;cursor:pointer}'
   +'.bs-rest{border:1px solid var(--line2,#E2E5EA);border-radius:14px;background:#fff;padding:10px 14px}.bs-rest>summary{cursor:pointer;font-weight:800;font-size:14px}.bs-rest>summary small{font-weight:600;color:var(--sub,#596579);margin-left:6px}.bs-rest[open]>summary{margin-bottom:10px}'
   +'@media (max-width:900px){.bs-cards{grid-template-columns:1fr}}'
   /* ④ 메뉴 배지 · 메뉴 아래 문구 ⑤ 종 빨간 점 — 대표 화면에서만(body.bs-on) */
   +'body.bs-on #relationshipBadge,body.bs-on #expansionBadge,body.bs-on #dupBadge,body.bs-on #sideFoot{display:none!important}'
   +'body.bs-on .mhead .ib .dot{display:none}body.bs-on .mhead .ib:has(.dwd-belln,.wrq-belln) .dot{display:block}body.bs-on .mhead .ib .dwd-belln~.wrq-belln{display:none}';
  document.head.append(s);
 }
 function mark(){try{const b=document.body;if(!b)return;b.classList.toggle('bs-on',on());if(on())style();}catch(e){}}
 function click(e){
  const t=e.target.closest&&e.target.closest('.bs [data-bs]');
  if(t){e.preventDefault();const k=t.dataset.key;try{
   /* [배정] = 오늘 업무와 같은 담당 지정 창(바로 배정) · 현장 이름 · [확인] = 문의 상세 · [보기] = 영업건 상세 */
   if(t.dataset.bs==='assign'&&t.classList.contains('bs-go')&&typeof root.todayAssignInquiry==='function'){root.todayAssignInquiry(k);return;}
   if(t.dataset.bs==='inq'||t.dataset.bs==='assign'){const q=((root.B&&root.B.inquiries)||[]).find(x=>String(root.inqKey?root.inqKey(x):x.id)===String(k));if(q){root.G._detailPopup=true;root.drwInq(JSON.stringify(q));}}else{const d=((root.B&&root.B.deals)||[]).find(x=>String(root.dealKey?root.dealKey(x):x.id)===String(k));if(d){root.G._detailPopup=true;root.drwDeal(JSON.stringify(d));}}}catch(x){}return;}
  const s=e.target.closest&&e.target.closest('.bs-rest>summary');if(s){setTimeout(()=>{const d=s.parentElement;st().open=!!(d&&d.open);},0);}
 }
 /* ⑥ '서버 적용 대기' 배너: 닫으면 그날은 다시 안 뜸 */
 const BKEY='nf_release_banner_closed';
 function bannerToday(){try{return root.localStorage.getItem(BKEY)===new Date().toISOString().slice(0,10);}catch(e){return false;}}
 function watchBanner(){
  const b=document.getElementById('crm-release-banner');if(!b||!on())return;
  if(bannerToday()){b.remove();return;}
  const x=b.querySelector('button');if(x&&!x.__bs){x.__bs=true;x.addEventListener('click',()=>{try{root.localStorage.setItem(BKEY,new Date().toISOString().slice(0,10));}catch(e){}});}
 }
 if(typeof document!=='undefined'){
  document.addEventListener('click',click,true);
  document.addEventListener('DOMContentLoaded',mark);
  try{new MutationObserver(()=>{mark();watchBanner();}).observe(document.documentElement,{childList:true,subtree:true});}catch(e){}
 }
 root.BossSimple={on,model,html,mark,style,bannerToday};
})(window);
