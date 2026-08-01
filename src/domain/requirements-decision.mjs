import { OBSERVATION } from './observation-kinds.mjs';
import { normalizeObservations } from './observation-kinds.mjs';

export const REQUIREMENTS_DECISION_KIND = 'rex.requirements-decision.v1';
const DECISION_REF_PATTERN = /^(?:artifact|command|diff|evidence|intent|receipt):[^\s]+$/u;
const EVIDENCE_REF_PATTERN = /^[a-z][a-z0-9+.-]*:[^\s]+$/iu;
const PLACEHOLDER_PATTERN = /(?:placeholder|todo|tbd|example-only|真实引用)/iu;
const DECISION_KEYS = new Set([
  'schemaVersion',
  'kind',
  'decisionRef',
  'acceptanceCriteria',
  'nonGoals',
  'firstSlice',
  'observations',
]);
const FIRST_SLICE_KEYS = new Set(['outcome', 'verification']);
const DECISION_OBSERVATIONS = new Set(Object.values(OBSERVATION));

function assertPlainObject(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`${label} must be an object`);
  }
}

function text(value, label) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new TypeError(`${label} must be a non-empty string`);
  }
  const normalized = value.trim();
  if (PLACEHOLDER_PATTERN.test(normalized)) throw new TypeError(`${label} must not be a placeholder`);
  return normalized;
}

function textList(value, label) {
  if (!Array.isArray(value) || value.length === 0) throw new TypeError(`${label} must be a non-empty array`);
  return Object.freeze(value.map((item, index) => text(item, `${label}[${index}]`)));
}

function normalizeFirstSlice(value) {
  assertPlainObject(value, 'firstSlice');
  if (Object.keys(value).some((key) => !FIRST_SLICE_KEYS.has(key))) {
    throw new TypeError('firstSlice contains an unknown field');
  }
  return Object.freeze({
    outcome: text(value.outcome, 'firstSlice.outcome'),
    verification: text(value.verification, 'firstSlice.verification'),
  });
}

export function normalizeRequirementsDecision(raw = {}) {
  assertPlainObject(raw, 'requirementsDecision');
  if (Object.keys(raw).some((key) => !DECISION_KEYS.has(key))) {
    throw new TypeError('requirementsDecision contains an unknown field');
  }
  if (raw.schemaVersion !== 1) throw new TypeError('requirementsDecision schemaVersion must be 1');
  if (raw.kind !== REQUIREMENTS_DECISION_KIND) {
    throw new TypeError(`requirementsDecision kind must be ${REQUIREMENTS_DECISION_KIND}`);
  }
  const decisionRef = text(raw.decisionRef, 'decisionRef');
  if (!DECISION_REF_PATTERN.test(decisionRef)) throw new TypeError('decisionRef must use a supported evidence protocol');
  const acceptanceCriteria = textList(raw.acceptanceCriteria, 'acceptanceCriteria');
  const nonGoals = textList(raw.nonGoals, 'nonGoals');
  const firstSlice = normalizeFirstSlice(raw.firstSlice);
  const observations = normalizeObservations(raw.observations);
  if (observations.length === 0) throw new TypeError('requirementsDecision observations must be non-empty');
  for (const observation of observations) {
    if (!DECISION_OBSERVATIONS.has(observation.kind)) {
      throw new TypeError(`requirementsDecision observation kind is not registered: ${observation.kind}`);
    }
    if (!observation.evidenceRefs.every((ref) => EVIDENCE_REF_PATTERN.test(ref))) {
      throw new TypeError(`requirementsDecision observation contains an invalid evidence ref`);
    }
    if (!observation.evidenceRefs.includes(decisionRef)) {
      throw new TypeError(`requirementsDecision observation must reference ${decisionRef}`);
    }
  }
  return Object.freeze({
    schemaVersion: 1,
    kind: REQUIREMENTS_DECISION_KIND,
    decisionRef,
    acceptanceCriteria,
    nonGoals,
    firstSlice,
    observations: Object.freeze(observations),
  });
}

export function requirementsDecisionEvidenceRef(decision) {
  return normalizeRequirementsDecision(decision).decisionRef;
}
