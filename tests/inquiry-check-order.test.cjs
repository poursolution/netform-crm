'use strict';

const assert=require('node:assert/strict');
const fs=require('node:fs');
const {test}=require('node:test');

const crm=fs.readFileSync('crm.html','utf8');
const overlay=fs.readFileSync('operational-overlay.js','utf8');
const handler=crm.slice(crm.indexOf('function splitCheck(i,v)'),crm.indexOf('function splitCheckBlock(q)'));
const wrapper=overlay.slice(overlay.indexOf("if(typeof root.splitCheck==='function')"),overlay.indexOf("if(typeof root.inqTechPromote==='function')"));

test('inquiry checklist command is queued before local check and activity changes',()=>{
 const queued=handler.indexOf("pushWrite('stage_check'");
 assert.ok(queued>=0);
 assert.ok(queued<handler.indexOf('p.checks[i]=v'));
 assert.ok(queued<handler.indexOf('p.activities='));
 assert.match(handler,/기존 확인 상태를 유지합니다/);
 assert.match(handler,/paint\(\);alert/);
});

test('inquiry checklist wrapper supplies intent without a duplicate command',()=>{
 assert.match(wrapper,/inquiryActionIntent='check'/);
 assert.match(wrapper,/return original\.apply/);
 assert.doesNotMatch(wrapper,/root\.pushWrite\('stage_check'/);
});
