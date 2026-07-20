import {
  assertExecutionReceiptMatchesCommand,
  executionReceiptRef,
  normalizeExecutionReceipt,
  normalizeExecutionCommand,
} from './execution-receipts.mjs';

const REF_PATTERN = /^[a-z][a-z0-9+.-]*:.+/iu;

function receiptExitCode(decision) {
  if (decision.kind === TESTABILITY_DECISION.BEHAVIOR_DELTA) return 'nonzero';
  if (decision.kind === TESTABILITY_DECISION.HARDENING) return 'zero';
  return null;
}

export const TESTABILITY_DECISION = Object.freeze({
  BEHAVIOR_DELTA: 'behavior-delta',
  HARDENING: 'behavior-preserving-hardening',
  BLOCKED: 'blocked',
});

function text(value, label) {
  const normalized = String(value || '').trim();
  if (!normalized) throw new TypeError(`testability decision requires ${label}`);
  return normalized;
}

function ref(value, label, prefix = '') {
  const normalized = text(value, label);
  if (!REF_PATTERN.test(normalized) || (prefix && !normalized.startsWith(prefix))) {
    throw new TypeError(`testability decision requires a valid ${label}`);
  }
  return normalized;
}

function normalizeScenario(value, { label, requiresFailureReason = false } = {}) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`testability decision requires ${label}`);
  }
  const scenario = {
    publicEntry: text(value.publicEntry, `${label}.publicEntry`),
    setup: text(value.setup, `${label}.setup`),
    command: normalizeExecutionCommand(value.command, { label: `${label}.command` }),
    expected: text(value.expected, `${label}.expected`),
    observed: text(value.observed, `${label}.observed`),
    receiptRef: ref(value.receiptRef, `${label}.receiptRef`, 'receipt:'),
  };
  if (requiresFailureReason) scenario.failureReason = text(value.failureReason, `${label}.failureReason`);
  return Object.freeze(scenario);
}

/**
 * 测试设计阶段只记录一个显式的可测试性结论。后续 Capability 只能依据
 * 这个类型化结论分流，不能从 Agent 文本或 "已有测试" 反推 RED 是否成立。
 */
export function normalizeTestabilityDecision(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError('testability decision must be an object');
  }
  const kind = text(value.kind, 'kind');
  const decisionRef = ref(value.decisionRef, 'decisionRef');
  if (kind === TESTABILITY_DECISION.BEHAVIOR_DELTA) {
    return Object.freeze({
      kind,
      decisionRef,
      redCandidate: normalizeScenario(value.redCandidate, {
        label: 'redCandidate',
        requiresFailureReason: true,
      }),
    });
  }
  if (kind === TESTABILITY_DECISION.HARDENING) {
    return Object.freeze({
      kind,
      decisionRef,
      baseline: normalizeScenario(value.baseline, { label: 'baseline' }),
    });
  }
  if (kind === TESTABILITY_DECISION.BLOCKED) {
    return Object.freeze({
      kind,
      decisionRef,
      reason: text(value.reason, 'reason'),
      missingAcceptance: text(value.missingAcceptance, 'missingAcceptance'),
    });
  }
  throw new TypeError(`unsupported testability decision: ${kind}`);
}

export function testabilityEvidenceRefs(decision) {
  const normalized = normalizeTestabilityDecision(decision);
  const scenario = normalized.redCandidate || normalized.baseline;
  return Object.freeze(scenario
    ? [normalized.decisionRef, scenario.receiptRef]
    : [normalized.decisionRef]);
}

/**
 * A testability conclusion can select a delivery path, so its public-scenario
 * observation must be backed by the same execution receipt boundary as RED/GREEN.
 */
export function validateTestabilityDecisionReceipt(decision, { resolveReceipt } = {}) {
  const normalized = normalizeTestabilityDecision(decision);
  const expectedExit = receiptExitCode(normalized);
  if (!expectedExit) return normalized;
  if (typeof resolveReceipt !== 'function') {
    throw new Error('testability decision requires an execution receipt resolver');
  }
  const scenario = normalized.redCandidate || normalized.baseline;
  const resolved = resolveReceipt(scenario.receiptRef);
  if (!resolved) {
    throw new Error(`testability decision references an unknown execution receipt: ${scenario.receiptRef}`);
  }
  const receipt = normalizeExecutionReceipt(resolved);
  if (executionReceiptRef(receipt) !== scenario.receiptRef) {
    throw new Error(`testability decision receipt does not match its reference: ${scenario.receiptRef}`);
  }
  assertExecutionReceiptMatchesCommand(receipt, scenario.command);
  const matches = expectedExit === 'zero' ? receipt.exitCode === 0 : receipt.exitCode !== 0;
  if (!matches) {
    const expectation = expectedExit === 'zero' ? 'a zero exit code' : 'a non-zero exit code';
    throw new Error(`testability decision requires an execution receipt with ${expectation}`);
  }
  return normalized;
}
