import { captureStandaloneExecutionReceipt } from '../standalone/store.mjs';
import {
  parseOptions,
  rootOption,
} from './options.mjs';

/**
 * The command after `--` is executed without a shell. Its exit code is data in
 * the receipt, so a failing test still returns a usable JSON receipt to callers.
 */
export function runReceipt(args, { cwd = process.cwd() } = {}) {
  const delimiter = args.indexOf('--');
  if (delimiter < 0) throw new Error('receipt requires a command after --');
  const optionArgs = args.slice(0, delimiter);
  const command = args.slice(delimiter + 1);
  if (command.length === 0 || !String(command[0] || '').trim()) {
    throw new Error('receipt requires a command after --');
  }
  const options = parseOptions(optionArgs);
  const result = captureStandaloneExecutionReceipt({
    rootDir: rootOption(options, cwd),
    executable: command[0],
    args: command.slice(1),
  });
  return Object.freeze({
    schemaVersion: 1,
    kind: 'rex.cli.execution-receipt.v1',
    ...result,
  });
}
