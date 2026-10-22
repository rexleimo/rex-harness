import assert from 'node:assert/strict';
import { test } from 'node:test';

import { applyBudgetRule } from '../../src/domain/budget-rule.mjs';
import { resolveStandardConfig } from '../../src/domain/standard-config.mjs';

// 中文注释：这一组断言解决的是「同一条规则、不同实体本该有不同的预算」。
// 宿主仓库有 24 个 facade 各自写着 maxLines，而引擎只认「每条规则一个数」，
// 于是它只能在自己的适配层里把配置预算顶掉——那就是双轨读路径的由来。
// 按实体的预算是通用需求（任何仓库都想给生成目录放宽、给核心入口收紧），所以它进产品，不进宿主。

test('an entity budget decides that entity\'s fate, while the rule budget still covers everything else', () => {
  const report = applyBudgetRule({
    rule: 'fileLines',
    measurements: new Map([['tight.mjs', 250], ['loose.mjs', 250], ['other.mjs', 40]]),
    budgets: { fileLines: { default: 300, entries: [{ path: 'tight.mjs', budget: 200 }] } },
  });

  assert.equal(report.budget, 300, 'report.budget 仍是规则级默认，--json 的字段含义不变');
  assert.deepEqual(report.violations.map((v) => v.path), ['tight.mjs']);
  assert.match(report.violations[0].detail, /tight\.mjs: 250 > budget 200/u,
    '违规要说的是它自己的预算，不是规则默认值');
  assert.deepEqual(report.pass.map((p) => p.path).sort(), ['loose.mjs', 'other.mjs']);
  assert.deepEqual([report.violations[0].limit, report.pass.find((e) => e.path === 'loose.mjs').limit], [200, 300],
    '每条处置要带着自己那条限额出来：宿主报告限额时若自己去查 entries，就又长出第二个读路径');
});

test('an entity budget may loosen as well as tighten', () => {
  const report = applyBudgetRule({
    rule: 'fileLines',
    measurements: new Map([['generated.mjs', 480]]),
    budgets: { fileLines: { default: 300, entries: [{ path: 'generated.mjs', budget: 500 }] } },
  });
  assert.equal(report.blocking, 0);
  assert.equal(report.pass[0].path, 'generated.mjs');
});

test('exemption and baseline still outrank a per-entity budget breach', () => {
  const exempted = applyBudgetRule({
    rule: 'fileLines',
    measurements: new Map([['a.mjs', 250]]),
    budgets: { fileLines: { default: 300, entries: [{ path: 'a.mjs', budget: 200 }] } },
    exemptions: { fileLines: [{ path: 'a.mjs', reason: 'flat discovery contract' }] },
  });
  assert.equal(exempted.exempt[0].reason, 'flat discovery contract');
  assert.equal(exempted.blocking, 0);

  const baselined = applyBudgetRule({
    rule: 'fileLines',
    measurements: new Map([['b.mjs', 250]]),
    budgets: { fileLines: { default: 300, entries: [{ path: 'b.mjs', budget: 200 }] } },
    baselines: { fileLines: [{ path: 'b.mjs', count: 260 }] },
  });
  assert.equal(baselined.blocking, 0);
  assert.equal(baselined.baseline[0].allowed, 260, '基线仍是那条更宽的量，处置照旧记在基线名下');
});

test('a plain number keeps working, so every existing caller keeps its meaning', () => {
  const report = applyBudgetRule({
    rule: 'fileLines',
    measurements: new Map([['x.mjs', 301]]),
    budgets: { fileLines: 300 },
  });
  assert.equal(report.blocking, 1);
  assert.match(report.violations[0].detail, /301 > budget 300/u);
});

test('the config layer accepts the structured form and rejects malformed entries with the closed codes', () => {
  const ok = resolveStandardConfig({
    budgets: { fileLines: { default: 300, entries: [{ path: 'a.mjs', budget: 200 }] } },
  });
  assert.equal(ok.ok, true);
  assert.deepEqual(ok.budgets.fileLines, { default: 300, entries: [{ path: 'a.mjs', budget: 200 }] });

  const cases = [
    [{ fileLines: { default: 300, entries: [{ path: 'a.mjs' }] } }, 'budget'],
    [{ fileLines: { default: 300, entries: [{ path: 'a.mjs', budget: 0 }] } }, 'positive'],
    [{ fileLines: { default: 300, entries: [{ path: 'a.mjs', budget: 200, max: 1 }] } }, 'unknown-key'],
    [{ fileLines: { default: 300, entries: [{ budget: 200 }] } }, 'path'],
    [{ fileLines: { default: 'x', entries: [] } }, 'positive'],
  ];
  for (const [budgets, expect] of cases) {
    const bad = resolveStandardConfig({ budgets });
    assert.equal(bad.ok, false, `${JSON.stringify(budgets)} 必须报错`);
    assert.match(JSON.stringify(bad.errors), new RegExp(expect, 'u'),
      `报错要指向真正的问题：期望出现 ${expect}`);
    assert.ok(bad.errors.every((e) => ['unknown-key', 'invalid-budget', 'missing-reason', 'invalid-baseline'].includes(e.code)),
      '错误码仍是闭集，不新增第六种');
  }

  // 中文注释：只写 entries 不写 default 也是合法声明：缺的那一半回退到清单默认。
  // (上一版这里把 entries 定成必填，结果本仓库 50 条 facade 以外的写法全被判成配置错，
  // 配置错又触犯了响亮失败门 -> 整个架构门直接 FAIL。过度收紧和不够严格一样会伤到真用的人。)
  const noDefault = resolveStandardConfig({ budgets: { fileLines: { entries: [{ path: 'a.mjs', budget: 200 }] } } });
  assert.equal(noDefault.ok, true, JSON.stringify(noDefault.errors));
  const scoped = applyBudgetRule({
    rule: 'fileLines',
    measurements: new Map([['a.mjs', 250], ['b.mjs', 399]]),
    budgets: noDefault.budgets,
  });
  assert.equal(scoped.budget, 400, '规则级预算仍是清单默认那一个数');
  assert.deepEqual(scoped.violations.map((v) => v.path), ['a.mjs']);
});
