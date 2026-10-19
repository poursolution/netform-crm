'use strict';
/* 릴리스 계약 (2026-09-25): 화면이 호출할 수 있는 RPC는 전부 저장소에 SQL 정의가 있어야 한다.
   운영에 직접만 적용되고 저장소에 없는 함수가 생기면 재구축·검토·배포 순서 확인이 불가능해진다.
   런타임 대조(운영에 실제로 있는지)는 release-contract.js + crm_release_manifest_v1이 담당한다. */
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');

function sqlFiles(dir){
 if(!fs.existsSync(dir))return [];
 return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>{
  const p=path.join(dir,e.name);
  if(e.isDirectory())return sqlFiles(p);
  return e.name.endsWith('.sql')?[p]:[];
 });
}
const allowed=()=>{
 const t=fs.readFileSync(path.join(root,'pc-manager-transport.js'),'utf8');
 const m=t.match(/rpcAllow=new Set\(\[([^\]]+)\]/);
 assert.ok(m,'rpcAllow 목록을 찾지 못함');
 return [...m[1].matchAll(/'([^']+)'/g)].map(x=>x[1]);
};

test('전송 허용 RPC는 모두 저장소 SQL에 정의가 있다',()=>{
 const sql=['sql','docs','supabase'].flatMap(d=>sqlFiles(path.join(root,d))).map(f=>fs.readFileSync(f,'utf8')).join('\n');
 const missing=allowed().filter(n=>!new RegExp('function\\s+(public\\.)?"?'+n+'"?\\s*\\(','i').test(sql));
 assert.deepEqual(missing,[],'저장소 SQL 정의가 없는 RPC: '+missing.join(', '));
});

test('운영 함수 목록에 있는 함수는 호출이 실패해도 서버 적용 대기로 보지 않는다(2026-10-18 오판)',async()=>{
 const vm=require('node:vm'),listeners={},banners=[];
 const el={remove(){},setAttribute(){},querySelector:()=>({}),set innerHTML(v){banners.push(v);}};
 const doc={getElementById:()=>null,createElement:()=>Object.assign({},el),querySelector:()=>null,head:{append(){}},body:{append(){}}};
 const w={document:doc,console:{warn(){}},CustomEvent:function(t,o){this.type=t;this.detail=o&&o.detail;},dispatchEvent(){},addEventListener:(t,f)=>{listeners[t]=f;},todayIsAdmin:()=>true,
  CRM_RPC_ALLOW:['crm_ops_rules_v1','crm_work_request_list_v1','crm_new_v1'],SB:{rpc:async()=>({data:{ok:true,functions:['crm_ops_rules_v1','crm_work_request_list_v1']}})}};
 w.window=w;global.document=doc;
 vm.runInNewContext(fs.readFileSync(path.join(root,'release-contract.js'),'utf8'),Object.assign(w,{setTimeout:()=>{}}));
 const R=w.CRMRelease;
 R.noteMissing('crm_ops_rules_v1');assert.deepEqual(Array.from(R.missing()),['crm_ops_rules_v1'],'목록이 오기 전에는 일단 적어 둔다');
 await R.check(true);
 assert.deepEqual(Array.from(R.missing()),['crm_new_v1'],'목록에 있는 것은 지우고, 정말 없는 것만 남긴다');
 R.noteMissing('crm_work_request_list_v1');assert.deepEqual(Array.from(R.missing()),['crm_new_v1'],'목록이 온 뒤의 호출 실패는 함수 없음이 아니다');
 assert.equal(R.has('crm_ops_rules_v1'),true);
 delete global.document;
});

test('화면이 열리는 순간 한 번 실패해 꺼진 운영 저장소 기능은 서버 목록에 있으면 다시 켜진다(2026-10-19)',async()=>{
 const vm=require('node:vm'),L={};let fail=true;
 const doc={getElementById:()=>null,createElement:()=>({remove(){},setAttribute(){},querySelector:()=>({})}),querySelector:()=>null,head:{append(){}},body:{append(){}}};
 const w={document:doc,console:{warn(){}},CustomEvent:function(t,o){this.type=t;this.detail=o&&o.detail;},dispatchEvent(ev){(L[ev.type]||[]).forEach(f=>f(ev));},addEventListener:(t,f)=>{(L[t]=L[t]||[]).push(f);},
  todayIsAdmin:()=>true,ME:{id:'admin'},setTimeout:()=>{},CRM_RPC_ALLOW:['crm_ops_settings_v1'],
  SB:{rpc:async n=>n==='crm_release_manifest_v1'?{data:{ok:true,functions:['crm_ops_settings_v1']}}:fail?{error:{code:'PGRST202',message:'Could not find the function'}}:{data:{ok:true,settings:{a:true}}}}};
 w.window=w;
 vm.runInNewContext(fs.readFileSync(path.join(root,'release-contract.js'),'utf8'),w);
 vm.runInNewContext(fs.readFileSync(path.join(root,'ops-store.js'),'utf8'),w);
 const O=w.OpsStore,R=w.CRMRelease;
 assert.equal(R.listed('crm_ops_settings_v1'),null,'목록 받기 전');
 await assert.rejects(O.rpc('crm_ops_settings_v1',{}),/설치되지/);assert.equal(O.has('crm_ops_settings_v1'),false,'목록 받기 전 실패 = 일단 끔');
 await R.check(true);assert.equal(R.listed('crm_ops_settings_v1'),true);
 assert.equal(O.has('crm_ops_settings_v1'),true,'목록에 있으니 다시 켬');
 await assert.rejects(O.rpc('crm_ops_settings_v1',{}),/잠시 불안정/);assert.equal(O.has('crm_ops_settings_v1'),true,'목록을 받은 뒤의 실패는 끄지 않음');
 fail=false;assert.equal((await O.rpc('crm_ops_settings_v1',{})).ok,true,'다음 호출은 정상');
 assert.deepEqual(Array.from(R.missing()),[],'배너 없음');
});

test('릴리스 계약 모듈이 전송 계층 바로 뒤에 로드되고 매니페스트 RPC가 허용된다',()=>{
 const html=fs.readFileSync(path.join(root,'crm.html'),'utf8');
 const t=html.indexOf('pc-manager-transport.js?v='),r=html.indexOf('release-contract.js?v=');
 assert.ok(t>0&&r>t,'release-contract.js는 pc-manager-transport.js 뒤에 로드되어야 함');
 assert.ok(allowed().includes('crm_release_manifest_v1'));
 const tr=fs.readFileSync(path.join(root,'pc-manager-transport.js'),'utf8');
 assert.match(tr,/PGRST202/,'전송 계층이 함수 없음 응답을 릴리스 계약에 알려야 함');
 assert.match(tr,/CRM_RPC_ALLOW=Object\.freeze/);
});
