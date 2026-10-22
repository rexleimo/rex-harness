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
  try {
    raw = readImpl(path.join(rootDir, configRelativePath));
  } catch {
    // 中文注释：没有项目配置就按清单默认跑。这不是赦免——处置照旧逐条执行，只是没有覆盖项。
    raw = '{}';
  }
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    return { ok: false, errors: [{ code: 'invalid-budget', path: configRelativePath, message: error.message }] };
  }
  return resolveStandardConfig(parsed);
}

function measureForRule({ rule, files, rootDir, extensions, readImpl }) {
  if (rule !== 'fileLines') return measureDirectoryEntries(files);
  const candidates = files.filter((file) => extensions.some((ext) => file.endsWith(ext)));
  const reads = [];
  for (const file of candidates) {
    try {
      reads.push({ path: file, content: readImpl(path.join(rootDir, file)) });
    } catch {
      // 中文注释：tracked 却读不到（工作树里被删）就不计入，也不猜行数。
      // 凭空报一条超标和漏报一条真超标，是同一种不诚实。
      continue;
    }
  }
  return measureFileLines(reads);
}

export async function runStandards({
  rootDir,
  rule = 'all',
  config,
  json = false,
  io = console,
  gitImpl,
  readImpl,
  extensions = DEFAULT_SOURCE_EXTENSIONS,
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
    const report = applyBudgetRule({
      rule: id,
      measurements: measureForRule({ rule: id, files: tracked.files, rootDir, extensions, readImpl }),
      budgets: resolved.budgets,
      exemptions: resolved.exemptions,
      baselines: resolved.baselines,
    });
    const code = report.blocking > 0 ? 1 : 0;
    exitCode = Math.max(exitCode, code);
    results.push({ rule: id, status: code ? 'fail' : 'ok', report, exitCode: code });
    emit(io, json, {
      root: rootDir, rule: id, status: code ? 'fail' : 'ok', reason: null,
      budget: report.budget, measured: report.measured, blocking: report.blocking,
      violations: report.violations, exempt: report.exempt,
    }, report);
  }
  return { exitCode, results };
}

function emit(io, json, record, report) {
  if (json) {
    io.log(JSON.stringify(record));
    return;
  }
  if (record.status === 'skip') {
    io.log(`[standards] SKIP ${record.rule}: ${record.reason}`);
    return;
  }
  for (const violation of record.violations) io.log(`[standards] FAIL ${record.rule} ${violation.detail}`);
  for (const item of report.recovered) {
    io.log(`[standards] RECOVERED ${record.rule} ${item.path} now ${item.count}; remove its baseline entry`);
  }
  io.log(`[standards] ${record.rule}: measured=${record.measured} overBudget=${report.overBudget}`
    + ` exempt=${record.exempt.length} baseline=${report.baseline.length}`
    + ` blocking=${record.blocking} budget=${record.budget} root=${record.root}`);
}
