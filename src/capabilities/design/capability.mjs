import { CAPABILITY } from '../../domain/capability-ids.mjs';
import { FACT } from '../../domain/fact-kinds.mjs';
import { findFact } from '../../domain/facts.mjs';

// 只有明确存在被阻塞的设计决策时才激活设计能力，
// 不能因为请求很长或代码陌生就自动进入设计流程。
export const designCapability = Object.freeze({
  id: CAPABILITY.DESIGN_RESOLVE,
  description: 'Resolve a consequential design choice before implementation commits to it.',
  priority: 75,
  exclusiveGroup: 'software-process',
  requiredEvidence: Object.freeze(['decision-recorded', 'tradeoffs-recorded', 'rejected-options-recorded']),
  recipe: Object.freeze({
    id: 'software.design.resolve.recipe',
    stages: Object.freeze([Object.freeze({
      id: 'resolve',
      objective: '比较关键设计选项并记录可执行的选择。',
      requiredEvidence: Object.freeze(['decision-recorded', 'tradeoffs-recorded', 'rejected-options-recorded']),
    })]),
  }),
  activate(facts) {
    return findFact(facts, FACT.DESIGN_DECISION_BLOCKED);
  },
});
