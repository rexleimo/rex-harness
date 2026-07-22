import assert from 'node:assert/strict';
import test from 'node:test';

import {
  FACT,
  OBSERVATION,
  deriveSoftwareFacts,
  evaluateSoftwareRequest,
  startSoftwareWorkflow,
} from '../../src/index.mjs';

const CHANGE_RISK_FACT_KINDS = new Set([
  FACT.CHANGE_KIND,
  FACT.CHANGE_BLAST_RADIUS,
  FACT.CHANGE_EXTERNAL_EFFECT,
  FACT.CHANGE_REVERSIBILITY,
  FACT.CHANGE_UNCERTAINTY,
]);

function riskObservation(changeRisk, evidenceRefs = ['assessment:checkout-validation']) {
  return {
    kind: OBSERVATION.CHANGE_RISK_ASSESSED,
    evidenceRefs,
    changeRisk,
  };
}

function changeRiskFacts(facts) {
  return facts.filter((fact) => CHANGE_RISK_FACT_KINDS.has(fact.kind));
}

function changeRiskValues(facts) {
  return Object.fromEntries(changeRiskFacts(facts).map((fact) => [fact.kind, fact.value]));
}

test('explicit change-risk assessment projects five evidence-bearing facts', () => {
  const facts = deriveSoftwareFacts({
    message: 'Update checkout validation behavior.',
    observations: [riskObservation({
      changeKind: 'behavioral',
      blastRadius: 'component',
      externalEffect: 'external',
      reversibility: 'compensatable',
      uncertainty: 'medium',
    })],
  });

  assert.deepEqual(changeRiskFacts(facts), [
    {
      kind: FACT.CHANGE_KIND,
      value: 'behavioral',
      evidenceRefs: ['assessment:checkout-validation'],
    },
    {
      kind: FACT.CHANGE_BLAST_RADIUS,
      value: 'component',
      evidenceRefs: ['assessment:checkout-validation'],
    },
    {
      kind: FACT.CHANGE_EXTERNAL_EFFECT,
      value: 'external',
      evidenceRefs: ['assessment:checkout-validation'],
    },
    {
      kind: FACT.CHANGE_REVERSIBILITY,
      value: 'compensatable',
      evidenceRefs: ['assessment:checkout-validation'],
    },
    {
      kind: FACT.CHANGE_UNCERTAINTY,
      value: 'medium',
      evidenceRefs: ['assessment:checkout-validation'],
    },
  ]);
});

test('change-risk assessment rejects incomplete and invalid public payloads', () => {
  const valid = {
    changeKind: 'behavioral',
    blastRadius: 'component',
    externalEffect: 'external',
    reversibility: 'compensatable',
    uncertainty: 'medium',
  };
  const cases = [
    { label: 'missing field', changeRisk: { changeKind: 'behavioral' }, expected: /changeRisk\.blastRadius/u },
    { label: 'unknown enum', changeRisk: { ...valid, uncertainty: 'certain' }, expected: /changeRisk\.uncertainty/u },
    { label: 'non-object assessment', changeRisk: 'local', expected: /changeRisk must be an object/u },
    { label: 'missing evidence', changeRisk: valid, evidenceRefs: [], expected: /requires evidenceRefs/u },
  ];

  for (const scenario of cases) {
    assert.throws(
      () => evaluateSoftwareRequest({ observations: [riskObservation(scenario.changeRisk, scenario.evidenceRefs)] }),
      scenario.expected,
      scenario.label,
    );
  }
});

test('structured assessments retain supplied values without prose classification', () => {
  const cases = [
    {
      assessment: {
        changeKind: 'structural', blastRadius: 'local', externalEffect: 'none', reversibility: 'reversible', uncertainty: 'low',
      },
      expected: ['structural', 'local', 'none', 'reversible', 'low'],
    },
    {
      assessment: {
        changeKind: 'dependency', blastRadius: 'system', externalEffect: 'external', reversibility: 'irreversible', uncertainty: 'high',
      },
      expected: ['dependency', 'system', 'external', 'irreversible', 'high'],
    },
    {
      assessment: {
        changeKind: 'data', blastRadius: 'unknown', externalEffect: 'unknown', reversibility: 'unknown', uncertainty: 'high',
      },
      expected: ['data', 'unknown', 'unknown', 'unknown', 'high'],
    },
  ];

  for (const scenario of cases) {
    const facts = deriveSoftwareFacts({ observations: [riskObservation(scenario.assessment)] });
    assert.deepEqual(Object.values(changeRiskValues(facts)), scenario.expected);
  }
});

test('Phase 3 change-risk facts do not select a capability or Provider', () => {
  const request = { message: 'Update checkout validation behavior.' };
  const withoutRisk = evaluateSoftwareRequest(request);
  const withRisk = evaluateSoftwareRequest({
    ...request,
    observations: [riskObservation({
      changeKind: 'dependency',
      blastRadius: 'system',
      externalEffect: 'destructive',
      reversibility: 'irreversible',
      uncertainty: 'high',
    })],
  });

  assert.deepEqual(withRisk.decision, withoutRisk.decision);
});

test('workflow JSON round trip preserves structured observations and derived facts', () => {
  const request = {
    message: 'Update checkout validation behavior.',
    observations: [riskObservation({
      changeKind: 'behavioral',
      blastRadius: 'component',
      externalEffect: 'internal',
      reversibility: 'compensatable',
      uncertainty: 'medium',
    })],
  };
  const workflow = startSoftwareWorkflow({
    workflowActivationId: 'workflow-change-risk-round-trip',
    workItemKey: 'change-risk-round-trip',
    request,
  });
  const roundTripped = JSON.parse(JSON.stringify(workflow));

  assert.deepEqual(roundTripped.request, { ...request, explicitIntent: null });
  assert.deepEqual(
    changeRiskFacts(evaluateSoftwareRequest(roundTripped.request).facts),
    changeRiskFacts(roundTripped.facts),
  );
});

test('risk-looking prose alone does not create structured change-risk facts', () => {
  const facts = deriveSoftwareFacts({
    message: 'This is a high-risk irreversible external production change with uncertain blast radius.',
  });

  assert.deepEqual(changeRiskFacts(facts), []);
});
