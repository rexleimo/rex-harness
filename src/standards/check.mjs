/**
 * 标准检查命令的实现：在**任何** git 仓库里量 rex-harness 清单里的可量化规则，逐条给出处置。
 *
 * 为什么实现在子模块：这条规则是公开产品面的一部分——第三方装完 rex-harness 就该能跑它，
 * 而不必先装某个宿主。宿主侧只准转发（ADR 0001 / ADR 0002）。
 *
 * 输入契约是闭集：`rootDir` + `rule` + `config`。目标根由调用方决定；取不到 tracked 列表时
 * 返回 skip 并退出 0，不用文件遍历猜一份口径（那会把未提交与未发布的结构都算成违规）。
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

import { applyBudgetRule, measureDirectoryEntries, measureFileLines } from '../domain/budget-rule.mjs';
import { measureDuplicateLines } from '../domain/duplication.mjs';
import { measureReverseDependencyEdges } from '../domain/layer-declaration.mjs';
import { QUANTITATIVE_STANDARD_RULES } from '../domain/quantitative-rules.mjs';
import { resolveStandardConfig } from '../domain/standard-config.mjs';

export const RULE_IDS = Object.freeze(Object.keys(QUANTITATIVE_STANDARD_RULES));

/** 中文注释：哪些文件算源码。这是工具的默认，不是宿主的秘密——宿主可以整条覆盖，但不得另写一份判定。 */
export const DEFAULT_SOURCE_EXTENSIONS = Object.freeze(['.mjs', '.js', '.cjs', '.ts', '.tsx']);

export const DEFAULT_PROJECT_CONFIG_PATH = 'config/standards.json';

function runGit(args, cwd) {
  try {
    const stdout = execFileSync('git', args, {
      cwd, encoding: 'buffer', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'],
    });
    return { ok: true, stdout, stderr: '' };
  } catch (error) {
    return { ok: false, stdout: '', stderr: String(error?.stderr ?? error?.message ?? error) };
  }
}

export function listTrackedFiles({ rootDir, gitImpl = runGit }) {
  const inside = gitImpl(['rev-parse', '--is-inside-work-tree'], rootDir);
  if (!inside.ok || String(inside.stdout).trim() !== 'true') {
    return { ok: false, reason: `not a git work tree: ${rootDir}` };
  }
  const listed = gitImpl(['ls-files', '-z'], rootDir);
  if (!listed.ok) {
    return { ok: false, reason: `git ls-files failed in ${rootDir}: ${listed.stderr.trim()}` };
  }
  return {
    ok: true,
    files: listed.stdout.toString('utf8').split('\0').map((line) => line.trim()).filter(Boolean),
  };
}

export function loadProjectConfig({
  rootDir,
  configRelativePath = DEFAULT_PROJECT_CONFIG_PATH,
  readImpl = (file) => fs.readFileSync(file, 'utf8'),
} = {}) {
  let raw;
  let found = true;
  try {
    raw = readImpl(path.join(rootDir, configRelativePath));
  } catch {
    // 中文注释：没有项目配置就按清单默认跟，但要把"这个仓库还没配置过"这件事告诉调用方：
    // 首次运行把存量仓库刷成一片红不是门禁，是噪声（所以未配置时只报不拦）。
    raw = '{}';
    found = false;
  }
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    return { ok: false, errors: [{ code: 'invalid-budget', path: configRelativePath, message: error.message }] };
  }
  const resolved = resolveStandardConfig(parsed);
  // 中文注释：configFound 跟解析结果一起返：调用方拿到的是"有没有配置 + 配置对不对"两个独立事实。
  return resolved.ok === true ? { ...resolved, configFound: found } : { ...resolved, configFound: found };
}

const CONTENT_RULES = new Set(['fileLines', 'duplicateLines']);

/**
 * 规则自己声明它需要什么（manifest 的 `requires`）；命令只负责检查这些东西是否齐备。
 * 缺东西就 SKIP 并说清缺什么——绝不出一个猜测式的违规，也绝不拿“没数据”冒充“很干净”。
 */
const REQUIREMENTS = Object.freeze({
  'layers declaration': ({ layers }) => (layers ? null : 'the project config declares no `layers` section'),
  'module graph edges': ({ edges }) => (edges ? null : 'no module graph supplied (pass --edges <json: {file: [targets]}>)'),
});

