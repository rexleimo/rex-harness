import { createHash, randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

import { validateCommandEvidence } from '../application/validate-command-evidence.mjs';
import {
  executionReceiptRef,
  normalizeExecutionReceipt,
} from '../domain/execution-receipts.mjs';
import {
  TURN_SETTLEMENT_KIND,
  deriveEffectRef,
  isMaterialTurnResult,
  normalizeTurnResult,
} from '../domain/turn-contract.mjs';
import {
  advanceSoftwareWorkflow,
  assertSoftwareWorkflowCommandContract,
  startSoftwareWorkflow,
} from '../workflows/software-workflow-runtime.mjs';

const STATE_DIRECTORY = '.rex-harness';

function text(value) {
  return String(value || '').trim();
}

function statePaths(rootDir) {
  const root = path.resolve(text(rootDir) || process.cwd());
  const stateRoot = path.join(root, STATE_DIRECTORY);
  return Object.freeze({
    root,
    stateRoot,
    workflows: path.join(stateRoot, 'workflows'),
    activations: path.join(stateRoot, 'activations'),
    evidence: path.join(stateRoot, 'evidence'),
    receipts: path.join(stateRoot, 'receipts'),
    settlements: path.join(stateRoot, 'settlements'),
  });
}

function safeId(value, label) {
  const id = text(value);
  if (!/^[a-zA-Z0-9._-]+$/u.test(id)) throw new Error(`invalid ${label}: ${id || '(empty)'}`);
  return id;
}

function workItemFile(paths, workItemKey) {
  const key = text(workItemKey);
  if (!key) throw new TypeError('standalone workflow requires workItemKey');
  const digest = createHash('sha256').update(key).digest('hex');
  return path.join(paths.workflows, `${digest}.json`);
}

function activationFile(paths, workflowActivationId) {
  return path.join(paths.activations, `${safeId(workflowActivationId, 'workflowActivationId')}.json`);
}

function evidenceFile(paths, workflowActivationId) {
  return path.join(paths.evidence, `${safeId(workflowActivationId, 'workflowActivationId')}.ndjson`);
}

function receiptFile(paths, receiptId) {
  return path.join(paths.receipts, `${safeId(receiptId, 'receiptId')}.json`);
}

function settlementFile(paths, workflowActivationId) {
  return path.join(paths.settlements, `${safeId(workflowActivationId, 'workflowActivationId')}.ndjson`);
}

function receiptIdFromRef(ref) {
  const value = text(ref);
  if (!value.startsWith('receipt:')) return '';
  return safeId(value.slice('receipt:'.length), 'receiptId');
}

function atomicWriteJson(target, value) {
  fs.mkdirSync(path.dirname(target), { recursive: true });
  const temporary = `${target}.${process.pid}.${randomUUID()}.tmp`;
  fs.writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  fs.renameSync(temporary, target);
}

function readJson(target, expectedKind) {
  let value;
  try {
    value = JSON.parse(fs.readFileSync(target, 'utf8'));
  } catch (error) {
    throw new Error(`invalid rex standalone state: ${target}: ${error.message}`, { cause: error });
  }
  if (value?.kind !== expectedKind) throw new Error(`invalid rex standalone state: ${target}`);
  return value;
}

function sealCurrentCommand(workflow) {
  if (!workflow.currentCommand) return workflow;
  return Object.freeze({
    ...workflow,
    currentCommand: Object.freeze({
      ...workflow.currentCommand,
      executionToken: randomUUID(),
    }),
  });
}

/**
 * CAS 语义：调用方可声明写入时期望的当前 status；磁盘状态已漂移时拒绝写入，
 * 防止并发写回互相覆盖（last-writer-wins 是结算门不允许的失败模式）。
 */
function writeWorkflow(paths, workflow, { expectedStatus } = {}) {
  const target = activationFile(paths, workflow.workflowActivationId);
  if (expectedStatus !== undefined && fs.existsSync(target)) {
    const current = readJson(target, 'rex.software-workflow-activation.v1');
    if (current.status !== expectedStatus) {
      throw new Error(
        `rex standalone CAS precondition failed: expected status ${expectedStatus}, found ${current.status}`,
      );
    }
  }
  atomicWriteJson(target, workflow);
  atomicWriteJson(workItemFile(paths, workflow.workItemKey), {
    schemaVersion: 1,
    kind: 'rex.standalone-work-item.v1',
    workItemKey: workflow.workItemKey,
    workflowActivationId: workflow.workflowActivationId,
    status: workflow.status,
    updatedAt: workflow.updatedAt,
  });
  return workflow;
}

function readByWorkflowId(paths, workflowActivationId) {
  const target = activationFile(paths, workflowActivationId);
  if (!fs.existsSync(target)) return null;
  const workflow = readJson(target, 'rex.software-workflow-activation.v1');
  try {
    assertSoftwareWorkflowCommandContract(workflow);
  } catch (error) {
    throw new Error(`invalid rex standalone workflow command contract: ${target}: ${error.message}`, { cause: error });
  }
  return workflow;
}

function readByWorkItem(paths, workItemKey) {
  const target = workItemFile(paths, workItemKey);
  if (!fs.existsSync(target)) return null;
  const index = readJson(target, 'rex.standalone-work-item.v1');
  if (index.workItemKey !== text(workItemKey)) {
    throw new Error(`rex standalone work-item index mismatch: ${target}`);
  }
  const workflow = readByWorkflowId(paths, index.workflowActivationId);
  if (!workflow) throw new Error(`rex standalone workflow is missing: ${index.workflowActivationId}`);
  return workflow;
}

function listWorkflows(paths) {
  if (!fs.existsSync(paths.activations)) return [];
  return fs.readdirSync(paths.activations, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
    .map((entry) => readJson(
      path.join(paths.activations, entry.name),
      'rex.software-workflow-activation.v1',
    ));
}

function appendEvidence(paths, workflow, command, evidence, now) {
  fs.mkdirSync(paths.evidence, { recursive: true });
  const record = {
    schemaVersion: 1,
    kind: 'rex.standalone-evidence.v1',
    workflowActivationId: workflow.workflowActivationId,
    activationId: command.activationId,
    capabilityId: command.capabilityId,
    stageId: command.stageId,
    evidence,
    recordedAt: now.toISOString(),
  };
  fs.appendFileSync(
    evidenceFile(paths, workflow.workflowActivationId),
    `${JSON.stringify(record)}\n`,
    'utf8',
  );
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function observedAt(now) {
  const value = now instanceof Date ? now : new Date(now);
  if (Number.isNaN(value.getTime())) throw new TypeError('execution receipt now must be a valid date');
  return value.toISOString();
}

/**
 * 在 standalone 的受控边界执行一条显式命令，并保存最小、可校验的执行回执。
 * 此命令自身总是成功返回回执；被观察命令的退出码记录在 receipt.exitCode 中。
 */
export function captureStandaloneExecutionReceipt({
  rootDir = process.cwd(),
  executable,
  args = [],
  now = new Date(),
} = {}) {
  const paths = statePaths(rootDir);
  const command = text(executable);
  if (!command) throw new TypeError('execution receipt requires command executable');
  if (!Array.isArray(args) || args.some((arg) => typeof arg !== 'string')) {
    throw new TypeError('execution receipt command args must be an array of strings');
  }

  const result = spawnSync(command, args, {
    cwd: paths.root,
    encoding: 'buffer',
    shell: false,
  });
  if (result.error) {
    throw new Error(`execution receipt command could not start: ${result.error.message}`, { cause: result.error });
  }
  if (!Number.isInteger(result.status)) {
    throw new Error('execution receipt command did not produce an exit code');
  }

  const receipt = normalizeExecutionReceipt({
    receiptId: randomUUID(),
    command: {
      executable: command,
      args,
      cwd: paths.root,
    },
    exitCode: result.status,
    stdoutSha256: sha256(result.stdout || Buffer.alloc(0)),
    stderrSha256: sha256(result.stderr || Buffer.alloc(0)),
    observedAt: observedAt(now),
  });
  atomicWriteJson(receiptFile(paths, receipt.receiptId), receipt);
  return Object.freeze({
    ref: executionReceiptRef(receipt),
    receipt,
  });
}

/** Resolve only receipts created in this workspace's standalone state directory. */
export function resolveStandaloneExecutionReceipt({
  rootDir = process.cwd(),
  ref,
} = {}) {
  const receiptId = receiptIdFromRef(ref);
  if (!receiptId) return null;
  const paths = statePaths(rootDir);
  const target = receiptFile(paths, receiptId);
  if (!fs.existsSync(target)) return null;
  const receipt = normalizeExecutionReceipt(readJson(target, 'rex.execution-receipt.v1'));
  if (receipt.receiptId !== receiptId) {
    throw new Error(`execution receipt id does not match its file: ${receiptId}`);
  }
  return receipt;
}

export function presentStandaloneWorkflow(workflow, {
  stateRoot,
  outcome = 'status',
  blockedReason = undefined,
  missingEvidence = [],
} = {}) {
  const blocked = blockedReason === undefined ? {} : { blockedReason };
  return Object.freeze({
    schemaVersion: 1,
    kind: 'rex.standalone.workflow-result.v1',
    outcome,
    ...blocked,
    stateRoot,
    workflow,
    command: workflow.currentCommand,
    missingEvidence: Object.freeze([...missingEvidence]),
    instructions: Object.freeze(workflow.currentCommand ? [
      '只执行 command 指定的当前 Provider 和 objective，不要自行选择下一步。',
      '完成后使用当前 executionToken 提交 expectedEvidence 中的真实证据引用。',
      '证据被接受后重新读取返回的新 command；旧 token 会立即失效。',
    ] : [
      '工作流已经完成；无需再执行 Provider。',
    ]),
  });
}

export function startStandaloneWorkflow({
  rootDir = process.cwd(),
  workItemKey,
  request,
  decision = null,
  evaluation = null,
  createActivationId,
  profile = 'default',
  workflowActivationId = randomUUID(),
  now = new Date(),
} = {}) {
  const paths = statePaths(rootDir);
  const existing = readByWorkItem(paths, workItemKey);
  if (existing && !['completed', 'blocked'].includes(existing.status)) {
    throw new Error(`rex standalone work item already exists: ${workItemKey}; use resume`);
  }
  const workflow = sealCurrentCommand(startSoftwareWorkflow({
    workflowActivationId,
    workItemKey,
    request,
    decision,
    evaluation,
    createActivationId,
    profile,
    now,
  }));
  writeWorkflow(paths, workflow);
  return presentStandaloneWorkflow(workflow, {
    stateRoot: paths.stateRoot,
    outcome: 'started',
  });
}

export function persistStandaloneWorkflow({ rootDir = process.cwd(), workflow } = {}) {
  if (workflow?.kind !== 'rex.software-workflow-activation.v1') {
    throw new TypeError('persistStandaloneWorkflow requires a rex software workflow');
  }
  writeWorkflow(statePaths(rootDir), workflow);
  return workflow;
}

export function findStandaloneWorkflow({
  rootDir = process.cwd(),
  workItemKey = '',
  workflowActivationId = '',
  activationId = '',
} = {}) {
  const paths = statePaths(rootDir);
  if (text(workItemKey) || text(workflowActivationId)) {
    try {
      return readStandaloneWorkflow({ rootDir, workItemKey, workflowActivationId });
    } catch (error) {
      if (!text(activationId)) throw error;
    }
  }
  const wanted = text(activationId);
  if (!wanted) {
    throw new Error('rex standalone lookup requires workItemKey, workflowActivationId, or activationId');
  }
  const workflow = listWorkflows(paths).find((candidate) => (
    candidate.currentActivation?.activationId === wanted
    || candidate.activationHistory?.some((activation) => activation.activationId === wanted)
  ));
  if (!workflow) throw new Error(`rex standalone activation not found: ${wanted}`);
  return presentStandaloneWorkflow(workflow, { stateRoot: paths.stateRoot });
}

export function readStandaloneWorkflow({
  rootDir = process.cwd(),
  workItemKey = '',
  workflowActivationId = '',
} = {}) {
  const paths = statePaths(rootDir);
  const workflow = workflowActivationId
    ? readByWorkflowId(paths, workflowActivationId)
    : readByWorkItem(paths, workItemKey);
  if (!workflow) {
    const target = workflowActivationId || workItemKey || '(missing selector)';
    throw new Error(`rex standalone workflow not found: ${target}`);
  }
  return presentStandaloneWorkflow(workflow, { stateRoot: paths.stateRoot });
}

export function submitStandaloneEvidence({
  rootDir = process.cwd(),
  activationId,
  commandToken,
  evidence = [],
  testabilityDecision,
  requirementsDecision,
  now = new Date(),
} = {}) {
  const paths = statePaths(rootDir);
  const workflow = listWorkflows(paths).find((candidate) => (
    candidate.currentActivation?.activationId === text(activationId)
  ));
  if (!workflow) throw new Error(`rex standalone activation not found: ${activationId}`);

  const command = workflow.currentCommand;
  if (!command || text(command.executionToken) !== text(commandToken)) {
    throw new Error('rex standalone evidence requires the current Command token');
  }
  const resolveReceipt = (ref) => resolveStandaloneExecutionReceipt({ rootDir: paths.root, ref });
  const normalizedEvidence = validateCommandEvidence(command, evidence, { resolveReceipt });
  const advanced = advanceSoftwareWorkflow(workflow, normalizedEvidence, {
    now,
    testabilityDecision,
    requirementsDecision,
    resolveReceipt,
  });
  // 显式拒绝的证据保留当前 Command，调用者才能按原身份重试。
  const sealedWorkflow = advanced.blockedReason === undefined
    ? sealCurrentCommand(advanced.workflow)
    : advanced.workflow;
  writeWorkflow(paths, sealedWorkflow);
  appendEvidence(paths, workflow, command, normalizedEvidence, now);

  return presentStandaloneWorkflow(sealedWorkflow, {
    stateRoot: paths.stateRoot,
    outcome: advanced.outcome,
    blockedReason: advanced.blockedReason,
    missingEvidence: advanced.missingEvidence,
  });
}

// ---------------------------------------------------------------------------
// Turn settlement gate（结算门）
//
// 借鉴 LoopX settlement：VALIDATION → DURABLE_WRITEBACK → 幂等记账，顺序固定。
// 只有 material 结果产生副作用；effectRef 重复即拒绝（防重复计数）；bypass turn
// 的 material 声明在此被代码级封印，而不是依赖 prompt 自觉。
// ---------------------------------------------------------------------------

function readSettlementRows(paths, workflowActivationId) {
  const target = settlementFile(paths, workflowActivationId);
  if (!fs.existsSync(target)) return [];
  return fs.readFileSync(target, 'utf8')
    .split('\n')
    .filter((line) => line.trim())
    .map((line) => JSON.parse(line));
}

function appendSettlementRow(paths, row) {
  fs.mkdirSync(paths.settlements, { recursive: true });
  fs.appendFileSync(settlementFile(paths, row.turnKey.workflowActivationId), `${JSON.stringify(row)}\n`, 'utf8');
}

function settlementRejection(paths, envelope, reason, now) {
  const row = {
    schemaVersion: 1,
    kind: TURN_SETTLEMENT_KIND,
    turnKey: envelope.turnKey,
    effectRef: envelope.effectRef,
    outcome: envelope.outcome,
    decision: 'rejected',
    reason,
    bypass: envelope.bypass,
    commandTokenFingerprint: sha256(envelope.commandToken),
    settledAt: now.toISOString(),
  };
  appendSettlementRow(paths, row);
  return row;
}

/**
 * 结算一个 turn：envelope 校验 → token/effectRef 绑定校验 → 幂等检查 →
 * bypass 封印 → 证据校验 → CAS 写回 → 记账。任何一步失败都不产生工作流副作用。
 */
export function settleStandaloneTurn({
  rootDir = process.cwd(),
  turnResult,
  now = new Date(),
} = {}) {
  const envelope = normalizeTurnResult(turnResult);
  const paths = statePaths(rootDir);
  const workflow = readByWorkflowId(paths, envelope.turnKey.workflowActivationId);

  // 校验顺序即语义：先自洽性（envelope 与自己声明的 token 绑定），再幂等，
  // 再当前 token 授权——篡改与重放互不遮蔽。
  const selfConsistent = deriveEffectRef({ executionToken: envelope.commandToken, turnResult: envelope });
  if (selfConsistent !== envelope.effectRef) {
    const row = settlementRejection(paths, envelope, 'effect_ref_mismatch', now);
    return settlementResult(workflow, paths, row, {});
  }

  const accepted = readSettlementRows(paths, envelope.turnKey.workflowActivationId)
    .find((candidate) => candidate.kind === TURN_SETTLEMENT_KIND
      && candidate.decision === 'accepted'
      && candidate.effectRef === envelope.effectRef);
  if (accepted) {
    // 幂等重放：不重复写回、不重复记账，原样返回首次结算事实。
    return settlementResult(workflow, paths, accepted, { duplicate: true });
  }

  const command = workflow.currentCommand;
  if (!command || text(command.executionToken) !== text(envelope.commandToken)) {
    const row = settlementRejection(paths, envelope, 'stale_command_token', now);
    return settlementResult(workflow, paths, row, {});
  }

  // 状态回滚检测：当前 token 若已被一笔 material 结算消耗过（token 在结算后
  // 才轮换），说明工作流状态被回滚到结算前——fail-closed，拒绝继续结算。
  const currentFingerprint = sha256(command.executionToken);
  const rolledBack = readSettlementRows(paths, envelope.turnKey.workflowActivationId)
    .find((row) => row.kind === TURN_SETTLEMENT_KIND
      && row.decision === 'accepted'
      && isMaterialTurnResult(row)
      && row.commandTokenFingerprint === currentFingerprint);
  if (rolledBack) {
    const row = settlementRejection(paths, envelope, 'state_rollback_detected', now);
    return settlementResult(workflow, paths, row, {});
  }

  if (envelope.bypass && isMaterialTurnResult(envelope)) {
    const row = settlementRejection(paths, envelope, 'bypass_turn_material_outcome_forbidden', now);
    return settlementResult(workflow, paths, row, {});
  }

  // 非 material 结果（blocked/replan_required）是合法的"无进展报告"：
  // 记账但不推进工作流、不轮换 token、不计费——结算副作用只属于 material 结果。
  if (!isMaterialTurnResult(envelope)) {
    const row = {
      schemaVersion: 1,
      kind: TURN_SETTLEMENT_KIND,
      turnKey: envelope.turnKey,
      effectRef: envelope.effectRef,
      outcome: envelope.outcome,
      decision: 'accepted',
      bypass: envelope.bypass,
      commandTokenFingerprint: sha256(envelope.commandToken),
      settledAt: now.toISOString(),
    };
    appendSettlementRow(paths, row);
    return settlementResult(workflow, paths, row, {});
  }

  const resolveReceipt = (ref) => resolveStandaloneExecutionReceipt({ rootDir: paths.root, ref });
  let normalizedEvidence;
  try {
    normalizedEvidence = validateCommandEvidence(command, envelope.evidence, { resolveReceipt });
  } catch (error) {
    const row = settlementRejection(paths, envelope, `evidence_invalid: ${error.message}`, now);
    return settlementResult(workflow, paths, row, {});
  }

  const advanced = advanceSoftwareWorkflow(workflow, normalizedEvidence, { now, resolveReceipt });
  if (advanced.blockedReason !== undefined) {
    const row = settlementRejection(paths, envelope, `advance_blocked: ${advanced.blockedReason}`, now);
    return settlementResult(workflow, paths, row, {
      blockedReason: advanced.blockedReason,
      missingEvidence: advanced.missingEvidence,
    });
  }

  // 被拒绝的证据保留当前 Command（调用者按原身份重试）；接受才轮换 token。
  const sealedWorkflow = sealCurrentCommand(advanced.workflow);
  writeWorkflow(paths, sealedWorkflow, { expectedStatus: workflow.status });

  const row = {
    schemaVersion: 1,
    kind: TURN_SETTLEMENT_KIND,
    turnKey: envelope.turnKey,
    effectRef: envelope.effectRef,
    outcome: envelope.outcome,
    decision: 'accepted',
    bypass: envelope.bypass,
    commandTokenFingerprint: sha256(envelope.commandToken),
    settledAt: now.toISOString(),
  };
  appendSettlementRow(paths, row);
  return settlementResult(sealedWorkflow, paths, row, {
    advancedOutcome: advanced.outcome,
    missingEvidence: advanced.missingEvidence,
  });
}

function settlementResult(workflow, paths, row, extras) {
  return {
    schemaVersion: 1,
    kind: 'rex.standalone.turn-settlement-result.v1',
    settlement: Object.freeze({
      decision: row.decision,
      effectRef: row.effectRef,
      outcome: row.outcome,
      turnKey: row.turnKey,
      reason: row.reason,
      duplicate: Boolean(extras.duplicate),
      settledAt: row.settledAt,
    }),
    ...presentStandaloneWorkflow(workflow, {
      stateRoot: paths.stateRoot,
      outcome: row.decision === 'accepted' ? (extras.advancedOutcome ?? 'settled') : row.decision,
      blockedReason: extras.blockedReason,
      missingEvidence: extras.missingEvidence,
    }),
  };
}

/** 只读投影：一个工作流的全部 settlement 记录（verify / dashboard 共用）。 */
export function readStandaloneSettlements({
  rootDir = process.cwd(),
  workflowActivationId,
} = {}) {
  const paths = statePaths(rootDir);
  return readSettlementRows(paths, workflowActivationId);
}
