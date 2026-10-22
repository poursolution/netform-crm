'use strict';
/* 하자 사진 간이 접수(2026-10-22) 모바일 모듈: 화면 상태 · 부위 · 사진/내용 중 하나 · 끄기 · 서버 함수 없으면 숨김 */
const {test}=require('node:test');
const assert=require('node:assert/strict');
const M=require('../mobile-defect.js');
test('부위 5가지 · 서버 명령 이름 · 켜짐 판정',()=>{
 assert.deepEqual(M.PARTS,['옥상','외벽','지하주차장','배수로','기타']);assert.equal(M.RPC,'crm_defect_report_create_v1');assert.equal(M.BUCKET,'defect-photos');
 const root=globalThis;root.G={};root.CRMRelease={listed:()=>false};assert.equal(M.on(),false,'서버 함수가 없으면 숨김');
 root.CRMRelease={listed:()=>true};assert.equal(M.on(),true);root.G={mobileDefectOff:true};assert.equal(M.on(),false);root.G={};
});
test('화면: 부위 고르기 · 사진 없이 내용만도 접수 가능 · 둘 다 없으면 버튼 잠김',()=>{
 const root=globalThis;root.esc=s=>String(s);
 const d={id:'d1',nm:'합성 아파트'};
 let html=M.render(d);assert.match(html,/하자 접수 · 합성 아파트/);assert.match(html,/data-defect="submit" disabled/);
 const st=M.state();assert.equal(st.dealId,'d1');assert.equal(st.part,'');
 M._set({part:'옥상',memo:'우수관 누수'});html=M.render(d);assert.doesNotMatch(html,/data-defect="submit" disabled/);assert.match(html,/md-chip on[^>]*data-v="옥상"/);
 M._set({memo:'',file:null});html=M.render(d);assert.match(html,/data-defect="submit" disabled/,'사진도 내용도 없으면 잠김');
 M._set({done:{id:'x',note:'[하자] 옥상 | 접수 2026-10-22 | 담당 이필선 | 약속 없음 | 미해결',notified:true}});html=M.render(d);assert.match(html,/접수했습니다/);assert.match(html,/본사\(잔디\)에 알렸습니다/);
 M.reset();assert.equal(M.state(),null);
});
