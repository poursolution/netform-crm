import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { prepareImport } from '../server/technical-advisory/normalize.mjs';

const [input, output] = process.argv.slice(2);
if (!input || !output || resolve(input) === resolve(output)) {
  console.error('Usage: node scripts/prepare-technical-advisory-import.mjs source.json review.json');
  process.exitCode = 1;
} else {
  try {
    const projects = prepareImport(JSON.parse(await readFile(input, 'utf8')));
    // Exclusive create prevents accidentally replacing an earlier review.
    await writeFile(output, JSON.stringify({ mode: 'review_only', projects }, null, 2), { flag: 'wx', mode: 0o600 });
    console.log(`Prepared ${projects.length} projects / ${projects.reduce((n, p) => n + p.contracts.length, 0)} contracts. No CRM writes.`);
  } catch (error) {
    // Do not echo raw input/customer records in logs.
    console.error(error.code || (/^[A-Z_]+$/.test(error.message) ? error.message : 'IMPORT_PREPARATION_FAILED'));
    process.exitCode = 1;
  }
}
