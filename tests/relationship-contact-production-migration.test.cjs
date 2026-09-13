const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const root=path.join(__dirname,'..');
const migration=fs.readFileSync(path.join(root,'supabase','migrations','20260913193000_relationship_contact_atomic.sql'),'utf8');
const rollback=fs.readFileSync(path.join(root,'sql','relationship-contact-atomic','20260913','rollback.production.sql'),'utf8');
const adapter=fs.readFileSync(path.join(root,'operational-adapter.js'),'utf8');
const overlay=fs.readFileSync(path.join(root,'operational-overlay.js'),'utf8');

test('relationship contact production path uses one existing dispatcher operation',()=>{
 assert.match(migration,/p_operation\s*=\s*'relationship_contact'/i);
 assert.match(adapter,/relationship_contact/);
 assert.match(overlay,/pushWrite\('relationship_contact'/);
 assert.doesNotMatch(overlay,/pushWrite\('activity'[\s\S]{0,500}pushWrite\('next_action'/);
});

test('private atomic helper is not executable by browser roles',()=>{
 assert.match(migration,/revoke all on function crm_security\.crm_relationship_contact_command_v1[\s\S]*from\s+public\s*,\s*anon\s*,\s*authenticated/i);
 assert.match(migration,/grant execute on function public\.crm_write_command_v2[\s\S]*to authenticated/i);
});

test('rollback requires the installed marker and restores the previous dispatcher',()=>{
 assert.match(rollback,/crm_relationship_contact_command_v1/);
 assert.match(rollback,/crm_write_command_v2_pre_relationship_contact_20260913/);
 assert.match(rollback,/rename to crm_write_command_v2/i);
 assert.match(rollback,/drop function crm_security\.crm_relationship_contact_command_v1/i);
});
