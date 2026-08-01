import fs from 'node:fs';
import path from 'node:path';

import { submitStandaloneEvidence } from '../standalone/store.mjs';
import {
  booleanOption,
  evidenceOptions,
  option,
  parseOptions,
  rootOption,
} from './options.mjs';
import { presentCliWorkflow } from './workflow-output.mjs';

function isContained(rootDir, target) {
  const relative = path.relative(path.resolve(rootDir), target);
  return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative));
}

function resolveDecisionFile(rootDir, source, optionName) {
  const rootPath = path.resolve(rootDir);
  const target = path.resolve(rootPath, source);
  if (!isContained(rootPath, target)) {
    throw new Error(`invalid --${optionName}: file must resolve inside the selected workspace`);
  }
  try {
    const realRoot = fs.realpathSync(rootPath);
    const realTarget = fs.realpathSync(target);
    if (!isContained(realRoot, realTarget)) {
      throw new Error(`invalid --${optionName}: file must resolve inside the selected workspace`);
    }
    return realTarget;
  } catch (error) {
    if (error.message.startsWith(`invalid --${optionName}:`)) throw error;
    if (error.code === 'ENOENT') return target;
    throw new Error(`invalid --${optionName}: ${error.message}`, { cause: error });
  }
}

function readDecisionFile(options, rootDir, optionName) {
  const source = option(options, optionName);
  if (!source) return undefined;
  const target = resolveDecisionFile(rootDir, source, optionName);
  try {
    const content = fs.readFileSync(target, 'utf8');
    const verifiedTarget = resolveDecisionFile(rootDir, source, optionName);
    if (verifiedTarget !== target) {
      throw new Error(`invalid --${optionName}: file changed during validation`);
    }
    return JSON.parse(content);
  } catch (error) {
    throw new Error(`invalid --${optionName}: ${target}: ${error.message}`, { cause: error });
  }
}

export function runEvidence(args, { cwd = process.cwd() } = {}) {
  const options = parseOptions(args, { booleanFlags: ['full'] });
  const rootDir = rootOption(options, cwd);
  const result = submitStandaloneEvidence({
    rootDir,
    activationId: option(options, 'activation', { required: true }),
    commandToken: option(options, 'command-token', { required: true }),
    evidence: evidenceOptions(options),
    testabilityDecision: readDecisionFile(options, rootDir, 'testability-file'),
    requirementsDecision: readDecisionFile(options, rootDir, 'requirements-file'),
  });
  return presentCliWorkflow(result, { full: booleanOption(options, 'full') });
}
