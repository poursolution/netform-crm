// crm-jandi — Supabase 대시보드 편집기에 붙여 넣는 한 파일 본(handler.mjs + index.ts 를 합친 것 · 내용은 같다)
// 비밀값: JANDI_WEBHOOK_URL (필수 · 잔디 토픽의 수신 웹훅 주소) · CRM_JANDI_ALLOWED_ORIGINS (선택)
/* crm-jandi — 주간 브리핑 · 월간 리포트를 잔디로 보내는 서버 함수 (2026-10-04)
   화면 → (로그인 토큰) → 이 함수 → 잔디 수신 웹훅 → 보낸 시각을 스냅샷(report_snapshots.payload.jandi)에 기록 → 화면.
   · 잔디 웹훅 주소는 Supabase 비밀값 JANDI_WEBHOOK_URL 에만 있다. 화면 · 저장소에는 없다.
   · 관리자만 보낼 수 있다: 보내기 전에 스냅샷 저장 함수(crm_report_snapshot_save_v1 — 관리자 전용)를 사용자 토큰으로 불러 확인한다.
   · 설정 jandi_enabled 가 켜져 있을 때만 동작한다(crm_ops_settings_v1).
   · 자동 발송(auto=true)은 같은 기간에 한 번만 — 이미 자동 발송한 기간이면 보내지 않고 skipped 로 돌려준다.
   · 영업 데이터는 바꾸지 않는다. 바뀌는 것은 그 기간 스냅샷의 payload(화면이 준 요약 + 발송 기록)와 promises(화면이 준 약속 목록)뿐이다.
   순수 로직(이 파일)은 node 로 검사한다(tests/crm-jandi-handler.test.mjs). Deno 진입점은 index.ts. */
const KINDS=['weekly','monthly'];
const json=(status,body,origin)=>new Response(status===204?null:JSON.stringify(body),{status,headers:{'content-type':'application/json; charset=utf-8','access-control-allow-origin':origin||'*','access-control-allow-headers':'authorization, content-type, apikey','access-control-allow-methods':'POST, OPTIONS','vary':'origin'}});
function handler(env){
 const fetchFn=env.fetch||fetch,origins=String(env.allowedOrigins||'').split(',').map(s=>s.trim()).filter(Boolean),now=env.now||(()=>new Date().toISOString());
 return async function(req){
  const origin=req.headers.get('origin')||'',allow=origins.length?(origins.includes(origin)?origin:origins[0]):'*';
  if(req.method==='OPTIONS')return json(204,{},allow);
  if(req.method!=='POST')return json(405,{ok:false,error:'METHOD'},allow);
  const auth=req.headers.get('authorization')||'';if(!/^Bearer\s+\S+/.test(auth))return json(401,{ok:false,error:'AUTH_REQUIRED'},allow);
  if(!/^https:\/\/wh\.jandi\.com\/connect-api\/webhook\//.test(String(env.webhookUrl||'')))return json(503,{ok:false,error:'JANDI_NOT_CONFIGURED'},allow);
  let body;try{body=await req.json();}catch(e){return json(400,{ok:false,error:'BAD_JSON'},allow);}
  const kind=String(body&&body.kind||''),key=String(body&&body.period_key||'').slice(0,20),text=String(body&&body.text||''),auto=body&&body.auto===true;
  const extra=body&&body.payload&&typeof body.payload==='object'&&!Array.isArray(body.payload)?body.payload:null,promises=body&&Array.isArray(body.promises)?body.promises:null;
  if(!KINDS.includes(kind)||!/^\d{4}-\d{2}(-\d{2})?$/.test(key)||text.trim().length<10||text.length>6000||JSON.stringify(body).length>150000)return json(400,{ok:false,error:'BAD_REQUEST'},allow);
  const rpc=async(name,p)=>{const r=await fetchFn(env.supabaseUrl+'/rest/v1/rpc/'+name,{method:'POST',headers:{apikey:env.anonKey,Authorization:auth,'content-type':'application/json'},body:JSON.stringify({p})});const j=await r.json().catch(()=>null);if(!r.ok)throw Object.assign(new Error(j&&j.message||'RPC_FAILED'),{status:r.status});return j;};
  try{
   /* 1) 로그인한 CRM 사용자인지 + 잔디 발송이 켜져 있는지 */
   const s=await rpc('crm_ops_settings_v1',{});if(!s||s.ok!==true)return json(403,{ok:false,error:'FORBIDDEN'},allow);
   if(s.settings.jandi_enabled!==true)return json(409,{ok:false,error:'JANDI_DISABLED'},allow);
   /* 2) 그 기간 스냅샷: 자동 발송은 한 번만 */
   const got=await rpc('crm_report_snapshot_get_v1',{kind,period_key:key,limit:1}),old=(got.snapshots||[])[0]||null;
   const p0=old&&old.payload&&typeof old.payload==='object'?old.payload:{},pr0=old&&Array.isArray(old.promises)?old.promises:[],j0=p0.jandi&&typeof p0.jandi==='object'?p0.jandi:{};
   if(auto&&j0.auto_sent_at)return json(200,{ok:true,skipped:true,jandi:j0},allow);
   const at=now(),base=Object.assign({},p0,extra||{}),list=promises||pr0;
   /* 3) 관리자 확인(스냅샷 저장은 관리자 전용) + 보내는 중 표시 — 여기서 막히면 잔디로 나가지 않는다 */
   await rpc('crm_report_snapshot_save_v1',{kind,period_key:key,payload:Object.assign({},base,{jandi:Object.assign({},j0,{pending_at:at})}),promises:list});
   /* 4) 잔디 수신 웹훅 */
   const r=await fetchFn(env.webhookUrl,{method:'POST',headers:{'Accept':'application/vnd.tosslab.jandi-v2+json','Content-Type':'application/json'},body:JSON.stringify({body:text,connectColor:'#15171C'})});
   if(!r.ok){await rpc('crm_report_snapshot_save_v1',{kind,period_key:key,payload:Object.assign({},base,{jandi:Object.assign({},j0,{failed_at:at})}),promises:list}).catch(()=>{});return json(502,{ok:false,error:'JANDI_UPSTREAM',status:r.status},allow);}
   /* 5) 보낸 시각 기록 */
   const jandi=Object.assign({},j0,auto?{auto_sent_at:at}:{resent_at:at});delete jandi.pending_at;delete jandi.failed_at;
   await rpc('crm_report_snapshot_save_v1',{kind,period_key:key,payload:Object.assign({},base,{jandi}),promises:list});
   return json(200,{ok:true,skipped:false,jandi,snapshot:{kind,period_key:key,payload:Object.assign({},base,{jandi}),promises:list}},allow);
  }catch(e){
   const st=e&&(e.status===401||e.status===403||/관리자만|forbidden/i.test(String(e.message||'')))?403:500;
   return json(st,{ok:false,error:st===403?'FORBIDDEN':'FAILED'},allow);
  }
 };
}

Deno.serve(handler({
  supabaseUrl: Deno.env.get('SUPABASE_URL')!,
  anonKey: Deno.env.get('SUPABASE_ANON_KEY')!,
  webhookUrl: Deno.env.get('JANDI_WEBHOOK_URL') || '',
  allowedOrigins: Deno.env.get('CRM_JANDI_ALLOWED_ORIGINS') || 'https://poursolution.github.io',
}));
