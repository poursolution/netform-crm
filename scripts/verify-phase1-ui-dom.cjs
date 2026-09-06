'use strict';
// Original HTML in JSDOM + REAL Staging Auth. Not evidence of a real-browser parity pass.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{createRequire}=require('node:module');
const {JSDOM,ResourceLoader,VirtualConsole}=createRequire(path.resolve(__dirname,'../../crm-security-lab/package.json'))('jsdom');
const secret=JSON.parse(fs.readFileSync('C:/Users/Administrator/crm-staging-private/auth-synthetic-20260905.json','utf8'));
if(secret.project_ref!=='rprechiaglyjaydkmxsu')throw Error('Wrong Staging ref');
const results=[],network=[],errors=[];
class Loader extends ResourceLoader{fetch(url,options){if(new URL(url).origin!=='http://127.0.0.1:4179')return null;return super.fetch(url,options);}}
async function until(predicate){const end=Date.now()+12000;while(Date.now()<end){if(predicate())return;await new Promise(r=>setTimeout(r,60));}throw Error('UI_WAIT_TIMEOUT');}
async function open(page,stored={}){const vc=new VirtualConsole();vc.on('jsdomError',e=>{if(!/navigation|CSS|stylesheet|dashboard-hierarchy/.test(e.message))errors.push(e.message.slice(0,180));});
 return JSDOM.fromURL('http://127.0.0.1:4179/'+page,{runScripts:'dangerously',resources:new Loader(),pretendToBeVisual:true,virtualConsole:vc,beforeParse(w){
  w.fetch=async(u,options)=>{const url=new URL(typeof u==='string'?u:u.url,'http://127.0.0.1:4179');network.push({origin:url.origin,path:url.pathname});assert.ok(['http://127.0.0.1:4179','https://rprechiaglyjaydkmxsu.supabase.co'].includes(url.origin));return fetch(url,options);};
  Object.assign(w,{Request,Response,Headers,TextEncoder,TextDecoder,AbortController});w.matchMedia=()=>({matches:false,addListener(){},removeListener(){},addEventListener(){},removeEventListener(){}});w.confirm=()=>true;w.BroadcastChannel=undefined;
  for(const [k,v]of Object.entries(stored))w.sessionStorage.setItem(k,v);
 }});}
async function main(){for(const page of ['crm.html','mobile.html'])for(const account of secret.accounts){let dom;try{
 dom=await open(page);const w=dom.window;await until(()=>w.Phase1&&w.SB&&w.document.querySelector(page==='crm.html'?'#au-name':'#lg-nm'));
 const name=w.document.querySelector(page==='crm.html'?'#au-name':'#lg-nm'),pw=w.document.querySelector(page==='crm.html'?'#au-pw':'#lg-pw');name.value=account.name;pw.value=account.password;name.dispatchEvent(new w.Event('input',{bubbles:true}));pw.dispatchEvent(new w.Event('input',{bubbles:true}));
 if(page==='crm.html')w.document.querySelector('#au-btn').click();else [...w.document.querySelectorAll('button')].find(b=>b.textContent.trim()==='로그인하기').click();
 await until(()=>w.Phase1.profile);assert.equal(w.Phase1.profile.user_id,account.user_id);assert.equal(w.Phase1.profile.source_role,account.source_role);
 if(page==='crm.html')assert.ok(w.document.querySelector('#meChip').textContent.includes(account.name));else assert.ok(w.document.body.textContent.includes(account.name));
 if(page==='mobile.html'){
  if(account.source_role==='admin'){[...w.document.querySelectorAll('button')].find(b=>b.textContent.trim()==='관리').click();assert.equal(w.G.mode,'admin');[...w.document.querySelectorAll('button')].find(b=>b.textContent.trim()==='내 영업').click();assert.equal(w.G.mode,'rep');}
  else assert.equal([...w.document.querySelectorAll('button')].some(b=>b.textContent.trim()==='관리'),false);
 }
 if(account.kind==='INTERNAL_REP'){
  w.Phase1.storage.setItem('TEST_CACHE','TEST_PRIVATE');const stored=Object.fromEntries(Array.from({length:w.sessionStorage.length},(_,i)=>{const k=w.sessionStorage.key(i);return[k,w.sessionStorage.getItem(k)];}));
  const restored=await open(page,stored);try{await until(()=>restored.window.Phase1?.profile);assert.equal(restored.window.Phase1.profile.user_id,account.user_id);}finally{restored.window.close();}
 }
 await w.Phase1.signOut();assert.equal(w.Phase1.profile,null);assert.equal(w.sessionStorage.length,0);assert.equal(w.localStorage.length,0);
 results.push({page,role:account.kind,status:'PASS',method:'JSDOM original copy, real Staging JWT; not real browser'});
 }catch(e){results.push({page,role:account.kind,status:'FAIL',reason:e.code||e.message});}finally{dom?.window.close();}}
 fs.writeFileSync(path.resolve(__dirname,'../sql/phase1/dom-ui-results.json'),JSON.stringify({results,errors,network,real_browser_parity:false},null,2));console.log(JSON.stringify({pass:results.filter(r=>r.status==='PASS').length,fail:results.filter(r=>r.status==='FAIL').length,errors:errors.slice(0,5)}));if(results.some(r=>r.status==='FAIL'))process.exitCode=1;}
main().catch(()=>{console.error('DOM UI test harness failed (no secret output).');process.exitCode=1;});
