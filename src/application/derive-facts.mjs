import { CAPABILITY } from '../domain/capability-ids.mjs';
import { FACT } from '../domain/fact-kinds.mjs';
import { normalizeFacts } from '../domain/facts.mjs';
import { OBSERVATION, normalizeObservations } from '../domain/observation-kinds.mjs';

const OBSERVATION_TO_FACT = new Map([
  [OBSERVATION.EXECUTION_FAILED, FACT.EXECUTION_FAILED],
  [OBSERVATION.REGRESSION_OBSERVED, FACT.REGRESSION_OBSERVED],
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

const REQUIREMENTS_PATTERN = /\b(?:acceptance criteria|domain vocabulary|ubiquitous language|ambiguous requirements?|unclear requirements?)\b|验收(?:标准|条件)|领域(?:词汇|语言|模型)|需求(?:不清|歧义)|澄清需求/iu;
const BEHAVIOR_CHANGE_PATTERN = /\b(?:implement(?:ation|ing)?|add|update|change|fix|refactor|build|create|modify)\b|实现|新增|添加|更新|修改|修复|重构|构建|创建/iu;
const NEW_CONSTRUCT_PATTERN = /\b(?:add|create|introduce|new (?:module|helper|dependency|service|class|abstraction))\b|新增|添加|创建|新建|引入(?:依赖|模块|抽象)|(?:一个|一项)?新的?[\p{Script=Han}a-z0-9_-]{0,16}(?:模块|抽象|依赖|服务|类|组件|工具)/iu;
const FAILURE_PATTERN = /\b(?:(?:execution|command|build|test) fail(?:ed|ure)?|crash)\b|执行失败|命令失败|构建失败|测试失败|报错|崩溃/iu;
const DEPENDENT_PATTERN = /\b(?:first.+then|then.+finally|multi[-\s]?step|across (?:files|modules)|migration|workflow refactor)\b|先.+再|最后|多步骤|跨(?:文件|模块)|迁移|工作流重构/iu;
const DESIGN_PATTERN = /\b(?:architecture decision|design choice|choose (?:an )?architecture|compare design options)\b|架构决策|设计选择|方案选择|比较方案/iu;
const PATH_PATTERN = /\b(?:wayfinder|decision map|unknown (?:execution )?path|map (?:the )?decisions)\b|寻径|决策地图|路径未知|未知[\p{Script=Han}a-z0-9_-]{0,16}路径|路径(?:仍然)?(?:不清楚|不明确|不确定)|梳理决策/iu;
const READ_ONLY_INTENT_PATTERN = /解释|分析|说明|查看|检查|审阅|回答|\b(?:explain|analy[sz]e|review|inspect|describe)\b/iu;
const CHINESE_ACTION_SOURCE = '(?:修改|编辑|写入|实现|修复|变更|更新|新增|添加|创建|构建|重构)';
const ENGLISH_ACTION_SOURCE = '(?:modif(?:y|ies|ied|ying)|edit(?:s|ed|ing)?|writ(?:e|es|ing|ten)|implement(?:s|ed|ing)?|fix(?:es|ed|ing)?|chang(?:e|es|ed|ing)|updat(?:e|es|ed|ing)|add(?:s|ed|ing)?|creat(?:e|es|ed|ing)|build(?:s|ing|built)?|refactor(?:s|ed|ing)?)';
const NEGATED_CHINESE_ACTION_PATTERN = new RegExp(
  `(?:不要|无需|不需要|禁止|不得|别|不可|不)(?:(?![。！？.!?;；]|然后|之后|接着).){0,32}?${CHINESE_ACTION_SOURCE}(?:\\s*(?:[、，,]|或|以及|和|并(?:且)?)\\s*${CHINESE_ACTION_SOURCE})*`,
  'giu',
);
const NEGATED_ENGLISH_ACTION_PATTERN = new RegExp(
  `\\b(?:do\\s+not|don't|must\\s+not|never|without)(?:(?![.!?;]).){0,48}?\\b${ENGLISH_ACTION_SOURCE}\\b(?:\\s*(?:,\\s*(?:(?:and|or)\\s*)?|(?:and|or)\\s+)\\b${ENGLISH_ACTION_SOURCE}\\b)*`,
  'giu',
);

const RISK_DOMAIN_PATTERNS = Object.freeze([
  Object.freeze({
    ref: 'risk-domain:security',
    pattern: /\b(?:security|auth(?:entication|orization)?|secret|token|session|injection|credential|permission)\b|安全|鉴权|认证|授权|密钥|令牌|会话|注入|权限/iu,
  }),
  Object.freeze({
    ref: 'risk-domain:react',
    pattern: /\b(?:react|hydration|accessibility|a11y|component state|rendering behavior)\b|React|水合|可访问性|无障碍|组件状态|渲染行为/iu,
  }),
  Object.freeze({
    ref: 'risk-domain:typescript',
    pattern: /\b(?:typescript|type safety|strict mode|strictness|runtime validation|esm boundary)\b|TypeScript|类型安全|严格模式|运行时校验|ESM 边界/iu,
  }),
]);

function explicitIntentValue(explicitIntent) {
  if (typeof explicitIntent === 'string') return explicitIntent.trim().toLowerCase();
  if (!explicitIntent || typeof explicitIntent !== 'object') return '';
  return String(explicitIntent.intent || explicitIntent.kind || explicitIntent.route || '').trim().toLowerCase();
}

function removeNegatedActions(value) {
  let hadNegatedAction = false;
  let actionableValue = value;
  for (const pattern of [NEGATED_CHINESE_ACTION_PATTERN, NEGATED_ENGLISH_ACTION_PATTERN]) {
    actionableValue = actionableValue.replace(pattern, (match) => {
      hadNegatedAction = true;
      return ' '.repeat(match.length);
    });
  }
  return { actionableValue, hadNegatedAction };
}

/**
 * 把请求文本视为带明确来源的 Observation，而不是把模型直觉伪装成证据。
 * 结构化 Observation 会与文本推导合并；同类 Fact 的引用会去重。
 */
export function deriveSoftwareFacts({
  message = '',
  explicitIntent = null,
  observations = [],
  completedCapabilities = [],
} = {}) {
  const facts = new Map();
  const addFact = (kind, evidenceRefs) => {
    const refs = new Set([...(facts.get(kind) || []), ...evidenceRefs]);
    facts.set(kind, refs);
  };

  for (const observation of normalizeObservations(observations)) {
    const factKind = OBSERVATION_TO_FACT.get(observation.kind);
    if (factKind) addFact(factKind, observation.evidenceRefs);
  }

  const value = String(message || '').trim();
  const requestRef = ['request:current'];
  const intent = explicitIntentValue(explicitIntent);
  const { actionableValue, hadNegatedAction } = removeNegatedActions(value);
  const explicitReadOnly = ['direct', 'read-only', 'readonly', 'explain'].includes(intent);
  // 先移除否定动作，再判断是否仍有真实变更目标，避免整条消息级布尔值吞掉后续修复子句。
  const readOnly = explicitReadOnly || (
    (hadNegatedAction || READ_ONLY_INTENT_PATTERN.test(value))
    && !BEHAVIOR_CHANGE_PATTERN.test(actionableValue)
  );
  const classificationValue = readOnly ? '' : actionableValue;
  if (value && !readOnly) {
    if (REQUIREMENTS_PATTERN.test(classificationValue)) addFact(FACT.ACCEPTANCE_CRITERIA_MISSING, requestRef);
    if (BEHAVIOR_CHANGE_PATTERN.test(classificationValue)) addFact(FACT.BEHAVIOR_CHANGE, requestRef);
    if (NEW_CONSTRUCT_PATTERN.test(classificationValue)) addFact(FACT.NEW_CONSTRUCT_PROPOSED, requestRef);
    if (FAILURE_PATTERN.test(classificationValue)) addFact(FACT.EXECUTION_FAILED, requestRef);
    if (DEPENDENT_PATTERN.test(classificationValue)) addFact(FACT.DEPENDENT_WORK_ITEMS, requestRef);
    if (DESIGN_PATTERN.test(classificationValue)) addFact(FACT.DESIGN_DECISION_BLOCKED, requestRef);
    if (PATH_PATTERN.test(classificationValue)) addFact(FACT.PATH_UNKNOWN, requestRef);

    // 风险域只是 Specialist 的选择证据。Capability 仍要求 DIFF_READY，
    // 因此这些词不会在编码前抢占测试设计或实现阶段。
    for (const domain of RISK_DOMAIN_PATTERNS) {
      if (domain.pattern.test(classificationValue)) {
        addFact(FACT.SPECIALIST_REVIEW_REQUIRED, [domain.ref]);
      }
    }
  }

  if (intent === 'wayfinder') addFact(FACT.PATH_UNKNOWN, ['intent:wayfinder']);
  if (intent === 'plan' || intent === 'planned') addFact(FACT.DEPENDENT_WORK_ITEMS, [`intent:${intent}`]);
  if (intent === 'team') addFact(FACT.INDEPENDENT_WORKSTREAMS, ['intent:team']);
  if (intent === 'harness') addFact(FACT.CONTINUITY_REQUIRED, ['intent:harness']);

  const completed = new Set(completedCapabilities);
  if (facts.has(FACT.BEHAVIOR_CHANGE) && completed.has(CAPABILITY.TESTING_DESIGN)) {
    addFact(FACT.TEST_SCOPE_CONFIRMED, [`activation:${CAPABILITY.TESTING_DESIGN}:completed`]);
  }
  if (completed.has(CAPABILITY.DEBUG_ROOT_CAUSE)) {
    addFact(FACT.IMPLEMENTATION_READY, [`activation:${CAPABILITY.DEBUG_ROOT_CAUSE}:completed`]);
  }
  if (
    completed.has(CAPABILITY.IMPLEMENTATION_EXECUTE)
    || completed.has(CAPABILITY.TESTING_TDD)
    || completed.has(CAPABILITY.TESTING_STRICT_TDD)
  ) {
    const source = completed.has(CAPABILITY.IMPLEMENTATION_EXECUTE)
      ? CAPABILITY.IMPLEMENTATION_EXECUTE
      : completed.has(CAPABILITY.TESTING_TDD)
        ? CAPABILITY.TESTING_TDD
        : CAPABILITY.TESTING_STRICT_TDD;
    addFact(FACT.DIFF_READY, [`activation:${source}:completed`]);
  }

  return normalizeFacts([...facts.entries()].map(([kind, evidenceRefs]) => ({
    kind,
    evidenceRefs: [...evidenceRefs],
  })));
}
