const PLACEHOLDER_REF = /artifact-or-command-ref|placeholder|真实存在|todo|tbd/iu;
const EVIDENCE_REF = /^[a-z][a-z0-9+.-]*:.+/iu;

export function normalizeEvidenceRefs(value, label = 'evidence refs', {
  allowEmpty = false,
  maxItems = 32,
} = {}) {
  if (!Array.isArray(value) || (!allowEmpty && value.length === 0)) {
    throw new TypeError(`${label} must be ${allowEmpty ? 'an array' : 'a non-empty array'}`);
  }
  if (value.length > maxItems) throw new TypeError(`${label} exceeds ${maxItems} refs`);
  return Object.freeze(value.map((item) => {
    const ref = String(item || '').trim();
    if (!ref || PLACEHOLDER_REF.test(ref) || !EVIDENCE_REF.test(ref)) {
      throw new TypeError(`${label} contains an invalid or placeholder evidence ref: ${ref || '(empty)'}`);
    }
    return ref;
  }));
}

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

