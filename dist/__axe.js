export default async function run() {
  await new Promise((r) => setTimeout(r, 4500));
  if (!window.axe) await new Promise((res, rej) => { const s = document.createElement('script'); s.src = '/node_modules/axe-core/axe.min.js'; s.onload = res; s.onerror = rej; document.head.appendChild(s); });
  const r = await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'] }, resultTypes: ['violations'] });
  return JSON.stringify({ path: location.pathname + location.search, violations: r.violations.map((v) => ({ id: v.id, impact: v.impact, n: v.nodes.length, ex: (v.nodes[0]?.target || []).join(' ').slice(0, 70) })) });
}
