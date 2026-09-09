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

function button(){
 return {textContent:'',attributes:{},classList:{on:false,toggle(_name,on){this.on=on}},setAttribute(k,v){this.attributes[k]=v}};
}

function sandbox({favorite=false,writeError=null}={}){
 let btn=null;
 const top={querySelector(){return btn},insertAdjacentHTML(){btn=button()}},deal={id:'2f98178e-a70e-4c21-8304-2a6ad7b627e8',favorite};
 const writes=[],messages=[];
 const context={
  CUR_DETAIL:{kind:'deal',item:deal},FIELD_DEMO:false,
  $(selector){return selector==='#detailView .detailtopin'?top:null},
  pushWrite(op,payload){if(writeError)throw writeError;writes.push({op,payload})},
  execUserKey(){return 'songboram@crm.netform.co.kr'},
  showDetailErr(message,ok){messages.push({message,ok})},
  String
 };
 vm.createContext(context);
 for(const name of ['syncExecFavoriteButton','toggleExecFavorite'])vm.runInContext(functionSource(name),context);
 return {context,top,deal,writes,messages,get button(){return btn}};
}

test('existing favorite button is synchronized instead of left with stale text',()=>{
 const x=sandbox();
 x.context.syncExecFavoriteButton(x.top,x.deal);
 const same=x.button;
 assert.equal(same.textContent,'☆ 즐겨찾기');
 assert.equal(same.attributes['aria-pressed'],'false');
 x.deal.favorite=true;
 x.context.syncExecFavoriteButton(x.top,x.deal);
 assert.equal(x.button,same);
 assert.equal(same.textContent,'★ 즐겨찾기');
 assert.equal(same.classList.on,true);
 assert.equal(same.attributes['aria-pressed'],'true');
});

test('favorite click updates the visible button immediately and queues the personal write',()=>{
 const x=sandbox();
 x.context.syncExecFavoriteButton(x.top,x.deal);
 x.context.toggleExecFavorite();
 assert.equal(x.deal.favorite,true);
 assert.equal(x.button.textContent,'★ 즐겨찾기');
 assert.equal(x.writes.length,1);
 assert.equal(x.writes[0].op,'favorite_set');
 assert.deepEqual(JSON.parse(JSON.stringify(x.writes[0].payload)),{opportunity_id:x.deal.id,user_key:'songboram@crm.netform.co.kr',favorite:true});
 assert.match(x.messages[0].message,/추가했습니다/);
});

test('synchronous save rejection restores the star and explains the failure',()=>{
 const x=sandbox({writeError:new Error('INVALID_COMMAND')});
 x.context.syncExecFavoriteButton(x.top,x.deal);
 x.context.toggleExecFavorite();
 assert.equal(x.deal.favorite,false);
 assert.equal(x.button.textContent,'☆ 즐겨찾기');
 assert.match(x.messages[0].message,/저장하지 못했습니다.*INVALID_COMMAND/);
 assert.equal(x.messages[0].ok,undefined);
});
