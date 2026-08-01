import { normalizeEvidenceRefs } from './evidence.mjs';

const TOP_LEVEL_KEYS = new Set([
  'schemaVersion',
  'kind',
  'status',
  'objective',
  'decisionTicketRef',
  'workItems',
  'frontier',
  'parallelGroups',
  'convergenceGate',
  'completionClaim',
  'runtimeArtifactContract',
]);
const WORK_ITEM_KEYS = new Set(['id', 'title', 'outcome', 'completionCriteria', 'verification', 'evidenceRefs', 'dependsOn']);
const FRONTIER_KEYS = new Set(['ready', 'blocked']);
const BLOCKED_KEYS = new Set(['workItemId', 'reason', 'evidenceRefs']);
const GATE_KEYS = new Set(['requiredEvidenceRefs', 'verification', 'joinCondition']);
const RUNTIME_KEYS = new Set(['kind', 'artifactRef', 'consumer', 'verification', 'evidenceRefs']);

function assertObject(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError(`${label} must be an object`);
}

function text(value, label) {
  const normalized = String(value || '').trim();
  if (!normalized) throw new TypeError(`${label} must be non-empty`);
  return normalized;
}

function list(value, label, { allowEmpty = false } = {}) {
  if (!Array.isArray(value) || (!allowEmpty && value.length === 0)) throw new TypeError(`${label} must be an array`);
  return value;
}

function strings(value, label, options) {
  return Object.freeze(list(value, label, options).map((ref) => text(ref, `${label} item`)));
}

function rejectUnknown(value, allowed, label) {
  assertObject(value, label);
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) throw new TypeError(`${label} contains unknown field: ${key}`);
  }
}

function freezeWorkItem(item) {
  rejectUnknown(item, WORK_ITEM_KEYS, 'delivery work item');
  const id = text(item.id, 'delivery work item id');
  if (!/^work-[a-z0-9][a-z0-9-]*$/u.test(id)) throw new TypeError('delivery work item id must be stable and slug-like');
  const dependsOn = strings(item.dependsOn || [], 'delivery work item dependsOn', { allowEmpty: true });
  if (new Set(dependsOn).size !== dependsOn.length) {
    throw new TypeError('delivery work item contains duplicate dependencies');
  }
  return Object.freeze({
    id,
    title: text(item.title, 'delivery work item title'),
    outcome: text(item.outcome, 'delivery work item outcome'),
    completionCriteria: strings(item.completionCriteria, 'delivery work item completionCriteria'),
    verification: strings(item.verification, 'delivery work item verification'),
    evidenceRefs: normalizeEvidenceRefs(item.evidenceRefs, 'delivery work item evidenceRefs'),
    dependsOn,
  });
}

function assertAcyclic(items) {
  const byId = new Map(items.map((item) => [item.id, item]));
  for (const item of items) {
    for (const dependency of item.dependsOn) {
      if (!byId.has(dependency)) throw new TypeError(`delivery dependency references unknown work item: ${dependency}`);
      if (dependency === item.id) throw new TypeError('delivery work item cannot depend on itself');
    }
  }
  const visiting = new Set();
  const visited = new Set();
  function visit(id) {
    if (visiting.has(id)) throw new TypeError('delivery dependency graph contains a cycle');
    if (visited.has(id)) return;
    visiting.add(id);
    for (const dependency of byId.get(id).dependsOn) visit(dependency);
    visiting.delete(id);
    visited.add(id);
  }
  for (const item of items) visit(item.id);
}

function freezeBlocked(blocked, ids) {
  rejectUnknown(blocked, BLOCKED_KEYS, 'delivery blocked frontier item');
  const workItemId = text(blocked.workItemId, 'delivery blocked workItemId');
  if (!ids.has(workItemId)) throw new TypeError('delivery blocked frontier references unknown work item');
  return Object.freeze({
    workItemId,
    reason: text(blocked.reason, 'delivery blocked reason'),
    evidenceRefs: normalizeEvidenceRefs(blocked.evidenceRefs, 'delivery blocked evidenceRefs'),
  });
}

export const PLANNING_ARTIFACT_KIND = 'rex.delivery-ticket.v1';
export const RUNTIME_ARTIFACT_CONTRACT_KIND = 'rex.runtime-artifact-contract.v1';

