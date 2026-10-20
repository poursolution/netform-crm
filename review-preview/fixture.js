/* Synthetic, memory-only fixture for candidate D. No production data changes. */
(async function prepareFixture(){
 if(document.readyState==='loading'){document.addEventListener('DOMContentLoaded',prepareFixture,{once:true});return;}
 'use strict';
 const params=new URLSearchParams(location.search),scenario=params.get('review')||'contact';
 document.title='Claude D · 연락 결과 구현 검토 · 합성 데이터 (운영 아님)';
 const fixtureScope=(params.get('screen')||'D')+':'+scenario;
 if(params.get('reset')==='1'||sessionStorage.getItem('crm:review:scope')!==fixtureScope)sessionStorage.clear();
 sessionStorage.setItem('crm:review:scope',fixtureScope);closeSheet();
 const id='11111111-1111-4111-8111-111111111111',aid='99999999-9999-4999-8999-999999999999',rid='22222222-2222-4222-8222-222222222222';
 const due=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul'}).format(new Date(Date.now()+3*864e5));
 const rep={...(REPS.find(x=>x.role==='dual')||REPS[0]),nm:'합성 담당자'};
 REPS=[rep];G.user=rep;G.mode='rep';G.tab='today';G.deal=id;G.sub=null;G._today=[];G.done={};DEMO=true;
 DEALS=[{id,nm:'[테스트] 합성 상담 현장',code:'consulting',sub:'방수',rep:rep.nm,activities:[],tl:[],version:0,manager_name:'합성 담당자',manager_mobile:'',nextAction:{id:aid,type:'전화',text:'회의 결과 확인',due,due_at:due,status:'open'}}];
 if(window.ADMIN)ADMIN.inquiries=[];
 const request={id:rid,target_type:'deal',target_id:id,kind:'first',label:'첫 연락 요청',asks:scenario==='compound'?['고객 첫 연락','현장방문 필요 여부 확인']:['고객 첫 연락'],to_me:true,status:'sent',open:true,closed_at:null};
 const rows=[],replies=[],items=[];let failOnce=scenario==='retry';
 const unsupported=()=>{throw Error('합성 검토 화면에서 지원하지 않는 작업입니다. 운영 저장은 차단되어 있습니다.');};
 window.Phase1={...Phase1,profile:{auth_uid:id,user_id:id,name:rep.nm,allowed_modes:['rep']},rpc:async(name,{p}={})=>{
  if(name==='crm_work_request_list_v1')return {ok:true,requests:[structuredClone(request)]};
  /* 영업건 요청 항목별 처리(crm_work_request_deal_contact_v1) — 서버(sql/work-request-deal-contact-v1-20261020.sql)와 같은 판정의 합성 응답 */
  if(name==='crm_work_request_deal_contact_v1'){
   const again=items.find(x=>x.operation_id===p.operation_id);if(again)return {...again._ack,replayed:true};
   const asks=(request.asks||[]).filter(a=>a!=='고객 첫 연락'),conf=p.confirmed||[],att=['부재','번호 오류'].includes(p.result),left=asks.filter(a=>!conf.includes(a)),complete=!att&&!left.length&&!!p.next_text&&!!p.next_due;
   const tries=items.filter(x=>['부재','번호 오류'].includes(x.result)).length+(att?1:0);
   const note=att?'연락 시도 '+tries+'회 · 미연결 ('+p.result+')':complete?'확인 완료'+(asks.length?' · '+asks.join(' · '):''):!left.length?'연결 · 다음 행동 · 날짜 필요':'일부 처리 '+conf.length+'/'+asks.length+' · 확인: '+(conf.join(' · ')||'없음')+' · 남음: '+left.join(' · ');
   Object.assign(request,{status:complete?'done':'working',open:!complete,closed_at:complete?new Date().toISOString():null,reply_note:note},att?{}:{result:p.result,next_text:p.next_text||request.next_text,next_due:p.next_due||request.next_due});
   const ack={ok:true,contract_version:1,kind:'deal-contact',operation_id:p.operation_id,request_id:request.id,attempt:att,request_complete:complete,remaining:left,request:structuredClone(request)};
   items.push({...structuredClone(p),_ack:ack});return ack;
  }
  if(name!=='crm_work_request_reply_v1')return unsupported();
  if(failOnce){failOnce=false;throw Error('합성 요청 저장 실패 — 같은 입력으로 재시도할 수 있습니다.');}
  replies.push(structuredClone(p));
  if(p.action==='seen')Object.assign(request,{status:'seen',open:true});
  else if(p.action==='working')Object.assign(request,{status:'working',open:true,closed_at:null});
  else if(p.action==='done')Object.assign(request,{status:'done',open:false,closed_at:new Date().toISOString(),result:p.result,next_text:p.next_text,next_due:p.next_due});
  else return unsupported();
  return {ok:true,request:structuredClone(request)};
 },queue:{list:()=>rows,enqueue:unsupported,flush:async()=>{
  for(const row of rows){
   if(row.status==='done')continue;const at=new Date().toISOString();
   row.ack={contract_version:1,ok:true,request_id:row.request_id,operation:row.operation,object_id:row.object_id,replayed:false,actor_auth_uid:id,actor_user_id:id,previous_version:0,version:1,activity_id:crypto.randomUUID(),audit_event_id:crypto.randomUUID(),meaningful_contact:!/부재|번호 오류/.test(row.payload.note),occurred_at:at,server_at:at};
   if(row.operation==='next_action')Object.assign(row.ack,{next_action_id:crypto.randomUUID(),cancelled_action_ids:[],due_at:row.payload.due_at,assignee_name:rep.nm});
   if(row.operation==='next_action_complete')Object.assign(row.ack,{next_action_id:row.payload.action_id,completed_at:at});
   if(row.payload.intent==='postpone')Object.assign(row.ack,{intent:'postpone',next_action_id:row.payload.action_id,previous_due_at:due,postpone_count:1,postpone_event_id:crypto.randomUUID()});
   OperationalAdapter.validateAck(row.ack,row);row.status='done';
  }
 }}};
 window.queueMobileContactOperation=(operation,payload,actionId)=>{
  if(!['activity','next_action','next_action_complete'].includes(operation)||!DEALS.some(d=>String(d.id)===String(payload.opportunity_id)))return unsupported();
  const cmd=OperationalAdapter.normalize(operation,String(payload.opportunity_id),0,{...(operation==='next_action_complete'?{}:{intent:'standalone'}),...payload,...(actionId?{action_id:actionId}:{})});
  const row={...cmd,auth_uid:id,user_id:id,request_id:crypto.randomUUID(),status:'pending'};rows.push(row);return row.request_id;
 };
 window.CRM_SCHEDULE_V1=false;
 Object.assign(MobileRequests.state(),{list:[structuredClone(request)],at:Date.now(),off:false,busy:false,loaded:true});
 // Test observability only, not an alternative product API.
 window.__review={scenario,rows,replies,items,request,productionWrites:0};
 document.addEventListener('click',event=>{const a=event.target.closest('a[href]');if(a&&new URL(a.href,location.href).origin!==location.origin){event.preventDefault();event.stopImmediatePropagation();toast('합성 검토 화면에서는 외부 앱 이동을 실행하지 않습니다.');}},true);
 if(params.get('screen')==='A'){
  document.title='Claude A 원본 적용 · 예시 데이터 · 운영 아님';
  const rows=[
   {id,kind:'inquiry',name:'[수원] 수원장안힐스테이트',brand:'POUR솔루션',color:'#1f9d55',stage:'견적문의',due:'2일 지남',dueColor:'#b42318',task:'고객 첫 연락',why:'접수 후 2일 · 송보람 요청 18:00',button:'전화하고 기록'},
   {id:'33333333-3333-4333-8333-333333333333',kind:'deal',name:'[고양] 햇빛마을23단지',brand:'석민이앤씨',color:'#e8590c',stage:'경쟁·입찰',due:'D-2',dueColor:'#b42318',task:'제안서 팀장 공유',why:'입찰 마감 10.6 11:00',button:'제출 확인'},
   {id:'44444444-4444-4444-8444-444444444444',kind:'deal',name:'[화성] 동탄푸른마을',brand:'POUR솔루션',color:'#1f9d55',stage:'컨설팅 설계',due:'오늘',dueColor:'#15171c',task:'현장 방문',why:'방문 약속 14:00',button:'방문 결과 입력'}
  ];
  window.__approvedAExample={title:'필선님, 오늘 6곳',progress:'2 / 6',progressPercent:33,notifications:2,batch:'묶음 요청 · 송보람 · 실주 사유 12건',areas:['지금 처리 4','회신 대기 3','정보 보완 12','약속 2'],rows};
  const original=DEALS[0];DEALS=rows.map((r,i)=>({...structuredClone(original),id:r.id,nm:r.name,brand:r.brand,code:i===1?'bidding':'consulting',nextAction:{...original.nextAction,id:i===2?'55555555-5555-4555-8555-555555555555':aid,type:i===2?'방문':original.nextAction.type,text:r.task}})).filter((r,i)=>i!==0);
  // The first approved card is a real inquiry view, never a deal disguised as an inquiry.
  // Only this local review server supplies the shared in-memory PC RPC fixture.
  const queue=Phase1.queue,otherRpc=Phase1.rpc;
  if(typeof window.__installReviewInquiryRPC!=='function')await new Promise((resolve,reject)=>{
   const script=document.createElement('script');script.src='review-preview/inquiry-rpc-fixture.js';
   script.onload=()=>{script.remove();resolve();};script.onerror=()=>{script.remove();reject(Error('합성 문의 저장 연결을 불러오지 못했습니다.'));};document.head.append(script);
  });
  const install=window.__installReviewInquiryRPC;
  if(typeof install!=='function')throw Error('합성 문의 저장 연결을 불러오지 못했습니다. 운영 연결을 대신 사용하지 않습니다.');
  const f=install(window,id),inquiryRpc=Phase1.rpc;
  Phase1.queue=queue;Object.assign(Phase1.profile,{name:rep.nm,display_name:rep.nm,allowed_modes:['rep']});
  G.user={...rep,id:f.uid};REPS=[G.user];
  const received=new Date(Date.now()-2*864e5).toISOString(),raw={id,status:'배정완료',site:rows[0].name,site_name:rows[0].name,assignee:G.user.nm,assigned_user_id:f.uid,assigned_to:f.uid,assigned_at:received,phone:'01000000000',contact_name:'합성 고객',work_type:'옥상 방수',created_at:received,activities:[]};
  ADMIN.inquiries=[inquiryViewM(raw)];
  Object.assign(request,{target_type:'inquiry',target_id:id});Object.assign(MobileRequests.state(),{list:[structuredClone(request)],loaded:true,busy:false,at:Date.now()});
  Phase1.rpc=async(name,args)=>{
   if(name==='crm_work_request_list_v1')return otherRpc(name,args);
   const value=await inquiryRpc(name,args);
   if(name==='crm_inquiry_command_v1'&&value.state)value.state.logs.forEach(log=>{log.kind=InquiryFlow.kindOf(log.result);});
   return value;
  };
  const save=PCInquirySave.save;
  window.PCInquirySave=Object.freeze({...PCInquirySave,save:async function(q,...args){
   const value=await save.call(this,q,...args);
   if(value===true&&String(q.id)===id)delete window.__approvedAExample;
   return value;
  }});
  window.__review.inquiry={fixture:f,raw,view:ADMIN.inquiries[0],id};
  document.title='Claude A → 문의 D · 합성 예시 · 메모리 저장만 · 운영 아님';
  G.deal=null;G.tab='today';render();
  }else if(['B','C'].includes(params.get('screen'))){
  document.title='Claude '+params.get('screen')+' 원본 적용 · 예시 데이터 · 운영 아님';
  const parsed={};for(const key of ['B','C']){const box=document.createElement('div');box.innerHTML=MobileApprovedBCSource[key];parsed[key]=box.firstElementChild;}
  const sampleRows=[...parsed.B.children[3].children];
  const original=DEALS[0],models={},details={};
  DEALS=sampleRows.map((row,i)=>{
   const key=i===0?id:'bbbbbbbb-bbbb-4bbb-8bbb-'+String(i).padStart(12,'0'),left=row.children[0],right=row.children[1];
   const name=left.children[0].textContent,subtitle=left.children[1].textContent,task=right.children[0].textContent;
   models[key]={name,subtitle,task,due:right.children[1].textContent,dueColor:right.children[1].style.color,color:row.style.borderLeftColor};
   return {...structuredClone(original),id:key,nm:name,brand:i===0||i===4?'석민이앤씨':'POUR솔루션',code:i===0||i===4?'rapport':i===1?'sent':'consulting',work_type:subtitle.split(' · ')[0],nextAction:{...original.nextAction,text:task}};
  });
  const [identity,now,contact,history,more]=parsed.C.children[1].children;
  details[id]={name:identity.children[1].textContent,brand:identity.children[0].textContent,color:identity.children[0].style.color,stage:identity.children[2].children[0].textContent,owner:identity.children[2].children[1].textContent,siblings:identity.children[3].textContent,task:now.children[1].textContent,context:now.children[2].textContent,actionLabel:now.children[3].textContent,action:'pending-task',followup:now.children[4].textContent,contactName:contact.children[0].children[0].textContent,phone:contact.children[0].children[1].textContent,history:[...history.children].slice(1).map(r=>({meta:r.children[0].textContent,note:r.children[1].textContent})),more:[...more.children].map(r=>r.children[1].textContent)};
  window.__approvedBCExample={rows:models,details};
  G.tab='mine';G.deal=params.get('screen')==='C'?id:null;render();
 }else if(['I-1','I-2','I-3'].includes(params.get('screen'))){
  const screen=params.get('screen'),models={"I-1": {"context": "옥상 방수 · 2026 · 동탄푸른마을 · 14:00 방문 일정", "transcript": "", "micLabel": "누르고 말하기", "statusText": "음성 입력 준비 전 · 직접 입력할 수 있습니다.", "canSpeak": false, "recording": false, "provenance": {"kind": "approved-design-example-only", "source": "source43/Codex 모바일 디자인 가이드 · 예시.dc.html", "screen": "I-1", "frame": "375×680", "note": "Source42 differs only by height640. Source43 I2 stale10.11(금) is deliberately not adopted as a confirmed date."}, "blockedReason": "합성 예시입니다. 음성·명함 결과와 공통 저장 계약을 확인하기 전에는 업무·연락처를 저장하지 않습니다."}, "I-2": {"transcript": "소장님 만났고 옥상 누수 보수 견적 요청받았습니다. 도면은 아직 없고, 금요일까지 견적을 원하십니다.", "dateCandidate": {"id": "date-candidate", "text": "금요일"}, "candidates": [{"id": "candidate-0", "kind": "visit", "title": "방문 일정 완료", "detail": "오늘 14:00 · 이 방문이 맞나요"}, {"id": "candidate-1", "kind": "quote_request", "title": "견적 요청", "detail": "상담 내용 · 사진 이어받음 · 도면 없음 표시"}, {"id": "candidate-2", "kind": "followup", "title": "견적 발송 업무 · 날짜 확인 필요", "detail": "\"금요일\" → 날짜 확인"}, {"id": "candidate-3", "kind": "stage", "title": "단계 바꾸기", "detail": "제안 안 함 · 필요하면 따로"}], "selectedIds": [], "preview": "선택한 후속 업무 없음 · 날짜 확인 전 · 운영 저장 없음", "dateConfirmed": false, "canSave": false, "suggestionLabel": "예시 후보", "provenance": {"kind": "approved-design-example-only", "source": "source43/Codex 모바일 디자인 가이드 · 예시.dc.html", "screen": "I-2", "frame": "375×680", "note": "Source42 differs only by height640. Source43 I2 stale10.11(금) is deliberately not adopted as a confirmed date."}, "blockedReason": "합성 예시입니다. 음성·명함 결과와 공통 저장 계약을 확인하기 전에는 업무·연락처를 저장하지 않습니다."}, "I-3": {"photoLabel": "명함 사진", "helper": "읽은 값 · 틀리면 고쳐 주세요", "fields": [{"id": "name", "label": "이름", "value": "최민우", "uncertain": false}, {"id": "role", "label": "역할", "value": "관리과장", "uncertain": false}, {"id": "phone", "label": "휴대폰", "value": "010-82O1-3320", "uncertain": true}, {"id": "company", "label": "회사", "value": "동탄푸른마을 관리사무소", "uncertain": false}], "siteId": "55555555-5555-4555-8555-555555555555", "siteLabel": "[화성] 동탄푸른마을 · 지금 보던 현장", "duplicateNote": "이 번호가 [화성] 동탄2신도시 현장에도 있어요 · 같은 분?", "validationState": "invalid", "canSave": false, "provenance": {"kind": "approved-design-example-only", "source": "source43/Codex 모바일 디자인 가이드 · 예시.dc.html", "screen": "I-3", "frame": "375×680", "note": "Source42 differs only by height640. Source43 I2 stale10.11(금) is deliberately not adopted as a confirmed date."}, "blockedReason": "합성 예시입니다. 음성·명함 결과와 공통 저장 계약을 확인하기 전에는 업무·연락처를 저장하지 않습니다."}};
  Object.assign(DEALS[0],{nm:'[화성] 동탄푸른마을',work_type:'옥상 방수',site_id:'55555555-5555-4555-8555-555555555555'});
  window.__approvedInputExample={owner:MobileSaveJournal.owner(),dealId:id,models};
  document.title='Claude '+screen+' 원본 적용 · 합성 입력 예시 · 운영 저장 없음';
  G.tab='mine';G.deal=id;MobileGuideShell.state.detailView='input';
  window.MobileInputFlow?.open(DEALS[0],screen);render();
 }else if(['K-1','K-2','K-3','K-4','K-5','Q-S','Q-N','Q-T','Q-M'].includes(params.get('screen'))){
  const screen=params.get('screen'),models={"K-1":{"title":"견적 요청","context":"옥상 방수 · 2026 · [수원] 매탄임광아파트 · 석민이앤씨","preview":"견적 요청 1건 · 견적팀(잔디) 알림 · 고객 약속 10.16 (금)","inherited":{"title":"상담 내용 · 사진 6장","tag":"이어받음","detail":"옥상 슁글 들뜸 · 배수로 막힘 · 사진 6장 · 도면 없음"},"inheritedHint":"방문 기록 · 10.8","works":[{"id":"chip-0","label":"슁글","selected":true},{"id":"chip-1","label":"금속기와","selected":false},{"id":"chip-2","label":"슬라브","selected":false},{"id":"chip-3","label":"배수로","selected":true},{"id":"chip-4","label":"PVC","selected":false},{"id":"chip-5","label":"기타공사","selected":false}],"quantities":[{"id":"row-0","label":"슁글","value":"약 1,200 ㎡ · 실측 필요"},{"id":"row-1","label":"배수로","value":"모름 · m"}],"dates":[{"id":"chip-0","label":"금 10.16","selected":true},{"id":"chip-1","label":"날짜 고르기","selected":false},{"id":"chip-2","label":"약속 없음","selected":false}],"provenance":{"kind":"approved-design-example-only","source":"source44/design_handoff_quote_v3/견적서 · 모바일 흐름.dc.html","sourceReadme":"source44/design_handoff_quote_v3/README.md:87-89","screen":"K-1","recordingDate":"2026-10-11","dateBasis":"Original example dates preserved; 2026-10-16 Friday and 2026-10-19 Monday agree with source. Future schedule/history is fictional example data.","amountBasis":"K3/K5 매탄임광 V2 290,000,000원 is source44 적산 기준금액, not an inferred customer submission amount. K4 동탄푸른마을 is a separate source example."},"primaryEnabled":false,"secondaryEnabled":false,"blockedReason":"승인된 디자인 예시입니다. 견적 서버 저장·제출금액 계산·발송 계약이 연결되지 않아 저장·발송할 수 없습니다."},"K-2":{"title":"견적 진행","context":"옥상 방수 · 2026 · [수원] 매탄임광아파트 · 석민이앤씨","preview":"고객과 다시 정하면 → 고객 응대 기록으로 (약속일은 그때 바뀜)","steps":[{"title":"요청함","detail":"10.8 15:10 · 필선","state":2},{"title":"자료 보완 필요","detail":"도면 없음 → 실측 10.9 완료","state":2},{"title":"작성 중","detail":"견적팀 박지훈 · 내부 완료 예정 10.19 (월)","state":1},{"title":"완료 · 최종본","detail":"","state":0}],"conflict":"고객 약속 10.16 (금) · 내부 완료 예정 10.19 (월) → 3일 늦음","adjustment":{"title":"앞당기기 요청함 · 10.12","tag":"답 대기","detail":"견적팀 답 기다림 · 받아들이면 내부 예정일이 바뀜 (요청만으론 안 바뀜)"},"question":{"title":"배수로 길이 확인 부탁드려요","tag":"질문 1","detail":"박지훈 · 10.9 16:20 · 답변 기다림"},"provenance":{"kind":"approved-design-example-only","source":"source44/design_handoff_quote_v3/견적서 · 모바일 흐름.dc.html","sourceReadme":"source44/design_handoff_quote_v3/README.md:87-89","screen":"K-2","recordingDate":"2026-10-11","dateBasis":"Original example dates preserved; 2026-10-16 Friday and 2026-10-19 Monday agree with source. Future schedule/history is fictional example data.","amountBasis":"K3/K5 매탄임광 V2 290,000,000원 is source44 적산 기준금액, not an inferred customer submission amount. K4 동탄푸른마을 is a separate source example."},"primaryEnabled":false,"secondaryEnabled":false,"blockedReason":"승인된 디자인 예시입니다. 견적 서버 저장·제출금액 계산·발송 계약이 연결되지 않아 저장·발송할 수 없습니다."},"K-3":{"title":"견적 V2 확인","context":"옥상 방수 · 2026 · [수원] 매탄임광아파트 · 석민이앤씨","preview":"확인하면 \"영업 확인 완료\" 기록 · 발송 준비","quote":{"title":"옥상 방수 견적 V2 · 최종본","tag":"도착","detail":"석민 공사 견적서 · 슁글 + 배수로 템플릿 · 단가 기준 26.03.25 이후"},"amountRows":[{"id":"row-0","label":"견적 금액","value":"2억 9,000만 · VAT 별도"},{"id":"row-1","label":"슁글 방수 (직접공사비)","value":"1억 1,764만"},{"id":"row-2","label":"배수로 방수 (직접공사비)","value":"4,842만"},{"id":"row-3","label":"기타공사 (직접공사비)","value":"2,400만"},{"id":"row-4","label":"간접비 · 관리비 · 이윤","value":"9,994만"},{"id":"row-5","label":"유효기간","value":"석민 양식 · 없음"},{"id":"row-6","label":"V1 대비","value":"−9,000만 · 옥탑 · 두겁 제외"}],"pdf":{"title":"견적서 PDF","tag":"보기","detail":"석민_매탄임광_옥상방수_V2.pdf · 4쪽 · 엑셀과 같은 금액 확인됨","id":"fixture-pdf","enabled":false},"note":"엑셀 수정은 PC에서 견적팀이 · 금액이 이상하면 [견적팀에 확인 요청]","provenance":{"kind":"approved-design-example-only","source":"source44/design_handoff_quote_v3/견적서 · 모바일 흐름.dc.html","sourceReadme":"source44/design_handoff_quote_v3/README.md:87-89","screen":"K-3","recordingDate":"2026-10-11","dateBasis":"Original example dates preserved; 2026-10-16 Friday and 2026-10-19 Monday agree with source. Future schedule/history is fictional example data.","amountBasis":"K3/K5 매탄임광 V2 290,000,000원 is source44 적산 기준금액, not an inferred customer submission amount. K4 동탄푸른마을 is a separate source example."},"primaryEnabled":false,"secondaryEnabled":false,"blockedReason":"승인된 디자인 예시입니다. 견적 서버 저장·제출금액 계산·발송 계약이 연결되지 않아 저장·발송할 수 없습니다.","versionId":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2"},"K-4":{"title":"견적 V1 확인","context":"옥상 방수 · 2026 · [화성] 동탄푸른마을 · 석민이앤씨","preview":"발송 1건 · 안 A · B 두 PDF","quote":{"title":"금속기와 도포만 · 두 안","tag":"최종본","detail":"석민 공사 견적서 · 한 견적 안에 안 A · B"},"options":[{"id":"chip-0","label":"안 A · 1회 도포","selected":true,"value":"6,800만 · VAT 별도"},{"id":"chip-1","label":"안 B · 2회 도포","selected":true,"value":"9,400만 · VAT 별도"}],"note":"고객이 한 안을 고르면 → 응대 기록에서 [안 B 선택] → 현재 견적 금액 = 9,400만","provenance":{"kind":"approved-design-example-only","source":"source44/design_handoff_quote_v3/견적서 · 모바일 흐름.dc.html","sourceReadme":"source44/design_handoff_quote_v3/README.md:87-89","screen":"K-4","recordingDate":"2026-10-11","dateBasis":"Original example dates preserved; 2026-10-16 Friday and 2026-10-19 Monday agree with source. Future schedule/history is fictional example data.","amountBasis":"K3/K5 매탄임광 V2 290,000,000원 is source44 적산 기준금액, not an inferred customer submission amount. K4 동탄푸른마을 is a separate source example."},"primaryEnabled":false,"secondaryEnabled":false,"blockedReason":"승인된 디자인 예시입니다. 견적 서버 저장·제출금액 계산·발송 계약이 연결되지 않아 저장·발송할 수 없습니다."},"K-5":{"title":"견적 이력","context":"옥상 방수 · 2026 · [수원] 매탄임광아파트 · 석민이앤씨","preview":"","dispatch":{"title":"V2 발송 · 박정호 소장 · 이메일","tag":"고객 검토 중","detail":"10.16 10:12 · 견적 V2 + 시방서 + 입대의 자료 · 성공 · 보낸 주소 고정"},"next":{"title":"다음 업무 · 10.23 반응 확인","tag":"예정","detail":"발송 D+7 · 같은 영업건에 열린 반응 확인이 있으면 새로 만들지 않음"},"versions":[{"id":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2","label":"V2 · 10.16","value":"2.9억 · 고객 검토 중","replaced":false,"enabled":true},{"id":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1","label":"V1 · 8.18","value":"3.8억 · 대체됨","replaced":true,"enabled":true}],"note":"V2 사유: 관리소장 변경 · 예산 축소 → 옥탑 · 두겁 제외 (변화 기록 9.20과 연결)","provenance":{"kind":"approved-design-example-only","source":"source44/design_handoff_quote_v3/견적서 · 모바일 흐름.dc.html","sourceReadme":"source44/design_handoff_quote_v3/README.md:87-89","screen":"K-5","recordingDate":"2026-10-11","dateBasis":"Original example dates preserved; 2026-10-16 Friday and 2026-10-19 Monday agree with source. Future schedule/history is fictional example data.","amountBasis":"K3/K5 매탄임광 V2 290,000,000원 is source44 적산 기준금액, not an inferred customer submission amount. K4 동탄푸른마을 is a separate source example."},"primaryEnabled":false,"secondaryEnabled":false,"blockedReason":"승인된 디자인 예시입니다. 견적 서버 저장·제출금액 계산·발송 계약이 연결되지 않아 저장·발송할 수 없습니다.","versionId":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2"},"Q-S":{"title":"간단견적","context":"간단견적 · 자재 2026-03-25 · 양식 넷폼 2026-01 · [화성] 동탄푸른마을","blockedReason":"합성 예시입니다. 공통 서버 견적 저장·계산·권한 검증 연결 전이므로 변경하지 않습니다.","rows":[{"label":"옥상 균열 보수","value":"3,600,000","detail":"120 m × 30,000 · m"},{"label":"우레탄 부분 도포","value":"5,400,000","detail":"180 ㎡ × 30,000 · ㎡"},{"label":"사다리차","value":"600,000","detail":"1 식"},{"label":"+ 항목 추가","value":"","detail":"공법 기준에서 불러오기 / 직접 입력"},{"label":"합계 · VAT 별도","value":"9,600,000","detail":"간단견적 = 원가계산서 없이 항목 합계 · 표지에 \"간단견적\" 표시"}],"pre":"초안 1건 · 고객 발송 전 팀장 확인(권한 설정)"},"Q-N":{"title":"견적 V2 작성 중","context":"공법견적 · 노임 · 요율 2026-01 · [수원] 매탄임광 · 옥상 방수","blockedReason":"합성 예시입니다. 공통 서버 견적 저장·계산·권한 검증 연결 전이므로 변경하지 않습니다.","rows":[{"label":"새 기준 2026-07 승인됨","value":"7.1 시행","detail":"이 견적은 2026-01 기준으로 계산됨"},{"label":"그대로 두기","value":"2.9억","detail":"2026-01 기준 유지 · 이유 한 줄 (예: 6월 약속한 금액)"},{"label":"새 기준으로 다시 계산","value":"2억 9,030만 (+30만)","detail":"바뀐 항목: 고용보험 1.01 → 1.15% · 임금채권 0.09 → 0.06%"},{"label":"보낸 견적이었다면","value":"원본 그대로","detail":"새 기준은 새 수정본(V3)으로만 · 차액 표시"}],"pre":"고른 기준이 이 견적에 저장됨"},"Q-T":{"title":"공법견적","context":"공법견적 · 노임 · 요율 2026-07 · 자재 2026-03-25 · 석민 2026-01","blockedReason":"합성 예시입니다. 공통 서버 견적 저장·계산·권한 검증 연결 전이므로 변경하지 않습니다.","rows":[{"label":"공법","value":"POUR슁글방수","detail":"공법 기준에서 고르기 · ㎡당 29,895"},{"label":"수량","value":"1,180 ㎡","detail":"방문 실측에서 이어받음 · 고치기 가능"},{"label":"직접공사비","value":"117,640,000","detail":"공법 기준 × 수량 자동"},{"label":"원가계산서","value":"자동","detail":"요율 2026-07 · 접힌 상태 · 눌러서 보기"},{"label":"견적 금액 · VAT 별도","value":"179,500,000","detail":"공급가액 179,550,000 → 10만원 아래 절삭"}],"pre":"권한: 영업사원은 초안까지 · 확정은 팀장 · 견적팀"},"Q-M":{"title":"제출금액 만들기","context":"옥상 슁글 방수 · V1 · [화성] 동탄푸른마을 · 석민이앤씨","blockedReason":"합성 예시입니다. 공통 서버 견적 저장·계산·권한 검증 연결 전이므로 변경하지 않습니다.","type":"area","baseAmount":"170,000,000","area":"1,000","value":"17,000","additionalAmount":"+ 17,000,000 · 10%","submitAmount":"187,000,000"}};
  const q1='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',q2='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2';
  const isDongtan=['K-4','Q-S','Q-M'].includes(screen);
  Object.assign(DEALS[0],{nm:isDongtan?'[화성] 동탄푸른마을':'[수원] 매탄임광아파트',work_type:'옥상 방수',brand:'석민이앤씨',
   nextAction:{...DEALS[0].nextAction,type:'견적',text:'견적 요청 등록'},
   quote_versions:screen==='K-4'?[{id:q1,opportunity_id:id,version_no:1,status:'final'}]:screen==='Q-S'?[{id:q1,opportunity_id:id,version_no:1,status:'draft',kind:'simple',base_amount:9600000}]:screen==='Q-T'?[{id:q1,opportunity_id:id,version_no:1,status:'draft',kind:'method',base_amount:179500000,supply_amount:179550000}]:screen==='Q-M'?[{id:q1,opportunity_id:id,version_no:1,status:'draft',base_amount:170000000,submit_amount:187000000}]:[
    {id:q2,opportunity_id:id,version_no:2,status:'final',base_amount:290000000,supply_amount:290071560,created_at:'2026-09-24T01:00:00Z',reason:'옥탑 · 두겁 제외'},
    {id:q1,opportunity_id:id,version_no:1,status:'superseded',base_amount:380000000,created_at:'2026-08-18T01:00:00Z'}]});
  models['K-1'].quantities=models['K-1'].quantities.map(x=>({...x,editable:true}));
  // Explicit date and picker behavior from the source44 K1 example only.
  models['K-1'].dates=models['K-1'].dates.map(x=>({...x,...(x.id==='chip-0'?{date:'2026-10-16'}:x.id==='chip-1'?{action:'pick-date'}:{})}));
  models['K-4'].options=models['K-4'].options.map(x=>({...x,selected:false}));
  // Only related supplied examples are available in one synthetic deal context.
  const selected=Object.fromEntries((isDongtan?[screen]:['K-1','K-2','K-3','K-5',screen]).map(k=>[k,models[k]]));
  window.__approvedQuoteExample={owner:MobileSaveJournal.owner(),dealId:id,models:selected};
  document.title='Claude 견적 v3 '+screen+' · 합성 예시 · 운영 저장·발송 없음';
  G.tab='mine';G.deal=id;
  if(window.MobileQuoteFlow?.open(DEALS[0],screen))MobileGuideShell.state.detailView='quote';
  else MobileGuideShell.state.detailView='quote';
  render();
 }else if(['G','J-1','J-2'].includes(params.get('screen'))){
  const screen=params.get('screen'),activityId='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  Object.assign(DEALS[0],{nm:screen==='G'?'[평택] 포승공장':'[수원] 매탄임광아파트',
   stage_contexts:{sent:{fields:{materials:['견적서'],quote_version:'2',recipient:'박정호 소장',sent_date:'',followup_date:''}}},
   quote_versions:[{version_no:2,opportunity_id:id}],
   activities:[{id:activityId,opportunity_id:id,at:'2026-09-30T02:00:00Z',type:'통화',note:'대표회의 날짜 2026.10.5 확인'}]});
  window.__approvedStage6Example={owner:MobileSaveJournal.owner(),dealId:id,candidates:[
   {id:'email-example',meta:'이메일 · 2026.6.2 · 이필선',text:'포승공장 견적서 V1.pdf → 임석재 소장',documents:['fixture-file-v1'],recipient:'임석재 소장',sentAt:'2026-06-02T01:00:00Z'},
   {id:'jandi-reference',meta:'잔디 · 2026.6.3',text:'“견적 메일로 보냈습니다”',documents:[],recipient:'',sentAt:''}],
   confirmation:{dealId:id,name:'[수원] 매탄임광아파트',task:'대표회의 전 개략 금액 보내기',actionLabel:'개략 금액 발송',action:'pending-task',actionAllowed:false,actionBlockedReason:'발송 화면은 공통 발송 계약 연결 후 사용할 수 있습니다.',context:'대표회의 검토 중',checks:[
    {label:'대표회의 날짜 확인',detail:'2026.10.5 · 9.30 통화에서 확인',verified:true,confirmedAt:'2026-09-30T02:00:00Z',evidence:{kind:'activity',id:activityId}},
    {label:'대표회의에 필요한 자료',detail:'개략 금액 · 공법 비교 1장',verified:false},
    {label:'결정권자 · 표결 방식',detail:'아직 모름',verified:false}],
    notice:'예시 근거를 연결한 화면입니다. 메모 단어만으로 완료 처리하지 않습니다.'}};
  document.title='Claude '+screen+' 원본 적용 · 합성 예시 · 운영 저장 없음';
  MobileGuideShell.state.detailView=screen==='G'?'evidence':screen==='J-1'?'confirmation':'transition';
  G.tab='mine';G.deal=id;render();
 }else if(['E','J-4'].includes(params.get('screen'))){
  const site='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',original=DEALS[0];
  DEALS=[{...original,nm:'[수원] 영통벽산',address:'수원 영통구 영통동',site_id:site,work_type:'외벽 재도장'},
   {...structuredClone(original),id:'33333333-3333-4333-8333-333333333333',nm:'[수원] 매탄임광아파트',address:'수원 영통구 매탄동',site_id:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',work_type:'외벽 재도장',code:'rapport'}];
  if(!MobileRegistrationContext.loadDraft())MobileRegistrationContext.saveDraft(params.get('screen')==='E'?'수원 영통벽산':'매탄임광 수원 영통구 매탄동','');
  document.title='Claude '+params.get('screen')+' 원본 적용 · 합성 데이터 · 운영 아님';
  G.deal=null;G.tab=params.get('screen')==='E'?'record':'registration-match';render();
 }else if(params.get('screen')==='F'){
  window.__approvedScheduleNow=Date.parse('2026-10-10T03:00:00Z');
  const original=DEALS[0],specs=[
   ['[송파] 서울체육고','전화','수신 확인','2026-10-10','2026-10-10T01:00:00Z'],
   ['[화성] 동탄푸른마을','방문','현장 방문','2026-10-10','2026-10-10T05:00:00Z'],
   ['[수원] 수원장안','전화','첫 연락','2026-10-10',null],
   ['[화성] 동탄푸른마을','방문','방문 결과 확인','2026-10-09',null]];
  DEALS=specs.map((s,i)=>({...structuredClone(original),id:i===0?id:'cccccccc-cccc-4ccc-8ccc-'+String(i).padStart(12,'0'),nm:s[0],nextAction:{...original.nextAction,id:'dddddddd-dddd-4ddd-8ddd-'+String(i).padStart(12,'0'),type:s[1],text:s[2],due:s[3],due_at:s[3],scheduled_at:s[4]}}));
  Object.assign(request,{target_id:DEALS[2].id,due_at:'2026-10-10T09:00:00Z'});Object.assign(MobileRequests.state(),{list:[structuredClone(request)],loaded:true});
  document.title='Claude F 원본 적용 · 합성 일정 · 운영 아님';G.deal=null;G.tab='schedule';render();
 }else if(params.get('screen')==='H'){
  const box=document.createElement('div');box.innerHTML=MobileApprovedHSource;const frame=box.firstElementChild,cards=[...frame.children[1].children],groups={};
  cards.forEach((c,i)=>groups[['done','open','tomorrow'][i]]={count:Number(c.firstElementChild.lastElementChild.textContent),rows:[...c.children].slice(1).map(n=>({text:n.textContent}))});
  window.__approvedHExample={dateLabel:'10.10',...groups,canClose:false,blockedReason:'예시 화면입니다. 미완료 약속 입력과 마감 저장·공유 연결은 아직 준비되지 않았습니다.'};
  document.title='Claude H 원본 적용 · 합성 예시 · 저장 미연결';G.deal=null;G.tab='day-close';render();
 }else{render();dealCallSheetM();}
})();
