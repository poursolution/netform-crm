const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const overlay=require('../operational-overlay.js');

const A='aaaaaaaa-0000-4000-8000-000000000001',Bid='bbbbbbbb-0000-4000-8000-000000000002',Q='cccccccc-0000-4000-8000-000000000003';

test('realtime row patch replaces a changed deal, drops one no longer visible, and repaints only that domain',async()=>{
 const painted=[],reads=[];
 const root={TOKEN:'t',ME:{id:'u'},B:{contract_version:2,deals:[{id:A,site:'old'},{id:Bid,site:'gone'}],inquiries:[{id:Q,site:'keep'}],message_logs:[]},
  Phase1:{profile:null,read:async(resource,args)=>{reads.push([resource,args.domain,args.id]);return {data:{domain:args.domain,id:args.id,item:args.id===A?{id:A,site_name:'새 이름',stage_code:'first_contact',version:3}:null}};},queue:{list:()=>[],flush:async()=>[]}},
  OperationalAdapter:{},addEventListener(){},document:{getElementById:()=>null},applyBundle(bundle,domains){this.B=bundle;painted.push(domains);}};
 overlay.install(root);
 await root.refreshOperationalRows([{domain:'deal_core',id:A},{domain:'deal_core',id:Bid}]);
 assert.deepEqual(reads.map(x=>x[0]),['operational_row','operational_row']);
 assert.deepEqual(painted,[['deal_core']]);
 assert.deepEqual(root.B.deals.map(x=>x.id),[A]);
 assert.equal(root.B.inquiries[0].id,Q,'other domains stay untouched');
});

test('both transports subscribe to the private change channel and read a single row by predecessor cursor',()=>{
 for(const f of ['pc-manager-transport.js','transport.js']){
  const s=fs.readFileSync(path.join(__dirname,'..',f),'utf8');
  assert.match(s,/sdkChannel\('crm:changes',\{config:\{private:true\}\}\)\.on\('broadcast',\{event:'change'\}/);
  assert.match(s,/resource==='operational_row'/);
  assert.match(s,/p_after:uuidBefore\(id\),p_limit:1/);
  const src=s.match(/function uuidBefore\(id\)\{[^\n]+?\}(?=\r?\n)/)[0];
  const uuidBefore=new Function(src+';return uuidBefore;')();
  assert.equal(uuidBefore('aaaaaaaa-0000-4000-8000-000000000001'),'aaaaaaaa-0000-4000-8000-000000000000');
  assert.equal(uuidBefore('aaaaaaaa-0000-4000-8000-000000000000'),'aaaaaaaa-0000-4000-7fff-ffffffffffff');
  assert.equal(uuidBefore('00000000-0000-0000-0000-000000000000'),null);
 }
});

test('after the change channel drops and reconnects, the overlay re-reads deals and inquiries once to fill signals missed while offline',()=>{
 const calls=[];let onStatus=null;
 const root={TOKEN:'t',ME:{id:'u'},B:{contract_version:2,deals:[],inquiries:[],message_logs:[]},
  Phase1:{profile:{auth_uid:'u'},read:async()=>({data:{}}),subscribe:(resource,onSignal,status)=>{onStatus=status;return ()=>{};},queue:{list:()=>[],flush:async()=>[]}},
  OperationalAdapter:{},addEventListener(){},document:{getElementById:()=>null}};
 overlay.install(root);
 root.refreshOperationalDomains=(domains,reason)=>{calls.push([domains,reason]);return Promise.resolve(null);};
 onStatus('SUBSCRIBED');
 assert.equal(calls.length,0,'첫 연결은 첫 로딩이 이미 받았다');
 onStatus('CHANNEL_ERROR');onStatus('SUBSCRIBED');
 assert.deepEqual(calls,[[['deal_core','inquiry_core'],'realtime']]);
 for(const f of ['pc-manager-transport.js','transport.js'])
  assert.match(fs.readFileSync(path.join(__dirname,'..',f),'utf8'),/changesChannel\.subscribe\(status=>\{if\(generation===epoch\)publishRealtimeStatus\(status\);\}\)/,f+' reports the change channel status');
});

test('overlay routes id-bearing signals to row refresh and keeps domain refresh as fallback',()=>{
 const s=fs.readFileSync(path.join(__dirname,'..','operational-overlay.js'),'utf8');
 assert.match(s,/signal=>scheduleRealtime\(signal\.table,signal\)/);
 assert.match(s,/rows\.length>ROW_PATCH_MAX/);
 assert.match(s,/root\.refreshOperationalDomains\(domains,'realtime'\)/);
 assert.ok(fs.existsSync(path.join(__dirname,'..','sql','realtime-change-signal-20260926.sql')),'server trigger SQL ships with the client');
});
