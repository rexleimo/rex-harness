/* 中文注释：work-cli-surface 第一轮——把这条检查做成**子模块 CLI 的一条命令**。
 * 落点理由（ADR 0001）：命令是公开产品面，第三方装完 rex-harness 就该能跑；父仓库只准转发。
 * 担保形状：在临时 git fixture 仓库上跑"红 → 改 → 绿"，并且 --json 与退出码两条路径都断言。 */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { runStandardsArgs } from '../../src/cli/standards.mjs';
import { runStandards } from '../../src/standards/check.mjs';

const QUIET = { log: () => {}, error: () => {} };

function git(project, args) {
  execFileSync('git', ['-C', project, ...args], { stdio: ['ignore', 'pipe', 'pipe'] });
}

async function makeRepo({ entries, config }) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'rex-std-'));
  const project = path.join(root, 'project');
  await mkdir(project, { recursive: true });
  for (const [rel, content] of Object.entries(entries)) {
    await mkdir(path.dirname(path.join(project, rel)), { recursive: true });
    await writeFile(path.join(project, rel), content, 'utf8');
  }
  if (config) {
    await mkdir(path.join(project, 'config'), { recursive: true });
    await writeFile(path.join(project, 'config', 'standards.json'), JSON.stringify(config), 'utf8');
  }
  git(project, ['init', '--quiet']);
  git(project, ['config', 'user.email', 't@example.invalid']);
  git(project, ['config', 'user.name', 'T']);
  git(project, ['add', '-A']);
  git(project, ['commit', '--quiet', '-m', 'fixture']);
  return { root, project };
}

const NINE = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i'].map((n) => [`wide/${n}.mjs`, 'x\n']);

test('a repository over budget exits nonzero and names each entity with its measure and budget', async () => {
  const fx = await makeRepo({ entries: Object.fromEntries(NINE) });
  try {
    const lines = [];
    const result = await runStandards({ rootDir: fx.project, rule: 'directoryEntries', io: { log: (l) => lines.push(l) } });

    assert.equal(result.exitCode, 1, '超标必须能在退出码上被 CI 读到');
    assert.equal(result.results[0].report.blocking, 1,
      '单规则与多规则走同一个形状，不因 rule 数量切换返回结构');
    const violation = lines.find((line) => line.includes('FAIL'));
    assert.match(violation, /wide/u, '逐条给出处，不能只报总数');
    assert.match(violation, /9/u);
    assert.match(violation, /budget 8/u);
  } finally {
    await rm(fx.root, { recursive: true, force: true });
  }
});

test('adding the exemption turns the same repository green', async () => {
  // 中文注释：红→改→绿是同一条命令上的闭环，不是两个 fixture——换 fixture 就证不了"改的确实起作用"。
  const fx = await makeRepo({
    entries: Object.fromEntries(NINE),
    config: { exemptions: { directoryEntries: [{ path: 'wide', reason: 'flat discovery contract' }] } },
  });
  try {
    const result = await runStandards({ rootDir: fx.project, rule: 'directoryEntries', io: QUIET });

    assert.equal(result.exitCode, 0);
    assert.equal(result.results[0].report.exempt.length, 1);
    assert.equal(result.results[0].report.exempt[0].reason, 'flat discovery contract');
  } finally {
    await rm(fx.root, { recursive: true, force: true });
  }
});

test('--json emits one machine-readable record per rule, and git-less roots read as skip with exit 0', async () => {
  const fx = await makeRepo({ entries: { 'ok/a.mjs': 'x\n' } });
  const plain = path.join(fx.root, 'not-a-repo');
  await mkdir(plain, { recursive: true });
  try {
    const lines = [];
    const good = await runStandards({ rootDir: fx.project, rule: 'all', json: true, io: { log: (l) => lines.push(l) } });
    assert.equal(good.exitCode, 0);
    assert.equal(lines.length, 3, '一条规则一行 JSON：directoryEntries、fileLines、duplicateLines');
    const record = JSON.parse(lines[0]);
    assert.deepEqual(Object.keys(record).sort(),
      ['blocking', 'budget', 'exempt', 'measured', 'reason', 'root', 'rule', 'status', 'violations'].sort(),
      'JSON 字段就是契约：加字段要显式改这里，不能漂着改');
    assert.equal(record.rule, 'directoryEntries');

    const skipped = [];
    const result = await runStandards({ rootDir: plain, rule: 'directoryEntries', json: true, io: { log: (l) => skipped.push(l) } });
    assert.equal(result.exitCode, 0, '测不了不是违规');
    assert.equal(JSON.parse(skipped[0]).status, 'skip');
    assert.equal(JSON.parse(skipped[0]).measured, null);
  } finally {
    await rm(fx.root, { recursive: true, force: true });
  }
});

