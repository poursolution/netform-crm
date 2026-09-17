'use strict';

const assert=require('node:assert/strict');
const fs=require('node:fs');
const {test}=require('node:test');

const crm=fs.readFileSync('crm.html','utf8');
const overlay=fs.readFileSync('operational-overlay.js','utf8');
const handler=crm.slice(crm.indexOf('function splitDoneAction()'),crm.indexOf('function splitNextStep()'));
const wrapper=overlay.slice(overlay.indexOf("if(typeof root.splitDoneAction==='function')"),overlay.indexOf("if(typeof root.splitCheck==='function')"));

test('inquiry Next completion queues before changing local inquiry state',()=>{
 const queued=handler.indexOf("pushWrite('next_action_complete'");
 assert.ok(queued>=0);
 assert.ok(queued<handler.indexOf('p.nextActionObj='));
 assert.ok(queued<handler.indexOf('p.activities='));
 assert.match(handler,/isUuid\(a\.id\)/);
 assert.match(handler,/기존 일정을 유지합니다/);
 assert.match(handler,/action_id:a\.id/);
});

test('inquiry wrapper provides intent but does not duplicate the completion command',()=>{
 assert.match(wrapper,/UUID\.test\(String\(a\.id\|\|''\)\)/);
 assert.match(wrapper,/inquiryActionIntent='complete'/);
 assert.match(wrapper,/return original\.apply/);
 assert.doesNotMatch(wrapper,/root\.pushWrite\('next_action_complete'/);
});
