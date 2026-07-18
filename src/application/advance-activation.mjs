import { updateActivation } from '../domain/activations.mjs';
import { mergeEvidence } from '../domain/evidence.mjs';
import { evaluateEvidence } from './evaluate-evidence.mjs';
import { capabilityForActivation, nextCommand } from './start-activation.mjs';

/**
 * 证据不足时保留已经收到的部分证据，但不移动 stageIndex；这样宿主恢复后
 * 可以继续补证据，而不会重复执行已经产生有效 Evidence 的动作。
 */
export function advanceActivation(activation, evidence = [], options = {}) {
  if (!activation || activation.status === 'completed') {
    return Object.freeze({
      outcome: 'completed',
      activation,
      missingEvidence: Object.freeze([]),
      command: null,
    });
  }

  const capability = capabilityForActivation(activation, options);
  const stage = capability.recipe.stages[activation.stageIndex];
  if (!stage || stage.id !== activation.stageId) {
    throw new Error(`activation stage mismatch: ${activation.stageId}`);
  }

  const mergedEvidence = mergeEvidence(activation.evidence, evidence);
  const gate = evaluateEvidence(stage.requiredEvidence, mergedEvidence);
  const withEvidence = updateActivation(activation, { evidence: mergedEvidence });
  if (!gate.ok) {
    return Object.freeze({
      outcome: 'blocked',
      activation: withEvidence,
      missingEvidence: gate.missingEvidence,
      command: nextCommand(withEvidence, options),
    });
  }

  const completedStages = [...activation.completedStages, stage.id];
  const nextStageIndex = activation.stageIndex + 1;
  const nextStage = capability.recipe.stages[nextStageIndex];
  if (!nextStage) {
    return Object.freeze({
      outcome: 'completed',
      activation: updateActivation(withEvidence, {
        status: 'completed',
        stageIndex: nextStageIndex,
        stageId: '',
        completedStages,
      }),
      missingEvidence: Object.freeze([]),
      command: null,
    });
  }

  const advanced = updateActivation(withEvidence, {
    stageIndex: nextStageIndex,
    stageId: nextStage.id,
    completedStages,
  });
  return Object.freeze({
    outcome: 'next',
    activation: advanced,
    missingEvidence: Object.freeze([]),
    command: nextCommand(advanced, options),
  });
}

