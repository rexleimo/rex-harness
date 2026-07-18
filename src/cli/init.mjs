import { installClientProjection } from '../clients/install.mjs';
import { option, parseOptions, rootOption } from './options.mjs';

export function runInit(args = [], { cwd = process.cwd() } = {}) {
  const options = parseOptions(args);
  return installClientProjection({
    client: option(options, 'client', { required: true }),
    rootDir: rootOption(options, cwd),
  });
}
