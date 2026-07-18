# ADR 0001: Modular Capability Pack

## Status

Accepted

## Context

AIOS already owns orchestration, continuity, memory, compression, and safety. Reimplementing those concerns in rex-harness would create a second control plane. Organizing policies into global rules, evidence, and adapter directories would also scatter one capability across the repository.

## Decision

Build rex-harness as a dependency-free modular capability pack. Organize software policy by vertical capability, keep third-party provider names behind bindings, and expose one AIOS manifest seam.

## Consequences

- Capabilities remain cohesive and testable.
- Providers can change without changing semantic rules.
- AIOS integration cannot become live until a public host contract is available.
- The package will remain a single module until independent versioning provides evidence for a split.
