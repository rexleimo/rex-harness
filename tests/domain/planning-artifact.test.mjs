import assert from 'node:assert/strict';
import test from 'node:test';

import {
  PLANNING_ARTIFACT_KIND,
  RUNTIME_ARTIFACT_CONTRACT_KIND,
  normalizePlanningArtifact,
} from '../../src/index.mjs';

function planningArtifact(overrides = {}) {
  return {
    schemaVersion: 1,
    kind: PLANNING_ARTIFACT_KIND,
    status: 'ready',
    objective: 'deliver one observable migration slice',
    decisionTicketRef: 'artifact:decision-ticket:migration-slice',
    workItems: [
      {
        id: 'work-schema',
        title: 'record the schema change',
        outcome: 'schema is accepted by the reader',
        completionCriteria: ['reader accepts the new field'],
        verification: ['node --test tests/schema.test.mjs'],
        evidenceRefs: ['path:src/schema.mjs'],
        dependsOn: [],
      },
      {
        id: 'work-adapter',
        title: 'update the read/write adapter',
        outcome: 'adapter persists the schema',
        completionCriteria: ['round trip preserves the field'],
        verification: ['node --test tests/adapter.test.mjs'],
        evidenceRefs: ['path:src/adapter.mjs'],
        dependsOn: ['work-schema'],
      },
    ],
    frontier: {
      ready: ['work-schema'],
      blocked: [{ workItemId: 'work-adapter', reason: 'waiting for schema', evidenceRefs: ['path:src/schema.mjs'] }],
    },
    parallelGroups: [['work-schema']],
    convergenceGate: {
      requiredEvidenceRefs: ['receipt:schema', 'receipt:adapter'],
      verification: 'node --test tests/schema.test.mjs tests/adapter.test.mjs',
      joinCondition: 'both work items have passing receipts',
    },
    completionClaim: 'soft',
    ...overrides,
  };
}

test('planning artifact normalizes vertical work items, frontier, and convergence gate', () => {
  const artifact = normalizePlanningArtifact(planningArtifact());
  assert.equal(artifact.kind, PLANNING_ARTIFACT_KIND);
  assert.equal(artifact.workItems.length, 2);
  assert.deepEqual(artifact.frontier.ready, ['work-schema']);
  assert.equal(artifact.convergenceGate.joinCondition, 'both work items have passing receipts');
});

test('planning artifact rejects unknown dependencies and cycles', () => {
  assert.throws(() => normalizePlanningArtifact({
    ...planningArtifact(),
    workItems: planningArtifact().workItems.map((item) => item.id === 'work-adapter'
      ? { ...item, dependsOn: ['work-missing'] }
      : item),
  }), /unknown work item/u);
  assert.throws(() => normalizePlanningArtifact({
    ...planningArtifact(),
    workItems: planningArtifact().workItems.map((item) => item.id === 'work-schema'
      ? { ...item, dependsOn: ['work-adapter'] }
      : item),
  }), /cycle/u);
});

test('hard completion requires a runtime artifact contract and never reuses a Decision Ticket', () => {
  const artifact = normalizePlanningArtifact({
    ...planningArtifact(),
    completionClaim: 'hard',
    runtimeArtifactContract: {
      kind: RUNTIME_ARTIFACT_CONTRACT_KIND,
      artifactRef: 'artifact:runtime:delivery',
      consumer: 'rex long-running delivery runtime',
      verification: 'node --test tests/runtime-contract.test.mjs',
      evidenceRefs: ['receipt:runtime-contract'],
    },
  });
  assert.equal(artifact.runtimeArtifactContract.kind, RUNTIME_ARTIFACT_CONTRACT_KIND);
  assert.throws(() => normalizePlanningArtifact({ ...planningArtifact(), completionClaim: 'hard' }), /runtime artifact contract/u);
  assert.throws(() => normalizePlanningArtifact({ ...planningArtifact(), decisionTicketRef: 'artifact:delivery-ticket:wrong' }), /separate Decision Ticket/u);
});

test('planning artifact rejects placeholder refs and incomplete Decision Ticket refs', () => {
  const artifact = planningArtifact();
  assert.throws(() => normalizePlanningArtifact({
    ...artifact,
    decisionTicketRef: 'artifact:decision-ticket:',
  }), /Decision Ticket/u);
  assert.throws(() => normalizePlanningArtifact({
    ...artifact,
    workItems: artifact.workItems.map((item) => item.id === 'work-schema'
      ? { ...item, evidenceRefs: ['TODO'] }
      : item),
  }), /invalid or placeholder evidence ref/u);
});

test('planning artifact rejects duplicate or contradictory frontier and parallel membership', () => {
  const artifact = planningArtifact();
  assert.throws(() => normalizePlanningArtifact({
    ...artifact,
    frontier: {
      ready: ['work-schema'],
      blocked: [
        { workItemId: 'work-schema', reason: 'contradictory', evidenceRefs: ['artifact:frontier'] },
        ...artifact.frontier.blocked,
      ],
    },
  }), /frontier membership/u);
  assert.throws(() => normalizePlanningArtifact({
    ...artifact,
    parallelGroups: [['work-schema'], ['work-schema']],
  }), /multiple parallel groups/u);
});

test('planning artifact rejects parallel duplicates and unknown frontier entries', () => {
  assert.throws(() => normalizePlanningArtifact({ ...planningArtifact(), parallelGroups: [['work-schema', 'work-schema']] }), /duplicate/u);
  assert.throws(() => normalizePlanningArtifact({ ...planningArtifact(), frontier: { ready: ['work-missing'], blocked: [] } }), /unknown work item/u);
});
