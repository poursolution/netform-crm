const assert=require('node:assert/strict');
const fs=require('node:fs');

const source=fs.readFileSync('production-ui-manifest.json','utf8');
assert.match(source,/^---\r?\nlayout: null\r?\n---/);
assert.match(source,/"source_commit": "\{\{ site\.github\.build_revision/);
assert.match(source,/"build_id": "\{\{ site\.github\.build_revision[^\n]+slice: 0, 12/);
assert.match(source,/"test_evidence": "must come from the matching commit checks/);
assert.doesNotMatch(source,/"automated_tests"|"pass":\s*\d+|20260913-branch-action-first/);

const json=JSON.parse(source.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/,''));
assert.equal(json.status,'PRODUCTION_PAGES_SOURCE_REVISION');
assert.deepEqual(json.files_sha256,{});

console.log('PASS Pages manifest uses the deployed commit and makes no stale test claim');
