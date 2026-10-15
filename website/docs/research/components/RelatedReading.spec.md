# RelatedReading Specification

- **Target file:** `src/components/RelatedReading.astro`
- **Interaction model:** link cards with hover

## DOM Structure
```
section.border-border.bg-border.grid.grid-cols-1.gap-px.scroll-mt-(--nav-height).md:grid-cols-[repeat(auto-fit,minmax(320px,1fr))] id=related-reading
  div.bg-background.px-[18px].py-10.sm:px-11
    h2 label "Related reading"
    ul.flex.flex-col.gap-2.5 > li > a card
```

## Computed Styles
- label h2: `font-mono text-[11px] font-medium leading-[1.4] tracking-normal text-muted-foreground mb-5`
- card: `border-input hover:border-foreground/25 focus-visible:ring-ring group flex items-center gap-4 rounded-md border px-4 py-3.5`
- card kicker: `font-mono text-[12px] font-normal leading-[1.4] tracking-normal text-muted-foreground mb-1.5 block` → "Docs"
- card title: `text-base font-bold leading-[1.3] tracking-[-0.018em] block text-pretty`
- arrow: `ease-out-quart text-foreground ml-auto size-4 flex-none opacity-[0.35] transition-transform duration-300 group-hover:translate-x-1 motion-reduce:transform-none`

## Content (3 cards)
- Docs · Architecture: Fact → Capability → Evidence → https://github.com/rexleimo/rex-harness/blob/main/docs/architecture.md
- Docs · Capability lifecycle → docs/capability-lifecycle.md
- Docs · Provider contract → docs/provider-contract.md
