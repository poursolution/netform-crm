'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const source=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');

test('outer PC/mobile router does not start the CRM auth transport',()=>{
  assert.doesNotMatch(source,/src=["']\.\/transport\.js/);
  assert.doesNotMatch(source,/src=["']\.\/operational-adapter\.js/);
  assert.doesNotMatch(source,/src=["']\.\/phase1-config\.js/);
});

test('view preference is stored without requiring an authenticated profile',()=>{
  assert.match(source,/localStorage\.setItem\(KEY, q\)/);
  assert.match(source,/localStorage\.setItem\(KEY, v\)/);
  assert.match(source,/localStorage\.getItem\(KEY\)/);
  assert.doesNotMatch(source,/Phase1\.storage\.(?:getItem|setItem)\(KEY/);
});
