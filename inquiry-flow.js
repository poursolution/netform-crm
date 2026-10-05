/* 견적문의 흐름 — 판정 규칙과 저장 명령을 한곳에 (2026-10-05 대표 핸드오프 design_handoff_inquiry_flow · P0)
   견적문의 → 실제 접촉 → 적합 판단 → 견적 → 파이프라인 전환이 한 흐름으로 이어지게, 화면마다 따로 하던 판정 · 저장을 여기로 모은다. 화면 모양은 바꾸지 않는다.
   InquiryFlow   = 판정(읽기). 목록 · 상세 · 오늘 업무 · 대시보드 · KPI 가 같은 함수를 쓴다.
     ① 결과 마스터(contact_result): 시도 = 부재 · 통화불가 · 번호오류 / 접촉 = 연결됨 · 고객 회신 · 검토중 · 자료요청 · 견적요청.
        최초응대 완료 = 최초 접촉 시각(first_connected_at)이 있는 것. 부재만 있으면 '시도 n회'로 남고 첫 연락 지연 판정은 그대로 간다.
        접촉 없이 시도가 기준 횟수(운영 기준 unreachable_attempts · 간격 unreachable_interval_days)에 닿으면 연락두절 종결을 '제안'만 한다(자동 종결 없음).
        마스터 밖의 예전 값: 회신대기 = 보냈지만 답이 없는 것(접촉 아님 · 시도 횟수에도 안 넣음), 보류 · 거절 · 연락 완료 … = 대화가 있었던 것(접촉).
        예전 자료: 근거가 상태 이름 · 응대완료 시각뿐인 문의는 응대한 것으로 그대로 둔다. 응대내용이 부재류뿐일 때만 시도로 본다.
     ⑥ 대표회의(meeting_date)와 자료 회신 기한(reply_due)은 다른 값 — 대표회의 D-3 판정은 대표회의 날짜만 본다.
     ⑦ 전화 응대자 = phone_handler 한 칸(시트 열 '전화응대자' · 예전 화면 저장 이름 '전화 응대자'를 같이 읽는다).
   InquiryCommand = 저장(쓰기). 화면은 run(type, 문의, 값)만 부른다 — 화면이 숨은 입력칸을 만들어 예전 함수를 돌려 부르지 않는다.
     contact_log · memo · field_set · schedule_set. 서버 전송 계층(operational-overlay)이 화면 칸에서 값을 읽는 부분은 이 파일 안(withFields)에서만 잠깐 만든다.
   서버: sql/inquiry-flow-v1-20261005.sql (crm_inquiry_command_v1 · crm_inquiry_flow_list_v1). 설치 전에는 이 PC 의 기록만으로 같은 판정을 하고, 보낼 기록은 모아 두었다가 설치 뒤 보낸다.
   끄기: G.inqFlowOff=true → 판정 · 저장 모두 예전 방식. */
