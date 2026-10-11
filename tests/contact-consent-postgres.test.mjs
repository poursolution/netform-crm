import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {PGlite} from '@electric-sql/pglite';
import {fixture} from './contact-consent-fixture.mjs';

const catalog=JSON.parse(readFileSync(new URL('../review-preview/fixtures/contact-consent-functions.json',import.meta.url),'utf8'));
const original=catalog.functions.find(x=>x.name==='crm_operational_go_command_v1').definition;
const migration=readFileSync(new URL('../supabase/migrations/20261011080417_contact_consent_preserve_omitted.sql',import.meta.url),'utf8');
const A='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',U='11111111-1111-4111-8111-111111111111',D='dddddddd-dddd-4ddd-8ddd-dddddddddddd',C='cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const OTHER='22222222-2222-4222-8222-222222222222';
const base={opportunity_id:D,site_id:null,person_key:'mobile:01012345678',site_name:'합성 현장',office_phone:'0212345678',office_email:null,manager_name:'합성 담당',manager_mobile:'01012345678',manager_role:'담당자',is_primary:false,started_at:null};
const readSql=`select jsonb_build_object('sms_consent',sms_consent,'kakao_consent',kakao_consent,'consent_at',consent_at,'opt_out_at',opt_out_at,'send_blocked',send_blocked,'send_blocked_reason',send_blocked_reason) as value from crm_security.contact_compat_state where contact_id=$1 and deal_id=$2`;

