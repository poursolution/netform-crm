/* CRM 운영 기준 — 한곳(공통 설정 · 계산 함수). 2026-10-04 design_handoff_rules/README.md · rules.json
   모든 화면은 여기 값과 함수로 메이드율 · 수주실적 · 놓침을 계산한다. 화면마다 기준을 따로 두지 않는다.
   상태: 확정(fix) = 회의 확정 · 잠금 / 조건부(cond) = 관리자 설정(운영 기준 설정 화면)에서 바꿈 / 보류(hold) = 구현하지 않음(자리만).
   저장: 조건부 값만 서버(crm_ops_rules_v1 → crm_settings 'ops_rules')에 두고, 바꿀 때마다 변경 이력(누가 · 언제 · 전 → 후)이 남는다.
   서버 함수가 아직 없으면 기본값(rules.json)으로 동작한다. 값이 바뀌면 예전 화면들이 읽는 OPS_RULES 에도 같은 값을 넣어 준다(sync).
   결과 구분: 자사 수주(won_own) · 타사 이관 수주 = 승인된 것만(won_transfer) · 파이프라인 실주(lost) · Bad Fit(bad_fit) · 진행 중(in_progress) · 낙찰결과 대기(transfer_pending)
   메이드율 = (자사 수주 + 승인 타사 이관 수주) ÷ (자사 수주 + 승인 타사 이관 수주 + 파이프라인 실주) — Bad Fit · 진행 중 · 낙찰결과 대기는 계산에서 뺀다.
   수주실적 = 최종 낙찰금액(VAT 별도). 자사 · 타사 이관은 화면에서 나눠 보여 주고 총 영업실적에서는 합산한다. */
