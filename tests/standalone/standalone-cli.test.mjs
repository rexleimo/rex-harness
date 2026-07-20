import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import {
  mkdtemp,
  readFile,
  readdir,
  rm,
  writeFile,
} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const cliPath = path.resolve(testDirectory, '../../bin/rex-harness.mjs');

function runCli(rootDir, ...args) {
  const output = execFileSync(process.execPath, [cliPath, ...args, '--root', rootDir], {
    encoding: 'utf8',
  });
  return JSON.parse(output);
}

function runReceipt(rootDir, ...command) {
  const output = execFileSync(process.execPath, [
    cliPath,
    'receipt',
    '--root',
    rootDir,
    '--',
    ...command,
  ], { encoding: 'utf8' });
  return JSON.parse(output);
}

test('standalone CLI starts, persists, advances, and resumes a workflow without AIOS', async () => {
  const rootDir = await mkdtemp(path.join(os.tmpdir(), 'rex-standalone-'));
  try {
    const started = runCli(
      rootDir,
      'start',
      '--work-item',
      'checkout',
      '--message',
      'Clarify acceptance criteria before implementing checkout.',
    );

    assert.equal(started.kind, 'rex.cli.workflow-command.v1');
    assert.equal(started.status, 'active');
    assert.equal(started.workItemKey, 'checkout');
    assert.equal(started.command.providerId, 'rex-requirements');
    assert.equal(started.command.providerKind, 'skill');
    assert.equal(started.command.instructionsRef, 'skill-sources/rex-requirements/SKILL.md');
    assert.ok(started.command.commandToken);
    assert.equal(Object.hasOwn(started, 'workflow'), false);
    assert.equal(Object.hasOwn(started, 'instructions'), false);

    const status = runCli(rootDir, 'status', '--work-item', 'checkout');
    assert.equal(status.workflowActivationId, started.workflowActivationId);
    assert.equal(status.command.commandToken, started.command.commandToken);

    const rejected = spawnSync(process.execPath, [
      cliPath,
      'evidence',
      '--activation',
      started.command.activationId,
      '--command-token',
      'stale-token',
      '--evidence',
      'acceptance-criteria-recorded=artifact:requirements',
      '--root',
      rootDir,
    ], { encoding: 'utf8' });
    assert.equal(rejected.status, 1);
    assert.match(rejected.stderr, /current Command token/u);

    const partiallyAdvanced = runCli(
      rootDir,
      'evidence',
      '--activation',
      started.command.activationId,
      '--command-token',
      started.command.commandToken,
      '--evidence',
      'acceptance-criteria-recorded=artifact:requirements',
    );
    assert.equal(partiallyAdvanced.outcome, 'blocked');
    assert.deepEqual(partiallyAdvanced.missingEvidence, [
      'non-goals-recorded',
      'first-slice-identified',
    ]);
    assert.notEqual(partiallyAdvanced.command.commandToken, started.command.commandToken);

    const advanced = runCli(
      rootDir,
      'evidence',
      '--activation',
      started.command.activationId,
      '--command-token',
      partiallyAdvanced.command.commandToken,
      '--evidence',
      'non-goals-recorded=artifact:requirements',
      '--evidence',
      'first-slice-identified=artifact:requirements',
    );
    assert.equal(advanced.outcome, 'completed');
    assert.equal(advanced.command.providerId, 'rex-test-design');

    const resumed = runCli(rootDir, 'resume', '--work-item', 'checkout');
    assert.equal(resumed.workflowActivationId, started.workflowActivationId);
    assert.equal(resumed.command.activationId, advanced.command.activationId);

    const fullStatus = runCli(rootDir, 'status', '--work-item', 'checkout', '--full');
    assert.equal(fullStatus.kind, 'rex.standalone.workflow-result.v1');
    assert.equal(fullStatus.workflow.workflowActivationId, started.workflowActivationId);
    assert.equal(fullStatus.workflow.stepIndex, 1);
    assert.equal(fullStatus.workflow.activationHistory.length, 1);
    assert.equal(fullStatus.command.executionToken, advanced.command.commandToken);

    const workflowFiles = await readdir(path.join(rootDir, '.rex-harness', 'workflows'));
    const activationFiles = await readdir(path.join(rootDir, '.rex-harness', 'activations'));
    const evidenceFiles = await readdir(path.join(rootDir, '.rex-harness', 'evidence'));
    assert.equal(workflowFiles.length, 1);
    assert.equal(activationFiles.length, 1);
    assert.equal(evidenceFiles.length, 1);

    const evidenceLog = await readFile(
      path.join(rootDir, '.rex-harness', 'evidence', evidenceFiles[0]),
      'utf8',
    );
    assert.match(evidenceLog, /acceptance-criteria-recorded/u);
    assert.match(evidenceLog, /first-slice-identified/u);
  } finally {
    await rm(rootDir, { recursive: true, force: true });
  }
});

