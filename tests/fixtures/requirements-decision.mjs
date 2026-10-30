export const REQUIREMENTS_DECISION_FIXTURE = Object.freeze({
  schemaVersion: 1,
  kind: 'rex.requirements-decision.v1',
  decisionRef: 'artifact:requirements-decision-test',
  acceptanceCriteria: ['the public checkout entry returns an observable success response'],
  nonGoals: ['do not change the checkout page layout'],
  firstSlice: {
    outcome: 'the public checkout entry handles the requested behavior',
    verification: 'run the focused checkout behavior test',
  },
  readiness: {
    status: 'ready',
    decisions: [{
      id: 'checkout-scope', dependsOn: [], status: 'resolved', impact: 'critical',
      rationale: 'The accepted request fixes the public entry and observable behavior',
      evidenceRefs: ['artifact:requirements-decision-test'],
    }],
    walkthroughs: {
      happyPath: ['artifact:checkout-happy-path'],
      failurePath: ['artifact:checkout-failure-path'],
    },
    feasibility: { status: 'supported', evidenceRefs: ['artifact:checkout-code-inspection'] },
    alignment: { status: 'confirmed', evidenceRefs: ['intent:accepted-checkout-scope'] },
  },
  observations: [
    {
      kind: 'change.behavior-requested',
      evidenceRefs: ['artifact:requirements-decision-test'],
    },
  ],
});
