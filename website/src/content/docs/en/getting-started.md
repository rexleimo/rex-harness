---
title: "Getting started"
description: "Install rex-harness, project provider skills into your agent, and run your first evidence-driven workflow in about two minutes."
order: 1
group: getting-started
updated: "2026-10-14"
---

## Requirements

- Node.js 24. No services, no MCP server, no resident daemon.
- A coding agent you already use: Codex, Claude Code, Gemini CLI, OpenCode, Hermes, Grok, Pi, or ZCode.

## Install

```bash
npm install -g @rexleimo/rex-harness
rex-harness --version
```

The standalone kernel owns Facts, Capabilities, Recipes, Activations, Commands, and the Evidence contract. Everything is project-local.

## Project skills into your agent

```bash
rex-harness init --client codex      # or claude | gemini | opencode | hermes | grok | pi | zcode
```

`init` projects the `rex-workflow` orchestration entry and the currently executable built-in provider skills into your client's standard discovery directory (e.g. `.agents/skills/`, `.claude/skills/`). Doctor the setup with `rex-harness doctor`.

## First run

```bash
rex-harness start --work-item checkout \
  --message "Clarify acceptance criteria before implementing checkout."
rex-harness status --work-item checkout
rex-harness evidence \
  --activation <current-activation-id> \
  --command-token <current-token> \
  --evidence acceptance-criteria-recorded=artifact:requirements
rex-harness resume --work-item checkout
```

`start` creates or reopens one workflow per work item and returns exactly one current command. `status` reads the current command without advancing state. `evidence` accepts or rejects typed evidence; accepted evidence rotates the one-time command token and advances the workflow. `resume` continues from the last accepted state after an interruption.

## What to read next

- [Architecture](../architecture/) — the two deployment modes and module ownership.
- [Capability lifecycle](../capability-lifecycle/) — how a capability is selected and advanced.
- [CLI reference](../cli-reference/) — every command and flag.
