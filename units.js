/* 관리 단위 (2026-10-10 design_handoff_units · 시안 '관리 단위 · 현장 아래 영업건 시안.dc.html') — 배치 그대로 · 데이터 단위와 그게 보이는 곳만.
   4층: 고객(사람) → 현장(단지) → 영업건(공종 · 연도) → 업무 · 요청.
   - 연락 이력 · 관계자 = 현장 공통(같은 현장의 영업건을 모아 센다) / 단계 · 금액 · 다음 행동 · 책임자 · 참여 역할 · 브랜드 3종 · 요청 · 완료 조건 = 영업건에만.
   - 주담당(실적 귀속) = DealOwner.perf 한 곳(crm_deal_owners) — 여기서 다시 저장하지 않는다. 책임자 1명 = 다음 행동의 담당(next_actions.assignee), 없으면 영업건 담당.
   - 참여 역할(지원 · 외부영업 · 관리 · 시공 담당) · 브랜드 3종(유입 · 제안 · 계약)은 서버 crm_security.deal_units(sql/deal-units-v1-20261010.sql)에 저장. 저장된 값이 없으면 지금 자료에서 추정해 보여 주고 '추정 · 저장 전'이라고 적는다(자료를 만들어 쓰지 않는다).
   - 영업건 A 의 처리(수주 · 연락 기록)는 영업건 B 의 업무를 완료시키지 않는다 — 요청 · 업무는 영업건 id 에만 연결(현장명 연결 X).
   - 수주 → 시공 인계: 공사 범위 · 제외 사항 · 금액 · 일정 · 고객 약속 요약 → 시공 담당에게 [수령 확인 요청](요청 엔진 kind support · 이름 '시공 인계 수령 확인') → 시공 담당이 [수령 확인]해야 영업 단계 종료로 본다.
   - 실주: 영업건 종료 ≠ 현장 관계 종료 — 현장 관계 줄(유지 · 다음 확인 · 근거)을 보여 주고, 재접촉 업무는 근거 + 예정일이 있을 때만(같은 현장의 열린 영업건 또는 새 영업건에서).
   - 집계 대조: 회사 수주실적 = 영업건 단위 1번(낙찰금액) · 개인 = 주담당 귀속 · 지원자는 기여 표시만(금액 합산 X).
   보이는 곳: 영업건 상세 오른쪽(결정 일정 · 협업 상자 아래) '관리 단위 · 영업건' 상자 · 고객 자산 상세 '지금 진행 중인 영업' 줄 밑 한 줄. 끄기: G.dealUnitsOff=true */
