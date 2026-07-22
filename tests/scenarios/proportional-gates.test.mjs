import assert from 'node:assert/strict';
import test from 'node:test';

import {
  CAPABILITY,
  FACT,
  OBSERVATION,
  advanceActivation,
  analyzeExecutionProfile,
  decideNextCapability,
  evaluateSoftwareRequest,
  nextCommand,
  startActivation,
} from '../../src/index.mjs';

function fact(kind, evidenceRefs, value) {
  return value === undefined ? { kind, evidenceRefs } : { kind, evidenceRefs, value };
}

function deliveryFacts(...riskFacts) {
  return [
    fact(FACT.BEHAVIOR_CHANGE, ['request:current']),
    fact(FACT.TEST_SCOPE_CONFIRMED, ['activation:software.testing.design:completed']),
    fact(FACT.HONEST_RED_CANDIDATE, ['receipt:checkout-red']),
    ...riskFacts,
  ];
}

test('external-effect behavior selects strict TDD with its stronger evidence contract', () => {
  const decision = decideNextCapability(deliveryFacts(
    fact(FACT.CHANGE_EXTERNAL_EFFECT, ['assessment:checkout'], 'external'),
  ));

  assert.equal(decision.capabilityId, CAPABILITY.TESTING_STRICT_TDD);
  assert.ok(decision.requiredEvidence.includes('test-strength-check-recorded'));
});

test('P3 structured observations reach the proportional strict-TDD gate', () => {
  const result = evaluateSoftwareRequest({
    message: 'Update checkout validation behavior.',
    observations: [{
      kind: OBSERVATION.CHANGE_RISK_ASSESSED,
      evidenceRefs: ['assessment:checkout'],
      changeRisk: {
        changeKind: 'behavioral',
        blastRadius: 'component',
        externalEffect: 'external',
        reversibility: 'compensatable',
        uncertainty: 'medium',
      },
    }],
    completedCapabilities: [CAPABILITY.TESTING_DESIGN],
    testabilityDecision: {
      kind: 'behavior-delta',
      decisionRef: 'artifact:checkout-testability',
      redCandidate: {
        publicEntry: 'checkout validation',
        setup: 'Submit an invalid checkout request.',
        command: {
          executable: 'node',
          args: ['--test', 'tests/scenarios/proportional-gates.test.mjs'],
          cwd: '/tmp/rex-proportional-gates',
        },
        expected: 'The invalid request is rejected.',
        observed: 'The invalid request is accepted before implementation.',
        failureReason: 'The requested validation behavior is absent.',
        receiptRef: 'receipt:checkout-red',
      },
    },
  });

  assert.equal(result.decision.capabilityId, CAPABILITY.TESTING_STRICT_TDD);
  assert.equal(result.decision.reasonCode, FACT.CHANGE_EXTERNAL_EFFECT);
});

test('local reversible low-uncertainty behavior keeps the baseline TDD contract', () => {
  const decision = decideNextCapability(deliveryFacts(
    fact(FACT.CHANGE_BLAST_RADIUS, ['assessment:checkout'], 'local'),
    fact(FACT.CHANGE_EXTERNAL_EFFECT, ['assessment:checkout'], 'none'),
    fact(FACT.CHANGE_REVERSIBILITY, ['assessment:checkout'], 'reversible'),
    fact(FACT.CHANGE_UNCERTAINTY, ['assessment:checkout'], 'low'),
  ));

  assert.equal(decision.capabilityId, CAPABILITY.TESTING_TDD);
  assert.ok(!decision.requiredEvidence.includes('test-strength-check-recorded'));
});

for (const scenario of [
  fact(FACT.CHANGE_EXTERNAL_EFFECT, ['assessment:external'], 'destructive'),
  fact(FACT.CHANGE_BLAST_RADIUS, ['assessment:system'], 'system'),
  fact(FACT.CHANGE_REVERSIBILITY, ['assessment:rollback'], 'irreversible'),
  fact(FACT.CHANGE_UNCERTAINTY, ['assessment:unknown'], 'high'),
]) {
  test(`${scenario.kind}=${scenario.value} selects strict TDD`, () => {
    const decision = decideNextCapability(deliveryFacts(scenario));
    assert.equal(decision.capabilityId, CAPABILITY.TESTING_STRICT_TDD);
    assert.equal(decision.reasonCode, scenario.kind);
  });
}

test('structured risk cannot bypass the existing delivery preconditions', () => {
  const elevatedRisk = fact(FACT.CHANGE_EXTERNAL_EFFECT, ['assessment:checkout'], 'external');

  assert.equal(decideNextCapability([elevatedRisk]), null);
  assert.equal(
    decideNextCapability([
      fact(FACT.BEHAVIOR_CHANGE, ['request:current']),
      elevatedRisk,
    ]).capabilityId,
    CAPABILITY.TESTING_DESIGN,
  );
});

test('legacy high-risk selection remains strict TDD', () => {
  const decision = decideNextCapability(deliveryFacts(
    fact(FACT.HIGH_RISK_BOUNDARY, ['risk:auth']),
  ));

  assert.equal(decision.capabilityId, CAPABILITY.TESTING_STRICT_TDD);
  assert.equal(decision.reasonCode, FACT.HIGH_RISK_BOUNDARY);
});

test('strict TDD blocks refactor advancement until its test-strength evidence is present', () => {
  const decision = decideNextCapability(deliveryFacts(
    fact(FACT.CHANGE_EXTERNAL_EFFECT, ['assessment:checkout'], 'external'),
  ));
  const started = startActivation(decision, { activationId: 'proportional-strict-tdd' });
  const green = advanceActivation(started, [
    { kind: 'failing-test-observed', refs: ['receipt:checkout-red'] },
    { kind: 'red-failure-reason-recorded', refs: ['artifact:red-reason'] },
  ]).activation;
  const refactor = advanceActivation(green, [
    { kind: 'passing-test-observed', refs: ['receipt:checkout-green'] },
    { kind: 'implementation-diff-recorded', refs: ['diff:checkout'] },
  ]).activation;
  const blocked = advanceActivation(refactor, [
    { kind: 'refactor-check-recorded', refs: ['receipt:checkout-refactor'] },
    { kind: 'test-diff-review-recorded', refs: ['artifact:test-diff-review'] },
  ]);

  assert.equal(blocked.outcome, 'blocked');
  assert.deepEqual(blocked.missingEvidence, ['test-strength-check-recorded']);
  assert.equal(blocked.command.stageId, 'refactor');

  const completed = advanceActivation(blocked.activation, [
    { kind: 'test-strength-check-recorded', refs: ['receipt:checkout-strength'] },
  ]);
  assert.equal(completed.outcome, 'completed');
  assert.equal(nextCommand(completed.activation), null);
});

test('execution profile is derived from completed activations rather than risk facts', () => {
  assert.deepEqual(analyzeExecutionProfile([]), { label: 'fast', capabilityIds: [] });
  assert.deepEqual(
    analyzeExecutionProfile([{ capabilityId: CAPABILITY.TESTING_STRICT_TDD }]),
    { label: 'deep', capabilityIds: [CAPABILITY.TESTING_STRICT_TDD] },
  );
});
