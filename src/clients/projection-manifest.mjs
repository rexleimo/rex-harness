import { createHash, randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export const PROJECTION_MARKER_FILE = '.rex-projection.json';
export const PROJECTION_MARKER_KIND = 'rex.client-skill-projection.v1';
export const PROJECTION_HISTORY_KIND = 'rex.client-projection-history.v1';

const DIGEST_PATTERN = /^sha256:[a-f0-9]{64}$/u;
const MARKER_KEYS = new Set(['schemaVersion', 'kind', 'skillId', 'sourceDigest', 'packageVersion']);
const HISTORY_KEYS = new Set(['schemaVersion', 'kind', 'skills']);

function normalizedRelative(value) {
  return value.replaceAll('\\', '/');
}

function compareEntryNames(left, right) {
  if (left.name === right.name) return 0;
  return left.name < right.name ? -1 : 1;
}

function canonicalFileContent(content) {
  if (content.includes(0)) return content;
  const text = content.toString('utf8');
  if (!Buffer.from(text, 'utf8').equals(content)) return content;
  return Buffer.from(text.replace(/\r\n/gu, '\n'), 'utf8');
}

function lstatOrNull(filePath) {
  try {
    return fs.lstatSync(filePath);
  } catch (error) {
    if (error?.code === 'ENOENT') return null;
    throw error;
  }
}

function assertPlainDirectory(directory, label) {
  const stats = lstatOrNull(directory);
  if (!stats || !stats.isDirectory() || stats.isSymbolicLink()) {
    throw new Error(`${label} must be a plain directory`);
  }
}

export function projectionPayloadDigest(rootDir) {
  assertPlainDirectory(rootDir, 'projection payload root');
  const hash = createHash('sha256');
  const visit = (directory, relative = '') => {
    const entries = fs.readdirSync(directory, { withFileTypes: true })
      .sort(compareEntryNames);
    for (const entry of entries) {
      const childRelative = path.join(relative, entry.name);
      const normalized = normalizedRelative(childRelative);
      if (normalized === PROJECTION_MARKER_FILE) continue;
      const child = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        hash.update(`d\0${normalized}\0`);
        visit(child, childRelative);
      } else if (entry.isFile()) {
        const content = canonicalFileContent(fs.readFileSync(child));
        hash.update(`f\0${normalized}\0${content.length}\0`);
        hash.update(content);
      } else {
        throw new Error(`unsupported projection entry: ${normalized}`);
      }
    }
  };
  visit(rootDir);
  return `sha256:${hash.digest('hex')}`;
}

function normalizedMarker(value, expectedSkillId) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  if (Object.keys(value).some((key) => !MARKER_KEYS.has(key))) return null;
  const skillId = String(value.skillId || '').trim();
  const sourceDigest = String(value.sourceDigest || '').trim();
  const packageVersion = String(value.packageVersion || '').trim();
  if (value.schemaVersion !== 1
    || value.kind !== PROJECTION_MARKER_KIND
    || !skillId
    || skillId !== expectedSkillId
    || !DIGEST_PATTERN.test(sourceDigest)) {
    return null;
  }
  return Object.freeze({
    schemaVersion: 1,
    kind: PROJECTION_MARKER_KIND,
    skillId,
    sourceDigest,
    ...(packageVersion ? { packageVersion } : {}),
  });
}

export function readProjectionMarker(targetDir, skillId) {
  const markerPath = path.join(targetDir, PROJECTION_MARKER_FILE);
  const stats = lstatOrNull(markerPath);
  if (!stats) return Object.freeze({ status: 'missing', marker: null });
  if (!stats.isFile() || stats.isSymbolicLink()) {
    return Object.freeze({ status: 'invalid', marker: null });
  }
  try {
    const marker = normalizedMarker(JSON.parse(fs.readFileSync(markerPath, 'utf8')), skillId);
    return Object.freeze({ status: marker ? 'valid' : 'invalid', marker });
  } catch {
    return Object.freeze({ status: 'invalid', marker: null });
  }
}

export function writeProjectionMarker(targetDir, { skillId, sourceDigest, packageVersion = '' }) {
  if (!skillId || !DIGEST_PATTERN.test(sourceDigest)) {
    throw new TypeError('projection marker requires a skill id and sha256 source digest');
  }
  assertPlainDirectory(targetDir, 'projection marker target');
  const markerPath = path.join(targetDir, PROJECTION_MARKER_FILE);
  if (lstatOrNull(markerPath)) {
    const error = new Error(`projection marker already exists: ${skillId}`);
    error.code = 'EEXIST';
    throw error;
  }
  const marker = {
    schemaVersion: 1,
    kind: PROJECTION_MARKER_KIND,
    skillId,
    sourceDigest,
    ...(packageVersion ? { packageVersion } : {}),
  };
  const temporary = path.join(targetDir, `.rex-marker-${randomUUID()}`);
  let descriptor;
  try {
    descriptor = fs.openSync(temporary, 'wx', 0o600);
    fs.writeFileSync(descriptor, `${JSON.stringify(marker, null, 2)}\n`, 'utf8');
    fs.fsyncSync(descriptor);
    fs.closeSync(descriptor);
    descriptor = undefined;
    fs.linkSync(temporary, markerPath);
  } finally {
    if (descriptor !== undefined) fs.closeSync(descriptor);
    fs.rmSync(temporary, { force: true });
  }
  return Object.freeze(marker);
}

export function readProjectionHistory(packageRoot) {
  const historyPath = path.join(packageRoot, 'src', 'clients', 'projection-history.json');
  if (!fs.existsSync(historyPath)) return Object.freeze({});
  let parsed;
  try {
    parsed = JSON.parse(fs.readFileSync(historyPath, 'utf8'));
  } catch (error) {
    throw new Error(`invalid Rex projection history: ${error.message}`, { cause: error });
  }
  if (parsed?.schemaVersion !== 1
    || parsed?.kind !== PROJECTION_HISTORY_KIND
    || Object.keys(parsed).some((key) => !HISTORY_KEYS.has(key))
    || !parsed.skills
    || typeof parsed.skills !== 'object'
    || Array.isArray(parsed.skills)) {
    throw new Error('invalid Rex projection history contract');
  }
  const history = {};
  for (const [skillId, values] of Object.entries(parsed.skills)) {
    if (!Array.isArray(values) || values.some((value) => !DIGEST_PATTERN.test(String(value)))) {
      throw new Error(`invalid Rex projection history for ${skillId}`);
    }
    history[skillId] = Object.freeze([...new Set(values.map(String))]);
  }
  return Object.freeze(history);
}
