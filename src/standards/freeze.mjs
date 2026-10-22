/**
 * `standards check --freeze`：把**当前**的超标存量写成 config/standards.json 的 baselines，
 * 让这条门从这个仓库的既成事实开始，而不是从一堆昨天就存在的噪声开始。
 *
 * 为什么必须单独一个模块而不是 check.mjs 里顺手写文件：判定与写盘是两个 owner。
 * check.mjs 只负责量与判；这里只负责「怎么把存量安全地冻下来」——保留项目已有的
 * budgets / exemptions / layers，只追加 baselines，且绝不在配置本身不合法时覆盖它。
 *
 * 诚实约束：冻结不是赦免的替代品，它是把「存量」和「新增」分开处置的声明。冻完之后
 * 同一个路径再多一条就越界（baseline 只许收缩），这条语义由 budget-rule 引擎保证。
 */
import fs from 'node:fs';
import path from 'node:path';

import { resolveStandardConfig } from '../domain/standard-config.mjs';

const BASELINE_KEY = 'baselines';

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

/**
 * 合并存量到已有配置：只碰 baselines，其他段原样保留。
 * @param {{ok:boolean, errors?:Array}} resolved 已解析的项目配置（来自 resolveStandardConfig）
 * @param {Record<string, Array<{path:string,count:number}>>} debt 每条规则当前的 blocking 项
 * @returns {{config:object, frozen:Record<string,number>, preserved:string[]}}
 */
export function mergeStockBaselines(resolved, debt) {
  if (resolved && resolved.ok === false) {
    // 中文注释：配置本身写坏了就拒绝冻结——覆盖一份坏配置等于把人的错误决定抹掉，
    // 而这条命令没有资格做那个决定。
    throw Object.assign(new TypeError('cannot freeze over an invalid project config'), { code: 'config-invalid' });
  }
  const base = isPlainObject(resolved?.raw) ? structuredClone(resolved.raw) : {};
  const existingBaselines = isPlainObject(base[BASELINE_KEY]) ? base[BASELINE_KEY] : {};
  const frozen = {};
  const baselines = { ...existingBaselines };
  for (const [rule, items] of Object.entries(debt)) {
    const existingByPath = new Map((existingBaselines[rule] ?? []).map((entry) => [entry.path, entry]));
    const merged = [...existingBaselines[rule] ?? []];
    for (const item of items) {
      const prior = existingByPath.get(item.path);
      if (prior) {
        const index = merged.indexOf(prior);
        merged[index] = { ...prior, count: Math.min(prior.count, item.count) };
      } else {
        merged.push({ path: item.path, count: item.count });
      }
    }
    baselines[rule] = merged;
    frozen[rule] = items.length;
  }
  base[BASELINE_KEY] = baselines;
  const preserved = Object.keys(base).filter((key) => key !== BASELINE_KEY);
  return { config: base, frozen, preserved };
}

/**
 * 写盘入口：读现有配置 → 解析 → 合并 → 落盘。返回逐项冻结数量。
 * @param {{rootDir:string, debt:Record<string,Array<{path:string,count:number}>>, configRelativePath?:string,
 *          readConfig?:(file:string)=>string, writeConfig?:(file:string,text:string)=>void}} options
 */
export function freezeStockBaselines({
  rootDir,
  debt,
  configRelativePath = 'config/standards.json',
  readConfig = (file) => fs.readFileSync(file, 'utf8'),
  writeConfig = (file, text) => fs.writeFileSync(file, text, 'utf8'),
} = {}) {
  const file = path.join(rootDir, configRelativePath);
  let rawText = '{}';
  let found = false;
  try {
    rawText = readConfig(file);
    found = true;
  } catch {
    found = false;
  }
  let parsedJson;
  try {
    parsedJson = found ? JSON.parse(rawText) : {};
  } catch (error) {
    throw Object.assign(new TypeError(`existing project config is not valid JSON: ${error.message}`), { code: 'config-invalid' });
  }
  const resolved = resolveStandardConfig(parsedJson);
  const { config, frozen, preserved } = mergeStockBaselines({ ...resolved, raw: parsedJson }, debt);
  const target = path.dirname(file);
  if (!fs.existsSync(target) && target !== rootDir) fs.mkdirSync(target, { recursive: true });
  writeConfig(file, `${JSON.stringify(config, null, 2)}\n`);
  return { written: file, configRelativePath, found, frozen, preserved };
}
