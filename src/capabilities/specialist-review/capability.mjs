import { CAPABILITY } from '../../domain/capability-ids.mjs';
import { FACT } from '../../domain/fact-kinds.mjs';
import { createCapabilityTrigger, findFact } from '../../domain/facts.mjs';

// Specialist Review 不是默认执行的角色表演；它同时要求存在可审查代码，
// 并且已经识别出足以承担专项成本的明确风险领域。
export const specialistReviewCapability = Object.freeze({
  id: CAPABILITY.REVIEW_SPECIALIST,
  description: 'Request one evidence-backed specialist review for an identified risk domain.',
  priority: 85,
  exclusiveGroup: 'software-process',
  requiredEvidence: Object.freeze(['specialist-scope-recorded', 'specialist-verdict-recorded']),
  recipe: Object.freeze({
    id: 'software.review.specialist.recipe',
    stages: Object.freeze([Object.freeze({
      id: 'review-risk',
      objective: '针对已识别的风险领域执行一次有范围、有证据的专项审查。',
      requiredEvidence: Object.freeze(['specialist-scope-recorded', 'specialist-verdict-recorded']),
    })]),
  }),
  activate(facts) {
    const diff = findFact(facts, FACT.DIFF_READY);
    if (!diff) return null;
    const specialist = findFact(facts, FACT.SPECIALIST_REVIEW_REQUIRED);
    return createCapabilityTrigger({ reason: specialist, prerequisites: [diff] });
  },
});
