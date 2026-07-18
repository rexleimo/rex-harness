import { readStandaloneWorkflow } from '../standalone/store.mjs';
import {
  booleanOption,
  option,
  parseOptions,
  rootOption,
} from './options.mjs';
import { presentCliWorkflow } from './workflow-output.mjs';

function workflowSelector(options) {
  const workItemKey = option(options, 'work-item');
  const workflowActivationId = option(options, 'workflow');
  if (!workItemKey && !workflowActivationId) {
    throw new Error('status/resume requires --work-item or --workflow');
  }
  return { workItemKey, workflowActivationId };
}

export function runStatus(args, { cwd = process.cwd() } = {}) {
  const options = parseOptions(args, { booleanFlags: ['full'] });
  const result = readStandaloneWorkflow({
    rootDir: rootOption(options, cwd),
    ...workflowSelector(options),
  });
  return presentCliWorkflow(result, { full: booleanOption(options, 'full') });
}

export function runResume(args, context = {}) {
  return runStatus(args, context);
}
