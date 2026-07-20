import {
  assertExecutionReceiptMatchesCommand,
  executionReceiptRef,
  normalizeExecutionCommand,
  normalizeExecutionReceipt,
} from './execution-receipts.mjs';

const FEATURE_ID_PATTERN = /^[a-z][a-z0-9-]*$/u;

function text(value, label) {
  const normalized = String(value || '').trim();
  if (!normalized) throw new TypeError(`long-running delivery requires ${label}`);
  return normalized;
}

function receiptRef(value, label) {
  const normalized = text(value, label);
  if (!normalized.startsWith('receipt:')) {
    throw new TypeError(`long-running delivery requires ${label} to be a receipt reference`);
  }
  return normalized;
}

function normalizeBaseline(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError('long-running delivery requires baseline');
  }
  return Object.freeze({
    publicEntry: text(value.publicEntry, 'baseline.publicEntry'),
    setup: text(value.setup, 'baseline.setup'),
    command: normalizeExecutionCommand(value.command, { label: 'baseline.command' }),
    expected: text(value.expected, 'baseline.expected'),
    observed: text(value.observed, 'baseline.observed'),
    receiptRef: receiptRef(value.receiptRef, 'baseline.receiptRef'),
  });
}

function normalizeVerificationScenario(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`long-running delivery requires ${label}`);
  }
  return Object.freeze({
    publicEntry: text(value.publicEntry, `${label}.publicEntry`),
    setup: text(value.setup, `${label}.setup`),
    command: normalizeExecutionCommand(value.command, { label: `${label}.command` }),
    expected: text(value.expected, `${label}.expected`),
  });
}

function normalizeFeatures(features) {
  if (!Array.isArray(features) || features.length === 0) {
    throw new TypeError('long-running delivery requires at least one feature');
  }
  const ids = new Set();
  return Object.freeze(features.map((feature, index) => {
    if (!feature || typeof feature !== 'object' || Array.isArray(feature)) {
      throw new TypeError(`long-running delivery feature[${index}] must be an object`);
    }
    const id = text(feature.id, `feature[${index}].id`);
    if (!FEATURE_ID_PATTERN.test(id)) {
      throw new TypeError(`long-running delivery feature id is invalid: ${id}`);
    }
    if (ids.has(id)) throw new TypeError(`long-running delivery feature id is duplicated: ${id}`);
    ids.add(id);
    return Object.freeze({
      id,
      acceptance: text(feature.acceptance, `feature[${index}].acceptance`),
      verificationScenario: normalizeVerificationScenario(
        feature.verificationScenario,
        `feature[${index}].verificationScenario`,
      ),
      status: 'pending',
      retryCount: 0,
      evidenceRefs: Object.freeze([]),
    });
  }));
}

function verifyBaseline(baseline, resolveReceipt) {
  if (typeof resolveReceipt !== 'function') {
    throw new TypeError('long-running delivery requires a receipt resolver');
  }
  const resolved = resolveReceipt(baseline.receiptRef);
  if (!resolved) {
    throw new Error(`long-running delivery baseline receipt is unknown: ${baseline.receiptRef}`);
  }
  const receipt = normalizeExecutionReceipt(resolved);
  if (executionReceiptRef(receipt) !== baseline.receiptRef) {
    throw new Error('long-running delivery baseline receipt does not match its reference');
  }
  assertExecutionReceiptMatchesCommand(receipt, baseline.command);
  if (receipt.exitCode !== 0) {
    throw new Error('long-running delivery baseline requires a zero-exit receipt');
  }
  return Object.freeze({ ...baseline, status: 'passed' });
}

/**
 * Rex owns the semantic starting point: a verified baseline and exactly one
 * active feature. Hosts may persist this ledger, but must not choose its next
 * feature outside the decisions returned by this module.
 */
export function startLongRunningDelivery({
  workItemKey,
  baseline,
  features,
  retryPolicy = { maxRetries: 2 },
} = {}, {
  resolveReceipt,
} = {}) {
  const normalizedFeatures = normalizeFeatures(features);
  const currentFeatureId = normalizedFeatures[0].id;
  const normalizedBaseline = verifyBaseline(normalizeBaseline(baseline), resolveReceipt);
  const maxRetries = Number(retryPolicy?.maxRetries ?? 2);
  if (!Number.isInteger(maxRetries) || maxRetries < 0) {
    throw new TypeError('long-running delivery retryPolicy.maxRetries must be a non-negative integer');
  }
  const ledger = Object.freeze({
    schemaVersion: 1,
    kind: 'rex.long-running-delivery.v1',
    workItemKey: text(workItemKey, 'workItemKey'),
    status: 'active',
    baseline: normalizedBaseline,
    features: Object.freeze(normalizedFeatures.map((feature) => Object.freeze({
      ...feature,
      status: feature.id === currentFeatureId ? 'active' : feature.status,
    }))),
    currentFeatureId,
    retryPolicy: Object.freeze({ maxRetries }),
  });
  return Object.freeze({
    ledger,
    decision: Object.freeze({ kind: 'continue', currentFeatureId }),
  });
}

