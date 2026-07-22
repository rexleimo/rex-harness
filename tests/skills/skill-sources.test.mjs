import assert from 'node:assert/strict';
import { access, readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

import { rexNativeProviderBindings } from '../../src/providers/catalog.mjs';

test('canonical skills are discoverable and keep activation logic out of prompts', async () => {
  const root = path.join(process.cwd(), 'skill-sources');
  const entries = await readdir(root, { withFileTypes: true });
  const skillDirectories = entries.filter((entry) => entry.isDirectory());
  const expectedSkills = rexNativeProviderBindings
    .filter((binding) => binding.provider.kind === 'skill')
    .map((binding) => binding.provider.id)
    .sort();

  assert.deepEqual(
    skillDirectories.map((entry) => entry.name).sort(),
    [...expectedSkills, 'rex-workflow'].sort(),
  );
  for (const entry of skillDirectories.filter((candidate) => expectedSkills.includes(candidate.name))) {
    const file = path.join(root, entry.name, 'SKILL.md');
    const content = (await readFile(file, 'utf8')).replace(/\r\n/g, '\n');
    assert.match(content, /^---\nname: [a-z0-9-]+\ndescription: .+\n---\n/u);
    assert.match(content, /^description: Use only after rex-harness selects .+ and supplies the current Command\.$/mu);
    assert.match(content, /已经.*激活|激活.*Capability/u);
    assert.match(content, /AIOS_REX_EVIDENCE/u);
    assert.match(content, /恰好一个.*信封/u);
    assert.match(content, /真实.*引用/u);
    assert.match(content, /不要.*下一个 Provider/u);
    assert.doesNotMatch(content, /keyword route|balanced route|deep route|Fast\s*\|\s*Balanced\s*\|\s*Deep/iu);

    const evalFile = path.join(root, entry.name, 'evals', 'evals.json');
    const evalSuite = JSON.parse(await readFile(evalFile, 'utf8'));
    if (entry.name === 'rex-tdd') {
      assert.equal(evalSuite.evals.length, 35);
      assert.equal(evalSuite.evals.filter((item) => item.split === 'train').length, 30);
      assert.equal(evalSuite.evals.filter((item) => item.split === 'validation').length, 5);
      // 保留完整的 35 条 rex-tdd 训练与验证案例，避免训练后丢失边界覆盖。
    } else {
      assert.equal(evalSuite.skill_name, entry.name);
      assert.ok(evalSuite.evals.length >= 2 && evalSuite.evals.length <= 3);
    }
    assert.equal(new Set(evalSuite.evals.map((item) => item.id)).size, evalSuite.evals.length);
    for (const item of evalSuite.evals) {
      assert.ok(item.prompt.length > 20);
      assert.ok(item.expected_output.length > 20);
      if (entry.name === 'rex-tdd') {
        assert.ok(item.assertions.length >= 3);
        assert.ok(item.pressures.length >= 2);
      }
      assert.deepEqual(item.files, []);
    }
  }
});

test('rex-workflow is a CLI-first orchestration skill with bounded context', async () => {
  const root = path.join(process.cwd(), 'skill-sources', 'rex-workflow');
  const content = (await readFile(path.join(root, 'SKILL.md'), 'utf8')).replace(/\r\n/g, '\n');

  assert.match(content, /^---\nname: rex-workflow\ndescription: .+\n---\n/u);
  assert.match(content, /rex-harness CLI/u);
  assert.match(content, /\bstart\b/u);
  assert.match(content, /\bresume\b/u);
  assert.match(content, /\bevidence\b/u);
  assert.match(content, /instructionsRef/u);
  assert.match(content, /一次只执行.*当前/u);
  assert.match(content, /不要.*一次.*全部.*Provider/u);
  assert.match(content, /完整.*历史.*\.rex-harness/u);
  assert.match(content, /fail-closed|拒绝继续/u);
  assert.match(content, /status.*command.*missingEvidence/su);
  assert.match(content, /completed.*null.*空数组/su);
  assert.match(content, /其他组合.*状态损坏/su);
  assert.doesNotMatch(content, /MCP tool|rex_start|rex_status|rex_evidence|rex_resume/iu);

  const evalSuite = JSON.parse(await readFile(path.join(root, 'evals', 'evals.json'), 'utf8'));
  assert.equal(evalSuite.skill_name, 'rex-workflow');
  assert.equal(evalSuite.schema_version, 2);
  assert.equal(evalSuite.evals.length, 15);
  assert.equal(evalSuite.evals.filter((item) => item.split === 'train').length, 10);
  assert.equal(evalSuite.evals.filter((item) => item.split === 'validation').length, 5);
  assert.equal(new Set(evalSuite.evals.map((item) => item.id)).size, evalSuite.evals.length);
  for (const item of evalSuite.evals) {
    assert.ok(item.prompt.length > 20);
    assert.ok(item.expected_output.length > 20);
    assert.ok(item.assertions.length >= 3);
    assert.ok(item.pressures.length >= 3);
    assert.deepEqual(item.files, []);
  }
});

test('every bundled Provider points to a packaged instruction source', async () => {
  for (const binding of rexNativeProviderBindings) {
    const target = path.join(process.cwd(), binding.provider.instructionsRef);
    await access(target);
  }

  const specialist = rexNativeProviderBindings.find((binding) => binding.provider.kind === 'agent');
  const reviewers = JSON.parse(await readFile(
    path.join(process.cwd(), specialist.provider.instructionsRef),
    'utf8',
  ));
  assert.equal(reviewers.kind, 'rex.specialist-reviewers.v1');
  assert.ok(reviewers.reviewers.length >= 4);
  assert.ok(reviewers.reviewers.every((reviewer) => reviewer.id && reviewer.riskDomains.length > 0));
});

test('TDD skills enforce the confirmed test scope instead of rewarding test weakening', async () => {
  for (const skillName of ['rex-tdd', 'rex-strict-tdd']) {
    const content = await readFile(
      path.join(process.cwd(), 'skill-sources', skillName, 'SKILL.md'),
      'utf8',
    );
    assert.match(content, /测试范围契约/u);
    assert.match(content, /RED.*失败原因|失败原因.*RED/su);
    assert.match(content, /不得.*(?:删除|跳过|弱化).*测试/u);
    assert.match(content, /test-diff-review-recorded/u);
  }

  const strict = await readFile(
    path.join(process.cwd(), 'skill-sources', 'rex-strict-tdd', 'SKILL.md'),
    'utf8',
  );
  assert.match(strict, /test-strength-check-recorded/u);

  const baseline = await readFile(
    path.join(process.cwd(), 'skill-sources', 'rex-tdd', 'SKILL.md'),
    'utf8',
  );
  assert.match(baseline, /不得.*(?:缩小|扩大).*测试范围|测试范围.*不得.*(?:缩小|扩大)/u);
  assert.match(baseline, /用户可观察行为/u);
  assert.match(baseline, /(?:命令|command).*(?:输出|失败)|(?:输出|失败).*(?:命令|command)/iu);
  assert.match(baseline, /当前 Command.*阶段|阶段.*当前 Command/u);
  assert.match(baseline, /不得.*(?:升级|切换).*严格 TDD|严格 TDD.*不得.*(?:升级|切换)/u);
  assert.match(baseline, /rex-harness receipt/u);
  assert.match(baseline, /非零.*receipt/u);

  const hardening = await readFile(
    path.join(process.cwd(), 'skill-sources', 'rex-refactor-hardening', 'SKILL.md'),
    'utf8',
  );
  assert.match(hardening, /rex-harness receipt/u);
  assert.match(hardening, /零退出.*receipt/u);
  assert.match(hardening, /恰好一个.*信封/u);
  assert.match(hardening, /不要.*下一个 Provider/u);
});
