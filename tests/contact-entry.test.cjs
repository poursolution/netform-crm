'use strict';
/* 상담 결과 · 한 번만 쓰기(2026-10-10 mobile_all 2번) — PC · 모바일이 같이 쓰는 입력 규칙 */
const test=require('node:test'),assert=require('node:assert/strict'),CE=require('../contact-entry.js');
const T='2026-10-10';
const ex=(due,extra)=>Object.assign({id:'a1',text:'대표회의 결과 확인',due,type:'전화'},extra||{});

test('연락 결과는 PC 값 다섯 가지뿐이다',()=>{
 assert.deepEqual(CE.VALUES,['연결됨','회신 받음','부재','번호 오류','배드핏']);
 assert.deepEqual(['연결됨','회신 받음','부재','번호 오류','배드핏'].map(CE.kindOf),['connected','connected','attempt','attempt','badfit']);
});
test('부재 · 번호 오류는 상담 내용 칸이 없고 연락 시도로만 기록한다',()=>{
 assert.deepEqual(['연결됨','회신 받음','부재','번호 오류','배드핏'].map(CE.showNote),[true,true,false,false,true]);
 const p=CE.plan({res:'부재',ch:'전화',memo:'무시됨',mode:'new',purpose:'다시 전화',date:'2026-10-11'},{today:T});
 assert.equal(p.ok,true);assert.equal(p.attempt,true);assert.equal(p.meaningful,false);
 assert.match(p.note,/^부재중 \(전화 안 받음\)$/,'상담 내용은 시도 기록에 붙지 않는다');
 assert.match(p.preview,/^연락 시도 1건 기록 · 다시 전화 일정 1건 등록 · 10\.11 \(일\)$/);
 const n=CE.plan({res:'번호 오류',ch:'전화',mode:'new',purpose:'연락처 확인',date:'2026-10-11'},{today:T});
 assert.equal(n.meaningful,false);assert.match(n.note,/^통화 시도 · 번호 오류$/);
});
test('연결됨 · 회신 받음은 상담 내용이 있어야 하고 실제 연결로 센다',()=>{
 const bad=CE.plan({res:'연결됨',ch:'전화',memo:' ',mode:'new',purpose:'견적서 발송',date:'2026-10-16'},{today:T});
 assert.equal(bad.ok,false);assert.match(bad.error,/상담 내용을 한 줄/);
 const ok=CE.plan({res:'연결됨',ch:'전화',memo:'금요일까지 견적서 보내 달라고 함',mode:'new',purpose:'견적서 발송',date:'2026-10-16'},{today:T});
 assert.equal(ok.ok,true);assert.equal(ok.meaningful,true);
 assert.equal(ok.note,'통화 완료 · 연결됨 — 금요일까지 견적서 보내 달라고 함');
 assert.equal(ok.preview,'응대 기록 1건 저장 (실제 연결) · 견적서 발송 일정 1건 등록 · 10.16 (금)');
 assert.equal(ok.next.type,'후속접촉');assert.equal(ok.completeCurrent,false);
 const r=CE.plan({res:'회신 받음',ch:'문자',memo:'사진 보냈다고 함',mode:'new',purpose:'사진 확인',date:'2026-10-13'},{today:T});
 assert.equal(r.note,'문자 답변 받음 · 회신 받음 — 사진 보냈다고 함');
});
test('기록 첫머리가 유효 접촉 분류와 맞는다(부재 · 시도 = 유효 아님)',()=>{
 const meaningful=s=>{if(/전화\s*시도|통화\s*시도\s*·|작성\s*시작|발송|부재|못\s*받|(전화|통화)\s*안\s*받|안\s*받(음|으심)|무응답|수신거부|실패/.test(s))return false;return /통화\s*완료|통화\s*[—-]\s*진행|고객\s*요청|회신|답변|응답|면담|미팅|현장\s*방문|방문\s*완료|자료\s*수신|문의\s*접수/.test(s);};
 CE.CHANNELS.forEach(ch=>CE.VALUES.forEach(res=>assert.equal(meaningful(CE.head(ch,res)),CE.meaningful(res),ch+' '+res+' → '+CE.head(ch,res))));
});
test('다음 업무: 이미 앞으로 잡힌 일정이 있으면 기본은 그대로 둠, 아니면 결과에 맞는 새 업무',()=>{
 assert.deepEqual(CE.defaults('연결됨',ex('2026-10-13'),T),{mode:'keep',purpose:'',date:''});
 assert.deepEqual(CE.defaults('연결됨',ex('2026-10-10'),T),{mode:'new',purpose:'다시 연락',date:'2026-10-13'},'오늘 일정을 처리한 것 → 새 업무');
 assert.deepEqual(CE.defaults('부재',null,T),{mode:'new',purpose:'다시 전화',date:'2026-10-11'});
 assert.deepEqual(CE.defaults('번호 오류',null,T),{mode:'new',purpose:'연락처 확인',date:'2026-10-11'});
 assert.equal(CE.defaults('배드핏',ex('2026-10-13'),T).mode,'none');
});
test('기존 일정 유지 · 변경 · 완료는 서로 다른 처리다(몰래 바꾸지 않음)',()=>{
 const keep=CE.plan({res:'연결됨',ch:'전화',memo:'검토 중',mode:'keep'},{today:T,existing:ex('2026-10-13')});
 assert.equal(keep.completeCurrent,false);assert.equal(keep.next,null);assert.equal(keep.change,null);
 assert.equal(keep.preview,'응대 기록 1건 저장 (실제 연결) · 기존 일정 유지 · 새 일정 없음');
 const chg=CE.plan({res:'연결됨',ch:'전화',memo:'날짜 미뤄 달라고 함',mode:'change',date:'2026-10-20',reason:'고객 요청'},{today:T,existing:ex('2026-10-13')});
 assert.equal(chg.completeCurrent,false);assert.deepEqual(chg.change,{text:'대표회의 결과 확인',type:'전화',due:'2026-10-20',from:'2026-10-13',id:'a1'});
 assert.match(chg.preview,/기존 일정 "대표회의 결과 확인" 날짜만 변경 · 10\.20 \(화\) · 미룬 사유 기록$/);
 const nw=CE.plan({res:'연결됨',ch:'전화',memo:'결과 들음',mode:'new',purpose:'견적서 발송',date:'2026-10-16'},{today:T,existing:ex('2026-10-10')});
 assert.equal(nw.completeCurrent,true,'수행한 업무는 완료 + 후속 업무 생성');
 assert.equal(nw.preview,'응대 기록 1건 저장 (실제 연결) · 기존 일정 "대표회의 결과 확인" 완료 · 견적서 발송 일정 1건 등록 · 10.16 (금)');
 assert.equal(CE.plan({res:'연결됨',ch:'전화',memo:'x',mode:'keep'},{today:T}).ok,false,'이어받을 일정이 없으면 유지는 고를 수 없다');
});
test('일정 변경이 기한을 늦추면 사유가 필수(원래 기한 · 새 기한 · 사유) — 당기는 것은 사유 없이',()=>{
 const e=ex('2026-10-13');
 const late=CE.plan({res:'연결됨',ch:'전화',memo:'미뤄 달라고 함',mode:'change',date:'2026-10-20'},{today:T,existing:e});
 assert.equal(late.ok,false);assert.match(late.error,/미루는 사유/);
 const ok=CE.plan({res:'연결됨',ch:'전화',memo:'미뤄 달라고 함',mode:'change',date:'2026-10-20',reason:'고객 요청 · 입대의 후 연락'},{today:T,existing:e});
 assert.equal(ok.ok,true);assert.deepEqual(ok.postpone,{from:'2026-10-13',to:'2026-10-20',reason:'고객 요청 · 입대의 후 연락',over:0});
 assert.match(ok.preview,/날짜만 변경 · 10\.20 \(화\) · 미룬 사유 기록$/);
 assert.match(CE.summary(ok,{existing:e})[1][1],/→ 10\.20 \(화\) · 사유 고객 요청/);
 const early=CE.plan({res:'연결됨',ch:'전화',memo:'앞당기자고 함',mode:'change',date:'2026-10-11'},{today:T,existing:e});
 assert.equal(early.ok,true);assert.equal(early.postpone,null,'앞당기는 것은 미루기가 아니다');
 const over=CE.plan({res:'부재',ch:'전화',mode:'change',date:'2026-10-14',reason:'일정 겹침'},{today:T,existing:ex('2026-10-08')});
 assert.equal(over.postpone.over,2,'지난 기한은 며칠 지났는지 함께');
});
test('다음 일정 없음은 사유가 필수 · 배드핏은 종결 검토 + 사유 필수(종결은 단계 바꾸기에서 따로)',()=>{
 const none=CE.plan({res:'연결됨',ch:'전화',memo:'올해는 어렵다고 함',mode:'none',reason:''},{today:T});
 assert.equal(none.ok,false);assert.match(none.error,/이유/);
 const ok=CE.plan({res:'연결됨',ch:'전화',memo:'올해는 어렵다고 함',mode:'none',reason:'2027 예산 · 3월 재확인'},{today:T,existing:ex('2026-10-10')});
 assert.equal(ok.ok,true);assert.equal(ok.completeCurrent,true);assert.match(ok.note,/ · 이유: 2027 예산 · 3월 재확인 — /);
 const bad=CE.plan({res:'배드핏',ch:'전화',memo:'공사 계획 없음',reason:''},{today:T});
 assert.equal(bad.ok,false);assert.match(bad.error,/배드핏은 사유/);
 const b2=CE.plan({res:'배드핏',ch:'전화',memo:'공사 계획 없음',reason:'자체 보수 완료'},{today:T});
 assert.equal(b2.ok,true);assert.equal(b2.mode,'none');assert.match(b2.preview,/배드핏 종결 검토 \(사유 필수\)/);
 assert.equal(b2.next,null);
});
test('새 업무는 \'연락하기\'만으로 저장되지 않고 오늘 이전 날짜도 안 된다',()=>{
 assert.match(CE.plan({res:'부재',ch:'전화',mode:'new',purpose:'전화',date:'2026-10-11'},{today:T}).error,/할 일을 적어/);
 assert.match(CE.plan({res:'부재',ch:'전화',mode:'new',purpose:'다시 전화',date:'2026-10-09'},{today:T}).error,/오늘 이후/);
 assert.match(CE.plan({res:'부재',ch:'전화',mode:'new',purpose:'다시 전화',date:''},{today:T}).error,/날짜/);
 const c=CE.plan({res:'연결됨',ch:'전화',memo:'합의함',mode:'new',purpose:'회의 결과 확인',date:'2026-10-13',plan:'customer'},{today:T});
 assert.equal(c.next.text,'고객 약속: 회의 결과 확인');assert.equal(c.next.plan,'customer');
});
test('저장 뒤 구분: 저장된 기록 · 완료된 업무 · 바뀐 일정 · 새 일정 · 남은 업무',()=>{
 const e=ex('2026-10-10');
 const p=CE.plan({res:'연결됨',ch:'전화',memo:'결과 들음',mode:'new',purpose:'견적서 발송',date:'2026-10-16'},{today:T,existing:e});
 assert.deepEqual(CE.summary(p,{existing:e}),[['저장','응대 기록 1건 (실제 연결)'],['완료','기존 일정 "대표회의 결과 확인"'],['신규','견적서 발송 · 10.16 (금)']]);
 const k=CE.plan({res:'부재',ch:'전화',mode:'keep'},{today:T,existing:ex('2026-10-13')});
 assert.deepEqual(CE.summary(k,{existing:ex('2026-10-13'),openRequests:[{title:'고객 요구 확인'}]}),[['저장','연락 시도 1건'],['남음','기존 일정 "대표회의 결과 확인" · 10.13 (화)'],['남음','관리자 요청 "고객 요구 확인" — 아직 진행 중']]);
});
