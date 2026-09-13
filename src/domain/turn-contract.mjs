import { createHash } from 'node:crypto';
import { normalizeEvidence } from './evidence.mjs';

/**
 * Turn 契约（借鉴 LoopX turn contract，见 research/upstream/loopx-analysis.md §4.2）：
 * executor 的每个 turn 必须产出单个类型化结果；结算门只接受 material 结果产生副作用。
 * executor 不得自验完成声明——独立校验由 `rex-harness verify` 进程承担。
 */

export const TURN_RESULT_KIND = 'rex.turn-result.v1';
export const TURN_SETTLEMENT_KIND = 'rex.turn-settlement.v1';

/** material 结果才允许结算副作用（推进工作流、扣额度、轮换 token）。 */
export const TURN_OUTCOMES = Object.freeze([
  'validated_progress',
  'validated_completion',
  'repair_required',
  'replan_required',
  'blocked',
]);

export const MATERIAL_TURN_OUTCOMES = Object.freeze([
  'validated_progress',
  'validated_completion',
  'repair_required',
]);

export const FAILURE_KINDS = Object.freeze([
  'none',
  'rate_limited',
  'provider_overloaded',
  'host_unsupported',
  'budget_exhausted',
  'safety_gate',
  'ownership_gate',
  'unknown',
]);

/** envelope 是 wire 契约：超限即拒绝，防止 journal 被单条记录膨胀。 */
export const TURN_RESULT_MAX_BYTES = 16 * 1024;

const SHA256_HEX = /^[0-9a-f]{64}$/u;
const MAX_TEXT_LENGTH = 2000;

function text(value, label, { required = true } = {}) {
  const normalized = String(value ?? '').trim();
  if (!normalized) {
    if (required) throw new TypeError(`turn result requires ${label}`);
    return '';
  }
  if (normalized.length > MAX_TEXT_LENGTH) throw new TypeError(`${label} exceeds ${MAX_TEXT_LENGTH} chars`);
  return normalized;
}

/** 稳定序列化：键排序后拼接，保证同 payload 在任何进程里散列一致。 */
export function canonicalTurnPayload(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) return `[${value.map((item) => canonicalTurnPayload(item)).join(',')}]`;
  const keys = Object.keys(value).filter((key) => value[key] !== undefined).sort();
  return `{${keys.map((key) => `${JSON.stringify(key)}:${canonicalTurnPayload(value[key])}`).join(',')}}`;
}

export function sha256Hex(value) {
  return createHash('sha256').update(value).digest('hex');
}

/**
 * effectRef 是幂等结算键：绑定当前 executionToken 与 turn payload。
 * token 在每次接受证据后轮换，因此旧 token 派生的 effectRef 永远无法重复结算。
 */
export function deriveEffectRef({ executionToken, turnResult }) {
  const token = text(executionToken, 'executionToken');
  const payload = canonicalTurnPayload({
    bypass: Boolean(turnResult?.bypass),
    commandToken: token,
    evidence: normalizeTurnEvidence(turnResult?.evidence, { allowEmpty: true }),
    failureKind: turnResult?.failureKind,
    outcome: turnResult?.outcome,
    selfReport: turnResult?.selfReport ?? null,
    turnKey: turnResult?.turnKey ?? null,
  });
  return `effect:${sha256Hex(payload)}`;
}

function normalizeTurnEvidence(value, { allowEmpty = false } = {}) {
  if (value === undefined || value === null) {
    if (allowEmpty) return [];
    throw new TypeError('turn result requires evidence for material outcomes');
  }
  return normalizeEvidence(value);
}

function normalizeTurnKey(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError('turn result requires turnKey');
  }
  const workflowActivationId = text(value.workflowActivationId, 'turnKey.workflowActivationId');
  const iteration = Number(value.iteration);
  if (!Number.isInteger(iteration) || iteration < 1) {
    throw new TypeError('turnKey.iteration must be a positive integer');
  }
  return Object.freeze({ workflowActivationId, iteration });
}

function normalizeSelfReport(value, { outcome }) {
  const report = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const blockedReason = text(report.blockedReason, 'selfReport.blockedReason', { required: false });
  if (outcome === 'blocked' && !blockedReason) {
    throw new TypeError('outcome "blocked" requires selfReport.blockedReason');
  }
  return Object.freeze({
    progressMade: Boolean(report.progressMade),
    blockedReason,
    summary: text(report.summary, 'selfReport.summary', { required: false }),
  });
}

/** 校验并冻结一份 turn 结果；拒绝占位符、超限与非法枚举。 */
export function normalizeTurnResult(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError('turn result must be an object');
  }
  const serialized = JSON.stringify(value);
  if (serialized && Buffer.byteLength(serialized, 'utf8') > TURN_RESULT_MAX_BYTES) {
    throw new TypeError(`turn result exceeds ${TURN_RESULT_MAX_BYTES} bytes`);
  }

  const kind = text(value.kind, 'kind');
  if (kind !== TURN_RESULT_KIND) throw new TypeError(`turn result kind must be ${TURN_RESULT_KIND}`);

  const outcome = text(value.outcome, 'outcome');
  if (!TURN_OUTCOMES.includes(outcome)) {
    throw new TypeError(`turn result outcome must be one of ${TURN_OUTCOMES.join('|')}`);
  }

  const failureKind = text(value.failureKind, 'failureKind', { required: false }) || 'none';
  if (!FAILURE_KINDS.includes(failureKind)) {
    throw new TypeError(`turn result failureKind must be one of ${FAILURE_KINDS.join('|')}`);
  }

  const turnKey = normalizeTurnKey(value.turnKey);
  const selfReport = normalizeSelfReport(value.selfReport, { outcome });
  const bypass = Boolean(value.bypass);
  const material = MATERIAL_TURN_OUTCOMES.includes(outcome);
  const evidence = normalizeTurnEvidence(value.evidence, { allowEmpty: !material });
  if (material && evidence.length === 0) {
    throw new TypeError(`material outcome "${outcome}" requires evidence`);
  }

  const commandToken = text(value.commandToken, 'commandToken');
  const effectRef = text(value.effectRef, 'effectRef');
  if (!effectRef.startsWith('effect:') || !SHA256_HEX.test(effectRef.slice('effect:'.length))) {
    throw new TypeError('turn result effectRef must be "effect:" + sha256 hex');
  }

  return Object.freeze({
    schemaVersion: 1,
    kind: TURN_RESULT_KIND,
    turnKey,
    commandToken,
    effectRef,
    outcome,
    failureKind,
    selfReport,
    bypass,
    evidence,
  });
}

/** envelope 是否声明了 material 结果（结算门据此决定是否产生副作用）。 */
export function isMaterialTurnResult(turnResult) {
  return MATERIAL_TURN_OUTCOMES.includes(turnResult?.outcome);
}
