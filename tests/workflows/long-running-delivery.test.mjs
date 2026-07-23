import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import * as rex from '../../src/index.mjs';

function scenarioCommand(rootDir, args) {
  return {
    executable: process.execPath,
    args,
    cwd: rootDir,
  };
}

async function startControlledDelivery(rootDir, { maxRetries = 1 } = {}) {
  const runner = path.join(rootDir, 'scenario-runner.mjs');
  const validationControl = path.join(rootDir, 'validation-exit.txt');
  const receiptControl = path.join(rootDir, 'receipt-exit.txt');
  await writeFile(runner, [
    "import fs from 'node:fs';",
    "process.exit(Number(fs.readFileSync(process.argv[2], 'utf8')));",
    '',
  ].join('\n'), 'utf8');
  await Promise.all([
    writeFile(validationControl, '0', 'utf8'),
    writeFile(receiptControl, '0', 'utf8'),
  ]);
  const baselineCommand = scenarioCommand(rootDir, ['-e', 'process.exit(0)']);
  const validationCommand = scenarioCommand(rootDir, [runner, validationControl]);
  const receiptCommand = scenarioCommand(rootDir, [runner, receiptControl]);
  const baselineReceipt = rex.captureStandaloneExecutionReceipt({ rootDir, ...baselineCommand });
  const resolveReceipt = (ref) => rex.resolveStandaloneExecutionReceipt({ rootDir, ref });
  const started = rex.startLongRunningDelivery({
    workItemKey: 'checkout-controlled-delivery',
    baseline: {
      publicEntry: 'checkout public baseline',
      setup: 'Run the existing checkout acceptance scenario before feature delivery.',
      command: baselineCommand,
      expected: 'The pre-existing checkout behavior passes.',
      observed: 'The pre-existing checkout behavior passed.',
      receiptRef: baselineReceipt.ref,
    },
    features: [
      {
        id: 'checkout-validation',
        acceptance: 'Invalid checkout input is rejected through the public entry.',
        verificationScenario: {
          publicEntry: 'checkout validation endpoint',
          setup: 'Submit invalid checkout input.',
          command: validationCommand,
          expected: 'The invalid checkout is rejected.',
        },
      },
      {
        id: 'checkout-receipt',
        acceptance: 'A valid checkout returns a receipt through the public entry.',
        verificationScenario: {
          publicEntry: 'checkout receipt endpoint',
          setup: 'Submit a valid checkout request.',
          command: receiptCommand,
          expected: 'The checkout returns a receipt.',
        },
      },
    ],
    retryPolicy: { maxRetries },
  }, { resolveReceipt });
  return {
    started,
    resolveReceipt,
    validationCommand,
    receiptCommand,
    validationControl,
    receiptControl,
  };
}

test('Rex long-running initializer verifies a real baseline and selects only the first feature', async () => {
  const rootDir = await mkdtemp(path.join(os.tmpdir(), 'rex-long-running-delivery-'));
  try {
    const baselineCommand = scenarioCommand(rootDir, ['-e', 'process.exit(0)']);
    const baselineReceipt = rex.captureStandaloneExecutionReceipt({
      rootDir,
      ...baselineCommand,
    });

    assert.equal(typeof rex.startLongRunningDelivery, 'function');
    const started = rex.startLongRunningDelivery({
      workItemKey: 'checkout-delivery',
      baseline: {
        publicEntry: 'checkout public baseline',
        setup: 'Run the existing checkout acceptance scenario before feature delivery.',
        command: baselineCommand,
        expected: 'The pre-existing checkout behavior passes.',
        observed: 'The pre-existing checkout behavior passed.',
        receiptRef: baselineReceipt.ref,
      },
      features: [
        {
          id: 'checkout-validation',
          acceptance: 'Invalid checkout input is rejected through the public entry.',
          verificationScenario: {
            publicEntry: 'checkout validation endpoint',
            setup: 'Submit invalid checkout input.',
            command: scenarioCommand(rootDir, ['-e', 'process.exit(0)']),
            expected: 'The invalid checkout is rejected.',
          },
        },
        {
          id: 'checkout-receipt',
          acceptance: 'A valid checkout returns a receipt through the public entry.',
          verificationScenario: {
            publicEntry: 'checkout receipt endpoint',
            setup: 'Submit a valid checkout request.',
            command: scenarioCommand(rootDir, ['-e', 'process.exit(0)']),
            expected: 'The checkout returns a receipt.',
          },
        },
      ],
    }, {
      resolveReceipt: (ref) => rex.resolveStandaloneExecutionReceipt({ rootDir, ref }),
    });

    assert.equal(started.ledger.baseline.status, 'passed');
    assert.equal(started.ledger.currentFeatureId, 'checkout-validation');
    assert.equal(started.decision.kind, 'continue');
    assert.equal(started.decision.currentFeatureId, 'checkout-validation');
    assert.equal(started.ledger.features[1].status, 'pending');
  } finally {
    await rm(rootDir, { recursive: true, force: true });
  }
});

