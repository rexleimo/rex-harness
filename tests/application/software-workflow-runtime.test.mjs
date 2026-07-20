import assert from 'node:assert/strict';
import test from 'node:test';

import {
  CAPABILITY,
  OBSERVATION,
  advanceSoftwareWorkflow,
  startSoftwareWorkflow,
} from '../../src/index.mjs';

function sequentialIds(prefix) {
  let index = 0;
  return () => `${prefix}-${index++}`;
}

const SCENARIO_COMMAND = Object.freeze({
  executable: 'node',
  args: ['--test', 'tests/application/software-workflow-runtime.test.mjs'],
  cwd: '/tmp/rex-workflow-test',
});

function receipt(ref, exitCode, command = SCENARIO_COMMAND) {
  return {
    receiptId: ref.slice('receipt:'.length),
    command,
    exitCode,
    stdoutSha256: 'a'.repeat(64),
    stderrSha256: 'b'.repeat(64),
    observedAt: '2026-07-19T00:00:00.000Z',
  };
}

function resolveReceipt(ref) {
  if (ref === 'receipt:red-workflow') return receipt(ref, 1);
  if (new Set([
    'receipt:baseline-workflow',
    'receipt:green-workflow',
    'receipt:refactor-workflow',
    'receipt:strength-workflow',
  ]).has(ref)) return receipt(ref, 0);
  return null;
}

function resolveReceiptWithWrongScenario(ref) {
  if (ref === 'receipt:wrong-red') {
    return receipt(ref, 1, {
      executable: 'node',
      args: ['-e', 'process.exit(1)'],
      cwd: '/tmp/other-workflow-test',
    });
  }
  if (ref === 'receipt:wrong-zero') {
    return receipt(ref, 0, {
      executable: 'node',
      args: ['-e', 'process.exit(0)'],
      cwd: '/tmp/other-workflow-test',
    });
  }
  return resolveReceipt(ref);
}

function workflowOptions(createActivationId) {
  return { createActivationId, resolveReceipt };
}

function honestRedDecision(decisionRef = 'artifact:testability-decision') {
  return {
    kind: 'behavior-delta',
    decisionRef,
    redCandidate: {
      publicEntry: 'startSoftwareWorkflow()',
      setup: 'A public workflow whose requested behavior has not been implemented.',
      command: SCENARIO_COMMAND,
      expected: 'The new public behavior succeeds.',
      observed: 'The new public behavior is absent before implementation.',
      failureReason: 'The requested behavior has not been implemented.',
      receiptRef: 'receipt:red-workflow',
    },
  };
}

function completeTestDesignWithHonestRed(workflow, createActivationId) {
  const designed = advanceSoftwareWorkflow(workflow, [
    { kind: 'test-scope-contract-recorded', refs: ['artifact:test-design'] },
    { kind: 'acceptance-test-mapping-recorded', refs: ['artifact:test-design'] },
    { kind: 'test-seam-recorded', refs: ['artifact:test-design'] },
  ], workflowOptions(createActivationId));
  assert.equal(designed.outcome, 'next');
  assert.equal(designed.workflow.currentCommand.stageId, 'decide-testability');

  return advanceSoftwareWorkflow(designed.workflow, [
    { kind: 'testability-decision-recorded', refs: ['artifact:testability-decision'] },
  ], {
    ...workflowOptions(createActivationId),
    testabilityDecision: honestRedDecision(),
  });
}

