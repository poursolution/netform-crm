const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const sql=fs.readFileSync('sql/site-record-link-review-v1.sql','utf8'),js=fs.readFileSync('pc-site-record-review.js','utf8'),html=fs.readFileSync('crm.html','utf8'),transport=fs.readFileSync('pc-manager-transport.js','utf8');
test('deal and inquiry Site review is admin-only, durable and explicit',()=>{
 assert.match(sql,/site_record_link_decisions/);
 assert.match(sql,/permission_role='admin'/);
 assert.match(sql,/p_source_type not in \('deal','inquiry'\)/);
 assert.match(sql,/update public\.deals set site_id=chosen_site/);
 assert.match(sql,/update public\.inquiries set site_id=chosen_site/);
 assert.match(sql,/pg_advisory_xact_lock/);
 assert.match(sql,/replayed',true/);
 assert.match(sql,/revoke all on function public\.crm_site_record_link_review_resolve_v1/);
 assert.match(js,/crm_site_record_link_review_list_v1/);
 assert.match(js,/crm_site_record_link_review_resolve_v1/);
 assert.match(js,/별도 현장/);
 assert.match(html,/PCSiteRecordReview\.mount/);
 assert.match(html,/pc-site-record-review\.js/);
 assert.match(transport,/crm_site_record_link_review_resolve_v1/);
});
