const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('relationship-management.js','utf8'),transport=fs.readFileSync('transport.js','utf8');
test('relationship activity dates cross UTC midnight in Korea without changing date-only schedules',()=>{
 const c=vm.createContext({});vm.runInContext(source.slice(source.indexOf('function activityDate('),source.indexOf('function isRelationship(')),c);
 for(const [value,expected] of [['2026-09-19T16:27:00Z','2026-09-20'],['2026-09-19T14:59:59Z','2026-09-19'],['2026-12-31T15:00:00Z','2027-01-01'],['2026-09-20T01:27:00+09:00','2026-09-20'],['2026-09-21','2026-09-21'],['',''],['bad','날짜 미확인']])assert.equal(c.activityDate(value),expected);
 assert.doesNotMatch(source,/fmtD\((?:relActivityAt\(x\)|recent\.at|r\.at|at)\)/);
 assert.match(source,/fmtD\(m\.due\)/);
});
function fixture(status='rejected',overrides={}){
 let saved=0,rows=[{request_id:'r',object_id:'d',auth_uid:'a',user_id:'u',status,error:'INVALID',payload:{note:'original draft'},...overrides}];
 const c=vm.createContext({profile:{user_id:'u'},activeUid:'a',list:()=>structuredClone(rows),save:r=>{rows=r;saved++;}});
 vm.runInContext(transport.slice(transport.indexOf(' function acknowledgeFailure('),transport.indexOf(' function inquiryDirectPayload(')),c);
 return {c,get rows(){return rows;},get saved(){return saved;}};
}
test('review preserves failed status, request, error and input; repeat review is idempotent',()=>{
 for(const status of ['rejected','conflict']){const f=fixture(status),before=structuredClone(f.rows[0]);f.c.acknowledgeFailure('r');const row=f.rows[0];assert.ok(row.reviewed_at);assert.equal(row.reviewed_by,'a');for(const key of Object.keys(before))assert.deepEqual(row[key],before[key]);f.c.acknowledgeFailure('r');assert.equal(f.saved,1);assert.equal(f.rows.length,1);}
});
test('pending, sending, uncertain and successful requests cannot be hidden by failure review',()=>{
 for(const status of ['pending','sending','uncertain','done']){const f=fixture(status);assert.throws(()=>f.c.acknowledgeFailure('r'),/NOT_ALLOWED/);assert.equal(f.saved,0);}
});
test('failure review requires the current identity and an existing request',()=>{
 for(const override of [{auth_uid:'other'},{user_id:'other'}]){const f=fixture('rejected',override);assert.throws(()=>f.c.acknowledgeFailure('r'),/IDENTITY_MISMATCH/);assert.equal(f.saved,0);}
 const f=fixture();assert.throws(()=>f.c.acknowledgeFailure('missing'),/IDENTITY_MISMATCH/);f.c.profile=null;assert.throws(()=>f.c.acknowledgeFailure('r'),/AUTH_REQUIRED/);assert.equal(f.saved,0);
});
