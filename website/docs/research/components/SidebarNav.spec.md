# SidebarNav Specification

- **Target file:** `src/components/SidebarNav.astro`
- **Interaction model:** click-driven disclosure (button toggles section list; chevron rotates)

## DOM Structure
```
aside: div.text-sidebar-foreground.flex-col.bg-sidebar.top-(--nav-height).w-[264px].sticky.hidden.h-[calc(100svh-var(--nav-height))].self-start.border-r  (lg:flex)
  div.flex.min-h-0.flex-1.flex-col.overflow-auto.no-scrollbar.scroll-fade
    (group label rows: font-mono text-[11px] uppercase text-muted-foreground, e.g. "Docs")
    per section:
      a (top link w/ icon) OR button (section toggle)
      ul.flex.w-full.min-w-0.flex-col.gap-px  (collapsible body)
        li > a (MenuButton)
```

## Computed Styles
- container: `w-[264px] sticky top-(--nav-height) h-[calc(100svh-var(--nav-height))] border-r bg-sidebar hidden lg:flex flex-col`
- menu button base: `peer/menu-button flex w-full overflow-hidden p-2 text-left outline-hidden ring-sidebar-ring transition-[width,height,padding] focus-visible:ring-2 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground data-[active=true]:bg-sidebar-accent data-[active=true]:font-medium data-[active=true]:text-sidebar-accent-foreground text-[13px] leading-[1.35] rounded-sm`
- section toggle button: `text-[13px] leading-[1.35] text-muted-foreground h-auto items-start gap-1.5 rounded-sm py-[7px] pr-2 font-normal` + number prefix span + chevron `ml-auto size-3.5 shrink-0 text-[color:var(--ah-fg-faint)] transition-transform duration-200 rotate-0 / rotate-90 when open`
- child links indent: wrapper `pl-6` via sidebar-menu-sub; item text `[&>span:last-child]:truncate`
- list: `ul.flex w-full min-w-0 flex-col gap-px`

## Sections (rex-harness content)
- `1` Getting Started → #what-it-does anchors: Install, Connect your agent, First run
- `2` Core Concepts → Fact / Capability / Command / Evidence / Activation (anchor #how-the-loop-works)
- `3` Providers → rex-workflow, requirements, design, planning, tdd, debug, code-review, wayfinder (anchor #connecting-your-agent)
- `4` Reference → CLI, State layout, Evidence contract (anchor #running-it-standalone)
- Active item (Get started / Overview) gets data-active=true.

## Behavior
- Click toggle → open/close list (height animation optional; simple show/hide + chevron rotate-90 duration-200).
- Default: first two sections open (matching reference where Productivity Skills expanded).
