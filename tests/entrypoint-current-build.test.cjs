const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const index = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

test('entrypoint resolves the current Pages commit before mounting the iframe', () => {
  assert.match(index, /function mountCurrentBuild\(\)/);
  assert.match(index, /production-ui-manifest\.json\?ts=/);
  assert.match(index, /cache:'no-store'/);
  assert.match(index, /APP_BUILD = commit/);
  assert.match(index, /\.then\(function\(\)\{ mount\(view\) \}\)/);
  assert.doesNotMatch(index, /\nmount\(view\);/);
});