test('Rex long-running transition accepts the current feature before selecting the next one', async () => {
  const rootDir = await mkdtemp(path.join(os.tmpdir(), 'rex-long-running-transition-'));
  try {
    const baselineCommand = scenarioCommand(rootDir, ['-e', 'process.stdout.write("baseline")']);
    const firstFeatureCommand = scenarioCommand(rootDir, ['-e', 'process.stdout.write("validation")']);
    const secondFeatureCommand = scenarioCommand(rootDir, ['-e', 'process.stdout.write("receipt")']);
    const baselineReceipt = rex.captureStandaloneExecutionReceipt({
      rootDir,
      ...baselineCommand,
    });
    const started = rex.startLongRunningDelivery({
      workItemKey: 'checkout-delivery-transition',
      baseline: {
        publicEntry: 'checkout public baseline',
        setup: 'Run the existing checkout acceptance scenario before feature delivery.',
        command: baselineCommand,
        expected: 'The pre-existing checkout behavior passes.',
        observed: 'The pre-existing checkout behavior passed.',
        receiptRef: baselineReceipt.ref,
      },
      features: [
        {
          id: 'checkout-validation',
          acceptance: 'Invalid checkout input is rejected through the public entry.',
          verificationScenario: {
            publicEntry: 'checkout validation endpoint',
            setup: 'Submit invalid checkout input.',
            command: firstFeatureCommand,
            expected: 'The invalid checkout is rejected.',
          },
        },
        {
          id: 'checkout-receipt',
          acceptance: 'A valid checkout returns a receipt through the public entry.',
          verificationScenario: {
            publicEntry: 'checkout receipt endpoint',
            setup: 'Submit a valid checkout request.',
            command: secondFeatureCommand,
            expected: 'The checkout returns a receipt.',
          },
        },
      ],
    }, {
      resolveReceipt: (ref) => rex.resolveStandaloneExecutionReceipt({ rootDir, ref }),
    });
    const acceptanceReceipt = rex.captureStandaloneExecutionReceipt({
      rootDir,
      ...firstFeatureCommand,
    });

    assert.equal(typeof rex.advanceLongRunningDelivery, 'function');
    const advanced = rex.advanceLongRunningDelivery(started.ledger, {
      kind: 'feature-verification-observed',
      featureId: 'checkout-validation',
      receiptRef: acceptanceReceipt.ref,
    }, {
      resolveReceipt: (ref) => rex.resolveStandaloneExecutionReceipt({ rootDir, ref }),
    });

    assert.equal(advanced.ledger.features[0].status, 'accepted');
    assert.equal(advanced.ledger.currentFeatureId, 'checkout-receipt');
    assert.deepEqual(advanced.decision, {
      kind: 'continue',
      currentFeatureId: 'checkout-receipt',
    });
  } finally {
    await rm(rootDir, { recursive: true, force: true });
  }
});

test('Rex retries only the current feature and requires a human gate when its retry budget is exhausted', async () => {
  const rootDir = await mkdtemp(path.join(os.tmpdir(), 'rex-long-running-retry-'));
  try {
    const fixture = await startControlledDelivery(rootDir, { maxRetries: 1 });
    await writeFile(fixture.validationControl, '7', 'utf8');
    const firstFailure = rex.captureStandaloneExecutionReceipt({
      rootDir,
      ...fixture.validationCommand,
    });
    const retried = rex.advanceLongRunningDelivery(fixture.started.ledger, {
      kind: 'feature-verification-observed',
      featureId: 'checkout-validation',
      receiptRef: firstFailure.ref,
    }, { resolveReceipt: fixture.resolveReceipt });

    assert.deepEqual(retried.decision, {
      kind: 'retry',
      currentFeatureId: 'checkout-validation',
    });
    assert.equal(retried.ledger.features[0].retryCount, 1);
    assert.equal(retried.ledger.features[1].status, 'pending');

    const secondFailure = rex.captureStandaloneExecutionReceipt({
      rootDir,
      ...fixture.validationCommand,
    });
    const gated = rex.advanceLongRunningDelivery(retried.ledger, {
      kind: 'feature-verification-observed',
      featureId: 'checkout-validation',
      receiptRef: secondFailure.ref,
    }, { resolveReceipt: fixture.resolveReceipt });

    assert.deepEqual(gated.decision, {
      kind: 'human-gate',
      reason: 'verification-failed',
    });
    assert.equal(Object.hasOwn(gated.decision, 'currentFeatureId'), false);
    assert.equal(gated.ledger.features[1].status, 'pending');
  } finally {
    await rm(rootDir, { recursive: true, force: true });
  }
});

