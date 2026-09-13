import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  deriveEffectRef,
  normalizeTurnResult,
  startStandaloneWorkflow,
} from '../../src/index.mjs';

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const cliPath = path.resolve(testDirectory, '../../bin/rex-harness.mjs');

function runCliWithStdin(rootDir, subcommand, payload) {
  return execFileSync(process.execPath, [cliPath, subcommand, '--root', rootDir], {
    encoding: 'utf8',
    input: `${JSON.stringify(payload)}\n`,
  });
}

function startRequirements(rootDir) {
  return startStandaloneWorkflow({
    rootDir,
    workItemKey: 'checkout',
    workflowActivationId: 'workflow-checkout',
    request: { message: 'Clarify acceptance criteria before implementing checkout.', explicitIntent: 'grill' },
  });
}

async function withRoot(prefix, run) {
  const rootDir = await mkdtemp(path.join(os.tmpdir(), prefix));
  try {
    await run(rootDir);
  } finally {
    await rm(rootDir, { recursive: true, force: true });
  }
}

test('verify CLI accepts a well-formed material envelope with exit 0', async () => {
  await withRoot('rex-verify-accept-', async (rootDir) => {
    const started = startRequirements(rootDir);
    const command = started.workflow.currentCommand;
    const bare = {
      kind: 'rex.turn-result.v1',
      turnKey: { workflowActivationId: started.workflow.workflowActivationId, iteration: 1 },
      outcome: 'validated_progress',
      failureKind: 'none',
      selfReport: { progressMade: true, blockedReason: '', summary: 'criteria recorded' },
      evidence: [{ kind: 'acceptance-criteria-recorded', refs: ['artifact:requirements'] }],
      bypass: false,
      commandToken: command.executionToken,
    };
    const envelope = { ...bare, effectRef: deriveEffectRef({ executionToken: bare.commandToken, turnResult: bare }) };

    const output = runCliWithStdin(rootDir, 'verify', envelope);
    const report = JSON.parse(output);
    assert.equal(report.status, 'accepted');
    assert.deepEqual(report.rejections, []);

    // 结算前重放 verify 仍 accepted（verify 只读，不产生 settlement 记录）。
    const second = JSON.parse(runCliWithStdin(rootDir, 'verify', envelope));
    assert.equal(second.status, 'accepted');
  });
});

test('verify CLI rejects a tampered envelope with exit 1', async () => {
  await withRoot('rex-verify-reject-', async (rootDir) => {
    const started = startRequirements(rootDir);
    const command = started.workflow.currentCommand;
    const bare = {
      kind: 'rex.turn-result.v1',
      turnKey: { workflowActivationId: started.workflow.workflowActivationId, iteration: 1 },
      outcome: 'validated_progress',
      failureKind: 'none',
      selfReport: { progressMade: true, blockedReason: '', summary: 'recorded progress' },
      evidence: [{ kind: 'acceptance-criteria-recorded', refs: ['artifact:requirements'] }],
      bypass: false,
      commandToken: command.executionToken,
    };
    const envelope = normalizeTurnResult({
      ...bare,
      effectRef: deriveEffectRef({ executionToken: bare.commandToken, turnResult: bare }),
    });
    // 篡改 outcome（progress → completion），保留原 effectRef。
    const tampered = { ...envelope, outcome: 'validated_completion' };

    let exited = false;
    let output = '';
    try {
      output = runCliWithStdin(rootDir, 'verify', tampered);
    } catch (error) {
      exited = true;
      output = String(error.stdout || '');
      assert.equal(error.status, 1);
    }
    assert.equal(exited, true, 'tampered envelope must exit non-zero');
    const report = JSON.parse(output);
    assert.equal(report.status, 'rejected');
    assert.ok(report.rejections.includes('effect_ref_mismatch'));
  });
});

test('settle CLI journals an accepted settlement and exits 0; rejection exits 1', async () => {
  await withRoot('rex-settle-cli-', async (rootDir) => {
    const started = startRequirements(rootDir);
    const command = started.workflow.currentCommand;
    const bare = {
      kind: 'rex.turn-result.v1',
      turnKey: { workflowActivationId: started.workflow.workflowActivationId, iteration: 1 },
      outcome: 'validated_progress',
      failureKind: 'none',
      selfReport: { progressMade: true, blockedReason: '', summary: 'criteria recorded' },
      evidence: [{ kind: 'acceptance-criteria-recorded', refs: ['artifact:requirements'] }],
      bypass: false,
      commandToken: command.executionToken,
    };
    const envelope = { ...bare, effectRef: deriveEffectRef({ executionToken: bare.commandToken, turnResult: bare }) };

    const output = runCliWithStdin(rootDir, 'settle', envelope);
    const result = JSON.parse(output);
    assert.equal(result.settlement.decision, 'accepted');

    // bypass material 声明 → reject → exit 1。
    const bypassBare = {
      ...bare,
      outcome: 'blocked',
      bypass: true,
      selfReport: { progressMade: false, blockedReason: 'operator gate', summary: 'steering only' },
      evidence: [],
    };
    const bypassEnvelope = {
      ...bypassBare,
      effectRef: deriveEffectRef({ executionToken: command.executionToken, turnResult: bypassBare }),
    };
    let rejectOutput = '';
    let rejectedExit = null;
    try {
      rejectOutput = runCliWithStdin(rootDir, 'settle', bypassEnvelope);
    } catch (error) {
      rejectOutput = String(error.stdout || '');
      rejectedExit = error.status;
    }
    assert.equal(rejectedExit, 1);
    assert.equal(JSON.parse(rejectOutput).settlement.decision, 'rejected');
  });
});
