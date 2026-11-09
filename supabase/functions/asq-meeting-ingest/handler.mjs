/* asq-meeting-ingest — 아파트스퀘어 감리 미팅 태블릿 자료가 보내는 질문지 · 상담결과를 받는 입구 (2026-11-09)
   태블릿(파일로 연 HTML · origin null) → (x-asq-key) → 이 함수 → service_role 로 crm_inquiry_ingest_v1 → public.inquiries.
   · 로그인이 없는 화면이 부르므로 CORS 는 '*'(origin null 포함), 막는 것은 비밀값 x-asq-key 하나다(env ASQ_INGEST_KEY).
     이 키는 HTML 안에 들어가므로 이 함수가 할 수 있는 일만 허락한다: 아파트스퀘어 문의 한 건 넣기(또는 같은 건 고쳐 쓰기) + 그 건의 PDF 올리기.
     읽기 · 지우기 · 다른 브랜드 · 다른 표는 없다.
   · kind 는 apartsquare_survey_v1(질문지) · apartsquare_meeting_v1(상담결과)만 받는다.
   · 같은 건 = 아파트(apt) + 날짜(date) + kind. 다시 보내면 새 문의를 만들지 않고 같은 문의의 원본(raw) · 요약 · PDF 를 새것으로 바꾼다
     (crm_inquiry_ingest_v1 의 event_id 중복 막기를 그대로 쓴다).
   · PDF 는 비공개 버킷 crm-site-files 의 inquiries/apartsquare/<날짜>/<kind>-<해시>.pdf 에 올리고, 경로를 raw.pdf 에 남긴다.
     PDF 를 못 올리면 문의도 넣지 않는다(태블릿에 실패로 보여 다시 보내게).
   · raw 에는 받은 JSON 전체를 넣되 PDF base64 는 뺀다.
   순수 로직(이 파일)은 node 로 검사한다(tests/asq-meeting-ingest-handler.test.mjs). Deno 진입점은 index.ts. */
export const KINDS = ['apartsquare_survey_v1', 'apartsquare_meeting_v1'];
export const BRAND = '아파트스퀘어';
export const SOURCE = 'asq_meeting_tablet';
export const BUCKET = 'crm-site-files';
export const MAX_BODY = 4_200_000;   // 요청 본문(PDF base64 포함) 약 4MB
export const MAX_PDF = 3_000_000;    // 풀어 낸 PDF 약 3MB
const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'content-type, x-asq-key',
  'access-control-allow-methods': 'POST, OPTIONS',
  'access-control-max-age': '86400'
};
const reply = (status, body) => new Response(status === 204 ? null : JSON.stringify(body), {
  status, headers: { ...CORS, ...(status === 204 ? {} : { 'content-type': 'application/json; charset=utf-8' }) }
});
const enc = new TextEncoder();
const bad = code => Object.assign(new Error(code), { code });
const hex = buf => [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
const sha256 = async text => hex(await crypto.subtle.digest('SHA-256', enc.encode(text)));

/* 키 비교: 길이가 달라도 같은 시간이 걸리게 해시끼리 비교 */
async function sameKey(given, secret) {
  const [a, b] = await Promise.all([given, secret].map(v => crypto.subtle.digest('SHA-256', enc.encode(v))));
  const x = new Uint8Array(a), y = new Uint8Array(b);
  let diff = 0; for (let i = 0; i < x.length; i++) diff |= x[i] ^ y[i];
  return diff === 0;
}

/* 글자 정리: 제어문자 빼고 길이 자르기 */
function clean(value, max, { multiline = false } = {}) {
  if (value == null) return '';
  let s = Array.isArray(value) ? value.map(v => String(v ?? '')).join(', ') : String(value);
  s = s.replace(multiline ? /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g : /[\u0000-\u001F\u007F]/g, multiline ? '' : ' ');
  if (!multiline) s = s.replace(/\s+/g, ' ');
  s = s.trim();
  return s.length > max ? s.slice(0, max) : s;
}
function validDate(v) {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return null;
  const ms = Date.parse(v + 'T00:00:00Z');
  return Number.isFinite(ms) && new Date(ms).toISOString().slice(0, 10) === v ? v : null;
}

/* PDF base64 → 바이트. data: 머리 허용, 모양 · 크기 · %PDF- 머리 확인 */
export function decodePdf(pdf) {
  if (pdf == null) return null;
  if (typeof pdf !== 'object' || Array.isArray(pdf)) throw bad('INVALID_PDF');
  let b64 = typeof pdf.base64 === 'string' ? pdf.base64 : '';
  b64 = b64.replace(/^data:application\/pdf;base64,/i, '').replace(/\s+/g, '');
  if (!b64) return null;
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(b64) || b64.length % 4 !== 0) throw bad('INVALID_PDF');
  if (Math.floor(b64.length * 3 / 4) > MAX_PDF + 2) throw bad('PDF_TOO_LARGE');
  const bin = atob(b64), bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  if (bytes.length > MAX_PDF) throw bad('PDF_TOO_LARGE');
  if (String.fromCharCode(...bytes.slice(0, 5)) !== '%PDF-') throw bad('INVALID_PDF');
  const name = clean(pdf.name, 120) || 'meeting.pdf';
  return { bytes, name: /\.pdf$/i.test(name) ? name : name + '.pdf' };
}

