# Prompt Authoring Norms for rex Capability Providers

Applies to every `skill-sources/<id>/SKILL.md` in this submodule. These norms
are binding for new providers and for edits to existing ones. Rationale and the
full anti-pattern table live in the parent repo: `docs/prompt-authoring-norms.md`.

## One-sentence test

Code verifies objective facts (exit codes, hashes, schema); it never guesses
model or user intent. Provider prompts guide the model through explicit
declarations and structured output contracts — the same north star that drives
`src/application/derive-facts.mjs` (facts derive only from structured
observations and explicit intents) and `src/composition-root.mjs`
(candidates evaluated by facts + priority, never by free text).

## The three rules

1. **Contract first.** Every SKILL.md states its input precondition ("Use only
   after rex-harness selects `<capabilityId>` and supplies the current
   Command") and its output contract (the exact evidence envelope / handoff
   JSON with exactly one result). Never route on keywords: if the provider
   needs a disposition from the model, require an explicit field
   (e.g. `intent`, `task-type`, `risk-domain`) and let the runtime look it up.
2. **Self-report, don't guess.** Semantic judgments — done? blocked? which
   specialist? which risk domain? — are fields the model emits in structured
   output, with definitions and few-shot examples in the prompt. Scripts never
   parse prose with regex or keyword tables, and the runtime never asks an LLM
   to classify what a declared field already carries.
3. **Hard gates are verification protocols.** Any guarantee the provider
   claims (tests ran, scope confirmed, diff ready) must land as evidence
   referencing a real execution receipt — `src/application/validate-command-evidence.mjs`
   checks exit codes and command match. Prompts describe the obligation;
   prompts never substitute for the gate.

## Anti-patterns to reject in review

- Keyword/regex branching on user text inside SKILL.md or helper scripts.
- Regex-based entity/keyword extraction feeding scoring or routing — require a
  structured `entities:[]` / enumerated field from the model instead.
- Runtime LLM calls that judge "is this stuck/done?" — require self-reported
  fields plus deterministic counters.
- Evidence refs accepted on format alone where an execution receipt is
  obtainable.

## Reviewer checklist for SKILL.md changes

- [ ] Input precondition names the selecting capability command.
- [ ] Output contract names exact envelope kinds; exactly one result.
- [ ] Any model-declared field is enumerated or schema-described with examples.
- [ ] No keyword lists, regex classifiers, or prose parsers anywhere in the bundle.
- [ ] Claims map to evidence kinds the runtime can actually validate.
