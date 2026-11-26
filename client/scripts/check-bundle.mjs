// Fails the build when the JS loaded by index.html exceeds the T-38 budget.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';

const BUDGET_KB = 250;
const dist = new URL('../dist/', import.meta.url).pathname;
const html = readFileSync(join(dist, 'index.html'), 'utf8');
const scripts = [...html.matchAll(/(?:src|href)="\/([^"]+\.js)"/g)].map((m) => m[1]);

let total = 0;
for (const file of scripts) {
  const kb = gzipSync(readFileSync(join(dist, file))).length / 1024;
  total += kb;
  console.log(`${file}: ${kb.toFixed(1)} kB gzipped`);
}
console.log(`Initial JS: ${total.toFixed(1)} kB gzipped (budget ${BUDGET_KB} kB)`);
if (scripts.length === 0 || total > BUDGET_KB) process.exit(1);
