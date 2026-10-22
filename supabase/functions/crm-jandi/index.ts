// crm-jandi — Deno 진입점. 로직은 handler.mjs (node 검사 대상)
// 비밀값: JANDI_WEBHOOK_URL (필수 · 잔디 토픽의 수신 웹훅 주소) · CRM_JANDI_ALLOWED_ORIGINS (선택, 쉼표 구분)
import { handler } from './handler.mjs';
Deno.serve(handler({
  supabaseUrl: Deno.env.get('SUPABASE_URL')!,
  anonKey: Deno.env.get('SUPABASE_ANON_KEY')!,
  webhookUrl: Deno.env.get('JANDI_WEBHOOK_URL') || '',
  // 2026-10-22 사건 알림(문의 배정 · 지원 요청 · 하자 접수) 전용 토픽 웹훅(선택) — 없으면 브리핑 웹훅으로
  eventWebhookUrl: Deno.env.get('JANDI_EVENT_WEBHOOK_URL') || '',
  allowedOrigins: Deno.env.get('CRM_JANDI_ALLOWED_ORIGINS') || 'https://poursolution.github.io',
}));
