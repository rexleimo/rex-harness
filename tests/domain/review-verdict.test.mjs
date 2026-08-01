import assert from 'node:assert/strict';
import test from 'node:test';

import {
  REVIEW_VERDICT_KIND,
  normalizeReviewVerdict,
} from '../../src/index.mjs';

function verdict(overrides = {}) {
  return {
    schemaVersion: 1,
    kind: REVIEW_VERDICT_KIND,
    status: 'complete',
    fixedPoint: 'git:merge-base',
    diffRef: 'diff:current',
    specStatus: 'missing',
    specSource: null,
    standardsFindings: [{
      id: 'standards-1',
      position: 'src/example.mjs:10',
      evidence: ['path:src/example.mjs'],
      severity: 'judgement',
      recommendation: 'Keep the boundary local.',
    }],
    specFindings: [],
    verdict: 'pass',
    evidenceRefs: ['receipt:review'],
    ...overrides,
  };
}

test('review verdict normalizes independent standards/spec axes and explicit missing spec', () => {
  const result = normalizeReviewVerdict(verdict());
  assert.equal(result.kind, REVIEW_VERDICT_KIND);
  assert.equal(result.specStatus, 'missing');
  assert.equal(result.standardsFindings[0].severity, 'judgement');
});

test('review verdict rejects unknown fields, missing diff, and invalid severity', () => {
  assert.throws(() => normalizeReviewVerdict({ ...verdict(), extra: true }), /unknown field/u);
  assert.throws(() => normalizeReviewVerdict({ ...verdict(), diffRef: '' }), /diffRef/u);
  assert.throws(() => normalizeReviewVerdict({
    ...verdict(),
    standardsFindings: [{ ...verdict().standardsFindings[0], severity: 'low' }],
  }), /severity/u);
});

test('review verdict requires spec source when the spec axis is available', () => {
  assert.throws(() => normalizeReviewVerdict({ ...verdict(), specStatus: 'available' }), /specSource/u);
  assert.throws(() => normalizeReviewVerdict({ ...verdict(), specSource: 'docs/spec.md' }), /missing spec/u);
  assert.throws(() => normalizeReviewVerdict({ ...verdict(), status: 'complete', verdict: 'blocked' }), /pass or changes-requested/u);
});