/* 받은 JSON 검사 + 정리. 이상하면 INVALID_PAYLOAD */
export function normalize(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw bad('INVALID_PAYLOAD');
  const kind = String(input.kind || '');
  if (!KINDS.includes(kind)) throw bad('UNSUPPORTED_KIND');
  if (input.brand != null && clean(input.brand, 40).replace(/\s+/g, '') !== BRAND) throw bad('WRONG_BRAND');
  const apt = clean(input.apt, 80);
  const date = validDate(input.date);
  if (!apt || !date) throw bad('INVALID_PAYLOAD');
  const sentAt = typeof input.sentAt === 'string' && Number.isFinite(Date.parse(input.sentAt)) ? new Date(Date.parse(input.sentAt)).toISOString() : null;
  const sv = input.survey && typeof input.survey === 'object' && !Array.isArray(input.survey) ? input.survey : {};
  if (sv.answers != null && !Array.isArray(sv.answers)) throw bad('INVALID_PAYLOAD');
  const answers = (sv.answers || []).slice(0, 100).map((x, i) => {
    const o = x && typeof x === 'object' ? x : {};
    const n = Number.isInteger(o.n) && o.n > 0 && o.n < 1000 ? o.n : i + 1;
    return { n, q: clean(o.q, 300), a: clean(o.a, 600) };
  }).filter(x => x.q || x.a);
  const memo = clean(sv.memo, 3000, { multiline: true });
  const nt = input.note && typeof input.note === 'object' && !Array.isArray(input.note) ? input.note : null;
  const strokes = {};
  if (nt && nt.strokes && typeof nt.strokes === 'object' && !Array.isArray(nt.strokes)) {
    for (const [k, v] of Object.entries(nt.strokes).slice(0, 10)) {
      const key = clean(k, 20); if (key && Number.isFinite(Number(v))) strokes[key] = Math.max(0, Math.min(100000, Math.round(Number(v))));
    }
  }
  const note = nt ? { text: clean(nt.text, 8000, { multiline: true }), strokes } : null;
  const pdf = decodePdf(input.pdf);
  if (kind === 'apartsquare_survey_v1' && !answers.length && !memo) throw bad('EMPTY_SURVEY');
  if (kind === 'apartsquare_meeting_v1' && !answers.length && !memo && !(note && note.text) && !pdf) throw bad('EMPTY_MEETING');
  return {
    kind, kind2: clean(input.kind2, 20) || null, apt, date, sentAt,
    survey: { answers, memo }, note, pdf
  };
}

/* CRM 문의 목록에 보일 글(raw.message) */
export function summary(n) {
  const title = n.kind === 'apartsquare_meeting_v1' ? '감리 미팅 상담결과' : '감리 미팅 질문지';
  const lines = [`[아파트스퀘어 ${title}] ${n.apt} · ${n.date}`];
  if (n.survey.answers.length) {
    lines.push('', '■ 질문지');
    for (const x of n.survey.answers) lines.push(`${x.n}. ${x.q || '(질문 없음)'} → ${x.a || '(답 없음)'}`);
  }
  if (n.survey.memo) lines.push('', '■ 기타 의견', n.survey.memo);
  if (n.note && n.note.text) lines.push('', '■ 상담 노트', n.note.text);
  const st = n.note ? Object.entries(n.note.strokes) : [];
  if (st.length) lines.push('', '■ 펜 표시: ' + st.map(([k, v]) => `${k} ${v}획`).join(' · '));
  if (n.pdf) lines.push('', '■ PDF 첨부: ' + n.pdf.name);
  const text = lines.join('\n');
  return text.length > 12000 ? text.slice(0, 12000) + '\n…(줄임)' : text;
}

