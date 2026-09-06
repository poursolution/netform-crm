'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),{createRequire}=require('node:module');
const req=createRequire(path.resolve(__dirname,'../../crm-security-lab/package.json')),acorn=req('acorn');
const root=path.resolve(__dirname,'..'),out=path.join(root,'staging-phase1'),hash=s=>crypto.createHash('sha256').update(s).digest('hex');
const manifest={golden:'6c1b570b8d79f908a7340292944acf96cecc9d68',source:'current approved local overlays (original files never modified)',project_ref:'rprechiaglyjaydkmxsu',files:[],patches:[],missing_assets:[]};
function replaceFunctions(html,replacements,file){return html.replace(/(<script\b[^>]*>)([\s\S]*?)(<\/script>)/gi,(all,start,code,end)=>{
 if(/\bsrc=/.test(start)||!code.trim())return all;const ast=acorn.parse(code,{ecmaVersion:'latest',allowReturnOutsideFunction:true});const edits=[];
 for(const node of ast.body){if(node.type==='FunctionDeclaration'&&replacements[node.id.name]){const source=code.slice(node.start,node.end),replacement=replacements[node.id.name];edits.push([node.start,node.end,typeof replacement==='function'?replacement(source):replacement]);manifest.patches.push({file,function:node.id.name,before_sha256:hash(source)});}}
 for(const [a,b,value] of edits.sort((a,b)=>b[0]-a[0]))code=code.slice(0,a)+value+code.slice(b);return start+code+end;
 });}
const common={loginEmailOf:'function loginEmailOf(name){return Phase1.loginEmail(name);}',
 pushWrite:`function pushWrite(op,payload){var q;if(op==='opportunity_work_set')q=Phase1.queue.enqueue(op,payload.opportunity_id,payload.expected_version,{primary_work:payload.primary_work,work_items:payload.work_items,reason:payload.reason});else if(op==='inquiry_assign')q=Phase1.queue.enqueue(op,payload.inquiry_id,0,payload);else throw Error('CONTRACT_UNAVAILABLE');WRITE_Q=Phase1.queue.list();return q.request_id;}`,
 flushWrites:'function flushWrites(){if(!Phase1.profile)return Promise.resolve();return Phase1.queue.flush().catch(function(e){console.warn("Phase1 queue: "+e.message)});}',
 retryFailedWrites:'function retryFailedWrites(){return flushWrites();}',retryFailed:'function retryFailed(){return flushWrites();}',
 authSignOut:'async function authSignOut(){await Phase1.signOut();location.reload();}',doSignOut:'async function doSignOut(){await Phase1.signOut();location.reload();}'};
const pc={...common,authAdmit:`async function authAdmit(session){try{var p=await Phase1.admit(session);TOKEN=session.access_token;ME={id:p.user_id,auth_uid:p.auth_uid,email:session.user.email,name:p.name,role:p.allowed_modes.includes('admin')?p.source_role:'rep',source_role:p.source_role,permission_role:p.permission_role};authGate(false);authBadge();authWatch();G._homePicked=0;applyRoleHome();applyHomeRole();loadData();}catch(e){await Phase1.signOut();ME=null;TOKEN=null;authGate(true);authState('err','담당자 확인 실패',e.message);}}`,
 loadData:`async function loadData(){if(!ME||!TOKEN)return;var el=document.getElementById('load');if(el)el.style.display='none';var err=document.getElementById('err');if(err){err.textContent='Staging Phase 1: 로그인 연결 완료 · 업무별 read 계약은 후속 Phase에서 연결합니다. 전체 실적 데이터로 해석하지 마세요.';err.style.display='block';}var live=document.getElementById('live');if(live)live.textContent='Staging · 업무 데이터 unavailable';}`};
const mobile={...common,authAdmit:`async function authAdmit(session){try{var p=await Phase1.admit(session);TOKEN=session.access_token;G.user={id:p.user_id,auth_uid:p.auth_uid,nm:p.name,email:session.user.email,role:p.allowed_modes.includes('admin')?p.source_role:'rep',source_role:p.source_role,permission_role:p.permission_role};G.mode=p.allowed_modes.includes(savedMode())?savedMode():'rep';G.loginErr=null;return true;}catch(e){await Phase1.signOut();TOKEN=null;G.user=null;G.loginErr=e.message;return false;}}`,
 canManage:"function canManage(){return !!Phase1.profile?.allowed_modes.includes('admin');}",
 switchMode:"function switchMode(m){Phase1.mode(m);G.mode=m;saveMode(m);G.tab=m==='admin'?'ctrl':'today';G.deal=null;G.drill=null;G.stage=null;G.sub=null;render();}",
 loadLive:"async function loadLive(){if(!TOKEN)return;LIVE=false;LOAD_ERR='Staging Phase 1: 업무별 read 계약 미연결 (unavailable)';render();}"};
