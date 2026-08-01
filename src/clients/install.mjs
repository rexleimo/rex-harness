import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  PROJECTION_MARKER_FILE,
  projectionPayloadDigest,
  readProjectionHistory,
  readProjectionMarker,
  writeProjectionMarker,
} from './projection-manifest.mjs';
import { rexNativeProviderBindings } from '../providers/catalog.mjs';

const PACKAGE_ROOT = fileURLToPath(new URL('../../', import.meta.url));
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
  return [rexWorkflowSkill.id, ...providerSkills];
}

function lstatOrNull(filePath) {
  try {
    return fs.lstatSync(filePath);
  } catch (error) {
    if (error?.code === 'ENOENT') return null;
    throw error;
  }
}

function realpathOrNull(filePath) {
  try {
    const realpath = fs.realpathSync.native || fs.realpathSync;
    return realpath(filePath);
  } catch (error) {
    if (error?.code === 'ENOENT') return null;
    throw error;
  }
}

function samePath(left, right) {
  const normalizedLeft = path.normalize(path.resolve(left));
  const normalizedRight = path.normalize(path.resolve(right));
  return process.platform === 'win32'
    ? normalizedLeft.toLowerCase() === normalizedRight.toLowerCase()
    : normalizedLeft === normalizedRight;
}

function canonicalPathForComparison(filePath) {
  const absolute = path.resolve(filePath);
  const parent = path.dirname(absolute);
  const canonicalParent = realpathOrNull(parent);
  return path.join(canonicalParent || parent, path.basename(absolute));
}

function resolvesOutsideEntry(filePath) {
  const realpath = realpathOrNull(filePath);
  return realpath !== null && !samePath(realpath, canonicalPathForComparison(filePath));
}

function assertPlainDirectory(directory, label) {
  const stats = lstatOrNull(directory);
  if (!stats?.isDirectory() || stats.isSymbolicLink() || resolvesOutsideEntry(directory)) {
    throw new Error(`${label} must be a plain directory: ${directory}`);
  }
}

function readPackageVersion(packageRoot) {
  try {
    return String(JSON.parse(fs.readFileSync(path.join(packageRoot, 'package.json'), 'utf8')).version || '').trim();
  } catch {
    return '';
  }
}

function ensurePlainDirectory(directory) {
  const current = lstatOrNull(directory);
  if (current) {
    assertPlainDirectory(directory, 'Rex projection path');
    return;
  }
  const parent = path.dirname(directory);
  if (parent !== directory) ensurePlainDirectory(parent);
  try {
    fs.mkdirSync(directory, { mode: 0o700 });
  } catch (error) {
    if (error?.code !== 'EEXIST') throw error;
    assertPlainDirectory(directory, 'Rex projection path');
  }
}

function canonicalizePotentialPath(value) {
  let cursor = path.resolve(value);
  const suffix = [];
  while (!lstatOrNull(cursor)) {
    const parent = path.dirname(cursor);
    if (parent === cursor) break;
    suffix.unshift(path.basename(cursor));
    cursor = parent;
  }
  const canonicalBase = fs.realpathSync(cursor);
  const canonicalNativeBase = realpathOrNull(cursor);
  if (!canonicalNativeBase) throw new Error(`Rex projection target root is unavailable: ${value}`);
  if (!samePath(canonicalNativeBase, canonicalPathForComparison(cursor))) {
    throw new Error(`Rex projection target root must be a plain directory: ${value}`);
  }
  return path.join(canonicalBase, ...suffix);
}

function isWithin(parent, candidate) {
  const relative = path.relative(parent, candidate);
  return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative));
}

