const assert=require('node:assert/strict');
const {create}=require('../organization-history-reader.js');
const reply=(items,more=false,cursor=null)=>({data:{items,has_more:more,next_cursor:cursor}});
(async()=>{
 const calls=[];const first={id:'one',organization_id:'one',name:'동명 현장'};const second={id:'two',organization_id:'two',name:'동명 현장'};
 let reader=create(async p=>{calls.push(p);return p.p_after?reply([first,second]):reply([first],true,'one');});
 assert.equal((await reader.list()).length,2);assert.equal(calls[1].p_after,'one');assert.equal(calls[0].p_org,null);
 const raw=[{id:'old',occurred_at:'2023-01-01',recorded_at:'2026-01-01',body:'<p>원본</p>'},{id:'new',occurred_at:'2025-01-01'}];const before=JSON.stringify(raw);
 reader=create(async()=>reply(raw));const notes=await reader.notes('org');assert.equal(notes[0].id,'new');assert.equal(notes[1].body,'<p>원본</p>');assert.equal(JSON.stringify(raw),before);
 reader=create(async()=>({error:{message:'private server diagnostic'}}));await assert.rejects(reader.list(),/HISTORY_READ_FAILED/);
 reader=create(async()=>({data:{items:[]}}));await assert.rejects(reader.list(),/INVALID_HISTORY_RESPONSE/);
 reader=create(async()=>reply([first],true,'same'));await assert.rejects(reader.list(),/INVALID_HISTORY_CURSOR/);
 reader=create(async p=>p.p_after?reply([{...first,name:'changed'}]):reply([first],true,'one'));await assert.rejects(reader.list(),/HISTORY_CHANGED_DURING_READ/);
 let resolve;reader=create(()=>new Promise(r=>{resolve=r;}));const pending=reader.list();reader.invalidate();resolve(reply([first]));await assert.rejects(pending,/SESSION_CHANGED/);
 let n=0;reader=create(async()=>++n===1?reply([first],true,'one'):{error:{}});await assert.rejects(reader.list(),/HISTORY_READ_FAILED/);
 await assert.rejects(reader.notes(''),/ORGANIZATION_ID_REQUIRED/);
 console.log('PASS: pagination, ID dedup, homonyms kept separate, original dates/body, errors not empty-success, cursor guard, concurrent-change guard, session invalidation, partial-result rejection. Mock data only.');
})().catch(e=>{console.error(e);process.exitCode=1;});
