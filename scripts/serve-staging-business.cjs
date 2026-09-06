'use strict';
const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const {validate,BASE,REF}=require('../staging/client.js');
const privateFile='C:/Users/Administrator/crm-staging-private/v2-client.json';
const source=JSON.parse(fs.readFileSync(privateFile,'utf8'));
const config=validate({environment:'staging',projectRef:source.project_ref,url:source.url,publishableKey:source.publishable_key,endpoints:{auth:BASE+'/auth/v1',rest:BASE+'/rest/v1/rpc',write:BASE+'/rest/v1/rpc',realtime:BASE.replace('https:','wss:')+'/realtime/v1',export:null},realtimeEnabled:false,exportEnabled:false});
const allowed=new Set(['crm.html','mobile.html','client.js','app.js','styles.css']);
const server=http.createServer((req,res)=>{res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');res.setHeader('Content-Security-Policy',`default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self' ${BASE}; img-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'`);
if(req.method!=='GET'){res.writeHead(405).end();return;}const p=new URL(req.url,'http://127.0.0.1').pathname.slice(1);
if(p==='config.js'){res.setHeader('Content-Type','application/javascript');res.end('window.STAGING_CONFIG='+JSON.stringify(config)+';');return;}
if(!allowed.has(p)){res.writeHead(404).end();return;}res.setHeader('Content-Type',p.endsWith('.html')?'text/html; charset=utf-8':p.endsWith('.css')?'text/css':'application/javascript');res.end(fs.readFileSync(path.join(__dirname,'../staging',p)));});
server.listen(4178,'127.0.0.1',()=>console.log(`Staging-only UI ready: http://127.0.0.1:4178/crm.html (${REF}); publishable config only; no private credential route.`));
