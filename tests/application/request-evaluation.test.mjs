import assert from 'node:assert/strict';
import test from 'node:test';

import {
  CAPABILITY,
  FACT,
  OBSERVATION,
  evaluateSoftwareRequest,
} from '../../src/index.mjs';

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

test('completed test design unlocks TDD without replaying the completed capability', () => {
  const result = evaluateSoftwareRequest({
    message: 'Update the public input validation behavior.',
    completedCapabilities: [CAPABILITY.TESTING_DESIGN],
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
