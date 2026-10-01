'use strict';
/* 릴리스 계약 보강(2026-10-01 컨설턴트 1항): 화면이 부르는 RPC마다 저장소에 설치 SQL이 있어야 한다.
   운영 DB 자체와의 대조는 로그인 뒤 crm_release_manifest_v1이 맡는다(release-contract.js). */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const list=dir=>{const p=path.join(root,dir);return fs.existsSync(p)?fs.readdirSync(p).filter(f=>f.endsWith('.sql')).map(f=>fs.readFileSync(path.join(p,f),'utf8')):[]};
const sql=list('sql').concat(list('supabase/migrations')).join('\n');
const src=fs.readFileSync(path.join(root,'pc-manager-transport.js'),'utf8');
const m=src.match(/rpcAllow=new Set\(\[([^\]]+)\]\)/);
test('전송 허용 RPC마다 설치 SQL 존재',()=>{
 assert.ok(m,'rpcAllow 목록');
 const names=[...m[1].matchAll(/'([a-z0-9_]+)'/g)].map(x=>x[1]);
 assert.ok(names.length>5);
 const missing=names.filter(n=>!new RegExp('function\\s+(public\\.)?'+n+'\\s*\\(','i').test(sql));
 assert.deepEqual(missing,[],'설치 SQL 없는 RPC');
});
