// Fact 描述已经观察到的软件工程状态，而不是对任务规模的主观猜测。
// AIOS 必须先附上证据引用，rex-harness 才会评估这些 Fact。
export const FACT = Object.freeze({
  ACCEPTANCE_CRITERIA_MISSING: 'acceptance-criteria-missing',
  DOMAIN_VOCABULARY_AMBIGUOUS: 'domain-vocabulary-ambiguous',
  DESIGN_DECISION_BLOCKED: 'design-decision-blocked',
  DEPENDENT_WORK_ITEMS: 'dependent-work-items',
  BEHAVIOR_CHANGE: 'behavior-change',
  TEST_SCOPE_CONFIRMED: 'test-scope-confirmed',
  HONEST_RED_CANDIDATE: 'honest-red-candidate',
  BEHAVIOR_PRESERVING_HARDENING: 'behavior-preserving-hardening',
  HIGH_RISK_BOUNDARY: 'high-risk-boundary',
  REGRESSION_OBSERVED: 'regression-observed',
  EXECUTION_FAILED: 'execution-failed',
  NEW_CONSTRUCT_PROPOSED: 'new-construct-proposed',
  IMPLEMENTATION_READY: 'implementation-ready',
  DIFF_READY: 'diff-ready',
  SPECIALIST_REVIEW_REQUIRED: 'specialist-review-required',
  PATH_UNKNOWN: 'path-unknown',
  INDEPENDENT_WORKSTREAMS: 'independent-workstreams',
  CONTINUITY_REQUIRED: 'continuity-required',
});
