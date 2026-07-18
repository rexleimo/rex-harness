import { normalizeEvidence } from '../domain/evidence.mjs';

export function evaluateEvidence(requiredEvidence = [], evidence = []) {
  const normalized = normalizeEvidence(evidence);
  const observedKinds = new Set(normalized.map((item) => item.kind));
  const missingEvidence = requiredEvidence.filter((kind) => !observedKinds.has(kind));
  return Object.freeze({
    ok: missingEvidence.length === 0,
    missingEvidence: Object.freeze(missingEvidence),
    evidence: normalized,
  });
}

