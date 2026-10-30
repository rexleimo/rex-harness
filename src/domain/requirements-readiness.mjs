const REF = /^[a-z][a-z0-9+.-]*:[^\s]+$/iu;

function object(value, keys, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`readiness ${label} must be an object`);
  }
  for (const key of Object.keys(value)) {
    if (!keys.includes(key)) throw new TypeError(`readiness ${label} contains unknown field ${key}`);
  }
}

function text(value, label) {
  if (typeof value !== 'string' || !value.trim()) throw new TypeError(`readiness ${label} must be non-empty`);
  return value.trim();
}

function choice(value, values, label) {
  if (!values.includes(value)) throw new TypeError(`readiness ${label} must be ${values.join('|')}`);
  return value;
}

function list(value, label) {
  if (!Array.isArray(value)) throw new TypeError(`readiness ${label} must be an array`);
  return value;
}

function refs(value, label, required = false) {
  const result = list(value, label).map((item) => text(item, label));
  if (result.some((item) => !REF.test(item)) || (required && !result.length)) {
    throw new TypeError(`readiness ${label} requires protocol evidence refs`);
  }
  return Object.freeze(result);
}

function decision(value) {
  object(value, ['id', 'dependsOn', 'status', 'impact', 'rationale', 'evidenceRefs'], 'decision');
  const status = choice(value.status, ['resolved', 'assumed', 'open'], 'decision.status');
  return Object.freeze({
    id: text(value.id, 'decision.id'),
    dependsOn: Object.freeze(list(value.dependsOn, 'decision.dependsOn').map((id) => text(id, 'dependency'))),
    status,
    impact: choice(value.impact, ['critical', 'low'], 'decision.impact'),
    rationale: text(value.rationale, 'decision.rationale'),
    evidenceRefs: refs(value.evidenceRefs, 'decision.evidenceRefs', status !== 'open'),
  });
}

function assertGraph(decisions) {
  const byId = new Map(decisions.map((item) => [item.id, item]));
  if (!byId.size || byId.size !== decisions.length) throw new TypeError('readiness decisions require unique ids');
  const visiting = new Set();
  const visited = new Set();
  function visit(id) {
    if (visited.has(id)) return;
    if (!byId.has(id)) throw new TypeError(`readiness unknown decision dependency ${id}`);
    if (visiting.has(id)) throw new TypeError('readiness decision dependencies contain a cycle');
    visiting.add(id);
    for (const dependency of byId.get(id).dependsOn) visit(dependency);
    visiting.delete(id);
    visited.add(id);
  }
  for (const id of byId.keys()) visit(id);
}

/** 语义结论由模型显式报告；代码只验证依赖、状态自洽和证据形状，不猜自然语言。 */
export function normalizeRequirementsReadiness(value) {
  object(value, ['status', 'decisions', 'walkthroughs', 'feasibility', 'alignment'], 'record');
  const status = choice(value.status, ['ready', 'blocked'], 'status');
  const ready = status === 'ready';
  const decisions = Object.freeze(list(value.decisions, 'decisions').map(decision));
  assertGraph(decisions);
  if (ready && decisions.some((item) => item.status === 'open'
    || (item.status === 'assumed' && item.impact === 'critical'))) {
    throw new TypeError('readiness ready cannot contain open decisions or critical assumptions');
  }
  object(value.walkthroughs, ['happyPath', 'failurePath'], 'walkthroughs');
  const walkthroughs = Object.freeze({
    happyPath: refs(value.walkthroughs.happyPath, 'walkthroughs.happyPath', ready),
    failurePath: refs(value.walkthroughs.failurePath, 'walkthroughs.failurePath', ready),
  });
  object(value.feasibility, ['status', 'evidenceRefs'], 'feasibility');
  const feasibility = Object.freeze({
    status: choice(value.feasibility.status, ['supported', 'unknown'], 'feasibility.status'),
    evidenceRefs: refs(value.feasibility.evidenceRefs, 'feasibility.evidenceRefs', ready),
  });
  object(value.alignment, ['status', 'evidenceRefs'], 'alignment');
  const alignment = Object.freeze({
    status: choice(value.alignment.status, ['confirmed', 'pending'], 'alignment.status'),
    evidenceRefs: refs(value.alignment.evidenceRefs, 'alignment.evidenceRefs', ready),
  });
  if (ready && (feasibility.status !== 'supported' || alignment.status !== 'confirmed')) {
    throw new TypeError('readiness ready requires supported feasibility and confirmed alignment');
  }
  return Object.freeze({ status, decisions, walkthroughs, feasibility, alignment });
}

export function requirementsReadinessEvidenceRefs(value) {
  const readiness = normalizeRequirementsReadiness(value);
  return [...new Set([
    ...readiness.decisions.flatMap((item) => item.evidenceRefs),
    ...readiness.walkthroughs.happyPath,
    ...readiness.walkthroughs.failurePath,
    ...readiness.feasibility.evidenceRefs,
    ...readiness.alignment.evidenceRefs,
  ])];
}
