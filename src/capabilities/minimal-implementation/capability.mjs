import { CAPABILITY } from '../../domain/capability-ids.mjs';
import { FACT } from '../../domain/fact-kinds.mjs';
import { findFact } from '../../domain/facts.mjs';

// 最小构造门在增加新结构之前执行，但安全顺序仍低于
// 需求澄清、根因调试和高风险控制。
export const minimalImplementationCapability = Object.freeze({
  id: CAPABILITY.IMPLEMENTATION_MINIMIZE,
  description: 'Choose the smallest correct response before adding a construct to the codebase.',
  priority: 60,
  exclusiveGroup: 'software-process',
  requiredEvidence: Object.freeze(['reuse-ladder-evaluated', 'minimal-option-recorded']),
  recipe: Object.freeze({
    id: 'software.implementation.minimize.recipe',
    stages: Object.freeze([Object.freeze({
      id: 'minimize',
      objective: '按复用阶梯比较选项，并记录满足目标的最小实现方式。',
      requiredEvidence: Object.freeze(['reuse-ladder-evaluated', 'minimal-option-recorded']),
    })]),
  }),
  activate(facts) {
    return findFact(facts, FACT.NEW_CONSTRUCT_PROPOSED);
  },
});
