/* crm-jandi 서버 함수 검사(2026-10-04): 웹훅 주소는 비밀값에만 · 로그인 + 잔디 켜짐 + 관리자(스냅샷 저장 통과)일 때만 발송 ·
   자동 발송은 기간당 한 번 · 보낸 시각을 스냅샷 payload.jandi 에 기록 · 잔디 실패 시 보냈다고 기록하지 않는다 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { handler } from '../supabase/functions/crm-jandi/handler.mjs';

const HOOK='https://wh.jandi.com/connect-api/webhook/123/abc';
function world(opt={}){
 const calls=[],snaps=opt.snaps||[];
 const fetchFn=async(url,init)=>{
  const body=init&&init.body?JSON.parse(init.body):null;calls.push([String(url).replace(/^https:\/\/x\.supabase\.co\/rest\/v1\/rpc\//,''),body]);
  const ok=j=>new Response(JSON.stringify(j),{status:200}),bad=(s,m)=>new Response(JSON.stringify({message:m}),{status:s});
  if(url===HOOK)return opt.jandiFail?new Response('no',{status:500}):new Response('{}',{status:200});
  if(String(url).endsWith('/crm_ops_settings_v1'))return opt.noUser?bad(403,'forbidden'):ok({ok:true,settings:{jandi_enabled:opt.off?false:true}});
  if(String(url).endsWith('/crm_report_snapshot_get_v1'))return ok({ok:true,snapshots:snaps.filter(s=>s.kind===body.p.kind&&s.period_key===body.p.period_key)});
  if(String(url).endsWith('/crm_report_snapshot_save_v1')){if(opt.notAdmin)return bad(403,'관리자만 스냅샷을 저장할 수 있습니다');const i=snaps.findIndex(s=>s.kind===body.p.kind&&s.period_key===body.p.period_key),row={kind:body.p.kind,period_key:body.p.period_key,payload:body.p.payload,promises:body.p.promises};if(i>=0)snaps[i]=row;else snaps.push(row);return ok({ok:true});}
  return bad(404,'unknown');
 };
 const h=handler({supabaseUrl:'https://x.supabase.co',anonKey:'anon',webhookUrl:opt.noHook?'':HOOK,allowedOrigins:'https://poursolution.github.io',fetch:fetchFn,now:()=>'2026-10-05T08:30:10.000Z'});
 const post=(b,auth='Bearer t')=>h(new Request('https://x/functions/v1/crm-jandi',{method:'POST',headers:Object.assign({'content-type':'application/json',origin:'https://poursolution.github.io'},auth?{authorization:auth}:{}),body:JSON.stringify(b)}));
 return {h,post,calls,snaps};
}
const req={kind:'weekly',period_key:'2026-09-28',text:'[주간 영업 브리핑]\n2026.09.28 ~ 10.02\n1. 이번 주 성과',auto:false,payload:{range:'2026.09.28 – 10.02'},promises:[{kind:'no_next',t:'다음 행동 미등록 3건 등록',owner:'황윤선',due:'수요일'}]};

test('로그인 토큰 · 웹훅 비밀값 · 요청 모양 확인',async()=>{
 assert.equal((await world().post(req,'')).status,401);
 const r=await world({noHook:true}).post(req);assert.equal(r.status,503);assert.equal((await r.json()).error,'JANDI_NOT_CONFIGURED');
 assert.equal((await world().post({...req,kind:'yearly'})).status,400);assert.equal((await world().post({...req,text:'짧음'})).status,400);assert.equal((await world().post({...req,period_key:'x'})).status,400);
 assert.equal((await world().h(new Request('https://x',{method:'OPTIONS',headers:{origin:'https://poursolution.github.io'}}))).status,204);
});
test('잔디가 꺼져 있거나 CRM 사용자가 아니면 보내지 않는다',async()=>{
 const off=world({off:true}),r=await off.post(req);assert.equal(r.status,409);assert.equal((await r.json()).error,'JANDI_DISABLED');assert.equal(off.calls.some(c=>c[0]===HOOK),false);
 const no=world({noUser:true});assert.equal((await no.post(req)).status,403);assert.equal(no.calls.some(c=>c[0]===HOOK),false);
});
test('관리자가 아니면(스냅샷 저장 거부) 잔디로 나가지 않는다',async()=>{
 const w=world({notAdmin:true}),r=await w.post(req);assert.equal(r.status,403);assert.equal((await r.json()).error,'FORBIDDEN');assert.equal(w.calls.some(c=>c[0]===HOOK),false);
});
test('다시 보내기: 잔디 발송 → 보낸 시각 · 요약 · 약속을 스냅샷에 기록',async()=>{
 const w=world(),r=await w.post(req),j=await r.json();
 assert.equal(r.status,200);assert.equal(j.ok,true);assert.equal(j.skipped,false);assert.equal(j.jandi.resent_at,'2026-10-05T08:30:10.000Z');
 const hook=w.calls.find(c=>c[0]===HOOK);assert.equal(hook[1].body,req.text);
 assert.deepEqual(w.calls.map(c=>c[0]===HOOK?'HOOK':c[0]),['crm_ops_settings_v1','crm_report_snapshot_get_v1','crm_report_snapshot_save_v1','HOOK','crm_report_snapshot_save_v1'],'관리자 확인(저장) 뒤에 발송');
 assert.deepEqual(w.snaps[0].payload,{range:'2026.09.28 – 10.02',jandi:{resent_at:'2026-10-05T08:30:10.000Z'}});assert.deepEqual(w.snaps[0].promises,req.promises);
 assert.equal(JSON.stringify(j).includes(HOOK),false,'웹훅 주소는 응답에 없다');
});
test('자동 발송은 기간당 한 번 · 기존 약속은 지우지 않는다',async()=>{
 const w=world({snaps:[{kind:'weekly',period_key:'2026-09-28',payload:{range:'r'},promises:[{kind:'stale60',t:'x'}]}]});
 const a=await (await w.post({kind:'weekly',period_key:'2026-09-28',text:req.text,auto:true})).json();assert.equal(a.skipped,false);assert.equal(a.jandi.auto_sent_at,'2026-10-05T08:30:10.000Z');
 assert.deepEqual(w.snaps[0].promises,[{kind:'stale60',t:'x'}],'약속 목록을 주지 않으면 기존 것을 유지');
 const n=w.calls.filter(c=>c[0]===HOOK).length,b=await (await w.post({kind:'weekly',period_key:'2026-09-28',text:req.text,auto:true})).json();
 assert.equal(b.skipped,true);assert.equal(w.calls.filter(c=>c[0]===HOOK).length,n,'두 번째 자동 발송은 나가지 않음');
 const c=await (await w.post({...req,auto:false})).json();assert.equal(c.skipped,false);assert.equal(c.jandi.auto_sent_at,'2026-10-05T08:30:10.000Z');assert.equal(c.jandi.resent_at,'2026-10-05T08:30:10.000Z','회의 후 다시 보내기는 자동 발송 뒤에도 가능');
});
test('잔디가 실패하면 보냈다고 기록하지 않는다',async()=>{
 const w=world({jandiFail:true}),r=await w.post(req);assert.equal(r.status,502);assert.equal((await r.json()).error,'JANDI_UPSTREAM');
 assert.equal(w.snaps[0].payload.jandi.resent_at,undefined);assert.equal(w.snaps[0].payload.jandi.failed_at,'2026-10-05T08:30:10.000Z');
});
