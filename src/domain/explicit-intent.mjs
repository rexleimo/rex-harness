import { CAPABILITY } from './capability-ids.mjs';

export const EXPLICIT_INTENT = Object.freeze({
  GRILL: 'grill',
  SPEC: 'spec',
  TICKETS: 'tickets',
  REVIEW: 'review',
  IMPLEMENT: 'implement',
  DEBUG: 'debug',
  WAYFINDER: 'wayfinder',
  PLAN: 'plan',
  TEAM: 'team',
  HARNESS: 'harness',
  DIRECT: 'direct',
  READ_ONLY: 'read-only',
  EXPLAIN: 'explain',
});

const ALIASES = new Map([
  ['grilling', EXPLICIT_INTENT.GRILL],
  ['clarify', EXPLICIT_INTENT.GRILL],
  ['clarification', EXPLICIT_INTENT.GRILL],
  ['specification', EXPLICIT_INTENT.SPEC],
  ['ticket', EXPLICIT_INTENT.TICKETS],
  ['planning', EXPLICIT_INTENT.TICKETS],
  ['implementation', EXPLICIT_INTENT.IMPLEMENT],
  ['root-cause', EXPLICIT_INTENT.DEBUG],
  ['root-cause-debug', EXPLICIT_INTENT.DEBUG],
  ['readonly', EXPLICIT_INTENT.READ_ONLY],
  ['read_only', EXPLICIT_INTENT.READ_ONLY],
  ['read only', EXPLICIT_INTENT.READ_ONLY],
  ['subagent', EXPLICIT_INTENT.TEAM],
  ['planned', EXPLICIT_INTENT.PLAN],
]);

const KNOWN = new Set(Object.values(EXPLICIT_INTENT));

export const EXPLICIT_INTENT_MATRIX = Object.freeze({
  [EXPLICIT_INTENT.GRILL]: Object.freeze({
    capabilityId: CAPABILITY.REQUIREMENTS_CLARIFY,
    route: 'requirements',
    reasonCode: 'explicit-intent-grill',
    providerMode: 'rex-native',
    evidenceRefs: Object.freeze(['intent:grill']),
  }),
  [EXPLICIT_INTENT.SPEC]: Object.freeze({
    capabilityId: CAPABILITY.REQUIREMENTS_CLARIFY,
    route: 'requirements-spec',
    reasonCode: 'explicit-intent-spec',
    providerMode: 'rex-native',
    evidenceRefs: Object.freeze(['intent:spec']),
  }),
  [EXPLICIT_INTENT.TICKETS]: Object.freeze({
    capabilityId: CAPABILITY.PLANNING_SEQUENCE,
    route: 'planning',
    reasonCode: 'explicit-intent-tickets',
    providerMode: 'rex-native',
    evidenceRefs: Object.freeze(['intent:tickets']),
  }),
  [EXPLICIT_INTENT.REVIEW]: Object.freeze({
    capabilityId: CAPABILITY.REVIEW_STANDARDS_SPEC,
    route: 'review',
    reasonCode: 'explicit-intent-review',
    providerMode: 'rex-native',
    evidenceRefs: Object.freeze(['intent:review']),
  }),
  [EXPLICIT_INTENT.IMPLEMENT]: Object.freeze({
    capabilityId: null,
    route: 'delivery-chain',
    reasonCode: 'explicit-intent-implement',
    providerMode: 'rex-native',
    evidenceRefs: Object.freeze(['intent:implement']),
  }),
  [EXPLICIT_INTENT.DEBUG]: Object.freeze({
    capabilityId: CAPABILITY.DEBUG_ROOT_CAUSE,
    route: 'debug',
    reasonCode: 'explicit-intent-debug',
    providerMode: 'rex-native',
    evidenceRefs: Object.freeze(['intent:debug']),
  }),
  [EXPLICIT_INTENT.WAYFINDER]: Object.freeze({
    capabilityId: CAPABILITY.NAVIGATION_WAYFIND,
    route: 'wayfinder',
    reasonCode: 'explicit-intent-wayfinder',
    providerMode: 'rex-native',
    evidenceRefs: Object.freeze(['intent:wayfinder']),
  }),
  [EXPLICIT_INTENT.PLAN]: Object.freeze({
    capabilityId: CAPABILITY.PLANNING_SEQUENCE,
    route: 'planning',
    reasonCode: 'explicit-intent-plan',
    providerMode: 'rex-native',
    evidenceRefs: Object.freeze(['intent:plan']),
  }),
  [EXPLICIT_INTENT.TEAM]: Object.freeze({
    capabilityId: null,
    route: 'team',
    reasonCode: 'explicit-intent-team',
    providerMode: 'rex-native',
    evidenceRefs: Object.freeze(['intent:team']),
  }),
  [EXPLICIT_INTENT.HARNESS]: Object.freeze({
    capabilityId: null,
    route: 'harness',
    reasonCode: 'explicit-intent-harness',
    providerMode: 'rex-native',
    evidenceRefs: Object.freeze(['intent:harness']),
  }),
  [EXPLICIT_INTENT.DIRECT]: Object.freeze({
    capabilityId: null,
    route: 'direct',
    reasonCode: 'explicit-intent-direct',
    providerMode: 'rex-native',
    evidenceRefs: Object.freeze(['intent:direct']),
  }),
  [EXPLICIT_INTENT.READ_ONLY]: Object.freeze({
    capabilityId: null,
    route: 'direct',
    reasonCode: 'explicit-intent-read-only',
    providerMode: 'rex-native',
    evidenceRefs: Object.freeze(['intent:read-only']),
  }),
  [EXPLICIT_INTENT.EXPLAIN]: Object.freeze({
    capabilityId: null,
    route: 'direct',
    reasonCode: 'explicit-intent-explain',
    providerMode: 'rex-native',
    evidenceRefs: Object.freeze(['intent:explain']),
  }),
});

function rawIntentValue(input) {
  if (typeof input === 'string') return input;
  if (!input || typeof input !== 'object' || Array.isArray(input)) return '';
  return input.intent ?? input.kind ?? input.route ?? '';
}

export function normalizeExplicitIntent(input) {
  const raw = String(rawIntentValue(input) || '').trim().toLowerCase();
  if (!raw) return Object.freeze({ status: 'empty', value: '', raw: '' });
  const value = ALIASES.get(raw) || raw;
  if (!KNOWN.has(value)) return Object.freeze({ status: 'unknown', value: '', raw });
  return Object.freeze({ status: 'known', value, raw });
}

export function explicitIntentValue(input) {
  return normalizeExplicitIntent(input).value;
}

export function explicitIntentMatrixEntry(input) {
  const normalized = normalizeExplicitIntent(input);
  return normalized.status === 'known'
    ? EXPLICIT_INTENT_MATRIX[normalized.value] || null
    : null;
}
