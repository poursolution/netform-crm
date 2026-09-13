'use strict';
// Read-only UI audit: synthetic records, localhost only, no live credentials or writes.
const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const {createRequire}=require('node:module');
const {chromium}=createRequire(path.resolve(__dirname,'../../crm-security-lab/package.json'))('playwright');
const root=path.resolve(__dirname,'..');
async function run(){
 const server=http.createServer((req,res)=>{const rel=decodeURIComponent(new URL(req.url,'http://127.0.0.1').pathname).replace(/^\/+/,''),file=path.resolve(root,rel||'crm.html');if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404);return res.end()}res.setHeader('Content-Type',({'.html':'text/html; charset=utf-8','.js':'application/javascript; charset=utf-8','.css':'text/css; charset=utf-8'})[path.extname(file)]||'application/octet-stream');fs.createReadStream(file).pipe(res)});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
 try{
  const context=await browser.newContext({viewport:{width:1365,height:768}});
  await context.route('**/*',r=>new URL(r.request().url()).hostname==='127.0.0.1'?r.continue():r.abort());
  const page=await context.newPage();
  await page.goto(`http://127.0.0.1:${server.address().port}/crm.html`,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>typeof drwInq==='function'&&typeof quickPanelHTML==='function');
  const result=await page.evaluate(()=>{
   FIELD_DEMO=true;ME={name:'테스트 담당자',email:'audit@crm.local'};
   const deal={id:'2f98178e-a70e-4c21-8304-2a6ad7b627e8',site:'검수 합성현장',brand:'POUR솔루션',assignee:'황윤선',code:'sent',stage_code:'sent',stage:'자료 발송완료',created:'2026-09-01',amt:120000000,quoteAmt:115000000,wonAmt:0,work:'옥상 방수',manager_name:'합성 관리소장',manager_mobile:'01000000000',activities:[],nextActionObj:{id:'2b3c7b82-42f0-47f4-b1d1-39127c66554e',type:'전화',text:'검토 확인',due:'2026-09-20',assignee:'황윤선',status:'open'}};
   const inquiry={id:'69caf08e-daea-4eac-aa39-82c85f1f3d08',site:deal.site,brand:'아파트스퀘어',status:'신규',assignee:'김성민',created:'2026-09-13',note:'별도 공사 문의'};
   B={deals:[deal],inquiries:[inquiry],users:[],sales_people:[],activities:[],sites:[],contacts:[],dups:[],expansion_pool:[],expansionPool:[],expansion_events:[],customerSupportActions:[],customer_support_actions:[],messageLogs:[],message_logs:[],campaigns:[],campaign_logs:[],repManagerComments:[],rep_manager_comments:[]};
   LOCAL={deals:{},inquiries:{}};saveLocal=()=>{};pushWrite=()=>{};
   G.page='pipe';G._detailPopup=true;G.detailTab='개요';G.actFilter='전체';G.splitKey=dealKey(deal);G.splitForm=null;
   const out={};
   drwInq(JSON.stringify(inquiry));out.same_name_without_explicit_link={kind:CUR_DETAIL.kind,id:CUR_DETAIL.item.id,assignee:CUR_DETAIL.item.assignee};
   inquiry.opportunity_id=deal.id;drwInq(JSON.stringify(inquiry));out.explicit_link={kind:CUR_DETAIL.kind,id:CUR_DETAIL.item.id};
   inquiry.site='별도 미전환 합성문의';delete inquiry.opportunity_id;drwInq(JSON.stringify(inquiry));
   out.unconverted_inquiry={kind:CUR_DETAIL.kind,amount_fields:['dv-qamt','dv-amt','dv-wamt'].filter(id=>document.getElementById(id))};
   drwDeal(JSON.stringify(deal));detailTabFocus('개요',true);
   out.deal={tabs:Array.from(document.querySelectorAll('.detailtabs button')).map(e=>e.textContent.trim()),overview_headings:Array.from(document.querySelectorAll('.dsec[data-sec="개요"] h3')).map(e=>e.textContent.trim()),contact_inputs:document.querySelectorAll('#contactCard input').length};
   detailTabFocus('현장·견적',true);out.deal.editable_amount_fields=['dv-qamt','dv-amt','dv-wamt'].filter(id=>{const e=document.getElementById(id);return e&&!e.readOnly&&!e.disabled});
   const writes=[];pushWrite=(op,payload)=>writes.push({op,payload});
   document.getElementById('dv-qamt').value='116000000';document.getElementById('dv-amt').value='120000000';document.getElementById('dv-wamt').value='0';saveBasics();out.amount_save={writes,local_quote:deal.quoteAmt};
   pushWrite=(op,payload)=>OperationalAdapter.normalize(op,payload.opportunity_id,1,payload);
   document.getElementById('dv-wamt').value='1000';
   try{saveBasics()}catch(e){out.rejected_amount_save={error:e.message,local_won_after_rejection:deal.wonAmt}}
   closeDrw();G.splitForm=null;const host=document.createElement('div');host.id='auditQuick';host.innerHTML=quickPanelHTML(deal);document.body.appendChild(host);
   out.quick_buttons=Array.from(host.querySelectorAll('button')).map(e=>e.textContent.trim());
   document.getElementById('authGate').style.display='none';
   // Keep the real quick-button handlers; scope their repaint to the synthetic panel.
   paint=()=>{host.innerHTML=quickPanelHTML(deal)};
   window.__detailAudit=out;
   return out;
  });
  for(const [kind,input] of [['act','sp-act-note'],['next','sp-na-text']]){
   await page.locator(`#auditQuick button[onclick="splitForm('${kind}')"]`).click();
   await page.waitForSelector('#'+input,{state:'visible'});
   result['quick_'+kind]={modal:await page.locator('#splitEditModal').getAttribute('aria-hidden'),input_visible:await page.locator('#'+input).isVisible()};
   await page.evaluate(()=>splitForm(null));
  }
  const adapter=require('../operational-adapter.js'),id='2f98178e-a70e-4c21-8304-2a6ad7b627e8';
  result.adapter={};
  for(const [name,won] of [['zero_won',null],['nonzero_won',1000]])try{adapter.normalize('amount',id,1,{opportunity_id:id,amount:120000000,quote_amount:116000000,won_amount:won});result.adapter[name]='accepted at adapter only'}catch(e){result.adapter[name]=e.message}
  console.log(JSON.stringify({scope:'localhost synthetic; no Production writes',...result},null,2));
 }finally{await browser.close();await new Promise(r=>server.close(r))}
}
run().catch(e=>{console.error(e);process.exitCode=1});
