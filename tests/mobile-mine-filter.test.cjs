'use strict';
/* 순수 값 검증 + 실제 셸 이벤트/목록 함수. 합성 자료만 사용하고 네트워크·서버 저장은 금지한다. */
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),path=require('path'),vm=require('vm');
const dir=path.resolve(__dirname,'..');
const crm=fs.existsSync(path.join(dir,'pipeline-stages.js'))?dir:JSON.parse(fs.readFileSync(path.join(dir,'source-hashes.json'),'utf8')).sourceRoot;
const Model=require('../mobile-mine-filter-model.js'),Stages=require(path.join(crm,'pipeline-stages.js'));
const pagerScope={};vm.runInNewContext(fs.readFileSync(path.join(crm,'list-pager.js'),'utf8'),pagerScope);
const plain=v=>JSON.parse(JSON.stringify(v));

class El{
 constructor(doc,tag='div',attrs={}){this.doc=doc;this.tagName=tag.toUpperCase();this.attrs={...attrs};this.dataset={};this.children=[];this.parentElement=null;this.disabled=false;this.hidden=false;this.type=attrs.type||'';this.value=attrs.value||'';this.checked=!!attrs.checked;this.tabIndex=['BUTTON','INPUT','SELECT','TEXTAREA','A'].includes(this.tagName)?0:-1;for(const [k,v]of Object.entries(attrs))if(k.startsWith('data-'))this.dataset[k.slice(5).replace(/-([a-z])/g,(_,c)=>c.toUpperCase())]=v;}
 hasAttribute(k){return Object.hasOwn(this.attrs,k);}
 getAttribute(k){return this.attrs[k]??null;}
 setAttribute(k,v){this.attrs[k]=v;}
 append(el){el.parentElement=this;this.children.push(el);if(el.hasAttribute('data-mine-filter-root'))this.doc.overlay=el;}
 remove(){if(this.parentElement)this.parentElement.children=this.parentElement.children.filter(x=>x!==this);this.parentElement=null;if(this.doc.overlay===this)this.doc.overlay=null;}
 contains(el){return this===el||this.children.some(c=>c.contains(el));}
 descendants(){return this.children.flatMap(c=>[c,...c.descendants()]);}
 matches(selector){return selector.split(',').some(s=>{const a=s.trim().match(/^\[([^=\]]+)(?:="([^"]*)")?\]/);return a?this.hasAttribute(a[1])&&(a[2]===undefined||this.getAttribute(a[1])===a[2]):s.trim().toUpperCase()===this.tagName;});}
 closest(selector){return this.matches(selector)?this:this.parentElement?.closest(selector)||null;}
 querySelector(selector){if(selector==='[data-mine-filter-dialog]')return this.descendants().find(e=>e.hasAttribute('data-mine-filter-dialog'))||null;return this.descendants().find(e=>e.matches(selector))||null;}
 querySelectorAll(){return this.descendants().filter(e=>['BUTTON','INPUT','SELECT','TEXTAREA','A'].includes(e.tagName)||e.hasAttribute('tabindex'));}
 focus(){this.doc.activeElement=this;}
 click(){this.doc.fire('click',this);}
}
function fixture(){
 const handlers={},windowEvents={},doc={readyState:'loading',overlay:null,activeElement:null,renderCount:0};doc.body=new El(doc,'body');
 doc.addEventListener=(type,fn)=>(handlers[type]||(handlers[type]=[])).push(fn);
 doc.fire=(type,target,extra={})=>{const e={type,target,key:'',shiftKey:false,prevented:false,preventDefault(){this.prevented=true;},...extra};for(const f of handlers[type]||[])f(e);return e;};
 doc.querySelector=selector=>selector==='[data-mine-filter-root]'?doc.overlay:selector.includes('[data-gs="filter"]')?doc.filter:selector==='.approved-list'?doc.list:null;
 doc.root=new El(doc);doc.scr={querySelector:s=>s==='.approved-bc'?doc.root:null};doc.list={scrollTop:0};
 doc.createElement=()=>{const box={firstElementChild:null};Object.defineProperty(box,'innerHTML',{set(value){assert.equal(value,'CLAUDE_FILTER_HTML');const m=doc.designModel,r=new El(doc,'div',{'data-mine-filter-root':''}),dialog=new El(doc,'section',{'data-mine-filter-dialog':'',tabindex:'-1'});r.append(dialog);for(const a of ['reset','cancel'])dialog.append(new El(doc,'button',{'data-mine-filter-action':a}));for(const b of ['',...m.brands])dialog.append(new El(doc,'input',{type:'radio',value:b,checked:m.draft.brand===b,'data-mine-filter-field':'brand'}));for(const s of m.stages)dialog.append(new El(doc,'input',{type:'radio',value:s.key,checked:m.draft.stage===s.key,'data-mine-filter-field':'stage'}));dialog.append(new El(doc,'input',{type:'checkbox',checked:m.draft.openOnly,'data-mine-filter-field':'openOnly'}));for(const a of ['cancel','apply'])dialog.append(new El(doc,'button',{'data-mine-filter-action':a}));box.firstElementChild=r;}});return box;};
 let rows=[],writes=0,session='session1';const messages=[];
 const w={document:doc,G:{user:null,mode:'rep',tab:'mine',deal:null,sub:null,brandF:'전체'},Phase1:{profile:{auth_uid:'auth1',user_id:'owner1'}},LIVE:true,DEMO:false,location:{href:'http://127.0.0.1/mobile.html'},URL,
  MobileSaveJournal:{session:()=>session,owner:()=>w.Phase1.profile.auth_uid+':'+w.Phase1.profile.user_id},MobileApprovedBoot:{login(){}},MobileMineFilterModel:Model,PipelineStages:Stages,ListPager:pagerScope.ListPager,
  PipelineScope:{on:()=>true,isLegacy:d=>d.stage_code==='old_import'},myDeals:()=>rows.filter(d=>d.owner_id===w.G.user?.id),
  isOpen:d=>!d.outcome,contactInfoM:d=>({name:d.customer||'',mobile:d.phone||'',officeTel:''}),dealWorkSummaryM:d=>d.work_type||'',stageLabel:c=>c,dueDays:()=>0,ContactEntry:{md:v=>v},
  MobileApprovedBC:{listing:m=>{doc.listModel=m;return 'LIST_HTML';}},MobileApprovedMineFilter:{render:m=>{doc.designModel=plain(m);return 'CLAUDE_FILTER_HTML';}},
  toast:m=>messages.push(m),render(){},addEventListener:(k,f)=>(windowEvents[k]||(windowEvents[k]=[])).push(f),fetch(){writes++;throw Error('네트워크 금지');},localStorage:{setItem(){writes++;throw Error('저장 금지');}},setTimeout:f=>f(),sessionStorage:{},structuredClone};
 const entries=[{state:{route:'mine',nested:{kept:true}},url:w.location.href}],historyCalls=[];let index=0,historyFailure='';
 const emitPop=()=>{for(const fn of windowEvents.popstate||[])fn();};
 w.history={
  get state(){if(historyFailure==='state')throw Error('HISTORY_STATE_BLOCKED');return structuredClone(entries[index].state);},
  get length(){return entries.length;},
  pushState(value,title,url){if(historyFailure==='push')throw Error('HISTORY_PUSH_BLOCKED');historyCalls.push('push');entries.splice(index+1);entries.push({state:structuredClone(value),url:String(url||w.location.href)});index++;w.location.href=entries[index].url;},
  replaceState(value,title,url){if(historyFailure==='replace')throw Error('HISTORY_REPLACE_BLOCKED');historyCalls.push('replace');entries[index]={state:structuredClone(value),url:String(url||w.location.href)};w.location.href=entries[index].url;},
  back(){historyCalls.push('back');if(index>0){index--;w.location.href=entries[index].url;emitPop();}},
  forward(){historyCalls.push('forward');if(index<entries.length-1){index++;w.location.href=entries[index].url;emitPop();}}
 };
 const marker='w.MobileGuideShell={show,state:S,todayItems};';
 const src=fs.readFileSync(path.join(dir,'mobile-guide-shell.js'),'utf8');assert.ok(src.includes(marker));
 vm.runInNewContext(src.replace(marker,'w.MobileGuideShell={show,state:S,todayItems,_filterTest:{listing,openMineFilter,renderMineFilter,captureMineFilterFocus,syncMineFilter,boot,peek:()=>mineFilter}};'),{window:w,URL,console});
 const api=w.MobileGuideShell._filterTest,S=w.MobileGuideShell.state;api.boot();w.G.user={id:'owner1',nm:'합성 담당자'};
 w.render=()=>{doc.renderCount++;api.captureMineFilterFocus();api.syncMineFilter();doc.overlay=null;doc.activeElement=doc.body;doc.root=new El(doc);doc.filter=new El(doc,'span',{'data-gs':'filter'});doc.filter.tabIndex=0;doc.root.append(doc.filter);if(w.G.deal==null){api.listing();doc.list.scrollTop=S.scroll;api.renderMineFilter(doc.scr);}};
 const mk=(i,extra={})=>({id:'deal'+i,owner_id:'owner1',nm:'합성 현장 '+i,code:'consulting',brand:i%2?'POUR솔루션':'석민이앤씨',site_id:'site'+i,work_type:'방수',activities:[],nextAction:{status:'open',text:'연락',due:'2026-10-27'},...extra});
 rows=Array.from({length:25},(_,i)=>mk(i+1)).concat([mk(26,{code:'won',outcome:'won',nextAction:null}),mk(27,{code:'lost',outcome:'lost',nextAction:null}),mk(28,{stage_code:'old_import'}),mk(29,{owner_id:'owner2',brand:'타담당자 브랜드'})]);w.render();
 const el=(action,field,value)=>{const a=doc.overlay?.descendants()||[];return a.find(e=>action?e.dataset.mineFilterAction===action:e.dataset.mineFilterField===field&&(value===undefined||e.value===value));};
 const change=(field,value)=>{const e=el(null,field,field==='openOnly'?undefined:value);assert.ok(e,'필터 항목 '+field+'='+value);if(field==='openOnly')e.checked=value;else{e.checked=true;e.value=value;}doc.fire('change',e);return e;};
 return {w,doc,S,api,messages,history:{calls:historyCalls,entries,failure:v=>{historyFailure=v;}},rows:()=>rows,setRows:v=>{rows=v;},el,change,writes:()=>writes,emit:k=>{for(const f of windowEvents[k]||[])f();},session:v=>{session=v;},open:()=>doc.filter.click(),ids:()=>doc.listModel.rows.map(r=>r.id),gs:(key,values={})=>new El(doc,'span',{'data-gs':key,...Object.fromEntries(Object.entries(values).map(([k,v])=>['data-'+k,v]))})};
}

test('값 검증: 현재 허용 자료의 브랜드만, 미지원 단계·문자형 boolean 차단, 원본 보존',()=>{
 const rows=[{brand:'A'},{brand:'A'},{brand:'B'},{}],before=JSON.stringify(rows),o=Model.options(rows,[{key:'consulting',label:'컨설팅'},{key:'expansion',label:'확장'}]);
 assert.deepEqual(o.brands,['A','B']);assert.deepEqual(o.stages.map(s=>s.key),['','consulting']);assert.equal(JSON.stringify(rows),before);
 assert.equal(Model.validate({brand:'타담당자',stage:'',openOnly:false},o).ok,false);
 assert.equal(Model.validate({brand:'A',stage:'expansion',openOnly:false},o).ok,false);
 assert.equal(Model.validate({brand:'A',stage:'',openOnly:'false'},o).ok,false);
 assert.deepEqual(Model.validate({brand:'전체',stage:'',openOnly:false},o).value,{brand:'',stage:'',openOnly:false});
});
test('기존 진입으로 만들 수 있는 목록 조건의 결과·실주 숨김·검색 예외 유지',()=>{
 const f=fixture(),base=f.rows().filter(d=>d.owner_id==='owner1'&&d.stage_code!=='old_import');
 for(const stage of ['',...Stages.definitions.filter(s=>s.key!=='expansion').map(s=>s.key)])for(const q of ['','합성 현장 27','없는 현장'])for(const brand of ['전체','POUR솔루션'])for(const openOnly of [false,true]){
  if(stage&&openOnly)continue;
  Object.assign(f.S,{stage,q,openOnly,page:1});f.w.G.brandF=brand;
  let expected=base.slice();if(stage)expected=expected.filter(d=>Stages.group(d.code,d.outcome)===stage);else if(openOnly)expected=expected.filter(f.w.isOpen);else if(!q)expected=expected.filter(d=>!(d.outcome&&Stages.group(d.code,d.outcome)==='lost'));
  if(q)expected=expected.filter(d=>[d.nm,d.address,d.addr,'','','',d.work_type].join(' ').toLocaleLowerCase().includes(q.toLocaleLowerCase()));if(brand!=='전체')expected=expected.filter(d=>d.brand===brand);
  f.w.render();assert.deepEqual(plain(f.ids()),expected.slice(0,20).map(d=>d.id),JSON.stringify({stage,q,brand,openOnly}));
 }
 assert.equal(f.writes(),0);
});
test('새 단계+진행 중 조합은 AND이며 종료 건을 끼워 넣지 않음',()=>{
 const f=fixture();Object.assign(f.S,{stage:'won',openOnly:true,page:1});f.w.render();assert.deepEqual(plain(f.ids()),[]);
 Object.assign(f.S,{stage:'consulting',openOnly:true});f.w.render();assert.equal(f.ids().length,20);assert.ok(f.ids().every(id=>f.rows().find(d=>d.id===id).code==='consulting'));
 assert.equal(Model.matches({brand:'A',stage:'won',openOnly:true},{brand:'A',stage:'won',open:false}),false);
});
test('열기·초안 변경·초기화·취소는 적용 조건/검색어/쪽/스크롤을 바꾸지 않음',()=>{
 const f=fixture();Object.assign(f.S,{q:'합성',stage:'consulting',openOnly:false,page:2,scroll:143});f.w.render();f.doc.list.scrollTop=143;
 const before={q:f.S.q,stage:f.S.stage,openOnly:f.S.openOnly,page:f.S.page,scroll:f.S.scroll,brand:f.w.G.brandF};f.open();
 assert.deepEqual(f.doc.designModel.brands,['POUR솔루션','석민이앤씨']);assert.ok(!f.doc.designModel.brands.includes('타담당자 브랜드'));
 const locked=f.doc.filter;assert.equal(locked.inert,true);f.change('brand','POUR솔루션');f.change('openOnly',true);assert.equal(f.w.G.brandF,'전체');
 f.el('reset').click();assert.deepEqual(plain(f.api.peek().draft),{brand:'',stage:'',openOnly:false});
 f.el('cancel').click();assert.equal(f.api.peek(),null);assert.equal(f.doc.activeElement,f.doc.filter);assert.equal(locked.inert,false);assert.ok(!f.doc.filter.inert);
 assert.deepEqual({q:f.S.q,stage:f.S.stage,openOnly:f.S.openOnly,page:f.S.page,scroll:f.S.scroll,brand:f.w.G.brandF},before);assert.equal(f.writes(),0);
});
test('적용은 세 조건을 함께 반영하고 1쪽·맨 위, 검색어 보존, 기존 필터 라벨만 갱신',()=>{
 const f=fixture();Object.assign(f.S,{q:'합성',page:2,scroll:122});f.w.render();f.open();f.change('brand','POUR솔루션');f.change('stage','consulting');f.change('openOnly',true);f.el('apply').click();
 assert.equal(f.w.G.brandF,'POUR솔루션');assert.equal(f.S.stage,'consulting');assert.equal(f.S.openOnly,true);assert.equal(f.S.page,1);assert.equal(f.S.scroll,0);assert.equal(f.S.q,'합성');assert.equal(f.doc.listModel.filterLabel,'필터 3');
 assert.ok(f.ids().length>0&&f.ids().every(id=>f.rows().find(d=>d.id===id).brand==='POUR솔루션'));assert.equal(f.doc.activeElement,f.doc.filter);assert.equal(f.writes(),0);
});
test('창을 연 뒤 브랜드가 조회 범위에서 사라지면 적용을 막고 기존 조건 유지',()=>{
 const f=fixture();f.open();f.change('brand','POUR솔루션');const before=f.w.G.brandF;f.setRows(f.rows().filter(d=>d.brand!=='POUR솔루션'));f.el('apply').click();
 assert.equal(f.w.G.brandF,before);assert.ok(f.api.peek());assert.match(f.doc.designModel.error,/현재 내 현장/);assert.equal(f.writes(),0);
});
test('계정·세션 변경은 창/초안/브랜드 범위 폐기, 이전 DOM의 적용은 새 계정에 무효',()=>{
 const f=fixture();f.open();f.change('brand','POUR솔루션');const stale=f.el('apply');f.w.G.user={id:'owner2',nm:'다른 합성 담당자'};f.w.Phase1.profile={auth_uid:'auth2',user_id:'owner2'};
 f.doc.fire('click',stale);assert.equal(f.api.peek(),null);assert.equal(f.doc.overlay,null);assert.equal(f.w.G.brandF,'전체');assert.equal(f.S.q,'');assert.equal(f.S.stage,'');
 f.open();assert.deepEqual(f.doc.designModel.brands,['타담당자 브랜드']);f.change('brand','타담당자 브랜드');f.el('apply').click();assert.equal(f.w.G.brandF,'타담당자 브랜드');
 f.open();const staleSession=f.el('apply');f.session('session2');f.doc.fire('click',staleSession);assert.equal(f.api.peek(),null);assert.equal(f.w.G.brandF,'전체');
 f.open();f.emit('phase1:identity-cleared');assert.equal(f.api.peek(),null);assert.equal(f.doc.overlay,null);assert.equal(f.w.G.brandF,'전체');assert.equal(f.writes(),0);
});
test('키보드: Tab/Shift+Tab 포커스 순환, Escape 취소·복귀, Enter 적용 한 번',()=>{
 const f=fixture();f.open();let nodes=f.doc.overlay.querySelectorAll().filter(e=>e.tabIndex>=0),first=nodes[0],last=nodes[nodes.length-1];last.focus();let e=f.doc.fire('keydown',last,{key:'Tab'});assert.ok(e.prevented);assert.ok(f.doc.activeElement===first);
 e=f.doc.fire('keydown',first,{key:'Tab',shiftKey:true});assert.ok(e.prevented);assert.equal(f.doc.activeElement,last);
 f.change('brand','석민이앤씨');e=f.doc.fire('keydown',last,{key:'Escape'});assert.ok(e.prevented);assert.equal(f.w.G.brandF,'전체');assert.equal(f.doc.activeElement,f.doc.filter);
 f.open();f.change('brand','석민이앤씨');const count=f.doc.renderCount;f.doc.fire('keydown',f.el('apply'),{key:'Enter'});assert.equal(f.w.G.brandF,'석민이앤씨');assert.equal(f.doc.renderCount,count+1);assert.equal(f.writes(),0);
});
test('20건 쪽 번호·상세 뒤로 복원 및 오늘 내 담당/기록 선택 진입 조건 유지',()=>{
 const f=fixture();assert.equal(f.ids().length,20);f.doc.fire('click',f.gs('page',{page:'2'}));assert.equal(f.S.page,2);assert.ok(f.ids().length>0&&f.ids().length<=20);
 const ids=plain(f.ids()),target=ids[0];f.doc.list.scrollTop=91;f.doc.fire('click',f.gs('deal',{id:target}));assert.equal(f.w.G.deal,target);assert.equal(f.S.returnTab,'mine');
 f.doc.fire('click',f.gs('back'));assert.equal(f.w.G.deal,null);assert.equal(f.S.page,2);assert.equal(f.S.scroll,91);assert.deepEqual(plain(f.ids()),ids);
 f.doc.fire('click',f.gs('tab',{tab:'mine',scope:'open'}));assert.equal(f.S.openOnly,true);assert.equal(f.S.stage,'');assert.equal(f.S.page,1);
 f.w.G.brandF='석민이앤씨';f.S.q='없는 현장';f.doc.fire('click',f.gs('e-activity'));assert.equal(f.S.q,'');assert.equal(f.S.stage,'');assert.equal(f.w.G.brandF,'전체');assert.equal(f.S.returnTab,'record');assert.equal(f.w.G.tab,'mine');assert.equal(f.writes(),0);
});
test('일반 render는 활성 필드/값과 초안을 유지하고 reset/error의 첫 포커스와 충돌하지 않음',()=>{
 const f=fixture();f.open();const field=f.change('brand','POUR솔루션');field.focus();f.w.render();
 assert.equal(f.doc.activeElement.dataset.mineFilterField,'brand');assert.equal(f.doc.activeElement.value,'POUR솔루션');assert.ok(f.doc.activeElement!==field);assert.equal(f.api.peek().draft.brand,'POUR솔루션');assert.equal(f.w.G.brandF,'전체');
 const cancel=f.doc.overlay.descendants().filter(e=>e.dataset.mineFilterAction==='cancel').pop();cancel.focus();f.w.render();
 assert.ok(f.doc.activeElement===f.doc.overlay.descendants().filter(e=>e.dataset.mineFilterAction==='cancel').pop());
 f.el('reset').click();assert.ok(f.doc.activeElement===f.el('reset'));assert.deepEqual(plain(f.api.peek().draft),{brand:'',stage:'',openOnly:false});
 f.change('brand','POUR솔루션');f.setRows(f.rows().filter(d=>d.brand!=='POUR솔루션'));f.el('apply').click();assert.match(f.doc.designModel.error,/현재 내 현장/);assert.ok(f.doc.activeElement===f.el('reset'));assert.equal(f.api.peek().draft.brand,'POUR솔루션');
 assert.equal(f.history.calls.filter(v=>v==='push').length,1,'일반 render/reset/error는 추가 history를 만들지 않음');
});
test('뒤로가기=초안 취소, 수동 닫기는 자기 marker만 제거하고 같은 슬롯 재사용·원래 state 보존',()=>{
 const f=fixture(),before=plain(f.w.history.state),url=f.w.location.href;
 f.open();f.change('brand','POUR솔루션');assert.ok(f.w.history.state.__crmMineFilter);assert.equal(f.w.history.state.route,before.route);
 f.w.history.back();assert.equal(f.api.peek(),null);assert.equal(f.doc.overlay,null);assert.equal(f.w.G.brandF,'전체');assert.deepEqual(f.w.history.state,before);assert.equal(f.w.location.href,url);
 f.w.history.forward();assert.equal(f.api.peek(),null);assert.ok(!f.w.history.state?.__crmMineFilter,'앞으로가기도 버린 초안을 되살리지 않고 남은 자기 marker 정리');assert.deepEqual(f.w.history.state,before);
 const beforeReopen=f.history.calls.filter(v=>v==='push').length;f.open();const pushes=f.history.calls.filter(v=>v==='push').length;assert.equal(pushes,beforeReopen,'앞으로 온 필터 슬롯도 새 기록을 만들지 않고 재사용');f.el('cancel').click();assert.deepEqual(f.w.history.state,before);assert.ok(!f.w.history.state?.__crmMineFilter);
 f.open();f.change('brand','석민이앤씨');f.el('apply').click();assert.equal(f.w.G.brandF,'석민이앤씨');assert.deepEqual(f.w.history.state,before);assert.equal(f.history.calls.filter(v=>v==='push').length,pushes,'연속 수동 열기/닫기는 같은 기록 한 개 재사용');
 f.open();f.w.G.user={id:'owner2',nm:'다른 합성 담당자'};f.w.Phase1.profile={auth_uid:'auth2',user_id:'owner2'};f.w.render();assert.equal(f.api.peek(),null);assert.deepEqual(f.w.history.state,before);assert.equal(f.w.G.brandF,'전체');
 assert.equal(f.history.calls.filter(v=>v==='back').length,1,'기능 코드가 history.back()을 호출하지 않음');assert.equal(f.writes(),0);
});
test('다른 URL/상태는 뒤로 보내거나 덮지 않으며 history 접근 예외도 일반 필터 사용 가능',()=>{
 const f=fixture();f.open();const changed={...f.w.history.state,otherRoute:'kept',nested:{newValue:42}},other='http://127.0.0.1/other?keep=1';f.w.history.replaceState(changed,'',other);f.el('cancel').click();
 const expected={...changed};delete expected.__crmMineFilter;assert.deepEqual(f.w.history.state,expected);assert.equal(f.w.location.href,other);assert.equal(f.history.calls.includes('back'),false);
 const changedOnlyUndefined=fixture();changedOnlyUndefined.open();const altered={...changedOnlyUndefined.w.history.state,externalUndefined:undefined};changedOnlyUndefined.w.history.replaceState(altered,'',changedOnlyUndefined.w.location.href);changedOnlyUndefined.el('cancel').click();assert.ok(Object.hasOwn(changedOnlyUndefined.w.history.state,'externalUndefined'),'JSON에서 빠지는 외부 상태 값도 덮어쓰지 않음');assert.ok(!changedOnlyUndefined.w.history.state.__crmMineFilter);
 for(const failure of ['state','push']){const g=fixture();g.history.failure(failure);g.open();assert.equal(g.api.peek().historySupported,false);assert.match(g.doc.designModel.error,/뒤로가기로 닫을 수 없/);g.change('brand','POUR솔루션');g.el('apply').click();assert.equal(g.w.G.brandF,'POUR솔루션');assert.equal(g.api.peek(),null);assert.equal(g.writes(),0);}
});
