'use strict';

const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const {test}=require('node:test');

const source=fs.readFileSync('mobile.html','utf8');

function functionSource(name){
  const start=source.indexOf('function '+name+'(');
  assert.notEqual(start,-1,name+' function should exist');
  const next=source.indexOf('\nfunction ',start+1);
  return source.slice(start,next<0?source.length:next);
}

function contextFor(person){
  const deals=[
    {id:'a',nm:'동명아파트',site_id:'site-a',address:'서울 A'},
    {id:'b',nm:'동명아파트',site_id:'site-b',address:'서울 B'}
  ];
  const context={
    DEALS:deals,
    normSiteM:value=>String(value||'').replace(/\s/g,''),
    peopleM:()=>person?{p:person}:{},
    contactDealsM:()=>[]
  };
  vm.createContext(context);
  for(const name of ['dealSiteKeyM','historyMatchesDealM','contactCurrentAtDealM'])vm.runInContext(functionSource(name),context);
  return context;
}

test('mobile contact state follows exact canonical Site history',()=>{
  const person={currentSite:'동명아파트',history:[{site:'동명아파트',site_id:'site-b',from:'2026-01-01',to:'',status:'current'}]};
  const context=contextFor(person),contact={personKey:'p',mobile:'01012345678',currentSite:'동명아파트'};
  assert.equal(context.contactCurrentAtDealM(context.DEALS[0],contact),false);
  assert.equal(context.contactCurrentAtDealM(context.DEALS[1],contact),true);
});

test('mobile server contacts stay unconfirmed across duplicate Site names',()=>{
  const context=contextFor(null),contact={personKey:'p',mobile:'01012345678',currentSite:'동명아파트'};
  context.contactDealsM=()=>context.DEALS;
  assert.equal(context.contactCurrentAtDealM(context.DEALS[0],contact),false);
  assert.equal(context.contactCurrentAtDealM(context.DEALS[1],contact),false);
  context.contactDealsM=()=>[context.DEALS[0]];
  assert.equal(context.contactCurrentAtDealM(context.DEALS[0],contact),true);
  assert.equal(context.contactCurrentAtDealM(context.DEALS[1],contact),false);
});

test('final mobile renderer labels unconfirmed contacts for review',()=>{
  const start=source.lastIndexOf('contactCardM=function(d){');
  const end=source.indexOf('\n};',start);
  const renderer=source.slice(start,end+3);
  assert.match(renderer,/current=contactCurrentAtDealM\(d,c\)/);
  assert.match(renderer,/과거 연락처 · 현재 현장 확인 필요/);
  assert.doesNotMatch(renderer,/<span>현재 연락처 · '\+esc\(d\.nm\)<\/span>/);
});
