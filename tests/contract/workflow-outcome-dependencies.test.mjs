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

function deliveryInput(rootDir, features) {
  const baselineCommand = command(rootDir);
  const baselineReceipt = rex.captureStandaloneExecutionReceipt({ rootDir, ...baselineCommand });
  return {
    input: {
      workItemKey: 'dependency-validation-delivery',
      baseline: {
        publicEntry: 'delivery public baseline',
        setup: 'Run the existing delivery scenario.',
        command: baselineCommand,
        expected: 'The existing behavior passes.',
        observed: 'The existing behavior passed.',
        receiptRef: baselineReceipt.ref,
      },
      features,
    },
    options: {
      resolveReceipt: (ref) => rex.resolveStandaloneExecutionReceipt({ rootDir, ref }),
    },
  };
}

function feature(id, dependsOn = []) {
  return {
    id,
    dependsOn,
    acceptance: `${id} acceptance`,
    verificationScenario: {
      publicEntry: `${id} public entry`,
      setup: `Exercise ${id}.`,
      command: command(process.cwd()),
      expected: `${id} passes.`,
    },
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

test('long-running delivery rejects invalid dependency graph edges before starting', async () => {
  const rootDir = await mkdtemp(path.join(os.tmpdir(), 'rex-invalid-dependency-'));
  try {
    const cases = [
      { features: [feature('feature', ['missing'])], pattern: /unknown dependency: missing/ },
      { features: [feature('feature', ['other', 'other']), feature('other')], pattern: /duplicate dependency: other/ },
      { features: [feature('feature', ['feature'])], pattern: /cannot depend on itself: feature/ },
      { features: [feature('first', ['second']), feature('second', ['first'])], pattern: /dependency cycle/ },
    ];

    for (const testCase of cases) {
      const { input, options } = deliveryInput(rootDir, testCase.features);
      assert.throws(() => rex.startLongRunningDelivery(input, options), testCase.pattern);
    }
  } finally {
    await rm(rootDir, { recursive: true, force: true });
  }
});

test('long-running delivery activates the first dependency-ready pending feature after acceptance', async () => {
  const rootDir = await mkdtemp(path.join(os.tmpdir(), 'rex-ready-dependency-'));
  try {
    const baselineCommand = command(rootDir);
    const prerequisiteCommand = command(rootDir);
    const dependentCommand = command(rootDir);
    const baselineReceipt = rex.captureStandaloneExecutionReceipt({ rootDir, ...baselineCommand });
    const resolveReceipt = (ref) => rex.resolveStandaloneExecutionReceipt({ rootDir, ref });
    const started = rex.startLongRunningDelivery({
      workItemKey: 'dependency-ready-transition',
      baseline: {
        publicEntry: 'delivery baseline', setup: 'Run baseline.', command: baselineCommand,
        expected: 'Baseline passes.', observed: 'Baseline passed.', receiptRef: baselineReceipt.ref,
      },
      features: [
        { id: 'dependent', dependsOn: ['prerequisite'], acceptance: 'Dependent passes.', verificationScenario: { publicEntry: 'dependent', setup: 'Run dependent.', command: dependentCommand, expected: 'Dependent passes.' } },
        { id: 'prerequisite', acceptance: 'Prerequisite passes.', verificationScenario: { publicEntry: 'prerequisite', setup: 'Run prerequisite.', command: prerequisiteCommand, expected: 'Prerequisite passes.' } },
      ],
    }, { resolveReceipt });
    const receipt = rex.captureStandaloneExecutionReceipt({ rootDir, ...prerequisiteCommand });

    const advanced = rex.advanceLongRunningDelivery(started.ledger, {
      kind: 'feature-verification-observed', featureId: 'prerequisite', receiptRef: receipt.ref,
    }, { resolveReceipt });

    assert.deepEqual(advanced.decision, { kind: 'continue', currentFeatureId: 'dependent' });
    assert.equal(advanced.ledger.currentFeatureId, 'dependent');
    assert.equal(advanced.ledger.features[0].status, 'active');
    assert.equal(advanced.ledger.features[1].status, 'accepted');
  } finally {
    await rm(rootDir, { recursive: true, force: true });
  }
});

test('long-running delivery blocks unresolved pending dependencies without activating a feature', async () => {
  const rootDir = await mkdtemp(path.join(os.tmpdir(), 'rex-unresolved-dependency-'));
  try {
    const baselineCommand = command(rootDir);
    const blockerCommand = command(rootDir);
    const baselineReceipt = rex.captureStandaloneExecutionReceipt({ rootDir, ...baselineCommand });
    const resolveReceipt = (ref) => rex.resolveStandaloneExecutionReceipt({ rootDir, ref });
    const started = rex.startLongRunningDelivery({
      workItemKey: 'unresolved-dependency-transition',
      baseline: { publicEntry: 'baseline', setup: 'Run baseline.', command: baselineCommand, expected: 'Baseline passes.', observed: 'Baseline passed.', receiptRef: baselineReceipt.ref },
      features: [
        { id: 'blocker', acceptance: 'Blocker passes.', verificationScenario: { publicEntry: 'blocker', setup: 'Run blocker.', command: blockerCommand, expected: 'Blocker passes.' } },
        { id: 'gated-prerequisite', acceptance: 'Prerequisite awaits a human gate.', verificationScenario: { publicEntry: 'gated-prerequisite', setup: 'Run prerequisite.', command: command(rootDir), expected: 'Prerequisite passes.' } },
        { id: 'waiting-dependent', dependsOn: ['gated-prerequisite'], acceptance: 'Dependent awaits prerequisite.', verificationScenario: { publicEntry: 'waiting-dependent', setup: 'Run dependent.', command: command(rootDir), expected: 'Dependent passes.' } },
      ],
    }, { resolveReceipt });
    const controlledLedger = Object.freeze({
      ...started.ledger,
      features: Object.freeze(started.ledger.features.map((item) => (
        item.id === 'gated-prerequisite' ? Object.freeze({ ...item, status: 'human-gate' }) : item
      ))),
    });
    const receipt = rex.captureStandaloneExecutionReceipt({ rootDir, ...blockerCommand });

    const advanced = rex.advanceLongRunningDelivery(controlledLedger, {
      kind: 'feature-verification-observed', featureId: 'blocker', receiptRef: receipt.ref,
    }, { resolveReceipt });

    assert.deepEqual(advanced.decision, { kind: 'blocked', reason: 'dependencies-unresolved' });
    assert.equal(advanced.ledger.status, 'blocked');
    assert.equal(advanced.ledger.currentFeatureId, null);
    assert.equal(advanced.ledger.features[2].status, 'pending');
  } finally {
    await rm(rootDir, { recursive: true, force: true });
  }
});
