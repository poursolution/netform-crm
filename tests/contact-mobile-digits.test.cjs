'use strict';
/* 연락처 저장의 휴대폰 번호(2026-10-04 운영): 저장돼 있던 번호나 입력에 하이픈(010-1234-5678)이 있으면
   "성명과 010으로 시작하는 11자리 휴대폰 번호를 확인해 주세요"로 매번 거절됐다 — 상세의 동의 칩(문자 · 카카오)과 연락처 등록/수정 모두.
   phoneN 은 글자를 그대로 돌려주므로, 저장 직전에 숫자만 남겨 검사 · 저장한다. */
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const read=f=>fs.readFileSync(path.join(__dirname,'..',f),'utf8');

test('연락처 저장: 번호는 숫자만 남겨 검사하고 그 값으로 저장한다',()=>{
 const js=read('pc-primary-contact.js');
 assert.match(js,/const mobile=String\(root\.phoneN\(value\('qc-mobile'\)\)\|\|''\)\.replace\(\/\\D\/g,''\),name=value\('qc-name'\)/);
 assert.match(js,/if\(!name\|\|!\/\^010\\d\{8\}\$\/\.test\(mobile\)\)/,'검사는 숫자 11자리 그대로');
 assert.match(js,/const key='mobile:'\+mobile/,'사람 키 · 저장 값도 숫자만');
 /* 같은 식을 실제 값으로 */
 const norm=v=>String(v||'').replace(/\D/g,'');
 for(const v of ['010-5249-3880','010 5249 3880','01052493880','010.5249.3880'])assert.equal(/^010\d{8}$/.test(norm(v)),true,v);
 for(const v of ['02-123-4567','011-123-4567','010-1234-567',''])assert.equal(/^010\d{8}$/.test(norm(v)),false,v);
});
