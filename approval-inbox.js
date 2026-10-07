/* 예외 승인함 (2026-10-04 design_handoff_rules 2차 기능 4 · 영업관리 2차 기능.dc.html '예외 승인함') — 사이드바 '설정 → 예외 승인함' · 승인자 · 관리자가 본다
   타사 이관 실적 · 귀속 변경 · 중복 리드 정산 · 전략수주 · 특별 인센티브 · 결과 수정은 현장에서 고치지 않고 여기로 모은다. 승인 · 반려 모두 이력에 남는다.
   승인자 = 운영 기준의 '예외 승인자'(기본 이승우 · 황윤선) — 그중 한 사람만 승인해도 된다. 본인이 올린 요청은 다른 승인자가 처리한다(서버가 같은 규칙으로 막는다).
   자료 두 곳을 한 목록으로: ① 타사 이관 실적 = 기존 타사 이관(DealTransfer) 중 낙찰결과가 등록된 건 — 승인 · 반려는 기존 실적 인정 창 그대로(같은 저장 함수)
   ② 그 밖 = 승인 요청 저장소(crm_approval_*_v1) — 승인 / 반려(사유)만 기록하고 다른 자료는 바꾸지 않는다. 서버 확인 뒤에만 '승인됨 · 반려'로 표시한다.
   누가 승인했는지: 목록의 '승인됨 · 이름' + 그 영업건 응대 이력의 시스템 기록 + 상세 머리 꼬리표(approval-request.js).
   종류 이름 = 운영 기준(CRMRules.PHASE2.approval_types). 끄기: G.approvalInboxOff=true */
