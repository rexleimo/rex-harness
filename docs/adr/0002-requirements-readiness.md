# ADR 0002: Requirements readiness before workflow advancement

Status: Accepted for local implementation, 2026-10-30.

## Context

The previous requirements Provider optimized for a first testable slice and
permitted unanswered questions to become assumptions after three rounds. Evidence
kind completion and a structurally valid decision could then advance the workflow
with unresolved critical behavior or feasibility. Upstream Matt Pocock Skills
v1.3.2 `grilling` models dependencies explicitly, and `loop-me` finishes only when
an implementer can use the specification without further questions.

## Decision

Add `readiness` to the existing requirements decision, and enforce it in the single
Rex software workflow submission boundary. Its explicit model reports cover a
closed decision graph, critical versus low-impact assumptions, happy/failure
walkthroughs, supported feasibility and confirmed user alignment. Runtime checks
shape, known acyclic dependencies, status consistency and receipt resolvability.
It does not infer intent or semantic completeness from text.

Missing/blocked readiness retains the clarification Command and token; evidence
kinds and exhausted question budgets cannot override it. Accepted scope remains
immutable. Existing unready submissions may be corrected; historical partial
records can be enriched only without rewriting their accepted fields. Historical
later-stage workflows and standalone read operations remain readable.

The Provider retains one-decision-at-a-time interaction and research-before-asking.
Existing user authorization satisfies alignment; no repeated approval is required.
Feasibility can follow from inspection and existing tests; use a minimal authorized
probe for critical facts that remain unknown. Neither a walkthrough nor a ready
self-report proves an implementation has completed.

## Consequences and alternatives

- This tightens new requirements submissions: callers must include readiness.
  It is a breaking public-contract change even though historical data reads work.
- Keep anyOf evidence groups for old Command compatibility and low-impact defaults;
  readiness is independently required by the public workflow API.
- Reject a parent-only guard: standalone Rex must have the same semantics and there
  must be one owner. Reject a prompt-only change: it cannot enforce consistency.
- Reject mandatory renewed human confirmation on every run: prior accepted scope
  already provides alignment, while new unresolved choices still require decisions.
- No finite program can establish that all semantic branches were considered.
  Eval scenarios and independent reviews remain necessary; deterministic tests
  prove the declared gate rather than an improvement in model judgment quality.

## Sources

- https://github.com/mattpocock/skills/blob/v1.3.2/skills/productivity/grilling/SKILL.md
- https://github.com/mattpocock/skills/blob/v1.3.2/skills/in-progress/loop-me/SKILL.md