test('captured production contact contract preserves omitted consent atomically (local PGlite only)',async t=>{
  const db=new PGlite();
  try{
    await db.exec(fixture);
    await db.exec(original);
    for(const f of catalog.functions.filter(x=>Number.isInteger(x.depth)).sort((a,b)=>b.depth-a.depth))await db.exec(f.definition);
    await db.exec('revoke all on function public.crm_write_command_v2(uuid,text,uuid,integer,jsonb) from public,anon; grant execute on function public.crm_write_command_v2(uuid,text,uuid,integer,jsonb) to authenticated;');
    const hash=async()=>(await db.query("select md5(pg_get_functiondef('crm_security.crm_operational_go_command_v1(uuid,text,uuid,integer,jsonb)'::regprocedure)) h")).rows[0].h;
    assert.equal(await hash(),'a0209794d0844913f287bd9da509e3e1','the source under test is the exact catalog handler');
    await db.exec(migration);
    const patched=(await db.query("select pg_get_functiondef('crm_security.crm_operational_go_command_v1(uuid,text,uuid,integer,jsonb)'::regprocedure) d")).rows[0].d;
    const write=async(payload={},version=1,id=randomUUID(),rpc='crm_contact_command_v1',operation='contact_upsert')=>(await db.query(`select public.${rpc}($1,$2,$3,$4,$5::jsonb) value`,[id,operation,D,version,JSON.stringify({...base,...payload})])).rows[0].value;
    const state=async(contact=C)=>(await db.query(readSql,[contact,D])).rows[0]?.value;
    const counts=async()=>(await db.query(`select (select count(*)::int from public.contacts) contacts,(select count(*)::int from public.contact_assignments) assignments,(select count(*)::int from crm_security.audit_events) audits,(select count(*)::int from crm_security.command_receipts) receipts,(select version from public.deals where id='${D}') version`)).rows[0];
    const reset=async(extra={},existing=true)=>{
      await db.exec('reset role; truncate crm_security.command_receipts,crm_security.audit_events,crm_security.contact_compat_state,public.contact_assignments,public.activities,public.assignment_history,public.contacts,public.deals,public.users cascade;');
      await db.query('insert into public.users values($1,$2,$3,$4,true),($5,$5,$6,$4,true)',[U,A,'합성 사용자','rep',OTHER,'다른 사용자']);
      await db.query('insert into public.deals(id,owner_id,version,stage_code) values($1,$2,1,$3)',[D,U,'consult']);
      if(existing){
        await db.query('insert into public.contacts(id,person_key,name,mobile) values($1,$2,$3,$4)',[C,base.person_key,'기존 이름',base.manager_mobile]);
        await db.query('insert into public.contact_assignments(person_key,opportunity_id,site_name,started_at,status) values($1,$2,$3,$4,$5)',[base.person_key,D,base.site_name,'2026-10-01','current']);
        const s={sms_consent:true,kakao_consent:false,consent_at:'2026-10-01T00:00:00Z',opt_out_at:null,send_blocked:false,send_blocked_reason:null,...extra};
        await db.query('insert into crm_security.contact_compat_state(contact_id,deal_id,decision_role,relationship_tone,sms_consent,kakao_consent,consent_at,opt_out_at,send_blocked,send_blocked_reason,updated_by_auth_uid,updated_by_user_id) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)',[C,D,'의사결정자','우호적',s.sms_consent,s.kakao_consent,s.consent_at,s.opt_out_at,s.send_blocked,s.send_blocked_reason,A,U]);
      }
      await db.query("select set_config('request.jwt.claim.sub',$1,false)",[A]);
    };

    await t.test('migration is idempotent and unrelated handler branches stay intact',async()=>{
      const first=await hash();await db.exec(migration);assert.equal(await hash(),first);
      assert.match(patched,/IF p_operation IN\('inquiry_assign','inquiry_consultant'\)/);
      assert.match(patched,/ELSIF p_operation='rep_manager_comment'/);
      await reset();
      const ack=await write({decision_role:'실무자',relationship_tone:'중립'},1,randomUUID(),'crm_write_command_v2','contact_relationship');
      assert.equal(ack.version,2);assert.equal(ack.contact_consent_contract,undefined);assert.equal((await state()).sms_consent,true);
    });
    await t.test('omitting all six keys preserves consent and relationship fields',async()=>{
      await reset();const before=await state();const ack=await write();
      assert.deepEqual(await state(),before);assert.deepEqual(ack.consent,before);assert.equal(ack.contact_consent_contract,'preserve-omitted-v1');
      assert.equal(ack.contact_id,C);assert.equal(ack.previous_version,1);assert.equal(ack.version,2);
      const relation=(await db.query('select decision_role,relationship_tone from crm_security.contact_compat_state')).rows[0];
      assert.deepEqual(relation,{decision_role:'의사결정자',relationship_tone:'우호적'});
    });
    await t.test('omitted withdrawal, blocking reason and false flags stay preserved',async()=>{
      await reset({sms_consent:false,kakao_consent:false,consent_at:null,opt_out_at:'2026-10-02T03:00:00Z',send_blocked:true,send_blocked_reason:'고객 수신 거부'});
      const before=await state();const ack=await write({manager_name:'이름만 정정'});
      assert.deepEqual(ack.consent,before);assert.deepEqual(await state(),before);
    });
    await t.test('a partial explicit false changes only that key; explicit null clears nullable evidence',async()=>{
      await reset({kakao_consent:true});const before=await state();const ack=await write({sms_consent:false});
      assert.deepEqual(ack.consent,{...before,sms_consent:false});
      const cleared=await write({kakao_consent:false,consent_at:null},2);
      assert.equal(cleared.consent.consent_at,null);assert.equal(cleared.consent.sms_consent,false);assert.equal(cleared.consent.kakao_consent,false);
    });
    await t.test('explicit unblocking and withdrawal clearing preserve omitted reason',async()=>{
      await reset({sms_consent:false,consent_at:null,opt_out_at:'2026-10-02T03:00:00Z',send_blocked:true,send_blocked_reason:'원래 이유'});
      const ack=await write({send_blocked:false,opt_out_at:null});
      assert.equal(ack.consent.send_blocked,false);assert.equal(ack.consent.opt_out_at,null);assert.equal(ack.consent.send_blocked_reason,'원래 이유');
      const next=await write({send_blocked_reason:null},2);assert.equal(next.consent.send_blocked_reason,null);
    });
    await t.test('new contact defaults do not manufacture consent',async()=>{
      await reset({},false);const ack=await write();
      assert.deepEqual(ack.consent,{sms_consent:false,kakao_consent:false,consent_at:null,opt_out_at:null,send_blocked:false,send_blocked_reason:null});
      assert.notEqual(ack.contact_id,C);assert.deepEqual(await state(ack.contact_id),ack.consent);
    });
    await t.test('boolean null, string, number and invalid nullable field types roll back',async()=>{
      for(const payload of [{sms_consent:null},{kakao_consent:'false'},{send_blocked:0},{consent_at:{}},{opt_out_at:[]},{send_blocked_reason:true},{consent_at:'infinity'},{opt_out_at:'not a date'}]){
        await reset();const before=await state();await assert.rejects(write(payload));
        assert.deepEqual(await state(),before);assert.deepEqual(await counts(),{contacts:1,assignments:1,audits:0,receipts:0,version:1});
        assert.equal((await db.query('select name from public.contacts')).rows[0].name,'기존 이름');
      }
    });
    await t.test('effective merged consent cannot lose evidence or coexist with refusal',async()=>{
      for(const payload of [{consent_at:null},{send_blocked:true,opt_out_at:'2026-10-03T00:00:00Z'},{opt_out_at:'2026-10-03T00:00:00Z'}]){
        await reset();const before=await state();await assert.rejects(write(payload),/invalid merged contact consent/);assert.deepEqual(await state(),before);assert.equal((await counts()).version,1);
      }
      await reset({sms_consent:false,consent_at:null,opt_out_at:'2026-10-02T00:00:00Z',send_blocked:true});
      await assert.rejects(write({sms_consent:true,consent_at:'2026-10-03T00:00:00Z'}),/invalid merged contact consent/);
      await reset({},false);await assert.rejects(write({sms_consent:true}),/invalid merged contact consent/);assert.equal((await counts()).contacts,0);
    });
    await t.test('explicit refusal may atomically turn off both channels',async()=>{
      await reset({kakao_consent:true});const ack=await write({sms_consent:false,kakao_consent:false,send_blocked:true,opt_out_at:'2026-10-04T00:00:00Z',send_blocked_reason:'명시적 거부'});
      assert.equal(ack.consent.sms_consent,false);assert.equal(ack.consent.kakao_consent,false);assert.equal(ack.consent.send_blocked,true);assert.equal(ack.consent.send_blocked_reason,'명시적 거부');
    });
    await t.test('retry returns the exact stored consent even after a later consent change',async()=>{
      await reset();const id=randomUUID(),first=await write({},1,id);await write({sms_consent:false,consent_at:null},2);
      const replay=await write({},1,id);assert.deepEqual(replay,{...first,replayed:true});assert.equal(replay.consent.sms_consent,true);assert.equal((await state()).sms_consent,false);
      assert.deepEqual(await counts(),{contacts:1,assignments:1,audits:2,receipts:2,version:3});
      await assert.rejects(write({sms_consent:false},1,id),/REQUEST_ID_REUSE/);assert.equal((await counts()).version,3);
    });
    await t.test('actor access, account changes, stale versions and wrong operations fail without writes',async()=>{
      await reset();await assert.rejects(write({},0),/version conflict/);
      await assert.rejects(write({},1,randomUUID(),'crm_contact_command_v1','assign'),/invalid contact command/);
      await assert.rejects(write({company:'unknown field'}),/invalid contact payload/);
      await db.query("select set_config('request.jwt.claim.sub',$1,false)",[OTHER]);await assert.rejects(write(),/forbidden/);
      await db.query("select set_config('request.jwt.claim.sub',$1,false)",[A]);await db.exec('update public.users set active=false');await assert.rejects(write(),/forbidden/);
      assert.equal((await counts()).receipts,0);assert.equal((await counts()).version,1);
    });
    await t.test('revoked deal access blocks even an otherwise valid receipt replay',async()=>{
      await reset();const id=randomUUID();await write({},1,id);await db.query('update public.deals set owner_id=$1 where id=$2',[OTHER,D]);
      await assert.rejects(write({},1,id),/forbidden/);assert.equal((await counts()).receipts,1);
    });
    await t.test('anonymous cannot execute and authenticated cannot read private consent rows',async()=>{
      await reset();const privileges=(await db.query("select has_function_privilege('anon','public.crm_contact_command_v1(uuid,text,uuid,integer,jsonb)','execute') anon,has_function_privilege('authenticated','public.crm_contact_command_v1(uuid,text,uuid,integer,jsonb)','execute') authenticated,has_function_privilege('service_role','public.crm_contact_command_v1(uuid,text,uuid,integer,jsonb)','execute') service")).rows[0];
      assert.deepEqual(privileges,{anon:false,authenticated:true,service:false});
      await db.exec('set role anon');await assert.rejects(write(),/permission denied/);await db.exec('reset role; set role authenticated');
      await assert.rejects(db.query('select * from crm_security.contact_compat_state'),/permission denied/);
      const ack=await write();assert.equal(ack.version,2);await db.exec('reset role');
    });
    await t.test('old go behind an installed wrapper rolls back its destructive write',async()=>{
      await reset();const before=await state();await db.exec(original);
      await assert.rejects(write(),/CONTACT_CONSENT_CONTRACT_MISMATCH/);
      assert.deepEqual(await state(),before);assert.deepEqual(await counts(),{contacts:1,assignments:1,audits:0,receipts:0,version:1});
      await db.exec(patched);
    });
    await t.test('old receipt never acquires the new preservation marker',async()=>{
      await reset();await db.exec(original);const id=randomUUID();const old=await write({},1,id,'crm_write_command_v2');assert.equal(old.contact_consent_contract,undefined);
      await db.exec(patched);await assert.rejects(write({},1,id),/CONTACT_CONSENT_CONTRACT_MISMATCH/);
      const stored=(await db.query('select ack from crm_security.command_receipts where request_id=$1',[id])).rows[0].ack;
      assert.deepEqual(stored,old);assert.equal((await counts()).version,2);
    });
    await t.test('a modified dispatcher ACK cannot differ from its durable receipt',async()=>{
      await reset();const before=await state();
      const dispatcher=catalog.functions.find(x=>x.name==='crm_write_command_v2').definition;
      await db.exec(dispatcher.replace('return crm_security.crm_write_command_v2_pre_aligo_20260919(p_request_id,p_operation,p_object_id,p_expected_version,p_payload);',
        `return crm_security.crm_write_command_v2_pre_aligo_20260919(p_request_id,p_operation,p_object_id,p_expected_version,p_payload)||'{"consent":{"sms_consent":false}}'::jsonb;`));
      await assert.rejects(write(),/CONTACT_CONSENT_CONTRACT_MISMATCH/);
      assert.deepEqual(await state(),before);assert.deepEqual(await counts(),{contacts:1,assignments:1,audits:0,receipts:0,version:1});
      await db.exec(dispatcher);
    });
    await t.test('a server without the guarded RPC has no write fallback',async()=>{
      await reset();const wrapper=(await db.query("select pg_get_functiondef('public.crm_contact_command_v1(uuid,text,uuid,integer,jsonb)'::regprocedure) d")).rows[0].d;
      await db.exec('drop function public.crm_contact_command_v1(uuid,text,uuid,integer,jsonb)');
      await assert.rejects(write(),/does not exist/);assert.deepEqual(await counts(),{contacts:1,assignments:1,audits:0,receipts:0,version:1});
      await db.exec(wrapper);await db.exec(migration);
    });
    await t.test('unknown handler drift refuses migration rather than replacing unrelated code',async()=>{
      await db.exec(patched.replace("reason:=nullif(btrim(coalesce(p_payload->>'reason','')),'');","reason:=nullif(btrim(coalesce(p_payload->>'reason','')),''); -- unknown edit"));
      const driftHash=await hash();await assert.rejects(db.exec(migration),/CONTACT_GO_BASE_HASH_MISMATCH/);await db.exec('rollback');assert.equal(await hash(),driftHash);
      await db.exec(patched);await db.exec(migration);
    });
  }finally{await db.close();}
});
