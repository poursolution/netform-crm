'use strict';

const assert=require('node:assert/strict');
const fs=require('node:fs');
const {test}=require('node:test');

const crm=fs.readFileSync('crm.html','utf8');
const overlay=fs.readFileSync('operational-overlay.js','utf8');
const todo=crm.slice(crm.indexOf('function todoDone(k)'),crm.indexOf('function todoDelay(k)'));
const wrapper=overlay.slice(overlay.indexOf("if(typeof root.todoDone==='function')"),overlay.indexOf("if(typeof root.todayCompleteM==='function')"));

test('Today completion requires a server-issued action id',()=>{
 assert.match(todo,/isUuid\(na\.id\)/);
 assert.match(todo,/return false/);
});

test('Today completion queues the command before mutating local history',()=>{
 const queued=todo.indexOf("pushWrite('next_action_complete'");
 assert.ok(queued>=0);
 assert.ok(queued<todo.indexOf('todoLog('));
 assert.ok(queued<todo.indexOf('p.completedActions='));
 assert.match(todo,/action_id:na\.id/);
 assert.match(todo,/기존 일정을 유지합니다/);
});

test('operational wrapper supplies completion context without preempting core validation',()=>{
 assert.match(wrapper,/compound='next_action_complete'/);
 assert.match(wrapper,/completeActionId=x\.a\.id/);
 assert.match(wrapper,/if\(!x\.a\|\|!x\.a\.id\)return original\.apply/);
 assert.doesNotMatch(wrapper,/root\.pushWrite\('next_action_complete'/);
});
