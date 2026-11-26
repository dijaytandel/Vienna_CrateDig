// Fails the build when the app's JavaScript exceeds the T-38 first-visit budget.
// Every chunk counts: the app has no lazy routes, and registerSW loads Workbox at startup.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

const BUDGET_KB = 250;
const assets = fileURLToPath(new URL('../dist/assets/', import.meta.url));
const scripts = readdirSync(assets).filter((f) => f.endsWith('.js'));

let total = 0;
for (const file of scripts) {
  const kb = gzipSync(readFileSync(join(assets, file))).length / 1024;
  total += kb;
  console.log(`${file}: ${kb.toFixed(1)} kB gzipped`);
}
console.log(`Initial JS: ${total.toFixed(1)} kB gzipped (budget ${BUDGET_KB} kB)`);
if (scripts.length === 0 || total > BUDGET_KB) process.exit(1);
