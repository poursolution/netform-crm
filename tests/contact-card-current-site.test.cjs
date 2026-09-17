'use strict';

const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const {test}=require('node:test');

const source=fs.readFileSync('crm.html','utf8');

function functionSource(name){
  const start=source.indexOf('function '+name+'(');
  assert.notEqual(start,-1,name+' function should exist');
  const next=source.indexOf('\nfunction ',start+1);
  return source.slice(start,next<0?source.length:next);
}

function contextFor(person){
  const people={p:person};
  const context={
    B:{deals:[
      {site:'동명아파트',site_id:'site-a',address:'서울 A'},
      {site:'동명아파트',site_id:'site-b',address:'서울 B'}
    ],inquiries:[],inquiryCleanupArchived:[]},
    LOCAL:{people},
    CleanupCore:{norm:value=>String(value||'').replace(/\s/g,'')},
    detailAddress:item=>item.address||'',
    normSite:value=>String(value||'').replace(/\s/g,''),
    peopleStore:()=>people,
    personFromContact:c=>people[c.personKey]||null,
    contactExistingDeals:()=>[]
  };
  vm.createContext(context);
  for(const name of ['sitePersonHistoryMatch','personCurrentAtSite','dealSiteRef','dealContactCurrentAtSite']){
    vm.runInContext(functionSource(name),context);
  }
  return context;
}

test('Deal contact card separates current employment for same-name canonical Sites',()=>{
  const person={currentSite:'동명아파트',history:[{site:'동명아파트',site_id:'site-b',from:'2026-01-01',to:'',status:'current'}]};
  const context=contextFor(person);
  const contact={personKey:'p',currentSite:'동명아파트'};
  assert.equal(context.dealContactCurrentAtSite({site:'동명아파트',site_id:'site-a',address:'서울 A'},contact),false);
  assert.equal(context.dealContactCurrentAtSite({site:'동명아파트',site_id:'site-b',address:'서울 B'},contact),true);
});

test('conflicting open histories do not mark either Deal contact current',()=>{
  const person={currentSite:'동명아파트',history:[
    {site:'동명아파트',site_id:'site-a',from:'2026-01-01',to:'',status:'current'},
    {site:'동명아파트',site_id:'site-b',from:'2026-02-01',to:'',status:'current'}
  ]};
  const context=contextFor(person),contact={personKey:'p',currentSite:'동명아파트'};
  assert.equal(context.dealContactCurrentAtSite({site:'동명아파트',site_id:'site-a'},contact),false);
  assert.equal(context.dealContactCurrentAtSite({site:'동명아파트',site_id:'site-b'},contact),false);
});

test('server contacts without a local person never become current at multiple canonical Sites',()=>{
  const context=contextFor(undefined),contact={personKey:'p',mobile:'01012345678',currentSite:'동명아파트'};
  context.contactExistingDeals=()=>context.B.deals;
  assert.equal(context.dealContactCurrentAtSite({site:'동명아파트',site_id:'site-a',address:'서울 A'},contact),false);
  assert.equal(context.dealContactCurrentAtSite({site:'동명아파트',site_id:'site-b',address:'서울 B'},contact),false);
  context.contactExistingDeals=()=>[context.B.deals[0]];
  assert.equal(context.dealContactCurrentAtSite({site:'동명아파트',site_id:'site-a',address:'서울 A'},contact),true);
  assert.equal(context.dealContactCurrentAtSite({site:'동명아파트',site_id:'site-b',address:'서울 B'},contact),false);
});

test('contact card renders move state from canonical current status',()=>{
  assert.match(functionSource('contactCardHTML'),/moved=!dealContactCurrentAtSite\(item,c\)&&!!c\.currentSite/);
  assert.doesNotMatch(functionSource('contactCardHTML'),/normSite\(c\.currentSite\)!==normSite\(item\.site\)/);
});
