'use strict';
/* 견적서 엑셀 올리기 · 읽기 · 자동 확인 5가지 — 시험용 xlsx 를 직접 만들어(zip + xml) 같은 경로로 읽는다 */
const test=require('node:test'),assert=require('node:assert/strict'),zlib=require('zlib'),fs=require('fs'),path=require('path');
const X=require('../quote-excel.js'),C=require('../quote-calc.js');
const inflate=async u=>new Uint8Array(zlib.inflateRawSync(u));
function crc32(b){let c,t=[];for(let n=0;n<256;n++){c=n;for(let k=0;k<8;k++)c=c&1?0xEDB88320^(c>>>1):c>>>1;t[n]=c>>>0;}let r=0xFFFFFFFF;for(const x of b)r=t[(r^x)&255]^(r>>>8);return (r^0xFFFFFFFF)>>>0;}
function makeZip(files){const parts=[],cd=[];let off=0;for(const [name,text] of Object.entries(files)){const nb=Buffer.from(name),raw=Buffer.from(text),def=zlib.deflateRawSync(raw),crc=crc32(raw);
 const lh=Buffer.alloc(30);lh.writeUInt32LE(0x04034b50,0);lh.writeUInt16LE(20,4);lh.writeUInt16LE(8,8);lh.writeUInt32LE(crc,14);lh.writeUInt32LE(def.length,18);lh.writeUInt32LE(raw.length,22);lh.writeUInt16LE(nb.length,26);
 parts.push(lh,nb,def);const ch=Buffer.alloc(46);ch.writeUInt32LE(0x02014b50,0);ch.writeUInt16LE(20,4);ch.writeUInt16LE(20,6);ch.writeUInt16LE(8,10);ch.writeUInt32LE(crc,16);ch.writeUInt32LE(def.length,20);ch.writeUInt32LE(raw.length,24);ch.writeUInt16LE(nb.length,28);ch.writeUInt32LE(off,42);cd.push(ch,nb);off+=30+nb.length+def.length;}
 const cdb=Buffer.concat(cd),e=Buffer.alloc(22);e.writeUInt32LE(0x06054b50,0);e.writeUInt16LE(cd.length/2,8);e.writeUInt16LE(cd.length/2,10);e.writeUInt32LE(cdb.length,12);e.writeUInt32LE(off,16);return Buffer.concat([...parts,cdb,e]);}
const esc=s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;');
function sheetXml(cells){const byRow={};for(const [ref,v] of Object.entries(cells)){const r=ref.match(/\d+/)[0];(byRow[r]=byRow[r]||[]).push([ref,v]);}
 return '<worksheet><sheetData>'+Object.entries(byRow).map(([r,cs])=>'<row r="'+r+'">'+cs.map(([ref,v])=>typeof v==='number'?'<c r="'+ref+'"><v>'+v+'</v></c>':'<c r="'+ref+'" t="inlineStr"><is><t>'+esc(v)+'</t></is></c>').join('')+'</row>').join('')+'</sheetData></worksheet>';}
function makeXlsx(sheets){const names=Object.keys(sheets),files={'xl/workbook.xml':'<workbook><sheets>'+names.map((n,i)=>'<sheet name="'+esc(n)+'" sheetId="'+(i+1)+'" r:id="rId'+(i+1)+'"/>').join('')+'</sheets></workbook>','xl/_rels/workbook.xml.rels':'<Relationships>'+names.map((n,i)=>'<Relationship Id="rId'+(i+1)+'" Target="worksheets/sheet'+(i+1)+'.xml"/>').join('')+'</Relationships>'};
 names.forEach((n,i)=>files['xl/worksheets/sheet'+(i+1)+'.xml']=sheetXml(sheets[n]));return makeZip(files);}
/* 솔밭 260623 견적서(2번 자료)와 같은 숫자로 만든 시험 파일 */
const fx=JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures','quote-solbat-2.json'),'utf8')),E=fx.exp;
function build(over){over=over||{};
 const cost={A1:'공 사 원 가 계 산 서',B3:'옥상 싱글 방수공사'};for(const r of [6,8,9,10,11,12,13,14,18,19,20,21,22,23,24,25,26,27,28,29,30])cost['E'+r]=E['E'+r];
 for(const k of Object.keys(fx.rates))cost[k]=fx.rates[k];Object.assign(cost,over.cost);
 const sum={A5:'1. 아스팔트 슁글 방수공사',C5:'식',D5:1,F5:E.E6,H5:E.E9,J5:E.E12,L5:E.E6+E.E9+E.E12,F28:E.E6,H28:E.E9,J28:E.E12,L28:E.E6+E.E9+E.E12};Object.assign(sum,over.sum);
 return makeXlsx({'갑지':{D6:45798,D10:'옥상 싱글 방수공사',H23:'주식회사 석민이앤씨',...over.cover},'원가계산서 ':cost,'집계표':sum,'산출내역서':{A4:'1. 아스팔트 슁글 방수공사',C4:'㎡',D4:fx.qty,...over.items}});}