test('software workflow owns capability selection, transition history, and execution analytics', () => {
  const createActivationId = sequentialIds('capability');
  const started = startSoftwareWorkflow({
    workflowActivationId: 'workflow-checkout',
    workItemKey: 'checkout',
    request: { message: 'Update checkout validation behavior.' },
    createActivationId,
  });

  assert.equal(started.workflowId, 'adaptive-software-delivery');
  assert.equal(started.status, 'active');
  assert.equal(started.phaseId, 'delivery');
  assert.equal(started.currentCapabilityId, CAPABILITY.TESTING_DESIGN);
  assert.equal(started.currentCommand.provider.id, 'rex-test-design');
  assert.equal(started.executionProfile.label, 'balanced');

  const testDesign = completeTestDesignWithHonestRed(started, createActivationId);

  assert.equal(testDesign.outcome, 'completed');
  assert.equal(testDesign.workflow.currentCapabilityId, CAPABILITY.TESTING_TDD);
  assert.equal(testDesign.workflow.stepIndex, 1);
  assert.deepEqual(testDesign.workflow.completedCapabilities, [CAPABILITY.TESTING_DESIGN]);
  assert.equal(testDesign.workflow.activationHistory[0].status, 'completed');

  let tddWorkflow = advanceSoftwareWorkflow(testDesign.workflow, [
    { kind: 'failing-test-observed', refs: ['receipt:red-workflow'] },
    { kind: 'red-failure-reason-recorded', refs: ['artifact:test:red-reason'] },
  ], workflowOptions(createActivationId));
  assert.equal(tddWorkflow.outcome, 'next');
  tddWorkflow = advanceSoftwareWorkflow(tddWorkflow.workflow, [
    { kind: 'passing-test-observed', refs: ['receipt:green-workflow'] },
    { kind: 'implementation-diff-recorded', refs: ['diff:working-tree'] },
  ], workflowOptions(createActivationId));
  assert.equal(tddWorkflow.outcome, 'next');
  tddWorkflow = advanceSoftwareWorkflow(tddWorkflow.workflow, [
    { kind: 'refactor-check-recorded', refs: ['receipt:refactor-workflow'] },
    { kind: 'test-diff-review-recorded', refs: ['artifact:test-diff-review'] },
  ], workflowOptions(createActivationId));

  assert.equal(tddWorkflow.workflow.currentCapabilityId, CAPABILITY.REVIEW_STANDARDS_SPEC);
  assert.equal(tddWorkflow.workflow.phaseId, 'assurance');

  const review = advanceSoftwareWorkflow(tddWorkflow.workflow, [
    { kind: 'standards-review-recorded', refs: ['artifact:review'] },
    { kind: 'spec-review-recorded', refs: ['artifact:review'] },
  ], workflowOptions(createActivationId));

  assert.equal(review.workflow.status, 'completed');
  assert.equal(review.workflow.currentActivation, null);
  assert.equal(review.workflow.currentCommand, null);
  assert.equal(review.workflow.executionProfile.label, 'balanced');
});

test('test design requires an explicit testability decision before selecting delivery', () => {
  const createActivationId = sequentialIds('testability');
  let workflow = startSoftwareWorkflow({
    workflowActivationId: 'workflow-testability',
    workItemKey: 'testability',
    request: { message: 'Update a private workflow validation boundary without changing public behavior.' },
    createActivationId,
  });

  workflow = advanceSoftwareWorkflow(workflow, [
    { kind: 'test-scope-contract-recorded', refs: ['artifact:test-scope'] },
    { kind: 'acceptance-test-mapping-recorded', refs: ['artifact:test-scope'] },
    { kind: 'test-seam-recorded', refs: ['artifact:test-scope'] },
  ], { createActivationId }).workflow;

  assert.equal(workflow.currentCapabilityId, CAPABILITY.TESTING_DESIGN);
  assert.equal(workflow.currentCommand.stageId, 'decide-testability');
  assert.deepEqual(workflow.currentCommand.expectedEvidence, ['testability-decision-recorded']);

  const redirected = advanceSoftwareWorkflow(workflow, [
    { kind: 'testability-decision-recorded', refs: ['artifact:testability-decision'] },
  ], {
    ...workflowOptions(createActivationId),
    testabilityDecision: {
      kind: 'behavior-preserving-hardening',
      decisionRef: 'artifact:testability-decision',
      baseline: {
        publicEntry: 'startSoftwareWorkflow()',
        setup: 'A workflow whose existing public scenarios already pass before the hardening.',
        command: SCENARIO_COMMAND,
        expected: 'Existing public workflow scenarios pass.',
        observed: 'Existing public workflow scenarios passed.',
        receiptRef: 'receipt:baseline-workflow',
      },
    },
  });

  assert.equal(redirected.outcome, 'completed');
  assert.equal(redirected.workflow.currentCapabilityId, CAPABILITY.TESTING_HARDENING);
  assert.equal(redirected.workflow.currentCommand.provider.id, 'rex-refactor-hardening');
  assert.equal(redirected.workflow.testabilityDecision.kind, 'behavior-preserving-hardening');

  assert.throws(
    () => advanceSoftwareWorkflow(redirected.workflow, [
      { kind: 'baseline-scenario-observed', refs: ['receipt:wrong-zero'] },
    ], {
      createActivationId,
      resolveReceipt: resolveReceiptWithWrongScenario,
    }),
    /does not match the declared scenario command/u,
  );
});

