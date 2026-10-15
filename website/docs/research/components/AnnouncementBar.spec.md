# AnnouncementBar Specification

- **Target file:** `src/components/AnnouncementBar.astro`
- **Screenshot:** `docs/design-references/grill-me-desktop-full.png` (top strip)
- **Interaction model:** static + hover (arrow nudge)

## DOM Structure
```
aside.relative.mx-auto.w-full.max-w-[1456px].px-2.print:hidden
  div.bg-muted/40.border-border.flex.h-[34px].items-center.justify-center.gap-2.5.border-x.border-b.px-4
    span (pill "New")
    a group (text + arrow svg)
```

## Computed Styles
- pill: `text-primary inline-flex shrink-0 items-center rounded-[4px] border border-[color:var(--ah-accent-line)] px-1.5 py-1 font-mono` text "New"
- link: `group focus-visible:ring-ring inline-flex min-w-0 items-center gap-1.5 font-medium tracking-tight underline-offset-4 transition`
- link text span: `truncate leading-[1.4]`
- arrow svg: `size-3.5 shrink-0 transition-transform group-hover:translate-x-0.5` (lucide arrow-right)

## States and Behaviors
- Hover: arrow translate-x-0.5, transition transform.
- Content (rex-harness): pill "New"; link "rex-harness v0.9.1 — evidence-driven workflow control plane is out." → https://github.com/rexleimo/rex-harness/releases

## Assets
- Icons: ArrowRight (lucide inline svg)

## Responsive
- Full width under 1456px; text truncates on mobile.
