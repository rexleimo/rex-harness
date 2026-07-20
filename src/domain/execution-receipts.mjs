import path from 'node:path';

const RECEIPT_ID_PATTERN = /^[a-zA-Z0-9._-]+$/u;

function text(value, label) {
  const normalized = String(value || '').trim();
  if (!normalized) throw new TypeError(`execution receipt requires ${label}`);
  return normalized;
}

/**
 * A receipt is useful as evidence only when its process invocation can be
 * compared with the public scenario that it claims to exercise. Keep cwd
 * absolute so a persisted scenario has no caller-dependent interpretation.
 */
export function normalizeExecutionCommand(value, { label = 'execution command' } = {}) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`${label} must be an object`);
  }
  if (!Array.isArray(value.args) || value.args.some((arg) => typeof arg !== 'string')) {
    throw new TypeError(`${label} requires string args`);
  }
  const cwd = text(value.cwd, `${label}.cwd`);
  if (!path.isAbsolute(cwd)) {
    throw new TypeError(`${label}.cwd must be an absolute path`);
  }
  return Object.freeze({
    executable: text(value.executable, `${label}.executable`),
    args: Object.freeze([...value.args]),
    cwd: path.normalize(cwd),
  });
}

export function executionCommandsMatch(actual, expected) {
  const normalizedActual = normalizeExecutionCommand(actual, { label: 'execution receipt command' });
  const normalizedExpected = normalizeExecutionCommand(expected, { label: 'declared scenario command' });
  return normalizedActual.executable === normalizedExpected.executable
    && normalizedActual.cwd === normalizedExpected.cwd
    && normalizedActual.args.length === normalizedExpected.args.length
    && normalizedActual.args.every((arg, index) => arg === normalizedExpected.args[index]);
}

export function assertExecutionReceiptMatchesCommand(receipt, expectedCommand) {
  const normalizedReceipt = normalizeExecutionReceipt(receipt);
  if (!executionCommandsMatch(normalizedReceipt.command, expectedCommand)) {
    throw new Error('execution receipt does not match the declared scenario command');
  }
  return normalizedReceipt;
}

export function normalizeExecutionReceipt(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError('execution receipt must be an object');
  }
  const receiptId = text(value.receiptId, 'receiptId');
  if (!RECEIPT_ID_PATTERN.test(receiptId)) throw new TypeError(`invalid execution receipt id: ${receiptId}`);
  const exitCode = Number(value.exitCode);
  if (!Number.isInteger(exitCode)) throw new TypeError('execution receipt requires an integer exitCode');
  return Object.freeze({
    schemaVersion: 1,
    kind: 'rex.execution-receipt.v1',
    receiptId,
    command: normalizeExecutionCommand(value.command, { label: 'execution receipt command' }),
    exitCode,
    stdoutSha256: text(value.stdoutSha256, 'stdoutSha256'),
    stderrSha256: text(value.stderrSha256, 'stderrSha256'),
    observedAt: text(value.observedAt, 'observedAt'),
  });
}

export function executionReceiptRef(receipt) {
  return `receipt:${normalizeExecutionReceipt(receipt).receiptId}`;
}
