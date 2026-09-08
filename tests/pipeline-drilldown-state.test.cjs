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
 const calls=[];
 const context={
  G:{page:'repmanage',rep:'전체',brand:'전체',workFilter:'전체',q:'',quickStageCodes:null,reportStageCodes:null,reportStageLabel:'',quickClosed:false,pipeNoAmt:false,quickIssueKind:'all',briefInquiryKind:null,inqIssueKind:null,pipePeriodMode:null,inqPeriodMode:null,pipeStatus:'전체',pipeSub:'전체',pipeAge:'전체',splitStage:null,splitClosed:null,splitKey:null,pipeOrigin:null,splitAct:null,splitCol:null,pipeView:'kb',stageCol:null},
  PD_COLS:[
   {nm:'초기·설계',codes:['lead','first_contact','design']},
   {nm:'자료발송',codes:['sent']},
   {nm:'관계관리',codes:['rapport','silent','waiting']},
   {nm:'경쟁·입찰',codes:['compete','imminent','bidding']},
   {nm:'계약·시공',codes:['contract','construction']}
  ],
  calls,
  goPage(p){calls.push(['goPage',p]);context.G.page=p},
  paint(){calls.push(['paint'])},
  briefWeekWindow(){return {startKey:'2026-09-07',endKey:'2026-09-13'}},
  targetNameFilter(){return null},
  dealKey(d){return d.id},
  document:{querySelector(){return null}},
  setTimeout(fn){fn()},
  console
 };
 vm.createContext(context);
 for(const name of ['setPipelineStageDrill','clearPipelineStageDrill','pipelineStageDrillCodes','towerDrillReset','dashboardGoStages','dashboardGoRepStages','matrixFilter','briefGoIssue','openPipeSplit'])vm.runInContext(functionSource(name),context);
 return context;
}

test('all salesperson stage cells preserve the exact owner and stage set',()=>{
 const reps=['황윤선','이필선','한준엽'];
 for(const rep of reps)for(const col of sandbox().PD_COLS){
  const x=sandbox();
  x.dashboardGoRepStages(rep,col.codes.join('|'),col.nm);
  assert.equal(x.G.page,'pipe');
  assert.equal(x.G.rep,rep);
  assert.deepEqual([...x.G.reportStageCodes],col.codes);
  assert.deepEqual([...x.G.quickStageCodes],col.codes);
  assert.equal(x.G.reportStageLabel,col.nm);
  assert.equal(x.G.pipeView,'split');
 }
});

test('pipeline matrix cells replace, rather than combine with, a stale cross-screen stage drill',()=>{
 for(let ci=0;ci<5;ci++){
  const x=sandbox();
  x.setPipelineStageDrill(['contract'],'오래된 계약 필터');
  x.matrixFilter('이필선',ci);
  assert.equal(x.G.rep,'이필선');
  assert.equal(x.G.splitCol,ci);
  assert.deepEqual([...x.pipelineStageDrillCodes()],[]);
  assert.equal(x.G.reportStageLabel,'');
 }
});

test('weekly issue drilldowns discard stale stage filters and use the current snapshot',()=>{
 for(const kind of ['nextMissing','overdue','stale','briefNoAmount','briefSilentHot']){
  const x=sandbox();
  x.setPipelineStageDrill(['sent'],'오래된 자료발송 필터');
  x.G.pipeOrigin='wonPeriod';
  x.briefGoIssue(kind,'황윤선');
  assert.equal(x.G.page,'pipe');
  assert.equal(x.G.rep,'황윤선');
  assert.equal(x.G.pipeOrigin,null);
  assert.equal(x.G.pipePeriodMode,'snapshot');
  assert.deepEqual([...x.pipelineStageDrillCodes()],[]);
 }
});

test('opening an exact deal from every non-pipeline screen cannot be hidden by stale filters',()=>{
 for(const source of ['today','sites','dup','inq']){
  const x=sandbox(),deal={id:'deal-42'};
  Object.assign(x.G,{page:source,rep:'다른 담당자',brand:'다른 브랜드',workFilter:'다른 공종',q:'검색 잔여값',pipeOrigin:'risk',pipePeriodMode:null});
  x.setPipelineStageDrill(['won'],'오래된 종료 필터');
  x.openPipeSplit(deal);
  assert.equal(x.G.page,'pipe');
  assert.equal(x.G.splitKey,'deal-42');
  assert.equal(x.G.rep,'전체');
  assert.equal(x.G.brand,'전체');
  assert.equal(x.G.workFilter,'전체');
  assert.equal(x.G.q,'');
  assert.equal(x.G.pipeOrigin,null);
  assert.equal(x.G.pipePeriodMode,'snapshot');
  assert.deepEqual([...x.pipelineStageDrillCodes()],[]);
 }
});

