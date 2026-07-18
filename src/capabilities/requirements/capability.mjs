import { CAPABILITY } from '../../domain/capability-ids.mjs';
import { FACT } from '../../domain/fact-kinds.mjs';
import { findFact } from '../../domain/facts.mjs';

// 需求澄清优先于设计和规划，避免下游工作把尚未解决的
// 验收条件或领域词汇歧义固化进实现。
export const requirementsCapability = Object.freeze({
  id: CAPABILITY.REQUIREMENTS_CLARIFY,
  description: 'Clarify observable behavior without creating a second implementation plan.',
  priority: 80,
  exclusiveGroup: 'software-process',
  requiredEvidence: Object.freeze([
    'acceptance-criteria-recorded',
    'non-goals-recorded',
    'first-slice-identified',
  ]),
  recipe: Object.freeze({
    id: 'software.requirements.clarify.recipe',
    stages: Object.freeze([Object.freeze({
      id: 'clarify',
      objective: '澄清可观察行为、非目标与第一个可交付切片。',
      requiredEvidence: Object.freeze([
        'acceptance-criteria-recorded',
        'non-goals-recorded',
        'first-slice-identified',
      ]),
    })]),
  }),
  activate(facts) {
    return findFact(facts, FACT.ACCEPTANCE_CRITERIA_MISSING, FACT.DOMAIN_VOCABULARY_AMBIGUOUS);
  },
});
