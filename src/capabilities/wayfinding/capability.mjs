import { CAPABILITY } from '../../domain/capability-ids.mjs';
import { FACT } from '../../domain/fact-kinds.mjs';
import { findFact } from '../../domain/facts.mjs';

// Wayfinding 用于梳理未知执行路径，
// 但会在生成第二份计划或开始改代码之前主动停止。
export const wayfindingCapability = Object.freeze({
  id: CAPABILITY.NAVIGATION_WAYFIND,
  description: 'Map decisions when the destination is known but no executable next slice is visible.',
  // 未知路径必须先形成可执行切片，再决定是否需要依赖计划。
  priority: 72,
  exclusiveGroup: 'software-process',
  requiredEvidence: Object.freeze(['destination-recorded', 'decision-map-recorded', 'next-slice-identified']),
  recipe: Object.freeze({
    id: 'software.navigation.wayfind.recipe',
    stages: Object.freeze([Object.freeze({
      id: 'map',
      objective: '记录目标和关键决策，直到出现一个可执行的下一切片。',
      requiredEvidence: Object.freeze(['destination-recorded', 'decision-map-recorded', 'next-slice-identified']),
    })]),
  }),
  activate(facts) {
    return findFact(facts, FACT.PATH_UNKNOWN);
  },
});
