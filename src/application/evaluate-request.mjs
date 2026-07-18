import { decideNextCapability, decidePromotion } from '../composition-root.mjs';
import { deriveSoftwareFacts } from './derive-facts.mjs';

export function evaluateSoftwareRequest({
  message = '',
  explicitIntent = null,
  observations = [],
  completedCapabilities = [],
  profile = 'default',
} = {}) {
  const facts = deriveSoftwareFacts({ message, explicitIntent, observations, completedCapabilities });
  return Object.freeze({
    facts: Object.freeze(facts),
    decision: decideNextCapability(facts, { profile, completedCapabilities }),
    promotion: decidePromotion(facts),
  });
}

