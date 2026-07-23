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

function normalizeDependsOn(value, label) {
  if (value === undefined) return Object.freeze([]);
  if (!Array.isArray(value)) {
    throw new TypeError(`long-running delivery requires ${label} to be an array`);
  }
  return Object.freeze(value.map((dependencyId, index) => (
    text(dependencyId, `${label}[${index}]`)
  )));
}

function assertDependencyGraph(features) {
  const byId = new Map(features.map((feature) => [feature.id, feature]));
  for (const feature of features) {
    const dependencies = new Set();
    for (const dependencyId of feature.dependsOn) {
      if (!byId.has(dependencyId)) {
        throw new TypeError(`long-running delivery has unknown dependency: ${dependencyId}`);
      }
      if (dependencies.has(dependencyId)) {
        throw new TypeError(`long-running delivery has duplicate dependency: ${dependencyId}`);
      }
      if (dependencyId === feature.id) {
        throw new TypeError(`long-running delivery feature cannot depend on itself: ${feature.id}`);
      }
      dependencies.add(dependencyId);
    }
  }

  const visiting = new Set();
  const visited = new Set();
  function visit(feature) {
    if (visiting.has(feature.id)) {
      throw new TypeError(`long-running delivery has dependency cycle at: ${feature.id}`);
    }
    if (visited.has(feature.id)) return;
    visiting.add(feature.id);
    for (const dependencyId of feature.dependsOn) visit(byId.get(dependencyId));
    visiting.delete(feature.id);
    visited.add(feature.id);
  }
  for (const feature of features) visit(feature);
}

function normalizeFeatures(features) {
  if (!Array.isArray(features) || features.length === 0) {
    throw new TypeError('long-running delivery requires at least one feature');
  }
  const ids = new Set();
  const normalized = features.map((feature, index) => {
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
      dependsOn: normalizeDependsOn(feature.dependsOn, `feature[${index}].dependsOn`),
      acceptance: text(feature.acceptance, `feature[${index}].acceptance`),
      verificationScenario: normalizeVerificationScenario(
        feature.verificationScenario,
        `feature[${index}].verificationScenario`,
      ),
      status: 'pending',
      retryCount: 0,
      evidenceRefs: Object.freeze([]),
    });
  });
  assertDependencyGraph(normalized);
  return Object.freeze(normalized);
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
  const currentFeatureId = normalizedFeatures.find((feature) => feature.dependsOn.length === 0)?.id;
  if (!currentFeatureId) {
    throw new TypeError('long-running delivery requires at least one dependency-ready feature');
  }
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

function withTerminalDecision(ledger, feature, kind, reference = null, changes = {}, reason = null) {
  const features = Object.freeze(ledger.features.map((candidate) => {
    if (candidate.id !== feature.id) return candidate;
    if (reference) return withFeatureEvidence(candidate, reference, changes);
    return Object.keys(changes).length > 0
      ? Object.freeze({ ...candidate, ...changes })
      : candidate;
  }));
  return Object.freeze({
    ledger: Object.freeze({ ...ledger, status: kind, features }),
    decision: Object.freeze({ ...(reason ? { reason } : {}), kind }),
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
  if (!observedEvidence) {
    return withTerminalDecision(ledger, feature, 'blocked', null, {}, 'evidence-missing');
  }
  if (observedEvidence.featureId !== feature.id) {
    return withTerminalDecision(ledger, feature, 'blocked', null, {}, 'evidence-feature-mismatch');
  }
  if (observedEvidence.kind === 'acceptance-unresolved') {
    return withTerminalDecision(ledger, feature, 'human-gate', observedEvidence.reasonRef);
  }
  const receipt = resolveFeatureReceipt(feature, observedEvidence, resolveReceipt);
  if (!receipt) {
    return withTerminalDecision(ledger, feature, 'blocked', null, {}, 'evidence-rejected');
  }
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
    return withTerminalDecision(
      ledger,
      feature,
      'human-gate',
      observedEvidence.receiptRef,
      { retryCount },
      'verification-failed',
    );
  }
  const acceptedFeatureIds = new Set([
    ...ledger.features
      .filter((candidate) => candidate.status === 'accepted')
      .map((candidate) => candidate.id),
    feature.id,
  ]);
  const nextFeature = ledger.features.find((candidate) => (
    candidate.status === 'pending'
      && candidate.dependsOn.every((dependencyId) => acceptedFeatureIds.has(dependencyId))
  )) || null;
  const hasPendingFeatures = ledger.features.some((candidate) => (
    candidate.id !== feature.id && candidate.status === 'pending'
  ));
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
  const unresolvedDependencies = !nextFeature && hasPendingFeatures;
  const completed = !nextFeature && !unresolvedDependencies;
  const nextLedger = Object.freeze({
    ...ledger,
    status: completed ? 'completed' : unresolvedDependencies ? 'blocked' : 'active',
    features,
    currentFeatureId,
  });
  return Object.freeze({
    ledger: nextLedger,
    decision: unresolvedDependencies
      ? Object.freeze({ kind: 'blocked', reason: 'dependencies-unresolved' })
      : completed
      ? Object.freeze({ kind: 'completed' })
      : Object.freeze({ kind: 'continue', currentFeatureId }),
  });
}
