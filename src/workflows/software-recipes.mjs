import { createRexCapabilityPack } from '../kernel/capability-pack.mjs';
import { CAPABILITY } from '../domain/capability-ids.mjs';
import { SOFTWARE_WORKFLOW_ID } from './software-workflow-runtime.mjs';

const RUNTIME_AUTHORITY = 'src/workflows/software-workflow-runtime.mjs';

function capabilityCandidate(capability) {
  const recipeStages = Object.freeze(capability.recipe.stages.map((stage) => Object.freeze({
    id: stage.id,
    objective: stage.objective,
    requiredEvidence: Object.freeze([...stage.requiredEvidence]),
  })));

  return Object.freeze({
    id: capability.id,
    capabilityId: capability.id,
    recipeId: capability.recipe.id,
    objective: capability.description,
    requiredEvidence: Object.freeze([...capability.requiredEvidence]),
    mode: 'conditional',
    ...(capability.id === CAPABILITY.REVIEW_SPECIALIST ? { selector: 'risk-domain' } : {}),
    recipeStages,
  });
}

/**
 * 这里只投影自适应运行时的候选能力，供宿主做发现、说明和 UI 展示。
 * 实际阶段由 software-workflow-runtime 根据 Fact 与 Evidence 动态选择，数组顺序不是执行顺序。
 */
export function listSoftwareWorkflowRecipes({ profile = 'default' } = {}) {
  const pack = createRexCapabilityPack({ profile });
  const enabled = new Set(pack.profile.enabledCapabilities);
  const stages = pack.capabilities
    .filter((capability) => enabled.has(capability.id))
    .map(capabilityCandidate);

  return Object.freeze([
    Object.freeze({
      kind: 'rex.software-workflow-descriptor.v1',
      workflowId: SOFTWARE_WORKFLOW_ID,
      trigger: 'runtime-selected from software Facts',
      description: 'Select and advance exactly one software-engineering Capability at a time from observed Facts and accepted Evidence.',
      runtimeManaged: true,
      runtimeAuthority: RUNTIME_AUTHORITY,
      executionSemantics: 'fact-and-evidence-driven',
      readinessScope: 'current-command',
      stages: Object.freeze(stages),
      // 完成条件属于当前 Command 的 Evidence Contract，不能再复制成固定工作流质量门。
      qualityGates: Object.freeze([]),
    }),
  ]);
}
