// Scroll-spy for sidebar/sheet anchor links: an anchor item is highlighted
// only when its target heading is the current section (reference behaviour),
// never merely because the page part of the href matches.
import { onPageLoad } from './util';

const ACTIVE = ['bg-sidebar-accent', 'font-medium', 'text-sidebar-accent-foreground'];
const INACTIVE = ['text-muted-foreground'];

function activate(link: HTMLAnchorElement | null) {
  document.querySelectorAll<HTMLAnchorElement>('a[data-spy]').forEach((a) => {
    a.classList.remove(...ACTIVE);
    a.classList.add(...INACTIVE);
    a.removeAttribute('aria-current');
  });
  if (link) {
    link.classList.add(...ACTIVE);
    link.classList.remove(...INACTIVE);
    link.setAttribute('aria-current', 'true');
  }
}

let io: IntersectionObserver | null = null;

function init() {
  io?.disconnect();
  const spied: { link: HTMLAnchorElement; heading: HTMLElement }[] = [];
  const page = location.pathname;

  document.querySelectorAll<HTMLAnchorElement>('#sidebar a[href*="#"], #pages-sheet a[href*="#"]').forEach((a) => {
    const href = a.getAttribute('href')!;
    const [base, hash] = href.split('#');
    if (!hash) return;
    if (base && decodeURI(base) !== page) return;
    const heading = document.getElementById(decodeURI(hash));
    if (!heading) return;
    a.setAttribute('data-spy', '');
    a.classList.remove(...INACTIVE);
    spied.push({ link: a, heading: heading as HTMLElement });
  });

  if (!spied.length) {
    io = null;
    return;
  }

  const seen = new Set<string>();
  io = new IntersectionObserver(
    (entries) => {
      // pick the topmost visible heading among intersecting targets
      for (const e of entries) {
        const id = e.target.id;
        if (e.isIntersecting) seen.add(id);
        else seen.delete(id);
      }
      const first = spied.find((s) => seen.has(s.heading.id));
      if (first) activate(first.link);
    },
    { rootMargin: '-88px 0px -60% 0px' },
  );
  spied.forEach((s) => io!.observe(s.heading));

  // honor an explicit hash on load
  if (location.hash) {
    const h = decodeURI(location.hash.slice(1));
    const match = spied.find((s) => s.heading.id === h);
    if (match) activate(match.link);
  }
}

onPageLoad(init);
document.addEventListener('astro:after-swap', () => {
  // cross-page anchor links: scroll to the target section after the swap
  if (location.hash) {
    requestAnimationFrame(() => {
      const el = document.getElementById(decodeURI(location.hash.slice(1)));
      el?.scrollIntoView();
    });
  }
});
addEventListener('hashchange', () => {
  const h = decodeURI(location.hash.slice(1));
  const match = document.querySelector<HTMLAnchorElement>(`a[data-spy][href$="#${h}"]`);
  if (match) activate(match);
});
