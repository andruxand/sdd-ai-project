import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

import { parseDocument } from 'yaml';

const ROOT = process.cwd();
const IGNORE = new Set([
  'node_modules',
  '.git',
  'dist',
  'coverage',
  '.serverless',
  'storybook-static',
]);
const TARGET_EXT = new Set(['.yml', '.yaml']);

async function walk(dir) {
  const out = [];
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (IGNORE.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...(await walk(full)));
    } else if (TARGET_EXT.has(path.extname(entry.name))) {
      out.push(full);
    }
  }
  return out;
}

const files = await walk(ROOT);
let failures = 0;

for (const file of files) {
  const raw = await fs.readFile(file, 'utf8');
  const doc = parseDocument(raw, { prettyErrors: true, strict: false });
  const errs = [...doc.errors, ...doc.warnings];
  if (errs.length) {
    failures += 1;
    console.error(`\nYAML issue in ${path.relative(ROOT, file)}:`);
    for (const err of errs) {
      console.error(`- ${String(err.message).trim()}`);
    }
  }
}

if (failures) {
  process.exit(1);
}
console.log(`Validated ${files.length} YAML file(s).`);