test('standalone CLI returns full diagnostics only when explicitly requested', async () => {
  const rootDir = await mkdtemp(path.join(os.tmpdir(), 'rex-standalone-full-'));
  try {
    const started = runCli(
      rootDir,
      'start',
      '--work-item',
      'full-check',
      '--message',
      'Clarify acceptance criteria before implementing checkout.',
      '--full',
    );
    assert.equal(started.kind, 'rex.standalone.workflow-result.v1');
    assert.equal(started.workflow.workItemKey, 'full-check');
    assert.ok(started.command.executionToken);

    const blocked = runCli(
      rootDir,
      'evidence',
      '--activation',
      started.command.activationId,
      '--command-token',
      started.command.executionToken,
      '--evidence',
      'acceptance-criteria-recorded=artifact:requirements',
      '--full',
    );
    assert.equal(blocked.kind, 'rex.standalone.workflow-result.v1');
    assert.equal(blocked.outcome, 'blocked');
    assert.deepEqual(blocked.missingEvidence, ['non-goals-recorded', 'first-slice-identified']);

    const resumed = runCli(rootDir, 'resume', '--work-item', 'full-check', '--full');
    assert.equal(resumed.kind, 'rex.standalone.workflow-result.v1');
    assert.equal(resumed.workflow.workflowActivationId, started.workflow.workflowActivationId);
  } finally {
    await rm(rootDir, { recursive: true, force: true });
  }
});

test('standalone evidence rejects a testability receipt from a different declared public scenario', async () => {
  const rootDir = await mkdtemp(path.join(os.tmpdir(), 'rex-standalone-testability-'));
  try {
    const started = runCli(
      rootDir,
      'start',
      '--work-item',
      'checkout-validation',
      '--message',
      'Update checkout validation behavior.',
    );
    assert.equal(started.command.providerId, 'rex-test-design');

    const designed = runCli(
      rootDir,
      'evidence',
      '--activation',
      started.command.activationId,
      '--command-token',
      started.command.commandToken,
      '--evidence',
      'test-scope-contract-recorded=artifact:test-design',
      '--evidence',
      'acceptance-test-mapping-recorded=artifact:test-design',
      '--evidence',
      'test-seam-recorded=artifact:test-design',
    );
    assert.equal(designed.command.stageId, 'decide-testability');

    await writeFile(
      path.join(rootDir, 'checkout-validation.test.mjs'),
      "import assert from 'node:assert/strict';\nimport test from 'node:test';\n\ntest('rejects invalid checkout', () => assert.fail('validation is not implemented'));\n",
      'utf8',
    );
    const unrelatedReceipt = runReceipt(rootDir, process.execPath, '-e', 'process.exit(7)');
    await writeFile(path.join(rootDir, 'testability.json'), `${JSON.stringify({
      kind: 'behavior-delta',
      decisionRef: 'artifact:testability-decision',
      redCandidate: {
        publicEntry: 'checkout validation endpoint',
        setup: 'Submit an invalid checkout request.',
        command: {
          executable: process.execPath,
          args: ['--test', 'checkout-validation.test.mjs'],
          cwd: rootDir,
        },
        expected: 'The invalid checkout is rejected.',
        observed: 'The invalid checkout is accepted before implementation.',
        failureReason: 'The requested validation behavior is absent.',
        receiptRef: unrelatedReceipt.ref,
      },
    }, null, 2)}\n`, 'utf8');

    const rejected = spawnSync(process.execPath, [
      cliPath,
      'evidence',
      '--activation',
      designed.command.activationId,
      '--command-token',
      designed.command.commandToken,
      '--evidence',
      'testability-decision-recorded=artifact:testability-decision',
      '--testability-file',
      'testability.json',
      '--root',
      rootDir,
    ], { encoding: 'utf8' });
    assert.equal(rejected.status, 1);
    assert.match(rejected.stderr, /does not match the declared scenario command/u);
  } finally {
    await rm(rootDir, { recursive: true, force: true });
  }
});
