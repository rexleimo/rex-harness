// 让消费者只依赖这个公共入口，避免内部目录布局和 Provider 组装方式
// 意外变成无法调整的兼容性契约。
export { createRexCapabilityPack, validateCapabilityPack } from './kernel/capability-pack.mjs';
export { toAiosManifest } from './aios/manifest.mjs';
export { decideNextCapability, decidePromotion } from './composition-root.mjs';
export { installClientProjection, supportedClients } from './clients/install.mjs';
export { rexNativeProviderBindings } from './providers/catalog.mjs';
export { deriveSoftwareFacts } from './application/derive-facts.mjs';
export { evaluateSoftwareRequest } from './application/evaluate-request.mjs';
export { evaluateEvidence } from './application/evaluate-evidence.mjs';
export { validateCommandEvidence } from './application/validate-command-evidence.mjs';
export { advanceActivation } from './application/advance-activation.mjs';
export { nextCommand, startActivation } from './application/start-activation.mjs';
export { CAPABILITY } from './domain/capability-ids.mjs';
export { FACT } from './domain/fact-kinds.mjs';
export { OBSERVATION } from './domain/observation-kinds.mjs';
export {
  TESTABILITY_DECISION,
  normalizeTestabilityDecision,
  testabilityEvidenceRefs,
  validateTestabilityDecisionReceipt,
} from './domain/testability-decision.mjs';
export {
  assertExecutionReceiptMatchesCommand,
  executionCommandsMatch,
  executionReceiptRef,
  normalizeExecutionCommand,
  normalizeExecutionReceipt,
} from './domain/execution-receipts.mjs';
export {
  advanceLongRunningDelivery,
  startLongRunningDelivery,
} from './domain/long-running-delivery.mjs';
export { listProfiles, resolveProfile } from './profiles/index.mjs';
export { listSoftwareWorkflowRecipes } from './workflows/software-recipes.mjs';
export { analyzeExecutionProfile } from './workflows/execution-profile.mjs';
export {
  SOFTWARE_WORKFLOW_ID,
  advanceSoftwareWorkflow,
  startSoftwareWorkflow,
} from './workflows/software-workflow-runtime.mjs';
export {
  presentStandaloneWorkflow,
  readStandaloneWorkflow,
  captureStandaloneExecutionReceipt,
  resolveStandaloneExecutionReceipt,
  startStandaloneWorkflow,
  submitStandaloneEvidence,
} from './standalone/store.mjs';
