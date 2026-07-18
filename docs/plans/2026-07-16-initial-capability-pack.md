# Initial Capability Pack Plan

> 状态：已被 rex-native-first 决策取代。外部 Matt/Superpowers/ECC/Ponytail 不再是默认绑定，仅保留显式兼容适配。

## Goal

Create a provider-neutral software-engineering capability pack that AIOS can execute through a future public Capability API.

## Scope

1. Define software facts and semantic capability IDs.
2. Implement single-capability selection and Team/Harness promotion requests.
3. Bind capabilities to bundled rex-native skills and a bundled specialist Reviewer catalog.
4. Add default and high-assurance profiles.
5. Add contract, scenario, architecture, and skill-source tests.

## Non-goals

- Implementing AIOS execution, ContextDB, compression, Team, or Harness.
- Installing external providers.
- Replacing the current harness-cli workflow policy in this change.
