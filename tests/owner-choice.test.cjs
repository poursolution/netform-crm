const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
function fixture(value='황윤선'){
 const nodes=[];const doc={createElement(){const n={dataset:{},events:{},children:[],attrs:{},append(...children){this.children.push(...children)},setAttribute(k,v){this.attrs[k]=v},addEventListener(k,f){this.events[k]=f},focus(){this.focused=true}};nodes.push(n);return n}};
 const select=doc.createElement();Object.assign(select,{ownerDocument:doc,id:'nd-rep',value,selectedOptions:[{textContent:value,disabled:!value,parentElement:{label:'추천 담당자 · 기존 수주 담당'}}],before(){},closest(){return null},getAttribute(){return null}});
 const c={};vm.runInNewContext(fs.readFileSync(require.resolve('../owner-choice.js'),'utf8'),c);c.OwnerChoice.mount(select);return {select,nodes,c,button:nodes.at(-1),name:nodes[3]};
}
test('기존 담당은 요약만, 변경할 때 열고 선택 후 접음',()=>{
 const h=fixture();assert.equal(h.select.hidden,true);assert.equal(h.button.textContent,'변경');
 h.button.events.click();assert.equal(h.select.hidden,false);assert.equal(h.select.focused,true);
 h.select.events.change();assert.equal(h.select.hidden,true);assert.equal(h.button.focused,true);
 const count=h.nodes.length;h.c.OwnerChoice.mount(h.select);assert.equal(h.nodes.length,count);
});
test('추천 없는 경우 선택창 유지, 강제 첫 사람 자동배정 안 함',()=>{const h=fixture('');assert.equal(h.select.hidden,false);assert.equal(h.select.value,'')});
test('Escape와 유효성 오류 시 키보드 흐름 유지',()=>{const h=fixture();h.button.events.click();h.select.events.keydown({key:'Escape',preventDefault(){},stopPropagation(){}});assert.equal(h.select.hidden,true);h.select.events.invalid();assert.equal(h.select.hidden,false)});
test('이름을 HTML로 실행하지 않고 textContent로 표시',()=>{const h=fixture('<img onerror=alert(1)>');assert.equal(h.name.textContent,'<img onerror=alert(1)>');assert.equal(h.name.innerHTML,undefined)});
test('실제 다음행동 함수는 잘못된 담당자를 저장하기 전에 차단',()=>{
 const code=fs.readFileSync(require.resolve('../crm.html'),'utf8'),start=code.indexOf('function saveNextAction(){'),end=code.indexOf('\nfunction completeNextAction',start);
 const nodes={'#dv-na-text':{value:'후속전화'},'#dv-na-date':{value:'2026-09-08'},'#dv-na-assignee':{value:'조재연'}},writes=[];
 const c={CUR_DETAIL:{kind:'deal',item:{id:'d'}},currentPatch:()=>({}),NextActionPicker:{read:()=> '전화'},$:id=>nodes[id],PeopleEligibility:{allowed:()=>false},SALES_PEOPLE_MASTER:[],showDetailErr:()=>{},bumpPostpone(){throw Error('변경하면 안 됨')},pushWrite:x=>writes.push(x)};
 vm.runInNewContext(code.slice(start,end),c);assert.equal(c.saveNextAction(),false);assert.equal(writes.length,0);
});
