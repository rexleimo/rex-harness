const TOP_LEVEL_KEYS = new Set([
  'schemaVersion',
  'kind',
  'status',
  'fixedPoint',
  'diffRef',
  'specStatus',
  'specSource',
  'standardsFindings',
  'specFindings',
  'verdict',
  'evidenceRefs',
]);
const FINDING_KEYS = new Set(['id', 'position', 'evidence', 'severity', 'recommendation']);

function assertObject(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError(`${label} must be an object`);
}

function text(value, label) {
  const normalized = String(value || '').trim();
  if (!normalized) throw new TypeError(`${label} must be non-empty`);
  return normalized;
}

function list(value, label, allowEmpty = false) {
  if (!Array.isArray(value) || (!allowEmpty && value.length === 0)) throw new TypeError(`${label} must be an array`);
  return value;
}

function refs(value, label) {
  return Object.freeze(list(value, label).map((ref) => text(ref, `${label} item`)));
}

function rejectUnknown(value, allowed, label) {
  assertObject(value, label);
  for (const key of Object.keys(value)) if (!allowed.has(key)) throw new TypeError(`${label} contains unknown field: ${key}`);
}

function finding(value, label) {
  rejectUnknown(value, FINDING_KEYS, label);
  const severity = text(value.severity, `${label} severity`).toLowerCase();
  if (!['hard', 'judgement'].includes(severity)) throw new TypeError(`${label} severity is invalid`);
  return Object.freeze({
    id: text(value.id, `${label} id`),
    position: text(value.position, `${label} position`),
    evidence: refs(value.evidence, `${label} evidence`),
    severity,
    recommendation: text(value.recommendation, `${label} recommendation`),
  });
}

export const REVIEW_VERDICT_KIND = 'rex.standards-spec-review.v1';

export function normalizeReviewVerdict(input) {
  rejectUnknown(input, TOP_LEVEL_KEYS, 'review verdict');
  if (input.schemaVersion !== 1) throw new TypeError('review verdict schemaVersion must be 1');
  if (input.kind !== REVIEW_VERDICT_KIND) throw new TypeError('review verdict kind is invalid');
  const status = text(input.status || 'complete', 'review verdict status').toLowerCase();
  if (!['complete', 'blocked', 'incomplete'].includes(status)) throw new TypeError('review verdict status is invalid');
  const fixedPoint = text(input.fixedPoint, 'review verdict fixedPoint');
  const diffRef = text(input.diffRef, 'review verdict diffRef');
  const specStatus = text(input.specStatus, 'review verdict specStatus').toLowerCase();
  if (!['available', 'missing'].includes(specStatus)) throw new TypeError('review verdict specStatus is invalid');
  const specSource = input.specSource == null ? null : text(input.specSource, 'review verdict specSource');
  if (specStatus === 'available' && !specSource) throw new TypeError('available spec requires specSource');
  if (specStatus === 'missing' && specSource) throw new TypeError('missing spec cannot claim a specSource');
  const standardsFindings = Object.freeze(list(input.standardsFindings, 'review verdict standardsFindings', true).map((item, index) => finding(item, `standards finding ${index}`)));
  const specFindings = Object.freeze(list(input.specFindings, 'review verdict specFindings', true).map((item, index) => finding(item, `spec finding ${index}`)));
  const verdict = text(input.verdict, 'review verdict verdict');
  const evidenceRefs = refs(input.evidenceRefs, 'review verdict evidenceRefs');
  if (status === 'complete' && !['pass', 'changes-requested'].includes(verdict.toLowerCase())) {
    throw new TypeError('complete review verdict must be pass or changes-requested');
  }
  return Object.freeze({
    schemaVersion: 1,
    kind: REVIEW_VERDICT_KIND,
    status,
    fixedPoint,
    diffRef,
    specStatus,
    specSource,
    standardsFindings,
    specFindings,
    verdict,
    evidenceRefs,
  });
}
