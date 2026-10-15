# SkillActions Specification

- **Target file:** `src/components/SkillActions.astro`
- **Interaction model:** click-driven tabs (command swap) + prev/next links

## DOM Structure
```
section.bg-muted.border-t.scroll-mt-(--nav-height) id=skill-actions
  div.px-5.py-10.sm:px-11.sm:py-11
    p label "Skill actions"
    div.border-border.bg-border.grid.gap-px.overflow-hidden.rounded-lg.border.min-[901px]:grid-cols-[repeat(auto-fit,minmax(320px,1fr))]
      div.bg-background.px-6.py-6.sm:py-7
        header row (h2 + badge link)
        tabs row + panel(s)
    nav mt-4 grid min-[901px]:grid-cols-3 (prev / here / next)
```

## Computed Styles
- label: `font-mono text-[11px] font-medium leading-[1.4] tracking-normal text-muted-foreground mb-5` → "Workflow actions"
- panel grid: `border-border bg-border grid gap-px overflow-hidden rounded-lg border min-[901px]:grid-cols-[repeat(auto-fit,minmax(320px,1fr))]`
- h2: `text-lg font-bold leading-[1.2] tracking-[-0.02em] sm:text-xl` → "Install the workflow"
- tabs: `bg-muted text-muted-foreground inline-flex h-8 w-fit rounded-[9px] p-[3px]`; tab button: `data-[state=active]:bg-background data-[state=active]:text-foreground inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-[6px] border border-transparent px-2.5 py-1 text-[13px] font-medium transition-all` (active adds `border-input bg-background shadow-sm`-ish)
- command row: same as InstallCard command row; per-tab content:
  - Tab "npm" → `npm install -g @rexleimo/rex-harness`
  - Tab "Per-agent init" → `rex-harness init --client claude`
- hint p: `text-sm leading-relaxed mt-3 text-[color:var(--ah-fg-muted)]` + update line `mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1.5` mono muted: "Update with npx/npm update -g @rexleimo/rex-harness" + right link "GitHub ↗"
- prev/next card: `border-border bg-background hover:border-foreground/30 group min-w-0 flex-1 rounded-md border px-[18px] py-4`
  - label: `font-mono text-[11px] ... text-muted-foreground mb-2.5`
  - title: `text-base leading-[1.3] tracking-[-0.018em] group-hover:text-foreground truncate font-medium text-[color:var(--ah-fg-muted)] transition-colors`
- here card: `hidden rounded-md border border-[color:var(--ah-accent-line)] bg-[color:var(--ah-accent-wash)] px-[18px] py-4 min-[901px]:block`; label `text-primary`; title `text-base font-bold leading-[1.3] tracking-[-0.018em] text-foreground`

## Content
- Previous: "AIOS control plane" → https://cli.rexai.top (left arrow svg)
- Here: "The rex-harness Workflow"
- Next: "rex-workflow skill" → https://github.com/rexleimo/rex-harness (right arrow svg)

## Behavior
- Tab click swaps command text (JS island, 2 buttons, aria-selected).
