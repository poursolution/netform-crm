'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const overlay=require('../operational-overlay.js');

function page(domain,items){return {contract_version:1,resource:'operational',data:{deals:domain==='deal_core'?items:[],inquiries:domain==='inquiry_core'?items:[],asq_projects:domain==='asq_project'?items:[]}};}
function mobileRoot(read){
 const toasts=[],timers=[];
 const root={TOKEN:'t',ME:{id:'u'},G:{},DEALS:[],toast:m=>toasts.push(m),rebuildAdmin(){},render(){},
  normalizeDeal:d=>d,Phase1:{profile:null,read,queue:{list:()=>[],flush:async()=>[]}},OperationalAdapter:{},addEventListener(){},document:{getElementById:()=>null}};
 root.setTimeout=(fn,ms)=>{timers.push(ms);return 1;};root.clearTimeout=()=>{};
 overlay.install(root);
 return {root,toasts,timers};
}

test('mobile first load keeps deals when inquiries fail, says so, and retries — instead of silently stopping at the first page',async()=>{
 const {root,toasts,timers}=mobileRoot(async(resource,args)=>{
  const d=args.domains[0];
  if(d==='inquiry_core')throw Error('timeout');
  if(d==='asq_project')throw Error('asq down');
  return page(d,[{id:'D1',site:'현장',stage_code:'consulting'},{id:'D2',site:'현장2',stage_code:'sent'}]);
 });
 await root.loadLive();
 assert.equal(root.DEALS.length,2,'영업은 끝까지 받는다');
 assert.match(toasts.join(' '),/일부 데이터를 불러오지 못했습니다/);assert.deepEqual(timers,[30000],'30초 뒤 한 번 다시 시도');
});

test('mobile.html real-data path: the inline loadLive is only a placeholder that operational-overlay.js replaces on load',()=>{
 /* 2026-09-26 외부 검토가 mobile.html 인라인 loadLive만 보고 '실데이터 미연결'로 오판 — 연결 경로를 고정해 둔다 */
 const fs=require('node:fs'),path=require('node:path'),html=fs.readFileSync(path.join(__dirname,'..','mobile.html'),'utf8'),src=fs.readFileSync(path.join(__dirname,'..','operational-overlay.js'),'utf8');
 assert.match(html,/<script src="\.\/operational-overlay\.js\?v=[^"]+"><\/script>/,'휴대폰도 동기화 계층을 싣는다');
 assert.match(src,/root\.OperationalUI=api;api\.install\(root\)/,'브라우저에서는 로드 즉시 설치');
 assert.match(src,/root\.loadLive=async function\(\)\{if\(!root\.TOKEN\)return;/,'설치가 loadLive를 실제 조회로 교체');
 const root={TOKEN:null,Phase1:{profile:null,read:async()=>({}),queue:{list:()=>[],flush:async()=>[]}},OperationalAdapter:{},addEventListener(){},document:{getElementById:()=>null},loadLive:'placeholder'};
 overlay.install(root);assert.equal(typeof root.loadLive,'function');
});

test('mobile first load survives a failed ASQ project read without any warning',async()=>{
 const {root,toasts}=mobileRoot(async(resource,args)=>{
  const d=args.domains[0];if(d==='asq_project')throw Error('asq down');
  return page(d,d==='deal_core'?[{id:'D1',site:'현장',stage_code:'consulting'}]:[{id:'Q1',site:'문의'}]);
 });
 await root.loadLive();
 assert.equal(root.DEALS.length,1);assert.equal(toasts.length,0);
});
