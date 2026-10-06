import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
import { fixture } from './aligo-database-fixture.mjs';

const sql=readFileSync(new URL('../sql/inquiry-consultation-links.sql',import.meta.url),'utf8');
const admin='10000000-0000-4000-8000-000000000001';
const rep='10000000-0000-4000-8000-000000000002';
const other='10000000-0000-4000-8000-000000000003';
const left='20000000-0000-4000-8000-000000000001';
const right='20000000-0000-4000-8000-000000000002';
const third='20000000-0000-4000-8000-000000000003';

test('consultation links preserve independent inquiries and enforce transactional access',async t=>{
 const db=new PGlite();
 try{
  await db.exec(fixture);
  await db.exec(`
   create schema private;
   create table public.inquiries(id uuid primary key,brand text,site_name text,status text,assigned_to uuid,
    updated_at timestamptz default now(),first_response_at timestamptz,raw jsonb,phone text);
   create table crm_security.inquiry_audit_events(event_id uuid primary key default gen_random_uuid(),inquiry_id uuid,action text,created_at timestamptz default now());
   create table crm_security.inquiry_contact_logs(id uuid primary key default gen_random_uuid(),inquiry_id uuid,kind text,
    actor_name text,occurred_at timestamptz,content text,channel text,result text);
   create table private.inquiry_change_events(event_id text primary key,inquiry_id uuid,status text,payload jsonb);
   create table crm_security.contract_sales_events(id int primary key,amount bigint);
   create table crm_security.notification_outbox(id int primary key,content text);
   insert into crm_security.contract_sales_events values(1,1234567);
   insert into crm_security.notification_outbox values(1,'unchanged');
   create function crm_security.can_inquiry(target uuid) returns boolean language sql stable security definer set search_path='' as $$
    select exists(select 1 from crm_security.actor() a join public.inquiries i on i.id=target
     where a.permission_role='admin' or (a.permission_role in ('rep','consultation') and i.assigned_to=a.user_id)) $$;
  `);
  for(const [id,role] of [[admin,'admin'],[rep,'rep'],[other,'rep']]){
   await db.query('insert into public.users values($1,$1,$2,$2,true)',[id,role]);
   await db.query("insert into crm_security.access_review values($1,$1,$2,$2,true,now()+interval '1 day')",[id,role]);
  }
  await db.query(`insert into public.inquiries(id,brand,site_name,status,assigned_to,raw,phone) values
   ($1,'Brand A','test site','배드핏',$4,'{"original":"keep A"}','010-0000-0001'),
   ($2,'Brand B','test site','접수',null,'{"original":"keep B"}','010-0000-0002'),
   ($3,'Brand C','other site','접수',$5,'{}','010-0000-0003')`,[left,right,third,rep,other]);
  await db.exec(sql);
  const login=async id=>{
   await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id??'']);
   await db.exec('set role authenticated');
  };
  const preview=async(l=left,r=right)=>(await db.query('select public.crm_inquiry_consultation_preview_v1($1,$2) value',[l,r])).rows[0].value;
  const write=async(p,op='link',id=randomUUID(),reason='Confirmed same construction request',l=left,r=right)=>
   (await db.query('select public.crm_inquiry_consultation_write_v1($1,$2,$3,$4,$5,$6) value',[l,r,op,reason,id,p.expected])).rows[0].value;
  const peers=async(id=left,after=null)=>(await db.query('select public.crm_inquiry_consultation_list_v1($1,$2) value',[id,after])).rows[0].value;
  const history=async(after=null,l=left,r=right)=>(await db.query('select public.crm_inquiry_consultation_history_v1($1,$2,$3) value',[l,r,after])).rows[0].value;
  const snapshot=async()=>{
   await db.exec('reset role');
   return (await db.query(`select jsonb_build_object(
    'inquiries',(select jsonb_agg(i order by id) from public.inquiries i),
    'contacts',(select jsonb_agg(i order by id) from crm_security.inquiry_contact_logs i),
    'external',(select jsonb_agg(i order by event_id) from private.inquiry_change_events i),
    'audit',(select jsonb_agg(i order by event_id) from crm_security.inquiry_audit_events i),
    'sales',(select jsonb_agg(i) from crm_security.contract_sales_events i),
    'notifications',(select jsonb_agg(i) from crm_security.notification_outbox i)) value`)).rows[0].value;
  };
  let initial,linked,requestId=randomUUID();
  await t.test('untrusted sessions, ordinary reps and direct table access are denied',async()=>{
   await login(null);await assert.rejects(preview(),/forbidden/);
   await login(rep);await assert.rejects(preview(),/forbidden/);
   await assert.rejects(db.query('select * from crm_security.inquiry_consultation_links'),/permission denied/);
   await assert.rejects(db.query('select crm_security.consultation_can_read($1)',[right]),/permission denied/);
   await login(admin);
   await assert.rejects(preview(left,left),/INVALID_PAIR/);
   await assert.rejects(preview(left,null),/INVALID_PAIR/);
   await assert.rejects(preview(left,randomUUID()),/forbidden/);
  });
  await t.test('link, reversed retry and unlink preserve all source data and retain audit',async()=>{
   const before=await snapshot();await login(admin);initial=await preview();
   assert.deepEqual(await preview(right,left),initial);
   linked=await write(initial,'link',requestId);
   assert.equal(linked.active,true);assert.equal(linked.version,1);
   assert.deepEqual(await write(initial,'link',requestId,'Confirmed same construction request',right,left),linked);
   await assert.rejects(write(initial,'unlink',requestId),/REQUEST_ID_REUSE/);
   await assert.rejects(write(initial,'link',requestId,'different evidence'),/REQUEST_ID_REUSE/);
   assert.equal((await peers()).items[0].id,right);
   await assert.rejects(write(await preview(),'link'),/RELATIONSHIP_UNCHANGED/);
   const unlinked=await write(await preview(),'unlink');assert.equal(unlinked.version,2);assert.equal(unlinked.active,false);
   assert.equal((await peers()).items.length,0);
   await assert.rejects(history(),/LINK_NOT_ACTIVE/);
   assert.deepEqual(await snapshot(),before);
   const audit=(await db.query('select operation,reason from crm_security.inquiry_consultation_events order by created_at')).rows;
   assert.deepEqual(audit.map(x=>x.operation),['link','unlink']);assert.ok(audit.every(x=>x.reason));
   await login(admin);assert.deepEqual(await write(initial,'link',requestId),linked); // receipt, not current state
   assert.equal((await preview()).active,false);
  });
  await t.test('stale ownership/status, empty reasons and stale relationship versions cannot save',async()=>{
   await login(admin);let p=await preview();
   await assert.rejects(write(p,'link',randomUUID(),'  '),/INVALID_REQUEST/);
   await db.exec('reset role');await db.query("update public.inquiries set assigned_to=$1 where id=$2",[other,right]);
   await login(admin);await assert.rejects(write(p),/STALE_PREVIEW/);
   p=await preview();await db.exec('reset role');await db.query("update public.inquiries set status='응대중' where id=$1",[right]);
   await login(admin);await assert.rejects(write(p),/STALE_PREVIEW/);
   p=await preview();await write(p);await assert.rejects(write(p),/STALE_PREVIEW/);
   await write(await preview(),'unlink');await assert.rejects(write(p),/STALE_PREVIEW/);
  });
  await t.test('audit failure rolls back relationship instead of reporting partial success',async()=>{
   await db.exec(`reset role; create function crm_security.test_audit_failure() returns trigger language plpgsql as $$
    begin raise exception 'simulated storage failure'; end $$;
    create trigger test_audit_failure before insert on crm_security.inquiry_consultation_events
    for each row execute function crm_security.test_audit_failure();`);
   await login(admin);const p=await preview();await assert.rejects(write(p),/simulated storage failure/);
   assert.deepEqual(await preview(),p);
   await db.exec('reset role; drop trigger test_audit_failure on crm_security.inquiry_consultation_events;');
  });
  await t.test('links do not grant peer access; direct pairs do not imply transitive links',async()=>{
   await login(admin);await write(await preview());
   await write(await preview(right,third),'link',randomUUID(),'Separate explicit pair',right,third);
   assert.deepEqual((await peers()).items.map(x=>x.id),[right]);
   await assert.rejects(history(null,left,third),/LINK_NOT_ACTIVE/);
   await login(rep);assert.deepEqual((await peers()).items,[]);await assert.rejects(history(),/forbidden/);
   await db.exec('reset role');await db.query('update public.inquiries set assigned_to=$1 where id=$2',[rep,right]);
   await login(rep);assert.deepEqual((await peers()).items.map(x=>x.id),[right]);assert.equal((await history()).ok,true);
   await db.exec('reset role');await db.query('update crm_security.access_review set approved=false where user_id=$1',[rep]);
   await login(rep);await assert.rejects(peers(),/forbidden/);
   await db.exec('reset role');await db.query('update crm_security.access_review set approved=true where user_id=$1',[rep]);
  });
  await t.test('source events are paged 20 at a time, exact external copies deduplicated, no contact inferred',async()=>{
   await db.exec('reset role');
   await db.query(`insert into private.inquiry_change_events values('external-1',$1,'applied',$2),('failed-1',$1,'failed',$3)`,
    [left,{kind:'response',occurred_at:'2026-10-06T08:00:00Z',response_content:'source response',status:'배드핏',private_key:'must not leak'}, {response_content:'must not leak failed'}]);
   await db.query(`update public.inquiries set raw=raw||$1::jsonb where id=$2`,[
    {external_change_history:[{event_id:'external-1',kind:'response',source_at:'2026-10-06T08:00:00Z',after:{response_content:'raw duplicate'}},
     {event_id:'external-missing-time',kind:'response',source_at:'invalid',after:{response_content:'undated source'}}]},left]);
   for(let n=0;n<24;n++)await db.query(`insert into crm_security.inquiry_contact_logs(inquiry_id,kind,occurred_at,content,channel,result)
    values($1,'connected','2026-10-06T08:00:00Z','same actual contact text','phone','connected')`,[n%2?left:right]);
   const before=await snapshot();await login(rep);
   let page=await history(),rows=page.items;assert.equal(rows.length,20);assert.ok(page.next_cursor);
   assert.equal(rows[0].occurred_at,null); // missing time is never today's time
   while(page.next_cursor){page=await history(page.next_cursor);assert.ok(page.items.length<=20);rows.push(...page.items);}
   assert.equal(new Set(rows.map(x=>x.event_key)).size,rows.length);
   assert.equal(rows.filter(x=>x.source==='crm_contact').length,24); // same text is not same event
   assert.equal(rows.filter(x=>x.source==='external').length,2);
   assert.equal(rows.find(x=>x.source_event_id==='external-1').detail.content,'source response');
   assert.doesNotMatch(JSON.stringify(rows),/must not leak|raw duplicate/);
   assert.ok(rows.every(x=>x.source_event_id));
   await assert.rejects(history({at:'invalid',key:'x'}),/INVALID_CURSOR/);
   assert.deepEqual(await snapshot(),before);
  });
  await t.test('peer pagination is bounded and trash immediately revokes history access',async()=>{
   await db.exec('reset role');
   for(let n=4;n<=25;n++){
    const id='20000000-0000-4000-8000-'+String(n).padStart(12,'0');
    await db.query("insert into public.inquiries(id,status,assigned_to) values($1,'접수',$2)",[id,rep]);
    await login(admin);await write(await preview(left,id),'link',randomUUID(),'Explicit test pair',left,id);await db.exec('reset role');
   }
   await login(rep);const p=await peers();assert.equal(p.items.length,20);assert.ok(p.next_cursor);
   const last=await peers(left,p.next_cursor);assert.equal(last.items.length,3);assert.equal(last.next_cursor,null);
   await db.exec('reset role');await db.query("insert into crm_security.inquiry_audit_events(inquiry_id,action) values($1,'inquiry_trash')",[right]);
   await login(rep);await assert.rejects(history(),/forbidden/);
   await login(admin);await assert.rejects(preview(),/forbidden/);await assert.rejects(write(initial,'link',requestId),/forbidden/);
  });
  await t.test('anonymous and service roles cannot bypass RPC identity; private tables have RLS',async()=>{
   await db.exec('reset role; set role anon');await assert.rejects(preview(),/permission denied/);
   await db.exec('reset role; set role service_role');await assert.rejects(peers(),/permission denied/);
   await db.exec('reset role');
   const rows=(await db.query("select relrowsecurity from pg_class where relname in ('inquiry_consultation_links','inquiry_consultation_events')")).rows;
   assert.equal(rows.length,2);assert.ok(rows.every(x=>x.relrowsecurity));
  });
 }finally{await db.close();}
});
