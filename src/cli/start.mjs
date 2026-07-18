import { startStandaloneWorkflow } from '../standalone/store.mjs';
import {
  booleanOption,
  option,
  parseOptions,
  rootOption,
} from './options.mjs';
import { presentCliWorkflow } from './workflow-output.mjs';

export function runStart(args, { cwd = process.cwd() } = {}) {
  const options = parseOptions(args, { booleanFlags: ['full'] });
  const result = startStandaloneWorkflow({
    rootDir: rootOption(options, cwd),
    workItemKey: option(options, 'work-item', { required: true }),
    request: { message: option(options, 'message', { required: true }) },
    profile: option(options, 'profile', { fallback: 'default' }),
  });
  return presentCliWorkflow(result, { full: booleanOption(options, 'full') });
}
