'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const html=fs.readFileSync(path.join(__dirname,'../crm.html'),'utf8');
test('PC sales menu is consecutive and preserves page IDs and navigation',()=>{
 const menu=html.match(/<nav class="menu">([\s\S]*?)<\/nav>/)[1];
 const ids=Array.from(menu.matchAll(/data-p="([^"]+)"/g),m=>m[1]);
 const start=ids.indexOf('inq');
 assert.deepEqual(ids.slice(start,start+5),['inq','pipe','relationship','expansion','campaign']);
 assert.equal(new Set(ids).size,ids.length);
 for(const id of ids){
  assert.match(menu,new RegExp('data-p="'+id+'" onclick="nav\\(this\\)"'));
  assert.ok(html.includes('id="pg-'+id+'"'),'page exists: '+id);
 }
 const chain=menu.slice(menu.indexOf('data-p="pipe"'),menu.indexOf('data-p="campaign"'));
 assert.ok(!chain.includes('class="sec"'),'no section heading interrupts sales flow');
 assert.ok(ids.indexOf('sites')>ids.indexOf('campaign'),'customer assets remain available');
});
