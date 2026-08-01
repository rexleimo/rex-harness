import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  appendFile,
  cp,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  symlink,
  writeFile,
} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { installClientProjection, supportedClients } from '../../src/clients/install.mjs';
import {
  PROJECTION_MARKER_FILE,
  projectionPayloadDigest,
} from '../../src/clients/projection-manifest.mjs';
import { rexNativeProviderBindings } from '../../src/providers/catalog.mjs';

const REX_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

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

async function copyPackageFixture(packageRoot) {
  await cp(path.join(REX_ROOT, 'skill-sources'), path.join(packageRoot, 'skill-sources'), { recursive: true });
  await mkdir(path.join(packageRoot, 'src', 'clients'), { recursive: true });
  await cp(
    path.join(REX_ROOT, 'src', 'clients', 'projection-history.json'),
    path.join(packageRoot, 'src', 'clients', 'projection-history.json'),
  );
}

async function recordCurrentDigest(packageRoot, skillId) {
  const historyPath = path.join(packageRoot, 'src', 'clients', 'projection-history.json');
  const history = JSON.parse(await readFile(historyPath, 'utf8'));
  const digest = projectionPayloadDigest(path.join(packageRoot, 'skill-sources', skillId));
  history.skills[skillId].push(digest);
  await writeFile(historyPath, `${JSON.stringify(history, null, 2)}\n`, 'utf8');
}

test('client projection catalog exposes every native Skill target', () => {
  assert.deepEqual(supportedClients(), Object.keys(CLIENT_ROOTS));
});

test('projection history records every current canonical Skill digest', async () => {
  const history = JSON.parse(await readFile(
    path.join(REX_ROOT, 'src', 'clients', 'projection-history.json'),
    'utf8',
  ));
  assert.equal(history.kind, 'rex.client-projection-history.v1');
  for (const skillId of expectedSkills) {
    const digest = projectionPayloadDigest(path.join(REX_ROOT, 'skill-sources', skillId));
    assert.ok(history.skills[skillId]?.includes(digest), `${skillId} current digest must be tracked`);
  }
});

test('projection payload digests normalize UTF-8 line endings across clients', async () => {
  const fixtureRoot = await mkdtemp(path.join(os.tmpdir(), 'rex-client-line-endings-'));
  const lfRoot = path.join(fixtureRoot, 'lf');
  const crlfRoot = path.join(fixtureRoot, 'crlf');
  try {
    await mkdir(lfRoot, { recursive: true });
    await mkdir(crlfRoot, { recursive: true });
    await writeFile(path.join(lfRoot, 'SKILL.md'), 'line one\nline two\n', 'utf8');
    const crlf = String.fromCharCode(13, 10);
    await writeFile(path.join(crlfRoot, 'SKILL.md'), ['line one', 'line two', ''].join(crlf), 'utf8');
    assert.equal(projectionPayloadDigest(lfRoot), projectionPayloadDigest(crlfRoot));
  } finally {
    await rm(fixtureRoot, { recursive: true, force: true });
  }
});

