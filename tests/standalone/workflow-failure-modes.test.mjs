import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  readStandaloneWorkflow,
  startStandaloneWorkflow,
  submitStandaloneEvidence,
} from '../../src/index.mjs';

async function withRoot(prefix, run) {
  const rootDir = await mkdtemp(path.join(os.tmpdir(), prefix));
  try {
    await run(rootDir);
  } finally {
    await rm(rootDir, { recursive: true, force: true });
  }
}

function startRequirements(rootDir, workItemKey = 'checkout') {
  return startStandaloneWorkflow({
    rootDir,
    workItemKey,
    workflowActivationId: `workflow-${workItemKey}`,
    request: { message: 'Clarify acceptance criteria before implementing checkout.' },
  });
}

test('standalone start rejects an existing work item and preserves the resumable workflow', async () => {
  await withRoot('rex-existing-', async (rootDir) => {
    const started = startRequirements(rootDir);

    assert.throws(
      () => startRequirements(rootDir),
      /already exists: checkout; use resume/u,
    );
    const resumed = readStandaloneWorkflow({ rootDir, workItemKey: 'checkout' });
    assert.equal(resumed.workflow.workflowActivationId, started.workflow.workflowActivationId);
    assert.equal(
      resumed.workflow.currentCommand.executionToken,
      started.workflow.currentCommand.executionToken,
    );
  });
});

test('standalone Evidence rejects activation mismatch, unexpected kinds, and placeholders', async () => {
  await withRoot('rex-invalid-evidence-', async (rootDir) => {
    const started = startRequirements(rootDir);
    const command = started.workflow.currentCommand;

    assert.throws(
      () => submitStandaloneEvidence({
        rootDir,
        activationId: 'activation-other',
        commandToken: command.executionToken,
        evidence: [{ kind: 'acceptance-criteria-recorded', refs: ['artifact:requirements'] }],
      }),
      /activation not found/u,
    );
    assert.throws(
      () => submitStandaloneEvidence({
        rootDir,
        activationId: command.activationId,
        commandToken: command.executionToken,
        evidence: [{ kind: 'passing-test-observed', refs: ['command:test'] }],
      }),
      /unexpected rex evidence kind/u,
    );
    assert.throws(
      () => submitStandaloneEvidence({
        rootDir,
        activationId: command.activationId,
        commandToken: command.executionToken,
        evidence: [{ kind: 'acceptance-criteria-recorded', refs: ['artifact:TODO'] }],
      }),
      /invalid or placeholder ref/u,
    );
  });
});

test('accepted partial Evidence rotates the token and blocks replay without duplicating the journal', async () => {
  await withRoot('rex-replay-', async (rootDir) => {
    const started = startRequirements(rootDir);
    const command = started.workflow.currentCommand;
    const partial = submitStandaloneEvidence({
      rootDir,
      activationId: command.activationId,
      commandToken: command.executionToken,
      evidence: [{ kind: 'acceptance-criteria-recorded', refs: ['artifact:requirements'] }],
    });

    assert.notEqual(partial.workflow.currentCommand.executionToken, command.executionToken);
    assert.throws(
      () => submitStandaloneEvidence({
        rootDir,
        activationId: command.activationId,
        commandToken: command.executionToken,
        evidence: [{ kind: 'non-goals-recorded', refs: ['artifact:requirements'] }],
      }),
      /current Command token/u,
    );

    const [journalName] = await readdir(path.join(rootDir, '.rex-harness', 'evidence'));
    const journal = await readFile(
      path.join(rootDir, '.rex-harness', 'evidence', journalName),
      'utf8',
    );
    assert.equal(journal.trim().split(/\r?\n/u).length, 1);
  });
});

test('corrupted activation state fails closed instead of creating or resuming a replacement workflow', async () => {
  await withRoot('rex-corrupt-', async (rootDir) => {
    startRequirements(rootDir);
    const activationDir = path.join(rootDir, '.rex-harness', 'activations');
    const [activationName] = await readdir(activationDir);
    await writeFile(path.join(activationDir, activationName), '{not-json\n', 'utf8');

    assert.throws(
      () => readStandaloneWorkflow({ rootDir, workItemKey: 'checkout' }),
      /invalid rex standalone state/u,
    );
    assert.throws(
      () => startRequirements(rootDir),
      /invalid rex standalone state/u,
    );
  });
});
