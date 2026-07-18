import { CAPABILITY } from '../../domain/capability-ids.mjs';
import { FACT } from '../../domain/fact-kinds.mjs';
import { createCapabilityTrigger, findFact } from '../../domain/facts.mjs';

// 基础 TDD 是所有行为变更的质量不变量。只有测试范围已经由独立
// Activation 确认后才允许进入 RED，避免 Agent 用实现反推测试目标。
export const tddCapability = Object.freeze({
  id: CAPABILITY.TESTING_TDD,
  description: 'Implement an ordinary behavior change through a scope-bound red-green-refactor cycle.',
  priority: 60,
  exclusiveGroup: 'software-process',
  requiredEvidence: Object.freeze([
    'failing-test-observed',
    'red-failure-reason-recorded',
    'passing-test-observed',
    'implementation-diff-recorded',
    'refactor-check-recorded',
    'test-diff-review-recorded',
  ]),
  recipe: Object.freeze({
    id: 'software.testing.tdd.recipe',
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
        objective: '保持测试通过，整理实现并审查测试差异没有弱化用户行为约束。',
        requiredEvidence: Object.freeze([
          'refactor-check-recorded',
          'test-diff-review-recorded',
        ]),
      }),
    ]),
  }),
  activate(facts) {
    const behavior = findFact(facts, FACT.BEHAVIOR_CHANGE);
    const scope = findFact(facts, FACT.TEST_SCOPE_CONFIRMED);
    return createCapabilityTrigger({ reason: scope, prerequisites: [behavior] });
  },
});
