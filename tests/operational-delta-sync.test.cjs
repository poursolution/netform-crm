'use strict';
/* 바뀐 것만 받기(2026-09-26): 화면을 새로 열 때·주기 확인 때 전체 대신 서버 장부에 바뀐 번호만 묻는다. */
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const overlay=require('../operational-overlay.js');

const A='aaaaaaaa-0000-4000-8000-000000000001',C='cccccccc-0000-4000-8000-000000000003',Q='dddddddd-0000-4000-8000-000000000004';
const iso=ms=>new Date(ms).toISOString();

function pcRoot(read,stored){
 const map=new Map(stored?[['operational-bundle-v1',JSON.stringify(stored)]]:[]),painted=[],reads=[];
 const root={TOKEN:'t',ME:{id:'u',name:'관리자'},G:{},
  Phase1:{profile:null,read:async(resource,args)=>{reads.push([resource,args&&args.domains?args.domains.join(','):args&&args.since!==undefined?String(args.since):args&&args.id]);return read(resource,args);},
   storage:{getItem:k=>map.has(k)?map.get(k):null,setItem:(k,v)=>map.set(k,v),removeItem:k=>map.delete(k)},queue:{list:()=>[],flush:async()=>[]}},
  OperationalAdapter:{},addEventListener(){},document:{getElementById:()=>null},applyBundle(bundle,domains){this.B=bundle;painted.push(domains||'all');}};
 overlay.install(root);
 return {root,reads,painted,map};
}
const page=(domain,items)=>({data:{deals:domain==='deal_core'?items:[],inquiries:domain==='inquiry_core'?items:[]}});
const changes=(t,deals,inquiries,truncated)=>({data:{ok:true,contract_version:1,server_time:t,deals:deals||[],inquiries:inquiries||[],truncated:truncated||{deals:false,inquiries:false}}});

test('reopening with a saved list asks only what changed — one changed deal is read alone, nothing else is downloaded',async()=>{
 const T0=iso(Date.now()-5*60e3),T1=iso(Date.now());
 const stored={contract_version:2,deals:[{id:A,site:'예전 이름'}],inquiries:[{id:Q,site:'문의'}],message_logs:[],sync_since:T0,full_at:Date.now()-10*60e3};
 const {root,reads,map}=pcRoot(async(resource,args)=>{
  /* 서버는 소수점 6자리 시각(…33.211531+00:00)을 준다 — 아이폰 사파리도 읽도록 표준 형식으로 저장 */
  if(resource==='operational_changes')return changes(T1.replace(/\.(\d{3})Z$/,'.$1531+00:00'),[{id:A,v:true},{id:C,v:false}]);
  if(resource==='operational_row')return {data:{domain:args.domain,id:args.id,item:args.id===A?{id:A,site_name:'새 이름',stage_code:'first_contact',version:4}:null}};
  throw Error('full read must not happen: '+resource);
 },stored);
 await root.loadData();
 assert.deepEqual(reads.map(x=>x[0]),['operational_changes','operational_row'],'변경 물음 1회 + 바뀐 1건만 (볼 수 없고 원래도 없던 C는 읽지 않음)');
 assert.equal(new Date(Date.parse(reads[0][1])).getTime(),Date.parse(T0)-60e3,'60초 겹쳐 묻는다');
 assert.equal(root.B.deals.find(d=>d.id===A).site,'새 이름');
 assert.equal(root.operationalSyncState().since,T1);
 assert.equal(JSON.parse(map.get('operational-bundle-v1')).sync_since,T1,'저장본에 새 기준 시각');
});

test('first open downloads everything once and remembers the server time taken just before; later polls with no changes cost one small call',async()=>{
 const T0=iso(Date.now()-1000),T1=iso(Date.now());let next=null;
 const {root,reads}=pcRoot(async(resource,args)=>{
  if(resource==='operational_changes')return args.since===null?changes(T0):next;
  if(resource==='operational')return page(args.domains[0],args.domains[0]==='deal_core'?[{id:A,site:'현장',stage_code:'consulting'}]:[{id:Q,site:'문의'}]);
  throw Error('unexpected '+resource);
 });
 await root.loadData();
 assert.equal(root.operationalSyncState().since,T0,'전체 받기 직전 서버 시각');
 assert.ok(reads.some(x=>x[0]==='operational'));
 reads.length=0;next=changes(T1);
 await root.refreshOperationalDomains(['deal_core','inquiry_core'],'poll');
 assert.deepEqual(reads.map(x=>x[0]),['operational_changes'],'바뀐 게 없으면 물음 1회로 끝');
 assert.equal(root.operationalSyncState().since,T1);
 /* 초반 대량 수정: 바뀐 영업이 30건을 넘으면 영업만 전체로 받고 문의는 건드리지 않는다 */
 reads.length=0;
 const many=Array.from({length:31},(_,i)=>({id:'eeeeeeee-0000-4000-8000-'+String(i).padStart(12,'0'),v:true}));
 next=changes(iso(Date.now()+1000),many,[]);
 await root.refreshOperationalDomains(['deal_core','inquiry_core'],'poll');
 assert.deepEqual(reads.map(x=>x[0]+':'+(x[0]==='operational'?x[1]:'')),['operational_changes:','operational:deal_core']);
});

test('without the server function the screen keeps working exactly as before — full reads',async()=>{
 const {root,reads}=pcRoot(async(resource,args)=>{
  if(resource==='operational_changes')throw Error('CONTRACT_UNAVAILABLE');
  if(resource==='operational')return page(args.domains[0],[]);
  throw Error('unexpected '+resource);
 });
 await root.loadData();
 reads.length=0;
 await root.refreshOperationalDomains(['deal_core','inquiry_core'],'poll');
 assert.deepEqual(reads.map(x=>x[0]+':'+x[1]),['operational:deal_core,inquiry_core'],'다시 묻지 않고 예전처럼 전체');
 assert.equal(root.operationalSyncState().off,true);
});

test('server SQL, both transports and the release gate ship together',()=>{
 const sql=fs.readFileSync(path.join(__dirname,'..','sql','operational-changes-v1-20260926.sql'),'utf8');
 assert.match(sql,/create table if not exists crm_security\.change_log/);
 assert.match(sql,/insert into crm_security\.change_log\(deal_id, inquiry_id\)/);
 assert.match(sql,/crm_security\.can_deal\(x\.deal_id, false\)/);
 assert.match(sql,/crm_security\.can_inquiry\(x\.inquiry_id\)/);
 assert.match(sql,/revoke all on table crm_security\.change_log from public, anon, authenticated/);
 assert.match(sql,/grant execute on function public\.crm_operational_changes_v1\(timestamptz, integer\) to authenticated/);
 for(const f of ['pc-manager-transport.js','transport.js']){
  const s=fs.readFileSync(path.join(__dirname,'..',f),'utf8');
  assert.match(s,/rpcAllow=new Set\(\[[^\]]*'crm_operational_changes_v1'/,f);
  assert.match(s,/resource==='operational_changes'/,f);
 }
 assert.match(fs.readFileSync(path.join(__dirname,'..','operational-overlay.js'),'utf8'),/CRMRelease\?\.has\?\.\('crm_operational_changes_v1'\)!==false/);
});
