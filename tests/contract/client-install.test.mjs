import assert from 'node:assert/strict';
import {
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  writeFile,
} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { installClientProjection, supportedClients } from '../../src/clients/install.mjs';
import { rexNativeProviderBindings } from '../../src/providers/catalog.mjs';

const expectedSkills = rexNativeProviderBindings
  .filter((binding) => binding.provider.kind === 'skill')
  .map((binding) => binding.provider.id)
  .concat('rex-workflow')
  .sort();

const CLIENT_ROOTS = {
  codex: '.codex/skills',
  claude: '.claude/skills',
  gemini: '.gemini/skills',
  opencode: '.opencode/skills',
  hermes: '.hermes/skills',
  grok: '.grok/skills',
};

test('client projection catalog exposes every native Skill target', () => {
  assert.deepEqual(supportedClients(), Object.keys(CLIENT_ROOTS));
});

test('client projection installs the workflow entry and bundled Providers into native discovery roots', async () => {
  for (const [client, relativeRoot] of Object.entries(CLIENT_ROOTS)) {
    const rootDir = await mkdtemp(path.join(os.tmpdir(), `rex-client-${client}-`));
    try {
      const result = installClientProjection({ client, rootDir });
      assert.equal(result.status, 'installed');
      assert.deepEqual([...result.installed].sort(), expectedSkills);
      assert.deepEqual(result.conflicts, []);

      const entries = await readdir(path.join(rootDir, relativeRoot));
      assert.deepEqual(entries.sort(), expectedSkills);
      assert.ok(entries.every((entry) => entry.startsWith('rex-')));

      const workflowSkill = await readFile(
        path.join(rootDir, relativeRoot, 'rex-workflow', 'SKILL.md'),
        'utf8',
      );
      assert.match(workflowSkill, /rex-harness CLI/u);
      assert.match(workflowSkill, /instructionsRef/u);
      const reviewers = JSON.parse(await readFile(
        path.join(rootDir, relativeRoot, 'rex-workflow', 'references', 'reviewers.json'),
        'utf8',
      ));
      assert.equal(reviewers.kind, 'rex.specialist-reviewers.v1');
      assert.ok(reviewers.reviewers.length >= 4);

      const repeated = installClientProjection({ client, rootDir });
      assert.equal(repeated.status, 'unchanged');
      assert.deepEqual([...repeated.skipped].sort(), expectedSkills);
    } finally {
      await rm(rootDir, { recursive: true, force: true });
    }
  }
});

test('client projection preserves a conflicting user skill instead of overwriting it', async () => {
  const rootDir = await mkdtemp(path.join(os.tmpdir(), 'rex-client-conflict-'));
  const target = path.join(rootDir, '.codex', 'skills', 'rex-tdd', 'SKILL.md');
  try {
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, 'user-owned skill\n', 'utf8');

    const result = installClientProjection({ client: 'codex', rootDir });
    assert.equal(result.status, 'conflicts');
    assert.deepEqual(result.conflicts, ['rex-tdd']);
    assert.equal(await readFile(target, 'utf8'), 'user-owned skill\n');
    assert.ok(result.installed.includes('rex-requirements'));
  } finally {
    await rm(rootDir, { recursive: true, force: true });
  }
});

test('client projection honors an explicit client discovery root', async () => {
  const rootDir = await mkdtemp(path.join(os.tmpdir(), 'rex-client-target-root-'));
  const targetRoot = path.join(rootDir, 'global-grok-home', 'skills');
  try {
    const result = installClientProjection({
      client: 'grok',
      rootDir,
      targetRoot,
    });

    assert.equal(result.status, 'installed');
    assert.equal(result.skillRoot, targetRoot);
    assert.deepEqual((await readdir(targetRoot)).sort(), expectedSkills);
    await assert.rejects(
      () => readdir(path.join(rootDir, '.grok', 'skills')),
      { code: 'ENOENT' },
    );
  } finally {
    await rm(rootDir, { recursive: true, force: true });
  }
});

test('client projection rejects unsupported clients', () => {
  assert.throws(
    () => installClientProjection({ client: 'unknown', rootDir: process.cwd() }),
    /unsupported rex-harness client/u,
  );
});
