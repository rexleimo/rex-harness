import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

import { rexNativeProviderBindings } from '../../src/providers/catalog.mjs';
import { sharedReferenceSkillIds, standardsReferenceConsumers } from '../../src/clients/install.mjs';

const SKILL_SOURCES_ROOT = path.resolve(import.meta.dirname, '../../skill-sources');

async function skillBody(skillId) {
  return readFile(path.join(SKILL_SOURCES_ROOT, skillId, 'SKILL.md'), 'utf8');
}

test('the standards skill is the shared reference the consumers point at', () => {
  assert.deepEqual([...sharedReferenceSkillIds], ['rex-engineering-standards']);
  assert.ok(standardsReferenceConsumers.length >= 4, 'code-producing providers must be registered');
});

test('every registered consumer is a real bundled skill provider', () => {
  const bundled = new Set(rexNativeProviderBindings
    .filter((binding) => binding.provider?.kind === 'skill')
    .map((binding) => binding.provider.id));
  for (const consumer of standardsReferenceConsumers) {
    assert.ok(bundled.has(consumer), `${consumer} is registered as a standards consumer but is not a bundled provider`);
  }
});

test('each code-producing provider loads the standards before its own procedure starts', async () => {
  for (const consumer of standardsReferenceConsumers) {
    const body = await skillBody(consumer);
    const lines = body.split(/\r?\n/);
    const referenceAt = lines.findIndex((line) => line.includes(sharedReferenceSkillIds[0]));
    assert.notEqual(referenceAt, -1,
      `${consumer} no longer references ${sharedReferenceSkillIds[0]} - the standards would stop being loaded in review, implement, design and hardening`);

    // 中文注释：正文起点从文件开头找，不从 reference 之后找。后者会让 referenceAt < firstHeadingAt
    // 变成恒真的自我实现断言——那比没有断言更坏。
    const firstHeadingAt = lines.findIndex((line, index) => index > 0 && /^#{2,3}\s/u.test(line));
    assert.notEqual(firstHeadingAt, -1, `${consumer} has no procedure section at all`);
    // 中文注释：位置也是担保的一部分。把"先读标准"塞到正文之后，模型读到的顺序就变了，
    // 而文件里两个字符串都还在——只看存在性会给出假安心。
    assert.ok(referenceAt < firstHeadingAt,
      `${consumer} references the standards at line ${referenceAt + 1}, after its procedure starts at line ${firstHeadingAt + 1}`);
  }
});

test('the guard itself cannot pass on an empty registration list', async () => {
  // 中文注释：如果登记表被清空，上面三条都会静默地"全部通过"。这条把空表变成红灯。
  assert.ok(standardsReferenceConsumers.length > 0);
  for (const consumer of standardsReferenceConsumers) {
    assert.ok((await skillBody(consumer)).length > 0, `${consumer} SKILL.md is empty`);
  }
});
