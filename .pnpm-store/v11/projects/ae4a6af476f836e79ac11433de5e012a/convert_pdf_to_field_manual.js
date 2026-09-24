const fs = require('fs');
const path = require('path');

const root = __dirname;
const primary = path.join(root, '아파트스퀘어_감리업무_로드맵.html');
const current = path.join(root, '아파트스퀘어_감리업무_실전운영템플릿.html');
let html = fs.readFileSync(primary, 'utf8');

// The PDF is a source, not an on-screen viewer. Remove its rendered pages and links.
html = html.replace(/"f-\d+":"data:image\/png;base64,[^"]*",/g, '');
html = html.replace(/,f:\['field_supervision','현장감리담당자 본감리 로드맵'\]/, '');
html = html.replace(/R\('f',\[[^\]]*\]\)/g, '[]');

const guides = `
const fieldGuides={
'착공 전 본감리 준비':{before:['계약범위·시방서·도면·공정표가 같은 최신본인지 확인한다.','승인자재의 제품명·용도·제조사·반입예정 수량과 시험성적·제품자료·MSDS를 준비한다.','현장 기준상태, 출입조건, 안전서류와 최초 촬영 위치를 정한다.'],field:['작업지휘체계·작업자 명단·TBM·보호구와 작업구역 통제를 확인한다.','자재 반입전표와 현장 수량을 대조하고 유효기간·파손·보관상태를 기록한다.','작업 전 전체와 근접 기준사진을 남기고 작업 시작 가능 여부를 판단한다.'],close:['미비사항은 담당자·완료기한·재확인 방법을 정한다.','다음 방문 목적과 시공사가 미리 보낼 자료를 합의한다.'],record:['착공 감리일지','착공 전·후 기준사진','최초 자재 반입·검수 기록','차기 방문계획']},
'출발 전 3분 브리핑':{before:['현장명·방문일시·날씨·감리자·출입 담당자를 확인한다.','현재 공정과 오늘의 작업구역·작업자·예정 종료시간을 확인한다.','전회 미종결 지적의 위치·담당자·약속기한과 동일 위치 사진을 준비한다.'],field:['오늘의 1순위와 HOLD POINT를 현장대리인에게 다시 읽어 확인한다.','자재·안전·민원·변경사항을 먼저 확인한 후 점검을 시작한다.'],close:['남길 산출물과 다음 방문 목적·예정일을 확정한다.'],record:['오늘의 1순위/HOLD','전회 미종결 목록','필수 촬영목록','방문 종료조건']},
'현장 행동 사이클·지적 종결':{before:['오늘 공정·전회 미종결·자재·날씨·민원을 사전 확인한다.'],field:['현장대리인에게 계획과 변경을 설명받는다.','안전·서류 → 자재 → 품질 → 공정 → 보양·민원 순서로 점검한다.','전체→근접 사진과 작업일보 내용을 연결한다.','기준에서 벗어난 항목은 진행·조건부·보류로 판정한다.'],close:['현장대리인과 지적 및 다음 공정 조건을 다시 읽는다.','당일 일지·사진·대장을 갱신하고 다음 방문 목적을 확정한다.'],record:['위치·현상·기준/영향','요청조치','담당자·완료기한','재확인일·종결일']},
'착공일 본감리':{before:['계약범위·도면·시방서와 착공 공정표를 대조한다.','공정표·안전관리계획·현장대리인 배치와 공지·출입사항을 확인한다.','승인자재·시험성적·제품자료·MSDS 준비를 확인한다.'],field:['작업지휘체계·TBM·보호구·작업구역 통제를 확인한다.','자재 반입전표와 수량·상태·보관을 기록한다.','작업 전 전체·근접 기준상태를 촬영한다.','바탕처리 또는 최초 시공구간으로 품질 비교기준을 만든다.'],close:['당일 지적을 다음 공정 전에 보완하도록 하고 재확인 시간을 정한다.','금일 자재의 반입·사용·잔량과 차기 방문 목적을 합의한다.'],record:['착공 감리일지','기준상태 사진','자재 검수 기록','안전·서류 최초 점검']},
'공사 중 정기 현장감리':{before:['전회 지적의 미종결 항목과 약속기한을 확인한다.','오늘 공정과 되돌리기 어려운 구간을 1순위로 정한다.','공종별 체크포인트와 승인자료를 준비한다.'],field:['현장대리인에게 계획 대비 실제 작업·변경·예상 종료시간을 확인한다.','바탕→보강→하도→중도→상도/마감 순서와 취약부를 점검한다.','자재 반입량·사용량·잔량·폐기량을 대조한다.','작업일보·TBM·MSDS·사진과 현장 실작업을 대조한다.'],close:['지적을 즉시·다음 공정 전·준공 전·경과관찰로 구분한다.','각 지적의 위치·사진·담당자·기한·재확인일을 확정한다.'],record:['공사감리일지','점검사진대장','지적사항 추적대장','자재 사용현황']},
'중요 공정·은폐 전 감리':{before:['검사 위치·물량·검사기준과 후속공정 시작시간을 확인한다.','도면·시방서·승인자재·시험시공 사진과 전회 지적을 준비한다.','검사 전까지 후속공정을 진행하지 않는 HOLD 시간을 확정한다.'],field:['건조·강도·수분·분진·유분·균열·면정리 등 바탕상태를 본다.','모서리·단부·이음·드레인·관통부·파라펫 등 취약부를 근접 촬영한다.','공정별 누락·불균일·들뜸·주름·충진 부족을 확인한다.','진행·조건부·보류 중 하나로 판단하고 근거를 설명한다.'],close:['조건부는 담당자·완료기한·재확인 방법을 정한다.','검사 위치와 미검사 위치를 구분하고 다음 공정 시작조건을 합의한다.'],record:['은폐 전 사진','측정·자재·시간 기록','진행/조건부/보류 판정','재확인 계획']},
'부적합·변경·민원 현장감리':{before:['최초 발생일·위치·사진·지적·협의·민원 접수를 시간순으로 모은다.','품질 부적합·범위 변경·기존 하자·안전위험을 1차 구분한다.','기술확인자·계약/비용 결정권자·현장 조치담당자를 구분한다.'],field:['관찰 사실과 추정 원인을 분리해 기록한다.','계약·시방·승인기준과 차이 및 안전·내구·사용 영향을 설명한다.','즉시보완·원인조사·범위협의·경과관찰·긴급피해방지로 처리 방향을 나눈다.','추가·대체시공은 감리자가 비용과 범위를 단독 약속하지 않는다.'],close:['누가 무엇을 언제까지 할지와 공정영향·재확인일을 합의한다.','긴급사항은 관리주체와 시공사에 우선 통보하고 임시조치를 확인한다.'],record:['부적합·시정요청 기록','변경·추가공사 협의기록','민원 처리이력','기성검토 근거']},
'공종별 중점·종료 루틴':{before:['외벽·옥상·지하주차장·내부 등 해당 공종의 체크포인트를 고른다.'],field:['외벽은 균열·들뜸·바인더·하도·색상·흐름·단부를 본다.','옥상은 바탕·함침/프라이머·이음·단부·배수 연속성과 손상 위험을 본다.','지하주차장은 균열·퍼티·하도·엠보/중도·상도 순서와 용접·과다척출·보양을 본다.','내부는 균열·바탕보수·무늬·색상·마스킹·경계선·걸레받이 오염을 본다.'],close:['지적·책임선·다음 공정·자재·서류·사진·현장통제·다음 방문을 확인한다.'],record:['공종별 체크 결과','동일 위치 보완사진','적용 기준과 예외사항']},
'현장 실행카드·권한 경계':{before:['방문일시·감리자·날씨·현재 단계와 오늘의 공정/HOLD를 적는다.'],field:['계획과 실제 차이, 품질·자재·안전·서류, 지적·변경·민원을 기록한다.','감리자는 사실을 확인하고 기준과 기술의견을 제공한다.','추가비용·설계변경·작업지휘·최종 승인·잔금지급은 권한자에게 인계한다.'],close:['담당자·기한·진행판정과 다음 방문 목적을 확정한다.'],record:['전체·중경·근접·동일위치 사진','자재 반입표·수량','작업일보·TBM·현장대리인 서명']},
'예비 준공검사':{before:['계약범위·변경승인·지적대장과 시공사 자체 준공점검표를 확인한다.','잔여공정·자재정산·준공서류 제출현황과 검사시간·동행자를 확인한다.'],field:['대표구간·취약부·민원구간을 구분해 전체 구간을 순회한다.','마감의 색상·오염·균열·들뜸·박리·도포누락과 이음·단부·드레인·보양해제를 본다.','지적을 즉시보완·최종검사 전 완료·경과관찰·협의로 구분한다.'],close:['최종검사 전 완료할 항목을 위치·내용·담당자·기한·확인방법으로 목록화한다.','합동검사 참석자·동선·판정기준·우천대안을 안내한다.'],record:['예비 준공검사표','펀치리스트','준공서류 제출현황','본 준공·합동검사 계획']},
'감리 본 준공검사':{before:['전회 하자리스트의 조치사진과 완료확인을 받고 미결을 표시한다.','계약범위표·승인변경·주요 지적·민원·준공서류를 준비한다.'],field:['전회 하자를 같은 위치에서 재확인해 완료·재보완·경과관찰로 닫는다.','대표구간·취약부·민원부위를 다시 본다.','준공 가능·조건부 가능·합동검사 보류 의견과 근거를 정한다.'],close:['잔여사항은 위치·내용·담당자·기한·확인자를 서면으로 남긴다.','검사의 시행/연기와 감리 의견을 관리주체·시공사에 공유한다.'],record:['준공 감리일지','전회 지적 종결표','준공 가능 여부 의견','합동검사 설명자료']},
'입주자대표회의 합동 최종 준공검사':{before:['필수 참석자·집결시간·장소와 안전한 검사동선을 확인한다.','공사개요·범위·주요 공정·승인자재·지적종결·조건부 항목을 한눈에 설명할 자료를 준비한다.','적합·조건부 적합·재검사의 판정기준을 사전 공유한다.'],field:['공사범위와 판정기준을 먼저 안내한다.','전체 완료상태→대표구간→취약부→전회 보완부→민원부 순으로 함께 확인한다.','현장 의견은 즉시보완·기한보완·경과관찰·계약범위 외로 분류한다.','의견이 다르면 책임을 단정하지 않고 확인자료와 회신기한을 정한다.'],close:['결과·잔여사항·담당자·기한을 현장에서 읽어 확인한다.','회장·관리소장·감리자와 추가 참석자의 서명·날인을 받는다.','승인서 원본·검사사진·잔여목록·연락자를 확보한다.'],record:['최종준공검사승인서','참석자 서명','검사사진','잔여사항 이행확인 일정']},
'준공검사 보완확인':{before:['조건부·재검사 항목의 위치·요구조치·완료기한과 제출사진을 확인한다.'],field:['동일 위치에서 보완 전·후를 대조하고 감춰진 항목은 근거자료를 확인한다.','완료·재보완·경과관찰로 판정하고 준공 및 후속 절차 영향을 기록한다.'],close:['미결이 없으면 종결일과 확인자를 확정하고, 남으면 재검사 일정을 잡는다.'],record:['보완 전·후 사진','재검사 결과','지적 종결일·확인자']}
};
`;
if (!html.includes('const fieldGuides=')) html = html.replace('const store=sessionStorage;', guides + 'const store=sessionStorage;');

