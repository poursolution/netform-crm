'use strict';

const http=require('node:http');
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const {createRequire}=require('node:module');
const {chromium}=createRequire(path.resolve(__dirname,'../../crm-security-lab/package.json'))('playwright');
const root=path.resolve(__dirname,'..');

function server(){return http.createServer((req,res)=>{const rel=decodeURIComponent(new URL(req.url,'http://127.0.0.1').pathname).replace(/^\/+/, '')||'crm.html',target=path.resolve(root,rel);if(!target.startsWith(root+path.sep)||!fs.existsSync(target)){res.writeHead(404);return res.end();}res.setHeader('Cache-Control','no-store');fs.createReadStream(target).pipe(res);});}

async function run(){
  const srv=server();await new Promise(resolve=>srv.listen(0,'127.0.0.1',resolve));
  const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
  try{
    const context=await browser.newContext({viewport:{width:1100,height:800}});
    await context.route('**/*',route=>new URL(route.request().url()).hostname==='127.0.0.1'?route.continue():route.abort());
    const page=await context.newPage();
    await page.goto(`http://127.0.0.1:${srv.address().port}/crm.html`,{waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>typeof advisoryPanel==='function'&&typeof openOriginBusinessEdit==='function');
    await page.evaluate(()=>{
      const item={id:'f6090900-0001-4000-8000-000000000001',site:'테스트 기술자문',assignee:'황윤선',brand:'기술자문',currentBusiness:'기술자문',originBusiness:'아파트스퀘어',version:7};
      ME={name:'황윤선',role:'rep',permission_role:'rep'};CUR_DETAIL={kind:'deal',item};
      document.body.innerHTML='<main style="padding:24px">'+advisoryPanel(item)+'</main><div id="detailErr"></div>';
      window.__originWrites=[];window.pushWrite=(op,payload)=>{window.__originWrites.push({op,payload});return 'test-request'};
      window.showDetailErr=()=>{};
    });
    assert.match(await page.locator('.origin-source-card').innerText(),/아파트스퀘어/);
    await page.getByRole('button',{name:'원천 브랜드 수정'}).click();
    assert.match(await page.locator('.origin-source-editor').innerText(),/현재 사업유형 기술자문은 유지됩니다/);
    await page.locator('#origin-biz-to').selectOption({label:'POUR솔루션'});
    await page.locator('#rs-origin-biz-text').fill('원 문의 경로를 확인하여 정정함');
    await page.getByRole('button',{name:'서버에 저장'}).click();
    const result=await page.evaluate(()=>({writes:window.__originWrites,item:CUR_DETAIL.item}));
    assert.equal(result.writes.length,1);assert.equal(result.writes[0].op,'origin_business_correct');
    assert.equal(result.writes[0].payload.to_origin,'POUR솔루션');
    assert.equal(result.item.originBusiness,'아파트스퀘어');
    assert.equal(result.item.currentBusiness,'기술자문');
    await page.evaluate(()=>{ME={name:'다른담당자',role:'rep',permission_role:'rep'};document.body.innerHTML=advisoryPanel(CUR_DETAIL.item);});
    assert.equal(await page.getByRole('button',{name:'원천 브랜드 수정'}).count(),0);
    assert.match(await page.locator('.origin-source-card').innerText(),/담당자 또는 관리자만 수정/);
    console.log(JSON.stringify({status:'PASS',source_visible:true,assigned_rep_edit:true,other_rep_edit:false,current_business_unchanged:true,server_writes:0}));
  }finally{await browser.close();await new Promise(resolve=>srv.close(resolve));}
}

run().catch(error=>{console.error(error.stack||error);process.exitCode=1;});
