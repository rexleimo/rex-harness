import { randomUUID } from 'node:crypto';

import { advanceActivation } from '../application/advance-activation.mjs';
import { evaluateSoftwareRequest } from '../application/evaluate-request.mjs';
import { nextCommand, startActivation, capabilityForActivation } from '../application/start-activation.mjs';
import { validateCommandEvidence } from '../application/validate-command-evidence.mjs';
import { CAPABILITY } from '../domain/capability-ids.mjs';
import {
  TESTABILITY_DECISION,
  normalizeTestabilityDecision,
  validateTestabilityDecisionReceipt,
} from '../domain/testability-decision.mjs';
import { normalizeRequirementsDecision } from '../domain/requirements-decision.mjs';
import { normalizeExplicitIntent } from '../domain/explicit-intent.mjs';
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
  const explicitIntent = normalizeExplicitIntent(request.explicitIntent);
  const normalized = {
    message: text(request.message),
    explicitIntent: explicitIntent.status === 'known'
      ? explicitIntent.value
      : (explicitIntent.status === 'unknown' ? explicitIntent.raw : null),
    observations: Object.freeze([...(request.observations || [])]),
  };
  if (request.requirementsDecision !== undefined && request.requirementsDecision !== null) {
    normalized.requirementsDecision = request.requirementsDecision;
  }
  return Object.freeze(normalized);
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

