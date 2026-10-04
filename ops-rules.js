/* CRM 운영 기준 — 한곳(공통 설정 · 계산 함수). 2026-10-04 design_handoff_rules/README.md · rules.json
   모든 화면은 여기 값과 함수로 메이드율 · 수주실적 · 놓침을 계산한다. 화면마다 기준을 따로 두지 않는다.
   상태: 확정(fix) = 회의 확정 · 잠금 / 조건부(cond) = 관리자 설정(운영 기준 설정 화면)에서 바꿈 / 보류(hold) = 구현하지 않음(자리만).
   저장: 조건부 값만 서버(crm_ops_rules_v1 → crm_settings 'ops_rules')에 두고, 바꿀 때마다 변경 이력(누가 · 언제 · 전 → 후)이 남는다.
   서버 함수가 아직 없으면 기본값(rules.json)으로 동작한다. 값이 바뀌면 예전 화면들이 읽는 OPS_RULES 에도 같은 값을 넣어 준다(sync).
   실주 원인 = 4분류(관계 / 공법 / 가격 / 사업) · 금액 5개(예상 / 낙찰 / 자사계약 / 기술자문 / 인센티브 실적)는 절대 더하지 않는다 · 영업 경로 5칸(유입 → 최초 영업업체 → 담당 → 낙찰업체 → 기술자문업체).
   결과 구분: 직접 수주(won_own) · 협약시공사 수주 · 기술자문(won_partner_tech) · 타사 이관 수주 = 승인된 것만(won_transfer) · 파이프라인 실주(lost) · Bad Fit(bad_fit) · 진행 중(in_progress) · 낙찰결과 대기(transfer_pending)
   메이드율 = (직접 수주 + 협약시공사 수주 + 승인 타사 이관 수주) ÷ (… + 파이프라인 실주) — Bad Fit · 진행 중 · 낙찰결과 대기는 계산에서 뺀다.
   수주실적 = 최종 낙찰금액(VAT 별도). 수주 유형 3가지는 화면에서 나눠 보여 주고 총 영업실적에서는 합산한다.
   협약시공사 수주의 기술자문 계약금액 · POUR 계약금액은 낙찰금액에 더하지 않는다(연결 계약 — 회사 매출 쪽 숫자). */
