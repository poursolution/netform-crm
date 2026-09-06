'use strict';
// OFFLINE SQL generator. No network, no credentials, no file writes.
// Review stdout and the REAL staging schema before executing anything.
const fs=require('node:fs');
const assert=require('node:assert/strict');
const seed=require('../tests/fixtures/staging-crm-seed.json');
const q=x=>x===null?'null':"'"+String(x).replaceAll("'","''")+"'";
function generate(config){
 assert.match(config.projectRef||'',/^[a-z]{20}$/);
 assert.notEqual(config.projectRef,'ymfbmpnizxvqsamnczow','Production prohibited');
 const users=seed.users.map(u=>({...u,id:config.authUserIds?.[u.fixture_role]}));
 for(const u of users)assert.match(u.id||'',/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i,'Actual Auth UUID required for '+u.fixture_role);
 assert.equal(new Set(users.map(u=>u.id)).size,6,'Distinct test accounts required');
 const lines=[
 '-- SYNTHETIC SEED ONLY. One-time, empty isolated staging; never run in production.',
 '-- Real base-schema field names must be reviewed first. Missing columns abort.',
 '-- BEFORE this file: SET crm.seed_project_ref to the confirmed staging ref in the SAME connection.',
 'begin;',
 'do $$ begin',
 "if current_setting('crm.seed_project_ref',true) is distinct from "+q(config.projectRef)+" then raise exception 'Confirm staging ref in this connection';end if;",
 "if (select count(*) from auth.users)<>6 then raise exception 'Expected exactly six synthetic Auth users';end if;",
 ...users.map(u=>"if not exists(select 1 from auth.users where id="+q(u.id)+"::uuid and email="+q(u.email)+") then raise exception 'Synthetic Auth UUID/email mismatch';end if;"),
 "if exists(select 1 from public.deals) or exists(select 1 from public.inquiries) or exists(select 1 from public.crm_users) then raise exception 'Empty disposable staging CRM required';end if;",
 ...Object.entries({deals:['id','site','assignee','brand','stage','created'],inquiries:['id','site','assigned_to','status','created','amount']}).flatMap(([table,cols])=>cols.map(col=>
 "if not exists(select 1 from pg_attribute where attrelid='public."+table+"'::regclass and attname="+q(col)+" and not attisdropped) then raise exception 'Base schema adapter required: "+table+"."+col+"';end if;")),
 'end $$;'
 ];
 for(const t of seed.teams)lines.push('insert into public.crm_teams(team_id,display_name) values('+[t.team_id,t.display_name].map(q).join(',')+');');
 for(const u of users){
  if(u.sales_person_id)lines.push('insert into public.crm_sales_people(sales_person_id,display_name) values('+[u.sales_person_id,u.display_name].map(q).join(',')+');');
  lines.push('insert into public.crm_users(user_id,display_name,role,team_id,sales_person_id,active) values('+[u.id,u.display_name,u.role,u.team_id,u.sales_person_id].map(q).join(',')+',true);');
 }
 for(const d of seed.deals)lines.push('insert into public.deals(id,site,assignee,brand,stage,created) values('+[d.id,d.site,d.assignee,d.brand,d.stage,d.created].map(q).join(',')+');');
 for(const i of seed.inquiries)lines.push('insert into public.inquiries(id,site,assigned_to,status,created,amount) values('+[i.id,i.site,i.assigned_to,i.status,i.created,i.amount].map(q).join(',')+');');
 lines.push('create temp table crm_uuid_reviewed_mapping(target_table text,target_id uuid,user_id uuid,evidence text) on commit preserve rows;');
 for(const [table,rows] of [['deals',seed.deals],['inquiries',seed.inquiries]])for(const r of rows){
  lines.push('insert into crm_private.identity_review(target_table,target_id,observed_legacy_name) values('+[table,r.id,r.assignee||r.assigned_to].map(q).join(',')+');');
  if(r.owner_fixture_role)lines.push('insert into crm_uuid_reviewed_mapping values('+[table,r.id,users.find(u=>u.fixture_role===r.owner_fixture_role).id,'Reviewed synthetic seed UUID mapping, not display-name matching'].map(q).join(',')+');');
 }
 lines.push('commit;','-- NEXT in the SAME connection: reviewed crm_uuid_backfill.sql. Unknown owners remain manual_review.');
 return lines.join('\n');
}
if(require.main===module){
 try{
  assert.ok(process.argv[2],'Usage: node scripts/build-staging-seed.cjs auth-ids.json');
  process.stdout.write(generate(JSON.parse(fs.readFileSync(process.argv[2],'utf8')))+'\n');
 }catch(e){console.error(e.message);process.exitCode=1;}
}
module.exports={generate};
