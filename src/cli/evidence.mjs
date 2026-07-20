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

function readTestabilityDecision(options, rootDir) {
  const source = option(options, 'testability-file');
  if (!source) return undefined;
  const target = path.resolve(rootDir, source);
  try {
    return JSON.parse(fs.readFileSync(target, 'utf8'));
  } catch (error) {
    throw new Error(`invalid --testability-file: ${target}: ${error.message}`, { cause: error });
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
    testabilityDecision: readTestabilityDecision(options, rootDir),
  });
  return presentCliWorkflow(result, { full: booleanOption(options, 'full') });
}
