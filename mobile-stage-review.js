/* Read-only approved G / J-2 review. No persistence, network, automatic dates or task changes. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory;else root.MobileStageReview=factory(root);})(typeof window==='object'?window:globalThis,function(root){
 'use strict';
 const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
 const object=v=>!!v&&typeof v==='object'&&!Array.isArray(v),text=v=>typeof v==='string'?v.trim():'',valid=v=>typeof v==='string'&&uuid.test(v);
 const blocked='발송 근거 확정과 기존 일정 유지가 함께 확인되는 저장 연결 전입니다. 단계와 일정은 바뀌지 않습니다.';
 let epoch=0,identity='',last=null,selection=null;
 const fail=code=>{throw Error(code);};
 function reset(){epoch++;last=null;selection=null;}
 function stable(v){if(Array.isArray(v))return '['+v.map(stable).join(',')+']';if(object(v))return '{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+stable(v[k])).join(',')+'}';return JSON.stringify(v)??'null';}
 function hash(v){let h=2166136261;for(const c of v){h^=c.charCodeAt(0);h=Math.imul(h,16777619);}return (h>>>0).toString(16);}
 function dateOnly(v){if(typeof v!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(v))return '';const n=Date.parse(v+'T00:00:00Z');return Number.isFinite(n)&&new Date(n).toISOString().slice(0,10)===v?v:'';}
 function actualDate(v){
  if(dateOnly(v))return v;
  const m=typeof v==='string'&&/^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2})$/i.exec(v);
  if(!m||!dateOnly(m[1])||+m[2]>23||+m[3]>59||+(m[4]||0)>59)return '';
  if(m[5]!=='Z'&&m[5]!=='z'&&(+m[5].slice(1,3)>14||+m[5].slice(4)>59||(+m[5].slice(1,3)===14&&+m[5].slice(4)!==0)))return '';
  const n=Date.parse(v);return Number.isFinite(n)?new Date(n+9*36e5).toISOString().slice(0,10):'';
 }
 const today=()=>new Date(Date.now()+9*36e5).toISOString().slice(0,10);
 function actor(){
  const p=root.Phase1?.profile,j=root.MobileSaveJournal;
  if(!valid(p?.auth_uid)||!valid(p?.user_id)||typeof j?.owner!=='function'||typeof j?.session!=='function')fail('STAGE_REVIEW_LOGIN_REQUIRED');
  const owner=p.auth_uid+':'+p.user_id,session=j.session();
  if(j.owner()!==owner||typeof session!=='string'||!session.startsWith(owner+':'))fail('STAGE_REVIEW_IDENTITY_INVALID');
  const key=owner+'|'+session;if(key!==identity){reset();identity=key;}
  return {owner,session,epoch};
 }
 function dealSignature(d){return stable({id:d.id,code:d.code,stage_code:d.stage_code,version:d.version,version_no:d.version_no,stage_contexts:d.stage_contexts,stageContexts:d.stageContexts,quote_versions:d.quote_versions,quoteVersions:d.quoteVersions,legacy_notes:d.legacy_notes,activities:d.activities,nextAction:d.nextAction,nextActionObj:d.nextActionObj,openNextActions:d.openNextActions});}
 function scope(input){
  const a=actor();if(!root.G?.user||root.G.mode!=='rep'||!(root.LIVE===true||root.DEMO===true))fail('STAGE_REVIEW_REP_SCOPE_REQUIRED');if(!valid(input?.id))fail('STAGE_REVIEW_TARGET_INVALID');
  if(typeof root.myDeals!=='function')fail('STAGE_REVIEW_SCOPE_UNAVAILABLE');
  const all=root.myDeals();if(!Array.isArray(all))fail('STAGE_REVIEW_SCOPE_INVALID');
  const found=all.filter(d=>d?.id===input.id);if(found.length!==1)fail('STAGE_REVIEW_TARGET_NOT_SCOPED');
  const d=found[0],signature=dealSignature(d);if(dealSignature(input)!==signature)fail('STAGE_REVIEW_STALE_TARGET');
  const after=actor();if(after.owner!==a.owner||after.session!==a.session||after.epoch!==a.epoch)fail('STAGE_REVIEW_IDENTITY_CHANGED');
  return {...a,d,signature};
 }
 function assertCurrent(s){const n=scope(s.d);if(n.owner!==s.owner||n.session!==s.session||n.epoch!==s.epoch||n.signature!==s.signature)fail('STAGE_REVIEW_CHANGED');}
 function references(d){
  if(typeof root.StageTransition?.evidence!=='function')fail('STAGE_EVIDENCE_UNAVAILABLE');
  const e=root.StageTransition.evidence({...d,stage_contexts:d.stage_contexts||d.stageContexts||{}},{},'sent');if(!object(e)||!object(e.sources)||!object(e.fields)||!Array.isArray(e.pending))fail('STAGE_EVIDENCE_INVALID');
  const groups=new Map();
  // Each source line stands alone. A material category is not a document or dispatch receipt.
  for(const [field,s] of Object.entries(e.sources)){
   if(!object(s)||!text(s.text))continue;
   const key=stable({id:s.id,kind:s.kind,text:s.text,recorded_at:s.recorded_at});
   if(!groups.has(key))groups.set(key,{id:'reference-'+hash(key),meta:[text(s.kind)||'기존 기록',dateOnly(s.recorded_at)&&'기록일 '+s.recorded_at].filter(Boolean).join(' · '),text:s.text,documents:[],recipient:'',sentAt:'',canSelect:false,referenceOnly:true,fixture:false,referenceFields:{}});
   groups.get(key).referenceFields[field]=e.fields[field];
  }
  return {rows:[...groups.values()],pending:e.pending.filter(x=>typeof x==='string')};
 }
 function candidates(s){
  const actual=references(s.d),example=root.__approvedStage6Example;
  if(root.DEMO!==true||!object(example)||example.owner!==s.owner||example.dealId!==s.d.id)return {rows:actual.rows,pending:actual.pending,fixture:false};
  if(!Array.isArray(example.candidates))fail('STAGE_FIXTURE_INVALID');
  const ids=new Set(),rows=example.candidates.map(c=>{
   if(!object(c)||!text(c.id)||!/^[a-zA-Z0-9_:.-]{1,128}$/.test(c.id)||ids.has(c.id))fail('STAGE_FIXTURE_CANDIDATE_INVALID');ids.add(c.id);
   if(c.dealId&&c.dealId!==s.d.id||c.owner&&c.owner!==s.owner)fail('STAGE_FIXTURE_SCOPE_INVALID');
   const documents=Array.isArray(c.documents)&&c.documents.every(x=>!!text(x))?c.documents.map(text):[],recipient=text(c.recipient),sentAt=text(c.sentAt),day=actualDate(sentAt);
   return {id:c.id,meta:text(c.meta),text:text(c.text),documents,recipient,sentAt,canSelect:documents.length>0&&!!recipient&&!!day&&day<=today(),referenceOnly:!(documents.length>0&&recipient&&day&&day<=today()),fixture:true};
  });
  return {rows,pending:actual.pending,fixture:true};
 }
 function safeG(e){reset();return {ok:false,status:'read-error',error:String(e?.message||'STAGE_REVIEW_READ_FAILED'),target_id:null,candidates:[],selectedId:null,canContinue:false,note:'발송 기록을 확인하지 못했습니다. 다시 불러온 뒤 확인해 주세요.',pager:'',total:null};}
 function readG(input,options){
  try{
   const s=scope(input),c=candidates(s),page=options?.page||1;
   if(!root.ListPager||typeof root.ListPager.cut!=='function'||typeof root.ListPager.html!=='function')fail('STAGE_PAGER_UNAVAILABLE');
   if(last&&(last.owner!==s.owner||last.session!==s.session||last.target!==s.d.id||last.signature!==s.signature))selection=null;
   const fingerprints=new Map(c.rows.map(row=>[row.id,stable(row)]));
   if(selection&&(selection.owner!==s.owner||selection.session!==s.session||selection.epoch!==s.epoch||selection.target!==s.d.id||selection.signature!==s.signature||fingerprints.get(selection.id)!==selection.fingerprint))selection=null;
   assertCurrent(s);last={owner:s.owner,session:s.session,epoch:s.epoch,target:s.d.id,signature:s.signature,fingerprints};
   const pg=root.ListPager.cut(c.rows,page),pager=root.ListPager.html(pg,{ns:'stage-evidence',unit:'건'});
   return {ok:true,status:'ready',target_id:s.d.id,candidates:pg.rows,selectedId:selection?.id||null,canContinue:false,note:(c.fixture?'합성 예시 · 운영 저장 없음. ':'불러온 CRM 기록만 참고합니다. 이메일·잔디 전체 조회는 연결되지 않았습니다. ')+blocked,pager,total:pg.total,page:pg.page,pages:pg.pages,fixture:c.fixture,pending:c.pending,coverage:'loaded-records-only'};
  }catch(e){return safeG(e);}
 }
 function select(input,id){
  try{
   const prior=last,s=scope(input);if(!prior||last!==prior||prior.owner!==s.owner||prior.session!==s.session||prior.epoch!==s.epoch||prior.target!==s.d.id||prior.signature!==s.signature)fail('STAGE_SELECTION_STALE');
   const c=candidates(s).rows.find(row=>row.id===id);
   if(!c||c.canSelect!==true)fail('STAGE_SELECTION_INCOMPLETE');
   const fingerprint=stable(c);if(prior.fingerprints.get(id)!==fingerprint)fail('STAGE_SELECTION_STALE');assertCurrent(s);
   selection={owner:s.owner,session:s.session,epoch:s.epoch,target:s.d.id,signature:s.signature,id,fingerprint};
   return {ok:true,selectedId:id,note:'선택만 반영했습니다. '+blocked};
  }catch(e){reset();return {ok:false,selectedId:null,error:String(e?.message||'STAGE_SELECTION_FAILED'),note:'현재 영업건의 발송 기록을 다시 확인해 주세요.'};}
 }
 function existingTasks(d){
  const source=Array.isArray(d.openNextActions)?d.openNextActions:[d.nextActionObj,object(d.nextAction)?d.nextAction:null].filter(Boolean),seen=new Set(),out=[];
  for(const t of source){if(!object(t)||!valid(t.id)||seen.has(t.id)||t.status!=='open'||[t.opportunity_id,t.deal_id].some(id=>id&&id!==d.id))continue;seen.add(t.id);
   const raw=text(t.due_on||t.due||t.due_at),date=actualDate(raw);out.push({id:t.id,text:text(t.text||t.title)||'기존 업무',type:text(t.type||t.action_type),date:date||null,date_basis:['customer_agreed','internal_plan','unconfirmed'].includes(t.date_basis)?t.date_basis:'unconfirmed',preserved:true});}
  return out;
 }
 function readJ2(input){
  const base={title:'컨설팅 설계 → 자료 발송완료',subtitle:'PC 전환 조건 그대로 · 있는 값은 확인만',from:'consulting',to:'sent',fields:[],quotes:[],existingNext:[],canSave:false,canContinue:false,reason:blocked};
  try{
   const s=scope(input),d=s.d,S=root.StageTransition;if(typeof S?.validate!=='function'||!object(S.definitions?.sent))fail('STAGE_VALIDATION_UNAVAILABLE');
   const from=text(d.code||d.stage_code);if(from!=='consulting')fail('STAGE_REVIEW_SOURCE_STAGE_CHANGED');
   const contexts=d.stage_contexts||d.stageContexts||{};if(!object(contexts))fail('STAGE_CONTEXT_INVALID');
   const context=contexts.sent===undefined?{}:contexts.sent;if(!object(context)||context.fields!==undefined&&!object(context.fields))fail('STAGE_CONTEXT_INVALID');
   const saved=context.fields||{},values={};
   for(const f of S.definitions.sent.fields){const value=saved[f.key];values[f.key]=Array.isArray(value)?value.slice():['string','number'].includes(typeof value)?value:'';}
   const raw=d.quote_versions!==undefined?d.quote_versions:d.quoteVersions;if(raw!==undefined&&!Array.isArray(raw))fail('STAGE_QUOTES_INVALID');
   const quotes=(raw||[]).filter(q=>object(q)&&[q.opportunity_id,q.deal_id].every(id=>!id||id===d.id)&&Number.isInteger(Number(q.version_no))&&Number(q.version_no)>0).map(q=>({id:text(q.id),version_no:Number(q.version_no),value:String(q.version_no)}));
   const hasQuote=Array.isArray(values.materials)&&values.materials.includes('견적서'),registered=quotes.some(q=>q.value===String(values.quote_version)),date=today();
   // Transition-date proposal is separate from the actual send date; never fill a missing send date.
   const payload={transition_date:date,fields:values,skip_reason:'',memo:''};
   const validation=S.validate(from,'sent',payload,date);if(!Array.isArray(validation))fail('STAGE_VALIDATION_INVALID');
   const errors=validation.slice();if(hasQuote&&!registered)errors.push('실제 등록된 견적 Version을 선택해 주세요.');
   const next=existingTasks(d),materials=Array.isArray(values.materials)?values.materials:[],materialsValid=materials.length>0&&materials.every(v=>S.definitions.sent.fields.find(f=>f.key==='materials').options.includes(v));
   const quote=quotes.find(q=>q.value===String(values.quote_version)),materialText=materialsValid?materials.map(m=>m==='견적서'?(registered?'견적 V'+quote.version_no:'견적 Version 확인 필요'):m).join(' · '):'확인 필요';
   const sentValid=!!dateOnly(values.sent_date)&&values.sent_date<=date,followValid=!!dateOnly(values.followup_date)&&(!sentValid||values.followup_date>=values.sent_date);
   const rows=[{id:'materials',label:'보낸 자료',value:materialText,state:materialsValid&&(!hasQuote||registered)?'present':'missing'},
    {id:'recipient',label:'받는 사람',value:text(values.recipient)||'확인 필요',state:text(values.recipient)?'present':'missing'},
    {id:'sent_date',label:'발송일',value:sentValid?values.sent_date:'확인 필요',state:sentValid?'present':'missing'},
    {id:'followup_date',label:'다음 확인일',value:followValid?values.followup_date:'확인 필요',state:followValid?'present':'missing'}].map(f=>({...f,actionLabel:f.state==='present'?'확인':'입력'}));
   assertCurrent(s);
   return {...base,ok:true,status:'ready',target_id:d.id,fields:rows,quotes,existingNext:next,validation:{valid:errors.length===0,errors,shared:true},input:payload,reason:[errors.length?'PC 조건 '+errors.length+'개 확인 필요.':'PC 필수 조건 확인됨.',next.length?'기존 업무 유지: '+next.map(n=>n.text+(n.date?' · '+n.date:' · 날짜 확인 필요')).join(' / ')+'.':'기존 후속 일정 연결은 별도 확인이 필요합니다.',blocked].join(' ')};
  }catch(e){reset();return {...base,ok:false,status:'read-error',error:String(e?.message||'STAGE_REVIEW_READ_FAILED'),validation:{valid:false,errors:['현재 영업건의 전환 조건을 확인하지 못했습니다.'],shared:false},reason:'현재 영업건의 전환 조건을 확인하지 못했습니다. '+blocked};}
 }
 if(typeof root.addEventListener==='function'){
  root.addEventListener('phase1:identity-cleared',()=>{identity='';reset();});
  root.addEventListener('phase1:profile',()=>{try{actor();}catch(e){identity='';reset();}});
 }
 return Object.freeze({readG,select,reset,readJ2});
});
