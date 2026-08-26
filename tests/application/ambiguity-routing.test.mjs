import assert from 'node:assert/strict';
import test from 'node:test';

import { evaluateSoftwareRequest } from '../../src/application/evaluate-request.mjs';
import { AMBIGUITY_CORPUS } from '../fixtures/ambiguity-corpus.mjs';

test('ambiguity corpus contains the planned bilingual coverage', () => {
  assert.equal(AMBIGUITY_CORPUS.length, 39);
  assert.equal(new Set(AMBIGUITY_CORPUS.map((item) => item.id)).size, 39);
  assert.ok(AMBIGUITY_CORPUS.filter((item) => item.locale === 'zh-CN').length >= 10);
  assert.ok(AMBIGUITY_CORPUS.filter((item) => item.locale === 'en').length >= 10);
  // 新语义：模糊措辞本身不再自动触发 requirements（LLM 未归类 grill 时）。
  // 明确要求澄清并归类 grill 的场景才触发；其余场景按行为分类路由。
  assert.ok(AMBIGUITY_CORPUS.filter((item) => item.expectedCapability === 'software.requirements.clarify').length >= 5);
  assert.ok(AMBIGUITY_CORPUS.filter((item) => item.expectedCapability !== 'software.requirements.clarify').length >= 15);
});

for (const scenario of AMBIGUITY_CORPUS) {
  test(`ambiguity route ${scenario.id}`, () => {
    const result = evaluateSoftwareRequest({
      message: scenario.input,
      explicitIntent: scenario.explicitIntent,
      observations: scenario.observations,
      completedCapabilities: scenario.completedCapabilities,
      requirementsDecision: scenario.requirementsDecision,
    });
    assert.equal(result.decision?.capabilityId || null, scenario.expectedCapability);
    assert.equal(result.decision?.reasonCode || null, scenario.expectedReason);
  });
}
