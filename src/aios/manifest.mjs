/**
 * 将进程内 Capability Pack 投影为可序列化的 AIOS 契约。
 * 这里有意移除 activate 等函数，因为宿主跨越此边界消费的是声明，
 * 而不是可执行闭包。
 */
export function toAiosManifest(pack) {
  return Object.freeze({
    id: pack.id,
    schemaVersion: pack.schemaVersion,
    profile: pack.profile.id,
    capabilities: Object.freeze(pack.capabilities.map((capability) => Object.freeze({
      id: capability.id,
      description: capability.description,
      requiredEvidence: capability.requiredEvidence,
      exclusiveGroup: capability.exclusiveGroup,
      recipe: Object.freeze({
        id: capability.recipe.id,
        stages: Object.freeze(capability.recipe.stages.map((stage) => Object.freeze({
          id: stage.id,
          objective: stage.objective,
          requiredEvidence: stage.requiredEvidence,
        }))),
      }),
    }))),
    providerBindings: pack.providerBindings,
  });
}
