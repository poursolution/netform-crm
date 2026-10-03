/* crm-ai — Claude API 제안 서버 함수 (2026-10-02 · 대표 승인 구조)
   화면 → (로그인 토큰) → 이 함수 → Claude API → 결과를 '제안'으로만 저장(crm_ai_suggestion_save_v1) → 화면.
   · API 키는 Supabase 비밀값 ANTHROPIC_API_KEY 에만 있다. 화면 · 저장소에는 없다.
   · 로그인한 CRM 사용자만 쓸 수 있고(crm_ops_settings_v1 을 사용자 토큰으로 불러 확인), 설정 ai_enabled 가 켜져 있을 때만 동작한다.
   · 영업 데이터는 바꾸지 않는다. 사람이 화면에서 확정해야 기존 저장 경로로 반영된다.
   · 같은 입력(input_hash)은 다시 만들지 않는다 — 저장된 제안을 그대로 돌려준다.
   순수 로직(이 파일)은 node 로 검사한다(tests/crm-ai-handler.test.mjs). Deno 진입점은 index.ts. */
export const KINDS=['work_guess','ask_parse','report_text','dup_judge','next_action','call_opener','memo_tidy'];/* memo_tidy: 2026-10-03 · sql/ai-memo-tidy-v1-20261003.sql 적용 뒤 저장됨 */
const WORK=['옥상>싱글','옥상>금속기와','옥상>듀얼','옥상>우레탄','옥상>PVC','재도장>외+내부','재도장>외부','재도장>내부','지하주차장>에폭시','지하주차장>배면차수','지하주차장>지하주차장 재도장','기타>기타'];
const ASK_KEYS=['open','owner','noContact','callToday','amount','noNext','stage','noPhone','text'];
const RULES={
 work_guess:'아파트 보수 공사 영업건의 공종을 추정한다. 아래 분류표의 값만 쓴다: '+WORK.join(', ')+'. 근거가 약하면 keys 를 비운다. JSON: {"keys":[분류표 값],"primary":"대표 공종 또는 빈 문자열","basis":"근거 한 줄(입력에 있는 단어만)","confidence":"high|medium|low"}',
 ask_parse:'영업 CRM 검색 질문을 조건으로 바꾼다. 쓸 수 있는 조건 k: '+ASK_KEYS.join(', ')+'. owner 의 v 는 입력의 owners 중 하나, stage 의 v 는 입력의 stages 중 하나, noContact 의 v 는 일수(숫자), amount 의 v 는 억 단위 숫자, text 의 v 는 검색어. 바꿀 수 없으면 conditions 를 비운다. JSON: {"conditions":[{"k":"조건","v":값 또는 생략}],"note":"해석 한 줄"}',
 report_text:'대표 보고 문장을 쓴다. 입력의 숫자만 쓰고 새 숫자 · 사실을 만들지 않는다. 표지 문장은 기회부터 쓴다. 부탁은 한 가지만, 구체적 대상과 시간을 넣고 거절할 수 있게 쓴다. 약속은 행동만(금액 · 결과 약속 금지), 2개 이하, 확인하는 곳(관리팀 KPI 또는 주간 브리핑)을 적는다. JSON: {"cover":"","risk":"","now":"","people":"","real":"","ask":"","askWhy":"","promises":[{"what":"","who":"","where":""}]}',
 dup_judge:'두 기록(A, B)이 같은 건인지 판단한다. 입력에 있는 값만 근거로 쓴다. JSON: {"probability":0~100 정수,"basis":"근거 한 줄","action":"merge|link|keep"}',
 next_action:'영업건의 다음 할 일을 하나 제안한다. 입력에 있는 사실만 쓴다. JSON: {"how":"전화|문자 · 카카오|방문|자료 준비|입찰 · 계약|기타","what":"무엇을(20자 이내)","days":며칠 뒤(0~30 정수),"why":"이유 한 줄"}',
 call_opener:'영업 담당이 고객에게 전화할 때 첫마디와 이번 통화 목표를 제안한다. 입력에 있는 사실만 쓴다. 과장 · 약속 금지. JSON: {"opener":"첫마디 한두 문장","goal":"이번 통화 목표 한 줄","summary":"지난 대화 요약 두 줄 이내"}',
 memo_tidy:'영업 담당이 통화 직후 말로 남긴 메모(받아쓰기 원문)를 정리한다. 원문에 있는 사실만 쓰고 추측 · 금액 · 날짜를 지어내지 않는다. memo 는 기록에 남길 정리문(존댓말 없이 간결하게, 80자 이내). result 는 통화 결과 분류: ongoing(통화함 · 진행 중) | recall(다시 연락하기로 함) | absent(전화 안 받음) | promise(고객과 약속함) | unknown. promise 면 what 에 약속 내용. next 는 원문에 날짜 · 요일 · 기간이 있을 때만 그 날짜(YYYY-MM-DD, 입력의 today 기준)와 할 일, 없으면 생략. JSON: {"memo":"","result":"ongoing|recall|absent|promise|unknown","what":"","next":{"date":"YYYY-MM-DD","text":""}}'
};
/* 204(사전 확인 OPTIONS)는 본문이 있으면 Response 생성 자체가 예외 → 500 이 되어 브라우저 요청이 전부 막힌다(2026-10-03 운영에서 확인) */
const json=(status,body,origin)=>new Response(status===204?null:JSON.stringify(body),{status,headers:{'content-type':'application/json; charset=utf-8','access-control-allow-origin':origin||'*','access-control-allow-headers':'authorization, content-type, apikey','access-control-allow-methods':'POST, OPTIONS','vary':'origin'}});
export async function inputHash(kind,input){const data=new TextEncoder().encode(kind+'\n'+JSON.stringify(input));const d=await crypto.subtle.digest('SHA-256',data);return [...new Uint8Array(d)].map(b=>b.toString(16).padStart(2,'0')).join('');}
export function extractJson(text){const s=String(text||''),a=s.indexOf('{'),b=s.lastIndexOf('}');if(a<0||b<=a)throw new Error('AI_BAD_OUTPUT');return JSON.parse(s.slice(a,b+1));}
/* 모델이 돌려준 값을 화면이 믿어도 되는 모양으로 좁힌다 */
export function sanitize(kind,o){
 const str=(v,n)=>String(v==null?'':v).slice(0,n);
 if(kind==='work_guess'){const keys=[...new Set((Array.isArray(o.keys)?o.keys:[]).filter(k=>WORK.includes(k)))];return {keys,primary:keys.includes(o.primary)?o.primary:(keys[0]||''),basis:str(o.basis,200),confidence:['high','medium','low'].includes(o.confidence)?o.confidence:'low'};}
 if(kind==='ask_parse')return {conditions:(Array.isArray(o.conditions)?o.conditions:[]).filter(c=>c&&ASK_KEYS.includes(c.k)).slice(0,8).map(c=>c.v==null?{k:c.k}:{k:c.k,v:typeof c.v==='number'?c.v:str(c.v,60)}),note:str(o.note,200)};
 if(kind==='report_text')return {cover:str(o.cover,120),risk:str(o.risk,160),now:str(o.now,200),people:str(o.people,240),real:str(o.real,300),ask:str(o.ask,120),askWhy:str(o.askWhy,240),promises:(Array.isArray(o.promises)?o.promises:[]).slice(0,2).map(p=>({what:str(p&&p.what,80),who:str(p&&p.who,60),where:str(p&&p.where,60)}))};
 if(kind==='dup_judge'){const p=Math.round(Number(o.probability));return {probability:Number.isFinite(p)?Math.max(0,Math.min(100,p)):0,basis:str(o.basis,200),action:['merge','link','keep'].includes(o.action)?o.action:'keep'};}
 if(kind==='memo_tidy'){const nx=o.next&&typeof o.next==='object'&&/^\d{4}-\d{2}-\d{2}$/.test(String(o.next.date||''))?{date:String(o.next.date),text:str(o.next.text,60)}:null;return {memo:str(o.memo,160),result:['ongoing','recall','absent','promise','unknown'].includes(o.result)?o.result:'unknown',what:str(o.what,80),next:nx};}
 if(kind==='next_action'){const d=Math.round(Number(o.days));return {how:['전화','문자 · 카카오','방문','자료 준비','입찰 · 계약','기타'].includes(o.how)?o.how:'전화',what:str(o.what,40),days:Number.isFinite(d)?Math.max(0,Math.min(30,d)):3,why:str(o.why,160)};}
 return {opener:str(o.opener,240),goal:str(o.goal,120),summary:str(o.summary,240)};
}
export function handler(env){
 const fetchFn=env.fetch||fetch,origins=String(env.allowedOrigins||'').split(',').map(s=>s.trim()).filter(Boolean),model=env.model||'claude-sonnet-5-5';
 return async function(req){
  const origin=req.headers.get('origin')||'',allow=origins.length?(origins.includes(origin)?origin:origins[0]):'*';
  if(req.method==='OPTIONS')return json(204,{},allow);
  if(req.method!=='POST')return json(405,{ok:false,error:'METHOD'},allow);
  const auth=req.headers.get('authorization')||'';if(!/^Bearer\s+\S+/.test(auth))return json(401,{ok:false,error:'AUTH_REQUIRED'},allow);
  if(!env.anthropicKey)return json(503,{ok:false,error:'AI_NOT_CONFIGURED'},allow);
  let body;try{body=await req.json();}catch(e){return json(400,{ok:false,error:'BAD_JSON'},allow);}
  const kind=String(body&&body.kind||''),type=String(body&&body.subject_type||'').slice(0,40),id=String(body&&body.subject_id||'').slice(0,200),input=body&&body.input;
  if(!KINDS.includes(kind)||!type||!id||!input||typeof input!=='object'||JSON.stringify(input).length>12000)return json(400,{ok:false,error:'BAD_REQUEST'},allow);
  const rpc=async(name,p)=>{const r=await fetchFn(env.supabaseUrl+'/rest/v1/rpc/'+name,{method:'POST',headers:{apikey:env.anonKey,Authorization:auth,'content-type':'application/json'},body:JSON.stringify({p})});const j=await r.json().catch(()=>null);if(!r.ok)throw Object.assign(new Error(j&&j.message||'RPC_FAILED'),{status:r.status});return j;};
  try{
   /* 1) 로그인한 CRM 사용자인지 + AI 가 켜져 있는지 (사용자 토큰으로 확인) */
   const s=await rpc('crm_ops_settings_v1',{});if(!s||s.ok!==true)return json(403,{ok:false,error:'FORBIDDEN'},allow);
   if(s.settings.ai_enabled!==true)return json(409,{ok:false,error:'AI_DISABLED'},allow);
   /* 2) 같은 입력이면 저장된 제안을 돌려준다 */
   const hash=await inputHash(kind,input),old=await rpc('crm_ai_suggestion_list_v1',{kind,subject_type:type,subject_ids:[id],limit:20});
   const hit=(old.suggestions||[]).find(x=>x.input_hash===hash);if(hit)return json(200,{ok:true,cached:true,suggestion:hit},allow);
   /* 3) Claude API */
   const r=await fetchFn('https://api.anthropic.com/v1/messages',{method:'POST',headers:{'x-api-key':env.anthropicKey,'anthropic-version':'2023-06-01','content-type':'application/json'},
    body:JSON.stringify({model,max_tokens:4000,output_config:{effort:'low'},/* 생각 토큰이 답을 잘라 먹지 않게 여유를 두고, 짧은 제안이라 노력은 낮게 */system:'너는 한국 아파트 보수 공사 영업 CRM의 보조자다. 입력에 없는 사실 · 숫자 · 이름을 만들지 않는다. 반드시 JSON 하나만 출력한다(설명 · 코드블록 없이).\n'+RULES[kind],messages:[{role:'user',content:JSON.stringify(input)}]})});
   if(!r.ok)return json(502,{ok:false,error:'AI_UPSTREAM',status:r.status},allow);
   const out=await r.json();if(out.stop_reason==='refusal'||out.stop_reason==='max_tokens')return json(502,{ok:false,error:'AI_BAD_OUTPUT',stop:out.stop_reason},allow);
   const text=(out.content||[]).filter(c=>c.type==='text').map(c=>c.text).join('');
   const suggestion=sanitize(kind,extractJson(text));
   /* 4) 제안으로만 저장 (사용자 토큰 · 서버 함수가 다시 검사) */
   const saved=await rpc('crm_ai_suggestion_save_v1',{kind,subject_type:type,subject_id:id,input_hash:hash,suggestion,model});
   return json(200,{ok:true,cached:false,suggestion:saved.suggestion},allow);
  }catch(e){
   const st=e&&e.status===401||e&&e.status===403?403:e&&e.message==='AI_BAD_OUTPUT'?502:500;
   return json(st,{ok:false,error:st===403?'FORBIDDEN':e&&e.message==='AI_BAD_OUTPUT'?'AI_BAD_OUTPUT':'FAILED'},allow);
  }
 };
}
