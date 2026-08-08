import assert from 'node:assert/strict';
import test from 'node:test';

import {
  CAPABILITY,
  FACT,
  OBSERVATION,
  evaluateSoftwareRequest,
} from '../../src/index.mjs';

import { REQUIREMENTS_DECISION_FIXTURE } from '../fixtures/requirements-decision.mjs';

function honestRedDecision() {
  return {
    kind: 'behavior-delta',
    decisionRef: 'artifact:testability-decision',
    redCandidate: {
      publicEntry: 'validation endpoint',
      setup: 'Submit an invalid request before the behavior is implemented.',
      command: {
        executable: 'node',
        args: ['--test', 'tests/application/request-evaluation.test.mjs'],
        cwd: '/tmp/rex-request-evaluation',
      },
      expected: 'The invalid request is rejected.',
      observed: 'The invalid request is accepted before the behavior is implemented.',
      failureReason: 'The requested validation behavior is absent.',
      receiptRef: 'receipt:request-evaluation-red',
    },
  };
}

test('request observation derives traceable facts and selects only requirements clarification', () => {
  const result = evaluateSoftwareRequest({
    message: 'Clarify the domain vocabulary and acceptance criteria before implementing checkout.',
  });

  assert.ok(result.facts.some((fact) => fact.kind === FACT.ACCEPTANCE_CRITERIA_MISSING));
  assert.ok(result.facts.every((fact) => fact.evidenceRefs.includes('request:current')));
  assert.equal(result.decision.capabilityId, CAPABILITY.REQUIREMENTS_CLARIFY);
  assert.equal(result.decision.recipeId, 'software.requirements.clarify.recipe');
  assert.equal(result.decision.stageId, 'clarify');
});

test('structured observations take priority over request wording', () => {
  const result = evaluateSoftwareRequest({
    message: 'Continue implementing the current slice.',
    observations: [
      {
        kind: OBSERVATION.EXECUTION_FAILED,
        evidenceRefs: ['command:npm-test'],
      },
    ],
  });

  assert.ok(result.facts.some((fact) => fact.kind === FACT.EXECUTION_FAILED));
  assert.equal(result.decision.capabilityId, CAPABILITY.DEBUG_ROOT_CAUSE);
});

test('explicit intent normalizes string/object inputs and keeps implement behind test design', () => {
  const result = evaluateSoftwareRequest({
    message: 'Update authentication behavior.',
    explicitIntent: { intent: 'IMPLEMENT' },
  });

  assert.deepEqual(
    result.facts.find((fact) => fact.kind === FACT.EXPLICIT_INTENT),
    {
      kind: FACT.EXPLICIT_INTENT,
      value: 'implement',
      evidenceRefs: ['intent:implement'],
    },
  );
  assert.equal(result.decision.capabilityId, CAPABILITY.TESTING_DESIGN);
});

test('grill and spec intents enter Requirements without relying on weak prose', () => {
  for (const intent of ['grill', 'SPEC']) {
    const result = evaluateSoftwareRequest({ message: 'Please proceed.', explicitIntent: intent });
    assert.equal(result.decision.capabilityId, CAPABILITY.REQUIREMENTS_CLARIFY);
    assert.equal(result.decision.reasonCode, `explicit-intent-${intent.toLowerCase()}`);
  }
});

test('tickets intent selects Planning and suppresses weak Requirements rerouting', () => {
  const result = evaluateSoftwareRequest({
    message: '把登录逻辑改一下。',
    explicitIntent: 'tickets',
  });

  assert.equal(result.facts.some((fact) => fact.kind === FACT.ACCEPTANCE_CRITERIA_MISSING), false);
  assert.equal(result.decision.capabilityId, CAPABILITY.PLANNING_SEQUENCE);
  assert.equal(result.decision.reasonCode, 'explicit-intent-tickets');
});

test('unknown explicit intent fails closed', () => {
  const result = evaluateSoftwareRequest({
    message: 'Explain the current implementation.',
    explicitIntent: 'teleport',
  });

  assert.ok(result.facts.some((fact) => fact.kind === FACT.EXPLICIT_INTENT_UNKNOWN));
  assert.equal(result.decision.blocked, true);
  assert.equal(result.decision.blockedReason, 'explicit-intent-unknown');
});

test('review and debug intents require their safety prerequisite', () => {
  const review = evaluateSoftwareRequest({ message: 'Review this change.', explicitIntent: 'review' });
  assert.equal(review.decision.blockedReason, 'review-requires-diff');

  const debug = evaluateSoftwareRequest({ message: 'Debug this.', explicitIntent: 'debug' });
  assert.equal(debug.decision.blockedReason, 'debug-requires-reproducible-failure');

  const reviewed = evaluateSoftwareRequest({
    message: 'Review this change.',
    explicitIntent: 'review',
    observations: [{ kind: OBSERVATION.DIFF_READY, evidenceRefs: ['diff:current'] }],
  });
  assert.equal(reviewed.decision.capabilityId, CAPABILITY.REVIEW_STANDARDS_SPEC);
});
test('completed test design unlocks TDD without replaying the completed capability', () => {
  const result = evaluateSoftwareRequest({
    message: 'Update the public input validation behavior.',
    completedCapabilities: [CAPABILITY.TESTING_DESIGN],
    testabilityDecision: honestRedDecision(),
  });

  assert.ok(result.facts.some((fact) => fact.kind === FACT.TEST_SCOPE_CONFIRMED));
  assert.equal(result.decision.capabilityId, CAPABILITY.TESTING_TDD);
});

