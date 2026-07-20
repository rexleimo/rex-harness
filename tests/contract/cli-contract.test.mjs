import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { runDoctor } from '../../src/cli/doctor.mjs';

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const cliPath = path.resolve(testDirectory, '../../bin/rex-harness.mjs');

function runCli(...args) {
  const output = execFileSync(process.execPath, [cliPath, ...args], {
    encoding: 'utf8',
  });
  return JSON.parse(output);
}

test('doctor reports a standalone-ready kernel with bundled Providers', () => {
  const report = runCli('doctor');

  assert.equal(report.status, 'ready');
  assert.equal(report.kernel.packId, 'rex-harness.software-engineering');
  assert.equal(report.kernel.schemaVersion, 1);
  assert.equal(report.kernel.status, 'ready');
  assert.ok(report.providers.length >= 12);
  assert.ok(report.providers.every((provider) => provider.id.startsWith('rex-')));
  assert.ok(report.providers.every((provider) => provider.source === 'bundled'));
  assert.deepEqual(report.missingInstructions, []);
  assert.equal(report.clientIntegration.status, 'available');
  assert.deepEqual(report.clientIntegration.clients, [
    'codex',
    'claude',
    'gemini',
    'opencode',
    'hermes',
    'grok',
  ]);
  assert.deepEqual(report.errors, []);
});

test('doctor --providers exposes reviewer and instruction checks', () => {
  const report = runCli('doctor', '--providers');

  assert.equal(report.status, 'ready');
  assert.ok(report.providerChecks.every((check) => check.status === 'ready'));
  assert.ok(report.specialistReviewers.includes('security'));
});

test('doctor fails closed when bundled Provider instructions are unavailable', async () => {
  const rootDir = await mkdtemp(path.join(os.tmpdir(), 'rex-doctor-missing-'));
  try {
    const report = runDoctor({ rootDir });
    assert.equal(report.status, 'invalid');
    assert.ok(report.missingInstructions.length > 0);
    assert.ok(report.errors.some((error) => error.includes('missing Provider instructions')));
  } finally {
    await rm(rootDir, { recursive: true, force: true });
  }
});

test('explain selects root-cause debugging for an observed execution failure', () => {
  const decision = runCli('explain', 'execution-failed');

  assert.equal(decision.capabilityId, 'software.debug.root-cause');
  assert.equal(decision.provider.id, 'rex-debug');
});

test('explain keeps high-risk behavior in test design until a typed honest RED decision exists', () => {
  const decision = runCli(
    'explain',
    'behavior-change',
    'test-scope-confirmed',
    'high-risk-boundary',
    'regression-observed',
  );

  assert.equal(decision.capabilityId, 'software.testing.design');
  assert.equal(decision.provider.id, 'rex-test-design');
});

test('explain keeps ordinary behavior in test design until a typed honest RED decision exists', () => {
  const decision = runCli(
    'explain',
    'behavior-change',
    'test-scope-confirmed',
  );

  assert.equal(decision.capabilityId, 'software.testing.design');
  assert.equal(decision.provider.id, 'rex-test-design');
});

test('CLI usage exposes the CLI-first protocol without a core MCP command', () => {
  const help = runCli('help');

  assert.match(help.usage, /doctor\|init\|explain\|start\|status\|evidence\|receipt\|resume/u);
  assert.doesNotMatch(help.usage, /mcp/iu);
});

test('receipt captures a command exit code without treating a failed test as a CLI failure', async () => {
  const rootDir = await mkdtemp(path.join(os.tmpdir(), 'rex-cli-receipt-'));
  try {
    const result = runCli(
      'receipt',
      '--root',
      rootDir,
      '--',
      process.execPath,
      '-e',
      'process.exit(7)',
    );

    assert.equal(result.kind, 'rex.cli.execution-receipt.v1');
    assert.match(result.ref, /^receipt:/u);
    assert.equal(result.receipt.exitCode, 7);
    assert.equal(result.receipt.command.executable, process.execPath);
  } finally {
    await rm(rootDir, { recursive: true, force: true });
  }
});