(function(root,factory){const api=factory(root);if(typeof module==='object'&&module.exports)module.exports=api;else root.CRMRules=api;})(typeof window!=='undefined'?window:globalThis,function(root){
 'use strict';
 const VERSION='2026-10-04',RPC='crm_ops_rules_v1';
 /* rules.json 과 같은 기본값 */
 const DEFAULTS=Object.freeze({
  assign_minutes:30,first_contact_hours:2,unreachable_attempts:3,unreachable_interval_days:1,inactive_days:7,quote_followup_days:7,next_action_required:true,
  care_focus_months:1,care_general_months:3,long_wait_contact_days:60,transfer_result_check_days:14,
  split_own_transfer:true,
  reasons_bad_fit:Object.freeze(['수행 불가 공종','규모 부적합','시공 불가 지역','기타']),
  reasons_lost:Object.freeze(['가격','관리소장 변경','타 공법 선호','경쟁사 관계','예산','공사 취소','기타']),
  reasons_transfer:Object.freeze(['영업권 조율','영업권 중복','안전 · 시공조건','파트너사 협업','시공역량 문제','기타']),
  contact_channels:Object.freeze(['전화','카카오','문자','이메일','방문','기타']),
  owner_change_log:true,manager_change_is_event:true,relationship_follows_person:true,duplicate_lead_warning:true,
  auto_owner_attribution:true,owner_keep_on_reassign:true,dashboard_public:true,
  nearby_map:true,nearby_radius_km:3,year_management:true,year_required_on_convert:true,year_future_skip_focus:true,
  content_followup:false});
 /* 설정 화면 · 서버 검증이 같이 보는 항목표. k = 값 열쇠, st = fix | cond | hold */
 const N=(k,l,d,st,unit,step,min,max)=>({k,l,d,st,type:'num',unit,step,min,max}),T=(k,l,d,st)=>({k,l,d,st,type:'tg'}),C=(k,l,d,st)=>({k,l,d,st,type:'chips'}),X=(l,d,st,text)=>({k:'',l,d,st,type:'text',text});
 const SECTIONS=[
  ['time','시간 기준','넘기면 오늘 업무 · 컨트롤타워에 놓침으로 표시',[
   N('assign_minutes','담당 배정','견적문의 접수 후 이 시간 안에 담당을 지정합니다.','cond','분',10,10,240),
   N('first_contact_hours','첫 연락','배정 후 이 시간 안에 첫 연락. 최초 응대 시각은 1회만 저장됩니다.','fix','시간'),
   N('unreachable_attempts','최초 문의 연락두절','연락이 안 되면 이 횟수만큼 시도한 뒤 별도 후속관리로 넘깁니다.','cond','회',1,1,10),
   N('unreachable_interval_days','연락두절 시도 간격','시도와 시도 사이 간격','cond','일',1,1,7),
   N('inactive_days','활동 없음','진행 중 영업건에 기록이 이 기간 없으면 알림 · 놓침','fix','일'),
   N('quote_followup_days','견적 발송 후 후속','견적 발송 후 이 기간 안에 후속 확인이 없으면 지연','fix','일'),
   T('next_action_required','다음 행동 필수','진행 중 영업건은 다음 행동 + 날짜가 있어야 합니다. 없으면 놓침.','fix'),
   X('고객관리 기간','견적 후 집중관리 → 일반관리 → 장기 대기','fix','집중 1개월 → 일반 3개월 → 장기 대기'),
   N('long_wait_contact_days','장기 대기 연락 주기','장기 대기 고객에게 후속 확인 할 일을 만드는 간격','cond','일',10,30,180),
   N('transfer_result_check_days','타사 이관 결과 확인','이관 후 이 기간이 지나면 담당자 오늘 업무에 결과 확인 생성','cond','일',1,3,60)]],
  ['perf','결과 · 실적','주간 브리핑 · 대시보드 · 리포트가 같은 계산식을 씁니다',[
   X('수주실적 금액','자사 · 타사 이관 모두 같은 기준. 실행가 · 정산액 · 기술자문료와 분리','fix','최종 낙찰금액 (VAT 별도)'),
   X('영업 메이드율','배드핏 · 진행 중 · 낙찰결과 대기는 계산에서 제외','fix','(자사 수주 + 승인 타사 이관) ÷ (자사 수주 + 승인 타사 이관 + 파이프라인 실주)'),
   T('split_own_transfer','자사 / 타사 이관 분리 표시','화면에서는 나눠 보여 주고 총 영업실적에서는 합산','fix'),
   X('타사 이관 실적 인정 조건','사전 정식 보고 + 관리자 승인 건만. 단순 중복 · 종료 건 제외','fix','사전 보고 · 낙찰결과 · 낙찰금액 확인 후 관리자 승인'),
   T('year_management','연도별 관리','영업건에 \'공사 예정 연도\'를 받아 올해 진행 건과 향후 연도 건을 나눠 봅니다. 파이프라인 단계는 그대로이고, 목록 · 대시보드에 연도 필터가 생깁니다.','cond'),
   T('year_required_on_convert','공사 예정 연도 필수','파이프라인 전환 시 연도를 꼭 받습니다. 모르면 \'미정\'.','cond'),
   T('year_future_skip_focus','향후 연도 건 집중관리 제외','내년 이후 공사 건은 7일 활동 없음 · 견적 후속 놓침에서 빼고 장기 대기 주기로 관리','cond')]],
  ['reason','사유 목록','필수 입력 · 집계에 그대로 쓰입니다',[
   C('reasons_bad_fit','Bad Fit 사유','견적문의 단계 부적합 종결 · 메이드율 제외','cond'),
   C('reasons_lost','실주 원인','파이프라인 실주 · 메이드율 포함','cond'),
   C('reasons_transfer','타사 이관 사유','타사 이관 등록 시 선택','cond')]],
  ['log','응대 기록','모든 접촉은 같은 형식으로 남깁니다',[
   X('기록 형식','문자 발송 중심이 아니라 기록 중심','fix','접촉 수단 → 결과 → 내용 → 다음 행동 → 다음 확인일'),
   C('contact_channels','접촉 수단','응대 기록에서 고르는 목록','cond'),
   T('owner_change_log','담당자 변경 이력','변경 전 · 후 담당 · 시각 · 사유 자동 기록','fix')]],
  ['people','사람 · 관계','관리소장 이동과 관계를 CRM이 기억합니다',[
   T('manager_change_is_event','관리소장 변경 = 영업 이벤트','변경 시 기존 견적 · 공법 · 관계 재확인 할 일 자동 생성','fix'),
   T('relationship_follows_person','관계 승계','같은 관리소장이 다른 아파트로 옮기면 과거 관계를 새 현장에 연결','fix'),
   T('duplicate_lead_warning','중복 리드 경고','기존 현장 재문의 시 경고 + 기존 담당 먼저 확인','fix'),
   T('auto_owner_attribution','주담당 자동 귀속','수주실적 · 인센티브를 누구에게 귀속할지 자동으로 정합니다.','cond'),
   X('귀속 기준','최초로 고객과 실제 연결된 담당자를 주담당으로 봅니다. 연락 시도(부재)는 제외.','cond','최초 연락(실제 연결) 담당자 우선'),
   T('owner_keep_on_reassign','재배정돼도 귀속 유지','중간에 담당이 바뀌어도 실적은 주담당에게. 바뀐 담당은 \'보조\'로 함께 표시','cond'),
   X('귀속 변경','예외가 있으면 관리자가 사유를 남기고 바꿉니다. 변경 이력에 남음','fix','관리자만 · 사유 필수'),
   T('nearby_map','주변 현장 지도','담당이 배정되면 상세 창에 주변 진행 · 수주 현장을 지도로 보여 줍니다. 방문 동선 · 레퍼런스 소개에 사용','cond'),
   N('nearby_radius_km','주변 현장 반경','지도에 보여 줄 거리','cond','km',1,1,20)]],
  ['open','공개 · 권한','',[
   T('dashboard_public','영업 대시보드 공개','전체 · 개인 성과를 전 직원에게 공개','fix'),
   X('할 일 지정 · 실적 인정 권한','컨트롤타워 지정, 타사 이관 실적 인정','fix','관리자 · 팀장')]],
  ['later','보류 · 추후','회의에서 잠정 · 추후로 정한 것',[
   T('content_followup','콘텐츠 후속관리','카드뉴스 · 영상 — 발송 대신 접촉 기록만','hold')]]];
 const ROWS=SECTIONS.flatMap(s=>s[3]),EDIT=ROWS.filter(r=>r.st==='cond'&&r.k),SPEC=Object.fromEntries(EDIT.map(r=>[r.k,r]));
 let over={},meta={updated_at:'',updated_by:'',history:[]},loaded=false,busy=false,warmed='';
 /* 한 값 다듬기: 조건부 항목만, 형식 · 범위가 맞을 때만 받아들인다(아니면 undefined) */
 function clean(k,v){
  const r=SPEC[k];if(!r)return undefined;
  if(r.type==='num'){const n=Number(v);return Number.isFinite(n)&&Math.round(n)===n&&n>=r.min&&n<=r.max?n:undefined;}
  if(r.type==='tg')return typeof v==='boolean'?v:undefined;
  if(r.type==='chips'){if(!Array.isArray(v))return undefined;const l=[...new Set(v.map(x=>String(x==null?'':x).trim()).filter(Boolean))];return l.length>=1&&l.length<=20&&l.every(x=>x.length<=30)?l:undefined;}
  return undefined;
 }
 const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
 function get(k){return Object.prototype.hasOwnProperty.call(over,k)?over[k]:DEFAULTS[k];}
 function all(){const o={};Object.keys(DEFAULTS).forEach(k=>{const v=get(k);o[k]=Array.isArray(v)?v.slice():v;});return o;}
 function apply(values){const o={};Object.keys(values||{}).forEach(k=>{const v=clean(k,values[k]);if(v!==undefined&&!same(v,DEFAULTS[k]))o[k]=v;});over=o;sync();return all();}
 /* 예전 화면들이 읽는 OPS_RULES 에 같은 기준을 넣는다 — 화면마다 다른 기준을 쓰지 않게 */
 function sync(){
  const O=root.OPS_RULES;if(!O||typeof O!=='object')return;
  O.inquiryAssignMinutes=get('assign_minutes');O.towerFirstResponseHours=get('first_contact_hours');O.responseSlaHours=get('first_contact_hours');
  O.contactWarnDays=get('inactive_days');O.stallDays=get('inactive_days');O.inquiryFollowDays=get('quote_followup_days');
  O.waitContactDays=get('long_wait_contact_days');O.longContactDays=get('care_general_months')*30;O.loopContactDays=get('care_focus_months')*30;
  /* 단계 바꾸기 '실주'의 사유 선택 = 실주 원인 목록 */
  try{const ST=root.StageTransition,f=ST&&ST.definitions&&ST.definitions.lost&&ST.definitions.lost.fields.find(x=>x.key==='close_reason');if(f){f.label='실주 원인';f.options=reasons('lost');}}catch(e){}
  O.unreachableAttempts=get('unreachable_attempts');O.unreachableIntervalDays=get('unreachable_interval_days');O.transferResultCheckDays=get('transfer_result_check_days');
 }
 /* ── 계산 함수 ── */
 const pct=(a,b)=>b>0?Math.round(a/b*1000)/10:null;
 /* 메이드율: wonOwn = 자사 수주, wonTransfer = 승인된 타사 이관 수주, lost = 파이프라인 실주 (건수) */
 function madeRate(wonOwn,wonTransfer,lost){const w=(Number(wonOwn)||0)+(Number(wonTransfer)||0);return pct(w,w+(Number(lost)||0));}
 /* 타사 이관 상태(영업단계가 아니라 상태값 — 서버 crm_deal_transfers 의 한 줄이 영업건의 transfer 로 붙는다):
    none | pending(등록 · 낙찰결과 대기) | awarded(타사 이관 수주 · 실적 인정 대기) | approved(관리자 인정 · 실적 반영) | rejected(관리자 제외) | lost(실주) | cancelled(입찰 취소 · 보류) */
 function transferOf(d){
  const t=d&&d.transfer;if(!t||typeof t!=='object'||t.transfer_status!=='transferred')return {status:'none'};
  const r=String(t.award_result||'pending'),status=r==='transferred_won'?(t.incentive_eligible===true?'approved':t.rejected_reason?'rejected':'awarded'):r==='lost'?'lost':r==='cancelled'?'cancelled':'pending';
  return {status,amount:Number(t.award_amount)||0,company:String(t.transfer_company||''),reason:String(t.transfer_reason||''),date:String(t.transfer_date||'').slice(0,10),reported:t.transfer_reported===true,owner:String(t.performance_owner||''),award_date:String(t.award_date||'').slice(0,10)};
 }
 /* 영업건 결과 구분. 타사 이관: 인정된 것만 수주 · 대기(등록 · 인정 전 · 취소 보류) = 계산 제외 · 실주 = 실패 · 관리자 제외 = 실적 · 메이드율 모두 제외 */
 function dealResult(d){
  const t=transferOf(d);if(t.status==='approved')return 'won_transfer';if(t.status==='pending'||t.status==='awarded'||t.status==='cancelled'||t.status==='rejected')return 'transfer_pending';if(t.status==='lost')return 'lost';
  let o='open';try{o=root.outcomeOf(d);}catch(e){}
  if(o==='won')return 'won_own';if(o==='badfit')return 'bad_fit';if(o==='lost'||o==='nocontact'||o==='closed')return 'lost';return 'in_progress';
 }
 /* 실적 금액(낙찰금액 · VAT 별도)을 자사 / 타사 이관으로 나눠 합산 */
 function performance(ownAmount,transferAmount){const own=Number(ownAmount)||0,tr=Number(transferAmount)||0;return {own,transfer:tr,total:own+tr,label:'수주실적'};}
 /* 사유 목록: bad_fit | lost | transfer */
 function reasons(kind){const v=get('reasons_'+kind);return Array.isArray(v)?v.slice():[];}
 /* 예전에 쓰던 실주 사유 → 지금 원인(뜻이 같은 것만). 나머지는 적힌 그대로 둔다 */
 const LOST_ALIAS={'가격 열세':'가격','고객 예산 무산':'예산','공사 시기 연기·취소':'공사 취소','타사 선정 (경쟁 패배)':'경쟁사 관계','기술·공법 열세':'타 공법 선호'};
 function lostReason(text){const s=String(text||'').trim();if(!s)return '사유 미기록';const list=reasons('lost');if(list.includes(s))return s;return LOST_ALIAS[s]||s;}
 /* 놓침 판정(시간 기준) — 모두 "지금" 기준, 시각은 ISO 문자열 또는 ms */
 const ms=v=>typeof v==='number'?v:Date.parse(v||'');
 const miss={
  assign:(receivedAt,now)=>{const t=ms(receivedAt);return Number.isFinite(t)&&((now||Date.now())-t)/6e4>get('assign_minutes');},
  firstContact:(assignedAt,now)=>{const t=ms(assignedAt);return Number.isFinite(t)&&((now||Date.now())-t)/36e5>get('first_contact_hours');},
  inactive:(lastRecordAt,now)=>{const t=ms(lastRecordAt);return !Number.isFinite(t)||((now||Date.now())-t)/864e5>=get('inactive_days');},
  quoteFollowup:(quoteSentAt,lastFollowAt,now)=>{const q=ms(quoteSentAt),f=ms(lastFollowAt);if(!Number.isFinite(q))return false;if(Number.isFinite(f)&&f>q)return false;return ((now||Date.now())-q)/864e5>get('quote_followup_days');},
  nextAction:(text,due)=>get('next_action_required')&&!(String(text||'').trim()&&String(due||'').trim()),
  longWait:(lastContactAt,now)=>{const t=ms(lastContactAt);return !Number.isFinite(t)||((now||Date.now())-t)/864e5>=get('long_wait_contact_days');},
  transferCheck:(reportedAt,now)=>{const t=ms(reportedAt);return Number.isFinite(t)&&((now||Date.now())-t)/864e5>=get('transfer_result_check_days');}};
 /* 고객관리 기간: 견적 뒤 지난 달수 → focus(집중) | general(일반) | long_wait(장기 대기) */
 function carePhase(quoteSentAt,now){const t=ms(quoteSentAt);if(!Number.isFinite(t))return '';const m=((now||Date.now())-t)/(864e5*30);return m<get('care_focus_months')?'focus':m<get('care_focus_months')+get('care_general_months')?'general':'long_wait';}
 /* ── 서버 ── */
 const store=()=>root.OpsStore,available=()=>!!(store()&&store().has&&store().has(RPC));
 function take(r){apply(r.rules||{});meta={updated_at:r.updated_at||'',updated_by:r.updated_by_name||'',history:Array.isArray(r.history)?r.history:[]};loaded=true;try{root.dispatchEvent(new CustomEvent('crm-rules:changed',{detail:{rules:all()}}));}catch(e){}return all();}
 async function load(force){if(!available())return all();if(busy)return all();if(loaded&&!force)return all();busy=true;try{return take(await store().rpc(RPC,{}));}catch(e){return all();}finally{busy=false;}}
 /* 저장: 바뀐 조건부 값만 보낸다. 서버가 확인한 값만 화면에 적용한다 */
 async function save(changes){
  const set={};Object.keys(changes||{}).forEach(k=>{const v=clean(k,changes[k]);if(v===undefined)throw new Error((SPEC[k]?SPEC[k].l:k)+' 값이 범위를 벗어났습니다');set[k]=v;});
  if(!Object.keys(set).length)return all();if(!available())throw new Error('운영 기준 저장은 서버 적용 뒤에 쓸 수 있습니다');
  return take(await store().rpc(RPC,{set}));
 }
 /* 로그인하면 한 번 읽고, 값이 기본과 다르면 다시 그린다 */
 function warm(){const me=root.ME&&String(root.ME.id||root.ME.name||'');if(!me||warmed===me||!available())return;warmed=me;const before=JSON.stringify(all());load(true).then(()=>{if(JSON.stringify(all())!==before&&typeof root.paint==='function'){try{root.paint();}catch(e){}}});}
 if(typeof root.paint==='function'){const base=root.paint;root.paint=function(){try{sync();}catch(e){}const r=base.apply(this,arguments);try{warm();}catch(e){}return r;};}
 try{sync();}catch(e){}
 return {VERSION,RPC,DEFAULTS,SECTIONS,ROWS,SPEC,get,all,apply,clean,sync,load,save,available,meta:()=>meta,loaded:()=>loaded,pct,madeRate,dealResult,transferOf,performance,reasons,lostReason,LOST_ALIAS,miss,carePhase};
});