function missingRequirements({ rule, layers, edges }) {
  const needs = QUANTITATIVE_STANDARD_RULES[rule].requires ?? [];
  return needs
    .map((need) => {
      const check = REQUIREMENTS[need];
      // 中文注释：check 返回 null 是「齐备」，不是「缺这个检查」——两者用 ?? 混起来就会把
      // 完整的输入误报成“本构建供不了这个输入”，把绿判成跳。先分“没这个检查”和“检查过了”。
      if (!check) return `this build has no supply rule for required input: ${need}`;
      return check({ layers, edges });
    })
    .filter(Boolean);
}

export const FREEZE_HINT = 'run `rex-harness standards check --freeze` to freeze this stock as baselines and gate future growth';

function measureForRule({ rule, files, rootDir, extensions, readImpl, layers, edges }) {
  if (rule === 'reverseDependencies') {
    const candidates = files.filter((file) => extensions.some((ext) => file.endsWith(ext)));
    return {
      measurements: measureReverseDependencyEdges(edges, layers),
      candidates: candidates.length,
      unreadable: 0,
    };
  }
  if (!CONTENT_RULES.has(rule)) {
    return { measurements: measureDirectoryEntries(files), candidates: files.length, unreadable: 0 };
  }
  const candidates = files.filter((file) => extensions.some((ext) => file.endsWith(ext)));
  const reads = [];
  let unreadable = 0;
  for (const file of candidates) {
    try {
      reads.push({ path: file, content: readImpl(path.join(rootDir, file)) });
    } catch (error) {
      // 中文注释：只有“tracked 但工作树里已删”这一种情况可以不计入。
      // 其他错误（包括注入的度量器本身坏了）必须往上抛——静默继续就是空报通过。
      if (error?.code === 'ENOENT') { unreadable += 1; continue; }
      throw error;
    }
  }
  // 中文注释：两条读内容的规则共用这一份 reads——同一个文件读两遍不是效率问题，是两份口径可能不一致。
  const measurements = rule === 'duplicateLines' ? measureDuplicateLines(reads) : measureFileLines(reads);
  return { measurements, candidates: candidates.length, unreadable };
}

export async function runStandards({
  rootDir,
  rule = 'all',
  config,
  json = false,
  io = console,
  gitImpl,
  readImpl = (file) => fs.readFileSync(file, 'utf8'),
  extensions = DEFAULT_SOURCE_EXTENSIONS,
  configFound = true,
  strict = false,
  layers,
  edges = null,
} = {}) {
  const resolved = config ?? loadProjectConfig({ rootDir });
  if (resolved.ok === false) {
    // 中文注释：配置不合法必须响亮失败。静默按默认预算跑，等于让"写了却没生效"继续存在。
    for (const error of resolved.errors ?? []) {
      io.log(`[standards] config ${error.code} at ${error.path}: ${error.message}`);
    }
    return { status: 'config-error', exitCode: 1, errors: resolved.errors };
  }

  const rules = rule === 'all' ? RULE_IDS : [rule];
  const layerConfig = layers ?? resolved.layers ?? null;
  let exitCode = 0;
  const results = [];
  for (const id of rules) {
    const tracked = listTrackedFiles({ rootDir, gitImpl });
    if (!tracked.ok) {
      exitCode = Math.max(exitCode, 0);
      results.push({ rule: id, status: 'skip', reason: tracked.reason, exitCode: 0 });
      emit(io, json, {
        root: rootDir, rule: id, status: 'skip', reason: tracked.reason,
        budget: null, measured: null, blocking: null, violations: [], exempt: [],
      });
      continue;
    }
    let measured;
    // 中文注释：先查规则声明的输入是否齐备：缺了就 SKIP + 原因，而不是拿空数据进预算判定。
    const unavailable = missingRequirements({ rule: id, layers: layerConfig, edges });
    if (unavailable.length > 0) {
      results.push({ rule: id, status: 'skip', exitCode: 0 });
      emit(io, json, {
        root: rootDir, rule: id, status: 'skip', reason: unavailable.join('; '),
        budget: null, measured: null, blocking: null, violations: [], exempt: [],
      });
      continue;
    }
    try {
      measured = measureForRule({ rule: id, files: tracked.files, rootDir, extensions, readImpl, layers: layerConfig, edges });
    } catch (error) {
      // 中文注释：度量本身坏了（注入的读器抛错、git 输出形状意外）要结构化地报红，
      // 不是摔一个栈给用户看，也不是静默报 ok。退出码仍是 1，保证 CI 读得到。
      exitCode = 1;
      results.push({ rule: id, status: 'measure-error', exitCode: 1 });
      emit(io, json, {
        root: rootDir, rule: id, status: 'measure-error',
        reason: `${id} could not be measured: ${error.message}`,
        budget: null, measured: 0, blocking: 1, violations: [], exempt: [],
      });
      continue;
    }
    const dense = QUANTITATIVE_STANDARD_RULES[id].coverage === 'all-entities';
    if (dense && measured.candidates > 0 && measured.measurements.size === 0) {
      // 中文注释：有可度量对象却一条也没度量到，不是“干净”，是木柱断了。
      // 这个分支就是本仓库上一次真实出的错：readImpl 没默认值，每次读都报错被吞掉，
      // 于是 fileLines 规则在 1425 个候选文件上报 measured=0 / status=ok / exit 0。
      exitCode = 1;
      results.push({ rule: id, status: 'measure-error', exitCode: 1 });
      emit(io, json, {
        root: rootDir, rule: id, status: 'measure-error',
        reason: `${id} measured 0 of ${measured.candidates} candidate entities; the measure itself is broken`,
        budget: null, measured: 0, blocking: 1, violations: [], exempt: [],
      });
      continue;
    }
    const report = applyBudgetRule({
      rule: id,
      measurements: measured.measurements,
      budgets: resolved.budgets,
      exemptions: resolved.exemptions,
      baselines: resolved.baselines,
    });
    // 中文注释：项目还没写过 config/standards.json 时，红灯只报不判——你没配置过的门不该弄挂你的构建。
    // 写配置（或 --freeze）才是显式接受门禁；--strict 把旧行为留给想先看真相的人。
    const code = report.blocking > 0 ? 1 : 0;
    const stock = code === 1 && !strict && !configFound;
    exitCode = Math.max(exitCode, stock ? 0 : code);
    results.push({ rule: id, status: stock ? 'stock' : (code ? 'fail' : 'ok'), report, exitCode: stock ? 0 : code });
    emit(io, json, {
      root: rootDir, rule: id, status: stock ? 'stock' : (code ? 'fail' : 'ok'), reason: null,
      budget: report.budget, measured: report.measured, blocking: report.blocking,
      violations: report.violations, exempt: report.exempt,
    }, report);
  }
  return { exitCode, results };
}

