const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const adapter = require('../operational-adapter.js');

const source = fs.readFileSync('crm.html', 'utf8');

function consentSaveFixture({mobile='010-1234-5678', name='테스트 소장', sms=true, kakao=false, blocked=false, consentAt='2026-10-05T00:00:00Z', scoped=false, oldSms=false, oldKakao=false, oldBlocked=false, itemFields={}}={}) {
  const values={'qc-name':name,'qc-mobile':mobile,'qc-role':'관리소장','qc-decision-role':'','qc-relation-tone':'','qc-consent-at':'','qc-block-reason':'','qc-office':'','qc-email':''};
  const checks={'qc-sms':sms,'qc-kakao':kakao,'qc-block':blocked};
  const errorBox={style:{},textContent:''};let globalReads=0;
  const selected=id=>id==='qc-err'?errorBox:({value:values[id]??'',checked:!!checks[id]});
  const document={getElementById:id=>{globalReads++;return scoped?{value:'',checked:false}:selected(id);}};
  const writes=[],messages=[],item={id:'11111111-1111-4111-8111-111111111111',site:'테스트 현장',...itemFields};
  const root={contactDirectoryHTML:()=>'',phoneN:value=>String(value||''),addEventListener:()=>{},
    QUICK_CONTACT:{item,mode:'primary',pcDecision:'',pcTone:'',pcConsentInput:'',pcOriginal:{mobile,consentAt,smsConsent:oldSms,kakaoConsent:oldKakao,sendBlocked:oldBlocked},...(scoped?{pcRoot:{querySelector:selector=>selected(selector.slice(1))}}:{})},
    quickContactErr:message=>messages.push(message),contactInfo:()=>({mobile}),itemPatch:()=>({}),
    Phase1:{queue:{list:()=>[]}},pushWrite:(operation,payload)=>{writes.push({operation,payload});return 'test-request';}};
  require('node:vm').runInNewContext(fs.readFileSync('pc-primary-contact.js','utf8'),{window:root,document});
  root.saveQuickContact();return {writes,messages,item,errorBox,globalReads,root};
}

test('selected contact form wins over stale duplicate IDs for both channels and withdrawal',()=>{
  for(const [sms,kakao] of [[true,false],[false,true],[false,false],[true,true]]){
    const r=consentSaveFixture({scoped:true,sms,kakao,oldSms:!sms,oldKakao:!kakao});assert.equal(r.writes.length,1);
    assert.equal(r.writes[0].payload.manager_mobile,'01012345678');assert.equal(r.writes[0].payload.manager_name,'테스트 소장');
    assert.equal(r.writes[0].payload.sms_consent,sms);assert.equal(r.writes[0].payload.kakao_consent,kakao);
    assert.equal(r.globalReads,0);assert.equal(r.messages.length,0);assert.equal(r.item.contact,undefined);
  }
});

test('selected form validation remains local and blocks invalid identity or missing consent evidence',()=>{
  for(const options of [{mobile:'0101234'},{name:''},{consentAt:null}]){
    const r=consentSaveFixture({scoped:true,...options});assert.equal(r.writes.length,0);
    assert.equal(r.globalReads,0);assert.equal(r.messages.length,0);assert.ok(r.errorBox.textContent);assert.equal(r.errorBox.style.display,'block');
  }
});

