/**
 * 工程标准里**可以用客观事实判定**的那几条，唯一权威在这里。
 *
 * 为什么放在子模块公开面：标准文本（`skill-sources/rex-engineering-standards` §4）已经写了
 * "单文件软上限约 400 行"，而目录条目上限 8 只活在宿主仓库的 AGENTS 与脚本常量里——同一个数字
 * 有两个 owner 就会漂移。任何检查器（宿主仓库的 `aios` 适配层、子模块自己的 CLI、第三方使用者）
 * 都从这里读数，项目侧只声明覆盖项与豁免理由。
 *
 * 本模块是**纯数据**：不在此处解析覆盖。预算解析只有一个入口——`standard-config.mjs` 的
 * `resolveStandardConfig()`；两处都能算预算，等于把刚请走的第二个 owner 从后门迎回来。
 * 语义类标准（§1 依赖方向、§2 深层模块）不在这个清单里：它们需要项目声明分层，属另一套输入契约。
 */
export const QUANTITATIVE_STANDARD_RULES = Object.freeze({
  directoryEntries: Object.freeze({
    measure: 'git tracked files grouped by their containing directory',
    // 中文注释：coverage 说清这条规则会给出多少实体：
    // all-entities = 每个候选都会得到一个数（因此'一个都没数到'就是度量坏了）；
    // matching-entities = 只列出命中的那一部分（没人重复就该是空表，不是故障）。
    coverage: 'all-entities',
    budget: 8,
    source: 'rex-engineering-standards §4 / host AGENTS.md directory budget',
    // 存量超标走 ratchet 基线（只许收缩），新增即红灯；豁免必须带 reason。
    dispositions: Object.freeze(['exempt', 'baseline', 'violation']),
  }),
  fileLines: Object.freeze({
    measure: 'physical lines in one source file, excluding nothing (blank lines count as content)',
    coverage: 'all-entities',
    budget: 400,
    source: 'rex-engineering-standards §4 行数预算（软上限，超限须在交付说明里写明为何仍是单一职责）',
    exemptions: Object.freeze(['generated', 'data-driven tables', 'pure data files']),
    dispositions: Object.freeze(['exempt', 'baseline', 'violation']),
  }),
  duplicateLines: Object.freeze({
    // 中文注释：零容忍是有意为之：预算给 1 或者 10 都是把“近似值”当成精度保证，而它做不到。
    // 存量走 baseline（只许收缩），误报走 exempt 并写清理由——静默跳过等于没有结论。
    measure: 'lines belonging to a run of >= 6 consecutive normalized lines that also appear in another file (approximation: text lines, no AST)',
    coverage: 'matching-entities',
    budget: 0,
    source: 'rex-engineering-standards §2 提取共享结构 / ADR 0002 假设清单（第一期不追求工具级精度）',
    limitations: Object.freeze(['identifier renames hide duplication', 'sub-window similarity is not reported', 'self-repetition inside one file is not reported']),
    dispositions: Object.freeze(['exempt', 'baseline', 'violation']),
  }),
  reverseDependencies: Object.freeze({
    // 中文注释：方向本身是项目声明的事实（layers 段），这条规则只是把声明变成红灯；
    // 没声明分层的项目得到 SKIP，不是得到一批猜测式的违规。
    measure: 'import edges pointing from an inner layer to an outer layer, per the declared layer order (approximation: edges come from the host reference collector)',
    budget: 0,
    coverage: 'matching-entities',
    requires: Object.freeze(['layers declaration', 'module graph edges']),
    source: 'rex-engineering-standards §1 依赖方向 / ADR 0002',
    dispositions: Object.freeze(['exempt', 'baseline', 'violation']),
  }),
});
