import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  deriveEffectRef,
  normalizeTurnResult,
  readStandaloneSettlements,
  readStandaloneWorkflow,
  settleStandaloneTurn,
  startStandaloneWorkflow,
} from '../../src/index.mjs';

async function withRoot(prefix, run) {
  const rootDir = await mkdtemp(path.join(os.tmpdir(), prefix));
  try {
    await run(rootDir);
  } finally {
    await rm(rootDir, { recursive: true, force: true });
  }
}

function startRequirements(rootDir, workItemKey = 'checkout') {
  return startStandaloneWorkflow({
    rootDir,
    workItemKey,
    workflowActivationId: `workflow-${workItemKey}`,
    request: { message: 'Clarify acceptance criteria before implementing checkout.', explicitIntent: 'grill' },
  });
}

function buildTurnResult({
  started,
  commandToken,
  outcome,
  evidence = [],
  failureKind = 'none',
  bypass = false,
  iteration = 1,
}) {
  const bare = {
    kind: 'rex.turn-result.v1',
    turnKey: { workflowActivationId: started.workflow.workflowActivationId, iteration },
    outcome,
    failureKind,
    selfReport: outcome === 'blocked'
      ? { progressMade: false, blockedReason: 'provider returned 429', summary: 'waiting' }
      : { progressMade: true, blockedReason: '', summary: 'recorded acceptance criteria' },
    evidence,
    bypass,
    commandToken,
  };
  return normalizeTurnResult({
    ...bare,
    effectRef: deriveEffectRef({ executionToken: commandToken, turnResult: bare }),
  });
}

const ACCEPTANCE_EVIDENCE = [{ kind: 'acceptance-criteria-recorded', refs: ['artifact:requirements'] }];

test('material settlement advances the workflow, rotates the token, and journals exactly once', async () => {
  await withRoot('rex-settle-accept-', async (rootDir) => {
    const started = startRequirements(rootDir);
    const tokenBefore = started.workflow.currentCommand.executionToken;
    const turn = buildTurnResult({
      started,
      commandToken: tokenBefore,
      outcome: 'validated_progress',
      evidence: ACCEPTANCE_EVIDENCE,
    });

    const settled = settleStandaloneTurn({ rootDir, turnResult: turn });
    assert.equal(settled.settlement.decision, 'accepted');
    assert.equal(settled.settlement.duplicate, false);
    const tokenAfter = settled.workflow.currentCommand.executionToken;
    assert.notEqual(tokenAfter, tokenBefore);

    // 幂等重放：即使 token 已轮换，同一 envelope 也返回 duplicate 且不再记账。
    const replay = settleStandaloneTurn({ rootDir, turnResult: turn });
    assert.equal(replay.settlement.decision, 'accepted');
    assert.equal(replay.settlement.duplicate, true);
    assert.equal(replay.workflow.currentCommand.executionToken, tokenAfter);

    const rows = readStandaloneSettlements({ rootDir, workflowActivationId: started.workflow.workflowActivationId });
    assert.equal(rows.length, 1);
    assert.equal(rows[0].decision, 'accepted');
    assert.equal(rows[0].effectRef, turn.effectRef);
    assert.ok(!JSON.stringify(rows).includes(tokenBefore), 'journal records a token fingerprint, not the token');
  });
});

test('settlement rejects tampered payloads and invalid evidence without advancing', async () => {
  await withRoot('rex-settle-reject-', async (rootDir) => {
    const started = startRequirements(rootDir);
    const tokenBefore = started.workflow.currentCommand.executionToken;
    const first = buildTurnResult({
      started,
      commandToken: tokenBefore,
      outcome: 'validated_progress',
      evidence: ACCEPTANCE_EVIDENCE,
    });
    const firstResult = settleStandaloneTurn({ rootDir, turnResult: first });
    assert.equal(firstResult.settlement.decision, 'accepted');
    const tokenAfterFirst = firstResult.workflow.currentCommand.executionToken;

    // 篡改 outcome 但保留原 effectRef → envelope 自洽性校验失败（优先于幂等）。
    const tampered = normalizeTurnResult({ ...first, outcome: 'validated_completion' });
    const tamperedResult = settleStandaloneTurn({ rootDir, turnResult: tampered });
    assert.equal(tamperedResult.settlement.decision, 'rejected');
    assert.equal(tamperedResult.settlement.reason, 'effect_ref_mismatch');

    // 证据指向不存在的 receipt → 校验失败，工作流不动、token 不轮换。
    const placeholder = buildTurnResult({
      started,
      commandToken: tokenAfterFirst,
      outcome: 'validated_progress',
      evidence: [{ kind: 'passing-test-observed', refs: ['command:does-not-exist'] }],
      iteration: 2,
    });
    const placeholderResult = settleStandaloneTurn({ rootDir, turnResult: placeholder });
    assert.equal(placeholderResult.settlement.decision, 'rejected');
    assert.match(placeholderResult.settlement.reason, /evidence_invalid/u);

    const after = readStandaloneWorkflow({ rootDir, workItemKey: 'checkout' });
    assert.equal(after.workflow.currentCommand.executionToken, tokenAfterFirst);

    const rows = readStandaloneSettlements({ rootDir, workflowActivationId: started.workflow.workflowActivationId });
    assert.equal(rows.filter((row) => row.decision === 'accepted').length, 1);
    assert.equal(rows.filter((row) => row.decision === 'rejected').length, 2);
  });
});

