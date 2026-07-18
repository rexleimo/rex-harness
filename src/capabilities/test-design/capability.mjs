import { CAPABILITY } from '../../domain/capability-ids.mjs';
import { FACT } from '../../domain/fact-kinds.mjs';
import { findFact } from '../../domain/facts.mjs';

// 测试范围必须先于任何 RED/GREEN 实现周期确认。
// 风险只决定后续使用基础 TDD 还是严格 TDD，不能跳过本阶段。
export const testDesignCapability = Object.freeze({
  id: CAPABILITY.TESTING_DESIGN,
  description: 'Select public behavior seams and a minimal vertical test slice.',
  priority: 50,
  exclusiveGroup: 'software-process',
  requiredEvidence: Object.freeze([
    'test-scope-contract-recorded',
    'acceptance-test-mapping-recorded',
    'test-seam-recorded',
  ]),
  recipe: Object.freeze({
    id: 'software.testing.design.recipe',
    stages: Object.freeze([Object.freeze({
      id: 'design-tests',
      objective: '确认用户目标、非目标和测试边界，把验收行为映射到公共测试缝。',
      requiredEvidence: Object.freeze([
        'test-scope-contract-recorded',
        'acceptance-test-mapping-recorded',
        'test-seam-recorded',
      ]),
    })]),
  }),
  activate(facts) {
    return findFact(facts, FACT.BEHAVIOR_CHANGE);
  },
});
