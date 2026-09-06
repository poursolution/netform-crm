'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),c=require('./adapter-contract.js');
const deal='f6090500-0006-4000-8000-000000000001',action='f6090600-0060-4000-8000-000000000001';
test('completion keeps only the server action UUID',()=>{const x=c.normalize(deal,4,{opportunity_id:deal,action_id:action,text:'표시값',due_at:'2026-09-10',at:'client'});assert.deepEqual(x.payload,{action_id:action});});
test('temporary IDs and unknown fields fail closed',()=>{assert.throws(()=>c.normalize(deal,4,{opportunity_id:deal,action_id:'na-1'}),/INVALID_NEXT_ACTION_COMPLETE/);assert.throws(()=>c.normalize(deal,4,{opportunity_id:deal,action_id:action,status:'done'}),/INVALID_NEXT_ACTION_COMPLETE/);});