function sourcePlan(packageRoot, projectionHistory, packageVersion) {
  const sourceRootPath = path.resolve(packageRoot, 'skill-sources');
  const sourceRootStats = lstatOrNull(sourceRootPath);
  if (!sourceRootStats?.isDirectory() || sourceRootStats.isSymbolicLink()) {
    throw new Error('bundled Rex skill-sources must be a plain directory');
  }
  const sourceRoot = fs.realpathSync(sourceRootPath);
  const plans = skillIds().map((skillId) => {
    const source = path.join(sourceRoot, skillId);
    const stats = lstatOrNull(source);
    if (!stats?.isDirectory() || stats.isSymbolicLink()) {
      throw new Error(`bundled Rex skill must be a plain directory: ${skillId}`);
    }
    if (lstatOrNull(path.join(source, PROJECTION_MARKER_FILE))) {
      throw new Error(`bundled Rex skill uses reserved marker name: ${skillId}`);
    }
    const sourceDigest = projectionPayloadDigest(source);
    const historicalDigests = projectionHistory[skillId] || [];
    if (!historicalDigests.includes(sourceDigest)) {
      throw new Error(`Rex projection history is missing the current digest: ${skillId}`);
    }
    return Object.freeze({
      skillId,
      source,
      sourceDigest,
      historicalDigests,
      marker: Object.freeze({ skillId, sourceDigest, packageVersion }),
    });
  });
  return Object.freeze({ sourceRoot, plans: Object.freeze(plans) });
}

function targetSnapshot(target, skillId) {
  const stats = lstatOrNull(target);
  if (!stats) return Object.freeze({ kind: 'absent' });
  if (stats.isSymbolicLink() || resolvesOutsideEntry(target)) {
    return Object.freeze({ kind: 'conflict', reason: 'target-symbolic-link' });
  }
  if (!stats.isDirectory()) {
    return Object.freeze({ kind: 'conflict', reason: 'target-not-directory' });
  }
  let targetDigest;
  try {
    targetDigest = projectionPayloadDigest(target);
  } catch {
    return Object.freeze({ kind: 'conflict', reason: 'unsupported-target-entry' });
  }
  const markerState = readProjectionMarker(target, skillId);
  return Object.freeze({
    kind: 'directory',
    targetDigest,
    markerStatus: markerState.status,
    markerDigest: markerState.marker?.sourceDigest || '',
  });
}

function snapshotsMatch(left, right) {
  return left.kind === 'directory'
    && right.kind === 'directory'
    && left.targetDigest === right.targetDigest
    && left.markerStatus === right.markerStatus
    && left.markerDigest === right.markerDigest;
}

function projectionConflict(reason, { sourceDigest = '', targetDigest = '', markerDigest = '', recoveryPath = '' } = {}) {
  return Object.freeze({
    outcome: 'conflict',
    reason,
    sourceDigest,
    targetDigest,
    markerDigest,
    ...(recoveryPath ? { recoveryPath } : {}),
  });
}

function decideProjection(plan, snapshot) {
  const { sourceDigest, historicalDigests } = plan;
  if (snapshot.kind === 'absent') return Object.freeze({ outcome: 'install', snapshot });
  if (snapshot.kind === 'conflict') return projectionConflict(snapshot.reason, { sourceDigest });
  const { targetDigest, markerStatus, markerDigest } = snapshot;

  if (sourceDigest === targetDigest) {
    if (markerStatus === 'invalid') {
      return projectionConflict('invalid-marker', { sourceDigest, targetDigest });
    }
    if (markerStatus === 'valid' && markerDigest !== targetDigest) {
      return projectionConflict('marker-digest-mismatch', { sourceDigest, targetDigest, markerDigest });
    }
    return Object.freeze({
      outcome: markerStatus === 'valid' ? 'skip' : 'adopt',
      snapshot,
    });
  }

  if (markerStatus === 'invalid') {
    return projectionConflict('invalid-marker', { sourceDigest, targetDigest });
  }
  if (historicalDigests.includes(targetDigest)) {
    if (markerStatus === 'valid' && markerDigest !== targetDigest) {
      return projectionConflict('marker-digest-mismatch', { sourceDigest, targetDigest, markerDigest });
    }
    return Object.freeze({
      outcome: markerStatus === 'valid' ? 'update' : 'migrate',
      snapshot,
    });
  }
  if (markerStatus === 'valid') {
    return projectionConflict(
      markerDigest === targetDigest ? 'unverified-marker' : 'managed-target-modified',
      { sourceDigest, targetDigest, markerDigest },
    );
  }
  return projectionConflict('unmanaged-target-differs', { sourceDigest, targetDigest });
}

