'use strict';

const assert=require('node:assert/strict');
const fs=require('node:fs');
const {test}=require('node:test');

const mobile=fs.readFileSync('mobile.html','utf8');
const overlay=fs.readFileSync('operational-overlay.js','utf8');
const handler=mobile.slice(mobile.indexOf('function todayCompleteM(i)'),mobile.indexOf('function todayPostponeM(i)'));
const wrapper=overlay.slice(overlay.indexOf("if(typeof root.todayCompleteM==='function')"),overlay.indexOf("if(Object.prototype.hasOwnProperty.call(root,'CUR_DETAIL')"));

test('mobile Today completion validates the server action before changing local state',()=>{
 assert.match(handler,/\^\[0-9a-f\]\{8\}/);
 assert.ok(handler.indexOf("pushWrite('next_action_complete'")<handler.indexOf("d.nextAction.status='done'"));
 assert.ok(handler.indexOf("pushWrite('next_action_complete'")<handler.indexOf("addActivity(d,'완료'"));
 assert.match(handler,/기존 일정을 유지합니다/);
 assert.match(handler,/return false/);
});

test('mobile operational wrapper leaves friendly validation to the core handler',()=>{
 assert.match(wrapper,/UUID\.test\(String\(a\.id\|\|''\)\)/);
 assert.match(wrapper,/return original\.apply/);
 assert.match(wrapper,/compound='next_action_complete'/);
 assert.doesNotMatch(wrapper,/root\.pushWrite\('next_action_complete'/);
});
