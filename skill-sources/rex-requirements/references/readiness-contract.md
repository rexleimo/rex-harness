# Requirements readiness contract

Input is the existing `rex.requirements-decision.v1`, extended with `readiness`.
Old artifacts without readiness remain readable. New clarification submissions
cannot advance without it. Ready/blocked are model judgments; code validates
structure and consistency, never intent from prose.

A normal record uses real refs in place of the illustrative refs below:

```json
{
  "schemaVersion": 1,
  "kind": "rex.requirements-decision.v1",
  "decisionRef": "artifact:docs/requirements/checkout.md",
  "acceptanceCriteria": ["A duplicate callback leaves exactly one payment record"],
  "nonGoals": ["Do not change payment providers"],
  "firstSlice": {
    "outcome": "Duplicate callbacks preserve the accepted order state",
    "verification": "Run the public callback scenario with the same event twice"
  },
  "observations": [{
    "kind": "change.behavior-requested",
    "evidenceRefs": ["artifact:docs/requirements/checkout.md"]
  }],
  "readiness": {
    "status": "ready",
    "decisions": [{
      "id": "duplicate-state",
      "dependsOn": [],
      "status": "resolved",
      "impact": "critical",
      "rationale": "Reuse the accepted idempotency key and preserve a single record",
      "evidenceRefs": ["artifact:docs/requirements/checkout.md#duplicate-state"]
    }],
    "walkthroughs": {
      "happyPath": ["artifact:docs/requirements/checkout.md#happy-path"],
      "failurePath": ["artifact:docs/requirements/checkout.md#duplicate-callback"]
    },
    "feasibility": {
      "status": "supported",
      "evidenceRefs": ["artifact:docs/requirements/checkout.md#existing-key-inspection"]
    },
    "alignment": {
      "status": "confirmed",
      "evidenceRefs": ["intent:accepted-idempotency-behavior"]
    }
  }
}
```

- Each decision has a unique id, known acyclic dependencies, nonempty rationale,
  status `resolved|assumed|open`, and impact `critical|low`. Resolved/assumed
  decisions require evidence refs; open decisions may have none yet.
- A ready record has no open nodes and no critical assumptions. Each walkthrough,
  supported feasibility, and confirmed alignment has at least one protocol ref.
- `feasibility.status` is `supported|unknown`; `alignment.status` is
  `confirmed|pending`. A blocked record may leave their refs and walkthroughs empty
  to report the precise gap honestly.
- Alignment may cite existing accepted user instructions. It does not require
  another permission round. Evidence of authorization cannot be invented.
- Feasibility refs point to source inspection, documentation, existing tests, or a
  necessary minimal probe. If a `receipt:` ref is used, the public submission
  boundary resolves it through the existing receipt validator. A failed probe may
  support a revised feasible design; the evidence record must explain that
  reasoning, rather than relying on its exit code to infer semantics.
- `assumptions-recorded` still exists for explicit low-impact defaults and old
  Command compatibility. It does not exempt the readiness check.
- Missing readiness returns `requirements-readiness-required`; blocked readiness
  returns `requirements-not-ready`. Both preserve the current clarification
  Command. Malformed/inconsistent records are rejected rather than silently fixed.
- Runtime does not prove semantic coverage, factual truth, or arbitrary artifact
  existence. It rejects inconsistent declarations and unresolved reported blockers.
  Reviewing branches and evidence remains the Provider's responsibility.

This is a requirements-stage contract, not an unconditional prerequisite for every
small direct/guarded edit, and not a new approval step or global software phase.
