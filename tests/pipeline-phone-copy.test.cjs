'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const html=fs.readFileSync(path.join(__dirname,'..','crm.html'),'utf8');

function functionSource(name){
 const plain='function '+name+'(',asyncMarker='async '+plain;
 let start=html.indexOf(asyncMarker);
 if(start<0)start=html.indexOf(plain);
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

function copyButton(){
 const names=new Set();
 return {textContent:'📋 번호 복사',dataset:{},attributes:{},isConnected:true,_copyTimer:null,
  classList:{add(n){names.add(n)},remove(...n){n.forEach(x=>names.delete(x))},contains(n){return names.has(n)}},
  setAttribute(k,v){this.attributes[k]=v}};
}

function sandbox({clipboard='ok',fallback=true}={}){
 const messages=[],writes=[],children=[];
 const body={appendChild(x){children.push(x)},removeChild(x){children.splice(children.indexOf(x),1)}};
 const document={body,execCommand(){return fallback},createElement(){return {value:'',style:{},setAttribute(){},focus(){},select(){},setSelectionRange(){}}}};
 const navigator={clipboard:{async writeText(text){writes.push(text);if(clipboard==='reject')throw new Error('denied')}}};
 const context={navigator,document,CUR_DETAIL:{kind:'deal',item:{phone:'010-5049-1418'}},
  briefPhone(){return {tel:'01050491418',raw:'010-5049-1418'}},
  showDetailErr(message,ok){messages.push({message,ok})},
  setTimeout(){return 1},clearTimeout(){},String};
 vm.createContext(context);
 for(const name of ['fallbackCopyText','copyTextReliable','briefCopyButtonState','briefCopy'])vm.runInContext(functionSource(name),context);
 return {context,messages,writes,children};
}

test('copy button passes itself so the user gets immediate visible feedback',()=>{
 assert.match(html,/data-copy-phone="1"[^>]+onclick="briefCopy\(this\)"/);
 assert.match(html,/\.bact button\.copy-ok/);
 assert.match(html,/\.bact button\.copy-fail/);
});
test('clipboard success is awaited before showing copy complete',async()=>{
 const x=sandbox(),button=copyButton();
 assert.equal(await x.context.briefCopy(button),true);
 assert.deepEqual(x.writes,['010-5049-1418']);
 assert.equal(button.textContent,'✓ 복사됨');
 assert.equal(button.classList.contains('copy-ok'),true);
 assert.match(x.messages[0].message,/010-5049-1418 복사 완료/);
 assert.equal(x.messages[0].ok,true);
});

test('clipboard rejection uses the local textarea fallback',async()=>{
 const x=sandbox({clipboard:'reject',fallback:true}),button=copyButton();
 assert.equal(await x.context.briefCopy(button),true);
 assert.equal(x.children.length,0,'temporary textarea must be removed');
 assert.equal(button.textContent,'✓ 복사됨');
 assert.equal(button.classList.contains('copy-ok'),true);
});

test('double failure is explicit and leaves the phone number visible',async()=>{
 const x=sandbox({clipboard:'reject',fallback:false}),button=copyButton();
 assert.equal(await x.context.briefCopy(button),false);
 assert.equal(button.textContent,'복사 실패');
 assert.equal(button.classList.contains('copy-fail'),true);
 assert.match(x.messages[0].message,/직접 선택.*010-5049-1418/);
 assert.equal(x.messages[0].ok,undefined);
});
