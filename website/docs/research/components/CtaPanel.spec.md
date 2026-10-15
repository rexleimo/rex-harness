# CtaPanel Specification

- **Target file:** `src/components/CtaPanel.astro` (rendered inside ProseArticle after last section)
- **Interaction model:** static panel + button hovers

## DOM Structure
```
aside.not-prose.my-10.flex.flex-col.gap-5.rounded-xl.border.p-6.sm:p-8
  div.flex.flex-col.gap-2
    span.kicker / h3 / p
  div.flex.flex-wrap.gap-3 (buttons)
```

## Computed Styles
- container: `not-prose border-primary/30 bg-primary/5 my-10 flex flex-col gap-5 rounded-xl border p-6 sm:p-8`
- kicker: `font-mono text-[11px] font-medium leading-[1.4] tracking-normal text-primary` → "AIOS · Documentation"
- h3: `text-[1.3125rem] font-bold leading-[1.15] tracking-[-0.02em] sm:text-[1.5rem] sm:tracking-[-0.022em] text-foreground text-balance font-sans` → "Pressure-tests decisions. Evidence ships them."
- p: `text-[17px] font-normal leading-[1.55] sm:text-[18.5px] text-foreground/80 text-balance` → "Start with one work item. rex-harness keeps the state, rotates the command token, and only advances when real evidence lands."
- primary btn: `bg-accent-fill text-accent-fill-foreground hover:bg-accent-fill-hover inline-flex h-11 items-center justify-center rounded-[9px] px-5 text-sm font-bold transition-colors` → "Read the docs" → https://cli.rexai.top
- secondary btn: `border-input hover:border-foreground/30 inline-flex h-11 items-center justify-center gap-2 rounded-[9px] border px-5 text-sm font-bold transition-colors` → "Star on GitHub" → repo
