'use strict';

// Human-reviewed reachability ledger for the currently loaded PC/mobile UI.
// This script reads local source only. It never evaluates the UI or contacts any endpoint.
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');

const root=path.resolve(__dirname,'..');
const out=path.join(root,'docs','operational-cutover-20260906');
const FROZEN='STAGING_COMPAT_PASS_FROZEN';
const BLOCKED='NEEDS_VERIFICATION_BLOCKED';
const NONE='NOT_CONNECTED';
const LOCAL_PREF='LOCAL_ONLY_CONFIRMED';
const LOCAL_BLOCKER='LOCAL_ONLY_MIGRATION_BLOCKER';
const EXTERNAL='EXTERNAL_APP';
const EXTERNAL_N8N='EXTERNAL_N8N_RETAINED_E2E_PENDING';
const OUT_SCOPE='OUT_OF_SCOPE_31_OP_BOUNDARY';
const DIRECT='DIRECT_SUPABASE_UNVERIFIED';
const READ='READ_CONTRACT_MISSING';
const MOCK='REACHABLE_MOCK_BLOCKER';
const CANDIDATE='DERIVED_SAFE_LOCAL_CANDIDATE';
const CANDIDATE_DRIFT='DERIVED_SAFE_LOCAL_CANDIDATE_DRIFT_BLOCKED';
const READ_CANDIDATE='READ_LOCAL_CANDIDATE';
const READ_DRIFT='READ_LOCAL_CANDIDATE_DRIFT_BLOCKED';
const CONTRACT='DERIVED_SAFE_CONTRACT_ONLY';
const STAGING_PASS='STAGING_JWT_E2E_PASS_20260906';

const rows=[];
function add(id,domain,surface,action,operations,payload,target,transport,status,readAfter,evidence,next){
 const ruleStatus=[FROZEN,STAGING_PASS,EXTERNAL,LOCAL_PREF,OUT_SCOPE].includes(status)?'CONFIRMED':
  [CANDIDATE,CANDIDATE_DRIFT,READ_CANDIDATE,READ_DRIFT,CONTRACT].includes(status)?'DERIVED_SAFE':'NEEDS_VERIFICATION';
 rows.push({id,domain,surface,action,operations,payload,target,transport,n8n_dependency:/n8n/i.test(transport)?'YES':'NO',rule_status:ruleStatus,adapter_status:status,read_after_write:readAfter,evidence,next});
}

add('C01','공통','index PC/모바일 전환','화면 자동·수동 선택','','view/cookie','브라우저 view preference','localStorage/cookie',LOCAL_PREF,'N/A','index.html:autoView/decide/mount','브라우저 선호값으로 유지하고 Staging 화면 회귀');
add('C02L','공통','PC·모바일 로그인','이름·비밀번호 로그인','','name/password; Auth session','Supabase Auth + users/profile','Staging browser Auth/profile PASS; candidate not deployed','BROWSER_STAGING_PASS_NOT_DEPLOYED','YES_PROFILE','crm.html:authSignIn; mobile.html:doSignIn; docs/operational-cutover-20260906/operational-ui-browser-read.json','배포 후보에서 회귀 유지');
add('C02S','공통','PC·모바일 세션','세션 복원·로그아웃','','Auth session','Supabase Auth + local session state','real Staging Auth against local operational UI candidate; not deployed','BROWSER_STAGING_PASS_NOT_DEPLOYED','N/A','crm.html:authInit/authSignOut; mobile.html:authRestore/doSignOut; docs/operational-cutover-20260906/operational-ui-browser-session.json','배포 후보에서 reload 복원·UI logout·만료 refresh fail-closed 회귀 유지');
add('C03','공통','PC·모바일 전체 화면','업무 데이터 조회·자동동기화·진단','','resource filters','deals/inquiries/contacts/history/reporting','strict cursor pagination + real Staging browser/JWT PASS for six roles',STAGING_PASS,'ACTOR_SCOPE_COMPLETE','crm.html:loadData; mobile.html:loadLive; docs/operational-cutover-20260906/operational-full-ui-browser-read.json; docs/operational-cutover-20260906/go-read-audit-20260907.json','회귀만 수행; 회사 전체를 암묵적으로 확대하지 않고 서버가 허용한 actor scope만 표시');
add('C04','공통','저장 실패 배지','동일 write_id 재시도','all queued ops','write_id + op + payload','shared receipt/ACK target','local cumulative UI candidate after O02; uncertain only; conflict/rejected remain blocked; not applied',CANDIDATE,'LOCAL_UI_QUEUE_PASS','crm.html:pushWrite/flushWrites; mobile.html:retryFailed; staging-phase1/transport.js; sql/queue-retry-compat/20260906','Staging JWT/PC·mobile에서 연결된 각 op의 응답 유실→같은 request_id receipt replay→중복 0 검증');

