import { Chart } from 'chart.js';
import { toFont } from 'chart.js/helpers';

const originalColors = new WeakMap();
const tooltipPresentations = new WeakMap();

// Canvas tooltips cannot use CSS wrapping. Reflow their existing text without
// changing callback arguments, labels, units, values, or the chart dimensions.
function fitTooltipText(chart, value, fontPart) {
  if (Array.isArray(value)) return value.flatMap((line) => fitTooltipText(chart, line, fontPart));
  if (typeof value !== 'string' || !value) return value;
  const options = chart.options.plugins.tooltip;
  const colorBox = options.displayColors ? options.boxWidth + 2 + options.boxPadding : 0;
  const available = Math.max(24, chart.width - options.padding * 2 - colorBox - 8);
  const ctx = chart.ctx;
  const lines = [];
  ctx.save();
  try {
    ctx.font = toFont(options[fontPart]).string;
    for (const text of value.split('\n')) {
      let line = '';
      for (const token of text.match(/\s+|\S+/gu) || ['']) {
        if (line && ctx.measureText(line + token).width > available) { lines.push(line); line = ''; }
        if (ctx.measureText(token).width <= available) { line += token; continue; }
        const pieces = typeof Intl.Segmenter === 'function'
          ? Array.from(new Intl.Segmenter(document.documentElement.lang || 'en', { granularity: 'grapheme' }).segment(token), (part) => part.segment)
          : Array.from(token);
        for (const piece of pieces) {
          if (line && ctx.measureText(line + piece).width > available) { lines.push(line); line = ''; }
          line += piece;
        }
      }
      lines.push(line);
    }
  } finally { ctx.restore(); }
  return lines.length === 1 ? lines[0] : lines;
}

function tooltipPresentation(callback, chart, fontPart) {
  if (typeof callback !== 'function') return callback;
  const previous = tooltipPresentations.get(callback);
  if (previous?.chart === chart && previous.fontPart === fontPart) return callback;
  const original = previous?.original || callback;
  const wrapped = function (...args) { return fitTooltipText(chart, original.apply(this, args), fontPart); };
  tooltipPresentations.set(wrapped, { original, chart, fontPart });
  return wrapped;
}

const darkColor = (value) => {
  if (Array.isArray(value)) return value.map(darkColor);
  if (typeof value !== 'string') return value;
  if (/^(#1b8354|rgba?\(\s*27,\s*131,\s*84)/i.test(value)) return '#75E0A7';
  if (/^(#194185|rgba?\(\s*25,\s*65,\s*133)/i.test(value)) return '#84CAFF';
  if (/^(#b54708|rgba?\(\s*181,\s*71,\s*8)/i.test(value)) return '#FEC84B';
  if (/^(#b42318|rgba?\(\s*180,\s*35,\s*24)/i.test(value)) return '#FDA29B';
  return value;
};

Chart.register({
  id: 'pdfPresentation',
  beforeUpdate(chart) {
    const style = getComputedStyle(document.body);
    const text = style.getPropertyValue('--txt-mute').trim();
    const family = style.fontFamily;
    const dark = document.documentElement.dataset.theme === 'dark';
    const grid = dark ? 'rgba(255,255,255,0.12)' : 'rgba(17,25,39,0.10)';
    for (const scale of Object.values(chart.options.scales || {})) {
      scale.grid.color = grid;
      scale.ticks.color = text;
      scale.ticks.font = { family, size: Math.max(12, scale.ticks.font?.size || 12) };
      scale.title.color = text;
      scale.title.font = { family, size: 12 };
    }
    const legend = chart.options.plugins?.legend;
    if (legend?.labels) { legend.labels.color = text; legend.labels.font = { family, size: 12 }; }
    const tooltip = chart.options.plugins?.tooltip;
    if (tooltip) {
      for (const part of ['titleFont', 'bodyFont', 'footerFont']) {
        const font = tooltip[part];
        tooltip[part] = {
          family,
          size: Math.max(12, font?.size || 12),
          weight: font?.weight,
          style: font?.style,
          lineHeight: font?.lineHeight
        };
      }
      tooltip.padding = 8;
      for (const [part, names] of [
        ['titleFont', ['beforeTitle', 'title', 'afterTitle']],
        ['bodyFont', ['beforeBody', 'beforeLabel', 'label', 'afterLabel', 'afterBody']],
        ['footerFont', ['beforeFooter', 'footer', 'afterFooter']]
      ]) {
        for (const name of names) tooltip.callbacks[name] = tooltipPresentation(tooltip.callbacks[name], chart, part);
      }
    }
    for (const dataset of chart.data.datasets) {
      const cached = originalColors.get(dataset) || {};
      for (const key of ['borderColor', 'backgroundColor']) {
        if (!cached[key] || dataset[key] !== cached[key].rendered) cached[key] = { original: dataset[key] };
        const rendered = dark ? darkColor(cached[key].original) : cached[key].original;
        dataset[key] = rendered;
        cached[key].rendered = rendered;
      }
      originalColors.set(dataset, cached);
    }
  },
  afterUpdate(chart) {
    const parent = chart.canvas.closest('[role="img"]');
    const target = parent || chart.canvas;
    if (!parent) target.setAttribute('role', 'img');
    if (!target.getAttribute('aria-label')) target.setAttribute('aria-label', chart.data.datasets.map((d) => d.label).filter(Boolean).join(' · ') || (document.documentElement.lang === 'ar' ? 'مخطط البيانات' : 'Data chart'));
  }
});

const redraw = () => Object.values(Chart.instances).forEach((chart) => chart.update('none'));
new MutationObserver(redraw).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'lang'] });

const redrawForFonts = () => Object.values(Chart.instances).forEach((chart) => {
  // Chart.js keys measured widths by the CSS font string, which is unchanged
  // when a web font replaces its fallback. Discard only those text measurements.
  for (const scale of Object.values(chart.scales)) scale._longestTextCache = {};
  chart.update('none');
});
document.fonts?.addEventListener('loadingdone', redrawForFonts);
document.fonts?.ready.then(redrawForFonts);
