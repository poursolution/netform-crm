'use strict';

const assert=require('node:assert/strict');
const fs=require('node:fs');
const {test}=require('node:test');

const crm=fs.readFileSync('crm.html','utf8');
const overlay=fs.readFileSync('operational-overlay.js','utf8');
const handlerStart=crm.indexOf('function applyInqBulkAction()');
const handler=crm.slice(handlerStart,crm.indexOf('/* 뷰 1',handlerStart));
const wrapper=overlay.slice(overlay.indexOf("if(typeof root.applyInqBulkAction==='function')"),overlay.indexOf("if(typeof root.splitDoneAction==='function')"));

test('bulk inquiry Next mutates only rows whose commands were accepted',()=>{
 assert.ok(handler.indexOf("pushWrite('next_action'")<handler.indexOf('accepted.forEach'));
 assert.match(handler,/accepted\.push\(q\)/);
 assert.match(handler,/failed\.push\(q\)/);
 assert.match(handler,/if\(!accepted\.length\)/);
 assert.match(handler,/실패 '\+failed\.length\+'건은 선택 상태를 유지했습니다/);
 assert.match(handler,/failed\.forEach\(function\(q\)\{INQ_SEL/);
});

test('bulk inquiry wrapper supplies intent without post-mutation writes',()=>{
 assert.match(wrapper,/inquiryActionIntent='set'/);
 assert.match(wrapper,/return original\.apply/);
 assert.doesNotMatch(wrapper,/root\.pushWrite\('next_action'/);
});
