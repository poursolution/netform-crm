const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const html=fs.readFileSync('crm.html','utf8'),review=fs.readFileSync('pc-organization-history.js','utf8'),transport=fs.readFileSync('pc-manager-transport.js','utf8');
test('confirmed legacy-only Sites are loaded into the customer asset master',()=>{
 assert.match(transport,/crm_site_linked_assets_v1/);
 assert.match(review,/transport\.rpc\('crm_site_linked_assets_v1'/);
 assert.match(review,/w\.SITE_LINKED_ASSETS=data\.items/);
 assert.match(html,/window\.SITE_LINKED_ASSETS\|\|\[\]/);
 assert.match(html,/key:'id:'\+x\.site_id/);
 assert.match(html,/legacyNoteCount:Number\(x\.legacy_note_count\|\|0\)/);
});
