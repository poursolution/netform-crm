import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {PGlite} from '@electric-sql/pglite';import {fixture} from './aligo-database-fixture.mjs';
const A='11111111-1111-4111-8111-111111111111',D='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
test('structured collaboration preserves legacy values, latest states, originals, ACL and restoration',async()=>{
 const db=new PGlite();try{await db.exec(fixture);await db.exec(`insert into public.users values('${A}','${A}','관리자','admin',true);insert into crm_security.access_review values('${A}','${A}','admin','admin',true,now()+interval '1 day');insert into public.deals(id) values('${D}');`);
 const sql=readFileSync(new URL('../sql/activity-context-20261007.sql',import.meta.url),'utf8');await db.exec(sql);await db.exec(sql);
 await db.query("select set_config('request.jwt.claim.sub',$1,false)",[A]);
 const notes=['[결정 일정] 입대의 회의 | 미정 | 미확인 | 출처 미기록','[결정 일정] 입대의 회의 | 2026-10-20 | 확인됨 | 소장 통화','[막힌 곳] 내부 · 견적팀 | 자료 대기 | 담당 | 없음 | 보완 요청','[막힌 곳 해제] 풀림 · 2026-10-07','[진척] 견적 요청 | 2026-10-07','[하자] 들뜸 | 접수 2026-10-06 | 담당 미지정 | 약속 없음 | 미해결','[하자] 들뜸 | 접수 2026-10-06 | 담당 미지정 | 약속 없음 | 해결','[확인] 주소 | 확인됨 | 현장 안내 | 2026-10-07','통화 기록 대기 이유: 예산 확정 대기 (2026-11-01까지)'];
 for(let i=0;i<notes.length;i++)await db.query('insert into public.activities(id,deal_id,type,detail,occurred_at) values($1,$2,\'메모\',$3,$4)',['bbbbbbbb-bbbb-4bbb-8bbb-'+String(i).padStart(12,'0'),D,JSON.stringify({note:notes[i]}),'2026-10-07T01:'+String(i).padStart(2,'0')+':00Z']);
 const read=async()=>((await db.query('select public.crm_activity_context_v1($1) r',[JSON.stringify({deal_ids:[D]})])).rows[0].r.items);
 const x=(await read())[D];assert.equal(x.dec.length,1);assert.equal(x.dec[0].date,'2026-10-20');assert.equal(x.blk,null);assert.equal(x.prg.length,1);assert.equal(x.def[0].state,'해결');assert.equal(x.def[0].due,'없음');assert.equal(x.chk['주소'].src,'현장 안내');assert.equal(x.wait.until,'2026-11-01');
 assert.equal((await db.query('select count(*)::int n from public.activities')).rows[0].n,notes.length);
 await db.exec('set role authenticated');await assert.rejects(db.exec('select * from crm_security.activity_context_events'),/permission denied/);await db.exec('reset role');
 const rep='22222222-2222-4222-8222-222222222222',other='cccccccc-cccc-4ccc-8ccc-cccccccccccc';
 await db.exec(`insert into public.users values('${rep}','${rep}','담당자','rep',true);insert into crm_security.access_review values('${rep}','${rep}','rep','rep',true,now()+interval '1 day');insert into public.deals(id) values('${other}');create or replace function crm_security.can_deal(uuid,boolean) returns boolean language sql stable security definer set search_path='' as $$ select exists(select 1 from crm_security.actor() a where a.permission_role='admin' or (a.permission_role='rep' and $1='${D}'::uuid)) $$;`);
 await db.query("select set_config('request.jwt.claim.sub',$1,false)",[rep]);
 const scoped=(await db.query('select public.crm_activity_context_v1($1) r',[JSON.stringify({deal_ids:[D,other]})])).rows[0].r.items;
 assert.deepEqual(Object.keys(scoped),[D]);assert.equal(scoped[D].wait.at,'2026-10-07T01:08:00.000Z');
 await db.exec("set timezone='America/New_York'");assert.equal((await read())[D].wait.at,scoped[D].wait.at);
 await db.query("select set_config('request.jwt.claim.sub',$1,false)",[A]);
 await db.exec(`delete from public.deals where id='${D}'`);assert.deepEqual(await read(),{});await db.exec(`insert into public.deals(id) values('${D}')`);assert.equal((await read())[D].def[0].state,'해결');
 await db.exec("update public.activities set detail=jsonb_build_object('note','그냥 메모')");assert.equal((await read())[D].prg.length,0);assert.equal((await read())[D].wait,null);
 await db.query("select set_config('request.jwt.claim.sub','',false)");await assert.rejects(read(),/forbidden/);
 assert.equal((await db.query("select has_function_privilege('anon','public.crm_activity_context_v1(jsonb)','execute') v")).rows[0].v,false);
 }finally{await db.close();}
});
