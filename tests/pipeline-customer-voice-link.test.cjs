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

function sandbox(){
 const panel={innerHTML:''},target={id:'deal-target',site:'대상아파트',created:'2026-09-02',work:'옥상방수',assignee:'황윤선',amt:120000000,code:'sent'},other={id:'deal-other',site:'다른아파트',created:'2026-09-03',work:'재도장',assignee:'이필선',amt:80000000,code:'rapport'};
 const context={
  G:{inqView:'console',linkTargetDealKey:null,linkAll:false,inqSelKey:'stale',inqPage:9},
  CUR_DETAIL:{kind:'deal',item:target},B:{deals:[target,other],inquiries:[]},panel,
  linkCandidates(){return [
   {q:{id:'inq-target',site:'대상아파트',at:'2026-09-01',status:'접수',work:'옥상방수',assignee:'황윤선'},cand:[{d:target,sc:100,gap:1},{d:other,sc:80,gap:2}]},
   {q:{id:'inq-other',site:'다른아파트',at:'2026-09-01',status:'접수',work:'재도장',assignee:'이필선'},cand:[{d:other,sc:95,gap:2}]}
  ]},
  dealKey:d=>d.id,dealStage:d=>d.code,stageNoLabel:v=>v,fmtD:v=>v,repN:v=>v,fmtAmt:v=>String(v||0),
  esc:v=>String(v??''),escAttr:v=>String(v??''),
  $(sel){assert.equal(sel,'#sg-panel');return panel},
  goPage(p){context.G.page=p},paint(){context.painted=true},console
 };
 vm.createContext(context);vm.runInContext('var LINK_CACHE=[];',context);
 for(const name of ['briefLink','inqLink','clearLinkTarget','inqCtlSetView'])vm.runInContext(functionSource(name),context);
 return context;
}

test('customer voice link carries the exact pipeline deal into inquiry linking',()=>{
 const x=sandbox();
 x.briefLink();
 assert.equal(x.G.linkTargetDealKey,'deal-target');
 assert.equal(x.G.inqView,'link');
 assert.equal(x.G.page,'inq');
});

test('targeted inquiry linking hides unrelated rows and unrelated deal candidates',()=>{
 const x=sandbox();x.G.linkTargetDealKey='deal-target';
 x.inqLink();
 const cache=vm.runInContext('LINK_CACHE',x);
 assert.equal(cache.length,1);
 assert.equal(cache[0].q.id,'inq-target');
 assert.equal(cache[0].cand.length,1);
 assert.equal(cache[0].cand[0].d.id,'deal-target');
 assert.match(x.panel.innerHTML,/현재 연결 대상 파이프라인/);
 assert.match(x.panel.innerHTML,/대상아파트/);
 assert.doesNotMatch(x.panel.innerHTML,/다른아파트/);
});

test('opening the shared link view clears a stale pipeline target',()=>{
 const x=sandbox();x.G.linkTargetDealKey='deal-target';
 x.inqCtlSetView('link');
 assert.equal(x.G.linkTargetDealKey,null);
 assert.equal(x.G.inqView,'link');
 assert.equal(x.G.inqSelKey,null);
 assert.equal(x.G.inqPage,1);
});
