const fs = require('fs');
const path = require('path');
const root = __dirname;
const files = ['아파트스퀘어_감리업무_로드맵.html','아파트스퀘어_감리업무_실전운영템플릿.html'];

const css = `
<style id="field-ui-refinement">
body{background:#f5f7f7;color:#17262f}
.top{height:54px;padding-inline:clamp(20px,3vw,42px)}
.brand{font-size:12px}.update-badge{background:#e8f2ed;color:#1f6b50;padding:5px 9px}
.top button{height:34px;border-radius:5px}
.project{max-width:1280px;padding:16px 24px 14px;align-items:center}
.project h1{font-size:28px;margin-bottom:4px}.project p{font-size:11px}
.project-fields input{height:34px;border-radius:5px}
.road-shell{top:54px}.road{max-width:1280px;padding:11px 24px 13px}
.phase-row{margin-bottom:8px}.phase{font-size:10px;padding-bottom:5px}
.dot{width:34px;height:34px}.step b{font-size:10.5px;margin-top:5px}.step small{font-size:8.5px}
.workspace{max-width:1280px;margin-top:14px;padding:0 24px}
.stage-head{background:#fff;color:var(--navy);border:1px solid #d7dfe2;border-left:6px solid var(--green);padding:18px 22px;box-shadow:0 5px 18px rgba(26,49,61,.05);scroll-margin-top:165px}
.stage-head small{color:var(--green);font-size:10px;font-weight:900}.stage-head h2{font-size:26px;margin:4px 0 5px}.stage-head p{color:#65737b;font-size:11px}
.gates{gap:10px}.gate{background:#f3f6f6;border-radius:6px;padding:10px 12px;min-width:150px}.gate span{color:#75858d;font-size:9px}.gate b{font-size:11.5px;line-height:1.45}
.work-title{padding:18px 2px 9px}.work-title h3{font-size:17px}.work-title span{font-size:11px}
.work{border-radius:8px;overflow:hidden;margin-bottom:10px;box-shadow:0 2px 8px rgba(26,49,61,.035)}
.work.open{border-color:#75a996;box-shadow:0 7px 24px rgba(30,93,69,.10)}
.work-summary{grid-template-columns:38px 1fr 100px 110px;padding:17px 19px;gap:14px}
.work-name b{font-size:14px}.work-name small{font-size:11.5px;line-height:1.5;margin-top:4px}.owner{font-size:11px}.manual-count{font-size:10px;border-radius:999px;background:#eef5f2;color:#246b52;border-color:#c5dbd2}
.work-detail{padding:20px;background:#f2f6f5}
.detail-grid{gap:14px}.field-guide{align-items:start}
.guide-section{position:relative;border:0;border-radius:8px;padding:18px 20px 18px 66px!important;margin-bottom:12px;box-shadow:0 1px 0 rgba(16,43,56,.08)}
.guide-section:before{position:absolute;left:17px;top:16px;width:25px;height:25px;border-radius:50%;display:grid;place-items:center;background:#17384a;color:#fff;font-size:11px;font-weight:900}
.field-guide>div:first-child .guide-section:first-child:before{content:'1'}
.field-guide>div:first-child .guide-section:nth-child(2):before{content:'2';background:#287459}
.field-guide>div:nth-child(2) .guide-section:first-child:before{content:'3';background:#b87616}
.field-guide>div:nth-child(2) .guide-section:nth-child(2):before{content:'4';background:#287459}
.guide-section h4{font-size:14px!important;margin-bottom:11px;letter-spacing:-.02em}.guide-section li{font-size:13.5px!important;line-height:1.72;margin-bottom:6px;color:#24343c}
.record-guide{background:#e8f3ee}.source-line{font-size:10px;border-radius:6px;padding:10px 12px}
@media(max-width:900px){.project-fields{display:none}.work-summary{grid-template-columns:32px 1fr 74px}.owner{font-size:10px}.detail-grid{grid-template-columns:1fr}.guide-section{padding-left:62px}.stage-head{padding:16px}.gates{display:grid;grid-template-columns:1fr}.road{min-width:1040px}}
</style>`;

for (const name of files) {
  const file = path.join(root,name);
  let html = fs.readFileSync(file,'utf8');
  html = html.replace('현장 본감리 PDF 14쪽 반영','현장감리 실행기준 반영');
  html = html.replace('업무를 누르면 실제 사진 매뉴얼이 바로 펼쳐집니다.','업무를 누르면 단계별 실행기준과 실제 매뉴얼이 펼쳐집니다.');
  if (html.includes('id="field-ui-refinement"')) html = html.replace(/<style id="field-ui-refinement">[\s\S]*?<\/style>/,css.trim());
  else html = html.replace('</head>',css+'</head>');
  html = html.replace('<div class="source-line">현장감리담당자 본감리 로드맵을 업무 흐름에 맞게 실행문장으로 재구성했습니다.</div>','');
  fs.writeFileSync(file,html,'utf8');
}
console.log('Refined the field manual UI in both HTML files.');
