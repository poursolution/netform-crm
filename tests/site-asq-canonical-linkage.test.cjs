const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const source = fs.readFileSync('crm.html', 'utf8');

function functionSource(name) {
  const start = source.indexOf('function ' + name + '(');
  assert.notEqual(start, -1, name + ' function should exist');
  const next = source.indexOf('\nfunction ', start + 1);
  return source.slice(start, next < 0 ? source.length : next);
}

function run(site, projects) {
  const context = { B: { asq_projects: projects, asqProjects: [] } };
  vm.createContext(context);
  vm.runInContext(
    functionSource('asqProjectRows') + '\n' +
    functionSource('asqNormalize') + '\n' +
    functionSource('siteAsqProjects'),
    context
  );
  return JSON.parse(JSON.stringify(context.siteAsqProjects(site)));
}

test('canonical-only Site shows ASQ projects linked by Site ID', () => {
  const rows = run(
    { key: 'id:site-a', deals: [] },
    [
      { id: 'asq-a', site_id: 'site-a', service_type: '감리' },
      { id: 'asq-b', site_id: 'site-b', service_type: '설계' }
    ]
  );
  assert.deepEqual(rows.map(row => row.id), ['asq-a']);
});

test('non-canonical keys never infer ASQ linkage from names', () => {
  const rows = run(
    { key: 'name:동명아파트', name: '동명아파트', deals: [] },
    [{ id: 'asq-a', site_id: 'site-a', site_name: '동명아파트' }]
  );
  assert.deepEqual(rows, []);
});
