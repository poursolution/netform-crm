// crm-jandi — Deno 진입점. 로직은 handler.mjs (node 검사 대상)
// 비밀값: JANDI_WEBHOOK_URL (필수 · 잔디 토픽의 수신 웹훅 주소) · CRM_JANDI_ALLOWED_ORIGINS (선택, 쉼표 구분)
import { handler } from './handler.mjs';
Deno.serve(handler({
  supabaseUrl: Deno.env.get('SUPABASE_URL')!,
  anonKey: Deno.env.get('SUPABASE_ANON_KEY')!,
  webhookUrl: Deno.env.get('JANDI_WEBHOOK_URL') || '',
  allowedOrigins: Deno.env.get('CRM_JANDI_ALLOWED_ORIGINS') || 'https://poursolution.github.io',
}));
