# ArticleHero Specification

- **Target file:** `src/components/ArticleHero.astro`
- **Interaction model:** static + button hover

## DOM Structure
```
div.bg-card > div.relative.flex.flex-col.justify-center.px-[18px].pb-10.pt-10.sm:px-11.md:pb-12.md:pt-12
  div.mb-4.flex.flex-wrap.items-center.gap-x-2.5.gap-y-1   (kicker row)
    span pill "v0.9.1"
    span meta "The rex-harness Control Plane · 6 min read · Updated Oct 14, 2026"
  h1 + inline logo img
  p lede
  div.mt-7.flex.w-full.flex-wrap.items-center.justify-between.gap-5
    left: author chip + "npm package" button
    right: Copy command / Share / Next page ghost buttons
```

## Computed Styles (verbatim classes)
- kicker pill: `font-mono text-[10px] font-medium uppercase leading-none tracking-[0.10em] border border-border text-foreground px-[7px] py-[5px] rounded-[5px]`
- kicker meta: `font-mono text-[12px] font-normal leading-[1.4] tracking-normal text-muted-foreground`
- h1: `text-[2rem] font-bold leading-[1.06] tracking-[-0.03em] sm:text-[2.5rem] lg:text-[2.75rem] lg:leading-[1.04] lg:tracking-[-0.034em] flex items-start`
  - logo span: `-mt-[0.02em] flex h-[1lh] shrink-0 items-center` > img `size-10 rounded-[11px] sm:size-12`
  - text span: `min-w-0 text-balance ml-3` → "The rex-harness Workflow"
- lede: `text-[17px] font-normal leading-[1.55] sm:text-[18.5px] mt-4 max-w-[48ch] text-pretty text-[color:var(--ah-fg-muted)]` → "One command at a time. Progress only on evidence."
- author chip: `flex items-center gap-2 text-foreground text-sm font-medium [&_img]:w-8` img rounded-full (use /logo.svg) + col: span "RexAI"
- ghost buttons: `inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground border border-input bg-background h-9 px-3.5 py-2` (shadcn outline button)
- Next page button includes arrow svg `text-muted-foreground ml-2 h-4 w-4`

## Content
- H1 "The rex-harness Workflow"; pill "v0.9.1"
- Buttons: "Copy command" (copies install cmd), "Share" (dropdown-less: copies URL), "Next page" → https://cli.rexai.top

## States
- hover:bg-accent on buttons; transition-colors.
