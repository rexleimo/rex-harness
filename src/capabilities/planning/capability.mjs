import { CAPABILITY } from '../../domain/capability-ids.mjs';
import { FACT } from '../../domain/fact-kinds.mjs';
import { findFact } from '../../domain/facts.mjs';

// 规划能力只处理存在依赖关系的工作项。
// 提示词很长本身不能证明需要建立执行图。
export const planningCapability = Object.freeze({
  id: CAPABILITY.PLANNING_SEQUENCE,
  description: 'Create an ordered work graph only when execution dependencies require one.',
  priority: 70,
  exclusiveGroup: 'software-process',
  requiredEvidence: Object.freeze(['dependency-graph-recorded', 'step-verification-recorded']),
  recipe: Object.freeze({
    id: 'software.planning.sequence.recipe',
    stages: Object.freeze([Object.freeze({
      id: 'sequence',
      objective: '建立有依赖关系的执行图，并为每一步指定验证证据。',
      requiredEvidence: Object.freeze(['dependency-graph-recorded', 'step-verification-recorded']),
    })]),
  }),
  activate(facts) {
    return findFact(facts, FACT.DEPENDENT_WORK_ITEMS);
  },
});
