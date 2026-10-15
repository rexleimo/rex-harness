# TocRail + MobileToc Specification

- **Target files:** `src/components/TocRail.astro`, `src/components/MobileToc.astro`
- **Interaction model:** static anchors; rail is sticky

## RightRail DOM
```
aside.hidden.border-l.xl:block
  div.sticky.top-(--nav-height).flex.max-h-[calc(100vh-var(--nav-height))].flex-col.gap-6.overflow-auto.px-5.pb-8.pt-5
    nav: p "On this page" + ul links
    div.border-t.pt-5: "Where this fits" list
    div.border-t.pt-5: "Share" icon row
```

## Computed Styles
- label: `font-mono text-[11px] font-medium leading-[1.4] tracking-normal text-muted-foreground mb-3`
- TOC link: `focus-visible:ring-ring flex w-full items-center gap-1.5 border-l py-1.5 pl-[13px] text-[13px] leading-[1.4]` (border-l color: default `var(--ah-line)`, active/hover `border-primary text-foreground`)
- "Where this fits" items: `text-[13px] leading-[1.35] text-[color:var(--ah-fg-subtle)] hover:text-foreground transition-colors`
- Share buttons: `flex size-8 items-center justify-center rounded-sm border text-[color:var(--ah-fg-muted)] transition-colors hover:bg-foreground/5` (X, Bluesky, LinkedIn, Copy URL)

## MobileToc (xl:hidden)
```
details.group
  summary.flex.cursor-pointer.list-none.items-center.gap-2.5.px-8.py-3.5
    svg.size-4 (list icon) + span.text-sm.font-medium "On this page" + chevron.ml-auto.size-4.transition-transform.group-[[open]]:rotate-90
  nav.px-8.pb-5 > ul.flex.flex-col > li.flex > a (same link style as rail)
```

## TOC content
What it does / When to reach for it / How the loop works / Running it standalone / Connecting your agent / Common questions / Where it fits / Install the workflow (#skill-actions) / Related reading (#related-reading)