fs.mkdirSync(out,{recursive:true});
const phase11=require('./phase11-ui-overrides.cjs');Object.assign(pc,phase11.pc);Object.assign(mobile,phase11.mobile);
for(const file of fs.readdirSync(root).filter(f=>/\.(html|js|css)$/.test(f))){let source=fs.readFileSync(path.join(root,file),'utf8'),result=source;
 manifest.files.push({file,source_sha256:hash(source)});
 if(file==='crm.html'||file==='mobile.html'){
  result=replaceFunctions(result,file==='crm.html'?pc:mobile,file);
  result=result.replace(/window\.supabase\.createClient\(/g,'Phase1.createClient(');
  result=result.replace(/var SUPABASE_URL='[^']*';/,'var SUPABASE_URL=Phase1.config.url;').replace(/var SUPABASE_ANON='[^']*';/,'var SUPABASE_ANON=Phase1.config.publishable_key;');
  result=result.replace(/\.replace\(\/\[\^0-9\]\/g,''\)/g,'');
  result=result.replace('var {data,error}=await SB.auth.signInWithPassword','Phase1.beginLogin();\n  var {data,error}=await SB.auth.signInWithPassword');
  result=result.replaceAll('inputmode="numeric"','inputmode="text"').replaceAll('본인 핸드폰 번호','테스트 계정 비밀번호').replaceAll('핸드폰 번호','비밀번호').replaceAll('예: 황윤선','예: TEST INTERNAL_REP');
  result=result.replaceAll('전체</b>입니다 (예: 01012345678).','</b>입니다.').replaceAll('하이픈은 넣어도 되고 안 넣어도 됩니다.','대소문자와 특수문자를 그대로 입력하세요.');
  result=result.replace(/(<script\b[^>]*src=")[^"]*supabase[^\"]*("[^>]*><\/script>)/i,'$1vendor/supabase.js$2');
  result=result.replace(/<head([^>]*)>/i,'<head$1><script src="/phase1-config.js"></script><script src="/transport.js"></script>');
  // Render the original profile/mode header even while business data is unavailable.
  if(file==='mobile.html'){
   result=result.replace('if(!LIVE&&!DEMO)return rLocked();','');
   result=result.replace('if(G.deal!=null)return rDeal();',"if(!LIVE&&!DEMO){rLocked();scr.insertAdjacentHTML('afterbegin',head);return;}\n if(G.deal!=null)return rDeal();");
   result=result.replace(/var DEMO=[^;]+;/,'var DEMO=false;');
  }
  result=result.replace('</body>',`<script src="/work-editor.js"></script><script>window.addEventListener('phase1:identity-cleared',function(){TOKEN=null;WRITE_Q=[];${file==='crm.html'?"ME=null;if(typeof B!=='undefined')B=null;authGate(true);":"G.user=null;DEALS=[];BUNDLE=null;LIVE=false;"}});window.addEventListener('phase1:profile',function(){WRITE_Q=Phase1.queue.list();});window.addEventListener('phase1:queue',function(){WRITE_Q=Phase1.queue.list();});</script></body>`);
 }
 result=result.replace(/\b(?:window\.)?localStorage\b/g,'Phase1.storage').replace(/\b(?:window\.)?sessionStorage\b/g,'Phase1.storage');
 result=result.replaceAll('https://ymfbmpnizxvqsamnczow.supabase.co','https://rprechiaglyjaydkmxsu.supabase.co').replaceAll('sb_publishable_Lrv2O_5Nr96a1HQF6n65zA_7OsqCz3X','PHASE1_CONFIG_ONLY');
 // Remove connection warmups, not product controls. Blocked integrations remain in source and inventory.
 result=result.replace(/<link\b[^>]*rel=["'](?:preconnect|dns-prefetch)["'][^>]*>/gi,'');
 if(file==='index.html')result=result.replace(/<head([^>]*)>/i,'<head$1><script src="/phase1-config.js"></script><script src="/transport.js"></script>');
 fs.writeFileSync(path.join(out,file),result);manifest.files.at(-1).copy_sha256=hash(result);
}
for(const file of ['crm.html','mobile.html','index.html']){
 const s=fs.readFileSync(path.join(out,file),'utf8');for(const m of s.matchAll(/(?:src|href)=["']([^"']+\.(?:js|css)(?:\?[^"']*)?)["']/g)){const f=m[1].split('?')[0];if(!/^https?:|^\/|^vendor\//.test(f)&&!fs.existsSync(path.join(out,f)))manifest.missing_assets.push({page:file,asset:f});}}
fs.mkdirSync(path.join(out,'vendor'),{recursive:true});fs.copyFileSync(path.resolve(__dirname,'../../crm-security-lab/node_modules/@supabase/supabase-js/dist/umd/supabase.js'),path.join(out,'vendor/supabase.js'));
fs.copyFileSync(path.resolve(__dirname,'../../crm-security-lab/node_modules/@supabase/supabase-js/LICENSE'),path.join(out,'vendor/supabase-LICENSE.txt'));
manifest.vendor={name:'@supabase/supabase-js',version:'2.115.0',sha256:hash(fs.readFileSync(path.join(out,'vendor/supabase.js'))),license:'vendor/supabase-LICENSE.txt'};
fs.writeFileSync(path.join(out,'source-manifest.json'),JSON.stringify(manifest,null,2));console.log(JSON.stringify({copies:manifest.files.length,patched_functions:manifest.patches.length,missing_assets:manifest.missing_assets}));
