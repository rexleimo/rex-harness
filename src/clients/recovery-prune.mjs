/* 中文注释：work-8 —— recovery 备份曾经只增不减：preserveRecovery() 只在失败/替换时写入，
   没有任何回收机制，历史失败安装的备份会永久堆积（父仓库工作区曾累积 93 个 / ~1.16MB，
   见父仓库 docs/plans/2026-10-14-submodule-boundary-and-loop-closure.md §work-5/work-8）。
   本模块提供成功安装后的保守修剪：按 skill 归属保留最近 N 份，归属不明的条目永不动。 */
import fs from 'node:fs';
import path from 'node:path';

/** 每个 skill 在 recovery 根里保留的最近备份数（按 mtime 排序）。 */
export const RECOVERY_RETENTION_PER_SKILL = 2;

/* 中文注释：备份名格式由 install.mjs 固定为 `.rex-backup-<skillId>-<randomUUID()>`。
   只比前缀会把 skillId 互为前缀的邻居（如 rex-tdd / rex-tdd-advanced）归到同一个桶，
   从而拿别的 skill 的保留额去删本不该删的备份；因此要求前缀之后的剩余部分必须是 UUID。 */
const UUID_TAIL = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * 修剪一个 recovery 根目录里可归属的过期备份。
 *
 * 保守规则（有意为之，勿放宽）：
 * - 只处理名字形如 `.rex-backup-<skillId>-<uuid>` 且 `skillId` 在 `knownSkillIds` 里的目录；
 *   归属不明的条目（废弃 skill 的备份、skillId 互为前缀的邻居、`_purged-*` 等非备份形态）一律不动——
 *   无法归属就没有资格替 operator 决定删除。
 * - 每个 skill 保留最近 `retention` 份；同一轮安装刚保留的备份 mtime 最新，天然在保留集里。
 * - prune 是尽力而为的副作用：单条删除失败留给下次成功安装回收，不影响安装结果。
 * - recovery 目录不存在时返回空数组，且不创建目录。
 *
 * @returns {readonly string[]} 被删除的备份绝对路径（按修剪顺序）。
 */
export function pruneRecoveryBackups({
  recoveryDir,
  knownSkillIds = [],
  retention = RECOVERY_RETENTION_PER_SKILL,
} = {}) {
  let entries;
  try {
    entries = fs.readdirSync(recoveryDir, { withFileTypes: true });
  } catch {
    return Object.freeze([]);
  }

  const pruned = [];
  for (const skillId of knownSkillIds) {
    const prefix = `.rex-backup-${skillId}-`;
    const backups = entries
      .filter((entry) => entry.isDirectory()
        && entry.name.startsWith(prefix)
        && UUID_TAIL.test(entry.name.slice(prefix.length)))
      .map((entry) => {
        const full = path.join(recoveryDir, entry.name);
        let mtimeMs = 0;
        try {
          mtimeMs = fs.statSync(full).mtimeMs;
        } catch {
          // 读不到 mtime 按最旧处理：可归属但已损坏的备份优先被回收。
        }
        return { full, mtimeMs };
      })
      .sort((left, right) => right.mtimeMs - left.mtimeMs);

    for (const stale of backups.slice(Math.max(0, retention))) {
      try {
        fs.rmSync(stale.full, { recursive: true, force: true });
        pruned.push(stale.full);
      } catch {
        // 见上：尽力而为，失败不升级。
      }
    }
  }
  return Object.freeze(pruned);
}