function stagedProjection(plan, targetRoot) {
  ensurePlainDirectory(targetRoot);
  const temporary = path.join(targetRoot, `.rex-install-${plan.skillId}-${randomUUID()}`);
  try {
    fs.cpSync(plan.source, temporary, { recursive: true, errorOnExist: true });
    writeProjectionMarker(temporary, plan.marker);
    if (projectionPayloadDigest(temporary) !== plan.sourceDigest) {
      throw new Error(`staged Rex projection digest mismatch: ${plan.skillId}`);
    }
    return temporary;
  } catch (error) {
    fs.rmSync(temporary, { recursive: true, force: true });
    throw error;
  }
}

function recoveryRoot(targetRoot) {
  return path.join(
    path.dirname(targetRoot),
    '.rex-projection-recovery',
    path.basename(targetRoot),
  );
}

function preserveRecovery(artifact, targetRoot) {
  const destinationRoot = recoveryRoot(targetRoot);
  try {
    ensurePlainDirectory(destinationRoot);
    const destination = path.join(destinationRoot, `${path.basename(artifact)}-${randomUUID()}`);
    fs.renameSync(artifact, destination);
    return Object.freeze({ path: destination, cleanupPending: false });
  } catch {
    return Object.freeze({ path: artifact, cleanupPending: true });
  }
}

function restoreOrPreserve(backup, target, targetRoot) {
  if (!lstatOrNull(target)) {
    try {
      fs.renameSync(backup, target);
      return Object.freeze({ restored: true, recoveryPath: '' });
    } catch {
      // Preserve below when rollback cannot be completed.
    }
  }
  const recovery = preserveRecovery(backup, targetRoot);
  return Object.freeze({ restored: false, recoveryPath: recovery.path });
}

function applyInstall(plan, target, targetRoot) {
  const temporary = stagedProjection(plan, targetRoot);
  try {
    if (lstatOrNull(target)) {
      return projectionConflict('target-created-during-install', { sourceDigest: plan.sourceDigest });
    }
    try {
      fs.renameSync(temporary, target);
    } catch (error) {
      if (['EEXIST', 'ENOTEMPTY', 'EPERM'].includes(error?.code) && lstatOrNull(target)) {
        return projectionConflict('target-created-during-install', { sourceDigest: plan.sourceDigest });
      }
      throw error;
    }
    return Object.freeze({ outcome: 'installed', sourceDigest: plan.sourceDigest });
  } finally {
    fs.rmSync(temporary, { recursive: true, force: true });
  }
}

function applyAdoption(plan, target, expected) {
  const current = targetSnapshot(target, plan.skillId);
  if (!snapshotsMatch(expected, current)) {
    return projectionConflict('target-changed-during-install', {
      sourceDigest: plan.sourceDigest,
      targetDigest: current.targetDigest || '',
      markerDigest: current.markerDigest || '',
    });
  }
  try {
    writeProjectionMarker(target, plan.marker);
  } catch (error) {
    if (error?.code === 'EEXIST') {
      return projectionConflict('target-changed-during-install', { sourceDigest: plan.sourceDigest });
    }
    throw error;
  }
  return Object.freeze({ outcome: 'adopted', sourceDigest: plan.sourceDigest, targetDigest: expected.targetDigest });
}

function applyReplacement(plan, target, targetRoot, expected, outcome) {
  const temporary = stagedProjection(plan, targetRoot);
  const backup = path.join(targetRoot, `.rex-backup-${plan.skillId}-${randomUUID()}`);
  try {
    const beforeCommit = targetSnapshot(target, plan.skillId);
    if (!snapshotsMatch(expected, beforeCommit)) {
      return projectionConflict('target-changed-during-install', {
        sourceDigest: plan.sourceDigest,
        targetDigest: beforeCommit.targetDigest || '',
        markerDigest: beforeCommit.markerDigest || '',
      });
    }
    fs.renameSync(target, backup);
    const claimed = targetSnapshot(backup, plan.skillId);
    if (!snapshotsMatch(expected, claimed)) {
      const recovery = restoreOrPreserve(backup, target, targetRoot);
      return projectionConflict('target-changed-during-install', {
        sourceDigest: plan.sourceDigest,
        targetDigest: claimed.targetDigest || '',
        markerDigest: claimed.markerDigest || '',
        recoveryPath: recovery.recoveryPath,
      });
    }
    try {
      fs.renameSync(temporary, target);
    } catch (error) {
      const recovery = restoreOrPreserve(backup, target, targetRoot);
      if (!recovery.restored) {
        return projectionConflict('replacement-rollback-pending', {
          sourceDigest: plan.sourceDigest,
          targetDigest: expected.targetDigest,
          markerDigest: expected.markerDigest,
          recoveryPath: recovery.recoveryPath,
        });
      }
      throw error;
    }
    const recovery = preserveRecovery(backup, targetRoot);
    return Object.freeze({
      outcome,
      sourceDigest: plan.sourceDigest,
      targetDigest: expected.targetDigest,
      markerDigest: expected.markerDigest,
      recoveryPath: recovery.path,
      cleanupPending: recovery.cleanupPending,
    });
  } finally {
    fs.rmSync(temporary, { recursive: true, force: true });
  }
}

