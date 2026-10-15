---
title: "Capability lifecycle"
description: "The nine-step loop from observation to evidence, transition results, promotions, and execution profiles."
order: 11
group: concepts
updated: "2026-10-14"
---

## The loop

1. The host (or you, in standalone mode) supplies normalized observations and evidence references.
2. rex-harness derives or receives software-engineering facts.
3. The composition root selects **at most one** process capability.
4. rex-harness starts an Activation, stores `reasonCode` and `triggerEvidenceRefs`, and returns the current recipe-stage Command.
5. A profile and host override resolve the Capability to one Provider binding.
6. The host executes the Provider; for agent providers it first resolves the real role, validates promotion evidence, and records a native Handoff artifact.
7. rex-harness validates the current stage's Evidence Contract.
8. Missing evidence blocks the same stage; valid evidence advances to the next stage or closes the Activation.
9. After completion, the host asks rex-harness for the next eligible Capability.

An observed execution failure has the highest priority and preempts implementation-oriented capabilities. A completed capability must be reported in `completedCapabilities` before the next eligible capability can run.

## Transition results

| Result | Meaning |
| --- | --- |
| `blocked` | Keep received partial evidence, stay on the same stage, return missing Evidence Kinds. |
| `next` | Move to the next stage in the same Capability Recipe and generate one new Command. |
| `completed` | Close the Activation; no more Commands are generated for it. |
| `promotion-requested` | Let the host accept or reject a Team or Harness runtime promotion. |

In host mode, AIOS projects this state into `.aios/workflow-activations/`. That directory is not a rex-harness storage implementation — it is the parent adapter's persistence of the rex pure state machine.

## Promotions

`decidePromotion()` may request `team` for independent workstreams or `harness` for continuity requirements. It never launches either runtime; the host remains the authority that accepts or rejects a promotion.

## Profiles

Profiles enable capabilities and declare host assurance requirements. They do **not** classify tasks as Fast, Balanced, or Deep. `analyzeExecutionProfile()` derives those labels *after* execution, from actual activations — the profile is an observation, never a pre-selection.
