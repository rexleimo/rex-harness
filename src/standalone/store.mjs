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
  advanceSoftwareWorkflow,
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

function writeWorkflow(paths, workflow) {
  atomicWriteJson(activationFile(paths, workflow.workflowActivationId), workflow);
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
  return readJson(target, 'rex.software-workflow-activation.v1');
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
  missingEvidence = [],
} = {}) {
  return Object.freeze({
    schemaVersion: 1,
    kind: 'rex.standalone.workflow-result.v1',
    outcome,
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
  profile = 'default',
  workflowActivationId = randomUUID(),
  now = new Date(),
} = {}) {
  const paths = statePaths(rootDir);
  const existing = readByWorkItem(paths, workItemKey);
  if (existing) {
    throw new Error(`rex standalone work item already exists: ${workItemKey}; use resume`);
  }
  const workflow = sealCurrentCommand(startSoftwareWorkflow({
    workflowActivationId,
    workItemKey,
    request,
    profile,
    now,
  }));
  writeWorkflow(paths, workflow);
  return presentStandaloneWorkflow(workflow, {
    stateRoot: paths.stateRoot,
    outcome: 'started',
  });
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
    resolveReceipt,
  });
  const sealedWorkflow = sealCurrentCommand(advanced.workflow);
  writeWorkflow(paths, sealedWorkflow);
  appendEvidence(paths, workflow, command, normalizedEvidence, now);

  return presentStandaloneWorkflow(sealedWorkflow, {
    stateRoot: paths.stateRoot,
    outcome: advanced.outcome,
    missingEvidence: advanced.missingEvidence,
  });
}