/* 같은 건(apt+date+kind)이면 같은 PDF 경로 · 같은 event_id */
export async function identity(n) {
  const h = (await sha256([n.apt.replace(/\s+/g, ''), n.date, n.kind].join('|'))).slice(0, 24);
  const short = n.kind === 'apartsquare_meeting_v1' ? 'meeting' : 'survey';
  return {
    eventId: `${n.kind}:${h}`,
    pdfPath: `inquiries/apartsquare/${n.date}/${short}-${h}.pdf`
  };
}

/* 원본(raw)에 남길 JSON: 받은 그대로에서 PDF base64 만 뺀다 */
export function rawCopy(input) {
  const copy = { ...input };
  if (copy.pdf && typeof copy.pdf === 'object') {
    const { base64, ...rest } = copy.pdf; copy.pdf = { ...rest, base64_omitted: typeof base64 === 'string' && base64.length > 0 };
  }
  return copy;
}

export function handler({ secret, store, upload, now = () => new Date().toISOString() }) {
  return async request => {
    if (request.method === 'OPTIONS') return reply(204, {});
    if (request.method !== 'POST') return reply(405, { ok: false, error: 'METHOD_NOT_ALLOWED' });
    if (!secret || String(secret).length < 24) return reply(503, { ok: false, error: 'NOT_CONFIGURED' });
    if (!await sameKey(request.headers.get('x-asq-key') || '', String(secret))) return reply(401, { ok: false, error: 'UNAUTHORIZED' });
    if (!/^application\/json\b/i.test(request.headers.get('content-type') || '')) return reply(415, { ok: false, error: 'JSON_REQUIRED' });
    const declared = Number(request.headers.get('content-length') || 0);
    if (declared > MAX_BODY) return reply(413, { ok: false, error: 'TOO_LARGE' });
    const reader = request.body && request.body.getReader();
    if (!reader) return reply(400, { ok: false, error: 'EMPTY_BODY' });
    let size = 0; const chunks = [];
    while (true) {
      const { done, value } = await reader.read(); if (done) break;
      size += value.length;
      if (size > MAX_BODY) { await reader.cancel().catch(() => {}); return reply(413, { ok: false, error: 'TOO_LARGE' }); }
      chunks.push(value);
    }
    const bytes = new Uint8Array(size); let off = 0; for (const c of chunks) { bytes.set(c, off); off += c.length; }
    let input, n;
    try { input = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)); }
    catch { return reply(400, { ok: false, error: 'BAD_JSON' }); }
    try { n = normalize(input); }
    catch (e) {
      const code = e && e.code || 'INVALID_PAYLOAD';
      return reply(code === 'PDF_TOO_LARGE' ? 413 : 400, { ok: false, error: code });
    }
    const id = await identity(n), at = now();
    let pdfInfo = null;
    if (n.pdf) {
      try { await upload(BUCKET, id.pdfPath, n.pdf.bytes); }
      catch { return reply(502, { ok: false, error: 'PDF_UPLOAD_FAILED' }); }
      pdfInfo = { bucket: BUCKET, path: id.pdfPath, name: n.pdf.name, size_bytes: n.pdf.bytes.length, uploaded_at: at };
    }
    const payload = {
      event_id: id.eventId,
      source_channel: SOURCE,
      source: SOURCE,
      channel: '아파트스퀘어 감리 미팅',
      brand: BRAND,
      site_name: n.apt,
      message: summary(n),
      submitted_at: n.sentAt || at,
      asq_kind: n.kind,
      asq_meeting_date: n.date,
      asq: rawCopy(input),
      pdf: pdfInfo,
      ingest_function: 'asq-meeting-ingest',
      ingested_at: at
    };
    let ack;
    try { ack = await store(payload); }
    catch { return reply(503, { ok: false, error: 'PERSIST_FAILED' }); }
    if (!ack || ack.ok !== true) return reply(503, { ok: false, error: 'PERSIST_FAILED' });
    return reply(200, {
      ok: true, kind: n.kind, inquiry_id: ack.inquiry_id || null,
      deduplicated: ack.deduplicated === true, pdf: pdfInfo ? pdfInfo.path : null, at
    });
  };
}
