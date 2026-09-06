'use strict';

const http=require('node:http');
const fs=require('node:fs');
const path=require('node:path');

const root=path.resolve(__dirname,'../staging-operational-full');
const config=JSON.parse(fs.readFileSync('C:/Users/Administrator/crm-staging-private/v2-client.json','utf8'));
const mapping=require('../sql/baseline/20260905/synthetic/auth-mapping.json');
if(config.project_ref!=='rprechiaglyjaydkmxsu'||config.url!=='https://rprechiaglyjaydkmxsu.supabase.co')throw Error('WRONG_STAGING_REF');
const publicConfig={project_ref:config.project_ref,url:config.url,publishable_key:config.publishable_key,accounts:mapping.accounts.map(account=>({name:account.name||'TEST '+account.kind,email:account.email}))};

http.createServer((request,response)=>{
 const url=new URL(request.url,'http://127.0.0.1:4181'),file=url.pathname==='/'?'/crm.html':url.pathname;
 response.setHeader('Cache-Control','no-store');
 response.setHeader('X-Content-Type-Options','nosniff');
 response.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; connect-src 'self' https://rprechiaglyjaydkmxsu.supabase.co; img-src 'self' data:; font-src 'self'; object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'");
 if(file==='/phase1-config.js'){
  response.setHeader('Content-Type','application/javascript');
  response.end('window.PHASE1_CONFIG='+JSON.stringify(publicConfig)+';');
  return;
 }
 if(!/^\/[\w.-]+\.(?:html|js|css)$/.test(file)&&file!=='/vendor/supabase.js'){
  response.writeHead(404);response.end();return;
 }
 const target=path.join(root,file);
 if(!target.startsWith(root+path.sep)||!fs.existsSync(target)){
  response.writeHead(404);response.end();return;
 }
 response.setHeader('Content-Type',file.endsWith('.html')?'text/html; charset=utf-8':file.endsWith('.css')?'text/css':'application/javascript');
 response.end(fs.readFileSync(target));
}).listen(4181,'127.0.0.1',()=>console.log('Operational full UI: http://127.0.0.1:4181'));
