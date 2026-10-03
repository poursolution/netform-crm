import test from 'node:test';
import assert from 'node:assert/strict';
import {handler} from '../supabase/functions/crm-ai/handler.mjs';
import {cardImage,cleanCard} from '../supabase/functions/crm-ai/contact-card.mjs';
const image={media_type:'image/jpeg',data:'/9j/2Q=='};
const payload={kind:'contact_card',subject_type:'deal',subject_id:'11111111-1111-4111-8111-111111111111',input:{image}};
const req=p=>new Request('https://local/crm-ai',{method:'POST',headers:{authorization:'Bearer test-user'},body:JSON.stringify(p)});
function setup({enabled=true,forbidden=false,text='{"name":"홍길동","mobile":"010-1234-5678","role":"관리소장","office":"02-123-4567","email":"office@example.com"}'}={}){
 const calls=[];const run=handler({supabaseUrl:'https://db',anonKey:'anon',anthropicKey:'test-key',fetch:async(url,init)=>{calls.push({url,body:JSON.parse(init.body),headers:init.headers});
  if(url.endsWith('/crm_ops_settings_v1'))return Response.json(forbidden?{message:'denied'}:{ok:true,settings:{ai_enabled:enabled}},{status:forbidden?403:200});
  if(url==='https://api.anthropic.com/v1/messages')return Response.json({content:[{type:'text',text}]});
  throw Error('Unexpected persistence request');
 }});return {run,calls};
}
test('사진 인식은 사용자 인증·AI 설정 뒤 실행하고 어떤 DB 쓰기/제안 캐시도 하지 않는다',async()=>{
 const {run,calls}=setup(),r=await run(req(payload));assert.equal(r.status,200);const j=await r.json();
 assert.equal(j.suggestion.suggestion.mobile,'01012345678');assert.equal(j.suggestion.suggestion.role,'관리소장');
 assert.equal(calls.length,2);assert.equal(calls[0].headers.Authorization,'Bearer test-user');
 assert.equal(calls[1].body.messages[0].content[0].type,'image');
 assert.equal(JSON.stringify(j).includes(image.data),false);
});
test('비로그인·권한 없음·AI 비활성일 때 공급자 호출 없음',async()=>{
 for(const opts of [{forbidden:true},{enabled:false}]){const {run,calls}=setup(opts);assert.ok([403,409].includes((await run(req(payload))).status));assert.equal(calls.length,1);}
 const {run,calls}=setup();const r=await run(new Request('https://local',{method:'POST',body:JSON.stringify(payload)}));assert.equal(r.status,401);assert.equal(calls.length,0);
});
test('외부 URL·SVG·비이미지·과대 사진 차단',async()=>{
 const {run,calls}=setup();for(const bad of [{image:{url:'https://example.com/a'}},{image:{media_type:'image/svg+xml',data:'AAAA'}},{image:{media_type:'image/jpeg',data:'AAAA'}},{image:{...image,data:'A'.repeat(2800004)}}])assert.equal((await run(req({...payload,input:bad}))).status,400);
 assert.equal(calls.length,0);assert.throws(()=>cardImage({image,extra:'x'}));
 const tooLarge=await run(req({...payload,padding:'x'.repeat(3000000)}));assert.equal(tooLarge.status,413);
});
test('틀린 번호·임의 직책·동의값을 입력값으로 채택하지 않는다',()=>{
 assert.deepEqual(cleanCard({name:'홍길동',mobile:'010-12??-5678',office:'01012345678',email:'invalid',role:'대표이사',sms_consent:true}),{name:'홍길동',mobile:'',office:'',email:'',role:'',note:''});
});
test('인식 실패는 성공 결과를 만들지 않는다',async()=>{
 const {run}=setup({text:'읽지 못함'});assert.equal((await run(req(payload))).status,502);
});