test('public workflow advancement rejects a claimed RED without a receipt', () => {
  const createActivationId = sequentialIds('forged-red');
  const workflow = startSoftwareWorkflow({
    workflowActivationId: 'workflow-forged-red',
    workItemKey: 'forged-red',
    request: { message: 'Update checkout validation behavior.' },
    createActivationId,
  });
  const designed = completeTestDesignWithHonestRed(workflow, createActivationId);

  assert.throws(
    () => advanceSoftwareWorkflow(designed.workflow, [
      { kind: 'failing-test-observed', refs: ['command:claimed-red'] },
      { kind: 'red-failure-reason-recorded', refs: ['artifact:test:red-reason'] },
    ], workflowOptions(createActivationId)),
    /requires at least one receipt/u,
  );
});

test('TDD rejects same-exit receipts that do not execute the declared scenario', () => {
  const createActivationId = sequentialIds('scenario-bound');
  const designed = completeTestDesignWithHonestRed(startSoftwareWorkflow({
    workflowActivationId: 'workflow-scenario-bound',
    workItemKey: 'scenario-bound',
    request: { message: 'Update checkout validation behavior.' },
    createActivationId,
  }), createActivationId);

  assert.throws(
    () => advanceSoftwareWorkflow(designed.workflow, [
      { kind: 'failing-test-observed', refs: ['receipt:wrong-red'] },
      { kind: 'red-failure-reason-recorded', refs: ['artifact:test:red-reason'] },
    ], {
      createActivationId,
      resolveReceipt: resolveReceiptWithWrongScenario,
    }),
    /does not match the declared scenario command/u,
  );

  const green = advanceSoftwareWorkflow(designed.workflow, [
    { kind: 'failing-test-observed', refs: ['receipt:red-workflow'] },
    { kind: 'red-failure-reason-recorded', refs: ['artifact:test:red-reason'] },
  ], workflowOptions(createActivationId)).workflow;
  assert.throws(
    () => advanceSoftwareWorkflow(green, [
      { kind: 'passing-test-observed', refs: ['receipt:wrong-zero'] },
      { kind: 'implementation-diff-recorded', refs: ['diff:working-tree'] },
    ], {
      createActivationId,
      resolveReceipt: resolveReceiptWithWrongScenario,
    }),
    /does not match the declared scenario command/u,
  );

  const refactor = advanceSoftwareWorkflow(green, [
    { kind: 'passing-test-observed', refs: ['receipt:green-workflow'] },
    { kind: 'implementation-diff-recorded', refs: ['diff:working-tree'] },
  ], workflowOptions(createActivationId)).workflow;
  assert.throws(
    () => advanceSoftwareWorkflow(refactor, [
      { kind: 'refactor-check-recorded', refs: ['receipt:wrong-zero'] },
      { kind: 'test-diff-review-recorded', refs: ['artifact:test-diff-review'] },
    ], {
      createActivationId,
      resolveReceipt: resolveReceiptWithWrongScenario,
    }),
    /does not match the declared scenario command/u,
  );
});

test('a legacy unbound testability command cannot resume delivery', () => {
  const createActivationId = sequentialIds('legacy-scenario');
  const designed = completeTestDesignWithHonestRed(startSoftwareWorkflow({
    workflowActivationId: 'workflow-legacy-scenario',
    workItemKey: 'legacy-scenario',
    request: { message: 'Update checkout validation behavior.' },
    createActivationId,
  }), createActivationId);
  const legacyWorkflow = {
    ...designed.workflow,
    testabilityDecision: {
      ...designed.workflow.testabilityDecision,
      redCandidate: {
        ...designed.workflow.testabilityDecision.redCandidate,
        command: 'node --test old-unbound-scenario.test.mjs',
      },
    },
  };

  assert.throws(
    () => advanceSoftwareWorkflow(legacyWorkflow, [
      { kind: 'failing-test-observed', refs: ['receipt:red-workflow'] },
      { kind: 'red-failure-reason-recorded', refs: ['artifact:test:red-reason'] },
    ], workflowOptions(createActivationId)),
    /legacy or invalid testability scenario cannot resume delivery/u,
  );
});

