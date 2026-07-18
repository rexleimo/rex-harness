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

  const testDesign = advanceSoftwareWorkflow(started, [
    { kind: 'test-scope-contract-recorded', refs: ['artifact:test-design'] },
    { kind: 'acceptance-test-mapping-recorded', refs: ['artifact:test-design'] },
    { kind: 'test-seam-recorded', refs: ['artifact:test-design'] },
  ], { createActivationId });

  assert.equal(testDesign.outcome, 'completed');
  assert.equal(testDesign.workflow.currentCapabilityId, CAPABILITY.TESTING_TDD);
  assert.equal(testDesign.workflow.stepIndex, 1);
  assert.deepEqual(testDesign.workflow.completedCapabilities, [CAPABILITY.TESTING_DESIGN]);
  assert.equal(testDesign.workflow.activationHistory[0].status, 'completed');

  let tddWorkflow = advanceSoftwareWorkflow(testDesign.workflow, [
    { kind: 'failing-test-observed', refs: ['command:test:red'] },
    { kind: 'red-failure-reason-recorded', refs: ['artifact:test:red-reason'] },
  ], { createActivationId });
  assert.equal(tddWorkflow.outcome, 'next');
  tddWorkflow = advanceSoftwareWorkflow(tddWorkflow.workflow, [
    { kind: 'passing-test-observed', refs: ['command:test:green'] },
    { kind: 'implementation-diff-recorded', refs: ['diff:working-tree'] },
  ], { createActivationId });
  assert.equal(tddWorkflow.outcome, 'next');
  tddWorkflow = advanceSoftwareWorkflow(tddWorkflow.workflow, [
    { kind: 'refactor-check-recorded', refs: ['command:test:refactor'] },
    { kind: 'test-strength-check-recorded', refs: ['command:test:mutation-probe'] },
    { kind: 'test-diff-review-recorded', refs: ['artifact:test-diff-review'] },
  ], { createActivationId });

  assert.equal(tddWorkflow.workflow.currentCapabilityId, CAPABILITY.REVIEW_STANDARDS_SPEC);
  assert.equal(tddWorkflow.workflow.phaseId, 'assurance');

  const review = advanceSoftwareWorkflow(tddWorkflow.workflow, [
    { kind: 'standards-review-recorded', refs: ['artifact:review'] },
    { kind: 'spec-review-recorded', refs: ['artifact:review'] },
  ], { createActivationId });

  assert.equal(review.workflow.status, 'completed');
  assert.equal(review.workflow.currentActivation, null);
  assert.equal(review.workflow.currentCommand, null);
  assert.equal(review.workflow.executionProfile.label, 'balanced');
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
  workflow = advanceSoftwareWorkflow(workflow, [
    { kind: 'test-scope-contract-recorded', refs: ['artifact:test-scope'] },
    { kind: 'acceptance-test-mapping-recorded', refs: ['artifact:test-scope'] },
    { kind: 'test-seam-recorded', refs: ['artifact:test-scope'] },
  ], { createActivationId }).workflow;
  assert.equal(workflow.currentCapabilityId, CAPABILITY.TESTING_TDD);

  workflow = advanceSoftwareWorkflow(workflow, [
    { kind: 'failing-test-observed', refs: ['command:test:red'] },
    { kind: 'red-failure-reason-recorded', refs: ['artifact:test:red-reason'] },
  ], { createActivationId }).workflow;
  workflow = advanceSoftwareWorkflow(workflow, [
    { kind: 'passing-test-observed', refs: ['command:test:green'] },
    { kind: 'implementation-diff-recorded', refs: ['diff:working-tree'] },
  ], { createActivationId }).workflow;
  workflow = advanceSoftwareWorkflow(workflow, [
    { kind: 'refactor-check-recorded', refs: ['command:test:refactor'] },
    { kind: 'test-diff-review-recorded', refs: ['artifact:test-diff-review'] },
  ], { createActivationId }).workflow;

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
  workflow = advanceSoftwareWorkflow(workflow, [
    { kind: 'test-scope-contract-recorded', refs: ['artifact:test-scope'] },
    { kind: 'acceptance-test-mapping-recorded', refs: ['artifact:test-scope'] },
    { kind: 'test-seam-recorded', refs: ['artifact:test-scope'] },
  ], { createActivationId }).workflow;
  assert.equal(workflow.currentCapabilityId, CAPABILITY.TESTING_STRICT_TDD);
  workflow = advanceSoftwareWorkflow(workflow, [
    { kind: 'failing-test-observed', refs: ['command:test:red'] },
    { kind: 'red-failure-reason-recorded', refs: ['artifact:test:red-reason'] },
  ], { createActivationId }).workflow;
  workflow = advanceSoftwareWorkflow(workflow, [
    { kind: 'passing-test-observed', refs: ['command:test:green'] },
    { kind: 'implementation-diff-recorded', refs: ['diff:working-tree'] },
  ], { createActivationId }).workflow;
  workflow = advanceSoftwareWorkflow(workflow, [
    { kind: 'refactor-check-recorded', refs: ['command:test:refactor'] },
    { kind: 'test-strength-check-recorded', refs: ['command:test:mutation-probe'] },
    { kind: 'test-diff-review-recorded', refs: ['artifact:test-diff-review'] },
  ], { createActivationId }).workflow;

  assert.equal(workflow.currentCapabilityId, CAPABILITY.REVIEW_SPECIALIST);
  assert.ok(workflow.completedCapabilities.includes(CAPABILITY.TESTING_DESIGN));
  assert.ok(!workflow.completedCapabilities.includes(CAPABILITY.IMPLEMENTATION_EXECUTE));
  assert.equal(workflow.executionProfile.label, 'deep');
});
