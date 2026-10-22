import assert from 'node:assert/strict';
import test from 'node:test';

import {
  resolveStandardConfig,
  STANDARD_CONFIG_ERROR_CODES,
} from '../../src/domain/standard-config.mjs';
import { QUANTITATIVE_STANDARD_RULES } from '../../src/domain/quantitative-rules.mjs';

test('defaults come from the rule manifest when the project declares nothing', () => {
  const result = resolveStandardConfig({});
  assert.equal(result.ok, true);
  for (const [ruleId, rule] of Object.entries(QUANTITATIVE_STANDARD_RULES)) {
    assert.equal(result.budgets[ruleId], rule.budget, `${ruleId} default budget`);
  }
});

test('a declared budget override wins and unknown keys are rejected, not ignored', () => {
  const ok = resolveStandardConfig({ budgets: { fileLines: 500 } });
  assert.equal(ok.ok, true);
  assert.equal(ok.budgets.fileLines, 500);
  assert.equal(ok.budgets.directoryEntries, QUANTITATIVE_STANDARD_RULES.directoryEntries.budget);

  const bad = resolveStandardConfig({ budgets: { fileLines: 500 }, budgetz: {} });
  assert.equal(bad.ok, false);
  assert.equal(bad.errors[0].code, 'unknown-key');
  assert.match(bad.errors[0].message, /allowed sections are budgets, exemptions/u);
});

test('illegal budgets fail as structured errors with the offending path', () => {
  for (const value of [0, -3, 8.5, '8', null, undefined]) {
    const result = resolveStandardConfig({ budgets: { directoryEntries: value } });
    assert.equal(result.ok, false, `${String(value)} must be rejected`);
    assert.ok(result.errors.some((e) => e.code === 'invalid-budget'
      && e.path === 'budgets.directoryEntries'), JSON.stringify(result.errors));
  }
});

test('an exemption without a reason is a silent second owner and is refused', () => {
  const missing = resolveStandardConfig({ exemptions: { fileLines: [{ path: 'src/tables.ts' }] } });
  assert.equal(missing.ok, false);
  assert.ok(missing.errors.some((e) => e.code === 'missing-reason'
    && e.path === 'exemptions.fileLines[0]'), JSON.stringify(missing.errors));

  const blank = resolveStandardConfig({ exemptions: { fileLines: [{ path: 'a.ts', reason: '   ' }] } });
  assert.equal(blank.ok, false, 'whitespace-only reason is not a reason');

  const declared = resolveStandardConfig({
    exemptions: { fileLines: [{ path: 'src/tables.ts', reason: 'generated data table' }] },
  });
  assert.equal(declared.ok, true);
  assert.deepEqual(declared.exemptions.fileLines, [{ path: 'src/tables.ts', reason: 'generated data table' }]);
});

test('unknown rule ids and non-object inputs are refused', () => {
  const unknown = resolveStandardConfig({ budgets: { maxCyclomaticComplexity: 5 } });
  assert.equal(unknown.ok, false);
  assert.ok(unknown.errors.some((e) => e.code === 'unknown-key'
    && e.path === 'budgets.maxCyclomaticComplexity'), JSON.stringify(unknown.errors));

  assert.throws(() => resolveStandardConfig([{ budgets: {} }]), /expects a project config object/u);
  assert.deepEqual([...STANDARD_CONFIG_ERROR_CODES], ['unknown-key', 'invalid-budget', 'missing-reason']);
});
