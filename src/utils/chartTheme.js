const DGA_CHART_HEX = Object.freeze({
  primary: '#1B8354',
  info: '#0A6FA6',
  success: '#3E8540',
  warning: '#C79A2A',
  danger: '#C4514C',
  orange: '#9A5C00',
  purple: '#6B57A6',
  teal: '#3D8B8B',
  brown: '#8B5A3C',
  neutral: '#8B93A1',
  charcoal: '#5A5A5A'
});

export function chartColor(name, alpha = 1) {
  const hex = DGA_CHART_HEX[name] || DGA_CHART_HEX.primary;
  if (alpha >= 1) return hex;
  const value = Number.parseInt(hex.slice(1), 16);
  const red = (value >> 16) & 255;
  const green = (value >> 8) & 255;
  const blue = value & 255;
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

export const chartSeries = Object.freeze([
  chartColor('primary'),
  chartColor('info'),
  chartColor('warning'),
  chartColor('purple'),
  chartColor('danger'),
  chartColor('teal'),
  chartColor('brown'),
  chartColor('charcoal')
]);

export function getChartTheme(theme) {
  const dark = theme === 'dark';

  return {
    text: dark ? '#A7C1B4' : '#667085',
    heading: dark ? '#F0F7F3' : '#101828',
    grid: dark ? 'rgba(215, 236, 225, 0.12)' : 'rgba(16, 24, 40, 0.08)',
    tooltip: {
      backgroundColor: dark ? '#16241C' : '#FFFFFF',
      titleColor: dark ? '#F0F7F3' : '#101828',
      bodyColor: dark ? '#D7ECE1' : '#344054',
      borderColor: dark ? '#3B5A4A' : '#D0D5DD',
      borderWidth: 1,
      padding: 10,
      cornerRadius: 8,
      displayColors: true
    }
  };
}

export function chartLegend(theme, overrides = {}) {
  const colors = getChartTheme(theme);
  const { labels = {}, ...rest } = overrides;
  return {
    ...rest,
    labels: {
      color: colors.text,
      boxWidth: 10,
      usePointStyle: true,
      pointStyle: 'circle',
      padding: 14,
      ...labels
    }
  };
}

export function chartTooltip(theme, isRtl, overrides = {}) {
  const colors = getChartTheme(theme);
  return {
    ...colors.tooltip,
    rtl: isRtl,
    textDirection: isRtl ? 'rtl' : 'ltr',
    ...overrides
  };
}
