'use strict';

const assert=require('node:assert/strict');
const fs=require('node:fs');
const {test}=require('node:test');

const issue=fs.readFileSync('issue-modal.js','utf8');
const overlay=fs.readFileSync('operational-overlay.js','utf8');
const complete=issue.slice(issue.indexOf("else if(type==='complete')"),issue.indexOf("else{const text=read('issue-text')"));
const wrapper=overlay.slice(overlay.indexOf("if(root.IssueModal&&typeof root.IssueModal.save==='function')"),overlay.indexOf("if(Object.prototype.hasOwnProperty.call(root,'CUR_DETAIL')"));

test('issue completion queues the command before changing schedule or history',()=>{
 const queued=complete.indexOf("pushWrite('next_action_complete'");
 assert.ok(queued>=0);
 assert.ok(queued<complete.indexOf('p.completedActions='));
 assert.ok(queued<complete.indexOf('d.nextActionObj='));
 assert.match(complete,/\^\[0-9a-f\]\{8\}/);
 assert.match(complete,/기존 일정을 유지합니다/);
});

test('issue modal exposes only its active completion action id to the wrapper',()=>{
 assert.match(issue,/function completionActionId\(\)/);
 assert.match(issue,/state\?\.editor\?\.type==='complete'/);
 assert.match(wrapper,/UUID\.test\(String\(id\|\|''\)\)/);
 assert.match(wrapper,/compound='next_action_complete'/);
 assert.doesNotMatch(wrapper,/root\.pushWrite\('next_action_complete'/);
});
