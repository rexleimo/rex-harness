import { normalizeEvidence } from '../domain/evidence.mjs';

const PLACEHOLDER_REF = /artifact-or-command-ref|placeholder|真实存在|todo|tbd/iu;

/**
 * 公共证据入口只能提交当前 Command 明确要求的类型，并且引用必须带协议前缀。
 * 这让独立 CLI 和 AIOS Adapter 能共享同一组基本证据约束。
 */
export function validateCommandEvidence(command, evidence = []) {
  if (!Array.isArray(evidence) || evidence.length === 0) {
    throw new TypeError('rex evidence requires a non-empty evidence array');
  }
  if (evidence.length > 64) throw new TypeError('rex evidence exceeds 64 evidence items');

  const normalized = normalizeEvidence(evidence);
  const expected = new Set(command?.expectedEvidence || []);
  for (const item of normalized) {
    if (!expected.has(item.kind)) {
      throw new Error(`unexpected rex evidence kind for current Command: ${item.kind}`);
    }
    if (item.refs.length > 32) throw new TypeError(`evidence ${item.kind} exceeds 32 refs`);
    for (const ref of item.refs) {
      if (PLACEHOLDER_REF.test(ref) || !/^[a-z][a-z0-9+.-]*:.+/iu.test(ref)) {
        throw new Error(`evidence ${item.kind} contains an invalid or placeholder ref: ${ref}`);
      }
    }
  }
  return normalized;
}
