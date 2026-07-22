import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import * as rex from '../../src/index.mjs';

function command(rootDir) {
  return {
    executable: process.execPath,
    args: ['-e', 'process.exit(0)'],
    cwd: rootDir,
  };
}

test('long-running delivery starts the first dependency-ready feature and preserves dependency edges', async () => {
  const rootDir = await mkdtemp(path.join(os.tmpdir(), 'rex-outcome-dependency-'));
  try {
    const baselineCommand = command(rootDir);
    const baselineReceipt = rex.captureStandaloneExecutionReceipt({
      rootDir,
      ...baselineCommand,
    });
    const resolveReceipt = (ref) => rex.resolveStandaloneExecutionReceipt({ rootDir, ref });

    const started = rex.startLongRunningDelivery({
      workItemKey: 'dependency-ordered-delivery',
      baseline: {
        publicEntry: 'delivery public baseline',
        setup: 'Run the existing delivery scenario.',
        command: baselineCommand,
        expected: 'The existing behavior passes.',
        observed: 'The existing behavior passed.',
        receiptRef: baselineReceipt.ref,
      },
      features: [
        {
          id: 'dependent',
          dependsOn: ['prerequisite'],
          acceptance: 'The dependent behavior is delivered after its prerequisite.',
          verificationScenario: {
            publicEntry: 'dependent public entry',
            setup: 'Exercise the dependent behavior.',
            command: command(rootDir),
            expected: 'The dependent behavior passes.',
          },
        },
        {
          id: 'prerequisite',
          acceptance: 'The prerequisite behavior is delivered first.',
          verificationScenario: {
            publicEntry: 'prerequisite public entry',
            setup: 'Exercise the prerequisite behavior.',
            command: command(rootDir),
            expected: 'The prerequisite behavior passes.',
          },
        },
      ],
    }, { resolveReceipt });

    assert.deepEqual(started.ledger.features[0].dependsOn, ['prerequisite']);
    assert.equal(started.ledger.currentFeatureId, 'prerequisite');
    assert.equal(started.ledger.features[0].status, 'pending');
    assert.equal(started.ledger.features[1].status, 'active');
  } finally {
    await rm(rootDir, { recursive: true, force: true });
  }
});
