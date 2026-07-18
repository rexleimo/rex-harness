function compactCommand(command) {
  if (!command) return null;
  return Object.freeze({
    activationId: command.activationId,
    commandToken: command.executionToken,
    capabilityId: command.capabilityId,
    providerKind: command.provider?.kind,
    providerId: command.provider?.id,
    instructionsRef: command.provider?.instructionsRef,
    stageId: command.stageId,
    objective: command.objective,
    expectedEvidence: Object.freeze([...(command.expectedEvidence || [])]),
  });
}

/**
 * CLI 默认只投影执行当前阶段所需的数据；完整 Workflow 仍由 standalone JS API 返回，
 * 避免宿主协议和面向模型的低上下文协议互相耦合。
 */
export function presentCliWorkflow(result, { full = false } = {}) {
  if (full) return result;
  const workflow = result?.workflow;
  if (!workflow) throw new TypeError('CLI workflow output requires a standalone workflow result');

  return Object.freeze({
    schemaVersion: 1,
    kind: 'rex.cli.workflow-command.v1',
    outcome: result.outcome,
    status: workflow.status,
    workflowActivationId: workflow.workflowActivationId,
    workItemKey: workflow.workItemKey,
    command: compactCommand(result.command),
    missingEvidence: Object.freeze([...(result.missingEvidence || [])]),
  });
}
