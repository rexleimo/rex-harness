# Design Tokens — extracted from aihero.dev/skills-grill-me compiled CSS

## Fonts (self-host woff2, downloaded from /_next/static/media/)
- **DM Sans** 400/500/600/700 (+italic) → CSS var `--font-geist: "DM Sans", fallback` → Tailwind `font-sans`
- **JetBrains Mono** 400/500 → `--font-geist-mono` → `font-mono`
- **Source Serif 4** 400/600 (+italic) → `--font-source-serif` (used in some prose)
- body classes: `antialiased font-sans` on `<body class="bg-page-background relative overflow-x-hidden">`

## Light theme (`:root`)
```
--page-background:#f1f2f5   (outside max-w-[1456px] shell)
--background:#fbfbfc         (card shell of the site)
--foreground:#14161a
--card:#fff
--card-foreground:#14161a
--popover:#f5f6f8
--primary:#14161a
--primary-foreground:#fbfbfc
--accent-fill:#f5c451        (gold CTA button)
--accent-fill-hover:#eab534
--accent-fill-foreground:#191510
--secondary:#14161a0f
--secondary-foreground:#14161a
--muted:#f5f6f8
--muted-foreground:#14161a9e
--accent:#14161a0f
--border:#14161a1a
--input:#14161a24
--ring:#14161a59
--radius:9px
--nav-height:62px
--command-bar-height:37px
--ah-fg-body:#14161acc
--ah-fg-muted:#14161ab3
--ah-fg-subtle:#14161aa3
--ah-fg-label:#14161a99
--ah-fg-faint:#14161a59
--ah-line:#14161a1a
--ah-line-strong:#14161a24
--ah-line-soft:#14161a12
--ah-mark-yes:#007e46
--ah-mark-gold:#a57700
--ah-mark-no:#c9302d
--ah-hover:#14161a0f
--ah-accent-wash:#14161a0a
--ah-accent-panel:#ecedef
--ah-accent-line:#14161a38
--ah-band:#f1f2f5
--sidebar:var(--muted)  --sidebar-foreground:var(--foreground)
--sidebar-accent:var(--ah-hover)  --sidebar-border:var(--border)
```

## Dark theme (`.dark`)
```
--page-background:#080808  --background:#0b0b0b  --foreground:#f4f3f1
--card:#100f0e  --popover:#0d0d0c
--primary:#f5c451  --primary-foreground:#191510   (primary flips to GOLD in dark)
--accent-fill:#f5c451  --accent-fill-hover:#ffd873
--secondary:#ffffff12  --muted:#0d0d0c  --muted-foreground:#f4f3f199
--border:#ffffff14  --input:#ffffff1f  --ring:#f5c45159
--ah-fg-body:#f4f3f1b8  --ah-fg-muted:#f4f3f199  --ah-fg-subtle:#f4f3f185
--ah-fg-label:#f4f3f17a  --ah-fg-faint:#f4f3f14d
--ah-line:#ffffff14  --ah-line-strong:#ffffff1f  --ah-line-soft:#ffffff0f
--ah-hover:#ffffff12  --ah-accent-wash:#f5c45112  --ah-accent-panel:#1d1a11
--ah-accent-line:#f5c45159  --ah-band:#0e0e0d
--ah-mark-yes:#58da98  --ah-mark-gold:var(--accent-fill)  --ah-mark-no:#fd736d
```

## Type scale (observed computed classes)
- H1: `text-[2rem] font-bold leading-[1.06] tracking-[-0.03em] sm:text-[2.5rem] lg:text-[2.75rem] lg:leading-[1.04] lg:tracking-[-0.034em]`
- Lede: `text-[17px] leading-[1.55] sm:text-[18.5px] text-[color:var(--ah-fg-muted)] max-w-[48ch] text-pretty mt-4`
- Kicker label (mono): `font-mono text-[11px] font-medium leading-[1.4] tracking-normal text-muted-foreground`
- Kicker pill: `font-mono text-[10px] font-medium uppercase leading-none tracking-[0.10em] border border-border text-foreground px-[7px]` (rounded via `rounded-*`, py small)
- Prose: `prose prose-lg sm:prose-lg lg:prose-lg prose-a:text-primary prose-hr:border-border dark:prose-invert max-w-[70ch]`
- Prose H2: `scroll-mt-[72px]` + inner anchor `text-inherit! w-full font-semibold no-underline`
- Inline code: `font-mono text-xs font-medium text-foreground bg-foreground/[0.055] border-border/70 rounded-[4px] border px-1.5 py-0.5`
- Body links: `decoration-primary/40 underline-offset-4 hover:decoration-primary`
- Nav item text: `text-[13.5px] leading-none` in `rounded-[7px] px-3 py-[7px]`, hover `bg-foreground/[0.06]`
- Secondary nav links: `text-[color:var(--ah-fg-muted)] hover:text-foreground text-[13px] leading-none`
- Small mono meta: `font-mono text-[12px] leading-[1.4] text-muted-foreground`

## Radii / spacing
- `--radius:9px`; buttons `rounded-[8px]`/`rounded-[9px]`; code box `rounded-md`; icon buttons `rounded-[6px]/[7px]`
- Page shell: `max-w-[1456px] mx-auto px-2`, inner card `bg-background border-x`
- Content gutters: `px-[18px] sm:px-11`
- Grid: sidebar `w-[264px]` + main flex-1; article inner `xl:grid xl:grid-cols-[minmax(0,1fr)_232px]`

## Signature effects
- Header: `bg-background/90 backdrop-blur-md border-b h-(--nav-height) z-50`
- Section dividers via border-collapse trick: `[&>*+*]:border-border [&>*+*]:-mt-px [&>*+*]:border-t`
- Gap-px bordered grids: `bg-border grid gap-px rounded-lg overflow-hidden border` (children `bg-background`)
- Copy icon morph: two svgs, `transition-all duration-300 ease-out-quart scale-100/opacity-100 ↔ scale-50/opacity-0`
- Footer dim-on-hover siblings: `[&:has(a:hover,button:hover)_a:not(:hover)]:opacity-60`
- Card hover: `hover:border-foreground/30` (prev/next), `hover:border-foreground/25` + arrow `group-hover:translate-x-1` (related)
- Announcement arrow: `group-hover:translate-x-0.5`
