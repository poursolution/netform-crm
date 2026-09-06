'use strict';
// Read-only source inspection: never evaluates application scripts or contacts CRM endpoints.
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),REF='6c1b570b8d79f908a7340292944acf96cecc9d68';
const git=(...args)=>cp.execFileSync('git',args,{cwd:root,encoding:'utf8',maxBuffer:30*1024*1024});
const tracked=git('ls-tree','-r','--name-only',REF).trim().split('\n');
const src={};for(const f of tracked.filter(f=>/\.(html|js|sql|md)$/.test(f)))src['golden/'+f]=git('show',REF+':'+f);
for(const f of fs.readdirSync(root).filter(f=>/\.(html|js|md)$/.test(f)))src['local/'+f]=fs.readFileSync(path.join(root,f),'utf8');
for(const f of fs.readdirSync(path.join(root,'sql')).filter(f=>f.endsWith('.sql')))src['local/sql/'+f]=fs.readFileSync(path.join(root,'sql',f),'utf8');
const sha=s=>crypto.createHash('sha256').update(s).digest('hex'),line=(s,i)=>s.slice(0,i).split('\n').length;
const functions=[];for(const [file,s]of Object.entries(src)){if(!/\.(html|js)$/.test(file))continue;
const found=[...s.matchAll(/(?:^|[;\n])\s*(?:async\s+)?function\s+([\w$]+)\s*\(|(?:^|[;\n])\s*(?:var|let|const)\s+([\w$]+)\s*=\s*(?:async\s+)?function\s*\(/g)];
for(let i=0;i<found.length;i++){const m=found[i],name=m[1]||m[2],end=found[i+1]?.index||s.length,body=s.slice(m.index,end),start=m.index+m[0].search(/(?:async\s+)?function|(?:var|let|const)\b/);functions.push({file,name,line:line(s,start),offset:start,end,write_operations:[...new Set([...body.matchAll(/(?:pushWrite|postExecWrite|postWriteNowM|postWriteNow|rpc)\s*\(\s*['"]([^'"]+)['"]/g)].map(m=>m[1]))],body});}}
if(process.argv[2]==='view'){const s=src[process.argv[3]];if(!s)throw Error('Unknown source');const a=Number(process.argv[4]),b=Number(process.argv[5]);console.log(s.split('\n').slice(a-1,b).map((v,i)=>(a+i)+': '+v).join('\n'));process.exit();}
if(process.argv[2]==='functions'){const re=new RegExp(process.argv[3]||'.');console.log(functions.filter(f=>re.test(f.name)&&(!process.argv[4]||f.file===process.argv[4])).map(f=>f.file+':'+f.line+' '+f.name+' '+f.write_operations.join(',')).join('\n'));process.exit();}
function owner(file,offset){return functions.filter(f=>f.file===file&&f.offset<=offset&&f.end>offset).at(-1)?.name||'(top-level/template)';}
const controls=[],events=[],writes=[],sql=[],surfaces=[],dynamicCalls=[];
for(const [file,s]of Object.entries(src)){
if(/\.(html|js)$/.test(file)){
for(const m of s.matchAll(/<(button|input|select|textarea|a|summary)\b[^>]*>|<[^>]*\bon(?:click|change|input|submit|keydown|dblclick|drop|dragstart)\s*=[^>]*>/gi)){
 const tag=m[0];controls.push({id:'C'+String(controls.length+1).padStart(5,'0'),file,line:line(s,m.index),owner:owner(file,m.index),tag:tag.match(/^<([\w-]+)/)?.[1]||'',source:tag.slice(0,900),label_hint:s.slice(m.index+tag.length,m.index+tag.length+100).split('<')[0].slice(0,80)});}
for(const m of s.matchAll(/\bon(?:click|change|input|submit|keydown|keyup|dblclick|drop|dragstart)\s*=|\.addEventListener\s*\(|\.(?:onclick|onchange|oninput|onsubmit)\s*=/g))events.push({file,line:line(s,m.index),owner:owner(file,m.index),source:s.slice(m.index,m.index+230).split('\n')[0]});
for(const m of s.matchAll(/(?:pushWrite|postExecWrite|postWriteNowM|postWriteNow|\brpc)\s*\(\s*['"]([^'"]+)['"]/g))writes.push({file,line:line(s,m.index),owner:owner(file,m.index),operation:m[1]});
for(const m of s.matchAll(/<(?:div|section|nav|dialog|aside|header|option|h[1-4])\b[^>]*>/gi)){if(/<(?:option|h[1-4]|nav|dialog)\b|\b(?:id|role)=|class=[^>]*(?:card|kpi|modal|tab|drawer|sheet|filter)/i.test(m[0]))surfaces.push({file,line:line(s,m.index),owner:owner(file,m.index),source:m[0].slice(0,500),label_hint:s.slice(m.index+m[0].length,m.index+m[0].length+90).split('<')[0]});}
for(const m of s.matchAll(/(?:pushWrite|postExecWrite|postWriteNowM|postWriteNow|\brpc)\s*\(\s*([^'"\s][^\n]{0,120})/g))dynamicCalls.push({file,line:line(s,m.index),owner:owner(file,m.index),expression:m[0]});
}else if(file.endsWith('.sql'))for(const m of s.matchAll(/CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+([\w.]+)\s*\(([^]*?)\)\s*RETURNS/gi))sql.push({file,line:line(s,m.index),name:m[1],arguments:m[2].replace(/\s+/g,' ').trim()});
}
const manifest=Object.entries(src).map(([file,s])=>({file,lines:s.split('\n').length,sha256:sha(s),same_as_golden:file.startsWith('local/')&&src['golden/'+file.slice(6)]!==undefined?sha(s.replace(/\r\n?/g,'\n'))===sha(src['golden/'+file.slice(6)].replace(/\r\n?/g,'\n')):null}));
const out=path.join(root,'docs/parity-20260905');fs.mkdirSync(out,{recursive:true});
const payload={golden:{repository:'poursolution/netform-crm',branch:'master',commit:REF,verified_via:'GitHub branch API; local HEAD equals remote SHA',verification_date:'2026-09-05'},method:'Static source occurrence inventory, including template strings. No app execution. Not a reachability or backend deployment proof; repeated/overridden definitions retained. Function owner is nearest-declaration lexical hint, not an AST call graph.',manifest,controls,surfaces,events,dynamicCalls,writes,functions:functions.map(({body,offset,end,...f})=>f),sql};
fs.writeFileSync(path.join(out,'source-inventory.json'),JSON.stringify(payload,null,2));
const csv=(rows,keys)=>'\ufeff'+[keys.join(','),...rows.map(r=>keys.map(k=>'"'+String(r[k]??'').replaceAll('"','""')+'"').join(','))].join('\n');
fs.writeFileSync(path.join(out,'controls.csv'),csv(controls,['id','file','line','owner','tag','label_hint','source']));
fs.writeFileSync(path.join(out,'write-actions.csv'),csv(writes,['file','line','owner','operation']));
if(require.main===module)console.log(JSON.stringify({files:manifest.length,controls:controls.length,surfaces:surfaces.length,events:events.length,functions:functions.length,writeSites:writes.length,sqlFunctions:sql.length,byScope:['golden','local'].map(scope=>({scope,controls:controls.filter(x=>x.file.startsWith(scope+'/')).length,functions:functions.filter(x=>x.file.startsWith(scope+'/')).length,writeOperations:[...new Set(writes.filter(x=>x.file.startsWith(scope+'/')).map(x=>x.operation))]}))}));
module.exports={src,functions,controls,surfaces,events,dynamicCalls,writes,sql,manifest,REF,out};
