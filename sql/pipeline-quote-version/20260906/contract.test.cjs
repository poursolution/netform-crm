'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),c=require('./adapter-contract.js');
const deal='f6090500-0006-4000-8000-000000000001';
test('PC and mobile quote payloads normalize to server-owned append inputs',()=>{for(const p of [{opportunity_id:deal,version_no:4,amount:120000000,reason:'공사 범위 조정',created_at:'2026-09-06',created_by:'표시이름'},{opportunity_id:deal,version_no:99,amount:130000000,reason:' 자재 변경 ',created_at:'client',created_by:'client'}])assert.deepEqual(c.normalize(deal,7,p).payload,{amount:p.amount,reason:p.reason.trim()});});
test('invalid amounts, short reasons and forged fields fail locally',()=>{assert.throws(()=>c.normalize(deal,1,{opportunity_id:deal,amount:0,reason:'정상 사유'}));assert.throws(()=>c.normalize(deal,1,{opportunity_id:deal,amount:1,reason:'x'}));assert.throws(()=>c.normalize(deal,1,{opportunity_id:deal,amount:1,reason:'정상 사유',actor:'forged'}));});