test('implementation-ready cannot bypass the test scope contract or duplicate TDD green', () => {
  const createActivationId = sequentialIds('ready');
  let workflow = startSoftwareWorkflow({
    workflowActivationId: 'workflow-ready',
    workItemKey: 'ready',
    request: {
      message: 'Update checkout behavior.',
      observations: [{
        kind: OBSERVATION.IMPLEMENTATION_READY,
        evidenceRefs: ['artifact:approved-slice'],
      }],
    },
    createActivationId,
  });

  assert.equal(workflow.currentCapabilityId, CAPABILITY.TESTING_DESIGN);
  workflow = completeTestDesignWithHonestRed(workflow, createActivationId).workflow;
  assert.equal(workflow.currentCapabilityId, CAPABILITY.TESTING_TDD);

  workflow = advanceSoftwareWorkflow(workflow, [
    { kind: 'failing-test-observed', refs: ['receipt:red-workflow'] },
    { kind: 'red-failure-reason-recorded', refs: ['artifact:test:red-reason'] },
  ], workflowOptions(createActivationId)).workflow;
  workflow = advanceSoftwareWorkflow(workflow, [
    { kind: 'passing-test-observed', refs: ['receipt:green-workflow'] },
    { kind: 'implementation-diff-recorded', refs: ['diff:working-tree'] },
  ], workflowOptions(createActivationId)).workflow;
  workflow = advanceSoftwareWorkflow(workflow, [
    { kind: 'refactor-check-recorded', refs: ['receipt:refactor-workflow'] },
    { kind: 'test-diff-review-recorded', refs: ['artifact:test-diff-review'] },
  ], workflowOptions(createActivationId)).workflow;

  assert.equal(workflow.currentCapabilityId, CAPABILITY.REVIEW_STANDARDS_SPEC);
  assert.ok(!workflow.completedCapabilities.includes(CAPABILITY.IMPLEMENTATION_EXECUTE));
});

test('high-risk behavior confirms scope, completes TDD, and keeps risk-backed review', () => {
  const createActivationId = sequentialIds('strict');
  let workflow = startSoftwareWorkflow({
    workflowActivationId: 'workflow-auth',
    workItemKey: 'auth',
    request: {
      message: 'Update authentication behavior.',
      observations: [
        {
          kind: OBSERVATION.HIGH_RISK_BOUNDARY,
          evidenceRefs: ['risk:auth'],
        },
      ],
    },
    createActivationId,
  });

  assert.equal(workflow.currentCapabilityId, CAPABILITY.TESTING_DESIGN);
  workflow = completeTestDesignWithHonestRed(workflow, createActivationId).workflow;
  assert.equal(workflow.currentCapabilityId, CAPABILITY.TESTING_STRICT_TDD);
  workflow = advanceSoftwareWorkflow(workflow, [
    { kind: 'failing-test-observed', refs: ['receipt:red-workflow'] },
    { kind: 'red-failure-reason-recorded', refs: ['artifact:test:red-reason'] },
  ], workflowOptions(createActivationId)).workflow;
  workflow = advanceSoftwareWorkflow(workflow, [
    { kind: 'passing-test-observed', refs: ['receipt:green-workflow'] },
    { kind: 'implementation-diff-recorded', refs: ['diff:working-tree'] },
  ], workflowOptions(createActivationId)).workflow;
  workflow = advanceSoftwareWorkflow(workflow, [
    { kind: 'refactor-check-recorded', refs: ['receipt:refactor-workflow'] },
    { kind: 'test-strength-check-recorded', refs: ['receipt:strength-workflow'] },
    { kind: 'test-diff-review-recorded', refs: ['artifact:test-diff-review'] },
  ], workflowOptions(createActivationId)).workflow;

  assert.equal(workflow.currentCapabilityId, CAPABILITY.REVIEW_SPECIALIST);
  assert.ok(workflow.completedCapabilities.includes(CAPABILITY.TESTING_DESIGN));
  assert.ok(!workflow.completedCapabilities.includes(CAPABILITY.IMPLEMENTATION_EXECUTE));
  assert.equal(workflow.executionProfile.label, 'deep');
});
