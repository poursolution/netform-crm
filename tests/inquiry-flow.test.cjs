'use strict';
/* 견적문의 흐름(2026-10-05 design_handoff_inquiry_flow · P0): 판정은 InquiryFlow 한 곳 · 저장은 InquiryCommand 하나 · 서버는 곁표 + 명령 함수 하나 */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const read=f=>fs.readFileSync(path.join(__dirname,'..',f),'utf8').replace(/\r\n/g,'\n');
/* 큰 파일은 실패해도 내용을 쏟지 않게 */
const has=(text,re,msg)=>assert.ok(re.test(text),msg||String(re));
function load(extra){
 const win=Object.assign({G:{},ME:{id:'me',name:'송보람'},console,itemPatch:()=>({}),inquiryDate:q=>q.at||'',localStorage:{getItem:()=>null,setItem(){}},CRMRules:{get:k=>({unreachable_attempts:3,unreachable_interval_days:1})[k]}},extra||{});
 win.window=win;vm.runInNewContext(read('inquiry-flow.js'),win);return win;
}
const at=d=>new Date(Date.now()-d*864e5).toISOString();
test('① 결과 마스터: 시도(부재 · 통화불가 · 번호오류)와 접촉(연결됨 · 고객 회신 · 검토중 · 자료요청 · 견적요청)을 한곳에서 가른다',()=>{
 const F=load().InquiryFlow;
 assert.deepEqual([...F.RESULT.attempt],['부재','통화불가','번호오류']);assert.deepEqual([...F.RESULT.connected],['연결됨','고객 회신','검토중','자료요청','견적요청']);
 assert.deepEqual([...F.RESULTS],['연결됨','고객 회신','검토중','자료요청','견적요청','부재','통화불가','번호오류'],'화면 칩 = 마스터');
 for(const r of F.RESULT.attempt)assert.equal(F.kindOf(r),'attempt',r);for(const r of F.RESULT.connected)assert.equal(F.kindOf(r),'connected',r);
 assert.equal(F.kindOf('회신대기'),'wait','보냈지만 답이 없는 것 = 접촉 아님');assert.equal(F.kindOf('보류'),'connected');assert.equal(F.kindOf('아무말'),'');
 assert.equal(JSON.stringify(F.readLine('[전화 · 부재] 두 번 걸었음')),JSON.stringify({ch:'전화',res:'부재',text:'두 번 걸었음'}));assert.equal(F.readLine('통화 결과: 연락 완료 → 다음 연락 2026.10.8(목)').res,'연락 완료');assert.equal(F.readLine('그냥 메모'),null);
 for(const r of F.RESULTS)assert.ok(F.NEXT[r],'다음 행동 제안 '+r);
});
test('① 최초응대 = 최초 접촉 시각. 부재만 있으면 시도 n회, 내부 메모 · 보낸 문자는 최초응대가 아니다',()=>{
 const F=load().InquiryFlow;
 const q={id:'a',status:'배정완료',activities:[{id:'1',type:'전화',note:'고객 응대 기록',result:'[전화 · 부재]',at:at(2)},{id:'2',type:'기타',note:'내부 메모',at:at(1.5)},{id:'3',type:'문자',note:'[문자 · 회신대기] 안내 문자',at:at(1)}]};
 let s=F.state(q);assert.equal(s.firstConnectedAt,'');assert.equal(s.firstAttemptAt,q.activities[0].at);assert.equal(s.attempts,1);assert.equal(F.attemptNote(q),'시도 1회');
 q.activities.push({id:'4',type:'전화',note:'고객 응대 기록',result:'[전화 · 연결됨] 통화함',at:at(0.5)});s=F.state(q);
 assert.equal(s.firstConnectedAt,q.activities[3].at,'접촉한 그때가 최초응대');assert.equal(s.attempts,1,'접촉 전 시도 수는 남는다');assert.equal(F.attemptNote(q),'','접촉 뒤에는 시도 표시를 붙이지 않는다');
 /* 예전 최초응대 시각: 그 시각의 기록이 부재면 시도로 옮겨 본다 · 근거가 없으면 그대로 접촉 */
 const old={id:'b',status:'전화응대 완료',first_response_at:at(3),activities:[{id:'9',type:'단계전환',note:'고객 응대 기록',result:'[전화 · 부재] 안 받음',at:at(3)}]};
 assert.equal(F.state(old).firstConnectedAt,'');assert.equal(F.state(old).firstAttemptAt,old.first_response_at);
 const bare={id:'c',status:'전화응대 완료',first_response_at:at(3)};assert.equal(F.state(bare).firstConnectedAt,bare.first_response_at,'근거 없는 과거 최초응대는 그대로');
 const byStatus={id:'d',status:'현장방문예정',lastActivity:at(4)};assert.equal(F.state(byStatus).firstConnectedAt,byStatus.lastActivity,'상태 이름뿐인 예전 문의도 그대로 응대한 것으로');
 const sheet={id:'e',status:'전화응대 완료',lastActivity:at(4),raw:{'응대내용':'부재'}};assert.equal(F.state(sheet).firstConnectedAt,'','응대내용이 부재뿐이면 시도');
 const fresh={id:'f',status:'배정완료'};assert.equal(F.state(fresh).firstConnectedAt,'');assert.equal(F.state(fresh).attempts,0);
});
test('① 연락두절은 제안만: 접촉 없이 기준 횟수(간격을 지킨 시도)에 닿았을 때',()=>{
 const F=load().InquiryFlow,mk=days=>({id:'u',status:'배정완료',activities:days.map((d,i)=>({id:'k'+i,type:'전화',note:'고객 응대 기록',result:'[전화 · 부재]',at:at(d)}))});
 assert.equal(F.state(mk([2,1,0])).unreachable,true);assert.match(F.attemptNote(mk([2,1,0])),/^시도 3회 · 연락두절 종결 제안$/);
 assert.equal(F.state(mk([0.02,0.01,0])).unreachable,false,'같은 날 세 번은 한 번으로 센다');assert.equal(F.state(mk([0.02,0.01,0])).attempts,3);
 const c=mk([3,2,1]);c.activities.push({id:'c',type:'전화',note:'고객 응대 기록',result:'[전화 · 연결됨]',at:at(0)});assert.equal(F.state(c).unreachable,false,'접촉했으면 제안하지 않는다');
});
test('⑥ ⑦ 대표회의와 자료 회신 기한은 따로 · 전화 응대자는 한 칸',()=>{
 const F=load().InquiryFlow,ymd=d=>d&&[d.getFullYear(),d.getMonth()+1,d.getDate()].join('-');
 assert.equal(F.meetingDate({raw:{'자료 회신 기한':'2026-10-09'}}),null,'회신 기한은 대표회의가 아니다');assert.equal(ymd(F.replyDue({raw:{'자료 회신 기한':'2026-10-09'}})),'2026-10-9');
 assert.equal(ymd(F.meetingDate({raw:{'대표회의':'2026-10-12','자료 회신 기한':'2026-10-09'}})),'2026-10-12');
 assert.equal(F.phoneHandler({raw:{'전화응대자':'조현식'}}),'조현식','시트 열');assert.equal(F.phoneHandler({raw:{'전화 응대자':'황윤선'}}),'황윤선','예전 화면 저장 이름');assert.equal(F.phoneHandler({raw:{'전화응대자':'-'}}),'');
 F.take({inquiry_id:'z',phone_handler:'이필선',meeting_date:'2026-11-02',reply_due:'2026-10-20'});const q={id:'z',raw:{'전화응대자':'조현식','대표회의':'2026-10-12'}};
 assert.equal(F.phoneHandler(q),'이필선','서버 phone_handler 가 먼저');assert.equal(ymd(F.meetingDate(q)),'2026-11-2');assert.equal(ymd(F.replyDue(q)),'2026-10-20');
});
test('화면: 판정 함수 두 개가 InquiryFlow 를 쓰고, 목록 · 상세 · 작업대 저장이 InquiryCommand 하나로 간다',()=>{
 const html=read('crm.html'),l3=read('inquiry-list-v3.js'),dv=read('inquiry-detail-v2.js'),wb=read('inquiry-workbench.js'),fl=read('inquiry-flow.js');
 has(html,/function inqCtlFirstResponseAt\(q\)\{\n[^\n]*\n if\(window\.InquiryFlow&&InquiryFlow\.on\(\)\)return InquiryFlow\.firstConnectedAt\(q\);/,'최초응대 판정 = InquiryFlow');
 has(html,/function inquiryResponded\(q\)\{if\(window\.InquiryFlow&&InquiryFlow\.on\(\)\)return !!InquiryFlow\.firstConnectedAt\(q\);return inquiryRespondedLegacy\(q\)\}/,'응대함 판정 = InquiryFlow');
 has(html,/<script src="\.\/inquiry-flow\.js\?v=[a-z0-9-]+"><\/script><link rel="stylesheet" href="\.\/inquiry-list-v2\.css/,'목록 · 상세보다 먼저 불러온다');
 assert.match(l3,/if\(F\(\)&&root\.InquiryCommand\)return root\.InquiryCommand\.run\('contact_log',q,\{did:o\.did,line:String\(o\.res\|\|''\)\.trim\(\),next:o\.next,due:o\.due\}\)===true;/,'목록 · 오늘 업무의 결과 기록');
 assert.match(l3,/RES=\(\)=>F\(\)\?F\(\)\.RESULTS\.slice\(\):RES_OLD/,'목록 결과 칩 = 마스터');assert.match(l3,/let cand=F\(\)\?F\(\)\.meetingDate\(q\):/,'D-3 판정은 대표회의만');
 assert.match(dv,/root\.InquiryCommand\.run\('contact_log',q,\{ch:g\.ch,result:g\.res,text,next:nextText,due\}\)/,'상세 응대 기록');assert.match(dv,/root\.InquiryCommand\.run\('memo',q,\{text\}\)/,'상세 내부 메모');
 assert.match(dv,/await root\.InquiryCommand\.run\('field_set',q,\{field,value\}\)/,'상세 칸 저장');assert.match(dv,/RES3=\(\)=>FL\(\)\?FL\(\)\.RESULTS\.map\(r=>\[r,r\]\)/,'상세 결과 칩 = 마스터');
 assert.match(wb,/root\.InquiryCommand\.run\('contact_log',q,\{did:o\.did,line:o\.res,next:o\.next,due:o\.due\}\)/,'작업대 처리 저장');assert.match(wb,/root\.InquiryFlow\.phoneHandler\(q\)/,'전화 응대자 읽기');
 /* 시도는 단계 진행(iqApply)으로 보내지 않는다 */
 assert.match(fl,/if\(kind==='connected'&&needsProgress\(q\)\)\{\n\s*ok=withFields\(\{'iq-did':did,'iq-res':line,'iq-next':next,'iq-due':due\},\(\)=>root\.iqApply\(q,'step:1'\)===true\);/);
 assert.match(fl,/const on=\(\)=>!\(root\.G&&root\.G\.inqFlowOff\);/,'끄기 스위치');
 for(const fn of ['crm_inquiry_command_v1','crm_inquiry_flow_list_v1']){assert.ok(read('pc-manager-transport.js').includes("'"+fn+"'"),fn+' 전송 허용 목록');assert.ok(read('pc-error-state.js').includes(fn+':'),fn+' 이름표');}
});
test('서버: 곁표는 잠겨 있고 명령 함수 하나로만 쓴다 · 최초 시각은 한 번만 · 종결은 사유 필수 · 기존 값은 지우지 않는다',()=>{
 const sql=read('sql/inquiry-flow-v1-20261005.sql'),body=sql.replace(/^\s*--.*$/gm,'');
 for(const t of ['inquiry_flow_state','inquiry_contact_logs','inquiry_quote_versions','schedules']){assert.match(body,new RegExp('create table if not exists crm_security\\.'+t+'\\('),t);assert.match(body,new RegExp('alter table crm_security\\.'+t+' enable row level security;'),t+' 잠금');}
 assert.match(body,/revoke all on crm_security\.inquiry_flow_state, crm_security\.inquiry_contact_logs, crm_security\.inquiry_quote_versions, crm_security\.schedules from public, anon, authenticated;/);
 assert.match(body,/create or replace function public\.crm_inquiry_command_v1\(p jsonb\)[\s\S]*?security definer set search_path=''/);
 assert.match(body,/if a\.permission_role<>'admin' and \(q\.assigned_to is null or q\.assigned_to<>a\.user_id\) then/,'관리자 또는 담당자만');
 assert.match(body,/v_type not in \('contact_log','close','quote_send','visit','schedule_set','field_set'\)/,'명령 종류');
 assert.match(body,/when p_result in \('부재','통화불가','번호오류'\) then 'attempt'\s*when p_result in \('연결됨','고객 회신','검토중','자료요청','견적요청'\) then 'connected'/,'화면과 같은 결과 마스터');
 assert.match(body,/first_attempt_at=coalesce\(x\.first_attempt_at,v_occ\)/,'최초 시도 시각은 한 번만');assert.match(body,/first_connected_at=coalesce\(x\.first_connected_at,v_occ\)/,'최초 접촉 시각은 한 번만');
 assert.match(body,/v_reason not in \('수행불가 공종','규모 부적합','대상 고객 아님','서비스 범위 아님','기타'\)/,'Bad Fit 사유');assert.match(body,/v_reason not in \('계획 없음','단순 문의','타사 선택'\)/,'상담종결 사유');
 assert.match(body,/v_reason:='시도 '\|\|v_attempts\|\|'회'; v_status:='연락두절'/,'연락두절 사유 = 시도 횟수 자동');
 assert.match(body,/v_follow:=greatest\(v_sent_day\+7,v_today\+1\)/,'견적 후속 = 보낸 날 + 7일(같은 날 할 일 금지)');assert.match(body,/'전화','고객 반응 확인'/);
 assert.match(body,/qualified_by=coalesce\(x\.qualified_by,'quote_sent'\)/);assert.match(body,/qualified_by=coalesce\(x\.qualified_by,'visit_done'\)/,'전환 기준 = 둘 중 먼저');
 assert.doesNotMatch(body,/delete\s+from|drop\s+table|truncate|contract_sales|update public\.deals|first_response_at\s*=/i,'지우지 않는다 · 영업건 · 계약 원장 · 기존 최초응대 값은 건드리지 않는다');
 assert.doesNotMatch(body,/update public\.inquiries[^;]*\bstatus=(?!v_status)/,'상태는 종결 때만 바꾼다');
 for(const fn of ['crm_inquiry_command_v1','crm_inquiry_flow_list_v1'])assert.match(body,new RegExp('revoke all on function public\\.'+fn+'\\(jsonb\\) from public, anon;\\s*grant execute on function public\\.'+fn+'\\(jsonb\\) to authenticated;'),fn);
 assert.match(body,/where t\.migrated is null;/,'이관은 여러 번 돌려도 같은 결과');
});
