// crm-ai — Deno 진입점. 로직은 handler.mjs (node 검사 대상)
// 비밀값: ANTHROPIC_API_KEY (필수) · CRM_AI_MODEL (선택, 기본 claude-sonnet-5-5) · CRM_AI_ALLOWED_ORIGINS (선택, 쉼표 구분)
import { handler } from './handler.mjs';
Deno.serve(handler({
  supabaseUrl: Deno.env.get('SUPABASE_URL')!,
  anonKey: Deno.env.get('SUPABASE_ANON_KEY')!,
  anthropicKey: Deno.env.get('ANTHROPIC_API_KEY') || '',
  model: Deno.env.get('CRM_AI_MODEL') || 'claude-sonnet-5-5',
  allowedOrigins: Deno.env.get('CRM_AI_ALLOWED_ORIGINS') || 'https://poursolution.github.io',
}));