function applyDecision(plan, decision, target, targetRoot) {
  if (decision.outcome === 'conflict') return decision;
  if (decision.outcome === 'skip') {
    return Object.freeze({ outcome: 'skipped', sourceDigest: plan.sourceDigest, targetDigest: decision.snapshot.targetDigest });
  }
  if (decision.outcome === 'install') return applyInstall(plan, target, targetRoot);
  if (decision.outcome === 'adopt') return applyAdoption(plan, target, decision.snapshot);
  if (decision.outcome === 'update') {
    return applyReplacement(plan, target, targetRoot, decision.snapshot, 'updated');
  }
  return applyReplacement(plan, target, targetRoot, decision.snapshot, 'migrated');
}

function interruptedArtifacts(targetRoot, skillId) {
  const rootStats = lstatOrNull(targetRoot);
  if (!rootStats) return [];
  if (!rootStats.isDirectory() || rootStats.isSymbolicLink() || resolvesOutsideEntry(targetRoot)) {
    throw new Error('Rex projection target root must be a plain directory');
  }
  return fs.readdirSync(targetRoot, { withFileTypes: true })
    .filter((entry) => entry.name.startsWith(`.rex-backup-${skillId}-`)
      || entry.name.startsWith(`.rex-install-${skillId}-`))
    .map((entry) => path.join(targetRoot, entry.name));
}

function recoverInterruptedArtifacts(targetRoot, plan) {
  const { skillId, sourceDigest, historicalDigests } = plan;
  const artifacts = interruptedArtifacts(targetRoot, skillId);
  if (artifacts.length === 0) return Object.freeze({ events: [], blocker: null });
  const target = path.join(targetRoot, skillId);
  const backups = artifacts.filter((entry) => path.basename(entry).startsWith(`.rex-backup-${skillId}-`));
  const stages = artifacts.filter((entry) => path.basename(entry).startsWith(`.rex-install-${skillId}-`));
  const events = [];
  if (!lstatOrNull(target) && backups.length === 1) {
    const backup = backups[0];
    const snapshot = targetSnapshot(backup, skillId);
    const markerMatches = snapshot.kind === 'directory'
      && snapshot.markerStatus !== 'invalid'
      && (snapshot.markerStatus !== 'valid' || snapshot.markerDigest === snapshot.targetDigest);
    const trusted = markerMatches && historicalDigests.includes(snapshot.targetDigest);
    if (!trusted) {
      const recovery = preserveRecovery(backup, targetRoot);
      events.push(Object.freeze({
        skillId,
        kind: 'preserved-untrusted-interrupted-backup',
        path: recovery.path,
        cleanupPending: recovery.cleanupPending,
      }));
      return Object.freeze({
        events: Object.freeze(events),
        blocker: projectionConflict('interrupted-backup-untrusted', {
          sourceDigest,
          targetDigest: snapshot.targetDigest || '',
          markerDigest: snapshot.markerDigest || '',
          recoveryPath: recovery.path,
        }),
      });
    }
    fs.renameSync(backup, target);
    events.push(Object.freeze({ skillId, kind: 'restored-interrupted-backup', path: target }));
    backups.length = 0;
  } else if (!lstatOrNull(target) && backups.length > 1) {
    return Object.freeze({
      events: Object.freeze(events),
      blocker: projectionConflict('multiple-interrupted-backups'),
    });
  }
  for (const artifact of [...backups, ...stages]) {
    const recovery = preserveRecovery(artifact, targetRoot);
    events.push(Object.freeze({
      skillId,
      kind: 'preserved-interrupted-artifact',
      path: recovery.path,
      cleanupPending: recovery.cleanupPending,
    }));
  }
  return Object.freeze({ events: Object.freeze(events), blocker: null });
}

