const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const base=path.resolve(__dirname,'..');
const source=fs.readFileSync(path.join(base,'pc-primary-contact.js'),'utf8');
const keys=['sms_consent','kakao_consent','consent_at','opt_out_at','send_blocked','send_blocked_reason'];
const original={name:'원래 이름',mobile:'01011112222',role:'담당자',personKey:'mobile:01011112222',smsConsent:true,kakaoConsent:true,consentAt:'2026-10-01T00:00:00.000Z',sendBlocked:false,optOutAt:null,sendBlockedReason:'기존 확인'};
function fixture({old=original,mobile=old.mobile,fields={},missing=[],meta={}}={}){
 const controls={
  'qc-name':{value:'수정 이름'},'qc-mobile':{value:mobile},'qc-role':{value:'담당자'},'qc-office':{value:''},'qc-email':{value:''},'qc-decision-role':{value:''},'qc-relation-tone':{value:''},
  'qc-sms':{checked:!!old.smsConsent},'qc-kakao':{checked:!!old.kakaoConsent},'qc-block':{checked:!!old.sendBlocked},'qc-consent-at':{value:old.consentAt||''},'qc-block-reason':{value:old.sendBlockedReason||''},'qc-err':{style:{},textContent:''},...fields};
 for(const key of missing)delete controls[key];
 const item={id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',site:'합성 현장',contacts:[{person_key:old.personKey,sms_consent:false,kakao_consent:false}]},queue=[],writes=[],listeners={},patch={},messages=[];
 const form={item,mode:'edit',pcDecision:'',pcTone:'',pcConsentInput:old.consentAt||'',pcOriginal:{...old},pcRoot:{querySelector:s=>controls[s.slice(1)]||null},...meta};
 const root={contactDirectoryHTML:()=>'',siteContacts:()=>[{...old}],phoneN:v=>String(v||'').replace(/\D/g,''),QUICK_CONTACT:form,CUR_DETAIL:{kind:'deal',item},contactInfo:()=>({...old}),itemPatch:()=>patch,
  addEventListener:(k,f)=>{listeners[k]=f;},Phase1:{queue:{list:()=>queue,flush:async()=>{}}},pushWrite:(operation,payload)=>{writes.push({operation,payload});return 'request-1';},quickContactErr:m=>messages.push(m),showDetailErr:m=>messages.push(m),renderDetail:()=>{},closeQuickContact:()=>{root.QUICK_CONTACT=null;},saveLocal:()=>{}};
 vm.runInNewContext(source,{window:root,document:{getElementById:()=>null},Date});
 return {root,item,queue,writes,listeners,controls,form,messages,patch};
}
function omit(payload){for(const key of keys)assert.equal(Object.hasOwn(payload,key),false,key);}
test('representative selection never transmits consent snapshots',()=>{
 const f=fixture();f.root.pcSetPrimaryContact(original.personKey);assert.equal(f.writes.length,1);omit(f.writes[0].payload);assert.equal(f.writes[0].payload.is_primary,true);assert.equal(f.item.contact,undefined);
});
test('name or role edit preserves the consent group and original evidence time',()=>{
 const f=fixture();f.root.saveQuickContact();assert.equal(f.writes.length,1);omit(f.writes[0].payload);assert.equal(f.controls['qc-consent-at'].value,original.consentAt);
});
test('number-only change does not transfer the old persons consents',()=>{
 const f=fixture({mobile:'01099998888'});f.root.saveQuickContact();assert.equal(f.writes.length,1);omit(f.writes[0].payload);
});
test('missing controls cannot revoke untouched channels or clear dates',()=>{
 const f=fixture({fields:{'qc-sms':{checked:false}},missing:['qc-kakao','qc-block','qc-consent-at','qc-block-reason']});f.root.saveQuickContact();const p=f.writes[0].payload;
 assert.equal(p.sms_consent,false);for(const key of keys.filter(k=>k!=='sms_consent'))assert.equal(Object.hasOwn(p,key),false,key);
});
test('explicit channel grant uses same-person evidence without rewriting its date',()=>{
 const f=fixture({old:{...original,smsConsent:false},fields:{'qc-sms':{checked:true}}});f.root.saveQuickContact();assert.equal(f.writes[0].payload.sms_consent,true);assert.equal(f.writes[0].payload.consent_at,original.consentAt);assert.equal(Object.hasOwn(f.writes[0].payload,'kakao_consent'),false);
});
test('grant to a changed phone requires fresh explicitly entered evidence',()=>{
 const f=fixture({old:{...original,smsConsent:false},mobile:'01099998888',fields:{'qc-sms':{checked:true}}});f.root.saveQuickContact();assert.equal(f.writes.length,0);assert.match(f.controls['qc-err'].textContent,/동의 확인 일시/);
 f.controls['qc-consent-at'].value='2026-10-11T13:30:00+09:00';f.root.saveQuickContact();assert.equal(f.writes[0].payload.sms_consent,true);assert.equal(f.writes[0].payload.consent_at,'2026-10-11T04:30:00.000Z');assert.equal(Object.hasOwn(f.writes[0].payload,'kakao_consent'),false);
});
test('explicit send block disables both channels and records refusal time',()=>{
 const f=fixture({fields:{'qc-block':{checked:true}}});f.root.saveQuickContact();const p=f.writes[0].payload;assert.equal(p.sms_consent,false);assert.equal(p.kakao_consent,false);assert.equal(p.send_blocked,true);assert.ok(Number.isFinite(Date.parse(p.opt_out_at)));
});
test('server effective receipt drives local consent after an omitted update',()=>{
 const f=fixture({meta:{pcConsentFields:[]}});f.root.saveQuickContact();
 const consent={sms_consent:true,kakao_consent:false,consent_at:original.consentAt,opt_out_at:null,send_blocked:false,send_blocked_reason:'서버 확인'};
 f.queue.push({request_id:'request-1',operation:'contact_upsert',object_id:f.item.id,status:'done',ack:{person_key:original.personKey,contact_id:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',contact_consent_contract:'preserve-omitted-v1',consent}});
 f.listeners['phase1:queue']();assert.equal(f.item.contacts[0].sms_consent,true);assert.equal(f.item.contacts[0].send_blocked_reason,'서버 확인');assert.equal(f.root.QUICK_CONTACT,null);
});
test('primary selection projects nested server effective consent instead of stale snapshot',()=>{
 const f=fixture();f.root.pcSetPrimaryContact(original.personKey);const consent={sms_consent:false,kakao_consent:false,consent_at:null,opt_out_at:'2026-10-11T00:00:00Z',send_blocked:true,send_blocked_reason:'서버 차단'};
 f.queue.push({request_id:'request-1',operation:'contact_upsert',object_id:f.item.id,status:'done',ack:{person_key:original.personKey,contact_id:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',contact_consent_contract:'preserve-omitted-v1',consent}});f.listeners['phase1:queue']();assert.equal(f.item.contact.sendBlocked,true);assert.equal(f.item.contact.smsConsent,false);assert.equal(f.item.contacts[0].send_blocked,true);
});
function panelCall(state,editing=original){
 const f=fixture({old:editing||{}}),text=fs.readFileSync(path.join(base,'deal-panels-v2.js'),'utf8');
 const start=text.indexOf(' function saveContact(p,S,cur,editing,key){'),end=text.indexOf('\n /* ───────── 2.',start);
 const p={querySelector:s=>s==='#dp-primary'?{checked:false}:f.controls[s.slice(1)]};
 f.root.dealKey=d=>d.id;f.root.saveQuickContact=()=>{};
 const ctx={root:f.root,document:{body:{style:{overflow:''}}},normPhone:v=>String(v||'').replace(/\D/g,''),localNow:()=> '2026-10-11T13:30',$:()=>null,Object};
 vm.runInNewContext(text.slice(start,end)+'\nthis.callSave=saveContact;',ctx);ctx.callSave(p,state,editing||{},editing,editing?.personKey||'');return f;
}
test('panel name-only edit does not manufacture a fresh consent date',()=>{
 const f=panelCall({sms:'yes',kakao:'yes'});assert.equal(f.controls['qc-consent-at'].value,original.consentAt);assert.deepEqual(Array.from(f.root.QUICK_CONTACT.pcConsentFields),[]);
});
test('panel withdrawing one channel retains remaining evidence date',()=>{
 const f=panelCall({sms:'no',kakao:'yes'});assert.equal(f.controls['qc-consent-at'].value,original.consentAt);assert.deepEqual(Array.from(f.root.QUICK_CONTACT.pcConsentFields),['sms_consent']);
});
test('panel last-channel withdrawal preserves evidence and omits its timestamp in the actual payload',()=>{
 const old={...original,kakaoConsent:false},f=panelCall({sms:'no',kakao:'ask'},old);
 assert.equal(f.controls['qc-consent-at'].value,old.consentAt);
 vm.runInNewContext(source,{window:f.root,document:{getElementById:()=>null},Date});
 f.root.saveQuickContact();assert.equal(f.writes.length,1);
 const p=f.writes[0].payload;assert.equal(p.sms_consent,false);assert.equal(Object.hasOwn(p,'consent_at'),false);assert.equal(Object.hasOwn(p,'kakao_consent'),false);assert.equal(f.root.QUICK_CONTACT.pcOriginal.consentAt,old.consentAt);
});
test('panel explicitly granting a channel records the new grant time',()=>{
 const f=panelCall({sms:'yes',kakao:'yes'},{...original,smsConsent:false});assert.equal(f.controls['qc-consent-at'].value,'2026-10-11T13:30');assert.deepEqual(Array.from(f.root.QUICK_CONTACT.pcConsentFields),['sms_consent']);
});
test('legacy name-only save delegates without premature local success or consent writes',()=>{
 const text=fs.readFileSync(path.join(base,'crm.html'),'utf8'),start=text.lastIndexOf('saveContactInfo=function(){'),end=text.indexOf('\n};',start)+3,body=text.slice(start,end);
 const f=fixture(),controls={'#ct-office':{value:'0212345678'},'#ct-name':{value:'수정 이름'},'#ct-mobile':{value:original.mobile},'#ct-email':{value:''}},ctx={window:f.root,CUR_DETAIL:f.root.CUR_DETAIL,QUICK_CONTACT:null,$:s=>controls[s],currentPatch:()=>f.patch,contactInfo:()=>original,phoneN:f.root.phoneN,showDetailErr:m=>f.messages.push(m)};
 f.root.saveQuickContact=()=>{assert.deepEqual(Array.from(ctx.QUICK_CONTACT.pcConsentFields),[]);assert.equal(ctx.QUICK_CONTACT.pcRoot.querySelector('#qc-name').value,'수정 이름');};
 vm.runInNewContext(body+'\nsaveContactInfo();',ctx);assert.equal(f.item.contact,undefined);assert.equal(f.messages.length,0);assert.doesNotMatch(body,/pushWrite\(|saveLocal\(|upsertPerson\(/);
});
