/* 견적서 엑셀 올리기 · 정해진 칸에서 읽기 · 자동 확인 5가지 (2026-10-11 design_handoff_quote_v3 3-4 · 작업 순서 3)
   15개 견적서 엑셀이 같은 6시트 구조 — 갑지(또는 안내사항) · 원가계산서 · 집계표 · 일위대가표 · 산출내역서 · (자재단가).
   읽는 칸: 집계표 F · H · J · L 합계(28행) · 원가계산서 E8~E30 · 요율 G10~G27 · 갑지 D6(견적일) · D10(공사명) · H23(회사).
   이 파일은 읽고 확인만 한다 — 저장 · 화면은 다음 단계. 금액 계산은 QuoteCalc 와 같은 산식(fromDirect).
   zip 풀기는 브라우저의 DecompressionStream('deflate-raw'), 시험에서는 inflate 를 넣어 준다. */
(function(root,factory){const api=factory(root);if(typeof module==='object'&&module.exports)module.exports=api;else root.QuoteExcel=api;})(typeof window==='undefined'?globalThis:window,function(root){
 'use strict';
 const td=new TextDecoder('utf-8');
 /* ---- zip ---- */
 async function defaultInflate(u8){const ds=new DecompressionStream('deflate-raw'),w=ds.writable.getWriter();w.write(u8);w.close();return new Uint8Array(await new Response(ds.readable).arrayBuffer());}
 async function unzip(buf,inflate){
  inflate=inflate||defaultInflate;const u8=buf instanceof Uint8Array?buf:new Uint8Array(buf),dv=new DataView(u8.buffer,u8.byteOffset,u8.byteLength);
  let e=-1;for(let i=u8.length-22;i>=Math.max(0,u8.length-65558);i--){if(dv.getUint32(i,true)===0x06054b50){e=i;break;}}
  if(e<0)throw new Error('엑셀(xlsx) 파일이 아닙니다');
  const n=dv.getUint16(e+10,true);let p=dv.getUint32(e+16,true);const out={};
  for(let k=0;k<n;k++){
   if(dv.getUint32(p,true)!==0x02014b50)throw new Error('엑셀 파일이 손상되었습니다');
   const method=dv.getUint16(p+10,true),cs=dv.getUint32(p+20,true),nl=dv.getUint16(p+28,true),xl=dv.getUint16(p+30,true),cl=dv.getUint16(p+32,true),lo=dv.getUint32(p+42,true);
   const name=td.decode(u8.subarray(p+46,p+46+nl));p+=46+nl+xl+cl;
   if(!/^xl\/(workbook\.xml|_rels\/workbook\.xml\.rels|sharedStrings\.xml|worksheets\/[^/]+\.xml)$/.test(name))continue;
   const ln=dv.getUint16(lo+26,true),lx=dv.getUint16(lo+28,true),data=u8.subarray(lo+30+ln+lx,lo+30+ln+lx+cs);
   out[name]=td.decode(method===0?data:await inflate(data));
  }
  return out;
 }
 /* ---- xml ---- */
 const unesc=s=>String(s).replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&apos;/g,"'").replace(/&amp;/g,'&');
 function parseBook(files){
  const wb=files['xl/workbook.xml'];if(!wb)throw new Error('엑셀(xlsx) 파일이 아닙니다');
  const rels=files['xl/_rels/workbook.xml.rels']||'';
  const ss=files['xl/sharedStrings.xml']?[...files['xl/sharedStrings.xml'].matchAll(/<si>([\s\S]*?)<\/si>/g)].map(m=>unesc([...m[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map(x=>x[1]).join(''))):[];
  const relOf=id=>{const m=rels.match(new RegExp('<Relationship[^>]*Id="'+id+'"[^>]*>'));const t=m&&m[0].match(/Target="([^"]*)"/);return t?('xl/'+t[1].replace(/^\//,'').replace(/^xl\//,'')):'';};
  const sheets={};
  for(const m of wb.matchAll(/<sheet [^>]*>/g)){
   const nm=m[0].match(/name="([^"]*)"/),id=m[0].match(/r:id="([^"]*)"/);if(!nm||!id)continue;
   const xml=files[relOf(id[1])];if(!xml)continue;const cells={};
   for(const c of xml.matchAll(/<c r="([A-Z]+\d+)"([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)){
    const body=c[3]||'',v=body.match(/<v>([\s\S]*?)<\/v>/),is=body.match(/<is>([\s\S]*?)<\/is>/),f=body.match(/<f[^>]*>([\s\S]*?)<\/f>/);
    let val;if(is)val=unesc([...is[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map(x=>x[1]).join(''));
    else if(v)val=/t="s"/.test(c[2])?ss[+v[1]]:/t="(str|e|b)"/.test(c[2])?unesc(v[1]):Number(v[1]);
    if(val!==undefined)cells[c[1]]={v:val,f:f?unesc(f[1]):''};
   }
   sheets[unesc(nm[1]).trim()]=cells;
  }
  return sheets;
 }
 const val=(sh,ref)=>sh&&sh[ref]?sh[ref].v:undefined;
 const num=(sh,ref)=>{const v=val(sh,ref);return typeof v==='number'?v:Number.isFinite(Number(v))&&v!==''&&v!=null?Number(v):0;};
 const txt=(sh,ref)=>{const v=val(sh,ref);return v==null?'':String(v).replace(/\s+/g,' ').trim();};
 /* 엑셀 날짜 숫자(1900 체계) → YYYY-MM-DD. 엑셀의 1900-02-29 오류 때문에 60 이상은 하루를 뺀다 */
 function excelDate(n){n=Number(n);if(!(n>=1))return '';const ms=Date.UTC(1899,11,30)+Math.floor(n)*86400000;return new Date(ms).toISOString().slice(0,10);}
 const ROW_FROM=5,ROW_TO=27;
 /* ---- 정해진 칸에서 읽기 ---- */
 function readQuote(sheets){
  const cover=sheets['갑지']||sheets['안내사항']||null,W=sheets['원가계산서'],G=sheets['집계표'],S=sheets['산출내역서'];
  const out={sheets:Object.keys(sheets),cover:{},cost:null,rates:{},summary:null,items:[]};
  if(cover){const isG=!!sheets['갑지'];out.cover={kind:isG?'갑지':'안내사항',date:isG&&typeof val(cover,'D6')==='number'?excelDate(val(cover,'D6')):'',title:txt(W,'B3')||txt(cover,'D10'),amount:isG?0:num(cover,'D10'),company:txt(cover,'H23')};}
  if(W){
   const c={};for(const r of [6,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30])c['E'+r]=num(W,'E'+r);out.cost=c;
   for(const r of [10,13,14,15,16,17,18,19,20,21,22,23,26,27])out.rates['G'+r]=num(W,'G'+r);
   out.flags={health:val(W,'E15')!==undefined&&num(W,'E15')>0,retire:num(W,'E23')>0,noIndirect:val(W,'E10')===undefined&&val(W,'E13')===undefined&&val(W,'E26')===undefined&&val(W,'E27')===undefined};/* 공과잡비X 양식: 간접비 칸이 비어 직접공사비가 곧 공급가액 */
  }
  if(G){
   const rows=[];for(let r=ROW_FROM;r<=ROW_TO;r++){const nm=txt(G,'A'+r);if(!nm||nm==='0')continue;rows.push({row:r,name:nm,qty:num(G,'D'+r),mat:num(G,'F'+r),lab:num(G,'H'+r),exp:num(G,'J'+r),total:num(G,'L'+r)});}
   out.summary={rows,totals:{mat:num(G,'F28'),lab:num(G,'H28'),exp:num(G,'J28'),total:num(G,'L28')}};
  }
  if(S){for(let r=4;r<=60;r++){const nm=txt(S,'A'+r);if(/^\d+\./.test(nm))out.items.push({row:r,name:nm,unit:txt(S,'C'+r),qty:num(S,'D'+r)});}}
  return out;
 }
 /* ---- 자동 확인 5가지 — 각각 pass / fail / skip(확인할 재료가 아직 없음). 최종본 = 전부 pass ---- */
 const REQUIRED=['원가계산서','집계표'];/* 일위대가표 · 산출내역서는 없는 간단 양식도 있다(우레탄 · 도포만 · 후레싱) */
 function check(read,opt){
  opt=opt||{};const Q=opt.calc||(typeof root.QuoteCalc!=='undefined'?root.QuoteCalc:null),res=[];
  const add=(key,label,status,msg)=>res.push({key,label,status,msg:msg||''});
  /* 1 구조 */
  const miss=REQUIRED.filter(n=>!read.sheets.includes(n));if(!read.cover.kind)miss.unshift('갑지(또는 안내사항)');
  add('structure','구조(정해진 시트 · 칸)',miss.length?'fail':(read.cost&&read.summary&&read.summary.rows.length?'pass':'fail'),miss.length?'없는 시트: '+miss.join(', '):(read.summary&&read.summary.rows.length?'':'집계표에 공종이 없습니다'));
  /* 2 고른 공종 수량 > 0 */
  if(read.summary&&read.summary.rows.length){
   /* 이름만 남은 빈 공종 줄(수량도 금액도 0)은 쓰지 않은 줄 — 줄여서 무시한다(대표 2026-10-11). 한쪽만 0이면 막는다 */
   const used=[],unused=[];for(const r of read.summary.rows){const it=read.items.find(i=>i.name===r.name),q=(it?it.qty:0)>0;(!q&&!(r.total>0)&&!(it?false:r.qty>1)?unused:used).push({r,q});}
   read.ignoredRows=unused.map(x=>x.r.name);
   const bad=used.filter(x=>!(x.q||x.r.qty>0)||!(x.r.total>0)).map(x=>x.r.name);
   add('qty','고른 공종 수량 > 0',!used.length?'fail':bad.length?'fail':'pass',!used.length?'고른 공종이 없습니다(모든 줄이 비어 있습니다)':bad.length?'수량 또는 금액이 0인 공종: '+bad.join(', '):(unused.length?'빈 공종 줄 '+unused.length+'개는 쓰지 않은 줄로 보고 뺐습니다':''));
  }else add('qty','고른 공종 수량 > 0','fail','집계표를 읽지 못했습니다');
  /* 3 항목별 재계산 = 공급가액 */
  if(read.cost&&read.summary&&Q){
   const R=read.rates,rate={indirectLabor:R.G10,accident:R.G13,employment:R.G14,health:R.G15,pension:R.G16,care:R.G17,safety:R.G18,asbestos:R.G19,wageClaim:R.G20,otherExp:R.G21,environment:R.G22,retire:R.G23};
   const t=read.summary.totals,calc=Q.fromDirect({mat:t.mat,lab:t.lab,exp:t.exp,rates:rate,generalPct:R.G26,profitPct:R.G27,health:!!read.flags.health,retire:!!read.flags.retire});
   if(read.flags.noIndirect){calc.supply=t.mat+t.lab+t.exp;calc.base=Math.floor(calc.supply/100000)*100000;}
   const ok=calc.supply===read.cost.E28&&calc.base===read.cost.E30&&t.mat===read.cost.E8&&t.lab===read.cost.E9&&t.exp===read.cost.E12;
   add('recalc','항목별 재계산 = 공급가액',ok?'pass':'fail',ok?'':'다시 계산한 공급가액 '+calc.supply.toLocaleString('ko-KR')+'원 ≠ 엑셀 '+read.cost.E28.toLocaleString('ko-KR')+'원');
  }else add('recalc','항목별 재계산 = 공급가액','fail','원가계산서 · 집계표를 읽지 못했습니다');
  /* 4 엑셀 = PDF 금액 */
  if(opt.pdfAmount==null)add('pdf','엑셀 = PDF 금액','skip','PDF 금액이 아직 없습니다');
  else add('pdf','엑셀 = PDF 금액',Number(opt.pdfAmount)===(read.cost&&read.cost.E30)?'pass':'fail',Number(opt.pdfAmount)===(read.cost&&read.cost.E30)?'':'PDF '+Number(opt.pdfAmount).toLocaleString('ko-KR')+'원 ≠ 엑셀 '+((read.cost&&read.cost.E30)||0).toLocaleString('ko-KR')+'원');
  /* 5 요청 공사 종류 = 템플릿 (요청의 공종 낱말이 공사명 · 공종 이름에 있어야) */
  if(!opt.requestedWork)add('template','요청 공사 종류 = 템플릿','skip','견적 요청의 공사 종류가 없습니다');
  else{const hay=[read.cover.title,...(read.summary?read.summary.rows.map(r=>r.name):[]),...read.items.map(i=>i.name)].join(' ');const words=String(opt.requestedWork).split(/[\s,·/]+/).filter(w=>w.length>=2);const hit=words.some(w=>hay.includes(w));add('template','요청 공사 종류 = 템플릿',hit?'pass':'fail',hit?'':'요청 "'+opt.requestedWork+'"와 다른 공사 양식입니다');}
  return {checks:res,canFinal:res.every(c=>c.status==='pass'),failed:res.filter(c=>c.status==='fail').length,pending:res.filter(c=>c.status==='skip').length};
 }
 async function readFile(buf,opt){const sheets=parseBook(await unzip(buf,opt&&opt.inflate));const read=readQuote(sheets);return {read,result:check(read,opt)};}
 return {unzip,parseBook,readQuote,check,readFile,excelDate};
});
