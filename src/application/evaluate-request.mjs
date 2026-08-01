import { decideNextCapability, decidePromotion } from '../composition-root.mjs';
import { deriveSoftwareFacts } from './derive-facts.mjs';
import { normalizeRequirementsDecision } from '../domain/requirements-decision.mjs';

export function evaluateSoftwareRequest({
  message = '',
  explicitIntent = null,
  observations = [],
  completedCapabilities = [],
  testabilityDecision = null,
  requirementsDecision = null,
  profile = 'default',
} = {}) {
  const normalizedRequirementsDecision = requirementsDecision
    ? normalizeRequirementsDecision(requirementsDecision)
    : null;
  const facts = deriveSoftwareFacts({
    message,
    explicitIntent,
    observations,
    completedCapabilities,
    testabilityDecision,
    requirementsDecision: normalizedRequirementsDecision,
  });
  return Object.freeze({
    facts: Object.freeze(facts),
    requirementsDecision: normalizedRequirementsDecision,
    decision: decideNextCapability(facts, { profile, completedCapabilities }),
    promotion: decidePromotion(facts),
  });
}
