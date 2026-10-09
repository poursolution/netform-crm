const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),path=require('path');
const {PGlite}=require('@electric-sql/pglite');
/* 관리 단위 SQL(sql/deal-units-v1-20261010.sql)을 실제로 실행해 본다: 관리자 · 담당만 저장 · 역할 검증 · 중복 제거 · 이력 · 읽기 · 두 번 돌려도 같은 결과 */
const sql=fs.readFileSync(path.join(__dirname,'../sql/deal-units-v1-20261010.sql'),'utf8');
test('관리 단위 SQL: 권한 · 역할 검증 · 이력 · 읽기',async()=>{
 const db=new PGlite();
 try{
  await db.exec(`create role anon; create role authenticated; create schema crm_security;
  create table users(user_id uuid primary key,auth_uid uuid,name text,active boolean default true);
  create table deals(id uuid primary key default gen_random_uuid(),owner_id uuid,assignee_name text);
  create function crm_security.actor() returns table(user_id uuid,auth_uid uuid,display_name text,permission_role text) language sql as $$select u.user_id,u.auth_uid,u.name,current_setting('test.role',true) from public.users u where u.name=current_setting('test.name',true)$$;
  insert into users values('10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','송보람',true),('10000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000002','이필선',true),('10000000-0000-4000-8000-000000000003','20000000-0000-4000-8000-000000000003','황윤선',true);
  set test.name='이필선'; set test.role='rep';`);
  await db.exec(sql);await db.exec(sql);
  const d1=(await db.query("insert into deals(owner_id,assignee_name) values('10000000-0000-4000-8000-000000000002','이필선') returning id")).rows[0].id;
  const d2=(await db.query("insert into deals(owner_id,assignee_name) values('10000000-0000-4000-8000-000000000003','황윤선') returning id")).rows[0].id;
  const save=async body=>(await db.query('select public.crm_deal_unit_save_v1($1::jsonb) r',[JSON.stringify(body)])).rows[0].r;
  const list=async body=>(await db.query('select public.crm_deal_unit_list_v1($1::jsonb) r',[JSON.stringify(body||{})])).rows[0].r;
  /* 담당은 자기 영업건만 */
  let r=await save({deal_id:d1,roles:[{name:'한준엽',role:'지원'},{name:'박현우',role:'시공 담당'},{name:' 한준엽 ',role:'지원'}],brand_inflow:'석민이앤씨',brand_proposal:'POUR공법',brand_contract:''});
  assert.equal(r.ok,true);assert.equal(r.contract,1);assert.deepEqual(r.unit.roles,[{name:'한준엽',role:'지원'},{name:'박현우',role:'시공 담당'}],'이름 + 역할 중복 제거');assert.equal(r.unit.brand_contract,null);assert.equal(r.unit.updated_by_name,'이필선');
  await assert.rejects(save({deal_id:d2,roles:[]}),/관리자 또는 담당자만/);
  await assert.rejects(save({deal_id:d1,roles:[{name:'아무나',role:'주담당'}]}),/참여 역할 형식/,'주담당은 여기 저장하지 않는다(귀속은 crm_deal_owners)');
  await assert.rejects(save({deal_id:d1,roles:[{name:'',role:'지원'}]}),/참여 역할 형식/);
  await assert.rejects(save({deal_id:d1,roles:Array.from({length:11},(_,i)=>({name:'사람'+i,role:'지원'}))}),/10명까지/);
  await assert.rejects(save({deal_id:'00000000-0000-4000-8000-000000000000'}),/영업건을 찾을 수 없습니다/);
  /* 같은 값은 이력에 안 남고, 바뀌면 전 → 후 */
  r=await save({deal_id:d1,roles:[{name:'한준엽',role:'지원'},{name:'박현우',role:'시공 담당'}],brand_inflow:'석민이앤씨',brand_proposal:'POUR공법'});
  let ev=(await db.query('select count(*)::int n from crm_security.deal_unit_events where deal_id=$1',[d1])).rows[0].n;assert.equal(ev,1);
  r=await save({deal_id:d1,roles:[{name:'박현우',role:'시공 담당'}],brand_inflow:'석민이앤씨',brand_proposal:'POUR공법',brand_contract:'POUR공법'});
  const L=await list({deal_id:d1});assert.equal(L.units.length,1);assert.equal(L.units[0].brand_contract,'POUR공법');assert.equal(L.events.length,2);assert.equal(L.events[0].before.roles.length,2);assert.equal(L.events[0].after.roles.length,1);assert.equal(L.events[0].by,'이필선');
  /* 관리자는 남의 영업건도 · 전체 읽기 */
  await db.exec("set test.name='송보람'; set test.role='admin'");
  r=await save({deal_id:d2,roles:[{name:'이필선',role:'외부영업'}]});assert.equal(r.unit.updated_by_name,'송보람');
  const all=await list();assert.equal(all.units.length,2);assert.deepEqual(all.events,[]);
 }finally{await db.close();}
});
