// Isolated real-browser UI test. No remote requests and no business writes.
const path=require('node:path'),assert=require('node:assert/strict');
const {createRequire}=require('node:module');
const {chromium}=createRequire(path.resolve(__dirname,'../../crm-security-lab/package.json'))('playwright');
(async()=>{
 const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
 try{
 const page=await browser.newPage({viewport:{width:1365,height:900}});await page.route('**/*',r=>r.abort());
 await page.setContent('<div id="p-main"></div><div id="nextActionCard"></div>');
 await page.addScriptTag({path:path.resolve(__dirname,'../operational-adapter.js')});
 await page.evaluate(()=>{
  window.B={deals:[{id:'11111111-1111-4111-8111-111111111111',site:'테스트 현장',code:'sent',stage_code:'sent',version:1,assignee:'이필선'}]};
  window.kb5Card=()=>'<div class="k5c"><b>테스트 현장</b></div>';window.pipeFiltered=()=>B.deals;window.paintPipe=()=>document.querySelector('#p-main').innerHTML=kb5Card(B.deals[0]);window.paint=paintPipe;
  window.StageTransitionUI={open:(d,m,to)=>{window.endStage=to;}};
  window.rows=[];window.Phase1={queue:{list:()=>rows,enqueue:(op,id,v,p)=>{const normalized=OperationalAdapter.normalize(op,id,v,p);const q={...normalized,request_id:String(rows.length+1),status:'pending'};rows.push(q);return q;},flush:async()=>{if(window.fail)throw Error('테스트 저장 실패');const q=rows.at(-1);q.status='done';q.ack={version:q.expected_version+1,next_action_id:'next',stage_contexts:q.operation==='transition'?{waiting:{fields:q.payload.fields,memo:q.payload.memo}}:{}};}}};
 });
 await page.addStyleTag({path:path.resolve(__dirname,'../pc-followup-plan.css')});
 await page.addScriptTag({path:path.resolve(__dirname,'../pc-followup-plan.js')});await page.evaluate(()=>paint());
 await page.getByRole('button',{name:'추후 다시 연락',exact:true}).click();
 await page.locator('[name=due]').fill('2030-12-15');await page.locator('[name=year]').fill('2030');
 assert.match(await page.locator('.pc-followup-preview').innerText(),/Pipeline/);
 await page.getByRole('button',{name:'계획 저장'}).click();
 assert.equal(await page.locator('dialog').count(),0);
 assert.deepEqual(await page.evaluate(()=>[rows[0].operation,B.deals[0].code,B.deals[0].nextAction.due]),['next_action','sent','2030-12-15']);
 await page.getByRole('button',{name:'종료',exact:true}).click();assert.equal(await page.evaluate(()=>endStage),'lost');
 await page.evaluate(()=>{Object.assign(B.deals[0],{amt:120000000,quote_amount:115000000,quote_versions:[{version_no:3,amount:115000000,sent_at:'2026-09-10T10:00:00+09:00'}],activities:[{id:'history-before',type:'전화',note:'기존 대화 내용'}]});window.preserved=JSON.stringify({id:B.deals[0].id,amt:B.deals[0].amt,quote_amount:B.deals[0].quote_amount,quote_versions:B.deals[0].quote_versions,activities:B.deals[0].activities});});
 await page.getByRole('button',{name:'추후 다시 연락',exact:true}).click();await page.locator('[name=long]').check();
 await page.getByRole('button',{name:'계획 저장'}).click();
 assert.deepEqual(await page.evaluate(()=>[rows[1].operation,B.deals[0].code,pipeFiltered().length]),['transition','waiting',0]);
 assert.match(await page.evaluate(()=>rows[1].payload.fields.reason),/2030/);
 assert.equal(await page.evaluate(()=>JSON.stringify({id:B.deals[0].id,amt:B.deals[0].amt,quote_amount:B.deals[0].quote_amount,quote_versions:B.deals[0].quote_versions,activities:B.deals[0].activities})),await page.evaluate(()=>preserved),'transition preserves deal identity, quote versions, amounts and existing conversation history');
 assert.equal(await page.evaluate(()=>B.deals.length),1,'relationship connection does not clone the opportunity');
 await page.evaluate(()=>{B.deals[0].code=B.deals[0].stage_code='sent';window.fail=true;paint();});
 await page.getByRole('button',{name:'계속 진행',exact:true}).click();await page.getByRole('button',{name:'계획 저장'}).click();
 assert.match(await page.locator('.pc-followup-error').innerText(),/저장 미완료/);
 assert.equal(await page.locator('[name=due]').inputValue(),'2030-12-15');
 assert.equal(await page.evaluate(()=>B.deals[0].code),'sent');
 await page.locator('.pc-followup-dialog [data-close]').first().click();
 await page.getByRole('button',{name:'계속 진행',exact:true}).click();
 assert.equal(await page.locator('[name=due]').inputValue(),'2030-12-15');
 assert.equal(await page.getByRole('button',{name:'계획 저장'}).isDisabled(),true);
 assert.equal(await page.evaluate(()=>rows.length),3,'reopening pending plan never re-enqueues');
 await page.locator('.pc-followup-dialog [data-close]').first().click();
 await page.evaluate(()=>{B.deals.push({id:'22222222-2222-4222-8222-222222222222',site:'다른 현장',code:'sent',version:1});const b=document.createElement('button');b.textContent='다른 현장 계획';b.dataset.followupId=B.deals[1].id;b.dataset.followupMode='later';document.body.appendChild(b);});
 await page.getByRole('button',{name:'다른 현장 계획'}).click();
 assert.equal(await page.getByRole('button',{name:'계획 저장'}).isEnabled(),true);
 await page.locator('[name=due]').fill('2027-04-12');
 await page.evaluate(()=>{rows[2].status='done';rows[2].ack={version:4,next_action_id:'recovered'};dispatchEvent(new Event('phase1:queue'));});
 await page.waitForFunction(()=>B.deals[0].version===4);
 assert.equal(await page.locator('[name=due]').inputValue(),'2027-04-12','other customer draft stays open when ACK arrives');
 await page.locator('.pc-followup-dialog [data-close]').first().click();
 await page.getByRole('button',{name:'다른 현장 계획'}).click();
 assert.equal(await page.locator('[name=due]').inputValue(),'2027-04-12','draft survives close and reopen');
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 console.log('PASS: short/long routing, existing payload normalization, close confirmation handoff, ACK-only update, retained failed draft, no horizontal overflow');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
