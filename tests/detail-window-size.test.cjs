'use strict';
/* 세부 창 크기 · 칸 폭은 파이프라인 영업건 상세 창과 같다(2026-10-05 대표 "확장관리 창도 · 경남지사 창도 파이프라인 창처럼 동일하게 · 전체적인 세부 창 확인해서(문자메시지 관리 제외) · 고객 자산도 · 뭐 이렇게 다 줄여 놨어")
   기준: 가로 min(1640px, 화면 − 32px) · 세로 화면 − 32px · 칸 minmax(260px,340px) minmax(380px,1fr) minmax(280px,380px). 새 세부 창을 만들면 여기에 더한다 */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const read=f=>fs.readFileSync(path.join(__dirname,'..',f),'utf8');
const COLS='minmax(260px,340px) minmax(380px,1fr) minmax(280px,380px)';
test('파이프라인 영업건 상세 창이 기준이다',()=>{
 const css=read('deal-detail-v3.css');
 assert.match(css,/#detailView\.ddv\.dv3\{inset:16px max\(16px,calc\(\(100vw - 1640px\)\/2\)\)!important;max-width:1640px!important;height:calc\(100vh - 32px\)!important\}/);
 assert.ok(css.includes('#detailView.ddv.dv3 .dw-columns.ddv-cols{grid-template-columns:'+COLS+'}'));
});
test('확장관리 · 고객 자산 · 경남지사 · 공종 분석 · 견적문의 · 영업사원 창도 같은 크기',()=>{
 const x=read('expansion-v2.css'),i2=read('inquiry-detail-v2.css'),i3=read('inquiry-detail-v3.css'),w=read('work-v2.css'),r=read('rep-window.css');
 assert.ok(x.includes('@media(min-width:1001px){.xdv{width:min(1640px,calc(100vw - 32px));height:calc(100vh - 32px)}.xdv-body{grid-template-columns:'+COLS+'}}'),'확장관리 · 고객 자산(.xdv)');
 assert.ok(i2.includes('#inq-inbox-dialog.idv:not(.idv3){padding:16px!important}#inq-inbox-dialog.idv:not(.idv3) .inq-dialog{width:min(1640px,calc(100vw - 32px))!important;height:calc(100vh - 32px)!important;max-height:calc(100vh - 32px)!important}#inq-inbox-dialog.idv:not(.idv3) .idv-body{grid-template-columns:'+COLS+'}'),'경남지사(.idv 만)');
 assert.ok(i3.includes('#inq-inbox-dialog.idv3 .inq-dialog{width:min(1640px,calc(100vw - 32px))!important;height:calc(100vh - 32px)!important'),'견적문의');
 assert.ok(w.includes('#gongjongDialog{padding:16px}#gongjongDialog .gj-dialog{width:min(1640px,100%);height:calc(100vh - 32px);max-height:none}#gongjongDialog .gj-columns{flex:1;grid-template-columns:'+COLS+'}'),'공종 분석');
 assert.ok(r.includes('.rw-box{max-width:1640px;height:calc(100vh - 32px);'),'영업사원 관리');
 assert.match(read('asset-v2.js'),/class="xdv" role="dialog"/,'고객 자산 세부 창은 확장관리와 같은 틀(.xdv)');
});
