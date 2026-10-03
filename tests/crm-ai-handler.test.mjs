import test from 'node:test';
import assert from 'node:assert/strict';
import {handler,sanitize,extractJson,inputHash,KINDS} from '../supabase/functions/crm-ai/handler.mjs';
/* crm-ai 서버 함수: 로그인 · 설정 확인 → Claude → 좁히기 → 제안으로만 저장. 키는 서버 비밀값에만 */
const env=(over={})=>({supabaseUrl:'https://x.supabase.co',anonKey:'anon',anthropicKey:'sk-test',allowedOrigins:'https://poursolution.github.io',...over});
const req=(body,headers={})=>new Request('https://fn/crm-ai',{method:'POST',headers:{'content-type':'application/json',authorization:'Bearer user-jwt',origin:'https://poursolution.github.io',...headers},body:JSON.stringify(body)});
function fakeFetch(state){return async(url,init)=>{state.calls.push([String(url),init]);const u=String(url),ok=(j,status=200)=>new Response(JSON.stringify(j),{status,headers:{'content-type':'application/json'}});
 if(u.endsWith('/rpc/crm_ops_settings_v1'))return state.forbidden?ok({message:'forbidden'},403):ok({ok:true,settings:{ai_enabled:state.enabled}});
 if(u.endsWith('/rpc/crm_ai_suggestion_list_v1'))return ok({ok:true,suggestions:state.saved});
 if(u.includes('api.anthropic.com'))return state.upstream?ok({},500):ok({content:[{type:'text',text:state.text}]});
 if(u.endsWith('/rpc/crm_ai_suggestion_save_v1')){const p=JSON.parse(init.body).p,row={id:'s1',status:'proposed',...p};state.saved.push(row);return ok({ok:true,suggestion:row});}
 return ok({},404);};}
