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
  observations: [
    {
      kind: 'change.behavior-requested',
      evidenceRefs: ['artifact:requirements-decision-test'],
    },
  ],
});
