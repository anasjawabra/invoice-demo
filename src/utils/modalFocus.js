// Keeps keyboard focus inside the topmost open modal dialog ([role=dialog][aria-modal=true]).
// Tab on the last control wraps to the first, Shift+Tab on the first wraps to the last, and focus that has
// strayed outside the dialog is brought back in. Non-modal panels (aria-modal absent) are left alone.
const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]):not([type=hidden]),select:not([disabled]),textarea:not([disabled]),summary,[tabindex]:not([tabindex="-1"])';

const visible = (el) => !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length);

export function topModal(doc = document) {
  const all = doc.querySelectorAll('[role="dialog"][aria-modal="true"]');
  return all.length ? all[all.length - 1] : null;
}

export function trapTab(e, doc = document) {
  if (e.key !== 'Tab' || e.defaultPrevented) return;
  const modal = topModal(doc);
  if (!modal) return;
  const items = [...modal.querySelectorAll(FOCUSABLE)].filter(visible);
  if (!items.length) { e.preventDefault(); modal.focus?.(); return; }
  const first = items[0]; const last = items[items.length - 1];
  const active = doc.activeElement;
  if (!modal.contains(active)) { e.preventDefault(); (e.shiftKey ? last : first).focus(); return; }
  if (e.shiftKey && (active === first || active === modal)) { e.preventDefault(); last.focus(); }
  else if (!e.shiftKey && active === last) { e.preventDefault(); first.focus(); }
}
