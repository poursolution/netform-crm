'use strict';
const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../staging-phase1');
const config=JSON.parse(fs.readFileSync('C:/Users/Administrator/crm-staging-private/v2-client.json','utf8'));
const mapping=require('../sql/baseline/20260905/synthetic/auth-mapping.json');
if(config.project_ref!=='rprechiaglyjaydkmxsu'||config.url!=='https://rprechiaglyjaydkmxsu.supabase.co')throw Error('Wrong Staging ref');
const publicConfig={project_ref:config.project_ref,url:config.url,publishable_key:config.publishable_key,accounts:mapping.accounts.map(a=>({name:a.name||'TEST '+a.kind,email:a.email}))};
http.createServer((req,res)=>{
 const u=new URL(req.url,'http://127.0.0.1:4179'),file=u.pathname==='/'?'/crm.html':u.pathname;
 res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');
 res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; connect-src 'self' https://rprechiaglyjaydkmxsu.supabase.co; img-src 'self' data:; font-src 'self'; object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'");
 if(file==='/phase1-config.js'){res.setHeader('Content-Type','application/javascript');res.end('window.PHASE1_CONFIG='+JSON.stringify(publicConfig)+';');return;}
 if(!/^\/[\w.-]+\.(?:html|js|css)$/.test(file)&&file!=='/vendor/supabase.js'){res.writeHead(404);res.end();return;}
 const target=path.join(root,file);if(!fs.existsSync(target)){res.writeHead(404);res.end();return;}
 res.setHeader('Content-Type',file.endsWith('.html')?'text/html; charset=utf-8':file.endsWith('.css')?'text/css':'application/javascript');res.end(fs.readFileSync(target));
}).listen(4179,'127.0.0.1',()=>console.log('Staging original-UI copies: http://127.0.0.1:4179 (public browser configuration only)'));
