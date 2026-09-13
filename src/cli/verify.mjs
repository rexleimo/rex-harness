import { readFileSync } from 'node:fs';
import { validateCommandEvidence } from '../application/validate-command-evidence.mjs';
import { deriveEffectRef, MATERIAL_TURN_OUTCOMES, normalizeTurnResult } from '../domain/turn-contract.mjs';
import {
  readStandaloneSettlements,
  readStandaloneWorkflow,
  resolveStandaloneExecutionReceipt,
} from '../standalone/store.mjs';
import {
  parseOptions,
  rootOption,
} from './options.mjs';

function readStdinTurnResult() {
  const raw = readFileSync(0, 'utf8');
  if (!raw.trim()) throw new Error('verify requires a turn result JSON on stdin');
  return JSON.parse(raw);
}

/**
 * 独立 validator 进程：stdin 读 turn 结果，只校验、不落盘。
 * executor 不得自验完成声明——结算前必须由本进程 exit 0 放行。
 * 校验与结算门（settleStandaloneTurn）共享同一套规则，但这里是只读副本：
 * 篡改 envelope、重放旧 token、伪造 effectRef、bypass 夹带 material 声明都在此被拦下。
 */
export function runVerify(args, { cwd = process.cwd() } = {}) {
  const options = parseOptions(args);
  const rootDir = rootOption(options, cwd);
  const envelope = normalizeTurnResult(readStdinTurnResult());

  const presented = readStandaloneWorkflow({
    rootDir,
    workflowActivationId: envelope.turnKey.workflowActivationId,
  });
  const command = presented.command;

  const rejections = [];
  // 顺序与结算门一致：自洽性 → 幂等 → 当前 token 授权。
  const selfConsistent = deriveEffectRef({ executionToken: envelope.commandToken, turnResult: envelope });
  if (selfConsistent !== envelope.effectRef) {
    rejections.push('effect_ref_mismatch');
  }

  const previous = readStandaloneSettlements({
    rootDir,
    workflowActivationId: envelope.turnKey.workflowActivationId,
  }).find((row) => row.decision === 'accepted' && row.effectRef === envelope.effectRef);
  if (previous) rejections.push('effect_ref_already_settled');

  if (!command || String(command.executionToken || '').trim() !== envelope.commandToken) {
    rejections.push('stale_command_token');
  }

  if (envelope.bypass && MATERIAL_TURN_OUTCOMES.includes(envelope.outcome)) {
    rejections.push('bypass_turn_material_outcome_forbidden');
  }

  if (rejections.length === 0 && MATERIAL_TURN_OUTCOMES.includes(envelope.outcome)) {
    try {
      validateCommandEvidence(command, envelope.evidence, {
        resolveReceipt: (ref) => resolveStandaloneExecutionReceipt({ rootDir, ref }),
      });
    } catch (error) {
      rejections.push(`evidence_invalid: ${error.message}`);
    }
  }

  return Object.freeze({
    schemaVersion: 1,
    kind: 'rex.cli.turn-verify.v1',
    status: rejections.length === 0 ? 'accepted' : 'rejected',
    effectRef: envelope.effectRef,
    turnKey: envelope.turnKey,
    rejections: Object.freeze(rejections),
  });
}