add('I01','견적문의','PC Control Center','본사 개인 최초·재배정','inquiry_assign/direct_assign','inquiry_id,from,to,status,reason,at','inquiries + assignment_history + private receipt/audit','strict Staging Supabase; current UI n8n',FROZEN,'YES_ASSIGNEE_STATUS','crm.html:7813','회귀만 수행');
add('I02','견적문의','모바일 관리 문의','본사 개인 최초·재배정','inquiry_assign/direct_assign','inquiry_id,from,to,status,reason,at','same as I01','strict Staging Supabase; current UI n8n',FROZEN,'YES_ASSIGNEE_STATUS','mobile.html:1946-1954','회귀만 수행');
add('I03P','견적문의','모바일 오늘·문의 상세','통화 완료·다음 일정 협의','inquiry_assign/response_progress','inquiry_id,from=to,status=전화응대 완료,at,response=진행됨 — 다음 잡음','inquiries first/last response timestamps + private append-only response audit + scoped history','23-op cumulative candidate; existing external op/ACK retained; not applied',CANDIDATE,'LOCAL_CHAIN_DB_UI_PASS','mobile.html:1411,1943; sql/business-v2/functions.sql:117-121; sql/inquiry-response-progress/20260906','Staging JWT/mobile 두 handler·최초/후속 timestamp·rep/consultation UUID scope·history/read-back·replay 검증');
add('I03N','견적문의','모바일 오늘·문의 상세','다음주 재연락','inquiry_assign/response_next_week_retry','inquiry_id,from=to,status=응대중,at,response=다음주 다시','inquiries response timestamps + status + next_action_date + private audit/history','23-op cumulative candidate; existing external op/ACK retained; not applied',CANDIDATE,'LOCAL_CHAIN_DB_UI_PASS','mobile.html:421-425,1411-1416,1942-1943; sql/inquiry-response-progress/20260906','Staging JWT/mobile 두 handler·KST+7·first-once/last-now·read-back·replay 검증');
add('I03M','견적문의','모바일 오늘·문의 상세','부재·내일 재시도','inquiry_assign/response_missed_retry','inquiry_id,from=to,status=배정완료,at,response=못 받으심 (내일 재시도)','inquiries preserved response timestamps + status + next_action_date + private audit/history','23-op cumulative candidate; existing external op/ACK retained; not applied',CANDIDATE,'LOCAL_CHAIN_DB_UI_PASS','mobile.html:421-425,1411-1416,1942-1943; business-v2 missed first_response KPI; sql/inquiry-response-progress/20260906','Staging JWT/mobile 두 handler·KST+1·response timestamp 불변·read-back·replay 검증');
add('I04','견적문의','PC 문의 상세·응대 폼','비종료 응대·상태·활동·다음행동','inquiry_status/progress','inquiry_id,from_status,target=step:0..5,did,result,next,due; client actor/at stripped','inquiries status/response timestamps/next_action_date + replacement next_actions + stage_history + private audit/receipt','23-op cumulative candidate; existing external op/ACK retained; not applied',CANDIDATE,'LOCAL_CHAIN_DB_UI_PASS','crm.html:6916-6959; sql/inquiry-stage-progress/20260906','Staging JWT/PC 단계 0..5·stale status·assigned rep/consultation·scoped admin·Next 교체·history/read-back·replay 검증; 종료/보류는 차단 유지');
add('I05','견적문의','PC Control Center','담당 회수','inquiry_unassign','inquiry_id,from,reason,actor,at','inquiries assignment/status + history/private receipt/audit','strict Staging Supabase; current UI n8n',FROZEN,'YES_ASSIGNMENT_STATUS_HISTORY','crm.html:7816; sql/operational-bundle/20260906; docs/operational-cutover-20260906/operational-bundle-final.json','UI Adapter 연결 후 회귀만 수행');
add('I06','견적문의','PC Control Center','보류','inquiry_status','inquiry_id,from_status,to_status,reason,actor,at','inquiries.status + private inquiry audit/receipt + scoped hold projection','17-op chained Dispatcher/read/UI candidate after inquiry reclassify; not applied',CANDIDATE,'LOCAL_CHAIN_DB_UI_PASS','crm.html:7816; sql/inquiry-hold/20260906; docs/operational-cutover-20260906/inquiry-management-contracts.md','full chain Staging JWT/PC single·batch/replay/read-back 검증; 영업전환·임의 상태·보류 해제는 차단 유지');
add('I07','견적문의','PC 문의 split/bulk','Next·완료·체크','next_action/inquiry_next_set; next_action_complete/inquiry_next_complete; stage_check/inquiry_check','inquiry_id,text,due_at; server action_id; fixed item_index,checked','inquiry next_actions + private checklist/audit/receipt','23-op cumulative candidate; existing external ops/Deal meanings retained; not applied',CANDIDATE,'LOCAL_CHAIN_DB_UI_PASS','crm.html:6360,6494,6874,6892; sql/inquiry-action-check/20260906','Staging JWT/PC 단건·일괄 Next 교체, server action_id 완료, 6개 체크, read-back, replay/reuse, assigned rep/consultation/scoped admin, Deal 회귀 검증');
add('I08','견적문의','모바일 오늘','문의 후속일 연기','inquiry_followup','due_at + fixed reason; client display state stripped','inquiries.next_action_date + private inquiry audit/receipt','21-op chained Dispatcher/mobile Today read-consumer candidate after purge; not applied',CANDIDATE,'LOCAL_CHAIN_DB_UI_PASS','mobile.html:2381; sql/inquiry-followup/20260906; docs/operational-cutover-20260906/inquiry-management-contracts.md','full chain Staging JWT/mobile future-hide·today/overdue/read-back/replay/foreign-owner 검증; generic Next/자동알림 차단 유지');
add('I09','견적문의','PC 문의 상세·Pipeline 전환','기존 Deal 연결 또는 신규 Deal 생성','transition; opportunity_create','internal intent,inquiry_id,promotion_mode,inquiry_status,server-reviewed owner,stage/reason,optional amount/site/client_ref','deals.origin_inquiry_id + deals/stage_history/activity + Deal/inquiry private audit + receipt','23-op cumulative candidate; existing external ops/ACK retained; Staging read-only preflight PASS; not applied',CANDIDATE,'STAGING_READONLY_PREFLIGHT_PASS_LOCAL_CHAIN_DB_UI_PASS','crm.html:6549-6592,6743-6783; sql/inquiry-pipeline-lineage/20260906; docs/operational-cutover-20260906/pipeline-lifecycle-contracts.md','Staging 적용 승인 후 JWT PC auto/manual create/existing·동시중복·replay/reuse·read-back 검증');
add('I10','견적문의','PC 연결 확인','문의와 Deal 계보 연결','lineage_link','inquiry_id normalized from origin_inquiry_id; client actor/time/site display discarded','deals.origin_inquiry_id + Deal/inquiry private audit + receipt','23-op cumulative candidate; existing external op/ACK retained; Staging read-only preflight PASS; not applied',CANDIDATE,'STAGING_READONLY_PREFLIGHT_PASS_LOCAL_CHAIN_DB_UI_PASS','crm.html:6266-6272; sql/inquiry-pipeline-lineage/20260906; docs/operational-cutover-20260906/pipeline-lifecycle-contracts.md','Staging 적용 승인 후 JWT admin same-site/same-owner/created-after/manual-link·conflict·replay·lineage-first refresh 검증');
add('I11','견적문의','PC 휴지통','휴지통 이동','inquiry_trash','reason/note; client actor/time/purge/protection stripped','private inquiry audit current trash state + snapshot/receipt + scoped projection','19-op chained Dispatcher/read/UI candidate after hold; not applied',CANDIDATE,'LOCAL_CHAIN_DB_UI_PASS','crm.html:7818; sql/inquiry-trash-restore/20260906; docs/operational-cutover-20260906/inquiry-management-contracts.md','full chain Staging JWT/PC single·batch trash/mobile exclusion/replay/read-back 검증; purge 차단 유지');
add('I12','견적문의','PC 휴지통','복원','inquiry_restore','intent=restore; client actor/time stripped','private inquiry audit current restore state + receipt + scoped projection','same 19-op chained candidate; not applied',CANDIDATE,'LOCAL_CHAIN_DB_UI_PASS','crm.html:7819; sql/inquiry-trash-restore/20260906; docs/operational-cutover-20260906/inquiry-management-contracts.md','I11과 같은 Staging 회귀에서 원 status/담당 유지·복원·중복 0 검증');
add('I13','견적문의','PC 휴지통','관리자 수동 완전삭제','inquiry_purge','intent=purge; client actor/time stripped','inquiry + scope delete, FK cascade, private immutable audit/receipt','20-op chained Dispatcher/UI candidate after trash/restore; not applied',CANDIDATE,'LOCAL_CHAIN_DB_UI_PASS_IRREVERSIBLE','crm.html:7820; sql/inquiry-purge/20260906; docs/operational-cutover-20260906/inquiry-management-contracts.md','full chain Staging JWT/admin button·active/non-admin/양방향 lineage/replay/rollback-before-use 검증; 자동 purge 차단 유지');
add('I14','견적문의','PC 기술자문 검토','일반 견적문의로 재분류','inquiry_reclassify','to brand; client from/review actor/time stripped','inquiries.brand + private inquiry audit/receipt + scoped review projection','16-op chained Dispatcher/read/UI candidate after waiting context; not applied',CANDIDATE,'LOCAL_CHAIN_DB_UI_PASS','crm.html:7787; sql/inquiry-reclassify/20260906; docs/operational-cutover-20260906/inquiry-management-contracts.md','full chain Staging JWT/PC button·linked Deal protection·replay/read-back 검증; 기술자문 Deal 이관은 차단 유지');
add('I15','견적문의','PC 기술자문 검토','기술자문 영업기회로 이관','opportunity_create/technical_inquiry_transfer; inquiry_status child absorbed','inquiry id; server current technical classification/site/work/approved optional owner/status','one technical public.deals row + lineage + inquiry converted state + histories/private audits/receipt','23-op cumulative candidate last layer; admin-only atomic helper/overlay; not applied',CANDIDATE,'LOCAL_DB_ADAPTER_UI_PASS','crm.html:7788; sql/technical-inquiry-transfer/20260906; docs/operational-cutover-20260906/technical-inquiry-transfer-resolution.md','누적 package Staging preflight 후 admin JWT/site·owner 유무/중복/replay/read-back/회귀 검증');
add('I16','견적문의','PC 상담담당','상담담당 지정·해제','inquiry_consultant','consultant,status,consulted_at,actor','inquiries consultation + history','current UI n8n; Staging eligibility source absent',BLOCKED,'NO','crm.html:7824; docs/operational-cutover-20260906/inquiry-management-contracts.md; docs/operational-cutover-20260906/staging-inquiry-consultant-preflight-20260906.json','상담 가능한 rep를 식별하는 UUID 기반 eligibility 정본 확정');
add('I17','경남지사','PC 본사 문의','경남 미지정 Pool 인계','inquiry_assign/branch_handoff','branch/group/reporting + reason','inquiry routing/pool/history TBD','current UI n8n; strict Staging blocked',BLOCKED,'NO','crm.html:7809-7813','Pool 표현·권한 정본 필요');
add('I18','경남지사','PC 경남 관리','지사 실담당 지정·미지정 복귀','inquiry_assign/branch_owner_assign','target/group/branch/reporting','inquiries assigned_to + branch history','current UI n8n; strict Staging blocked',BLOCKED,'PARTIAL','crm.html:5563,7813','허용 지사 UUID·Pool 복귀 규칙');
add('I19','견적문의','PC·모바일 문의 목록/상세','문의 표시·검색·배정이력 새로고침','','inquiry/site/contact/work/assignment/timestamps','crm_read_scoped_v2 inquiry projection','strict Staging scoped read; current UI read not yet switched',FROZEN,'YES_SCOPE_FIELDS_HISTORY','crm.html:inqCtl*; mobile.html:inquiryViewM; sql/operational-bundle/20260906; docs/operational-cutover-20260906/operational-bundle-final.json','UI read 연결 후 회귀만 수행');

