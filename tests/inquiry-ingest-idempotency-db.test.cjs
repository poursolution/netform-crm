'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');
const { PGlite } = createRequire(path.resolve(__dirname, '../../crm-security-lab/package.json'))('@electric-sql/pglite');

const migration = fs.readFileSync(path.join(
  __dirname,
  '../supabase/migrations/20260911090000_harden_inquiry_ingest_idempotency.sql'
), 'utf8');

const uuidA = '11111111-1111-4111-8111-111111111111';
const uuidB = '22222222-2222-4222-8222-222222222222';

async function setup() {
  const db = new PGlite();
  await db.exec(`
    create role anon;
    create role authenticated;
    create role service_role;
    create schema private;
    create table public.users (
      user_id uuid primary key,
      name text not null,
      active boolean not null default true
    );
    create table public.inquiries (
      id uuid primary key default gen_random_uuid(),
      sheet_row integer,
      brand text,
      site_name text,
      address text,
      contact_name text,
      phone text,
      assigned_to uuid,
      assignee_name text,
      assigned_at timestamptz,
      status text default '접수',
      source_channel text,
      inquiry_type text default '견적문의',
      channel text,
      source text,
      work_type text,
      business_type text default '견적문의',
      raw jsonb default '{}'::jsonb,
      received_at timestamptz default clock_timestamp(),
      created_at timestamptz default clock_timestamp(),
      updated_at timestamptz default clock_timestamp()
    );
    create function public.crm_inquiry_ingest_v1(p_payload jsonb)
    returns jsonb language plpgsql security invoker set search_path = '' as $fn$
    declare
      v_business_type text;
      recent_sheet_phone_brand_site text := 'installed';
      new_id uuid;
    begin
      if coalesce(current_setting('request.jwt.claim.role', true), '') <> 'service_role'
         and current_user <> 'service_role' then
        raise exception 'SERVICE_ROLE_REQUIRED' using errcode = '42501';
      end if;
      insert into public.inquiries(
        sheet_row, brand, site_name, phone, raw, business_type
      ) values (
        case when coalesce(p_payload->>'sheet_row', '') ~ '^[0-9]+$' then (p_payload->>'sheet_row')::integer end,
        p_payload->>'brand', p_payload->>'site_name', p_payload->>'phone', p_payload,
        coalesce(p_payload->>'business_type', '견적문의')
      ) returning id into new_id;
      return jsonb_build_object('ok', true, 'deduplicated', false, 'inquiry_id', new_id);
    end $fn$;
  `);
  await db.exec(migration);
  await db.query("select set_config('request.jwt.claim.role', 'service_role', false)");
  return db;
}

async function ingest(db, payload) {
  return (await db.query(
    'select public.crm_inquiry_ingest_v1($1::jsonb) result',
    [JSON.stringify(payload)]
  )).rows[0].result;
}

test('migration compiles and the same external event remains one inquiry', async () => {
  const db = await setup();
  try {
    const payload = {
      event_id: 'evt-101', received_at: '2026-09-11T09:30:00+09:00',
      phone: '010-1111-2222', brand: 'POUR솔루션', site_name: '안전아파트', message: '옥상 방수 문의'
    };
    const first = await ingest(db, payload);
    const replay = await ingest(db, { ...payload, request_id: 'retry-wrapper-id' });
    assert.equal(first.ok, true);
    assert.equal(replay.ok, true);
    assert.equal(replay.deduplicated, true);
    assert.equal(replay.inquiry_id, first.inquiry_id);
    assert.equal((await db.query('select count(*)::int n from public.inquiries')).rows[0].n, 1);
  } finally {
    await db.close();
  }
});

test('strict fingerprint joins sheet and webhook arrival but keeps another day separate', async () => {
  const db = await setup();
  try {
    const common = { phone: '010-3333-4444', brand: 'POUR솔루션', site_name: '교차수집아파트', message: '외벽 방수 문의' };
    const direct = await ingest(db, { ...common, received_at: '2026-09-11T10:00:00+09:00' });
    const sheet = await ingest(db, { ...common, received_at: '2026-09-11 10:01:00', sheet_row: 501 });
    const later = await ingest(db, { ...common, received_at: '2026-09-12T10:00:00+09:00' });
    assert.equal(sheet.inquiry_id, direct.inquiry_id);
    assert.equal(sheet.matched_by, 'idempotency_alias');
    assert.notEqual(later.inquiry_id, direct.inquiry_id);
    assert.equal((await db.query('select count(*)::int n from public.inquiries')).rows[0].n, 2);
    assert.equal((await db.query('select sheet_row from public.inquiries where id=$1', [direct.inquiry_id])).rows[0].sheet_row, 501);
  } finally {
    await db.close();
  }
});

test('a replay can fill an empty owner but cannot overwrite an existing owner UUID', async () => {
  const db = await setup();
  try {
    await db.query('insert into public.users(user_id,name) values ($1,$2),($3,$4)', [uuidA, '김성민', uuidB, '정정훈']);
    const base = { event_id: 'evt-owner', received_at: '2026-09-11', phone: '010-5555-6666', brand: 'POUR솔루션', site_name: '담당보존아파트' };
    const first = await ingest(db, base);
    await ingest(db, { ...base, assignee_name: '김성민' });
    await ingest(db, { ...base, assignee_name: '정정훈' });
    const row = (await db.query('select assigned_to,assignee_name from public.inquiries where id=$1', [first.inquiry_id])).rows[0];
    assert.equal(row.assigned_to, uuidA);
    assert.equal(row.assignee_name, '김성민');
  } finally {
    await db.close();
  }
});

test('two aliases pointing at different inquiries abort instead of guessing or merging', async () => {
  const db = await setup();
  try {
    const a = await ingest(db, { event_id: 'event-a', received_at: '2026-09-11', phone: '010-7777-8888', brand: 'POUR솔루션', site_name: '충돌아파트' });
    const b = await ingest(db, { event_id: 'event-b', received_at: '2026-09-12', phone: '010-9999-0000', brand: 'POUR솔루션', site_name: '다른아파트' });
    await db.query("insert into private.inquiry_ingest_idempotency(event_key,inquiry_id) values ('sheet:777',$1)", [b.inquiry_id]);
    await assert.rejects(
      ingest(db, { event_id: 'event-a', sheet_row: 777, received_at: '2026-09-11', phone: '010-7777-8888', brand: 'POUR솔루션', site_name: '충돌아파트' }),
      /INGEST_IDENTITY_CONFLICT/
    );
    assert.equal((await db.query('select count(*)::int n from public.inquiries')).rows[0].n, 2);
    assert.equal(a.inquiry_id === b.inquiry_id, false);
  } finally {
    await db.close();
  }
});
