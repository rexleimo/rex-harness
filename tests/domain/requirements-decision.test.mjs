import assert from 'node:assert/strict';
import test from 'node:test';

import { evaluateSoftwareRequest } from '../../src/application/evaluate-request.mjs';
import { deriveSoftwareFacts } from '../../src/application/derive-facts.mjs';
import { FACT } from '../../src/domain/fact-kinds.mjs';
import {
  normalizeRequirementsDecision,
  REQUIREMENTS_DECISION_KIND,
} from '../../src/domain/requirements-decision.mjs';

const decisionFixture = Object.freeze({
  schemaVersion: 1,
  kind: REQUIREMENTS_DECISION_KIND,
  decisionRef: 'artifact:requirements-decision-001',
  acceptanceCriteria: ['expired session returns 401'],
  nonGoals: ['do not change the login page layout'],
  firstSlice: {
    outcome: 'public authentication entry rejects expired sessions',
    verification: 'focused public-entry test',
  },
  observations: [
    {
      kind: 'change.behavior-requested',
      evidenceRefs: ['artifact:requirements-decision-001'],
    },
    {
      kind: 'change.high-risk-boundary',
      evidenceRefs: ['artifact:requirements-decision-001'],
    },
  ],
});

test('requirements decision normalizes and round-trips as a stable typed artifact', () => {
  const normalized = normalizeRequirementsDecision(JSON.parse(JSON.stringify(decisionFixture)));
  assert.deepEqual(normalized, decisionFixture);
  assert.equal(normalized.kind, REQUIREMENTS_DECISION_KIND);
});

test('requirements decision rejects incomplete, unknown, or mismatched evidence', () => {
  assert.throws(
    () => normalizeRequirementsDecision({ ...decisionFixture, acceptanceCriteria: [] }),
    /acceptanceCriteria must be a non-empty array/u,
  );
  assert.throws(
    () => normalizeRequirementsDecision({ ...decisionFixture, unknown: true }),
    /unknown field/u,
  );
  assert.throws(
    () => normalizeRequirementsDecision({
      ...decisionFixture,
      observations: [{ kind: 'change.behavior-requested', evidenceRefs: ['artifact:other'] }],
    }),
    /must reference artifact:requirements-decision-001/u,
  );
  assert.throws(
    () => normalizeRequirementsDecision({
      ...decisionFixture,
      observations: [{ kind: 'not-registered', evidenceRefs: [decisionFixture.decisionRef] }],
    }),
    /not registered/u,
  );
  assert.throws(
    () => normalizeRequirementsDecision({
      ...decisionFixture,
      observations: [{
        kind: 'change.behavior-requested',
        evidenceRefs: [decisionFixture.decisionRef, 'not-a-protocol-ref'],
      }],
    }),
    /invalid evidence ref/u,
  );
  assert.throws(
    () => normalizeRequirementsDecision({
      ...decisionFixture,
      observations: [{
        kind: 'change.behavior-requested',
        evidenceRefs: [decisionFixture.decisionRef],
        unknown: true,
      }],
    }),
    /unknown field/u,
  );
});

test('requirements decision observations override weak request wording on the next Fact derivation', () => {
  const result = evaluateSoftwareRequest({
    message: '把登录逻辑改一改，涉及认证安全',
    requirementsDecision: decisionFixture,
  });
  const factKinds = result.facts.map((fact) => fact.kind);
  assert.ok(factKinds.includes(FACT.REQUIREMENTS_DECISION_RECORDED));
  assert.ok(factKinds.includes(FACT.BEHAVIOR_CHANGE));
  assert.ok(factKinds.includes(FACT.HIGH_RISK_BOUNDARY));
  assert.ok(!factKinds.includes(FACT.ACCEPTANCE_CRITERIA_MISSING));
  assert.ok(!factKinds.includes(FACT.SPECIALIST_REVIEW_REQUIRED));
  assert.equal(result.requirementsDecision.decisionRef, decisionFixture.decisionRef);
});

test('requirements decision is authoritative even when the original request contains risk words', () => {
  const facts = deriveSoftwareFacts({
    message: 'Update authentication security behavior.',
    requirementsDecision: decisionFixture,
  });
  assert.ok(facts.some((fact) => fact.kind === FACT.BEHAVIOR_CHANGE));
  assert.ok(!facts.some((fact) => fact.kind === FACT.SPECIALIST_REVIEW_REQUIRED));
});
