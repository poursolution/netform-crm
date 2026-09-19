'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const read=(name)=>fs.readFileSync(path.join(__dirname,'..',name),'utf8');
const pc=read('crm.html');
const mobile=read('mobile.html');
const productionBuilder=read('scripts/build-production-ui.cjs');

for(const [name,source] of [['PC',pc],['mobile',mobile]]){
  test(`${name} login asks for an individual password instead of a phone number`,()=>{
    assert.match(source,/개인 비밀번호/);
    assert.match(source,/휴대폰 번호를 비밀번호로 사용하거나 공유하지 마세요/);
    assert.doesNotMatch(source,/비밀번호\s*(?:=|는)\s*본인 핸드폰 번호/);
    assert.doesNotMatch(source,/placeholder=["'](?:본인 핸드폰 번호|01012345678)["']/);
  });

  test(`${name} login preserves the exact password for Supabase Auth`,()=>{
    assert.match(source,/signInWithPassword\(\{email:em,password:pw\}\)/);
    assert.doesNotMatch(source,/pw\s*=.*replace\(\/\[\^0-9\]\//);
  });
}

test('password fields use password-manager compatible input semantics',()=>{
  assert.match(pc,/id="au-pw" type="password" autocomplete="current-password" placeholder="개인 비밀번호"/);
  assert.match(mobile,/id="lg-pw" type="password"[^>]+placeholder="개인 비밀번호" autocomplete="current-password"/);
  assert.doesNotMatch(pc,/id="au-pw"[^>]+inputmode="numeric"/);
  assert.doesNotMatch(mobile,/id="lg-pw"[^>]+inputmode="numeric"/);
});

test('production build does not restore phone-number passwords',()=>{
  assert.doesNotMatch(productionBuilder,/본인 핸드폰 번호/);
  assert.doesNotMatch(productionBuilder,/inputmode="numeric"/);
  assert.doesNotMatch(productionBuilder,/replace\(\/\[\^0-9\]\//);
});
