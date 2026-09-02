import { CAPABILITY } from '../domain/capability-ids.mjs';
import { deriveChangeRiskFacts } from '../domain/change-risk-assessment.mjs';
import { FACT } from '../domain/fact-kinds.mjs';
import { normalizeFacts } from '../domain/facts.mjs';
import { OBSERVATION, normalizeObservations } from '../domain/observation-kinds.mjs';
import {
  TESTABILITY_DECISION,
  normalizeTestabilityDecision,
  testabilityEvidenceRefs,
} from '../domain/testability-decision.mjs';
import { normalizeRequirementsDecision } from '../domain/requirements-decision.mjs';
import { normalizeExplicitIntent } from '../domain/explicit-intent.mjs';

/* 北极星原则：事实只来自显式声明——结构化 Observation 或显式 intent。
 * 程序绝不用关键词正则从自由文本猜"是否行为变更 / 是否只读 / 是否新构造 /
 * 是否失败 / 是否多步 / 是否设计决策 / 是否路径未知 / 是否风险域"。这些是
 * 语义判断，由调用方/模型显式声明（OBSERVATION / explicitIntent）后程序才
 * 建立对应事实；无声明时不建立任何猜测事实，capability 决策回退确定性默认。 */

const OBSERVATION_TO_FACT = new Map([
  [OBSERVATION.EXECUTION_FAILED, FACT.EXECUTION_FAILED],
  [OBSERVATION.REGRESSION_OBSERVED, FACT.REGRESSION_OBSERVED],
  [OBSERVATION.BEHAVIOR_CHANGE, FACT.BEHAVIOR_CHANGE],
  [OBSERVATION.HIGH_RISK_BOUNDARY, FACT.HIGH_RISK_BOUNDARY],
  [OBSERVATION.NEW_CONSTRUCT_PROPOSED, FACT.NEW_CONSTRUCT_PROPOSED],
  [OBSERVATION.IMPLEMENTATION_READY, FACT.IMPLEMENTATION_READY],
  [OBSERVATION.DIFF_READY, FACT.DIFF_READY],
  [OBSERVATION.SPECIALIST_REVIEW_REQUIRED, FACT.SPECIALIST_REVIEW_REQUIRED],
  [OBSERVATION.DEPENDENT_WORK_ITEMS, FACT.DEPENDENT_WORK_ITEMS],
  [OBSERVATION.INDEPENDENT_WORKSTREAMS, FACT.INDEPENDENT_WORKSTREAMS],
  [OBSERVATION.CONTINUITY_REQUIRED, FACT.CONTINUITY_REQUIRED],
  [OBSERVATION.DESIGN_DECISION_BLOCKED, FACT.DESIGN_DECISION_BLOCKED],
  [OBSERVATION.PATH_UNKNOWN, FACT.PATH_UNKNOWN],
]);

/** 北极星原则：行为变更由显式 intent 声明（implement/debug/ops），
 * 程序不根据"实现/修改/修复"等文本词猜行为变更。 */
const BEHAVIOR_CHANGE_INTENTS = new Set(['implement', 'debug', 'ops']);

/**
 * 把显式 Observation 与显式 intent 规整成结构化 Fact。
 * 请求文本只作为记录保留（request:current），不再参与任何语义推导。
 */
