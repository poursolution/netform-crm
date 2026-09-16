const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true});try{
 const page=await browser.newPage(),root=path.join(__dirname,'..'),crm=fs.readFileSync(path.join(root,'crm.html'),'utf8'),transport=fs.readFileSync(path.join(root,'pc-manager-transport.js'),'utf8');
 const allowed=transport.match(/const rpcAllow=new Set\(\[([^\]]+)\]/)[1].match(/'([^']+)'/g).map(x=>x.slice(1,-1));
 for(const rpc of ['crm_site_linked_history_v1','crm_site_link_review_list_v1','crm_site_link_review_resolve_v1'])assert.ok(allowed.includes(rpc));
 for(const file of ['site-link-review.css','pc-organization-history.js','site-linked-history.js'])assert.ok(crm.includes(file));
 await page.setContent('<main id="site-master"></main>');
 await page.evaluate(()=>{window.calls=[];window.confirm=()=>true;window.toast=()=>{};window.Phase1={profile:{auth_uid:'admin-1',permission_role:'admin'},rpc:async(name,args)=>{calls.push({name,args});if(name==='crm_site_link_review_resolve_v1')return {ok:true};return {contract_version:2,items:[{organization_id:'11111111-1111-4111-8111-111111111111',name:'동남아파트',address:'수원시',note_count:2,status:'review_single_candidate',site_candidates:[{site_id:'22222222-2222-4222-8222-222222222222',name:'동남아파트',address:'수원시',exact_address:true,match_reason:'이름·주소 일치',match_score:150}]}]};}}});
 await page.addStyleTag({path:path.join(root,'site-link-review.css')});await page.addScriptTag({path:path.join(root,'pc-organization-history.js')});
 await page.evaluate(()=>PCOrganizationHistory.mount(document.querySelector('main'),'동남'));
 await page.getByText('동남아파트',{exact:true}).waitFor();assert.match(await page.locator('main').innerText(),/이름·주소 일치 · 근거 150/);
 const select=page.locator('select');await select.selectOption('22222222-2222-4222-8222-222222222222');await page.getByRole('button',{name:'선택 Site에 연결'}).click();
 await page.waitForFunction(()=>calls.some(x=>x.name==='crm_site_link_review_resolve_v1'));
 const payload=await page.evaluate(()=>calls.find(x=>x.name==='crm_site_link_review_resolve_v1').args);assert.deepEqual(payload,{p_organization:'11111111-1111-4111-8111-111111111111',p_resolution:'linked',p_site:'22222222-2222-4222-8222-222222222222'});
 await page.evaluate(()=>{Phase1.profile={auth_uid:'rep-1',permission_role:'rep'};dispatchEvent(new Event('phase1:profile'));});assert.equal(await page.locator('[data-organization-history]').count(),0);
 console.log('PASS Site review UI: candidate evidence, explicit confirmation, canonical Site payload, identity clearing');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
