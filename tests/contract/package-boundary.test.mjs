import assert from 'node:assert/strict';
import { access, readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

test('core package exposes CLI and JS API without bundling an MCP server', async () => {
  const packageRoot = process.cwd();
  const manifest = JSON.parse(await readFile(path.join(packageRoot, 'package.json'), 'utf8'));
  const publicIndex = await readFile(path.join(packageRoot, 'src', 'index.mjs'), 'utf8');
  const cli = await readFile(path.join(packageRoot, 'bin', 'rex-harness.mjs'), 'utf8');

  assert.equal(manifest.dependencies?.['@modelcontextprotocol/sdk'], undefined);
  assert.equal(manifest.scripts?.mcp, undefined);
  assert.doesNotMatch(publicIndex, /callRexTool|listRexTools|\.\/mcp\//u);
  assert.doesNotMatch(cli, /runMcp|command === 'mcp'|\|mcp\|/u);

  const mcpSourceFiles = await readdir(path.join(packageRoot, 'src', 'mcp')).catch((error) => {
    if (error?.code === 'ENOENT') return [];
    throw error;
  });
  assert.deepEqual(mcpSourceFiles, []);
  await assert.rejects(access(path.join(packageRoot, 'src', 'cli', 'mcp.mjs')));
});
