// Sidebar disclosure toggles — animated height (reference: collapsible-down,
// 0.2s ease-out, height 0 -> content height, wrapper overflow-hidden).
import { onPageLoad, once } from './util';

function setOpen(target: HTMLElement, open: boolean) {
  target.classList.toggle('hidden', !open);
  target.style.height = '';
  target.style.overflow = 'hidden';
  if (open) {
    const h = target.scrollHeight;
    target.animate(
      [{ height: '0px' }, { height: `${h}px` }],
      { duration: 200, easing: 'ease-out', fill: 'forwards' },
    ).onfinish = () => {
      target.style.height = '';
      target.style.overflow = '';
    };
  }
}

onPageLoad(() => {
  document.querySelectorAll<HTMLElement>('[data-disclosure]').forEach((btn) => {
    if (!once(btn, '__disclosureWired')) return;
    const target = document.querySelector<HTMLElement>(btn.getAttribute('data-disclosure')!);
    if (!target) return;
    let open = btn.getAttribute('aria-expanded') === 'true';
    target.classList.toggle('hidden', !open); // initial state without animation
    btn.addEventListener('click', () => {
      open = !open;
      btn.setAttribute('aria-expanded', String(open));
      const icon = btn.querySelector<HTMLElement>('[data-disclosure-icon]');
      icon?.classList.toggle('rotate-90', open);
      icon?.classList.toggle('rotate-0', !open);
      setOpen(target, open);
    });
  });
});