test('fileLines actually reads the files it is measuring', async () => {
  const fx = await makeRepo({
    entries: {
      'src/long.mjs': 'x\n'.repeat(450),
      'src/short.mjs': 'x\n',
    },
  });
  try {
    const result = await runStandards({ rootDir: fx.project, rule: 'fileLines', io: QUIET });
    const report = result.results[0].report;

    assert.equal(report.measured, 2, '候选两个文件就只能度量到两个；报 0 又报 ok 是空过');
    assert.equal(report.blocking, 1);
    assert.equal(report.violations[0].path, 'src/long.mjs');
    assert.match(report.violations[0].detail, /450 > budget 400/u, '未声明按实体预算时，用的是清单默认');
    assert.equal(report.pass[0].limit, 400, '每条处置要把自己那条限额带出来');
    assert.equal(result.exitCode, 1);
  } finally {
    await rm(fx.root, { recursive: true, force: true });
  }
});

test('a broken measure reports ERROR and exits nonzero instead of claiming the repository is clean', async () => {
  const fx = await makeRepo({ entries: { 'src/a.mjs': 'x\n' } });
  try {
    const lines = [];
    const result = await runStandards({
      rootDir: fx.project,
      rule: 'fileLines',
      json: true,
      io: { log: (l) => lines.push(l), error: () => {} },
      readImpl: () => { throw new TypeError('not a function-shaped reader'); },
    });

    assert.equal(result.exitCode, 1, '度量器自已是红的时候，结论不能是 0');
    assert.equal(JSON.parse(lines[0]).status, 'measure-error');
    assert.match(JSON.parse(lines[0]).reason, /could not be measured: not a function-shaped reader/u,
      '要把底层原因带出来：只说“测不了”等于让人再去猜');
  } finally {
    await rm(fx.root, { recursive: true, force: true });
  }
});

test('every candidate unreadable is reported as an empty measurement, not as a clean repository', async () => {
  const fx = await makeRepo({ entries: { 'src/a.mjs': 'x\n' } });
  try {
    const lines = [];
    const result = await runStandards({
      rootDir: fx.project,
      rule: 'fileLines',
      json: true,
      io: { log: (l) => lines.push(l), error: () => {} },
      readImpl: () => { const error = new Error('missing'); error.code = 'ENOENT'; throw error; },
    });

    assert.equal(result.exitCode, 1);
    assert.equal(JSON.parse(lines[0]).status, 'measure-error');
    assert.match(JSON.parse(lines[0]).reason, /measured 0 of 1 candidate entities/u,
      '全部 ENOENT 是“工作树与 index 不匹配”，不是“这个仓库很干净”');
  } finally {
    await rm(fx.root, { recursive: true, force: true });
  }
});

test('a tracked file that is missing from the work tree is counted as unreadable, not as a violation', async () => {
  const fx = await makeRepo({ entries: { 'src/gone.mjs': 'x\n', 'src/keep.mjs': 'x\n' } });
  try {
    execFileSync('git', ['-C', fx.project, 'rm', '-q', '--cached', 'src/gone.mjs'], { stdio: ['ignore', 'pipe', 'pipe'] });
    await rm(path.join(fx.project, 'src', 'gone.mjs'), { force: true });
    const result = await runStandards({
      rootDir: fx.project, rule: 'fileLines', io: QUIET,
      readImpl: (file) => {
        const error = new Error('missing');
        error.code = file.endsWith('gone.mjs') ? 'ENOENT' : undefined;
        if (error.code) throw error;
        return 'x\n';
      },
    });
    assert.equal(result.results[0].report.measured, 1);
    assert.equal(result.exitCode, 0, '只少了那一个读不到的文件，不影响另一个的结论');
  } finally {
    await rm(fx.root, { recursive: true, force: true });
  }
});

test('the CLI route parses flags and passes the exit code through', async () => {
  const fx = await makeRepo({ entries: Object.fromEntries(NINE) });
  try {
    const lines = [];
    const result = await runStandardsArgs(['check', '--root', fx.project, '--rule', 'directoryEntries', '--json'],
      { io: { log: (l) => lines.push(l), error: () => {} } });

    assert.equal(result.exitCode, 1);
    assert.equal(JSON.parse(lines[0]).status, 'fail');
  } finally {
    await rm(fx.root, { recursive: true, force: true });
  }
});