test('settlement rejects an envelope built against a rotated token', async () => {
  await withRoot('rex-settle-stale-', async (rootDir) => {
    const started = startRequirements(rootDir);
    const tokenBefore = started.workflow.currentCommand.executionToken;
    settleStandaloneTurn({
      rootDir,
      turnResult: buildTurnResult({
        started,
        commandToken: tokenBefore,
        outcome: 'validated_progress',
        evidence: ACCEPTANCE_EVIDENCE,
      }),
    });

    // 用旧 token 构造的第二笔 envelope（自洽但未授权）→ stale_command_token。
    const stale = buildTurnResult({
      started,
      commandToken: tokenBefore,
      outcome: 'validated_progress',
      evidence: ACCEPTANCE_EVIDENCE,
      iteration: 2,
    });
    const result = settleStandaloneTurn({ rootDir, turnResult: stale });
    assert.equal(result.settlement.decision, 'rejected');
    assert.equal(result.settlement.reason, 'stale_command_token');
  });
});

test('non-material settlement records the turn without advancing or rotating', async () => {
  await withRoot('rex-settle-blocked-', async (rootDir) => {
    const started = startRequirements(rootDir);
    const tokenBefore = started.workflow.currentCommand.executionToken;
    const turn = buildTurnResult({ started, commandToken: tokenBefore, outcome: 'blocked', failureKind: 'rate_limited' });

    const settled = settleStandaloneTurn({ rootDir, turnResult: turn });
    assert.equal(settled.settlement.decision, 'accepted');
    assert.equal(settled.settlement.outcome, 'blocked');
    assert.equal(settled.workflow.currentCommand.executionToken, tokenBefore);

    const rows = readStandaloneSettlements({ rootDir, workflowActivationId: started.workflow.workflowActivationId });
    assert.equal(rows.length, 1);
    assert.equal(rows[0].outcome, 'blocked');
  });
});

test('settlement survives a state-rollback replay (load-bearing gate regression)', async () => {
  await withRoot('rex-settle-rollback-', async (rootDir) => {
    const started = startRequirements(rootDir);
    const activationFile = path.join(rootDir, '.rex-harness', 'activations', 'workflow-checkout.json');
    const snapshotBeforeTurn = await readFile(activationFile, 'utf8');
    const tokenBefore = started.workflow.currentCommand.executionToken;

    const turn = buildTurnResult({
      started,
      commandToken: tokenBefore,
      outcome: 'validated_progress',
      evidence: ACCEPTANCE_EVIDENCE,
    });
    const first = settleStandaloneTurn({ rootDir, turnResult: turn });
    assert.equal(first.settlement.decision, 'accepted');
    const tokenAfter = first.workflow.currentCommand.executionToken;

    // 模拟一个并发写入者把状态文件回滚到结算前（last-writer-wins 破坏场景）。
    const { writeFile } = await import('node:fs/promises');
    await writeFile(activationFile, snapshotBeforeTurn, 'utf8');

    // settlement journal 没有回滚：同一 effectRef 的重放仍判定为 duplicate，
    // 不会对已回滚的状态做第二次推进（防重复计数/重复扣费的核心保证）。
    const replay = settleStandaloneTurn({ rootDir, turnResult: turn });
    assert.equal(replay.settlement.decision, 'accepted');
    assert.equal(replay.settlement.duplicate, true);

    // 基于回滚快照旧 token 构造的新 envelope：当前 token 已被 material 结算
    // 消耗过 → 状态回滚不变量 fail-closed。
    const forged = buildTurnResult({
      started,
      commandToken: tokenBefore,
      outcome: 'validated_progress',
      evidence: ACCEPTANCE_EVIDENCE,
      iteration: 2,
    });
    const forgedResult = settleStandaloneTurn({ rootDir, turnResult: forged });
    assert.equal(forgedResult.settlement.decision, 'rejected');
    assert.equal(forgedResult.settlement.reason, 'state_rollback_detected');

    const rows = readStandaloneSettlements({ rootDir, workflowActivationId: started.workflow.workflowActivationId });
    assert.equal(rows.filter((row) => row.decision === 'accepted').length, 1, 'exactly one accepted settlement');
  });
});

test('bypass turns cannot settle material outcomes but may settle blocked reports', async () => {
  await withRoot('rex-settle-bypass-', async (rootDir) => {
    const started = startRequirements(rootDir);
    const tokenBefore = started.workflow.currentCommand.executionToken;

    const bypassProgress = buildTurnResult({
      started,
      commandToken: tokenBefore,
      outcome: 'validated_progress',
      evidence: ACCEPTANCE_EVIDENCE,
      bypass: true,
    });
    const rejected = settleStandaloneTurn({ rootDir, turnResult: bypassProgress });
    assert.equal(rejected.settlement.decision, 'rejected');
    assert.equal(rejected.settlement.reason, 'bypass_turn_material_outcome_forbidden');
    assert.equal(rejected.workflow.currentCommand.executionToken, tokenBefore);

    const bypassBlocked = buildTurnResult({
      started,
      commandToken: tokenBefore,
      outcome: 'blocked',
      failureKind: 'ownership_gate',
      bypass: true,
    });
    const accepted = settleStandaloneTurn({ rootDir, turnResult: bypassBlocked });
    assert.equal(accepted.settlement.decision, 'accepted');
    assert.equal(accepted.workflow.currentCommand.executionToken, tokenBefore);

    const journal = await readFile(
      path.join(rootDir, '.rex-harness', 'settlements', 'workflow-checkout.ndjson'),
      'utf8',
    );
    assert.equal(journal.trim().split('\n').length, 2);
  });
});
