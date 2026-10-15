// Clipboard copy with icon cross-fade (matches reference 300ms ease-out-quart)
import { onPageLoad, once } from './util';

function wire(btn: HTMLElement) {
  if (!once(btn, '__copyWired')) return;
  const iconCopy = btn.querySelector<HTMLElement>('[data-icon-copy]');
  const iconCheck = btn.querySelector<HTMLElement>('[data-icon-check]');
  btn.addEventListener('click', async () => {
    const text = btn.getAttribute('data-copy') || location.href;
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
    if (iconCopy && iconCheck) {
      iconCopy.classList.replace('scale-100', 'scale-50');
      iconCopy.classList.replace('opacity-100', 'opacity-0');
      iconCheck.classList.replace('scale-50', 'scale-100');
      iconCheck.classList.replace('opacity-0', 'opacity-100');
      setTimeout(() => {
        iconCopy.classList.replace('scale-50', 'scale-100');
        iconCopy.classList.replace('opacity-0', 'opacity-100');
        iconCheck.classList.replace('scale-100', 'scale-50');
        iconCheck.classList.replace('opacity-100', 'opacity-0');
      }, 1500);
    }
    // aria-live label swap (reference: "Copy page" -> "Copied!")
    const label = btn.querySelector<HTMLElement>('[data-copy-label]');
    if (label) {
      const original = label.textContent;
      label.textContent = label.getAttribute('data-copied') ?? 'Copied!';
      setTimeout(() => { label.textContent = original; }, 1500);
    }
  });
}

onPageLoad(() => {
  document.querySelectorAll<HTMLElement>('[data-copy]').forEach(wire);
  document.querySelectorAll<HTMLElement>('[data-copy-url]').forEach((btn) => {
    btn.setAttribute('data-copy', location.href);
    wire(btn);
  });
});

// Theme toggle — delegated once at document level so it survives swaps.
document.addEventListener('click', (e) => {
  const btn = (e.target as HTMLElement).closest<HTMLElement>('[data-theme-toggle]');
  if (!btn) return;
  const dark = document.documentElement.classList.toggle('dark');
  try {
    localStorage.setItem('theme', dark ? 'dark' : 'light');
  } catch {}
});
