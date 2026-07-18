import assert from 'node:assert/strict';
import test from 'node:test';

import {
  CAPABILITY,
  FACT,
  advanceActivation,
  decideNextCapability,
  nextCommand,
  startActivation,
} from '../../src/index.mjs';

function strictTddDecision() {
  return decideNextCapability([
    { kind: FACT.BEHAVIOR_CHANGE, evidenceRefs: ['request:current'] },
    { kind: FACT.TEST_SCOPE_CONFIRMED, evidenceRefs: ['contract:test-scope'] },
    { kind: FACT.HIGH_RISK_BOUNDARY, evidenceRefs: ['risk:auth'] },
  ]);
}

test('strict TDD activation advances red, green, and refactor one evidence gate at a time', () => {
  const activation = startActivation(strictTddDecision(), { activationId: 'activation:tdd-1' });
  const red = nextCommand(activation);

  assert.equal(activation.capabilityId, CAPABILITY.TESTING_STRICT_TDD);
  assert.equal(activation.reasonCode, FACT.HIGH_RISK_BOUNDARY);
  assert.deepEqual(activation.triggerEvidenceRefs, ['request:current', 'contract:test-scope', 'risk:auth']);
  assert.equal(red.type, 'provider.invoke');
  assert.equal(red.stageId, 'red');
  assert.equal(red.reasonCode, FACT.HIGH_RISK_BOUNDARY);
  assert.deepEqual(red.triggerEvidenceRefs, ['request:current', 'contract:test-scope', 'risk:auth']);
  assert.deepEqual(red.expectedEvidence, [
    'failing-test-observed',
    'red-failure-reason-recorded',
  ]);

  const blocked = advanceActivation(activation, [
    { kind: 'passing-test-observed', refs: ['command:test:unexpected-green'] },
  ]);
  assert.equal(blocked.outcome, 'blocked');
  assert.deepEqual(blocked.missingEvidence, [
    'failing-test-observed',
    'red-failure-reason-recorded',
  ]);
  assert.equal(blocked.activation.stageId, 'red');

  const green = advanceActivation(blocked.activation, [
    { kind: 'failing-test-observed', refs: ['command:test:red'] },
    { kind: 'red-failure-reason-recorded', refs: ['command:test:red-reason'] },
  ]);
  assert.equal(green.outcome, 'next');
  assert.equal(green.command.stageId, 'green');
  assert.deepEqual(green.command.expectedEvidence, [
    'passing-test-observed',
    'implementation-diff-recorded',
  ]);

  const refactor = advanceActivation(green.activation, [
    { kind: 'passing-test-observed', refs: ['command:test:green'] },
    { kind: 'implementation-diff-recorded', refs: ['diff:working-tree'] },
  ]);
  assert.equal(refactor.outcome, 'next');
  assert.equal(refactor.command.stageId, 'refactor');
  assert.deepEqual(refactor.command.expectedEvidence, [
    'refactor-check-recorded',
    'test-strength-check-recorded',
    'test-diff-review-recorded',
  ]);

  const completed = advanceActivation(refactor.activation, [
    { kind: 'refactor-check-recorded', refs: ['command:test:refactor'] },
    { kind: 'test-strength-check-recorded', refs: ['command:test:strength'] },
    { kind: 'test-diff-review-recorded', refs: ['diff:test-review'] },
  ]);
  assert.equal(completed.outcome, 'completed');
  assert.equal(completed.activation.status, 'completed');
  assert.equal(completed.command, null);
  assert.equal(nextCommand(completed.activation), null);
});

test('activation ids are supplied by the host persistence boundary', () => {
  assert.throws(
    () => startActivation(strictTddDecision()),
    /activationId/u,
  );
});