test('client projection installs the workflow entry and bundled Providers into native discovery roots', async () => {
  for (const [client, relativeRoot] of Object.entries(CLIENT_ROOTS)) {
    const rootDir = await mkdtemp(path.join(os.tmpdir(), `rex-client-${client}-`));
    try {
      const result = installClientProjection({ client, rootDir });
      assert.equal(result.status, 'installed');
      assert.deepEqual([...result.installed].sort(), expectedSkills);
      assert.deepEqual(result.updated, []);
      assert.deepEqual(result.adopted, []);
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
      const marker = JSON.parse(await readFile(
        path.join(rootDir, relativeRoot, 'rex-workflow', PROJECTION_MARKER_FILE),
        'utf8',
      ));
      assert.equal(marker.kind, 'rex.client-skill-projection.v1');
      assert.equal(marker.skillId, 'rex-workflow');
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
    assert.equal(result.conflictDetails[0].reason, 'unmanaged-target-differs');
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

test('client projection updates an unchanged managed target after canonical source changes', async () => {
  const fixtureRoot = await mkdtemp(path.join(os.tmpdir(), 'rex-client-managed-update-'));
  const packageRoot = path.join(fixtureRoot, 'package');
  const projectRoot = path.join(fixtureRoot, 'project');
  try {
    await cp(path.join(REX_ROOT, 'skill-sources'), path.join(packageRoot, 'skill-sources'), { recursive: true });
    await mkdir(path.join(packageRoot, 'src', 'clients'), { recursive: true });
    await cp(
      path.join(REX_ROOT, 'src', 'clients', 'projection-history.json'),
      path.join(packageRoot, 'src', 'clients', 'projection-history.json'),
    );
    installClientProjection({ client: 'claude', rootDir: projectRoot, packageRoot });

    const source = path.join(packageRoot, 'skill-sources', 'rex-wayfinder', 'SKILL.md');
    await appendFile(source, '\nManaged update contract probe.\n', 'utf8');
    const currentHistoryPath = path.join(packageRoot, 'src', 'clients', 'projection-history.json');
    const currentHistory = JSON.parse(await readFile(currentHistoryPath, 'utf8'));
    currentHistory.skills['rex-wayfinder'].push(projectionPayloadDigest(path.dirname(source)));
    await writeFile(currentHistoryPath, `${JSON.stringify(currentHistory, null, 2)}\n`, 'utf8');
    const result = installClientProjection({ client: 'claude', rootDir: projectRoot, packageRoot });

    assert.equal(result.status, 'installed');
    assert.deepEqual(result.updated, ['rex-wayfinder']);
    assert.deepEqual(result.conflicts, []);
    const targetRoot = path.join(projectRoot, CLIENT_ROOTS.claude, 'rex-wayfinder');
    assert.equal(
      await readFile(path.join(targetRoot, 'SKILL.md'), 'utf8'),
      await readFile(source, 'utf8'),
    );
    const marker = JSON.parse(await readFile(path.join(targetRoot, PROJECTION_MARKER_FILE), 'utf8'));
    assert.equal(marker.sourceDigest, projectionPayloadDigest(path.dirname(source)));
    assert.ok(result.recoveries.some((recovery) => recovery.skillId === 'rex-wayfinder'));
    assert.ok((await readdir(path.dirname(targetRoot))).every((entry) => !entry.startsWith('.rex-')));
  } finally {
    await rm(fixtureRoot, { recursive: true, force: true });
  }
});

test('client projection preserves a user-modified managed target and reports digest details', async () => {
  const fixtureRoot = await mkdtemp(path.join(os.tmpdir(), 'rex-client-managed-conflict-'));
  const projectRoot = path.join(fixtureRoot, 'project');
  try {
    installClientProjection({ client: 'hermes', rootDir: projectRoot });
    const target = path.join(projectRoot, CLIENT_ROOTS.hermes, 'rex-planning', 'SKILL.md');
    await appendFile(target, '\nUser-owned local change.\n', 'utf8');

    const result = installClientProjection({ client: 'hermes', rootDir: projectRoot });

    assert.equal(result.status, 'conflicts');
    assert.deepEqual(result.conflicts, ['rex-planning']);
    assert.equal(result.conflictDetails[0].reason, 'managed-target-modified');
    assert.match(await readFile(target, 'utf8'), /User-owned local change/u);
  } finally {
    await rm(fixtureRoot, { recursive: true, force: true });
  }
});

test('client projection rejects an invalid ownership marker without replacing payload', async () => {
  const fixtureRoot = await mkdtemp(path.join(os.tmpdir(), 'rex-client-invalid-marker-'));
  const projectRoot = path.join(fixtureRoot, 'project');
  try {
    installClientProjection({ client: 'codex', rootDir: projectRoot });
    const targetRoot = path.join(projectRoot, CLIENT_ROOTS.codex, 'rex-debug');
    const target = path.join(targetRoot, 'SKILL.md');
    const before = await readFile(target, 'utf8');
    await writeFile(path.join(targetRoot, PROJECTION_MARKER_FILE), '{"kind":"user-marker"}\n', 'utf8');

    const result = installClientProjection({ client: 'codex', rootDir: projectRoot });

    assert.deepEqual(result.conflicts, ['rex-debug']);
    assert.equal(result.conflictDetails[0].reason, 'invalid-marker');
    assert.equal(await readFile(target, 'utf8'), before);
  } finally {
    await rm(fixtureRoot, { recursive: true, force: true });
  }
});

test('client projection does not trust a forged but self-consistent marker', async () => {
  const fixtureRoot = await mkdtemp(path.join(os.tmpdir(), 'rex-client-forged-marker-'));
  const projectRoot = path.join(fixtureRoot, 'project');
  const targetRoot = path.join(projectRoot, CLIENT_ROOTS.codex);
  const target = path.join(targetRoot, 'rex-debug');
  try {
    await mkdir(target, { recursive: true });
    await writeFile(path.join(target, 'SKILL.md'), 'third-party skill\n', 'utf8');
    await writeFile(path.join(target, PROJECTION_MARKER_FILE), `${JSON.stringify({
      schemaVersion: 1,
      kind: 'rex.client-skill-projection.v1',
      skillId: 'rex-debug',
      sourceDigest: projectionPayloadDigest(target),
    })}\n`, 'utf8');

    const result = installClientProjection({ client: 'codex', rootDir: projectRoot });

    assert.deepEqual(result.conflicts, ['rex-debug']);
    assert.equal(result.conflictDetails[0].reason, 'unverified-marker');
    assert.equal(await readFile(path.join(target, 'SKILL.md'), 'utf8'), 'third-party skill\n');
  } finally {
    await rm(fixtureRoot, { recursive: true, force: true });
  }
});

test('client projection rejects a target junction without writing through it', async () => {
  const fixtureRoot = await mkdtemp(path.join(os.tmpdir(), 'rex-client-target-junction-'));
  const projectRoot = path.join(fixtureRoot, 'project');
  const targetRoot = path.join(projectRoot, CLIENT_ROOTS.codex);
  const external = path.join(fixtureRoot, 'external-rex-debug');
  try {
    await cp(path.join(REX_ROOT, 'skill-sources', 'rex-debug'), external, { recursive: true });
    await mkdir(targetRoot, { recursive: true });
    await symlink(external, path.join(targetRoot, 'rex-debug'), 'junction');

    const result = installClientProjection({ client: 'codex', rootDir: projectRoot });

    assert.deepEqual(result.conflicts, ['rex-debug']);
    assert.equal(result.conflictDetails[0].reason, 'target-symbolic-link');
    await assert.rejects(
      () => readFile(path.join(external, PROJECTION_MARKER_FILE), 'utf8'),
      { code: 'ENOENT' },
    );
  } finally {
    await rm(fixtureRoot, { recursive: true, force: true });
  }
});

test('client projection rejects a target root junction before writing outside it', async () => {
  const fixtureRoot = await mkdtemp(path.join(os.tmpdir(), 'rex-client-root-junction-'));
  const projectRoot = path.join(fixtureRoot, 'project');
  const targetRoot = path.join(projectRoot, CLIENT_ROOTS.codex);
  const external = path.join(fixtureRoot, 'external-root');
  try {
    await mkdir(path.dirname(targetRoot), { recursive: true });
    await mkdir(external, { recursive: true });
    await symlink(external, targetRoot, 'junction');

    assert.throws(
      () => installClientProjection({ client: 'codex', rootDir: projectRoot }),
      /plain directory|junction|symbolic/u,
    );
    await assert.rejects(
      () => readFile(path.join(external, PROJECTION_MARKER_FILE), 'utf8'),
      { code: 'ENOENT' },
    );
    assert.deepEqual(await readdir(external), []);
  } finally {
    await rm(fixtureRoot, { recursive: true, force: true });
  }
});

test('client projection never promotes an untrusted interrupted backup junction', async () => {
  const fixtureRoot = await mkdtemp(path.join(os.tmpdir(), 'rex-client-backup-junction-'));
  const projectRoot = path.join(fixtureRoot, 'project');
  const targetRoot = path.join(projectRoot, CLIENT_ROOTS.codex);
  const target = path.join(targetRoot, 'rex-debug');
  const external = path.join(fixtureRoot, 'external-backup');
  try {
    await mkdir(targetRoot, { recursive: true });
    await mkdir(external, { recursive: true });
    await writeFile(path.join(external, 'ATTACKER.txt'), 'untrusted backup\n', 'utf8');
    await symlink(external, path.join(targetRoot, '.rex-backup-rex-debug-forged'), 'junction');

    const result = installClientProjection({ client: 'codex', rootDir: projectRoot });

    assert.ok(result.conflicts.includes('rex-debug'));
    assert.equal(
      result.conflictDetails.find((detail) => detail.skillId === 'rex-debug')?.reason,
      'interrupted-backup-untrusted',
    );
    assert.throws(() => fs.lstatSync(target), { code: 'ENOENT' });
    assert.equal(await readFile(path.join(external, 'ATTACKER.txt'), 'utf8'), 'untrusted backup\n');
    await assert.rejects(
      () => readFile(path.join(external, PROJECTION_MARKER_FILE), 'utf8'),
      { code: 'ENOENT' },
    );
  } finally {
    await rm(fixtureRoot, { recursive: true, force: true });
  }
});

test('client projection restores one trusted interrupted backup before evaluating updates', async () => {
  const fixtureRoot = await mkdtemp(path.join(os.tmpdir(), 'rex-client-backup-recovery-'));
  const projectRoot = path.join(fixtureRoot, 'project');
  const targetRoot = path.join(projectRoot, CLIENT_ROOTS.codex);
  const target = path.join(targetRoot, 'rex-debug');
  const backup = path.join(targetRoot, '.rex-backup-rex-debug-fixture');
  try {
    installClientProjection({ client: 'codex', rootDir: projectRoot });
    fs.renameSync(target, backup);

    const result = installClientProjection({ client: 'codex', rootDir: projectRoot });

    assert.ok(result.skipped.includes('rex-debug'));
    assert.ok(result.recoveries.some((event) => (
      event.skillId === 'rex-debug' && event.kind === 'restored-interrupted-backup'
    )));
    assert.equal(fs.lstatSync(target).isDirectory(), true);
    assert.throws(() => fs.lstatSync(backup), { code: 'ENOENT' });
    assert.equal(
      projectionPayloadDigest(target),
      projectionPayloadDigest(path.join(REX_ROOT, 'skill-sources', 'rex-debug')),
    );
  } finally {
    await rm(fixtureRoot, { recursive: true, force: true });
  }
});

test('client projection adopts an identical unmarked target without replacing its payload', async () => {
  const fixtureRoot = await mkdtemp(path.join(os.tmpdir(), 'rex-client-adopt-'));
  const targetRoot = path.join(fixtureRoot, 'skills');
  const target = path.join(targetRoot, 'rex-debug');
  try {
    await cp(path.join(REX_ROOT, 'skill-sources', 'rex-debug'), target, { recursive: true });
    const before = await readFile(path.join(target, 'SKILL.md'), 'utf8');

    const result = installClientProjection({ client: 'grok', rootDir: fixtureRoot, targetRoot });

    assert.ok(result.adopted.includes('rex-debug'));
    assert.equal(await readFile(path.join(target, 'SKILL.md'), 'utf8'), before);
    const marker = JSON.parse(await readFile(path.join(target, PROJECTION_MARKER_FILE), 'utf8'));
    assert.equal(marker.skillId, 'rex-debug');
  } finally {
    await rm(fixtureRoot, { recursive: true, force: true });
  }
});

test('client projection migrates an unmarked target only when its digest is known history', async () => {
  const fixtureRoot = await mkdtemp(path.join(os.tmpdir(), 'rex-client-history-'));
  const packageRoot = path.join(fixtureRoot, 'package');
  const targetRoot = path.join(fixtureRoot, 'skills');
  const target = path.join(targetRoot, 'rex-wayfinder');
  try {
    await cp(path.join(REX_ROOT, 'skill-sources'), path.join(packageRoot, 'skill-sources'), { recursive: true });
    await cp(path.join(packageRoot, 'skill-sources', 'rex-wayfinder'), target, { recursive: true });
    await appendFile(path.join(target, 'SKILL.md'), '\nKnown legacy payload.\n', 'utf8');
    const legacyDigest = projectionPayloadDigest(target);
    await mkdir(path.join(packageRoot, 'src', 'clients'), { recursive: true });
    const historyPath = path.join(REX_ROOT, 'src', 'clients', 'projection-history.json');
    const history = JSON.parse(await readFile(historyPath, 'utf8'));
    history.skills['rex-wayfinder'].unshift(legacyDigest);
    await writeFile(
      path.join(packageRoot, 'src', 'clients', 'projection-history.json'),
      `${JSON.stringify(history, null, 2)}\n`,
      'utf8',
    );

    const result = installClientProjection({ client: 'grok', rootDir: fixtureRoot, targetRoot, packageRoot });

    assert.ok(result.migrated.includes('rex-wayfinder'));
    assert.ok(!result.updated.includes('rex-wayfinder'));
    assert.ok(!result.adopted.includes('rex-wayfinder'));
    assert.deepEqual(result.conflicts, []);
    assert.equal(
      projectionPayloadDigest(target),
      projectionPayloadDigest(path.join(packageRoot, 'skill-sources', 'rex-wayfinder')),
    );
  } finally {
    await rm(fixtureRoot, { recursive: true, force: true });
  }
});

test('client projection preflights every source before any target write', async () => {
  const fixtureRoot = await mkdtemp(path.join(os.tmpdir(), 'rex-client-preflight-'));
  const packageRoot = path.join(fixtureRoot, 'package');
  const projectRoot = path.join(fixtureRoot, 'project');
  const targetRoot = path.join(projectRoot, CLIENT_ROOTS.codex);
  try {
    await copyPackageFixture(packageRoot);
    await rm(path.join(packageRoot, 'skill-sources', 'rex-tdd'), { recursive: true, force: true });

    assert.throws(
      () => installClientProjection({ client: 'codex', rootDir: projectRoot, packageRoot }),
      /bundled Rex skill must be a plain directory: rex-tdd/u,
    );
    await assert.rejects(() => readdir(targetRoot), { code: 'ENOENT' });
  } finally {
    await rm(fixtureRoot, { recursive: true, force: true });
  }
});

test('client projection conflicts when a target is created during staging', async () => {
  const fixtureRoot = await mkdtemp(path.join(os.tmpdir(), 'rex-client-target-race-'));
  const packageRoot = path.join(fixtureRoot, 'package');
  const projectRoot = path.join(fixtureRoot, 'project');
  const targetRoot = path.join(projectRoot, CLIENT_ROOTS.codex);
  const originalCopy = fs.cpSync;
  let triggered = false;
  try {
    await copyPackageFixture(packageRoot);
    fs.cpSync = (source, destination, options) => {
      const result = originalCopy(source, destination, options);
      if (!triggered && path.basename(source) === 'rex-workflow') {
        triggered = true;
        fs.mkdirSync(path.join(targetRoot, 'rex-workflow'), { recursive: true });
        fs.writeFileSync(path.join(targetRoot, 'rex-workflow', 'USER.txt'), 'created during staging\n', 'utf8');
      }
      return result;
    };

    const result = installClientProjection({ client: 'codex', rootDir: projectRoot, packageRoot });

    assert.deepEqual(result.conflicts, ['rex-workflow']);
    assert.equal(result.conflictDetails[0].reason, 'target-created-during-install');
    assert.equal(
      await readFile(path.join(targetRoot, 'rex-workflow', 'USER.txt'), 'utf8'),
      'created during staging\n',
    );
  } finally {
    fs.cpSync = originalCopy;
    await rm(fixtureRoot, { recursive: true, force: true });
  }
});

test('client projection conflicts when a managed target changes during staging', async () => {
  const fixtureRoot = await mkdtemp(path.join(os.tmpdir(), 'rex-client-managed-race-'));
  const packageRoot = path.join(fixtureRoot, 'package');
  const projectRoot = path.join(fixtureRoot, 'project');
  const targetRoot = path.join(projectRoot, CLIENT_ROOTS.codex);
  const originalCopy = fs.cpSync;
  let triggered = false;
  try {
    await copyPackageFixture(packageRoot);
    installClientProjection({ client: 'codex', rootDir: projectRoot, packageRoot });
    await appendFile(path.join(packageRoot, 'skill-sources', 'rex-workflow', 'SKILL.md'), '\nPublished update.\n', 'utf8');
    await recordCurrentDigest(packageRoot, 'rex-workflow');

    fs.cpSync = (source, destination, options) => {
      const result = originalCopy(source, destination, options);
      if (!triggered && path.basename(source) === 'rex-workflow') {
        triggered = true;
        fs.appendFileSync(path.join(targetRoot, 'rex-workflow', 'SKILL.md'), '\nUser race.\n', 'utf8');
      }
      return result;
    };

    const result = installClientProjection({ client: 'codex', rootDir: projectRoot, packageRoot });

    assert.deepEqual(result.conflicts, ['rex-workflow']);
    assert.equal(result.conflictDetails[0].reason, 'target-changed-during-install');
    assert.match(await readFile(path.join(targetRoot, 'rex-workflow', 'SKILL.md'), 'utf8'), /User race/u);
  } finally {
    fs.cpSync = originalCopy;
    await rm(fixtureRoot, { recursive: true, force: true });
  }
});

test('client projection rejects unsupported clients', () => {
  assert.throws(
    () => installClientProjection({ client: 'unknown', rootDir: process.cwd() }),
    /unsupported rex-harness client/u,
  );
});
