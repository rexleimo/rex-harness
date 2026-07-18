// Observation 是 AIOS 在系统边界提供的原始事实来源；它与 rex 内部
// 用于选择 Capability 的 Fact 分离，避免宿主直接操纵领域路由结果。
export const OBSERVATION = Object.freeze({
  EXECUTION_FAILED: 'execution.failure-observed',
  REGRESSION_OBSERVED: 'test.regression-observed',
  HIGH_RISK_BOUNDARY: 'change.high-risk-boundary',
  NEW_CONSTRUCT_PROPOSED: 'change.new-construct-proposed',
  IMPLEMENTATION_READY: 'implementation.ready',
  DIFF_READY: 'change.diff-ready',
  SPECIALIST_REVIEW_REQUIRED: 'review.specialist-required',
  DEPENDENT_WORK_ITEMS: 'work.dependent-items',
  INDEPENDENT_WORKSTREAMS: 'work.independent-streams',
  CONTINUITY_REQUIRED: 'runtime.continuity-required',
  DESIGN_DECISION_BLOCKED: 'design.decision-blocked',
  PATH_UNKNOWN: 'navigation.path-unknown',
});

export function normalizeObservations(observations = []) {
  if (!Array.isArray(observations)) throw new TypeError('observations must be an array');

  return observations.map((observation, index) => {
    if (!observation || typeof observation !== 'object') {
      throw new TypeError(`observation ${index} must be an object`);
    }
    const kind = String(observation.kind || '').trim();
    if (!kind) throw new TypeError(`observation ${index} requires kind`);
    const evidenceRefs = Array.isArray(observation.evidenceRefs)
      ? observation.evidenceRefs.map((ref) => String(ref).trim()).filter(Boolean)
      : [];
    if (evidenceRefs.length === 0) throw new TypeError(`observation ${kind} requires evidenceRefs`);
    return Object.freeze({ kind, evidenceRefs: Object.freeze(evidenceRefs) });
  });
}