/**
 * 存量债务快照：给 `--freeze` 用，只收 blocking 项的路径与计数。
 * 中文注释：走同一条 runStandards（strict + 假装无配置）而不是另写一遍度量流程——
 * “冻下来的存量”和“检查报出的违规”必须同一口径，否则第二天又红一批。
 */
export async function collectStockDebt({ rootDir, rule = 'all', gitImpl, readImpl, extensions } = {}) {
  const { results } = await runStandards({
    rootDir, rule, io: { log() {} }, gitImpl, readImpl, extensions, configFound: false, strict: true,
  });
  const rules = {};
  for (const item of results) {
    if (item.status !== 'fail' || !item.report) continue;
    rules[item.rule] = item.report.violations.map((violation) => ({ path: violation.path, count: violation.count }));
  }
  return { rules, totals: Object.fromEntries(Object.entries(rules).map(([key, value]) => [key, value.length])) };
}

function emit(io, json, record, report) {
  if (json) {
    io.log(JSON.stringify(record));
    return;
  }
  if (record.status === 'stock') {
    io.log('[standards] STOCK ' + record.rule + ': ' + record.blocking + ' over budget ' + record.budget
      + ' (reported, not gated: this repository has no config/standards.json)');
    for (const violation of record.violations.slice(0, 20)) io.log('[standards] STOCK ' + record.rule + ' ' + violation.detail); // 最多打 20 行：满屏堆在终端里不会让人修，只会让人关掉它
    if (record.violations.length > 20) io.log('[standards] ... ' + (record.violations.length - 20) + ' more; use --json for the full list');
    io.log('[standards] hint: ' + FREEZE_HINT);
    return;
  }
  if (record.status === 'skip' || record.status === 'measure-error') {
    io.log(`[standards] ${record.status === 'skip' ? 'SKIP' : 'ERROR'} ${record.rule}: ${record.reason}`);
    return;
  }  for (const violation of record.violations) io.log(`[standards] FAIL ${record.rule} ${violation.detail}`);
  for (const item of report.recovered) {
    io.log(`[standards] RECOVERED ${record.rule} ${item.path} now ${item.count}; remove its baseline entry`);
  }
  io.log(`[standards] ${record.rule}: measured=${record.measured} overBudget=${report.overBudget}`
    + ` exempt=${record.exempt.length} baseline=${report.baseline.length}`
    + ` blocking=${record.blocking} budget=${record.budget} root=${record.root}`);
}
