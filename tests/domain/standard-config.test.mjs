import assert from 'node:assert/strict';
import test from 'node:test';

import {
  resolveStandardConfig,
  STANDARD_CONFIG_ERROR_CODES,
} from '../../src/domain/standard-config.mjs';
import { QUANTITATIVE_STANDARD_RULES } from '../../src/domain/quantitative-rules.mjs';

test('defaults come from the rule manifest when the project declares nothing', () => {
  const result = resolveStandardConfig({});
  assert.equal(result.ok, true);
  for (const [ruleId, rule] of Object.entries(QUANTITATIVE_STANDARD_RULES)) {
    assert.equal(result.budgets[ruleId], rule.budget, `${ruleId} default budget`);
  }
});

test('a declared budget override wins and unknown keys are rejected, not ignored', () => {
  const ok = resolveStandardConfig({ budgets: { fileLines: 500 } });
  assert.equal(ok.ok, true);
  assert.equal(ok.budgets.fileLines, 500);
  assert.equal(ok.budgets.directoryEntries, QUANTITATIVE_STANDARD_RULES.directoryEntries.budget);

  const bad = resolveStandardConfig({ budgets: { fileLines: 500 }, budgetz: {} });
  assert.equal(bad.ok, false);
  assert.equal(bad.errors[0].code, 'unknown-key');
  assert.match(bad.errors[0].message, /allowed sections are budgets, exemptions/u);
});

test('illegal budgets fail as structured errors with the offending path', () => {
  // 中文注释：0 从这一版起是**合法**声明（零容忍）：duplicateLines 的预算就是 0，
  // 把 0 当非法等于禁止任何人声明“一行重复都不许”。这条规则的边界是非负，不是正数。
  for (const value of [-3, 8.5, '8', null, undefined]) {
    const result = resolveStandardConfig({ budgets: { directoryEntries: value } });
    assert.equal(result.ok, false, `${String(value)} must be rejected`);
    assert.ok(result.errors.some((e) => e.code === 'invalid-budget'
      && e.path === 'budgets.directoryEntries'), JSON.stringify(result.errors));
  }
});

test('an exemption without a reason is a silent second owner and is refused', () => {
  const missing = resolveStandardConfig({ exemptions: { fileLines: [{ path: 'src/tables.ts' }] } });
  assert.equal(missing.ok, false);
  assert.ok(missing.errors.some((e) => e.code === 'missing-reason'
    && e.path === 'exemptions.fileLines[0]'), JSON.stringify(missing.errors));

  const blank = resolveStandardConfig({ exemptions: { fileLines: [{ path: 'a.ts', reason: '   ' }] } });
  assert.equal(blank.ok, false, 'whitespace-only reason is not a reason');

  const declared = resolveStandardConfig({
    exemptions: { fileLines: [{ path: 'src/tables.ts', reason: 'generated data table' }] },
  });
  assert.equal(declared.ok, true);
  assert.deepEqual(declared.exemptions.fileLines, [{ path: 'src/tables.ts', reason: 'generated data table' }]);
});

test('unknown rule ids and non-object inputs are refused', () => {
  const unknown = resolveStandardConfig({ budgets: { maxCyclomaticComplexity: 5 } });
  assert.equal(unknown.ok, false);
  assert.ok(unknown.errors.some((e) => e.code === 'unknown-key'
    && e.path === 'budgets.maxCyclomaticComplexity'), JSON.stringify(unknown.errors));

  assert.throws(() => resolveStandardConfig([{ budgets: {} }]), /expects a project config object/u);
  assert.deepEqual([...STANDARD_CONFIG_ERROR_CODES],
    ['unknown-key', 'invalid-budget', 'missing-reason', 'invalid-baseline', 'invalid-layer'],
    '五个码是闭集；加第六个之前先问处置动作是不是真的不同');
});

test('baselines freeze stock counts and refuse malformed entries', () => {
  const declared = resolveStandardConfig({
    baselines: { directoryEntries: [{ path: 'scripts/tests', count: 12 }] },
  });
  assert.equal(declared.ok, true, JSON.stringify(declared.errors));
  assert.deepEqual(declared.baselines.directoryEntries, [{ path: 'scripts/tests', count: 12 }]);

  // count 写错的正是要单独成码的理由：处置是"删条目或收缩"，不是"改预算数字"
  const badCount = resolveStandardConfig({ baselines: { directoryEntries: [{ path: 'x', count: '12' }] } });
  assert.equal(badCount.ok, false);
  assert.ok(badCount.errors.some((e) => e.code === 'invalid-baseline' && e.path === 'baselines.directoryEntries[0]'),
    JSON.stringify(badCount.errors));

  const zeroCount = resolveStandardConfig({ baselines: { directoryEntries: [{ path: 'x', count: 0 }] } });
  assert.equal(zeroCount.ok, false, 'count 0 等于把条目变成第二条预算，必须拒');

  const unknownRule = resolveStandardConfig({ baselines: { maxDepth: [{ path: 'x', count: 3 }] } });
  assert.equal(unknownRule.ok, false);
  assert.ok(unknownRule.errors.some((e) => e.code === 'unknown-key' && e.path === 'baselines.maxDepth'),
    JSON.stringify(unknownRule.errors));

  const absent = resolveStandardConfig({});
  assert.deepEqual(absent.baselines, {}, '不声明就等于没有存量，不是隐式豁免');
});

test('a malformed exemption entry is refused with missing-reason, not silently accepted', () => {
  // 列表形状错：exemptions.fileLines 不是数组
  const notAList = resolveStandardConfig({ exemptions: { fileLines: 'src/tables.ts' } });
  assert.equal(notAList.ok, false);
  assert.ok(notAList.errors.some((e) => e.code === 'missing-reason'
    && e.path === 'exemptions.fileLines'), JSON.stringify(notAList.errors));

  // 条目缺 path：缺 path 与缺 reason 同属"这条豁免不成立"，共用 missing-reason（闭集不加第四个码）
  const noPath = resolveStandardConfig({ exemptions: { fileLines: [{ reason: 'generated' }] } });
  assert.equal(noPath.ok, false);
  assert.ok(noPath.errors.some((e) => e.code === 'missing-reason'
    && e.path === 'exemptions.fileLines[0]'), JSON.stringify(noPath.errors));

  // 条目不是对象也不能放过：否则 undefined.path 会被当成合法豁免
  const notAnEntry = resolveStandardConfig({ exemptions: { directoryEntries: ['scripts'] } });
  assert.equal(notAnEntry.ok, false, 'a bare string is not an exemption entry');
  assert.ok(notAnEntry.errors.some((e) => e.code === 'missing-reason'
    && e.path === 'exemptions.directoryEntries[0]'),
    JSON.stringify(notAnEntry.errors));
});