add('P01','Pipeline','PC +영업·모바일 신규영업','신규 영업기회 생성','opportunity_create','direct surface,site/work/brand,reviewed owner UUID,amount,contact,reason,client_ref + mobile initial Activity/Next','sites/deals/contacts/assignment + surface-specific Activity/Next + scope/audit/receipt','23-op cumulative candidate; read-only Staging aggregate evidence; not applied',CANDIDATE,'LOCAL_CHAIN_DB_UI_PASS','crm.html:7171-7207; mobile.html:2106-2125; docs/operational-cutover-20260906/opportunity-create-resolution-20260906.json; sql/pipeline-opportunity-create/20260906','reachable direct PC/mobile JWT/browser create·site exact/broad collision·owner role matrix·replay/reuse·atomic rollback·read-back 검증; inquiry/technical/expansion meanings remain blocked');
add('P02','Pipeline','PC·모바일 Deal 상세','담당자 변경·인수인계','assign; handover','from,to,reason,summary','deals owner + assignment/history + server-generated handover audit','current UI n8n; actual Staging has no UUID team authority',BLOCKED,'NO','crm.html:5264,7562; mobile.html:1529,2055,2401; people-eligibility.js; docs/operational-cutover-20260906/pipeline-owner-handover-resolution-20260906.md','users.user_id별 head_office/external/gyeongnam 팀·Pipeline 배정 가능 UUID 정본 승인; 이후 assign transaction에 handover를 흡수하고 mobile reason 입력 보완');
add('P03','Pipeline','PC·모바일 구조화 단계전환','Stage 진행','transition','from,to,transition_date,fields,skip_reason,memo,note','Deal stage/context + stage_history + Activity + optional replacement Next + private event/audit/receipt','12-op chained Dispatcher/read/UI candidate after stage-check; not applied',CANDIDATE,'LOCAL_CHAIN_DB_UI_PASS','stage-transition-ui.js:39-79; sql/20260905_structured_stage_transition.sql; sql/pipeline-transition/20260906','full chain Staging JWT/PC/mobile transition·derived child absorption·replay/conflict/read-back 검증; inquiry promote/terminal close는 별도 차단 유지');
add('P04','Pipeline','PC 구조화 종료·모바일 종료 폼','실주·배드핏·연락두절','close','from,outcome,closed_date,category,detail,reason_source,note','Deal outcome/lifecycle/context + completed open Next + stage history + Activity + private event/audit/receipt','13-op chained Dispatcher/read/UI candidate after transition; not applied',CANDIDATE,'LOCAL_CHAIN_DB_UI_PASS','stage-transition-ui.js:50-74; mobile.html:1631-1654; sql/pipeline-close-nonwon/20260906','full chain Staging JWT/PC/mobile lost·badfit·nocontact, pre/post child absorption, replay/conflict/read-back 검증');
add('P04W','Pipeline','PC·모바일 Closed Won','수주 종료','close; expansion_pool_upsert','completion evidence,won amount,completion date; child pool payload ignored','Deal closure + separate won monetary truth + private expansion Pool/event + history/activity/audit/receipt','local candidate after cumulative 25-op package; activity/pool child absorbed; not applied',CANDIDATE,'LOCAL_CHAIN_DB_UI_PASS','stage-transition-ui.js:63-77; mobile.html:1664-1674; sql/pipeline-close-won/20260906; docs/operational-cutover-20260906/pipeline-lifecycle-contracts.md','Staging 승인 후 JWT PC/mobile completion-only·evidence·amount·pool/read-back·replay/conflict·rollback-runtime-limit 검증');
add('P05E','Pipeline','PC Deal 상세·문제함','예상금액 저장·초기화','amount','amount; quote_amount is latest-quote snapshot; won_amount must be null','deals.amount + Deal version + private receipt/audit','14-op chained Dispatcher/read/UI candidate after non-won close; not applied',CANDIDATE,'LOCAL_CHAIN_DB_UI_PASS','crm.html:4661-4671; issue-modal.js:59-65; sql/pipeline-amount-expected/20260906','full chain Staging JWT/PC detail/problem-box update·zero clear·quote snapshot conflict·replay/read-back 검증');
add('P05Q','Pipeline','PC Deal 상세','사유 없는 견적금액 직접 편집','amount','quote_amount without adjustment reason','append-only quote_versions is authoritative','31-op cutover boundary; supported quote_version path remains',OUT_SCOPE,'NO','crm.html:4651,4661-4671; sql/pipeline-quote-version/20260906','운영에서는 사유가 남는 견적 Version 저장 경로 사용; 직접 편집은 이번 전환 범위 밖');
add('P05W','Pipeline','PC Deal 상세','수주 전 수주금액 직접 편집','amount','won_amount without closure evidence','Closed Won monetary truth','31-op cutover boundary; supported close/won path remains',OUT_SCOPE,'NO','crm.html:4651,4661-4671; stage-transition-ui.js:63-77','운영에서는 준공·수주 종료 경로 사용; 수주 전 직접 편집은 이번 전환 범위 밖');
add('P06','Pipeline','PC·모바일 공종 편집','대표·복합 공종 저장','opportunity_work_set','primary/items/scope/summary/reason/version','deals work fields + activity/audit','strict Staging Supabase; current UI n8n',FROZEN,'YES','crm.html:7148; mobile.html:1555','회귀만 수행');
add('P07','Pipeline','PC·모바일 사업유형 편집','사업유형 변경','service_change','from/to service,origin,reason,next,at','deals business/history/activity/optional next + private receipt/audit','strict Staging Supabase; current UI n8n',FROZEN,'YES_VERSION_HISTORY_ACTIVITY','crm.html:7120; mobile.html:1775; sql/operational-bundle/20260906; docs/operational-cutover-20260906/operational-bundle-final.json','UI Adapter correlation 후 회귀만 수행');
add('P08','Pipeline','PC 상세·split·Today / 모바일 통화메모·연락시도','독립 활동 기록','activity','intent=standalone,type,note,result,occurred_at,meaningful_contact','activities + Deal activity/contact timestamps + private receipt/audit','8-op chained Dispatcher/UI candidate after T03; not applied',CANDIDATE,'LOCAL_CHAIN_DB_UI_PASS','crm.html:3528,4676,5230,6009; mobile.html:1403,1490-1508; sql/pipeline-action-bundle/20260906','T03 적용 후 live baseline 재캡처·Staging 적용 승인·JWT/browser 검증');
add('P08C','Pipeline','PC split 응대','의미있는 접촉 체크를 Activity에 통합','activity; contact','meaningful_contact boolean; legacy contact absorbed','single activity/contact evidence + KPI','UI overlay + action helper chain candidate after T03; not applied',CANDIDATE,'LOCAL_CHAIN_DB_UI_PASS','crm.html:6009-6010; sql/pipeline-action-bundle/20260906/operational-overlay.candidate.js','T03 후 Staging에서 Activity 1건·contact timestamp·legacy contact request 0 검증');
add('P09','Next Action','PC Deal 상세·split 기본 입력','Next 생성·현재 open 교체','next_action','intent=standalone,type,text,due_at,assignee','next_actions + Deal summary + private receipt/audit','8-op chained Dispatcher/UI candidate after T03; not applied',CANDIDATE,'LOCAL_CHAIN_DB_UI_PASS','crm.html:4681,6020; sql/pipeline-action-bundle/20260906','T03 적용 후 live baseline 재캡처·Staging 적용 승인·JWT/browser 검증');
add('P09M','Next Action','모바일 Today Deal 통화결과','진행됨·다음주 다시·못 받으심','next_action_complete/today_outcome; activity child absorbed; next_action child absorbed','server Action UUID,outcome; client child/time/count stripped','completed current Action + outcome Activity + replacement Next + Deal-level durable postpone count + Deal version/contact + audit/receipt','local cumulative candidate wraps public Dispatcher; current UI n8n; not applied',CANDIDATE,'LOCAL_CHAIN_DB_UI_PASS','mobile.html:1396-1416; sql/mobile-today-outcome/20260906','Staging JWT/mobile 세 결과·+3/+7/+1·meaningful contact·Deal-level count·child absorption·replay/reuse/stale/scope/read-back 검증');
add('P09X','Next Action','PC·모바일 Today','현재 open Action 연기','next_action/postpone','server action_id,due_at; client postpone_count/type/text stripped','same next_actions row due + private append-only postpone event + non-meaningful Activity + Deal version/audit/receipt','local candidate after M04; existing external op/ACK retained; not applied',CANDIDATE,'LOCAL_CHAIN_DB_UI_PASS','crm.html:3551; mobile.html:2380-2381; sql/next-action-postpone/20260906','Staging 승인 후 JWT PC/mobile 동일 Action UUID·KST 미래일·서버 count·replay/reuse/stale/scope/read-back/child Activity 흡수 검증');
add('P10','Next Action','PC·모바일 Today/할 일','Next 완료','next_action_complete','server action_id; legacy text/due/time stripped','next_actions completion + Deal summary + Activity + private receipt/audit','10-op chained Dispatcher/UI candidate after operational source; not applied',CANDIDATE,'LOCAL_CHAIN_DB_UI_PASS','crm.html:3548; mobile.html:781,2379; sql/pipeline-next-complete/20260906','T03→action→quote→operational source 적용 후 Staging JWT/PC/mobile complete/replay/conflict/read-back 검증');
add('P11','Next Action','PC Deal 상세','현재 행동 완료','next_action_complete','server action_id; missing legacy write added by overlay','same transaction as P10','same 10-op chained candidate; not applied',CANDIDATE,'LOCAL_CHAIN_DB_UI_PASS','crm.html:4683; sql/pipeline-next-complete/20260906','P10과 같은 Staging 회귀에서 상세 버튼의 Activity 1건·서버 write 1건 검증');
add('P12','Pipeline','PC 빠른관리 일괄 모달','단계·세부·담당·장기검토·Next 일괄변경','', 'bulk selection and values','LOCAL deal patches','31-op cutover boundary; local-only bulk helper excluded',OUT_SCOPE,'LOCAL_ONLY','crm.html:5685-5712','개별 담당·단계·Next 경로는 검증 완료; 다건 일괄 저장은 이번 전환 범위 밖');
add('P13','Pipeline','PC DCC 대기고객','기존 대기 Deal의 근거·재접촉 저장','waiting_context; next_action','reason,speaker,statement,wake,evidence,resume; client actor/time stripped','stage_contexts.waiting + wake + replacement Next + Activity + private receipt/audit','15-op chained Dispatcher/read/UI candidate after expected amount; not applied',CANDIDATE,'LOCAL_CHAIN_DB_UI_PASS','crm.html:7879-7880; sql/pipeline-waiting-context/20260906','full chain Staging JWT/PC DCC save·child absorption·KST date/read aliases·replay/conflict 검증; 대기 진입은 P03 유지');
add('P14','Pipeline','PC·모바일 견적','견적 Version 추가','quote_version','amount,reason; client version/actor/time ignored','private append-only quote_versions + Deal version + receipt/audit','9-op chained Dispatcher/UI candidate after action layer; not applied',CANDIDATE,'LOCAL_CHAIN_DB_UI_PASS','crm.html:7558; mobile.html:2398; sql/20260905_sales_execution_engine.sql; sql/pipeline-quote-version/20260906','T03→action 적용 후 live baseline/guard 생성·Staging JWT/PC/mobile append/replay/conflict/read-back 검증');
add('P15','Pipeline','PC·모바일 실행 체크','수동 체크리스트 토글','stage_check','stage_code,item_index,checked; client item_text stripped','deals.stage_checklist + Deal version + private receipt/audit','11-op chained Dispatcher/read/UI candidate after next completion; not applied',CANDIDATE,'LOCAL_CHAIN_DB_UI_PASS','crm.html:7630; mobile.html:2460; sql/20260905_sales_execution_engine.sql; sql/pipeline-stage-check/20260906','full chain 적용 후 manual toggle/replay/conflict/read-back 및 자동 항목 write 0 검증');
add('P16','Pipeline','수주 완료','확장관리 Pool 생성','expansion_pool_upsert','client child is absorbed; server derives source deal/site/work/won/completion/owner/next','private expansion pool + source Deal lineage + actor-scoped read','local close/won parent candidate; standalone child remains blocked; not applied',CANDIDATE,'LOCAL_CHAIN_DB_UI_PASS','stage-transition-ui.js terminal plan; mobile.html:1673; sql/pipeline-close-won/20260906','P04W Staging JWT에서 Pool 1건·준공+30일·Deal UUID scope·중복 0 검증; standalone update는 X01로 유지');

