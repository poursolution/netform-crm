const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true});try{
 const page=await browser.newPage(),root=path.join(__dirname,'..');
 const crm=fs.readFileSync(path.join(root,'crm.html'),'utf8');
 const transport=fs.readFileSync(path.join(root,'pc-manager-transport.js'),'utf8');
 const allowed=transport.match(/const rpcAllow=new Set\(\[([^\]]+)\]/)[1].match(/'([^']+)'/g).map(x=>x.slice(1,-1));
 assert.deepEqual(allowed,['crm_orphan_organization_history','crm_manager_request_create_v1','crm_manager_request_list_v1','crm_profile_scoped_v2','crm_read_scoped_v2','crm_contacts_scoped_v2','crm_write_command_v2','crm_operational_source_v1','crm_expansion_note','crm_expansion_context']);
 for(const file of ['organization-history-reader.js','organization-history-view.js','pc-organization-history.js'])assert.ok(crm.includes('src="./'+file));
 assert.ok(crm.includes('PCOrganizationHistory.mount(root,G.q)'));
 await page.setContent('<main id="site-master"></main>');
 await page.addScriptTag({content:crm.split(/\r?\n/).find(x=>x.startsWith('function siteNoteDisplayText('))});
 await page.evaluate(()=>{
  window.calls=[];window.fail=false;
  window.Phase1={profile:{auth_uid:'admin-1',permission_role:'admin'},rpc:async(name,args)=>{
   calls.push({name,args});if(fail)throw Error('API_NOT_INSTALLED');
   if(window.hold)return new Promise(resolve=>window.pending=resolve);
   return {items:args.p_org?[{id:'note-1',body:'<p>과거 예산 협의</p>',occurred_at:'2023-05-01'}]:[{id:'org-a',organization_id:'org-a',name:'동남아파트',note_count:1},{id:'org-b',organization_id:'org-b',name:'다른아파트',note_count:1}],has_more:false};
  }};
 });
 for(const file of ['organization-history-reader.js','organization-history-view.js','pc-organization-history.js'])await page.addScriptTag({path:path.join(root,file)});
 assert.equal(await page.evaluate(()=>calls.length),0); // lazy, no global fetch
 await page.evaluate(()=>PCOrganizationHistory.mount(document.querySelector('main'),'동남'));
 assert.equal(await page.locator('[data-organization-id]').count(),1);
 await page.locator('[data-organization-id=org-a]').click();
 await page.getByText('과거 예산 협의',{exact:true}).waitFor();
 assert.match(await page.locator('main').innerText(),/2023-05-01/);
 assert.equal(await page.evaluate(()=>calls.every(x=>x.name==='crm_orphan_organization_history')),true);
 await page.evaluate(()=>{Phase1.profile={auth_uid:'rep-1',permission_role:'rep'};dispatchEvent(new Event('phase1:profile'));});
 assert.equal(await page.locator('[data-organization-history]').count(),0);
 const before=await page.evaluate(()=>calls.length);
 await page.evaluate(()=>PCOrganizationHistory.mount(document.querySelector('main')));
 assert.equal(await page.evaluate(()=>calls.length),before);
 await page.evaluate(()=>{Phase1.profile={auth_uid:'admin-2',permission_role:'admin'};fail=true;return PCOrganizationHistory.mount(document.querySelector('main'));});
 assert.match(await page.locator('[role=alert]').innerText(),/실패/);
 await page.evaluate(()=>{fail=false;hold=true;PCOrganizationHistory.mount(document.querySelector('main'));});
 await page.evaluate(()=>{Phase1.profile=null;dispatchEvent(new Event('phase1:identity-cleared'));pending({items:[{id:'secret',organization_id:'secret',name:'이전 권한 데이터'}],has_more:false});});
 assert.equal(await page.locator('main').innerText(),'');
 console.log('PASS: PC HTML hook, lazy authorized transport, name search, history details, profile/identity clearing, non-admin hidden, missing API error. Mock integration, not deployed.');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
