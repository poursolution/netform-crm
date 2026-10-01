'use strict';
/* 로그인 보호(2026-10-01 컨설턴트 P0-6): 실패 5회 → 60초 잠금, 관리자 임시 비밀번호도 전화번호 모양 거부 */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const html=fs.readFileSync(path.join(root,'crm.html'),'utf8');
function fn(name){const i=html.indexOf('function '+name+'(');assert.ok(i>=0,name);return html.slice(i,html.indexOf('\n',i))}
test('10분 안 5회 실패 → 60초 잠금, 성공하면 초기화',()=>{
 const store={};const ctx={localStorage:{getItem:k=>store[k]??null,setItem:(k,v)=>{store[k]=v},removeItem:k=>{delete store[k]}},Date,JSON,Number,Math};vm.createContext(ctx);
 vm.runInContext("var AUTH_FAIL_KEY='nf_auth_fail_v1';"+fn('authFailRec')+'\n'+fn('authLockLeft')+'\n'+fn('authNoteFail')+'\n'+fn('authClearFail'),ctx);
 assert.equal(ctx.authLockLeft(),0);
 for(let i=1;i<=4;i++)assert.equal(ctx.authNoteFail(),i);
 assert.equal(ctx.authLockLeft(),0,'4회까지는 안 잠김');
 assert.equal(ctx.authNoteFail(),5);
 assert.ok(ctx.authLockLeft()>0&&ctx.authLockLeft()<=60,'5회째 잠금');
 ctx.authClearFail();assert.equal(ctx.authLockLeft(),0);
 assert.match(html,/var lockLeft=authLockLeft\(\);if\(lockLeft>0\)/);
 assert.match(html,/if\(error\)\{var n=authNoteFail\(\);/);
 assert.match(html,/authClearFail\(\);\s*\n?\s*await authAdmit/);
});
test('관리자 임시 비밀번호: 숫자만(전화번호 모양) 거부',()=>{
 const src=fs.readFileSync(path.join(root,'account-admin.js'),'utf8');
 const i=src.indexOf('function validate('),body=src.slice(i,src.indexOf('}',src.indexOf('PASSWORD_MISMATCH',i))+1);
 const validate=new Function('return '+body)();
 assert.throws(()=>validate('010-1234-5678','010-1234-5678'),/PASSWORD_PHONE/);
 assert.throws(()=>validate('01012345678','01012345678'),/PASSWORD_PHONE/);
 assert.doesNotThrow(()=>validate('netform2026!','netform2026!'));
 assert.match(src,/PASSWORD_PHONE: '전화번호처럼/);
});
