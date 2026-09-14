const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {createRequire}=require('node:module');
const {JSDOM}=createRequire(path.resolve(__dirname,'../../crm-security-lab/package.json'))('jsdom');
test('test composer never sends or alters customer history',()=>{
 const dom=new JSDOM('<div id="campaign-root"></div>',{runScripts:'outside-only'}),w=dom.window;
 let writes=0;w.pushWrite=()=>writes++;w.fetch=()=>{writes++;throw Error('network forbidden')};
 w.paintCampaign=()=>{w.document.getElementById('campaign-root').innerHTML=''};
 w.HTMLDialogElement.prototype.showModal=function(){this.open=true};
 w.HTMLDialogElement.prototype.close=function(){this.dispatchEvent(new w.Event('close'))};
 w.eval(fs.readFileSync(path.resolve(__dirname,'../pc-message-test.js'),'utf8'));
 w.paintCampaign();w.paintCampaign();assert.equal(w.document.querySelectorAll('.pc-message-test-entry').length,1);
 w.document.querySelector('.pc-message-test-entry').click();
 const d=w.document.querySelector('dialog');assert.equal(d.querySelector('[name=phone]').value,'010-3282-5402');assert.ok(d.querySelector('[name=phone]').readOnly);
 for(const channel of ['sms','kakao']){
  const select=d.querySelector('select');select.value=channel;select.dispatchEvent(new w.Event('change'));
  assert.ok(d.querySelector('[data-send]').disabled);assert.match(d.querySelector('[role=status]').textContent,/연동 필요/);
  d.querySelector('[data-preview]').click();assert.ok(!d.querySelector('pre').hidden);
  d.querySelector('[data-send]').click();
 }
 assert.equal(writes,0);w.dispatchEvent(new w.Event('phase1:identity-cleared'));assert.equal(w.document.querySelector('dialog'),null);dom.window.close();
});
