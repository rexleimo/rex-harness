import { CAPABILITY } from '../../domain/capability-ids.mjs';
import { FACT } from '../../domain/fact-kinds.mjs';
import { findFact } from '../../domain/facts.mjs';

// 已观察到的失败拥有最高优先级，
// 防止在真实原因尚未确定时继续进行猜测式修改。
export const rootCauseDebuggingCapability = Object.freeze({
  id: CAPABILITY.DEBUG_ROOT_CAUSE,
  description: 'Stop speculative edits and establish a root cause for an observed failure.',
  priority: 100,
  exclusiveGroup: 'software-process',
  requiredEvidence: Object.freeze(['failure-reproduced', 'root-cause-evidenced', 'regression-check-recorded']),
  recipe: Object.freeze({
    id: 'software.debug.root-cause.recipe',
    stages: Object.freeze([Object.freeze({
      id: 'diagnose',
      objective: '复现失败、定位根因并定义能够防止回归的检查。',
      requiredEvidence: Object.freeze(['failure-reproduced', 'root-cause-evidenced', 'regression-check-recorded']),
    })]),
  }),
  activate(facts) {
    return findFact(facts, FACT.EXECUTION_FAILED);
  },
});
