import { CAPABILITY } from '../../domain/capability-ids.mjs';
import { FACT } from '../../domain/fact-kinds.mjs';
import { findFact, findFactValue } from '../../domain/facts.mjs';

// 需求澄清由 LLM 语义判断触发（grill/spec intent）或执行中领域词汇歧义
// observation 触发，不再用正则从请求措辞推断验收标准缺失。
// 澄清可发生在任意阶段边界：执行中遇到决策点即可插入，澄清完成后继续原 Capability。
export const requirementsCapability = Object.freeze({
  id: CAPABILITY.REQUIREMENTS_CLARIFY,
  description: 'Clarify observable behavior without creating a second implementation plan.',
  priority: 80,
  exclusiveGroup: 'software-process',
  requiredEvidence: Object.freeze([
    // 收敛组：验收标准或假设记录二选一，为澄清会话提供时间盒出口，防止无限询问。
    Object.freeze({ anyOf: Object.freeze(['acceptance-criteria-recorded', 'assumptions-recorded']) }),
    Object.freeze({ anyOf: Object.freeze(['non-goals-recorded', 'assumptions-recorded']) }),
    'first-slice-identified',
    'requirements-decision-recorded',
  ]),
  recipe: Object.freeze({
    id: 'software.requirements.clarify.recipe',
    stages: Object.freeze([Object.freeze({
      id: 'clarify',
      objective: '澄清可观察行为、非目标与第一个可交付切片；未决项可记录为假设收敛。',
      requiredEvidence: Object.freeze([
        Object.freeze({ anyOf: Object.freeze(['acceptance-criteria-recorded', 'assumptions-recorded']) }),
        Object.freeze({ anyOf: Object.freeze(['non-goals-recorded', 'assumptions-recorded']) }),
        'first-slice-identified',
        'requirements-decision-recorded',
      ]),
    })]),
  }),
  activate(facts) {
    return findFact(facts, FACT.DOMAIN_VOCABULARY_AMBIGUOUS)
      || findFactValue(facts, FACT.EXPLICIT_INTENT, 'grill', 'spec');
  },
});
