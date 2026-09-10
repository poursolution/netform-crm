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

test('searchable assignee picker exposes filter state only, never a stale selected-site owner badge',()=>{
 const host={innerHTML:''};
 const context={
  G:{page:'pipe',rep:'정정훈'},
  PERFORMANCE_TARGET_NAMES:[],
  inquiryAssignableReps(){return []},
  assignableReps(){return ['한준엽','정정훈']},
  inqBase(){return []},
  activeDealList(){return [{assignee:'한준엽'},{assignee:'정정훈'},{assignee:'정정훈'}]},
  inquiryRoutedOwner(){return ''},
  repN(value){return value},
  repDisplay(value){return value},
  esc(value){return String(value)},
  escAttr(value){return String(value)},
  document:{getElementById(id){return id==='reptabs'?host:null}}
 };
 vm.createContext(context);
 vm.runInContext(functionSource('paintRepTabs'),context);
 context.paintRepTabs();

 assert.match(host.innerHTML,/class="rep-filter-picker"/);
 assert.match(host.innerHTML,/aria-label="영업담당자 이름 검색"/);
 assert.match(host.innerHTML,/class="rep-filter-option on"[^>]*>[\s\S]*?<span>정정훈<\/span><b>2<\/b>/);
 assert.match(host.innerHTML,/class="rep-filter-option "[^>]*>[\s\S]*?<span>한준엽<\/span><b>1<\/b>/);
 assert.doesNotMatch(host.innerHTML,/현재 현장|curtag|class="[^"]*\bcur\b/);
 assert.doesNotMatch(functionSource('paintRepTabs'),/lastRep|curDetailRep/);
 assert.doesNotMatch(html,/\.rtab\.cur|\.rtab \.curtag/);
});
