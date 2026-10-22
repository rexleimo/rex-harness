import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { measureDuplicateLines } from '../../src/domain/duplication.mjs';
import { applyBudgetRule } from '../../src/domain/budget-rule.mjs';
import { runStandards } from '../../src/standards/check.mjs';

// 中文注释：这条规则的度量是**近似值**，测试就是把它愿意承认的边界钉住：连续窗口相同才算重复、
// 改个变量名就看不见、窗口之下的片段不算。第一期不追求工具级精度（ADR 0002 的假设清单），
// 但近似值必须说自己是近似值——所以断言里连"漏报的那一侧"都写死了。
const SHARED = ['function buildThing(input) {', '  const parts = [];', '  for (const item of input) {',
  '    parts.push(normalize(item));', '  }', '  return parts.join("|");', '}'];

test('a block copied into two files is reported in both of them', () => {
  const map = measureDuplicateLines([
    { path: 'a.mjs', content: `${SHARED.join('\n')}\nexport { buildThing };\n` },
    { path: 'b.mjs', content: `${SHARED.map((l) => l.replace('buildThing', 'buildOther')).join('\n')}\n` },
    { path: 'c.mjs', content: 'export const alone = 1;\n' },
  ]);

  // 中文注释：第一行就是 `function buildThing` vs `function buildOther`，所以逐行相同的只有后 6 行；
  // 要求它背满 7 行是我的断言错，不是度量错。
  assert.ok(map.get('a.mjs') >= 6, `a.mjs 应至少背 6 行重复（窗口长度），实得 ${map.get('a.mjs')}`);
  assert.ok(map.get('b.mjs') >= 6, '函数名不同不影响其余行的判定：近似值是逐行文本比较');
  assert.ok(!map.has('c.mjs') || map.get('c.mjs') === 0, '没有副本的文件不该有重复行');
});

test('five shared lines below the six-line window are not called duplication', () => {
  const five = SHARED.slice(0, 5);
  const map = measureDuplicateLines([
    { path: 'a.mjs', content: `${five.join('\n')}\nexport const x = 1;\n` },
    { path: 'b.mjs', content: `${five.join('\n')}\nexport const y = 2;\n` },
  ]);
  assert.equal(map.get('a.mjs') ?? 0, 0, '窗口之下的片段算误报，第一期宁可漏报也不冤枉人');
});

test('renaming identifiers hides it, and that limitation is the declared contract', () => {
  const map = measureDuplicateLines([
    { path: 'a.mjs', content: `${SHARED.join('\n')}\n` },
    { path: 'b.mjs', content: `${SHARED.map((l) => l.replace(/normalize|parts|item/g, 'zzz')).join('\n')}\n` },
  ]);
  assert.equal(map.get('a.mjs') ?? 0, 0,
    '没有 AST，改名就看不见——这是近似实现公开的局限，不是缺陷；工具级精度另立期次');
});

test('extracting the shared block into one module turns the rule green', () => {
  const before = measureDuplicateLines([
    { path: 'a.mjs', content: `${SHARED.join('\n')}\n` },
    { path: 'b.mjs', content: `${SHARED.join('\n')}\n` },
  ]);
  const after = measureDuplicateLines([
    { path: 'shared.mjs', content: `${SHARED.join('\n')}\n` },
    { path: 'a.mjs', content: 'import { buildThing } from \x27./shared.mjs\x27;\n' },
    { path: 'b.mjs', content: 'import { buildThing } from \x27./shared.mjs\x27;\n' },
  ]);

  assert.ok((before.get('a.mjs') ?? 0) > 0, '复制成块即红');
  assert.equal(after.get('shared.mjs') ?? 0, 0, '只剩一处定义就不该算重复');
  assert.equal(applyBudgetRule({
    rule: 'duplicateLines', measurements: after, budgets: { duplicateLines: 0 },
  }).blocking, 0, '提取共享结构后转绿');
});

test('a zero budget is a legitimate declaration meaning zero tolerance', () => {
  const measurements = new Map([['a.mjs', 7]]);
  assert.equal(applyBudgetRule({ rule: 'duplicateLines', measurements, budgets: { duplicateLines: 0 } }).blocking, 1);
  assert.equal(applyBudgetRule({
    rule: 'duplicateLines', measurements, budgets: { duplicateLines: { default: 0, entries: [{ path: 'a.mjs', budget: 20 }] } },
  }).blocking, 0, '按实体的放宽照样生效');
});

test('the shipped command measures duplicateLines over a real git fixture', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'rex-dup-'));
  const project = path.join(root, 'project');
  await mkdir(project, { recursive: true });
  await writeFile(path.join(project, 'a.mjs'), `${SHARED.join('\n')}\n`, 'utf8');
  await writeFile(path.join(project, 'b.mjs'), `${SHARED.join('\n')}\n`, 'utf8');
  const git = (args) => execFileSync('git', ['-C', project, ...args], { stdio: ['ignore', 'pipe', 'pipe'] });
  try {
    git(['init', '--quiet']);
    git(['config', 'user.email', 'dup@example.invalid']);
    git(['config', 'user.name', 'Dup Fixture']);
    git(['add', '-A']);
    git(['commit', '--quiet', '-m', 'duplicated block']);

    const result = await runStandards({ rootDir: project, rule: 'duplicateLines', io: { log: () => {}, error: () => {} } });
    const report = result.results[0].report;
    assert.equal(report.budget, 0);
    assert.equal(report.blocking, 2, '两个文件各算一条');
    assert.equal(result.exitCode, 1);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
