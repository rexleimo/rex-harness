import { submitStandaloneEvidence } from '../standalone/store.mjs';
import {
  booleanOption,
  evidenceOptions,
  option,
  parseOptions,
  rootOption,
} from './options.mjs';
import { presentCliWorkflow } from './workflow-output.mjs';

export function runEvidence(args, { cwd = process.cwd() } = {}) {
  const options = parseOptions(args, { booleanFlags: ['full'] });
  const result = submitStandaloneEvidence({
    rootDir: rootOption(options, cwd),
    activationId: option(options, 'activation', { required: true }),
    commandToken: option(options, 'command-token', { required: true }),
    evidence: evidenceOptions(options),
  });
  return presentCliWorkflow(result, { full: booleanOption(options, 'full') });
}
