import { CAPABILITY } from '../../domain/capability-ids.mjs';
import { FACT } from '../../domain/fact-kinds.mjs';
import { findFact } from '../../domain/facts.mjs';

// 行为变更必须先取得测试范围证据；宿主给出的 implementation-ready
// 只能表示切片可执行，不能绕过测试设计。非行为型任务仍可直接实施。
export const implementationCapability = Object.freeze({
  id: CAPABILITY.IMPLEMENTATION_EXECUTE,
  description: 'Implement one approved vertical slice without widening its agreed behavior.',
  priority: 55,
  exclusiveGroup: 'software-process',
  requiredEvidence: Object.freeze(['implementation-diff-recorded', 'focused-tests-pass']),
  recipe: Object.freeze({
    id: 'software.implementation.execute.recipe',
    stages: Object.freeze([Object.freeze({
      id: 'implement',
      objective: '实现一个已经批准的纵向切片，并运行聚焦验证。',
      requiredEvidence: Object.freeze(['implementation-diff-recorded', 'focused-tests-pass']),
    })]),
  }),
  activate(facts) {
    const ready = findFact(facts, FACT.IMPLEMENTATION_READY);
    if (!ready) return null;
    if (findFact(facts, FACT.BEHAVIOR_CHANGE) && !findFact(facts, FACT.TEST_SCOPE_CONFIRMED)) {
      return null;
    }
    return ready;
  },
});