add('A01','고객자산','PC·모바일 연락처 폼','연락처·관리사무소·수신동의 저장','contact_upsert','person/site/phones/email/role/consent/optout','contacts + assignments/history','current UI n8n; Staging write storage blocker read-only reconfirmed',BLOCKED,'NO','crm.html:4577,7465; mobile.html:2299; sql/customer-asset-bundle/20260906/review.md; docs/operational-cutover-20260906/staging-customer-asset-write-preflight-20260906.json','UUID person·채널별 동의/철회 이력 서버 정본 승인 필요; 현재 custom_fields 관례 없음');
add('A02','고객자산','PC·모바일 관계도','의사결정 역할·관계 톤 저장','contact_relationship','opportunity,person,decision_role,tone','contact-opportunity relationship','current UI n8n; Staging relation/column absence read-only reconfirmed',BLOCKED,'NO','crm.html:7553; mobile.html:2394; sql/customer-asset-bundle/20260906/review.md; docs/operational-cutover-20260906/staging-customer-asset-write-preflight-20260906.json','(deal_id,contact_id) 관계 저장소와 이력 규칙 승인 필요');
add('A03','고객자산','PC 연락처','관리소장 근무지 이동','contact_move','person,from/to site,date,reason','contact assignments + movement history','current UI n8n; Staging destination ambiguity read-only reconfirmed',BLOCKED,'NO','crm.html:4614-4619; sql/customer-asset-bundle/20260906/review.md; docs/operational-cutover-20260906/staging-customer-asset-write-preflight-20260906.json','실제 multi-Deal Site가 있으므로 to_site_id와 선택적 to_opportunity_id 또는 Site-only 규칙 승인 필요');
add('A04D','고객자산','Deal 고객자산·Timeline','Deal 직접연결 연락처·근무이력 조회','','deal/contact ids','crm_contacts_scoped_v2 Deal-scoped projection','guarded public read replacement local candidate; Staging canonical preflight pass; not applied',READ_CANDIDATE,'STAGING_CANONICAL_PREFLIGHT_PASS','crm.html:siteMasterData; mobile.html:historySheetM; sql/customer-asset-bundle/20260906/staging-preflight.json; docs/operational-cutover-20260906/staging-function-canonical-compare.json','Staging 적용 승인 전 대기; 적용 시 authenticated owner/scoped-admin/foreign/anonymous read 회귀');
add('A04S','고객자산','현장·고객자산·Timeline','Site 1:N 권한범위 timeline 조회','','site/deal/inquiry/contact ids','authorized child rows grouped by Site in Golden UI','real Staging actor-scoped deal/inquiry rows + A04D contact history',STAGING_PASS,'AUTHORIZED_CHILDREN_ONLY','crm.html:siteTimeline/openSiteMaster; docs/operational-cutover-20260906/go-read-audit-20260907.json','회귀만 수행; 접근 불가 자식을 Site 전체라는 이유로 추가 노출하지 않음');
add('A05','고객자산','PC 데이터 정리','중복 preview·확인·apply','crm_cleanup_state/preview/apply','fingerprint + selected resolution','cleanup private state + canonical links','31-op cutover boundary; maintenance utility excluded',OUT_SCOPE,'NO','data-cleanup-ui.js:12,33-34; sql/operational-auxiliary/20260906/review.md; docs/operational-cutover-20260906/staging-auxiliary-entrypoints-20260906.json','일상 CRM 운영이 아닌 데이터 정리 도구로 별도 backlog 유지');

add('X01','확장관리','PC 확장 Pool','상태·다음접촉일 갱신','expansion_pool_update','source,status,next; client last/relationship/need/created/time stripped','private expansion Pool version/event + Deal audit/receipt','local candidate after Closed Won; Pipeline conversion remains separate; not applied',CANDIDATE,'LOCAL_CHAIN_DB_UI_PASS','crm.html:4452-4454; expansion-pool.js; sql/expansion-pool-update/20260906','Staging 승인 후 status/date·version conflict·scope·history/read-back·replay/reuse·rollback archive JWT 검증');
add('X02','확장관리','PC 확장 Pool','접촉·니즈 기록/문맥 조회','crm_expansion_note/context','source,body/context','private expansion note event + Deal audit/receipt; actor-scoped event context; dispatches unavailable','local candidate after X01; quote dispatch evidence and conversion remain blocked; not applied',CANDIDATE,'LOCAL_CHAIN_DB_UI_PASS','expansion-pool.js:21,25; sql/expansion-note-context/20260906','Staging 승인 후 note·scope·history/context·replay/reuse·rollback archive JWT 검증; X03 provider dispatch ledger 전까지 dispatches=[] 유지');
add('X03','확장관리','PC 견적 발송 확인','실제 견적 후 새 Opportunity 전환','expansion_quote_convert','source/site/work/owner/quote evidence','dispatch + child deal + lineage','31-op cutover boundary; provider-evidence conversion excluded',OUT_SCOPE,'NO','expansion-pool.js:40-52; sql/operational-auxiliary/20260906/review.md','확장 상태·접촉 기록은 검증 완료; provider 발송 증거 기반 자동 전환은 별도 외부연동 backlog');

add('T01','첨부/메모','PC·모바일 파일 등록','prepare→signed PUT→complete','attachment_prepare; attachment_complete','deal,file metadata,size/type/tags; server path','private Storage + private attachment metadata + audit/receipt','25-op cumulative candidate; authenticated Storage signer/upload; not applied',CANDIDATE,'LOCAL_DB_ADAPTER_UI_PASS','crm.html:7592-7601; mobile.html:2416-2426; sql/attachment-compat/20260906; docs/operational-cutover-20260906/attachment-contracts.md','누적 package Staging preflight 후 PC/mobile JWT 실제 File upload·replay/reuse·scope·owner/size/MIME·부분실패·read-back 검증; expired pending Storage API cleanup operator 필요');
add('T02','첨부/메모','PC·모바일 Gallery','ready 첨부 목록 표시','','deal id','ready-only safe metadata without object path/URL','25-op cumulative candidate deal_core projection; not applied',CANDIDATE,'LOCAL_DB_READ_UI_PASS','crm.html:execAttachPanel; mobile.html:openAttachmentGalleryM; sql/attachment-compat/20260906','Staging JWT에서 타 Deal 격리·pending 비노출·ready 새로고침 PC/mobile 동일성 검증');
add('T03','개인화','PC·모바일 Deal 상세','즐겨찾기·최근 본/작업','favorite_set; opportunity_touch','opportunity,user_key,favorite/kind/time','private per-actor user opportunity state + receipts','single Dispatcher + scoped read apply-ready local bundle; Staging canonical preflight pass; not applied',CANDIDATE,'STAGING_CANONICAL_PREFLIGHT_PASS','crm.html:7604-7605; mobile.html:2431-2432; sql/personal-state-compat/20260906/staging-preflight.json; sql/personal-state-compat/20260906/staging-live-baseline.json','Staging 적용 승인 전 대기; 적용 시 two-op fresh JWT/browser mutation과 frozen 4-op 회귀');

