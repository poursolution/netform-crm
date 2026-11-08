'use strict';
/* AI 사무실 시간 기준 조회(crm_office_timing_v1 · sql/office-timing-v1-20261108.sql) — 읽기 전용 · 권한 · 민감 정보 없음 · 화면 정의와 같은 판정 근거 */
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {PGlite}=require('@electric-sql/pglite'),read=f=>fs.readFileSync(path.join(__dirname,'..',f),'utf8');
const U=n=>'10000000-0000-4000-8000-'+String(n).padStart(12,'0'),Q=n=>'20000000-0000-4000-8000-'+String(n).padStart(12,'0'),D=n=>'30000000-0000-4000-8000-'+String(n).padStart(12,'0');
const SECRET=['비밀고객','010-1234-5678','비밀주소','비밀현장','비밀메모'];

test('사무실 시간 기준 조회: 시각 · 있음/없음만, 화면과 같은 첫 연결 정의, 기존 권한 범위',async()=>{
 const db=new PGlite(),me=U(1),other=U(2);
 try{
  await db.exec("create role anon;create role authenticated;create role service_role;create schema crm_security;");
  await db.exec(read('tests/fixtures/dashboard-read-schema.sql'));
  await db.exec(`create table crm_security.inquiry_contact_logs(id uuid,inquiry_id uuid,kind text,result text,channel text,occurred_at timestamptz,content text);
   create table crm_security.inquiry_memo_reviews(inquiry_id uuid,kind text,on_date date,decided_at timestamptz,source_text text);
   create function crm_security.actor() returns table(user_id uuid,auth_uid uuid,display_name text,permission_role text) language sql stable as $$
    select '${me}'::uuid,'${me}'::uuid,'synthetic',current_setting('test.role',true) where coalesce(current_setting('test.role',true),'')<>'' $$;
   create function crm_security.can_deal(target uuid,writing boolean default false) returns boolean language sql stable as $$
    select exists(select 1 from public.deals d,crm_security.actor() a where d.id=target and (a.permission_role='admin' or d.owner_id=a.user_id)) $$;
   create function crm_security.can_inquiry(target uuid) returns boolean language sql stable as $$
    select exists(select 1 from public.inquiries i,crm_security.actor() a where i.id=target and (a.permission_role='admin' or i.assigned_to=a.user_id)) $$;
   set test.role='admin';`);
  await db.exec(read('sql/office-timing-v1-20261108.sql'));await db.exec(read('sql/office-timing-v1-20261108.sql'));

  const inq=(id,o)=>db.query(`insert into public.inquiries(id,brand,site_name,address,contact_name,phone,assignee_name,status,received_at,created_at,updated_at,assigned_to,assigned_at,first_response_at,responded_at,sheet_row,raw,close_reason,work_type,inquiry_type)
   values($1,$2,'비밀현장','비밀주소','비밀고객','010-1234-5678',$3,$4,$5,$5,$6,$7,$8,$9,$10,1,$11::jsonb,$12,$13,$14)`,
   [id,o.brand||'POUR공법',o.name===undefined?'담당':o.name,o.status||'담당자 배정',o.recv||'2026-11-02T00:00:00Z',o.updated||'2026-11-05T00:00:00Z',o.to===undefined?me:o.to,o.assignedAt===undefined?'2026-11-02T00:20:00Z':o.assignedAt,
    o.firstResp||null,o.resp||null,JSON.stringify(Object.assign({'응대내용':'비밀메모 '+(o.text||'')},o.raw||{})),o.close||null,o.work||null,o.type||null]);
  const flow=(id,fa,fc,mig)=>db.query("insert into crm_security.inquiry_flow_state(inquiry_id,first_attempt_at,first_connected_at,migrated) values($1,$2,$3,$4)",[id,fa,fc,mig||null]);
  const log=(id,kind,at)=>db.query("insert into crm_security.inquiry_contact_logs(id,inquiry_id,kind,result,channel,occurred_at,content) values(gen_random_uuid(),$1,$2,'x','전화',$3,'비밀메모')",[id,kind,at]);
  const audit=(id,action,after,at)=>db.query("insert into crm_security.inquiry_audit_events(event_id,inquiry_id,action,after_data,created_at) values(gen_random_uuid(),$1,$2,$3::jsonb,$4)",[id,action,JSON.stringify(after),at]);

  await inq(Q(1),{});                                                                 // 배정만 · 연락 없음 → 첫 연락 전
  await inq(Q(2),{});await flow(Q(2),null,'2026-11-02T03:00:00Z');await log(Q(2),'connected','2026-11-02T03:00:00Z'); // 응대 기록 연결
  await inq(Q(3),{});await flow(Q(3),'2026-11-02T02:00:00Z',null);await log(Q(3),'attempt','2026-11-02T02:00:00Z');   // 부재만 = 시도
  await inq(Q(4),{resp:'2026-11-03T05:00:00Z',text:'부재중 안받음'});                    // 예전 시각 + 글이 시도만
  await inq(Q(5),{resp:'2026-11-03T05:00:00Z',text:'통화함 견적 요청'});                  // 예전 시각 + 통화
  await inq(Q(6),{firstResp:'2026-11-02T00:00:10Z'});                                    // 접수일 복사 → 이관 기록 확인
  await inq(Q(7),{});await db.query("insert into crm_security.inquiry_memo_reviews values($1,'call','2026-11-04',now(),'비밀메모')",[Q(7)]);
  await inq(Q(8),{status:'보류'});await audit(Q(8),'inquiry_hold',{hold_reason:'공사 연기'},'2026-11-03T00:00:00Z');
  await db.query("insert into public.next_actions(id,inquiry_id,status,due_at,title) values(gen_random_uuid(),$1,'open','2026-11-20T01:00:00Z','비밀메모')",[Q(8)]);
  await inq(Q(9),{});await audit(Q(9),'inquiry_trash',{},'2026-11-03T00:00:00Z');        // 휴지통 → 빠짐
  await inq(Q(10),{brand:'기술자문'});                                                    // 기술자문 → 빠짐
  await inq(Q(11),{status:'배드핏',close:'시공 불가'});                                    // 종결 + 사유
  await inq(Q(12),{to:null,name:'',assignedAt:null});                                    // 미배정
  await inq(Q(13),{to:other});                                                           // 다른 담당

  const deal=(id,owner,cx,o={})=>db.query("insert into public.deals(id,owner_id,stage_code,stage_group,lifecycle_status,stage_entered_at,stage_contexts,lost_reason,wake_up_at,created_at,updated_at,manager_name,manager_mobile,list_fields,version) values($1,$2,$3,$4,'open','2026-10-20T00:00:00Z',$5::jsonb,$6,$7,'2026-10-01T00:00:00Z','2026-11-05T00:00:00Z','비밀고객','010-1234-5678','{\"site_name\":\"비밀현장\"}',3)",
   [id,owner,o.stage||'sent',o.group||'sent',JSON.stringify(cx),o.lost||null,o.wake||null]);
  await deal(D(1),me,{sent:{fields:{sent_date:'2026-11-01',reaction:''}}});
  for(const [type,detail,at] of [['전화',{note:'통화함'},'2026-11-01T05:00:00Z'],['단계전환',{op:'x'},'2026-11-02T01:00:00Z'],['문자',{note:'견적 보냄'},'2026-11-03T01:00:00Z'],['전화',{result:'[전화 · 부재] 비밀메모'},'2026-11-03T02:00:00Z'],['메모',{result:'[전화 · 연결됨] 비밀메모'},'2026-11-04T01:00:00Z']])
   await db.query("insert into public.activities(id,deal_id,type,detail,occurred_at) values(gen_random_uuid(),$1,$2,$3::jsonb,$4)",[D(1),type,JSON.stringify(detail),at]);
  await deal(D(2),me,{sent:{fields:{sent_date:'2026-02-30',sent_date_check:'확인 불가'}}});
  await deal(D(3),me,{waiting:{fields:{reason:'예산 미확정',resume_date:'2026-12-01'}}},{stage:'waiting',group:'relationship'});
  await deal(D(4),me,{lost:{fields:{close_reason:''}}},{stage:'lost',group:'closed',lost:'경쟁사 낙찰'});
  await deal(D(5),other,{},{wake:'2026-12-10T00:00:00Z',stage:'waiting',group:'relationship'});
  await deal(D(6),me,{first_contact:{fields:{meeting_date:'2026-11-03'}},consulting:{fields:{quote_due:'2026-11-12',quote_request:'비밀메모 요청'}},
   sent:{fields:{followup_date:'2026-11-15'}},compete:{fields:{bid_deadline:'2026-11-30',decision_date:'2026-11-28'}},
   contract:{fields:{contract_date:'2026-12-01'}},construction:{fields:{start_date:'2026-12-05'}}},{stage:'consulting',group:'consulting'});
  for(const [type,detail,at] of [['현장방문',{note:'비밀메모 실측함'},'2026-11-02T03:00:00Z'],['미팅',{note:'다음 주 예정'},'2026-11-05T03:00:00Z'],['방문',{result:'취소'},'2026-11-06T03:00:00Z'],['실측',{},'2099-01-01T00:00:00Z']])
   await db.query("insert into public.activities(id,deal_id,type,detail,occurred_at) values(gen_random_uuid(),$1,$2,$3::jsonb,$4)",[D(6),type,JSON.stringify(detail),at]);
  for(const [id,type,at] of [[D(3),'담당자변경','2026-11-06T00:00:00Z'],[D(3),'메모','2026-10-25T00:00:00Z']])
   await db.query("insert into public.activities(id,deal_id,type,detail,occurred_at) values(gen_random_uuid(),$1,$2,'{}'::jsonb,$3)",[id,type,at]);
  await db.query("update public.deals set last_activity_at='2026-10-15T00:00:00Z' where id=$1",[D(4)]);
  for(const [due,status] of [['2026-11-25T00:00:00Z','open'],['2026-11-20T00:00:00Z','open'],['2026-11-10T00:00:00Z','completed']])
   await db.query("insert into public.next_actions(id,deal_id,status,due_at,title) values(gen_random_uuid(),$1,$2,$3,'비밀메모')",[D(1),status,due]);

  const page=async(domain,after=null,limit=200)=>(await db.query("select public.crm_office_timing_v1($1,$2,$3) r",[domain,after,limit])).rows[0].r;
  await db.exec('set role authenticated');
  let r=await page('inquiry_timing');
  assert.equal(r.resource,'office_timing');assert.equal(r.scope_completeness,'actor_authorized_rows_only');assert.equal(r.actor_user_id,me);
  const text=JSON.stringify(r);SECRET.forEach(s=>assert.ok(!text.includes(s),'민감 값이 나가면 안 됨: '+s));
  assert.ok(r.items.every(x=>!['phone','contact_name','site_name','address','raw','assignee_name'].some(k=>k in x)),'이름 · 연락처 칸 없음');
  const by=Object.fromEntries(r.items.map(x=>[x.id,x]));
  assert.ok(!by[Q(9)]&&!by[Q(10)],'휴지통 · 기술자문 제외');
  assert.equal(by[Q(1)].before_first_contact_approx,true);assert.equal(by[Q(1)].first_contact_basis,'none');assert.equal(by[Q(1)].assigned_at_basis,'column');
  assert.equal(Date.parse(by[Q(1)].assigned_at)-Date.parse(by[Q(1)].received_at),20*60000,'배정 30분 기준 재료');
  assert.equal(by[Q(2)].first_contact_basis,'contact_log');assert.equal(by[Q(2)].first_contact_approx,false);assert.equal(by[Q(2)].before_first_contact_approx,false);
  assert.equal(by[Q(3)].first_contact_at,null,'부재만 있으면 첫 연결 아님');assert.ok(by[Q(3)].first_attempt_at);assert.equal(by[Q(3)].before_first_contact_approx,true);
  assert.equal(by[Q(4)].first_contact_at,null,'예전 시각이어도 글이 시도만이면 연결 아님');assert.equal(by[Q(4)].before_first_contact_approx,true);
  assert.equal(by[Q(5)].first_contact_basis,'legacy_stamp');assert.equal(by[Q(5)].first_contact_approx,true);
  assert.equal(by[Q(6)].review_needed_approx,true,'접수일 복사 = 이관 기록 확인');assert.equal(by[Q(6)].before_first_contact_approx,false);
  assert.equal(by[Q(7)].first_contact_basis,'memo_confirmed');assert.equal(by[Q(7)].first_contact_precision,'day');assert.equal(by[Q(7)].memo_call_date,'2026-11-04');
  assert.equal(by[Q(8)].on_hold,true);assert.equal(by[Q(8)].hold_reason_present,true);assert.equal(by[Q(8)].hold_review_date,'2026-11-20');
  assert.equal(by[Q(11)].tracking_closed,true);assert.equal(by[Q(11)].close_reason_present,true);assert.equal(by[Q(11)].before_first_contact_approx,false);
  assert.equal(by[Q(12)].assigned,false);assert.equal(by[Q(12)].assigned_at,null);assert.equal(by[Q(12)].before_first_contact_approx,false);

  r=await page('deal_timing');const dt=Object.fromEntries(r.items.map(x=>[x.id,x]));
  SECRET.forEach(s=>assert.ok(!JSON.stringify(r).includes(s),'영업건에도 민감 값 없음: '+s));
  assert.equal(dt[D(1)].quote_sent_date,'2026-11-01');assert.equal(dt[D(1)].quote_reaction_present,false);
  assert.equal(Date.parse(dt[D(1)].first_activity_after_sent_at),Date.parse('2026-11-03T01:00:00Z'),'발송 당일 · 단계 전환은 후속이 아님, 문자 = 후속 시도');
  assert.equal(Date.parse(dt[D(1)].first_connected_after_sent_at),Date.parse('2026-11-04T01:00:00Z'),'부재 · 문자는 실제 연결 아님');
  assert.equal(dt[D(2)].quote_sent_date,null,'없는 날짜는 null');assert.equal(dt[D(2)].quote_sent_unverifiable,true);
  assert.equal(dt[D(3)].hold_reason_present,true);assert.equal(dt[D(3)].hold_review_date,'2026-12-01');assert.equal(dt[D(3)].hold_review_basis,'resume_date');
  assert.equal(dt[D(4)].lost_reason_present,true,'단계 칸이 비어도 lost_reason 이 있으면 있음');
  assert.equal(dt[D(5)].hold_review_basis,'wake_up_at');assert.equal(dt[D(5)].hold_reason_present,false);
  assert.ok(dt[D(1)].stage_entered_at);
  // 정체 재료(definitions_version 2): 시스템 기록은 활동이 아니다 · 활동이 없으면 last_activity_at → 등록일 · 열린 다음 할 일 기한
  assert.equal(r.definitions_version,3);
  // 단계 근거 날짜(definitions_version 3 · pipeline-judge.js basis 자리)
  const b6=dt[D(6)];
  assert.equal(b6.consulting_quote_due,'2026-11-12');assert.equal(b6.consulting_quote_request_present,true);
  assert.equal(b6.meeting_scheduled_date,'2026-11-03','consulting.meeting_date 가 없으면 first_contact.meeting_date');
  assert.equal(b6.meeting_done_date,'2026-11-02','예정 · 취소 기록은 완료 미팅이 아니다');
  assert.equal(b6.sent_followup_date,'2026-11-15');assert.equal(b6.waiting_resume_date,null);
  assert.equal(b6.bid_deadline_date,'2026-11-30');assert.equal(b6.decision_date,'2026-11-28');assert.equal(b6.briefing_date,null);assert.equal(b6.any_meeting_date,'2026-11-03');
  assert.equal(b6.construction_start_date,'2026-12-05');assert.equal(b6.contract_date,'2026-12-01');
  assert.equal(dt[D(3)].waiting_resume_date,'2026-12-01');assert.equal(dt[D(1)].consulting_quote_request_present,false);
  assert.ok(!JSON.stringify(b6).includes('비밀'),'요청 글 · 메모 원문 없음');
  assert.equal(Date.parse(dt[D(1)].last_sales_activity_at),Date.parse('2026-11-04T01:00:00Z'));assert.equal(dt[D(1)].last_sales_activity_basis,'activity');
  assert.equal(dt[D(3)].last_sales_activity_basis,'activity','담당자변경만 있으면 활동 아님 → 그다음 근거');
  assert.equal(Date.parse(dt[D(3)].last_sales_activity_at),Date.parse('2026-10-25T00:00:00Z'));
  assert.equal(dt[D(4)].last_sales_activity_basis,'last_activity_at');assert.equal(Date.parse(dt[D(4)].last_sales_activity_at),Date.parse('2026-10-15T00:00:00Z'));
  assert.equal(dt[D(5)].last_sales_activity_basis,'created_at');
  assert.equal(Date.parse(dt[D(1)].next_action_due_at),Date.parse('2026-11-20T00:00:00Z'),'열린 할 일 중 가장 이른 기한');assert.equal(dt[D(5)].next_action_due_at,null);

  let p1=await page('deal_timing',null,2);assert.equal(p1.items.length,2);assert.equal(p1.pagination.has_more,true);assert.equal(p1.pagination.next_cursor,D(2));
  p1=await page('deal_timing',p1.pagination.next_cursor,10);assert.equal(p1.items[0].id,D(3));assert.equal(p1.pagination.completeness,'complete');assert.equal(p1.pagination.next_cursor,null);

  await assert.rejects(db.query("select * from public.inquiries"),/permission denied/,'표를 직접 읽을 수 없음');
  await assert.rejects(page('contacts'),/unsupported/);await assert.rejects(page('deal_timing',null,0),/invalid limit/);await assert.rejects(page('deal_timing',null,501),/invalid limit/);

  await db.exec("reset role;set test.role='rep';set role authenticated");
  r=await page('inquiry_timing');assert.ok(r.items.some(x=>x.id===Q(1))&&!r.items.some(x=>x.id===Q(13)),'담당 = 본인 문의만');
  r=await page('deal_timing');assert.ok(!r.items.some(x=>x.id===D(5)),'담당 = 본인 영업건만');
  await db.exec("reset role;set test.role='';set role authenticated");await assert.rejects(page('deal_timing'),/forbidden/);
  await db.exec("reset role;set test.role='admin';set role anon");await assert.rejects(page('deal_timing'),/permission denied/);

  await db.exec("reset role");
  assert.equal((await db.query("select sum(version)::int n from public.deals")).rows[0].n,18,'읽기만 — 자료 그대로');
  await db.exec(read('sql/office-timing-v1-20261108-rollback.sql'));
  assert.equal((await db.query("select count(*)::int n from pg_proc where proname like 'crm_office%'")).rows[0].n,0,'되돌리기 = 새 함수 4개 모두 지움');
  assert.equal((await db.query("select count(*)::int n from public.inquiries")).rows[0].n,13,'되돌리기는 자료를 건드리지 않음');
 }finally{await db.close();}
});

test('사무실 조회는 화면 전송 목록에 넣지 않는다(사무실 전용 · 화면 배너 대상 아님)',()=>{
 const t=read('pc-manager-transport.js');assert.ok(!/crm_office_timing_v1/.test(t));
 const sql=read('sql/office-timing-v1-20261108.sql');
 assert.match(sql,/security definer set search_path=''/);
 assert.match(sql,/revoke all on function public\.crm_office_timing_v1\(text,uuid,integer\) from public, anon, service_role/);
 assert.match(sql,/grant execute on function public\.crm_office_timing_v1\(text,uuid,integer\) to authenticated/);
 assert.ok(!/\b(insert|update|delete)\s+(into\s+)?(public|crm_security)\./i.test(sql),'쓰기 문장 없음');
});
