'use strict';

const assert=require('node:assert/strict');
const fs=require('node:fs');
const {test}=require('node:test');

const crm=fs.readFileSync('crm.html','utf8');
const overlay=fs.readFileSync('operational-overlay.js','utf8');
const handler=crm.slice(crm.indexOf('function splitSaveNext()'),crm.indexOf('function splitSaveStatus()'));
const wrapper=overlay.slice(overlay.indexOf("if(typeof root.splitSaveNext==='function')"),overlay.indexOf("if(typeof root.applyInqBulkAction==='function')"));

test('single inquiry Next is queued before local schedule and activity changes',()=>{
 const queued=handler.indexOf("pushWrite('next_action'");
 assert.ok(queued>=0);
 assert.ok(queued<handler.indexOf('bumpPostpone('));
 assert.ok(queued<handler.indexOf('p.nextActionObj='));
 assert.ok(queued<handler.indexOf('p.activities='));
 assert.match(handler,/기존 일정을 유지합니다/);
 assert.match(handler,/inquiry_id:inqKey\(q\)/);
});

test('single inquiry Next wrapper sets intent without sending a duplicate command',()=>{
 assert.match(wrapper,/inquiryActionIntent='set'/);
 assert.match(wrapper,/return original\.apply/);
 assert.doesNotMatch(wrapper,/root\.pushWrite\('next_action'/);
});