add('M01O','메시징','PC·모바일 연락처','전화·SMS·카카오 앱 열기','','phone/body/deep-link','OS external app','tel:/sms:/kakao URI',EXTERNAL,'N/A','crm.html:contactDial/openRelationshipMessage; mobile.html:callContactM/rmLaunchM; docs/operational-cutover-20260906/messaging-contracts.md','외부 앱 open을 통화·발송 성공으로 기록하지 않음');
add('M01A','메시징','PC·모바일 연락처','전화 앱 열기 전 시도 Activity','activity','opportunity,type,note,occurred_at,meaningful_contact=false','activities + Deal activity timestamp','current UI n8n; pipeline action local chain candidate',CANDIDATE,'LOCAL_CHAIN_DB_UI_PASS','crm.html:contactDial/contactActivity; mobile.html:callContactM; sql/pipeline-action-bundle/20260906; docs/operational-cutover-20260906/messaging-contracts.md','T03 뒤 action chain Staging JWT/PC·mobile 전화시도 1건·meaningful false·replay/conflict 검증; SMS/카카오 결과는 M02 유지');
add('M02','메시징','PC·모바일 발송 확인','발송·실패·취소 결과 기록','message_log','Deal UUID/version, person key, channel/template/body/status, optional quote/ready attachment, optional next action; client actor/phone/site/stage/time stripped','private user-attested message outcome + sent non-meaningful Activity + optional replacement Next Action + audit/receipt','local cumulative DB/UI candidate after O02+C04; external app launch remains non-evidence; not applied',CANDIDATE,'LOCAL_CHAIN_DB_UI_PASS','crm.html:7968; mobile.html:2567-2578; sql/message-log-compat/20260906; docs/operational-cutover-20260906/messaging-contracts.md','Staging JWT/PC·mobile sent·failed·cancelled, server contact/phone/actor, quote/ready attachment, atomic side effects, replay/reuse/stale/foreign scope, read-back 검증');
add('M03','메시징','PC·모바일 composer','문구 복사','','body','Clipboard','Clipboard API',EXTERNAL,'N/A','crm.html:relationshipCopy; mobile.html:rmCopyM; docs/operational-cutover-20260906/messaging-contracts.md','sent로 기록하지 않음');
add('M04','메시징','PC·모바일 composer','담당자 발송 알림 예약','next_action/message_reminder','scheduled/channel/template/draft','Next Action + private reminder + non-meaningful Activity + Deal audit/receipt','local candidate after X02; never provider auto-send; not applied',CANDIDATE,'LOCAL_CHAIN_DB_UI_PASS','crm.html:7517; mobile.html:2336; sql/message-reminder/20260906','Staging 승인 후 PC/mobile 예약·open Next 교체·Activity 1·read-back·replay/reuse·scope·rollback archive JWT 검증');
add('M05','메시징','PC·모바일 관계관리','접촉 보류·회신 cadence 초기화','relationship_hold; relationship_response','hold date/reason + absorbed Next; response kind + absorbed meaningful Activity; client actor stripped','private relationship event + Deal wake/version + targeted message response/linked Next cancellation + audit/receipt','named PC/mobile wrappers + private RLS event ledger + M02 outcome correlation + scoped read + rollback; local DB/UI 11 PASS',CANDIDATE,'LOCAL_CHAIN_DB_UI_PASS','crm.html:7675,7695; mobile.html:2502,2515; sql/relationship-cadence-compat/20260906; docs/operational-cutover-20260906/messaging-contracts.md','Staging 적용 전 M02 선행 drift/ACL/manifest 확인 및 hold/response JWT·read-back·rollback preflight 필요');
add('M06','메시징','PC 문자발송 메뉴','다중 대상 즉시·예약 대기열','campaign_create','campaign/template/body/schedule/recipients','campaign queue + provider callbacks','approved retained n8n/provider boundary; outside Supabase 31-op cutover',OUT_SCOPE,'NO','crm.html:8045-8046; docs/operational-cutover-20260906/messaging-contracts.md; docs/operational-cutover-20260906/n8n-allowed-boundary.md','문자 provider는 승인된 n8n 유지 경계이며 본문·운영 endpoint를 이번 Staging 전환에서 변경하지 않음');

add('O01','관리','PC 영업사원 관리','주간 코멘트·완료 상태','rep_manager_comment','rep,week,comment,status; client actor/time stripped','weekly mutable comment snapshot + append-only audit','current UI n8n; UUID team eligibility unavailable',BLOCKED,'NO','crm.html:3827-3846; sql/20260905_sales_rep_management.sql; sql/customer-support-action/20260906/review.md','실제 UUID 사용자에 head_office/internal/performanceIncluded 정본을 승인; Golden 여섯 이름을 서버 권한표로 하드코딩하지 않음');
add('O02','관리','PC 고객지원 카드','지원 요청 기록','customer_support_action','target UUID,client_ref,action key/label,reason,completion rule; client actor/time/status/rep/site stripped','private append-only requested support ledger + common receipt + admin-scoped read','local candidate after P09M; downstream Activity/Next remains independent; not applied',CANDIDATE,'LOCAL_CHAIN_DB_UI_PASS','crm.html:3848-3872; sql/20260905_customer_support_actions.sql; sql/customer-support-action/20260906','Staging JWT/admin Deal·문의 scope·rep UUID·16 action keys·read-back·replay/reuse 검증; downstream 실행 완료로 자동 승격 금지');
add('O03','관리','PC 대시보드','연간 목표 변경','','year,goal','browser setting','Golden localStorage preference; no n8n dependency',LOCAL_PREF,'LOCAL_ONLY','crm.html:setYearGoal; sql/operational-auxiliary/20260906/review.md; docs/operational-cutover-20260906/staging-dashboard-state-preflight-20260906.json','현행 Golden 브라우저 설정으로 유지; 서버 조직목표 신규 설계는 범위 밖');
add('O04','관리','PC 관리자 Export','범위 제한 JSON export','crm_export_create','date range,columns,MFA context','private export job/audit','31-op cutover boundary; administrative export excluded',OUT_SCOPE,'NO','crm-export.js:16,38; sql/operational-auxiliary/20260906/review.md; docs/operational-cutover-20260906/staging-auxiliary-entrypoints-20260906.json','일상 CRM 핵심 경로가 아닌 관리자 Export로 별도 backlog 유지');
add('O05','관리','모바일 설정·보고·채널 버튼','알림/휴가위임/채널발송/PDF/병합 요청','', 'UI values','memory/toast only','no transport',MOCK,'NO','mobile.html:2149-2230; sql/operational-auxiliary/20260906/review.md','각 버튼을 실제 구현하거나 UI에서 명확히 미지원으로 승인');
add('O06','관리','PC 문의 일괄','잔디 쪼기','', 'selected inquiries','notice only','no transport',MOCK,'NO','crm.html:6355-6411; sql/operational-auxiliary/20260906/review.md','provider/channel·동의·수신자·receipt 규칙 확정 후 메시징 편입');
add('O07S','조회/분석','PC Dashboard','권한 범위 Deal·문의 원천행 조회','','domain/cursor/limit','authorized deal/inquiry core rows','new authenticated domain-paged public source local chain candidate after T03; existing scoped read unchanged',READ_CANDIDATE,'LOCAL_CHAIN_DB_UI_PASS','crm.html:towerBase/dashboardSnapshotDeals; sql/operational-read-source/20260906','T03 적용 후 live baseline/OID/hash guard 생성 및 Staging JWT pagination 검증');
add('O07D','조회/분석','PC Dashboard','KPI·드릴다운','','period/brand/owner/stage','actor-scoped deal/inquiry rows → Golden role dashboard aggregates + admin Pipeline drilldown','real Staging Auth + crm_operational_source_v1 browser verified for six synthetic roles; not Production deployed','STAGING_JWT_E2E_PASS_20260906','BROWSER_ROLE_DASHBOARD_AND_ADMIN_DRILLDOWN_PASS','crm.html:paintTower,paintTowerMoney,paintTowerMine,towerDrill; docs/operational-cutover-20260906/operational-dashboard-browser.json','Production 배포 전 동일 assembled UI 회귀만 필요');
add('O07P','조회/분석','PC Performance','담당자 실적 점수·상세','','period/rep','actor-scoped performance inputs','real Staging source includes stage/action/inquiry lineage and Golden target preference',STAGING_PASS,'ACTOR_SCOPE_COMPLETE','crm.html:paintPerformance; docs/operational-cutover-20260906/go-read-audit-20260907.json','회귀만 수행; 목표는 기존 Golden 브라우저 설정을 유지');
add('O07R','조회/분석','PC Executive Report','전월·전년·분기·담당자 보고','','period/brand/owner','authorized aggregates + source rows','real Staging source includes quote/won/period/owner fields; scope stays server-authorized',STAGING_PASS,'ACTOR_SCOPE_COMPLETE','crm.html:paintReportV2; docs/operational-cutover-20260906/go-read-audit-20260907.json','회귀만 수행; 화면의 전체는 현재 사용자 권한 범위 전체를 뜻함');
add('O07G','조회/분석','PC 경남','지사 인계·응대·영업 KPI','','period/branch/owner','authorized branch inquiry/deal rows','real Staging inquiry assignee_permission_role + scoped Deal fields; Golden branch roster retained',STAGING_PASS,'ACTOR_SCOPE_COMPLETE','crm.html:paintGyeongnam; docs/operational-cutover-20260906/go-read-audit-20260907.json','read 회귀만 수행; branch_handoff/branch_owner_assign 쓰기는 별도 UUID gate 유지');
add('O08M','조회/분석','모바일 내 건','담당 Deal 목록·상세 이동','','domain/cursor/limit','authorized owned/scoped deal core rows','new authenticated domain-paged public source local chain candidate after T03; existing scoped read unchanged',READ_CANDIDATE,'LOCAL_CHAIN_DB_UI_PASS','mobile.html:rMine; sql/operational-read-source/20260906','T03 적용 후 live baseline/OID/hash guard 생성 및 Staging JWT/mobile read 검증');
add('O08T','조회/분석','모바일 Today','권한 범위 목록·Deal Next 완료·문의 세 응대결과·문의 연기','next_action_complete; inquiry_assign/response_*; inquiry_followup','actor-scoped Deal/inquiry rows + server Next UUID + response/followup timestamps','deal/inquiry/next/response signals','operational source + next complete + three inquiry response intents + inquiry followup local chain candidate',CANDIDATE,'LOCAL_CHAIN_DB_UI_PASS','mobile.html:buildToday/rToday/todayCompleteM/pickToday/applyTodayPostponeM; sql/operational-read-source/20260906; sql/pipeline-next-complete/20260906; sql/inquiry-response-progress/20260906; sql/inquiry-followup/20260906','full chain Staging JWT/mobile 목록·Deal 완료·문의 세 응대결과·future-hide/today/overdue·replay/read-back 검증');
add('O08C','조회/분석','모바일 관리','관리 목록·필터·상세 이동','','role/mode/filter','authorized management rows','six-role real Staging browser read PASS; no implicit global expansion',STAGING_PASS,'ACTOR_SCOPE_COMPLETE','mobile.html:rCtrl; docs/operational-cutover-20260906/operational-full-ui-browser-read.json; docs/operational-cutover-20260906/go-read-audit-20260907.json','회귀만 수행; 관리 목록도 서버가 허용한 범위만 표시');
add('O08S','조회/분석','모바일 검색','내 권한 현장·담당·대표 연락처 검색','','query text','actor-scoped Deal core + directly linked primary contact','operational source local chain now maps persisted site/owner/amount/date/contact into Golden mobile shape; not applied',READ_CANDIDATE,'LOCAL_CHAIN_DB_UI_PASS','mobile.html:rSearch/srchDo; sql/operational-read-source/20260906','T03→action→quote→operational source 적용 후 Staging JWT/mobile 현장·담당·전화 검색 및 foreign result 0 검증');
add('O08A','조회/분석','모바일 CRM에게 물어보기','Today·방문·고액·기술자문·미접촉·견적발송·과거근무지 조건검색','','natural-language query/filter','actor-scoped Deal + linked contacts + quote/activity/history projections','real Staging deal_core fields + A04D contact assignment history are present',STAGING_PASS,'ACTOR_SCOPE_COMPLETE','mobile.html:crmAskM/askResultHTMLM/crmMonthQuoteM; docs/operational-cutover-20260906/go-read-audit-20260907.json','회귀만 수행; 질문은 read-only 필터이며 권한 밖 결과를 확장하지 않음');
add('O09','외부연동','PC·모바일 ASQ 카드','운영 프로젝트 열기','','https URL','external ASQ page','HTTPS external link',EXTERNAL,'N/A','crm.html:asqOperationHTML; mobile.html:asqCardM','CRM에서는 read-only 유지');

