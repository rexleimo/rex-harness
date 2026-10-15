# Page Topology — aihero.dev/skills-grill-me (source of truth for rex-harness site)

Overall: centered shell `max-w-[1456px] mx-auto px-2`; inner column `bg-background border-x`.
Outside the shell the page background is `--page-background`. `body` scrolls normally (no Lenis/smooth-scroll detected; native scroll).

Order top→bottom (all inside shell):
1. **AnnouncementBar** (overlay, fixed/absolute at very top, `h-[34px]`, `bg-muted/40 border-x border-b`, "New" pill + link + arrow) — print:hidden
2. **SiteHeader** `h-(--nav-height)` sticky-ish `z-50 bg-background/90 backdrop-blur-md border-b px-[18px]` — logo avatar img + "AIHero" (mono "AI" + bold "Hero"), nav (Courses), ml-auto nav (Search, Newsletter, skeleton, CTA pill `bg-foreground/[0.06] min-w-[152px] rounded-[8px] px-3.5 py-2 text-[13px] font-bold`), mobile: 3 icon buttons `size-9 rounded-[7px]`
3. **Layout row** `group/sidebar-wrapper flex w-full min-h-0`
   - **Sidebar** `w-[264px] sticky top-(--nav-height) h-[calc(100svh-var(--nav-height))] border-r bg-sidebar hidden lg:flex flex-col`; inner `overflow-auto no-scrollbar scroll-fade`; MenuButtons `p-2 text-[13px]`, section toggles `text-[13px] leading-[1.35] text-muted-foreground py-[7px] rounded-sm`, numbered prefixes, active item `bg-sidebar-accent`; chevron `rotate-90` when open (`transition-transform duration-200`)
   - **Main** `flex min-w-0 flex-1 flex-col` → `main.bg-card w-full dark:bg-transparent`
     - **ArticleHeader block** `bg-card` with border-collapse dividers:
       a. hero `px-[18px] pb-10 pt-10 sm:px-11 md:pb-12 md:pt-12`: kicker row (pill "17 / 27" + mono meta), H1 with inline avatar `size-10 sm:size-12 rounded-[11px]`, lede, action row (author chip + Subscribe; right: Copy page / Share / Next page ghost buttons)
       b. **InstallCard** `bg-muted border-t px-6 py-8 sm:px-10 sm:py-9`: mono label "Install this skill", command row (`$` + code + copy btn `h-[30px]`), helper p, `dl` with border-t "Source → mattpocock/skills"
     - **MobileTOC** `details.xl:hidden` summary `px-8 py-3.5` ("On this page" + rotate chevron) + nav `px-8 pb-5`, links `border-l py-1.5 pl-[13px] text-[13px]`
     - **Body grid** `xl:grid xl:grid-cols-[minmax(0,1fr)_232px]`
       - prose col `px-[18px] pb-16 pt-10 sm:px-11 md:pb-20 md:pt-14`: `article.prose max-w-[70ch]` + CTA `aside.not-prose border-primary/30 bg-primary/5 rounded-xl border p-6 sm:p-8 my-10` (email form)
       - **RightRail** `aside.hidden border-l xl:block` > `div.sticky top-(--nav-height) max-h-[calc(100vh-var(--nav-height))] overflow-auto px-5 pb-8 pt-5 flex flex-col gap-6`: "On this page" nav, "Where this fits" (border-t pt-5), Share row (border-t pt-5, icon buttons `size-8 rounded-sm border`)
     - **SkillActions** `section.bg-muted border-t px-5 py-10 sm:px-11 sm:py-11 scroll-mt-(--nav-height)`: label, `bg-border grid gap-px rounded-lg border` panel `bg-background px-6 py-6/7` (h2 + badge img + Tabs "All agents/Claude Code" `bg-muted h-8 rounded-[9px] p-[3px]`, command row, update hint, Skills.sh link), then prev/here/next nav `grid min-[901px]:grid-cols-3` (here card `border-[color:var(--ah-accent-line)] bg-[color:var(--ah-accent-wash)]`)
     - **MobileShare** `flex xl:hidden px-[18px] py-8 gap-2` icon row
     - **RelatedReading** `section.border-t bg-border grid md:grid-cols-[repeat(auto-fit,minmax(320px,1fr))]`: `bg-background px-[18px] py-10 sm:px-11` + link cards `border-input rounded-md border px-4` with mono "Video" label + bold title + arrow svg
4. **MobileInstallBar** `fixed inset-x-0 bottom-0 z-40 bg-background/95 border-t backdrop-blur desk:hidden`: gold `bg-accent-fill h-11 flex-1 rounded-*` "Copy install command" + GitHub icon button `size-11 border-input`
5. **Footer** `border-t`: column grid (Learn/Cohorts/Account/Agents) `font-mono text-[11px]` labels, links `text-sm font-medium` with dim-siblings hover; bottom row nav `text-[13px] px-2.5` + Theme button (sun/moon rotate-scale swap)

Interaction models:
- Sidebar sections: **click-driven** disclosure (button toggles list; chevron rotate-90)
- TOC: anchor links + native scroll (`scroll-mt`); no scroll-spy observed
- Tabs (All agents/Claude Code): **click-driven** radix tabs, content swap
- Copy buttons: clipboard + icon cross-fade 300ms
- Theme: class strategy on <html>, persisted; `--primary` flips to gold in dark
- Header: static within shell (not shrink-on-scroll); backdrop blur
- No scroll-snap, no Lenis, no entrance animations observed on this page
