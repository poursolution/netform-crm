/* Inquiry controller only. The approved D renderer owns every node and style. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory;else root.MobileInquiryEntry=factory(root);})(typeof window==='object'?window:globalThis,function(root){
 'use strict';
 const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,LIFE=30*60*1000,SOURCE='approved-inquiry-d-v1';
 const clone=x=>JSON.parse(JSON.stringify(x)),serial=x=>JSON.stringify(x),fail=m=>{throw Error(m);},message=e=>String(e?.message||e),journal=()=>root.MobileSaveJournal;
 const keys=['res','memo','mode','purpose','date','reason','plan','touchedNext'];
 const clean=s=>Object.fromEntries(keys.map(k=>[k,s[k]]));
 function validInput(s){return !!s&&typeof s==='object'&&typeof s.res==='string'&&(!s.res||root.ContactEntry.VALUES.includes(s.res))&&root.ContactEntry.MODES.some(x=>x[0]===s.mode)&&['memo','purpose','date','reason'].every(k=>typeof s[k]==='string'&&s[k].length<=({memo:300,purpose:60,date:10,reason:80}[k]))&&['internal','customer'].includes(s.plan)&&typeof s.touchedNext==='boolean';}
 const idOf=q=>String(q?.raw?.id||q?.raw?.inquiry_id||q?.id||q?.inquiry_id||q?.key||'');
 const today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul'}).format(new Date());
 const dateOK=v=>/^\d{4}-\d{2}-\d{2}$/.test(v||'')&&Number.isFinite(Date.parse(v+'T00:00:00Z'))&&new Date(v+'T00:00:00Z').toISOString().slice(0,10)===v;
 const name=v=>String(root.canonicalRep?root.canonicalRep(v):v||'').trim();
 let active=null,wiredCard=null,originalClose=null,closing=false;
 function resolve(input){
  const id=typeof input==='string'?input:idOf(input);if(!UUID.test(id))fail('문의 식별자를 확인하지 못했습니다. 목록을 다시 불러와 주세요.');
  const rows=root.ADMIN?.inquiries;if(!Array.isArray(rows))fail('문의 목록을 불러오는 중입니다.');
  const matches=rows.filter(q=>idOf(q)===id);if(matches.length!==1)fail('현재 문의 목록에서 대상을 확인하지 못했습니다.');
  const view=matches[0],raw=view.raw&&typeof view.raw==='object'?view.raw:view;
  if(raw.id&&String(raw.id)!==id||view.id&&String(view.id)!==id||UUID.test(String(view.key||''))&&view.key!==id)fail('문의 식별자가 일치하지 않습니다.');
  return {id,view,raw,q:{...raw,id,raw,nm:view.nm||raw.site||raw.site_name||raw.name||'',status:raw.status??view.status??'',rep:view.rep||raw.assignee||raw.assignee_name||''}};
 }
 function scoped(input){
  if(!root.G?.user||root.G.mode!=='rep'||(!root.LIVE&&!root.DEMO))fail('담당자 계정으로 문의를 다시 열어 주세요.');
  const j=journal(),p=root.Phase1?.profile;if(!j?.owner?.()||!j?.session?.()||!UUID.test(p?.auth_uid||'')||!UUID.test(p?.user_id||''))fail('로그인 상태를 확인하지 못했습니다.');
  const t=resolve(input),q=t.q,raw=t.raw;
  if(typeof root.InquiryB2B?.isAgreement!=='function')fail('문의 유형 확인 연결을 불러오지 못했습니다.');
  if(root.InquiryB2B.isAgreement(q)||raw.is_b2b===true||raw.inquiry_type==='b2b'||raw.b2b===true)fail('협약문의는 기존 B2B 처리 경로에서 확인해 주세요.');
  if(raw.deal_id||raw.opportunity_id||t.view.dealId||raw.qualified_at||/영업전환|전환완료|수주|실주|배드핏|연락두절|종결|종료|협약완료|해결완료/.test(q.status))fail('전환되거나 종결된 문의는 해당 처리 경로에서 확인해 주세요.');
  const rep=name(q.rep),mine=name(root.G.user.nm||p.display_name||p.name);
  if(!rep||['미배정','팀 담당','-'].includes(rep)||!mine||rep!==mine)fail('현재 담당이 확인된 본인 문의만 응대를 기록할 수 있습니다.');
  for(const k of ['assignee_id','assigned_user_id','owner_user_id'])if(raw[k]!=null&&raw[k]!==''&&(!UUID.test(String(raw[k]))||String(raw[k])!==p.user_id))fail('현재 문의 담당자가 바뀌었습니다. 목록을 다시 확인해 주세요.');
  if(UUID.test(String(raw.assigned_to||''))&&String(raw.assigned_to)!==p.user_id)fail('현재 문의 담당자가 바뀌었습니다. 목록을 다시 확인해 주세요.');
  return t;
 }
 function canOpen(q){try{const t=scoped(q);return {ok:true,id:t.id};}catch(e){return {ok:false,error:message(e)};}}
 function fingerprint(t){const q=t.q;return serial([t.id,q.status,q.rep,q.assignee_id,q.assigned_user_id,q.owner_user_id,q.assigned_to,q.updated_at,q.responded_at,q.first_response_at,root.PCInquirySave?.existing?.(q)]);}
 function assertActive(a=active){if(!a||a!==active)fail('열려 있는 문의 입력을 확인해 주세요.');journal().assertOwner(a.owner);journal().assertSession(a.session);return scoped(a.id);}
 function pending(a=active){return root.PCInquirySave.pending(a.id);}
 function frozen(a=active){return !!(a?.submitted||a?.saved);}
 function ctx(a=active){return clone(a.context);}
 function blockReason(a=active){
  if(!root.ContactEntry?.on?.()||root.G?.mobileInqOff||root.G?.mobileV2Off) return '현재 문의 응대 입력이 꺼져 있습니다.';
  if(!root.InquiryResponseContract?.enabled?.()||!root.CRMRelease?.has?.('crm_inquiry_command_v1'))return '서버 저장 연결을 확인할 수 없습니다. 입력을 유지한 채 다시 시도해 주세요.';
  if(a?.input.res==='배드핏')return '배드핏 종결은 PC의 문의 종결 경로에서 확인해 주세요. 이 입력에서는 종결하지 않습니다.';
  return '';
 }
 function plan(a=active){
  if(!a)return {ok:false,error:'열려 있는 문의 입력을 확인해 주세요.'};
  try{assertActive(a);if(a.submitted){if(serial(clean(a.input))!==a.submitted.signature)fail('저장 확인 중 입력값이 바뀌었습니다. 원래 입력으로 재시도해 주세요.');return clone(a.submitted.plan);}
   return root.ContactEntry.plan({...clean(a.input),ch:'전화',requests:[]},{...ctx(a),scheduleV1:root.ScheduleContract?.enabled?.()===true});
  }catch(e){return {ok:false,error:message(e)};}
 }
 function durable(a=active){
  assertActive(a);const found=journal().read('inquiry',a.id),raw=serial(found);
  if(raw!==a.expected&&raw!==a.attempted)fail('다른 문의 입력이 보관돼 있습니다. 기존 입력을 덮어쓰지 않았습니다.');
  const value={source:SOURCE,at:Date.now(),session:a.session,fingerprint:a.fingerprint,input:clean(a.input),context:clone(a.context),saveState:a.saveState||'draft',progress:{}};
  a.attempted=serial(value);journal().write('inquiry',a.id,value,a.owner);a.expected=a.attempted;a.attempted=undefined;
 }
 function eraseDraft(a){assertActive(a);const value=journal().read('inquiry',a.id),raw=serial(value);if(raw!==a.expected&&raw!==a.attempted)fail('다른 입력이 보관돼 있어 지우지 않았습니다.');journal().drop('inquiry',a.id,a.owner);a.expected='null';a.attempted=undefined;}
 function remember(a=active){try{durable(a);return true;}catch(e){if(a)a.input.err=message(e);return false;}}
 function dates(){const t=today(),d=root.ContactEntry;return [['내일',d.addDays(t,1)],['3일 후',d.addDays(t,3)],['다음 주 월요일',d.addDays(t,((8-new Date(t+'T00:00:00Z').getUTCDay())%7)||7)]];}
 function model(){
  const a=active;if(!a)return null;let pl=plan(a),why=blockReason(a);if(why)pl={...pl,ok:false,error:why};
  const q=a.q,detail=q.detail||{},contact={name:q.contact_name||detail.contact_name||detail.contactName||'',role:q.contact_role||detail.contact_role||''};
  return {s:a.input,d:{nm:q.nm,work_type:q.work_type||detail.workType||a.view.gj||'',construction_year:q.construction_year||'',contactAt:q.first_connected_at||''},ex:ctx(a).existing,plan:pl,ce:root.ContactEntry,contact,requests:[],requestApi:null,busy:a.busy,frozen:frozen(a),fields:null,currentPlan:'',dateOptions:dates(),today:today()};
 }
 function card(){return root.document?.getElementById('sheetcard');}
 function paint(){
  if(!active||!card())return;const c=card(),top=c.scrollTop||0;
  c.classList.add('ce-card','ce-page');c._ceMode='approved-inquiry';c._ceDeal='';
  root.document.getElementById('sheetwrap')?.classList.add('ce-page-wrap');const bg=root.document.getElementById('scr');if(bg)bg.inert=true;
  c.innerHTML=root.MobileContactView.render(model());c.scrollTop=top;
 }
 function refreshFooter(){const c=card(),m=model();if(!c||!m)return;const p=c.querySelector('.ce-prev'),b=c.querySelector('[data-ce="save"]');if(p)p.textContent=m.plan?.ok?m.plan.preview:m.plan?.error||'';if(b)b.disabled=m.busy||!m.plan?.ok;}
 function showError(e){if(active){active.input.err=message(e);paint();}return {ok:false,error:message(e)};}
 function close(options={}){
  const a=active;if(!a)return {ok:true};if(a.busy&&!options.force)return showError('서버 저장 확인 중입니다. 잠시 기다려 주세요.');
  if(!options.force&&!remember(a)){paint();return {ok:false,error:a.input.err};}
  active=null;const c=card();if(c){c._ceMode='';c._ceDeal='';c.classList.remove('ce-card','ce-page');}
  const bg=root.document?.getElementById('scr');if(bg)bg.inert=false;
  root.document?.getElementById('sheetwrap')?.classList.remove('ce-page-wrap');
  if(!closing&&originalClose){closing=true;try{originalClose.call(root);}finally{closing=false;}}
  root.render?.();return {ok:true};
 }
 function installClose(){if(originalClose)return;originalClose=root.closeSheet;root.closeSheet=function(){if(active&&!closing)return close();return originalClose?.apply(this,arguments);};}
 function open(q){
  if(active?.busy)return {ok:false,error:'서버 저장 확인 중입니다.'};
  try{
   if(typeof root.MobileContactView?.render!=='function'||typeof root.MobileApprovedDSource!=='string'||!root.ContactEntry||!root.PCInquirySave?.existing||!root.InquiryFlow?.TWO)fail('연락 결과 화면을 불러오지 못했습니다. 다시 열어 주세요.');
   const t=scoped(q);if(active&&active.id===t.id){assertActive();paint();return {ok:true};}if(active&&!close().ok)return {ok:false,error:active.input.err};
   const j=journal(),owner=j.owner(),session=j.session(),f=fingerprint(t),old=j.read('inquiry',t.id),p=root.PCInquirySave.pending(t.id);
   let input,context={today:today(),existing:root.PCInquirySave.existing(t.q)},expected=serial(old),submitted=null;
   if(p){
    if(p.surface!=='mobile-d'||!validInput(p.form)||!p.input?.plan||!Object.hasOwn(p.input,'existing'))fail('다른 문의 입력에서 시작한 저장입니다. 원래 입력에서 남은 저장을 확인해 주세요.');
    input=clean(p.form);context=p.form._inquiryContext||{today:today(),existing:p.input.existing};context.existing=clone(p.input.existing);submitted={signature:serial(input),plan:clone(p.input.plan)};
   }else if(old){
    if(old.source!==SOURCE)fail('이전 문의 입력이 보관돼 있습니다. 기존 저장 결과를 먼저 확인해 주세요.');
    if(old.session!==session)fail('로그인 세션이 바뀌어 기존 입력을 자동 복원하지 않았습니다.');
    if(!Number.isFinite(old.at)||!validInput(old.input)||!old.context||!dateOK(old.context.today)||!Object.hasOwn(old.context,'existing')||old.saveState&&!['draft','submitting','confirmed'].includes(old.saveState))fail('문의 입력 복원 정보를 확인하지 못했습니다.');
    if(old.saveState==='submitting')fail('이전 저장 결과 확인이 필요합니다. 기존 입력으로 새 기록을 다시 만들지 않았습니다.');
    if(old.saveState==='confirmed'){j.drop('inquiry',t.id,owner);expected='null';}
    else if(Date.now()-old.at<LIFE){if(old.fingerprint!==f)fail('문의 상태나 일정이 바뀌었습니다. 보관된 입력을 덮어쓰지 않았습니다.');input=clean(old.input);context=clone(old.context);}
    else {j.drop('inquiry',t.id,owner);expected='null';}
   }
   if(!input){const d=root.ContactEntry.defaults('연결됨',context.existing,today());input={res:'',memo:'',mode:d.mode,purpose:d.purpose,date:d.date,reason:'',plan:'internal',touchedNext:false};}
   active={id:t.id,q:t.q,view:t.view,owner,session,fingerprint:f,context,input:{...input,err:'',datePanel:false},expected,attempted:undefined,submitted,saveState:p?'submitting':'draft',busy:false};
   if(!remember()){const err=active.input.err;active=null;fail(err);}
   installClose();root.openSheet('','');wire();paint();return {ok:true};
  }catch(e){root.toast?.(message(e));return {ok:false,error:message(e)};}
 }
 function input(key,value){
  const a=active;if(!a||a.busy||frozen(a))return {ok:false};
  try{assertActive(a);if(!['memo','purpose','reason','date','plan'].includes(key))return {ok:false};
   if(key==='plan'){a.input.plan=value===true||value==='customer'?'customer':'internal';}
   else {const max={memo:300,purpose:60,reason:80,date:10}[key];a.input[key]=String(value??'').slice(0,max);if(key!=='memo')a.input.touchedNext=true;}
   a.input.err='';if(!remember(a)){paint();return {ok:false,error:a.input.err};}refreshFooter();return {ok:true};
  }catch(e){return showError(e);}
 }
 function handle(action,value){
  if(action==='close')return close();const a=active;if(!a||a.busy||frozen(a)&&action!=='save')return {ok:false};
  try{assertActive(a);if(action==='save')return save();
   if(['input-mic','mic','info','edit-work','edit-contact'].includes(action)){root.toast?.(action.includes('mic')?'문의 음성 입력 연결은 아직 확인되지 않았습니다. 상담 내용을 직접 적어 주세요.':'고객 정보 변경 화면은 Claude 원본 연결 작업 중입니다.');return {ok:false};}
   if(action==='res'){
    if(!root.ContactEntry.VALUES.includes(value))return {ok:false};a.input.res=value;
    if(!a.input.touchedNext){const d=root.ContactEntry.defaults(value,a.context.existing,today());Object.assign(a.input,{mode:d.mode,purpose:d.purpose,date:d.date});}
    if(root.ContactEntry.isBadfit(value))a.input.mode='none';
   }else if(action==='mode'){if(!root.ContactEntry.MODES.some(m=>m[0]===value))return {ok:false};a.input.mode=value;a.input.touchedNext=true;}
   else if(action==='date-open')a.input.datePanel=true;
   else if(action==='date-close')a.input.datePanel=false;
   else if(action==='date'){if(!dates().some(x=>x[1]===value)||!dateOK(value))return {ok:false};Object.assign(a.input,{date:value,datePanel:false,touchedNext:true});}
   else return {ok:false};
   a.input.err='';remember(a);paint();return {ok:true};
  }catch(e){return showError(e);}
 }
 async function save(){
  const a=active;if(!a||a.busy)return {ok:false};
  try{
   if(a.saved){assertActive(a);durable(a);eraseDraft(a);close({force:true});root.toast?.('응대 기록을 저장했습니다.');return {ok:true};}
   const current=assertActive(a);if(!a.submitted&&fingerprint(current)!==a.fingerprint)fail('문의 상태나 일정이 바뀌었습니다. 보관한 입력으로 대상을 다시 확인해 주세요.');
   const why=blockReason(a);if(why)fail(why);const pl=plan(a);if(!pl.ok)fail(pl.error);if(!dateOK(a.input.date)&&(pl.next||pl.change))fail('다음 업무의 날짜를 확인해 주세요.');
   const result=root.InquiryFlow.TWO.of(a.input.res,'관심 있음');if(!result?.contact_result||!root.InquiryFlow.kindOf(result.contact_result))fail('문의 연락 결과를 확인하지 못했습니다.');
   a.saveState='submitting';if(!remember(a))fail(a.input.err);
   a.busy=true;a.input.err='';paint();
   const options={ch:'전화',result:result.res,text:root.ContactEntry.showNote(a.input.res)?a.input.memo:'',contact_result:result.contact_result,customer_reaction:'',plan:pl,existing:ctx(a).existing};
   const form={...clean(a.input),_inquiryContext:ctx(a)};
   await root.PCInquirySave.save(a.q,options,form,'mobile-d');assertActive(a);
   for(const k of ['status','first_response_at','responded_at','updated_at','lastActivity','openNextActions','nextActionObj','nextAction','nextActionText','next_action_date','nextActionDate'])if(Object.hasOwn(a.q,k))a.view[k]=a.q[k];
   a.busy=false;a.saved=true;a.saveState='confirmed';durable(a);eraseDraft(a);close({force:true});root.toast?.('응대 기록을 저장했습니다.');return {ok:true};
  }catch(e){
   a.busy=false;if(active!==a)return {ok:false,error:message(e)};
   try{const p=pending(a);if(p?.input?.plan&&p.surface==='mobile-d')a.submitted={signature:serial(clean(p.form)),plan:clone(p.input.plan)};else if(!a.saved){a.saveState='draft';remember(a);}}catch(ignore){}
   a.input.err=message(e);paint();return {ok:false,error:message(e)};
  }
 }
 function wire(){const c=card();if(c===wiredCard)return;wiredCard=c;
  c.addEventListener('click',e=>{if(!active||c._ceMode!=='approved-inquiry')return;const b=e.target.closest('[data-ce]');if(!b)return;e.preventDefault?.();e.stopImmediatePropagation?.();handle(b.dataset.ce,b.dataset.v);},true);
  c.addEventListener('input',e=>{if(!active||c._ceMode!=='approved-inquiry')return;const n=e.target.closest('[data-ce-in]');if(n){e.stopImmediatePropagation?.();input(n.dataset.ceIn,n.dataset.ceIn==='plan'?n.checked:n.value);}},true);
 }
 function state(){return active?clone({target_id:active.id,input:active.input,existing:active.context.existing,busy:active.busy,pending:!!active.submitted}):null;}
 root.addEventListener?.('phase1:identity-cleared',()=>close({force:true}));
 return Object.freeze({canOpen,open,restore:id=>open(id),handle,input,save,close,state,model});
});
