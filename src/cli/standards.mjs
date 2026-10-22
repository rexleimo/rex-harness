/* 中文注释：`rex-harness standards check` 的参数面。实现全在 src/standards/check.mjs，
 * 这里只做解析——宿主（aios）转发时走的也是同一条命令，不得在别处再写一份判定。 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

import { collectModuleEdges } from '../domain/module-edges.mjs';
import { DEFAULT_SOURCE_EXTENSIONS, RULE_IDS, runStandards } from '../standards/check.mjs';
import { booleanOption, option, parseOptions, rootOption } from './options.mjs';

// 中文注释：边的约定位置——写下来就不是宿主需要知道的秘密，读不到也只是 SKIP。
export const DEFAULT_EDGES_RELATIVE_PATH = '.aios/standards/module-edges.json';

/** 中文注释：读不到图不是错误：引擎会说“没数据所以没得判”，而不是“数据为零所以很干净”。 */
function loadEdges(file) {
  try {
    return new Map(Object.entries(JSON.parse(fs.readFileSync(file, 'utf8'))));
  } catch {
    return null;
  }
}

export function standardsHelp() {
  return [
    'Usage: rex-harness standards check [--root <dir>] [--rule all|' + RULE_IDS.join('|') + '] [--json]',
    '       rex-harness standards check --write-edges [--root <dir>]  (self-contained module graph)',
    '',
    'Measures the quantitative engineering standards in any git repository and',
    'reports one disposition per entity: pass, exempt, baseline, violation.',
    'Project overrides live in <root>/config/standards.json.',
    'Layer direction reads ' + DEFAULT_EDGES_RELATIVE_PATH + '; --write-edges builds it from tracked sources.',
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
  let edgesFile;
  let writeEdges;
  try {
    options = parseOptions(rest, { booleanFlags: ['json', 'write-edges'] });
    rootDir = path.resolve(rootOption(options, cwd));
    rule = option(options, 'rule', { fallback: 'all' });
    json = booleanOption(options, 'json');
    writeEdges = booleanOption(options, 'write-edges');
    edgesFile = path.join(rootDir, DEFAULT_EDGES_RELATIVE_PATH);
  } catch (error) {
    io.log(`standards: ${error.message}`);
    return { status: 'usage', exitCode: 2 };
  }

  if (writeEdges) return writeEdgeSnapshot({ rootDir, edgesFile, io });
  if (rule !== 'all' && !RULE_IDS.includes(rule)) {
    io.log(`standards: --rule must be all or one of ${RULE_IDS.join(', ')}`);
    return { status: 'usage', exitCode: 2 };
  }

  const result = await runStandards({ rootDir, rule, json, io, edges: loadEdges(edgesFile) });
  return { ...result, status: result.exitCode === 0 ? 'ok' : 'fail' };
}

/**
 * 边快照：只采自己 tracked 的源码，写到自己根下的约定路径。
 * 中文注释：这就是“第三方开箱能跑”的另一半——不需要宿主递图，也不需要多仓库模式。
 */
function writeEdgeSnapshot({ rootDir, edgesFile, io }) {
  const files = listTrackedFiles(rootDir);
  if (files === null) {
    io.log(`standards: cannot write edges: ${rootDir} is not a git work tree`);
    return { status: 'error', exitCode: 1 };
  }
  const edges = collectModuleEdges({ files, extensions: DEFAULT_SOURCE_EXTENSIONS, readFile: (file) => fs.readFileSync(path.join(rootDir, file), 'utf8') });
  fs.mkdirSync(path.dirname(edgesFile), { recursive: true });
  fs.writeFileSync(edgesFile, `${JSON.stringify(Object.fromEntries(edges), null, 2)}\n`);
  io.log(`standards: wrote ${edges.size} edge entries to ${DEFAULT_EDGES_RELATIVE_PATH}`);
  return { status: 'ok', exitCode: 0 };
}

function listTrackedFiles(rootDir) {
  try {
    return execFileSync('git', ['ls-files', '-z'], {
      cwd: rootDir, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'],
    }).split('\0').filter(Boolean);
  } catch {
    return null;
  }
}