(function(root){
 'use strict';
 const R=root,h=v=>R.esc(String(v==null?'':v)),attr=v=>R.escAttr(String(v==null?'':v));
 const RPC={list:'crm_approval_list_v1',request:'crm_approval_request_v1',decide:'crm_approval_decide_v1'};
 const CODES=['transfer','owner_change','dup_lead','strategic_win','special_incentive','result_fix'];
 const TONE=[['#1d3f99','#eef3fe'],['#8a5a00','#fff4d6'],['#6b7280','#f3f4f6'],['#1f7a4d','#e8f6ee'],['#7048e8','#f1edfd'],['#b42318','#fdecec']];
 const labelOf=code=>{if(code==='contract_amount')return '계약금액 정정';const L=R.CRMRules&&R.CRMRules.PHASE2&&R.CRMRules.PHASE2.approval_types||[],i=CODES.indexOf(code);return i>=0&&L[i]?L[i]:code;};
 const toneOf=code=>TONE[CODES.indexOf(code)]||TONE[2];
 function st(){const g=R.G;if(!g.approvalInbox)g.approvalInbox={rows:null,busy:false,err:'',rej:'',reason:'',sending:''};return g.approvalInbox;}
 const enabled=()=>!R.G.approvalInboxOff&&!!R.CRMRules;
 const admin=()=>{try{return !!R.todayIsAdmin();}catch(e){return false;}};
 const me=()=>{try{return R.repN(R.ME&&R.ME.name)||'';}catch(e){return '';}};
 const approvers=()=>{try{return R.CRMRules.approvers();}catch(e){return [];}};
 const approver=()=>{try{return !!R.CRMRules.isApprover(R.ME&&R.ME.name);}catch(e){return false;}};
 const canSee=()=>admin()||approver();
 const stored=()=>enabled()&&!!R.OpsStore&&R.OpsStore.has(RPC.list);
 const toast=(m,k)=>{if(typeof R.toast==='function')R.toast(m,k);};
 const dayKey=v=>{const d=new Date(v);return isNaN(d)?'':new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(d);};
 /* 오늘 · 어제 · n일 전(서울 날짜 기준) */
 function ago(v){const k=dayKey(v),t=dayKey(Date.now());if(!k||!t)return '';const n=Math.round((Date.parse(t+'T00:00:00Z')-Date.parse(k+'T00:00:00Z'))/864e5);return n<=0?'오늘':n===1?'어제':n+'일 전';}
 const md=k=>{const m=/^(\d{4})-(\d{2})-(\d{2})/.exec(String(k||''));return m?Number(m[2])+'.'+Number(m[3]):'';};
 const dealOf=id=>id?(R.B&&R.B.deals||[]).find(d=>String(d.id)===String(id))||null:null;
 const siteOf=d=>d?String(d.site||d.site_name||d.nm||''):'';
 /* ── 자료: 타사 이관(낙찰결과 등록된 건) + 승인 요청 → 한 목록. 대기 먼저, 그 안에서 최근 순 ── */
 function transferItems(){
  const T=R.DealTransfer;if(!T||!T.enabled()||typeof T.rows!=='function')return [];
  /* 승인 요청 창에서 올린 타사 이관 실적이 있는 영업건은 그 요청 한 줄로만 보여 준다(같은 건을 두 번 세지 않는다) */
  const viaRequest=new Set((st().rows||[]).filter(r=>r.type==='transfer'&&r.deal_id).map(r=>String(r.deal_id)));
  return T.rows().filter(t=>t.transfer_status==='transferred'&&t.award_result==='transferred_won'&&!viaRequest.has(String(t.deal_id))).map(t=>{
   const d=dealOf(t.deal_id),done=!!t.approved_at,ok=done&&!!t.incentive_eligible;
   return {key:'t:'+t.deal_id,code:'transfer',deal:d,title:[siteOf(d)||'영업건 '+t.deal_id,[t.award_company,Number(t.award_amount)>0?R.fmtAmt(Number(t.award_amount)):''].filter(Boolean).join(' ')].filter(Boolean).join(' · '),
    why:[t.transfer_reported?'사전 보고'+(t.transfer_reported_at?' '+md(t.transfer_reported_at):''):'사전 보고 없음',t.award_evidence].filter(Boolean).join(' · '),
    who:R.repN(t.created_by_name||t.performance_owner)||'',owners:[R.repN(t.created_by_name),R.repN(t.performance_owner)].filter(Boolean),at:done?t.approved_at:t.updated_at,decidedAt:done?t.approved_at:'',state:done?(ok?'approved':'rejected'):'pending',by:R.repN(t.approved_by_name)||'',note:t.rejected_reason||''};
  });
 }
 const rowItem=r=>({key:'r:'+r.id,id:r.id,code:r.type,dealId:r.deal_id||'',deal:dealOf(r.deal_id),title:r.title,why:r.reason,who:R.repN(r.requested_by_name)||'',owners:[R.repN(r.requested_by_name)].filter(Boolean),at:r.requested_at,decidedAt:r.decided_at||'',state:r.status,by:R.repN(r.decided_by_name)||'',note:r.decision_reason||'',payload:r.payload||{}});
 function requestItems(){return (st().rows||[]).map(rowItem);}
 function items(){
  const all=[...transferItems(),...requestItems()].filter(x=>['pending','approved','rejected'].includes(x.state));
  const t=x=>Date.parse(x.at)||0;
  return all.sort((a,b)=>(a.state==='pending'?0:1)-(b.state==='pending'?0:1)||t(b)-t(a));
 }
 const pendingCount=()=>items().filter(x=>x.state==='pending').length;
 /* 그 영업건에 올라온 요청(상세 머리 꼬리표 · 승인 요청 창이 쓴다) */
 const forDeal=id=>requestItems().filter(x=>String(x.dealId)===String(id)&&['pending','approved','rejected'].includes(x.state));
 /* 승인 · 반려할 수 있는가: 승인자이고, 본인이 올린(본인 담당) 건이 아닐 때 */
 const own=x=>{const n=me();return !!n&&(x.owners||[]).includes(n);};
 const canDecide=x=>approver()&&!own(x);
 /* 응대 이력에 남기는 시스템 기록 한 줄(누가 승인 · 반려했는지) */
 const noteOf=(x,decision,by,reason)=>'[승인 요청 · '+labelOf(x.code)+'] '+by+' '+(decision==='approve'?'승인 완료':'반려')+' — '+(decision==='approve'?x.title:'사유: '+reason);
 /* ── 그리기 ── */
 function rowHtml(x){
  const S=st(),tone=toneOf(x.code),pending=x.state==='pending',busy=S.sending===x.key;
  let side;
  if(!pending)side='<span class="apv-res '+(x.state==='approved'?'ok':'no')+'"'+(x.note?' title="'+attr(x.note)+'"':'')+'>'+h(x.state==='approved'?'승인됨'+(x.by?' · '+x.by:''):'반려 · '+(x.note||'사유 기록'))+'</span>';
  else if(!canDecide(x))side='<span class="apv-wait">'+h(approver()?'본인 건 · 다른 승인자 처리 대기':'승인자 처리 대기')+'</span>';
  else if(S.rej===x.key)side='<div class="apv-rej"><input data-apv-f="reason" maxlength="300" placeholder="반려 사유" value="'+attr(S.reason)+'"'+(busy?' disabled':'')+'><button type="button" class="apv-no" data-apv="rej-cancel"'+(busy?' disabled':'')+'>취소</button><button type="button" class="apv-yes" data-apv="rej-ok" data-k="'+attr(x.key)+'"'+(busy?' disabled':'')+'>'+(busy?'저장 확인 중…':'반려 확정')+'</button></div>';
  else side='<div class="apv-act"><button type="button" class="apv-no" data-apv="no" data-k="'+attr(x.key)+'"'+(busy?' disabled':'')+'>반려</button><button type="button" class="apv-yes" data-apv="yes" data-k="'+attr(x.key)+'"'+(busy?' disabled':'')+'>'+(busy?'저장 확인 중…':'승인')+'</button></div>';
  return '<div class="apv-row'+(pending?'':' done')+'" data-key="'+attr(x.key)+'"><span class="apv-type" style="color:'+tone[0]+';background:'+tone[1]+'">'+h(labelOf(x.code))+'</span>'
   +'<div class="apv-main">'+(x.deal?'<button type="button" class="apv-t" data-apv="open" data-k="'+attr(x.key)+'" title="영업건 상세 열기">'+h(x.title)+'</button>':'<b class="apv-t">'+h(x.title)+'</b>')+'<span>'+h(x.why)+'</span></div>'
   +'<div class="apv-side"><span class="apv-who">'+h([x.who,ago(x.at)].filter(Boolean).join(' · '))+'</span>'+side+'</div></div>';
 }
 function render(){
  const host=document.getElementById('approval-inbox');if(!host)return;
  if(!enabled()){host.innerHTML='';return;}
  if(!canSee()){host.innerHTML='<p class="apv-empty">예외 승인함은 승인자 · 관리자 전용 화면입니다.</p>';return;}
  const S=st(),L=items(),n=L.filter(x=>x.state==='pending').length,names=approvers().join(' · ');
  const keep=host.querySelector('[data-apv-f="reason"]'),focus=keep&&document.activeElement===keep;
  host.innerHTML='<div class="apv-shell"><section class="apv-box"><div class="apv-hd"><b>승인 대기 <em>'+n+'</em>건</b><span>현장에서 바로 고치지 않고 여기로 모음 · 승인 · 반려 모두 이력에 남음 · 승인자'+(names?'('+h(names)+') 중 한 사람':'')+'</span></div>'
   +(S.err?'<p class="apv-err" role="alert">'+h(S.err)+'</p>':'')
   +(L.length?L.map(rowHtml).join(''):'<p class="apv-none">'+(S.busy&&S.rows===null?'불러오는 중…':'승인 대기 중인 요청이 없습니다')+'</p>')+'</section></div>';
  if(focus){const el=host.querySelector('[data-apv-f="reason"]');if(el){el.focus();try{el.setSelectionRange(el.value.length,el.value.length);}catch(e){}}}
 }
 /* ── 불러오기 ── */
 let fresh=0,rowsAt=0,rowsFor='';
 async function load(){
  const S=st();if(S.busy)return;S.busy=true;S.err='';
  try{
   const T=R.DealTransfer;if(T&&T.available&&T.available())await T.load();
   if(stored()){const r=await R.OpsStore.rpc(RPC.list,{});S.rows=Array.isArray(r.rows)?r.rows:[];rowsAt=Date.now();rowsFor=String(R.ME&&(R.ME.id||R.ME.name)||'');}else S.rows=S.rows||[];
  }catch(e){S.rows=S.rows||[];if(!e||!e.unavailable)S.err='불러오지 못했습니다: '+String(e&&e.message||e);}
  finally{S.busy=false;}
 }
 /* 상세가 열릴 때: 승인 요청을 아직 안 읽었거나 1분이 지났으면 한 번 읽는다(같은 사람 기준) */
 function ensure(){
  if(!stored()||st().busy)return Promise.resolve(false);const who=String(R.ME&&(R.ME.id||R.ME.name)||'');
  if(st().rows!==null&&rowsFor===who&&Date.now()-rowsAt<60000)return Promise.resolve(false);
  rowsAt=Date.now();rowsFor=who;return load().then(()=>true);
 }
 function take(row){const S=st();S.rows=S.rows||[];const i=S.rows.findIndex(q=>String(q.id)===String(row.id));if(i>=0)S.rows[i]=row;else S.rows.unshift(row);}
 function paint(){if(R.G.page!=='approvals')return;render();if(enabled()&&canSee()&&Date.now()-fresh>15000){fresh=Date.now();load().then(()=>{if(R.G.page==='approvals')render();});}}
 /* 사이드바: 승인자도 '설정 → 예외 승인함'을 본다 */
 function syncNav(){const see=enabled()&&!!R.ME&&canSee();document.querySelectorAll('.menu [data-approver-nav]').forEach(el=>{el.hidden=!see;});if(see)document.querySelectorAll('.menu [data-approver-sec]').forEach(el=>{el.hidden=false;});}
 /* ── 처리 ── */
 async function decide(x,decision,reason){
  const S=st();if(S.sending)return;S.sending=x.key;S.err='';render();
  let row=null;
  try{const r=await R.OpsStore.rpc(RPC.decide,{id:x.id,decision,reason:reason||undefined});row=r.request;take(row);try{if(x.code==='contract_amount'&&row?.status==='approved')await R.ContractSalesData?.refresh?.();}catch(e){}S.rej='';S.reason='';try{if(r.owner&&R.DealOwner)R.DealOwner.take(r.owner);}catch(e){}
   /* 승인으로 반영된 자료(타사 이관 실적 · 수주 결과)를 다시 읽는다 — 대시보드 · 상세가 같은 자료를 본다 */
   if(r.applied){try{if(x.code==='transfer'&&R.DealTransfer&&R.DealTransfer.available())await R.DealTransfer.load();}catch(e){}try{if(x.code==='result_fix'&&R.DealWin&&R.DealWin.available())await R.DealWin.load();}catch(e){}try{if(x.code==='result_fix'&&r.applied.contract==='signed'&&R.ContractSalesData&&typeof R.ContractSalesData.refresh==='function')await R.ContractSalesData.refresh();}catch(e){}}}
  catch(e){S.err='저장하지 못했습니다: '+String(e&&e.message||e);}
  if(row){
   /* 누가 승인 · 반려했는지 그 영업건 응대 이력에 시스템 기록으로 남긴다(결정은 이미 저장됨 — 기록이 실패해도 결정은 그대로) */
   const by=R.repN(row.decided_by_name)||me();let logged=!x.deal;
   if(x.deal&&R.DealDetailV3&&typeof R.DealDetailV3.memo==='function'){try{await R.DealDetailV3.memo(x.deal,noteOf(x,decision,by,row.decision_reason||reason||''),{});logged=true;}catch(e){logged=false;}}
   toast((decision==='approve'?by+' 승인 완료':'반려했습니다')+(logged?' — 이력에 남았습니다':' — 결정은 저장됐지만 응대 이력 기록은 남기지 못했습니다'),logged?undefined:'warn');
   try{R.ApprovalRequest&&R.ApprovalRequest.decorate();}catch(e){}
  }
  S.sending='';render();
 }
 function onClick(e){
  const b=e.target.closest('[data-apv]');if(!b||b.disabled)return;const host=document.getElementById('approval-inbox');if(!host||!host.contains(b))return;
  const a=b.dataset.apv,S=st(),x=items().find(i=>i.key===b.dataset.k);
  if(a==='rej-cancel'){S.rej='';S.reason='';S.err='';return render();}
  if(!x)return;
  if(S.err&&a!=='rej-ok'){S.err='';render();}
  if(a==='open'){if(x.deal){R.G._detailPopup=true;R.drwDeal(JSON.stringify(x.deal));}return;}
  if(x.state!=='pending'||!canDecide(x))return;
  /* 기존 타사 이관 흐름으로 올라온 건: 기존 실적 인정 창(사전 보고 · 낙찰결과 · 낙찰금액 확인 3개 / 제외 사유) 그대로 */
  if(x.code==='transfer'&&String(x.key).startsWith('t:')){if(x.deal&&R.DealTransfer)R.DealTransfer.open('approve',{dealId:String(x.deal.id),reject:a==='no'});else{S.err='영업건을 찾을 수 없어 처리할 수 없습니다.';render();}return;}
  if(a==='yes')return decide(x,'approve');
  if(a==='no'){S.rej=x.key;S.reason='';S.err='';render();const el=host.querySelector('[data-apv-f="reason"]');if(el)el.focus();return;}
  if(a==='rej-ok'){const v=String(S.reason||'').trim();if(!v){S.err='반려 사유를 적어 주세요.';return render();}return decide(x,'reject',v);}
 }
 document.addEventListener('click',onClick);
 document.addEventListener('input',e=>{const t=e.target;if(!t||!t.dataset||t.dataset.apvF!=='reason')return;const S=st();S.reason=t.value;if(S.err){S.err='';document.querySelector('#approval-inbox .apv-err')?.remove();}});
 document.addEventListener('keydown',e=>{const t=e.target;if(!t||!t.dataset||t.dataset.apvF!=='reason')return;if(e.key==='Enter'){e.preventDefault();t.closest('.apv-rej')?.querySelector('[data-apv="rej-ok"]')?.click();}if(e.key==='Escape'){e.preventDefault();e.stopPropagation();const S=st();S.rej='';S.reason='';render();}});
 /* ── 요청자에게 알림: 내가 올린 요청이 승인 · 반려되면 다음에 화면을 볼 때 한 번 알려 준다(본 것은 이 PC 에 기억) ── */
 function notifyMine(){
  if(!enabled()||!R.ME)return;const who=me();if(!who)return;const key='crm.approvalSeen.'+String(R.ME.id||who);
  let seen={};try{seen=JSON.parse(R.localStorage.getItem(key)||'{}')||{};}catch(e){}
  const fresh=v=>{const t=Date.parse(v);return isFinite(t)&&Date.now()-t<14*864e5;};
  const mine=items().filter(x=>(x.state==='approved'||x.state==='rejected')&&(x.owners||[]).includes(who)&&fresh(x.decidedAt||x.at)&&!seen[x.key+'@'+(x.decidedAt||x.at)]);
  if(!mine.length)return;
  const x=mine[0];toast('승인 요청 결과 — '+labelOf(x.code)+' · '+(x.by||'승인자')+(x.state==='approved'?' 승인 완료':' 반려'+(x.note?' (사유: '+x.note+')':''))+(mine.length>1?' 외 '+(mine.length-1)+'건':'')+' · '+x.title,x.state==='approved'?undefined:'warn');
  mine.forEach(m=>{seen[m.key+'@'+(m.decidedAt||m.at)]=1;});try{R.localStorage.setItem(key,JSON.stringify(seen));}catch(e){}
 }
 if(typeof root.paint==='function'){const base=root.paint;root.paint=function(){const r=base.apply(this,arguments);try{syncNav();}catch(e){}try{if(R.ME&&stored())ensure().then(changed=>{try{notifyMine();}catch(e){}try{if(changed&&R.G.page==='approvals'&&!st().sending)render();}catch(e){}}).catch(()=>{});}catch(e){}return r;};}
 root.addEventListener('crm-rules:changed',()=>{try{syncNav();if(R.G&&R.G.page==='approvals'&&!st().sending)render();}catch(e){}});
 root.ApprovalInbox={enabled,render:paint,load,ensure,take,notifyMine,items,forDeal,pendingCount,labelOf,toneOf,canDecide,canSee,approver,syncNav,noteOf,RPC,CODES,state:st};
})(window);
