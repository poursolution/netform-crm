const fs = require('fs');
const path = require('path');

const root = __dirname;
const htmlPath = path.join(root, '아파트스퀘어_감리업무_로드맵.html');
let html = fs.readFileSync(htmlPath, 'utf8');

html = html.replace(
  "const sources={b:['manual_full_boram','업무매뉴얼_보람'],g:['manual_full_general','매뉴얼 (2)'],o:['manual_full_ops','업무보조 매뉴얼 26.08']};",
  "const sources={b:['manual_full_boram','업무매뉴얼_보람'],g:['manual_full_general','매뉴얼 (2)'],o:['manual_full_ops','업무보조 매뉴얼 26.08'],f:['field_supervision','현장감리담당자 본감리 로드맵']};"
);

const oldStage7 = "['착공 전 확인','착공계·공정표·자재·시험성적·안전계획·주민공지를 확인합니다.','감리·서비스',[]]";
const newStage7 = "['착공 전 본감리 준비','계약범위·시방서·도면·공정표와 승인자재를 대조하고, 안전서류·현장 기준상태·최초 품질기준을 확인합니다.','감리',R('f',[1,4])]";
if (html.includes(oldStage7)) html = html.replace(oldStage7, newStage7);

const oldStage8 = "{n:'현장감리',sub:'원본 11·12',owner:'감리·서비스',start:'당일 공정과 이전 지적 확인',end:'감리보고서·사진·지적조치',next:'공정보고·기성검토',works:[['감리메모·사진 수신','잔디 현장체크리스트의 메모와 사진을 확인해 현장별 날짜 폴더에 저장합니다.','서비스·감리',R('o',[4,5,6,7])],['감리보고서 작성·업로드','보고서를 작성하고 갑지를 만든 뒤 아임웹과 이메일로 발송합니다.','서비스',R('o',[8,9,10,11,12,13,14])],['현장사진 백업·게시','작업일보와 사진을 내려받아 공정별 폴더로 저장하고 안전모 착용 사진만 게시합니다.','서비스',R('o',[24,25,26,27,28,29,30])],['상시 파일·자료 관리','현장사진·과거견적·도면을 현장별 폴더에 저장하고 최신본 위치를 공유합니다.','서비스',R('b',[23])]]}";
const newStage8 = "{n:'현장감리',sub:'현장 본감리 02~07·11~14',owner:'감리·서비스',start:'출발 전 미종결·HOLD·당일 공정 확인',end:'판정·증거·책임자·재확인일 기록',next:'공정보고·기성검토',works:[['출발 전 3분 브리핑','현장·공정·최우선 확인사항, 전회 미종결, 자재·안전·민원과 오늘의 종료조건을 한 줄씩 정리합니다.','감리',R('f',[2])],['현장 행동 사이클·지적 종결','계획과 실제를 대조하고 안전→자재→품질→공정→보양·민원 순서로 확인합니다. 지적은 위치·현상·기준·조치·담당자·기한·재확인일까지 닫습니다.','감리',R('f',[3])],['착공일 본감리','착공서류·승인자재·기준상태를 확인하고 작업 시작 가능 여부와 최초 품질기준을 기록합니다.','감리',R('f',[4])],['공사 중 정기 현장감리','전회 지적부터 재확인하고 실제 공정·자재·품질·안전·보양·민원을 점검한 뒤 다음 방문 목적을 확정합니다.','감리',R('f',[5])],['중요 공정·은폐 전 감리','후속공정으로 가려지기 전 취약부를 검사하고 진행·조건부·보류 판정과 재확인 방법을 남깁니다.','감리',R('f',[6])],['부적합·변경·민원 현장감리','확인된 사실과 추정을 분리하고 계약기준·추가요청·긴급조치·책임주체를 구분해 조치기한을 합의합니다.','감리',R('f',[7])],['공종별 중점·종료 루틴','외벽·옥상·지하주차장·내부 공종별 중점사항을 확인하고 지적, 책임선, 다음 공정, 자재, 서류, 사진, 현장통제와 다음 방문을 마감합니다.','감리',R('f',[11,12])],['현장 실행카드·권한 경계','방문 전·현장·떠나기 전 체크카드와 필수 증거를 사용하고, 감리 판단과 시공사·입대의 결정의 경계를 지킵니다.','감리',R('f',[13,14])],['감리메모·사진 수신','잔디 현장체크리스트의 메모와 사진을 확인해 현장별 날짜 폴더에 저장합니다.','서비스·감리',R('o',[4,5,6,7])],['감리보고서 작성·업로드','보고서를 작성하고 갑지를 만든 뒤 아임웹과 이메일로 발송합니다.','서비스',R('o',[8,9,10,11,12,13,14])],['현장사진 백업·게시','작업일보와 사진을 내려받아 공정별 폴더로 저장하고 안전모 착용 사진만 게시합니다.','서비스',R('o',[24,25,26,27,28,29,30])],['상시 파일·자료 관리','현장사진·과거견적·도면을 현장별 폴더에 저장하고 최신본 위치를 공유합니다.','서비스',R('b',[23])]]}";
if (!html.includes(oldStage8) && !html.includes("['출발 전 3분 브리핑'")) throw new Error('stage 8 marker not found');
if (html.includes(oldStage8)) html = html.replace(oldStage8, newStage8);

