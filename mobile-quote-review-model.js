/* Read-only K1-K5 / markup projection of already-loaded, current-rep records.
 * No RPC, quote arithmetic, drafting persistence, sending or automatic scheduling.
 * Legacy amount is deliberately never promoted to base_amount / submit_amount. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory;else root.MobileQuoteReviewModel=factory(root);})(typeof window==='object'?window:globalThis,function(root){
 'use strict';
 const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
 const SCREENS=['K-1','K-2','K-3','K-4','K-5','Q-S','Q-N','Q-T','Q-M'],obj=v=>!!v&&typeof v==='object'&&!Array.isArray(v),txt=v=>typeof v==='string'?v.trim():'',valid=v=>typeof v==='string'&&UUID.test(v);
 const blocked='견적 요청·제출금액·발송의 공통 저장 연결을 확인 중입니다. 기존 기록과 일정은 유지됩니다.';
 const error=code=>{throw Error(code);},clone=v=>JSON.parse(JSON.stringify(v));
 function day(v){if(typeof v!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(v))return '';const n=Date.parse(v+'T00:00:00Z');return Number.isFinite(n)&&new Date(n).toISOString().slice(0,10)===v?v:'';}
 function actualDay(v){if(day(v))return v;const m=typeof v==='string'&&/^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2})$/i.exec(v);if(!m||!day(m[1])||+m[2]>23||+m[3]>59||+(m[4]||0)>59)return '';const n=Date.parse(v);return Number.isFinite(n)?new Date(n+9*36e5).toISOString().slice(0,10):'';}
 function money(v){if(typeof v!=='number'&&!(typeof v==='string'&&/^\d+$/.test(v)))return null;const n=Number(v);return Number.isSafeInteger(n)&&n>=0?n:null;}
 const amountText=v=>money(v)===null?'확인 필요':money(v).toLocaleString('ko-KR')+'원';
 function actor(){const p=root.Phase1?.profile,j=root.MobileSaveJournal;if(!valid(p?.auth_uid)||!valid(p?.user_id)||typeof j?.owner!=='function'||typeof j?.session!=='function')error('QUOTE_REVIEW_LOGIN_REQUIRED');const owner=p.auth_uid+':'+p.user_id,session=j.session();if(j.owner()!==owner||typeof session!=='string'||!session.startsWith(owner+':'))error('QUOTE_REVIEW_IDENTITY_INVALID');return {owner,session};}
 function signature(d){return JSON.stringify({id:d.id,code:d.code,version:d.version,stage_contexts:d.stage_contexts,stageContexts:d.stageContexts,quote_versions:d.quote_versions,quoteVersions:d.quoteVersions,work_items:d.work_items,workItems:d.workItems,activities:d.activities,attachments:d.attachments,message_logs:d.message_logs,messageLogs:d.messageLogs,nextAction:d.nextAction,nextActionObj:d.nextActionObj,openNextActions:d.openNextActions});}
 function scope(input){const a=actor();if(!root.G?.user||root.G.mode!=='rep'||!(root.LIVE===true||root.DEMO===true))error('QUOTE_REVIEW_REP_SCOPE_REQUIRED');if(!valid(input?.id)||typeof root.myDeals!=='function')error('QUOTE_REVIEW_TARGET_INVALID');const list=root.myDeals();if(!Array.isArray(list))error('QUOTE_REVIEW_SCOPE_INVALID');const rows=list.filter(d=>d?.id===input.id);if(rows.length!==1)error('QUOTE_REVIEW_TARGET_NOT_SCOPED');const d=rows[0],sig=signature(d);if(signature(input)!==sig)error('QUOTE_REVIEW_STALE_TARGET');return {...a,d,sig};}
 function assertCurrent(s){const list=root.myDeals(),a=actor();if(a.owner!==s.owner||a.session!==s.session||!root.G?.user||root.G.mode!=='rep'||!(root.LIVE===true||root.DEMO===true)||!Array.isArray(list)||list.filter(d=>d?.id===s.d.id).length!==1||signature(list.find(d=>d?.id===s.d.id))!==s.sig)error('QUOTE_REVIEW_CHANGED');}
 const sameDeal=(row,id)=>[row.opportunity_id,row.deal_id].every(v=>!v||v===id);
 function quoteRows(d){const raw=d.quote_versions??d.quoteVersions;if(raw!==undefined&&!Array.isArray(raw))error('QUOTE_REVIEW_ROWS_INVALID');const seen=new Set();return (raw||[]).filter(q=>obj(q)&&sameDeal(q,d.id)).map(q=>{const n=Number(q.version_no);if(!Number.isSafeInteger(n)||n<1||seen.has(n)||q.id&&!valid(q.id))error('QUOTE_REVIEW_VERSION_INVALID');seen.add(n);return {...clone(q),version_no:n};}).sort((a,b)=>b.version_no-a.version_no);}
 function quoteKey(q){return q?txt(q.id)||String(q.version_no):'';}
 function selected(rows,id){if(id==null||id==='')return rows[0]||null;const key=String(id),match=rows.filter(q=>q.id===key||String(q.version_no)===key);if(match.length!==1)error('QUOTE_REVIEW_VERSION_NOT_FOUND');return match[0];}
 function existingTasks(d){const rows=Array.isArray(d.openNextActions)?d.openNextActions:[d.nextActionObj,obj(d.nextAction)?d.nextAction:null].filter(Boolean),seen=new Set();return rows.filter(a=>obj(a)&&valid(a.id)&&sameDeal(a,d.id)&&a.status==='open'&&!seen.has(a.id)&&seen.add(a.id)).map(a=>({id:a.id,text:txt(a.text||a.title)||'내용 확인 필요',date:actualDay(a.due_on||a.due||a.due_at)||null,date_basis:['customer_agreed','internal_plan'].includes(a.date_basis)?a.date_basis:'unconfirmed',preserved:true}));}
 function base(s,screen){return {ok:true,status:'ready',screen,targetId:s.d.id,versionId:'',context:txt(s.d.nm||s.d.name||s.d.site)||'현장명 확인 필요',title:{'K-1':'견적 요청','K-2':'견적 진행','K-3':'견적 도착 확인','K-4':'견적 두 안','K-5':'견적 이력','Q-S':'간단견적','Q-N':'견적 기준 확인','Q-T':'공법견적 초안','Q-M':'제출금액 만들기'}[screen],preview:'조회만 반영 · 저장·발송 없음',pre:'공통 서버 조회·저장 연결 전 · 금액·일정 유지',blockedReason:blocked,primaryEnabled:false,secondaryEnabled:false,canEdit:false,optionsEnabled:false,fixture:false,coverage:{scope:'current-rep-loaded-records',quoteVersions:'partial',requestWorkflow:'unavailable',dispatches:'partial',options:'unavailable',calculation:'unavailable'},pager:''};}
 function paginate(model,field,page){const rows=model[field];if(!Array.isArray(rows))return model;if(rows.length<=20)return model;if(typeof root.ListPager?.cut!=='function'||typeof root.ListPager?.html!=='function')error('QUOTE_REVIEW_PAGER_UNAVAILABLE');const pg=root.ListPager.cut(rows,page);return {...model,[field]:pg.rows,pager:root.ListPager.html(pg,{ns:'quote-review',unit:'건'}),page:pg.page,pages:pg.pages,total:pg.total};}
 function actual(s,screen,opt){
  const d=s.d,out=base(s,screen),contexts=d.stage_contexts||d.stageContexts||{};if(!obj(contexts))error('QUOTE_REVIEW_CONTEXT_INVALID');const f=contexts.consulting?.fields||{};if(!obj(f))error('QUOTE_REVIEW_CONTEXT_INVALID');
  const quotes=quoteRows(d),q=selected(quotes,opt.quoteVersionId),tasks=existingTasks(d),version=q?'V'+q.version_no:'수정본 확인 필요',tag=q?({draft:'초안',internal:'내부 확인',final:'최종본',superseded:'대체됨'}[q.status]||'상태 확인 필요'):'조회 확인 필요';
  out.versionId=quoteKey(q);out.currentVersion=q?{id:valid(q.id)?q.id:null,version_no:q.version_no,status:txt(q.status)||null,base_amount:money(q.base_amount),supply_amount:money(q.supply_amount),submit_amount:money(q.submit_amount),legacy_amount:money(q.amount)}:null;out.existingTasks=tasks;
  if(['K-3','K-4','K-5','Q-S','Q-N','Q-T','Q-M'].includes(screen))out.context=[txt(d.work_type),q?version:'',out.context,txt(d.brand)].filter(Boolean).join(' · ');
  const quote={title:version,detail:q?txt(q.reason)||'수정 사유 확인 필요':'등록된 견적 수정본 조회가 필요합니다.',tag};
  if(screen==='K-1'){
   const visits=(Array.isArray(d.activities)?d.activities:[]).filter(a=>obj(a)&&sameDeal(a,d.id)&&['방문','visit'].includes(a.type)&&actualDay(a.occurred_at||a.at)).sort((a,b)=>String(b.occurred_at||b.at).localeCompare(String(a.occurred_at||a.at))),visit=visits[0];
   const rawWorks=d.work_items??d.workItems;if(rawWorks!==undefined&&!Array.isArray(rawWorks))error('QUOTE_REVIEW_WORKS_INVALID');const works=(rawWorks||[]).filter(x=>typeof x==='string'&&txt(x)).map((x,i)=>({id:'work-'+i,label:x,selected:true}));
   Object.assign(out,{inheritedHint:visit?'방문 기록 · '+actualDay(visit.occurred_at||visit.at):'기존 CRM 기록 · 요청 접수 여부 확인 필요',inherited:{title:visit?'기존 방문 기록':'기존 견적 요청 내용',detail:txt(visit?.note||visit?.body)||txt(f.quote_request)||'연결할 기록 확인 필요',tag:'참고'},works,quantities:[],dates:[],internalDue:day(f.quote_due)||null,customerDue:null,note:'현재 단계의 견적 예정일은 내부 일정입니다. 고객 약속일로 복사하지 않습니다.'});
  }else if(screen==='K-2')Object.assign(out,{steps:[{title:'요청 접수',detail:txt(f.quote_request)?'CRM에 요청 내용 있음 · 견적팀 접수 상태 확인 필요':'요청 상태 확인 필요',state:0},{title:'견적 작성',detail:'견적팀 처리 상태 조회 연결 필요',state:0},{title:'도착 확인',detail:quotes.length?'등록된 수정본 있음 · 도착·최종화 상태 별도 확인':'견적 도착 여부 확인 필요',state:0}],conflict:'고객 약속일과 내부 완료 예정일의 충돌 여부는 아직 판정할 수 없습니다.',adjustment:{title:'기한 조정 확인 필요',detail:day(f.quote_due)?'CRM 내부 예정일 '+f.quote_due+' · 앞당기기 수락 여부 별도 확인':'내부 완료 예정일·앞당기기 처리 상태 조회 필요',tag:'미확인'},question:{title:'보완 요청 확인 필요',detail:'견적팀 질의·응답 조회 연결 필요',tag:'미확인'},customerDue:null,internalDue:day(f.quote_due)||null});
  else if(screen==='K-3'){
   const raw=d.attachments;if(raw!==undefined&&!Array.isArray(raw))error('QUOTE_REVIEW_ATTACHMENTS_INVALID');const file=valid(q?.pdf_file_id)?(raw||[]).find(a=>obj(a)&&a.id===q.pdf_file_id&&sameDeal(a,d.id)&&a.state==='ready'):null;
   Object.assign(out,{quote,amountRows:[{label:'적산 기준금액',value:amountText(q?.base_amount),tone:'emphasis'},{label:'공급가액',value:amountText(q?.supply_amount),tone:'muted'},{label:'고객 제출금액',value:amountText(q?.submit_amount),tone:'normal'}],pdf:{title:file?txt(file.file_name)||'견적 PDF':'같은 수정본 PDF 확인 필요',detail:file?'파일 연결 있음 · 금액·수정본 일치 확인 필요':'파일이 없다고 단정하지 않습니다. 조회 연결 필요',tag:'확인 필요',id:file?.id||'',enabled:false},note:'기준금액·고객 제출금액·PDF는 같은 수정본에서 확인합니다. 기존 amount를 기준금액이나 제출금액으로 추정하지 않습니다.'});
  }else if(screen==='K-4')Object.assign(out,{quote,options:[],note:'같은 수정본 안의 A·B 조회 연결이 필요합니다. 서로 다른 수정본을 두 안으로 묶거나 합산하지 않습니다.'});
  else if(screen==='K-5'){
   const raw=d.message_logs??d.messageLogs;if(raw!==undefined&&!Array.isArray(raw))error('QUOTE_REVIEW_DISPATCH_INVALID');
   const logs=(raw||[]).filter(m=>obj(m)&&valid(m.id||m.message_log_id)&&m.opportunity_id===d.id&&q&&Number(m.quote_version_no)===q.version_no&&['sms','kakao'].includes(m.channel)&&['sent','failed','cancelled'].includes(m.status)).sort((a,b)=>String(b.sent_at||b.occurred_at||'').localeCompare(String(a.sent_at||a.occurred_at||''))),log=logs[0],sentAt=log?actualDay(log.sent_at||log.occurred_at):'',attested=log?.attestation_kind==='user_attested'||log?.user_attested===true;
   const dispatch=log?{title:({sent:'발송 입력 기록',failed:'발송 실패 기록',cancelled:'발송 취소 기록'}[log.status]),detail:[version,log.channel==='sms'?'문자':'카카오',sentAt||'날짜 확인 필요',txt(log.recipient_phone)||'당시 수신자 확인 필요'].join(' · '),tag:attested?'담당자 기록':'근거 확인 필요'}:{title:'발송 이력 확인 필요',detail:'현재 불러온 문자·카카오 기록만 확인 가능 · 전체 발송 이력은 미연결',tag:'미확인'};
   Object.assign(out,{dispatch,next:tasks.length?{title:'기존 다음 업무 유지',detail:tasks[0].text+' · '+(tasks[0].date||'날짜 확인 필요'),tag:tasks[0].date_basis==='customer_agreed'?'고객 약속':'약속 여부 확인 필요'}:{title:'후속 일정 확인 필요',detail:'발송일 기준 일정을 새로 만들지 않습니다.',tag:'미확인'},versions:quotes.map(v=>({id:quoteKey(v),label:'V'+v.version_no+' · '+(actualDay(v.created_at)||'날짜 확인 필요'),value:money(v.submit_amount)!==null?'제출금액 '+amountText(v.submit_amount):money(v.base_amount)!==null?'기준금액 '+amountText(v.base_amount):'금액 구분 확인 필요',replaced:v.status==='superseded',enabled:true})),note:'이력 조회는 재발송·고객 선택·후속 업무 완료를 뜻하지 않습니다. 기존 일정은 유지됩니다.',dispatchCoverage:'loaded-sms-kakao-only'});
  }else if(screen==='Q-M'){
   const type=['area','multiplier','flat','none'].includes(q?.markup_type)?q.markup_type:'',scalar=v=>(typeof v==='number'&&Number.isFinite(v)&&v>=0)||(typeof v==='string'&&/^\d+(?:\.\d+)?$/.test(v))?String(v):'확인 필요';
   Object.assign(out,{quote,type,baseAmount:amountText(q?.base_amount),submitAmount:amountText(q?.submit_amount),area:scalar(q?.markup_area),value:scalar(q?.markup_value),additionalAmount:'확인 필요',markupItems:Array.isArray(q?.markup_items)?clone(q.markup_items):[],calculation:{status:'unavailable',value:null},note:type?'저장된 값만 표시합니다. 가산액 계산·최종화는 서버 연결 전입니다.':q?.markup_type==='multi'?'복합 가산은 단일 선택 원본 화면에 표시할 수 없습니다. 공통 계산 결과 확인이 필요합니다.':'가산 방식 확인 필요 · 모바일에서 금액을 계산하지 않습니다.'});
  }else if(screen==='Q-S'){
   const items=q?.kind==='simple'&&Array.isArray(q?.basis?.simple_items)?q.basis.simple_items:[];
   const rows=Array.from({length:3},(_,i)=>{const item=obj(items[i])?items[i]:null;return {label:item?txt(item.name)||'항목명 확인 필요':'견적 항목 확인 필요',value:'항목 금액 확인 필요',detail:item?[item.qty===0?'0':String(item.qty??'수량 확인 필요'),txt(item.unit)||'단위 확인 필요','단가 '+amountText(item.price)].join(' · '):'서버 계산 결과 조회 연결 필요'};});
   Object.assign(out,{rows:rows.concat([{label:'+ 항목 추가',value:'연결 전',detail:'원본 입력 흐름 및 서버 저장 연결 필요'},{label:'적산 기준금액 · VAT 별도',value:amountText(q?.base_amount),detail:'서버에 저장된 기준금액 · 항목을 모바일에서 합산하지 않습니다.'}]),note:items.length>3?'전체 항목 '+items.length+'개 · 원본 화면의 항목 조회 연결 필요':'등록된 간단견적 기준만 조회합니다.'});
  }else if(screen==='Q-N')Object.assign(out,{rows:[{label:'새 기준',value:'조회 연결 필요',detail:'현재 승인된 원가 기준과 적용일 확인 필요'},{label:'기존 기준',value:'유지',detail:q?'V'+q.version_no+' 원본 보존':'기존 수정본 조회 필요'},{label:'새 기준 재계산',value:'실행하지 않음',detail:'공통 서버 계산과 명시적 확인 전'},{label:'보낸 견적',value:'원본 유지',detail:'기준 변경만으로 기존 견적·발송 이력을 변경하지 않습니다.'}]});
  else if(screen==='Q-T'){
   const b=q?.kind==='method'&&obj(q?.basis)?q.basis:null,items=Array.isArray(b?.work_items)?b.work_items:[];
   Object.assign(out,{rows:[{label:'공법',value:items.length?items.map(i=>txt(i?.method)).filter(Boolean).join(' · ')||'공법 확인 필요':'공법 조회 필요',detail:'현재 수정본의 산출 근거'},{label:'수량',value:'산출 내역 조회 필요',detail:'서로 다른 단위의 수량을 합산하지 않습니다.'},{label:'직접공사비',value:'확인 필요',detail:'재료비·노무비·경비를 모바일에서 합산하지 않습니다.'},{label:'원가계산서',value:'확인 필요',detail:'계산 근거·요율 조회 연결 필요'},{label:'적산 기준금액',value:amountText(q?.base_amount),detail:'고객 제출금액과 별도'}]});
  }
  return out;
 }
 function fixture(s,screen,out,opt){
  const ex=root.__approvedQuoteExample;if(root.DEMO!==true||!obj(ex)||ex.owner!==s.owner||ex.dealId!==s.d.id||!obj(ex.models)||!obj(ex.models[screen]))return out;
  const value=clone(ex.models[screen]);
  // A direct design example is not evidence for a different historical revision.
  if(opt.quoteVersionId&&(screen==='Q-M'||value.versionId&&String(value.versionId)!==String(out.versionId)))return out;
  if(value.versionId&&String(value.versionId)!==String(out.versionId))error('QUOTE_REVIEW_FIXTURE_VERSION_MISMATCH');
  const model={...out,...value,ok:true,status:'ready',screen,targetId:s.d.id,versionId:out.versionId,currentVersion:out.currentVersion,existingTasks:out.existingTasks,fixture:true,canEdit:screen==='K-1',optionsEnabled:screen==='K-4',primaryEnabled:false,secondaryEnabled:false,blockedReason:blocked,preview:'합성 예시 · 운영 저장·발송 없음',coverage:{...out.coverage,scope:'scoped-synthetic-example'}};
  // Fixtures demonstrate the approved view, never a production write permission or PDF download.
  if(model.pdf)model.pdf={...model.pdf,enabled:false};
  if(Array.isArray(model.versions)){const qs=quoteRows(s.d);model.versions=model.versions.map(v=>{const q=qs.find(q=>quoteKey(q)===String(v.id)||String(q.version_no)===String(v.id));return {...v,id:q?quoteKey(q):String(v.id),enabled:!!q};});}
  for(const field of ['works','quantities','dates','steps','options','versions','amountRows'])if(model[field]!==undefined&&!Array.isArray(model[field]))error('QUOTE_REVIEW_FIXTURE_INVALID');
  return model;
 }
 function draft(model,value){
  if(value===undefined||value===null)return model;if(!obj(value))error('QUOTE_REVIEW_DRAFT_INVALID');
  const out={...model},own=(o,k)=>Object.prototype.hasOwnProperty.call(o,k),list=field=>Array.isArray(model[field])?model[field]:[];
  function chosen(key,field){if(!own(value,key))return;const ids=value[key];if(!Array.isArray(ids)||ids.some(id=>typeof id!=='string')||new Set(ids).size!==ids.length||ids.some(id=>!list(field).some(row=>row.id===id)))error('QUOTE_REVIEW_DRAFT_TARGET_INVALID');out[field]=list(field).map(row=>({...row,selected:ids.includes(row.id)}));}
  if(model.screen==='K-1'&&model.canEdit===true){
   chosen('works','works');
   if(own(value,'quantities')){if(!obj(value.quantities)||Object.entries(value.quantities).some(([id,v])=>typeof v!=='string'||v.length>300||!list('quantities').some(row=>row.id===id&&row.editable===true)))error('QUOTE_REVIEW_DRAFT_QUANTITY_INVALID');out.quantities=list('quantities').map(row=>({...row,value:own(value.quantities,row.id)?value.quantities[row.id]:row.value}));}
   if(own(value,'datePreset')){if(value.datePreset!==null&&value.datePreset!==''&&!list('dates').some(row=>row.id===value.datePreset))error('QUOTE_REVIEW_DRAFT_DATE_PRESET_INVALID');out.dates=list('dates').map(row=>({...row,selected:row.id===value.datePreset}));out.datePreset=value.datePreset;out.customerDue=null;}
   if(own(value,'customer_due')){if(value.customer_due!==''&&!day(value.customer_due))error('QUOTE_REVIEW_DRAFT_DATE_INVALID');out.customerDue=value.customer_due||null;
    if(out.customerDue)out.dates=(out.dates||list('dates')).map(row=>row.action==='pick-date'?{...row,label:out.customerDue.replace(/-/g,'.')+' ('+'일월화수목금토'[new Date(out.customerDue+'T00:00:00Z').getUTCDay()]+')'}:row);
   }
   out.draftOnly=true;out.customerDueState=out.customerDue?'unconfirmed-local-draft':'unconfirmed';
  }
  if(model.screen==='K-4'&&model.optionsEnabled===true){chosen('options','options');out.draftOnly=true;}
  return out;
 }
 function read(d,screen,options){
  const opt=options||{};
  try{if(!SCREENS.includes(screen))error('QUOTE_REVIEW_SCREEN_INVALID');const s=scope(d);let model=actual(s,screen,opt);model=fixture(s,screen,model,opt);model=draft(model,opt.draft);
   // A visible page is not the full selection. Preserve choices on every page.
   model.selectedWorkIds=(model.works||[]).filter(row=>row.selected).map(row=>row.id);model.selectedOptionIds=(model.options||[]).filter(row=>row.selected).map(row=>row.id);
   model=paginate(model,screen==='K-5'?'versions':screen==='K-1'?'works':'options',opt.page||1);assertCurrent(s);return model;}
  catch(e){return {ok:false,status:'read-error',screen,error:String(e?.message||'QUOTE_REVIEW_READ_FAILED'),title:'견적 확인',context:'현재 영업건의 견적 정보를 확인하지 못했습니다.',preview:'조회 실패 · 저장·발송 없음',blockedReason:blocked,primaryEnabled:false,secondaryEnabled:false,canEdit:false,optionsEnabled:false,fixture:false,coverage:{scope:'unknown'},works:[],quantities:[],dates:[],steps:[],amountRows:[],options:[],versions:[],pager:'',note:'다시 조회한 뒤 확인해 주세요.'};}
 }
 return Object.freeze({read});
});
