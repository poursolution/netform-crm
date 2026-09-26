'use strict';
/* 상세 새 창(2026-09-26): 새 창은 여는 창과 같은 로그인 보관소를 쓴다 — 창마다 따로 토큰을 갱신하면
   Supabase 갱신 토큰 재사용 감지로 두 창 모두 로그아웃된다. 이 연결이 빠지면 안 된다. */
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const read=f=>fs.readFileSync(path.join(__dirname,'..',f),'utf8');

test('detail windows share the opener login store and mirror refreshed tokens back',()=>{
 const t=read('pc-manager-transport.js');
 assert.match(t,/searchParams\.get\('solo'\)==='1'&&!!root\.opener&&root\.opener\.location\.origin===root\.location\.origin/);
 assert.match(t,/getItem\(\)\{const shared=sharedAuth\(\);if\(shared\)\{[^}]*nativeSession\.setItem\(base\+'auth-locator',u\)/,'reads the opener\'s latest session first');
 assert.match(t,/const shared=sharedAuth\(\);if\(shared\)\{try\{shared\.setItem\(base\+'auth-locator',uid\);shared\.setItem\(base\+uid\+':auth',value\)/,'writes refreshed tokens back to the opener');
});

test('detail window module loads after the operational overlay and restores ?detail= links',()=>{
 const html=read('crm.html'),o=html.indexOf('operational-overlay.js?v='),d=html.indexOf('detail-window.js?v=');
 assert.ok(o>0&&d>o,'detail-window.js after operational-overlay.js');
 const src=read('detail-window.js');
 assert.match(src,/w\.loadData=async function\(\)\{\s*const result=await baseLoad\.apply/);
 assert.match(src,/openRequestedDetail/);
 assert.match(src,/navigator\?\.webdriver/,'automated browsers keep the in-place detail');
});
