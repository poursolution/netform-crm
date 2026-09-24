const fs = require('fs');
const vm = require('vm');
const file = process.argv[2];
const html = fs.readFileSync(file, 'utf8');
const scripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)].map(m => m[1]).filter(s => s.trim());
let failed = false;
scripts.forEach((source, index) => {
  try { new vm.Script(source, { filename: `${file}#script-${index + 1}` }); }
  catch (error) { failed = true; console.error(error.message); }
});
if (failed) process.exit(1);
console.log(`OK ${scripts.length} inline scripts`);
