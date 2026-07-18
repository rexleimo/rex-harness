/** 构造 AIOS 可执行、但不包含进程和客户端细节的当前阶段命令。 */
export function createProviderCommand({ activation, stage, provider }) {
  if (!provider) throw new Error(`missing provider binding for ${activation.capabilityId}`);
  return Object.freeze({
    schemaVersion: 1,
    type: 'provider.invoke',
    activationId: activation.activationId,
    capabilityId: activation.capabilityId,
    recipeId: activation.recipeId,
    stageId: stage.id,
    reasonCode: activation.reasonCode,
    triggerEvidenceRefs: Object.freeze([...(activation.triggerEvidenceRefs || [])]),
    provider: Object.freeze({ ...provider }),
    objective: stage.objective,
    expectedEvidence: Object.freeze([...stage.requiredEvidence]),
  });
}
