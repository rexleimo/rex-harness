import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';

import { validateCommandEvidence } from '../../src/application/validate-command-evidence.mjs';
import {
  captureStandaloneExecutionReceipt,
  startStandaloneWorkflow,
  submitStandaloneEvidence,
} from '../../src/standalone/store.mjs';

// 中文注释：这一组断言来自一次真实事故——review 阶段用一条编造的 receipt ref 提交了
// `standards-review-recorded`，控制面把它收进账本了。原因不是校验缺失，而是校验只覆盖
// 白名单里的 kind（failing/passing-test-observed 那一类会去解 resolveReceipt）：
// 其余 kind 的 `receipt:` ref 从来没被解析过，所以 `receipt:00000000-…` 这种根本不存在的
// 凭证也能过。凭证存在性不该按 kind 分等级——这是控制面的地基。
const FABRICATED = 'receipt:00000000-0000-4000-8000-000000000000';

async function withRoot(run) {
  const rootDir = await mkdtemp(path.join(os.tmpdir(), 'rex-ref-integrity-'));
  try {
    await run(rootDir);
  } finally {
    await rm(rootDir, { recursive: true, force: true });
  }
}

test('a fabricated receipt ref is refused on every evidence kind, not only the allowlisted ones', () => {
  const command = { expectedEvidence: ['standards-review-recorded', 'spec-review-recorded'] };
  for (const kind of command.expectedEvidence) {
    assert.throws(
      () => validateCommandEvidence(command, [{ kind, refs: [FABRICATED] }], {
        resolveReceipt: () => null,
      }),
      /references an unknown execution receipt/u,
      `${kind} 的 receipt ref 同样必须可解析`,
    );
  }
});

test('refs that are not receipts keep their own namespace instead of being forced through the receipt store', () => {
  const command = { expectedEvidence: ['acceptance-criteria-recorded'] };
  const normalized = validateCommandEvidence(
    command,
    [{ kind: 'acceptance-criteria-recorded', refs: ['artifact:requirements', 'doc:docs/plans/a.md'] }],
    { resolveReceipt: () => null },
  );
  assert.deepEqual(normalized[0].refs, ['artifact:requirements', 'doc:docs/plans/a.md']);
});

test('a git ref has to look like a commit object id', () => {
  const command = { expectedEvidence: ['hardening-diff-recorded'] };
  assert.throws(
    () => validateCommandEvidence(command, [{ kind: 'hardening-diff-recorded', refs: ['git:main-head'] }],
      { resolveReceipt: () => null }),
    /invalid or placeholder ref/u,
    'git:<非 sha> 只是把占位符换了个前缀，不能算证据',
  );
  const ok = validateCommandEvidence(command, [{ kind: 'hardening-diff-recorded', refs: ['git:72fd26df'] }],
    { resolveReceipt: () => null });
  assert.equal(ok[0].refs[0], 'git:72fd26df');
});

test('the store refuses a fabricated receipt before writing it into the evidence journal', async () => {
  await withRoot(async (rootDir) => {
    const started = startStandaloneWorkflow({
      rootDir,
      workItemKey: 'ref-integrity',
      workflowActivationId: 'workflow-ref-integrity',
      request: { message: 'Evidence refs must resolve to real receipts.', explicitIntent: 'grill' },
    });
    const command = started.workflow.currentCommand;

    assert.throws(
      () => submitStandaloneEvidence({
        rootDir,
        activationId: command.activationId,
        commandToken: command.executionToken,
        evidence: [{ kind: 'acceptance-criteria-recorded', refs: [FABRICATED] }],
      }),
      /references an unknown execution receipt/u,
    );

    // 同一 kind 用真实存在的凭证再交一次，必须能过——否则这条规则只是把门关上而不给通路。
    const real = captureStandaloneExecutionReceipt({
      rootDir,
      executable: process.execPath,
      args: ['-e', 'process.exit(0)'],
    });
    const accepted = submitStandaloneEvidence({
      rootDir,
      activationId: command.activationId,
      commandToken: command.executionToken,
      evidence: [{ kind: 'acceptance-criteria-recorded', refs: [real.ref] }],
    });
    assert.equal(accepted.outcome, 'blocked');
    assert.ok(accepted.missingEvidence.length > 0, '同阶段其余证据仍未齐，说明只是补上了一条真凭证');
  });
});
