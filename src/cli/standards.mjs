/* 中文注释：`rex-harness standards check` 的参数面。实现全在 src/standards/check.mjs，
 * 这里只做解析——宿主（aios）转发时走的也是同一条命令，不得在别处再写一份判定。 */
import path from 'node:path';

import { RULE_IDS, runStandards } from '../standards/check.mjs';
import { booleanOption, option, parseOptions, rootOption } from './options.mjs';

export function standardsHelp() {
  return [
    'Usage: rex-harness standards check [--root <dir>] [--rule all|' + RULE_IDS.join('|') + '] [--json]',
    '',
    'Measures the quantitative engineering standards in any git repository and',
    'reports one disposition per entity: pass, exempt, baseline, violation.',
    'Project overrides live in <root>/config/standards.json.',
    'Exit codes: 0 clean or skipped (no git), 1 violation or invalid project config.',
  ].join('\n');
}

export async function runStandardsArgs(argv = [], { io = console, cwd = process.cwd() } = {}) {
  const [verb = 'check', ...rest] = argv;
  if (verb === 'help' || rest.includes('--help')) {
    io.log(standardsHelp());
    return { status: 'help', exitCode: 0 };
  }
  if (verb !== 'check') {
    io.log(`standards: unknown subcommand "${verb}"\n${standardsHelp()}`);
    return { status: 'usage', exitCode: 2 };
  }

  let options;
  let rootDir;
  let rule;
  let json;
  try {
    options = parseOptions(rest, { booleanFlags: ['json'] });
    rootDir = rootOption(options, cwd);
    rule = option(options, 'rule', { fallback: 'all' });
    json = booleanOption(options, 'json');
  } catch (error) {
    io.log(`standards: ${error.message}`);
    return { status: 'usage', exitCode: 2 };
  }
  if (rule !== 'all' && !RULE_IDS.includes(rule)) {
    io.log(`standards: --rule must be all or one of ${RULE_IDS.join(', ')}`);
    return { status: 'usage', exitCode: 2 };
  }

  const result = await runStandards({ rootDir: path.resolve(rootDir), rule, json, io });
  return { ...result, status: result.exitCode === 0 ? 'ok' : 'fail' };
}
