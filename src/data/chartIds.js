// Stable chart ids inside one report model: `<sectionKey|headline>:<n>` (n = the chart's position among that section's charts). The ids key the saved per-chart presentation config
// (`view.charts[id]`, docs/chart-library.md), so they must not depend on the language or on a title. Pure: returns a model whose chart blocks all carry an `id`; blocks that already have one keep it.
export function assignChartIds(model) {
  if (!model) return model;
  const tag = (blocks, key) => { let n = 0; return blocks.map((b) => (b && b.type === 'chart' ? { ...b, id: b.id || `${key}:${n++}` } : b)); };
  return { ...model, headline: tag(model.headline || [], 'headline'), sections: (model.sections || []).map((s) => ({ ...s, blocks: tag(s.blocks || [], s.key || 'section') })) };
}
export const chartBlocks = (model) => (model ? [...(model.headline || []), ...(model.sections || []).flatMap((s) => s.blocks || [])].filter((b) => b && b.type === 'chart') : []);
