const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),sql=fs.readFileSync(path.join(root,'sql/site-admin-search-v1.sql'),'utf8'),transport=fs.readFileSync(path.join(root,'pc-manager-transport.js'),'utf8');
assert.match(sql,/permission_role='admin'/);assert.match(sql,/pg_catalog\.length\(q\)<2/);assert.match(sql,/limit page_size/);assert.match(sql,/security invoker set search_path=''/);
assert.doesNotMatch(sql,/\b(?:insert|update|delete)\b/i);assert.match(sql,/revoke all on function public\.crm_site_admin_search_v1/);assert.match(transport,/rpcAllow=new Set\(\['crm_site_admin_search_v1'/);
console.log('PASS manual Site search is admin-only, bounded, read-only and transport-allowlisted');
