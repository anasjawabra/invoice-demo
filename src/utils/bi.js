import { useI18n } from '../context/I18nContext';
import { localize, localizedObject } from './zh';
import { fmtMoney, fmtSar, fmtInt, fmtInvoices, fmtParts, unitLabel, unitOfValues, chartUnit } from './money';

// Inline bilingual helper for revenue-intelligence screens. English and Arabic
// and Chinese share the same semantic keys and display-only translation catalog.
export function useL() {
  const { lang, isRtl, t, T } = useI18n();
  const ar = lang === 'ar';
  const L = (en, arText) => (ar ? arText : localize(en, lang));
  const B = (o) => localizedObject(o, lang);
  // ONE appropriate unit per amount (SAR · ألف · مليون · مليار), or ONE shared unit for a whole table/chart (pass `unit`). Stored values stay in SAR.
  const money = (n, unit = 'auto') => fmtMoney(n, { lang, unit });
  const short = money;
  const detail = (n) => fmtMoney(n, { lang, mode: 'detail' }); // exact conversion (tooltips / detail panes)
  const sar = (n) => fmtSar(n, lang); // full SAR: invoice / evidence tables and exports
  const num = (n, unit = 'auto') => fmtMoney(n, { lang, unit, withUnit: false }); // number only, for a column/axis whose title carries the unit
  const parts = (n, unit = 'auto') => fmtParts(n, { lang, unit });
  const unitFor = (values) => unitOfValues(values);
  const uLabel = (unit) => unitLabel(unit, lang);
  const cu = (values) => chartUnit(values, lang);
  const count = (n) => fmtInt(n);
  const invoices = (n, opts) => fmtInvoices(n, { lang, ...opts });
  return { lang, isRtl, ar, t, T, L, B, money, short, detail, sar, num, parts, unitFor, uLabel, cu, count, invoices };
}

export const NC = { en: 'Not available', ar: 'غير متاحة', zh: '暂无数据' };

export function ratioText(r, ar = false, digits = 1) {
  if (!r || !r.calculable) return ar === 'zh' ? NC.zh : ar === true || ar === 'ar' ? NC.ar : NC.en;
  return `${(r.value * 100).toFixed(digits)}%`;
}
