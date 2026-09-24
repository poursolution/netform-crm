const fs = require('fs');
const vm = require('vm');
const file = process.argv[2] || '아파트스퀘어_감리업무_로드맵.html';
const html = fs.readFileSync(file, 'utf8');
const scripts = [...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/gi)].map(m => m[1]);
for (const [i, js] of scripts.entries()) new vm.Script(js, { filename: `${file}:script-${i + 1}` });
const checks = {
  redactedOpsEmbedded: html.includes('"o-36-redacted":"data:image/png;base64,'),
  redactedGeneralEmbedded: html.includes('"g-39-redacted":"data:image/png;base64,'),
  stageReferencesBoth: html.includes("R('o',[31,32,33,34,35,36,37,38]).concat(R('g',[39,40]))"),
  routesToRedactedCopies: html.includes("(code==='o'&&n===36)||(code==='g'&&n===39)"),
  oldExclusionCopyRemoved: !html.includes('비밀번호가 표시된 원본 페이지는 화면에서 제외했습니다.'),
  backdataRemoved: !html.includes('업무 백데이터'),
  noExternalManualPngPaths: !/src=["'][^"']*manual_full_[^"']*\.png/i.test(html),
  fieldPdfViewerRemoved: !/\"f-\d+\":\"data:image\/png;base64,/.test(html) && !html.includes("R('f',["),
  structuredFieldManualAdded: html.includes('const fieldGuides=') && html.includes('function workflowFor(') && html.includes("title:'파악과 준비'") && html.includes("title:'기록과 증거'"),
  noSeparateManualPanel: !html.includes('실제 매뉴얼 화면') && !html.includes('오른쪽의 실제 매뉴얼 화면'),
  integratedFourStepFlow: html.includes('function flowCardHtml(') && html.includes('준비부터 완료·인계까지 한 흐름'),
  fieldWorkflowIntegrated: ['출발 전 3분 브리핑','착공일 본감리','공사 중 정기 현장감리','중요 공정·은폐 전 감리','부적합·변경·민원 현장감리','예비 준공검사','감리 본 준공검사','입주자대표회의 합동 최종 준공검사'].every(x=>html.includes(x)),
  stageNavigationHandler: html.includes('data-stage="${i}"') && html.includes("stepsEl.addEventListener('click'") && html.includes('function selectStage(i)'),
  explicitDomBindings: html.includes("const stepsEl=document.getElementById('steps')") && html.includes("worksEl=document.getElementById('works')"),
  noInlineHandlers: !/on(?:click|change)="/.test(html),
  stageChangeAutoScroll: html.includes("scrollIntoView({behavior:'smooth',block:'start'})"),
};
console.log(JSON.stringify({ size: fs.statSync(file).size, scripts: scripts.length, checks }, null, 2));
if (Object.values(checks).some(v => !v)) process.exit(1);