test('crm-ai: 브라우저 사전 확인(OPTIONS)은 204 + CORS 헤더 — 본문 없이',async()=>{
 const r=await handler(env({fetch:fakeFetch({calls:[]})}))(new Request('https://fn/crm-ai',{method:'OPTIONS',headers:{origin:'https://poursolution.github.io','access-control-request-method':'POST','access-control-request-headers':'authorization, content-type, apikey'}}));
 assert.equal(r.status,204);assert.equal(r.body,null);assert.equal(r.headers.get('access-control-allow-origin'),'https://poursolution.github.io');assert.match(r.headers.get('access-control-allow-headers'),/authorization/);assert.match(r.headers.get('access-control-allow-methods'),/POST/);
});
test('crm-ai: memo_tidy — 받아쓰기 원문을 정리 · 결과 분류 · 날짜 있는 다음 할 일만',()=>{
 assert.deepEqual(sanitize('memo_tidy',{memo:'소장님 화요일 방문 확정, 견적 수정본 지참',result:'promise',what:'화요일 방문',next:{date:'2026-10-07',text:'방문'}}),{memo:'소장님 화요일 방문 확정, 견적 수정본 지참',result:'promise',what:'화요일 방문',next:{date:'2026-10-07',text:'방문'}});
 assert.deepEqual(sanitize('memo_tidy',{memo:'x',result:'뭔가',next:{date:'다음주',text:'방문'}}),{memo:'x',result:'unknown',what:'',next:null},'모르는 분류는 unknown · 날짜 모양이 아니면 다음 할 일 없음');
 assert.ok(KINDS.includes('memo_tidy'));
});
test('crm-ai: auth, flag, cache, sanitize, proposal-only save, key stays server-side',async()=>{
 const body={kind:'work_guess',subject_type:'deal',subject_id:'d1',input:{site:'강동 롯데캐슬 옥상 우레탄 방수'}};
 /* 로그인 토큰 없으면 거절 · 키 없으면 준비 안 됨 */
 assert.equal((await handler(env({fetch:fakeFetch({calls:[]})}))(req(body,{authorization:''}))).status,401);
 assert.equal((await handler(env({anthropicKey:'',fetch:fakeFetch({calls:[]})}))(req(body))).status,503);
 /* CRM 사용자가 아니면 거절 · AI 가 꺼져 있으면 Claude 를 부르지 않는다 */
 let st={calls:[],forbidden:true,saved:[]};assert.equal((await handler(env({fetch:fakeFetch(st)}))(req(body))).status,403);
 st={calls:[],enabled:false,saved:[]};const off=await handler(env({fetch:fakeFetch(st)}))(req(body));assert.equal(off.status,409);assert.equal(st.calls.some(c=>c[0].includes('anthropic')),false);
 /* 정상: 분류표 밖의 값은 버리고 제안으로 저장 */
 st={calls:[],enabled:true,saved:[],text:'설명 없이 {"keys":["옥상>우레탄","없는>공종"],"primary":"없는>공종","basis":"현장명의 «옥상 우레탄»","confidence":"high"}'};
 const h=handler(env({fetch:fakeFetch(st)})),r=await h(req(body)),j=await r.json();
 assert.equal(r.status,200);assert.equal(j.cached,false);assert.deepEqual(j.suggestion.suggestion,{keys:['옥상>우레탄'],primary:'옥상>우레탄',basis:'현장명의 «옥상 우레탄»',confidence:'high'});assert.equal(j.suggestion.status,'proposed');
 assert.equal(r.headers.get('access-control-allow-origin'),'https://poursolution.github.io');
 const ai=st.calls.find(c=>c[0].includes('anthropic'));assert.equal(ai[1].headers['x-api-key'],'sk-test');assert.equal(JSON.parse(ai[1].body).model,'claude-sonnet-5-5');
 for(const c of st.calls.filter(c=>c[0].includes('/rpc/'))){assert.equal(c[1].headers.Authorization,'Bearer user-jwt','서버 함수는 사용자 토큰으로 부른다');assert.equal(JSON.stringify(c[1]).includes('sk-test'),false,'키는 Supabase 로 가지 않는다');}
 assert.equal(JSON.stringify(j).includes('sk-test'),false,'키는 화면으로 가지 않는다');
 /* 같은 입력이면 다시 만들지 않는다 */
 const n=st.calls.filter(c=>c[0].includes('anthropic')).length,again=await (await h(req(body))).json();assert.equal(again.cached,true);assert.equal(st.calls.filter(c=>c[0].includes('anthropic')).length,n);
 /* 잘못된 요청 · 모델 오류 · 깨진 출력 */
 assert.equal((await h(req({...body,kind:'delete_all'}))).status,400);
 assert.equal((await handler(env({fetch:fakeFetch({calls:[],enabled:true,saved:[],upstream:true})}))(req(body))).status,502);
 assert.equal((await handler(env({fetch:fakeFetch({calls:[],enabled:true,saved:[],text:'죄송합니다'})}))(req(body))).status,502);
 /* 좁히기 규칙 */
 assert.deepEqual(sanitize('dup_judge',{probability:140,basis:'주소 동일',action:'delete'}),{probability:100,basis:'주소 동일',action:'keep'});
 assert.deepEqual(sanitize('ask_parse',{conditions:[{k:'owner',v:'이필선'},{k:'drop_table'},{k:'noContact',v:30},{k:'open'}]}).conditions,[{k:'owner',v:'이필선'},{k:'noContact',v:30},{k:'open'}]);
 assert.equal(sanitize('report_text',{promises:[{what:'a'},{what:'b'},{what:'c'}]}).promises.length,2,'약속은 2개 이하');
 assert.equal(sanitize('next_action',{how:'이메일',what:'x',days:99}).days,30);
 assert.deepEqual(extractJson('```json\n{"a":1}\n```'),{a:1});assert.throws(()=>extractJson('없음'),/AI_BAD_OUTPUT/);
 assert.equal((await inputHash('a',{x:1})).length,64);assert.equal(KINDS.length,7);
});
