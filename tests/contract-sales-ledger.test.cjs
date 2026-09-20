const test=require('node:test');
const assert=require('node:assert/strict');
const L=require('../contract-sales-ledger.js');
const signed=(overrides={})=>L.initial({deal_id:'A',event_id:'sign-A',contract_signed:true,contract_date:'2026-09-18',contract_amount:300000000,sales_owner:'hwang',sales_owner_name:'황윤선',...overrides});
test('signing recognizes the amount before construction regardless of current stage or owner',()=>{
  for(const stage of ['contract','construction','completion','won','expansion']){
    const result=L.summarize([[signed({stage,current_owner:'jung'})]],{year:2026,month:9});
    assert.equal(result.netAmount,300000000);assert.equal(result.count,1);
    assert.equal(result.rows[0].sales_owner,'hwang');
  }
});
test('signing requires signed status, verified date, positive integer amount and frozen owner',()=>{
  for(const patch of [{contract_signed:false},{contract_date:'2026-02-30'},{contract_date:''},{contract_amount:null},{contract_amount:0},{contract_amount:-1},{contract_amount:'300'},{sales_owner:''}])assert.throws(()=>signed(patch));
});
test('cancellation is an October negative event and preserves September',()=>{
  const events=L.append([signed()],{event_id:'cancel-A',expected_version:1,kind:'cancelled',effective_date:'2026-10-01',reason:'고객 계약 해지'});
  assert.equal(L.summarize([events],{month:9}).netAmount,300000000);
  const oct=L.summarize([events],{month:10});
  assert.equal(oct.newAmount,0);assert.equal(oct.cancellationAmount,-300000000);assert.equal(oct.count,0);
  assert.equal(L.summarize([events]).netAmount,0);assert.equal(events[0].amount_delta,300000000);
});
test('amendments recognize only delta on amendment date; cancellation reverses latest balance',()=>{
  let events=L.append([signed()],{event_id:'amend-A',expected_version:1,kind:'amended',effective_date:'2026-10-03',amount_delta:50000000,reason:'범위 추가',sales_owner:'jung'});
  assert.equal(L.summarize([events],{month:9}).netAmount,300000000);
  assert.equal(L.summarize([events],{month:10}).netAmount,50000000);
  assert.equal(events[1].sales_owner,'hwang');
  events=L.append(events,{event_id:'reduce-A',expected_version:2,kind:'amended',effective_date:'2026-10-05',amount_delta:-20000000,reason:'범위 축소'});
  events=L.append(events,{event_id:'cancel-A',expected_version:3,kind:'cancelled',effective_date:'2026-11-01',reason:'해지'});
  assert.equal(events[3].amount_delta,-330000000);assert.equal(L.summarize([events]).netAmount,0);
});
test('concurrent versions, duplicate events, attribution edits and incomplete streams fail closed',()=>{
  const e=signed();
  assert.throws(()=>L.append([e],{expected_version:0}),/VERSION/);
  assert.throws(()=>L.validate([e,{...e,sequence:2}]),/DUPLICATE/);
  assert.throws(()=>L.validate([e,{...e,sequence:2,event_id:'b',sales_owner:'jung'}]),/OWNER/);
  assert.throws(()=>L.validate([{...e,sequence:2}]),/SEQUENCE/);
  assert.throws(()=>L.summarize([[e],[e]]),/DUPLICATE_CONTRACT/);
});
test('closed, expected and current owner fields do not produce invented historical performance',()=>{
  assert.throws(()=>L.initial({deal_id:'A',event_id:'e',stage:'won',closed_at:'2026-09-18',won_amount:300000000,assignee:'황윤선'}),/NOT_SIGNED/);
  assert.equal(L.summarize([]).netAmount,0);
});
test('multiple owners, years and period bounds share one sum',()=>{
  const streams=[[signed()],[signed({deal_id:'B',event_id:'b',sales_owner:'lee',contract_amount:200000000,contract_date:'2026-10-01'})]];
  assert.equal(L.summarize(streams).netAmount,500000000);
  assert.equal(L.summarize(streams,{quarter:3}).netAmount,300000000);
  assert.equal(L.summarize(streams,{year:2025}).netAmount,0);
  assert.equal(L.summarize(streams,{sales_owner:'lee'}).netAmount,200000000);
  assert.equal(L.summarize(streams,{from:'2026-09-19',to:'2026-10-01'}).netAmount,200000000);
});
