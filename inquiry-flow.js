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
     contact_log · memo · field_set · schedule_set · close · visit · quote_send. 서버 전송 계층(operational-overlay)이 화면 칸에서 값을 읽는 부분은 이 파일 안(withFields)에서만 잠깐 만든다.
     ② 종결 4종: Bad Fit · 연락두절 · 상담종결 · 스토어 이관 / B2B 협약 — 사유 필수 · 고르는 즉시 종결('배드핏 종결 검토' 같은 다음 할 일을 만들지 않는다). '다른 업체 선택'은 Bad Fit 이 아니라 상담종결.
     ④ 전환 기준 하나(isQualified): 1차 현장방문 완료 또는 견적 발송 완료 중 먼저 일어난 것. '예정'은 전환이 아니다.
     ⑤ 견적 = 버전(금액은 원). 금액을 다음 할 일 문장에 넣지 않는다. 보내면 후속 할 일 = 보낸 날 + 7일 '고객 반응 확인'(같은 날 할 일은 만들지 않는다).
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
 function kindOf(res){const r=String(res||'').trim();if(!r)return '';if(RESULT.attempt.includes(r))return 'attempt';if(RESULT.connected.includes(r))return 'connected';if(OLD.wait.includes(r))return 'attempt';/* 보냈지만 답이 없는 것(문자 · 카카오 회신대기) = 연락 시도(2026-10-05 design_handoff_inquiry_sms) — 접촉 · 최초 응대는 아니다 */if(OLD.connected.includes(r))return 'connected';return '';}
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
  if(/문자|SMS|카카오|메일|메시지/i.test(type))return {at,ch:/카카오/.test(type)?'카카오':/메일/.test(type)?'이메일':'문자',res:'회신대기',kind:'attempt'};
  if(/방문/.test(type))return {at,ch:'방문',res:'연결됨',kind:'connected'};
  return null;
 }
 /* ── 서버 흐름 상태(문의 id → 상태) ── */
 const SRV=new Map(),CLOSED=new Map();/* CLOSED = 문의 id → 서버의 종결 사유 글(기본 읽기는 이 칸을 내려 주지 않는다) */let SV=0,loadAt=0,loadBusy=false,loadedOk=false;/* loadedOk = 서버 흐름 함수가 실제로 응답함(설치 확인) */
 const store=()=>root.OpsStore;
 const can=name=>{try{return !!store()&&store().has(name);}catch(e){return false;}};
 const server=q=>SRV.get(String(q&&q.id||''))||null;
 function take(s){if(!s||!s.inquiry_id)return;SRV.set(String(s.inquiry_id),s);SV++;}
 function load(force){
  if(!on()||loadBusy||!can(LIST))return Promise.resolve(false);if(!force&&loadAt&&Date.now()-loadAt<120000)return Promise.resolve(false);
  loadBusy=true;
  return store().rpc(LIST,{}).then(r=>{loadAt=Date.now();loadedOk=true;const next=new Map();(r.states||[]).forEach(s=>{if(s&&s.inquiry_id)next.set(String(s.inquiry_id),s);});
   const sig=m=>JSON.stringify([...m.entries()].map(([k,v])=>[k,v.updated_at]).sort());
   const nc=new Map();(r.closed||[]).forEach(c=>{if(c&&c.inquiry_id&&c.close_reason)nc.set(String(c.inquiry_id),String(c.close_reason));});const csig=m=>JSON.stringify([...m.entries()].sort());
   if(sig(next)!==sig(SRV)||csig(nc)!==csig(CLOSED)){SRV.clear();next.forEach((v,k)=>SRV.set(k,v));CLOSED.clear();nc.forEach((v,k)=>CLOSED.set(k,v));SV++;try{root.paint();}catch(e){}}return true;})
   .catch(()=>{loadAt=Date.now();return false;}).finally(()=>{loadBusy=false;});
 }
 function warm(){if(!on()||!root.ME)return;if(!loadAt||Date.now()-loadAt>120000)load();flush();}
 /* ── 판정 ── */
 function logs(q){
  const p=patchOf(q),seen=new Set(),out=[];
  [].concat(q.activities||[],p.activities||[]).forEach(a=>{const k=a.id||[a.at,a.type,a.note,a.result].join('|');if(seen.has(k))return;seen.add(k);const l=logOf(a);if(l)out.push(l);});
  const S=server(q),rids=new Set(out.map(l=>l.rid).filter(Boolean));
  if(S&&Array.isArray(S.logs))S.logs.forEach(l=>{if(l.request_id&&rids.has(String(l.request_id)))return;out.push({at:l.occurred_at,ch:l.channel,res:l.result,kind:l.kind==='wait'?'attempt':l.kind,rid:String(l.request_id||''),who:l.actor_name||'',text:l.content||'',next:l.next_action||'',server:true});});
  return out.sort((a,b)=>tOf(a.at)-tOf(b.at));
 }
 /* 예전 방식의 '응대함' 근거(상태 이름 · 응대 시각) */
 const legacyResponded=q=>{const s=String(q.status||'접수');return ['접수','신규','담당자 배정','배정완료',''].indexOf(s)<0||!!(q.firstActivity||q.first_activity||q.respondedAt||q.responded_at);};
 const sheetText=q=>{const r=q.raw&&typeof q.raw==='object'?q.raw:{};return String(r['응대내용']||'').trim();};
 const memo=new WeakMap();
 /* 이 문의 줄에만 붙은 기록으로 본 판정. 화면은 state(q) 를 쓴다(같은 건의 연락을 합친 것) */
 function own(q){
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
 /* 판정(화면이 쓰는 것): 같은 현장 · 같은 브랜드의 다른 문의에 남긴 연락도 이 문의의 연락이다 — 이 문의가 접수된 뒤의 것만.
    (2026-10-05 정합성 ①: 재문의 줄 · 복제 줄에는 기록이 없어 한 현장이 줄마다 '기록 없음' / '첫 연락 9.21' 로 달랐다. 묶음 규칙은 ContactState) */
 function state(q){
  const o=own(q),CS=root.ContactState;if(!q||typeof q!=='object'||!CS||!CS.on()||!CS.siblings)return o;
  let sibs=[];try{sibs=CS.siblings(q)||[];}catch(e){}if(!sibs.length)return o;
  const rec=tOf(q.received_at||q.at||q.created_at||q.created||'')-60000,after=at=>!!at&&!(tOf(at)<rec),min=(a,b)=>!a?b||'':!b?a:(tOf(a)<=tOf(b)?a:b);
  let fa=o.firstAttemptAt,fc=o.firstConnectedAt,add=[];
  sibs.forEach(s=>{const v=own(s);if(after(v.firstAttemptAt))fa=min(fa,v.firstAttemptAt);if(after(v.firstConnectedAt))fc=min(fc,v.firstConnectedAt);
   v.logs.forEach(l=>{if(!after(l.at))return;add.push(Object.assign({},l,{sibling:String(s.id||'')}));if(l.kind==='attempt')fa=min(fa,l.at);else if(l.kind==='connected')fc=min(fc,l.at);});});
  if(fa===o.firstAttemptAt&&fc===o.firstConnectedAt&&!add.length)return o;
  const L=o.logs.concat(add).sort((a,b)=>tOf(a.at)-tOf(b.at)),fcT=fc?tOf(fc):Infinity,A=L.filter(l=>l.kind==='attempt'&&tOf(l.at)<fcT);
  let n=A.length;if(!fc&&o.attempts>n)n=o.attempts;
  const gap=rule('unreachable_interval_days',1),dayNo=t=>{const d=new Date(t);d.setHours(0,0,0,0);return Math.round(d.getTime()/DAY);};let spaced=0,last=-Infinity;
  A.forEach(l=>{const d=dayNo(tOf(l.at));if(d-last>=gap){spaced++;last=d;}});if(!A.length&&n)spaced=n;
  return {firstAttemptAt:fa,firstConnectedAt:fc,attempts:n,spaced,unreachable:!fc&&spaced>=rule('unreachable_attempts',3),logs:L,server:o.server,merged:true};
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
 /* ② 종결 4종. Bad Fit 사유 = 운영 기준(설정 화면의 'Bad Fit 사유' · CRMRules.reasons('bad_fit')) — 여기 목록은 그 기준을 못 읽을 때만 쓴다. 스토어 이관 · B2B 협약은 기존 전용 처리로 넘긴다 */
 const CLOSE=Object.freeze({
  bad_fit:Object.freeze({label:'Bad Fit',status:'배드핏',reasons:Object.freeze(['수행불가 공종','규모 부적합','대상 고객 아님','서비스 범위 아님','기타'])}),
  unreachable:Object.freeze({label:'연락두절',status:'연락두절',reasons:Object.freeze([])}),
  consult_end:Object.freeze({label:'상담종결',status:'종결',reasons:Object.freeze(['계획 없음','단순 문의','타사 선택'])}),
  transfer:Object.freeze({label:'스토어 이관 / B2B 협약',status:'',reasons:Object.freeze(['POUR스토어','B2B 협약'])})});
 /* 종결 사유 글: 문의에 실려 온 값, 없으면 서버에서 따로 읽은 값 */
 const closeReasonText=q=>String(q&&q.close_reason||CLOSED.get(String(q&&q.id||''))||'').trim();
 function closeReasons(kind){const C=CLOSE[kind];if(!C)return [];if(kind==='bad_fit'){try{const l=root.CRMRules&&root.CRMRules.reasons&&root.CRMRules.reasons('bad_fit');if(Array.isArray(l)&&l.length)return l.slice();}catch(e){}}return C.reasons.slice();}
 /* 닫힌 문의의 종결 종류(닫히지 않았으면 null). 예전 자료는 상태 · 사유 글에서 읽고, 읽히지 않으면 other(사유 있음) · unknown(사유 미기록) */
 function closeOf(q){
  if(!q)return null;const S=server(q),s=String(q.status||''),r=closeReasonText(q),mk=(kind,reason,detail)=>({kind,label:(CLOSE[kind]||{}).label||(kind==='other'?'종결':'종결 · 사유 미기록'),reason:String(reason||'').trim(),detail:String(detail||'').trim()});
  if(/스토어|자재|미구매/.test(s))return mk('transfer','POUR스토어');
  let agreement=false;try{agreement=!!(root.inqNoTrack&&root.inqNoTrack(q));}catch(e){}
  if(['협약완료','해결완료'].includes(s)||/^협약 종결/.test(r)||(agreement&&['종결','종료'].includes(s)))return mk('transfer','B2B 협약');
  if(!['배드핏','연락두절','종결','종료'].includes(s))return null;
  if(S&&S.close_kind&&CLOSE[S.close_kind])return mk(S.close_kind,S.close_reason,S.close_detail);
  let m=/연락두절 · (시도 \d+회)/.exec(r);if(s==='연락두절'||m)return mk('unreachable',m?m[1]:'');
  m=/Bad Fit · ([^—·]+)/.exec(r)||/배드핏[^·]*·\s*([^—·]+)/.exec(r);if(s==='배드핏'||m)return mk('bad_fit',m?m[1]:'');
  m=/상담종결 · ([^—·]+)/.exec(r);if(m)return mk('consult_end',m[1]);
  if(/^상담만 종결/.test(r))return mk('consult_end','상담만');
  return r?mk('other',r.replace(/ · 이전 상태:.*$/,'').slice(0,60)):mk('unknown','');
 }
 /* ④ 전환 기준(하나): 1차 현장방문 완료 또는 견적 발송 완료 중 먼저 일어난 것 */
 const QUALIFY_TEXT='1차 현장방문 완료 또는 견적 발송 완료 중 먼저 → 파이프라인 전환';
 const Q_STATUS=/견적.*발송\s*완료|현장\s*방문\s*완료/;
 const statusQualifies=s=>Q_STATUS.test(String(s||''));
 function qualifiedBy(q){
  if(!q)return '';const S=server(q),p=patchOf(q),s=String(q.status||''),v=S&&S.visit_done_at||p.visitDoneAt||'',qs=S&&S.quote_sent_at||p.quoteSentAt||'';
  if(v&&qs)return tOf(v)<=tOf(qs)?'visit_done':'quote_sent';if(v)return 'visit_done';if(qs)return 'quote_sent';
  return /견적.*발송\s*완료/.test(s)?'quote_sent':/현장\s*방문\s*완료/.test(s)?'visit_done':'';
 }
 const isQualified=q=>!!qualifiedBy(q);
 /* ⑤ 견적 버전(서버 것이 있으면 서버, 없으면 이 PC 에 적어 둔 것) · 예전 다음 할 일 문장 속 금액 읽기 */
 function quotes(q){const S=server(q),p=patchOf(q),L=S&&Array.isArray(S.quotes)&&S.quotes.length?S.quotes:(Array.isArray(p.quoteVersions)?p.quoteVersions:[]);return L.slice().sort((a,b)=>Number(a.version_no)-Number(b.version_no));}
 const parseQuoteText=t=>{const m=/예상\s*([0-9,]+)\s*만원/.exec(String(t||''));return m?Number(m[1].replace(/,/g,''))*10000:0;};
 root.InquiryFlow={on,RESULT,OLD,RESULTS,NEXT,CHANNELS,kindOf,readLine,logOf,logs,state,own,firstConnectedAt,firstAttemptAt,attempts,attemptNote,meetingDate,replyDue,phoneHandler,legacyResponded,server,load,take,RPC,LIST,
  CLOSE,closeReasons,closeReasonText,closeOf,QUALIFY_TEXT,statusQualifies,qualifiedBy,isQualified,quotes,parseQuoteText,
  _reset(){SRV.clear();CLOSED.clear();SV++;loadAt=0;}};

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
 /* ② 종결: Bad Fit · 연락두절 · 상담종결 — 서버가 확인한 뒤에만 화면에 반영한다. 새 함수가 아직 없으면 기존 종결 함수로(사유 글머리에 종류를 남긴다) */
 async function closeInquiry(q,o){
  o=o||{};const kind=String(o.kind||''),C=CLOSE[kind];if(!C||kind==='transfer')throw Error('종결 종류를 골라 주세요.');
  let reason=String(o.reason||'').trim();const detail=String(o.detail||'').trim(),v=state(q);
  if(kind==='unreachable'){if(v.firstConnectedAt)throw Error('이미 접촉한 문의입니다 — 상담종결로 처리해 주세요.');if(!v.attempts)throw Error('연락 시도 기록이 없습니다.');reason='시도 '+v.attempts+'회';}
  else{if(!closeReasons(kind).includes(reason))throw Error(C.label+' 사유를 골라 주세요.');if(reason==='기타'&&!detail)throw Error('기타 사유는 메모에 적어 주세요.');}
  if(root.inqCtlConverted(q))throw Error('영업건으로 전환된 문의는 영업건에서 처리합니다.');
  if(!root.SB||typeof root.SB.rpc!=='function')throw Error('로그인 상태에서만 종결할 수 있습니다.');
  const from=q.status||'접수';let status=C.status,closeReason=C.label+' · '+reason+(detail?' — '+detail:''),at='',done=false;
  if(on()&&can(RPC)){try{const r=await store().rpc(RPC,{type:'close',inquiry_id:String(q.id),kind,reason:kind==='unreachable'?'':reason,detail,attempts:v.attempts});take(r.state);status=r.status||status;closeReason=r.close_reason||closeReason;at=r.server_at||'';done=true;}catch(e){if(!(e&&e.unavailable))throw e;}}
  if(!done){
   const text=kind==='bad_fit'?'배드핏(부적합) · '+reason+(detail?' — '+detail:''):closeReason,r=await root.SB.rpc('crm_inquiry_close_v1',{p:{inquiry_id:String(q.id||root.inqKey(q)),reason:text,kind:'기타'}});
   if(r.error)throw Error(r.error.message||'저장 실패');if(!r.data||r.data.ok!==true)throw Error('서버 확인 응답이 올바르지 않습니다.');
   status='종결';closeReason=r.data.close_reason||('기타 종결 — '+text);at=r.data.closed_at||'';
  }
  const p=patchFor(q);at=at||new Date().toISOString();q.status=p.status=status;q.close_reason=p.close_reason=closeReason;q.next_action_date=p.next_action_date=null;
  p.activities=p.activities||[];p.activities.push({id:'cl-'+Date.now(),type:'상태변경',note:from+' → '+C.label+' 종결('+reason+')',result:detail,at,actor:(root.inqCtlActor?root.inqCtlActor():meName())});
  saveLocal();return {kind,label:C.label,reason,status};
 }
 /* ④ ⑤ 다음 단계 */
 const pad2=n=>String(n).padStart(2,'0'),dayOf=d=>d.getFullYear()+'-'+pad2(d.getMonth()+1)+'-'+pad2(d.getDate()),todayStr=()=>dayOf(new Date()),plusDays=(ymd,n)=>{const d=new Date(ymd+'T00:00:00');d.setDate(d.getDate()+n);return dayOf(d);};
 function setStatus(q,to){const from=q.status||'접수';if(to===from)return;const p=patchFor(q),at=new Date().toISOString();q.status=p.status=to;q.lastActivity=p.lastActivity=at;p.activities=p.activities||[];p.activities.push({type:'상태변경',note:from+' → '+to,result:'',at,actor:meName()||'관리자'});}
 /* 전환 기준을 채웠으면 그 자리에서 파이프라인으로(기존 전환 경로 autoPromote — 현장 · 브랜드 · 담당 · 문의 연결을 그대로 넘긴다) */
 function promote(q){if(!isQualified(q)||root.inqCtlConverted(q)||typeof root.autoPromote!=='function')return '';return String(root.autoPromote(q)||'');}
 function localNext(q,text,due,id){const p=patchFor(q);p.nextActionObj={id:id||('na-'+Date.now()),type:'전화',text,due,status:'open'};q.nextActionText=p.nextActionText=text;q.nextAction=p.nextAction=due;}
 /* 1차 현장방문: 일정(예정) = 상태 + 그날 할 일 / 완료 = 전환 기준 충족 → 파이프라인 */
 async function visit(q,o){
  o=o||{};const date=String(o.date||''),time=String(o.time||''),done=!!o.done,today=todayStr();
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date))throw Error('방문 날짜를 넣어 주세요.');
  if(done&&date>today)throw Error('방문 완료는 오늘까지의 날짜로 적어 주세요.');
  if(on()&&can(RPC)&&UUID.test(String(q.id||''))){try{const r=await store().rpc(RPC,{type:'visit',inquiry_id:String(q.id),date,time,done});take(r.state);}catch(e){if(!(e&&e.unavailable))throw e;}}
  if(done){const p=patchFor(q);p.visitDoneAt=p.visitDoneAt||new Date(date+'T'+(time||'12:00')+':00').toISOString();setStatus(q,'현장방문 완료');saveLocal();
   /* 전환 요청은 서버가 '현장방문 완료' 상태를 받는 것이 확인된 뒤에만 보낸다(같은 SQL 이 흐름 함수와 전환 조건을 함께 설치한다). 그 전에는 저장만 — 전환 대기 목록에 남는다 */
   const ready=loadedOk&&can(RPC),msg=ready?promote(q):'서버 적용 뒤 전환 대기 목록에서 파이프라인으로 넘길 수 있습니다';saveLocal();return {done:true,promoted:!!root.inqCtlConverted(q),label:'1차 현장방문 완료',msg};}
  if(date>=today&&root.inquiryAssigned(q)&&nextSet(q,'현장방문'+(time?' '+time:''),date)!==true)throw Error('다음 할 일을 저장하지 못했습니다.');
  setStatus(q,'현장방문예정');saveLocal();return {done:false,promoted:false,label:'현장방문 일정',msg:''};
 }
 /* 견적: 금액은 견적 버전으로(원). 발송 완료 = 후속 할 일(보낸 날 + 7일 · 고객 반응 확인) + 전환 / 발송 예정 = 상태 + 발송일 할 일(금액이 있으면 초안 버전) */
 async function quoteSend(q,o){
  o=o||{};const amount=Math.round(Number(o.amount||0))||0,sent=!!o.sent,today=todayStr(),date=/^\d{4}-\d{2}-\d{2}$/.test(String(o.date||''))?String(o.date):'';
  if(sent&&!(amount>0))throw Error('보낸 견적 금액을 넣어 주세요.');
  if(sent&&date&&date>today)throw Error('보낸 날은 오늘까지의 날짜로 적어 주세요.');
  if(!sent&&!(amount>0)&&!date)throw Error('견적 금액이나 발송 예정일을 넣어 주세요.');
  const sentDay=sent?(date||today):'',sentAt=sent?(sentDay===today?new Date().toISOString():new Date(sentDay+'T12:00:00').toISOString()):'',p=patchFor(q);let srv=null;
  if(amount>0&&on()&&can(RPC)&&UUID.test(String(q.id||''))){
   try{srv=await store().rpc(RPC,{type:'quote_send',inquiry_id:String(q.id),request_id:uuid(),amount,draft:!sent,sent_at:sentAt,method:String(o.method||''),file_name:String(o.file||''),change_reason:String(o.reason||''),recipient:o.recipient||null});take(srv.state);}
   catch(e){if(!(e&&e.unavailable))throw e;srv=null;}}
  if(amount>0&&!srv){const L=p.quoteVersions=Array.isArray(p.quoteVersions)?p.quoteVersions:[],last=L[L.length-1];
   if(last&&!last.sent_at)Object.assign(last,{amount,sent_at:sentAt||null,author_name:meName()});else L.push({version_no:L.length+1,amount,sent_at:sentAt||null,method:String(o.method||''),change_reason:String(o.reason||''),author_name:meName(),created_at:new Date().toISOString()});}
  if(!sent){
   if(date&&date>=today&&root.inquiryAssigned(q)&&nextSet(q,'견적서 발송',date)!==true)throw Error('다음 할 일을 저장하지 못했습니다.');
   setStatus(q,'견적서 발송예정');saveLocal();return {sent:false,promoted:false,label:'견적서 발송 예정',msg:''};
  }
  p.quoteSentAt=p.quoteSentAt||sentAt;
  const follow=srv&&srv.next_action_date?String(srv.next_action_date).slice(0,10):(()=>{const f=plusDays(sentDay,7);return f>today?f:plusDays(today,1);})();
  if(srv&&srv.next_action_id)localNext(q,'고객 반응 확인',follow,srv.next_action_id);
  else if(root.inquiryAssigned(q)){try{nextSet(q,'고객 반응 확인',follow);}catch(e){}}
  setStatus(q,'견적서 발송완료');saveLocal();const msg=promote(q);saveLocal();
  return {sent:true,promoted:!!root.inqCtlConverted(q),label:'견적서 발송 완료',follow,msg};
 }
 const HANDLERS={contact_log:contactLog,memo:memoLog,field_set:fieldSet,schedule_set:(q,o)=>fieldSet(q,{field:o&&o.schedule_type==='reply_due'?'reply_due':'meeting_date',value:o&&o.at}),close:closeInquiry,visit,quote_send:quoteSend,next_set:(q,o)=>nextSet(q,String(o&&o.text||'').slice(0,500),String(o&&o.due||''))};/* next_set = 다음 할 일만(문자 예약 알림) */
 function run(type,q,payload){const fn=HANDLERS[type];if(!fn)throw Error('알 수 없는 저장 명령입니다: '+type);if(!q)throw Error('문의를 찾지 못했습니다.');return fn(q,payload||{});}
 root.InquiryCommand={run,isFirst,needsProgress,flush,types:()=>Object.keys(HANDLERS),_handlers:HANDLERS,_withFields:withFields,_nextSet:nextSet,_queue:queue,_outbox:outbox};
})(window);
