'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const html=fs.readFileSync('crm.html','utf8');
function ui(rows){
 const context=vm.createContext({B:{campaigns:rows},CAMPAIGN_STORE:{campaigns:[]},G:{campaignYear:'전체'},CUR_Y:2026,esc:v=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))});
 const names=['campaignLogs','campaignStatusView','campaignDeliveredCount','campaignNeedsReview','campaignDeliveryText','campaignLogYear','campaignYearMatch','campaignYearTabs','campaignHistoryPage','campaignAnalysisPage','campaignHomePage'];
 for(const name of names){const start=html.indexOf('function '+name+'(');if(start<0)continue;const end=html.indexOf('\nfunction ',start+1);vm.runInContext(html.slice(start,end),context)}
 return context;
}
const row=(status,extra={})=>({id:status,created_at:'2026-09-19T09:00:00Z',category:'안내',status,recipient_count:10,...extra});
test('home and history show every provider state without treating uncertainty as waiting',()=>{
 const labels={queued:'전송대기',scheduled:'예약',sending:'발송중',submitted:'결과 대기',sent:'발송완료',partial:'일부 성공',failed:'실패',cancelled:'취소',unknown:'결과 확인 필요'};
 for(const [status,label] of Object.entries(labels)){const c=ui([row(status)]);for(const rendered of [c.campaignHomePage(),c.campaignHistoryPage(false)])assert.ok(rendered.includes('>'+label+'</em>'),status)}
});
test('home counts in-flight and review-required campaigns independently',()=>{
 const c=ui(['queued','scheduled','sending','submitted','partial','unknown','failed','cancelled','sent'].map(s=>row(s)));
 const result=c.campaignHomePage();
 for(const [label,count] of [['예약 발송',1],['발송 준비중',1],['발송 진행중',2],['발송 실패',1],['결과 확인 필요',2]])assert.ok(result.includes('<span>'+label+'</span><b>'+count+'건</b>'),label);
});
test('analysis counts only confirmed recipients including partially finished campaigns',()=>{
 const c=ui([row('sent',{sent_count:8,response_count:2}),row('partial',{sent_count:3,response_count:1}),row('unknown',{sent_count:2}),row('submitted',{sent_count:1,submitted_count:9}),row('sending',{sent_count:1}),row('scheduled'),row('queued'),row('failed')]);
 const result=c.campaignAnalysisPage();
 assert.match(result,/<span>발송 완료<\/span><b>15<\/b>/);
 assert.match(result,/<span>고객 응답<\/span><b>3<\/b>/);
 assert.match(result,/<b>15명<\/b>/);
});
test('legacy sent totals remain readable while explicit zero and null counts are handled safely',()=>{
 const c=ui([row('sent',{id:'old',recipient_count:4}),row('sent',{id:'zero',sent_count:0}),row('sent',{id:'null',sent_count:null,recipient_count:2}),row('partial',{recipient_count:50}),row('sent',{id:'bad',sent_count:'invalid'}),row('sent',{id:'negative',sent_count:-5})]);
 assert.match(c.campaignAnalysisPage(),/<span>발송 완료<\/span><b>6<\/b>/);
});
test('history shows confirmed and failed recipient counts, without manufacturing unknown outcomes',()=>{
 const c=ui([row('partial',{sent_count:6,failed_count:4})]);
 assert.match(c.campaignHistoryPage(false),/성공 6 · 실패 4/);
 assert.match(c.campaignHomePage(),/성공 6 · 실패 4/);
});
test('unrecognized status is review-required and cannot inject a status class',()=>{
 const c=ui([row('" onclick="alert(1)')]);
 for(const rendered of [c.campaignHomePage(),c.campaignHistoryPage(false)]){assert.ok(rendered.includes('class="unknown">결과 확인 필요</em>'));assert.ok(!rendered.includes('onclick="alert(1)'))}
});
test('scheduled filter and year filter still exclude unrelated campaigns',()=>{
 const c=ui([row('scheduled'),row('sent',{created_at:'2025-09-19',sent_count:8}),row('partial',{sent_count:3})]);
 assert.match(c.campaignHistoryPage(true),/cc-panel-badge">1건/);
 c.G.campaignYear='2026';assert.match(c.campaignAnalysisPage(),/<span>발송 완료<\/span><b>3<\/b>/);
});
