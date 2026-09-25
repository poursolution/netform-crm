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

test('릴리스 계약 모듈이 전송 계층 바로 뒤에 로드되고 매니페스트 RPC가 허용된다',()=>{
 const html=fs.readFileSync(path.join(root,'crm.html'),'utf8');
 const t=html.indexOf('pc-manager-transport.js?v='),r=html.indexOf('release-contract.js?v=');
 assert.ok(t>0&&r>t,'release-contract.js는 pc-manager-transport.js 뒤에 로드되어야 함');
 assert.ok(allowed().includes('crm_release_manifest_v1'));
 const tr=fs.readFileSync(path.join(root,'pc-manager-transport.js'),'utf8');
 assert.match(tr,/PGRST202/,'전송 계층이 함수 없음 응답을 릴리스 계약에 알려야 함');
 assert.match(tr,/CRM_RPC_ALLOW=Object\.freeze/);
});