function evaluateNext(
  request,
  completedCapabilities,
  profile,
  testabilityDecision = null,
  requirementsDecision = null,
) {
  const result = evaluateSoftwareRequest({
    ...request,
    profile,
    completedCapabilities: completedForSelection(completedCapabilities),
    testabilityDecision,
    requirementsDecision,
  });
  return result;
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
  if (!decision || decision.blocked) {
    return Object.freeze({ activation: null, command: null, blockedReason: decision?.blockedReason || '' });
  }
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

function isRequirementsStage(activation) {
  return activation?.capabilityId === CAPABILITY.REQUIREMENTS_CLARIFY
    && activation.stageId === 'clarify';
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

function requirementsDecisionEvidenceRefs(evidence) {
  return new Set((evidence || [])
    .filter((item) => item?.kind === 'requirements-decision-recorded')
    .flatMap((item) => item.refs || []));
}

function resolveRequirementsDecision(workflow, evidence, suppliedDecision) {
  if (!isRequirementsStage(workflow.currentActivation)) {
    if (suppliedDecision !== undefined) {
      throw new Error('requirements decision can only be submitted at the requirements clarify stage');
    }
    return workflow.requirementsDecision || null;
  }
  const refs = requirementsDecisionEvidenceRefs(evidence);
  const persisted = workflow.requirementsDecision || null;
  if (refs.size === 0) {
    if (suppliedDecision !== undefined) {
      throw new Error('requirements decision requires requirements-decision-recorded evidence');
    }
    return persisted;
  }
  if (suppliedDecision === undefined) {
    if (!persisted) {
      throw new Error('requirements-decision-recorded evidence requires a typed requirements decision');
    }
    if (!refs.has(persisted.decisionRef)) {
      throw new Error('requirements decisionRef must be included in requirements-decision-recorded evidence');
    }
    return persisted;
  }
  const decision = normalizeRequirementsDecision(suppliedDecision);
  if (!refs.has(decision.decisionRef)) {
    throw new Error('requirements decisionRef must be included in requirements-decision-recorded evidence');
  }
  return decision;
}

function commandContract(workflow) {
  if (['completed', 'blocked'].includes(workflow?.status) && !workflow.currentActivation && !workflow.currentCommand) {
    return Object.freeze({ expectedEvidence: Object.freeze([]) });
  }
  const activation = workflow?.currentActivation;
  const command = workflow?.currentCommand;
  if (!activation || !command) throw new Error('active software workflow is missing its current command contract');
  const capability = capabilityForActivation(activation, { profile: workflow.profile });
  const stage = capability.recipe.stages[activation.stageIndex];
  if (!stage || stage.id !== activation.stageId) {
    throw new Error('current activation stage does not match its recipe');
  }
  for (const field of ['activationId', 'capabilityId', 'recipeId', 'stageId']) {
    if (command[field] !== activation[field]) {
      throw new Error(`current Command ${field} does not match current Activation`);
    }
  }
  if (command.type !== 'provider.invoke') {
    throw new Error('current Command has an invalid type');
  }
  const persistedEvidence = command.expectedEvidence;
  if (persistedEvidence !== undefined) {
    if (!Array.isArray(persistedEvidence) || persistedEvidence.some((kind) => (
      typeof kind !== 'string' || !stage.requiredEvidence.includes(kind)
    ))) {
      throw new Error('current Command expectedEvidence does not match its recipe stage');
    }
  }
  return Object.freeze({
    expectedEvidence: Object.freeze(
      persistedEvidence?.length ? [...new Set(persistedEvidence)] : [...stage.requiredEvidence],
    ),
  });
}

export function assertSoftwareWorkflowCommandContract(workflow) {
  return commandContract(workflow);
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

export function expectedScenarioCommandForWorkflow(workflow) {
  return expectedScenarioCommand(workflow);
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
  blockedReason = '',
  testabilityDecision,
  requirementsDecision,
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
    blockedReason: text(blockedReason),
    testabilityDecision: testabilityDecision || null,
    requirementsDecision: requirementsDecision || null,
    executionProfile: executionProfile(activationHistory, currentActivation),
    createdAt,
    updatedAt,
  });
}

/**
 * 创建与宿主无关的软件工作流。它只发出当前一条 Command，既不启动模型，
 * 也不依赖 AIOS 的计划、ContextDB 或进程生命周期。
 * `request.requirementsDecision` 表示外部已完成消歧的类型化 artifact，
 * 会故意跳过 Requirements clarify activation；需求再次变化时必须新开 workflow。
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
      requirementsDecision: evaluation.requirementsDecision || normalizedRequest.requirementsDecision || null,
    })
    : decision
      ? Object.freeze({
        facts: Object.freeze([]),
        decision,
        promotion: null,
        requirementsDecision: normalizedRequest.requirementsDecision || null,
      })
      : evaluateNext(
        normalizedRequest,
        [],
        profile,
        null,
        normalizedRequest.requirementsDecision,
      );
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
    status: current.blockedReason ? 'blocked' : (current.activation ? 'active' : 'completed'),
    completedCapabilities: [],
    activationHistory: [],
    currentActivation: current.activation,
    currentCommand: current.command,
    facts: evaluated.facts,
    promotion: evaluated.promotion,
    blockedReason: current.blockedReason,
    testabilityDecision: null,
    requirementsDecision: evaluated.requirementsDecision,
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
  requirementsDecision,
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
  if (workflow.status === 'blocked' && !workflow.currentActivation && !workflow.currentCommand) {
    return Object.freeze({
      outcome: 'blocked',
      blockedReason: workflow.blockedReason || 'workflow-blocked',
      workflow,
      completedActivation: null,
      missingEvidence: Object.freeze([]),
      nextCapability: null,
    });
  }
  if (!workflow.currentActivation || !workflow.currentCommand) {
    throw new Error('active software workflow is missing its current activation or command');
  }

  let currentCommandContract;
  try {
    currentCommandContract = commandContract(workflow);
  } catch {
    return Object.freeze({
      outcome: 'blocked',
      blockedReason: 'command-invalid',
      workflow,
      completedActivation: null,
      missingEvidence: Object.freeze([]),
      nextCapability: null,
    });
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
  const resolvedRequirementsDecision = resolveRequirementsDecision(
    workflow,
    normalizedEvidence,
    requirementsDecision,
  );

  const capabilityResult = advanceActivation(workflow.currentActivation, normalizedEvidence, {
    profile: workflow.profile,
    providerBindings,
    requiredEvidence: currentCommandContract.expectedEvidence,
  });
  const updatedAt = timestamp(now);

  if (capabilityResult.outcome !== 'completed') {
    const nextWorkflow = createWorkflowState({
      ...workflow,
      status: 'active',
      currentActivation: capabilityResult.activation,
      currentCommand: capabilityResult.command,
      testabilityDecision: workflow.testabilityDecision,
      requirementsDecision: workflow.requirementsDecision || resolvedRequirementsDecision,
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
  const nextRequirementsDecision = isRequirementsStage(workflow.currentActivation)
    ? (resolvedRequirementsDecision || workflow.requirementsDecision)
    : workflow.requirementsDecision;
  if (nextTestabilityDecision?.kind === TESTABILITY_DECISION.BLOCKED) {
    const blockedWorkflow = createWorkflowState({
      ...workflow,
      status: 'blocked',
      completedCapabilities,
      activationHistory,
      currentActivation: null,
      currentCommand: null,
      testabilityDecision: nextTestabilityDecision,
      requirementsDecision: nextRequirementsDecision,
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
    nextRequirementsDecision,
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
    status: current.blockedReason ? 'blocked' : (current.activation ? 'active' : 'completed'),
    completedCapabilities,
    activationHistory,
    currentActivation: current.activation,
    currentCommand: current.command,
    facts: evaluated.facts,
    promotion: evaluated.promotion,
    blockedReason: current.blockedReason,
    testabilityDecision: nextTestabilityDecision,
    requirementsDecision: nextRequirementsDecision,
    updatedAt,
  });

  return Object.freeze({
    outcome: current.blockedReason ? 'blocked' : 'completed',
    blockedReason: current.blockedReason || undefined,
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
