'use strict';
// Local synthetic review only. Product files and the Claude preview on 8766 stay unchanged.
const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const candidate=path.resolve(__dirname,'..');
const baseline=require('./review-environment.cjs').baseline;
const types={'.js':'application/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.html':'text/html; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.woff2':'font/woff2','.ico':'image/x-icon'};
const server=http.createServer((req,res)=>{
 res.setHeader('Cache-Control','no-store');
 res.setHeader('X-Content-Type-Options','nosniff');
 res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; font-src 'self' https://cdn.jsdelivr.net; img-src 'self' data:; connect-src 'none'; worker-src 'none'; object-src 'none'; frame-src 'none'; form-action 'none'; base-uri 'none'");
 if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);return res.end();}
 let rel;try{rel=decodeURIComponent(new URL(req.url,'http://127.0.0.1').pathname).replace(/^\/+/, '')||'mobile.html';}catch{res.writeHead(400);return res.end();}
 const ext=path.extname(rel);if(!types[ext]||(ext==='.html'&&rel!=='mobile.html')){res.writeHead(404);return res.end();}
 let file;
 if(rel==='review-fixture.js')file=path.join(__dirname,'fixture.js');
 else for(const dir of [candidate,baseline]){const p=path.resolve(dir,rel);if(p.startsWith(dir+path.sep)&&fs.existsSync(p)&&fs.statSync(p).isFile()){file=p;break;}}
 if(!file){res.writeHead(404);return res.end();}
 res.setHeader('Content-Type',types[ext]);if(req.method==='HEAD')return res.end();
 if(ext==='.html')return res.end(fs.readFileSync(file,'utf8').replace('</body>','<script src="review-fixture.js"></script></body>'));
 fs.createReadStream(file).pipe(res);
});
if(require.main===module)server.listen(8767,'127.0.0.1',()=>console.log('Synthetic mobile review: http://127.0.0.1:8767/mobile.html?demo=1&review=contact'));
module.exports=server;
