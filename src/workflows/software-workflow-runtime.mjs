import { randomUUID } from 'node:crypto';

import { advanceActivation } from '../application/advance-activation.mjs';
import { evaluateSoftwareRequest } from '../application/evaluate-request.mjs';
import { nextCommand, startActivation } from '../application/start-activation.mjs';
import { validateCommandEvidence } from '../application/validate-command-evidence.mjs';
import { CAPABILITY } from '../domain/capability-ids.mjs';
import {
  TESTABILITY_DECISION,
  normalizeTestabilityDecision,
  validateTestabilityDecisionReceipt,
} from '../domain/testability-decision.mjs';
import { analyzeExecutionProfile } from './execution-profile.mjs';

export const SOFTWARE_WORKFLOW_ID = 'adaptive-software-delivery';

const DISCOVERY_CAPABILITIES = new Set([
  CAPABILITY.REQUIREMENTS_CLARIFY,
  CAPABILITY.DESIGN_RESOLVE,
  CAPABILITY.PLANNING_SEQUENCE,
  CAPABILITY.IMPLEMENTATION_MINIMIZE,
  CAPABILITY.NAVIGATION_WAYFIND,
]);
const ASSURANCE_CAPABILITIES = new Set([
  CAPABILITY.REVIEW_STANDARDS_SPEC,
  CAPABILITY.REVIEW_SPECIALIST,
]);

function text(value) {
  return String(value || '').trim();
}

function timestamp(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) throw new TypeError('workflow now must be a valid date');
  return date.toISOString();
}

function normalizeRequest(request = {}) {
  if (!request || typeof request !== 'object' || Array.isArray(request)) {
    throw new TypeError('software workflow request must be an object');
  }
  return Object.freeze({
    message: text(request.message),
    explicitIntent: request.explicitIntent ?? null,
    observations: Object.freeze([...(request.observations || [])]),
  });
}

function phaseForCapability(capabilityId) {
  if (!capabilityId) return 'completed';
  if (ASSURANCE_CAPABILITIES.has(capabilityId)) return 'assurance';
  if (DISCOVERY_CAPABILITIES.has(capabilityId)) return 'discovery';
  return 'delivery';
}

function completedForSelection(completedCapabilities) {
  const completed = new Set(completedCapabilities);
  // 基础和严格 TDD 的 GREEN 都已经产出实现。只在选择层把独立实施
  // 视为已满足，避免 implementation-ready 令宿主重复修改同一切片；
  // 审计记录仍只保存实际执行过的 TDD Activation。
  if (
    completed.has(CAPABILITY.TESTING_TDD)
    || completed.has(CAPABILITY.TESTING_STRICT_TDD)
    || completed.has(CAPABILITY.TESTING_HARDENING)
  ) {
    completed.add(CAPABILITY.TESTING_DESIGN);
    completed.add(CAPABILITY.IMPLEMENTATION_EXECUTE);
  }
  return [...completed];
}

function evaluateNext(request, completedCapabilities, profile, testabilityDecision = null) {
  return evaluateSoftwareRequest({
    ...request,
    profile,
    completedCapabilities: completedForSelection(completedCapabilities),
    testabilityDecision,
  });
}

function resolveActivationId(createActivationId, context) {
  const id = text((createActivationId || randomUUID)(context));
  if (!id) throw new TypeError('software workflow activation id factory returned an empty id');
  return id;
}

function startCapability(decision, {
  workflowActivationId,
  stepIndex,
  profile,
  providerBindings,
  createActivationId,
}) {
  if (!decision) return Object.freeze({ activation: null, command: null });
  const activation = startActivation(decision, {
    activationId: resolveActivationId(createActivationId, {
      workflowActivationId,
      stepIndex,
      capabilityId: decision.capabilityId,
    }),
    profile,
  });
  const command = nextCommand(activation, { profile, providerBindings });
  return Object.freeze({ activation, command });
}

function executionProfile(activationHistory, currentActivation) {
  return analyzeExecutionProfile([
    ...activationHistory,
    ...(currentActivation ? [currentActivation] : []),
  ]);
}

function isTestabilityStage(activation) {
  return activation?.capabilityId === CAPABILITY.TESTING_DESIGN
    && activation.stageId === 'decide-testability';
}

function decisionEvidenceRefs(evidence) {
  return new Set((evidence || [])
    .filter((item) => item?.kind === 'testability-decision-recorded')
    .flatMap((item) => item.refs || []));
}

