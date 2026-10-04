'use strict';
/* 근처 영업 현황 검사(2026-10-01 대표 "배정되면 해당 영업사원 근처 영업 단지가 사라졌어")
   미배정: 그 지역에서 누가 몇 곳 영업 중인지 + 배정 목록 담당자 줄에 '지역 진행 N곳' / 배정됨: 담당자의 같은 지역 현장(주소로도 맞춤) */
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'..');
const srv=http.createServer((req,res)=>{const t=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(!fs.existsSync(t)||!fs.statSync(t).isFile()){res.writeHead(404);return res.end()}res.setHeader('Content-Type',t.endsWith('.js')?'text/javascript':t.endsWith('.css')?'text/css':'text/html');fs.createReadStream(t).pipe(res)});
(async()=>{
 await new Promise(r=>srv.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({headless:true});
 try{
  const ctx=await browser.newContext({viewport:{width:1600,height:950},timezoneId:'Asia/Seoul'});
  await ctx.route('**/*',r=>new URL(r.request().url()).hostname==='127.0.0.1'?r.continue():r.abort());
  const page=await ctx.newPage(),errs=[];page.on('pageerror',e=>errs.push(e.message));
  await page.goto(`http://127.0.0.1:${srv.address().port}/crm.html`);await page.waitForFunction(()=>window.InquiryWorkbench&&window.PipelineWorkspace);
  await page.evaluate(()=>{
   const at=new Date(Date.now()-3*36e5).toISOString();
   const mk=(id,site,owner,extra)=>Object.assign({id,site,assignee:owner,brand:'POUR솔루션',created:CUR_Y+'-06-01',code:'consulting',stage_code:'consulting',grp:'영업·관리',amt:1e8},extra||{});
   B={deals:[mk('d1','[경기 용인] 신갈현대아파트','이필선'),mk('d2','수지 신정마을','이필선',{address:'경기도 용인시 수지구 풍덕천동 1'}),mk('d3','[경기 용인] 역북금강','황윤선'),mk('d4','[서울 강북] 번동한진','이필선')],
    inquiries:[{id:'11111111-1111-4111-8111-111111111111',site:'용인 동백 호수마을',address:'경기도 용인시 기흥구 동백동 1',status:'접수',at,created_at:at,brand:'POUR솔루션',phone:'010-1111-2222',raw:{'문의내용':'옥상 방수 문의'}},
     {id:'22222222-2222-4222-8222-222222222222',site:'[경기 용인] 구갈 한양',assignee:'이필선',assigned_to:'이필선',assigned_at:at,status:'배정완료',at,created_at:at,brand:'POUR솔루션',phone:'010-3333-4444',raw:{'문의내용':'재도장 문의'}}],activities:[],inquiryTrash:[]};
   LOCAL={deals:{},inquiries:{}};AUTH_ON=true;G.inqDetailV3Off=true;ME={id:'admin',name:'송보람',role:'admin'};G.year='전체';G.quarter=0;G.rep='전체';G.brand='전체';G.workFilter='전체';G.q='';G.inqPeriodMode='snapshot';
   document.getElementById('authGate').classList.remove('on');document.getElementById('load').style.display='none';window.pushWrite=()=>{};goPage('inq');
  });
  assert.deepEqual(await page.evaluate(()=>regionOwnerCounts('경기 용인')),{'이필선':2,'황윤선':1},'주소만 있는 건도 지역으로 묶인다');
  /* 미배정 문의 */
  await page.evaluate(()=>InquiryWorkbench.open('11111111-1111-4111-8111-111111111111'));await page.waitForTimeout(300);
  /* 새 상세 모달(v2): 배정 목록의 담당자 줄에 '<지역> 진행 N곳' */
  await page.locator('#inq-inbox-dialog.idv [data-idv="showall"]').click().catch(()=>{});
  const rows=await page.evaluate(()=>[].map.call(document.querySelectorAll('#inq-inbox-dialog.idv .idv-rep'),b=>(b.querySelector('b')?.textContent||'')+'|'+(b.querySelector('small')?.textContent||'')));
  assert.ok(rows.some(x=>/^이필선.*경기 용인 진행 2곳/.test(x)),'배정 목록 '+rows.join(' / '));
  assert.ok(rows.some(x=>/^한준엽.*경기 용인 진행 없음/.test(x)),'진행 없음 표기 '+rows.join(' / '));
  await page.evaluate(()=>InquiryWorkbench.close());
  /* 배정된 문의: 담당자의 같은 지역 현장(주소로도 맞춤) */
  await page.evaluate(()=>InquiryWorkbench.open('22222222-2222-4222-8222-222222222222'));await page.waitForTimeout(300);
  const box=await page.evaluate(()=>{const s=document.querySelector('#inq-inbox-dialog.idv .idv-near');return s&&{text:s.innerText.replace(/\s+/g,' '),items:s.querySelectorAll('.idv-ncard').length}});
  assert.ok(box&&box.items===2&&/신갈현대아파트/.test(box.text)&&/수지 신정마을/.test(box.text),'배정됨: 담당자의 같은 지역 현장 2곳 '+JSON.stringify(box));
  assert.deepEqual(errs,[]);
  console.log(JSON.stringify({status:'PASS',unassigned_region_summary:true,assign_rows_near:true,assigned_sites:box.items}));
 }finally{await browser.close();srv.close();}
})().catch(e=>{console.error(e);process.exit(1)});
