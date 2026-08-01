import { createRexCapabilityPack } from './kernel/capability-pack.mjs';
import { FACT } from './domain/fact-kinds.mjs';
import { findFact, findFactValue, normalizeFacts } from './domain/facts.mjs';
import {
  EXPLICIT_INTENT,
  EXPLICIT_INTENT_MATRIX,
} from './domain/explicit-intent.mjs';

/**
 * 根据当前 Fact 集合选择一个下一步软件工程能力。
 * 实际执行和证据收集仍由宿主负责；这里返回语义决策及可由宿主覆盖的默认 Provider 提示。
 */
export function decideNextCapability(facts, { profile = 'default', completedCapabilities = [] } = {}) {
  const normalizedFacts = normalizeFacts(facts);
  const completed = new Set(completedCapabilities);
  const pack = createRexCapabilityPack({ profile });
  const enabled = new Set(pack.profile.enabledCapabilities);
  const bindings = new Map(pack.providerBindings.map((binding) => [binding.capabilityId, binding.provider]));
  const unknownIntent = findFact(normalizedFacts, FACT.EXPLICIT_INTENT_UNKNOWN);
  if (unknownIntent) {
    return Object.freeze({
      blocked: true,
      blockedReason: 'explicit-intent-unknown',
      reasonCode: unknownIntent.kind,
      evidenceRefs: unknownIntent.evidenceRefs,
      capabilityId: '',
      recipeId: '',
      stageId: '',
      requiredEvidence: Object.freeze([]),
      provider: null,
    });
  }
  const intent = findFact(normalizedFacts, FACT.EXPLICIT_INTENT)?.value || '';
  const intentEntry = EXPLICIT_INTENT_MATRIX[intent] || null;
  if (intentEntry && intent === EXPLICIT_INTENT.REVIEW && !findFact(normalizedFacts, FACT.DIFF_READY)) {
    return Object.freeze({
      blocked: true,
      blockedReason: 'review-requires-diff',
      reasonCode: intentEntry.reasonCode,
      evidenceRefs: intentEntry.evidenceRefs,
      capabilityId: intentEntry.capabilityId,
      recipeId: '',
      stageId: '',
      requiredEvidence: Object.freeze([]),
      provider: null,
    });
  }
  if (intentEntry && intent === EXPLICIT_INTENT.DEBUG && !findFact(normalizedFacts, FACT.EXECUTION_FAILED)) {
    return Object.freeze({
      blocked: true,
      blockedReason: 'debug-requires-reproducible-failure',
      reasonCode: intentEntry.reasonCode,
      evidenceRefs: intentEntry.evidenceRefs,
      capabilityId: intentEntry.capabilityId,
      recipeId: '',
      stageId: '',
      requiredEvidence: Object.freeze([]),
      provider: null,
    });
  }

  if (intentEntry && intent === EXPLICIT_INTENT.REVIEW && findFact(normalizedFacts, FACT.DIFF_READY)) {
    const capability = pack.capabilities.find((candidate) => candidate.id === intentEntry.capabilityId);
    if (capability && enabled.has(capability.id) && !completed.has(capability.id)) {
      const diffFact = findFact(normalizedFacts, FACT.DIFF_READY);
      return Object.freeze({
        capabilityId: capability.id,
        reasonCode: intentEntry.reasonCode,
        evidenceRefs: Object.freeze([...new Set([
          ...intentEntry.evidenceRefs,
          ...(diffFact?.evidenceRefs || []),
        ])]),
        requiredEvidence: capability.requiredEvidence,
        recipeId: capability.recipe.id,
        stageId: capability.recipe.stages[0].id,
        provider: bindings.get(capability.id),
      });
    }
  }

  // 排除已完成的能力后，调用方可以反复评估同一组 Fact，
  // 每次只推进一个适用的工程控制，避免同时注入整条工作流。
  const candidates = pack.capabilities
    .filter((capability) => enabled.has(capability.id) && !completed.has(capability.id))
    .map((capability) => ({
      capability,
      trigger: capability.activate(normalizedFacts, { completedCapabilities: completed }),
    }))
    .filter((candidate) => candidate.trigger)
    // priority 表达安全先后顺序；当两个能力有意使用相同优先级时，
    // 再用 ID 排序，保证不同运行之间仍得到确定性结果。
    .sort((left, right) => right.capability.priority - left.capability.priority
      || left.capability.id.localeCompare(right.capability.id));

  if (candidates.length === 0) return null;
  const { capability, trigger } = candidates[0];
  const explicitTrigger = intentEntry
    && trigger.evidenceRefs.includes(`intent:${intent}`)
    ? intentEntry
    : null;
  return Object.freeze({
    capabilityId: capability.id,
    reasonCode: explicitTrigger?.reasonCode || trigger.kind,
    evidenceRefs: Object.freeze([
      ...new Set([
        ...trigger.evidenceRefs,
        ...(explicitTrigger?.evidenceRefs || []),
      ]),
    ]),
    requiredEvidence: capability.requiredEvidence,
    recipeId: capability.recipe.id,
    stageId: capability.recipe.stages[0].id,
    provider: bindings.get(capability.id),
  });
}

/**
 * 只向宿主请求运行时升级，不在 rex-harness 内部启动 Team 或 Harness。
 * 当两种 Fact 同时存在时优先 continuity，因为可恢复性属于运行时硬要求；
 * AIOS 仍然可以在可恢复运行内部协调并行工作。
 */
export function decidePromotion(facts) {
  const normalizedFacts = normalizeFacts(facts);
  const continuity = normalizedFacts.find((fact) => fact.kind === FACT.CONTINUITY_REQUIRED);
  if (continuity) {
    return Object.freeze({ target: 'harness', reasonCode: continuity.kind, evidenceRefs: continuity.evidenceRefs });
  }
  const independent = normalizedFacts.find((fact) => fact.kind === FACT.INDEPENDENT_WORKSTREAMS);
  if (independent) {
    return Object.freeze({ target: 'team', reasonCode: independent.kind, evidenceRefs: independent.evidenceRefs });
  }
  return null;
}
