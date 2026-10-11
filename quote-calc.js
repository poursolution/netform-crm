/* 견적 원가계산 — 서버·PC·모바일이 같이 쓰는 계산 함수 한 곳 (2026-10-11 design_handoff_quote_v3 6단계 2)
   엑셀 '일위대가표 → 산출내역서 → 집계표 → 원가계산서'와 같은 순서 · 같은 절삭(항목마다 INT, 끝에 10만원 아래 절삭).
   화면이 따로 계산하지 않는다 — 입력(수량 · 일위대가 줄 · 요율)만 받아 결과 표를 돌려주는 순수 함수.
   · 노임 · 요율은 업로드한 기준(적용일 버전)에서 가져와 넣는다(이 파일은 값을 갖지 않는다 — DEFAULT_RATES 는 대조용 기본 구성).
   · 일반관리비율 · 이윤율은 정해진 요율이 없다 — 금액 맞추기용 입력(대표 2026-10-11). 비우면 0.
   · 건강 · 연금 · 요양보험료는 '1개월 이상' 옵션(health) · 퇴직공제부금비는 6개월 이하 제외(retire). */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.QuoteCalc=api;})(typeof window==='undefined'?globalThis:window,function(){
 'use strict';
 const INT=n=>Math.floor(Math.round(n*1e6)/1e6);/* 엑셀 INT: 부동소수 잡음 제거 후 내림 */
 const n0=v=>{const n=Number(v);return Number.isFinite(n)?n:0;};
 /* 원가계산서 항목 요율(엑셀 G칸) — 업로드한 제비율 기준으로 덮어쓴다 */
 const DEFAULT_RATES=Object.freeze({indirectLabor:0.175,accident:0.0356,employment:0.0101,health:0.03595,pension:0.0475,care:0.1314,safety:0.0311,asbestos:0.00006,wageClaim:0.0009,otherExp:0.05,environment:0.003,retire:0.023});
 /* 건강 · 연금 · 요양보험료: 공사기간 1개월(30일) 미만이면 뺀다, 그 외에는 넣는다(대표 2026-10-11). 직접 지정(health)이 있으면 그대로. 퇴직공제부금비는 거의 제외 — retire:true 로 켠 때만 */
 function healthApplies(i){if(typeof i.health==='boolean')return i.health;const d=Number(i.durationDays);return Number.isFinite(d)&&i.durationDays!==''&&i.durationDays!=null?d>=30:true;}
 /* 적용일 버전 고르기: 견적일(YYYY-MM-DD) 이전 시행일 중 가장 늦은 것. 노임은 '지금 = 2026.9.1 열' */
 function pickEffective(list,date,key){key=key||'effective_from';const L=(list||[]).filter(x=>x&&String(x[key]||'')<=String(date||'9999-12-31')).sort((a,b)=>String(b[key]).localeCompare(String(a[key])));return L[0]||null;}
 /* 자재 단가 = 단가표 포장 단가 ÷ 포장 수량 → 100원 단위 올림(엑셀 ROUNDUP(x,-2), 대표 2026-10-11: 50원이 아니라 100원 단위로 관리) */
 function materialUnit(packPrice,packSize,step){step=step||100;const p=n0(packPrice),s=n0(packSize);if(!(p>0)||!(s>0))return 0;return Math.ceil(Math.round(p/s*1e6)/1e6/step)*step;}
 /* 일위대가 1㎡(또는 단위당) 계산: 줄 {kind:'mat'|'lab'|'exp'|'misc', qty, price, pct} → 재료비 · 노무비 · 경비 단가 */
 function unitCost(lines){
  let mat=0,lab=0,exp=0;const rows=[];
  for(const l of lines||[]){
   if(l.kind==='misc')continue;
   const amt=INT(n0(l.price)*n0(l.qty));
   if(l.kind==='mat')mat+=amt;else if(l.kind==='lab')lab+=amt;else exp+=amt;
   rows.push({name:l.name,kind:l.kind,amount:amt});
  }
  for(const l of lines||[]){/* 잡재료비(재료비 n%) · 공구손료(노무비 n%) = 경비 */
   if(l.kind!=='misc')continue;
   const base=l.of==='lab'?lab:mat,amt=INT(base*n0(l.pct));exp+=amt;rows.push({name:l.name,kind:'misc',amount:amt});
  }
  return {mat,lab,exp,rows};
 }
 /* 원가계산서. input: {area, lines|unit:{mat,lab,exp}, rates, generalPct, profitPct, retire:boolean(기본 false), health:boolean(기본 = durationDays>=30, 없으면 true), durationDays} */
 function costSheet(input){
  const u=input.unit||unitCost(input.lines),area=n0(input.area);
  return fromDirect(Object.assign({},input,{mat:INT(u.mat*area),lab:INT(u.lab*area),exp:INT(u.exp*area),unit:u}));
 }
 /* 직접공사비 합계(재료 · 노무 · 경비)에서 바로 원가계산서 — 엑셀을 올렸을 때 '항목별 재계산 = 공급가액' 확인에도 같은 산식을 쓴다 */
 function fromDirect(input){
  const R=Object.assign({},DEFAULT_RATES,input.rates||{}),u=input.unit||{mat:0,lab:0,exp:0};
  const E8=n0(input.mat),E9=n0(input.lab),E12=n0(input.exp);
  const E10=INT(E9*R.indirectLabor),E11=E9+E10;
  const E13=INT(E11*R.accident),E14=INT(E11*R.employment);
  const hl=healthApplies(input);const E15=hl?INT(E9*R.health):0,E16=hl?INT(E9*R.pension):0,E17=hl?INT(E15*R.care):0;
  const E18=INT((E8+E9)*R.safety),E19=INT(E11*R.asbestos),E20=INT(E11*R.wageClaim);
  const E21=INT((E8+E11)*R.otherExp),E22=INT((E8+E9+E12)*R.environment);
  const E23=input.retire?INT(E9*R.retire):0;
  const E24=E12+E13+E14+E15+E16+E17+E18+E19+E20+E21+E22+E23,E25=E8+E11+E24;
  const E26=INT(E25*n0(input.generalPct)),E27=INT((E11+E24+E26)*n0(input.profitPct));
  const E28=E25+E26+E27,E30=Math.floor(E28/100000)*100000;
  return {directMaterial:E8,directLabor:E9,indirectLabor:E10,labor:E11,expense:E12,accident:E13,employment:E14,health:E15,pension:E16,care:E17,safety:E18,asbestos:E19,wageClaim:E20,otherExp:E21,environment:E22,retire:E23,subtotalC:E24,sum:E25,general:E26,profit:E27,supply:E28,rounding:E30-E28,base:E30,unit:{mat:u.mat,lab:u.lab,exp:u.exp}};
 } return {INT,DEFAULT_RATES,fromDirect,healthApplies,pickEffective,materialUnit,unitCost,costSheet};
});
