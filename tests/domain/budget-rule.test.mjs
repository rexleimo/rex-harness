/* 中文注释：预算引擎的公开契约测试。为什么要独立测它：这条规则此前只活在宿主仓库的脚本常量里，
 * 第三方装了 rex-harness 却拿不到它，而同一个数字有两个 owner 就会漂移（ADR 0002）。
 * 引擎的边界是"纯客观事实"：输入是键→数的度量，输出是逐条处置，不接受任何宿主路径假设。 */
import assert from 'node:assert/strict';
import test from 'node:test';

import {
  applyBudgetRule,
  measureDirectoryEntries,
  measureFileLines,
} from '../../src/domain/budget-rule.mjs';

test('directory entries are measured per containing directory, with subdirectories taking a slot', () => {
  const counts = measureDirectoryEntries(['a.txt', 'b.txt', 'sub/c.txt', 'sub/deep/d.txt']);
  assert.equal(counts.get('.'), 3, 'a.txt + b.txt + sub/');
  assert.equal(counts.get('sub'), 2, 'c.txt + deep/');
  assert.equal(counts.get('sub/deep'), 1);
});

test('line counts are measured per file from content the caller already read', () => {
  const counts = measureFileLines([{ path: 'x.mjs', content: 'a\nb\nc\n' }]);
  assert.equal(counts.get('x.mjs'), 3);
});

test('over budget with no exemption and no baseline is a violation', () => {
  const report = applyBudgetRule({
    rule: 'directoryEntries',
    measurements: measureDirectoryEntries(['a', 'b', 'c']),
    // 中文注释：造一个更小的预算让 3 条真超标——拿清单默认 8 跑 3 个条目不会红灯，那样这条断言什么也没测。
    budgets: { directoryEntries: 2 },
    exemptions: {},
    baselines: {},
  });
  assert.equal(report.blocking, 1);
  assert.deepEqual(report.violations.map((v) => [v.path, v.count, v.disposition]),
    [['.', 3, 'violation']], '每个超标条目必须逐条报出，不能只给总数');
});

test('exempt, baseline and new share one disposition model', () => {
  const measurements = new Map([
    ['gen/out', 12], ['legacy/big', 9], ['fresh/dir', 9], ['clean/dir', 2],
  ]);
  const report = applyBudgetRule({
    rule: 'directoryEntries',
    measurements,
    budgets: { directoryEntries: 8 },
    exemptions: { directoryEntries: [{ path: 'gen/out', reason: 'generated mirror' }] },
    baselines: { directoryEntries: [{ path: 'legacy/big', count: 9 }] },
  });

  assert.deepEqual([...report.byDisposition.keys()], ['exempt', 'baseline', 'violation', 'pass'],
    '三处置加一条达标，用的是同一张表');
  assert.equal(report.blocking, 1, '只有新增超标是红灯');
  assert.equal(report.exempt.length, 1);
  assert.equal(report.exempt[0].reason, 'generated mirror', '豁免必须把理由带回来，静默豁免是这条规则的第二个 owner');
  assert.equal(report.baseline.length, 1);
  assert.equal(report.violations.length, 1);
  assert.equal(report.violations[0].path, 'fresh/dir');
});

test('a baseline may only shrink: growth is a violation, shrink is reported as recovered', () => {
  const base = { directoryEntries: [{ path: 'big/dir', count: 10 }] };
  const grew = applyBudgetRule({
    rule: 'directoryEntries', measurements: new Map([['big/dir', 11]]),
    budgets: { directoryEntries: 8 }, exemptions: {}, baselines: base,
  });
  assert.equal(grew.blocking, 1);
  assert.match(grew.violations[0].detail, /baseline 10/u, '报的是存量增长，不是新增超标');

  const shrank = applyBudgetRule({
    rule: 'directoryEntries', measurements: new Map([['big/dir', 6]]),
    budgets: { directoryEntries: 8 }, exemptions: {}, baselines: base,
  });
  assert.equal(shrank.blocking, 0);
  assert.deepEqual(shrank.recovered.map((item) => item.path), ['big/dir'],
    '基线清零后要提示删除条目，否则基线会变成永久的第二个预算');
});

test('the engine carries no host path assumptions', () => {
  const report = applyBudgetRule({
    rule: 'fileLines',
    measurements: new Map([['anything/deep/inside.mjs', 900]]),
    budgets: { fileLines: 400 },
    exemptions: {},
    baselines: {},
  });
  assert.equal(report.blocking, 1);
  assert.equal(report.rule, 'fileLines');
  assert.ok(!('rootDir' in report) && !('installRoot' in report),
    '引擎不接收也不回传任何根目录：测哪个根是调用方的决定');
});
