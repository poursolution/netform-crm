'use strict';
/* 정착 모드 v1 서버 SQL(2026-11-09): 단계 칸이 비어도 단계 이동을 받고, 저장 기록에는 적은 값 그대로 남고, 돈 칸은 여전히 막고, 되돌리기가 원래 본문으로 돌린다 */
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const personal=require('../sql/personal-state-compat/20260906/build.cjs'),s=require('../scripts/crm-phase1.cjs');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
const sourceApproval="SET crm.operational_source_ref='rprechiaglyjaydkmxsu';\n",deal=s.uid(6,1);
const rid=n=>`f6091109-0080-4000-8000-${String(n).padStart(12,'0')}`;
async function setup(){const db=await personal.setup();await db.exec(personal.approval+read('sql/personal-state-compat/20260906/candidate.sql'));
 for(const f of ['sql/pipeline-action-bundle/20260906/staging-apply-after-personal.sql','sql/pipeline-quote-version/20260906/staging-apply-after-action.sql'])await db.exec(read(f));
 await db.exec(sourceApproval+read('sql/operational-read-source/20260906/candidate.sql'));
 for(const f of ['sql/pipeline-next-complete/20260906/staging-apply-after-operational-source.sql','sql/pipeline-stage-check/20260906/staging-apply-after-next-complete.sql','sql/pipeline-transition/20260906/staging-apply-after-stage-check.sql',
  /* 운영에 쌓인 같은 함수 패치들 — 운영과 같은 본문 위에서 시험한다 */
  'supabase/migrations/20260919200000_relationship_transition_fields.sql','supabase/migrations/20261005063232_stage_transition_without_skip_reason.sql','supabase/migrations/20261005072749_optional_contract_bid_result.sql'])await db.exec(read(f));
 return db;}
async function write(db,version,payload,request){await db.exec(`SET request.jwt.claim.sub='${s.mapping.accounts[0].auth_uid}';`);return (await db.query('SELECT public.crm_write_command_v2($1,$2,$3,$4,$5) a',[request,'transition',deal,version,JSON.stringify(payload)])).rows[0].a;}
const validatorDef="SELECT pg_get_functiondef('crm_security.crm_transition_validate_v1(text,jsonb,date)'::regprocedure) AS body";
/* 문의 전환 함수는 이 시험 DB 묶음에 없다 — ③은 정적 검사(아래)로 본다. 설치 SQL 의 ① ② 만 떼어 실행한다 */
const sql=read('sql/settle-mode-v1-20261109.sql'),cut=sql.indexOf('-- ③');
const install=sql.slice(0,cut).replace(/^begin;\s*$/m,'')+'\n',rollbackSql=read('sql/settle-mode-v1-20261109-rollback.sql'),rollback=rollbackSql.slice(rollbackSql.indexOf('do $migration$'),rollbackSql.indexOf('do $do$'));

test('settle mode: empty stage fields pass, stored fields stay as typed, money still required, rollback restores',async()=>{
 const db=await setup();try{
  const before=(await db.query(validatorDef)).rows[0].body;
  const empty={from:'first_contact',to:'consulting',transition_date:'2026-09-01',fields:{},skip_reason:'',memo:'',note:'단계만 옮김'};
  await assert.rejects(write(db,1,empty,rid(1)),/quote request is required/);
  await db.exec(install);await db.exec(install);/* 두 번 실행해도 안전 */
  const after=(await db.query(validatorDef)).rows[0].body;
  assert.equal((after.match(/settle-mode-v1:start/g)||[]).length,1);
  assert.equal((await db.query("SELECT (public.crm_settle_mode_v1()->>'version')::int v")).rows[0].v,1);
  assert.equal((await write(db,1,empty,rid(2))).to_stage,'consulting');
  const ev=(await db.query('SELECT fields FROM crm_security.stage_transition_events WHERE deal_id=$1 ORDER BY recorded_at DESC LIMIT 1',[deal])).rows[0];
  assert.deepEqual(ev.fields,{},'저장 기록에 지어낸 값(미입력 · 날짜)이 들어가지 않는다');
  const sent={from:'consulting',to:'sent',transition_date:'2026-09-02',fields:{},skip_reason:'',memo:'',note:'자료 발송'};
  assert.equal((await write(db,2,sent,rid(3))).to_stage,'sent');
  const silent={from:'sent',to:'silent',transition_date:'2026-09-03',fields:{},skip_reason:'',memo:'',note:'침묵'};
  assert.equal((await write(db,3,silent,rid(4))).to_stage,'silent');
  const contract={from:'silent',to:'contract',transition_date:'2026-09-04',fields:{},skip_reason:'',memo:'',note:'계약'};
  await assert.rejects(write(db,4,contract,rid(5)),/invalid contract fields/,'계약금액은 여전히 필수');
  assert.equal((await write(db,4,{...contract,fields:{contract_amount:120000000}},rid(6))).to_stage,'contract');
  await assert.rejects(write(db,5,{from:'contract',to:'consulting',transition_date:'2026-09-05',fields:{quote_due:'2026-13-40'},skip_reason:'',memo:'',note:'x'},rid(7)),e=>e.code==='22023','적은 값은 여전히 형식 검사');
  await db.exec(rollback);
  assert.equal((await db.query(validatorDef)).rows[0].body,before,'되돌리기 = 설치 전 본문 그대로');
 }finally{await db.close();}
});

test('settle mode SQL: promote condition patch is guarded and reversible (static)',()=>{
 const c="status_value !~ '견적.*발송|현장[[:space:]]*방문[[:space:]]*(완료|예정)|전화[[:space:]]*응대[[:space:]]*완료'";
 assert.ok(sql.includes(c)&&rollbackSql.includes(c));
 assert.match(sql,/전환 조건을 바꿀 자리가 %곳입니다/);
 assert.match(sql,/grant execute on function public\.crm_settle_mode_v1\(jsonb\) to authenticated/);
 /* 화면 전송 계층의 전환 정규식도 같은 상태를 받는다 */
 assert.match(read('operational-adapter.js'),/전화\\s\*응대\\s\*완료/);
});
