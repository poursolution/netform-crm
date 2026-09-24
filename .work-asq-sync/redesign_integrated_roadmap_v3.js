const fs = require('fs');
const path = require('path');
const root = __dirname;
const files = [
  '아파트스퀘어_감리업무_로드맵.html',
  '아파트스퀘어_감리업무_실전운영템플릿.html',
  '아파트스퀘어_감리업무_로드맵_검증완료_20260913.html'
];

const helper = `function workflowFor(w,guide,s){
if(guide)return [
{no:'01',label:'가기 전',title:'파악과 준비',items:guide.before},
{no:'02',label:'현장에서',title:'확인과 판단',items:guide.field},
{no:'03',label:'떠나기 전',title:'현장 마감',items:guide.close},
{no:'04',label:'남길 것',title:'기록과 증거',items:guide.record}
];
return [
{no:'01',label:'시작 전',title:'대상과 자료 확인',items:['업무 요청내용과 대상현장·담당자를 확인합니다.','사용할 원본자료와 최신본 여부를 확인합니다.']},
{no:'02',label:'업무 실행',title:w[0],items:[w[1]]},
{no:'03',label:'검토',title:'누락과 오류 확인',items:['대상·일자·범위·첨부자료가 서로 일치하는지 확인합니다.','승인 또는 재확인이 필요한 항목을 완료 처리하지 않습니다.']},
{no:'04',label:'완료·인계',title:'결과를 남기고 넘기기',items:['완료 결과와 저장 위치를 확인합니다.','다음 단계인 '+s.next+'에 필요한 내용을 담당자에게 공유합니다.']}
]}
function flowCardHtml(flow){return flow.map((p,idx)=>\`<section class="flow-card flow-\${idx+1}"><header><span>\${p.no}</span><div><small>\${p.label}</small><h4>\${p.title}</h4></div></header><ul>\${p.items.map(x=>\`<li>\${x}</li>\`).join('')}</ul></section>\`).join('')}
function referenceHtml(refs){if(!refs.length)return '';return \`<details class="reference-fold"><summary><span>관련 화면 참고</span><b>\${refs.length}개</b><small>필요할 때만 펼치기</small></summary><div class="reference-grid">\${refs.map(r=>\`<figure><img loading="lazy" src="\${imagePath(r)}" alt="\${sources[r[0]][1]} \${r[1]}페이지"><figcaption>\${sources[r[0]][1]} · \${r[1]}페이지</figcaption></figure>\`).join('')}</div></details>\`}
`;

const newRenderBlock = `works.innerHTML=s.works.map((w,i)=>{const v=state[k(current,i)]||{},opened=openKey===k(current,i),refs=w[3],guide=fieldGuides[w[0]],flow=workflowFor(w,guide,s);return \`<article class="work \${opened?'open':''}"><div class="work-summary" onclick="toggle(\${i},event)"><input class="check" type="checkbox" \${v.done?'checked':''} onclick="event.stopPropagation()" onchange="update(\${i},'done',this.checked)"><div class="work-name"><b>\${i+1}. \${w[0]}</b><small>\${w[1]}</small></div><div class="owner">\${w[2]}</div><div class="manual-count">\${guide?'실행 기준':refs.length?\`화면 \${refs.length}개\`:'업무 기준'}</div><span class="work-chevron" aria-hidden="true">⌄</span></div><div class="work-detail"><div class="flow-line" aria-label="업무 실행 흐름">\${flowCardHtml(flow)}</div>\${referenceHtml(refs)}</div></article>\`}).join('');`;

