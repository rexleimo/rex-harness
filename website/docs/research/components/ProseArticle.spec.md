# ProseArticle Specification

- **Target file:** `src/components/ProseArticle.astro` (content inline, MDX-free)
- **Interaction model:** static (anchor links)

## Container
`article.prose prose-hr:border-border dark:prose-invert prose-a:text-primary sm:prose-lg lg:prose-lg mx-auto [&>*:last-child]:mb-0 max-w-[70ch] [&>*:first-child]:mt-0` inside `div.px-[18px].pb-16.pt-10.sm:px-11.md:pb-20.md:pt-14` (col 1 of `xl:grid xl:grid-cols-[minmax(0,1fr)_232px]`)

## Typography rules (copy verbatim into global.css)
```css
.ah-prose-p{color:var(--ah-fg-body);text-wrap:pretty;margin:0 0 20px;font-size:15.5px;line-height:1.68}
@media(min-width:640px){.ah-prose-p,.ah-bullets>li,.ah-numbers>li{font-size:17.5px}}
.ah-prose-a{color:var(--primary);text-decoration:none}
:root .ah-prose-a{text-underline-offset:2px;text-decoration:underline #14161a59;text-decoration-thickness:1px}
:root .ah-prose-a:hover{text-decoration-color:var(--foreground)}
.dark .ah-prose-a,.dark .ah-prose-a:hover{text-decoration:none}
.dark .ah-prose-a:hover{color:var(--accent-fill-hover)}
.ah-prose-strong{color:var(--foreground);font-weight:700}
.ah-code-inline{font-family:var(--ah-mono);color:var(--foreground);background:var(--ah-hover);border:1px solid var(--ah-line);border-radius:4px;padding:1px 5px;font-size:.85em;font-weight:400}
.ah-bullets>li{color:var(--ah-fg-body);margin:0;position:relative;list-style:none;padding-left:17px;font-size:15.5px;line-height:1.68}
.ah-bullets>li+li{margin-top:11px}
.ah-bullets>li::before{content:"";background:var(--primary);opacity:.7;border-radius:50%;width:5px;height:5px;position:absolute;top:calc(.84em - 2.5px);left:0}
h2 anchor: .scroll-mt-[72px] > a.text-inherit w-full font-semibold no-underline
prose h2: font-size 1.66667em line-height 1.33333 margin-top 1.86667em margin-bottom 1.06667em font-weight 700 (prose-lg)
code block (pre): .bg-card!.text-xs!.sm:text-sm!.border-border.overflow-x-auto.border rounded-md px-3 py-2.5 font-mono
```

## Content sections (rex-harness — see CONTENT.md)
1. What it does (#what-it-does)
2. When to reach for it (#when-to-reach-for-it)
3. How the loop works (#how-the-loop-works) + code block showing start→status→evidence→resume
4. Running it standalone (#running-it-standalone) + bullets for .rex-harness/ layout
5. Connecting your agent (#connecting-your-agent) + code block `rex-harness init --client claude`
6. Common questions (#common-questions) — bold-lead paragraphs
7. Where it fits (#where-it-fits)
Then CTA aside (see CtaPanel.spec.md).
