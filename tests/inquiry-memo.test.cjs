const {test}=require('node:test'),assert=require('node:assert/strict');
const M=require('../inquiry-memo.js'),BG=require('../boot-guard.js');
test('독립된 일시 머리줄 아래 통화와 약속에 기록 날짜를 연결한다',()=>{
 const text='2026/01/16 PM 05:02\n1차 통화완료\n유상 진단보고서 상담\n다음주 월요일 현장 미팅 후 아파트스퀘어 연계 진행 예정';
 const r=M.parse(text,'');assert.equal(r.calls[0].date,'2026-01-16');assert.equal(r.promises[0].date,'2026-01-16');assert.equal(r.promises[0].when,'');
 assert.equal(M.memoCallDay({raw:{응대내용:text}}),'2026-01-16');
 const r2=M.parse(text+'\n2026/02/03 AM 10:00\n2차 통화완료','');assert.deepEqual(r2.calls.map(c=>c.date),['2026-01-16','2026-02-03']);
 assert.equal(M.parse('2026/01/16 방문 예정\n1차 통화완료','').calls[0].date,'','일반 문장의 날짜를 다음 통화의 날짜로 추정하지 않음');
});
test('문의 원문의 일시·붙여 쓴 통화 완료와 현장 미팅은 확인 후보로만 읽는다',()=>{
 const text='유상 하자 진단보고서 요청. 2026/01/16 PM 05:02 1차통화완료. 다음주 월요일 현장 미팅 후 아파트스퀘어 연계 예정';
 for(const q of [{raw:{문의내용:text}},{message:text},{detail:{inquiry:text}},{content:text},{detail:text}]){
  const before=JSON.stringify(q),s=M.scan(q);
  assert.equal(s.calls[0].date,'2026-01-16');assert.equal(s.promises[0].type,'visit');
  assert.match(s.promises[0].title,/다음주 월요일 현장 미팅/);assert.equal(s.promises[0].when,'','상대 날짜를 현재 날짜로 확정하지 않음');
  assert.equal(M.connection(q).state,'none');assert.equal(M.needsReview(q),true);
  assert.match(M.opener(q,'담당자'),/진단보고서 상담 기록/);assert.match(M.opener(q,'담당자'),/현장 미팅 논의 후 진행 여부/);assert.match(M.opener(q,'담당자'),/연계 결과/);
  assert.equal(JSON.stringify(q),before,'읽기만으로 응대 완료·후속 업무를 저장하지 않음');
 }
});
test('예정·부정 통화를 실제 통화 후보로 읽지 않으며 취소 예정은 방문 약속이 아니다',()=>{
 for(const text of ['1차통화예정','통화완료 예정','통화완료 아님','1차 통화 불가','통화 시도'])assert.equal(M.parse(text,'').calls.length,0,text);
 assert.equal(M.parse('현장 미팅 취소 예정','').promises.length,0);
 assert.equal(M.needsReview({message:'다음주 월요일 현장 미팅 예정'}),false,'날짜 없는 새 약속만으로 이관 기록이라고 판단하지 않음');
 assert.equal(M.parse('2026/01/16 PM 05:02 1차 통화완료','').calls[0].date,'2026-01-16');
});
test('원문과 응대 메모가 같으면 후보를 중복 생성하지 않고 같은 길이 수정도 다시 읽는다',()=>{
 const text='2026/01/16 PM 05:02 1차통화완료',q={message:text,raw:{문의내용:text,응대내용:text}};
 assert.equal(M.scan(q).calls.length,1);
 q.message=q.raw.문의내용=q.raw.응대내용=text.replace('16','17');
 assert.equal(M.scan(q).calls[0].date,'2026-01-17');
 assert.equal(M.scan({raw:{문의내용:'옥상 방수 문의드립니다'}}).memos.length,0,'일반 문의 원문을 이관 메모 칸에 중복 표시하지 않음');
});
/* 견적문의 · 과거 메모의 통화 · 약속(2026-10-08) — 규칙은 후보만 찾는다: 통화 기록 · 약속 · 날짜 · 한국 날짜 일수 */
test('메모에서 통화 후보와 약속 후보를 찾는다(시안의 천안두정 메모)',()=>{
 const tx='관리소장 통화 완료. 옥상 누수 3세대. 사진 이메일로 받기로 함. 다음 날 방문 가능하다고 함.',r=M.parse(tx,'2026-01-07');
 assert.deepEqual(r.calls.map(c=>[c.date,c.phrase]),[['2026-01-07','관리소장 통화 완료']]);
 assert.deepEqual(r.promises.map(p=>[p.type,p.title]),[['material','사진 이메일로 받기'],['visit','다음 날 현장 방문']]);
 assert.equal(M.marked(tx,r.ranges),'<mark class="im-call">관리소장 통화 완료</mark>. 옥상 누수 3세대. <mark class="im-pro">사진 이메일로 받기로 함</mark>. <mark class="im-pro">다음 날 방문 가능하다고 함</mark>.');
});
test('통화가 아닌 말 · 이미 지난 일은 후보로 만들지 않는다',()=>{
 for(const s of ['부재 통화 안 됨.','통화 예정','전화 안 받음','통화 불가'])assert.equal(M.parse(s,'2026-02-01').calls.length,0,s);
 for(const s of ['사진 받음','방문 완료','견적 발송함'])assert.equal(M.parse(s,'2026-02-01').promises.length,0,s);
});
test('문장 속 날짜: 9.30 같은 점은 문장을 끊지 않고, 기준일에서 멀리 앞서면 전년으로 본다',()=>{
 const r=M.parse('9.30 통화 완료. 견적서 보내기로 함.','2026-02-01');
 assert.equal(r.calls[0].date,'2025-09-30');assert.equal(r.promises[0].type,'quote');
 assert.equal(M.parse('1월 7일 오후 통화완료','2026-01-06').calls[0].date,'2026-01-07');
 const r2=M.parse('1/20 관리소장님과 통화. 도면 카톡으로 보내준다고 함. 대표회의 2/3 예정','2026-02-01');
 assert.equal(r2.calls[0].date,'2026-01-20');assert.deepEqual(r2.promises.map(p=>p.title),['도면 카카오톡으로 받기','회의 일정 확인']);
});
test('한국 날짜 일수 — 접속 PC 시간대와 무관하게 자정 기준',()=>{
 assert.equal(M.diff('2026-09-30T23:30:00+09:00','2026-10-08T10:00:00+09:00'),8);
 assert.equal(M.days('2026-09-30T23:30:00+09:00','2026-10-08T10:00:00+09:00'),8,'7일 10시간이어도 한국 날짜로는 8일');
 assert.equal(M.days('2026-10-07T23:30:00+09:00','2026-10-08T10:00:00+09:00'),0,'하루(24시간)가 안 되면 0');
 assert.equal(M.span('2026-10-08T00:30:00+09:00','2026-10-08T23:00:00+09:00'),'22시간');
 assert.equal(M.md('2026-01-07T00:10:00+09:00'),'1.7');assert.equal(M.ymd('2026-01-06T09:00:00+09:00'),'2026.1.6');
 assert.equal(M.addDays('2026-10-08',7),'2026-10-15');
});
test('이관 메모 읽기: 시각이 찍힌 줄과 시각 미기록 줄을 나눈다',()=>{
 const q={raw:{'응대내용':'시각 없는 메모\n[2026-01-07 10:00:00] 관리소장 통화 완료.\n[2026-02-03 11:00:00] 사진 받음'}};
 assert.deepEqual(M.memosOf(q).map(m=>[m.at,m.src]),[['2026-01-07','이관 메모'],['2026-02-03','이관 메모'],['','이관 메모 · 시각 미기록']].sort((a,b)=>String(a[0]||'~').localeCompare(String(b[0]||'~'))));
});
test('연락처 후보: 이관 기록 · 같은 현장의 다른 문의에서만 찾는다',()=>{
 const q={id:'a',site:'[광주] 문흥라인동산',raw:{'응대내용':'소장 010-3333-4444 통화'}};
 const got=M.phones(q);assert.deepEqual(got.map(p=>[p.digits,p.from]),[['01033334444','이관 메모 · 시트 원문']]);
});
test('불러오기 실패 안내: 원인 문구와 다시 시도 주소',()=>{
 assert.equal(BG.reason({},['phase1-config.js']),'phase1-config.js 를 불러오지 못했습니다');
 assert.equal(BG.reason({},[]),'접속 설정(phase1-config.js)이 실행되지 않았습니다');
 assert.equal(BG.reason({PHASE1_CONFIG:{}},['pc-manager-transport.js']),'pc-manager-transport.js 를 불러오지 못했습니다');
 assert.match(BG.reason({PHASE1_CONFIG:{}},[]),/서버 연결 모듈\(pc-manager-transport\.js\)이 실행되지 않았습니다/);
 assert.equal(BG.reason({PHASE1_CONFIG:{},Phase1:{}},[]),'운영 데이터 연결이 10초 넘게 끝나지 않았습니다');
 assert.equal(BG.retryUrl({href:'https://poursolution.github.io/netform-crm/crm.html?view=pc#p=inq'},1760000000000),'https://poursolution.github.io/netform-crm/crm.html?view=pc&_r=1760000000000#p=inq');
});

