import { normalizeEvidenceRefs } from './evidence.mjs';

const TOP_LEVEL_KEYS = new Set([
  'schemaVersion',
  'kind',
  'status',
  'destination',
  'decisionGraph',
  'unknowns',
  'decisionTicket',
  'nextSlice',
]);

const NODE_KEYS = new Set(['id', 'question', 'fact', 'decision', 'evidenceRefs']);
const EDGE_KEYS = new Set(['from', 'to', 'reason']);
const UNKNOWN_KEYS = new Set(['id', 'question', 'impact', 'evidenceRefs']);
const TICKET_KEYS = new Set(['ticketId', 'facts', 'decision', 'consequences', 'evidenceRefs']);
const SLICE_KEYS = new Set(['id', 'outcome', 'verification', 'evidenceRefs']);

function assertObject(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`${label} must be an object`);
  }
}

function text(value, label) {
  const normalized = String(value || '').trim();
  if (!normalized) throw new TypeError(`${label} must be non-empty`);
  return normalized;
}

function list(value, label) {
  if (!Array.isArray(value) || value.length === 0) throw new TypeError(`${label} must be a non-empty array`);
  return value;
}

function strings(value, label) {
  return Object.freeze(list(value, label).map((ref) => text(ref, `${label} item`)));
}

function rejectUnknown(value, allowed, label) {
  assertObject(value, label);
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) throw new TypeError(`${label} contains unknown field: ${key}`);
  }
}

function freezeNode(node) {
  rejectUnknown(node, NODE_KEYS, 'decision graph node');
  return Object.freeze({
    id: text(node.id, 'decision graph node id'),
    question: text(node.question, 'decision graph node question'),
    ...(node.fact === undefined ? {} : { fact: text(node.fact, 'decision graph node fact') }),
    ...(node.decision === undefined ? {} : { decision: text(node.decision, 'decision graph node decision') }),
    evidenceRefs: normalizeEvidenceRefs(node.evidenceRefs, 'decision graph node evidenceRefs'),
  });
}

function freezeEdge(edge, nodeIds) {
  rejectUnknown(edge, EDGE_KEYS, 'decision graph edge');
  const from = text(edge.from, 'decision graph edge from');
  const to = text(edge.to, 'decision graph edge to');
  if (!nodeIds.has(from) || !nodeIds.has(to)) throw new TypeError('decision graph edge references an unknown node');
  if (from === to) throw new TypeError('decision graph edge cannot be self-referential');
  return Object.freeze({
    from,
    to,
    ...(edge.reason === undefined ? {} : { reason: text(edge.reason, 'decision graph edge reason') }),
  });
}

function freezeUnknown(unknown) {
  rejectUnknown(unknown, UNKNOWN_KEYS, 'wayfinding unknown');
  return Object.freeze({
    id: text(unknown.id, 'wayfinding unknown id'),
    question: text(unknown.question, 'wayfinding unknown question'),
    impact: text(unknown.impact, 'wayfinding unknown impact'),
    evidenceRefs: normalizeEvidenceRefs(unknown.evidenceRefs, 'wayfinding unknown evidenceRefs'),
  });
}

function freezeDecisionTicket(ticket) {
  rejectUnknown(ticket, TICKET_KEYS, 'wayfinding decision ticket');
  const ticketId = text(ticket.ticketId, 'wayfinding decision ticket id');
  if (!/^decision-[a-z0-9][a-z0-9-]*$/u.test(ticketId)) {
    throw new TypeError('wayfinding decision ticket id must be stable and slug-like');
  }
  return Object.freeze({
    ticketId,
    facts: strings(ticket.facts, 'wayfinding decision ticket facts'),
    decision: text(ticket.decision, 'wayfinding decision ticket decision'),
    consequences: strings(ticket.consequences, 'wayfinding decision ticket consequences'),
    evidenceRefs: normalizeEvidenceRefs(ticket.evidenceRefs, 'wayfinding decision ticket evidenceRefs'),
  });
}

function freezeNextSlice(slice) {
  rejectUnknown(slice, SLICE_KEYS, 'wayfinding next slice');
  return Object.freeze({
    id: text(slice.id, 'wayfinding next slice id'),
    outcome: text(slice.outcome, 'wayfinding next slice outcome'),
    verification: text(slice.verification, 'wayfinding next slice verification'),
    evidenceRefs: normalizeEvidenceRefs(slice.evidenceRefs, 'wayfinding next slice evidenceRefs'),
  });
}

export const WAYFINDER_ARTIFACT_KIND = 'rex.wayfinding-artifact.v1';

export function normalizeWayfinderArtifact(input) {
  rejectUnknown(input, TOP_LEVEL_KEYS, 'wayfinding artifact');
  if (input.schemaVersion !== 1) throw new TypeError('wayfinding artifact schemaVersion must be 1');
  if (input.kind !== WAYFINDER_ARTIFACT_KIND) throw new TypeError('wayfinding artifact kind is invalid');
  const status = text(input.status || 'complete', 'wayfinding artifact status').toLowerCase();
  if (!['complete', 'partial', 'blocked'].includes(status)) throw new TypeError('wayfinding artifact status is invalid');

  rejectUnknown(input.destination, new Set(['name', 'successSignal', 'scope', 'evidenceRefs']), 'wayfinding destination');
  const destination = Object.freeze({
    name: text(input.destination.name, 'wayfinding destination name'),
    successSignal: text(input.destination.successSignal, 'wayfinding destination successSignal'),
    scope: strings(input.destination.scope, 'wayfinding destination scope'),
    evidenceRefs: normalizeEvidenceRefs(input.destination.evidenceRefs, 'wayfinding destination evidenceRefs'),
  });

  rejectUnknown(input.decisionGraph, new Set(['nodes', 'edges']), 'wayfinding decisionGraph');
  const nodes = Object.freeze(list(input.decisionGraph.nodes, 'wayfinding decisionGraph nodes').map(freezeNode));
  const nodeIds = new Set(nodes.map((node) => node.id));
  if (nodeIds.size !== nodes.length) throw new TypeError('wayfinding decisionGraph node ids must be unique');
  const edges = Object.freeze((input.decisionGraph.edges || []).map((edge) => freezeEdge(edge, nodeIds)));

  const unknowns = Object.freeze((input.unknowns || []).map(freezeUnknown));
  const decisionTicket = input.decisionTicket == null ? null : freezeDecisionTicket(input.decisionTicket);
  const nextSlice = input.nextSlice == null ? null : freezeNextSlice(input.nextSlice);
  if (status === 'complete' && (!decisionTicket || !nextSlice)) {
    throw new TypeError('complete wayfinding artifact requires one decisionTicket and one nextSlice');
  }
  if (status !== 'complete' && (decisionTicket || nextSlice)) {
    throw new TypeError('partial or blocked wayfinding artifact cannot claim a completed decision or nextSlice');
  }

  return Object.freeze({
    schemaVersion: 1,
    kind: WAYFINDER_ARTIFACT_KIND,
    status,
    destination,
    decisionGraph: Object.freeze({ nodes, edges }),
    unknowns,
    decisionTicket,
    nextSlice,
  });
}
