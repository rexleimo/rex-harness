# Footer + MobileInstallBar + Theme Specification

## Footer DOM
```
footer.border-t
  div.px-[18px].py-10.sm:px-11 (or grid) > div.grid.gap-8.sm:grid-cols-2.lg:grid-cols-4
    column: h3 label + ul links
  div.flex.flex-col.items-start.gap-5.px-[18px].pb-8.pt-5.sm:flex-row.sm:items-center.lg:px-11
    nav bottom links + Theme toggle button
```

## Computed Styles
- column label: `font-mono text-[11px] font-medium leading-[1.4] tracking-normal text-muted-foreground mb-4`
- column links ul: `-my-[5px] flex flex-col items-start [&:has(a:hover,button:hover)_a:not(:hover)]:opacity-60` (dim siblings)
- link: `text-sm font-medium leading-snug rounded-sm focus-visible:ring-2 inline-block` (transition implied; siblings fade)
- bottom nav links: `text-[13px] leading-[1.35] rounded-sm inline-block px-2.5`
- theme button: sun/moon two svgs cross-fade `absolute size-3.5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0` ↔ `rotate-90 scale-0 dark:rotate-0 dark:scale-100`; label span `text-xs font-normal capitalize opacity-80 sm:text-sm` "Theme"

## Content columns (rex-harness)
- Project: GitHub · npm · Releases · Changelog
- Docs: Architecture · Capability lifecycle · Provider contract · Workflow ownership
- Agents: README.md · AGENTS.md (raw github links)
- Bottom nav: AIOS · cli.rexai.top · rexai.top · Terms(?) → use: GitHub · npm · AIOS docs · Releases

## MobileInstallBar
```
div.bg-background/95.border-border.fixed.inset-x-0.bottom-0.z-40.border-t.pb-[env(safe-area-inset-bottom)].backdrop-blur-md (hidden on desktop: lg:hidden)
  div.flex.items-center.gap-2.5.px-4.py-3
    button Copy install command: .bg-accent-fill.text-accent-fill-foreground.hover:bg-accent-fill-hover.flex.h-11.flex-1.items-center.justify-center.gap-2.rounded-[9px].text-sm.font-bold
    a GitHub icon button: .border-input.text-[color:var(--ah-fg-subtle)].hover:text-foreground.hover:border-foreground/30.flex.size-11.flex-none.items-center.justify-center.rounded-[9px].border
```
- Copy icon cross-fade same as InstallCard (size-4 variant).

## Theme strategy
- `<script is:inline>` in head: read localStorage `theme`, else matchMedia; toggle `dark` class on <html>.
- Toggle button switches class + persists.
