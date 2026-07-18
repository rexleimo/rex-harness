import { CAPABILITY } from '../domain/capability-ids.mjs';

const DEEP_CAPABILITIES = new Set([
  CAPABILITY.DESIGN_RESOLVE,
  CAPABILITY.PLANNING_SEQUENCE,
  CAPABILITY.TESTING_STRICT_TDD,
  CAPABILITY.DEBUG_ROOT_CAUSE,
  CAPABILITY.REVIEW_SPECIALIST,
]);

const BALANCED_CAPABILITIES = new Set([
  CAPABILITY.REQUIREMENTS_CLARIFY,
  CAPABILITY.TESTING_DESIGN,
  CAPABILITY.TESTING_TDD,
  CAPABILITY.IMPLEMENTATION_EXECUTE,
  CAPABILITY.REVIEW_STANDARDS_SPEC,
  CAPABILITY.NAVIGATION_WAYFIND,
]);

// Fast / Balanced / Deep 只总结实际发生过的 Activation，不参与请求选择。
export function analyzeExecutionProfile(activations = []) {
  const capabilityIds = activations
    .map((activation) => String(activation?.capabilityId || '').trim())
    .filter(Boolean);
  const label = capabilityIds.some((id) => DEEP_CAPABILITIES.has(id))
    ? 'deep'
    : capabilityIds.some((id) => BALANCED_CAPABILITIES.has(id))
      ? 'balanced'
      : 'fast';
  return Object.freeze({ label, capabilityIds: Object.freeze(capabilityIds) });
}