html = html.replace('opened=openKey===k(current,i),refs=w[3];return', 'opened=openKey===k(current,i),refs=w[3],guide=fieldGuides[w[0]];return');
html = html.replace("${refs.length?`매뉴얼 ${refs.length}쪽`:'업무 기준'}", "${guide?'현장 실행기준':refs.length?`매뉴얼 ${refs.length}쪽`:'업무 기준'}");

const oldDetail = `<div class="work-detail"><div class="detail-grid"><div class="instructions"><h4>실행 내용</h4><ol><li>\${w[1]}</li><li>오른쪽의 실제 매뉴얼 화면을 순서대로 확인합니다.</li></ol><div class="source-line">\${refs.length?\`연결 매뉴얼 · \${sourceName(refs)} / \${refs.length}페이지\`:'사진 매뉴얼 없음 · 로드맵과 현장감리 기준으로 작성'}</div></div><div class="evidence"><h4>실제 매뉴얼 화면</h4>\${refs.length?\`<div class="shots">\${refs.map(r=>\`<figure><a href="\${imagePath(r)}" target="_blank"><img loading="lazy" src="\${imagePath(r)}"></a><figcaption>\${sources[r[0]][1]} · \${r[1]}페이지</figcaption></figure>\`).join('')}</div>\`:'<div class="no-shot">이 업무와 직접 연결되는 사진 매뉴얼은 현재 세 파일에서 확인되지 않았습니다.</div>'}</div></div></div>`;
const newDetail = `<div class="work-detail">\${guide?\`<div class="detail-grid field-guide"><div><section class="guide-section"><h4>가기 전 · 파악과 준비</h4><ol>\${guide.before.map(x=>\`<li>\${x}</li>\`).join('')}</ol></section><section class="guide-section"><h4>현장에서 · 확인과 판단</h4><ol>\${guide.field.map(x=>\`<li>\${x}</li>\`).join('')}</ol></section></div><div><section class="guide-section"><h4>떠나기 전 · 현장 마감</h4><ol>\${guide.close.map(x=>\`<li>\${x}</li>\`).join('')}</ol></section><section class="guide-section record-guide"><h4>반드시 남길 기록</h4><ul>\${guide.record.map(x=>\`<li>\${x}</li>\`).join('')}</ul></section><div class="source-line">현장감리담당자 본감리 로드맵을 업무 흐름에 맞게 실행문장으로 재구성했습니다.</div></div></div>\`:\`<div class="detail-grid"><div class="instructions"><h4>실행 내용</h4><ol><li>\${w[1]}</li><li>오른쪽의 실제 매뉴얼 화면을 순서대로 확인합니다.</li></ol><div class="source-line">\${refs.length?\`연결 매뉴얼 · \${sourceName(refs)} / \${refs.length}페이지\`:'사진 매뉴얼 없음 · 로드맵 업무 기준으로 작성'}</div></div><div class="evidence"><h4>실제 매뉴얼 화면</h4>\${refs.length?\`<div class="shots">\${refs.map(r=>\`<figure><a href="\${imagePath(r)}" target="_blank"><img loading="lazy" src="\${imagePath(r)}"></a><figcaption>\${sources[r[0]][1]} · \${r[1]}페이지</figcaption></figure>\`).join('')}</div>\`:'<div class="no-shot">이 업무와 직접 연결되는 사진 매뉴얼은 현재 확인되지 않았습니다.</div>'}</div></div>\`}</div>`;
if (!html.includes(oldDetail) && !html.includes('class="detail-grid field-guide"')) throw new Error('work detail marker not found');
if (html.includes(oldDetail)) html = html.replace(oldDetail, newDetail);

if (!html.includes('.guide-section{')) html = html.replace('</style></body></html>', '.guide-section{background:#fff;border:1px solid var(--line);padding:17px 19px;margin-bottom:10px}.guide-section h4{margin:0 0 10px;color:var(--blue);font-size:11px}.guide-section ol,.guide-section ul{margin:0;padding-left:20px}.guide-section li{font-size:11px;line-height:1.65;margin-bottom:5px}.record-guide{background:#eef6f2;border-color:#c7ddd3}.record-guide h4{color:var(--green)}</style></body></html>');

if (/"f-\d+":"data:image\/png;base64,/.test(html)) throw new Error('PDF page images remain embedded');
if (html.includes("R('f',[")) throw new Error('PDF page references remain');
if (!html.includes('const fieldGuides=')) throw new Error('field guides missing');

fs.writeFileSync(primary, html, 'utf8');
fs.writeFileSync(current, html, 'utf8');
console.log('Converted field PDF pages into structured field manuals.');