export function normalizePlanningArtifact(input) {
  rejectUnknown(input, TOP_LEVEL_KEYS, 'delivery ticket');
  if (input.schemaVersion !== 1) throw new TypeError('delivery ticket schemaVersion must be 1');
  if (input.kind !== PLANNING_ARTIFACT_KIND) throw new TypeError('delivery ticket kind is invalid');
  const status = text(input.status || 'ready', 'delivery ticket status').toLowerCase();
  if (!['ready', 'partial', 'blocked', 'complete'].includes(status)) throw new TypeError('delivery ticket status is invalid');
  const [decisionTicketRef] = normalizeEvidenceRefs(
    [input.decisionTicketRef],
    'delivery decisionTicketRef',
  );
  if (!/^artifact:decision-ticket:[a-z0-9][a-z0-9-]*$/u.test(decisionTicketRef)) {
    throw new TypeError('delivery decisionTicketRef must reference a separate Decision Ticket');
  }
  const workItems = Object.freeze(list(input.workItems, 'delivery workItems').map(freezeWorkItem));
  const ids = new Set(workItems.map((item) => item.id));
  if (ids.size !== workItems.length) throw new TypeError('delivery work item ids must be unique');
  assertAcyclic(workItems);

  rejectUnknown(input.frontier, FRONTIER_KEYS, 'delivery frontier');
  const ready = strings(input.frontier.ready, 'delivery frontier ready');
  if (ready.some((id) => !ids.has(id))) throw new TypeError('delivery frontier ready references unknown work item');
  if (new Set(ready).size !== ready.length) throw new TypeError('delivery frontier ready contains duplicate work item');
  const blocked = Object.freeze((input.frontier.blocked || []).map((item) => freezeBlocked(item, ids)));
  const blockedIds = blocked.map((item) => item.workItemId);
  const frontierMembership = [...ready, ...blockedIds];
  const frontierIds = new Set(frontierMembership);
  if (new Set(blockedIds).size !== blockedIds.length
    || frontierIds.size !== frontierMembership.length
    || frontierIds.size !== ids.size
    || frontierMembership.some((id) => !ids.has(id))) {
    throw new TypeError('delivery frontier membership must place every work item exactly once');
  }

  const groupedWorkItems = new Set();
  const parallelGroups = Object.freeze(list(input.parallelGroups, 'delivery parallelGroups').map((group, index) => {
    const members = strings(group, `delivery parallel group ${index}`);
    if (members.some((id) => !ids.has(id))) throw new TypeError('delivery parallel group references unknown work item');
    if (new Set(members).size !== members.length) throw new TypeError('delivery parallel group contains duplicate work item');
    if (members.some((id) => groupedWorkItems.has(id))) {
      throw new TypeError('delivery work item cannot appear in multiple parallel groups');
    }
    for (const id of members) groupedWorkItems.add(id);
    return members;
  }));

  rejectUnknown(input.convergenceGate, GATE_KEYS, 'delivery convergenceGate');
  const convergenceGate = Object.freeze({
    requiredEvidenceRefs: normalizeEvidenceRefs(
      input.convergenceGate.requiredEvidenceRefs,
      'delivery convergenceGate requiredEvidenceRefs',
    ),
    verification: text(input.convergenceGate.verification, 'delivery convergenceGate verification'),
    joinCondition: text(input.convergenceGate.joinCondition, 'delivery convergenceGate joinCondition'),
  });

  const completionClaim = text(input.completionClaim || 'soft', 'delivery completionClaim').toLowerCase();
  if (!['soft', 'hard'].includes(completionClaim)) throw new TypeError('delivery completionClaim must be soft or hard');
  let runtimeArtifactContract = null;
  if (completionClaim === 'hard') {
    rejectUnknown(input.runtimeArtifactContract, RUNTIME_KEYS, 'runtime artifact contract');
    if (input.runtimeArtifactContract.kind !== RUNTIME_ARTIFACT_CONTRACT_KIND) {
      throw new TypeError('hard completion requires a runtime artifact contract');
    }
    const [artifactRef] = normalizeEvidenceRefs(
      [input.runtimeArtifactContract.artifactRef],
      'runtime artifact contract artifactRef',
    );
    if (!artifactRef.startsWith('artifact:')) {
      throw new TypeError('runtime artifact contract artifactRef must use the artifact protocol');
    }
    runtimeArtifactContract = Object.freeze({
      kind: RUNTIME_ARTIFACT_CONTRACT_KIND,
      artifactRef,
      consumer: text(input.runtimeArtifactContract.consumer, 'runtime artifact contract consumer'),
      verification: text(input.runtimeArtifactContract.verification, 'runtime artifact contract verification'),
      evidenceRefs: normalizeEvidenceRefs(
        input.runtimeArtifactContract.evidenceRefs,
        'runtime artifact contract evidenceRefs',
      ),
    });
  } else if (input.runtimeArtifactContract !== undefined && input.runtimeArtifactContract !== null) {
    throw new TypeError('soft completion cannot claim a runtime artifact contract');
  }

  return Object.freeze({
    schemaVersion: 1,
    kind: PLANNING_ARTIFACT_KIND,
    status,
    objective: text(input.objective, 'delivery objective'),
    decisionTicketRef,
    workItems,
    frontier: Object.freeze({ ready, blocked }),
    parallelGroups,
    convergenceGate,
    completionClaim,
    runtimeArtifactContract,
  });
}
