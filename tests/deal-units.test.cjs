'use strict';
/* 관리 단위(units.js · design_handoff_units): 영업건 단위 값 · 추정 표시 · 집계 대조(회사 = 영업건 1번 · 개인 = 주담당 · 지원자는 금액 합산 X) · 서버 SQL 허용 목록 */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),read=f=>fs.readFileSync(path.join(root,f),'utf8');
const g=globalThis;g.G={};g.B={deals:[]};g.CRMRules=require('../ops-rules.js');
g.repN=v=>String(v||'').trim();g.normSite=s=>String(s||'').replace(/\s+/g,'').toLowerCase();g.dealStage=d=>d.code||'first_contact';g.stageLabel=c=>({first_contact:'1차 접촉',won:'수주',lost:'실주',construction:'계약 · 시공'})[c]||c;
g.oppAmt=d=>Number(d.amt||0)||0;g.itemPatch=()=>({});g.actionObj=(d)=>d.nextActionObj||null;g.siteContacts=d=>d.contacts||[];g.dealWorkSummary=d=>d.work||'';g.isOpen=d=>!/won|lost/.test(String(d.code||''));g.outcomeOf=d=>d.code==='won'?'won':d.code==='lost'?'lost':'open';g.fmtAmt=n=>n+'원';
const U=require('../units.js');
const win=(brand,amt,owner)=>({win_status:'confirmed',won_type:'own',award_amount:amt,award_date:'2026-09-01',sales_channel_brand:brand,performance_owner:owner,inflow_brand:'석민이앤씨'});
test('영업건 단위 값: 책임자 = 다음 행동 담당 · 브랜드 3종 추정 · 참여는 주담당 밖 사람만 · 같은 현장 다른 영업건은 따로',()=>{
 const A={id:'a1',site:'햇빛마을23단지',site_id:'s1',code:'won',amt:4.2e8,brand:'POUR공법',assignee:'이필선',work:'옥상방수',win:win('POUR공법',4.2e8,'이필선'),nextActionObj:{text:'시공 인계 확인',assignee:'박현우'},activities:[{id:1},{id:2}],contacts:[{name:'김정훈'}]};
 const Bd={id:'b1',site:'햇빛마을23단지',site_id:'s1',code:'first_contact',amt:3.1e8,brand:'POUR솔루션',assignee:'이필선',work:'재도장',activities:[{id:3}]};
 g.B.deals=[A,Bd];
 const ua=U.unit(A),ub=U.unit(Bd);
 assert.equal(ua.responsible,'박현우','책임자 = 다음 행동의 담당 1명');assert.equal(ub.responsible,'이필선','다음 행동이 없으면 영업건 담당');
 assert.deepEqual([ua.brand.inflow,ua.brand.proposal,ua.brand.contract,ua.brand.saved],['석민이앤씨','POUR공법','POUR공법',false],'수주 건: 유입 = 수주 기록의 유입 브랜드 · 계약 = 영업 경로 브랜드 · 저장 전 = 추정');
 assert.deepEqual([ub.brand.inflow,ub.brand.proposal,ub.brand.contract],['POUR솔루션','POUR솔루션',''],'진행 건은 계약 브랜드 미정');
 assert.equal(ua.roles.main,'이필선');assert.deepEqual(ua.roles.list,[]);assert.equal(ua.roles.saved,false);
 assert.equal(ua.site.siblings.length,1);assert.equal(ua.site.acts,3,'연락 이력은 현장 공통(같은 현장 영업건 전체)');assert.equal(ua.site.contacts,1);
 assert.equal(ua.work,'옥상방수');assert.equal(ub.work,'재도장');
 /* ② 연결: 영업건 꼬리표 · 신규 판정(같은 현장에 먼저 생긴 영업건이 있으면 same_site · 아니면 new_site) */
 A.created='2025-11-20';Bd.created='2026-06-10';assert.equal(U.tagOf(A),'2025 옥상방수');assert.equal(U.tagOf(Bd),'2026 재도장');
 assert.equal(U.newness(A),'new_site');assert.equal(U.newness(Bd),'same_site');assert.deepEqual(U.newCounts([A,Bd]),{deals:2,sites:1},'신규 영업건 2 · 신규 현장 1');
 /* 저장된 값이 있으면 그대로(주담당은 역할 목록에 들어오지 않는다) */
 U.take({deal_id:'a1',roles:[{name:'한준엽',role:'지원'},{name:'박현우',role:'시공 담당'},{name:'이필선',role:'지원'},{name:'아무나',role:'사장'}],brand_inflow:'석민이앤씨',brand_proposal:'POUR공법',brand_contract:'POUR공법'});
 const r=U.roles(A);assert.deepEqual(r.list,[{name:'한준엽',role:'지원'},{name:'박현우',role:'시공 담당'}]);assert.equal(r.saved,true);assert.equal(U.brand3(A).saved,true);
 const hs=U.handoverSummary(A);assert.deepEqual(hs.map(x=>x[0]),['공사 범위','제외 사항','금액','일정','고객 약속']);assert.match(hs[0][1],/옥상방수/);assert.equal(hs[2][1],'미기록','계약 정보가 없으면 미기록(만들어 넣지 않음)');
});
test('집계 대조: 회사 수주실적 = 영업건 단위 1번 · 개인 = 주담당 · 지원자는 기여 표시만(금액 합산 X)',()=>{
 const A={id:'a1',site:'A',site_id:'s1',code:'won',amt:4.2e8,brand:'POUR공법',assignee:'이필선',win:win('POUR공법',4.2e8,'이필선')};
 const C={id:'c1',site:'C',site_id:'s2',code:'won',amt:1e8,brand:'POUR솔루션',assignee:'황윤선',win:win('POUR솔루션',1e8,'황윤선')};
 const L={id:'l1',site:'L',site_id:'s3',code:'lost',amt:9e8,brand:'POUR솔루션',assignee:'이필선'};
 g.B.deals=[A,C,L];U.take({deal_id:'a1',roles:[{name:'한준엽',role:'지원'}]});
 const co=U.companySum(g.B.deals);assert.deepEqual(co,{n:2,sum:5.2e8},'실주 · 지원자 금액은 더하지 않음 · 영업건마다 1번');
 const p=U.personal(g.B.deals);assert.deepEqual(p.get('이필선'),{n:1,sum:4.2e8,support:0});assert.deepEqual(p.get('황윤선'),{n:1,sum:1e8,support:0});assert.deepEqual(p.get('한준엽'),{n:0,sum:0,support:1},'지원자 = 기여 표시만');
 assert.equal([...p.values()].reduce((s,x)=>s+x.sum,0),co.sum,'개인 합 = 회사 합(두 번 세지 않음)');
 /* ④ 집계 단위 한 줄: 진행 중은 영업건마다 · 같은 현장 2건 이상은 각각 · 붙인 재문의는 신규 아님 */
 const O1={id:'o1',site:'S1',site_id:'s9',code:'first_contact',amt:1,brand:'POUR솔루션',assignee:'이필선'},O2={id:'o2',site:'S1',site_id:'s9',code:'rapport',amt:1,brand:'POUR솔루션',assignee:'이필선'},O3={id:'o3',site:'S2',site_id:'s8',code:'first_contact',amt:1,brand:'POUR솔루션',assignee:'황윤선'};
 const au=U.audit([A,C,L,O1,O2,O3],[{raw:{'기존 현장 판단':'같은 공사','기존 영업건':'o1'}},{raw:{'기존 현장 판단':'새 공사'}},{}]);
 assert.deepEqual([au.open,au.sites,au.multi,au.attached,au.won,au.wonSum],[3,2,1,1,2,5.2e8]);assert.match(au.line,/^집계 단위 = 영업건: 진행 중 3건 · 현장 2곳\(같은 현장 2건 이상 1곳은 각각 센다\) · 같은 영업건에 붙인 재문의 1건은 신규로 안 셈 · 수주실적은 영업건마다 1번/);
});
test('서버 함수 · 허용 목록 · 오류 이름 · 요청 엔진 수령 확인',()=>{
 const sql=read('sql/deal-units-v1-20261010.sql'),tr=read('pc-manager-transport.js'),es=read('pc-error-state.js');
 ['crm_deal_unit_save_v1','crm_deal_unit_list_v1'].forEach(n=>{assert.match(sql,new RegExp('function public\\.'+n+'\\(jsonb'));assert.match(tr,new RegExp("'"+n+"'"));assert.match(es,new RegExp(n+':'));});
 assert.match(sql,/allowed constant text\[\]:=array\['지원','외부영업','관리','시공 담당'\]/);assert.deepEqual([...U.ROLES],['지원','외부영업','관리','시공 담당']);assert.equal(U.MAIN,'주담당');
 assert.doesNotMatch(sql,/(update|insert into|delete from) (public\.deals|public\.crm_deal_owners|crm_security\.contract_sales|public\.next_actions|crm_security\.work_requests)\b/,'영업건 · 귀속 · 계약실적 · 다음 행동 · 요청은 건드리지 않는다');
 assert.match(read('work-request.js'),/RECEIPT_LABEL='시공 인계 수령 확인'/);assert.equal(U.RECEIPT_LABEL,'시공 인계 수령 확인');
 assert.match(read('deal-detail-v3.js'),/root\.DealUnits&&root\.DealUnits\.mount\((r|host),d,closed\)/);assert.match(read('asset-v2.js'),/root\.DealUnits\.assetLine\(d\)/);
 assert.match(read('deal-owner-v2.js'),/'고객 요구: '|'남은 약속: '|'자료: '/);
 const html=read('crm.html');assert.ok(html.indexOf('deal-owner-v2.js?v=')<html.indexOf('units.js?v='),'units.js 는 deal-owner-v2.js 뒤');
});
