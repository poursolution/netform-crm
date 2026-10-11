'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const factory=require('../inquiry-message-handoff.js');
function env(ua='Desktop'){const copies=[],root={navigator:{userAgent:ua,clipboard:{writeText:async s=>copies.push(s)}},location:{href:'unchanged'}};return {root,copies,api:factory(root)};}
test('desktop SMS copies draft without delivery claim or navigation',async()=>{const e=env(),r=await e.api.open({text:'견적 확인 & 연락',phone:'010-0000-0000'});assert.deepEqual(e.copies,['견적 확인 & 연락']);assert.equal(r.sent,false);assert.equal(e.root.location.href,'unchanged');});
test('Kakao copies only; does not claim app opened or message sent',async()=>{const e=env('Android'),r=await e.api.open({channel:'kakao',text:'확인 부탁드립니다'});assert.equal(r.sent,false);assert.equal(r.opened,undefined);assert.equal(e.root.location.href,'unchanged');});
test('SMS composer receives encoded body and normalized recipient',async()=>{const e=env('Android'),r=await e.api.open({text:'자료 & 날짜\n확인',phone:'010-0000-0000'});assert.equal(e.root.location.href,'sms:01000000000?body='+encodeURIComponent('자료 & 날짜\n확인'));assert.equal(r.sent,false);assert.deepEqual(e.copies,[]);});
test('invalid recipient never navigates',async()=>{const e=env('Android');await assert.rejects(e.api.open({text:'문의',phone:'123'}),/연락처/);assert.equal(e.root.location.href,'unchanged');});
test('clipboard rejection is failure, not successful handoff',async()=>{const e=env();e.root.navigator.clipboard.writeText=async()=>{throw Error('denied')};await assert.rejects(e.api.open({text:'보존할 문구'}),/복사하지 못/);});
test('missing clipboard support fails explicitly',async()=>{const e=env();delete e.root.navigator.clipboard;await assert.rejects(e.api.copy('보존할 문구'),/직접 선택/);});
test('empty draft cannot initiate handoff',async()=>{const e=env();await assert.rejects(e.api.open({text:'  '}),/먼저/);assert.deepEqual(e.copies,[]);});
test('unknown channel cannot initiate handoff',async()=>{const e=env();await assert.rejects(e.api.open({text:'메모',channel:'email'}),/종류/);assert.deepEqual(e.copies,[]);});
