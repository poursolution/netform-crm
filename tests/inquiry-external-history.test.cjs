const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync(require('node:path').join(__dirname,'../inquiry-detail-v2.js'),'utf8');
function setup(){
 const root={esc:s=>String(s).replaceAll('<','&lt;').replaceAll('>','&gt;'),escAttr:String,itemPatch:()=>({}),inquiryCreatedAt:()=> '2026-10-05T01:00:00Z',inqCtlConverted:()=>false,inqCtlFirstResponseAt:()=>'',inquiryAssigned:()=>false,inquiryRoutedOwner:()=>'',actionObj:()=>null,InquiryWorkbench:{gist:()=>''},inqCtlWorkLabel:()=>'',repDisplay:x=>x,phoneFmt:x=>x};
 const sandbox={window:root,Date,Set,Map,console};vm.createContext(sandbox);
 vm.runInContext(source.replace('root.InquiryDetailV2={','root.test={externalResponses,timeline,closedStatus,col33,stepsOf,header3};root.InquiryDetailV2={'),sandbox);
 return root;
}
function response(id='e1',at='2026-10-05T02:15:18Z',text='견적은 필요하지 않습니다.'){return {event_id:id,kind:'response',source_at:at,after:{status:'배드핏',response_content:text,close_reason:'고객 요청 종료'}};}
test('external response appears with original time, outcome, reason and source, without inventing a call',()=>{
 const w=setup(),r=w.test.timeline({raw:{external_change_history:[response()]}}).find(x=>x.src==='잔디·시트');
 assert.equal(r.at,'2026-10-05T02:15:18Z');assert.match(r.text,/배드핏.*견적은 필요하지 않습니다.*고객 요청 종료/);assert.equal(r.kind,'system');assert.equal(r.ch,'');assert.equal(r.who,'');
});
test('repeated event and raw appended copy are shown once',()=>{
 const r=setup().test.externalResponses({raw:{external_change_history:[response(),response()],응대내용:'[2026-10-05 11:15:18] 견적은 필요하지 않습니다.'}});assert.equal(r.length,1);
});
test('same response at a later time is a separate event; assignments are not response events',()=>{
 const r=setup().test.externalResponses({raw:{external_change_history:[response(),response('e2','2026-10-06T02:15:18Z'),{kind:'assign',after:{to:'담당자'}}]}});assert.equal(r.length,2);
});
test('legacy response text is preserved without inventing a historical date',()=>{
 const r=setup().test.externalResponses({raw:{응대내용:'옛 응대 원문',external_change_history:'invalid'}});assert.equal(r[0].text,'옛 응대 원문');assert.equal(r[0].at,'');assert.match(r[0].src,/시각 미기록/);
});
test('existing canonical event is not displayed twice',()=>{
 const r=setup().test.externalResponses({activities:[{id:'e1',at:'2026-10-05T02:15:18Z',type:'기타',note:'원문'}],raw:{external_change_history:[response()],응대내용:'[2026-10-05 11:15:18] 견적은 필요하지 않습니다.'}});assert.equal(r.length,0);
});
test('unassigned closed inquiries show completion before any assignment or next action',()=>{
 const w=setup();for(const status of ['배드핏','실주','종결','연락두절','협약완료','해결완료']){
 const q={status,close_reason:'<사유>'},html=w.test.col33(q,{});
 assert.match(html,/처리 완료/);assert.match(html,/&lt;사유&gt;/);assert.doesNotMatch(html,/data-idv|후속 연락|담당자 배정|현장방문/);assert.ok(w.test.stepsOf(q).every(x=>!x.cur));
 }
});
test('hold and store handoff are not terminal sales inquiries',()=>{const w=setup();for(const status of ['보류','전화응대 완료','POUR스토어 이관대기'])assert.equal(w.test.closedStatus({status}),'');});
test('closed history does not attach stale future follow-up to an old contact',()=>{
 const w=setup();w.actionObj=()=>({text:'다시 연락',due:'2026-10-10'});
 const q={status:'배드핏',activities:[{at:'2026-10-05T02:00:00Z',type:'전화',note:'거절'}]};
 assert.ok(w.test.timeline(q).every(x=>!x.next));
});
