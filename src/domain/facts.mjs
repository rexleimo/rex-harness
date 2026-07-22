/**
 * 在系统边界校验宿主传入的观察结果，并返回不可变的 Fact。
 * 每个 Fact 都必须携带证据，避免使用无法追溯的模型直觉作为路由理由。
 */
export function normalizeFacts(facts = []) {
  if (!Array.isArray(facts)) throw new TypeError('facts must be an array');

  return facts.map((fact, index) => {
    if (!fact || typeof fact !== 'object') throw new TypeError(`fact ${index} must be an object`);
    const kind = String(fact.kind || '').trim();
    if (!kind) throw new TypeError(`fact ${index} requires kind`);
    const evidenceRefs = Array.isArray(fact.evidenceRefs)
      ? fact.evidenceRefs.map((ref) => String(ref).trim()).filter(Boolean)
      : [];
    if (evidenceRefs.length === 0) throw new TypeError(`fact ${kind} requires evidenceRefs`);
    if (fact.value === undefined) {
      return Object.freeze({ kind, evidenceRefs: Object.freeze(evidenceRefs) });
    }
    const value = String(fact.value || '').trim();
    if (!value) throw new TypeError(`fact ${kind} requires a non-empty value when provided`);
    return Object.freeze({ kind, value, evidenceRefs: Object.freeze(evidenceRefs) });
  });
}

// Capability 模块把第一个匹配的 Fact 同时作为触发原因，
// 并将其中的原因和证据引用原样返回给 AIOS。
export function findFact(facts, ...kinds) {
  return facts.find((fact) => kinds.includes(fact.kind)) || null;
}

/**
 * 将复合触发条件收敛成一个可审计的触发结果。
 * reason 决定路由原因码，prerequisites 与 reason 的证据都会进入 Activation。
 */
export function createCapabilityTrigger({ reason, prerequisites = [] } = {}) {
  if (!reason) return null;
  const evidenceRefs = [...new Set([
    ...prerequisites.flatMap((fact) => fact?.evidenceRefs || []),
    ...(reason.evidenceRefs || []),
  ])];
  return Object.freeze({
    kind: reason.kind,
    evidenceRefs: Object.freeze(evidenceRefs),
  });
}
