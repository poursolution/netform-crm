/* 원가 기준 읽기 · 비교 · 승인 점검 · 견적 적용 (2026-10-11 design_handoff_quote_v3 3번 '원가 기준 관리' · 작업 순서 5)
   변경될 때마다 파일을 올린다(대표 2026-10-11) → 정해진 칸에서 읽고 → 이전 값과 비교 → 승인(시행일) → 그 시행일에 맞는 견적의 원가계산서 · 노임에 적용.
   · 원가 요율: 조달청 '간접공사비(제비율) 적용기준' xlsx (시트 1개, 적용시기 B2)
   · 노임: 대한건설협회 '임금실태 조사표' PDF (공표일 열 4개) — PDF 글자 조각(x · y)을 줄로 묶어 읽는다
   · 자재 단가: 통합관리표 xlsx 의 '단가표(개인)' 시트 (왼쪽 · 오른쪽 두 묶음)
   읽기만 한다 — 저장 · 승인은 서버 함수(crm_cost_standard_*_v1). 요율은 분수(3.595% → 0.03595)로 저장한다.
   파일에서 찾지 못한 값(고용보험료)은 지어내지 않고 manual 로 표시해 직접 입력 · 출처 입력 없이는 승인할 수 없다. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.QuoteStandards=api;})(typeof window==='undefined'?globalThis:window,function(){
 'use strict';
 const SIZES=['10억 미만','10억 - 50억 미만','50억 - 300억 미만','300억 - 1000억 미만','1000억 이상'];
 const norm=s=>String(s==null?'':s).replace(/\s+/g,' ').trim();
 const compact=s=>norm(s).replace(/\s*-\s*/g,' - ');
 const frac=pct=>Math.round(Number(pct)*1e8/100)/1e8;
 const txt=(c,ref)=>{const v=c[ref];return v==null?'':norm(v);};
 const numAt=(c,ref)=>{const v=c[ref];if(typeof v==='number')return v;const n=Number(String(v==null?'':v).replace(/,/g,''));return Number.isFinite(n)&&String(v).trim()!==''?n:null;};
 const rowOf=ref=>+String(ref).match(/\d+/)[0],colOf=ref=>String(ref).match(/^[A-Z]+/)[0];
 const iso=(y,m,d)=>String(y)+'-'+String(m).padStart(2,'0')+'-'+String(d).padStart(2,'0');
 /* ---------- 원가 요율 (조달청 제비율) ---------- */
 function parseCostRates(cells){
  const c=cells||{},items=[],notes=[];
  const head=txt(c,'B2'),dm=head.match(/(\d{4})\.\s*(\d{1,2})\.\s*(\d{1,2})/);
  const effective=dm?iso(dm[1],dm[2],dm[3]):'';
  const source='조달청 간접공사비(제비율) 적용기준'+(head?' · '+head.replace(/^※\s*/,''):'');
  const add=o=>items.push(Object.assign({tier:'',fixed_amount:0,manual:false,source,effective_from:effective},o,o.manual?{source:''}:{}));/* 파일에 숫자가 없는 항목은 출처도 파일이 아니다 — 비워 두고 직접 입력하게 한다 */
  /* 간접노무비(AC) · 기타경비(AL): 공사규모 × 공사기간 — 건축 */
  let size='';
  for(let r=13;r<=60;r++){
   const b=txt(c,'B'+r);if(b&&/억/.test(b))size=compact(b);
   const m=txt(c,'M'+r);if(!size||!/개월/.test(m))continue;
   const period=m.replace(/\(.*?\)/g,'').replace(/\s+/g,' ').trim(),tier=size+'|'+period;
   const a=numAt(c,'AC'+r),e=numAt(c,'AL'+r);
   if(a!=null)add({item:'간접노무비',tier,category:'needs_check',base_of:'직접노무비',rate:frac(a)});
   if(e!=null)add({item:'기타경비',tier,category:'needs_check',base_of:'재료비+노무비',rate:frac(e)});
  }
  /* 머리 칸 아래에서 '… x 값' 읽기 */
  const labelVal=(label,baseDefault)=>{
   const hit=Object.keys(c).find(k=>txt(c,k)===label);if(!hit)return null;
   const col=colOf(hit),r0=rowOf(hit);
   for(let r=r0+1;r<=r0+6;r++){const t=txt(c,col+r),m=t.match(/^\((.+?)\)\s*x\s*(\d+(?:\.\d+)?)\s*$/);if(m)return {pct:Number(m[2]),base:m[1]};if(/^\(.+\)\s*x\s*율\s*$/.test(t))return {pct:null,base:t.match(/^\((.+?)\)/)[1]};}
   return {pct:null,base:baseDefault||''};
  };
  const BASE={'직노':'직접노무비','노':'노무비','직접공사비':'직접공사비','건강보험료':'건강보험료'};
  const FIXED=[['산재보험료','[산재보험료]','statutory'],['건강보험료','[건강보험료]','statutory'],['노인장기요양보험료','[노인장기요양보험료]','statutory'],['연금보험료','[연금보험료]','statutory'],['석면분담금','[석면분담금]','statutory'],['임금채권부담금','[임금채권부담금]','statutory'],['퇴직공제부금비','[퇴직공제부금비]','statutory'],['고용보험료','[고용보험료]','statutory']];
  for(const [item,label,category] of FIXED){
   const v=labelVal(label,'노무비');
   if(!v){notes.push(item+': 파일에서 머리 칸 "'+label+'"을 찾지 못했습니다');add({item,category,base_of:'',rate:null,manual:true});continue;}
   add({item,category,base_of:BASE[v.base]||v.base,rate:v.pct==null?null:frac(v.pct),manual:v.pct==null});
  }
  /* 환경보전비: 공사 종류별 표(AU 이름 · BT 요율) */
  for(let r=66;r<=96;r++){const nm=txt(c,'AU'+r),v=numAt(c,'BT'+r);if(nm&&v!=null&&v>0&&!/^\*|구분|요율/.test(nm))add({item:'환경보전비',tier:nm,category:'needs_check',base_of:'직접공사비',rate:frac(v)});}
  /* 산업안전보건관리비: 대상액 구간(DJ) × 공사 종류(EA) — 요율(ER) + 기초액(EZ 천원) */
  let band='',big='';
  for(let r=17;r<=52;r++){
   const d=txt(c,'DJ'+r);if(d&&/억/.test(d)&&r<=50&&/^\d+억|^5억/.test(d.replace(/\s+/g,'')))band=d.replace(/\s+/g,'').replace('~','~');
   const q=txt(c,'DQ'+r);if(q&&/800억/.test(q))big=/미만/.test(q)?'800억 미만':'800억 이상';
   const kind=txt(c,'EA'+r),rate=numAt(c,'ER'+r);
   if(!/^(건축|토목|중건설|특수건설)공사$/.test(kind)||rate==null)continue;
   const fx=numAt(c,'EZ'+r);
   add({item:'산업안전보건관리비',tier:[band,big&&band==='50억이상'?big:'',kind].filter(Boolean).join('|'),category:'statutory',base_of:'재료비+직접노무비',rate:frac(rate),fixed_amount:fx?fx*1000:0});
  }
  return {kind:'cost',effective_from:effective,source,items,notes};
 }
 /* ---------- 노임 (임금실태 조사표 PDF) ---------- */
 const dateKey=s=>{const m=String(s).match(/^(\d{4})\.(\d{1,2})\.(\d{1,2})$/);return m?iso(m[1],m[2],m[3]):'';};
 function parseWageRows(pages){
  const rows=[],dates=new Set(),notes=[];
  (pages||[]).forEach((items,pi)=>{
   const groups=[];
   for(const it of items.slice().sort((a,b)=>b.y-a.y||a.x-b.x)){const g=groups.find(x=>Math.abs(x.y-it.y)<=2.2);if(g)g.items.push(it);else groups.push({y:it.y,items:[it]});}
   let cols=[];
   for(const g of groups){const ds=g.items.filter(i=>dateKey(i.s));if(ds.length>=2){cols=ds.map(i=>({x:i.x,date:dateKey(i.s)})).sort((a,b)=>a.x-b.x);cols.forEach(c=>dates.add(c.date));}}
   if(!cols.length){notes.push((pi+1)+'쪽: 공표일 머리 줄을 찾지 못해 건너뜀');return;}
   for(const g of groups){
    const its=g.items.sort((a,b)=>a.x-b.x),first=its[0];
    const noTok0=its.find(i=>/^\*{0,2}\d{4}$/.test(i.s)&&i.x<110);if(!noTok0)continue;
    const star=(noTok0.s.match(/^\*+/)||[''])[0],noTok={s:noTok0.s.replace(/^\*+/,''),x:noTok0.x};
    const name=its.filter(i=>i.x>noTok.x+4&&i.x<cols[0].x-4&&!/^\*+$/.test(i.s)).map(i=>i.s).join('').replace(/\s+/g,'').replace(/^\*+/,'');
    if(!name)continue;
    const wages={};
    for(const i of its){if(i.x<cols[0].x-4)continue;const v=/^[\d,]+$/.test(i.s)?Number(i.s.replace(/,/g,'')):(i.s==='-'?null:undefined);if(v===undefined)continue;
     const col=cols.reduce((b,c)=>Math.abs(c.x+12-i.x)<Math.abs(b.x+12-i.x)?c:b);wages[col.date]=v;}
    rows.push({trade_no:noTok.s,trade:name,mark:star,wages});
   }
  });
  return {kind:'labor',dates:[...dates].sort().reverse(),rows,notes};
 }
 /* 노임 행 → 저장 행(공표일마다 한 줄, '-' 는 건너뜀) */
 function wageToRows(parsed,source){const out=[];for(const r of parsed.rows)for(const d of parsed.dates){const w=r.wages[d];if(w>0)out.push({trade_no:r.trade_no,trade:r.trade,daily_wage:w,effective_from:d,source});}return out;}
 /* ---------- 자재 단가 (통합관리표 '단가표(개인)') ---------- */
 function packOf(spec,unitTxt){
  if(typeof spec==='number')return spec;const s=norm(spec);if(!s)return null;
  if(/^[\d.]+$/.test(s))return Number(s);
  const m=s.match(/\*\s*([\d.]+)\s*m\b/i);if(m)return Number(m[1]);
  return null;
 }
 function parseMaterialPrices(cells){
  const c=cells||{},items=[],notes=[];
  const head=txt(c,'A1'),dm=head.match(/(\d{4})\.(\d{1,2})\.(\d{1,2})/);
  const price_date=dm?iso(dm[1],dm[2],dm[3]):'';
  const source=head||'통합관리표 단가표(개인)';
  const blocks=[['A','B','C','D'],['G','H','I','J']];
  const maxRow=Math.max(...Object.keys(c).map(rowOf));
  for(let r=4;r<=maxRow;r++)for(const [n,s,u,p] of blocks){
   const name=txt(c,n+r),price=numAt(c,p+r);if(!name||price==null||/판매 단가/.test(txt(c,p+r)))continue;
   if(!(price>0)){notes.push(name+': 단가가 비어 있어 건너뜀('+(txt(c,String.fromCharCode(p.charCodeAt(0)+1)+r)||'0')+')');continue;}
   const spec=txt(c,s+r),unit=txt(c,u+r);
   items.push({item:name,spec:spec+(typeof c[s+r]==='number'?'':''),unit,pack_size:packOf(c[s+r],unit),unit_price:price,price_date,source});
  }
  return {kind:'material',price_date,source,items,notes};
 }
 /* ---------- 이전 값과 비교 (승인 전 확인) ---------- */
 const keyOf={labor:r=>r.trade,cost:r=>r.item+'|'+(r.tier||''),material:r=>r.item+'|'+(r.spec||'')};
 const valOf={labor:r=>r.daily_wage,cost:r=>r.rate,material:r=>r.unit_price};
 const labelOf={labor:r=>r.trade,cost:r=>r.item+(r.tier?' · '+r.tier:''),material:r=>r.item+(r.spec?' · '+r.spec:'')};
 /* 같은 항목의 '지금 쓰는 값' = 시행일이 새 기준 시행일 이전인 것 중 가장 늦은 것(초안 제외) */
 function latestBefore(kind,rows,key,date){
  const dk=kind==='material'?'price_date':'effective_from';
  return (rows||[]).filter(r=>r.status!=='draft'&&keyOf[kind](r)===key&&String(r[dk]||'')<=String(date||'9999')).sort((a,b)=>String(b[dk]).localeCompare(String(a[dk])))[0]||null;
 }
 function diff(kind,staged,current){
  const dk=kind==='material'?'price_date':'effective_from';
  return staged.map(n=>{
   const key=keyOf[kind](n),prev=latestBefore(kind,current,key,n[dk]),pv=prev?valOf[kind](prev):null,nv=valOf[kind](n);
   const change=pv==null?'new':nv==null?'blank':Number(pv)===Number(nv)?'same':Number(nv)>Number(pv)?'up':'down';
   return {key,label:labelOf[kind](n),prev:pv,next:nv,change,pct:pv>0&&nv!=null?Math.round((nv/pv-1)*10000)/100:null,row:n};
  });
 }
 /* ---------- 승인 점검 ---------- */
 function approvalProblems(kind,rows,effective){
  const p=[];
  if(!rows||!rows.length)p.push('승인할 항목이 없습니다');
  if(!/^\d{4}-\d{2}-\d{2}$/.test(String(effective||'')))p.push('시행일을 정해 주세요');
  const noSrc=(rows||[]).filter(r=>!norm(r.source));if(noSrc.length)p.push('출처가 없는 항목 '+noSrc.length+'개 — 출처 없이는 승인할 수 없습니다');
  const pending=(rows||[]).filter(r=>(kind==='cost'&&(r.rate==null||!(r.rate>=0)))||(kind==='labor'&&!(r.daily_wage>0))||(kind==='material'&&!(r.unit_price>0)));
  if(pending.length)p.push('값이 비어 있는 항목 '+pending.length+'개: '+pending.slice(0,5).map(r=>labelOf[kind](r)).join(', ')+(pending.length>5?' …':''));
  return p;
 }
 /* ---------- 견적에 적용: 견적일에 맞는 승인 기준 고르기 ---------- */
 function pickByDate(kind,rows,key,date){return latestBefore(kind,rows,key,date);}
 const CALC_ITEMS={indirectLabor:'간접노무비',accident:'산재보험료',employment:'고용보험료',health:'건강보험료',pension:'연금보험료',care:'노인장기요양보험료',safety:'산업안전보건관리비',asbestos:'석면분담금',wageClaim:'임금채권부담금',otherExp:'기타경비',environment:'환경보전비',retire:'퇴직공제부금비'};
 const DEFAULT_TIER={size:'10억 미만',period:'6개월 이하',safety:'5억미만|건축공사',env:'조경, 기타(전문, 개보수 공사)'};
 /* QuoteCalc 의 요율 객체로. missing = 그 날짜에 승인된 값이 없는 항목(견적에 쓰기 전에 기준 담당이 올려야 함) */
 function toCalcRates(costRows,date,opt){
  const o=Object.assign({},DEFAULT_TIER,opt||{}),rates={},missing=[],basis={};
  for(const [k,item] of Object.entries(CALC_ITEMS)){
   const tier=item==='간접노무비'||item==='기타경비'?o.size+'|'+o.period:item==='산업안전보건관리비'?o.safety:item==='환경보전비'?o.env:'';
   const row=pickByDate('cost',costRows,item+'|'+tier,date);
   if(!row){missing.push(item+(tier?' · '+tier:''));continue;}
   rates[k]=Number(row.rate);basis[k]=row.effective_from;
  }
  return {rates,missing,basis};
 }
 function wageOn(laborRows,trade,date){const r=pickByDate('labor',laborRows,trade,date);return r?Number(r.daily_wage):null;}
 return {SIZES,DEFAULT_TIER,CALC_ITEMS,frac,parseCostRates,parseWageRows,wageToRows,parseMaterialPrices,diff,latestBefore,approvalProblems,toCalcRates,wageOn,keyOf,labelOf};
});
