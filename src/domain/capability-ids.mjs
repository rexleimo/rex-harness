// Capability ID 是稳定的宿主契约。Provider 名称不进入这套词汇，
// 这样调整内置 Provider 时就不需要修改 Fact 和领域语义。
export const CAPABILITY = Object.freeze({
  REQUIREMENTS_CLARIFY: 'software.requirements.clarify',
  DESIGN_RESOLVE: 'software.design.resolve',
  PLANNING_SEQUENCE: 'software.planning.sequence',
  TESTING_DESIGN: 'software.testing.design',
  TESTING_TDD: 'software.testing.tdd',
  TESTING_STRICT_TDD: 'software.testing.strict-tdd',
  TESTING_HARDENING: 'software.testing.hardening',
  DEBUG_ROOT_CAUSE: 'software.debug.root-cause',
  IMPLEMENTATION_MINIMIZE: 'software.implementation.minimize',
  IMPLEMENTATION_EXECUTE: 'software.implementation.execute',
  REVIEW_STANDARDS_SPEC: 'software.review.standards-spec',
  REVIEW_SPECIALIST: 'software.review.specialist',
  NAVIGATION_WAYFIND: 'software.navigation.wayfind',
});