(function(root){
 'use strict';
 const RPC='crm_inquiry_command_v1',LIST='crm_inquiry_flow_list_v1',DAY=864e5,OUT_KEY='crm.inqFlow.outbox.v1';
 const RESULT=Object.freeze({attempt:Object.freeze(['부재','통화불가','번호오류']),connected:Object.freeze(['연결됨','고객 회신','검토중','자료요청','견적요청'])});
 const OLD=Object.freeze({wait:Object.freeze(['회신대기']),connected:Object.freeze(['보류','거절','연락 완료','대표회의 예정','재견적 요청','경쟁사 비교','계약 검토'])});
 /* 화면 칩 순서: 접촉 5 → 시도 3 */
 const RESULTS=Object.freeze(RESULT.connected.concat(RESULT.attempt));
 /* 결과 → 다음 행동 제안(행동 · 날짜) */
 const NEXT=Object.freeze({'연결됨':['다시 연락','3일 후'],'고객 회신':['다시 연락','3일 후'],'검토중':['다시 연락','7일 후'],'자료요청':['자료 확인','3일 후'],'견적요청':['견적 준비','3일 후'],'부재':['다시 연락','내일'],'통화불가':['다시 연락','내일'],'번호오류':['연락처 확인','내일'],'회신대기':['다시 연락','3일 후']});
 const CHANNELS=()=>(root.CRMRules&&root.CRMRules.get&&root.CRMRules.get('contact_channels'))||['전화','카카오','문자','이메일','방문','기타'];
 const on=()=>!(root.G&&root.G.inqFlowOff);
 const rule=(k,d)=>{try{const v=root.CRMRules&&root.CRMRules.get?root.CRMRules.get(k):null;return Number(v)>0?Number(v):d;}catch(e){return d;}};
 function kindOf(res){const r=String(res||'').trim();if(!r)return '';if(RESULT.attempt.includes(r))return 'attempt';if(RESULT.connected.includes(r))return 'connected';if(OLD.wait.includes(r))return 'wait';if(OLD.connected.includes(r))return 'connected';return '';}
 /* 기록 한 줄의 머리: "[전화 · 부재] 메모" 또는 "통화 결과: 부재 → 다음 연락 …" */
 const HEAD=/^\[(전화|카카오|문자|이메일|방문|기타) · ([^\]]+)\]\s*/,CALL=/^통화 결과:\s*([^→]+?)\s*(?:→|$)/;
 function readLine(text){const s=String(text||'');let m=HEAD.exec(s);if(m)return {ch:m[1],res:m[2].trim(),text:s.replace(HEAD,'')};m=CALL.exec(s);if(m)return {ch:'전화',res:m[1].trim(),text:''};return null;}
 const ATT_TXT=/부재|안 ?받|받지 ?않|통화 ?불가|연결 ?안 ?(됨|되)|번호 ?오류|없는 ?번호|결번/,CON_TXT=/통화 ?(함|완료|했|하였|됨|후)|상담|안내|설명|요청|방문|견적|검토|회신 ?(받|옴|함)|연결됨|예정|보내|발송|전달|확인/;
 const attemptOnly=t=>ATT_TXT.test(t)&&!CON_TXT.test(t);
 const tOf=v=>{const n=Date.parse(v||'');return Number.isFinite(n)?n:NaN;};
 const patchOf=q=>{try{return (root.itemPatch&&root.itemPatch(q,'inq'))||{};}catch(e){return {};}};
 /* 활동 한 줄 → 고객 접점 기록(없으면 null). 내부 메모 · 시스템 기록은 접점이 아니다 */
 function logOf(a){
  if(!a||a.type==='체크')return null;const at=a.at||a.occurred_at||a.created_at;if(!Number.isFinite(tOf(at)))return null;
  if(a.flow&&a.flow.kind)return {at,ch:a.flow.ch||'전화',res:a.flow.res||'',kind:a.flow.kind,rid:a.flow.rid||''};
  const type=String(a.type||''),note=String(a.note||''),result=String(a.result||''),line=readLine(result)||readLine(note);
  if(line)return {at,ch:line.ch,res:line.res,kind:kindOf(line.res)||'connected'};
  if(/^고객 응대 기록/.test(note)&&result)return {at,ch:'전화',res:'',kind:attemptOnly(result)?'attempt':'connected'};
  if(/전화|통화/.test(type))return {at,ch:'전화',res:'',kind:attemptOnly(note+' '+result)?'attempt':'connected'};
  if(/문자|SMS|카카오|메일|메시지/i.test(type))return {at,ch:/카카오/.test(type)?'카카오':/메일/.test(type)?'이메일':'문자',res:'회신대기',kind:'wait'};
  if(/방문/.test(type))return {at,ch:'방문',res:'연결됨',kind:'connected'};
  return null;
 }
 /* ── 서버 흐름 상태(문의 id → 상태) ── */
 const SRV=new Map();let SV=0,loadAt=0,loadBusy=false,loadedOk=false;/* loadedOk = 서버 흐름 함수가 실제로 응답함(설치 확인) */
 const store=()=>root.OpsStore;
 const can=name=>{try{return !!store()&&store().has(name);}catch(e){return false;}};
 const server=q=>SRV.get(String(q&&q.id||''))||null;
 function take(s){if(!s||!s.inquiry_id)return;SRV.set(String(s.inquiry_id),s);SV++;}
 function load(force){
  if(!on()||loadBusy||!can(LIST))return Promise.resolve(false);if(!force&&loadAt&&Date.now()-loadAt<120000)return Promise.resolve(false);
  loadBusy=true;
  return store().rpc(LIST,{}).then(r=>{loadAt=Date.now();loadedOk=true;const next=new Map();(r.states||[]).forEach(s=>{if(s&&s.inquiry_id)next.set(String(s.inquiry_id),s);});
   const sig=m=>JSON.stringify([...m.entries()].map(([k,v])=>[k,v.updated_at]).sort());
   if(sig(next)!==sig(SRV)){SRV.clear();next.forEach((v,k)=>SRV.set(k,v));SV++;try{root.paint();}catch(e){}}return true;})
   .catch(()=>{loadAt=Date.now();return false;}).finally(()=>{loadBusy=false;});
 }
 function warm(){if(!on()||!root.ME)return;if(!loadAt||Date.now()-loadAt>120000)load();flush();}
 /* ── 판정 ── */
 function logs(q){
  const p=patchOf(q),seen=new Set(),out=[];
  [].concat(q.activities||[],p.activities||[]).forEach(a=>{const k=a.id||[a.at,a.type,a.note,a.result].join('|');if(seen.has(k))return;seen.add(k);const l=logOf(a);if(l)out.push(l);});
  const S=server(q),rids=new Set(out.map(l=>l.rid).filter(Boolean));
  if(S&&Array.isArray(S.logs))S.logs.forEach(l=>{if(l.request_id&&rids.has(String(l.request_id)))return;out.push({at:l.occurred_at,ch:l.channel,res:l.result,kind:l.kind,rid:String(l.request_id||''),who:l.actor_name||'',text:l.content||'',next:l.next_action||'',server:true});});
  return out.sort((a,b)=>tOf(a.at)-tOf(b.at));
 }
 /* 예전 방식의 '응대함' 근거(상태 이름 · 응대 시각) */
 const legacyResponded=q=>{const s=String(q.status||'접수');return ['접수','신규','담당자 배정','배정완료',''].indexOf(s)<0||!!(q.firstActivity||q.first_activity||q.respondedAt||q.responded_at);};
 const sheetText=q=>{const r=q.raw&&typeof q.raw==='object'?q.raw:{};return String(r['응대내용']||'').trim();};
 const memo=new WeakMap();
 function state(q){
  if(!q||typeof q!=='object')return {firstAttemptAt:'',firstConnectedAt:'',attempts:0,spaced:0,unreachable:false,logs:[]};
  const p=patchOf(q),sig=[(q.activities||[]).length,(p.activities||[]).length,q.status,q.first_response_at,q.responded_at,q.respondedAt,p.firstResponseAt,q.lastActivity,SV].join('|'),c=memo.get(q);
  if(c&&c.sig===sig)return c.v;
  const S=server(q),L=logs(q),min=(a,b)=>!a?b||'':!b?a:(tOf(a)<=tOf(b)?a:b);
  let fa=S&&S.first_attempt_at||'',fc=S&&S.first_connected_at||'';
  L.forEach(l=>{if(l.kind==='attempt')fa=min(fa,l.at);else if(l.kind==='connected')fc=min(fc,l.at);});
  /* 예전 최초응대 시각: 그 시각의 기록이 시도면 시도로, 아니면 접촉으로. 서버가 이미 나눠 옮긴 문의(migrated)는 서버 값이 기준 */
  const stamp=q.responded_at||q.respondedAt||q.first_response_at||p.firstResponseAt||'';
  if(stamp&&!(S&&S.migrated)){const near=L.find(l=>Math.abs(tOf(l.at)-tOf(stamp))<5000),k=near?near.kind:(attemptOnly(sheetText(q))?'attempt':'connected');if(k==='attempt')fa=min(fa,stamp);else if(k==='connected')fc=min(fc,stamp);}
  if(!fc&&!stamp){const R=q.responses||[];
   if(R.length)fc=R[0].at||R[0].created_at||(root.inquiryDate?root.inquiryDate(q):'')||'';
   else if(legacyResponded(q)){const t=q.lastActivity||q.updated||(root.inquiryDate?root.inquiryDate(q):'')||'';if(attemptOnly(sheetText(q)))fa=min(fa,t);else fc=t;}}
  /* 접촉 없이 한 시도 수 · 간격을 지킨 시도 수(연락두절 제안 기준) */
  const fcT=fc?tOf(fc):Infinity,A=L.filter(l=>l.kind==='attempt'&&tOf(l.at)<fcT);let n=A.length;if(!fc&&S&&Number(S.attempt_count)>n)n=Number(S.attempt_count);
  const gap=rule('unreachable_interval_days',1),dayNo=t=>{const d=new Date(t);d.setHours(0,0,0,0);return Math.round(d.getTime()/DAY);};let spaced=0,last=-Infinity;
  A.forEach(l=>{const d=dayNo(tOf(l.at));if(d-last>=gap){spaced++;last=d;}});if(!A.length&&n)spaced=n;
  const v={firstAttemptAt:fa,firstConnectedAt:fc,attempts:n,spaced,unreachable:!fc&&spaced>=rule('unreachable_attempts',3),logs:L,server:S};
  memo.set(q,{sig,v});return v;
 }
 const firstConnectedAt=q=>{warm();return state(q).firstConnectedAt||'';};
 const firstAttemptAt=q=>state(q).firstAttemptAt||'';
 const attempts=q=>state(q).attempts;
 /* 목록 · 상세에 붙이는 한마디: 접촉 전 시도가 있을 때만 */
 function attemptNote(q){if(!on())return '';const v=state(q);return !v.firstConnectedAt&&v.attempts?'시도 '+v.attempts+'회'+(v.unreachable?' · 연락두절 종결 제안':''):'';}
 const parseDate=v=>{const s=String(v||'').trim();let m=/(\d{4})[.\-\/](\d{1,2})[.\-\/](\d{1,2})/.exec(s);if(m)return new Date(+m[1],+m[2]-1,+m[3]);m=/^(\d{1,2})[.\/](\d{1,2})$/.exec(s);if(m)return new Date(new Date().getFullYear(),+m[1]-1,+m[2]);return null;};
 function meetingDate(q){const S=server(q),d=q.detail&&typeof q.detail==='object'?q.detail:{},r=q.raw&&typeof q.raw==='object'?q.raw:{};return [S&&S.meeting_date,d.meetingDate,d.meeting_date,r['대표회의'],r['대표회의 일정']].map(parseDate).filter(Boolean)[0]||null;}
 function replyDue(q){const S=server(q),d=q.detail&&typeof q.detail==='object'?q.detail:{},r=q.raw&&typeof q.raw==='object'?q.raw:{};return [S&&S.reply_due,d.replyDue,d.reply_due,r['자료 회신 기한']].map(parseDate).filter(Boolean)[0]||null;}
 function phoneHandler(q){const S=server(q),d=q.detail&&typeof q.detail==='object'?q.detail:{},r=q.raw&&typeof q.raw==='object'?q.raw:{};return [S&&S.phone_handler,r.phone_handler,d.responder,r['전화응대자'],r['전화 응대자']].map(v=>String(v==null?'':v).trim()).find(v=>v&&v!=='-')||'';}
 root.InquiryFlow={on,RESULT,OLD,RESULTS,NEXT,CHANNELS,kindOf,readLine,logOf,logs,state,firstConnectedAt,firstAttemptAt,attempts,attemptNote,meetingDate,replyDue,phoneHandler,legacyResponded,server,load,take,RPC,LIST,
  _reset(){SRV.clear();SV++;loadAt=0;}};

 /* ── 저장 명령 ── */
 const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
 const uuid=()=>{try{return crypto.randomUUID();}catch(e){return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g,c=>{const r=Math.random()*16|0;return (c==='x'?r:(r&3|8)).toString(16);});}};
 const meName=()=>{try{const n=root.repN(root.ME&&root.ME.name);return n&&n!=='미배정'?n:'';}catch(e){return '';}};
 const patchFor=q=>{try{if(typeof root.detailPatchFor==='function')return root.detailPatchFor('inq',root.inqKey(q));}catch(e){}return root.itemPatch(q,'inq');};
 const saveLocal=()=>{try{root.saveLocal&&root.saveLocal();}catch(e){}};
 /* 서버 전송 계층(operational-overlay)은 단계 진행 · 다음 할 일의 값을 화면 칸(id)에서 읽는다. 그 칸은 여기서만 잠깐 만들고(이미 있으면 값만 잠깐 바꾸고) 되돌린다 */
 function withFields(map,fn){
  const made=[],back=[];
  Object.keys(map).forEach(id=>{const had=document.getElementById(id);if(had){const old=had.value;had.value=map[id];back.push(()=>{had.value=old;});}else{const el=document.createElement('input');el.id=id;el.hidden=true;el.value=map[id];document.body.append(el);made.push(el);}});
  try{return fn();}finally{made.forEach(el=>el.remove());back.forEach(f=>f());}
 }
 const FIRST_DONE='전화응대 완료',PRE=['접수','신규','담당자 배정','배정완료',''];
 /* 첫 접촉 전인가(상태가 이미 전화응대 완료면 단계 진행을 다시 보내지 않는다 — 서버가 충돌로 거절한다) */
 const isFirst=q=>!root.inqCtlFirstResponseAt(q)&&String(q&&q.status||'')!==FIRST_DONE;
 /* 접촉을 저장할 때 단계 진행(→ 전화응대 완료)이 필요한가: 상태가 아직 응대 전이고 서버에 응대 시각도 없을 때. 배정 전에 남긴 접촉 기록이 있어도 상태는 여기서 올린다.
    이미 응대한 문의(응대 시각이 있는데 상태 이름만 그대로인 것 포함)의 후속 연락은 상태를 건드리지 않는다 — 다음 할 일만 다시 잡는다(2026-10-04) */
 const needsProgress=q=>PRE.includes(String(q&&q.status||''))&&!(q.responded_at||q.respondedAt||q.first_response_at);
 /* 다음 할 일만 다시 잡는다(상태는 그대로) */
 function nextSet(q,text,due){
  if(typeof root.applyInqBulkAction!=='function')throw Error('다음 할 일 저장 연결을 확인해 주세요.');
  const key=root.inqKey(q),keepSel=root.INQ_SEL,keepMode=root.G.inqBulkMode,keepNotice=root.G.inqNotice;let ok=false;root.INQ_SEL={[key]:true};
  try{ok=withFields({inqActText:text,inqActDue:due},()=>root.applyInqBulkAction()===true);}finally{root.INQ_SEL=keepSel||{};root.G.inqBulkMode=keepMode;root.G.inqNotice=keepNotice;}
  return ok;
 }
 /* 서버로 보낼 흐름 기록: 모아 두고 차례로 보낸다(설치 전 · 연결이 끊긴 동안에도 이 PC 의 판정은 그대로 동작) */
 let OUT=null,flushing=false;
 const outbox=()=>{if(OUT)return OUT;try{OUT=JSON.parse(root.localStorage.getItem(OUT_KEY)||'[]');if(!Array.isArray(OUT))OUT=[];}catch(e){OUT=[];}return OUT;};
 const keepOut=()=>{try{root.localStorage.setItem(OUT_KEY,JSON.stringify(outbox().slice(-200)));}catch(e){}};
 function queue(body){outbox().push(Object.assign({queued_at:Date.now()},body));keepOut();flush();}
 async function flush(){
  if(flushing||!on()||!root.ME||!can(RPC)||!outbox().length)return;flushing=true;let changed=false;
  try{while(outbox().length){const item=outbox()[0];
    if(Date.now()-Number(item.queued_at||0)>14*DAY){outbox().shift();keepOut();continue;}
    const body=Object.assign({},item);delete body.queued_at;
    try{const r=await store().rpc(RPC,body);take(r.state);changed=true;outbox().shift();keepOut();}
    catch(e){if(e&&e.unavailable)break;if(/forbidden|invalid payload|담당자 또는 관리자만|찾을 수 없습니다|기술자문/.test(String(e&&e.message||''))){outbox().shift();keepOut();continue;}break;}}
  }finally{flushing=false;if(changed){try{root.paint();}catch(e){}}}
 }
 /* ① 응대 기록: 시도면 최초응대 · 단계는 그대로(다음 할 일만), 첫 접촉이면 단계 진행(접수 → 전화응대 완료), 그 뒤 접촉이면 다음 할 일만 */
 function contactLog(q,o){
  o=o||{};const did=String(o.did||'고객 응대 기록').trim();
  let ch=String(o.ch||'').trim(),res=String(o.result||'').trim(),text=String(o.text||'').trim(),line=String(o.line||'').trim();
  if(line){const r=readLine(line);if(r){ch=ch||r.ch;res=res||r.res;if(!text)text=r.text;}}
  ch=ch||'전화';if(!line){if(!res)throw Error('결과와 다음 행동일을 모두 넣어 주세요.');line=('['+ch+' · '+res+'] '+text).trim();}
  const kind=kindOf(res)||'connected',next=String(o.next||'').trim(),due=String(o.due||''),rid=uuid(),at=new Date().toISOString(),flow={ch,res,kind,rid},type=ch==='기타'?'전화':ch;
  const send=()=>{if(kindOf(res)&&UUID.test(String(q.id||'')))queue({type:'contact_log',inquiry_id:String(q.id),request_id:rid,channel:ch,result:res,content:text.slice(0,4000),next_action:next.slice(0,500),next_check_date:/^\d{4}-\d{2}-\d{2}$/.test(due)?due:'',occurred_at:at});};
  if(!root.inquiryAssigned(q)){/* 배정 전: 기록만(다음 할 일은 배정 뒤) */
   const p=patchFor(q);p.activities=p.activities||[];p.activities.push({id:'lg-'+Date.now(),type,note:line,result:'',at,actor:meName()||root.repN(q.assignee),flow});
   q.lastActivity=p.lastActivity=at;if(kind==='connected'){try{root.touchCustomer(p,type,at);}catch(e){}}saveLocal();send();return true;}
  if(!next||!/^\d{4}-\d{2}-\d{2}$/.test(due))throw Error('결과와 다음 행동일을 모두 넣어 주세요.');
  /* 전송 요청이 중간에 실패하면 이 PC 의 값도 되돌린다(반쯤 바뀐 채 남지 않게) */
  const p0=patchFor(q),before=JSON.parse(JSON.stringify(q)),beforeP=JSON.parse(JSON.stringify(p0));
  let ok=false;
  try{
   if(kind==='connected'&&needsProgress(q)){
    ok=withFields({'iq-did':did,'iq-res':line,'iq-next':next,'iq-due':due},()=>root.iqApply(q,'step:1')===true);
    if(ok){const A=patchOf(q).activities||[],last=A[A.length-1];if(last&&!last.flow)last.flow=flow;}
   }else{
    /* 다음 할 일 문장: 서버에 응대 기록 표가 있으면 행동만('다시 연락'), 아직 없으면 예전처럼 결과 줄을 붙여 둔다(다른 PC 에서도 결과가 보이게) */
    ok=nextSet(q,loadedOk&&can(RPC)?next.slice(0,500):(next+' — '+line).slice(0,500),due);
    if(ok){const p=patchFor(q);p.activities=p.activities||[];p.activities.push({id:'fu-'+Date.now(),type,note:did,result:line,at,actor:root.repN(q.assignee),flow});q.lastActivity=p.lastActivity=at;if(kind==='connected'){try{root.touchCustomer(p,type,at);}catch(e){}}}
   }
  }catch(e){Object.keys(q).forEach(k=>delete q[k]);Object.assign(q,before);Object.keys(p0).forEach(k=>delete p0[k]);Object.assign(p0,beforeP);throw e;}
  if(ok){saveLocal();send();}
  return ok;
 }
 /* 내부 메모: 응대 이력에 한 줄(고객 접점 아님 → 최초응대로 치지 않는다) */
 function memoLog(q,o){
  const text=String(o&&o.text||'').trim();if(!text)throw Error('내용을 입력해 주세요.');
  const p=patchFor(q),at=new Date().toISOString();p.activities=p.activities||[];p.activities.push({id:'mm-'+Date.now(),type:'기타',note:text,result:'',at,actor:meName()||root.repN(q.assignee)});
  q.lastActivity=p.lastActivity=at;try{root.touchCustomer(p,'기타',at);}catch(e){}saveLocal();return true;
 }
 /* 문의 정보 칸: 전화 응대자 = phone_handler, 대표회의 · 자료 회신 기한 = 일정(schedule_set), 그 밖 = 기존 칸 저장 함수. 서버가 확인한 값을 돌려준다 */
 const FIELD_RPC='crm_inquiry_field_update_v1';
 async function legacyField(q,field,value){
  const r=await root.SB.rpc(FIELD_RPC,{p:{inquiry_id:String(q.id),field,value}});
  if(r.error){if(r.error.code==='PGRST202')root.CRMRelease&&root.CRMRelease.noteMissing&&root.CRMRelease.noteMissing(FIELD_RPC);throw Error(r.error.message||'저장 실패');}
  if(!r.data||r.data.ok!==true)throw Error('서버 확인 응답이 올바르지 않습니다.');
  return {field,value:r.data.value||value,rawKey:r.data.raw_key||''};
 }
 async function fieldSet(q,o){
  const field=String(o&&o.field||''),value=String(o&&o.value||'').trim();if(!field||!value)throw Error('값을 입력해 주세요.');
  if(on()&&can(RPC)){
   try{
    if(field==='responder'||field==='phone_handler'){const r=await store().rpc(RPC,{type:'field_set',inquiry_id:String(q.id),field:'phone_handler',value});take(r.state);return {field:'responder',value,rawKey:'phone_handler'};}
    if(field==='meeting_date'||field==='reply_due'){const r=await store().rpc(RPC,{type:'schedule_set',inquiry_id:String(q.id),schedule_type:field==='meeting_date'?'meeting':'reply_due',at:value});take(r.state);return {field,value,rawKey:field==='meeting_date'?'대표회의':'자료 회신 기한'};}
   }catch(e){if(!(e&&e.unavailable))throw e;/* 새 함수가 아직 없으면 기존 칸 저장으로 */}
  }
  return legacyField(q,field==='phone_handler'?'responder':field,value);
 }
 const HANDLERS={contact_log:contactLog,memo:memoLog,field_set:fieldSet,schedule_set:(q,o)=>fieldSet(q,{field:o&&o.schedule_type==='reply_due'?'reply_due':'meeting_date',value:o&&o.at})};
 function run(type,q,payload){const fn=HANDLERS[type];if(!fn)throw Error('알 수 없는 저장 명령입니다: '+type);if(!q)throw Error('문의를 찾지 못했습니다.');return fn(q,payload||{});}
 root.InquiryCommand={run,isFirst,needsProgress,flush,types:()=>Object.keys(HANDLERS),_handlers:HANDLERS,_withFields:withFields,_nextSet:nextSet,_queue:queue,_outbox:outbox};
})(window);
