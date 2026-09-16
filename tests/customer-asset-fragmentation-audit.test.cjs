const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const sql = fs.readFileSync(path.join(
  __dirname,
  '..',
  'scripts',
  'customer-asset-fragmentation-audit.sql'
), 'utf8');

assert.match(sql, /begin transaction read only;/i);
assert.match(sql, /rollback;/i);
assert.match(sql, /set local statement_timeout/i);
assert.match(sql, /set local lock_timeout/i);

const withoutComments = sql
  .replace(/--.*$/gm, '')
  .replace(/\/\*[\s\S]*?\*\//g, '');

for (const mutation of [
  /\binsert\s+into\b/i,
  /\bupdate\s+(?:public\.)?\w+/i,
  /\bdelete\s+from\b/i,
  /\bcreate\s+(?:or\s+replace\s+)?(?:table|view|function|index|policy)\b/i,
  /\balter\s+(?:table|function|view|policy)\b/i,
  /\bdrop\s+(?:table|view|function|index|policy)\b/i,
  /\bgrant\b/i,
  /\brevoke\b/i,
]) {
  assert.doesNotMatch(withoutComments, mutation);
}

for (const marker of [
  'fragmented_normalized_names',
  'orphan_history_organizations',
  'auto_candidate_exact_address',
  'review_single_name_candidate',
  'review_multiple_candidates',
  'separate_site_candidate',
  'deal_without_site_id',
  'inquiry_without_site_id',
  'top_fragmented_names',
]) {
  assert.ok(sql.includes(marker), `missing audit marker: ${marker}`);
}

assert.match(sql, /left join site_base s on s\.norm_name = o\.norm_name/i);
assert.match(sql, /o\.norm_address is not null[\s\S]*s\.norm_address = o\.norm_address/i);
assert.match(sql, /limit 200/i);
assert.doesNotMatch(sql, /\b(body|phone|mobile|manager_name|contact_name)\b\s*[,)]/i);

console.log('PASS: customer asset audit is read-only, bounded, privacy-minimized, and covers the three candidate states.');
