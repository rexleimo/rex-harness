import { CAPABILITY } from '../domain/capability-ids.mjs';

function bundledSkill(capabilityId, id) {
  return Object.freeze({
    capabilityId,
    provider: Object.freeze({
      kind: 'skill',
      id,
      source: 'bundled',
      instructionsRef: `skill-sources/${id}/SKILL.md`,
    }),
  });
}

// 默认目录只包含 rex 自有 Provider。外部项目适配必须由宿主显式传入，
// 不能污染独立安装时的基础执行闭环。
export const rexNativeProviderBindings = Object.freeze([
  bundledSkill(CAPABILITY.REQUIREMENTS_CLARIFY, 'rex-requirements'),
  bundledSkill(CAPABILITY.DESIGN_RESOLVE, 'rex-design'),
  bundledSkill(CAPABILITY.PLANNING_SEQUENCE, 'rex-planning'),
  bundledSkill(CAPABILITY.TESTING_DESIGN, 'rex-test-design'),
  bundledSkill(CAPABILITY.TESTING_TDD, 'rex-tdd'),
  bundledSkill(CAPABILITY.TESTING_STRICT_TDD, 'rex-strict-tdd'),
  bundledSkill(CAPABILITY.TESTING_HARDENING, 'rex-refactor-hardening'),
  bundledSkill(CAPABILITY.DEBUG_ROOT_CAUSE, 'rex-debug'),
  bundledSkill(CAPABILITY.IMPLEMENTATION_MINIMIZE, 'rex-minimal-construction'),
  bundledSkill(CAPABILITY.IMPLEMENTATION_EXECUTE, 'rex-implement'),
  bundledSkill(CAPABILITY.REVIEW_STANDARDS_SPEC, 'rex-code-review'),
  Object.freeze({
    capabilityId: CAPABILITY.REVIEW_SPECIALIST,
    provider: Object.freeze({
      kind: 'agent',
      id: 'rex-specialist-review',
      role: 'specialist-reviewer',
      selector: 'risk-domain',
      source: 'bundled',
      instructionsRef: 'skill-sources/rex-workflow/references/reviewers.json',
    }),
  }),
  bundledSkill(CAPABILITY.NAVIGATION_WAYFIND, 'rex-wayfinder'),
]);
