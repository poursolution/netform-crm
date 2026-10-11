'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),path=require('path'),vm=require('vm');
const raw=fs.readFileSync(path.join(__dirname,'../today-v3.js'),'utf8');
function rig(){
 let resolve,reject,owner='owner-1',session='session-1';const calls=[],renders=[];
 const pending=new Promise((a,b)=>{resolve=a;reject=b;});
 const root={G:{_towerRole:'rep'},ME:{name:'담당'},Phase1:{profile:{auth_uid:'auth-1',user_id:'user-1'}},esc:String,escAttr:String,repN:x=>x,TodayV2:{render:()=>renders.push('render')},paint:()=>renders.push('paint'),MobileSaveJournal:{owner:()=>owner,session:()=>session},InquiryListV3:{record:(q,o)=>{calls.push({q,o});return pending;}}};
 const document={addEventListener(){},getElementById(){return null;}};
 const source=raw.replace(' root.TodayV3={',' root.__execTest={startExec,execSave,onClick};\n root.TodayV3={');assert.notEqual(source,raw);
 vm.runInNewContext(source,{window:root,document,console,setTimeout,Date});
 const item=id=>({key:'inq:'+id,x:{type:'inq',owner:'담당',item:{id}},i:{site:id},missTxt:'연락 확인'});
 root.__execTest.startExec({groups:[{t:'오늘',items:[item('a'),item('b')]}]});const S=root.G.today3;S.er='부재';S.em='원 메모';
 const click=(action,key)=>root.__execTest.onClick({stopPropagation(){},target:{closest:()=>({dataset:{t3:action,key}})}});
 return {root,S,calls,renders,resolve,reject,click,save:()=>root.__execTest.execSave(),swapOwner(){owner='owner-2';session='session-2';}};
}
test('ACK only completes the captured inquiry and advances after success',async()=>{const r=rig(),p=r.save();assert.equal(r.S.ebusy,true);assert.equal(Object.keys(r.S.ed).length,0);assert.equal(r.calls.length,1);assert.equal(r.calls[0].q.id,'a');await r.save();assert.equal(r.calls.length,1);r.resolve(true);await p;assert.equal(r.S.ed['inq:a'],true);assert.equal(r.S.ed['inq:b'],undefined);assert.equal(r.S.ek,'inq:b');assert.equal(r.S.em,'');assert.equal(r.S.ebusy,false);});
test('exit while ACK pending does not turn a successful save into an error',async()=>{const r=rig(),p=r.save();r.click('exit');assert.equal(r.S.exec,false);r.resolve(true);await p;assert.equal(r.S.eerr,'');assert.equal(r.S.ebusy,false);assert.equal(r.S.ed['inq:a'],undefined);assert.equal(r.S.em,'원 메모');});
test('another selected target retains its input after old ACK succeeds',async()=>{const r=rig(),p=r.save();r.click('epick','inq:b');r.S.er='연결됨';r.S.em='새 대상 입력';r.resolve(true);await p;assert.equal(r.S.ek,'inq:b');assert.equal(r.S.er,'연결됨');assert.equal(r.S.em,'새 대상 입력');assert.equal(r.S.ed['inq:b'],undefined);assert.equal(r.S.eerr,'');assert.equal(r.S.ebusy,false);});
test('old rejection cannot replace the selected target error or inputs',async()=>{const r=rig(),p=r.save();r.click('epick','inq:b');r.S.em='다른 입력';r.S.eerr='현재 대상 안내';r.reject(Error('old request'));await p;assert.equal(r.S.eerr,'현재 대상 안내');assert.equal(r.S.em,'다른 입력');assert.equal(r.S.ebusy,false);});
test('unchanged target failure keeps result and memo for retry',async()=>{const r=rig(),p=r.save();r.reject(Error('server unavailable'));await p;assert.match(r.S.eerr,/server unavailable/);assert.equal(r.S.er,'부재');assert.equal(r.S.em,'원 메모');assert.equal(r.S.ed['inq:a'],undefined);assert.equal(r.S.ebusy,false);});
test('account/session change prevents late completion or rerender',async()=>{const r=rig(),p=r.save(),before=r.renders.length;r.swapOwner();r.resolve(true);await p;assert.equal(r.S.ed['inq:a'],undefined);assert.equal(r.S.er,'부재');assert.equal(r.S.em,'원 메모');assert.equal(r.renders.length,before);});
test('same inquiry with changed memo is not cleared by old ACK',async()=>{const r=rig(),p=r.save();r.S.em='새 수정';r.resolve(true);await p;assert.equal(r.S.em,'새 수정');assert.equal(r.S.er,'부재');assert.equal(r.S.ed['inq:a'],undefined);assert.equal(r.calls[0].o.res,'[전화 · 부재] 원 메모');});