function currentFeature(ledger) {
  if (!ledger || ledger.kind !== 'rex.long-running-delivery.v1') {
    throw new TypeError('advanceLongRunningDelivery requires a Rex long-running delivery ledger');
  }
  const currentFeatureId = text(ledger.currentFeatureId, 'ledger.currentFeatureId');
  const feature = (ledger.features || []).find((candidate) => candidate.id === currentFeatureId);
  if (!feature || feature.status !== 'active') {
    throw new Error(`long-running delivery has no active current feature: ${currentFeatureId}`);
  }
  return feature;
}

function optionalText(value) {
  const normalized = typeof value === 'string' ? value.trim() : '';
  return normalized || null;
}

function featureEvidence(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const featureId = optionalText(value.featureId);
  if (!featureId) return null;
  if (value.kind === 'acceptance-unresolved') {
    const reasonRef = optionalText(value.reasonRef);
    return reasonRef
      ? Object.freeze({ kind: value.kind, featureId, reasonRef })
      : null;
  }
  if (value.kind !== 'feature-verification-observed') return null;
  const receiptReference = optionalText(value.receiptRef);
  if (!receiptReference || !receiptReference.startsWith('receipt:')) return null;
  return Object.freeze({
    kind: value.kind,
    featureId,
    receiptRef: receiptReference,
  });
}

function resolveFeatureReceipt(feature, evidence, resolveReceipt) {
  if (typeof resolveReceipt !== 'function') {
    throw new TypeError('long-running delivery requires a receipt resolver');
  }
  try {
    const resolved = resolveReceipt(evidence.receiptRef);
    if (!resolved) return null;
    const receipt = normalizeExecutionReceipt(resolved);
    if (executionReceiptRef(receipt) !== evidence.receiptRef) return null;
    assertExecutionReceiptMatchesCommand(receipt, feature.verificationScenario.command);
    return receipt;
  } catch {
    // Invalid, unresolved, or mismatched evidence must not advance delivery.
    return null;
  }
}

function withFeatureEvidence(feature, reference, changes = {}) {
  return Object.freeze({
    ...feature,
    ...changes,
    evidenceRefs: Object.freeze([...feature.evidenceRefs, reference]),
  });
}

function withTerminalDecision(ledger, feature, kind, reference = null, changes = {}) {
  const features = Object.freeze(ledger.features.map((candidate) => {
    if (candidate.id !== feature.id) return candidate;
    if (reference) return withFeatureEvidence(candidate, reference, changes);
    return Object.keys(changes).length > 0
      ? Object.freeze({ ...candidate, ...changes })
      : candidate;
  }));
  return Object.freeze({
    ledger: Object.freeze({ ...ledger, status: kind, features }),
    decision: Object.freeze({ kind }),
  });
}

/**
 * Advance only the feature selected in the durable Rex ledger. This public
 * boundary is intentionally independent of AIOS so every host receives the
 * same receipt validation and next-feature decision.
 */
export function advanceLongRunningDelivery(ledger, evidence, {
  resolveReceipt,
} = {}) {
  const feature = currentFeature(ledger);
  const observedEvidence = featureEvidence(evidence);
  if (!observedEvidence || observedEvidence.featureId !== feature.id) {
    return withTerminalDecision(ledger, feature, 'blocked');
  }
  if (observedEvidence.kind === 'acceptance-unresolved') {
    return withTerminalDecision(ledger, feature, 'human-gate', observedEvidence.reasonRef);
  }
  const receipt = resolveFeatureReceipt(feature, observedEvidence, resolveReceipt);
  if (!receipt) return withTerminalDecision(ledger, feature, 'blocked');
  if (receipt.exitCode !== 0) {
    const retryCount = feature.retryCount + 1;
    if (retryCount <= ledger.retryPolicy.maxRetries) {
      const features = Object.freeze(ledger.features.map((candidate) => (
        candidate.id === feature.id
          ? withFeatureEvidence(candidate, observedEvidence.receiptRef, { retryCount })
          : candidate
      )));
      return Object.freeze({
        ledger: Object.freeze({ ...ledger, status: 'active', features }),
        decision: Object.freeze({ kind: 'retry', currentFeatureId: feature.id }),
      });
    }
    return withTerminalDecision(ledger, feature, 'human-gate', observedEvidence.receiptRef, { retryCount });
  }
  const currentIndex = ledger.features.findIndex((candidate) => candidate.id === feature.id);
  const nextFeature = ledger.features.slice(currentIndex + 1)
    .find((candidate) => candidate.status === 'pending') || null;
  const features = Object.freeze(ledger.features.map((candidate) => {
    if (candidate.id === feature.id) {
      return withFeatureEvidence(candidate, observedEvidence.receiptRef, { status: 'accepted' });
    }
    if (nextFeature && candidate.id === nextFeature.id) {
      return Object.freeze({ ...candidate, status: 'active' });
    }
    return candidate;
  }));
  const currentFeatureId = nextFeature?.id || null;
  const completed = !nextFeature;
  const nextLedger = Object.freeze({
    ...ledger,
    status: completed ? 'completed' : 'active',
    features,
    currentFeatureId,
  });
  return Object.freeze({
    ledger: nextLedger,
    decision: completed
      ? Object.freeze({ kind: 'completed' })
      : Object.freeze({ kind: 'continue', currentFeatureId }),
  });
}