(function(root,factory){const api=factory(root);if(typeof module==='object'&&module.exports)module.exports=api;else root.DealUnits=api;})(typeof window==='undefined'?globalThis:window,function(root){
 'use strict';
 const R=root,h=v=>R.esc?R.esc(String(v==null?'':v)):String(v==null?'':v),attr=v=>R.escAttr?R.escAttr(String(v==null?'':v)):String(v==null?'':v);
 const SAVE='crm_deal_unit_save_v1',LIST='crm_deal_unit_list_v1',SQL='sql/deal-units-v1-20261010.sql';
 const ROLES=Object.freeze(['지원','외부영업','관리','시공 담당']),MAIN='주담당';
 const BRANDS=()=>Array.isArray(R.BRANDS)?R.BRANDS.filter(b=>b!=='기술자문'):['석민이앤씨','POUR솔루션','POUR공법','아파트스퀘어'];
 const RECEIPT_LABEL='시공 인계 수령 확인',OPEN=['sent','seen','working'];
 const on=()=>!(R.G&&R.G.dealUnitsOff);
 const O=()=>R.OpsStore;
 const avail=()=>{try{return !!(O()&&O().has(SAVE)&&O().has(LIST)&&(!R.CRMRelease||R.CRMRelease.has(SAVE)!==false));}catch(e){return false;}};
 const rep=v=>{try{return R.repN(v)||'';}catch(e){return String(v||'').trim();}};
 const toast=(m,k)=>{if(typeof R.toast==='function')R.toast(m,k);};
 const st=()=>{const g=R.G||(R.G={});return g.dealUnits||(g.dealUnits={edit:'',role:ROLES[0],who:'',busy:false,err:'',brand:null,roles:null});};
 /* ── 서버 값 ── */
 let rows=new Map(),at=0,busy=false,who='';
 function take(u){if(u&&u.deal_id)rows.set(String(u.deal_id),u);}
 async function load(force){
  if(!avail()||busy)return false;const me=String(R.ME&&(R.ME.id||R.ME.name)||'');if(!force&&who===me&&Date.now()-at<60000)return false;
  busy=true;try{const r=await O().rpc(LIST,{});rows=new Map((r&&r.units||[]).map(u=>[String(u.deal_id),u]));at=Date.now();who=me;return true;}catch(e){at=Date.now();return false;}finally{busy=false;}
 }
 const rowOf=d=>d?rows.get(String(d.id))||null:null;
 /* ── 영업건 단위 값 ── */
 function perf(d){try{if(R.DealOwner&&R.DealOwner.perf){const p=R.DealOwner.perf(d);if(p)return p;}}catch(e){}return rep(d.assignee);}
 /* 참여 역할: 저장값 → 없으면 실적 나눔(중복 리드 정산)의 다른 사람을 '지원'으로 추정 */
 function roles(d){
  const u=rowOf(d),main=perf(d);
  const saved=u&&Array.isArray(u.roles)?u.roles.filter(x=>x&&x.name&&ROLES.includes(x.role)).map(x=>({name:rep(x.name),role:x.role})):null;
  let list=saved?saved.slice():[];
  if(!saved){try{const sh=R.DealOwner&&R.DealOwner.shares?R.DealOwner.shares(d):[];sh.forEach(x=>{if(x.name&&x.name!==main)list.push({name:x.name,role:'지원',est:true});});}catch(e){}}
  return {main,list:list.filter(x=>x.name!==main),saved:!!saved,est:!saved&&list.length>0};
 }
 /* 브랜드 3종: 저장값 → 없으면 지금 자료에서 추정(유입 = 수주 기록의 유입 브랜드 · 처음 사업 · 영업건 브랜드, 제안 = 지금 사업 · 영업건 브랜드, 계약 = 수주 확정 건의 영업 경로 브랜드만) */
 function brand3(d){
  const u=rowOf(d);if(u&&(u.brand_inflow||u.brand_proposal||u.brand_contract))return {inflow:u.brand_inflow||'',proposal:u.brand_proposal||'',contract:u.brand_contract||'',saved:true};
  let w={type:''},res='in_progress';try{w=R.CRMRules.winOf(d);res=R.CRMRules.dealResult(d);}catch(e){}
  const raw=d.win&&d.win.win_status==='confirmed'?d.win:{};
  return {inflow:String(raw.inflow_brand||d.origin_business||d.brand||''),proposal:String(d.current_business||d.brand||''),contract:res==='won_own'?String(w.brand||d.brand||''):res==='won_partner_tech'||res==='won_transfer'?String(w.brand||''):'',saved:false};
 }
 /* 책임자 1명 = 다음 행동의 담당 → 없으면 영업건 담당 */
 function responsible(d){let a=null;try{a=R.actionObj?R.actionObj(d,R.itemPatch(d,'deal')):null;}catch(e){}const w=a&&(a.assignee||a.assignee_name)?rep(a.assignee||a.assignee_name):'';return w||rep(d.assignee)||'미배정';}
 /* 이 영업건에 연결된 열린 요청(요청 엔진 · 영업건 id 로만) */
 function requests(d){try{const W=R.WorkRequest;if(!W||!W.enabled())return [];return (W.state().list||[]).filter(r=>r.target_type==='deal'&&String(r.target_id)===String(d.id)&&OPEN.includes(r.status));}catch(e){return [];}}
 /* 같은 현장(현장 id, 없으면 현장명)의 다른 영업건 */
 function siblings(d){
  const sid=String(d.cleanup_site_id||d.site_id||d.siteId||''),ns=R.normSite?R.normSite(d.site||''):'';
  return ((R.B&&R.B.deals)||[]).filter(x=>String(x.id)!==String(d.id)&&(sid?String(x.cleanup_site_id||x.site_id||x.siteId||'')===sid:!!ns&&R.normSite(x.site||'')===ns));
 }
 /* 현장 공통: 관계자 · 연락 이력(같은 현장 영업건 전체) */
 function siteCommon(d){
  let contacts=0;try{contacts=(R.siteContacts(d,R.itemPatch(d,'deal'))||[]).length;}catch(e){}
  const sib=siblings(d),acts=[d].concat(sib).reduce((s,x)=>s+(Array.isArray(x.activities)?x.activities.length:0),0);
  return {contacts,acts,siblings:sib};
 }
 function workOf(d){try{const w=R.dealWorkSummary(d);return w&&!/미분류/.test(w)?w:'공종 미분류';}catch(e){return String(d.work_name||d.work||'공종 미분류');}}
 function yearOf(d){const sc=d.stage_contexts||{},f=sc.first_contact&&sc.first_contact.fields||{};const y=String(d.construction_year||f.expected_timing||'');const m=/(20\d{2})/.exec(y);return m?m[1]:String(d.created||d.created_at||'').slice(0,4);}
 /* 영업건 꼬리표(현장 공통 이력에서 어느 영업건인지): '2025 옥상방수' */
 function tagOf(d){try{return (yearOf(d)+' '+workOf(d)).trim();}catch(e){return '';}}
 /* 새 문의 3택의 결과 — 영업건이 어떻게 생겼는지: new_site(다른 현장 · 신규) / same_site(같은 현장 · 새 영업건) — 둘만 신규 영업건 수에 세고, 신규 현장 수는 new_site 만. 같은 영업건에 붙인 문의는 영업건을 만들지 않으므로 여기 오지 않는다 */
 function newness(d){const sib=siblings(d),mine=String(d.created||d.created_at||'');const older=sib.some(x=>String(x.created||x.created_at||'')<mine);return older?'same_site':'new_site';}
 function newCounts(deals){let n=0,sites=0;(deals||[]).forEach(d=>{n++;if(newness(d)==='new_site')sites++;});return {deals:n,sites};}
 function unit(d){
  let stage='';try{stage=R.stageLabel(R.dealStage(d));}catch(e){}
  return {id:String(d.id||''),short:'#'+String(d.id||'').replace(/-.*$/,'').slice(-6).toUpperCase(),work:workOf(d),year:yearOf(d),stage,amount:Number(R.oppAmt?R.oppAmt(d):d.amt)||0,responsible:responsible(d),roles:roles(d),brand:brand3(d),requests:requests(d),site:siteCommon(d)};
 }
 /* ── 수주 → 시공 인계 ── */
 function receipt(d){
  try{const W=R.WorkRequest;if(!W||!W.enabled())return {state:'off'};const L=(W.state().list||[]).filter(r=>r.target_type==='deal'&&String(r.target_id)===String(d.id)&&r.kind==='support'&&r.label===RECEIPT_LABEL);
   const done=L.find(r=>r.status==='done'||r.status==='replied'),open=L.find(r=>OPEN.includes(r.status));if(done)return {state:'done',r:done};if(open)return {state:'open',r:open};return {state:'none'};}catch(e){return {state:'off'};}
 }
 function handoverSummary(d){
  const sc=k=>{const c=d.stage_contexts&&d.stage_contexts[k];return c&&c.fields||{};},con=sc('contract'),cs=sc('construction'),amt=Number(con.contract_amount||cs.contract_amount||d.contract_amount)||0,fmt=v=>{try{return R.fmtAmt(v);}catch(e){return String(v);}};
  const wk=workOf(d),ws=String(d.work_summary||'').trim();
  return [['공사 범위',wk+(ws&&ws!==wk?' · '+ws:'')],['제외 사항',con.exclusions||cs.exclusions||'미기록'],['금액',amt?fmt(amt):'미기록'],['일정',[cs.start_date?'착공 '+cs.start_date:'',cs.completion_due?'준공 예정 '+cs.completion_due:''].filter(Boolean).join(' · ')||'미기록'],['고객 약속',con.special_terms||cs.requests||'미기록']];
 }
 async function askReceipt(d){
  const W=R.WorkRequest,o=O(),S=st();if(!W||!W.enabled()||!o||!o.has(W.RPC.create)){toast('요청 저장소가 아직 서버에 없습니다','warn');return;}
  const to=roles(d).list.find(x=>x.role==='시공 담당');if(!to){S.err='참여 역할에 시공 담당을 먼저 넣어 주세요';return repaint();}
  const at=new Date();at.setDate(at.getDate()+3);at.setHours(23,59,0,0);S.busy=true;S.err='';repaint();
  try{await o.rpc(W.RPC.create,{target_type:'deal',target_id:String(d.id),site:d.site||d.site_name||'',brand:d.brand||'',kind:'support',label:RECEIPT_LABEL,to_scope:'user',to_name:to.name,asks:['공사 범위 확인','제외 사항 확인','금액 · 일정 확인','고객 약속 확인','수령 확인'],due_at:at.toISOString(),due_label:'3일 안',memo:handoverSummary(d).map(x=>x[0]+': '+x[1]).join('\n')});
   toast(to.name+'에게 시공 인계 수령 확인을 요청했습니다 · 수령 확인 전까지 영업 단계가 끝나지 않습니다');try{W.load(true);}catch(e){}}
  catch(e){S.err='요청을 보내지 못했습니다: '+String(e&&e.message||e);}
  S.busy=false;repaint();
 }
 /* ── 실주 뒤 현장 관계 ── */
 function relationAfterLost(d){
  const sc=d.stage_contexts&&d.stage_contexts.lost&&d.stage_contexts.lost.fields||{};
  const open=siblings(d).filter(x=>{try{return R.isOpen(x);}catch(e){return false;}});
  return {keep:true,next:String(sc.recontact_possibility||d.wake_up_at||'').slice(0,10)||'',basis:String(sc.lesson||sc.close_detail||'').trim(),reengage:String(sc.reengage||''),openSiblings:open};
 }
 /* ── 집계 대조(④): 회사 = 영업건 단위 1번 · 개인 = 주담당만 · 지원자 = 기여 표시만 ── */
 function companySum(deals){let n=0,sum=0;(deals||[]).forEach(d=>{try{const r=R.CRMRules.dealResult(d);if(!/^won_/.test(r))return;n++;sum+=Number(R.CRMRules.amounts(d).incentive)||0;}catch(e){}});return {n,sum};}
 function personal(deals){const m=new Map();(deals||[]).forEach(d=>{try{const r=R.CRMRules.dealResult(d);if(!/^won_/.test(r))return;const who=perf(d)||'미배정',v=m.get(who)||{n:0,sum:0,support:0};v.n++;v.sum+=Number(R.CRMRules.amounts(d).incentive)||0;m.set(who,v);roles(d).list.forEach(x=>{const s=m.get(x.name)||{n:0,sum:0,support:0};s.support++;m.set(x.name,s);});}catch(e){}});return m;}
 /* ── 상세 오른쪽 상자 ── */
 const dot=s=>{const m=/^(\d{4})-(\d{2})-(\d{2})/.exec(String(s||''));return m?Number(m[2])+'.'+Number(m[3]):'';};
 const money=n=>{n=Number(n)||0;if(!n)return '금액 미정';try{return R.fmtAmt(n);}catch(e){return n.toLocaleString('ko-KR')+'원';}};
 function people(d){try{if(R.DealOwnerV2&&R.DealOwnerV2.people)return R.DealOwnerV2.people(d)||[];}catch(e){}try{return (R.repNames&&R.repNames())||[];}catch(e){return [];}}
 function html(d,closed){
  const S=st(),U=unit(d),ed=S.edit===U.id,can=avail()&&!S.busy,bz=S.brand||U.brand,rl=S.roles||U.roles.list;
  const chip=(x,i)=>'<span class="dvu-chip'+(x.est?' est':'')+'">'+h(x.name)+' <small>'+h(x.role)+'</small>'+(ed?'<button type="button" data-dvu="rdel" data-i="'+i+'" aria-label="빼기">×</button>':'')+'</span>';
  const rolesHtml='<span class="dvu-chip main">'+h(U.roles.main||'미배정')+' <small>'+MAIN+' · 실적 귀속</small></span>'+rl.map(chip).join('')+(U.roles.est&&!ed?'<em class="dvu-est">추정 · 저장 전</em>':'')
   +(ed?'<span class="dvu-add"><select data-dvu-in="who" aria-label="참여자"><option value="">사람</option>'+people(d).filter(n=>n!==U.roles.main).map(n=>'<option value="'+attr(n)+'"'+(S.who===n?' selected':'')+'>'+h(n)+'</option>').join('')+'</select><select data-dvu-in="role" aria-label="역할">'+ROLES.map(r=>'<option value="'+attr(r)+'"'+(S.role===r?' selected':'')+'>'+h(r)+'</option>').join('')+'</select><button type="button" data-dvu="radd">넣기</button></span>':'');
  const bsel=(k,v)=>'<select data-dvu-in="b-'+k+'" aria-label="'+{inflow:'유입',proposal:'제안',contract:'계약'}[k]+' 브랜드"><option value="">미정</option>'+BRANDS().map(b=>'<option value="'+attr(b)+'"'+(v===b?' selected':'')+'>'+h(b)+'</option>').join('')+'</select>';
  const brandHtml=ed?'<span class="dvu-b3">유입 '+bsel('inflow',bz.inflow)+' → 제안 '+bsel('proposal',bz.proposal)+' → 계약 '+bsel('contract',bz.contract)+'</span>'
   :'<span class="dvu-b3">유입 <b>'+h(U.brand.inflow||'미정')+'</b> → 제안 <b>'+h(U.brand.proposal||'미정')+'</b> → 계약 <b>'+h(U.brand.contract||'미정')+'</b></span>'+(U.brand.saved?'':'<em class="dvu-est">추정 · 저장 전</em>');
  const reqHtml=U.requests.length?U.requests.map(r=>'<span class="dvu-req">'+h((r.requested_by||'관리자')+' '+r.label+' · '+(r.due_label||dot(r.due_at)))+'</span>').join(''):'<span class="dvu-mute">없음</span>';
  const sib=U.site.siblings,siteHtml='연락 이력 '+U.site.acts+'건 · 관계자 '+U.site.contacts+'명 · 같은 현장 영업건 '+(sib.length+1)+'건'+(sib.length?' ('+sib.slice(0,3).map(x=>workOf(x)+' '+yearOf(x)).join(' · ')+(sib.length>3?' 외 '+(sib.length-3):'')+')':'');
  const code=(()=>{try{return R.dealStage(d);}catch(e){return '';}})(),isLost=/lost|nocontact|badfit/.test(String(code)),isCon=/contract|construction|won|completion/.test(String(code));
  let extra='';
  if(isCon){const rc=receipt(d),HS=handoverSummary(d);
   const state=rc.state==='done'?'<b class="ok">수령 확인 완료 · '+h(dot(rc.r.closed_at||rc.r.updated_at))+' · '+h(rc.r.to_name||'')+'</b>':rc.state==='open'?'<b class="amb">수령 확인 대기 · '+h(rc.r.to_name||'')+' · 기한 '+h(rc.r.due_label||dot(rc.r.due_at))+'</b>':rc.state==='off'?'<span class="dvu-mute">요청 저장소 적용 전</span>':'<button type="button" data-dvu="receipt"'+(can?'':' disabled')+'>수령 확인 요청</button>';
   extra+='<div class="dvu-row dvu-ho"><span>시공 인계</span><div><dl>'+HS.map(x=>'<div><dt>'+h(x[0])+'</dt><dd>'+h(x[1])+'</dd></div>').join('')+'</dl><div class="dvu-rc">'+state+'<small>시공 담당이 수령 확인해야 영업 단계 종료</small></div></div></div>';}
  if(isLost){const rl2=relationAfterLost(d);
   extra+='<div class="dvu-row dvu-rel"><span>현장 관계</span><div><b class="ok">유지'+(rl2.next?' · 다음 확인 '+h(rl2.next):'')+'</b><small>'+h(rl2.basis?'근거: '+rl2.basis:'근거 미기록 · 실주 사유 칸의 배운 점 · 확인한 내용이 근거가 됩니다')+(rl2.reengage?' · 재영업 '+rl2.reengage:'')+'</small><small>'+(rl2.openSiblings.length?'같은 현장 진행 중 영업건 '+rl2.openSiblings.length+'건에서 재접촉 업무를 잡습니다':'재접촉 업무는 근거 + 예정일이 있을 때만 · 같은 현장 새 영업건(견적문의 → 같은 현장 · 새 영업건)으로 등록')+'</small></div></div>';}
  const foot=ed?'<div class="dvu-ft">'+(S.err?'<em>'+h(S.err)+'</em>':'<span>'+(avail()?'저장하면 이력(누가 · 언제 · 전 → 후)에 남습니다':'저장은 서버 적용('+SQL+') 뒤에 할 수 있습니다')+'</span>')+'<button type="button" data-dvu="cancel">취소</button><button type="button" class="save" data-dvu="save"'+(can?'':' disabled')+'>'+(S.busy?'저장 중…':'저장')+'</button></div>'
   :'<div class="dvu-ft"><span>이 건의 처리(수주 · 연락 기록)는 같은 현장 다른 영업건의 업무를 완료시키지 않습니다</span>'+(closed?'':'<button type="button" data-dvu="edit">참여 · 브랜드 수정</button>')+(S.err&&!ed?'<em>'+h(S.err)+'</em>':'')+'</div>';
  return '<section class="dvu" data-deal="'+attr(U.id)+'"><header><b>관리 단위 · 영업건</b><small>'+h(U.short+' · '+U.work+' · '+U.year+(U.stage?' · '+U.stage:''))+'</small></header>'
   +'<div class="dvu-row"><span>책임자</span><div><b>'+h(U.responsible)+'</b><small>다음 행동의 담당 1명</small></div></div>'
   +'<div class="dvu-row"><span>참여</span><div class="dvu-chips">'+rolesHtml+'</div></div>'
   +'<div class="dvu-row"><span>브랜드</span><div>'+brandHtml+'</div></div>'
   +'<div class="dvu-row"><span>금액</span><div>'+h(money(U.amount))+'</div></div>'
   +'<div class="dvu-row"><span>요청</span><div class="dvu-chips">'+reqHtml+'</div></div>'
   +'<div class="dvu-row"><span>현장 공통</span><div><small>'+h(siteHtml)+'</small></div></div>'+extra+foot+'</section>';
 }
 /* 고객 자산 상세 '지금 진행 중인 영업' 줄 밑 한 줄 */
 function assetLine(d){if(!on())return '';try{const U=unit(d);return '<small class="dvu-al">책임자 '+h(U.responsible)+' · 참여 '+(U.roles.list.length+1)+'명 · 유입 '+h(U.brand.inflow||'미정')+' → 제안 '+h(U.brand.proposal||'미정')+' → 계약 '+h(U.brand.contract||'미정')+(U.requests.length?' · 요청 '+U.requests.length+'건':'')+'</small>';}catch(e){return '';}}
 /* ── 상세에 붙이기(deal-detail-v3 buildRight 가 부른다) ── */
 function mount(r,d,closed){
  if(!on()||!r||!d)return;r.querySelectorAll(':scope>.dvu').forEach(n=>n.remove());
  const box=document.createElement('div');box.innerHTML=html(d,!!closed);const sec=box.firstElementChild;if(!sec)return;
  const after=r.querySelector(':scope>.dcb')||r.querySelector(':scope>.dvs-task');if(after&&after.nextSibling)r.insertBefore(sec,after.nextSibling);else r.append(sec);
  load().then(ok=>{if(ok)repaint();});
 }
 function repaint(){try{if(R.CUR_DETAIL&&R.CUR_DETAIL.kind==='deal'&&typeof R.renderDetail==='function')R.renderDetail();}catch(e){}}
 const curDeal=()=>{const c=R.CUR_DETAIL;return c&&c.kind==='deal'&&c.item?c.item:null;};
 async function save(d){
  const S=st(),U=unit(d);if(S.busy)return;if(!avail()){S.err='저장은 서버 적용('+SQL+') 뒤에 할 수 있습니다';return repaint();}
  const list=(S.roles||U.roles.list).map(x=>({name:x.name,role:x.role})),bz=S.brand||U.brand;
  S.busy=true;S.err='';repaint();
  try{const r=await O().rpc(SAVE,{deal_id:String(d.id),roles:list,brand_inflow:bz.inflow||null,brand_proposal:bz.proposal||null,brand_contract:bz.contract||null});
   if(!r||r.ok!==true||!r.unit)throw Error('서버 확인 응답이 올바르지 않습니다.');take(r.unit);S.edit='';S.roles=null;S.brand=null;toast('관리 단위를 저장했습니다 · 참여 '+(list.length+1)+'명 · 브랜드 '+[bz.inflow,bz.proposal,bz.contract].map(x=>x||'미정').join(' → '));}
  catch(e){S.err='저장하지 못했습니다: '+String(e&&e.message||e);}
  S.busy=false;repaint();
 }
 function onClick(e){
  const b=e.target.closest('.dvu [data-dvu]');if(!b||b.disabled)return;const d=curDeal();if(!d)return;e.preventDefault();e.stopPropagation();const S=st(),a=b.dataset.dvu,U=unit(d);
  if(a==='edit'){S.edit=U.id;S.roles=U.roles.list.map(x=>({name:x.name,role:x.role}));S.brand=Object.assign({},U.brand);S.err='';S.who='';return repaint();}
  if(a==='cancel'){S.edit='';S.roles=null;S.brand=null;S.err='';return repaint();}
  if(a==='radd'){const sec=b.closest('.dvu'),w=sec.querySelector('[data-dvu-in="who"]'),rs=sec.querySelector('[data-dvu-in="role"]');const name=rep(w&&w.value),role=rs&&rs.value;if(!name||!ROLES.includes(role)){S.err='사람과 역할을 골라 주세요';return repaint();}S.roles=S.roles||[];if(S.roles.length>=10){S.err='참여 역할은 10명까지';return repaint();}if(!S.roles.some(x=>x.name===name&&x.role===role))S.roles.push({name,role});S.who='';S.err='';return repaint();}
  if(a==='rdel'){S.roles=(S.roles||[]).filter((_,i)=>i!==Number(b.dataset.i));return repaint();}
  if(a==='save')return save(d);
  if(a==='receipt')return askReceipt(d);
 }
 function onChange(e){const t=e.target;if(!t||!t.matches||!t.closest('.dvu'))return;const S=st(),k=t.dataset.dvuIn;if(k==='who')S.who=t.value;else if(k==='role')S.role=t.value;else if(/^b-/.test(k||'')){S.brand=S.brand||{};S.brand[k.slice(2)]=t.value;}}
 if(typeof document!=='undefined'){document.addEventListener('click',onClick,true);document.addEventListener('change',onChange,true);}
 return {on,avail,load,take,unit,tagOf,newness,newCounts,roles,brand3,responsible,requests,siblings,siteCommon,receipt,handoverSummary,relationAfterLost,companySum,personal,html,assetLine,mount,ROLES,MAIN,RECEIPT_LABEL,SAVE,LIST,state:st,_rows:()=>rows};
});
