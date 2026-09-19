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
    await page.goto(`http://127.0.0.1:${srv.address().port}/crm.html`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => typeof paintInq === 'function' && typeof inqCtlRoleView === 'function');
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


    await page.evaluate(async()=>{
      window.__manualCalls=[];window.__manualReadable=false;window.__manualMap=new Map();window.__created=null;
      const profile={auth_uid:'11111111-1111-4111-8111-111111111111',user_id:'22222222-2222-4222-8222-222222222222'};
      window.Phase1={profile,storage:{getItem:k=>__manualMap.get(k)||null,setItem:(k,v)=>__manualMap.set(k,v),removeItem:k=>__manualMap.delete(k)},
        rpc:async(name,args)=>{if(name==='crm_inquiry_manual_capability_v1')return{contract_version:1,can_create:true};__manualCalls.push(args);__created={...args.p_payload,id:'44444444-4444-4444-8444-444444444444',site:args.p_payload.site_name,valid_inquiry:true,status:'접수',created_at:new Date().toISOString()};return{ok:true,contract_version:1,operation:'inquiry_manual_create',request_id:args.p_request_id,inquiry_id:__created.id,actor_auth_uid:profile.auth_uid,actor_user_id:profile.user_id,status:'접수',assigned_to:null,replayed:false,server_at:new Date().toISOString()};},
        read:async()=>({data:{inquiries:__manualReadable?[__created]:[]}})};
      window.loadData=async()=>{if(__manualReadable&&!B.inquiries.some(q=>q.id===__created.id))B.inquiries.push(__created);return B;};
      await InquiryCreate.refresh();paintInq();
    });
    await page.getByRole('button',{name:'+ 문의 등록',exact:true}).click();
    const dialog=page.getByRole('dialog',{name:'신규 문의 등록',exact:true});
    for(const width of [1440,760,390]){await page.setViewportSize({width,height:900});assert.ok(await dialog.evaluate(e=>e.scrollWidth<=e.clientWidth+1),'registration dialog overflow '+width);assert.ok(await dialog.evaluate(e=>{const r=e.getBoundingClientRect();return Math.abs((innerWidth-r.width)/2-r.x)<2&&r.y>=0}),'centered dialog '+width);}
    await page.setViewportSize({width:1440,height:1000});
    await dialog.getByRole('textbox',{name:'현장명',exact:true}).fill('합성 신규 등록 현장');
    await dialog.getByRole('textbox',{name:'문의자',exact:true}).fill('합성 문의자');
    await dialog.getByRole('textbox',{name:'문의 내용',exact:true}).fill('견적문의 수동 등록 흐름 검증');
    if(process.env.INQUIRY_CREATE_SCREENSHOT)await page.screenshot({path:process.env.INQUIRY_CREATE_SCREENSHOT});
    await dialog.getByRole('button',{name:'문의 등록',exact:true}).click();
    await dialog.getByRole('button',{name:'목록 다시 확인',exact:true}).waitFor();
    assert.match(await dialog.getByRole('status').textContent(),/등록은 확인/);
    assert.equal(await page.evaluate(()=>__manualCalls.length),1);
    assert.equal(await dialog.getByRole('textbox',{name:'현장명',exact:true}).isEnabled(),false);
    await dialog.getByRole('button',{name:'닫기',exact:true}).last().click();
    await page.getByRole('button',{name:'+ 문의 등록',exact:true}).click();
    assert.equal(await dialog.getByRole('textbox',{name:'현장명',exact:true}).inputValue(),'합성 신규 등록 현장');
    await page.evaluate(()=>{__manualReadable=true});
    await dialog.getByRole('button',{name:'목록 다시 확인',exact:true}).click();
    await dialog.waitFor({state:'detached'});
    assert.equal(await page.evaluate(()=>__manualCalls.length),1,'read-back does not create a second inquiry');
    assert.equal(await page.evaluate(()=>__manualMap.size),0);
    assert.equal(await page.locator('.inq-work-row[data-k="44444444-4444-4444-8444-444444444444"] .inq-now').textContent(),'배정');
    await page.evaluate(async()=>{Phase1.rpc=async()=>({contract_version:1,can_create:false});await InquiryCreate.refresh()});
    assert.equal(await page.getByRole('button',{name:'+ 문의 등록',exact:true}).count(),0);
    console.log('Manual inquiry browser: form, responsive widths, read-back retry, unassigned list and permission gating passed');
  }finally{await browser.close();await new Promise(resolve=>srv.close(resolve));}
}
run().catch(e=>{console.error(e);process.exitCode=1});
