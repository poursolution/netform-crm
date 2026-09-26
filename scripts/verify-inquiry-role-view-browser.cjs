'use strict';

// Localhost-only role-view regression with synthetic inquiries. No CRM reads or writes.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

const root = path.resolve(__dirname, '..');
const types = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json' };
function server() {
  return http.createServer((req, res) => {
    const pathname = decodeURIComponent(new URL(req.url, 'http://127.0.0.1').pathname);
    const rel = pathname === '/' ? 'crm.html' : pathname.replace(/^\/+/, '');
    const target = path.resolve(root, rel);
    if (!target.startsWith(root + path.sep) || !fs.existsSync(target) || !fs.statSync(target).isFile()) {
      res.writeHead(404); res.end(); return;
    }
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Content-Type', types[path.extname(target)] || 'application/octet-stream');
    fs.createReadStream(target).pipe(res);
  });
}

async function run() {
  const srv = server();
  await new Promise(resolve => srv.listen(0, '127.0.0.1', resolve));
  const browser = await chromium.launch({ headless: true, ...(process.env.EDGE_PATH ? { executablePath: process.env.EDGE_PATH } : {}) });
  try {
    const context = await browser.newContext();
    await context.route('**/*', route => new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort());
    const page = await context.newPage();
    await page.goto(`http://127.0.0.1:${srv.address().port}/crm.html`, { waitUntil: 'load' });
    await page.waitForFunction(() => typeof paintInq === 'function' && typeof inqCtlRoleView === 'function' && !!window.InquiryWorkbench && !!window.PCManagerRequests);
    await page.evaluate(async()=>{await Promise.resolve(window.AUTH_READY).catch(()=>{});});
    await page.evaluate(() => {
      const base = { brand: 'POUR솔루션', created_at: '2026-09-10T00:00:00+09:00', valid_inquiry: true };
      B = {
        deals: [], inquiryTrash: [], inquiryCleanupArchived: [],
        inquiries: [
          { ...base, id: 'inq-1', site: '황윤선 최초응대 대기', assignee: '황윤선', status: '배정완료', assigned_at: '2026-09-10T00:30:00+09:00' },
          { ...base, id: 'inq-2', site: '황윤선 다음행동 필요', assignee: '황윤선', status: '응대중', assigned_at: '2026-09-10T01:00:00+09:00', responded_at: '2026-09-10T01:20:00+09:00' },
          { ...base, id: 'inq-3', site: '이필선 문의', assignee: '이필선', status: '배정완료', assigned_at: '2026-09-10T01:10:00+09:00' },
          { ...base, id: 'inq-4', site: '관리자 미배정 문의', assignee: '', status: '접수' }
        ]
      };
      LOCAL = { deals: {}, inquiries: {} };
      G.page = 'inq'; G.inqPeriodMode = 'snapshot'; G.brand = '전체'; G.rep = '전체'; G.workFilter = '전체'; G.q = ''; G.inqBucket = '전체'; G.inqView = 'console'; delete G._inqRoleApplied;
      AUTH_ON = true; ME = { name: '관리자', role: 'admin' };
      document.getElementById('authGate').classList.remove('on');
      document.querySelectorAll('.apage').forEach(node => node.classList.remove('on'));
      document.getElementById('pg-inq').classList.add('on');
      B.inquiries[1].activities=[{id:'reply',type:'전화',at:'2026-09-13T10:00:00+09:00',note:'도면 요청 완료'},{id:'memo',type:'메모',at:'2026-09-14T10:00:00+09:00',note:'내부 메모'}];
      B.inquiries[1].nextActionObj={text:'도면 수신 확인',due:'2026-09-16'};
      goPage('inq');
    });

    await page.evaluate(()=>{B.inquiries[1].brand='POUR공법';B.inquiries[2].brand='석민이앤씨';B.inquiries[3].brand='아파트스퀘어';B.inquiries[0].phone='010-1234-5678';B.inquiries[0].contact_name='테스트 문의자';window.__writes=[];pushWrite=(...args)=>__writes.push(args);window.Phase1={subscribe:()=>()=>{}};window.__stopRequests=PCManagerRequests.install(window,{list:async()=>[],create:async()=>{throw Error("Unexpected request write")}});paintInq()});
    await page.evaluate(()=>{B.inquiries[0].detail={inquiry:'옥상 방수 문의\n도면 확인 요청 <img src=x onerror=alert(1)>',note:'접수 참고',customerType:'테스트건설(주)',channel:'홈페이지',buildingType:'공장',complex:'2개동',responder:'테스트 상담자'};paintInq()});
    await page.locator('#pg-inq').waitFor({state:'visible'});
    assert.match(await page.locator('.inq-work-row[data-k="inq-1"] .inq-question-preview').textContent(),/옥상 방수 문의/);
    await page.evaluate(()=>InquiryWorkbench.open('inq-1'));
    assert.equal(await page.locator('#inq-inbox-dialog .inq-original-text').innerText(),'옥상 방수 문의\n도면 확인 요청 <img src=x onerror=alert(1)>');
    assert.equal(await page.locator('#inq-inbox-dialog .sp-inquiry-original img').count(),0);
    assert.match(await page.locator('#inq-inbox-dialog .inq-source-fields').innerText(),/테스트건설\(주\)/);
    assert.match(await page.locator('#inq-inbox-dialog .inq-source-fields').innerText(),/홈페이지/);
    assert.equal(await page.locator('#inq-inbox-dialog .inq-source-fields dt').count(),12);
    assert.equal(await page.evaluate(()=>InquiryWorkbench.originalText({note:'상담원 기록'})), '');
    assert.equal(await page.evaluate(()=>InquiryWorkbench.originalText({raw:{문의내용:'잔디 문의 원문'}})), '잔디 문의 원문');
    assert.equal(await page.locator('.inq-related').count(),1);
    const related=await page.evaluate(()=>{
      const old=nearbySites,opened=nearbyOpen;let proxy=null,target=null;
      nearbySites=q=>{proxy=q;return {region:'인천 계양',list:[{d:{id:'allowed',site:'같은 지역 현장',assignee:'황윤선'},age:3}]}};
      nearbyOpen=k=>target=k;
      const result=InquiryWorkbench.related({...B.inquiries[0],site:'현장',address:'인천광역시 계양구 계산동'});
      InquiryWorkbench.openRelated('forbidden');
      nearbySites=old;nearbyOpen=opened;
      return {region:result.region,owner:proxy.assignee,target};
    });
    assert.equal(related.region,'인천 계양');assert.equal(related.owner,'황윤선');assert.equal(related.target,null);
    await page.evaluate(()=>InquiryWorkbench.close());
    assert.equal(await page.locator('.inq-task-modes [data-key="needs"]').getAttribute('aria-pressed'),'true');
    assert.deepEqual(await page.locator('.inq-work-row:not(.head)').evaluateAll(es=>es.map(e=>e.dataset.k)),['inq-4','inq-1','inq-3','inq-2']);
    const cases=await page.evaluate(()=>{
      const base={...B.inquiries[1]},day=delta=>{const d=new Date();d.setDate(d.getDate()+delta);return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')};
      return [
        {...base,nextActionObj:{text:'확인 전화',due:day(0)}},
        {...base,nextActionObj:{text:'확인 전화',due:day(2)}},
        {...base,nextActionObj:{text:'확인 전화',due:''}},
        {...base,status:'보류',nextActionObj:{text:'확인 전화',due:day(-2)}},
        {...base,nextActionObj:{text:'확인 전화',due:'invalid'}}
      ].map(q=>{const t=InquiryWorkbench.task(q);return {kind:t.kind,needed:t.needed}});
    });
    assert.deepEqual(cases,[{kind:'followup',needed:true},{kind:'followup',needed:false},{kind:'followup',needed:true},{kind:'closed',needed:false},{kind:'followup',needed:true}]);
    assert.equal(await page.locator('.inq-work-counts b').evaluateAll(es=>es.reduce((sum,e)=>sum+Number(e.textContent),0)),4);
    const model=await page.evaluate(()=>{
      const q={...B.inquiries[1],status:'견적서 발송완료',nextActionObj:null,nextAction:null,nextActionText:''};
      const decision=InquiryWorkbench.task(q);
      const converted=InquiryWorkbench.task({...q,deal_id:'linked'});
      const closed=InquiryWorkbench.task({...q,status:'실주'});
      return {decision:decision.kind,needed:decision.needed,converted:converted.needed,closed:closed.needed};
    });
    assert.deepEqual(model,{decision:'decision',needed:true,converted:false,closed:false});
    assert.deepEqual(await page.locator('.inq-work-row.head>span').allTextContents(),['우선순위','문의','지금 확인하는 이유','지금 할 일','담당자','기한','실행']);
    assert.equal(await page.getByRole('button',{name:'팀 문의',exact:true}).count(),1);
    assert.equal(await page.locator('.inq-work-tools').getAttribute('open'),null);
    assert.equal(await page.locator('.inq-work-tools .inq-ctl-toolbar').isVisible(),false);
    assert.equal(await page.locator('.sales-filterbar [data-sf-brand]').count(),5);
    assert.equal(await page.locator('.inq-work-row[data-k="inq-4"] .inq-ctl-assignee').textContent(),'미배정');
    assert.equal(await page.locator('.inq-work-row[data-k="inq-4"] .inq-work-recent').textContent(),'담당자 배정');
    assert.equal(await page.locator('.inq-work-row[data-k="inq-4"] .inq-work-next').textContent(),'배정 필요');
    assert.equal(await page.locator('.inq-work-row[data-k="inq-4"] .inq-now').textContent(),'배정하기');
    assert.equal(await page.locator('.inq-work-row[data-k="inq-1"] .inq-now').textContent(),'연락 결과 남기기');
    await page.locator('#pg-inq').waitFor({state:'visible'});
    assert.match(await page.locator('.inq-work-row[data-k="inq-2"] .inq-work-recent').textContent(),/도면 요청 완료/);
    assert.doesNotMatch(await page.locator('.inq-work-row[data-k="inq-2"] .inq-work-recent').textContent(),/내부 메모/);
    for(const width of [1920,1440,1024,760,390]){
      await page.setViewportSize({width,height:1000});
      assert.ok(await page.locator('#pg-inq').evaluate(e=>e.scrollWidth<=e.clientWidth+1),'page overflow '+width);
      assert.ok(await page.locator('.inq-ctl-scroll').evaluate(e=>e.scrollWidth<=e.clientWidth+1),'list overflow '+width);
      assert.ok(await page.locator('.inq-work-row:not(.head)').evaluateAll(es=>es.every(e=>(e.getBoundingClientRect().height>=96&&e.getBoundingClientRect().height<=160)||innerWidth<=760)),'row height with manager request at '+width);const buttons=await page.locator('.inq-work-row:not(.head) .inq-now').evaluateAll(es=>es.map(e=>({w:e.getBoundingClientRect().width,h:e.getBoundingClientRect().height,wrap:getComputedStyle(e).whiteSpace})));
      assert.ok(buttons.every(b=>Math.abs(b.w-104)<0.1&&Math.abs(b.h-40)<0.1&&b.wrap==='nowrap'),'button geometry at '+width+': '+JSON.stringify(buttons));
    }
    await page.setViewportSize({width:1440,height:1000});
    if(process.env.INQUIRY_SCREENSHOT)await page.screenshot({path:process.env.INQUIRY_SCREENSHOT,fullPage:true});
    assert.equal(await page.locator('.inq-work-row[data-k="inq-1"] .pc-manager-request-trigger').isVisible(),false);
    await page.locator('.inq-work-row[data-k="inq-1"] .inq-action-menu summary').click();
    await page.locator('.inq-work-row[data-k="inq-1"] .pc-manager-request-trigger').click();assert.equal(await page.getByRole('dialog',{name:'담당자에게 요청',exact:true}).count(),1);await page.getByRole('dialog',{name:'담당자에게 요청',exact:true}).getByRole('button',{name:'닫기',exact:true}).click();await page.locator('.sales-filterbar [data-sf-brand="POUR솔루션"]').click();
    assert.equal(await page.locator('.inq-work-row:not(.head)').count(),1);
    assert.equal(await page.locator('.sales-filterbar [data-sf-brand="POUR공법"] em').textContent(),'1','other brand counts remain visible');
    await page.locator('.sales-filterbar [data-sf-brand="POUR공법"]').click();
    assert.equal(await page.locator('.inq-work-row:not(.head)').count(),2);
    await page.locator('.inq-work-counts [data-key="waiting"]').click();
    assert.equal(await page.locator('.inq-work-row:not(.head)').count(),1);
    await page.locator('.inq-task-modes [data-key="all"]').click();
    await page.locator('.sales-filterbar [data-sf-brand="전체"]').click();
    await page.getByRole('textbox',{name:'문의 검색',exact:true}).fill('01012345678');
    await page.locator('.inq-work-filters').getByRole('button',{name:'검색',exact:true}).click();
    assert.equal(await page.locator('.inq-work-row:not(.head)').count(),1,'phone search handles formatting');
    await page.getByRole('textbox',{name:'문의 검색',exact:true}).fill('테스트 문의자');
    await page.locator('.inq-work-filters').getByRole('button',{name:'검색',exact:true}).click();
    assert.equal(await page.locator('.inq-work-row:not(.head)').count(),1,'contact name search');
    await page.getByRole('textbox',{name:'문의 검색',exact:true}).fill('');
    await page.locator('.inq-work-filters').getByRole('button',{name:'검색',exact:true}).click();
    await page.locator('.inq-work-counts [data-key="unassigned"]').click();
    assert.equal(await page.locator('.inq-work-row:not(.head)').count(),1);
    await page.locator('.inq-work-row[data-k="inq-4"] .inq-now').click();
    assert.equal(await page.evaluate(()=>INQ_CTL_MODAL.keys[0]),'inq-4');
    await page.evaluate(()=>closeInquiryControlModal());
    await page.locator('.inq-work-counts [data-key="followup"]').click();
    assert.equal(await page.locator('.inq-work-row:not(.head)').count(),await page.evaluate(()=>inqCtlScopeActive().filter(q=>InquiryWorkbench.matches(q,'followup')).length));
    await page.locator('.inq-task-modes [data-key="all"]').click();
    await page.locator('.inq-work-row[data-k="inq-1"] .inq-now').click();
    assert.equal(await page.getByRole('dialog',{name:'황윤선 최초응대 대기',exact:true}).count(),1);
    assert.equal(await page.evaluate(()=>G.inqSelKey),'inq-1');assert.equal(await page.locator('#iq-next').count(),1,'response requires next action in canonical progress form');await page.getByRole('button',{name:'연락 결과 저장',exact:true}).click();assert.match(await page.locator('#iq-msg').textContent(),/한 일|did|필수|required|INVALID/i);
    assert.equal(await page.locator('#inq-inbox-dialog .inq-dialog-columns>aside').count(),2);
    assert.equal(await page.locator('#inq-inbox-dialog .sp-inquiry-original').count(),1);
    await page.locator('#inq-inbox-dialog').getByRole('button',{name:/상담·영업담당/}).click();
    await page.getByRole('button',{name:'영업담당 배정 창',exact:true}).click();
    assert.equal(await page.locator('#inquiryControlModal.on').count(),1);
    assert.ok(await page.evaluate(()=>Number(getComputedStyle(document.getElementById('inquiryControlModal')).zIndex)>Number(getComputedStyle(document.getElementById('inq-inbox-dialog')).zIndex)));
    await page.evaluate(()=>closeInquiryControlModal());
    const size=await page.locator('.inq-dialog').boundingBox();assert.ok(size.width>=1440-228-2&&size.height>=900,'inquiry detail page fills the content area');
    await page.locator('#inq-inbox-dialog').getByRole('button',{name:'📞 연락 결과',exact:true}).click();
    await page.locator('#iq-res').fill('저장 전 초안 유지');
    await page.evaluate(()=>paintInq());
    assert.equal(await page.locator('#iq-res').inputValue(),'저장 전 초안 유지');
    assert.equal(await page.locator('[aria-label="문의 업무 관리"] #iq-res').count(),1);
    assert.equal(await page.locator('#inq-inbox-dialog main input,#inq-inbox-dialog main textarea').count(),0);
    await page.locator('.spform').getByRole('button',{name:'닫기',exact:true}).click();
    await page.locator('#inq-inbox-dialog').getByRole('button',{name:/다음 할 일/}).first().click();
    assert.equal(await page.locator('#spNextText').count(),1);
    assert.equal(await page.locator('#inq-inbox-dialog .spform').count(),0,'next schedule must not coexist with response form');
    assert.equal(await page.locator('[aria-label="문의 업무 관리"] #spNextText').count(),1);
    await page.locator('.sp-form').getByRole('button',{name:'취소',exact:true}).click();
    await page.locator('#inq-inbox-dialog').getByRole('button',{name:/상태 변경/}).click();
    assert.equal(await page.locator('#spStatus').count(),1);
    await page.locator('.sp-form').getByRole('button',{name:'취소',exact:true}).click();
    if(process.env.INQUIRY_DETAIL_SCREENSHOT)await page.screenshot({path:process.env.INQUIRY_DETAIL_SCREENSHOT});
    await page.getByRole('button',{name:'← 목록으로',exact:true}).click();
    assert.equal(await page.locator('#inq-inbox-dialog').count(),0);
    assert.equal(await page.locator('.inq-work-row:not(.head)').count(),4);
    await page.locator('.inq-work-row[data-k="inq-2"] .inq-next-link').click();
    assert.equal(await page.evaluate(()=>G.inqSelKey),'inq-2');assert.equal(await page.locator('#spNextText').count(),1);
    await page.getByRole('button',{name:'← 목록으로',exact:true}).click();
    await page.evaluate(()=>{window.__originalInquiries=B.inquiries;B.inquiries=B.inquiries.concat(Array.from({length:35},(_,i)=>({...B.inquiries[0],id:'scroll-'+i,site:'스크롤 검증 '+i})));paintInq();window.scrollTo(0,900)});
    assert.ok(await page.locator('.inq-inbox-sticky').evaluate(e=>Math.abs(e.getBoundingClientRect().top)<2),'brand and filters stick while scrolling');
    await page.evaluate(()=>{B.inquiries=__originalInquiries;paintInq();window.scrollTo(0,0)});
    await page.evaluate(()=>{ME={name:'황윤선',role:'rep'};G.inqRoleView='admin';paintInq()});
    assert.equal(await page.getByRole('button',{name:'팀 문의',exact:true}).count(),0);
    assert.equal(await page.locator('.inq-work-row:not(.head)').count(),2);
    assert.equal(await page.locator('.inq-ctl-bulk').count(),0);
    assert.equal(await page.locator('.inq-work-row input[type="checkbox"]').count(),0);
    await page.evaluate(()=>inqCtlOpenSingle('inq-3'));
    assert.equal(await page.locator('#inq-inbox-dialog').count(),0,'foreign inquiry cannot open');
    await page.locator('.inq-work-row[data-k="inq-1"] .inq-now').click();
    assert.equal(await page.locator('#inq-inbox-dialog').getByRole('button',{name:/상담·영업담당/}).count(),0);
    await page.getByRole('button',{name:'← 목록으로',exact:true}).click();
    await page.evaluate(()=>{
      InquiryWorkbench.open('inq-1','process');
      const saved=iqApply;let captured=null;iqApply=(q,target)=>{captured={id:q.id,target};return false};
      InquiryWorkbench.saveProcess();iqApply=saved;
      if(captured.id!=='inq-1'||captured.target!=='step:1')throw Error('First response must not advance to quote');
      const q={...B.inquiries[1],nextActionObj:{text:'약속한 확인',due:'2099-01-01'}};
      Phase1.queue={list:()=>[{object_id:q.id,operation:'inquiry_status',status:'pending'}]};
      if(!InquiryWorkbench.task(q).needed)throw Error('Pending write cannot clear today');
      Phase1.queue={list:()=>[{object_id:q.id,operation:'inquiry_status',status:'rejected'}]};
      if(!InquiryWorkbench.task(q).needed)throw Error('Rejected write cannot clear today');
      Phase1.queue={list:()=>[]};
      if(InquiryWorkbench.task(q).needed)throw Error('Future task should leave today after confirmation');
      InquiryWorkbench.close();
    });
    /* 열림 규칙(2026-09-26): 오늘 업무에서 연 문의도 견적문의와 같은 전체 상세 — 닫으면 오늘 업무로, 메뉴를 누르면 상세가 남지 않는다 */
    await page.evaluate(()=>goPage('today'));
    await page.evaluate(()=>drwInq(JSON.stringify(B.inquiries.find(q=>q.id==='inq-1'))));
    assert.equal(await page.locator('#inq-inbox-dialog').count(),1,'Today opens the same inquiry detail page');
    assert.equal(await page.locator('#detailView.on').count(),0,'no small read-only inquiry window');
    await page.getByRole('button',{name:'← 목록으로',exact:true}).click();
    assert.equal(await page.evaluate(()=>G.page),'today','closing returns to Today');
    await page.evaluate(()=>drwInq(JSON.stringify(B.inquiries.find(q=>q.id==='inq-1'))));
    await page.evaluate(()=>goPage('dash'));
    assert.equal(await page.locator('#inq-inbox-dialog').count(),0,'menu navigation closes the inquiry detail page');
    await page.evaluate(()=>goPage('inq'));
    assert.equal(await page.evaluate(()=>__writes.length),0);
    const save=await page.evaluate(()=>{ Phase1.storage={setItem:()=>{}};
      const q={...B.inquiries[0],id:'10000000-0000-4000-8000-000000000001',first_response_at:null,responded_at:null};B.inquiries=[q];LOCAL.inquiries={};
      InquiryWorkbench.open(q.id,'process');
      document.getElementById('iq-did').value='고객 통화';document.getElementById('iq-res').value='사진 전달 약속';document.getElementById('iq-next').value='사진 수신 확인';document.getElementById('iq-due').value='2099-01-01';
      const result=InquiryWorkbench.saveProcess();return {result,writes:__writes,needed:InquiryWorkbench.task(q).needed,error:document.getElementById("iq-msg")?.textContent};
    });
    assert.equal(save.result,true,JSON.stringify(save));assert.equal(save.writes.length,1);assert.equal(save.writes[0][0],'inquiry_status');assert.equal(save.writes[0][1].intent,'progress');assert.equal(save.writes[0][1].target,'step:1');assert.equal(save.needed,false);

    console.log(JSON.stringify({status:'PASS',admin_rows:4,rep_rows:2,brand_multiselect:true,brand_counts:true,contact_search:true,seven_columns:true,action_geometry:true,wide_dialog:true,draft_preserved:true,foreign_inquiry_blocked:true,existing_assignment:true,viewports:[1920,1440,1024,760,390],external_writes:0,synthetic_progress_commands:1}));
  } finally {await browser.close();await new Promise(resolve=>srv.close(resolve));}
}
run().catch(error=>{console.error(error.stack||error);process.exitCode=1});
