import { designCapability } from '../capabilities/design/capability.mjs';
import { hardeningCapability } from '../capabilities/hardening/capability.mjs';
import { implementationCapability } from '../capabilities/implementation/capability.mjs';
import { minimalImplementationCapability } from '../capabilities/minimal-implementation/capability.mjs';
import { planningCapability } from '../capabilities/planning/capability.mjs';
import { requirementsCapability } from '../capabilities/requirements/capability.mjs';
import { rootCauseDebuggingCapability } from '../capabilities/root-cause-debugging/capability.mjs';
import { specialistReviewCapability } from '../capabilities/specialist-review/capability.mjs';
import { standardsSpecReviewCapability } from '../capabilities/standards-spec-review/capability.mjs';
import { strictTddCapability } from '../capabilities/strict-tdd/capability.mjs';
import { testDesignCapability } from '../capabilities/test-design/capability.mjs';
import { tddCapability } from '../capabilities/tdd/capability.mjs';
import { wayfindingCapability } from '../capabilities/wayfinding/capability.mjs';
import { rexNativeProviderBindings } from '../providers/catalog.mjs';
import { resolveProfile } from '../profiles/index.mjs';

// 这是唯一同时了解语义 Capability 和内置 Provider 的组装点。
// Domain 与 Capability 保持 Provider 无关，宿主只能显式覆盖最终执行绑定。
const CAPABILITIES = Object.freeze([
  requirementsCapability,
  designCapability,
  planningCapability,
  testDesignCapability,
  tddCapability,
  strictTddCapability,
  hardeningCapability,
  rootCauseDebuggingCapability,
  minimalImplementationCapability,
  implementationCapability,
  standardsSpecReviewCapability,
  specialistReviewCapability,
  wayfindingCapability,
]);

/** 构建用于能力选择、运行和检查的不可变 Capability Pack。 */
export function createRexCapabilityPack({ profile = 'default' } = {}) {
  return Object.freeze({
    id: 'rex-harness.software-engineering',
    schemaVersion: 1,
    profile: resolveProfile(profile),
    capabilities: CAPABILITIES,
    providerBindings: rexNativeProviderBindings,
  });
}

/** 检查独立内核所需的结构不变量；Provider 文件可用性由 Doctor 继续验证。 */
export function validateCapabilityPack(pack) {
  const errors = [];
  const capabilityIds = pack.capabilities.map((capability) => capability.id);
  const bindingIds = pack.providerBindings.map((binding) => binding.capabilityId);

  if (new Set(capabilityIds).size !== capabilityIds.length) errors.push('duplicate-capability-id');
  if (new Set(bindingIds).size !== bindingIds.length) errors.push('duplicate-provider-binding');

  for (const capabilityId of pack.profile.enabledCapabilities) {
    if (!capabilityIds.includes(capabilityId)) errors.push(`unknown-profile-capability:${capabilityId}`);
    if (!bindingIds.includes(capabilityId)) errors.push(`missing-provider-binding:${capabilityId}`);
  }
  for (const capability of pack.capabilities) {
    if (!Array.isArray(capability.requiredEvidence) || capability.requiredEvidence.length === 0) {
      errors.push(`missing-evidence-contract:${capability.id}`);
    }
    if (!capability.recipe?.id || !Array.isArray(capability.recipe?.stages) || capability.recipe.stages.length === 0) {
      errors.push(`missing-capability-recipe:${capability.id}`);
      continue;
    }
    const recipeEvidence = new Set(capability.recipe.stages.flatMap((stage) => stage.requiredEvidence || []));
    for (const evidenceKind of capability.requiredEvidence) {
      if (!recipeEvidence.has(evidenceKind)) errors.push(`unmapped-capability-evidence:${capability.id}:${evidenceKind}`);
    }
  }

  return Object.freeze({ valid: errors.length === 0, errors: Object.freeze(errors) });
}
