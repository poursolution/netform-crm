'use strict';
/* 상세 창 기준 = 파이프라인(영업건) 상세 (2026-10-05 대표 "이거 또 나오는데 파이프라인 좀 보고 그거 토대로 지침 설정해")
   · 같은 정보는 한 화면에 한 번만. 정보 칸은 한 상자에 줄(이름 + 값 / 미입력 · 입력하기)로 두고, 빠진 수는 제목 옆 '미입력 n' 하나로만 알린다
   · 같은 내용을 칩 · 요약 상자('필수 확인 n/9' · '보완 필요 n개')로 다시 보여 주지 않는다. 한 창에서 없앤 중복은 같은 내용을 쓰는 다른 창(지사용 · 예전 틀)에서도 없앤다
   새 상세 창을 만들면 이 검사에 그 파일을 더한다(창 크기 · 칸 폭은 tests/detail-window-size.test.cjs) */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const read=f=>fs.readFileSync(path.join(__dirname,'..',f),'utf8').replace(/\r\n/g,'\n');
const DETAILS=['inquiry-detail-v2.js','deal-detail-v3.js','deal-panels-v2.js','gyeongnam-v2.js','expansion-v2.js','asset-v2.js','rep-window.js'];
test('상세 창: 빠진 정보를 칩 · 요약 상자로 다시 보여 주지 않는다',()=>{
 for(const f of DETAILS){const t=read(f);
  assert.doesNotMatch(t,/보완 필요 '\+|idv-missing|idv-needchip|class="idv-need"/,f+': 보완 필요 상자 · 필수 확인 칩은 쓰지 않는다');
 }
 const css=read('inquiry-detail-v2.css');assert.doesNotMatch(css,/\.idv-missing|\.idv-needchip/);
});
test('견적문의 예전 틀(경남지사로 넘긴 문의)의 왼쪽 = 문의 정보 한 상자 · 줄 · 제목 옆 미입력 n',()=>{
 const t=read('inquiry-detail-v2.js'),a=t.indexOf(' function col1(q,s){'),b=t.indexOf(' function applyField(',a),col1=t.slice(a,b);assert.ok(a>0&&b>a);
 assert.match(col1,/'<span class="idv-miss">미입력 '\+missing\.length\+'<\/span>'/);
 assert.match(col1,/Object\.keys\(NEEDKEY\)\.map\(field=>/,'공사 시기 · 경쟁사 · 요청 자료 · 결정권자는 문의 정보의 줄');
 assert.doesNotMatch(col1,/need9|필수 확인</,'필수 확인 묶음을 따로 그리지 않는다');
 /* 기준: 파이프라인 상세의 필수 정보 상자 — 정돈안(2026-10-06 design_handoff_deal_detail_tidy)부터는 제목 옆 '채운 수 / 전체' 하나 + [채우기 ▾] 접기(끄면 예전 '미입력 n') */
 const v3=read('deal-detail-v3.js');
 assert.match(v3,/h3\.innerHTML='이 단계 필수 정보'\+\(T\?' <span class="dvt-cnt'/);
 assert.match(v3,/:\(miss\?' <span class="dv3-miss">미입력 '\+miss\+'<\/span>':''\)\);/);
});
