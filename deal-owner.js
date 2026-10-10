/* 담당 · 귀속 분리 (2026-10-04 design_handoff_rules 2차 기능 8 · 영업관리 2차 기능.dc.html '담당자 변경 · 실적 귀속 분리')
   현재 담당 · 최초 담당 · 실적 귀속을 따로 본다. 담당이 바뀌어도 귀속은 주담당에게(기본) — 바뀐 담당은 '보조'. 귀속 변경은 바로 바뀌지 않고 예외 승인함으로 간다.
   상세 왼쪽 '담당 정보' 상자(현재 담당 · 최초 담당 · 실적 귀속 · 변경 이력) + 담당자 변경 창의 '실적 귀속' 선택(주담당 유지 (기본) / 귀속도 변경 요청).
   주담당 = 저장된 귀속(crm_deal_owners) → 없으면 최초로 실제 연결된 담당자(연락 시도 · 부재 제외) → 없으면 지금 담당. 계산은 여기 한곳(DealOwner.perf).
   담당 변경 자체는 기존 저장 경로 그대로 — 그 뒤에 사유 · 귀속 선택을 기록하고(crm_deal_owner_reassign_v1), '변경 요청'이면 승인 요청을 올린다. 서버 확인 뒤에만 표시가 바뀐다.
   끄기: G.dealOwnerOff=true */
