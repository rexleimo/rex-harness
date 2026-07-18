import assert from 'node:assert/strict';
import test from 'node:test';

import {
  CAPABILITY,
  evaluateSoftwareRequest,
  startSoftwareWorkflow,
} from '../../src/index.mjs';

for (const scenario of [
  {
    label: '纯解释请求',
    message: '请解释这个仓库的工作流是怎么运行的，不要修改任何文件。',
    capabilityId: null,
  },
  {
    label: '无目标的继续确认',
    message: '继续。',
    capabilityId: null,
  },
  {
    label: '英文只读解释',
    message: 'Explain the workflow and do not modify any files.',
    capabilityId: null,
  },
  {
    label: '否定子句在前的中文只读解释',
    message: '不要修改任何文件，只解释工作流。',
    capabilityId: null,
  },
  {
    label: '否定子句在前的英文只读解释',
    message: 'Do not modify any files; explain the workflow.',
    capabilityId: null,
  },
  {
    label: '中文复合否定动作只读解释',
    message: '不要修改或修复任何文件，只解释工作流。',
    capabilityId: null,
  },
  {
    label: '英文复合否定动作只读解释',
    message: 'Do not modify or fix any files; only explain the workflow.',
    capabilityId: null,
  },
  {
    label: '中文多动作列表只读审阅',
    message: '不得新增、修改或重构代码，只做审阅。',
    capabilityId: null,
  },
  {
    label: '英文多动作列表只读审阅',
    message: 'Never implement or fix anything; just review it.',
    capabilityId: null,
  },
  {
    label: '中文简写否定只读解释',
    message: '不修改任何文件，只解释工作流。',
    capabilityId: null,
  },
  {
    label: '普通行为变更',
    message: '修复结账金额的舍入行为。',
    capabilityId: CAPABILITY.TESTING_DESIGN,
  },
  {
    label: '失败优先于新增构造',
    message: '新增支付模块时测试失败了，请修复报错。',
    capabilityId: CAPABILITY.DEBUG_ROOT_CAUSE,
  },
  {
    label: '需求澄清优先于实现',
    message: '实现结账功能前先澄清需求歧义和验收条件。',
    capabilityId: CAPABILITY.REQUIREMENTS_CLARIFY,
  },
]) {
  test(`${scenario.label}稳定映射到预期 Capability`, () => {
    const result = evaluateSoftwareRequest({ message: scenario.message });
    assert.equal(result.decision?.capabilityId || null, scenario.capabilityId);
  });
}

test('a scoped do-not-touch clause does not erase an explicit fix objective', () => {
  const result = evaluateSoftwareRequest({
    message: '修复结账金额的舍入行为，但不要修改 docs 目录。',
  });

  assert.equal(result.decision.capabilityId, CAPABILITY.TESTING_DESIGN);
});

for (const message of [
  '解释当前流程，不要修改文档。然后修复结账舍入。',
  'Explain the flow and do not modify docs. Then fix checkout rounding.',
]) {
  test(`read-only clause does not erase a later mutation objective: ${message}`, () => {
    const result = evaluateSoftwareRequest({ message });

    assert.equal(result.decision.capabilityId, CAPABILITY.TESTING_DESIGN);
  });
}

test('read-only requests complete without a fabricated current Command', () => {
  const workflow = startSoftwareWorkflow({
    workflowActivationId: 'workflow-read-only',
    workItemKey: 'read-only',
    request: { message: '说明 rex-harness 的职责，不要修改代码。' },
  });

  assert.equal(workflow.status, 'completed');
  assert.equal(workflow.currentActivation, null);
  assert.equal(workflow.currentCommand, null);
  assert.equal(workflow.executionProfile.label, 'fast');
});

test('prompt length does not choose Fast Balanced or Deep', () => {
  const short = startSoftwareWorkflow({
    workflowActivationId: 'workflow-short',
    request: { message: '修复结账行为。' },
  });
  const long = startSoftwareWorkflow({
    workflowActivationId: 'workflow-long',
    request: { message: `${'背景说明。'.repeat(300)}修复结账行为。` },
  });

  assert.equal(short.currentCapabilityId, CAPABILITY.TESTING_DESIGN);
  assert.equal(long.currentCapabilityId, short.currentCapabilityId);
  assert.equal(long.executionProfile.label, short.executionProfile.label);
});

test('team and harness intent changes promotion only, not the selected Provider capability', () => {
  for (const [explicitIntent, target] of [['team', 'team'], ['harness', 'harness']]) {
    const result = evaluateSoftwareRequest({
      message: '修改结账校验行为。',
      explicitIntent,
    });

    assert.equal(result.decision.capabilityId, CAPABILITY.TESTING_DESIGN);
    assert.equal(result.decision.provider.id, 'rex-test-design');
    assert.equal(result.promotion.target, target);
  }
});
