import { createRexCapabilityPack } from '../kernel/capability-pack.mjs';
import { createActivation } from '../domain/activations.mjs';
import { createProviderCommand } from '../domain/commands.mjs';

function findCapability(pack, capabilityId) {
  const capability = pack.capabilities.find((item) => item.id === capabilityId);
  if (!capability) throw new Error(`unknown capability: ${capabilityId}`);
  return capability;
}

function resolveProvider(pack, capabilityId, providerBindings = []) {
  const bindings = new Map(pack.providerBindings.map((binding) => [binding.capabilityId, binding.provider]));
  for (const binding of providerBindings) {
    if (binding?.capabilityId && binding?.provider) bindings.set(binding.capabilityId, binding.provider);
  }
  return bindings.get(capabilityId);
}

export function startActivation(decision, {
  activationId,
  profile = 'default',
} = {}) {
  if (!decision?.capabilityId) throw new TypeError('startActivation requires a capability decision');
  const pack = createRexCapabilityPack({ profile });
  const capability = findCapability(pack, decision.capabilityId);
  const firstStage = capability.recipe.stages[0];
  return createActivation({
    activationId,
    capabilityId: capability.id,
    recipeId: capability.recipe.id,
    stageId: firstStage.id,
    reasonCode: decision.reasonCode,
    triggerEvidenceRefs: decision.evidenceRefs,
  });
}

export function nextCommand(activation, {
  profile = 'default',
  providerBindings = [],
} = {}) {
  if (!activation || activation.status === 'completed') return null;
  const pack = createRexCapabilityPack({ profile });
  const capability = findCapability(pack, activation.capabilityId);
  if (activation.recipeId !== capability.recipe.id) {
    throw new Error(`activation recipe mismatch: ${activation.recipeId}`);
  }
  const stage = capability.recipe.stages[activation.stageIndex];
  if (!stage) return null;
  return createProviderCommand({
    activation,
    stage,
    provider: resolveProvider(pack, capability.id, providerBindings),
  });
}

export function capabilityForActivation(activation, { profile = 'default' } = {}) {
  return findCapability(createRexCapabilityPack({ profile }), activation.capabilityId);
}