const css = `<style id="integrated-roadmap-v3">
.work-title span{color:#64747c}.work{border:1px solid #dce3e4;background:#fff}.work-summary{grid-template-columns:38px minmax(0,1fr) 96px 92px 22px}.work-summary:hover{background:#fbfdfc}.work.open{border-color:#8fb8a8}.work-chevron{font-size:20px;color:#7f8f96;transition:transform .2s}.work.open .work-chevron{transform:rotate(180deg);color:#246b52}.manual-count{white-space:nowrap}
.work-detail{padding:22px 24px 24px;background:#f5f8f7}.flow-line{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;position:relative}.flow-line:before{content:'';position:absolute;top:26px;left:8%;right:8%;height:2px;background:#cbd8d3;z-index:0}.flow-card{position:relative;z-index:1;background:#fff;border:1px solid #dce5e2;border-radius:10px;padding:15px 16px 17px;min-height:190px}.flow-card header{display:flex;align-items:center;gap:10px;margin-bottom:14px}.flow-card header>span{width:36px;height:36px;border-radius:50%;display:grid;place-items:center;background:#17384a;color:#fff;font-size:11px;font-weight:900;box-shadow:0 0 0 5px #f5f8f7}.flow-card header small{display:block;color:#78878e;font-size:9px;font-weight:800}.flow-card h4{font-size:13px;margin:2px 0 0;color:#17384a}.flow-card ul{margin:0;padding-left:18px}.flow-card li{font-size:12px;line-height:1.65;margin-bottom:7px;color:#2c3c44}.flow-2 header>span{background:#287459}.flow-3 header>span{background:#b87616}.flow-4{background:#eaf4ef;border-color:#c9ded5}.flow-4 header>span{background:#287459}.flow-4 h4{color:#246b52}
.reference-fold{margin-top:14px;border:1px solid #d9e1e2;border-radius:9px;background:#fff;overflow:hidden}.reference-fold summary{list-style:none;display:flex;align-items:center;gap:9px;padding:13px 16px;cursor:pointer;color:#35454d;font-size:11px}.reference-fold summary::-webkit-details-marker{display:none}.reference-fold summary:before{content:'+';width:22px;height:22px;border-radius:50%;display:grid;place-items:center;background:#edf3f1;color:#286f55;font-weight:900}.reference-fold[open] summary:before{content:'−'}.reference-fold summary b{color:#286f55}.reference-fold summary small{margin-left:auto;color:#87949a}.reference-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;padding:0 16px 16px}.reference-grid figure{margin:0;background:#f5f7f7;border:1px solid #e0e5e6;border-radius:7px;overflow:hidden}.reference-grid img{display:block;width:100%;height:230px;object-fit:contain;background:#fff}.reference-grid figcaption{padding:8px 10px;font-size:9px;color:#68777e}
@media(max-width:1050px){.flow-line{grid-template-columns:1fr 1fr}.flow-line:before{display:none}.flow-card{min-height:0}.reference-grid{grid-template-columns:1fr 1fr}}
@media(max-width:700px){.work-summary{grid-template-columns:30px 1fr 20px}.owner,.manual-count{display:none}.work-detail{padding:14px}.flow-line{grid-template-columns:1fr}.reference-grid{grid-template-columns:1fr}.reference-grid img{height:auto}.flow-card{padding:14px}.work-chevron{display:block}}
@media print{.reference-fold{display:none}.flow-line{grid-template-columns:repeat(2,1fr)}.flow-card{break-inside:avoid;min-height:0}}
</style>`;

for(const name of files){
  const file=path.join(root,name);
  if(!fs.existsSync(file))continue;
  let html=fs.readFileSync(file,'utf8');
  if(!html.includes('function workflowFor('))html=html.replace('function render(){',helper+'function render(){');
  html=html.replace("items:[w[0]+'의 요청내용·대상현장·담당자를 확인합니다.','사용할 원본자료와 최신본 여부를 확인합니다.']","items:['업무 요청내용과 대상현장·담당자를 확인합니다.','사용할 원본자료와 최신본 여부를 확인합니다.']");
  const start=html.indexOf('works.innerHTML=s.works.map');
  const end=html.indexOf('const done=s.works.filter',start);
  if(start<0||end<0)throw new Error('render block not found: '+name);
  html=html.slice(0,start)+newRenderBlock+html.slice(end);
  html=html.replace('업무를 누르면 단계별 실행기준과 실제 매뉴얼이 펼쳐집니다.','업무를 누르면 준비부터 완료·인계까지 한 흐름으로 펼쳐집니다.');
  html=html.replace(/검증완료 · 12단계 전환 정상|현장감리 실행기준 반영/g,'업무흐름 통합형');
  html=html.replace(/<style id="integrated-roadmap-v3">[\s\S]*?<\/style>/,css);
  if(!html.includes('id="integrated-roadmap-v3"'))html=html.replace('</head>',css+'</head>');
  fs.writeFileSync(file,html,'utf8');
}
console.log('Redesigned roadmap as one integrated execution flow.');