test('Rex blocks missing, unresolved, cross-feature, and command-mismatched evidence without selecting another feature', async () => {
  const rootDir = await mkdtemp(path.join(os.tmpdir(), 'rex-long-running-blocked-'));
  try {
    const fixture = await startControlledDelivery(rootDir);
    const missing = rex.advanceLongRunningDelivery(fixture.started.ledger, null, {
      resolveReceipt: fixture.resolveReceipt,
    });
    assert.deepEqual(missing.decision, {
      kind: 'blocked',
      reason: 'evidence-missing',
    });
    assert.equal(Object.hasOwn(missing.decision, 'currentFeatureId'), false);

    const unresolved = rex.advanceLongRunningDelivery(fixture.started.ledger, {
      kind: 'acceptance-unresolved',
      featureId: 'checkout-validation',
      reasonRef: 'artifact:missing-acceptance-decision',
    }, { resolveReceipt: fixture.resolveReceipt });
    assert.equal(unresolved.decision.kind, 'human-gate');
    assert.equal(Object.hasOwn(unresolved.decision, 'currentFeatureId'), false);

    const receipt = rex.captureStandaloneExecutionReceipt({ rootDir, ...fixture.receiptCommand });
    const crossed = rex.advanceLongRunningDelivery(fixture.started.ledger, {
      kind: 'feature-verification-observed',
      featureId: 'checkout-receipt',
      receiptRef: receipt.ref,
    }, { resolveReceipt: fixture.resolveReceipt });
    assert.deepEqual(crossed.decision, {
      kind: 'blocked',
      reason: 'evidence-feature-mismatch',
    });
    assert.equal(Object.hasOwn(crossed.decision, 'currentFeatureId'), false);
    assert.equal(crossed.ledger.features[1].status, 'pending');

    const mismatched = rex.advanceLongRunningDelivery(fixture.started.ledger, {
      kind: 'feature-verification-observed',
      featureId: 'checkout-validation',
      receiptRef: receipt.ref,
    }, { resolveReceipt: fixture.resolveReceipt });
    assert.deepEqual(mismatched.decision, {
      kind: 'blocked',
      reason: 'evidence-rejected',
    });
    assert.equal(Object.hasOwn(mismatched.decision, 'currentFeatureId'), false);
    assert.equal(mismatched.ledger.features[0].status, 'active');
    assert.equal(mismatched.ledger.features[1].status, 'pending');
  } finally {
    await rm(rootDir, { recursive: true, force: true });
  }
});

test('Rex completes only after the final current feature has matching acceptance evidence', async () => {
  const rootDir = await mkdtemp(path.join(os.tmpdir(), 'rex-long-running-completed-'));
  try {
    const fixture = await startControlledDelivery(rootDir);
    const firstReceipt = rex.captureStandaloneExecutionReceipt({ rootDir, ...fixture.validationCommand });
    const afterFirst = rex.advanceLongRunningDelivery(fixture.started.ledger, {
      kind: 'feature-verification-observed',
      featureId: 'checkout-validation',
      receiptRef: firstReceipt.ref,
    }, { resolveReceipt: fixture.resolveReceipt });
    const finalReceipt = rex.captureStandaloneExecutionReceipt({ rootDir, ...fixture.receiptCommand });
    const completed = rex.advanceLongRunningDelivery(afterFirst.ledger, {
      kind: 'feature-verification-observed',
      featureId: 'checkout-receipt',
      receiptRef: finalReceipt.ref,
    }, { resolveReceipt: fixture.resolveReceipt });

    assert.deepEqual(completed.decision, { kind: 'completed' });
    assert.equal(completed.ledger.status, 'completed');
    assert.equal(completed.ledger.features[1].status, 'accepted');
  } finally {
    await rm(rootDir, { recursive: true, force: true });
  }
});
