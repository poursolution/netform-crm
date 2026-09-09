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

function sandbox(kind='deal'){
 const buttons=['개요','공종·금액','연락·활동','일정·Next','변경이력'].map(tab=>({dataset:{tab},classList:{on:false,toggle(_c,on){this.on=on}}}));
 const sections=buttons.map(button=>({dataset:{sec:button.dataset.tab},style:{display:'unset'}}));
 const detail={scrollTop:99},nextSection=sections.find(s=>s.dataset.sec==='일정·Next'),amountSection=sections.find(s=>s.dataset.sec==='공종·금액'),nextInput={focused:false,scrolled:false,focus(){this.focused=true},closest(){return nextSection}},amountInput={focused:false,scrolled:false,focus(){this.focused=true},closest(){return amountSection}},activityInput={focused:false,focus(){this.focused=true}};
 nextSection.scrollIntoView=function(){nextInput.scrolled=true};
 amountSection.scrollIntoView=function(){amountInput.scrolled=true};
 const context={
  G:{detailTab:'개요'},CUR_DETAIL:{kind},DETAIL_TABS:['개요','현장·견적','영업활동','일정','이력'],DCC_TABS:['개요','공종·금액','연락·활동','일정·Next','변경이력'],
  dccTabName(t){return {'현장·견적':'공종·금액','영업활동':'연락·활동','일정':'일정·Next','이력':'변경이력'}[t]||t||'개요'},
  $$(sel){return sel.includes('button')?buttons:sections},
  $(sel){return {'#detailView':detail,'#dv-na-text':nextInput,'#dv-amt':amountInput,'#dv-act-note':activityInput}[sel]||null},
  setTimeout(fn){fn()},buttons,sections,detail,nextInput,amountInput,activityInput,console
 };
 vm.createContext(context);
 for(const name of ['detailTabFocus','briefNextAction','briefAmountEditor','dccGoNext','dccGoActivity'])vm.runInContext(functionSource(name),context);
 return context;
}

test('pipeline next action accepts the Command Center tab name and focuses its editor',()=>{
 const x=sandbox();x.dccGoNext();
 assert.equal(x.G.detailTab,'일정·Next');
 assert.equal(x.sections.find(s=>s.dataset.sec==='일정·Next').style.display,'');
 assert.equal(x.sections.find(s=>s.dataset.sec==='개요').style.display,'none');
 assert.equal(x.buttons.find(b=>b.dataset.tab==='일정·Next').classList.on,true);
 assert.equal(x.nextInput.focused,true);
 assert.equal(x.nextInput.scrolled,true);
});

test('the top briefing actions navigate to the visible next-action editor',()=>{
 assert.match(html,/onclick="briefNextAction\(\)">📅 다음 행동/);
 assert.match(html,/📅 정하기','briefNextAction\(\)'/);
 const x=sandbox();x.briefNextAction();
 assert.equal(x.G.detailTab,'일정·Next');
 assert.equal(x.nextInput.scrolled,true);
 assert.equal(x.nextInput.focused,true);
});

test('other detail shortcuts cannot repeat the same silent tab-only navigation bug',()=>{
 assert.match(html,/금액 입력','briefAmountEditor\(\)'/);
 assert.match(html,/stickytools[^\n]+onclick="briefLog\(\)">＋ 활동 기록/);
 assert.match(html,/전체 활동 보기<\/button>/);
 assert.doesNotMatch(html,/onclick="detailTabFocus\(\\'연락·활동\\'\)">전체 활동 보기/);
 const x=sandbox();x.briefAmountEditor();
 assert.equal(x.G.detailTab,'공종·금액');
 assert.equal(x.amountInput.scrolled,true);
 assert.equal(x.amountInput.focused,true);
});

test('legacy deal tab names normalize to the Command Center names',()=>{
 const x=sandbox();x.detailTabFocus('영업활동');
 assert.equal(x.G.detailTab,'연락·활동');
 assert.equal(x.sections.find(s=>s.dataset.sec==='연락·활동').style.display,'');
});

test('Command Center quick actions normalize back to legacy sections when that DOM is rendered',()=>{
 const x=sandbox(),names=['개요','현장·견적','영업활동','일정','이력'];
 x.buttons=names.map(tab=>({dataset:{tab},classList:{on:false,toggle(_c,on){this.on=on}}}));
 x.sections=names.map(tab=>({dataset:{sec:tab},style:{display:'unset'}}));
 x.$$=sel=>sel.includes('button')?x.buttons:x.sections;
 x.nextInput.closest=()=>x.sections.find(s=>s.dataset.sec==='일정');
 x.sections.find(s=>s.dataset.sec==='일정').scrollIntoView=()=>{x.nextInput.scrolled=true};
 x.dccGoNext();
 assert.equal(x.G.detailTab,'일정');
 assert.equal(x.sections.find(s=>s.dataset.sec==='일정').style.display,'');
 assert.equal(x.sections.find(s=>s.dataset.sec==='개요').style.display,'none');
 assert.equal(x.nextInput.focused,true);
});

test('inquiry details keep their original tab vocabulary',()=>{
 const x=sandbox('inq');
 x.sections=[{dataset:{sec:'개요'},style:{}},{dataset:{sec:'일정'},style:{}}];
 x.$$=sel=>sel.includes('button')?[]:x.sections;
 x.detailTabFocus('일정');
 assert.equal(x.G.detailTab,'일정');
 assert.equal(x.sections[1].style.display,'');
});
