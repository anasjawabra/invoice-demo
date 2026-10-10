// ONE registry of the period presets (EQ7): the scope bar, the Smart-report filter panel, the stored scope and the report labels all read it.
// Every preset is defined by a function of today (Asia/Riyadh), so the meaning is the same everywhere and testable.
import { startOfMonth, startOfYear, prevMonthEnd, lastCompleteMonths } from './clock';
import { DATA_START } from './revenueLedger';

const startOfQuarter = (t) => { const m = Number(t.slice(5, 7)); const q0 = Math.floor((m - 1) / 3) * 3 + 1; return `${t.slice(0, 4)}-${String(q0).padStart(2, '0')}-01`; };
export const PRESETS = [
  { key: 'today', ar: 'اليوم', en: 'Today', range: (t) => ({ from: t, to: t }) },
  { key: 'month', ar: 'هذا الشهر حتى اليوم', en: 'Month to date', range: (t) => ({ from: startOfMonth(t), to: t }) },
  { key: 'lastMonth', ar: 'الشهر الماضي', en: 'Last month', range: (t) => { const e = prevMonthEnd(t); return { from: startOfMonth(e), to: e }; } },
  { key: 'last3', ar: 'آخر 3 أشهر مكتملة', en: 'Last 3 complete months', range: (t) => lastCompleteMonths(t, 3) },
  { key: 'qtd', ar: 'الربع الحالي حتى اليوم', en: 'Quarter to date', range: (t) => ({ from: startOfQuarter(t), to: t }) },
  { key: 'ytd', ar: 'السنة حتى اليوم', en: 'Year to date', range: (t) => ({ from: startOfYear(t), to: t }) },
  { key: 'all', ar: 'كل البيانات', en: 'All data', range: (t) => ({ from: DATA_START, to: t }) }
];
export const presetRange = (key, today) => PRESETS.find((p) => p.key === key)?.range(today) || null;
export const presetLabel = (key, lang) => { const p = PRESETS.find((x) => x.key === key); return p ? (lang === 'ar' ? p.ar : p.en) : null; };
// which preset a range is (the first that matches), or 'custom'
export const detectPreset = (from, to, today) => PRESETS.find((p) => { const r = p.range(today); return r.from === from && r.to === to; })?.key || 'custom';
