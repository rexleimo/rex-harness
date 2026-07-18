function text(value) {
  return String(value || '').trim();
}

function refs(values = []) {
  return Object.freeze([...new Set(values.map((value) => text(value)).filter(Boolean))]);
}

// Activation 只保存可恢复的语义状态；Provider 解析留给每次生成 Command 时完成，
// 因而宿主可以在恢复后替换 Provider，而不必迁移历史状态。
export function createActivation({
  activationId,
  capabilityId,
  recipeId,
  stageId,
  reasonCode = '',
  triggerEvidenceRefs = [],
} = {}) {
  const id = text(activationId);
  if (!id) throw new TypeError('startActivation requires activationId from the host');
  if (!text(capabilityId)) throw new TypeError('activation requires capabilityId');
  if (!text(recipeId)) throw new TypeError('activation requires recipeId');
  if (!text(stageId)) throw new TypeError('activation requires stageId');

  return Object.freeze({
    schemaVersion: 1,
    activationId: id,
    capabilityId: text(capabilityId),
    recipeId: text(recipeId),
    reasonCode: text(reasonCode),
    triggerEvidenceRefs: refs(triggerEvidenceRefs),
    status: 'active',
    stageIndex: 0,
    stageId: text(stageId),
    completedStages: Object.freeze([]),
    evidence: Object.freeze([]),
  });
}

export function updateActivation(activation, patch = {}) {
  return Object.freeze({
    ...activation,
    ...patch,
    triggerEvidenceRefs: refs(patch.triggerEvidenceRefs || activation.triggerEvidenceRefs || []),
    completedStages: Object.freeze([...(patch.completedStages || activation.completedStages || [])]),
    evidence: Object.freeze([...(patch.evidence || activation.evidence || [])]),
  });
}
