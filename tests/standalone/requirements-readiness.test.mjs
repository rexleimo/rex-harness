import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { REQUIREMENTS_DECISION_FIXTURE } from '../fixtures/requirements-decision.mjs';

const cli = path.resolve(import.meta.dirname, '../../bin/rex-harness.mjs');

test('standalone CLI retains blocked clarification and resumes only after a ready record', () => {
  const root = mkdtempSync(path.join(os.tmpdir(), 'rex-readiness-'));
  function run(...args) {
    const result = spawnSync(process.execPath, [cli, ...args, '--root', root], { encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    return JSON.parse(result.stdout);
  }
  try {
    const started = run('start', '--work-item', 'ready', '--intent', 'grill', '--message', 'Design a checkout workflow');
    const submit = () => run('evidence', '--activation', started.command.activationId,
      '--command-token', started.command.commandToken,
      '--evidence', 'assumptions-recorded=artifact:declared-defaults',
      '--evidence', 'first-slice-identified=artifact:checkout-slice',
      '--evidence', `requirements-decision-recorded=${REQUIREMENTS_DECISION_FIXTURE.decisionRef}`,
      '--requirements-file', 'requirements.json');
    const decision = structuredClone(REQUIREMENTS_DECISION_FIXTURE);
    decision.readiness.status = 'blocked';
    decision.readiness.decisions[0].status = 'open';
    writeFileSync(path.join(root, 'requirements.json'), JSON.stringify(decision));
    const blocked = submit();
    assert.equal(blocked.outcome, 'blocked');
    assert.equal(blocked.blockedReason, 'requirements-not-ready');
    assert.equal(blocked.command.commandToken, started.command.commandToken);
    const resumed = run('resume', '--work-item', 'ready');
    assert.equal(resumed.command.providerId, 'rex-requirements');
    assert.equal(resumed.command.commandToken, started.command.commandToken);
    writeFileSync(path.join(root, 'requirements.json'), JSON.stringify(REQUIREMENTS_DECISION_FIXTURE));
    const ready = submit();
    assert.equal(ready.command.providerId, 'rex-test-design');
    const saved = run('status', '--work-item', 'ready', '--full');
    assert.equal(saved.workflow.requirementsDecision.readiness.status, 'ready');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
