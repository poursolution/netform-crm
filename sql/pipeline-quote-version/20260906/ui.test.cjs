'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),build=require('./build.cjs');
const deal='f6090500-0006-4000-8000-000000000001';
test('nine-op adapter keeps quote client display fields out of RPC',()=>{const adapterText=build.adapter();assert.match(adapterText,/quote_version/);const Module=require('node:module'),m=new Module('quote-adapter');m._compile(adapterText,'quote-adapter.js');const c=m.exports.normalize('quote_version',deal,4,{opportunity_id:deal,version_no:77,amount:120000000,reason:' 범위 변경 ',created_at:'client',created_by:'forged'});assert.deepEqual(c.payload,{amount:120000000,reason:'범위 변경'});});
test('overlay connects quote_version without broadening derived activity intent',()=>{const text=build.overlay();assert.match(text,/quote_version/);assert.match(text,/actionIntent/);assert.match(text,/op\.toUpperCase\(\)\+'_INTENT_NOT_CONNECTED'/);});
