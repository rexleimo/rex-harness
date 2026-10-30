import assert from 'node:assert/strict';
import test from 'node:test';

import {
  CAPABILITY,
  FACT,
  advanceActivation,
  decideNextCapability,
  nextCommand,
  startActivation,
} from '../../src/index.mjs';

import { REQUIREMENTS_DECISION_FIXTURE } from '../fixtures/requirements-decision.mjs';

function requirementsDecision() {
  return decideNextCapability([
    { kind: FACT.EXPLICIT_INTENT, value: 'grill', evidenceRefs: ['intent:grill'] },
  ]);
}

function decisionEvidence(ref) {
  return { kind: 'requirements-decision-recorded', refs: [ref] };
}

function assertConvergenceContract(activation) {
  assert.equal(activation.capabilityId, CAPABILITY.REQUIREMENTS_CLARIFY);
  const command = nextCommand(activation);
  assert.equal(command.stageId, 'clarify');

  // 这里只验证低层 Activation 的证据形状；完整 Workflow 还要求 typed readiness。
  // anyOf 的兼容性不代表关键未知可被假设关闭。
  const anyOf = command.expectedEvidence.find((item) => item && typeof item === 'object' && item.anyOf);
  assert.ok(anyOf, 'expectedEvidence must include an anyOf convergence group');
  assert.deepEqual([...anyOf.anyOf].sort(), ['acceptance-criteria-recorded', 'assumptions-recorded']);
  assert.ok(command.expectedEvidence.includes('first-slice-identified'));
  assert.ok(command.expectedEvidence.includes('requirements-decision-recorded'));
}

test('需求澄清契约包含 anyOf 收敛组（验收标准或假设记录二选一）', () => {
  const activation = startActivation(requirementsDecision(), { activationId: 'activation:req-converge-1' });
  assertConvergenceContract(activation);
});

test('完整验收证据（兼容路径）仍可完成澄清阶段', () => {
  const activation = startActivation(requirementsDecision(), { activationId: 'activation:req-converge-2' });
  const completed = advanceActivation(activation, [
    { kind: 'acceptance-criteria-recorded', refs: ['artifact:acceptance'] },
    { kind: 'non-goals-recorded', refs: ['artifact:non-goals'] },
    { kind: 'first-slice-identified', refs: ['artifact:first-slice'] },
    decisionEvidence('artifact:requirements-decision'),
  ]);
  assert.equal(completed.outcome, 'completed');
  assert.equal(completed.activation.status, 'completed');
});

test('低层 Activation 兼容假设证据，是否可推进软件工作流另由 readiness 约束', () => {
  const activation = startActivation(requirementsDecision(), { activationId: 'activation:req-converge-3' });
  const completed = advanceActivation(activation, [
    { kind: 'assumptions-recorded', refs: ['artifact:assumptions'] },
    { kind: 'first-slice-identified', refs: ['artifact:first-slice'] },
    decisionEvidence('artifact:requirements-decision'),
  ]);
  assert.equal(completed.outcome, 'completed');
  assert.equal(completed.activation.status, 'completed');
});

test('缺少收敛组任一证据时保持 blocked（证据契约不放松）', () => {
  const activation = startActivation(requirementsDecision(), { activationId: 'activation:req-converge-4' });
  const blocked = advanceActivation(activation, [
    { kind: 'first-slice-identified', refs: ['artifact:first-slice'] },
  ]);
  assert.equal(blocked.outcome, 'blocked');
  assert.ok(blocked.missingEvidence.some((item) => item && typeof item === 'object' && item.anyOf));
});
