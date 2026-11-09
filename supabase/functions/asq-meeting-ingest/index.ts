// Deno 진입점. 규칙은 handler.mjs 에 있다(node 테스트: tests/asq-meeting-ingest-handler.test.mjs).
// 배포: supabase functions deploy asq-meeting-ingest --no-verify-jwt   (로그인 없는 태블릿이 부르므로 JWT 검사 끔 — 대신 x-asq-key)
// 비밀값: supabase secrets set ASQ_INGEST_KEY=<24자 이상 임의 문자열>
import { handler } from './handler.mjs';
const url = Deno.env.get('SUPABASE_URL')!;
const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const auth = { apikey: service, Authorization: 'Bearer ' + service };
Deno.serve(handler({
  secret: Deno.env.get('ASQ_INGEST_KEY'),
  async upload(bucket: string, path: string, bytes: Uint8Array) {
    const r = await fetch(`${url}/storage/v1/object/${bucket}/${path}`, {
      method: 'POST',
      headers: { ...auth, 'content-type': 'application/pdf', 'x-upsert': 'true' },
      body: bytes
    });
    if (!r.ok) throw new Error('UPLOAD_FAILED');
  },
  async store(payload: unknown) {
    const r = await fetch(url + '/rest/v1/rpc/crm_inquiry_ingest_v1', {
      method: 'POST',
      headers: { ...auth, 'content-type': 'application/json' },
      body: JSON.stringify({ p_payload: payload })
    });
    if (!r.ok) throw new Error('PERSIST_FAILED');
    return await r.json();
  }
}));
