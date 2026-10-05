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
 assert.equal(F.kindOf('회신대기'),'attempt','보냈지만 답이 없는 것(문자 · 카카오) = 연락 시도 · 접촉은 아님(2026-10-05 design_handoff_inquiry_sms)');assert.equal(F.kindOf('보류'),'connected');assert.equal(F.kindOf('아무말'),'');
 assert.equal(JSON.stringify(F.readLine('[전화 · 부재] 두 번 걸었음')),JSON.stringify({ch:'전화',res:'부재',text:'두 번 걸었음'}));assert.equal(F.readLine('통화 결과: 연락 완료 → 다음 연락 2026.10.8(목)').res,'연락 완료');assert.equal(F.readLine('그냥 메모'),null);
 for(const r of F.RESULTS)assert.ok(F.NEXT[r],'다음 행동 제안 '+r);
});
test('① 최초응대 = 최초 접촉 시각. 부재 · 보낸 문자는 시도 n회, 내부 메모 · 보낸 문자는 최초응대가 아니다',()=>{
 const F=load().InquiryFlow;
 const q={id:'a',status:'배정완료',activities:[{id:'1',type:'전화',note:'고객 응대 기록',result:'[전화 · 부재]',at:at(2)},{id:'2',type:'기타',note:'내부 메모',at:at(1.5)},{id:'3',type:'문자',note:'[문자 · 회신대기] 안내 문자',at:at(1)}]};
 let s=F.state(q);assert.equal(s.firstConnectedAt,'');assert.equal(s.firstAttemptAt,q.activities[0].at);assert.equal(s.attempts,2,'부재 1 + 보낸 문자 1');assert.equal(F.attemptNote(q),'시도 2회');
 {const only={id:'m',status:'배정완료',activities:[{id:'1',type:'문자',note:'[문자 · 회신대기] 안내 문자',at:at(1)}]},v=F.state(only);assert.equal(v.firstConnectedAt,'','문자만 보낸 문의 = 최초 응대 없음');assert.equal(v.firstAttemptAt,only.activities[0].at,'보낸 문자 = 최초 시도');assert.equal(v.attempts,1);}
 q.activities.push({id:'4',type:'전화',note:'고객 응대 기록',result:'[전화 · 연결됨] 통화함',at:at(0.5)});s=F.state(q);
 assert.equal(s.firstConnectedAt,q.activities[3].at,'접촉한 그때가 최초응대');assert.equal(s.attempts,2,'접촉 전 시도 수는 남는다(부재 1 + 보낸 문자 1)');assert.equal(F.attemptNote(q),'','접촉 뒤에는 시도 표시를 붙이지 않는다');
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
 assert.match(body,/when p_result in \('부재','통화불가','번호오류','회신대기'\) then 'attempt'\s*when p_result in \('연결됨','고객 회신','검토중','자료요청','견적요청'\) then 'connected'/,'화면과 같은 결과 마스터(회신대기 = 시도)');
 assert.match(body,/first_attempt_at=coalesce\(x\.first_attempt_at,v_occ\)/,'최초 시도 시각은 한 번만');assert.match(body,/first_connected_at=coalesce\(x\.first_connected_at,v_occ\)/,'최초 접촉 시각은 한 번만');
 assert.match(body,/if v_reason is null or length\(v_reason\)>60 then raise exception 'Bad Fit 사유를 골라 주세요'/,'Bad Fit 사유 필수(목록은 운영 기준)');assert.match(body,/if v_reason='기타' and v_detail is null then raise exception '기타 사유를 적어 주세요'/);assert.match(body,/v_reason not in \('계획 없음','단순 문의','타사 선택'\)/,'상담종결 사유');
 assert.match(body,/v_reason:='시도 '\|\|v_attempts\|\|'회'; v_status:='연락두절'/,'연락두절 사유 = 시도 횟수 자동');
 assert.match(body,/v_follow:=greatest\(v_sent_day\+7,v_today\+1\)/,'견적 후속 = 보낸 날 + 7일(같은 날 할 일 금지)');assert.match(body,/'전화','고객 반응 확인'/);
 assert.match(body,/qualified_by=coalesce\(x\.qualified_by,'quote_sent'\)/);assert.match(body,/qualified_by=coalesce\(x\.qualified_by,'visit_done'\)/,'전환 기준 = 둘 중 먼저');
 assert.doesNotMatch(body,/delete\s+from|drop\s+table|truncate|contract_sales|update public\.deals|first_response_at\s*=/i,'지우지 않는다 · 영업건 · 계약 원장 · 기존 최초응대 값은 건드리지 않는다');
 assert.doesNotMatch(body,/update public\.inquiries[^;]*\bstatus=(?!v_status)/,'상태는 종결 때만 바꾼다');
 assert.match(body,/'closed',coalesce\(\(\s*select jsonb_agg\(jsonb_build_object\('inquiry_id',i\.id,'status',i\.status,'close_reason',i\.close_reason\)\)/,'닫힌 문의의 사유 글 읽기(읽기만)');
 for(const fn of ['crm_inquiry_command_v1','crm_inquiry_flow_list_v1'])assert.match(body,new RegExp('revoke all on function public\\.'+fn+'\\(jsonb\\) from public, anon;\\s*grant execute on function public\\.'+fn+'\\(jsonb\\) to authenticated;'),fn);
 assert.match(body,/where t\.migrated is null;/,'이관은 여러 번 돌려도 같은 결과');
});
test('② 종결 4종: 종류는 한곳에서 읽는다 — 다른 업체 선택은 Bad Fit 이 아니라 상담종결, 종류가 안 적힌 예전 종결은 사유 미기록',()=>{
 const F=load({inqNoTrack:q=>/협약/.test(String(q.work||''))}).InquiryFlow,k=q=>{const c=F.closeOf(q);return c?c.kind+'|'+c.reason:null;};
 assert.deepEqual(Object.keys(F.CLOSE),['bad_fit','unreachable','consult_end','transfer']);
 assert.deepEqual([...F.closeReasons('consult_end')],['계획 없음','단순 문의','타사 선택']);assert.deepEqual([...F.closeReasons('transfer')],['POUR스토어','B2B 협약']);assert.deepEqual([...F.closeReasons('unreachable')],[]);
 /* Bad Fit 사유 = 운영 기준(설정 화면) 한 곳. 못 읽을 때만 기본 목록 */
 assert.deepEqual([...F.closeReasons('bad_fit')],['수행불가 공종','규모 부적합','대상 고객 아님','서비스 범위 아님','기타']);
 const F2=load({CRMRules:{get:()=>3,reasons:k=>k==='bad_fit'?['수행 불가 공종','규모 부적합','시공 불가 지역','기타']:[]}}).InquiryFlow;assert.deepEqual([...F2.closeReasons('bad_fit')],['수행 불가 공종','규모 부적합','시공 불가 지역','기타'],'운영 기준 목록을 그대로');
 assert.ok(![...F.closeReasons('bad_fit'),...F2.closeReasons('bad_fit')].some(r=>/타사|다른 업체|거절/.test(r)),'Bad Fit 사유에 타사 선택이 없다');
 assert.equal(k({status:'배정완료'}),null,'닫히지 않은 문의');assert.equal(k({status:'수주'}),null,'영업 결과는 문의 종결이 아니다');
 assert.equal(k({status:'배드핏',close_reason:'Bad Fit · 규모 부적합 — 3세대'}),'bad_fit|규모 부적합');assert.equal(k({status:'연락두절',close_reason:'연락두절 · 시도 3회'}),'unreachable|시도 3회');
 assert.equal(k({status:'종결',close_reason:'상담종결 · 타사 선택 — 다른 업체와 계약'}),'consult_end|타사 선택');
 assert.equal(k({status:'종결',close_reason:'기타 종결 — 배드핏(부적합) · 수행 불가 공종 · 이전 상태: 접수'}),'bad_fit|수행 불가 공종','예전 배드핏 종결 글');
 assert.equal(k({status:'종결',close_reason:'기타 종결 — 상담종결 · 계획 없음 · 이전 상태: 배정완료'}),'consult_end|계획 없음','새 함수 설치 전 종결');
 assert.equal(k({status:'종결',close_reason:'상담만 종결 — 가격만 문의 · 이전 상태: 접수'}),'consult_end|상담만');
 assert.equal(k({status:'POUR스토어 이관대기'}),'transfer|POUR스토어');assert.equal(k({status:'종결',work:'협약문의'}),'transfer|B2B 협약');assert.equal(k({status:'해결완료'}),'transfer|B2B 협약');
 assert.equal(k({status:'종결'}),'unknown|');assert.equal(k({status:'종결',close_reason:'중복 문의 · sheet:405'}),'other|중복 문의 · sheet:405');
 F.take({inquiry_id:'s1',close_kind:'consult_end',close_reason:'단순 문의'});assert.equal(k({id:'s1',status:'종결'}),'consult_end|단순 문의','서버 종결 종류가 먼저');
 const bb=read('brief-b.js');assert.match(bb,/let m=\/Bad Fit · \(\[\^—·\]\+\)\/\.exec\(r\);if\(m\)return m\[1\]\.trim\(\);/);assert.match(bb,/if\(\/\^연락두절 ·\/\.test\(r\)\)return '연락두절';m=\/상담종결 · \(\[\^—·\]\+\)\/\.exec\(r\);if\(m\)return '상담종결 · '\+m\[1\]\.trim\(\);/,'브리핑 · 대시보드의 사유 읽기도 종류대로');
});
test('② ③ 화면: [배드핏] 칩 = 종결 창(다음 할 일을 만들지 않는다) · 문자 = 1:1 보내기(가운데 칸) · 연락 시도로 기록 · CRM 발송 큐는 꺼 둠',()=>{
 const html=read('crm.html'),dv=read('inquiry-detail-v2.js'),l3=read('inquiry-list-v3.js'),fl=read('inquiry-flow.js');
 has(html,/if\(window\.InquiryFlow&&InquiryFlow\.on\(\)\)\{var first=InquiryFlow\.state\(q\)\.unreachable\?'unreachable':'bad_fit',opts=\[\['bad_fit',/,'종결 창 = 4종(연락두절 제안이면 연락두절이 먼저)');
 has(html,/return InquiryCommand\.run\('close',q,\{kind:type,reason:cat,detail:reason\}\)\.then\(/,'종결 저장 = 명령 하나');
 has(html,/if\(cat==='POUR스토어'\)\{closeInquiryControlModal\(\);return inqCtlOpenStore\(key\)\}/,'스토어 이관 = 기존 이관 창');has(html,/if\(!\(window\.InquiryB2B&&InquiryB2B\.isAgreement\(q\)\)\)return inqCtlError\(/,'B2B = 협약 문의만 · 다른 문의를 협약으로 바꾸지 않는다');
 assert.match(dv,/RES3=\(\)=>FL\(\)\?FL\(\)\.RESULTS\.map\(r=>\[r,r\]\)\.concat\(\[\['배드핏','__close'\]\]\):RES3_OLD;/);assert.match(dv,/if\(k==='res'&&v==='__close'\)\{if\(typeof root\.inqCtlOpenClose==='function'\)root\.inqCtlOpenClose\(curKey\);return;\}/);
 assert.match(dv,/none:!FL\(\)&&res==='거절'\};\}/,'흐름 기준에서는 배드핏 종결 검토 다음 할 일을 만들지 않는다');assert.match(dv,/return r==='거절'\|\|r==='회신대기'\?'연결됨':r==='보류'\?'검토중':r;\};/,'글에서 읽은 결과도 마스터 안에서만');
 assert.match(fl,/if\(!C\|\|kind==='transfer'\)throw Error\('종결 종류를 골라 주세요\.'\);/);assert.match(fl,/if\(reason==='기타'&&!detail\)throw Error\('기타 사유는 메모에 적어 주세요\.'\);/,'사유 필수');
 /* ③ */
 assert.match(dv,/\(FL\(\)\?\[\['call','응대 기록'\],\['memo','내부 메모'\]\]:\[\['call','응대 기록'\],\['sms','문자'\],\['memo','내부 메모'\]\]\)/,'상세 문자 탭 없음');
 assert.match(dv,/const crmSendable=digits=>!!\(root\.G\.inqSmsQueueOn&&root\.SB&&/,'CRM 직접 발송 큐 = 꺼 둔 플래그(서버 코드는 그대로)');
 assert.match(dv,/if\(k==='ch'\)\{s\.ch=v;if\(FL\(\)&&v==='문자'\)\{if\(document\.getElementById\('inq-inbox-dialog'\)\?\.classList\.contains\('idv3'\)\)\{s\.smsOpen=true;/,'수단 문자 = 가운데 칸 문자 보내기');assert.match(dv,/root\.InquiryCommand\.run\('contact_log',q,\{ch:'문자',result:'회신대기',text,next:'회신 확인',due:due3\}\)/,'예전 틀의 보낸 문자 = 응대 기록');
 assert.match(dv,/if\(s\.smsOpen&&!closedStatus\(q\)\)return smsPanel4\(q,s\);/,'[문자] → 가운데 칸(응대 이력 자리)이 문자 보내기로');assert.match(dv,/root\.InquiryCommand\.run\('contact_log',q,\{ch,result:'회신대기',text:title\+' '\+ch\+' 발송 — '\+text,next:title\+' 회신 확인 전화',due\}\)/,'보내면 회신대기(연락 시도) + 다음 확인일');
 assert.match(dv,/class="idv3-callrow"><button type="button" class="idv3-call" data-idv="dial"/,'전화 옆 [문자]');assert.match(read('inquiry-detail-v3.css'),/\.idv3-callrow\{display:grid;grid-template-columns:minmax\(0,1\.7fr\) minmax\(0,1fr\);gap:6px\}/,'전화 : 문자 = 1.7 : 1');
 assert.match(read('sql/inquiry-flow-v1-20261005.sql'),/when p_result in \('부재','통화불가','번호오류','회신대기'\) then 'attempt'/,'서버도 회신대기 = 시도');
 assert.match(l3,/\(F\(\)\?'':'<button type="button" data-il="sms" data-key="'\+k\+'">문자<\/button>'\)/,'목록 문자 버튼 없음');
 for(const f of ['today-tower.js','today-v3.js','today-rep-v2.js'])assert.ok(read(f).includes('root.InquiryDetailV2.openSms()'),f+' 의 [문자] = 문의면 상세의 문자 작은 창');
});
test('④ ⑤ 전환 기준 하나 · 견적 = 버전: 상세 · 전환 대기 목록 · 전송 계층 · 서버가 같은 기준',()=>{
 const F=load().InquiryFlow,html=read('crm.html'),dv=read('inquiry-detail-v2.js'),fl=read('inquiry-flow.js'),sql=read('sql/inquiry-flow-v1-20261005.sql');
 assert.equal(F.QUALIFY_TEXT,'1차 현장방문 완료 또는 견적 발송 완료 중 먼저 → 파이프라인 전환');
 for(const [s,v] of [['현장방문예정',false],['견적서 발송예정',false],['전화응대 완료',false],['현장방문 완료',true],['견적서 발송완료',true],['견적서 발송 완료',true]]){assert.equal(F.statusQualifies(s),v,s);assert.equal(F.isQualified({status:s}),v,s);}
 F.take({inquiry_id:'q1',visit_done_at:'2026-10-03T03:00:00Z',quote_sent_at:'2026-10-05T03:00:00Z'});assert.equal(F.qualifiedBy({id:'q1',status:'배정완료'}),'visit_done','먼저 일어난 것');
 F.take({inquiry_id:'q2',quote_sent_at:'2026-10-05T03:00:00Z',quotes:[{version_no:2,amount:172000000,sent_at:'2026-10-05T03:00:00Z'},{version_no:1,amount:185000000,sent_at:'2026-10-01T03:00:00Z'}]});
 assert.equal(F.qualifiedBy({id:'q2'}),'quote_sent');assert.equal(F.quotes({id:'q2'}).map(v=>v.version_no).join(),'1,2','견적 버전 순서');assert.equal(F.parseQuoteText('견적서 발송 후 확인 연락 · 예상 1,200만원'),12000000);
 has(html,/function inqStatusQualifies\(s\)\{return window\.InquiryFlow&&InquiryFlow\.on\(\)\?InquiryFlow\.statusQualifies\(s\):QUALIFY_ST\.test\(String\(s\|\|''\)\)\}/);has(html,/  if\(inqStatusQualifies\(to\)&&CLOSED_ST\.indexOf\(to\)<0\)\{/,'상태 변경 → 자동 전환도 같은 기준');
 has(html,/if\(window\.InquiryFlow&&InquiryFlow\.on\(\)\)return inqIsQualified\(q\)&&CLOSED_ST\.indexOf\(q\.status\)<0&&!linkedDeal\(q\);/,'전환 대기 판정(대시보드 · 오늘 업무가 쓰는 함수)');
 has(html,/if\(\/현장\\s\*방문\\s\*완료\/\.test\(t\)\)return t\+' 상태로 파이프라인 인계';/,'인계 사유 문장 = 서버와 같은 모양');
 assert.match(read('inquiry-conversion.js'),/\(F\?F\.isQualified\(q\):qualify\.test\(String\(q\.status\|\|''\)\)\)/,'전환 대기 목록');
 assert.match(read('operational-adapter.js'),/!\/견적\.\*발송\|현장\\s\*방문\\s\*완료\/\.test\(payload\.inquiry_status\)/,'전송 계층');
 assert.match(sql.replace(/\r\n/g,'\n'),/a constant text:=\$a\$status_value !~ '견적\.\*발송'\$a\$;\n b constant text:=\$b\$status_value !~ '견적\.\*발송\|현장\[\[:space:\]\]\*방문\[\[:space:\]\]\*완료'\$b\$;/,'서버 전환 명령의 조건 한 곳');
 assert.match(sql,/if n<>1 then raise exception '전환 조건을 바꿀 자리가 %곳입니다\(1곳이어야 함\) — 아무것도 바꾸지 않았습니다',n; end if;/,'자리가 정확히 1곳이 아니면 멈춘다');
 assert.match(fl,/const ready=loadedOk&&can\(RPC\),msg=ready\?promote\(q\):'서버 적용 뒤 전환 대기 목록에서 파이프라인으로 넘길 수 있습니다';/,'방문 완료 전환은 서버가 받는 것이 확인된 뒤에만 보낸다');
 assert.match(dv,/const stepConverts=s=>!FL\(\)\|\|\(s\.step==='visit'\?s\.visitMode==='완료':s\.step==='quote'\?s\.quoteMode==='완료':false\);/,'예정은 저장만');assert.match(dv,/\(FL\(\)\?h\(FL\(\)\.QUALIFY_TEXT\):/,'상세 문구 = 같은 기준');
 assert.match(dv,/root\.InquiryCommand\.run\('quote_send',q,\{amount:s\.quoteAmt\?Number\(s\.quoteAmt\)\*10000:0,date:s\.quoteDate,sent:s\.quoteMode==='완료'\}\)/,'견적 금액은 견적 버전으로(원)');
 assert.doesNotMatch(fl,/예상 '\+|만원'\)/,'명령은 다음 할 일 문장에 금액을 넣지 않는다');assert.match(fl,/nextSet\(q,'고객 반응 확인',follow\)/);assert.match(fl,/const f=plusDays\(sentDay,7\);return f>today\?f:plusDays\(today,1\);/,'후속 = 보낸 날 + 7일 · 같은 날 할 일 금지');
 assert.match(sql,/v_draft:=coalesce\(\(p->>'draft'\)='true',false\);/);assert.match(sql,/if found and lv\.sent_at is null then/,'초안은 같은 버전을 고쳐 쓴다');
});
test('서버 함수 본문은 운영에 배포된 실행 버전과 같다 — 보호 조건이 빠진 버전으로 덮어쓰지 않게',()=>{
 const mine=read('sql/inquiry-flow-v1-20261005.sql'),cx=read('supabase/migrations/20261005034655_inquiry_flow_runtime.sql');
 const fn=(t,name)=>{const a=t.indexOf('create or replace function '+name),b=t.indexOf('end $fn$;',a);assert.ok(a>=0&&b>a,name+' 을 찾지 못함');return t.slice(a,b);};
 for(const n of ['public.crm_inquiry_command_v1(p jsonb)','public.crm_inquiry_flow_list_v1(p jsonb)','crm_security.inquiry_flow_state_json(p_inquiry_id uuid)','crm_security.inquiry_contact_kind(p_result text)'].slice(0,2))assert.ok(fn(mine,n)===fn(cx,n),n+' 본문이 실행 버전과 다름');
 for(const guard of ['협약문의는 B2B 전용 처리로 완료해 주세요','REQUEST_ID_REUSE','이미 종결 또는 전환된 문의입니다',"in ('inquiry_trash','inquiry_purge')"])assert.ok(mine.includes(guard),'보호 조건: '+guard);
 assert.ok(mine.indexOf('-- ── 이관(여러 번 돌려도 같은 결과) ──')>mine.indexOf('create or replace function public.crm_inquiry_flow_list_v1'),'이관 · 전환 조건은 함수 뒤에');
});
test('③ 닫힌 문의 수 문구: 종결 N건 · Bad Fit n(대시보드 · 브리핑 · 리포트가 같은 함수) · Bad Fit 사유 기본 목록 = README 표',()=>{
 const bb=read('brief-b.js'),db=read('dash-b.js'),rb=read('report-b.js');
 assert.match(bb,/const isBadFit=q=>\{if\(!flowOn\(\)\)return true;const c=root\.InquiryFlow\.closeOf\(q\);return !!c&&c\.kind==='bad_fit';\};/,'Bad Fit = 종결 종류가 bad_fit 인 것만');
 assert.match(bb,/return '종결 '\+n\+\(form==='ex'\?' 제외':form==='n'\?'':'건'\)\+' · Bad Fit '\+b;/);assert.match(bb,/STALE,badfit,badfitReason,isBadFit,closedText,closedWord,isLoss,/);
 assert.doesNotMatch(bb,/'배드핏 '\+x\.bad\.length|견적문의 배드핏 '\+x\.bad\.length/);assert.doesNotMatch(db,/배드핏 '\+bad\.length|'배드핏 사유/);assert.doesNotMatch(rb,/배드핏 '\+(x\.cur|c)\.bad\.length/);
 assert.match(db,/B\.closedText\(bad,'ex'\)/);assert.match(db,/<b>견적문의 '\+h\(B\.closedText\(bad\)\)\+' <span>/);assert.match(rb,/<p><b>견적문의 '\+h\(B\.closedText\(c\.bad\)\)\+'<\/b>/);
 assert.deepEqual(require('../ops-rules.js').reasons('bad_fit'),['수행불가 공종','규모 부적합','대상 고객 아님','서비스 범위 아님','기타']);
});
