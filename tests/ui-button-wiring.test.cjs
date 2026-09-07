const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const ignored=new Set([
  'if','function',
  'alert','confirm','prompt','open','close','focus','blur','stopPropagation','preventDefault',
  'String','Number','Boolean','Array','Object','Date','Math','JSON','parseInt','parseFloat',
  'encodeURIComponent','decodeURIComponent','setTimeout','clearTimeout'
]);

for(const file of ['crm.html','mobile.html'])test(`${file} inline click handlers resolve to callable code`,()=>{
  const html=fs.readFileSync(path.join(__dirname,'..',file),'utf8');
  const attrs=[...html.matchAll(/\bonclick\s*=\s*(["'])([\s\S]*?)\1/gi)].map(m=>m[2]);
  const calls=new Set();
  for(const attr of attrs)for(const match of attr.matchAll(/(?:^|[^.\w$])([A-Za-z_$][\w$]*)\s*\(/g))if(!ignored.has(match[1]))calls.add(match[1]);
  const missing=[...calls].filter(name=>!new RegExp(`(?:function\\s+${name}\\s*\\(|(?:var|let|const)\\s+${name}\\s*=|(?:window|root)\\.${name}\\s*=)`).test(html));
  assert.equal(missing.length,0,`unresolved onclick calls: ${missing.join(', ')}`);
  assert.ok(attrs.length>50,`unexpectedly small button surface: ${attrs.length}`);
});