{ const fs=require('node:fs'),vm=require('node:vm');
const note='[2026. 1. 7. 오후 5:06:44] 시설 팀장님과 통화완료 사진은 메일로 보내주신다 고 하셨고\n내일 일정 때문에 시간이 맞으면\n내일바로 방문드리기로 함 .';
test('공백 있는 한국어 일시와 조건부 약속의 주체를 보존한다',()=>{
 const q={raw:{응대내용:note}},before=JSON.stringify(q),r=M.scan(q),p=r.promises;
 assert.equal(r.calls[0].date,'2026-01-07');assert.equal(p.length,2);
 assert.deepEqual([p[0].actor,p[0].recipient,p[0].title],['customer','staff','사진 이메일로 받기']);
 assert.equal(p[1].modality,'conditional');assert.equal(p[1].condition,'시간이 맞으면');
 assert.equal(p[1].when,'');assert.match(M.opener(q,'담당자'),/고객님이 보내주시기로 한 사진/);
 assert.match(M.opener(q,'담당자'),/시간이 맞으면.*논의한.*여부/);
 assert.match(M.opener(q,'담당자'),/확인해도 될까요/);assert.doesNotMatch(M.opener(q,'담당자'),/했었는데|사진.*보내드리기로/);
 assert.equal(JSON.stringify(q),before);
});
test('고객 발송·우리 발송·주체 미확인을 섞지 않는다',()=>{
 for(const [text,actor] of [['사진 메일로 보내드리기로 함','staff'],['사진 메일로 보내주신다','customer'],['사진 메일로 보내기로 함','unknown'],['사진 받기로 함','customer']]){
  const p=M.parse(text,'2026-01-07').promises[0];assert.equal(p.actor,actor,text);
 }
 assert.match(M.parse('사진 메일로 보내기로 함','').promises[0].say,/전달 여부/);
 assert.equal(M.parse('시간이 맞으면 내일 방문','').promises[0].modality,'conditional');
 assert.equal(M.parse('시간이 맞으면 내일 방문 불가','').promises.length,0);
 assert.equal(M.parse('고객이 사진을 시공사에게 보내기로 함','').promises[0].recipient,'other');
});
test('날짜 보완으로 기존 약속 판단 키를 바꾸지 않는다',()=>{
 const hash=s=>{let h=5381;for(const c of s.replace(/\s+/g,''))h=((h<<5)+h+c.charCodeAt(0))>>>0;return h.toString(36);};
 const oldSentence=' 오후 5:06:44] 시설 팀장님과 통화완료 사진은 메일로 보내주신다 고 하셨고\n';
 const p=M.scan({raw:{응대내용:note}}).promises[0];
 assert.equal(p.key,'p-material-'+hash(oldSentence));
});
test('약속 판단 상태를 반영하며 완료된 약속은 첫마디에서 뺀다',()=>{
 const root={Intl,Date,Map,WeakMap,Set,G:{},itemPatch:q=>q.patch||{}};root.window=root;
 vm.runInNewContext(fs.readFileSync(require.resolve('../inquiry-memo.js'),'utf8'),root);
 const q={raw:{응대내용:note}},p=root.InquiryMemo.scan(q).promises;
 for(const res of ['', '미완료','확인 불가']){
  q.patch={memoReview:{promises:{[p[0].key]:{res,at:'2026-10-09'}}}};
  assert.match(root.InquiryMemo.opener(q,'담당자'),/전달 여부.*확인해도 될까요/);
 }
 q.patch={memoReview:{promises:Object.fromEntries(p.map(x=>[x.key,{res:'완료',at:'2026-10-09'}]))}};
 assert.doesNotMatch(root.InquiryMemo.opener(q,'담당자'),/사진|방문/);
});
test('공종 요약은 동 번호와 동 개수를 구분한다',()=>{
 const root={addEventListener(){}};root.window=root;
 vm.runInNewContext(fs.readFileSync(require.resolve('../inquiry-workbench.js'),'utf8'),root);
 for(const text of ['1501동 3~4라인 누수발생 현장방문 견적요청','101동 외벽 누수','1501세대 외벽 재도장'])assert.doesNotMatch(root.InquiryWorkbench.gist({message:text}),/1501개동|101개동/);
 assert.match(root.InquiryWorkbench.gist({message:'3개동 방수 공사'}),/3개동/);
 assert.match(root.InquiryWorkbench.gist({message:'1501세대 방수 공사'}),/1501세대/);
});

}
