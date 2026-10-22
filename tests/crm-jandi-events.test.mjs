/* crm-jandi 사건 알림(2026-10-22): kind event — 로그인 + 잔디 켜짐이면 관리자가 아니어도 보냄 · 저장 없음 · 허용 origin 링크만 · 사건 전용 웹훅 우선 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {handler,eventMessage,EVENTS,KINDS} from '../supabase/functions/crm-jandi/handler.mjs';
const HOOK='https://wh.jandi.com/connect-api/webhook/123/abc',EHOOK='https://wh.jandi.com/connect-api/webhook/999/evt';
function world(opt={}){
 const calls=[];
 const fetchFn=async(url,init)=>{const body=init&&init.body?JSON.parse(init.body):null;calls.push([String(url),body]);
  const ok=j=>new Response(JSON.stringify(j),{status:200}),bad=(s,m)=>new Response(JSON.stringify({message:m}),{status:s});
  if(url===HOOK||url===EHOOK)return opt.jandiFail?new Response('no',{status:500}):new Response('{}',{status:200});
  if(String(url).endsWith('/crm_ops_settings_v1'))return opt.noUser?bad(403,'forbidden'):ok({ok:true,settings:{jandi_enabled:opt.off?false:true}});
  if(String(url).endsWith('/crm_report_snapshot_save_v1'))return bad(403,'관리자만 스냅샷을 저장할 수 있습니다');
  return bad(404,'unknown');};
 const h=handler({supabaseUrl:'https://x.supabase.co',anonKey:'anon',webhookUrl:HOOK,eventWebhookUrl:opt.eventHook?EHOOK:'',allowedOrigins:'https://poursolution.github.io',fetch:fetchFn,now:()=>'2026-10-22T09:00:00.000Z'});
 const post=(b,auth='Bearer t')=>h(new Request('https://x/functions/v1/crm-jandi',{method:'POST',headers:Object.assign({'content-type':'application/json',origin:'https://poursolution.github.io'},auth?{authorization:auth}:{}),body:JSON.stringify(b)}));
 return {post,calls};
}
const ev={kind:'event',event:'inquiry_assigned',title:'[문의 배정] 오산 골든팰리스',text:'POUR공법 · 옥상 방수 · 담당 이필선 · 배정 송보람',links:[{title:'1차 응대 하기(모바일)',url:'https://poursolution.github.io/netform-crm/mobile.html?open=inq:aaaaaaaa-1111-4111-8111-000000000001'},{title:'PC에서 보기',url:'https://poursolution.github.io/netform-crm/crm.html#p=inq'},{title:'밖',url:'https://evil.example.com/x'}]};
test('eventMessage: 제목 + 본문 · 허용 origin 링크만 카드로 · 사건별 색',()=>{
 const m=eventMessage(ev,['https://poursolution.github.io']);
 assert.equal(m.event,'inquiry_assigned');assert.equal(m.links.length,2,'밖 주소는 뺀다');
 assert.equal(m.payload.body,'[문의 배정] 오산 골든팰리스\nPOUR공법 · 옥상 방수 · 담당 이필선 · 배정 송보람');
 assert.deepEqual(m.payload.connectInfo.map(c=>c.title),['1차 응대 하기(모바일)','PC에서 보기']);assert.equal(m.payload.connectColor,'#2A52B8');
 assert.throws(()=>eventMessage({...ev,event:'party'},[]),/BAD_REQUEST/);assert.throws(()=>eventMessage({...ev,text:'짧'},[]),/BAD_REQUEST/);
 assert.deepEqual(KINDS,['weekly','monthly','event']);assert.ok(EVENTS.includes('defect_reported'));
});
test('사건 알림: 관리자가 아니어도(스냅샷 저장 403) 보낸다 · 저장 호출 없음 · 사건 웹훅 우선',async()=>{
 const w=world({eventHook:true}),r=await w.post(ev),j=await r.json();
 assert.equal(r.status,200);assert.equal(j.ok,true);assert.equal(j.event,'inquiry_assigned');assert.equal(j.links,2);
 assert.equal(w.calls.some(c=>c[0].endsWith('/crm_report_snapshot_save_v1')),false,'저장 없음');
 const hook=w.calls.find(c=>c[0]===EHOOK);assert.ok(hook,'사건 전용 웹훅으로');assert.equal(w.calls.some(c=>c[0]===HOOK),false);
 assert.match(hook[1].body,/^\[문의 배정\]/);assert.equal(hook[1].connectInfo.length,2);
 const w2=world(),r2=await w2.post(ev);assert.equal(r2.status,200);assert.ok(w2.calls.some(c=>c[0]===HOOK),'전용 주소가 없으면 브리핑 웹훅');
});
test('꺼짐 · 비사용자 · 잘못된 사건 · 잔디 실패',async()=>{
 const off=world({off:true});assert.equal((await off.post(ev)).status,409);assert.equal(off.calls.some(c=>c[0]===HOOK),false);
 assert.equal((await world({noUser:true}).post(ev)).status,403);
 assert.equal((await world().post({...ev,event:'x'})).status,400);assert.equal((await world().post({...ev,text:'짧'})).status,400);
 assert.equal((await world().post(ev,'')).status,401);
 const f=world({jandiFail:true}),r=await f.post(ev);assert.equal(r.status,502);assert.equal((await r.json()).error,'JANDI_UPSTREAM');
});
