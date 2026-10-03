import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
import {fixture} from './aligo-database-fixture.mjs';
const sql=readFileSync(new URL('../sql/ops-store-v1-20261002.sql',import.meta.url),'utf8');
const sql2=readFileSync(new URL('../sql/ai-memo-tidy-v1-20261003.sql',import.meta.url),'utf8');/* AI 종류 memo_tidy 추가(2026-10-03) */
/* 운영 저장소 v1: 다시 실행해도 안전 · 테이블 직접 접근 차단 · 쓰기는 관리자 · 플래그 기본 꺼짐 · AI 제안은 저장만 */
test('ops store: idempotent install, RLS-only access, admin writes, flags default off, AI suggestions are proposals',async()=>{
 const db=new PGlite();
 const U='11111111-1111-4111-8111-111111111111',AU='22222222-2222-4222-8222-222222222222',V='44444444-4444-4444-8444-444444444444',AV='55555555-5555-4555-8555-555555555555';
 try{
  await db.exec(fixture);
  await db.exec(sql);await db.exec(sql);/* 두 번 실행해도 안전 */
  await db.exec(sql2);await db.exec(sql2);
  await db.query("insert into public.users values($1,$2,'송보람','admin',true),($3,$4,'이필선','rep',true)",[U,AU,V,AV]);
  await db.query("insert into crm_security.access_review values($1,$2,'admin','admin',true,now()+interval '1 day'),($3,$4,'rep','rep',true,now()+interval '1 day')",[U,AU,V,AV]);
  const as=async uid=>{await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[uid]);await db.exec('set role authenticated');};
  const call=async(fn,p)=>(await db.query('select public.'+fn+'($1::jsonb) result',[JSON.stringify(p||{})])).rows[0].result;
  /* 테이블은 직접 못 읽는다 */
  await as(AU);
  for(const t of ['crm_settings','kpi_promises','kpi_weekly','kpi_actions','report_snapshots','ai_suggestions','merge_log'])await assert.rejects(db.exec('select * from public.'+t),/permission denied/,t);
  /* 플래그: 기본 전부 꺼짐 · 관리자만 바꿈 · 허용된 키 · 참/거짓만 */
  const s0=await call('crm_ops_settings_v1');assert.deepEqual(s0.settings,{enforce_auto_assign:false,enforce_stage_block:false,ai_enabled:false,merge_enabled:false,jandi_enabled:false});
  await assert.rejects(call('crm_ops_settings_v1',{set:{anything:true}}),/invalid payload/);
  await assert.rejects(call('crm_ops_settings_v1',{set:{ai_enabled:'yes'}}),/invalid payload/);
  await as(AV);await assert.rejects(call('crm_ops_settings_v1',{set:{ai_enabled:true}}),/관리자만/);assert.equal((await call('crm_ops_settings_v1')).settings.ai_enabled,false);
  /* AI 제안: 꺼져 있으면 저장되지 않는다 */
  const sug={kind:'work_guess',subject_type:'deal',subject_id:'d1',input_hash:'h1',suggestion:{keys:['옥상>우레탄'],basis:'현장명'},model:'claude'};
  await assert.rejects(call('crm_ai_suggestion_save_v1',sug),/꺼져 있습니다/);
  await as(AU);assert.equal((await call('crm_ops_settings_v1',{set:{ai_enabled:true}})).settings.ai_enabled,true);
  const saved=await call('crm_ai_suggestion_save_v1',sug);assert.equal(saved.suggestion.status,'proposed');
  assert.equal((await call('crm_ai_suggestion_save_v1',{...sug,suggestion:{keys:['다른 값']}})).suggestion.id,saved.suggestion.id,'같은 입력이면 다시 만들지 않는다');
  await assert.rejects(call('crm_ai_suggestion_save_v1',{...sug,kind:'unknown'}),/invalid payload/);
  assert.equal((await call('crm_ai_suggestion_save_v1',{...sug,kind:'memo_tidy',subject_id:'d9',suggestion:{memo:'소장님 화요일 방문 확정'}})).suggestion.kind,'memo_tidy','memo_tidy 저장(2026-10-03 SQL)');
  await as(AV);
  assert.equal((await call('crm_ai_suggestion_list_v1',{kind:'work_guess',subject_ids:['d1','d2']})).suggestions.length,1);
  assert.equal((await call('crm_ai_suggestion_list_v1',{kind:'work_guess',subject_ids:['zz']})).suggestions.length,0);
  const dec=await call('crm_ai_suggestion_decide_v1',{id:saved.suggestion.id,status:'accepted'});assert.equal(dec.suggestion.status,'accepted');assert.equal(dec.suggestion.decided_by,V);
  await assert.rejects(call('crm_ai_suggestion_decide_v1',{id:saved.suggestion.id,status:'applied'}),/invalid payload/);
  /* KPI 약속 · 주간 결과: 관리자만 저장, 모두 읽기 */
  await assert.rejects(call('crm_kpi_promise_save_v1',{promise_key:'assign',title:'당일 배정',target:95}),/관리자만/);
  await as(AU);
  assert.equal((await call('crm_kpi_promise_save_v1',{promise_key:'assign',title:'견적문의는 그날 담당을 정한다',target:95,measure:'당일 배정 ÷ 접수',sort:1})).promise.target,95);
  assert.equal((await call('crm_kpi_promise_save_v1',{promise_key:'assign',title:'견적문의는 그날 담당을 정한다',target:90})).promise.target,90,'같은 열쇠면 고친다');
  await assert.rejects(call('crm_kpi_promise_save_v1',{promise_key:'x',title:'t',target:120}),/확인해 주세요/);
  const monday=(await db.query("select (date_trunc('week',current_date))::date::text d")).rows[0].d;
  assert.deepEqual(await call('crm_kpi_weekly_save_v1',{week_start:monday,rows:[{promise_key:'assign',numerator:3,denominator:4}]}),{ok:true,week_start:monday,saved:1});
  await call('crm_kpi_weekly_save_v1',{week_start:monday,rows:[{promise_key:'assign',numerator:4,denominator:4}]});
  await assert.rejects(call('crm_kpi_weekly_save_v1',{week_start:monday,rows:[{promise_key:'assign',numerator:5,denominator:4}]}),/invalid payload/);
  const tuesday=(await db.query("select (date_trunc('week',current_date)+interval '1 day')::date::text d")).rows[0].d;
  await assert.rejects(call('crm_kpi_weekly_save_v1',{week_start:tuesday,rows:[]}),/월요일/);
  await as(AV);
  assert.equal((await call('crm_kpi_promise_list_v1')).promises.length,1);
  const wk=(await call('crm_kpi_weekly_list_v1',{weeks:4})).rows;assert.equal(wk.length,1);assert.equal(wk[0].numerator,4);
  await assert.rejects(call('crm_kpi_weekly_save_v1',{week_start:monday,rows:[]}),/관리자만/);
  /* 처리 기록: 로그인 사용자가 남긴다 */
  const act=await call('crm_kpi_action_log_v1',{promise_key:'assign',action:'담당 정하기',target_type:'inquiry',target_id:'q1',target_name:'신규 문의 1'});assert.equal(act.action.actor_name,'이필선');
  await assert.rejects(call('crm_kpi_action_log_v1',{promise_key:'assign',action:'x',target_type:'table'}),/invalid payload/);
  assert.equal((await call('crm_kpi_action_list_v1',{limit:10})).actions.length,1);
  /* 보고 스냅샷 · 대표 응답 */
  await assert.rejects(call('crm_report_snapshot_save_v1',{kind:'monthly',period_key:'2026-10',payload:{won:1}}),/관리자만/);
  await as(AU);
  await assert.rejects(call('crm_report_response_save_v1',{kind:'monthly',period_key:'2026-10',response:'yes'}),/먼저 그 기간의 보고를 저장/);
  await call('crm_report_snapshot_save_v1',{kind:'monthly',period_key:'2026-10',payload:{won:200000000,ask:'롯데캐슬'},promises:[{what:'다음 할 일 등록',where:'주간 브리핑'}]});
  await call('crm_report_snapshot_save_v1',{kind:'monthly',period_key:'2026-09',payload:{won:500000000}});
  await assert.rejects(call('crm_report_snapshot_save_v1',{kind:'daily',period_key:'x',payload:{}}),/invalid payload/);
  assert.equal((await call('crm_report_response_save_v1',{kind:'monthly',period_key:'2026-10',response:'partial',note:'1곳만'})).response,'partial');
  await assert.rejects(call('crm_report_response_save_v1',{kind:'monthly',period_key:'2026-10',response:'maybe'}),/invalid payload/);
  await as(AV);
  const snaps=(await call('crm_report_snapshot_get_v1',{kind:'monthly'})).snapshots;assert.deepEqual(snaps.map(s=>s.period_key),['2026-10','2026-09']);
  assert.equal(snaps[0].boss_response,'partial');assert.equal(snaps[0].promises[0].where,'주간 브리핑');
  assert.equal((await call('crm_report_snapshot_get_v1',{kind:'monthly',period_key:'2026-09'})).snapshots.length,1);
  /* 병합 기록: 관리자만 읽기(쓰는 함수는 아직 없다) */
  await assert.rejects(call('crm_merge_log_list_v1'),/관리자만/);
  await as(AU);assert.deepEqual((await call('crm_merge_log_list_v1')).rows,[]);
  /* 로그인하지 않으면 전부 거절 · anon 은 실행 권한 없음 */
  await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub','',false)");await db.exec('set role authenticated');
  await assert.rejects(call('crm_ops_settings_v1'),/forbidden/);
  await db.exec('reset role');await db.exec('set role anon');await assert.rejects(call('crm_kpi_promise_list_v1'),/permission denied/);
  /* 릴리스 계약 매니페스트가 찾을 수 있게 전부 crm_ 로 시작한다 */
  await db.exec('reset role');
  const fns=(await db.query("select proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and proname like 'crm\\_%' and (proname like 'crm\\_ops%' or proname like 'crm\\_kpi%' or proname like 'crm\\_report%' or proname like 'crm\\_ai%' or proname like 'crm\\_merge%') order by 1")).rows.map(r=>r.proname);
  assert.equal(fns.length,14,fns.join(','));
 }finally{await db.close();}
});
