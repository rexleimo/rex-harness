import assert from 'node:assert/strict';
import test from 'node:test';
import { advanceSoftwareWorkflow, startSoftwareWorkflow, normalizeRequirementsDecision } from '../../src/index.mjs';
import { REQUIREMENTS_DECISION_FIXTURE } from '../fixtures/requirements-decision.mjs';

function readyDecision() {
  return {
    ...structuredClone(REQUIREMENTS_DECISION_FIXTURE),
    readiness: {
      status: 'ready',
      decisions: [
        { id: 'scope', dependsOn: [], status: 'resolved', impact: 'critical', rationale: 'Use the existing public checkout boundary', evidenceRefs: ['artifact:scope-decision'] },
        { id: 'failure', dependsOn: ['scope'], status: 'resolved', impact: 'critical', rationale: 'Reject invalid input without changing stored state', evidenceRefs: ['artifact:failure-decision'] },
      ],
      walkthroughs: { happyPath: ['artifact:checkout-walkthrough'], failurePath: ['artifact:checkout-failure-path'] },
      feasibility: { status: 'supported', evidenceRefs: ['artifact:checkout-code-inspection'] },
      alignment: { status: 'confirmed', evidenceRefs: ['intent:accepted-checkout-scope'] },
    },
  };
}

function start() {
  return startSoftwareWorkflow({
    workflowActivationId: 'workflow-readiness', workItemKey: 'readiness',
    request: { message: 'Clarify checkout before implementing', explicitIntent: 'grill' },
  });
}

function evidence(decision) {
  return [
    { kind: 'assumptions-recorded', refs: ['artifact:declared-defaults'] },
    { kind: 'first-slice-identified', refs: ['artifact:checkout-slice'] },
    { kind: 'requirements-decision-recorded', refs: [decision.decisionRef] },
  ];
}

function submit(decision, workflow = start()) {
  return advanceSoftwareWorkflow(workflow, evidence(decision), { requirementsDecision: decision });
}

test('legacy requirements remain readable but cannot unlock a new clarification submission', () => {
  const legacy = structuredClone(REQUIREMENTS_DECISION_FIXTURE);
  delete legacy.readiness;
  assert.equal(normalizeRequirementsDecision(legacy).decisionRef, legacy.decisionRef);
  const result = submit(legacy);
  assert.equal(result.outcome, 'blocked');
  assert.equal(result.blockedReason, 'requirements-readiness-required');
  assert.equal(result.completedActivation, null);
  assert.equal(result.workflow.currentActivation.stageId, 'clarify');
});

test('all evidence kinds and exhausted question budget cannot override a blocked decision', () => {
  const decision = readyDecision();
  decision.readiness.status = 'blocked';
  decision.readiness.decisions[1].status = 'open';
  decision.readiness.feasibility.status = 'unknown';
  const workflow = start();
  const result = submit(decision, workflow);
  assert.equal(result.outcome, 'blocked');
  assert.equal(result.blockedReason, 'requirements-not-ready');
  assert.equal(result.workflow.currentCommand, workflow.currentCommand);
  assert.equal(result.nextCapability, null);
  assert.deepEqual(result.missingEvidence, ['requirements-decision-recorded']);
});

test('ready conclusion needs closed dependencies, supported feasibility and alignment', () => {
  const cases = [
    (r) => { r.decisions[1].status = 'open'; },
    (r) => { r.decisions[1].status = 'assumed'; },
    (r) => { r.decisions[1].dependsOn = ['missing']; },
    (r) => { r.decisions[0].dependsOn = ['failure']; },
    (r) => { r.walkthroughs.failurePath = []; },
    (r) => { r.feasibility.status = 'unknown'; },
    (r) => { r.feasibility.evidenceRefs = []; },
    (r) => { r.decisions.push(structuredClone(r.decisions[0])); },
    (r) => { r.decisions[1].evidenceRefs = ['bare-path']; },
    (r) => { r.decisions[1].rationale = ''; },
    (r) => { r.decisions[1].unexpected = true; },
    (r) => { r.alignment.status = 'pending'; },
  ];
  for (const mutate of cases) {
    const decision = readyDecision();
    mutate(decision.readiness);
    assert.throws(() => normalizeRequirementsDecision(decision), /readiness/u);
  }
});

test('supported complete reasoning permits progression with an explicit low-impact default', () => {
  const decision = readyDecision();
  decision.readiness.decisions.push({
    id: 'report-order', dependsOn: ['scope'], status: 'assumed', impact: 'low',
    rationale: 'Use newest-first ordering; reversible presentation choice', evidenceRefs: ['artifact:report-order-default'],
  });
  const result = submit(decision);
  assert.equal(result.outcome, 'completed');
  assert.equal(result.workflow.currentCommand.provider.id, 'rex-test-design');
  assert.deepEqual(result.workflow.requirementsDecision.readiness, decision.readiness);
});

test('readiness cannot smuggle an unresolvable probe receipt into a ready decision', () => {
  const decision = readyDecision();
  decision.readiness.feasibility.evidenceRefs = ['receipt:unrecorded-probe'];
  assert.throws(() => submit(decision), /receipt resolver/u);
  assert.throws(() => advanceSoftwareWorkflow(start(), evidence(decision), {
    requirementsDecision: decision, resolveReceipt: () => null,
  }), /unknown execution receipt/u);
  assert.throws(() => startSoftwareWorkflow({
    workflowActivationId: 'workflow-readiness-receipt-bypass',
    request: { explicitIntent: 'implement', requirementsDecision: decision },
    resolveReceipt: () => null,
  }), /unknown execution receipt/u);
});

test('historical in-progress clarification can add readiness without rewriting its accepted scope', () => {
  const decision = readyDecision();
  const legacy = structuredClone(decision);
  delete legacy.readiness;
  const workflow = { ...start(), requirementsDecision: legacy };
  assert.equal(submit(decision, workflow).outcome, 'completed');
  decision.acceptanceCriteria = ['different user behavior'];
  assert.throws(() => submit(decision, workflow), /already recorded/u);
});

test('new request cannot bypass clarification with a pre-recorded legacy decision', () => {
  const legacy = structuredClone(REQUIREMENTS_DECISION_FIXTURE);
  delete legacy.readiness;
  assert.throws(() => startSoftwareWorkflow({
    workflowActivationId: 'workflow-readiness-bypass',
    request: { explicitIntent: 'implement', requirementsDecision: legacy },
  }), /requirements-readiness-required/u);
});

test('a saved ready decision supports later partial evidence without inventing new approval', () => {
  const decision = readyDecision();
  const partial = advanceSoftwareWorkflow(start(), [evidence(decision)[2]], { requirementsDecision: decision });
  assert.equal(partial.outcome, 'blocked');
  const result = advanceSoftwareWorkflow(partial.workflow, evidence(decision).slice(0, 2));
  assert.equal(result.outcome, 'completed');
  assert.equal(result.workflow.requirementsDecision.readiness.alignment.evidenceRefs[0], 'intent:accepted-checkout-scope');
});
