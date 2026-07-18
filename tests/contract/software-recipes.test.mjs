import assert from 'node:assert/strict';
import test from 'node:test';

import {
  CAPABILITY,
  SOFTWARE_WORKFLOW_ID,
  analyzeExecutionProfile,
  listSoftwareWorkflowRecipes,
} from '../../src/index.mjs';

test('software workflow registry describes one adaptive runtime instead of fixed executable recipes', () => {
  const [workflow] = listSoftwareWorkflowRecipes();

  assert.equal(workflow.workflowId, SOFTWARE_WORKFLOW_ID);
  assert.equal(workflow.runtimeManaged, true);
  assert.equal(workflow.executionSemantics, 'fact-and-evidence-driven');
  assert.match(workflow.runtimeAuthority, /software-workflow-runtime\.mjs$/u);
  assert.equal(workflow.stages.length, 12);
  assert.ok(workflow.stages.every((stage) => stage.mode === 'conditional'));

  for (const candidate of workflow.stages) {
    assert.match(candidate.capabilityId, /^software\./u);
    assert.ok(candidate.objective);
    assert.ok(candidate.requiredEvidence.length > 0);
    assert.ok(candidate.recipeStages.length > 0);
  }

  const strictTdd = workflow.stages.filter(
    (stage) => stage.capabilityId === CAPABILITY.TESTING_STRICT_TDD,
  );
  assert.equal(strictTdd.length, 1);
  assert.deepEqual(strictTdd[0].recipeStages.map((stage) => stage.id), ['red', 'green', 'refactor']);

  const specialist = workflow.stages.find(
    (stage) => stage.capabilityId === CAPABILITY.REVIEW_SPECIALIST,
  );
  assert.equal(specialist.selector, 'risk-domain');
});

test('Fast Balanced Deep is derived from actual activations instead of request routing', () => {
  assert.equal(analyzeExecutionProfile([]).label, 'fast');
  assert.equal(analyzeExecutionProfile([
    { capabilityId: CAPABILITY.REQUIREMENTS_CLARIFY },
    { capabilityId: CAPABILITY.TESTING_DESIGN },
    { capabilityId: CAPABILITY.IMPLEMENTATION_EXECUTE },
    { capabilityId: CAPABILITY.REVIEW_STANDARDS_SPEC },
  ]).label, 'balanced');
  assert.equal(analyzeExecutionProfile([
    { capabilityId: CAPABILITY.TESTING_STRICT_TDD },
  ]).label, 'deep');
});
