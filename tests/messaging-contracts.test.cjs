'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const root=path.resolve(__dirname,'..');
const read=(...p)=>fs.readFileSync(path.join(root,...p),'utf8');
const pc=read('crm.html');
const mobile=read('mobile.html');
const legacyRelationship=read('sql','20260905_relationship_messaging.sql');
const legacyContext=read('sql','20260905_contextual_message_composer.sql');
const legacyCampaign=read('sql','20260905_campaign_center.sql');
const snapshot=JSON.parse(read('sql','operational-bundle','20260906','after.json'));
const contract=read('docs','operational-cutover-20260906','messaging-contracts.md');
const review=read('sql','messaging-domain','20260906','review.md');
const manifest=JSON.parse(read('sql','messaging-domain','20260906','manifest.json'));

const functionBody=(source,name)=>{
  const start=source.indexOf(`function ${name}(`);
  assert.notEqual(start,-1,`${name} must remain reachable`);
  const next=source.indexOf('\nfunction ',start+10);
  return source.slice(start,next<0?source.length:next);
};

test('M01 keeps external app launch separate from completion evidence',()=>{
  for(const source of [pc,mobile]){
    assert.match(source,/location\.href='tel:'/);
    assert.match(source,/location\.href='sms:'/);
    assert.match(source,/kakaotalk:\/\/launch|scheme=kakaotalk/);
  }
  assert.match(pc,/앱을 연 것만으로는 발송 기록을 남기지 않습니다/);
  assert.match(mobile,/앱을 연 것만으로는 발송 이력이 남지 않습니다/);
  assert.match(contract,/전화 시도 기록.*성공 기록이 아니다/);
});

