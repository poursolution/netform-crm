'use strict';
/* AI 사무실 서버 판정(sql/office-alerts-v1-20261110.sql) — 규칙별 판정 · 권한 · 보관 · 되돌리기 */
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {PGlite}=require('@electric-sql/pglite'),read=f=>fs.readFileSync(path.join(__dirname,'..',f),'utf8');
const U=n=>'10000000-0000-4000-8000-'+String(n).padStart(12,'0'),Q=n=>'20000000-0000-4000-8000-'+String(n).padStart(12,'0'),D=n=>'30000000-0000-4000-8000-'+String(n).padStart(12,'0'),W=n=>'40000000-0000-4000-8000-'+String(n).padStart(12,'0');

test('서버 판정: 규칙별로 잡고, 관리자 전체 · 담당 본인 건만 읽고, 판정 함수는 밖에서 못 부른다',async()=>{
 const db=new PGlite(),me=U(1),other=U(2);
 try{
  await db.exec("create role anon;create role authenticated;create role service_role;create schema crm_security;");
  await db.exec(read('tests/fixtures/dashboard-read-schema.sql'));
  await db.exec(`create table crm_security.inquiry_contact_logs(id uuid,inquiry_id uuid,kind text,result text,channel text,occurred_at timestamptz,content text);
   create table public.crm_settings(key text primary key,value jsonb,updated_by uuid,updated_at timestamptz);
   insert into public.crm_settings values('ops_rules','{"assign_minutes":30}'::jsonb,null,now());
   create table crm_security.work_requests(id uuid primary key default gen_random_uuid(),status text,due_at timestamptz,created_at timestamptz default now(),to_user_id uuid);
   create function crm_security.actor() returns table(user_id uuid,auth_uid uuid,display_name text,permission_role text) language sql stable as $$
    select coalesce(nullif(current_setting('test.uid',true),''),'${me}')::uuid,'${me}'::uuid,'synthetic',current_setting('test.role',true) where coalesce(current_setting('test.role',true),'')<>'' $$;
   create function crm_security.can_deal(target uuid,writing boolean default false) returns boolean language sql stable as $$
    select exists(select 1 from public.deals d,crm_security.actor() a where d.id=target and (a.permission_role='admin' or d.owner_id=a.user_id)) $$;
   create function crm_security.can_inquiry(target uuid) returns boolean language sql stable as $$
    select exists(select 1 from public.inquiries i,crm_security.actor() a where i.id=target and (a.permission_role='admin' or i.assigned_to=a.user_id)) $$;`);
  await db.exec(read('sql/office-timing-v1-20261108.sql'));
  await db.exec(read('sql/office-alerts-v1-20261110.sql'));await db.exec(read('sql/office-alerts-v1-20261110.sql'));
  assert.equal((await db.query("select count(*)::int n from crm_security.office_alert_runs where ok")).rows[0].n,2,'설치할 때마다 한 번 판정(자료 없어도 성공)');

  const inq=(id,o)=>db.query(`insert into public.inquiries(id,brand,site_name,contact_name,phone,assignee_name,status,received_at,created_at,updated_at,assigned_to,assigned_at,sheet_row,raw,close_reason)
   values($1,'POUR공법','비밀현장','비밀고객','010-1234-5678',$2,$3,now()-$4::interval,now()-$4::interval,now(),$5,$6,1,'{}'::jsonb,$7)`,
   [id,o.to?'담당':'',o.status||'담당자 배정',o.ago||'1 hour',o.to||null,o.assignedAgo?null:null,o.close||null]);
  await inq(Q(1),{ago:'1 hour',status:'접수'});                                          // 미배정 1시간 → 배정 지연
  await inq(Q(2),{ago:'3 hours',to:me});await db.query("update public.inquiries set assigned_at=now()-interval '3 hours' where id=$1",[Q(2)]); // 첫 연락 지연
  await inq(Q(3),{ago:'10 minutes',to:me});await db.query("update public.inquiries set assigned_at=now()-interval '10 minutes' where id=$1",[Q(3)]); // 아직 기한 안
  await inq(Q(4),{status:'배드핏',to:other});                                              // 종결 · 사유 없음
  await inq(Q(5),{status:'보류',to:me});                                                   // 보류 · 사유 없음
  await db.query("insert into public.inquiries(id,brand,status,received_at,created_at,updated_at,sheet_row,raw) values($1,'POUR공법','접수','2026-09-01T00:00:00Z','2026-09-01T00:00:00Z',now(),2,'{}'::jsonb)",[Q(6)]); // 이관 미배정

  const deal=(id,owner,o={})=>db.query("insert into public.deals(id,owner_id,stage_code,lifecycle_status,outcome,stage_contexts,lost_reason,created_at,updated_at,stage_entered_at,version) values($1,$2,$3,$4,$5,$6::jsonb,null,now()-$7::interval,now(),now()-interval '3 days',1)",
   [id,owner,o.stage||'sent',o.life||'active',o.outcome||null,JSON.stringify(o.cx||{}),o.created||'2 days']);
  const act=(id,ago,type='전화')=>db.query("insert into public.activities(id,deal_id,type,detail,occurred_at) values(gen_random_uuid(),$1,$2,'{}'::jsonb,now()-$3::interval)",[id,type,ago]);
  const sent10=new Date(Date.now()-10*864e5).toISOString().slice(0,10);
  await deal(D(1),me,{cx:{sent:{fields:{sent_date:sent10}}}});                             // 견적 후 7일 넘음
  await deal(D(2),me,{created:'5 days',stage:'rapport'});await act(D(2),'40 days');       // 정체
  await deal(D(3),other,{stage:'rapport'});await act(D(3),'10 days');                      // 연락 주기(7일)
  await deal(D(4),me,{created:'5 days',stage:'rapport'});await act(D(4),'40 days');
  await db.query("insert into public.next_actions(id,deal_id,status,due_at,title) values(gen_random_uuid(),$1,'open',now()+interval '5 days','비밀메모')",[D(4)]); // 기다리는 중 → 정체 아님
  await deal(D(5),me,{stage:'consulting'});await db.query("insert into public.next_actions(id,deal_id,status,due_at,title) values(gen_random_uuid(),$1,'open',now()-interval '3 days','x')",[D(5)]); // 다음 할 일 지남
  await deal(D(6),me,{stage:'lost',life:'closed',outcome:'lost'});                         // 실주 사유 없음
  await deal(D(7),me,{stage:'waiting'});                                                   // 대기 · 사유 없음
  await deal(D(8),me,{stage:'rapport',created:'400 days'});                                 // 이관 · 활동 기록 없음 → 정체지만 legacy
  for(const [id,status,due] of [[W(1),'sent','-2 hours'],[W(2),'seen','+2 hours'],[W(3),'done','-5 days']])
   await db.query("insert into crm_security.work_requests(id,status,due_at,to_user_id) values($1,$2,now()+$3::interval,$4)",[id,status,due,me]);

  await db.exec("set test.role='admin';set role authenticated");
  const run=(await db.query("select public.crm_office_alerts_refresh_v1() r")).rows[0].r;assert.equal(run.ok,true,JSON.stringify(run));
  const all=(await db.query("select public.crm_office_alerts_v1(null,0,2000) r")).rows[0].r;
  assert.equal(all.ok,true);assert.equal(all.scope,'all');assert.ok(all.run.age_minutes>=0);assert.equal(all.run.rules.assign_minutes,30);
  const has=(rule,id)=>all.items.some(x=>x.rule===rule&&x.id===id),get=(rule,id)=>all.items.find(x=>x.rule===rule&&x.id===id);
  assert.ok(has('assign_overdue',Q(1)));assert.equal(get('assign_overdue',Q(1)).legacy,false);assert.ok(get('assign_overdue',Q(1)).over_minutes>=29);
  assert.ok(has('first_contact_overdue',Q(2)));assert.equal(get('first_contact_overdue',Q(2)).approx,true);assert.equal(get('first_contact_overdue',Q(2)).owner_user_id,me);
  assert.ok(!all.items.some(x=>x.id===Q(3)),'기한 안이면 없음');
  assert.ok(has('close_reason_missing',Q(4)));assert.ok(has('hold_reason_missing',Q(5)));
  assert.ok(has('assign_overdue',Q(6)));assert.equal(get('assign_overdue',Q(6)).legacy,true,'이관 자료 표시');
  assert.ok(has('quote_followup_overdue',D(1)));
  assert.ok(has('stale',D(2)));assert.equal(get('stale',D(2)).legacy,false);assert.ok(!has('inactive',D(2)),'정체면 연락 주기 알림은 따로 안 냄');
  assert.ok(has('inactive',D(3)));assert.ok(!has('stale',D(3)));
  assert.ok(!all.items.some(x=>x.id===D(4)&&['stale','inactive'].includes(x.rule)),'다음 할 일 날짜가 안 왔으면 기다리는 중');
  assert.ok(has('next_action_overdue',D(5)));assert.ok(has('lost_reason_missing',D(6)));assert.ok(has('hold_reason_missing',D(7)));
  assert.ok(has('stale',D(8)));assert.equal(get('stale',D(8)).legacy,true,'활동 기록 없는 이관 건은 숫자만');
  assert.ok(has('request_overdue',W(1)));assert.ok(!has('request_overdue',W(2))&&!has('request_overdue',W(3)));
  assert.ok(!JSON.stringify(all).match(/비밀|010-1234/),'고객 정보 · 메모 없음');
  assert.ok(all.run.counts['stale:legacy']>=1&&all.run.counts.stale>=1);
  const one=(await db.query("select public.crm_office_alerts_v1('stale',0,1) r")).rows[0].r;assert.equal(one.items.length,1);assert.equal(one.has_more,true);

  await db.exec(`reset role;set test.role='rep';set test.uid='${other}';set role authenticated`);
  const mine=(await db.query("select public.crm_office_alerts_v1(null,0,2000) r")).rows[0].r;
  assert.equal(mine.scope,'own');assert.ok(mine.items.length>0&&mine.items.every(x=>x.owner_user_id===other),'담당은 본인 건만');
  await assert.rejects(db.query("select public.crm_office_alerts_refresh_v1()"),/forbidden/,'다시 판정은 관리자만');
  await assert.rejects(db.query("select crm_security.crm_office_alerts_compute_v1()"),/permission denied/,'판정 함수는 밖에서 못 부름');
  await assert.rejects(db.query("select * from crm_security.office_alerts"),/permission denied/);
  await assert.rejects(db.query("select crm_security.crm_office_timing_core('deal_timing',null,10,true)"),/permission denied/,'본문 함수도 밖에서 못 부름');
  await db.exec("reset role;set test.uid='';set test.role='admin';set role anon");await assert.rejects(db.query("select public.crm_office_alerts_v1()"),/permission denied/);

  await db.exec("reset role");
  for(let i=0;i<7;i++)await db.query("select crm_security.crm_office_alerts_compute_v1()");
  assert.equal((await db.query("select count(*)::int n from crm_security.office_alert_runs")).rows[0].n,6,'최근 6회만 보관');
  assert.equal((await db.query("select count(distinct run_id)::int n from crm_security.office_alerts")).rows[0].n,6);
  assert.equal((await db.query("select count(*)::int n from public.deals")).rows[0].n,8,'영업 자료는 그대로');
  await db.exec(read('sql/office-alerts-v1-20261110-rollback.sql'));
  assert.equal((await db.query("select count(*)::int n from pg_proc where proname like 'crm_office_alerts%'")).rows[0].n,0);
  assert.equal((await db.query("select to_regclass('crm_security.office_alerts') is null x")).rows[0].x,true);
  assert.equal((await db.query("select count(*)::int n from pg_proc where proname='crm_office_timing_v1'")).rows[0].n,1,'사무실 조회는 남는다');
 }finally{await db.close();}
});

test('서버 판정 SQL: 예약 등록은 pg_cron 이 있을 때만 · 쓰는 곳은 결과표뿐',()=>{
 const sql=read('sql/office-alerts-v1-20261110.sql');
 assert.match(sql,/if exists\(select 1 from pg_extension where extname='pg_cron'\)/);
 assert.match(sql,/cron\.schedule\('crm-office-alerts','\*\/10 \* \* \* \*'/);
 const writes=[...sql.matchAll(/\b(insert into|update|delete from)\s+([a-z_]+\.[a-z_]+)/gi)].map(m=>m[2]);
 assert.ok(writes.length>0&&writes.every(t=>/^crm_security\.office_alert(s|_runs)$/.test(t)),'영업 자료 표에 쓰지 않음: '+writes.join(','));
 assert.ok(!/crm_office_alerts/.test(read('pc-manager-transport.js')),'화면 전송 목록에 넣지 않음');
});
