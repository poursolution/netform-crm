const {test}=require('node:test');
const assert=require('node:assert/strict');
const api=require('../pc-followup-plan.js');
test('late date alone never changes stage; explicit long intent does',()=>{
 const d={code:'sent'},i={mode:'later',reason:'予算',due:'2030-12-15',year:'2030'};
 assert.equal(api.plan(d,i).long,false);
 assert.equal(api.plan(d,{...i,long:true}).long,true);
 assert.equal(api.plan(d,{...i,mode:'continue',long:true}).long,false);
 assert.throws(()=>api.plan(d,{...i,due:'2026-02-30'}));
 assert.throws(()=>api.plan({code:'won'},i));
});
test('quote creation and outbound activity are not customer responses',()=>{
 assert.equal(api.noResponse({quote_versions:[{created_at:'2026-09-01'}]}),false);
 const d={quote_versions:[{sent_at:'2026-09-01T10:00:00Z'}],activities:[{at:'2026-09-02T10:00:00Z',result:'문자 발송'}]};
 assert.equal(api.noResponse(d),true);
 d.activities[0].meaningful_contact=true;assert.equal(api.noResponse(d),false);
});
test('missing next date or action is surfaced',()=>{assert.equal(api.noNext({nextAction:{text:'확인'}}),true);assert.equal(api.noNext({nextAction:{text:'확인',due:'2026-09-18'}}),false);});
