const test=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
test('library reads contracts without a Deal and reports errors instead of empty success',async()=>{
 const button={},detail={},content={querySelectorAll:()=>[],querySelector:()=>detail};
 const panel={querySelector:s=>s==='button'?button:content};
 const host={querySelector:()=>null,prepend:()=>{}};
 const win=setup({getElementById:()=>host,createElement:()=>panel});
 let args;
 win.SB={rpc:async(name,input)=>{args={name,input};return {data:{ok:true,items:[{site_name:'<test>',site_linked:false,contracts:[]}],next_cursor:null}}}};
 await button.onclick();
 assert.equal(args.name,'crm_advisory_library_read_v1');
 assert.deepEqual(JSON.parse(JSON.stringify(args.input)),{p_after:null});
 assert.match(content.innerHTML,/현장 연결 검토 필요/);
 assert.match(content.innerHTML,/&lt;test&gt;/);
 assert.equal(button.disabled,false);
 win.SB.rpc=async()=>({error:{code:'42501'}});await button.onclick();
 assert.match(content.textContent,/조회하지 못했습니다/);
});
function setup(document={}){const window={};vm.runInNewContext(fs.readFileSync(require('node:path').join(__dirname,'../technical-advisory-ui.js'),'utf8'),{window,document,URL});return window;}

test('legacy document explains missing amount without exposing internal status codes',()=>{
 const html=setup().TechnicalAdvisoryUI.html([{contracts:[{source_structure:'legacy_modusign',source_status:'document_all_signed',document_amount:null}]}]);
 assert.ok(html.includes('서명 완료'));assert.ok(html.includes('금액 미확인'));
 assert.ok(html.includes('과거 전자계약'));assert.ok(!html.includes('document_all_signed'));
 assert.ok(!html.includes('0원'));
});
test('contract display escapes source data, blocks unsafe links, and distinguishes performance',()=>{
 const ui=setup().TechnicalAdvisoryUI;
 const text=ui.html([{contracts:[{company_name:'<img src=x onerror=alert(1)>',document_amount:20300000,document_url:'javascript:alert(1)',contract_kind:'initial_contract',source_status:'completed'}]}]);
 assert.ok(text.includes('20,300,000원'));assert.ok(text.includes('서명 완료'));
 assert.ok(text.includes('&lt;img'));assert.ok(!text.includes('<img'));assert.ok(!text.includes('href='));
 assert.ok(text.includes('실적 인정일이 아니며'));assert.ok(ui.html([]).includes('연결된 기술자문 계약이 없습니다'));
});
test('late contract response does not populate another selected deal and RPC errors are not empty success',async()=>{
 const content={},button={},panel={dataset:{},isConnected:true,querySelector:s=>s==='button'?button:content};
 const win=setup({createElement:()=>panel});win.CUR_DETAIL={item:{id:'one'}};
 let resolve;win.SB={rpc:()=>new Promise(r=>resolve=r)};
 const host={querySelector:()=>null,append:()=>{}};
 win.TechnicalAdvisoryUI.mount(host,'one');win.CUR_DETAIL.item.id='two';
 resolve({data:{ok:true,items:[{contracts:[{company_name:'WRONG DEAL'}]}]}});await new Promise(setImmediate);
 assert.equal(content.innerHTML,undefined);
 win.CUR_DETAIL.item.id='one';win.SB.rpc=async()=>({error:{code:'42501'}});
 await button.onclick();assert.match(content.textContent,/조회하지 못했습니다/);
});
