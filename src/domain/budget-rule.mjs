/**
 * 预算规则引擎：把「度量 → 处置」这条纯客观判定从宿主仓库的私有常量里拿出来。
 *
 * 立项原因：目录条目上限 8 与单文件软上限 400 行都写在标准文本里，但真正执行它们的代码只存在于
 * 宿主仓库的 `scripts/check-dir-budget.mjs`，豁免表也硬编码在里面。第三方装了 rex-harness 却用不上
 * 这条规则，而同一条规则有两个 owner 就会漂移（ADR 0002）。
 *
 * 边界：引擎只认「键 → 数值」的度量，不认目录、不认 git、不认文件类型。
 * 测哪个根、怎么取 tracked 列表、哪些扩展名算 source file，全部是调用方（宿主适配层）的决定；
 * 引擎既不接收也不回传根目录，这样它的输出在任何人那里都是同一句话。
 *
 * 处置是闭集四种：`exempt`（带理由豁免）/ `baseline`（存量冻结，只许收缩）/
 * `violation`（新增超标或存量增长，红灯）/ `pass`（达标）。
 * 目录条目与单文件行数共用这一张表：差别只在度量函数，不在判定逻辑。
 */
import { QUANTITATIVE_STANDARD_RULES } from './quantitative-rules.mjs';

const RULE_IDS = Object.freeze(Object.keys(QUANTITATIVE_STANDARD_RULES));

function isKnownRule(rule) {
  return RULE_IDS.includes(rule);
}

/**
 * 中文注释：把 tracked 路径列表折成「目录 → 直接条目数」。子目录本身占父目录一位——
 * 因为门禁管的是"这一层能被一眼读完吗"，不是"这层有多少文件"。
 * 分隔符固定 `/`：输入是 git ls-files 的输出，它本就是 POSIX 形式，不做平台转换。
 */
export function measureDirectoryEntries(trackedPaths) {
  const dirs = new Map();
  for (const file of trackedPaths) {
    const slash = file.lastIndexOf('/');
    const dir = slash < 0 ? '.' : file.slice(0, slash);
    if (!dirs.has(dir)) dirs.set(dir, new Set());
    dirs.get(dir).add(file.slice(slash + 1));
  }
  for (const dir of [...dirs.keys()]) {
    if (dir === '.') continue;
    const parent = dir.includes('/') ? dir.slice(0, dir.lastIndexOf('/')) : '.';
    if (!dirs.has(parent)) dirs.set(parent, new Set());
    dirs.get(parent).add(`${dir.slice(parent === '.' ? 0 : parent.length + 1)}/`);
  }
  return new Map([...dirs.entries()].map(([dir, entries]) => [dir, entries.size]));
}

/** 中文注释：行数度量按调用方已读到的内容计算，引擎自己不开文件。 */
export function measureFileLines(fileReads) {
  const counts = new Map();
  for (const { path, content } of fileReads) {
    // 中文注释：物理行数不以末尾换行多算一行——'a\nb\n' 是三行，不是四行。
    // 用 split 而不是数反斜杠-n，是为了与 readFileSync(\x27utf8\x27) 的调用方口径一致。
    const lines = content.split('\n');
    if (lines.at(-1) === '') lines.pop();
    counts.set(path, lines.length);
  }
  return counts;
}

function indexByPath(entries) {
  const list = Array.isArray(entries) ? entries : [];
  const map = new Map();
  for (const entry of list) {
    if (entry && typeof entry.path === 'string') map.set(entry.path, entry);
  }
  return map;
}

/**
 * @param {object} input
 * @param {string} input.rule            清单里的规则 id
 * @param {Map<string,number>} input.measurements 度量结果（键由调用方定义：目录名或文件路径）
 * @param {Record<string,number>} input.budgets   resolveStandardConfig 解析出的预算
 * @param {Record<string,Array<{path,reason}>>} input.exemptions
 * @param {Record<string,Array<{path,count}>>} input.baselines
 * @returns 逐条处置 + 汇总；不抛异常——判定是数据，不是控制流
 */
export function applyBudgetRule({ rule, measurements, budgets = {}, exemptions = {}, baselines = {} } = {}) {
  if (!isKnownRule(rule)) {
    throw new TypeError(`applyBudgetRule needs a known rule id; known rules are ${RULE_IDS.join(', ')}`);
  }
  const budget = Number.isInteger(budgets[rule]) ? budgets[rule] : QUANTITATIVE_STANDARD_RULES[rule].budget;
  const exemptionIndex = indexByPath(exemptions[rule]);
  const baselineIndex = indexByPath(baselines[rule]);

  const exempt = [];
  const baseline = [];
  const violations = [];
  const pass = [];
  const recovered = [];

  for (const [path, count] of measurements) {
    if (count <= budget) {
      pass.push({ path, count, disposition: 'pass' });
      // 中文注释：基线条目一旦不再超标就要提示删除，否则基线会变成第二条永久预算。
      if (baselineIndex.has(path)) recovered.push({ path, count, disposition: 'baseline' });
      continue;
    }
    if (exemptionIndex.has(path)) {
      const entry = exemptionIndex.get(path);
      exempt.push({ path, count, disposition: 'exempt', reason: entry.reason ?? null });
      continue;
    }
    if (baselineIndex.has(path)) {
      const allowed = baselineIndex.get(path).count;
      if (Number.isInteger(allowed) && count > allowed) {
        violations.push({
          path, count, disposition: 'violation', kind: 'growth',
          detail: `${path}: ${count} > baseline ${allowed} (shrink only)`,
        });
        continue;
      }
      baseline.push({ path, count, disposition: 'baseline', allowed: Number.isInteger(allowed) ? allowed : budget });
      continue;
    }
    violations.push({
      path, count, disposition: 'violation', kind: 'new',
      detail: `${path}: ${count} > budget ${budget}`,
    });
  }

  const byDisposition = new Map([
    ['exempt', exempt],
    ['baseline', baseline],
    ['violation', violations],
    ['pass', pass],
  ]);

  return Object.freeze({
    rule,
    budget,
    measured: pass.length + exempt.length + baseline.length + violations.length,
    overBudget: exempt.length + baseline.length + violations.length,
    blocking: violations.length,
    byDisposition,
    exempt: Object.freeze(exempt),
    baseline: Object.freeze(baseline),
    violations: Object.freeze(violations),
    recovered: Object.freeze(recovered),
    pass: Object.freeze(pass),
  });
}
