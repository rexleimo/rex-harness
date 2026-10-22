/**
 * 项目侧工程标准配置的唯一解析入口。
 *
 * 为什么需要它：清单给出默认预算之后，项目只允许声明「覆盖项 + 豁免理由」。如果解析靠
 * `undefined` 兜底，未知键就会静默生效成默认值，配置写了却没起作用也没人知道——那正是
 * 「一条规则两个 owner」的另一种形态。所以这里返回结构化错误，而不是抛异常或忽略。
 *
 * 契约（闭集）：
 * - 顶层只接受 `budgets` / `exemptions`；
 * - 两者的键必须是清单里已有的规则 id；
 * - 预算值必须是正整数；
 * - 豁免项必须带非空 `reason`。
 * 调用签名错误（传非对象）按程序 bug 处理直接抛错；配置内容错误一律走 `{ ok:false, errors }`。
 *
 * 错误码是闭集三个：`unknown-key` / `invalid-budget` / `missing-reason`。其中 `missing-reason`
 * 覆盖“这条豁免整体不成立”——缺 reason、空白 reason、条目缺 path、条目不是对象、列表不是数组
 * 共用它，因为对调用方来说处置动作相同（补全或删掉这条豁免），而不是五种不同的病。
 */
import { QUANTITATIVE_STANDARD_RULES } from './quantitative-rules.mjs';

const ALLOWED_SECTIONS = Object.freeze(['budgets', 'exemptions']);
const RULE_IDS = Object.freeze(Object.keys(QUANTITATIVE_STANDARD_RULES));

export const STANDARD_CONFIG_ERROR_CODES = Object.freeze([
  'unknown-key',
  'invalid-budget',
  'missing-reason',
]);

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function defaultBudgets() {
  return Object.fromEntries(
    RULE_IDS.map((id) => [id, QUANTITATIVE_STANDARD_RULES[id].budget]),
  );
}

function parseBudgets(section, errors) {
  const budgets = defaultBudgets();
  if (section === undefined) return budgets;
  if (!isPlainObject(section)) {
    errors.push({ code: 'invalid-budget', path: 'budgets', message: 'budgets must be an object of rule id to positive integer' });
    return budgets;
  }
  for (const [ruleId, value] of Object.entries(section)) {
    if (!RULE_IDS.includes(ruleId)) {
      errors.push({ code: 'unknown-key', path: `budgets.${ruleId}`, message: `unknown rule id; known rules are ${RULE_IDS.join(', ')}` });
      continue;
    }
    if (!Number.isInteger(value) || value <= 0) {
      errors.push({ code: 'invalid-budget', path: `budgets.${ruleId}`, message: 'budget must be a positive integer' });
      continue;
    }
    budgets[ruleId] = value;
  }
  return budgets;
}

function parseExemptions(section, errors) {
  const exemptions = {};
  if (section === undefined) return exemptions;
  if (!isPlainObject(section)) {
    errors.push({ code: 'unknown-key', path: 'exemptions', message: 'exemptions must be an object of rule id to a list of entries' });
    return exemptions;
  }
  for (const [ruleId, entries] of Object.entries(section)) {
    if (!RULE_IDS.includes(ruleId)) {
      errors.push({ code: 'unknown-key', path: `exemptions.${ruleId}`, message: `unknown rule id; known rules are ${RULE_IDS.join(', ')}` });
      continue;
    }
    if (!Array.isArray(entries)) {
      errors.push({ code: 'missing-reason', path: `exemptions.${ruleId}`, message: 'exemption list must be an array of { path, reason }' });
      continue;
    }
    exemptions[ruleId] = entries.map((entry, index) => {
      const path = `exemptions.${ruleId}[${index}]`;
      if (!isPlainObject(entry) || typeof entry.path !== 'string' || !entry.path) {
        errors.push({ code: 'missing-reason', path, message: 'exemption entry needs a non-empty path' });
        return { path: null, reason: null };
      }
      if (typeof entry.reason !== 'string' || !entry.reason.trim()) {
        errors.push({ code: 'missing-reason', path, message: `exemption for ${entry.path} needs a reason; silent exemptions are a second owner for the rule` });
        return { path: entry.path, reason: null };
      }
      return { path: entry.path, reason: entry.reason };
    });
  }
  return exemptions;
}

/**
 * @param {object} projectConfig 项目侧声明（budgets / exemptions），未知键不忽略而是报错
 * @returns {{ ok: boolean, budgets?: object, exemptions?: object, errors?: Array<{code,path,message}> }}
 */
export function resolveStandardConfig(projectConfig = {}) {
  if (!isPlainObject(projectConfig)) {
    throw new TypeError('resolveStandardConfig expects a project config object');
  }
  const errors = [];
  for (const key of Object.keys(projectConfig)) {
    if (!ALLOWED_SECTIONS.includes(key)) {
      errors.push({ code: 'unknown-key', path: key, message: `unknown top-level key; allowed sections are ${ALLOWED_SECTIONS.join(', ')}` });
    }
  }
  const budgets = parseBudgets(projectConfig.budgets, errors);
  const exemptions = parseExemptions(projectConfig.exemptions, errors);
  if (errors.length > 0) return Object.freeze({ ok: false, errors: Object.freeze(errors) });
  return Object.freeze({ ok: true, budgets: Object.freeze(budgets), exemptions: Object.freeze(exemptions) });
}
