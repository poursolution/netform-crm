'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const cp = require('node:child_process');

const root = path.resolve(__dirname, '..');
const output = path.join(root, 'local-release-candidate-manifest.json');
const runtimeFiles = [
  'crm.html',
  'inquiry-assignment-clarity.css',
  'inquiry-assignment-clarity.js',
  'relationship-management.css',
  'relationship-management.js',
  'stage-transition-ui.js',
  'stage-transition.js'
];
const databaseCandidates = [
  'supabase/migrations/20260911090000_harden_inquiry_ingest_idempotency.sql'
];
const sha = file => crypto.createHash('sha256').update(fs.readFileSync(path.join(root, file))).digest('hex');
const head = cp.execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();

for (const file of [...runtimeFiles, ...databaseCandidates]) {
  if (!fs.existsSync(path.join(root, file))) throw Error(`MISSING_RELEASE_CANDIDATE_FILE:${file}`);
}

const manifest = {
  status: 'LOCAL_RELEASE_CANDIDATE_NOT_DEPLOYED',
  base_commit: head,
  production_applied: false,
  production_database_applied: false,
  external_systems_changed: false,
  runtime_files_sha256: Object.fromEntries(runtimeFiles.map(file => [file, sha(file)])),
  database_candidates_sha256: Object.fromEntries(databaseCandidates.map(file => [file, sha(file)]))
};

fs.writeFileSync(output, JSON.stringify(manifest, null, 2) + '\n');
console.log(JSON.stringify({ output, files: runtimeFiles.length + databaseCandidates.length, status: manifest.status }));
