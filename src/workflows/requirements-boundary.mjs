import { normalizeRequirementsDecision } from '../domain/requirements-decision.mjs';
import { requirementsReadinessEvidenceRefs } from '../domain/requirements-readiness.mjs';
import { validateCommandEvidence } from '../application/validate-command-evidence.mjs';

export function resolveRequirementsDecision(workflow, evidence, suppliedDecision, { resolveReceipt } = {}) {
  const refs = new Set((evidence || [])
    .filter((item) => item?.kind === 'requirements-decision-recorded')
    .flatMap((item) => item.refs || []));
  const persisted = workflow.requirementsDecision || null;
  if (refs.size === 0) {
    if (suppliedDecision !== undefined) {
      throw new Error('requirements decision requires requirements-decision-recorded evidence');
    }
    return persisted;
  }
  if (suppliedDecision === undefined && !persisted) {
    throw new Error('requirements-decision-recorded evidence requires a typed requirements decision');
  }
  const decision = normalizeRequirementsDecision(suppliedDecision === undefined ? persisted : suppliedDecision);
  if (!refs.has(decision.decisionRef)) {
    throw new Error('requirements decisionRef must be included in requirements-decision-recorded evidence');
  }
  const recorded = workflow.requirementsDecision
    ? normalizeRequirementsDecision(workflow.requirementsDecision) : null;
  const comparable = (item) => {
    if (recorded?.readiness) return item;
    const { readiness, ...historicalFields } = item;
    return historicalFields;
  };
  if (suppliedDecision !== undefined && recorded
    && JSON.stringify(comparable(decision)) !== JSON.stringify(comparable(recorded))) {
    throw new Error('requirements decision is already recorded; start a new workflow for a changed decision');
  }
  if (decision.readiness) {
    assertReadinessEvidence(decision, { command: workflow.currentCommand, resolveReceipt });
  }
  return decision;
}

export function assertReadinessEvidence(decision, { command, resolveReceipt } = {}) {
  if (!decision?.readiness) return;
  // 所有入口的嵌套 receipt 与顶层证据走同一验证器，不能藏入不存在的探针回执。
  const nestedRefs = requirementsReadinessEvidenceRefs(decision.readiness);
  const contract = command || { expectedEvidence: ['requirements-decision-recorded'] };
  for (let offset = 0; offset < nestedRefs.length; offset += 32) {
    validateCommandEvidence(contract, [{
      kind: 'requirements-decision-recorded', refs: nestedRefs.slice(offset, offset + 32),
    }], { resolveReceipt });
  }
}

export function requirementsReadinessBlocker(decision) {
  if (!decision?.readiness) return 'requirements-readiness-required';
  const normalized = normalizeRequirementsDecision(decision);
  if (normalized.readiness.status !== 'ready') return 'requirements-not-ready';
  return '';
}
