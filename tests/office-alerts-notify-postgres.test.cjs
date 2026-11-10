'use strict';
/* 서버 판정 → 잔디 알림(sql/office-alerts-notify-v1-20261110.sql) — 새 건만 · 한 번만 · 해소 뒤 다시 · 조용한 시간 · 이관 제외 · 고객 정보 없음 */
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {PGlite}=require('@electric-sql/pglite'),read=f=>fs.readFileSync(path.join(__dirname,'..',f),'utf8');
const U=n=>'10000000-0000-4000-8000-'+String(n).padStart(12,'0'),Q=n=>'20000000-0000-4000-8000-'+String(n).padStart(12,'0');
const HOOK='https://wh.jandi.com/connect-api/webhook/123/abc';

test('잔디 알림: 꺼져 있으면 안 보내고, 켜면 새 건만 한 번, 해소 뒤 다시 넘기면 다시 보낸다',async()=>{
 const db=new PGlite(),me=U(1);
 try{
  await db.exec("create role anon;create role authenticated;create role service_role;create schema crm_security;create schema net;");
  await db.exec(read('tests/fixtures/dashboard-read-schema.sql'));
  await db.exec(`create table crm_security.inquiry_contact_logs(id uuid,inquiry_id uuid,kind text,result text,channel text,occurred_at timestamptz,content text);
   create table net.calls(id bigserial,url text,body jsonb,headers jsonb);
   create function net.http_post(url text,body jsonb default '{}'::jsonb,params jsonb default '{}'::jsonb,headers jsonb default '{}'::jsonb,timeout_milliseconds integer default 5000)
    returns bigint language sql as $$ insert into net.calls(url,body,headers) values(url,body,headers) returning id $$;
   create function crm_security.actor() returns table(user_id uuid,auth_uid uuid,display_name text,permission_role text) language sql stable as $$ select null::uuid,null::uuid,'x','x' where false $$;
   create function crm_security.can_deal(target uuid,writing boolean default false) returns boolean language sql stable as $$ select false $$;
   create function crm_security.can_inquiry(target uuid) returns boolean language sql stable as $$ select false $$;
   insert into public.users(user_id,name,active) values('${me}','김담당',true);`);
  await db.exec(read('sql/office-timing-v1-20261108.sql'));await db.exec(read('sql/office-alerts-v1-20261110.sql'));
  await db.exec(read('sql/office-alerts-notify-v1-20261110.sql'));await db.exec(read('sql/office-alerts-notify-v1-20261110.sql'));
  const calls=async()=>(await db.query("select * from net.calls order by id")).rows;
  const cycle=async()=>{await db.query("select crm_security.crm_office_alerts_compute_v1()");return (await db.query("select crm_security.crm_office_alerts_notify_v1() r")).rows[0].r;};

  await db.query("insert into public.inquiries(id,brand,site_name,contact_name,phone,status,received_at,created_at,updated_at,assigned_to,assigned_at,sheet_row,raw) values($1,'POUR공법','비밀현장','비밀고객','010-1234-5678','담당자 배정',now()-interval '8 days',now()-interval '8 days',now(),$2,now()-interval '8 days',1,'{}'::jsonb)",[Q(1),me]);
  await db.query("insert into public.inquiries(id,brand,status,received_at,created_at,updated_at,sheet_row,raw) values($1,'POUR공법','접수','2026-09-01T00:00:00Z','2026-09-01T00:00:00Z',now(),2,'{}'::jsonb)",[Q(2)]); // 이관 · 미배정

  let r=await cycle();assert.equal(r.reason,'not_configured','처음엔 꺼져 있음');assert.equal((await calls()).length,0);
  await db.query("update crm_security.office_notify_settings set webhook_url='https://example.com/x',enabled=true,quiet_from=0,quiet_to=0");
  r=await cycle();assert.equal(r.reason,'not_configured','잔디 주소가 아니면 안 보냄');
  await db.query("update crm_security.office_notify_settings set webhook_url=$1",[HOOK]);

  r=await cycle();assert.equal(r.sent,true);assert.equal(r.items,1,'이관 건은 보내지 않음');
  let c=await calls();assert.equal(c.length,1);assert.equal(c[0].url,HOOK);assert.equal(c[0].headers.Accept,'application/vnd.tosslab.jandi-v2+json');
  const msg=JSON.stringify(c[0].body);
  assert.match(c[0].body.body,/새로 기준을 넘긴 일 1건/);assert.match(msg,/첫 연락 2시간 넘김 · 담당 김담당 · 근무(일로 \d+일|\s\d+시간) 넘김/);
  assert.equal(c[0].body.connectInfo[0].description,'https://poursolution.github.io/netform-crm/mobile.html?open=inq%3A'+Q(1));
  assert.ok(!/비밀|010-1234/.test(msg),'고객 이름 · 연락처 · 현장명 없음');

  r=await cycle();assert.equal(r.reason,'nothing_new','같은 건은 한 번만');assert.equal((await calls()).length,1);
  await db.query("insert into crm_security.inquiry_contact_logs values(gen_random_uuid(),$1,'connected','연결됨','전화',now(),'x')",[Q(1)]);
  await db.query("insert into crm_security.inquiry_flow_state(inquiry_id,first_connected_at) values($1,now())",[Q(1)]);
  r=await cycle();assert.equal(r.reason,'nothing_new');assert.equal((await db.query("select count(*)::int n from crm_security.office_alert_notified")).rows[0].n,0,'해소되면 보냄 기록도 지움');
  await db.query("delete from crm_security.inquiry_flow_state");await db.query("delete from crm_security.inquiry_contact_logs");
  r=await cycle();assert.equal(r.sent,true,'다시 넘기면 다시 보냄');assert.equal((await calls()).length,2);

  await db.query("delete from crm_security.office_alert_notified");
  await db.query("update crm_security.office_notify_settings set quiet_from=0,quiet_to=24");
  r=await cycle();assert.equal(r.reason,'quiet_hours');assert.equal((await calls()).length,2,'조용한 시간엔 보내지 않음');
  assert.equal((await db.query("select count(*)::int n from crm_security.office_alert_notified")).rows[0].n,0,'모아 두었다가 나중에');
  r=(await db.query("select crm_security.crm_office_alerts_notify_v1(true) r")).rows[0].r;assert.equal(r.test,true,'시험은 조용한 시간에도 보냄');
  assert.match((await calls())[2].body.body,/CRM 알림 시험/);
  assert.equal((await db.query("select count(*)::int n from crm_security.office_notify_log")).rows[0].n,3);

  await db.exec("set role authenticated");
  await assert.rejects(db.query("select crm_security.crm_office_alerts_notify_v1()"),/permission denied/,'알림 함수는 밖에서 못 부름');
  await assert.rejects(db.query("select webhook_url from crm_security.office_notify_settings"),/permission denied/,'웹훅 주소는 밖에서 못 읽음');
  await db.exec("reset role");
  await db.exec(read('sql/office-alerts-notify-v1-20261110-rollback.sql'));
  assert.equal((await db.query("select to_regclass('crm_security.office_notify_settings') is null x")).rows[0].x,true);
  assert.equal((await db.query("select count(*)::int n from pg_proc where proname='crm_office_alerts_compute_v1'")).rows[0].n,1,'판정은 남는다');
 }finally{await db.close();}
});

test('잔디 알림 SQL: 웹훅 주소를 저장소에 두지 않고, 이관 자료는 보내지 않는다',()=>{
 const sql=read('sql/office-alerts-notify-v1-20261110.sql');
 assert.ok(!/wh\.jandi\.com\/connect-api\/webhook\/[0-9]/.test(sql),'실제 웹훅 주소 없음');
 assert.match(sql,/where a\.run_id=v_run and not a\.legacy/);
 assert.match(sql,/cron\.schedule\('crm-office-alerts','\*\/10 \* \* \* \*','select crm_security\.crm_office_alerts_compute_v1\(\); select crm_security\.crm_office_alerts_notify_v1\(\);'\)/);
});