function resolveTestabilityDecision(workflow, evidence, suppliedDecision, resolveReceipt) {
  if (!isTestabilityStage(workflow.currentActivation)) {
    if (suppliedDecision !== undefined) {
      throw new Error('testability decision can only be submitted at the decide-testability stage');
    }
    return workflow.testabilityDecision || null;
  }

  const refs = decisionEvidenceRefs(evidence);
  if (refs.size === 0) {
    if (suppliedDecision !== undefined) {
      throw new Error('testability decision requires testability-decision-recorded evidence');
    }
    return null;
  }
  if (suppliedDecision === undefined) {
    throw new Error('testability-decision-recorded evidence requires a typed testability decision');
  }
  const decision = validateTestabilityDecisionReceipt(
    normalizeTestabilityDecision(suppliedDecision),
    { resolveReceipt },
  );
  if (!refs.has(decision.decisionRef)) {
    throw new Error('testability decisionRef must be included in testability-decision-recorded evidence');
  }
  return decision;
}

function expectedScenarioCommand(workflow) {
  const activation = workflow.currentActivation;
  if (!activation) return null;
  const decision = workflow.testabilityDecision;
  const isTdd = activation.capabilityId === CAPABILITY.TESTING_TDD
    || activation.capabilityId === CAPABILITY.TESTING_STRICT_TDD;
  const isHardeningBaseline = activation.capabilityId === CAPABILITY.TESTING_HARDENING
    && activation.stageId === 'baseline';
  if (!isTdd && !isHardeningBaseline) return null;

  // Old workflows stored an unbound command string. Do not reinterpret it at
  // resume time: a new test-design activation must record a typed scenario.
  let normalized;
  try {
    normalized = normalizeTestabilityDecision(decision);
  } catch (error) {
    throw new Error(
      'legacy or invalid testability scenario cannot resume delivery; start a fresh test-design activation',
      { cause: error },
    );
  }
  if (isTdd && normalized.kind !== TESTABILITY_DECISION.BEHAVIOR_DELTA) {
    throw new Error('TDD requires a behavior-delta testability scenario');
  }
  if (isHardeningBaseline && normalized.kind !== TESTABILITY_DECISION.HARDENING) {
    throw new Error('hardening baseline requires a hardening testability scenario');
  }
  return (normalized.redCandidate || normalized.baseline).command;
}

function createWorkflowState({
  workflowActivationId,
  workItemKey,
  request,
  profile,
  status,
  completedCapabilities,
  activationHistory,
  currentActivation,
  currentCommand,
  facts,
  promotion,
  testabilityDecision,
  createdAt,
  updatedAt,
}) {
  return Object.freeze({
    schemaVersion: 1,
    kind: 'rex.software-workflow-activation.v1',
    workflowActivationId,
    workflowId: SOFTWARE_WORKFLOW_ID,
    workItemKey,
    profile,
    request,
    status,
    stepIndex: activationHistory.length,
    phaseId: phaseForCapability(currentActivation?.capabilityId),
    currentCapabilityId: currentActivation?.capabilityId || '',
    completedCapabilities: Object.freeze([...completedCapabilities]),
    activationHistory: Object.freeze([...activationHistory]),
    currentActivation,
    currentCommand,
    facts: Object.freeze([...(facts || [])]),
    promotion: promotion || null,
    testabilityDecision: testabilityDecision || null,
    executionProfile: executionProfile(activationHistory, currentActivation),
    createdAt,
    updatedAt,
  });
}

/**
 * 创建与宿主无关的软件工作流。它只发出当前一条 Command，既不启动模型，
 * 也不依赖 AIOS 的计划、ContextDB 或进程生命周期。
 */
export function startSoftwareWorkflow({
  workflowActivationId = randomUUID(),
  workItemKey = '',
  request = {},
  decision = null,
  evaluation = null,
  profile = 'default',
  providerBindings = [],
  createActivationId,
  now = new Date(),
} = {}) {
  const id = text(workflowActivationId);
  if (!id) throw new TypeError('software workflow requires workflowActivationId');
  const normalizedRequest = normalizeRequest(request);
  const evaluated = evaluation
    ? Object.freeze({
      facts: Object.freeze([...(evaluation.facts || [])]),
      decision: evaluation.decision || null,
      promotion: evaluation.promotion || null,
    })
    : decision
      ? Object.freeze({ facts: Object.freeze([]), decision, promotion: null })
      : evaluateNext(normalizedRequest, [], profile, null);
  const current = startCapability(evaluated.decision, {
    workflowActivationId: id,
    stepIndex: 0,
    profile,
    providerBindings,
    createActivationId,
  });
  const createdAt = timestamp(now);

  return createWorkflowState({
    workflowActivationId: id,
    workItemKey: text(workItemKey),
    request: normalizedRequest,
    profile,
    status: current.activation ? 'active' : 'completed',
    completedCapabilities: [],
    activationHistory: [],
    currentActivation: current.activation,
    currentCommand: current.command,
    facts: evaluated.facts,
    promotion: evaluated.promotion,
    testabilityDecision: null,
    createdAt,
    updatedAt: createdAt,
  });
}