test('high-risk behavior still confirms the test scope before TDD', () => {
  const result = evaluateSoftwareRequest({
    message: 'Update authentication behavior.',
    observations: [
      {
        kind: OBSERVATION.HIGH_RISK_BOUNDARY,
        evidenceRefs: ['risk:auth'],
      },
    ],
  });

  assert.equal(result.decision.capabilityId, CAPABILITY.TESTING_DESIGN);
});

test('confirmed high-risk test scope upgrades baseline TDD to strict TDD', () => {
  const result = evaluateSoftwareRequest({
    message: 'Update authentication behavior.',
    observations: [
      {
        kind: OBSERVATION.HIGH_RISK_BOUNDARY,
        evidenceRefs: ['risk:auth'],
      },
    ],
    completedCapabilities: [CAPABILITY.TESTING_DESIGN],
    testabilityDecision: honestRedDecision(),
  });

  assert.equal(result.decision.capabilityId, CAPABILITY.TESTING_STRICT_TDD);
});

test('常见中文新模块表述会触发 rex 最小构造门', () => {
  const result = evaluateSoftwareRequest({
    message: '实现一个新的支付模块。',
  });

  assert.ok(result.facts.some((fact) => fact.kind === FACT.NEW_CONSTRUCT_PROPOSED));
  assert.equal(result.decision.capabilityId, CAPABILITY.IMPLEMENTATION_MINIMIZE);
});

test('常见中文未知路径表述会在依赖规划前触发 Wayfinding', () => {
  const result = evaluateSoftwareRequest({
    message: '梳理这个未知迁移路径，再决定后续步骤。',
  });

  assert.ok(result.facts.some((fact) => fact.kind === FACT.PATH_UNKNOWN));
  assert.equal(result.decision.capabilityId, CAPABILITY.NAVIGATION_WAYFIND);
});

test('模糊变更请求会自动触发需求澄清（结构性推导，不依赖关键词）', () => {
  const result = evaluateSoftwareRequest({
    message: '优化一下前端页面。',
  });

  assert.ok(result.facts.some((fact) => fact.kind === FACT.ACCEPTANCE_CRITERIA_MISSING));
  assert.equal(result.decision.capabilityId, CAPABILITY.REQUIREMENTS_CLARIFY);
});

test('英文模糊变更请求同样触发需求澄清', () => {
  const result = evaluateSoftwareRequest({
    message: 'Improve the landing page.',
  });

  assert.ok(result.facts.some((fact) => fact.kind === FACT.ACCEPTANCE_CRITERIA_MISSING));
  assert.equal(result.decision.capabilityId, CAPABILITY.REQUIREMENTS_CLARIFY);
});

test('带可观察验收描述的变更请求不触发需求澄清', () => {
  const result = evaluateSoftwareRequest({
    message: '优化前端页面，要求首屏加载时间降低到 2 秒以内。',
  });

  assert.ok(!result.facts.some((fact) => fact.kind === FACT.ACCEPTANCE_CRITERIA_MISSING));
});

test('特指功能目标的变更请求不触发需求澄清', () => {
  const result = evaluateSoftwareRequest({
    message: '实现一个新的支付模块。',
  });

  assert.ok(!result.facts.some((fact) => fact.kind === FACT.ACCEPTANCE_CRITERIA_MISSING));
  assert.equal(result.decision.capabilityId, CAPABILITY.IMPLEMENTATION_MINIMIZE);
});

test('已完成需求澄清的任务不再重复触发澄清', () => {
  const result = evaluateSoftwareRequest({
    message: '优化一下前端页面。',
    requirementsDecision: REQUIREMENTS_DECISION_FIXTURE,
  });

  assert.ok(!result.facts.some((fact) => fact.kind === FACT.ACCEPTANCE_CRITERIA_MISSING));
  assert.notEqual(result.decision?.capabilityId, CAPABILITY.REQUIREMENTS_CLARIFY);
});

for (const scenario of [
  {
    label: '安全风险',
    message: '修改鉴权 token 和 session 校验逻辑。',
    riskRef: 'risk-domain:security',
  },
  {
    label: 'TypeScript 风险',
    message: 'Update the TypeScript strict mode and type safety checks.',
    riskRef: 'risk-domain:typescript',
  },
  {
    label: 'React 风险',
    message: 'Fix the React hydration and accessibility behavior.',
    riskRef: 'risk-domain:react',
  },
]) {
  test(`${scenario.label}会在实现完成后触发专项审查`, () => {
    const result = evaluateSoftwareRequest({
      message: scenario.message,
      completedCapabilities: [
        CAPABILITY.TESTING_DESIGN,
        CAPABILITY.TESTING_STRICT_TDD,
      ],
    });

    const specialistFact = result.facts.find((fact) => fact.kind === FACT.SPECIALIST_REVIEW_REQUIRED);
    assert.ok(specialistFact);
    assert.ok(specialistFact.evidenceRefs.includes(scenario.riskRef));
    assert.equal(result.decision.capabilityId, CAPABILITY.REVIEW_SPECIALIST);
    assert.ok(result.decision.evidenceRefs.includes('activation:software.testing.strict-tdd:completed'));
    assert.ok(result.decision.evidenceRefs.includes(scenario.riskRef));
  });
}
