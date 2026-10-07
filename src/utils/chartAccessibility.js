import { translations } from '../data/i18n';

function localText(key) {
  const documentLang = document.documentElement.lang;
  const lang = documentLang === 'ar' ? 'ar' : documentLang.startsWith('zh') ? 'zh' : 'en';
  return translations[lang]?.[key] || translations.en[key];
}

function localFallback() {
  const lang = document.documentElement.lang;
  if (lang === 'ar') return 'مخطط بيانات';
  if (lang === 'zh') return '数据图表';
  return 'Data chart';
}

function readableDataset(dataset, index) {
  const label = dataset.label || `${localText('chart_series')} ${index + 1}`;
  const values = Array.isArray(dataset.data) ? dataset.data.slice(0, 12).join(', ') : '';
  return values ? `${label}: ${values}` : label;
}

/** Adds a deterministic text alternative to every Chart.js canvas, including
 * charts rendered by feature modules that do not pass canvas aria props. */
export const chartAccessibilityPlugin = {
  id: 'intellibillAccessibility',
  afterInit(chart) {
    const configuredTitle = chart.options?.plugins?.title?.text;
    const title = Array.isArray(configuredTitle) ? configuredTitle.join(' ') : configuredTitle;
    const datasetSummary = (chart.data?.datasets || []).map(readableDataset).join('. ');
    const labels = (chart.data?.labels || []).slice(0, 12).join(', ');
    const description = [title || localFallback(), labels ? `${localText('chart_labels')}: ${labels}` : '', datasetSummary]
      .filter(Boolean)
      .join('. ');

    chart.canvas.setAttribute('role', 'img');
    chart.canvas.setAttribute('aria-label', description);
  },
  afterUpdate(chart) {
    this.afterInit(chart);
  }
};
