// Pure helpers for the hierarchy / flow chart kinds (treemap · sunburst · donut · sankey) — see docs/chart-library.md («Hierarchy and flow renderers»).
// No imports: usable by the renderers, by the report builders (which must refuse a non-additive tree / non-reconciled flow) and by the tests.
const num = (v) => typeof v === 'number' && Number.isFinite(v);
const kidsOf = (n) => (n && Array.isArray(n.children) ? n.children : []);

// value of a node: its declared value, else (a parent without one) the sum of its children, else null (= unknown, never zero)
export function nodeValue(n) {
  if (!n || typeof n !== 'object') return null;
  if (num(n.value)) return n.value;
  const k = kidsOf(n); if (!k.length) return null;
  let t = 0; for (const c of k) { const v = nodeValue(c); if (v == null) return null; t += v; }
  return t;
}

// pre-order list of every node (root = index 0). path = labels below the root (root: []), depth = 0 for the root. Indices are stable: they follow the data order.
export function flattenTree(tree) {
  const out = [];
  const walk = (n, path, depth, parent) => {
    const idx = out.length; const label = String(n?.label ?? '');
    const e = { index: idx, node: n, label, key: n?.key != null ? String(n.key) : null, path: depth ? path : [], depth, value: nodeValue(n), parent, children: [], leaf: !kidsOf(n).length };
    out.push(e); if (parent >= 0) out[parent].children.push(idx);
    kidsOf(n).forEach((c) => walk(c, depth ? [...path, String(c?.label ?? '')] : [String(c?.label ?? '')], depth + 1, idx));
    return e;
  };
  if (tree && typeof tree === 'object') walk(tree, [], 0, -1);
  return out;
}
export const treeDepth = (tree) => flattenTree(tree).reduce((m, e) => Math.max(m, e.depth), 0); // levels below the root
export function treeTotal(tree) { const v = nodeValue(tree); return num(v) ? v : 0; }
export const treeLeaves = (tree) => flattenTree(tree).filter((e) => e.leaf);

// null when the tree can be drawn as parts of one whole; else {code, path, expected?, actual?}: 'empty' · 'missing' (a leaf without a value) · 'negative' · 'sum' (a parent ≠ Σ children by more than tol)
export function treeProblem(tree, tol = 0.5) {
  if (!tree || typeof tree !== 'object') return { code: 'empty', path: [] };
  const rows = flattenTree(tree);
  for (const e of rows) {
    if (e.leaf && !num(e.node?.value)) return { code: 'missing', path: e.path };
    if (num(e.node?.value) && e.node.value < 0) return { code: 'negative', path: e.path };
  }
  for (const e of rows) {
    if (e.leaf || !num(e.node?.value)) continue;
    const s = e.children.reduce((t, i) => t + (rows[i].value ?? 0), 0);
    if (Math.abs(s - e.node.value) > tol) return { code: 'sum', path: e.path, expected: s, actual: e.node.value };
  }
  return null;
}
export const treeIsAdditive = (tree, tol = 0.5) => treeProblem(tree, tol) === null;

// a flat single series as a one-level tree. null values are unknown: they are returned in `missing` and not drawn (missing ≠ zero)
export function treeFromSeries(labels, values, title = '') {
  const children = []; const missing = [];
  (labels || []).forEach((l, i) => { const v = values?.[i]; if (num(v)) children.push({ label: String(l), value: v, i }); else missing.push({ label: String(l), i }); });
  return { tree: { label: title, value: children.reduce((t, c) => t + c.value, 0), children }, missing };
}

// ---------- flows ----------
// column of every node: node.col when given, else the longest path from a source; null when the links contain a cycle
export function sankeyColumns(nodes, links) {
  const col = new Map(); const ns = Array.isArray(nodes) ? nodes : [];
  ns.forEach((n) => { if (num(n?.col)) col.set(n.id, n.col); });
  if (col.size === ns.length) return col;
  const ls = (Array.isArray(links) ? links : []).filter((l) => ns.some((n) => n.id === l.from) && ns.some((n) => n.id === l.to));
  const d = new Map(ns.map((n) => [n.id, num(n.col) ? n.col : 0]));
  for (let it = 0; it <= ns.length; it += 1) {
    let ch = false; ls.forEach((l) => { if (!num(ns.find((n) => n.id === l.to)?.col) && d.get(l.to) < d.get(l.from) + 1) { d.set(l.to, d.get(l.from) + 1); ch = true; } });
    if (!ch) return d; if (it === ns.length) return null;
  }
  return d;
}

// null when the flows reconcile; else {code, id?, expected?, actual?}.
// Codes: 'empty' · 'node' (duplicate / missing id) · 'link' (references a missing node, or from = to) · 'missing' (null / non-numeric value) · 'negative' · 'backward' (a link that does not go to a later column) · 'cycle' · 'duplicate' (two links from→to) · 'imbalance' (an intermediate node: inflow ≠ outflow beyond tol)
export function sankeyProblem(nodes, links, tol = 0.5) {
  if (!Array.isArray(nodes) || !Array.isArray(links) || !nodes.length || !links.length) return { code: 'empty' };
  const ids = new Set();
  for (const n of nodes) { if (!n || n.id == null || ids.has(n.id)) return { code: 'node', id: n?.id }; ids.add(n.id); }
  const seen = new Set(); const inn = new Map(); const out = new Map();
  for (const l of links) {
    if (!l || !ids.has(l.from) || !ids.has(l.to) || l.from === l.to) return { code: 'link', id: `${l?.from}>${l?.to}` };
    if (!num(l.value)) return { code: 'missing', id: `${l.from}>${l.to}` };
    if (l.value < 0) return { code: 'negative', id: `${l.from}>${l.to}` };
    const k = `${l.from}>${l.to}`; if (seen.has(k)) return { code: 'duplicate', id: k }; seen.add(k);
    out.set(l.from, (out.get(l.from) || 0) + l.value); inn.set(l.to, (inn.get(l.to) || 0) + l.value);
  }
  const col = sankeyColumns(nodes, links); if (!col) return { code: 'cycle' };
  for (const l of links) if (!(col.get(l.to) > col.get(l.from))) return { code: 'backward', id: `${l.from}>${l.to}` };
  for (const n of nodes) {
    if (!links.some((l) => l.to === n.id) || !links.some((l) => l.from === n.id)) continue; // a source or a sink is free
    const a = inn.get(n.id) || 0; const z = out.get(n.id) || 0;
    if (Math.abs(a - z) > tol) return { code: 'imbalance', id: n.id, expected: a, actual: z };
  }
  return null;
}
export const sankeyReconciles = (nodes, links, tol = 0.5) => sankeyProblem(nodes, links, tol) === null;
