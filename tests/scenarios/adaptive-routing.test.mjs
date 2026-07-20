import assert from 'node:assert/strict';
import test from 'node:test';

import {
  CAPABILITY,
  FACT,
  decideNextCapability,
  decidePromotion,
} from '../../src/index.mjs';

test('no software-engineering fact means no process capability', () => {
  assert.equal(decideNextCapability([]), null);
});

test('missing acceptance criteria activates requirements clarification only', () => {
  const decision = decideNextCapability([
    { kind: FACT.ACCEPTANCE_CRITERIA_MISSING, evidenceRefs: ['request:current'] },
  ]);

  assert.equal(decision.capabilityId, CAPABILITY.REQUIREMENTS_CLARIFY);
  assert.equal(decision.reasonCode, FACT.ACCEPTANCE_CRITERIA_MISSING);
});

test('an observed failure preempts implementation-oriented capabilities', () => {
  const decision = decideNextCapability([
    { kind: FACT.NEW_CONSTRUCT_PROPOSED, evidenceRefs: ['proposal:helper'] },
    { kind: FACT.EXECUTION_FAILED, evidenceRefs: ['command:npm-test'] },
  ]);

  assert.equal(decision.capabilityId, CAPABILITY.DEBUG_ROOT_CAUSE);
});

test('high-risk regression with a confirmed test scope activates strict TDD', () => {
  const decision = decideNextCapability([
    { kind: FACT.BEHAVIOR_CHANGE, evidenceRefs: ['diff:auth/session.mjs'] },
    { kind: FACT.TEST_SCOPE_CONFIRMED, evidenceRefs: ['contract:test-scope'] },
    { kind: FACT.HONEST_RED_CANDIDATE, evidenceRefs: ['receipt:auth-red'] },
    { kind: FACT.HIGH_RISK_BOUNDARY, evidenceRefs: ['risk:auth'] },
    { kind: FACT.REGRESSION_OBSERVED, evidenceRefs: ['test:session-regression'] },
  ]);

  assert.equal(decision.capabilityId, CAPABILITY.TESTING_STRICT_TDD);
  assert.deepEqual(decision.evidenceRefs, [
    'diff:auth/session.mjs',
    'contract:test-scope',
    'receipt:auth-red',
    'risk:auth',
  ]);
});

test('a proposed construct activates the minimal-implementation gate', () => {
  const decision = decideNextCapability([
    { kind: FACT.NEW_CONSTRUCT_PROPOSED, evidenceRefs: ['proposal:new-dependency'] },
  ]);

  assert.equal(decision.capabilityId, CAPABILITY.IMPLEMENTATION_MINIMIZE);
});

test('a ready bounded diff activates standards and spec review', () => {
  const decision = decideNextCapability([
    { kind: FACT.DIFF_READY, evidenceRefs: ['diff:working-tree'] },
  ]);

  assert.equal(decision.capabilityId, CAPABILITY.REVIEW_STANDARDS_SPEC);
});

test('a completed capability is skipped so the next eligible capability can run', () => {
  const facts = [
    { kind: FACT.BEHAVIOR_CHANGE, evidenceRefs: ['diff:auth/session.mjs'] },
    { kind: FACT.TEST_SCOPE_CONFIRMED, evidenceRefs: ['contract:test-scope'] },
    { kind: FACT.HONEST_RED_CANDIDATE, evidenceRefs: ['receipt:auth-red'] },
    { kind: FACT.HIGH_RISK_BOUNDARY, evidenceRefs: ['risk:auth'] },
    { kind: FACT.DIFF_READY, evidenceRefs: ['diff:working-tree'] },
    { kind: FACT.SPECIALIST_REVIEW_REQUIRED, evidenceRefs: ['risk-domain:security'] },
  ];

  const firstDecision = decideNextCapability(facts);
  assert.equal(firstDecision.capabilityId, CAPABILITY.TESTING_STRICT_TDD);

  const secondDecision = decideNextCapability(facts, {
    completedCapabilities: [CAPABILITY.TESTING_STRICT_TDD],
  });
  assert.equal(secondDecision.capabilityId, CAPABILITY.REVIEW_SPECIALIST);
  assert.deepEqual(secondDecision.evidenceRefs, ['diff:working-tree', 'risk-domain:security']);
});

test('continuity requirements request AIOS harness promotion', () => {
  const decision = decidePromotion([
    { kind: FACT.CONTINUITY_REQUIRED, evidenceRefs: ['objective:multi-session'] },
  ]);

  assert.deepEqual(decision, {
    target: 'harness',
    reasonCode: FACT.CONTINUITY_REQUIRED,
    evidenceRefs: ['objective:multi-session'],
  });
});

test('independent workstreams request AIOS team promotion', () => {
  const decision = decidePromotion([
    { kind: FACT.INDEPENDENT_WORKSTREAMS, evidenceRefs: ['workstreams:api,docs'] },
  ]);

  assert.deepEqual(decision, {
    target: 'team',
    reasonCode: FACT.INDEPENDENT_WORKSTREAMS,
    evidenceRefs: ['workstreams:api,docs'],
  });
});

test('promotion is not requested without an explicit promotion fact', () => {
  assert.equal(decidePromotion([
    { kind: FACT.DIFF_READY, evidenceRefs: ['diff:working-tree'] },
  ]), null);
});