(function(root,factory){const api=factory(root);if(typeof module==='object'&&module.exports)module.exports=api;else root.CRMRules=api;})(typeof window!=='undefined'?window:globalThis,function(root){
 'use strict';
 const VERSION='2026-10-04',RPC='crm_ops_rules_v1';
 /* rules.json 과 같은 기본값 */
 const DEFAULTS=Object.freeze({
  assign_minutes:30,first_contact_hours:2,unreachable_attempts:3,unreachable_interval_days:1,inactive_days:7,quote_followup_days:7,next_action_required:true,
  care_focus_months:1,care_general_months:3,long_wait_contact_days:60,transfer_result_check_days:14,
  split_own_transfer:true,stage_gates:true,
  reasons_bad_fit:Object.freeze(['수행 불가 공종','규모 부적합','시공 불가 지역','기타']),
  /* 실주 원인 4분류(2차 기능 3): '분류 · 세부 사유' — 관계 / 공법 / 가격 / 사업 */
  reasons_lost:Object.freeze(['관계 · 관리소장 변경','관계 · 입대의 · 회장 영향','관계 · 경쟁업체 기존 관계','공법 · 타 공법 선호','공법 · 특허 조건 불리','공법 · 설계 변경','가격 · 가격 경쟁','가격 · 예산 부족','가격 · 실행가 문제','사업 · 공사 취소','사업 · 연기','사업 · 예산 미확정']),
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
   T('stage_gates','단계 이동 필수조건','단계별 필수값이 비면 [옮기기]를 잠급니다 — → 컨설팅 설계: 1차 현장미팅 / → 자료 발송완료: 발송일 · 발송 자료 · 다음 확인일 / → 관계관리: 자료 발송일 · 고객 반응 · 다음 행동 · 다음 확인일 / → 경쟁 · 입찰: 입찰 · 결정 일정 · 경쟁 상황 / → 계약 · 시공: 계약일 · 계약금액 / → 수주 · 실주: 수주 유형 · 낙찰금액 / 실주 원인','cond'),
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
 /* 수주 유형 3가지(rules.json won_types) · 영업건에 붙는 수주 필드 이름(deal_fields) */
 const WON_TYPES=Object.freeze({won_own:Object.freeze({key:'own',label:'직접 수주',short:'직접 수주',hint:'자사가 직접 계약 · 시공'}),won_partner_tech:Object.freeze({key:'partner_tech',label:'협약시공사 수주 · 기술자문',short:'협약 · 기술자문',hint:'우리 영업 → 협약시공사 낙찰 → 기술자문 계약'}),won_transfer:Object.freeze({key:'transfer',label:'타사 이관 수주',short:'타사 이관',hint:'공식 이관 → 그 업체 낙찰 · 사전 보고 승인'})});
 const DEAL_FIELDS=Object.freeze({sales_channel_brand:'영업 경로(브랜드)',award_company:'낙찰 시공사',award_amount:'낙찰금액(VAT 별도)',tech_advisory_company:'기술자문 계약 상대',tech_advisory_amount:'기술자문 계약금액',pour_contract_amount:'POUR 계약금액'});
 /* ── 계산 함수 ── */
 const pct=(a,b)=>b>0?Math.round(a/b*1000)/10:null;
 /* 메이드율: wonOwn = 직접 수주, wonTransfer = 승인된 타사 이관 수주, lost = 파이프라인 실주, wonPartner = 협약시공사 수주 · 기술자문 (건수) */
 function madeRate(wonOwn,wonTransfer,lost,wonPartner){const w=(Number(wonOwn)||0)+(Number(wonTransfer)||0)+(Number(wonPartner)||0);return pct(w,w+(Number(lost)||0));}
 /* 수주 확정 정보(서버 crm_deal_wins 의 한 줄이 영업건의 win 으로 붙는다): type own | partner_tech */
 function winOf(d){
  const w=d&&d.win;if(!w||typeof w!=='object'||w.win_status!=='confirmed'||!['own','partner_tech'].includes(w.won_type))return {type:''};
  const tech=w.won_type==='partner_tech'&&w.tech_advisory===true;
  return {type:w.won_type,company:String(w.award_company||''),amount:Number(w.award_amount)||0,date:String(w.award_date||'').slice(0,10),brand:String(w.sales_channel_brand||''),owner:String(w.performance_owner||''),tech,techCompany:tech?String(w.tech_advisory_company||''):'',techAmount:tech?Number(w.tech_advisory_amount)||0:0,pourAmount:tech?Number(w.pour_contract_amount)||0:0,advisoryId:w.advisory_id||''};
 }
 /* 타사 이관 상태(영업단계가 아니라 상태값 — 서버 crm_deal_transfers 의 한 줄이 영업건의 transfer 로 붙는다):
    none | pending(등록 · 낙찰결과 대기) | awarded(타사 이관 수주 · 실적 인정 대기) | approved(관리자 인정 · 실적 반영) | rejected(관리자 제외) | lost(실주) | cancelled(입찰 취소 · 보류) */
 function transferOf(d){
  const t=d&&d.transfer;if(!t||typeof t!=='object'||t.transfer_status!=='transferred')return {status:'none'};
  const r=String(t.award_result||'pending'),status=r==='transferred_won'?(t.incentive_eligible===true?'approved':t.rejected_reason?'rejected':'awarded'):r==='lost'?'lost':r==='cancelled'?'cancelled':'pending';
  return {status,amount:Number(t.award_amount)||0,company:String(t.transfer_company||''),reason:String(t.transfer_reason||''),date:String(t.transfer_date||'').slice(0,10),reported:t.transfer_reported===true,owner:String(t.performance_owner||''),award_date:String(t.award_date||'').slice(0,10),award_company:String(t.award_company||'')};
 }
 /* 영업건 결과 구분. 타사 이관: 인정된 것만 수주 · 대기(등록 · 인정 전 · 취소 보류) = 계산 제외 · 실주 = 실패 · 관리자 제외 = 실적 · 메이드율 모두 제외 */
 function dealResult(d){
  const t=transferOf(d);if(t.status==='approved')return 'won_transfer';if(t.status==='pending'||t.status==='awarded'||t.status==='cancelled'||t.status==='rejected')return 'transfer_pending';if(t.status==='lost')return 'lost';
  const w=winOf(d);if(w.type==='partner_tech')return 'won_partner_tech';if(w.type==='own')return 'won_own';
  let o='open';try{o=root.outcomeOf(d);}catch(e){}
  if(o==='won')return 'won_own';if(o==='badfit')return 'bad_fit';if(o==='lost'||o==='nocontact'||o==='closed')return 'lost';return 'in_progress';
 }
 /* 실적 금액(낙찰금액 · VAT 별도)을 직접 / 협약시공사 · 기술자문 / 타사 이관으로 나눠 합산 */
 function performance(ownAmount,transferAmount,partnerAmount){const own=Number(ownAmount)||0,tr=Number(transferAmount)||0,partner=Number(partnerAmount)||0;return {own,partner,transfer:tr,total:own+partner+tr,label:'수주실적'};}
 /* 회사 매출(영업실적과 다른 숫자): 직접 수주 = 계약금액 그대로, 협약시공사 수주 = 기술자문 계약금액 + POUR 계약금액, 타사 이관 = 0 */
 function revenue(type,amount,techAmount,pourAmount){return type==='own'?Number(amount)||0:type==='partner_tech'?(Number(techAmount)||0)+(Number(pourAmount)||0):0;}
 /* 사유 목록: bad_fit | lost | transfer */
 function reasons(kind){const v=get('reasons_'+kind);return Array.isArray(v)?v.slice():[];}
 /* 예전에 쓰던 실주 사유 → 지금 원인(뜻이 같은 것만). 나머지는 적힌 그대로 둔다 */
 const LOST_ALIAS={'가격':'가격 · 가격 경쟁','가격 열세':'가격 · 가격 경쟁','예산':'가격 · 예산 부족','고객 예산 무산':'가격 · 예산 부족','관리소장 변경':'관계 · 관리소장 변경','경쟁사 관계':'관계 · 경쟁업체 기존 관계','타사 선정 (경쟁 패배)':'관계 · 경쟁업체 기존 관계','타 공법 선호':'공법 · 타 공법 선호','기술·공법 열세':'공법 · 타 공법 선호','공사 취소':'사업 · 공사 취소','공사 시기 연기·취소':'사업 · 연기'};
 function lostReason(text){const s=String(text||'').trim();if(!s)return '사유 미기록';const list=reasons('lost');if(list.includes(s))return s;const a=LOST_ALIAS[s];return a&&list.includes(a)?a:s;}
 /* 실주 원인 분류: '관계 · 관리소장 변경' → 분류 '관계', 세부 '관리소장 변경'. 분류가 없는 사유(직접 추가한 것 · 예전 기록)는 '기타' */
 const lostSplit=text=>{const s=lostReason(text),i=s.indexOf(' · ');return i>0?[s.slice(0,i),s.slice(i+3)]:['기타',s];};
 const lostCategory=text=>lostSplit(text)[0];
 function lostGroups(){const m=new Map();reasons('lost').forEach(v=>{const p=lostSplit(v),g=m.get(p[0])||[];g.push({v,l:p[1]});m.set(p[0],g);});return [...m];}
 /* ── 2차 · 3차 기준값(rules.json phase2 · phase3) — 화면이 따로 정하지 않고 여기 값을 본다 ── */
 const PHASE2=Object.freeze({change_events:Object.freeze({types:Object.freeze(['관리소장 변경','입대의 회장 변경','예산 변경','공사시기 변경','공법 변경','경쟁업체 등장','입찰방식 변경','재견적 요청']),auto_next_action_days:3,suggest_as_lost_reason:true,
   actions:Object.freeze({'관리소장 변경':'기존 견적 · 공법 조건 재확인 (새 소장 첫 미팅)','입대의 회장 변경':'새 회장 의견 확인 · 선정 방식 재확인','예산 변경':'범위 축소안 · 단계 시공안 다시 제안','공사시기 변경':'공사 예정 연도 변경 · 장기 대기로 관리','공법 변경':'공법 비교자료 재발송 · 결정권자 미팅','경쟁업체 등장':'경쟁사 견적 · 조건 파악','입찰방식 변경':'입찰 참여 여부 결정 · 서류 준비','재견적 요청':'견적 요청 등록 (3일)'}),
   lost_map:Object.freeze({'관리소장 변경':'관계 · 관리소장 변경','입대의 회장 변경':'관계 · 입대의 · 회장 영향','예산 변경':'가격 · 예산 부족','공사시기 변경':'사업 · 연기','공법 변경':'공법 · 타 공법 선호','경쟁업체 등장':'관계 · 경쟁업체 기존 관계','재견적 요청':'가격 · 가격 경쟁'})}),
  stage_gates:Object.freeze({consulting:Object.freeze(['1차 현장미팅 일정 또는 완료']),sent:Object.freeze(['발송일','발송 자료','다음 확인일']),relationship:Object.freeze(['자료 발송일','고객 반응','다음 행동','다음 확인일']),competition:Object.freeze(['입찰/결정 일정','경쟁 상황']),construction:Object.freeze(['계약일','계약금액']),closed:Object.freeze(['수주 유형 · 낙찰금액 / 실주 원인'])}),
  approval_types:Object.freeze(['타사 이관 실적','귀속 변경','중복 리드 정산','전략수주','특별 인센티브','결과 수정']),cohort_compare_after_months:3,owner_fields:Object.freeze(['current_owner','first_owner','performance_owner','owner_history']),
  urgent_quote:Object.freeze({deadline_required:true,float_to_top:true}),promise_keeping:Object.freeze({window_days:30,warn_below:0.8})});
 const PHASE3=Object.freeze({sales_path:Object.freeze(['inflow_brand','first_sales_company','sales_owner','award_company','tech_advisory_company']),
  amounts:Object.freeze({estimated:'예상금액',award:'낙찰금액',own_contract:'자사계약금액',tech_advisory:'기술자문금액',incentive:'인센티브 실적금액'}),
  health_score:Object.freeze({base:100,red_below:40,penalties:Object.freeze({no_contract_info:30,quote_no_contact_7d:25,no_next_action:20,inactive_7d:15,manager_changed:15,bid_or_meeting_d3:15})}),
  bid_alert_days:Object.freeze([7,3,1]),stage_dwell_days:Object.freeze({inq:2,cons:7,sent:14,rel:60,bid:30,con:14}),reactivation_reasons:Object.freeze(['사업 · 연기','사업 · 예산 미확정'])});
 const PHASE4=Object.freeze({playbook:Object.freeze({inq:Object.freeze(['연락자 · 연락처','현재 문제','공사 범위','공사 시기','현장 방문일']),cons:Object.freeze(['1차 현장미팅','부위별 범위','도면 · 사진','공사 예정 연도','견적 요청 등록']),sent:Object.freeze(['발송일 · 수신자','수신 확인','결정권자','경쟁사 견적','다음 확인일']),rel:Object.freeze(['다음 연락일','공사 예정 연도','결정권자','예산 반영','콘텐츠 발송']),bid:Object.freeze(['현설일','PT','경쟁 공법','의사결정자','예상 가격대']),con:Object.freeze(['계약일','계약금액','특약 · 구두 약속','시공팀 인계서','착공일']),won:Object.freeze(['준공 확인','사후 연락','추가 공사 니즈','소개 가능성','하자 접수 경로'])}),
  playbook_tips:Object.freeze({inq:'첫 통화에서 방문일까지 잡으면 견적이 4일 빨랐습니다',cons:'범위를 부위별로 받으면 수량 변경이 줄었습니다',sent:'견적 후 7일 안에 결정권자 일정을 물으면 실주가 줄었습니다',rel:'장기 대기는 2개월마다 짧은 안부 + 사례 자료',bid:'D-3 전에 경쟁 공법을 확인한 건의 낙찰률이 2배',con:'구두 약속은 계약서 특약에 남겨야 분쟁이 없습니다',won:'준공 30일 안 사후 연락이 재계약 · 소개로 이어졌습니다'}),
  followup_sequence_days:Object.freeze([3,7,14,30])});
 /* 금액 5개(3차 기능 2) — 같은 현장, 다른 의미. 절대 더하지 않는다. 영업 성과 = 인센티브 실적금액(= 낙찰금액), 회사 매출 = 자사계약 + 기술자문.
    ledgerBalance = 계약실적 원장의 남은 계약금액(직접 수주의 자사계약금액) */
 function amounts(d,ledgerBalance){
  const w=winOf(d),t=transferOf(d),est=Number(d&&(d.amount!=null?d.amount:d.amt))||0,led=Number(ledgerBalance)||0,raw=d&&d.win||{};let award=0,own=0,tech=0,counted=true;
  if(t.status==='approved'||t.status==='awarded'){award=t.amount;counted=t.status==='approved';}
  else if(w.type==='partner_tech'){award=w.amount;own=w.pourAmount;tech=w.techAmount;}
  else if(w.type==='own'){award=w.amount;own=led||Number(raw.own_contract_amount)||w.amount;}
  else if(led>0){award=led;own=led;}
  return {estimated:est,award,own_contract:own,tech_advisory:tech,incentive:counted?award:0,revenue:own+tech};
 }
 /* 영업 경로 5칸(3차 기능 1): 유입 → 최초 영업업체 → 영업 담당 → 낙찰업체 → 기술자문업체 */
 function salesPath(d){
  const w=winOf(d),t=transferOf(d),raw=d&&d.win&&d.win.win_status==='confirmed'?d.win:{},won=t.status==='approved'||t.status==='awarded';
  return {inflow_brand:String(raw.inflow_brand||raw.sales_channel_brand||d&&(d.origin_business||d.brand)||''),first_sales_company:String(raw.first_sales_company||d&&d.brand||''),sales_owner:String(w.owner||t.owner||d&&d.assignee||''),award_company:String(won?(t.award_company||t.company):w.company||''),tech_advisory_company:String(w.techCompany||'')};
 }
 /* Health Score(3차 기능 4): 100점에서 감점, red_below 미만 빨강. flags = 감점표 열쇠별 true/false */
 function healthScore(flags){const P=PHASE3.health_score;let s=P.base;Object.keys(P.penalties).forEach(k=>{if(flags&&flags[k])s-=P.penalties[k];});s=Math.max(0,s);return {score:s,red:s<P.red_below};}
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
 return {VERSION,RPC,DEFAULTS,SECTIONS,ROWS,SPEC,get,all,apply,clean,sync,load,save,available,meta:()=>meta,loaded:()=>loaded,pct,madeRate,dealResult,transferOf,winOf,performance,revenue,WON_TYPES,DEAL_FIELDS,reasons,lostReason,lostCategory,lostGroups,LOST_ALIAS,PHASE2,PHASE3,PHASE4,amounts,salesPath,healthScore,miss,carePhase};
});