// Preserve the reviewed per-scenario Staging result when this deterministic
// inventory is rebuilt after a UI-only source change. Functional E2E evidence
// and fixture cleanup are separate gates: the later browser run passed all 35
// scenarios, and its exact approved fixture cleanup is independently proven.
// Candidate/read rows covered by that run must not silently regress to local
// candidate because unrelated coverage gates remain open.
function applyRecordedStagingEvidence(){
 const applicationPath=path.join(out,'staging-31-op-application-20260906.json');
 const runPath=path.join(out,'staging-fixture-runs','stg-e2e-20260906t125239z-fc70f2d2');
 const proofPath=path.join(runPath,'browser-mutation-proof.json');
 const cleanupPath=path.join(runPath,'cleanup-verification-current.json');
 if(![applicationPath,proofPath,cleanupPath].every(fs.existsSync))return;
 const application=JSON.parse(fs.readFileSync(applicationPath,'utf8'));
 const proof=JSON.parse(fs.readFileSync(proofPath,'utf8'));
 const cleanup=JSON.parse(fs.readFileSync(cleanupPath,'utf8'));
 const valid=application.project_ref==='rprechiaglyjaydkmxsu'
  && application.status==='APPLIED_READ_JWT_BROWSER_MUTATION_35_OF_35_STORAGE_POLICY_CLEANUP_PASS'
  && application.fixture?.run_id===proof.run_id
  && application.fixture?.cleanup_status==='PASS'
  && cleanup.status==='PASS'&&cleanup.run_id===proof.run_id
  && cleanup.post_cleanup?.verified_fixture_db_rows_remaining===0
  && cleanup.post_cleanup?.generated_residual_rows_remaining===0
  && cleanup.post_cleanup?.storage_objects_remaining===0
  && application.production_accessed===false&&application.n8n_accessed===false
  && application.fixture?.mutation_scenarios?.pass===35
  && application.fixture?.mutation_steps?.pass===75
  && proof.project_ref==='rprechiaglyjaydkmxsu'&&proof.scenario_pass===35
  && proof.step_pass===75&&proof.step_fail===0&&proof.blocked_count===0
  && (proof.results||[]).length===75&&(proof.results||[]).every(x=>x.status==='PASS')
  && proof.production_requests===0&&proof.n8n_requests===0
  && Array.isArray(proof.violations)&&proof.violations.length===0;
 if(!valid)throw Error('Recorded Staging evidence drift; refusing coverage promotion');
 for(const row of rows){
  if([CANDIDATE,READ_CANDIDATE].includes(row.adapter_status)){
   row.adapter_status=STAGING_PASS;
   row.evidence+='; docs/operational-cutover-20260906/staging-fixture-runs/'+proof.run_id+'/mutation-proof.json';
   row.next='Staging 회귀만 수행; Production cutover 전 UI 배포 리허설 유지';
  }
 }
}
applyRecordedStagingEvidence();

// Promote only the eight formerly UUID/business-rule-blocked paths proven by
// the dedicated real-JWT Staging run.  The proof and its exact cleanup must
// both remain valid; unrelated unconnected features stay blocked.
function applyOperationalGoEvidence(){
 const proofPath=path.join(out,'staging-go-eight-jwt-results.json');
 const cleanupPath=path.join(out,'staging-fixture-runs','stg-e2e-20260906t225700z-90c0ffee','cleanup-verification-current.json');
 if(![proofPath,cleanupPath].every(fs.existsSync))return;
 const proof=JSON.parse(fs.readFileSync(proofPath,'utf8'));
 const cleanup=JSON.parse(fs.readFileSync(cleanupPath,'utf8'));
 const valid=proof.project_ref==='rprechiaglyjaydkmxsu'
  && proof.status==='PASS'&&proof.pass===10&&proof.fail===0&&proof.skip===0
  && proof.n8n_requests===0&&proof.production_requests===0
  && (proof.results||[]).length===10&&(proof.results||[]).every(x=>x.status==='PASS')
  && cleanup.project_ref==='rprechiaglyjaydkmxsu'&&cleanup.status==='PASS'
  && cleanup.post_cleanup?.verified_fixture_db_rows_remaining===0
  && cleanup.post_cleanup?.storage_objects_remaining===0
  && cleanup.post_cleanup?.temporary_storage_policies_remaining===0
  && cleanup.post_cleanup?.canonical_deals===5&&cleanup.post_cleanup?.canonical_inquiries===5
  && cleanup.production_requests===0&&cleanup.n8n_requests===0;
 if(!valid)throw Error('Operational GO Staging evidence drift; refusing coverage promotion');
 const ids=new Set(['I16','I17','I18','P02','A01','A02','A03','O01']);
 for(const row of rows){
  if(ids.has(row.id)){
   if(row.adapter_status!==BLOCKED)throw Error('Operational GO row status drift: '+row.id);
   row.adapter_status=STAGING_PASS;
   row.rule_status='CONFIRMED';
   row.read_after_write='STAGING_JWT_READBACK_PASS';
   row.evidence+='; docs/operational-cutover-20260906/staging-go-eight-jwt-results.json; '+path.relative(root,cleanupPath).replaceAll('\\','/');
   row.next='Staging 회귀만 수행; Production cutover 전 UI 배포 리허설 유지';
  }
 }
}
applyOperationalGoEvidence();

const dead=[
 {id:'D01',surface:'PC 문의 구형 단일 배정',operations:'inquiry_assign',evidence:'crm.html:4251-4257',reason:'후대 Control Center 경로가 대체; 호출 UI 증거 없음'},
 {id:'D02',surface:'PC 구형 Pipeline bulk',operations:'',evidence:'crm.html:4913,4919',reason:'현재 applyBulkDialog 경로로 대체'},
 {id:'D03',surface:'PC 문의 중복 op',operations:'inquiry_duplicate',evidence:'crm.html:7828; docs/operational-cutover-20260906/inquiry-management-contracts.md',reason:'정의는 있으나 현재 빠른메뉴는 DataCleanupUI로 이동'},
 {id:'D04',surface:'모바일 구형 contact 저장',operations:'contact_upsert',evidence:'mobile.html:1499,1506',reason:'후대 consent 포함 정의가 shadow'},
 {id:'D05',surface:'모바일 관리소장 이동',operations:'contact_move',evidence:'mobile.html:1509-1515',reason:'최종 contactCardM에 진입 버튼 없음; PC op는 살아 있음'},
 {id:'D06',surface:'모바일 구형 수주',operations:'win',evidence:'mobile.html:1672',reason:'StageTransitionUI가 진입 handler를 교체; 현재 수주는 close 사용'},
 {id:'D07',surface:'모바일 구형 inline 단계전환',operations:'transition',evidence:'mobile.html:1693-1704',reason:'StageTransitionUI form이 대체; transition op는 살아 있음'},
 {id:'D08',surface:'메시지 기반 단계진행 wrapper',operations:'message_stage_advanced',evidence:'crm.html:7697; mobile.html:2517',reason:'후대 StageTransitionUI override 뒤 호출 증거 없음'},
 {id:'D09',surface:'모바일 구형 Today quick/skip',operations:'',evidence:'mobile.html:1383,2026-2034',reason:'최종 rToday가 대체'},
 {id:'D10',surface:'모바일 구형 사진 sheet',operations:'',evidence:'mobile.html:2233-2246',reason:'attachment gallery가 대체'},
 {id:'D11',surface:'모바일 PIN 로그인·spawnExpansion·voice draft',operations:'',evidence:'mobile.html:1292-1307,1677; crm.html:4318',reason:'호출 UI 없음 또는 첫 return으로 차단'}
];

const csv=(items,keys)=>'\ufeff'+[keys.join(','),...items.map(row=>keys.map(k=>'"'+String(row[k]??'').replaceAll('"','""')+'"').join(','))].join('\n')+'\n';
fs.mkdirSync(out,{recursive:true});
fs.writeFileSync(path.join(out,'coverage-matrix.csv'),csv(rows,['id','domain','surface','action','operations','payload','target','transport','n8n_dependency','rule_status','adapter_status','read_after_write','evidence','next']));
fs.writeFileSync(path.join(out,'dead-overrides.csv'),csv(dead,['id','surface','operations','evidence','reason']));

