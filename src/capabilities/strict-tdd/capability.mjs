import { CAPABILITY } from '../../domain/capability-ids.mjs';
import { FACT } from '../../domain/fact-kinds.mjs';
import { createCapabilityTrigger, findFact } from '../../domain/facts.mjs';

// 严格 TDD 在基础 TDD 之上增加测试强度探针，只用于已确认范围的
// 高风险或回归行为；普通行为仍由基础 TDD 保证质量。
export const strictTddCapability = Object.freeze({
  id: CAPABILITY.TESTING_STRICT_TDD,
  description: 'Apply strict red-green discipline to a high-risk behavior change or regression.',
  priority: 90,
  exclusiveGroup: 'software-process',
  requiredEvidence: Object.freeze([
    'failing-test-observed',
    'red-failure-reason-recorded',
    'passing-test-observed',
    'implementation-diff-recorded',
    'refactor-check-recorded',
    'test-strength-check-recorded',
    'test-diff-review-recorded',
  ]),
  recipe: Object.freeze({
    id: 'software.testing.strict-tdd.recipe',
    stages: Object.freeze([
      Object.freeze({
        id: 'red',
        objective: '运行映射到已确认测试范围的失败测试，并记录与目标行为一致的失败原因。',
        requiredEvidence: Object.freeze([
          'failing-test-observed',
          'red-failure-reason-recorded',
        ]),
      }),
      Object.freeze({
        id: 'green',
        objective: '实施使目标测试通过的最小代码变更，并记录有边界的实现差异。',
        requiredEvidence: Object.freeze([
          'passing-test-observed',
          'implementation-diff-recorded',
        ]),
      }),
      Object.freeze({
        id: 'refactor',
        objective: '整理实现，执行定向测试强度探针，并审查测试差异没有弱化用户行为约束。',
        requiredEvidence: Object.freeze([
          'refactor-check-recorded',
          'test-strength-check-recorded',
          'test-diff-review-recorded',
        ]),
      }),
    ]),
  }),
  activate(facts) {
    const behavior = findFact(facts, FACT.BEHAVIOR_CHANGE);
    const scope = findFact(facts, FACT.TEST_SCOPE_CONFIRMED);
    const redCandidate = findFact(facts, FACT.HONEST_RED_CANDIDATE);
    if (!behavior || !scope || !redCandidate) return null;
    const risk = findFact(facts, FACT.REGRESSION_OBSERVED, FACT.HIGH_RISK_BOUNDARY);
    return createCapabilityTrigger({ reason: risk, prerequisites: [behavior, scope, redCandidate] });
  },
});
