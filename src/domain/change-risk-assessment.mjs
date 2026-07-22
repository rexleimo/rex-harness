import { FACT } from './fact-kinds.mjs';

export const CHANGE_RISK_VALUES = Object.freeze({
  changeKind: Object.freeze(['behavioral', 'structural', 'configuration', 'dependency', 'data']),
  blastRadius: Object.freeze(['local', 'component', 'subsystem', 'system', 'unknown']),
  externalEffect: Object.freeze(['none', 'internal', 'external', 'destructive', 'unknown']),
  reversibility: Object.freeze(['reversible', 'compensatable', 'irreversible', 'unknown']),
  uncertainty: Object.freeze(['low', 'medium', 'high']),
});

const FACT_BY_ASSESSMENT_FIELD = Object.freeze({
  changeKind: FACT.CHANGE_KIND,
  blastRadius: FACT.CHANGE_BLAST_RADIUS,
  externalEffect: FACT.CHANGE_EXTERNAL_EFFECT,
  reversibility: FACT.CHANGE_REVERSIBILITY,
  uncertainty: FACT.CHANGE_UNCERTAINTY,
});

function normalizeAssessmentValue(value, field) {
  const normalized = String(value || '').trim().toLowerCase();
  if (!CHANGE_RISK_VALUES[field].includes(normalized)) {
    throw new TypeError(`changeRisk.${field} must be one of: ${CHANGE_RISK_VALUES[field].join(', ')}`);
  }
  return normalized;
}

export function normalizeChangeRiskAssessment(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError('changeRisk must be an object');
  }

  return Object.freeze(Object.fromEntries(
    Object.keys(FACT_BY_ASSESSMENT_FIELD).map((field) => [
      field,
      normalizeAssessmentValue(value[field], field),
    ]),
  ));
}

export function deriveChangeRiskFacts(changeRisk, evidenceRefs) {
  const assessment = normalizeChangeRiskAssessment(changeRisk);
  return Object.freeze(Object.entries(FACT_BY_ASSESSMENT_FIELD).map(([field, kind]) => Object.freeze({
    kind,
    value: assessment[field],
    evidenceRefs,
  })));
}
