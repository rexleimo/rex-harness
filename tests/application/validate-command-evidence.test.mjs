import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  captureStandaloneExecutionReceipt,
  resolveStandaloneExecutionReceipt,
  validateCommandEvidence,
} from '../../src/index.mjs';

async function withRoot(run) {
  const rootDir = await mkdtemp(path.join(os.tmpdir(), 'rex-evidence-receipt-'));
  try {
    await run(rootDir);
  } finally {
    await rm(rootDir, { recursive: true, force: true });
  }
}

function command(expectedEvidence) {
  return { expectedEvidence };
}

function resolver(rootDir) {
  return (ref) => resolveStandaloneExecutionReceipt({ rootDir, ref });
}

test('command evidence requires a real execution receipt with the matching exit code', async () => {
  await withRoot(async (rootDir) => {
    const passing = captureStandaloneExecutionReceipt({
      rootDir,
      executable: process.execPath,
      args: ['-e', 'process.exit(0)'],
    });
    const failing = captureStandaloneExecutionReceipt({
      rootDir,
      executable: process.execPath,
      args: ['-e', 'process.exit(7)'],
    });
    const resolveReceipt = resolver(rootDir);

    assert.equal(passing.receipt.exitCode, 0);
    assert.equal(failing.receipt.exitCode, 7);
    assert.match(passing.receipt.stdoutSha256, /^[a-f0-9]{64}$/u);

    assert.throws(
      () => validateCommandEvidence(command(['failing-test-observed']), [
        { kind: 'failing-test-observed', refs: [passing.ref] },
      ], { resolveReceipt }),
      /non-zero exit code/u,
    );
    assert.throws(
      () => validateCommandEvidence(command(['failing-test-observed']), [
        { kind: 'failing-test-observed', refs: ['receipt:missing'] },
      ], { resolveReceipt }),
      /unknown execution receipt/u,
    );
    assert.throws(
      () => validateCommandEvidence(command(['failing-test-observed']), [
        { kind: 'failing-test-observed', refs: ['command:test:red'] },
      ], { resolveReceipt }),
      /requires at least one receipt/u,
    );

    assert.doesNotThrow(() => validateCommandEvidence(command(['failing-test-observed']), [
      { kind: 'failing-test-observed', refs: [failing.ref] },
    ], { resolveReceipt }));
    assert.doesNotThrow(() => validateCommandEvidence(command(['baseline-scenario-observed']), [
      { kind: 'baseline-scenario-observed', refs: [passing.ref] },
    ], { resolveReceipt }));

    const declaredScenario = {
      executable: process.execPath,
      args: ['-e', 'process.exit(7)'],
      cwd: rootDir,
    };
    for (const scenario of [
      { ...declaredScenario, executable: 'node' },
      { ...declaredScenario, args: ['-e', 'process.exit(1)'] },
      { ...declaredScenario, cwd: path.join(rootDir, 'different-working-directory') },
    ]) {
      assert.throws(
        () => validateCommandEvidence(command(['failing-test-observed']), [
          { kind: 'failing-test-observed', refs: [failing.ref] },
        ], { resolveReceipt, expectedScenarioCommand: scenario }),
        /does not match the declared scenario command/u,
      );
    }
  });
});
