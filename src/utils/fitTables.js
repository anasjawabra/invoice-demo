// Every data table must fit the page WITHOUT sideways scrolling.
// At normal widths tables simply lay out inside their container (cells wrap; see the table rules in global.css / revenue.css).
// When a table still cannot fit (a many-column table on a tablet or phone) it is shown as stacked cards: one card per row, each cell labelled with its column header.
// Nothing about the data changes — only the presentation, applied per table and only when needed, and undone as soon as the table fits again.
import { useEffect } from 'react';

const STACK = 'is-stacked';
const ROLE = { table: 'table', thead: 'rowgroup', tbody: 'rowgroup', tfoot: 'rowgroup', tr: 'row', th: 'columnheader', td: 'cell' };

function scroller(table) {
  for (let w = table.parentElement; w && w.id !== 'main-content'; w = w.parentElement) {
    const o = getComputedStyle(w).overflowX;
    if (o === 'auto' || o === 'scroll') return w;
  }
  return null;
}

// column header text for every body cell (a cell that spans several columns keeps the label of its first column)
function label(table) {
  const heads = [...table.querySelectorAll('thead tr:last-child th')];
  table.querySelectorAll('tbody tr, tfoot tr').forEach((tr) => {
    let col = 0;
    [...tr.children].forEach((cell) => {
      const span = cell.colSpan || 1;
      if (span > 1 && span >= heads.length) cell.setAttribute('data-span-all', ''); else cell.removeAttribute('data-span-all');
      const h = heads[col];
      const text = h ? (h.getAttribute('aria-label') || h.textContent || '').trim() : '';
      if (text) cell.setAttribute('data-label', text); else cell.removeAttribute('data-label');
      col += span;
    });
  });
}

// the stacked layout hides the real header row visually, so the table keeps its meaning for assistive technology through explicit roles
function setRoles(table, on) {
  const els = [table, ...table.querySelectorAll('thead, tbody, tfoot, tr, th, td')];
  for (const el of els) {
    const r = ROLE[el.tagName.toLowerCase()];
    if (!r) continue;
    if (on) el.setAttribute('role', r); else if (el.getAttribute('role') === r) el.removeAttribute('role');
  }
}

export function fitTables(root) {
  if (!root) return;
  for (const table of root.querySelectorAll('table')) {
    if (table.hasAttribute('data-no-stack')) continue;
    const wasStacked = table.classList.contains(STACK);
    if (wasStacked) { table.classList.remove(STACK); setRoles(table, false); }
    const w = scroller(table);
    const overflows = w ? w.scrollWidth > w.clientWidth + 1 : table.getBoundingClientRect().width > root.clientWidth + 1;
    if (overflows) { label(table); table.classList.add(STACK); setRoles(table, true); }
  }
}

export function useFitTables(rootId = 'main-content') {
  useEffect(() => {
    // attached to the document, not to the content area itself: the area may not exist yet when the layout first mounts, and it is looked up on every run
    let timer = 0; // a short debounce timer, not requestAnimationFrame (which is paused while the tab is in the background)
    const run = () => { window.clearTimeout(timer); timer = window.setTimeout(() => fitTables(document.getElementById(rootId)), 40); };
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(run) : null;
    ro?.observe(document.documentElement);
    const mo = new MutationObserver(run); // rows arrive after the data loads, pages change, panels open
    mo.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['hidden'] }); // not other attributes: our own class and label changes must not retrigger it; «hidden» is a tab panel being shown
    window.addEventListener('resize', run);
    document.addEventListener('toggle', run, true); // an opened <details> may reveal a table that has just become visible
    run();
    return () => { window.clearTimeout(timer); ro?.disconnect(); mo.disconnect(); window.removeEventListener('resize', run); document.removeEventListener('toggle', run, true); };
  }, [rootId]);
}
