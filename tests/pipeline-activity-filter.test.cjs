'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const html=fs.readFileSync(path.join(__dirname,'..','crm.html'),'utf8');

function functionSource(name){
 const marker='function '+name+'(',start=html.indexOf(marker);
 assert.notEqual(start,-1,'missing '+name);
 const brace=html.indexOf('{',start);let depth=0,quote='',escaped=false;
 for(let i=brace;i<html.length;i++){
  const ch=html[i];
  if(quote){if(escaped)escaped=false;else if(ch==='\\')escaped=true;else if(ch===quote)quote='';continue}
  if(ch==='"'||ch==="'"||ch==='`'){quote=ch;continue}
  if(ch==='{')depth++;else if(ch==='}'&&--depth===0)return html.slice(start,i+1);
 }
 throw new Error('unterminated '+name);
}

function sandbox({withHost=true}={}){
 const host=withHost?{innerHTML:'old'}:null;
 const buttons=['전체','전화','문자'].map(type=>({dataset:{type},classList:{on:false,toggle(_name,on){this.on=on}}}));
 const draft={note:'작성 중인 통화 메모',result:'작성 중인 결과'};
 const context={
  CUR_DETAIL:{kind:'deal',item:{id:'deal-1'}},G:{actFilter:'전체',utlAll:false},ACTIVITY_TYPES:['전화','문자'],
  $(selector){return selector==='#activityTimelineHost'?host:null},
  $$(selector){return selector==='#detailView .activity-filter button'?buttons:[]},
  currentPatch(){return {activities:[]}},
  unifiedTimelineHTML(){return '<p>'+context.G.actFilter+':'+context.G.utlAll+'</p>'},
  renderDetail(){context.renderCount++},renderCount:0,draft
 };
 vm.createContext(context);
 for(const name of ['refreshActivityTimeline','setActivityFilter','utlShowAll'])vm.runInContext(functionSource(name),context);
 return {context,host,buttons,draft};
}

test('activity type filter updates only the timeline and keeps the draft intact',()=>{
 const x=sandbox();
 x.context.setActivityFilter('전화');
 assert.equal(x.context.G.actFilter,'전화');
 assert.equal(x.host.innerHTML,'<p>전화:false</p>');
 assert.equal(x.buttons.find(b=>b.dataset.type==='전화').classList.on,true);
 assert.deepEqual(x.draft,{note:'작성 중인 통화 메모',result:'작성 중인 결과'});
 assert.equal(x.context.renderCount,0);
});

test('unknown activity filters fail closed to 전체',()=>{
 const x=sandbox();x.context.setActivityFilter('임의값');
 assert.equal(x.context.G.actFilter,'전체');
 assert.equal(x.buttons[0].classList.on,true);
});

test('show-all refreshes only the timeline and falls back when the host is unavailable',()=>{
 const x=sandbox();x.context.utlShowAll();
 assert.equal(x.context.G.utlAll,true);
 assert.equal(x.host.innerHTML,'<p>전체:true</p>');
 assert.equal(x.context.renderCount,0);
 const fallback=sandbox({withHost:false});fallback.context.utlShowAll();
 assert.equal(fallback.context.renderCount,1);
});
