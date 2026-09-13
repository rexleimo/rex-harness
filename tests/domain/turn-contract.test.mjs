import assert from 'node:assert/strict';
import test from 'node:test';

import {
  FAILURE_KINDS,
  MATERIAL_TURN_OUTCOMES,
  TURN_OUTCOMES,
  deriveEffectRef,
  isMaterialTurnResult,
  normalizeTurnResult,
} from '../../src/domain/turn-contract.mjs';

const BASE = Object.freeze({
  kind: 'rex.turn-result.v1',
  turnKey: { workflowActivationId: 'workflow-checkout', iteration: 3 },
  outcome: 'blocked',
  failureKind: 'rate_limited',
  selfReport: { progressMade: false, blockedReason: 'provider returned 429 twice', summary: 'waiting out the window' },
  evidence: [],
  bypass: false,
  commandToken: 'token-abc',
});

function withEffectRef(value) {
  return { ...value, effectRef: deriveEffectRef({ executionToken: value.commandToken, turnResult: value }) };
}

test('turn outcomes split into material and non-material sets', () => {
  assert.deepEqual([...MATERIAL_TURN_OUTCOMES], ['validated_progress', 'validated_completion', 'repair_required']);
  for (const outcome of MATERIAL_TURN_OUTCOMES) assert.ok(TURN_OUTCOMES.includes(outcome));
  assert.equal(isMaterialTurnResult({ outcome: 'validated_progress' }), true);
  assert.equal(isMaterialTurnResult({ outcome: 'blocked' }), false);
});

test('effectRef is deterministic for identical payloads and moves with the token', () => {
  const envelope = withEffectRef(BASE);
  const replayed = withEffectRef({ ...BASE });
  assert.equal(envelope.effectRef, replayed.effectRef);

  const rotated = withEffectRef({ ...BASE, commandToken: 'token-next' });
  assert.notEqual(envelope.effectRef, rotated.effectRef);
});

test('normalizeTurnResult freezes a well-formed envelope and defaults failureKind to none', () => {
  const envelope = normalizeTurnResult(withEffectRef({ ...BASE, failureKind: undefined }));
  assert.equal(envelope.failureKind, 'none');
  assert.equal(envelope.turnKey.iteration, 3);
  assert.equal(envelope.bypass, false);
  assert.deepEqual(envelope.evidence, []);
});

test('normalizeTurnResult rejects malformed envelopes', () => {
  assert.throws(() => normalizeTurnResult({ ...withEffectRef(BASE), kind: 'rex.other.v1' }), /kind must be/u);
  assert.throws(() => normalizeTurnResult(withEffectRef({ ...BASE, outcome: 'shipped-it' })), /outcome must be one of/u);
  assert.throws(
    () => normalizeTurnResult(withEffectRef({ ...BASE, failureKind: 'vibes' })),
    /failureKind must be one of/u,
  );
  assert.throws(
    () => normalizeTurnResult(withEffectRef({ ...BASE, selfReport: {} })),
    /"blocked" requires selfReport.blockedReason/u,
  );
  assert.throws(
    () => normalizeTurnResult(withEffectRef({ ...BASE, turnKey: { workflowActivationId: 'w', iteration: 0 } })),
    /positive integer/u,
  );
  assert.throws(
    () => normalizeTurnResult({ ...withEffectRef(BASE), effectRef: 'effect:not-hex' }),
    /effectRef must be/u,
  );
  for (const outcome of MATERIAL_TURN_OUTCOMES) {
    assert.throws(
      () => normalizeTurnResult(withEffectRef({ ...BASE, outcome, evidence: [] })),
      /requires evidence/u,
      `material outcome ${outcome} must require evidence`,
    );
  }
  const oversize = withEffectRef({ ...BASE, selfReport: { blockedReason: 'x'.repeat(3000) } });
  assert.throws(() => normalizeTurnResult(oversize), /exceeds/u);
});

test('failure kind vocabulary matches the wire contract', () => {
  assert.ok(FAILURE_KINDS.includes('rate_limited'));
  assert.ok(FAILURE_KINDS.includes('provider_overloaded'));
  assert.ok(FAILURE_KINDS.includes('host_unsupported'));
  assert.ok(FAILURE_KINDS.includes('budget_exhausted'));
});
