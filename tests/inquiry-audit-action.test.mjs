import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
/* 견적문의 감사 기록 action 허용 목록 보강(2026-10-03): 기존 값은 그대로, field_update · close 만 보탠다. 두 번 실행해도 안전 */
const sql=readFileSync(new URL('../sql/inquiry-audit-action-field-update-20261003.sql',import.meta.url),'utf8');
test('audit action check: 기존 목록 유지 + field_update · close 추가 · 다시 실행 안전',async()=>{
 const db=new PGlite();
 try{
  await db.exec("create schema crm_security;create table crm_security.inquiry_audit_events(event_id uuid default gen_random_uuid(),action text not null,constraint inquiry_audit_events_action_check check(action=any(array['direct_assign','inquiry_hold']::text[])));");
  await db.exec(sql);await db.exec(sql);
  const def=(await db.query("select pg_get_constraintdef(c.oid) d from pg_constraint c where c.conname='inquiry_audit_events_action_check'")).rows[0].d;
  assert.match(def,/'direct_assign'/);assert.match(def,/'field_update'/);assert.match(def,/'close'/);
  await db.exec("insert into crm_security.inquiry_audit_events(action) values('field_update'),('close'),('direct_assign')");
  await assert.rejects(db.exec("insert into crm_security.inquiry_audit_events(action) values('nope')"),/check constraint/);
 }finally{await db.close();}
});
