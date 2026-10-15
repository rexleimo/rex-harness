// Re-run init on every client-side navigation (astro:transitions swaps the
// DOM; hoisted module scripts execute once, so listeners must be re-bound).
// astro:page-load also fires after the first load, so init must be guarded
// per element to stay idempotent.
export function onPageLoad(fn: () => void): void {
  fn();
  document.addEventListener('astro:page-load', fn);
}

// One-time-per-element guard.
export function once(el: HTMLElement, key: string): boolean {
  if ((el as unknown as Record<string, boolean>)[key]) return false;
  (el as unknown as Record<string, boolean>)[key] = true;
  return true;
}
