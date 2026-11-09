/* asq-meeting-ingest 서버 함수 검사(2026-11-09): 아파트스퀘어 감리 미팅 태블릿 → CRM 문의
   · CORS: 프리플라이트(OPTIONS)에 '*' + content-type, x-asq-key — 파일로 연 태블릿(origin null)도 통과
   · 키(x-asq-key)가 없거나 틀리면 저장 · 업로드 없음 / 비밀값이 비어 있으면 503
   · kind 두 가지만 · 브랜드는 아파트스퀘어만 · 본문 4MB 넘으면 413
   · raw 에 PDF base64 는 없다 · PDF 는 비공개 버킷 경로로 · PDF 못 올리면 문의도 안 넣음
   · 같은 apt+date+kind 는 같은 event_id(→ 같은 문의), kind 가 다르면 다른 건
   · (pglite 가 있으면) 실제 crm_inquiry_ingest_v1 중복 막기 마이그레이션으로 한 건만 남는지 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { handler, MAX_BODY } from '../supabase/functions/asq-meeting-ingest/handler.mjs';

const KEY = 'test-only-key-0123456789abcdef';
const URL_ = 'https://x.supabase.co/functions/v1/asq-meeting-ingest';
const pdfB64 = Buffer.from('%PDF-1.4\n% 시험용 가짜 PDF\n%%EOF').toString('base64');
const survey = {
  kind: 'apartsquare_survey_v1', brand: '아파트스퀘어', apt: '시험아파트', date: '2026-11-09', sentAt: '2026-11-09T05:10:00.000Z',
  survey: { answers: [{ n: 1, q: '현재 감리 방식은?', a: '상주' }, { n: 2, q: '관심 공사', a: ['방수', '도장'] }], memo: '시험 메모' }
};
const meeting = {
  ...survey, kind: 'apartsquare_meeting_v1', kind2: 'meeting',
  note: { text: '시험 노트\n둘째 줄', strokes: { wbs: 3, note: 2 } },
  pdf: { name: '상담결과_시험아파트_2026-11-09.pdf', base64: pdfB64 }
};

function world(opt = {}) {
  const stored = [], uploads = [];
  const h = handler({
    secret: opt.secret === undefined ? KEY : opt.secret,
    now: () => '2026-11-09T05:11:00.000Z',
    async upload(bucket, path, bytes) { if (opt.uploadFail) throw new Error('x'); uploads.push({ bucket, path, bytes }); },
    async store(payload) {
      if (opt.storeFail) throw new Error('x');
      if (opt.store) return opt.store(payload);
      const i = stored.findIndex(s => s.event_id === payload.event_id);
      if (i >= 0) { stored[i] = payload; return { ok: true, deduplicated: true, inquiry_id: 'id-' + i }; }
      stored.push(payload); return { ok: true, deduplicated: false, inquiry_id: 'id-' + (stored.length - 1) };
    }
  });
  const post = (body, headers = {}) => h(new Request(URL_, {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: 'null', 'x-asq-key': KEY, ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body)
  }));
  return { h, post, stored, uploads };
}

test('프리플라이트: origin null 도 통과하는 CORS', async () => {
  const r = await world().h(new Request(URL_, { method: 'OPTIONS', headers: { origin: 'null', 'access-control-request-method': 'POST', 'access-control-request-headers': 'content-type, x-asq-key' } }));
  assert.equal(r.status, 204);
  assert.equal(r.headers.get('access-control-allow-origin'), '*');
  assert.match(r.headers.get('access-control-allow-headers'), /content-type/);
  assert.match(r.headers.get('access-control-allow-headers'), /x-asq-key/);
  assert.match(r.headers.get('access-control-allow-methods'), /POST/);
  const ok = await world().post(survey);
  assert.equal(ok.headers.get('access-control-allow-origin'), '*', '실제 응답에도 CORS 머리');
});

test('키가 없거나 틀리면 저장도 업로드도 없다 · 비밀값 미설정은 503', async () => {
  const w = world();
  assert.equal((await w.post(meeting, { 'x-asq-key': '' })).status, 401);
  assert.equal((await w.post(meeting, { 'x-asq-key': KEY + 'x' })).status, 401);
  assert.equal((await w.post(meeting, { 'x-asq-key': 'short' })).status, 401);
  assert.equal(w.stored.length, 0); assert.equal(w.uploads.length, 0);
  const n = world({ secret: '' }), r = await n.post(survey);
  assert.equal(r.status, 503); assert.equal((await r.json()).error, 'NOT_CONFIGURED');
  assert.equal((await world({ secret: 'too-short' }).post(survey)).status, 503, '짧은 비밀값은 설정 안 된 것으로');
  assert.equal((await w.h(new Request(URL_, { method: 'GET' }))).status, 405);
});

test('모양 검사: kind · 브랜드 · 아파트 · 날짜 · JSON', async () => {
  const w = world();
  const err = async b => { const r = await w.post(b); return [r.status, (await r.json()).error]; };
  assert.deepEqual(await err({ ...survey, kind: 'other_v1' }), [400, 'UNSUPPORTED_KIND']);
  assert.deepEqual(await err({ ...survey, brand: '다른브랜드' }), [400, 'WRONG_BRAND']);
  assert.deepEqual(await err({ ...survey, apt: '  ' }), [400, 'INVALID_PAYLOAD']);
  assert.deepEqual(await err({ ...survey, date: '2026-02-30' }), [400, 'INVALID_PAYLOAD']);
  assert.deepEqual(await err({ ...survey, survey: { answers: [], memo: '' } }), [400, 'EMPTY_SURVEY']);
  assert.deepEqual(await err('{깨진 json'), [400, 'BAD_JSON']);
  assert.deepEqual(await err({ ...meeting, pdf: { name: 'x.pdf', base64: Buffer.from('not a pdf').toString('base64') } }), [400, 'INVALID_PDF']);
  assert.deepEqual(await err({ ...meeting, pdf: { name: 'x.pdf', base64: '@@@@' } }), [400, 'INVALID_PDF']);
  const t = await w.post(survey, { 'content-type': 'text/plain' }); assert.equal(t.status, 415);
  assert.equal(w.stored.length, 0);
});

test('본문이 4MB 를 넘으면 413 · 저장 없음', async () => {
  const w = world();
  const big = { ...meeting, pdf: { name: 'big.pdf', base64: 'A'.repeat(MAX_BODY + 10) } };
  const r = await w.post(big); assert.equal(r.status, 413);
  const huge = { ...meeting, pdf: { name: 'big.pdf', base64: Buffer.concat([Buffer.from('%PDF-'), Buffer.alloc(3_100_000)]).toString('base64') } };
  const r2 = await w.post(huge); assert.equal(r2.status, 413);
  assert.equal(w.stored.length, 0); assert.equal(w.uploads.length, 0);
});

test('질문지: 아파트스퀘어 문의로 — site_name=apt · message=요약 · raw=받은 JSON', async () => {
  const w = world(), r = await w.post(survey), j = await r.json();
  assert.equal(r.status, 200); assert.equal(j.ok, true); assert.equal(j.inquiry_id, 'id-0'); assert.equal(j.pdf, null);
  const p = w.stored[0];
  assert.equal(p.brand, '아파트스퀘어'); assert.equal(p.site_name, '시험아파트'); assert.equal(p.source_channel, 'asq_meeting_tablet');
  assert.match(p.event_id, /^apartsquare_survey_v1:[0-9a-f]{24}$/);
  assert.match(p.message, /^\[아파트스퀘어 감리 미팅 질문지\] 시험아파트 · 2026-11-09/);
  assert.match(p.message, /1\. 현재 감리 방식은\? → 상주/);
  assert.match(p.message, /2\. 관심 공사 → 방수, 도장/);
  assert.match(p.message, /■ 기타 의견\n시험 메모/);
  assert.deepEqual(p.asq, survey);
  assert.equal(p.submitted_at, '2026-11-09T05:10:00.000Z');
  assert.equal(w.uploads.length, 0);
});

test('상담결과: PDF 는 비공개 버킷 경로로 · raw 에 base64 없음 · 노트 · 펜 표시는 요약에', async () => {
  const w = world(), r = await w.post(meeting), j = await r.json();
  assert.equal(r.status, 200);
  assert.equal(w.uploads.length, 1);
  const u = w.uploads[0];
  assert.equal(u.bucket, 'crm-site-files');
  assert.match(u.path, /^inquiries\/apartsquare\/2026-11-09\/meeting-[0-9a-f]{24}\.pdf$/);
  assert.equal(Buffer.from(u.bytes).toString('utf8').startsWith('%PDF-'), true);
  assert.equal(j.pdf, u.path);
  const p = w.stored[0];
  assert.deepEqual(p.pdf, { bucket: 'crm-site-files', path: u.path, name: meeting.pdf.name, size_bytes: u.bytes.length, uploaded_at: '2026-11-09T05:11:00.000Z' });
  assert.equal(JSON.stringify(p).includes(pdfB64), false, 'raw 어디에도 PDF base64 가 없다');
  assert.equal(p.asq.pdf.base64_omitted, true); assert.equal(p.asq.pdf.name, meeting.pdf.name);
  assert.equal(meeting.pdf.base64, pdfB64, '받은 객체는 건드리지 않는다');
  assert.match(p.message, /^\[아파트스퀘어 감리 미팅 상담결과\]/);
  assert.match(p.message, /■ 상담 노트\n시험 노트\n둘째 줄/);
  assert.match(p.message, /■ 펜 표시: wbs 3획 · note 2획/);
});

test('PDF 를 못 올리면 문의도 넣지 않는다(502) · 저장 실패는 503', async () => {
  const a = world({ uploadFail: true }), r = await a.post(meeting);
  assert.equal(r.status, 502); assert.equal((await r.json()).error, 'PDF_UPLOAD_FAILED'); assert.equal(a.stored.length, 0);
  const b = world({ storeFail: true }); assert.equal((await b.post(survey)).status, 503);
  const c = world({ store: () => ({ ok: false }) }); assert.equal((await c.post(survey)).status, 503);
});

test('같은 apt+date+kind 는 한 건(다시 보내면 고쳐 씀) · kind 나 날짜가 다르면 다른 건', async () => {
  const w = world();
  const a = await (await w.post(meeting)).json();
  const b = await (await w.post({ ...meeting, note: { text: '고친 노트' } })).json();
  assert.equal(b.inquiry_id, a.inquiry_id); assert.equal(b.deduplicated, true);
  assert.equal(w.uploads[0].path, w.uploads[1].path, '같은 PDF 경로에 덮어씀');
  assert.match(w.stored[0].message, /고친 노트/);
  const s = await (await w.post(survey)).json(); assert.notEqual(s.inquiry_id, a.inquiry_id);
  const d = await (await w.post({ ...meeting, date: '2026-11-10' })).json(); assert.notEqual(d.inquiry_id, a.inquiry_id);
  const sp = await (await w.post({ ...meeting, apt: '시험 아파트' })).json(); assert.equal(sp.inquiry_id, a.inquiry_id, '띄어쓰기만 다른 아파트 이름은 같은 건');
  assert.equal(w.stored.length, 3);
});

/* 실제 중복 막기 규칙(마이그레이션)과 맞물리는지 — pglite 가 있을 때만 */
let PGlite = null;
try { ({ PGlite } = createRequire(import.meta.url)('@electric-sql/pglite')); } catch { /* 없으면 건너뜀 */ }
test('crm_inquiry_ingest_v1 와 맞물림: 다시 보내도 문의 한 건 · raw 갱신', { skip: PGlite ? false : 'pglite 없음' }, async () => {
  const db = new PGlite();
  try {
    await db.exec(`
      create role anon; create role authenticated; create role service_role; create schema private;
      create table public.users (user_id uuid primary key, name text not null, active boolean not null default true);
      create table public.inquiries (
        id uuid primary key default gen_random_uuid(), sheet_row integer, brand text, site_name text, address text,
        contact_name text, phone text, assigned_to uuid, assignee_name text, assigned_at timestamptz, status text default '접수',
        source_channel text, inquiry_type text default '견적문의', channel text, source text, work_type text,
        business_type text default '견적문의', opportunity_id uuid, deal_id uuid, raw jsonb default '{}'::jsonb,
        received_at timestamptz default clock_timestamp(), created_at timestamptz default clock_timestamp(), updated_at timestamptz default clock_timestamp());
      create function public.crm_inquiry_ingest_v1(p_payload jsonb) returns jsonb language plpgsql security invoker set search_path = '' as $fn$
      declare v_business_type text; recent_sheet_phone_brand_site text := 'installed'; new_id uuid;
      begin
        if coalesce(current_setting('request.jwt.claim.role', true), '') <> 'service_role' and current_user <> 'service_role' then
          raise exception 'SERVICE_ROLE_REQUIRED' using errcode = '42501'; end if;
        insert into public.inquiries(brand, site_name, phone, raw, source_channel) values (p_payload->>'brand', p_payload->>'site_name', p_payload->>'phone', p_payload, p_payload->>'source_channel') returning id into new_id;
        return jsonb_build_object('ok', true, 'deduplicated', false, 'inquiry_id', new_id);
      end $fn$;`);
    for (const f of ['20260911090000_harden_inquiry_ingest_idempotency.sql', '20260913213000_harden_inquiry_mirror_race.sql'])
      await db.exec(fs.readFileSync(new URL('../supabase/migrations/' + f, import.meta.url), 'utf8'));
    await db.query("select set_config('request.jwt.claim.role', 'service_role', false)");
    const w = world({ store: async payload => (await db.query('select public.crm_inquiry_ingest_v1($1::jsonb) r', [JSON.stringify(payload)])).rows[0].r });
    const a = await (await w.post(meeting)).json();
    const b = await (await w.post({ ...meeting, note: { text: '두 번째 노트' } })).json();
    const s = await (await w.post(survey)).json();
    assert.equal(a.ok, true); assert.equal(b.inquiry_id, a.inquiry_id); assert.equal(b.deduplicated, true);
    assert.notEqual(s.inquiry_id, a.inquiry_id);
    const rows = (await db.query("select id, brand, site_name, source_channel, raw from public.inquiries order by created_at")).rows;
    assert.equal(rows.length, 2);
    const m = rows.find(x => x.id === a.inquiry_id);
    assert.equal(m.brand, '아파트스퀘어'); assert.equal(m.site_name, '시험아파트'); assert.equal(m.source_channel, 'asq_meeting_tablet');
    assert.match(m.raw.message, /두 번째 노트/, '다시 보내면 요약이 새것으로');
    assert.match(m.raw.pdf.path, /^inquiries\/apartsquare\//);
    assert.equal(JSON.stringify(m.raw).includes(pdfB64), false);
  } finally { await db.close(); }
});
