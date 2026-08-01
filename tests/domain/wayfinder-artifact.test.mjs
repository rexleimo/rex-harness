import assert from 'node:assert/strict';
import test from 'node:test';

import {
  WAYFINDER_ARTIFACT_KIND,
  normalizeWayfinderArtifact,
} from '../../src/index.mjs';

function completeArtifact(overrides = {}) {
  return {
    schemaVersion: 1,
    kind: WAYFINDER_ARTIFACT_KIND,
    status: 'complete',
    destination: {
      name: 'browser request handler',
      successSignal: 'the handler returns the current response contract',
      scope: ['browser command entry', 'handler tests'],
      evidenceRefs: ['path:src/cli.mjs'],
    },
    decisionGraph: {
      nodes: [
        { id: 'entry', question: 'Where does the command enter?', fact: 'CLI owns parsing', evidenceRefs: ['path:src/cli.mjs'] },
        { id: 'handler', question: 'Which handler owns the behavior?', decision: 'Use the request handler', evidenceRefs: ['path:src/handler.mjs'] },
      ],
      edges: [{ from: 'entry', to: 'handler', reason: 'entry dispatches to handler' }],
    },
    unknowns: [{ id: 'unknown-test', question: 'Which fixture covers the response?', impact: 'verification choice', evidenceRefs: ['path:tests/'] }],
    decisionTicket: {
      ticketId: 'decision-browser-handler',
      facts: ['CLI parses the command'],
      decision: 'Inspect the request handler before changing code',
      consequences: ['the next slice stays bounded'],
      evidenceRefs: ['path:src/cli.mjs'],
    },
    nextSlice: {
      id: 'slice-handler-entry',
      outcome: 'trace one command to one handler',
      verification: 'node --test tests/handler.test.mjs',
      evidenceRefs: ['path:tests/handler.test.mjs'],
    },
    ...overrides,
  };
}

test('wayfinder artifact normalizes destination, graph, unknowns, ticket, and one next slice', () => {
  const artifact = normalizeWayfinderArtifact(completeArtifact());
  assert.equal(artifact.kind, WAYFINDER_ARTIFACT_KIND);
  assert.equal(artifact.decisionGraph.nodes.length, 2);
  assert.equal(artifact.decisionGraph.edges.length, 1);
  assert.equal(artifact.decisionTicket.ticketId, 'decision-browser-handler');
  assert.equal(artifact.nextSlice.id, 'slice-handler-entry');
});

test('wayfinder partial state cannot claim a decision ticket or next slice', () => {
  const artifact = normalizeWayfinderArtifact({
    ...completeArtifact(),
    status: 'partial',
    decisionTicket: null,
    nextSlice: null,
  });
  assert.equal(artifact.status, 'partial');
  assert.equal(artifact.decisionTicket, null);
  assert.equal(artifact.nextSlice, null);
});

test('wayfinder artifact rejects unknown fields, duplicate nodes, and dangling edges', () => {
  assert.throws(() => normalizeWayfinderArtifact({ ...completeArtifact(), extra: true }), /unknown field/u);
  assert.throws(() => normalizeWayfinderArtifact({
    ...completeArtifact(),
    decisionGraph: { ...completeArtifact().decisionGraph, nodes: [...completeArtifact().decisionGraph.nodes, completeArtifact().decisionGraph.nodes[0]] },
  }), /node ids must be unique/u);
  assert.throws(() => normalizeWayfinderArtifact({
    ...completeArtifact(),
    decisionGraph: { ...completeArtifact().decisionGraph, edges: [{ from: 'entry', to: 'missing' }] },
  }), /unknown node/u);
});

test('wayfinder artifact rejects placeholder or unscoped evidence references', () => {
  const artifact = completeArtifact();
  assert.throws(() => normalizeWayfinderArtifact({
    ...artifact,
    destination: { ...artifact.destination, evidenceRefs: ['TODO'] },
  }), /invalid or placeholder evidence ref/u);
  assert.throws(() => normalizeWayfinderArtifact({
    ...artifact,
    nextSlice: { ...artifact.nextSlice, evidenceRefs: ['tests/handler.test.mjs'] },
  }), /invalid or placeholder evidence ref/u);
});

test('wayfinder complete artifact requires a stable decision ticket and exactly one next slice', () => {
  assert.throws(() => normalizeWayfinderArtifact({ ...completeArtifact(), decisionTicket: null }), /requires one decisionTicket/u);
  assert.throws(() => normalizeWayfinderArtifact({
    ...completeArtifact(),
    decisionTicket: { ...completeArtifact().decisionTicket, ticketId: 'TODO' },
  }), /stable/u);
  assert.throws(() => normalizeWayfinderArtifact({ ...completeArtifact(), nextSlice: [{ id: 'one' }] }), /must be an object/u);
});
