/* OS ↔ 영업 CRM 연결 어댑터 — B2C 아파트 접수(OS_B2C) ↔ netform-crm 견적문의 (2026-10-21 · 잔디 '03_송보람_AI작업지시' · 공통 기준 OS_STAFF_HANDOFF_V1)
   역할: OS 업무페이지(별도 시스템 A)가 보내는 연결 봉투 + B2C 문의 레코드를 CRM 입력(기존 crm_inquiry_manual_create_v1 payload)으로 바꾸고,
         CRM 상태를 봉투 result 로 돌려준다. 봉투는 시험용 교환 형식이며 운영 API 가 아니다 — 이 파일은 전송하지 않는다(transport 를 넣어 줘야 한다).
   지키는 것: B2C id 를 다른 번호로 바꾸지 않음 · 현장명으로 공사(caseRef)를 만들지 않음(null 유지) · CRM 상태를 OS '계약 체결 완료'로 자동 치환하지 않음 ·
            같은 handoffKey 재시도는 같은 request_id(재전송 = 서버 replay) · 다른 문의 응답 · 지연(이전) 응답 · 같은 응답 두 번은 거부 · OS 배정(owner)과 CRM 진행(status)은 수정 주체가 다르다.
   브라우저: window.OSB2CBridge · node: module.exports (검사 tests/os-b2c-bridge.test.cjs). crm.html 로딩 순서: inquiry-flow.js 뒤(의존 없음 · 전역 이름 OSB2CBridge 하나) */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.OSB2CBridge=factory();})(typeof window!=='undefined'?window:globalThis,function(){
 'use strict';
 const SCHEMA='OS_STAFF_HANDOFF_V1',VERSION=1,TARGET='crm',SOURCE_SYSTEM='os-b2c',TYPE_KEY='b2c';
 const str=v=>typeof v==='string'&&v.trim().length>0;
 /* ── 봉투 검사: 공통 묶음 검증/validate-handoff.cjs 와 같은 규칙(브라우저에서도 쓰려고 여기 둠) ── */
 function validate(x){
  const e=[],ref=v=>v&&str(v.system)&&str(v.id);
  if(!x||typeof x!=='object')return ['object required'];
  if(x.schema!==SCHEMA||x.schemaVersion!==VERSION)e.push('schema');
  if(!['fixture','prepared'].includes(x.mode))e.push('mode');
  if(!str(x.handoffKey))e.push('handoffKey');
  if(!ref(x.source)||!str(x.targetSystem))e.push('source/target');
  if(!Array.isArray(x.receiptRefs))e.push('receiptRefs');
  else x.receiptRefs.forEach(r=>{if(!r||!str(r.sourceSystem)||!str(r.typeKey)||!str(r.sourceId)||!('osInternalId' in r)||!('displayNo' in r))e.push('receipt identity');
   if(r&&r.osInternalId!==null&&!str(r.osInternalId))e.push('osInternalId');if(r&&r.displayNo!==null&&!str(r.displayNo))e.push('displayNo');});
  if(!Array.isArray(x.unresolved)||!x.unresolved.every(str))e.push('unresolved');
  if(x.caseRef===null){if(!(x.unresolved&&x.unresolved.length))e.push('unbound reason');}
  else{const c=x.caseRef;if(!c||!str(c.caseId)||!str(c.siteId)||!Number.isInteger(c.scope)||c.scope<1||!['bid','direct'].includes(c.route))e.push('caseRef');
   if(c&&c.route==='direct'&&x.targetSystem==='bid')e.push('direct route cannot target bid');}
  if(!Array.isArray(x.documents))e.push('documents');else x.documents.forEach(d=>{if(!d||!str(d.id)||!str(d.version)||!str(d.purpose))e.push('document');});
  if(!x.result||!str(x.result.status))e.push('result');
  return e;
 }
 /* ── 같은 handoffKey → 같은 request_id(uuid 모양 · 결정적) — 서버 crm_inquiry_manual_create_v1 은 request_id 로 재전송을 replay 처리한다.
       해시는 시험용 규칙(FNV-1a 32bit × 4) — 운영에서는 통합 담당과 request_id 발급 규칙을 확정해야 한다(미연결 항목) ── */
 function fnv(s,seed){let h=(2166136261^seed)>>>0;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)>>>0;}return h;}
 function requestIdFor(handoffKey){const k='os-b2c→crm|'+String(handoffKey||'');const hx=[0,1,2,3].map(n=>fnv(k,n*0x9e3779b9).toString(16).padStart(8,'0')).join('');return hx.slice(0,8)+'-'+hx.slice(8,12)+'-4'+hx.slice(13,16)+'-'+((parseInt(hx.slice(16,18),16)&0x3f)|0x80).toString(16).padStart(2,'0')+hx.slice(18,20)+'-'+hx.slice(20,32);}
 /* ── CRM 상태 → OS 에 돌려줄 의미(수정 주체 = crm). OS 계약 완료로 자동 치환 금지: osContract 는 항상 false, 수주는 '확인 필요' ── */
 const STATUS={'접수':['crm_received','CRM 접수 · 담당 배정 전'],'배정':['crm_assigned','CRM 담당 배정됨'],'응대':['crm_contacted','CRM 첫 연락 기록 있음'],'진행':['crm_in_progress','CRM 영업 진행 중'],'영업건':['crm_deal','CRM 영업건으로 전환'],'종결':['crm_closed','CRM 종결(영업건 안 됨)'],'배드핏':['crm_badfit','CRM 배드핏 종결']};
 const DEAL={won:['crm_won','CRM 수주 결과 — OS 계약 체결 완료 아님 · 계약 근거 확인 뒤 OS 에서 처리'],lost:['crm_lost','CRM 실주'],open:['crm_deal_open','CRM 영업건 진행 중']};
 function crmStateOf(rec){
  const q=rec&&rec.inquiry||{},d=rec&&rec.deal||null;
  if(d){const o=String(d.outcome||'open').toLowerCase(),m=DEAL[o]||DEAL.open;return {code:m[0],label:m[1],crmStatus:String(q.status||''),dealStage:String(d.stage||''),dealOutcome:o,osContract:false};}
  const m=STATUS[String(q.status||'')]||['crm_unknown','CRM 상태 미확인'];return {code:m[0],label:m[1],crmStatus:String(q.status||''),dealStage:'',dealOutcome:'',osContract:false};
 }
 /* ── OS → CRM 입력: 봉투 + OS_B2C 문의 레코드 → crm_inquiry_manual_create_v1 (request_id, payload). 개인정보는 payload 안에서만(시험 파일에 복사하지 않는다) ── */
 function fromHandoff(env,item){
  const errors=validate(env).slice(),out={ok:false,errors,unresolved:Array.isArray(env&&env.unresolved)?env.unresolved.slice():[],request_id:'',payload:null,mapping:null};
  if(env&&env.targetSystem!==TARGET)errors.push('targetSystem must be crm');
  if(env&&env.source&&env.source.system!==TYPE_KEY)errors.push('source.system must be b2c');
  const ref=env&&Array.isArray(env.receiptRefs)?env.receiptRefs.find(r=>r&&r.sourceSystem===SOURCE_SYSTEM):null;if(!ref)errors.push('receiptRefs needs os-b2c');
  if(!item||typeof item!=='object'||!str(item.id))errors.push('b2c item required');
  else if(env&&env.source&&String(item.id)!==String(env.source.id))errors.push('source.id ≠ item.id');
  if(errors.length)return out;
  const works=Array.isArray(item.work_types)&&item.work_types.length?item.work_types.join(' · '):String(item.work_type_raw||'');
  out.request_id=requestIdFor(env.handoffKey);
  out.payload={brand:String(item.brand||''),site_name:String(item.site_name||''),contact_name:String(item.customer_name||''),phone:String(item.phone||''),address:[item.region,item.address].filter(Boolean).join(' '),work_type:works,message:String(item.content||''),channel:String(item.consult_channel||''),
   raw:{source:SOURCE_SYSTEM,os_b2c_id:String(item.id),os_internal_id:ref.osInternalId,display_no:ref.displayNo,handoff_key:env.handoffKey,case_ref:env.caseRef||null,documents:env.documents||[],os_owner:item.owner||'',os_status:item.status||'',inflow_path:item.inflow_path||'',customer_type:item.customer_type||'',building_type:item.building_type||'',complex_info:item.complex_info||'',agent_name:item.agent_name||'',office_phone:item.office_phone||''}};
  if(env.caseRef===null&&!out.unresolved.length)out.unresolved.push('공사 건 미확정 — 이름으로 자동 연결하지 않음');
  out.mapping={handoffKey:env.handoffKey,sourceId:String(item.id),osInternalId:ref.osInternalId,displayNo:ref.displayNo,request_id:out.request_id};
  out.ok=true;return out;
 }
 /* ── CRM → OS 결과 봉투: 받은 봉투의 식별(handoffKey · source · receiptRefs · caseRef · documents)은 그대로, result 만 CRM 값으로 ── */
 function toHandoff(env,crm){
  const st=crmStateOf(crm),q=crm&&crm.inquiry||{};
  const out={schema:SCHEMA,schemaVersion:VERSION,mode:'prepared',handoffKey:env.handoffKey,source:{system:env.source.system,id:env.source.id},targetSystem:TARGET,receiptRefs:(env.receiptRefs||[]).map(r=>Object.assign({},r)),caseRef:env.caseRef?Object.assign({},env.caseRef):null,documents:(env.documents||[]).map(d=>Object.assign({},d)),
   result:{status:st.label,code:st.code,crmId:String(q.id||''),originalInquiryId:String(env.source.id),crmStatus:st.crmStatus,dealStage:st.dealStage,dealOutcome:st.dealOutcome,assignee:String(q.assignee_name||''),updatedAt:String(q.updated_at||q.server_at||''),editor:'crm',osContract:false},
   unresolved:Array.isArray(env.unresolved)?env.unresolved.slice():[]};
  if(out.caseRef===null&&!out.unresolved.length)out.unresolved.push('공사 건 미확정 — 이름으로 자동 연결하지 않음');
  if(!out.result.crmId)out.unresolved.push('CRM ID 없음 — 전송 전 또는 실패');
  return out;
 }
 /* ── 가짜 CRM(시험용): 실제 서버 대신 메모리. create 는 request_id 로 replay, fail 을 켜면 연결 실패 ── */
 function fakeTransport(opts){
  const O=Object.assign({fail:false,clock:()=>'2026-10-21T09:00:00+09:00'},opts||{}),byReq=new Map(),byId=new Map();let n=0;
  return {byReq,byId,set fail(v){O.fail=!!v;},get fail(){return O.fail;},
   create(request_id,payload){if(O.fail)throw new Error('CRM 연결 실패(시험)');if(byReq.has(request_id)){const r=byReq.get(request_id);return Object.assign({},r,{replayed:true});}const id='TEST-CRM-'+(++n),rec={inquiry_id:id,status:'접수',assigned_to:null,assignee_name:'',server_at:O.clock(),replayed:false};byReq.set(request_id,rec);byId.set(id,{inquiry:{id,status:'접수',assignee_name:'',updated_at:O.clock(),payload},deal:null});return Object.assign({},rec);},
   status(id){if(O.fail)throw new Error('CRM 연결 실패(시험)');const r=byId.get(id);if(!r)throw new Error('CRM 문의 없음: '+id);return JSON.parse(JSON.stringify(r));},
   progress(id,patch){const r=byId.get(id);if(!r)throw new Error('CRM 문의 없음: '+id);if(patch.inquiry)Object.assign(r.inquiry,patch.inquiry);if('deal' in patch)r.deal=patch.deal;r.inquiry.updated_at=patch.at||O.clock();return this.status(id);}};
 }
 /* ── 연결 상태 저장소(시험용 메모리 · 운영은 통합 담당과 저장 위치 확정) ── 키 = handoffKey + 대상 ── */
 function createBridge(transport,store){
  const S=store||new Map(),key=k=>TARGET+'|'+k;
  const get=k=>S.get(key(k))||null,put=(k,v)=>{S.set(key(k),v);return v;};
  return {
   state(handoffKey){return get(handoffKey)||{link:'unlinked',label:'CRM 연결 전',handoffKey};},
   /* OS → CRM 전송. 저장 성공(mapping 보관) 뒤에만 전달 데이터 확정 · 실패는 retryable 로 두고 기존 mapping 은 지우지 않는다 */
   send(env,item){
    const f=fromHandoff(env,item);if(!f.ok)return {link:'rejected',errors:f.errors,handoffKey:env&&env.handoffKey};
    const prev=get(env.handoffKey);if(prev&&prev.link==='linked')return Object.assign({},prev,{replayed:true});
    try{const ack=transport.create(f.request_id,f.payload);return put(env.handoffKey,{link:'linked',label:'CRM 전송 저장됨',handoffKey:env.handoffKey,sourceId:f.mapping.sourceId,request_id:f.request_id,crmId:ack.inquiry_id,osOwner:item.owner||'',osOwnerBy:'os',crm:{status:ack.status,updatedAt:ack.server_at},crmBy:'crm',replayed:!!ack.replayed,lastError:''});}
    catch(e){const r={link:prev?prev.link:'retryable',label:'CRM 연결 실패 · 재시도 가능',handoffKey:env.handoffKey,sourceId:f.mapping.sourceId,request_id:f.request_id,lastError:String(e&&e.message||e),lastErrorAt:new Date().toISOString()};return prev?Object.assign({},prev,{lastError:r.lastError,lastErrorAt:r.lastErrorAt}):put(env.handoffKey,r);}
   },
   /* CRM 진행 조회 → OS 에 돌려줄 봉투. 조회 실패면 이전 정상 결과를 지우지 않는다 */
   pull(env){
    const m=get(env.handoffKey);if(!m||m.link!=='linked')return {ok:false,reason:m?m.label:'CRM 연결 전',envelope:toHandoff(env,null)};
    try{const rec=transport.status(m.crmId);return this.receive(env,rec);}catch(e){m.lastError=String(e&&e.message||e);m.lastErrorAt=new Date().toISOString();return {ok:false,reason:'조회 실패 · 이전 결과 유지',envelope:toHandoff(env,m.lastRec||null),mapping:m};}
   },
   /* CRM 응답 반영: 다른 문의 응답 · 같은 응답 두 번 · 이전 버전(지연) 응답은 저장하지 않는다 */
   receive(env,rec){
    const m=get(env.handoffKey);if(!m||m.link!=='linked')return {ok:false,reason:'CRM 연결 전',envelope:toHandoff(env,null)};
    const q=rec&&rec.inquiry||{};
    if(String(q.id||'')!==String(m.crmId))return {ok:false,reason:'다른 문의 응답(crmId 불일치) · 무시',envelope:toHandoff(env,m.lastRec||null),mapping:m};
    const payloadSrc=q.payload&&q.payload.raw&&q.payload.raw.os_b2c_id;if(payloadSrc&&String(payloadSrc)!==m.sourceId)return {ok:false,reason:'다른 원문의 응답(os_b2c_id 불일치) · 무시',envelope:toHandoff(env,m.lastRec||null),mapping:m};
    const at=String(q.updated_at||''),prevAt=m.crm&&m.crm.updatedAt||'';
    if(m.lastRec&&at&&at===prevAt&&JSON.stringify(crmStateOf(rec))===JSON.stringify(crmStateOf(m.lastRec)))return {ok:true,reason:'같은 응답 재수신 · 변경 없음',duplicate:true,envelope:toHandoff(env,m.lastRec),mapping:m};
    if(prevAt&&at&&at<prevAt)return {ok:false,reason:'이전 버전 응답(지연) · 무시',stale:true,envelope:toHandoff(env,m.lastRec||null),mapping:m};
    m.lastRec=JSON.parse(JSON.stringify(rec));m.crm={status:String(q.status||''),updatedAt:at,state:crmStateOf(rec)};m.crmBy='crm';m.lastError='';
    return {ok:true,reason:'반영',envelope:toHandoff(env,rec),mapping:m};
   },
   /* OS 배정 변경: owner 만 OS 가 고친다 — CRM 진행 값은 건드리지 않는다 */
   assign(handoffKey,owner){const m=get(handoffKey);if(!m)return null;m.osOwner=String(owner||'');m.osOwnerBy='os';m.osOwnerAt=new Date().toISOString();return m;}
  };
 }
 return {SCHEMA,VERSION,TARGET,SOURCE_SYSTEM,validate,requestIdFor,crmStateOf,fromHandoff,toHandoff,fakeTransport,createBridge,STATUS,DEAL};
});
