import assert from 'node:assert/strict';
import test from 'node:test';

import { createRexCapabilityPack } from '../../src/index.mjs';

test('capability pack exposes a versioned, provider-neutral contract', () => {
  const pack = createRexCapabilityPack();

  assert.equal(pack.id, 'rex-harness.software-engineering');
  assert.equal(pack.schemaVersion, 1);
  assert.equal(pack.profile.id, 'default');
  assert.ok(pack.capabilities.length >= 8);

  const ids = pack.capabilities.map((capability) => capability.id);
  assert.equal(new Set(ids).size, ids.length, 'capability ids must be unique');
  for (const capability of pack.capabilities) {
    assert.match(capability.id, /^software\./u);
    assert.doesNotMatch(capability.id, /matt|superpowers|ecc|ponytail/iu);
    assert.ok(capability.requiredEvidence.length > 0);
  }
});

test('every enabled capability resolves through a provider binding', () => {
  const pack = createRexCapabilityPack();
  const bindings = new Map(pack.providerBindings.map((binding) => [binding.capabilityId, binding]));

  for (const capabilityId of pack.profile.enabledCapabilities) {
    assert.ok(bindings.has(capabilityId), `missing provider binding for ${capabilityId}`);
  }
});

test('default provider bindings are rex-native executable entries', () => {
  const pack = createRexCapabilityPack();

  for (const binding of pack.providerBindings) {
    assert.match(binding.provider.id, /^rex-/u);
    assert.doesNotMatch(binding.provider.id, /matt|superpowers|ecc|ponytail/iu);
    assert.equal(binding.provider.source, 'bundled');
    assert.match(binding.provider.instructionsRef, /^skill-sources\//u);
  }
});
