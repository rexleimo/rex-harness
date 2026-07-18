import { CAPABILITY } from '../../domain/capability-ids.mjs';
import { FACT } from '../../domain/fact-kinds.mjs';
import { findFact } from '../../domain/facts.mjs';

// 有边界的 diff 即可进入普通 Review。这里有意使用较低优先级，
// 让必需的专项审查和测试控制先完成。
export const standardsSpecReviewCapability = Object.freeze({
  id: CAPABILITY.REVIEW_STANDARDS_SPEC,
  description: 'Review an implementation independently against repository standards and the originating spec.',
  priority: 40,
  exclusiveGroup: 'software-process',
  requiredEvidence: Object.freeze(['standards-review-recorded', 'spec-review-recorded']),
  recipe: Object.freeze({
    id: 'software.review.standards-spec.recipe',
    stages: Object.freeze([Object.freeze({
      id: 'review',
      objective: '独立对照仓库规范和原始规格审查有边界的代码差异。',
      requiredEvidence: Object.freeze(['standards-review-recorded', 'spec-review-recorded']),
    })]),
  }),
  activate(facts) {
    return findFact(facts, FACT.DIFF_READY);
  },
});
