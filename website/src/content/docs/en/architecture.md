---
title: "Architecture"
description: "How rex-harness works standalone and host-integrated, with a shared Fact → Capability → Evidence state machine."
order: 10
group: concepts
updated: "2026-10-14"
---

## Goals

`rex-harness` supports two deployment modes at once:

1. **Standalone control plane**: the coding agent natively loads `rex-workflow`, reads the current Command through the compact CLI, executes it, and submits Evidence.
2. **Host integration**: AIOS reuses the same runtime through the full JS API, adding provider execution, recovery, safety, and audit.

Both modes must share the same Fact, Capability, Activation, and Evidence semantics. Neither may maintain its own state machine.

## Ownership

| Concern | rex-harness | Integrated host (e.g. AIOS) |
| --- | --- | --- |
| Request / Observation normalization | yes | may collect and pass in |
| Software-engineering Facts and Capability selection | yes | must not re-select |
| Capability Recipe and Evidence Contract | yes | must not rewrite |
| Software Workflow Activation and continuation | yes | persists and calls the public API |
| Standalone state and Evidence Journal | yes | not required |
| rex-native provider content and availability checks | yes | reuses by default, may override |
| Coding Agent / model process execution | no | yes |
| ContextDB, Team, long-run harness, RTK/Headroom | no | yes |
| Host safety, privacy, recovery, audit | no | yes |

## Modules

- `domain/` — stable vocabulary: Observation, Fact, Capability, Evidence, Activation, Command.
- `capabilities/` — vertically aggregated capabilities and internal recipes.
- `application/` — fact derivation, capability selection, activation lifecycle, evidence validation.
- `infrastructure/` — project-local state persistence under `.rex-harness/`.
- `interfaces/` — the compact CLI and the host-facing JS API.

## Design rules

- **One current command per workflow.** Selection is deterministic given the facts; the agent never chooses a capability by guessing.
- **Fail closed.** Corrupted state, mismatched evidence types, or unprefixed references stop the run instead of papering over it.
- **Tokens rotate on acceptance.** An accepted piece of evidence invalidates the previous command token immediately; replays are impossible.
- **The journal is append-only.** Audit needs no database — `.rex-harness/evidence/` is the full history.

## Where the seams are

The host may override provider availability and content checks, but never capability selection or evidence semantics. That single boundary is what keeps standalone and host-integrated runs byte-compatible in meaning.