const run=(buf,opt)=>X.readFile(buf,Object.assign({calc:C,inflate},opt));
test('정해진 칸에서 읽는다 — 표지 · 원가계산서 · 집계표 · 산출내역서',async()=>{
 const {read}=await run(build());
 assert.equal(read.cover.kind,'갑지');assert.equal(read.cover.date,'2025-05-21','엑셀 날짜 숫자 45798 → 1900 체계 변환');assert.equal(read.cover.company,'주식회사 석민이앤씨');
 assert.equal(read.cost.E28,182172502);assert.equal(read.cost.E30,182100000);assert.equal(read.rates.G26,0.03);assert.equal(read.summary.totals.total,134683560);assert.equal(read.items[0].qty,3960);
 assert.equal(read.flags.health,false);assert.equal(read.flags.noIndirect,false);
});
test('자동 확인 — 구조 · 수량 · 재계산이 통과하고, PDF · 요청 공사 종류는 재료가 오기 전까지 보류(최종본 불가)',async()=>{
 const {result}=await run(build());const st=Object.fromEntries(result.checks.map(c=>[c.key,c.status]));
 assert.deepEqual(st,{structure:'pass',qty:'pass',recalc:'pass',pdf:'skip',template:'skip'});assert.equal(result.canFinal,false);assert.equal(result.pending,2);
});
test('다섯 가지가 모두 통과하면 최종본 가능 · PDF 금액 다르면 막힘 · 다른 공사 양식이면 막힘',async()=>{
 const ok=await run(build(),{pdfAmount:182100000,requestedWork:'옥상 싱글 방수'});assert.equal(ok.result.canFinal,true);
 const pdf=await run(build(),{pdfAmount:182000000,requestedWork:'싱글'});assert.equal(pdf.result.canFinal,false);assert.match(pdf.result.checks.find(c=>c.key==='pdf').msg,/PDF 182,000,000원 ≠ 엑셀 182,100,000원/);
 const tpl=await run(build(),{pdfAmount:182100000,requestedWork:'우레탄 도장'});assert.equal(tpl.result.checks.find(c=>c.key==='template').status,'fail');
});
test('고른 공종의 수량 또는 금액이 0이면 막힘',async()=>{
 const a=await run(build({items:{D4:0},sum:{D5:0}}));assert.equal(a.result.checks.find(c=>c.key==='qty').status,'fail');
 const b=await run(build({sum:{L5:0}}));assert.equal(b.result.checks.find(c=>c.key==='qty').status,'fail');
});
test('항목별 재계산이 엑셀 공급가액과 다르면 막힘(손으로 금액을 고친 경우)',async()=>{
 const {result}=await run(build({cost:{E28:E.E28+1000}}));const c=result.checks.find(x=>x.key==='recalc');assert.equal(c.status,'fail');assert.match(c.msg,/182,172,502원 ≠ 엑셀 182,173,502원/);
});
test('간접비 칸이 빈 양식(공과잡비X)은 직접공사비가 곧 공급가액',async()=>{
 const cost={A1:'x',B3:'후레싱 복합시트 보강공사',E6:18666000,E8:18666000,E9:42450000,E11:42450000,E12:0,E25:61116000,E28:61116000,E30:61100000,G10:0.175,G26:0.06,G27:0.15};
 const buf=makeXlsx({'갑지':{D10:'x'},'원가계산서 ':cost,'집계표':{A5:'1. 후레싱 복합시트 보강공사',D5:1,F5:18666000,H5:42450000,J5:0,L5:61116000,F28:18666000,H28:42450000,J28:0,L28:61116000}});
 const {read,result}=await run(buf);assert.equal(read.flags.noIndirect,true);assert.equal(result.checks.find(c=>c.key==='recalc').status,'pass');assert.equal(result.checks.find(c=>c.key==='structure').status,'pass','일위대가표 · 산출내역서가 없는 간단 양식도 구조 통과');
});
test('엑셀이 아니거나 필요한 시트가 없으면 이유를 알려 준다',async()=>{
 await assert.rejects(()=>run(Buffer.from('not a zip file at all, just text')),/엑셀\(xlsx\) 파일이 아닙니다/);
 const {result}=await run(makeXlsx({'갑지':{D10:'x'}}));assert.equal(result.checks.find(c=>c.key==='structure').status,'fail');assert.match(result.checks.find(c=>c.key==='structure').msg,/원가계산서, 집계표/);
 assert.equal(X.excelDate(45798),'2025-05-21');assert.equal(X.excelDate(''),'');
});

test('이름만 남은 빈 공종 줄(수량도 금액도 0)은 쓰지 않은 줄로 빼고 통과 · 전부 비어 있으면 막힘',async()=>{
 const a=await run(build({sum:{A6:'2. 기타공사',C6:'식',D6:1,F6:0,H6:0,J6:0,L6:0},items:{A20:'2. 기타공사',C20:'식',D20:0}}));
 const q=a.result.checks.find(c=>c.key==='qty');assert.equal(q.status,'pass');assert.match(q.msg,/빈 공종 줄 1개/);assert.deepEqual(a.read.ignoredRows,['2. 기타공사']);
 const b=await run(build({sum:{L5:0,F5:0,H5:0,J5:0},items:{D4:0}}));assert.equal(b.result.checks.find(c=>c.key==='qty').status,'fail');
});
