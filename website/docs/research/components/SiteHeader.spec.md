# SiteHeader Specification

- **Target file:** `src/components/SiteHeader.astro`
- **Interaction model:** static (backdrop blur), hover color transitions

## DOM Structure
```
header (h-(--nav-height) z-50 flex w-full items-center gap-5 border-b bg-background/90 px-[18px] backdrop-blur-md)
  span.shrink-0 > a.group.flex.items-center.gap-2.5 (logo)
  nav.hidden.lg:flex > ul.flex.items-center.gap-0.5 (left nav)
  nav.ml-auto.hidden.lg:flex > ul.flex.items-center.gap-[18px] (right links + CTA)
  div.ml-auto.flex.lg:hidden (mobile icon buttons)
```

## Computed Styles
- header: `bg-background/90 h-(--nav-height) z-50 flex w-full items-center gap-5 border-b px-[18px] backdrop-blur-md`
- logo img (AIOS mark): `h-(--nav-height) w-auto shrink-0 object-contain object-bottom` — use /logo.svg rendered ~44px; site name: `text-foreground text-[15.5px] font-bold leading-none tracking-[-0.01em]` with `<span class="font-mono">rex</span>-harness`
- nav item: `rounded-[7px] px-3 py-[7px] text-[13.5px] leading-none transition-colors duration-200 hover:bg-foreground/[0.06]` inside `group/nav-item`
- right links: `text-[color:var(--ah-fg-muted)] hover:text-foreground inline-flex rounded-[6px] text-[13px] leading-none transition-colors`
- CTA pill: `bg-foreground/[0.06] inline-flex min-w-[152px] items-center justify-center rounded-[8px] px-3.5 py-2 text-[13px] font-bold` → gold variant: `bg-accent-fill text-accent-fill-foreground hover:bg-accent-fill-hover`
- mobile icon buttons: `text-foreground opacity-70 hover:bg-foreground/[0.06] hover:opacity-100 flex size-9 items-center justify-center rounded-[7px]` with `svg.size-5`

## Content
- Left nav: "AIOS docs" → https://cli.rexai.top
- Right: GitHub · npm · CTA "Install" → /rex-harness/#skill-actions
- Mobile icons: GitHub, docs, menu (no JS drawer needed — link to #sidebar anchor acceptable v1)

## States
- Hover: bg-foreground/[0.06] on nav items; color swap on links. transition-colors duration-200.
