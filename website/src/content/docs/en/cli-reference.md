---
title: "CLI reference"
description: "Every rex-harness command: start, status, evidence, resume, init, doctor — flags, exit behavior, and the .rex-harness state layout."
order: 20
group: reference
updated: "2026-10-14"
---

## Command overview

| Command | Purpose |
| --- | --- |
| `rex-harness start` | Create or reopen one workflow per work item; return exactly one current command. |
| `rex-harness status` | Read the current command without advancing state. |
| `rex-harness evidence` | Accept or reject typed evidence; accepted evidence rotates the token and advances. |
| `rex-harness resume` | Continue from the last accepted state after an interruption. |
| `rex-harness init` | Project `rex-workflow` + provider skills into a client's discovery directory. |
| `rex-harness doctor` | Verify runtime, state, and projection health. |

## start

```bash
rex-harness start --work-item <id> --message "<task>"
```

Returns the compact command object: current state, provider, `instructionsRef`, stage goal, evidence contract, and the one-time `commandToken`.

## status / resume

```bash
rex-harness status --work-item <id>
rex-harness resume --work-item <id>
```

`status` is read-only. `resume` re-emits the current command with a valid token when the previous one expired unused.

## evidence

```bash
rex-harness evidence \
  --activation <activation-id> \
  --command-token <token> \
  --evidence <kind>=<protocol-prefixed-ref>
```

Multiple `--evidence` flags may be repeated. Only kinds in the current `expectedEvidence` are accepted; refs must carry a protocol prefix (`artifact:`, `command:`, `diff:`, …). On acceptance the token rotates immediately — the old token is invalid and cannot be replayed.

## init

```bash
rex-harness init --client codex   # codex | claude | gemini | opencode | hermes | grok | pi | zcode
```

Never overwrites same-named user files by default: identical content is skipped, different content is reported as a conflict. See [Provider contract → projection ownership](../provider-contract/) for the full fail-closed update rules.

## Global flags

- `--root <project-root>` — target another project.
- `--full` — return the complete workflow result for diagnostics or audit instead of the compact command.

## State layout

```text
.rex-harness/
  workflows/    # canonical Workflow Activations + work-item index
  activations/  # convenience projection of the current Capability
  evidence/     # append-only NDJSON Evidence Journal
```

All reads and writes are fail-closed: corrupted state, mismatched evidence types, or unprefixed references stop the run rather than papering over it.

## Core JS API (host integration)

- `startSoftwareWorkflow()` / `advanceSoftwareWorkflow()` — the full adaptive software workflow runtime.
- `evaluateSoftwareRequest()` — select the current capability from facts.
- `startActivation()` / `advanceActivation()` — single-capability evidence state machine.
- `nextCommand()` — generate exactly one provider command for the current stage.
- `validateCommandEvidence()` — shared evidence base validation.
- `listSoftwareWorkflowRecipes()` — read-only description of the adaptive runtime.
- `analyzeExecutionProfile()` — derive Fast/Balanced/Deep from actual activations.
- `startStandaloneWorkflow()` / `readStandaloneWorkflow()` / `submitStandaloneEvidence()` — full standalone JS API for hosts.

## Development

```bash
npm test
npm run doctor
```
