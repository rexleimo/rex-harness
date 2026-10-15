---
title: "Workflow ownership"
description: "The one-sentence boundary between rex-harness and an integrated host like AIOS."
order: 13
group: concepts
updated: "2026-10-14"
---

## The boundary in one sentence

`rex-harness` decides what the software engineering step is next, supplies the default execution provider, and independently stores and advances the semantic workflow; `AIOS` reuses that command by default and adds model execution and host governance on top.

## rex-harness owns

- Facts with evidence references, derived from requests and observations;
- selecting exactly one Capability at a time;
- Capability Recipes, stage goals, and Evidence Contracts;
- the `adaptive-software-delivery` Workflow Activation and its continuation history;
- the single current Provider Command;
- `.rex-harness/` standalone state, recovery entrypoints, and the Evidence Journal;
- the rex-native Provider Catalog, execution instructions, `rex-workflow` client projection, compact CLI, and execution-profile analysis.

`listSoftwareWorkflowRecipes()` projects only one `adaptive-software-delivery` description. Every stage in it is a `conditional` candidate; real selection and ordering live in `software-workflow-runtime.mjs` — the single runtime source of truth.

## The host (AIOS) additionally owns

- `direct | guarded | planned` host dispositions;
- optional provider overrides and concrete agent promotion checks;
- Coding Agent / model process execution;
- Plan, ContextDB, Team, long-run harness, and cross-session recovery;
- pre-edit, verification, privacy, security, compression, and audit gates;
- the `.aios/workflow-activations/` host projection of rex workflow state.

The host must call rex's `startSoftwareWorkflow()` / `advanceSoftwareWorkflow()` and may never re-derive the next capability from completion records. `executionHost = single | team | harness` only selects the run shape; it cannot override the current command's provider.

## Default provider assignment

- `rex-requirements` — bounded requirements clarification;
- `rex-design` / `rex-planning` / `rex-wayfinder` — consequential decisions, dependency graphs, unknown-path exploration;
- `rex-test-design` / `rex-tdd` / `rex-strict-tdd` — test scope contracts and risk-graded TDD;
- `rex-debug` / `rex-minimal-construction` / `rex-implement` — root cause, minimal construction, bounded implementation;
- `rex-code-review` / `rex-refactor-hardening` — standards-and-spec review, behavior-preserving hardening.

Providers never own triggering. A first request cannot pre-install the whole provider chain; each provider executes only the current command and stops after returning evidence.

## How standalone mode assists your agent

Standalone mode does not launch a specific agent process — it supplies a stable control protocol:

1. The agent natively loads `rex-workflow` and calls `start` or `resume` to read the current compact command;
2. it executes only the goal the command names;
3. it submits real evidence with the current token;
4. it reads the next command until the workflow completes.

So Codex, Claude, Gemini, OpenCode, Hermes, Grok Build, Pi, and ZCode only need the CLI and `init --client` — no AIOS installation required. Embedded hosts call the public JS API directly; the core package neither requires nor registers MCP.
