# Capability Lifecycle

## Loop

1. AIOS supplies normalized observations and evidence references.
2. rex-harness derives or receives software-engineering facts.
3. The composition root selects at most one process capability.
4. rex-harness starts an Activation，保存 `reasonCode` 与 `triggerEvidenceRefs`，并返回当前 recipe-stage Command。
5. A profile and host override resolve the Capability to one Provider binding.
6. AIOS 执行 Provider；若为 Agent，先解析真实角色并验证晋级证据，再记录原生 Handoff artifact。
7. rex-harness validates the current stage Evidence Contract.
8. Missing evidence blocks the same stage; valid evidence advances to the next stage or closes the Activation.
9. AIOS records the state and, after completion, asks rex-harness for the next eligible Capability.

An observed execution failure has the highest priority and preempts implementation-oriented capabilities. A completed capability must be supplied in `completedCapabilities` so the next eligible capability can run.

## Transition Results

- `blocked`: keep received partial evidence, stay on the same stage, and return missing Evidence Kinds.
- `next`: move to the next stage in the same Capability Recipe and generate one new Command.
- `completed`: close the Activation and generate no more Commands for it.
- `promotion-requested`: let AIOS accept or reject a Team or Harness runtime promotion.

AIOS projects this state into `.aios/workflow-activations/`. That directory is not a rex-harness storage implementation; it is the parent Adapter's persistence of the rex pure state machine.

## Promotions

`decidePromotion()` may request `team` for independent workstreams or `harness` for continuity requirements. It never launches either runtime; AIOS remains the authority that accepts or rejects a promotion.

## Profiles

Profiles enable capabilities and declare host assurance requirements. They do not classify tasks as Fast, Balanced, or Deep. `analyzeExecutionProfile()` derives those labels after execution from actual activations.