test('M03 copy-only handlers never create a write',()=>{
  const pcCopy=functionBody(pc,'relationshipCopy');
  const mobileCopy=functionBody(mobile,'rmCopyM');
  assert.match(pcCopy,/navigator\.clipboard|window\.prompt/);
  assert.match(mobileCopy,/rmCopyTextM/);
  assert.doesNotMatch(pcCopy,/pushWrite\(/);
  assert.doesNotMatch(mobileCopy,/pushWrite\(/);
});

test('M02 current UI splits writes but the local contract preserves launch gate and user attestation',()=>{
  assert.match(pc,/if\(status==='sent'&&!msg\.launched\)return/);
  assert.match(mobile,/if\(status==='sent'&&!RM_M\.launched\)return/);
  for(const source of [pc,mobile]){
    assert.match(source,/pushWrite\('message_log',payload\)/);
    assert.match(source,/pushWrite\('next_action'/);
  }
  assert.match(pc,/pushWrite\('activity'/);
  assert.match(mobile,/addActivity\(d,RM_M\.channel/);
  assert.match(contract,/provider-confirmed delivery가 아니다/);
  assert.match(contract,/부분 성공과 중복이 가능/);
  assert.match(contract,/attestation_kind='user_attested'/);
  assert.match(contract,/sql\/message-log-compat\/20260906/);
});

test('M04 is a reminder, not an automatic provider queue',()=>{
  const pcSchedule=functionBody(pc,'relationshipSchedule');
  const mobileSchedule=functionBody(mobile,'rmScheduleM');
  for(const body of [pcSchedule,mobileSchedule]){
    assert.match(body,/메시지발송/);
    assert.match(body,/scheduled_at/);
    assert.match(body,/template_key/);
    assert.match(body,/draft_body/);
    assert.match(body,/자동발송이 아닌 담당자 발송 알림/);
  }
});

test('M05 local candidate collapses current split writes with post-M02 correlation',()=>{
  assert.match(pc,/pushWrite\('relationship_hold'/);
  assert.match(pc,/pushWrite\('relationship_response'/);
  assert.match(mobile,/pushWrite\('relationship_hold'/);
  assert.match(mobile,/pushWrite\('relationship_response'/);
  assert.match(contract,/가장 최근 `sent \+ response 미기록` outcome/);
  assert.match(contract,/다른 업무 Next Action을 일괄 취소.*해서는 안 된다/);
  assert.match(contract,/DERIVED_SAFE_LOCAL_CANDIDATE/);
});

test('M06 is PC-only queue intent and explicitly waits for provider callback',()=>{
  assert.match(pc,/function campaignQueue\(mode\)/);
  assert.match(pc,/pushWrite\('campaign_create'/);
  assert.match(pc,/실제 발송 성공은 서버 콜백으로만 확정됩니다/);
  assert.doesNotMatch(mobile,/pushWrite\('campaign_create'/);
  assert.match(contract,/PC에서만 도달 가능/);
});

test('campaign all-send stays explicit, consent-scoped, and cannot record false success',()=>{
  assert.match(pc,/group:'전체 발송',items:\[\['all','전체 고객'\]\]/);
  assert.match(pc,/발송 가능 전체 선택 · /);
  assert.match(pc,/function campaignGuard\(t\)[\s\S]*문자 수신동의 없음/);
  assert.match(pc,/id="cc-final-approval" type="checkbox"/);
  assert.match(pc,/if\(!approval\|\|!approval\.checked\)/);
  const queue=functionBody(pc,'campaignQueue');
  assert.ok(queue.indexOf("pushWrite('campaign_create'")<queue.indexOf('CAMPAIGN_STORE.campaigns.unshift(obj)'),'local history must only change after the operational queue accepts the request');
  assert.match(queue,/대상이나 이력은 변경되지 않았습니다/);
});

test('campaign recipients normalize Korean international numbers and preserve consent evidence',()=>{
  const source=functionBody(pc,'campaignPhone');
  const normalize=new Function('phoneN',`${source};return campaignPhone;`)(v=>String(v||''));
  assert.equal(normalize('+82 10-6225-2310'),'01062252310');
  assert.equal(normalize('0082-10-6225-2310'),'01062252310');
  assert.equal(normalize('010-6225-2310'),'01062252310');
  assert.match(pc,/smsConsent:x\.smsConsent===true\|\|x\.sms_consent===true/);
  assert.match(pc,/optOutAt:x\.optOutAt\|\|x\.opt_out_at/);
});

test('actual Staging snapshot lacks messaging and campaign persistence contracts',()=>{
  const names=(snapshot.public.relations||[]).map(x=>x.name);
  const signatures=(snapshot.public.functions||[]).map(x=>x.signature);
  for(const name of ['crm_message_logs','crm_campaigns','crm_campaign_recipients']){
    assert.equal(names.includes(name),false,name);
  }
  assert.equal(signatures.some(x=>/crm_(message|campaign|relationship)/.test(x)),false);

  const cols=table=>snapshot.public.columns.filter(x=>x.table===table).map(x=>x.name);
  for(const name of ['sms_consent','kakao_consent','consent_at','opt_out_at','send_blocked']){
    assert.equal(cols('contacts').includes(name),false,name);
  }
  for(const name of ['last_outbound_at','outbound_attempts','waiting_reason','relationship_state','relationship_hold_until']){
    assert.equal(cols('deals').includes(name),false,name);
  }
  for(const name of ['scheduled_at','channel','template_key','draft_body']){
    assert.equal(cols('next_actions').includes(name),false,name);
  }
});

test('historical SQL proves intent but not current UUID security and idempotency',()=>{
  assert.match(legacyRelationship,/create table if not exists public\.crm_message_logs/);
  assert.match(legacyContext,/quote_attachment_id/);
  assert.match(legacyCampaign,/create table if not exists public\.crm_campaigns/);
  assert.match(legacyCampaign,/provider_message_id/);
  for(const source of [legacyRelationship,legacyContext,legacyCampaign]){
    assert.doesNotMatch(source,/crm_security\.can_deal/);
    assert.doesNotMatch(source,/actor_auth_uid/);
    assert.doesNotMatch(source,/payload_hash/);
  }
  assert.match(contract,/과거 Golden SQL은 증거일 뿐 후보가 아니다/);
});

test('historical review-only manifest remains distinct from later M02/M04 candidates',()=>{
  assert.equal(manifest.status,'CONTRACT_REVIEW_ONLY');
  assert.equal(manifest.public_dispatcher_changed,false);
  assert.equal(manifest.candidate_sql_created,false);
  assert.equal(manifest.rollback_created,false);
  assert.equal(manifest.adapter_created,false);
  assert.deepEqual(manifest.connected_operations,[]);
  assert.match(review,/NO_SQL_CANDIDATE/);
  assert.match(contract,/M02\/M04 candidate SQL\/rollback\/adapter는 생성했으나 Staging 적용 0/);
  assert.match(contract,/contract-only operation: `relationship_hold`, `relationship_response`/);
});
