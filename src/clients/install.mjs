import { createHash, randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { rexNativeProviderBindings } from '../providers/catalog.mjs';

const PACKAGE_ROOT = fileURLToPath(new URL('../../', import.meta.url));
// 独立包不反向依赖 AIOS；父项目通过契约测试保证此表与 AIOS 的 Skill 客户端注册表一致。
const CLIENT_SKILL_ROOTS = Object.freeze({
  codex: path.join('.codex', 'skills'),
  claude: path.join('.claude', 'skills'),
  gemini: path.join('.gemini', 'skills'),
  opencode: path.join('.opencode', 'skills'),
  hermes: path.join('.hermes', 'skills'),
  grok: path.join('.grok', 'skills'),
});
export const rexWorkflowSkill = Object.freeze({
  id: 'rex-workflow',
  instructionsRef: 'skill-sources/rex-workflow/SKILL.md',
});

function skillIds() {
  const providerSkills = rexNativeProviderBindings
    .filter((binding) => binding.provider.kind === 'skill')
    .map((binding) => binding.provider.id);
  // 编排入口不是 Capability Provider，必须显式投影，不能伪装成 Provider 绑定。
  return [rexWorkflowSkill.id, ...providerSkills];
}

function directoryDigest(rootDir) {
  const hash = createHash('sha256');
  const visit = (directory, relative = '') => {
    const entries = fs.readdirSync(directory, { withFileTypes: true })
      .sort((left, right) => left.name.localeCompare(right.name));
    for (const entry of entries) {
      const childRelative = path.join(relative, entry.name);
      const child = path.join(directory, entry.name);
      hash.update(childRelative.replaceAll('\\', '/'));
      if (entry.isDirectory()) visit(child, childRelative);
      else if (entry.isFile()) hash.update(fs.readFileSync(child));
      else hash.update('unsupported-entry');
    }
  };
  visit(rootDir);
  return hash.digest('hex');
}

function installSkill(source, target) {
  if (fs.existsSync(target)) {
    const unchanged = fs.statSync(target).isDirectory()
      && directoryDigest(source) === directoryDigest(target);
    return unchanged ? 'skipped' : 'conflict';
  }

  fs.mkdirSync(path.dirname(target), { recursive: true });
  const temporary = path.join(path.dirname(target), `.rex-install-${path.basename(target)}-${randomUUID()}`);
  try {
    fs.cpSync(source, temporary, { recursive: true, errorOnExist: true });
    fs.renameSync(temporary, target);
  } finally {
    fs.rmSync(temporary, { recursive: true, force: true });
  }
  return 'installed';
}

export function installClientProjection({
  client,
  rootDir = process.cwd(),
  packageRoot = PACKAGE_ROOT,
} = {}) {
  const clientId = String(client || '').trim().toLowerCase();
  const relativeSkillRoot = CLIENT_SKILL_ROOTS[clientId];
  if (!relativeSkillRoot) throw new Error(`unsupported rex-harness client: ${clientId || '(empty)'}`);

  const projectRoot = path.resolve(rootDir);
  const targetRoot = path.join(projectRoot, relativeSkillRoot);
  const installed = [];
  const skipped = [];
  const conflicts = [];

  // 客户端投影复制 rex 编排入口和 Catalog 中的自有 Skill；外部兼容 Provider
  // 不属于独立安装内容，也不能借此覆盖用户已经维护的同名 Skill。
  for (const id of skillIds()) {
    const source = path.resolve(packageRoot, 'skill-sources', id);
    if (!fs.existsSync(source)) throw new Error(`bundled rex skill is missing: ${id}`);
    const outcome = installSkill(source, path.join(targetRoot, id));
    if (outcome === 'installed') installed.push(id);
    if (outcome === 'skipped') skipped.push(id);
    if (outcome === 'conflict') conflicts.push(id);
  }

  const status = conflicts.length > 0
    ? 'conflicts'
    : installed.length > 0 ? 'installed' : 'unchanged';
  return Object.freeze({
    schemaVersion: 1,
    kind: 'rex.client-install-result.v1',
    status,
    client: clientId,
    skillRoot: targetRoot,
    installed: Object.freeze(installed),
    skipped: Object.freeze(skipped),
    conflicts: Object.freeze(conflicts),
  });
}

export function supportedClients() {
  return Object.freeze(Object.keys(CLIENT_SKILL_ROOTS));
}
