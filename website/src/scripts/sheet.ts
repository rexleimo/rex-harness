// Mobile "Pages" sheet — native dialog with slide-in animation
import { onPageLoad, once } from './util';

onPageLoad(() => {
  const openBtn = document.querySelector<HTMLElement>('[data-sheet-open]');
  const dlg = document.getElementById('pages-sheet') as HTMLDialogElement | null;
  if (!openBtn || !dlg || !once(openBtn, '__sheetWired')) return;
  openBtn.addEventListener('click', () => {
    dlg.showModal();
    openBtn.setAttribute('aria-expanded', 'true');
    dlg.querySelector('div')?.animate(
      [{ transform: 'translateX(-100%)' }, { transform: 'translateX(0)' }],
      { duration: 250, easing: 'cubic-bezier(0.32, 0.72, 0, 1)' },
    );
  });
  dlg.addEventListener('click', (e) => {
    if (e.target === dlg) dlg.close(); // backdrop click
  });
  dlg.addEventListener('close', () => openBtn.setAttribute('aria-expanded', 'false'));
  dlg.querySelector<HTMLElement>('[data-sheet-close]')?.addEventListener('click', () => dlg.close());
  // close after navigating inside the sheet
  dlg.querySelectorAll('a').forEach((a) => a.addEventListener('click', () => dlg.close()));
});
