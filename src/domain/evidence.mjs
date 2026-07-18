/** 在推进 Activation 前，把宿主证据收敛为稳定、可序列化的契约。 */
export function normalizeEvidence(evidence = []) {
  if (!Array.isArray(evidence)) throw new TypeError('evidence must be an array');

  return evidence.map((item, index) => {
    if (!item || typeof item !== 'object') throw new TypeError(`evidence ${index} must be an object`);
    const kind = String(item.kind || '').trim();
    if (!kind) throw new TypeError(`evidence ${index} requires kind`);
    const refs = Array.isArray(item.refs)
      ? item.refs.map((ref) => String(ref).trim()).filter(Boolean)
      : [];
    if (refs.length === 0) throw new TypeError(`evidence ${kind} requires refs`);
    return Object.freeze({ kind, refs: Object.freeze(refs) });
  });
}

export function mergeEvidence(current = [], incoming = []) {
  const merged = new Map();
  for (const item of normalizeEvidence([...current, ...incoming])) {
    const refs = new Set([...(merged.get(item.kind) || []), ...item.refs]);
    merged.set(item.kind, refs);
  }
  return Object.freeze([...merged.entries()].map(([kind, refs]) => Object.freeze({
    kind,
    refs: Object.freeze([...refs]),
  })));
}

