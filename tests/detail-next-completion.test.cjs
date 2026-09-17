'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {test}=require('node:test');

const crm=fs.readFileSync('crm.html','utf8');
const overlay=fs.readFileSync('operational-overlay.js','utf8');

test('detail completion queues the server action before local completion',()=>{
 const start=crm.indexOf('function completeNextAction(){'),end=crm.indexOf('\nfunction scheduleFocus',start),source=crm.slice(start,end);
 assert.match(source,/isUuid\(a\.id\)/);
 assert.match(source,/pushWrite\('next_action_complete',\{opportunity_id:item\.id,action_id:a\.id/);
 assert.ok(source.indexOf("pushWrite('next_action_complete'")<source.indexOf("a.status='completed'"));
 assert.match(source,/catch\(e\).*기존 일정을 유지합니다/);
});

test('operational wrapper provides completion context without sending a duplicate command',()=>{
 const start=overlay.indexOf("if(Object.prototype.hasOwnProperty.call(root,'CUR_DETAIL')"),end=overlay.indexOf('\n  const coreDomains',start),source=overlay.slice(start,end);
 assert.match(source,/compound='next_action_complete'/);
 assert.doesNotMatch(source,/root\.pushWrite\('next_action_complete'/);
});
