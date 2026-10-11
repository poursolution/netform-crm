'use strict';
/* 시험용 xlsx 만들기 — { 시트이름: { 'A1': 값(숫자 | 글자) } } → Buffer (zip + xml, 읽는 쪽 QuoteExcel 과 같은 경로로 열린다) */
const zlib=require('zlib');
function crc32(b){let c,t=[];for(let n=0;n<256;n++){c=n;for(let k=0;k<8;k++)c=c&1?0xEDB88320^(c>>>1):c>>>1;t[n]=c>>>0;}let r=0xFFFFFFFF;for(const x of b)r=t[(r^x)&255]^(r>>>8);return (r^0xFFFFFFFF)>>>0;}
function makeZip(files){const parts=[],cd=[];let off=0;for(const [name,text] of Object.entries(files)){const nb=Buffer.from(name),raw=Buffer.from(text),def=zlib.deflateRawSync(raw),crc=crc32(raw);
 const lh=Buffer.alloc(30);lh.writeUInt32LE(0x04034b50,0);lh.writeUInt16LE(20,4);lh.writeUInt16LE(8,8);lh.writeUInt32LE(crc,14);lh.writeUInt32LE(def.length,18);lh.writeUInt32LE(raw.length,22);lh.writeUInt16LE(nb.length,26);
 parts.push(lh,nb,def);const ch=Buffer.alloc(46);ch.writeUInt32LE(0x02014b50,0);ch.writeUInt16LE(20,4);ch.writeUInt16LE(20,6);ch.writeUInt16LE(8,10);ch.writeUInt32LE(crc,16);ch.writeUInt32LE(def.length,20);ch.writeUInt32LE(raw.length,24);ch.writeUInt16LE(nb.length,28);ch.writeUInt32LE(off,42);cd.push(ch,nb);off+=30+nb.length+def.length;}
 const cdb=Buffer.concat(cd),e=Buffer.alloc(22);e.writeUInt32LE(0x06054b50,0);e.writeUInt16LE(cd.length/2,8);e.writeUInt16LE(cd.length/2,10);e.writeUInt32LE(cdb.length,12);e.writeUInt32LE(off,16);return Buffer.concat([...parts,cdb,e]);}
const esc=s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;');
function sheetXml(cells){const byRow={};for(const [ref,v] of Object.entries(cells)){const r=ref.match(/\d+/)[0];(byRow[r]=byRow[r]||[]).push([ref,v]);}
 const cell=(ref,v)=>{if(v&&typeof v==='object'){const f='<f>'+esc(v.f)+'</f>';return typeof v.v==='number'?'<c r="'+ref+'">'+f+'<v>'+v.v+'</v></c>':'<c r="'+ref+'" t="str">'+f+'<v>'+esc(v.v)+'</v></c>';}return typeof v==='number'?'<c r="'+ref+'"><v>'+v+'</v></c>':'<c r="'+ref+'" t="inlineStr"><is><t>'+esc(v)+'</t></is></c>';};
 return '<worksheet><sheetData>'+Object.entries(byRow).map(([r,cs])=>'<row r="'+r+'">'+cs.map(([ref,v])=>cell(ref,v)).join('')+'</row>').join('')+'</sheetData></worksheet>';}
function makeXlsx(sheets){const names=Object.keys(sheets),files={'xl/workbook.xml':'<workbook><sheets>'+names.map((n,i)=>'<sheet name="'+esc(n)+'" sheetId="'+(i+1)+'" r:id="rId'+(i+1)+'"/>').join('')+'</sheets></workbook>','xl/_rels/workbook.xml.rels':'<Relationships>'+names.map((n,i)=>'<Relationship Id="rId'+(i+1)+'" Target="worksheets/sheet'+(i+1)+'.xml"/>').join('')+'</Relationships>'};
 names.forEach((n,i)=>files['xl/worksheets/sheet'+(i+1)+'.xml']=sheetXml(sheets[n]));return makeZip(files);}
module.exports={makeXlsx,makeZip};
