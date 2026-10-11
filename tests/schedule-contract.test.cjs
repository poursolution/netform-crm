/* Actual migration on embedded PostgreSQL; synthetic identities/data; no remote calls. */
const {PGlite}=require('@electric-sql/pglite');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{randomUUID}=require('node:crypto');
const out=path.resolve(__dirname,'..');
const sql=fs.readFileSync(path.join(out,'sql/schedule-preserve-v1-20261011.sql'),'utf8');
const ids={user:randomUUID(),auth:randomUUID(),other:randomUUID(),otherAuth:randomUUID(),deal:randomUUID(),inq:randomUUID(),foreign:randomUUID(),task:randomUUID(),itask:randomUUID()};
const db=new PGlite();let passed=[];
const q=(s,p=[])=>db.query(s,p), exec=s=>db.exec(s);
const rpc=async(n,p)=>(await q(`select public.${n}($1::jsonb) as r`,[JSON.stringify(p)])).rows[0].r;
const list=(kind='deal',id=ids.deal,page=1)=>rpc('crm_schedule_list_v1',{target_type:kind,target_id:id,page});
const check=async(name,fn)=>{await fn();passed.push(name);};
const reject=async(fn,code)=>{await assert.rejects(fn,e=>e.code===code,code);};
let today,later,far;
const command=async(op='add',extra={},kind='deal',target=ids.deal)=>({request_id:randomUUID(),target_type:kind,target_id:target,expected_token:(await list(kind,target)).token,operation:op,due_on:later,date_basis:'internal_plan',...(op==='add'?{action_type:'후속접촉',title:'견적 준비'}:{action_id:ids.task,reason:'고객 일정 확인'}),...extra});
async function main(){
 await exec(`create role anon; create role authenticated;
 create schema auth; create schema crm_security;
 create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.auth',true),'')::uuid $$;
 create table public.users(user_id uuid primary key,auth_uid uuid,name text,active boolean default true,role text);
 create table crm_security.access_review(user_id uuid,reviewed_auth_uid uuid,permission_role text,approved boolean default true,source_role text,expires_at timestamptz default now()+interval '1 day');
 create table crm_security.object_scope(user_id uuid,deal_id uuid,inquiry_id uuid,expires_at timestamptz,can_write boolean);
 create table public.deals(id uuid primary key,owner_id uuid,version integer not null default 1,updated_at timestamptz default now(),stage_code text default 'consulting',lifecycle_status text default 'open',outcome text,next_action text,next_action_date date);
 create table public.inquiries(id uuid primary key,assigned_to uuid,brand text,inquiry_type text,status text default '신규',next_action_date date,updated_at timestamptz not null default now(),first_response_at timestamptz,responded_at timestamptz,deal_id uuid,opportunity_id uuid,qualified_at timestamptz);
 create table public.next_actions(id uuid primary key default gen_random_uuid(),deal_id uuid references public.deals,inquiry_id uuid references public.inquiries,action_type text not null default '기타',title text not null,due_at timestamptz not null,assignee_name text not null,status text not null default 'open' check(status in ('open','completed','cancelled')),completed_at timestamptz,source_activity_id uuid,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),check((deal_id is not null)<>(inquiry_id is not null)));
 create table crm_security.inquiry_audit_events(event_id uuid default gen_random_uuid(),inquiry_id uuid,action text,created_at timestamptz default now());
 create function crm_security.actor() returns table(user_id uuid,auth_uid uuid,display_name text,permission_role text) language sql stable security definer set search_path='' as $$
 select u.user_id,u.auth_uid,u.name,r.permission_role from public.users u join crm_security.access_review r on r.user_id=u.user_id where auth.uid() is not null and u.auth_uid=auth.uid() and u.active and r.approved and r.reviewed_auth_uid=u.auth_uid and r.source_role=u.role and r.expires_at>now() and (select count(*) from public.users x where x.auth_uid=u.auth_uid)=1 $$;
 create function crm_security.can_deal(target uuid,writing boolean default false) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from crm_security.actor() a join public.deals d on d.id=target where a.permission_role='admin' or (a.permission_role='rep' and d.owner_id=a.user_id) or (a.permission_role='branch' and exists(select 1 from crm_security.object_scope s where s.user_id=a.user_id and s.deal_id=d.id and s.expires_at>now() and (not writing or s.can_write)))) $$;
 create function crm_security.can_inquiry(target uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from crm_security.actor() a join public.inquiries i on i.id=target where a.permission_role='admin' or (a.permission_role in ('rep','consultation') and i.assigned_to=a.user_id) or (a.permission_role='branch' and exists(select 1 from crm_security.object_scope s where s.user_id=a.user_id and s.inquiry_id=i.id and s.expires_at>now()))) $$;
 create function public.set_updated_at() returns trigger language plpgsql as $$ begin new.updated_at=clock_timestamp();return new;end $$;
 create trigger trg_next_actions_upd before update on public.next_actions for each row execute function public.set_updated_at();
 create table crm_security.test_signals(action_id uuid,operation text);
 create function crm_security.test_signal() returns trigger language plpgsql security definer set search_path='' as $$begin insert into crm_security.test_signals values(new.id,tg_op);return new;end$$;
 create trigger test_signal after insert or update on public.next_actions for each row execute function crm_security.test_signal();`);
 await q('insert into public.users values($1,$2,\'담당 A\',true,\'rep\'),($3,$4,\'담당 B\',true,\'rep\')',[ids.user,ids.auth,ids.other,ids.otherAuth]);
 await exec("insert into crm_security.access_review(user_id,reviewed_auth_uid,permission_role,source_role) select user_id,auth_uid,'rep','rep' from public.users;");
 await q('insert into public.deals(id,owner_id) values($1,$2),($3,$4)',[ids.deal,ids.user,ids.foreign,ids.other]);
 await q('insert into public.inquiries(id,assigned_to) values($1,$2)',[ids.inq,ids.user]);
 ({today,later,far}=(await q("select (now() at time zone 'Asia/Seoul')::date::text today,((now() at time zone 'Asia/Seoul')::date+3)::text later,((now() at time zone 'Asia/Seoul')::date+10)::text far")).rows[0]);
 await q("insert into public.next_actions(id,deal_id,title,due_at,assignee_name) values($1,$2,'원래 방문',($3::date+time '14:30') at time zone 'Asia/Seoul','담당 A')",[ids.task,ids.deal,far]);
 await q("insert into public.next_actions(id,inquiry_id,title,due_at,assignee_name) values($1,$2,'원래 문의 일정',$3::date::timestamp at time zone 'Asia/Seoul','담당 A')",[ids.itask,ids.inq,far]);
 await exec(sql); await exec(sql); // migration can be reapplied without clearing history/config
 await require('./inquiry-response-sql.cjs')({db,q,exec,rpc,ids,out});
 await q("select set_config('test.auth',$1,false)",[ids.auth]);
 await exec('set role authenticated');
 await check('migration disabled, list 20-item contract',async()=>{const r=await list();assert.equal(r.enabled,false);assert.equal(r.per,20);assert.equal(r.items[0].date_basis,'unconfirmed');await reject(async()=>rpc('crm_schedule_write_v1',await command()),'PT503');});
 await check('private events cannot be read directly',()=>reject(()=>q('select * from crm_security.schedule_v1_events'),'42501'));
 await check('private helper cannot be executed directly',()=>reject(()=>q('select crm_security.schedule_v1_context(\'deal\',$1)',[ids.deal]),'42501'));
 await exec('reset role; update crm_security.schedule_v1_settings set enabled=true; set role authenticated;');
 let addCmd,addAck;
 await check('append keeps original open task and UUID',async()=>{addCmd=await command();addAck=await rpc('crm_schedule_write_v1',addCmd);const r=await list();assert.equal(r.total,2);assert(r.items.some(x=>x.id===ids.task));assert(r.items.some(x=>x.id===addAck.action_id));assert.deepEqual(addAck.cancelled_action_ids,[]);assert.deepEqual(addAck.completed_action_ids,[]);assert.equal(addAck.after.status,'open');});
 await check('same request returns exact receipt, no repeated trigger',async()=>{const r=await rpc('crm_schedule_write_v1',addCmd);assert.equal(r.replayed,true);assert.equal(r.action_id,addAck.action_id);assert.equal((await list()).total,2);await exec('reset role');assert.equal((await q('select count(*)::int n from crm_security.test_signals where action_id=$1',[addAck.action_id])).rows[0].n,1);await exec('set role authenticated');});
 await check('same request with changed body rejected',()=>reject(()=>rpc('crm_schedule_write_v1',{...addCmd,title:'다른 내용'}),'PT409'));
 await check('read-only receipt recovers uncertain save',async()=>{const r=await rpc('crm_schedule_receipt_v1',{target_type:'deal',target_id:ids.deal,request_id:addCmd.request_id});assert.equal(r.found,true);assert.equal(r.ack.action_id,addAck.action_id);});
 await check('receipt not found is distinct from successful save',async()=>assert.equal((await rpc('crm_schedule_receipt_v1',{target_type:'deal',target_id:ids.deal,request_id:randomUUID()})).found,false));
 await check('stale snapshot rejected',()=>reject(()=>rpc('crm_schedule_write_v1',{...addCmd,request_id:randomUUID()}),'PT409'));
 await check('earlier date including today keeps ID/time and records reason atomically',async()=>{const r=await rpc('crm_schedule_write_v1',await command('reschedule',{due_on:today,date_basis:'internal_plan',reason:'내부 준비 일정을 오늘 14:30으로 변경'}));assert.equal(r.action_id,ids.task);assert.equal(r.after.title,'원래 방문');assert.equal(r.after.status,'open');assert.equal(r.after.completed_at,null);assert.equal(new Date(r.after.due_at).getUTCHours(),5);assert.equal(new Date(r.before.due_at).toISOString(),new Date(far+'T14:30:00+09:00').toISOString());assert.equal((await list()).items.find(x=>x.id===ids.task).date_basis,'internal_plan');});
 await check('reason required without changing any task',async()=>{const token=(await list()).token;await reject(async()=>rpc('crm_schedule_write_v1',await command('reschedule',{reason:''})),'22023');assert.equal((await list()).token,token);});
 await check('unchanged date rejected',()=>reject(async()=>rpc('crm_schedule_write_v1',await command('reschedule',{due_on:today})),'PT409'));
 await check('later date modifies same task',async()=>{const r=await rpc('crm_schedule_write_v1',await command('reschedule',{due_on:far}));assert.equal(r.action_id,ids.task);assert.equal(r.after.status,'open');});
 await check('past date rejected',()=>reject(async()=>rpc('crm_schedule_write_v1',await command('reschedule',{due_on:'2000-01-01'})),'22023'));
 await check('invalid calendar date rejected',()=>reject(async()=>rpc('crm_schedule_write_v1',await command('reschedule',{due_on:'2027-02-30'})),'22008'));
 await check('unknown complete intent cannot complete tasks',()=>reject(async()=>rpc('crm_schedule_write_v1',await command('complete')),'22023'));
 await check('unknown fields rejected',()=>reject(async()=>rpc('crm_schedule_write_v1',await command('add',{complete:true})),'22023'));
 await check('null operation rejected',()=>reject(async()=>rpc('crm_schedule_write_v1',await command(null)),'22023'));
 await check('foreign action cannot be rescheduled',()=>reject(async()=>rpc('crm_schedule_write_v1',await command('reschedule',{action_id:ids.itask})),'PT409'));
 await check('inquiry append preserves previous open task',async()=>{const r=await rpc('crm_schedule_write_v1',await command('add',{},'inquiry',ids.inq));assert.equal((await list('inquiry',ids.inq)).total,2);assert.equal(r.target_id,ids.inq);});
 await check('inquiry can move earlier with same UUID',async()=>{const r=await rpc('crm_schedule_write_v1',await command('reschedule',{action_id:ids.itask,due_on:today},'inquiry',ids.inq));assert.equal(r.action_id,ids.itask);assert.equal(r.after.status,'open');});
 await check('inquiry continuation guard excludes only response progression fields',async()=>{
  const before=await list('inquiry',ids.inq);assert.match(before.inquiry_guard,/^[a-f0-9]{32}$/);assert.equal(before.version,null);
  await exec('reset role');await q("update public.inquiries set status='전화응대 완료',first_response_at=clock_timestamp(),responded_at=clock_timestamp(),updated_at=clock_timestamp() where id=$1",[ids.inq]);await exec('set role authenticated');
  const after=await list('inquiry',ids.inq);assert.equal(after.inquiry_guard,before.inquiry_guard);assert.notEqual(after.token,before.token);assert.equal(after.response_state.status,'전화응대 완료');assert(after.response_state.responded_at);
 });
 await check('inquiry unrelated parent edit changes continuation guard',async()=>{
  const before=await list('inquiry',ids.inq);await exec('reset role');await q("update public.inquiries set brand='POUR' where id=$1",[ids.inq]);await exec('set role authenticated');assert.notEqual((await list('inquiry',ids.inq)).inquiry_guard,before.inquiry_guard);
 });
 await check('inquiry legacy task edit changes guard and rejects original command',async()=>{
  const before=await list('inquiry',ids.inq),cmd=await command('add',{},'inquiry',ids.inq);await exec('reset role');await q("update public.next_actions set title='다른 기기에서 수정' where id=$1",[ids.itask]);await exec('set role authenticated');assert.notEqual((await list('inquiry',ids.inq)).inquiry_guard,before.inquiry_guard);await reject(()=>rpc('crm_schedule_write_v1',cmd),'PT409');
 });
 await check('completed inquiry tasks are still included in guard',async()=>{
  const before=await list('inquiry',ids.inq);await exec('reset role');await q("update public.next_actions set status='completed',completed_at=clock_timestamp() where id=$1",[ids.itask]);await exec('set role authenticated');const after=await list('inquiry',ids.inq);assert.notEqual(after.inquiry_guard,before.inquiry_guard);
  await exec('reset role');await q("update public.next_actions set title='완료 후 정정' where id=$1",[ids.itask]);await exec('set role authenticated');assert.notEqual((await list('inquiry',ids.inq)).inquiry_guard,after.inquiry_guard);
 });
 await check('new inquiry task after snapshot cannot be replaced',async()=>{
  const cmd=await command('add',{},'inquiry',ids.inq);await rpc('crm_schedule_write_v1',await command('add',{title:'다른 기기의 방문'},'inquiry',ids.inq));const after=await list('inquiry',ids.inq);await reject(()=>rpc('crm_schedule_write_v1',cmd),'PT409');assert.equal((await list('inquiry',ids.inq)).token,after.token);
 });
 await check('B2B completed and promoted inquiries cannot receive a new task',async()=>{
  for(const status of ['협약완료','해결완료','영업전환']){await exec('reset role');await q('update public.inquiries set status=$1 where id=$2',[status,ids.inq]);await exec('set role authenticated');assert.equal((await list('inquiry',ids.inq)).writable,false);await reject(async()=>rpc('crm_schedule_write_v1',await command('add',{},'inquiry',ids.inq)),'PT409');}
  await exec('reset role');await q("update public.inquiries set status='전화응대 완료',deal_id=$1 where id=$2",[ids.deal,ids.inq]);await exec('set role authenticated');assert.equal((await list('inquiry',ids.inq)).writable,false);
  await exec('reset role');await q('update public.inquiries set deal_id=null where id=$1',[ids.inq]);await exec('set role authenticated');
 });
 await check('foreign target forbidden',()=>reject(()=>list('deal',ids.foreign),'42501'));
 await check('other account cannot read receipt',async()=>{await q("select set_config('test.auth',$1,false)",[ids.otherAuth]);await reject(()=>rpc('crm_schedule_receipt_v1',{target_type:'deal',target_id:ids.deal,request_id:addCmd.request_id}),'42501');await q("select set_config('test.auth',$1,false)",[ids.auth]);});
 await check('parent reassignment invalidates expected token',async()=>{const c=await command();await exec('reset role');await q('update public.deals set owner_id=$1 where id=$2',[ids.other,ids.deal]);await exec('set role authenticated');await reject(()=>rpc('crm_schedule_write_v1',c),'42501');await exec('reset role');await q('update public.deals set owner_id=$1,version=version+1 where id=$2',[ids.user,ids.deal]);await exec('set role authenticated');await reject(()=>rpc('crm_schedule_write_v1',c),'PT409');});
 await check('legacy action mutation invalidates snapshot without parent version',async()=>{const c=await command();await exec('reset role');await q("update public.next_actions set title='기존 경로에서 바뀐 제목' where id=$1",[ids.task]);await exec('set role authenticated');await reject(()=>rpc('crm_schedule_write_v1',c),'PT409');});
 await check('closed target rejects new write, preserves receipt lookup',async()=>{await exec('reset role');await q("update public.deals set lifecycle_status='closed' where id=$1",[ids.deal]);await exec('set role authenticated');assert.equal((await list()).writable,false);await reject(async()=>rpc('crm_schedule_write_v1',await command()),'PT409');assert.equal((await rpc('crm_schedule_receipt_v1',{target_type:'deal',target_id:ids.deal,request_id:addCmd.request_id})).found,true);await exec('reset role');await q("update public.deals set lifecycle_status='open' where id=$1",[ids.deal]);await exec('set role authenticated');});
 await check('trashed inquiry rejects write',async()=>{await exec('reset role');await q("insert into crm_security.inquiry_audit_events(inquiry_id,action) values($1,'inquiry_trash')",[ids.inq]);await exec('set role authenticated');await reject(async()=>rpc('crm_schedule_write_v1',await command('add',{},'inquiry',ids.inq)),'PT409');});
 await check('pagination 20/3 without duplicate or omitted IDs',async()=>{for(let i=0;i<21;i++)await rpc('crm_schedule_write_v1',await command('add',{title:'추가 '+i}));const a=await list(),b=await list('deal',ids.deal,2);assert.equal(a.total,23);assert.equal(a.items.length,20);assert.equal(b.items.length,3);assert.equal(new Set([...a.items,...b.items].map(x=>x.id)).size,23);});
 await check('flat legacy schedule without task cannot be overwritten',async()=>{const id=randomUUID();await exec('reset role');await q('insert into public.deals(id,owner_id,next_action,next_action_date) values($1,$2,\'기존 이관 일정\',$3)',[id,ids.user,far]);await exec('set role authenticated');await reject(async()=>rpc('crm_schedule_write_v1',await command('add',{},'deal',id)),'PT409');assert.equal((await list('deal',id)).total,0);});
 await check('unassigned target is not writable even for admin',async()=>{const id=randomUUID();await exec('reset role');await q("update crm_security.access_review set permission_role='admin' where user_id=$1",[ids.user]);await q('insert into public.deals(id) values($1)',[id]);await exec('set role authenticated');assert.equal((await list('deal',id)).writable,false);await reject(async()=>rpc('crm_schedule_write_v1',await command('add',{},'deal',id)),'PT409');await exec('reset role');await q("update crm_security.access_review set permission_role='rep' where user_id=$1",[ids.user]);await exec('set role authenticated');});
 await check('branch scope requires write permission',async()=>{await exec('reset role');await q("update crm_security.access_review set permission_role='branch' where user_id=$1",[ids.user]);await q("insert into crm_security.object_scope(user_id,deal_id,expires_at,can_write) values($1,$2,now()+interval '1 day',false)",[ids.user,ids.deal]);await exec('set role authenticated');await reject(()=>list(),'42501');await exec('reset role');await q('update crm_security.object_scope set can_write=true where user_id=$1',[ids.user]);await exec('set role authenticated');assert.equal((await list()).writable,true);await exec('reset role');await q("update crm_security.access_review set permission_role='rep' where user_id=$1",[ids.user]);await exec('set role authenticated');});
 await check('projection follows earliest remaining task, not last edited task',async()=>{const rows=(await list()).items;await exec('reset role');const d=(await q('select next_action,next_action_date::text as day from public.deals where id=$1',[ids.deal])).rows[0];assert.equal(d.next_action,rows[0].title);assert.equal(d.day,rows[0].due_on);await exec('set role authenticated');});
 await check('customer-agreed task rejects internal reschedule without evidence',async()=>{
 const r=await rpc('crm_schedule_write_v1',await command('add',{date_basis:'customer_agreed',title:'고객 요청 방문'})),before=await list();
 await reject(async()=>rpc('crm_schedule_write_v1',await command('reschedule',{action_id:r.action_id,due_on:far,reason:'내부 조정'})),'PT409');
 assert.equal((await list()).token,before.token);
 });
 await check('legacy customer promise title cannot bypass protection',async()=>{
 const r=await rpc('crm_schedule_write_v1',await command('add',{title:'고객 약속: 방문'})),before=await list();
 await reject(async()=>rpc('crm_schedule_write_v1',await command('reschedule',{action_id:r.action_id,due_on:far,reason:'내부 조정'})),'PT409');
 assert.equal((await list()).token,before.token);
 });
 await check('invalid page rejected',()=>reject(()=>list('deal',ids.deal,0),'22023'));
 await check('failed audit rolls back task, projection and signals',async()=>{const c=await command(),before=await list();await exec("reset role; create function crm_security.test_audit_failure() returns trigger language plpgsql as $$begin raise exception 'test audit failure';end$$;create trigger test_audit_failure before insert on crm_security.schedule_v1_events for each row execute function crm_security.test_audit_failure();set role authenticated;");await reject(()=>rpc('crm_schedule_write_v1',c),'P0001');assert.equal((await list()).token,before.token);assert.equal((await rpc('crm_schedule_receipt_v1',{target_type:'deal',target_id:ids.deal,request_id:c.request_id})).found,false);await exec('reset role;drop trigger test_audit_failure on crm_security.schedule_v1_events;set role authenticated;');});
 await check('disable blocks new writes but keeps idempotent recovery',async()=>{await exec('reset role;update crm_security.schedule_v1_settings set enabled=false;set role authenticated;');await reject(async()=>rpc('crm_schedule_write_v1',await command()),'PT503');assert.equal((await rpc('crm_schedule_write_v1',addCmd)).replayed,true);});
 await check('anonymous cannot call public RPC',async()=>{await exec('reset role;set role anon');await reject(()=>list(),'42501');await exec('reset role;set role authenticated');});
 await check('expired access review denies even own target',async()=>{await exec('reset role');await q("update crm_security.access_review set expires_at=now()-interval '1 hour' where user_id=$1",[ids.user]);await exec('set role authenticated');await reject(()=>list(),'42501');});
 fs.writeFileSync(path.join(out,'schedule-sql-result.json'),JSON.stringify({engine:'PGlite PostgreSQL',remoteWrites:0,tests:passed.length,passed,limitations:['single-session engine: no multi-connection race proof','production notification/realtime integrations replaced by transactional signal fixture']},null,2));
 console.log(JSON.stringify({passed:passed.length,tests:passed},null,2));await db.close();
}
main().catch(async e=>{console.error('FAILED after',passed.length,passed.at(-1),e);await db.close();process.exitCode=1;});
