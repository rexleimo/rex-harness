---
title: "Provider contract"
description: "Provider bindings, the one-command rule, expectedEvidence with anyOf groups, evidence validation, and projection ownership."
order: 12
group: concepts
updated: "2026-10-14"
---

A Provider Binding is the executable entry for a semantic Capability. The Catalog only binds rex-packaged skills or reviewers; an integrated host cannot override it with an external provider.

Two provider kinds are supported:

- `skill` — a discoverable Coding Agent skill;
- `agent` — a specialist reviewer selected by `risk-domain`.

Bindings never contain trigger rules. Provider availability belongs to the execution host; when a provider is unavailable the host must report it, not silently swap in a semantically different provider.

## The Command

Only the current command may execute at any time:

```json
{
  "type": "provider.invoke",
  "activationId": "activation-1",
  "capabilityId": "software.requirements.clarify",
  "recipeId": "software.requirements.clarify.recipe",
  "stageId": "clarify",
  "reasonCode": "acceptance-criteria-missing",
  "triggerEvidenceRefs": ["request:current"],
  "provider": {
    "kind": "skill",
    "id": "rex-requirements",
    "source": "bundled",
    "instructionsRef": "skill-sources/rex-requirements/SKILL.md"
  },
  "expectedEvidence": [
    { "anyOf": ["acceptance-criteria-recorded", "assumptions-recorded"] },
    { "anyOf": ["non-goals-recorded", "assumptions-recorded"] },
    "first-slice-identified",
    "requirements-decision-recorded"
  ],
  "executionToken": "host-or-standalone-token"
}
```

`expectedEvidence` supports `anyOf` convergence groups: satisfying any kind inside a group fulfills that contract item (e.g. acceptance criteria *or* recorded assumptions). This time-boxes clarification sessions and prevents infinite questioning; open items can be recorded as assumptions (`assumptions-recorded`) to converge and unlock.

A provider must return real evidence references and then stop. It cannot call the next provider, modify the Activation, re-select the Capability, or decide Team/Harness promotion.

## Evidence rules

Base validation is centralized in `validateCommandEvidence()`:

- Only kinds listed in the current `expectedEvidence` may be submitted (`anyOf` groups expand to their member kinds).
- Every evidence item needs at least one protocol-prefixed reference, e.g. `artifact:`, `command:`, `diff:`.
- Placeholders, TODO, TBD, and bare paths without a protocol prefix are rejected.
- Both the standalone CLI and manual host entrypoints must carry the current command token.
- After evidence is accepted the token rotates; the old token cannot be replayed.

```bash
rex-harness evidence \
  --activation activation-1 \
  --command-token <token> \
  --evidence acceptance-criteria-recorded=artifact:requirements
```

Agent providers return a single native JSON handoff with fields: `schemaVersion, agentId, role, status, findings, blockers, evidenceRefs, filesReviewed, recommendedNextSteps`. The host additionally verifies agent identity, role, promotion, and execution evidence before adapting it into rex typed evidence. This protocol is distinct from generic Team/Subagent handoffs and must not be mixed.

## Client projection ownership

`installClientProjection()` writes a `.rex-projection.json` marker into each rex-managed skill directory. The marker records the SHA-256 of the canonical payload; the marker itself is excluded from the digest. Updates are fail-closed:

- All canonical sources, digests, history, and target snapshots complete a preflight first — a missing source cannot leave a partial install behind.
- Absent targets are staged-installed; if the target appears before commit, the result is a conflict.
- Identical payload with no marker may be safely adopted; non-regular marker/link files refuse writes.
- Destructive updates are only allowed when the target payload matches an audited canonical digest in `src/clients/projection-history.json` — a valid marker alone does not authorize an overwrite.
- Target changes during staging, symlink/junction targets, invalid markers, or unknown user content are all preserved and reported as conflicts.
- The replaced directory is never auto-deleted; it is kept in `.rex-projection-recovery/` outside the discovery root for crash/rollback recovery.

Results return mutually exclusive `installed`, `updated`, `migrated`, `adopted`, `skipped` plus `conflicts`, `errors`, `recoveries`, and `conflictDetails` with digests and reasons.
