'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const read=f=>fs.readFileSync(path.join(__dirname,'..',f),'utf8');
function context(){
 const w={console,Date,Intl,setTimeout,clearTimeout,Map,Set,WeakMap,Promise};w.window=w;w.globalThis=w;
 Object.assign(w,{G:{},B:{deals:[],inquiries:[],inquiryCleanupArchived:[]},itemPatch:x=>x.patch||{},actionObj:()=>null,
  document:{readyState:'loading',addEventListener(){}},esc:String,escAttr:String,fmtAmt:String,
  isOpen:d=>!['won','lost'].includes(d.outcome),isWon:d=>d.outcome==='won',oppAmt:d=>d.amount||0,wonAmt:d=>d.won_amount||0,
  dealStage:d=>d.code,dealKey:d=>d.id,dealWorkSummary:()=>'',StageTransition:{definitions:{silent:{label:'침묵관리'},waiting:{label:'대기고객'}}},
  PipelineStages:{group:k=>['rapport','silent','waiting'].includes(k)?'relationship':'consulting'},
  PipelineWorkspace:{rows:()=>w.B.deals.map(d=>({key:d.id,item:d,contactDays:null,next:null}))},
  PipelineJudge:{on:()=>true,isLate:()=>false,basis:()=>({})},
  PipelineScope:{on:()=>true,isActive:d=>d.code==='rapport'||d.code==='consulting'},
  CRMRules:{get:()=>null}});
 vm.createContext(w);for(const f of ['inquiry-flow.js','contact-state.js','relationship-v12.js','asset-report.js','asset-c.js'])vm.runInContext(read(f),w);
 vm.runInContext(read('crm.html').split(/\r?\n/).find(l=>l.startsWith('function siteItemDates(')),w);
 return w;
}
const at='2026-01-16T08:02:00+09:00';
const plain=x=>JSON.parse(JSON.stringify(x));
test('creation/import/update/internal notes do not become customer contact dates',()=>{
 const w=context(),d={created:at,updated_at:at,lastActivity:at,contactAt:at,activities:[{type:'메모',note:'통화 완료 메모를 옮김',at},{type:'단계 변경',at}]};
 const before=JSON.stringify(d);assert.deepEqual(plain(w.siteItemDates(d,'deal')),[]);assert.equal(JSON.stringify(d),before);
});
test('completed call/visit count; absence, a planned visit and internal result notes do not',()=>{
 const w=context();
 for(const a of [{type:'전화',result:'연결됨'},{type:'방문',note:'현장 방문 완료'}])assert.deepEqual(plain(w.siteItemDates({activities:[{...a,at}]},'deal')),[at]);
 for(const a of [{type:'전화',note:'부재'},{type:'방문 예정',note:'일정 협의'},{type:'방문',note:'내일 방문 예정'},
  {type:'내부 메모',note:'[전화 · 연결됨] 기존 기록 정리'},{type:'체크',flow:{kind:'connected'}}])
  assert.deepEqual(plain(w.siteItemDates({activities:[{...a,at}]},'deal')),[],JSON.stringify(a));
});
test('copied response stamps and status alone never establish a contact date',()=>{
 const w=context();for(const q of [{received_at:at,responded_at:at},{status:'전화응대 완료',updated:at},
  {raw:{응대내용:'1/16 통화완료'},created_at:at},{responses:[{at}]}])assert.deepEqual(plain(w.siteItemDates(q,'inq')),[]);
});
test('server inquiry contact and server-confirmed historical call dates are accepted, not queued patches',()=>{
 const w=context(),q={id:'q',patch:{activities:[{type:'전화',result:'연결됨',at}]}};
 assert.deepEqual(plain(w.siteItemDates(q,'inq')),[]);
 w.InquiryFlow.take({inquiry_id:'q',logs:[{kind:'connected',occurred_at:at}]});
 assert.deepEqual(plain(w.siteItemDates(q,'inq')),[at]);
 w.InquiryMemo={confirmedCallDay:()=> '2026-01-17'};
 assert.deepEqual(plain(w.siteItemDates(q,'inq')),[at,'2026-01-17']);
});
test('explicit origin inquiry is read, same-named unrelated inquiry is not',()=>{
 const w=context();w.B.inquiries=[{id:'q',site:'같은 이름',activities:[{type:'전화',result:'연결됨',at}]}];
 assert.deepEqual(plain(w.siteItemDates({site:'같은 이름'},'deal')),[]);
 assert.deepEqual(plain(w.siteItemDates({origin_inquiry_id:'q'},'deal')),[at]);
});
test('explicit customer-contact fields survive, invalid/future timestamps do not',()=>{
 const w=context();assert.deepEqual(plain(w.siteItemDates({last_meaningful_contact_at:at},'deal')),[at]);
 assert.deepEqual(plain(w.siteItemDates({last_meaningful_contact_at:'invalid',activities:[{type:'전화',result:'연결됨',at:'2999-01-01'}]},'deal')),[]);
});
test('linked legacy-note timestamp is preserved as record date, never contact date',()=>{
 const w=context(),line=read('crm.html').split(/\r?\n/).find(l=>l.startsWith('siteMasterData=function(){var rows=_siteMasterDataCore()'));
 w._siteMasterDataCore=()=>[];w.normSite=String;w.siteDays=v=>v?38:null;w.SITE_LINKED_ASSETS=[{site_id:'s',name:'이관 현장',last_at:at}];
 vm.runInContext(line,w);const s=w.siteMasterData()[0];assert.equal(s.lastAt,'');assert.equal(s.lastDays,null);assert.equal(s.lastRecordAt,at);
});
test('unknown relationship uses current classification explanation and opens review, not contact recommendation',()=>{
 const w=context(),d={id:'d',code:'silent'};w.B.deals=[d];
 const s={key:'s',health:'recontact',lastDays:38,open:[d],deals:[d],lost:[],won:[]};w.AssetReport.adjust([s]);
 assert.equal(s.relFix,1);assert.equal(s.relLate,0);assert.match(w.AssetC.whyOf(s,w.AssetC.money(s)),/미확인 · 분류 필요/);
 assert.doesNotMatch(w.AssetC.whyOf(s,w.AssetC.money(s)),/침묵관리|38일 연락 없음/);assert.equal(w.AssetC.actOf(s,w.AssetC.money(s)),'열기');
});
test('relationship row unavailable is classification unknown, not silently compliant',()=>{
 const w=context();w.PipelineWorkspace.rows=()=>[];
 assert.deepEqual(plain(w.AssetReport.relOf({open:[{id:'missing',code:'rapport'}]})),{late:0,fix:1});
});
test('explicit relationship marker drives explanation instead of legacy stage name',()=>{
 const w=context(),d={id:'d',code:'waiting',activities:[{type:'메모',at,note:'[관계 상태] 대기 | 다음 예산 | | |'}]};w.B.deals=[d];
 const s={key:'s',health:'active',lastDays:0,relFix:0,open:[d],deals:[d],lost:[],won:[]};
 assert.equal(w.AssetC.whyOf(s,w.AssetC.money(s)),'대기 중');
});
test('current opportunity count uses PipelineScope.isActive, remaining open records stay separate',()=>{
 const w=context(),m=w.AssetC.money({key:'s',deals:[{code:'consulting',amount:100},{code:'unknown',amount:200},{code:'won',amount:300}],lost:[]});
 assert.equal(m.curN,1);assert.equal(m.cur,100);assert.equal(m.legN,2);assert.equal(m.prog,m.cur+m.leg);
});
test('late server contact response invalidates the cached site dates without replacing inquiry arrays',()=>{
 const w=context();Object.assign(w,{SITE_MASTER_DATA_CACHE:null,SITE_MASTER_DATA_REV:0,normSite:String,detailAddress:()=>'',
  inquiryCreatedAt:q=>q.received_at||'',sumBy:(a,f)=>a.reduce((n,d)=>n+f(d),0),hasWonAmt:()=>true,repN:x=>x||'',repCompare:()=>0,
  customerContacts:()=>[],siteMinDate:a=>a.filter(Boolean).sort()[0]||'',siteMaxDate:a=>a.filter(Boolean).sort().pop()||'',
  siteDays:v=>v?1:null,siteHealth:()=> 'dormant'});
 vm.runInContext(read('crm.html').split(/\r?\n/).find(l=>l.startsWith('function siteMasterData(')),w);
 w.B.inquiries=[{id:'q',site:'연락 확인',site_id:'s',received_at:at}];
 const first=w.siteMasterData();assert.equal(first[0].lastAt,'');assert.equal(w.siteMasterData(),first);
 w.InquiryFlow.take({inquiry_id:'q',logs:[{kind:'connected',occurred_at:at}]});
 const second=w.siteMasterData();assert.notEqual(first,second);assert.equal(second[0].lastAt,at);
});
