import { normalizeEvidence } from '../domain/evidence.mjs';
import {
  assertExecutionReceiptMatchesCommand,
  executionReceiptRef,
  normalizeExecutionReceipt,
} from '../domain/execution-receipts.mjs';

const PLACEHOLDER_REF = /artifact-or-command-ref|placeholder|真实存在|todo|tbd/iu;
const NONZERO_RECEIPT_EVIDENCE = new Set([
  'failing-test-observed',
]);
const ZERO_RECEIPT_EVIDENCE = new Set([
  'passing-test-observed',
  'refactor-check-recorded',
  'test-strength-check-recorded',
  'baseline-scenario-observed',
  'affected-boundary-scenario-observed',
]);

function requiredReceiptExitCode(kind) {
  if (NONZERO_RECEIPT_EVIDENCE.has(kind)) return 'nonzero';
  if (ZERO_RECEIPT_EVIDENCE.has(kind)) return 'zero';
  return null;
}

function validateExecutionReceipts(item, resolveReceipt, expectedScenarioCommand) {
  const expectedExit = requiredReceiptExitCode(item.kind);
  if (!expectedExit) return;
  if (typeof resolveReceipt !== 'function') {
    throw new Error(`evidence ${item.kind} requires an execution receipt resolver`);
  }

  const receiptRefs = item.refs.filter((ref) => ref.startsWith('receipt:'));
  if (receiptRefs.length === 0) {
    throw new Error(`evidence ${item.kind} requires at least one receipt: reference`);
  }

  const matchingReceipt = receiptRefs.some((ref) => {
    const resolved = resolveReceipt(ref);
    if (!resolved) throw new Error(`evidence ${item.kind} references an unknown execution receipt: ${ref}`);
    const receipt = normalizeExecutionReceipt(resolved);
    if (executionReceiptRef(receipt) !== ref) {
      throw new Error(`execution receipt resolver returned a mismatched receipt for ${ref}`);
    }
    if (expectedScenarioCommand) {
      assertExecutionReceiptMatchesCommand(receipt, expectedScenarioCommand);
    }
    return expectedExit === 'zero' ? receipt.exitCode === 0 : receipt.exitCode !== 0;
  });

  if (!matchingReceipt) {
    const expectation = expectedExit === 'zero' ? 'a zero exit code' : 'a non-zero exit code';
    throw new Error(`evidence ${item.kind} requires an execution receipt with ${expectation}`);
  }
}

/**
 * 公共证据入口只能提交当前 Command 明确要求的类型，并且引用必须带协议前缀。
 * 这让独立 CLI 和 AIOS Adapter 能共享同一组基本证据约束。
 */
export function validateCommandEvidence(command, evidence = [], {
  resolveReceipt,
  expectedScenarioCommand,
} = {}) {
  if (!Array.isArray(evidence) || evidence.length === 0) {
    throw new TypeError('rex evidence requires a non-empty evidence array');
  }
  if (evidence.length > 64) throw new TypeError('rex evidence exceeds 64 evidence items');

  const normalized = normalizeEvidence(evidence);
  const expected = new Set(command?.expectedEvidence || []);
  for (const item of normalized) {
    if (!expected.has(item.kind)) {
      throw new Error(`unexpected rex evidence kind for current Command: ${item.kind}`);
    }
    if (item.refs.length > 32) throw new TypeError(`evidence ${item.kind} exceeds 32 refs`);
    for (const ref of item.refs) {
      if (PLACEHOLDER_REF.test(ref) || !/^[a-z][a-z0-9+.-]*:.+/iu.test(ref)) {
        throw new Error(`evidence ${item.kind} contains an invalid or placeholder ref: ${ref}`);
      }
    }
    validateExecutionReceipts(item, resolveReceipt, expectedScenarioCommand);
  }
  return normalized;
}