export function deriveSoftwareFacts({
  message = '',
  explicitIntent = null,
  observations = [],
  completedCapabilities = [],
  testabilityDecision = null,
  requirementsDecision = null,
} = {}) {
  const facts = new Map();
  const normalizedRequirementsDecision = requirementsDecision
    ? normalizeRequirementsDecision(requirementsDecision)
    : null;
  const addFact = (kind, evidenceRefs, value) => {
    const current = facts.get(kind);
    if (current?.value !== undefined && value !== undefined && current.value !== value) {
      throw new TypeError(`conflicting values for fact ${kind}`);
    }
    const refs = new Set([...(current?.evidenceRefs || []), ...evidenceRefs]);
    facts.set(kind, { evidenceRefs: refs, value: current?.value ?? value });
  };

  const structuredObservations = normalizedRequirementsDecision
    ? [...observations, ...normalizedRequirementsDecision.observations]
    : observations;
  for (const observation of normalizeObservations(structuredObservations)) {
    const factKind = OBSERVATION_TO_FACT.get(observation.kind);
    if (factKind) addFact(factKind, observation.evidenceRefs);
    if (observation.kind === OBSERVATION.CHANGE_RISK_ASSESSED) {
      for (const fact of deriveChangeRiskFacts(observation.changeRisk, observation.evidenceRefs)) {
        addFact(fact.kind, fact.evidenceRefs, fact.value);
      }
    }
  }

  // 请求文本作为可见记录保留，供宿主/模型引用；不参与事实推导。
  void message;

  if (normalizedRequirementsDecision) {
    addFact(FACT.REQUIREMENTS_DECISION_RECORDED, [normalizedRequirementsDecision.decisionRef]);
  }
  const intentResult = normalizeExplicitIntent(explicitIntent);
  const intent = intentResult.value;
  if (intentResult.status === 'known') {
    addFact(FACT.EXPLICIT_INTENT, [`intent:${intent}`], intent);
  }
  if (intentResult.status === 'unknown') {
    addFact(FACT.EXPLICIT_INTENT_UNKNOWN, [`intent:${intentResult.raw}`], intentResult.raw);
  }

  // 显式 intent 驱动的确定性事实推导（非文本猜测）：
  if (BEHAVIOR_CHANGE_INTENTS.has(intent)) addFact(FACT.BEHAVIOR_CHANGE, [`intent:${intent}`]);
  if (intent === 'wayfinder') addFact(FACT.PATH_UNKNOWN, ['intent:wayfinder']);
  if (intent === 'plan' || intent === 'planned') addFact(FACT.DEPENDENT_WORK_ITEMS, [`intent:${intent}`]);
  if (intent === 'team') addFact(FACT.INDEPENDENT_WORKSTREAMS, ['intent:team']);
  if (intent === 'harness') addFact(FACT.CONTINUITY_REQUIRED, ['intent:harness']);

  const completed = new Set(completedCapabilities);
  if (facts.has(FACT.BEHAVIOR_CHANGE) && completed.has(CAPABILITY.TESTING_DESIGN)) {
    addFact(FACT.TEST_SCOPE_CONFIRMED, [`activation:${CAPABILITY.TESTING_DESIGN}:completed`]);
    if (testabilityDecision) {
      const decision = normalizeTestabilityDecision(testabilityDecision);
      if (decision.kind === TESTABILITY_DECISION.BEHAVIOR_DELTA) {
        addFact(FACT.HONEST_RED_CANDIDATE, testabilityEvidenceRefs(decision));
      }
      if (decision.kind === TESTABILITY_DECISION.HARDENING) {
        addFact(FACT.BEHAVIOR_PRESERVING_HARDENING, testabilityEvidenceRefs(decision));
      }
    }
  }
  if (completed.has(CAPABILITY.DEBUG_ROOT_CAUSE)) {
    addFact(FACT.IMPLEMENTATION_READY, [`activation:${CAPABILITY.DEBUG_ROOT_CAUSE}:completed`]);
  }
  if (
    completed.has(CAPABILITY.IMPLEMENTATION_EXECUTE)
    || completed.has(CAPABILITY.TESTING_TDD)
    || completed.has(CAPABILITY.TESTING_STRICT_TDD)
    || completed.has(CAPABILITY.TESTING_HARDENING)
  ) {
    const source = completed.has(CAPABILITY.IMPLEMENTATION_EXECUTE)
      ? CAPABILITY.IMPLEMENTATION_EXECUTE
      : completed.has(CAPABILITY.TESTING_TDD)
        ? CAPABILITY.TESTING_TDD
        : completed.has(CAPABILITY.TESTING_STRICT_TDD)
          ? CAPABILITY.TESTING_STRICT_TDD
          : CAPABILITY.TESTING_HARDENING;
    addFact(FACT.DIFF_READY, [`activation:${source}:completed`]);
  }

  return normalizeFacts([...facts.entries()].map(([kind, fact]) => ({
    kind,
    evidenceRefs: [...fact.evidenceRefs],
    ...(fact.value === undefined ? {} : { value: fact.value }),
  })));
}
