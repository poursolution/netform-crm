'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),contract=require('./read-contract.js');
const id=n=>`f6090500-0006-4000-8000-${String(n).padStart(12,'0')}`;
const page=(domain,items,more,cursor)=>({contract_version:1,resource:'operational_source',domain,scope_completeness:'actor_authorized_rows_only',items,pagination:{completeness:more?'partial':'complete',has_more:more,next_cursor:cursor}});
test('collector completes independent cursor pages without duplicates',async()=>{
 const calls=[];const result=await contract.collect('deal_core',2,async(domain,after)=>{calls.push(after);return after===null?page(domain,[{id:id(1)},{id:id(2)}],true,id(2)):page(domain,[{id:id(3)}],false,null);});
 assert.deepEqual(calls,[null,id(2)]);assert.deepEqual(result.items.map(x=>x.id),[id(1),id(2),id(3)]);assert.equal(result.pages,2);
});
test('collector rejects false completeness, cursor stalls and duplicate rows',async()=>{
 assert.throws(()=>contract.validatePage(page('deal_core',[],true,null),'deal_core'),/PAGINATION_MISMATCH/);
 let stalled=0;await assert.rejects(contract.collect('deal_core',1,async domain=>++stalled===1?page(domain,[{id:id(1)}],true,id(1)):page(domain,[{id:id(2)}],true,id(1))),/CURSOR_STALLED/);
 let n=0;await assert.rejects(contract.collect('deal_core',1,async domain=>++n===1?page(domain,[{id:id(1)}],true,id(1)):page(domain,[{id:id(1)}],false,null)),/DUPLICATE_ITEM/);
});
test('source projection includes Golden list/contact fields but excludes raw contact metadata',()=>{
 const fs=require('node:fs'),path=require('node:path'),sql=fs.readFileSync(path.join(__dirname,'candidate.sql'),'utf8');
 for(const token of ['d.amount','d.created_at','d.updated_at','d.office_phone','d.manager_name','d.manager_mobile','AS contacts'])assert.ok(sql.includes(token),token);
 assert.doesNotMatch(sql,/c\.emails|c\.custom_fields/);
});
