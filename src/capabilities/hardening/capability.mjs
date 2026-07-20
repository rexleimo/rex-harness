import { CAPABILITY } from '../../domain/capability-ids.mjs';
import { FACT } from '../../domain/fact-kinds.mjs';
import { createCapabilityTrigger, findFact } from '../../domain/facts.mjs';

// 这条路径服务于不新增用户可观察行为的安全加固和重构。它以真实基线
// 和边界验证替代不诚实的 RED，不允许把既有通过测试伪装成失败证据。
export const hardeningCapability = Object.freeze({
  id: CAPABILITY.TESTING_HARDENING,
  description: 'Safely harden behavior-preserving code through real scenario baselines and boundary verification.',
  priority: 70,
  exclusiveGroup: 'software-process',
  requiredEvidence: Object.freeze([
    'baseline-scenario-observed',
    'hardening-diff-recorded',
    'affected-boundary-scenario-observed',
    'hardening-invariants-reviewed',
    'test-diff-review-recorded',
  ]),
  recipe: Object.freeze({
    id: 'software.testing.hardening.recipe',
    stages: Object.freeze([
      Object.freeze({
        id: 'baseline',
        objective: '在独立、可清理环境中运行真实公共场景，记录变更前基线及执行回执。',
        requiredEvidence: Object.freeze(['baseline-scenario-observed']),
      }),
      Object.freeze({
        id: 'harden',
        objective: '实施受限加固，并用受影响边界的真实场景验证行为没有回退。',
        requiredEvidence: Object.freeze([
          'hardening-diff-recorded',
          'affected-boundary-scenario-observed',
        ]),
      }),
      Object.freeze({
        id: 'verify-invariants',
        objective: '审查副作用路径、测试差异和不变量，确认没有弱化行为约束或引入测试专用出口。',
        requiredEvidence: Object.freeze([
          'hardening-invariants-reviewed',
          'test-diff-review-recorded',
        ]),
      }),
    ]),
  }),
  activate(facts) {
    const behavior = findFact(facts, FACT.BEHAVIOR_CHANGE);
    const scope = findFact(facts, FACT.TEST_SCOPE_CONFIRMED);
    const hardening = findFact(facts, FACT.BEHAVIOR_PRESERVING_HARDENING);
    return createCapabilityTrigger({ reason: hardening, prerequisites: [behavior, scope] });
  },
});
