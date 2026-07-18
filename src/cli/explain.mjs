import { decideNextCapability } from '../composition-root.mjs';

// Explain 是诊断 Adapter。cli:* 证据引用明确标记了它的模拟来源，
// 不能把这些引用当成生产环境证据。
export function explainFacts(factKinds = [], options = {}) {
  const facts = factKinds.map((kind) => ({ kind, evidenceRefs: [`cli:${kind}`] }));
  return decideNextCapability(facts, options);
}