(function(root){
 'use strict';
 const R=root,h=v=>R.esc(String(v==null?'':v)),attr=v=>R.escAttr(String(v==null?'':v));
 const RPC={change:'crm_deal_reassign_handover_v1',list:'crm_deal_owner_list_v1',reassign:'crm_deal_owner_reassign_v1'};
 const enabled=()=>!R.G.dealOwnerOff&&!!R.CRMRules&&!!R.OpsStore;
 const available=()=>enabled()&&R.OpsStore.has(RPC.list);
 const keepRule=()=>{try{return R.CRMRules.get('owner_keep_on_reassign')!==false;}catch(e){return true;}};
 const autoRule=()=>{try{return R.CRMRules.get('auto_owner_attribution')!==false;}catch(e){return true;}};
 const st=()=>R.G.dealOwner||(R.G.dealOwner={attr:'keep'});
 const toast=(m,k)=>{if(typeof R.toast==='function')R.toast(m,k);};
 const rep=v=>{try{return R.repN(v)||'';}catch(e){return String(v||'').trim();}};
 const names=()=>{try{return R.CRMRules.approvers().join(' · ');}catch(e){return '';}};
 const dayKey=v=>{if(!v)return '';const s=String(v);if(/^\d{4}-\d{2}-\d{2}$/.test(s))return s;const d=new Date(s);return isNaN(d)?'':new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(d);};
 const dot=k=>{const m=/^(\d{4})-(\d{2})-(\d{2})/.exec(dayKey(k));return m?m[1]+'.'+Number(m[2])+'.'+Number(m[3]):'';};
 /* 은 / 는 */
 const josa=w=>{const c=String(w||'').charCodeAt(String(w||'').length-1);return c>=0xAC00&&c<=0xD7A3&&(c-0xAC00)%28?'은':'는';};
 function cur(){const c=R.CUR_DETAIL;return c&&c.kind==='deal'&&c.item?c.item:null;}
 /* ── 자료 ── */
 let rows=new Map(),events=new Map(),rowsAt=0,rowsFor='',busy=false;
 const rowOf=d=>d&&rows.get(String(d.id))||null;
 function take(row){if(row&&row.deal_id){rows.set(String(row.deal_id),row);}}
 async function load(dealId){
  if(!available()||busy)return false;busy=true;
  try{const r=await R.OpsStore.rpc(RPC.list,dealId?{deal_id:String(dealId)}:{});rows=new Map((r.rows||[]).map(x=>[String(x.deal_id),x]));if(dealId)events.set(String(dealId),Array.isArray(r.events)?r.events:[]);rowsAt=Date.now();rowsFor=String(R.ME&&(R.ME.id||R.ME.name)||'');return true;}
  catch(e){return false;}finally{busy=false;}
 }
 /* 상세가 열릴 때: 그 영업건의 이력을 아직 안 읽었거나 1분이 지났으면 한 번 읽는다 */
 function ensure(d){
  if(!available()||busy||!d)return Promise.resolve(false);const who=String(R.ME&&(R.ME.id||R.ME.name)||''),id=String(d.id);
  if(rowsFor===who&&events.has(id)&&Date.now()-rowsAt<60000)return Promise.resolve(false);
  return load(id);
 }
 function acts(d){let p={};try{p=R.itemPatch(d,'deal')||{};}catch(e){}return [...(d.activities||[]),...(p.activities||[])];}
 /* 최초로 실제 연결된 담당자(연락 시도 · 부재는 제외) */
 function firstConnect(d){
  let best=null;acts(d).forEach(a=>{const who=rep(a.actor||a.actor_name||''),at=a.at||a.occurred_at||'';if(!who||!at)return;let ok=false;try{ok=!!R.isMeaningfulContact(a.type,a.note,a.result||'',a.meaningful);}catch(e){}if(!ok)return;const t=Date.parse(at);if(isFinite(t)&&(!best||t<best.t))best={name:who,at:dayKey(at),t};});
  return best;
 }
 /* 2026-10-07 design_handoff_stage7_2 ④ — 실적 귀속의 두 기준을 따로 본다: '최초 연락을 받은 사원'(회의 잠정안 · 연락 기록 중 가장 이른 것 — 시도 · 부재 포함)과 '최초 실제 연결된 사원'(현재 설정 · 연락 시도 · 부재 제외).
    둘이 다르고 저장된 귀속이 없으면 '귀속 확인 필요' — 상세에 두 이름을 다 보여 준다. (두 값을 서버 필드로 따로 저장하는 것은 코덱스 몫 — 지금은 연락 기록에서 계산) */
 function firstReceive(d){let best=null;acts(d).forEach(a=>{if(!/전화|통화|문자|카카오|카톡|방문|이메일|메일/.test(String(a.type||'')))return;const who=rep(a.actor||a.actor_name||''),at=a.at||a.occurred_at||'';if(!who||!at)return;const t=Date.parse(at);if(isFinite(t)&&(!best||t<best.t))best={name:who,at:dayKey(at),t};});return best;}
 function first(d){const r=rowOf(d);if(r&&r.first_owner)return {name:rep(r.first_owner),at:dayKey(r.first_connected_at),stored:true};return firstConnect(d);}
 /* 실적 귀속(주담당): 저장된 귀속 → 최초 연결 담당자 → 지금 담당 */
 function perf(d){if(!d)return '';const r=rowOf(d);if(r&&r.performance_owner)return rep(r.performance_owner);const f=autoRule()?firstConnect(d):null;return (f&&f.name)||rep(d.assignee)||'';}
 /* 실적 나눔(중복 리드 정산이 승인된 영업건): [{name,ratio}] 합 100 */
 function shares(d){const r=rowOf(d),s=r&&Array.isArray(r.shares)?r.shares.filter(x=>x&&x.name&&Number(x.ratio)>0):[];return s.length>=2?s.map(x=>({name:rep(x.name),ratio:Number(x.ratio)})):[];}
 function attribution(d){const a=firstReceive(d),b=first(d),r=rowOf(d),stored=!!(r&&r.performance_owner),differ=!!(a&&b&&a.name&&b.name&&a.name!==b.name);return {received:a,connected:b,differ,stored,pending:differ&&!stored};}
 function info(d){const now=rep(d.assignee)||'',p=perf(d),f=first(d),sh=shares(d);return {current:now,first:f,perf:sh.length?sh.map(x=>x.name+' '+x.ratio+'%').join(' · '):p,sub:sh.length?'실적 나눔 · 정산 내역에 기록':p&&now&&p!==now?'주담당 · '+now+' 보조':'주담당',stored:!!rowOf(d),shares:sh};}
 /* 변경 이력: 최초 연결 → 담당 변경(서버 기록 · 예전 것은 기존 담당 이력) → 귀속 변경 요청 · 승인 */
 function history(d){
  const out=[],f=first(d),ev=events.get(String(d.id))||[];
  if(f&&f.name)out.push({k:f.at||'',t:'최초 담당 '+f.name+' · 첫 연결 (주담당 확정)'});
  const seen=new Set();
  ev.forEach(e=>{const k=dayKey(e.at);if(e.action==='reassign'){seen.add(rep(e.from_owner)+'>'+rep(e.to_owner)+'@'+k);out.push({k,t:'담당 변경 '+rep(e.from_owner)+' → '+rep(e.to_owner)+' · 사유: '+String(e.reason||'')+' · '+(e.attribution==='request'?'귀속 변경 요청':'귀속 유지')});}
   else if(e.action==='attribution_change')out.push({k,t:(e.attribution==='split'?'실적 나눔 '+String(e.to_owner||''):'귀속 변경 '+(e.from_owner?rep(e.from_owner)+' → ':'')+rep(e.to_owner))+' · '+(rep(e.actor_name)||'승인자')+' 승인 완료'});});
  let p={};try{p=R.itemPatch(d,'deal')||{};}catch(e){}
  (p.assignmentHistory||d.assignmentHistory||[]).forEach(x=>{const k=dayKey(x.at),id=rep(x.from)+'>'+rep(x.to)+'@'+k;if(!x.to||!x.from||x.from==='—'||seen.has(id))return;seen.add(id);out.push({k,t:'담당 변경 '+rep(x.from)+' → '+rep(x.to)+(x.reason?' · 사유: '+x.reason:'')});});
  try{const AI=R.ApprovalInbox;if(AI&&AI.enabled())AI.forDeal(d.id).filter(x=>x.code==='owner_change').forEach(x=>{if(x.state==='pending')out.push({k:dayKey(x.at),t:'귀속 변경 요청 → 승인함 대기'});else if(x.state==='rejected')out.push({k:dayKey(x.decidedAt||x.at),t:'귀속 변경 요청 반려'+(x.by?' · '+x.by:'')+(x.note?' — '+x.note:'')});else if(x.state==='approved'&&!ev.some(e=>e.action==='attribution_change'))out.push({k:dayKey(x.decidedAt||x.at),t:'귀속 변경 승인'+(x.by?' · '+x.by+' 승인 완료':'')});});}catch(e){}
  return out.map((x,i)=>Object.assign(x,{i})).sort((a,b)=>String(a.k).localeCompare(String(b.k))||a.i-b.i).slice(-8);
 }
 /* ── 상세 왼쪽: 담당 정보 상자 ── */
 function cardHtml(d){
  const I=info(d),H=history(d),A=attribution(d),open=!!st().open;
  /* 접어 둔 채로 시작(2026-10-05 대표 "이거는 접어 두게 해 줘 · 담당 정보 ; 이필선 해 놓고") — 머리줄에 지금 담당 이름, [펼치기]를 누르면 최초 담당 · 실적 귀속 · 변경 이력. 펼친 상태는 창을 바꿔도 유지 */
  const head='<header><b>담당 정보</b><span class="do-cur">'+h(I.current||'미배정')+'</span><i></i><button type="button" class="lnk" data-do="fold" aria-expanded="'+open+'">'+(open?'접기':'펼치기')+'</button></header>';
  if(!open)return head;
  return head+'<div class="do-grid"><span>현재 담당</span><b>'+h(I.current||'미배정')+'</b>'
   +'<span>최초 연락 받은 사원</span><span>'+(A.received&&A.received.name?h(A.received.name)+(A.received.at?' <small>'+h(dot(A.received.at))+'</small>':'')+' <em class="do-conf">회의 잠정안</em>':'<small>아직 없음 — 연락 기록 전</small>')+'</span>'
   +'<span>최초 실제 연결된 사원</span><span>'+(I.first&&I.first.name?h(I.first.name)+(I.first.at?' <small>첫 연결 '+h(dot(I.first.at))+'</small>':'')+' <em class="do-conf cur">현재 설정</em>':'<small>아직 없음 — 첫 연결 전</small>')+'</span>'
   +'<span>실적 귀속</span><b class="perf">'+h(I.perf||'미배정')+' <small>'+h(I.sub)+'</small></b>'+(A.pending?'<p class="do-pend" role="status"><b>귀속 확인 필요</b> 두 사람이 다릅니다('+h(A.received.name)+' · '+h(A.connected.name)+') — 확정 전에는 실적 · 정산에 자동 반영하지 않는 건으로 봅니다</p>':'')+'</div>'
   +'<div class="do-hist"><span>변경 이력</span>'+(H.length?H.map(x=>'<div><span>'+h(dot(x.k))+'</span><span>'+h(x.t)+'</span></div>').join(''):'<p>아직 변경 이력이 없습니다</p>')+'</div>';
 }
 /* ── 담당자 변경 창: 실적 귀속 선택 ── */
 function attrHtml(d,to){
  const S=st(),I=info(d),req=S.attr==='request',same=to&&to===I.perf;
  const note=same?'새 담당이 주담당입니다 — 귀속은 그대로입니다.':req?'귀속 변경은 바로 바뀌지 않고 예외 승인함으로 갑니다. 승인자'+(names()?'('+names()+')':'')+' 승인 후 반영 · 이력 기록.':'담당만 바뀌고 수주실적 · 인센티브는 '+(I.perf||'지금 담당')+'(주담당) 유지. '+(to&&to!==I.current?to+josa(to):'새 담당은')+' 보조로 표시됩니다.';
  return '<b>실적 귀속</b><div class="do-chips">'+[['keep','주담당 유지 (기본)'],['request','귀속도 변경 요청']].map(o=>'<button type="button" data-do="attr" data-v="'+o[0]+'" aria-pressed="'+(S.attr===o[0])+'"'+(same?' disabled':'')+'>'+o[1]+'</button>').join('')+'</div><p class="do-note '+(req&&!same?'req':'keep')+'">'+h(note)+'</p>';
 }
 function decorate(){
  const v=document.getElementById('detailView'),d=cur();
  document.querySelectorAll('.do-card,.do-attr').forEach(n=>n.remove());
  if(!v||!d||!enabled())return;
  const secs=[...v.querySelectorAll('.dw-left .dv3-sec')],title=x=>{const b=x.querySelector(':scope>header>b');return b?b.textContent.trim():'';},site=secs.find(x=>title(x)==='현장 정보')||secs.find(x=>/^(이 단지 영업 이력|같은 현장 다른 영업|지금 영업건)$/.test(title(x)));/* 왼쪽 '현장 정보'가 빠진 뒤(2026-10-05)에는 영업 이력 칸 아래 */
  if(site){const sec=document.createElement('section');sec.className='dv3-sec do-card';sec.innerHTML=cardHtml(d);site.after(sec);}
  /* 담당자 변경 창(기존 담당자 관리 상자)에 실적 귀속 선택을 얹는다 — 재배정돼도 귀속 유지가 켜져 있을 때 */
  const sel=document.getElementById('dv-assignee'),card=sel&&sel.closest('.dcard'),actions=card&&card.querySelector('.dactions');
  if(card&&actions&&keepRule()&&available()){
   const lab=sel.closest('.field')&&sel.closest('.field').querySelector('label');if(lab&&lab.textContent.trim()==='현재 담당자')lab.textContent='새 담당';
   const rl=card.querySelector('#rs-asg>label');if(rl&&/담당자 변경 근거/.test(rl.textContent))rl.innerHTML='변경 사유 <span class="req">*</span>';
   const box=document.createElement('div');box.className='do-attr';box.innerHTML=attrHtml(d,rep(sel.value));actions.before(box);
   if(!sel.dataset.do){sel.dataset.do='1';sel.addEventListener('change',()=>{const b=document.querySelector('.do-attr'),x=cur();if(b&&x)b.innerHTML=attrHtml(x,rep(sel.value));});}
  }
  ensure(d).then(changed=>{if(changed&&cur()&&String(cur().id)===String(d.id)){try{decorate();}catch(e){}}}).catch(()=>{});
 }
 document.addEventListener('click',e=>{const f=e.target.closest('#detailView .do-card [data-do="fold"]');if(!f)return;e.preventDefault();st().open=!st().open;try{decorate();}catch(x){}});
 document.addEventListener('click',e=>{const b=e.target.closest('[data-do="attr"]');if(!b||b.disabled)return;e.preventDefault();st().attr=b.dataset.v;const box=b.closest('.do-attr'),sel=document.getElementById('dv-assignee'),d=cur();if(box&&d)box.innerHTML=attrHtml(d,rep(sel&&sel.value));});
 /* ── 담당 변경이 끝난 뒤: 사유 · 귀속 선택 기록 + (요청이면) 승인 요청 ── */
 async function after(d,o){
  if(!available()||!keepRule())return;
  const keep=o.perfBefore||o.from,req=o.attr==='request'&&o.to!==keep;
  try{const r=await R.OpsStore.rpc(RPC.reassign,{deal_id:String(d.id),from:o.from,to:o.to,reason:o.reason,attribution:req?'request':'keep',keep_owner:keep,first_owner:o.first&&o.first.name||undefined,first_connected_at:o.first&&o.first.at||undefined});take(r.owner);events.delete(String(d.id));}
  catch(e){toast('담당은 바뀌었지만 실적 귀속 기록은 남기지 못했습니다: '+String(e&&e.message||e),'warn');try{decorate();}catch(x){}return;}
  if(req){
   const AI=R.ApprovalInbox;
   try{if(!AI||!AI.enabled()||!R.OpsStore.has(AI.RPC.request))throw Error('예외 승인함을 쓸 수 없는 상태입니다');
    const r=await R.OpsStore.rpc(AI.RPC.request,{type:'owner_change',deal_id:String(d.id),title:(String(d.site||'').trim()+' '+keep+' → '+o.to).trim().slice(0,120),reason:o.reason,payload:{fields:[{l:'현재 귀속',v:keep+' (주담당)',auto:true},{l:'바꿀 귀속',v:o.to,auto:true}],from_owner:keep,to_owner:o.to,evidence:null}});
    AI.take(r.request);toast('담당을 바꿨습니다 — 귀속 변경은 예외 승인함에 올라갔습니다(승인 전까지 '+keep+' 유지)');}
   catch(e){toast('담당은 바뀌었지만 귀속 변경 요청은 올리지 못했습니다: '+String(e&&e.message||e),'warn');}
  }else toast('담당을 바꿨습니다 — 실적 귀속은 '+keep+'(주담당) 유지');
  st().attr='keep';
  try{R.DealDetailV3&&R.DealDetailV3.apply();}catch(e){}
 }
 /* Server ACK precedes local owner/history updates. One request id survives an uncertain retry. */
 const pendingChanges=new Map();
 async function change(d,o){
  if(!R.OpsStore?.has(RPC.change)||R.CRMRelease?.has(RPC.change)===false)throw Error('담당 변경 서버 적용 대기');
  const identity=String(R.ME?.id||R.ME?.name||''),key=String(d.id),payload={deal_id:key,from:o.from,to:o.to,reason:o.reason,attribution:o.attr,
   memo:String(R.G.dealOwnerV2?.memo||'').trim()};
  const signature=JSON.stringify(payload);let pending=pendingChanges.get(key);
  if(pending?.busy)return null;
  if(!pending||pending.signature!==signature){pending={signature,requestId:crypto.randomUUID(),busy:false};pendingChanges.set(key,pending);}
  pending.busy=true;
  try{
   const r=await R.OpsStore.rpc(RPC.change,{...payload,request_id:pending.requestId});
   if(String(R.ME?.id||R.ME?.name||'')!==identity)throw Error('로그인 사용자가 변경되었습니다. 새로고침 후 확인해 주세요');
   if(r.deal_id!==key||r.assignee!==o.to||!r.activity_id||!Number.isInteger(r.version))throw Error('담당 변경 저장 확인 응답이 올바르지 않습니다');
   const p=R.itemPatch(d,'deal');
   // Apply only acknowledged task IDs; never infer a transfer from a local draft's owner.
   const transfers=Array.isArray(r.transferred_next_actions)?r.transferred_next_actions:[];
   for(const holder of [d,p])for(const field of ['next_action','nextActionObj']){
    const task=holder[field];if(!task||task.status!=='open')continue;
    const moved=transfers.find(x=>x&&x.id===task.id&&x.to===r.assignee&&typeof x.from==='string');
    if(!moved)continue;
    for(const ownerField of ['assignee','assignee_name']){
     if(typeof task[ownerField]==='string'&&task[ownerField].trim()===moved.from.trim())task[ownerField]=moved.to;
    }
   }
   d.assignee=p.assignee=r.assignee;d.owner_id=r.owner_id;d.version=r.version;
   p.assignmentHistory=p.assignmentHistory||[];
   p.assignmentHistory.push({at:r.server_at,from:o.from,to:r.assignee,actor:rep(R.ME?.name),reason:o.reason,request_id:pending.requestId});
   p.activities=p.activities||d.activities||[];
   if(!p.activities.some(x=>x.id===r.activity_id))p.activities.push({id:r.activity_id,type:'담당자변경',note:(o.from||'미배정')+' → '+r.assignee,result:o.reason,at:r.server_at,actor_name:rep(R.ME?.name)});
   d.activities=p.activities;
   if(r.owner)take(r.owner);events.delete(key);
   if(r.approval)R.ApprovalInbox?.take(r.approval);
   R.WorkRequest?.load(true)?.catch(()=>{});
   R.saveLocal?.();R.renderDetail?.();
   toast(r.approval?'담당 변경과 인계 요청을 저장했습니다 · 귀속 변경은 승인 대기':'담당 변경과 인계 기록을 저장했습니다');
   st().attr='keep';pendingChanges.delete(key);return r;
  }finally{pending.busy=false;}
 }
 /* 기존 담당자 변경 저장을 감싼다: 저장이 실제로 담당을 바꿨을 때만 뒤처리 */
 function wrap(){
  const base=R.saveAssigneeChange;if(typeof base!=='function'||base.__do)return;
  const fn=function(){
   const c=R.CUR_DETAIL;if(!enabled()||!c||c.kind!=='deal')return base.apply(this,arguments);
   const d=c.item,sel=document.getElementById('dv-assignee'),from=rep(d.assignee),to=rep(sel&&sel.value);let reason='';try{reason=R.reasonValue('rs-asg');}catch(e){}
   const I=info(d),o={from,to,reason,attr:st().attr||'keep',perfBefore:I.perf||from,first:I.first};
   if(!R.FIELD_DEMO){
    if(!to||to===from||!reason)return Promise.resolve(null);
    if(R.PeopleEligibility&&!R.PeopleEligibility.allowed(R.SALES_PEOPLE_MASTER,'pipeline',d,to)){
     toast('이 현장의 조직에 속한 활성 영업담당자를 선택해 주세요');return Promise.resolve(null);
    }
    return change(d,o).catch(e=>{toast('담당 변경 저장 실패: '+String(e&&e.message||e),'warn');return null;});
   }
   const r=base.apply(this,arguments);
   if(to&&to!==from&&rep(d.assignee)===to)after(d,o);
   return r;
  };
  fn.__do=true;R.saveAssigneeChange=fn;
 }
 wrap();document.addEventListener('DOMContentLoaded',wrap);
 root.DealOwner={enabled,available,perf,first,firstReceive,attribution,info,shares,history,load,ensure,take,decorate,after,change,RPC,state:st};
})(window);