const entryFiles=['index.html','crm.html','mobile.html'];
const loadedFiles=new Set(entryFiles);
for(const html of ['crm.html','mobile.html']){
 const body=fs.readFileSync(path.join(root,html),'utf8');
 for(const match of body.matchAll(/<script\s+[^>]*src=["']([^"':?]+\.js)(?:\?[^"']*)?["']/gi)){
  const relative=match[1].replaceAll('\\','/');
  if(fs.existsSync(path.join(root,relative)))loadedFiles.add(relative);
 }
}
const sha256=file=>crypto.createHash('sha256').update(fs.readFileSync(path.join(root,file))).digest('hex');
const sourceManifest={generated_at:new Date().toISOString(),basis:'current local PC/mobile entrypoints and directly loaded local scripts',files:[...loadedFiles].sort().map(file=>({file,sha256:sha256(file)}))};
fs.writeFileSync(path.join(out,'source-manifest.json'),JSON.stringify(sourceManifest,null,2)+'\n');

// Every literal pushWrite operation in the current UI must be represented as reachable,
// blocked, or dead. This is a completeness guard, not runtime reachability proof.
const source=['crm.html','mobile.html'].map(f=>fs.readFileSync(path.join(root,f),'utf8')).join('\n');
const literalOps=[...new Set([...source.matchAll(/pushWrite\(\s*['"]([^'"]+)['"]/g)].map(x=>x[1]))].sort();
const mapped=new Set([...rows,...dead].flatMap(r=>String(r.operations||'').split(';').map(x=>x.trim().split('/')[0]).filter(Boolean)));
const missing=literalOps.filter(x=>!mapped.has(x));
if(missing.length)throw Error('Unmapped current pushWrite operations: '+missing.join(', '));

const counts=rows.reduce((a,r)=>(a[r.adapter_status]=(a[r.adapter_status]||0)+1,a),{});
const md=`# 운영 완전 전환 Coverage — 2026-09-06

판정: **NO-GO / INVENTORY_BASELINE_COMPLETE**. 완료 기준은 행이나 op 개수가 아니라 현재 도달 가능한 업무의 Staging E2E 100%다.

## 정본과 범위

- 기준 UI: 현재 로컬 \`crm.html\`, \`mobile.html\` 및 두 파일이 직접 로드하는 overlay. 운영 Pages, Production, n8n 본문은 조회하지 않았다.
- 방법: 메뉴·버튼·모달·form submit·input change에서 최종 handler와 write/read 호출까지 정적 역추적했다. 동일명 구형 함수는 최종 override와 분리했다.
- \`coverage-matrix.csv\`는 업무 행동 중심 장부이며 reachable mock도 명시한다. \`dead-overrides.csv\`는 현재 UI에서 호출되지 않거나 후대 정의에 덮인 코드만 분리한다.
- literal \`pushWrite\` ${literalOps.length}종을 모두 reachable/blocked/dead 행 중 하나에 매핑했다. 이 숫자는 완료율이 아니다.

## 현재 결과

- Staging n8n-free 완료·동결: \`opportunity_work_set\`, \`inquiry_assign/direct_assign\`.
- Staging 검증 완료: 문의 scoped read, \`inquiry_unassign\`, \`service_change\`를 단일 공개 Dispatcher 뒤의 한 transaction bundle로 적용했다.
- 실제 JWT 13/13, 기존 JWT 회귀 11/11, private receipt/audit exact count, synthetic 표시 상태 복구가 모두 PASS했다.
- 별도 \`staging-operational\` UI 후보는 실제 Staging 6역할 × PC/mobile 12조합 Auth/scoped read에서 PASS했다. 4개 승인 op의 브라우저 transport는 4/4 PASS했지만 direct/unassign은 기존 receipt replay이므로 fresh 버튼 mutation E2E와 실제 배포, 전체 read는 아직 남아 있다. Production/n8n 요청은 0건이다.
- 첨부 T01/T02는 Staging에서 prepare→authenticated signed upload→complete→ready read까지 PASS했다. 이후 브라우저 재실행으로 생성된 exact Storage object 1개와 fixture DB 448행을 승인된 정확 범위로 삭제했고 fixture/잔여/Storage 0 및 canonical 원복을 확인했다.
- 고객자산 A04D와 개인상태 T03은 로컬 후보 검증과 Staging read-only canonical preflight를 통과했다. 초기 raw MD5 차이는 CRLF/source formatting 차이였고 전체 함수 본문을 재대조했다. 현재 Staging 적용은 0이며 승인 전 대기한다.
- Dashboard 원천행과 Mobile Mine은 기존 scoped read를 바꾸지 않는 별도 authenticated domain-paged source의 로컬 체인 후보까지 통과했다. 초기 mobile 변환이 persisted 현장명·담당·금액·날짜·대표 연락처를 버리던 문제를 교정했고, 단순 모바일 검색(O08S)도 같은 actor scope 후보에 연결했다. 자연어 고급검색(O08A)의 견적발송·과거근무지는 별도 projection 전까지 차단한다. T03 적용과 live guard/JWT pagination 검증 전에는 Staging 연결로 계산하지 않는다.
- 위 개인화/read/Pipeline/문의관리 후보 15개 delta는 \`sql/reachable-operations-bundle/20260906/\`에서 frozen 4-op → 21-op 상태의 단일 transaction apply와 역순 단일 transaction rollback으로 합성했다. 마지막 단계의 의도적 실패가 앞선 모든 계층을 원복하고, 전체 apply 후 rollback이 frozen baseline으로 돌아오는 것을 격리 PostgreSQL에서 검증했다. 이 번들은 아직 Staging 미적용이며 JWT/E2E PASS가 아니다.
- 현재 최상위 누적본은 \`sql/operational-cutover-candidate/20260906/\`이다. 위 21-op에 직접/문의승격 \`opportunity_create\`, 문의 기존 Deal 승격 \`transition\`, I03P/I03N/I03M 문의 응대 세 intent, \`lineage_link\`, A04D Deal-scoped 연락처/근무이력 read, lineage-first Deal read를 더해 23-op+세 read 보충을 한 transaction apply/역순 rollback으로 합성했다. 마지막 계층 실패와 runtime create/promote/link 뒤 rollback 차단도 격리 PostgreSQL에서 검증했다.
- Pipeline action/quote 체인 뒤에 Next Action 완료(P10/P11)를 붙인 로컬 후보까지 검증했다. 완료 command는 server UUID만 정본으로 받고 Action·Deal summary·Activity·version·private audit·receipt를 한 transaction으로 처리한다. operational source가 UUID를 PC/mobile alias에 공급하기 전에는 Staging 연결로 계산하지 않는다.
- Stage checklist 수동 토글(P15)은 같은 체인 뒤의 로컬 후보로 검증했다. 서버가 최종 PC/mobile guide의 수동 index만 허용하고, 자동 항목은 기존 CRM 데이터에서 계속 계산하며 write하지 않는다.
- 구조화된 비종료 Stage 전환(P03)은 P15 뒤의 로컬 후보로 검증했다. 단계별 fields와 graph를 서버가 검증하고 Deal context·history·Activity·필요한 replacement Next·private event/audit/receipt를 한 transaction으로 처리한다.
- 비수주 종료(P04: 실주·배드핏·연락두절)는 P03 뒤의 로컬 후보로 검증했다. PC의 parent 후 Activity와 모바일의 parent 전 Activity/Next 완료를 모두 \`close\` 한 transaction에 흡수하고 종료 전 stage를 보존한다.
- Closed Won(P04W/P16)은 25-op 누적 후보 뒤의 별도 로컬 후보로 검증했다. 최종 PC/mobile 구조화 UI의 준공일·공사 완료·준공검사 완료·최종 수주금액만 받으며, 예상금액과 분리된 won 정본·private expansion Pool·history/Activity/audit/receipt를 한 transaction으로 저장한다. 뒤따르는 \`activity\`와 \`expansion_pool_upsert\`는 흡수하고 Pool UUID/site/owner/work는 잠긴 Deal에서 서버가 만든다.
- 확장관리 X01은 Closed Won 후보 뒤에서 상태 5종과 다음 접촉일만 받는 별도 로컬 후보로 검증했다. private Pool version/event, Deal scope/audit, receipt를 한 transaction으로 쓰고, Pipeline 전환·접촉메모·client actor/time은 계속 분리한다.
- Next Action 연기(P09X)는 메시지 실행 알림(M04) 뒤의 별도 \`next_action/postpone\` 로컬 후보로 검증했다. PC \`todoDelay\`와 모바일 Deal \`applyTodayPostponeM\`만 실제 read가 공급한 open Action UUID를 사용하며, 같은 Action의 due·서버 계산 연기 횟수·Activity·Deal version·audit·receipt를 한 transaction으로 저장한다. 모바일 문의 연기는 기존 \`inquiry_followup\`으로 유지하고 임시 \`na-*\`, client count/type/text, 같거나 이른 날짜는 차단한다.
- 모바일 Today Deal 통화결과(P09M)는 기존 \`next_action_complete\` 아래 \`today_outcome\` intent로 분리한 로컬 후보로 검증했다. 진행됨·다음주 다시·못 받으심만 도달 가능하며, 현재 Action 완료·결과 Activity·replacement Next·Deal version/contact·audit/receipt를 한 transaction으로 처리한다. 다음주 결과만 P09X와 공유하는 Deal 단위 \`postpone_count\`를 올린다. 구형 \`quick/pickSkip\` 경로는 최종 \`rToday/execTaskRowM\`에서 호출되지 않아 D09 dead code로 유지한다.
- 고객관리 지원요청(O02)은 기존 \`customer_support_action\`을 관리자 요청 ledger로만 연결한 로컬 후보로 검증했다. 버튼 직후의 요청 1건과 receipt만 원자 저장하고, 뒤이어 열리는 전화·메시지·Activity·Next는 각 기존 기능으로 남긴다. client actor/time/status/rep/site는 버리고 잠긴 Deal/문의와 현재 승인된 rep UUID를 서버가 다시 확인한다.
- 저장 실패 재시도(C04)는 새 op가 아니라 누적 명령 큐 복구로 연결했다. 네트워크·응답 유실인 \`uncertain\`만 저장된 동일 request_id/operation/object/version/payload로 다시 보내며, \`conflict\`와 \`rejected\`는 확인 필요 상태로 남겨 자동·수동 재전송하지 않는다.
- 영업사원 주간 코멘트(O01)는 UI와 과거 SQL상 \`(담당자,주차)\` mutable snapshot 의미까지는 확정됐지만, 실제 UUID 사용자에 본사 내부 6명을 식별할 team 정본이 없다. Golden 이름 여섯 개를 권한 allowlist로 만들지 않고 O01은 별도 team/eligibility 승인 전까지 차단한다.
- 예상금액(P05E)은 P04 뒤의 로컬 후보로 분리했다. actual \`deals.amount\`만 바꾸고 최신 견적금액은 append-only \`quote_version\`의 concurrency snapshot으로 대조하며 수주금액은 null만 허용한다. PC 상세·문제함의 같은 \`amount\` op와 read alias를 유지하되 P05Q/P05W 직접 편집은 별도로 계속 차단한다.
- 기존 대기 Deal의 근거·재접촉 저장(P13)은 P05E 뒤의 로컬 후보로 검증했다. waiting context·replacement Next·Activity·Deal version·private audit/receipt를 한 transaction으로 묶고, 기존 UI의 뒤따르는 \`next_action\`은 흡수한다. 대기 단계 진입 자체는 P03 구조화 전환에 남긴다.
- 기술자문 문의 재분류(I14)는 P13 뒤의 로컬 후보로 검증했다. 기술자문 Deal 이관(I15)도 누적 후보의 마지막 레이어로 분리해, admin scope·현재 inquiry 정본만으로 nullable owner/site를 결정하고 Deal·문의 backlink·history/activity·양쪽 private audit·receipt를 한 transaction에 저장한다. 기존 UI의 뒤따르는 \`inquiry_status\`는 부모 command에 흡수한다.
- 상담담당 지정(I16)은 Staging read-only 확인 결과 \`public.sales_people\`가 없고 현재 reviewed role은 \`admin/rep/branch/consultation\`만 구분한다. UI가 상담 가능한 영업담당까지 후보로 노출하므로 \`consultation\` role만으로 축소하거나 모든 \`rep\`로 확대하지 않고, UUID 기반 eligibility 정본이 승인될 때까지 차단한다.
- 관리자 수동 완전삭제(I13)는 trash/restore 상태 정본 뒤의 로컬 후보로 검증했다. latest trash와 양방향 Deal lineage를 서버에서 재확인하고 RESTRICT인 object scope 제거, FK child cascade, private immutable audit/receipt를 한 transaction으로 처리한다. runtime purge는 복구 불가이므로 migration rollback은 purge 사용 전만 허용하며 자동 purge는 별도 차단한다.
- 문의 후속일 연기(I08)는 Actual \`inquiries.next_action_date\`를 정본으로 쓰는 로컬 후보로 검증했다. 기존 payload에 없는 Next UUID·제목·유형을 발명하지 않고 current assigned UUID actor만 미래 날짜를 저장하며, Mobile Today가 새로고침 뒤 미래 due를 숨기고 당일·기한초과에 다시 표시한다.
- 직접 신규 Pipeline(P01)은 21-op 누적 후보 뒤에 붙는 별도 \`opportunity_create\` 로컬 후보로 검증했다. 공통 exact Site key만 자동 재사용하고 PC/mobile 전용 broad 차이는 409로 멈추며, reviewed UUID owner matrix와 PC Activity 1/Next 0·모바일 Activity 1/Next 1을 한 transaction으로 처리한다. 문의 promote·기술자문·확장 전환은 같은 op 이름이어도 계속 차단한다.
- 문의 응대(I03P/I03N/I03M)는 기존 \`inquiry_assign\` 아래의 세 내부 intent로 분리했다. assigned UUID인 rep/consultation만 허용하며 진행·다음주 응답은 최초응대를 한 번 기록하고 마지막시각을 갱신한다. 부재는 미응대 timestamp를 보존한다. 다음주·부재 후속일은 서버 KST 기준 각각 7일·1일 뒤이고 private append-only audit와 scoped response history를 함께 남긴다.
- PC 문의 상세 진행(I04)은 기존 \`inquiry_status\` 아래 \`progress\` intent로 분리했다. 비종료 단계 0~5만 허용하고 현재 status를 optimistic token으로 비교하며, 문의 응대시각·단계이력·기존 open 후속 취소·새 Next Action·private audit/receipt를 한 transaction으로 처리한다. 보류와 종료 의미는 계속 별도 차단한다.
- 일반 본사 문의의 Pipeline 승격(I09)과 수동 계보 연결(I10)은 PC 기존 외부 op/ACK를 유지하면서 내부 intent만 분리한 로컬 후보로 검증했다. \`deals.origin_inquiry_id\`를 정본으로 고정하고 inquiry row/advisory lock 및 적용 전 중복 preflight로 inquiry당 Deal 하나를 보장한다. 자동 승격만 qualifying 문의 status를 원자 갱신하며, 수동 승격은 현재 status 일치를 요구한다. 조회는 명시 lineage를 우선하고 site-name은 legacy fallback으로만 남긴다. 기술자문·경남 승격은 계속 차단한다.
- Pipeline 담당자 배정/인계(P02/P12)는 현재 Staging users에 team 정본이 없고 PC와 mobile의 재배정 사유 규칙도 달라 차단했다. 기존 assignment_history의 text 컬럼을 임의 UUID/team 권한 모델로 해석하지 않는다. P02는 향후 \`assign\` 한 transaction에서 서버 생성 handover를 흡수하는 계약까지만 고정했으며, 승인된 UUID team/assignability 정본 전에는 후보 SQL을 만들지 않는다.
- 메시징은 외부 앱 open/Clipboard를 유지하면서 message log(M02), reminder(M04), 관계 cadence(M05)를 Supabase ledger·원자 command·scoped read로 연결했다. 실제 문자·카카오 발송·예약·provider callback(M06)은 승인된 n8n 유지 경계이며, 기존 workflow 본문을 바꾸지 않는 별도 외부 E2E만 남는다.
- 명시 차단: \`branch_handoff\`, \`branch_owner_assign\`.
- 나머지 저장은 현재 UI에서 n8n, localStorage, 외부 앱, 검증 전 직접 RPC 중 하나에 남아 있다.
- Staging 원본 화면은 업무별 read가 대부분 unavailable이므로 write만 연결해도 운영 전환이 완료되지 않는다.
- 현재 source에 남은 Production/n8n URL은 전환 대상 증거이며, 이 조사에서는 호출하지 않았다.

상태별 업무행: ${Object.entries(counts).sort().map(([k,v])=>`${k} ${v}`).join(' / ')}.

## 도메인 처리 순서

1. 공통 read projection + queue/receipt/audit/ACK 회귀 harness
2. 견적문의: 응대·상태·회수·후속·전환, 이후 경남 routing
3. Pipeline + Next/Activity: 생성·담당·단계·종료·금액·사업유형·대기
4. 고객자산: Site·연락처·관계·이동·Timeline·정리
5. 기술자문·확장관리
6. 첨부/메모
7. 개별 메시징, 이후 campaign/provider
8. 관리자·보고·Export와 역할별 전체 회귀

각 묶음은 확정 가능한 계약을 함께 구현하되, 한 transaction이어야 하는 동작을 여러 성공 toast로 쪼개지 않는다. NEEDS_VERIFICATION 행은 다른 묶음 진행을 막지 않는다.

## 최종 Gate

- reachable matrix의 PASS/E2E coverage 100%
- PC·모바일 주요 업무 E2E 및 모든 역할 권한 PASS
- duplicate write 0, stale/version·request reuse 충돌 PASS
- 대화형 CRM read/write에서 n8n 요청 0, 승인된 외부 유입·발송 경계만 n8n 허용
- Production 요청 0인 Staging 리허설 PASS
- Production cutover/rollback·legacy RLS backlog 검토 완료

## 검토 자료

- \`sql/operational-bundle/20260906/\`: 통합 apply/rollback/manifest/local DB 검증
- \`sql/reachable-operations-bundle/20260906/\`: 미적용 후보 15개 delta의 원자 누적 apply/역순 rollback/최종 UI asset/hash manifest
- \`sql/operational-full-local-candidate/20260906/\`: 25-op 기반부터 M02/M05까지 31개 operation을 단일 apply/역순 rollback으로 합성한 최종 로컬 후보
- \`staging-write/compat-adapter-operational-candidate.js\`: 공개 Dispatcher 단일 경로 Adapter 후보
- \`docs/operational-cutover-20260906/staging-preflight-20260906.json\`: Staging read-only live preflight
- \`docs/operational-cutover-20260906/operational-bundle-staging-application.json\`: migration/JWT/private evidence/복구 결과
- \`docs/operational-cutover-20260906/staging-advisor-after-operational-bundle.md\`: 적용 후 advisor 분리 기록
- \`docs/operational-cutover-20260906/production-security-backlog.md\`: 이번 bundle과 분리한 legacy RLS cutover backlog
`;
fs.writeFileSync(path.join(out,'README.md'),md);
console.log(JSON.stringify({rows:rows.length,dead:dead.length,literal_pushwrite_operations:literalOps.length,missing_operations:missing,status:'INVENTORY_BASELINE_COMPLETE'}));
