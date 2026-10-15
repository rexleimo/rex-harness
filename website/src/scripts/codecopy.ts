// Hover-revealed copy button on every code block (reference:
// size-9 absolute bottom-1 right-1 rounded opacity-0 transition
// group-focus-within:opacity-100 group-hover:opacity-100 border bg-background shadow-xs)
import { onPageLoad, once } from './util';
const BTN = 'border bg-background shadow-xs size-9 absolute bottom-1 right-1 rounded opacity-0 transition group-focus-within:opacity-100 group-hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 text-[color:var(--ah-fg-muted)] hover:text-foreground';
const ICON = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="size-4"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>';
const CHECK = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="size-4"><polyline points="20 6 9 17 4 12"/></svg>';

onPageLoad(() => {
  document.querySelectorAll<HTMLElement>('article pre, .docs-prose pre').forEach((pre) => {
    if (!once(pre, '__codeCopyDone')) return;
    const parent = pre.parentElement;
    if (!parent) return;
    // ensure positioning context + group
    const cs = getComputedStyle(parent);
    if (cs.position === 'static') parent.style.position = 'relative';
    parent.classList.add('group');
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.setAttribute('aria-label', 'Copy to clipboard');
    btn.className = BTN;
    btn.innerHTML = ICON;
    btn.addEventListener('click', async () => {
      const text = pre.textContent ?? '';
      try {
        await navigator.clipboard.writeText(text);
      } catch {
        const ta = document.createElement('textarea');
        ta.value = text;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        ta.remove();
      }
      btn.innerHTML = CHECK;
      setTimeout(() => { btn.innerHTML = ICON; }, 1500);
    });
    parent.appendChild(btn);
  });
});
