import { normalizeEvidence } from '../domain/evidence.mjs';

/**
 * 评估证据契约。契约项可以是：
 * - 字符串 kind：必须出现该证据；
 * - `{ anyOf: [...] }` 对象：组内任一证据出现即满足（用于澄清收敛出口，
 *   例如验收标准或假设记录二选一，防止澄清会话无限循环）。
 * 字符串项行为保持向后兼容。
 */
export function evaluateEvidence(requiredEvidence = [], evidence = []) {
  const normalized = normalizeEvidence(evidence);
  const observedKinds = new Set(normalized.map((item) => item.kind));
  const missingEvidence = requiredEvidence.filter((item) => {
    if (item && typeof item === 'object' && Array.isArray(item.anyOf)) {
      return !item.anyOf.some((kind) => observedKinds.has(kind));
    }
    return !observedKinds.has(item);
  });
  return Object.freeze({
    ok: missingEvidence.length === 0,
    missingEvidence: Object.freeze(missingEvidence),
    evidence: normalized,
  });
}
