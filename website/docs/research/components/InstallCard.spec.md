# InstallCard Specification

- **Target file:** `src/components/InstallCard.astro`
- **Interaction model:** click (copy button)

## DOM Structure
```
section.bg-muted.border-t.flex.h-full.flex-col.justify-center.px-6.py-8.sm:px-10.sm:py-9
  p label "Install this skill"
  div (command row): .border-border.bg-muted.dark:bg-card.flex.w-full.flex-wrap.items-center.gap-x-3.gap-y-2.5.rounded-md.border.px-3.py-2.5
    span "$"  code  button(copy)
  p helper text
  dl border-t grid (Source)
```

## Computed Styles
- label: `font-mono text-[11px] font-medium leading-[1.4] tracking-normal text-muted-foreground mb-3.5`
- command row: `border-border bg-muted focus-within:ring-ring dark:bg-card flex w-full flex-wrap items-center gap-x-3 gap-y-2.5 rounded-md border px-3 py-2.5`
- `$`: `font-mono text-xs font-medium flex-none select-none text-[color:var(--ah-fg-faint)]`
- code: `font-mono font-medium text-foreground/90 min-w-0 flex-1 select-all overflow-x-auto overscroll-x-contain whitespace-nowrap bg-transparent` → `npm install -g @rexleimo/rex-harness`
- copy button: `focus-visible:ring-ring ease-out-quart flex h-[30px] w-full flex-none items-center justify-center rounded-sm transition-colors` size-3.5 icon slot; two svgs cross-fade:
  - copy: `absolute size-3.5 transition-all duration-300 motion-reduce:transition-none scale-100 opacity-100` (rect+path)
  - check: same but `scale-50 opacity-0` → swap on success for ~1.5s
- helper p: `text-sm leading-relaxed mt-3 text-[color:var(--ah-fg-muted)]` with inline code `font-mono text-xs font-medium text-foreground bg-foreground/[0.055] border-border/70 rounded-[4px] border px-1.5 py-0.5` → Then run `rex-harness start --work-item <id> --message "…"` in your project.
- dl: `border-border mt-5 flex flex-wrap gap-x-6 gap-y-4 border-t pt-5`; dt `font-mono text-[11px] ... mb-1.5`; dd `text-sm font-medium leading-snug` > a `text-primary underline-offset-4 hover:underline` → "rexleimo/rex-harness" (github)
