'use strict';
/* 2026-10-22 모바일 초기 로딩: 저장본이 없으면 crm_mobile_today_v1 로 내 오늘 업무를 먼저 그리고 전체 조회가 덮어쓴다 · 함수가 없으면 전체 조회만 · 끄기 */
const {test}=require('node:test');
const assert=require('node:assert/strict');
const overlay=require('../operational-overlay.js');
function page(domain,items){return {contract_version:1,resource:'operational',data:{deals:domain==='deal_core'?items:[],inquiries:domain==='inquiry_core'?items:[],asq_projects:[]}};}
function mobileRoot(read,rpc,G){
 const applied=[];
 const root={TOKEN:'t',ME:{id:'u'},G:G||{},DEALS:[],toast(){},rebuildAdmin(){},render(){applied.push(root.DEALS.map(d=>d.id).join(','));},
  normalizeDeal:d=>d,Phase1:{profile:null,read,rpc,queue:{list:()=>[],flush:async()=>[]}},OperationalAdapter:{},addEventListener(){},document:{getElementById:()=>null}};
 root.setTimeout=()=>1;root.clearTimeout=()=>{};
 overlay.install(root);
 return {root,applied};
}
const full=async(resource,args)=>{const d=args.domains[0];if(d==='deal_core')return page(d,[{id:'D1',site:'현장',stage_code:'consulting'},{id:'D2',site:'현장2',stage_code:'sent'}]);return page(d,[]);};

test('저장본이 없으면 오늘 조회 결과(내 열린 건)를 먼저 그리고, 전체 조회가 뒤에 덮어쓴다',async()=>{
 const calls=[];
 const {root,applied}=mobileRoot(full,async(name,args)=>{calls.push([name,args]);return {ok:true,deals:[{id:'D1',site:'현장',stage_code:'consulting',mobile_today_partial:true}],inquiries:[]};});
 await root.loadLive();
 assert.deepEqual(calls,[['crm_mobile_today_v1',{p_limit:500}]],'가벼운 조회 한 번');
 assert.deepEqual(applied,['D1','D1,D2'],'먼저 내 건 하나 → 전체 두 건');
 assert.equal(root.MOBILE_TODAY_FIRST,false,'전체가 오면 먼저 표시 상태 해제');
 assert.equal(root.LIVE,true);
});
test('함수가 없거나(PGRST202) 실패하면 전체 조회만으로 그대로 간다',async()=>{
 const {root,applied}=mobileRoot(full,async()=>{throw Object.assign(Error('Could not find the function'),{code:'PGRST202'});});
 await root.loadLive();
 assert.deepEqual(applied,['D1,D2']);assert.equal(root.MOBILE_TODAY_FIRST,false);
});
test('끄기(G.mobileTodayFirstOff)면 가벼운 조회를 부르지 않는다',async()=>{
 let n=0;const {root,applied}=mobileRoot(full,async()=>{n++;return {ok:true,deals:[]};},{mobileTodayFirstOff:true});
 await root.loadLive();
 assert.equal(n,0);assert.deepEqual(applied,['D1,D2']);
});
test('이상한 응답(ok 아님 · deals 배열 아님)은 무시한다',async()=>{
 const {root,applied}=mobileRoot(full,async()=>({ok:false}));
 await root.loadLive();
 assert.deepEqual(applied,['D1,D2']);
});
