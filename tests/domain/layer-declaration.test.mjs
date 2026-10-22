import assert from 'node:assert/strict';
import test from 'node:test';

import { applyBudgetRule } from '../../src/domain/budget-rule.mjs';
import {
  measureReverseDependencyEdges,
  parseLayerDeclaration,
  resolveLayer,
} from '../../src/domain/layer-declaration.mjs';
import { resolveStandardConfig } from '../../src/domain/standard-config.mjs';

// 中文注释：这条规则判的是「依赖方向」，而方向是项目自己声明的事实，不是我从目录名猜出来的。
// 所以契约的两端都要钉住：没声明 → 一律 SKIP（绝不出猜测式违规）；声明写坏 → 结构化错误，不崩。
const DECLARATION = {
  order: ['ui', 'service', 'domain', 'foundation'],
  prefixes: {
    'scripts/lib/ui': 'ui',
    'scripts/lib/execution': 'service',
    'scripts/lib/foundation/architecture': 'domain',
    'scripts/lib/foundation': 'foundation',
  },
};

test('the longest matching prefix owns the path, and an unmatched path is simply unlayered', () => {
  const layers = parseLayerDeclaration(DECLARATION);
  assert.equal(resolveLayer(layers, 'scripts/lib/foundation/architecture/governance.mjs'), 'domain');
  assert.equal(resolveLayer(layers, 'scripts/lib/foundation/platform/x.mjs'), 'foundation');
  assert.equal(resolveLayer(layers, 'docs/readme.md'), null, '没落在任何前缀里的文件不该被硬塞进某一层');
});

test('depending inward is legal; depending outward is the red light', () => {
  const layers = parseLayerDeclaration(DECLARATION);
  const edges = new Map([
    ['scripts/lib/foundation/platform/fs.mjs', ['scripts/lib/ui/app.mjs']],
    ['scripts/lib/ui/app.mjs', ['scripts/lib/foundation/platform/fs.mjs']],
    ['scripts/lib/execution/a.mjs', ['scripts/lib/foundation/architecture/governance.mjs', 'scripts/lib/ui/app.mjs']],
    ['scripts/lib/ui/side.mjs', ['scripts/lib/ui/app.mjs']],
  ]);

  const measured = measureReverseDependencyEdges(edges, layers);
  assert.equal(measured.get('scripts/lib/foundation/platform/fs.mjs'), 1, '内层反向依赖外层，一处算一条');
  assert.ok(!measured.has('scripts/lib/ui/app.mjs'), '外层依赖内层是正常方向');
  assert.equal(measured.get('scripts/lib/execution/a.mjs'), 1, '同层与向内都不算，只有向外那一条算');
  assert.ok(!measured.has('scripts/lib/ui/side.mjs'), '同层依赖不是违规');
});

test('the disposition model is the same one the budgets use', () => {
  const layers = parseLayerDeclaration(DECLARATION);
  const measurements = measureReverseDependencyEdges(
    new Map([['scripts/lib/foundation/a.mjs', ['scripts/lib/ui/b.mjs']]]),
    layers,
  );

  assert.equal(applyBudgetRule({ rule: 'reverseDependencies', measurements }).blocking, 1,
    '预算取清单默认 0：反向依赖一条都不许');

  const exempted = applyBudgetRule({
    rule: 'reverseDependencies',
    measurements,
    exemptions: { reverseDependencies: [{ path: 'scripts/lib/foundation/a.mjs', reason: 'plugin host contract' }] },
  });
  assert.equal(exempted.blocking, 0);
  assert.equal(exempted.exempt[0].reason, 'plugin host contract');

  const grew = applyBudgetRule({
    rule: 'reverseDependencies',
    measurements: new Map([['scripts/lib/foundation/a.mjs', 2]]),
    baselines: { reverseDependencies: [{ path: 'scripts/lib/foundation/a.mjs', count: 1 }] },
  });
  assert.equal(grew.blocking, 1, '存量只许收缩：多一条反向依赖就变红灯');
});

test('a broken declaration is a structured error, never a crash and never a guess', () => {
  const cases = [
    [{ order: ['ui'], prefixes: { a: 'ghost' } }, 'ghost'],
    [{ order: ['ui', 'ui'], prefixes: {} }, 'duplicate'],
    [{ order: 'ui', prefixes: {} }, 'array'],
    [{ order: ['ui'], prefixes: { 'x': 1 } }, 'must name a layer'],
  ];
  for (const [declaration, expect] of cases) {
    assert.throws(
      () => parseLayerDeclaration(declaration),
      (error) => error.message.toLowerCase().includes(expect.toLowerCase())
        && error.code === 'invalid-layer',
      `${JSON.stringify(declaration)} 必须报 invalid-layer 并指向真正的问题：${expect}`,
    );
  }
});

test('the config layer accepts a layers section and refuses to run without one', () => {
  const ok = resolveStandardConfig({ layers: DECLARATION });
  assert.equal(ok.ok, true);
  assert.deepEqual(ok.layers.order, DECLARATION.order);

  const missing = resolveStandardConfig({});
  assert.equal(missing.ok, true, '不声明分层是合法选择：这条规则就该 SKIP');
  assert.equal(missing.layers, null);

  const bad = resolveStandardConfig({ layers: { order: ['ui'], prefixes: { a: 'ghost' } } });
  assert.equal(bad.ok, false);
  assert.ok(bad.errors.every((e) => e.code === 'invalid-layer'),
    `分层写错的处置动作只有一种（改声明），所以它是一个码而不是三个：${JSON.stringify(bad.errors)}`);
});
