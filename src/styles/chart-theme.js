// Canvas presentation only: leave datasets, labels, units, callbacks and scales intact.
import { Chart } from 'chart.js';

Chart.register({
  id: 'appTypography',
  beforeUpdate(chart) {
    const style = getComputedStyle(document.body);
    const family = style.fontFamily;
    const color = style.getPropertyValue('--txt-mute').trim();
    const font = (existing) => ({ ...existing, family });
    for (const scale of Object.values(chart.options.scales || {})) {
      if (scale.ticks) { scale.ticks.font = font(scale.ticks.font); scale.ticks.color = color; }
      if (scale.title) { scale.title.font = font(scale.title.font); scale.title.color = color; }
    }
    const labels = chart.options.plugins?.legend?.labels;
    if (labels) { labels.font = font(labels.font); labels.color = color; }
    const tooltip = chart.options.plugins?.tooltip;
    if (tooltip) for (const key of ['titleFont', 'bodyFont', 'footerFont']) tooltip[key] = font(tooltip[key]);
  }
});