/**
 * 用当前 Capability 的类型化证据推进工作流。Capability 完成后，下一步仍由
 * rex 的 Fact/Capability 选择器计算，宿主不需要也不允许复制续转规则。
 */
export function advanceSoftwareWorkflow(workflow, evidence = [], {
  providerBindings = [],
  createActivationId,
  now = new Date(),
  testabilityDecision,
  resolveReceipt,
} = {}) {
  if (workflow?.kind !== 'rex.software-workflow-activation.v1') {
    throw new TypeError('advanceSoftwareWorkflow requires a rex software workflow activation');
  }
  if (workflow.status === 'completed') {
    return Object.freeze({
      outcome: 'completed',
      workflow,
      completedActivation: null,
      missingEvidence: Object.freeze([]),
      nextCapability: null,
    });
  }
  if (!workflow.currentActivation || !workflow.currentCommand) {
    throw new Error('active software workflow is missing its current activation or command');
  }

  // This is a public state-machine API, so enforce the same receipt boundary
  // used by persisted CLI and AIOS entry points before accepting any evidence.
  const scenarioCommand = expectedScenarioCommand(workflow);
  let normalizedEvidence;
  try {
    normalizedEvidence = validateCommandEvidence(workflow.currentCommand, evidence, {
      resolveReceipt,
      expectedScenarioCommand: scenarioCommand,
    });
  } catch {
    return Object.freeze({
      outcome: 'blocked',
      blockedReason: 'evidence-invalid',
      workflow,
      completedActivation: null,
      missingEvidence: Object.freeze([]),
      nextCapability: null,
    });
  }

  const resolvedTestabilityDecision = resolveTestabilityDecision(
    workflow,
    normalizedEvidence,
    testabilityDecision,
    resolveReceipt,
  );

  const capabilityResult = advanceActivation(workflow.currentActivation, normalizedEvidence, {
    profile: workflow.profile,
    providerBindings,
  });
  const updatedAt = timestamp(now);

  if (capabilityResult.outcome !== 'completed') {
    const nextWorkflow = createWorkflowState({
      ...workflow,
      status: 'active',
      currentActivation: capabilityResult.activation,
      currentCommand: capabilityResult.command,
      testabilityDecision: workflow.testabilityDecision,
      updatedAt,
    });
    return Object.freeze({
      outcome: capabilityResult.outcome,
      workflow: nextWorkflow,
      completedActivation: null,
      missingEvidence: capabilityResult.missingEvidence,
      nextCapability: null,
    });
  }

  const completedActivation = capabilityResult.activation;
  const completedCapabilities = [
    ...new Set([...workflow.completedCapabilities, completedActivation.capabilityId]),
  ];
  const activationHistory = [...workflow.activationHistory, completedActivation];
  const nextTestabilityDecision = isTestabilityStage(workflow.currentActivation)
    ? resolvedTestabilityDecision
    : workflow.testabilityDecision;
  if (nextTestabilityDecision?.kind === TESTABILITY_DECISION.BLOCKED) {
    const blockedWorkflow = createWorkflowState({
      ...workflow,
      status: 'blocked',
      completedCapabilities,
      activationHistory,
      currentActivation: null,
      currentCommand: null,
      testabilityDecision: nextTestabilityDecision,
      updatedAt,
    });
    return Object.freeze({
      outcome: 'replan',
      workflow: blockedWorkflow,
      completedActivation,
      missingEvidence: Object.freeze([]),
      nextCapability: null,
    });
  }
  const evaluated = evaluateNext(
    workflow.request,
    completedCapabilities,
    workflow.profile,
    nextTestabilityDecision,
  );
  const current = startCapability(evaluated.decision, {
    workflowActivationId: workflow.workflowActivationId,
    stepIndex: activationHistory.length,
    profile: workflow.profile,
    providerBindings,
    createActivationId,
  });
  const nextWorkflow = createWorkflowState({
    ...workflow,
    status: current.activation ? 'active' : 'completed',
    completedCapabilities,
    activationHistory,
    currentActivation: current.activation,
    currentCommand: current.command,
    facts: evaluated.facts,
    promotion: evaluated.promotion,
    testabilityDecision: nextTestabilityDecision,
    updatedAt,
  });

  return Object.freeze({
    outcome: 'completed',
    workflow: nextWorkflow,
    completedActivation,
    missingEvidence: Object.freeze([]),
    nextCapability: current.activation
      ? Object.freeze({
        decision: evaluated.decision,
        activation: current.activation,
        command: current.command,
        promotion: evaluated.promotion,
      })
      : null,
  });
}