export function installClientProjection({
  client,
  rootDir = process.cwd(),
  targetRoot,
  packageRoot = PACKAGE_ROOT,
} = {}) {
  const clientId = String(client || '').trim().toLowerCase();
  const relativeSkillRoot = CLIENT_SKILL_ROOTS[clientId];
  if (!relativeSkillRoot) throw new Error(`unsupported rex-harness client: ${clientId || '(empty)'}`);

  const projectRoot = path.resolve(rootDir);
  const requestedTargetRoot = targetRoot
    ? (path.isAbsolute(targetRoot) ? path.resolve(targetRoot) : path.resolve(projectRoot, targetRoot))
    : path.join(projectRoot, relativeSkillRoot);
  const resolvedTargetRoot = canonicalizePotentialPath(requestedTargetRoot);
  const projectionHistory = readProjectionHistory(packageRoot);
  const packageVersion = readPackageVersion(packageRoot);
  const sources = sourcePlan(packageRoot, projectionHistory, packageVersion);
  if (isWithin(sources.sourceRoot, resolvedTargetRoot)) {
    throw new Error('Rex projection target must not overlap bundled skill-sources');
  }

  const recoveryEvents = [];
  const recoveryBlockers = new Map();
  for (const plan of sources.plans) {
    const recovery = recoverInterruptedArtifacts(resolvedTargetRoot, plan);
    recoveryEvents.push(...recovery.events);
    if (recovery.blocker) recoveryBlockers.set(plan.skillId, recovery.blocker);
  }

  const decisions = sources.plans.map((plan) => {
    const target = path.join(resolvedTargetRoot, plan.skillId);
    return Object.freeze({
      plan,
      target,
      decision: recoveryBlockers.get(plan.skillId) || decideProjection(plan, targetSnapshot(target, plan.skillId)),
    });
  });

  const installed = [];
  const updated = [];
  const adopted = [];
  const migrated = [];
  const skipped = [];
  const conflicts = [];
  const conflictDetails = [];
  const errors = [];

  for (const entry of decisions) {
    let result;
    try {
      result = applyDecision(entry.plan, entry.decision, entry.target, resolvedTargetRoot);
    } catch (error) {
      errors.push(Object.freeze({
        skillId: entry.plan.skillId,
        operation: entry.decision.outcome,
        code: String(error?.code || 'ERR_REX_PROJECTION'),
      }));
      break;
    }
    if (result.outcome === 'installed') installed.push(entry.plan.skillId);
    if (result.outcome === 'updated') updated.push(entry.plan.skillId);
    if (result.outcome === 'adopted') adopted.push(entry.plan.skillId);
    if (result.outcome === 'migrated') migrated.push(entry.plan.skillId);
    if (result.outcome === 'skipped') skipped.push(entry.plan.skillId);
    if (result.recoveryPath) {
      recoveryEvents.push(Object.freeze({
        skillId: entry.plan.skillId,
        kind: 'preserved-replaced-projection',
        path: result.recoveryPath,
        cleanupPending: Boolean(result.cleanupPending),
      }));
    }
    if (result.outcome === 'conflict') {
      conflicts.push(entry.plan.skillId);
      conflictDetails.push(Object.freeze({ skillId: entry.plan.skillId, ...result }));
    }
  }

  const changedCount = installed.length + updated.length + adopted.length + migrated.length;
  const status = errors.length > 0 || conflicts.length > 0
    ? 'conflicts'
    : changedCount > 0 ? 'installed' : 'unchanged';
  return Object.freeze({
    schemaVersion: 1,
    kind: 'rex.client-install-result.v1',
    status,
    client: clientId,
    skillRoot: resolvedTargetRoot,
    installed: Object.freeze(installed),
    updated: Object.freeze(updated),
    adopted: Object.freeze(adopted),
    migrated: Object.freeze(migrated),
    skipped: Object.freeze(skipped),
    conflicts: Object.freeze(conflicts),
    conflictDetails: Object.freeze(conflictDetails),
    errors: Object.freeze(errors),
    recoveries: Object.freeze(recoveryEvents),
  });
}

export function supportedClients() {
  return Object.freeze(Object.keys(CLIENT_SKILL_ROOTS));
}
