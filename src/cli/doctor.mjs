import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { createRexCapabilityPack, validateCapabilityPack } from '../kernel/capability-pack.mjs';
import { rexWorkflowSkill, supportedClients } from '../clients/install.mjs';
import {
  booleanOption,
  option,
  parseOptions,
} from './options.mjs';

const PACKAGE_ROOT = fileURLToPath(new URL('../../', import.meta.url));

function inspectProvider(binding, rootDir) {
  const { provider } = binding;
  const instructionsPath = path.resolve(rootDir, provider.instructionsRef);
  const exists = fs.existsSync(instructionsPath) && fs.statSync(instructionsPath).isFile();
  return Object.freeze({
    capabilityId: binding.capabilityId,
    id: provider.id,
    kind: provider.kind,
    source: provider.source,
    instructionsRef: provider.instructionsRef,
    status: exists ? 'ready' : 'missing-instructions',
  });
}

function readSpecialistReviewers(rootDir, checks) {
  const specialist = checks.find((check) => check.kind === 'agent');
  if (!specialist || specialist.status !== 'ready') return { ids: [], errors: [] };
  const target = path.resolve(rootDir, specialist.instructionsRef);
  try {
    const catalog = JSON.parse(fs.readFileSync(target, 'utf8'));
    if (catalog?.kind !== 'rex.specialist-reviewers.v1' || !Array.isArray(catalog.reviewers)) {
      return { ids: [], errors: ['invalid bundled specialist Reviewer catalog'] };
    }
    const invalid = catalog.reviewers.some((reviewer) => (
      !reviewer?.id || !Array.isArray(reviewer.riskDomains) || reviewer.riskDomains.length === 0
    ));
    if (invalid) return { ids: [], errors: ['invalid bundled specialist Reviewer entry'] };
    return { ids: catalog.reviewers.map((reviewer) => reviewer.id), errors: [] };
  } catch (error) {
    return { ids: [], errors: [`invalid bundled specialist Reviewer catalog: ${error.message}`] };
  }
}

// Doctor 以发布包根目录为可信边界，同时验证语义内核和内置 Provider。
// 外部增强是否安装不会影响独立就绪状态，也不会被静默计入默认 Provider。
export function runDoctor({
  profile = 'default',
  rootDir = PACKAGE_ROOT,
  includeProviders = false,
} = {}) {
  const pack = createRexCapabilityPack({ profile });
  const validation = validateCapabilityPack(pack);
  const enabled = new Set(pack.profile.enabledCapabilities);
  const bound = new Set(pack.providerBindings.map((binding) => binding.capabilityId));
  const missingBindings = [...enabled].filter((capabilityId) => !bound.has(capabilityId));
  const providerChecks = pack.providerBindings.map((binding) => inspectProvider(binding, rootDir));
  const missingProviderInstructions = providerChecks
    .filter((check) => check.status !== 'ready')
    .map((check) => check.instructionsRef);
  const workflowSkillPath = path.resolve(rootDir, rexWorkflowSkill.instructionsRef);
  const workflowSkillReady = fs.existsSync(workflowSkillPath)
    && fs.statSync(workflowSkillPath).isFile();
  const missingInstructions = [
    ...missingProviderInstructions,
    ...(workflowSkillReady ? [] : [rexWorkflowSkill.instructionsRef]),
  ];
  const nonNativeProviders = providerChecks
    .filter((check) => !check.id.startsWith('rex-') || check.source !== 'bundled')
    .map((check) => check.id);
  const reviewers = readSpecialistReviewers(rootDir, providerChecks);
  const errors = [
    ...validation.errors,
    ...missingBindings.map((id) => `missing Provider binding: ${id}`),
    ...missingProviderInstructions.map((ref) => `missing Provider instructions: ${ref}`),
    ...(workflowSkillReady ? [] : [`missing client workflow instructions: ${rexWorkflowSkill.instructionsRef}`]),
    ...nonNativeProviders.map((id) => `default Provider is not rex-native: ${id}`),
    ...reviewers.errors,
  ];
  const kernelReady = validation.valid && missingBindings.length === 0;

  return Object.freeze({
    schemaVersion: 1,
    kind: 'rex.doctor-report.v1',
    status: errors.length === 0 ? 'ready' : 'invalid',
    kernel: Object.freeze({
      status: kernelReady ? 'ready' : 'invalid',
      packId: pack.id,
      schemaVersion: pack.schemaVersion,
      profile: pack.profile.id,
      capabilities: pack.capabilities.length,
    }),
    providers: Object.freeze(providerChecks.map((check) => Object.freeze({
      capabilityId: check.capabilityId,
      id: check.id,
      kind: check.kind,
      source: check.source,
    }))),
    missingInstructions: Object.freeze(missingInstructions),
    clientIntegration: Object.freeze({
      status: workflowSkillReady ? 'available' : 'missing-workflow-skill',
      clients: supportedClients(),
      command: 'rex-harness init --client <client>',
      instructionsRef: rexWorkflowSkill.instructionsRef,
    }),
    hostIntegration: 'optional-enhancement',
    providerChecks: includeProviders ? Object.freeze(providerChecks) : undefined,
    specialistReviewers: includeProviders ? Object.freeze(reviewers.ids) : undefined,
    errors: Object.freeze(errors),
  });
}

export function runDoctorArgs(args = []) {
  const options = parseOptions(args, { booleanFlags: ['providers'] });
  return runDoctor({
    profile: option(options, 'profile', { fallback: 'default' }),
    rootDir: option(options, 'root', { fallback: PACKAGE_ROOT }),
    includeProviders: booleanOption(options, 'providers'),
  });
}
