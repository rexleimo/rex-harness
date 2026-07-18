import assert from 'node:assert/strict';
import { access, readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

const SRC_ROOT = path.join(process.cwd(), 'src');

async function sourceFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await sourceFiles(target));
    if (entry.isFile() && entry.name.endsWith('.mjs')) files.push(target);
  }
  return files;
}

test('domain and capability modules do not depend on providers or CLI', async () => {
  const files = await sourceFiles(SRC_ROOT);
  assert.ok(files.length > 0, 'expected source modules');

  for (const file of files) {
    const relative = path.relative(SRC_ROOT, file).replaceAll('\\', '/');
    if (!relative.startsWith('domain/') && !relative.startsWith('capabilities/')) continue;

    const source = await readFile(file, 'utf8');
    assert.doesNotMatch(source, /from\s+['"][^'"]*providers\//u, `${relative} imports a provider`);
    assert.doesNotMatch(source, /from\s+['"][^'"]*cli\//u, `${relative} imports the CLI`);
    assert.doesNotMatch(source, /scripts\/lib\//u, `${relative} imports AIOS internals`);
  }
});

test('catch-all utility directories are not introduced', async () => {
  const entries = await readdir(SRC_ROOT, { withFileTypes: true });
  const directories = new Set(entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name));

  for (const forbidden of ['common', 'helpers', 'misc', 'services', 'shared', 'utils']) {
    assert.equal(directories.has(forbidden), false, `forbidden catch-all directory: ${forbidden}`);
  }
});

test('the capability pack belongs to the standalone kernel, not the AIOS projection', async () => {
  await access(path.join(SRC_ROOT, 'kernel', 'capability-pack.mjs'));
  await assert.rejects(
    () => access(path.join(SRC_ROOT, 'aios', 'capability-pack.mjs')),
    /ENOENT/u,
  );

  const publicIndex = await readFile(path.join(SRC_ROOT, 'index.mjs'), 'utf8');
  assert.match(publicIndex, /kernel\/capability-pack\.mjs/u);

  const manifest = await readFile(path.join(SRC_ROOT, 'aios', 'manifest.mjs'), 'utf8');
  assert.doesNotMatch(manifest, /capabilities\/|providers\//u);
});
