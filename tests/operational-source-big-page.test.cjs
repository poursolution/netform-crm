'use strict';
/* 운영 자료 읽기 왕복 축소(2026-10-01 컨설턴트 P1-12): 첫 페이지는 v1(100건), 나머지는 v2로 1000건씩. v2가 없으면 v1로 이어 받는다 */
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const UUIDS=n=>Array.from({length:n},(_,i)=>'00000000-0000-4000-8000-'+String(i+1).padStart(12,'0'));
function boot(server){
 const url='https://ymfbmpnizxvqsamnczow.supabase.co',calls=[];
 const storage={length:0,getItem(){return null},setItem(){},removeItem(){},key(){return null}};
 const root={PHASE1_CONFIG:{project_ref:'ymfbmpnizxvqsamnczow',url,publishable_key:'synthetic'},localStorage:storage,sessionStorage:storage,XMLHttpRequest:class{open(){}},addEventListener(){},dispatchEvent(){},CRMRelease:{has:()=>true,noteMissing(n){root.missing=n}}};
 root.fetch=async(u,init)=>{const name=String(u).split('/rest/v1/rpc/')[1];const args=JSON.parse(init.body||'{}');if(name==='crm_profile_scoped_v2')return {ok:true,status:200,json:async()=>({contract_version:2,auth_uid:'u-1',user_id:'user-1',source_role:'admin',allowed_modes:['rep','admin']})};calls.push([name,args.p_limit,args.p_after]);const r=server(name,args);if(r.error){const res={ok:false,status:404,json:async()=>r.error,clone:()=>res};return res;}return {ok:true,status:200,json:async()=>r}};
 root.supabase={createClient:()=>({channel(){},auth:{onAuthStateChange(){},getSession:async()=>({data:{session:{access_token:'t'}}})},rpc:()=>{throw Error('unused')}})};
 vm.runInNewContext(fs.readFileSync(require.resolve('../pc-manager-transport.js'),'utf8'),{window:root,URL,location:{origin:'http://localhost',hostname:'localhost',href:'http://localhost/'},navigator:{},setTimeout,clearTimeout,AbortController,console,Event:class{constructor(t){this.type=t}},CustomEvent:class{constructor(t,o){this.type=t;this.detail=o&&o.detail}}});
 root.Phase1.createClient(url,'synthetic');
 return {root,calls,ready:root.Phase1.admit({user:{id:'u-1'}})};
}
function page(domain,ids,after,limit){const start=after?ids.indexOf(after)+1:0,slice=ids.slice(start,start+limit),more=start+slice.length<ids.length;return {contract_version:1,resource:'operational_source',domain,scope_completeness:'actor_authorized_rows_only',items:slice.map(id=>({id})),pagination:{completeness:more?'partial':'complete',has_more:more,next_cursor:more?slice[slice.length-1]:null}}}
test('v2가 있으면 영역당 2회(100 + 나머지 한 번)',async()=>{
 const ids=UUIDS(750);const {root,calls,ready}=boot((name,a)=>page(a.p_domain,ids,a.p_after,a.p_limit));
 await ready;const r=await root.Phase1.read('operational',{domains:['deal_core'],firstPageLimit:100});
 assert.equal(r.data.deals.length,750);
 assert.deepEqual(calls.map(c=>c[0]+':'+c[1]),['crm_operational_source_v1:100','crm_operational_source_v2:1000']);
});
test('v2가 없으면(PGRST202) v1 100건씩으로 이어 받고 결과는 같다',async()=>{
 const ids=UUIDS(250);const {root,calls,ready}=boot((name,a)=>name==='crm_operational_source_v2'?{error:{code:'PGRST202',message:'Could not find the function'}}:page(a.p_domain,ids,a.p_after,a.p_limit));
 await ready;const r=await root.Phase1.read('operational',{domains:['inquiry_core'],firstPageLimit:100});
 assert.equal(r.data.inquiries.length,250);
 assert.equal(calls.filter(c=>c[0]==='crm_operational_source_v2').length,1,'v2는 한 번만 시도');
 assert.equal(calls.filter(c=>c[0]==='crm_operational_source_v1').length,3);
 assert.equal(root.missing,'crm_operational_source_v2');
});
test('bigFirst: 첫 호출부터 v2 — 1000건 이하는 1회로 끝(부분 표시 없음)',async()=>{
 const ids=UUIDS(750);const {root,calls,ready}=boot((name,a)=>page(a.p_domain,ids,a.p_after,a.p_limit));
 let pages=0;await ready;const r=await root.Phase1.read('operational',{domains:['deal_core'],firstPageLimit:100,bigFirst:true,onPage:()=>{pages++}});
 assert.equal(r.data.deals.length,750);
 assert.deepEqual(calls.map(c=>c[0]+':'+c[1]),['crm_operational_source_v2:1000']);
 assert.equal(pages,1);
});
test('bigFirst인데 v2가 없으면 v1 첫 100건부터 다시',async()=>{
 const ids=UUIDS(150);const {root,calls,ready}=boot((name,a)=>name==='crm_operational_source_v2'?{error:{code:'PGRST202',message:'Could not find the function'}}:page(a.p_domain,ids,a.p_after,a.p_limit));
 await ready;const r=await root.Phase1.read('operational',{domains:['deal_core'],firstPageLimit:100,bigFirst:true});
 assert.equal(r.data.deals.length,150);
 assert.deepEqual(calls.map(c=>c[0]+':'+c[1]),['crm_operational_source_v2:1000','crm_operational_source_v1:100','crm_operational_source_v1:100']);
});
test('화면: v2가 있으면 부분 표시를 건너뛴다',()=>{
 const src=fs.readFileSync(require.resolve('../operational-overlay.js'),'utf8');
 assert.match(src,/const bigFirst=root\.CRMRelease\?\.has\?\.\('crm_operational_source_v2'\)!==false/);
 assert.match(src,/showFirst=\(\)=>\{if\(bigFirst\|\|cached\|\|root\.B/);
 assert.match(src,/\}\.onPage,bigFirst\),bundle=shell/);
});
test('설치 SQL: v1을 서버 안에서 이어 부르고 같은 응답 모양',()=>{
 const sql=fs.readFileSync(require.resolve('../sql/operational-source-v2-20261001.sql'),'utf8');
 assert.match(sql,/create or replace function public\.crm_operational_source_v2\(p_domain text, p_after uuid default null, p_limit integer default 1000\)/);
 assert.match(sql,/public\.crm_operational_source_v1\(p_domain,cur,least\(100,p_limit-n\)\)/);
 assert.match(sql,/'scope_completeness','actor_authorized_rows_only'/);
 assert.match(sql,/revoke all on function public\.crm_operational_source_v2\(text,uuid,integer\) from public, anon/);
});