test('both current contact callers pass their own form root',()=>{
  assert.match(fs.readFileSync('deal-detail-v3.js','utf8'),/QUICK_CONTACT=\{pcRoot:box,item:d,/);
  assert.match(fs.readFileSync('deal-panels-v2.js','utf8'),/QUICK_CONTACT=\{pcRoot:p,item,key:/);
});

test('consent save accepts formatted mobile and queues its canonical identity without optimistic changes',()=>{
  const result=consentSaveFixture();assert.equal(result.writes.length,1);
  const {operation,payload}=result.writes[0];assert.equal(operation,'contact_upsert');
  assert.equal(payload.manager_mobile,'01012345678');assert.equal(payload.person_key,'mobile:01012345678');
  assert.equal(payload.sms_consent,true);assert.equal(Object.hasOwn(payload,'kakao_consent'),false,'unchanged unchecked channel is omitted, not revoked');
  assert.equal(payload.consent_at,'2026-10-05T00:00:00Z');for(const key of ['send_blocked','opt_out_at','send_blocked_reason'])assert.equal(Object.hasOwn(payload,key),false,key+' unchanged');
  assert.equal(result.item.contact,undefined);assert.equal(result.messages.some(x=>x.includes('11자리')),false);
});

test('consent validation still blocks missing evidence and invalid customer identity',()=>{
  for(const options of [{mobile:'0101234'},{mobile:'0212345678'},{name:''},{consentAt:null}]){
    assert.equal(consentSaveFixture(options).writes.length,0);
  }
});

test('consent withdrawal and send block remain disabled in the queued payload',()=>{
  const withdrawn=consentSaveFixture({sms:false,kakao:false,oldSms:true,oldKakao:true,consentAt:null}).writes[0].payload;
  assert.equal(withdrawn.sms_consent,false);assert.equal(withdrawn.kakao_consent,false);
  const blocked=consentSaveFixture({blocked:true}).writes[0].payload;
  assert.equal(blocked.send_blocked,true);assert.equal(blocked.sms_consent,false);assert.equal(blocked.kakao_consent,false);
});

test('PC contact normalization fix has a fresh browser asset version',()=>{
  const primary=source.match(/pc-primary-contact\.js\?v=([^"' >]+)/);assert.ok(primary,'shared contact module must be loaded with a cache version');
  assert.notEqual(primary[1],'20261006-consent-scope','new sparse consent contract must not reuse the previous browser asset version');
  /* deal-panels-v2 도 이 뒤에 고쳐졌다(관리정보 수정은 상세 기본 화면에서 안 연다 · 2026-10-10) — 새 버전 표식이면 된다 */
  assert.match(source,/deal-panels-v2\.js\?v=(?!20261006-consent-scope)[^"' >]+/);
  /* deal-detail-v3 는 이 뒤에도 고쳐졌다(같은 정보 같은 판단 · 2026-10-08) — 새 버전 표식이면 된다 */
  assert.match(source,/deal-detail-v3\.js\?v=(?!20261006-consent-scope)[^"' >]+/);
});

test('existing Deal contact saves pass the canonical Site ID to the shared server command', () => {
  const ids=['22222222-2222-4222-8222-222222222222','33333333-3333-4333-8333-333333333333','44444444-4444-4444-8444-444444444444'];
  for(const [itemFields,expected] of [[{cleanup_site_id:ids[0],site_id:ids[1],siteId:ids[2]},ids[0]],[{site_id:ids[1],siteId:ids[2]},ids[1]],[{siteId:ids[2]},ids[2]],[{},null]]){
    const r=consentSaveFixture({itemFields});assert.equal(r.writes.length,1);
    assert.equal(r.writes[0].payload.site_id,expected);assert.equal(r.writes[0].operation,'contact_upsert');
    assert.equal(r.item.contact,undefined,'server confirmation must precede local contact projection');
  }
  const start=source.lastIndexOf('saveContactInfo=function(){'),end=source.indexOf('\n};',start)+3;
  assert.ok(start>=0&&end>start,'current legacy entry must exist');const delegated=source.slice(start,end);
  assert.match(delegated,/window\.saveQuickContact\(\)/,'legacy entry must use the same contact save path');
  assert.doesNotMatch(delegated,/upsertPerson\(|saveLocal\(|pushWrite\(/,'legacy entry cannot maintain a separate optimistic contact history');
});

test('new Deal creation remains unlinked until a canonical Site exists', () => {
  assert.match(source, /upsertPerson\(contact,site,officeTel,at\)/);
});

test('live PC contact commands carry the canonical Site ID', () => {
  const moduleSource = fs.readFileSync('pc-primary-contact.js', 'utf8');
  const calls = moduleSource.match(/site_id:item\.cleanup_site_id\|\|item\.site_id\|\|item\.siteId\|\|null/g) || [];
  assert.equal(calls.length, 2);
});

test('contact command contract preserves a valid Site ID and rejects an invalid one', () => {
  const dealId = '11111111-1111-4111-8111-111111111111';
  const siteId = '22222222-2222-4222-8222-222222222222';
  const payload = {opportunity_id: dealId, site_id: siteId, person_key: 'mobile:01012345678', site_name: '한빛아파트', manager_name: '김소장', manager_mobile: '01012345678', manager_role: '관리소장'};
  assert.equal(adapter.normalize('contact_upsert', dealId, 1, payload, adapter.toRpc({operation:'contact_upsert'})).payload.site_id, siteId);
  assert.throws(() => adapter.normalize('contact_upsert', dealId, 1, {...payload, site_id: 'same-name-only'}, 'crm_contact_command_v1'), /INVALID_CONTACT_PAYLOAD/);
});

test('contact updates use the read Deal version and validate the Production receipt', () => {
  const crypto=require('node:crypto');
  const object_id=crypto.randomUUID(),request_id=crypto.randomUUID(),auth_uid=crypto.randomUUID(),user_id=crypto.randomUUID();
  const payload={opportunity_id:object_id,person_key:'mobile:01000000000',site_name:'synthetic',manager_name:'test',manager_mobile:'01000000000',manager_role:'관리소장',sms_consent:true,consent_at:'2026-09-01T00:00:00Z'};
  const command={...adapter.normalize('contact_upsert',object_id,7,payload,'crm_contact_command_v1'),request_id,auth_uid,user_id};
  const ack={contract_version:1,ok:true,replayed:false,operation:'contact_upsert',object_id,request_id,
    actor_auth_uid:auth_uid,actor_user_id:user_id,contact_id:crypto.randomUUID(),person_key:payload.person_key,
    previous_version:7,version:8,audit_event_id:crypto.randomUUID(),server_at:'2026-09-19T00:00:00Z',
    contact_consent_contract:'preserve-omitted-v1',consent:{sms_consent:true,kakao_consent:false,consent_at:payload.consent_at,opt_out_at:null,send_blocked:false,send_blocked_reason:null}};
  assert.equal(adapter.validateAck(ack,command),ack);
  for(const rpc of [undefined,'crm_write_command_v2'])assert.throws(()=>adapter.normalize('contact_upsert',object_id,7,payload,rpc),/CONTACT_STORAGE_CONTRACT_REQUIRED/);
  for(const invalid of [{previous_version:0},{version:7},{audit_event_id:null},{person_key:'wrong'},{sms_consent:false},{contact_consent_contract:undefined},{consent:undefined},{consent:{...ack.consent,sms_consent:false}},{consent:{...ack.consent,consent_at:null}}])
    assert.throws(()=>adapter.validateAck({...ack,...invalid},command),/ACK_CONTRACT_MISMATCH/);
  assert.throws(()=>adapter.normalize('contact_upsert',object_id,undefined,payload,'crm_contact_command_v1'),/READ_VERSION_REQUIRED/);
});

test('contact UI queues current versions, advances on receipt, and refuses missing versions', () => {
  const overlay=require('../operational-overlay.js'),crypto=require('node:crypto');
  const id=crypto.randomUUID(),calls=[],queue=[],listeners={};
  const root={crypto,OperationalAdapter:adapter,B:{deals:[{id,version:7}]},addEventListener:(name,fn)=>{listeners[name]=fn;},
    Phase1:{queue:{list:()=>queue,enqueue:(op,object_id,expected_version,payload,request_id)=>{
      calls.push({op,object_id,expected_version});return {request_id};},flush:async()=>{}}}};
  overlay.install(root);
  root.pushWrite('contact_upsert',{opportunity_id:id});
  assert.equal(calls[0].expected_version,7);
  queue.push({operation:'contact_upsert',object_id:id,request_id:crypto.randomUUID(),status:'done',ack:{version:8}});
  listeners['phase1:queue']();root.pushWrite('contact_upsert',{opportunity_id:id});
  assert.equal(calls[1].expected_version,8);
  assert.throws(()=>root.pushWrite('contact_upsert',{opportunity_id:crypto.randomUUID()}),/READ_VERSION_REQUIRED/);
  root.pushWrite('campaign_create',{});assert.equal(calls.at(-1).expected_version,0);
});