const oldStage10 = "{n:'준공검사·준공보고',sub:'원본 15·16',owner:'감리·서비스',start:'공사완료 통보',end:'보완완료·준공계 발송증빙',next:'잔금지급·정산',works:[['준공검사와 보완확인','계약범위와 지적사항을 대조하고 미조치 항목은 재검사합니다.','감리',[]],";
const newStage10 = "{n:'준공검사·준공보고',sub:'예비·본·합동 준공검사',owner:'감리·서비스',start:'공사완료 통보와 예비검사 준비',end:'합동검사 서명·보완완료·준공계 발송증빙',next:'잔금지급·정산',works:[['예비 준공검사','전체 구간을 순회하며 취약부·민원구간과 준공서류를 확인하고, 최종검사 전 완료할 항목을 담당자·기한·재확인 방법으로 정리합니다.','감리',R('f',[8])],['감리 본 준공검사','전회 지적을 동일 위치에서 재확인하고 계약범위·승인변경·준공서류를 종합해 적합·조건부·합동검사 보류 의견을 정합니다.','감리',R('f',[9])],['입주자대표회의 합동 최종 준공검사','검사동선·안전수칙·판정기준을 공유하고 결과와 잔여사항을 현장에서 조정해 참석자 서명과 최종준공검사승인서를 확보합니다.','감리·아파트·시공사',R('f',[10])],['준공검사 보완확인','계약범위와 지적사항을 대조하고 조건부·재검사 항목은 완료 증거와 현장 재확인으로 종결합니다.','감리',[]],";
if (!html.includes(oldStage10) && !html.includes("['예비 준공검사'")) throw new Error('stage 10 marker not found');
if (html.includes(oldStage10)) html = html.replace(oldStage10, newStage10);

const mapStart = 'const embeddedImages={';
if (!html.includes(mapStart)) throw new Error('embedded image map not found');
if (!html.includes('"f-1":"data:image/png;base64,')) {
  const entries = [];
  for (let n = 1; n <= 14; n++) {
    const file = path.join(root, 'tmp', 'pdfs', 'field_supervision', `page-${String(n).padStart(2, '0')}.png`);
    const data = fs.readFileSync(file).toString('base64');
    entries.push(`${JSON.stringify(`f-${n}`)}:${JSON.stringify(`data:image/png;base64,${data}`)}`);
  }
  html = html.replace(mapStart, `${mapStart}${entries.join(',')},`);
}

fs.writeFileSync(htmlPath, html, 'utf8');
console.log('Integrated all 14 field-supervision PDF pages into the roadmap.');
