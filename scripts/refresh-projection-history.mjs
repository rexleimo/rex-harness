import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { projectionPayloadDigest } from '../src/clients/projection-manifest.mjs';
import { rexNativeProviderBindings } from '../src/providers/catalog.mjs';
import { rexWorkflowSkill, sharedReferenceSkillIds } from '../src/clients/install.mjs';

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const historyPath = path.join(packageRoot, 'src', 'clients', 'projection-history.json');
const history = JSON.parse(fs.readFileSync(historyPath, 'utf8'));

const providerSkills = rexNativeProviderBindings
  .filter((binding) => binding.provider.kind === 'skill')
  .map((binding) => binding.provider.id);
const ids = [rexWorkflowSkill.id, ...providerSkills, ...sharedReferenceSkillIds];

let changed = 0;
for (const id of ids) {
  const digest = projectionPayloadDigest(path.join(packageRoot, 'skill-sources', id));
  const bucket = history.skills[id] || (history.skills[id] = []);
  if (!bucket.includes(digest)) {
    bucket.push(digest);
    changed += 1;
    console.log(`appended ${id}: ${digest.slice(0, 20)}…`);
  } else {
    console.log(`already tracked ${id}`);
  }
}
fs.writeFileSync(historyPath, `${JSON.stringify(history, null, 2)}\n`);
console.log(`done; ${changed} digest(s) appended; skills tracked: ${ids.length}`);
