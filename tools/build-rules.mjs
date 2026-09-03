// docs/rules.seed.json -> js/rules.data.js
// Die Regeln werden als ES-Modul eingebettet, damit die App ohne fetch() startet
// (und damit auch offline und ohne CORS-Sonderfaelle laeuft).
// Aufruf: node tools/build-rules.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const seed = JSON.parse(readFileSync(join(root, 'docs/rules.seed.json'), 'utf8'));

const ids = seed.rules.map((r) => r.id);
const dupes = ids.filter((id, i) => ids.indexOf(id) !== i);
if (dupes.length) throw new Error('Doppelte Regel-IDs: ' + dupes.join(', '));
for (const r of seed.rules) {
  for (const key of ['id', 'category', 'severity', 'priority', 'when', 'text']) {
    if (r[key] === undefined) throw new Error(`Regel ${r.id || '?'} ohne "${key}"`);
  }
}

const out = `// AUTO-GENERIERT aus docs/rules.seed.json - nicht direkt editieren.
// Regeln sind reine Daten; siehe docs/regel-engine.md.
export const RULESET = ${JSON.stringify(seed, null, 2)};
`;
writeFileSync(join(root, 'js/rules.data.js'), out);
console.log(`${seed.rules.length} Regeln geschrieben nach js/rules.data.js`);
