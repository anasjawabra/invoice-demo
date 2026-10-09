// One validation rule for every period control (Dashboard scope bar, Smart-report filter panel, typed requests).
// A range is applied only when it is valid; a range that is partly outside the data is clamped AND the user is told.
import { DATA_START } from './revenueLedger';

const isIso = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s || '') && new Date(`${s}T00:00:00Z`).toISOString().slice(0, 10) === s;

// → { ok:false, code } | { ok:true, from, to, adjusted:[ 'from_clamped' | 'to_clamped' ] }
export function checkRange({ from, to }, { today, start = DATA_START }) {
  if (!isIso(from) || !isIso(to)) return { ok: false, code: 'incomplete' };
  if (from > to) return { ok: false, code: 'inverted' };
  if (from > today) return { ok: false, code: 'future' };
  if (to < start) return { ok: false, code: 'before_data' };
  const adjusted = []; let f = from; let t = to;
  if (t > today) { t = today; adjusted.push('to_clamped'); }
  if (f < start) { f = start; adjusted.push('from_clamped'); }
  return { ok: true, from: f, to: t, adjusted };
}

export function rangeMessage(code, lang, { today, start = DATA_START, planMax = null }) {
  const ar = lang === 'ar';
  const M = {
    incomplete: ['أدخل تاريخ بداية ونهاية صحيحين.', 'Enter a valid start and end date.'],
    inverted: ['تاريخ البداية بعد تاريخ النهاية — صحّح الفترة.', 'The start date is after the end date — correct the period.'],
    future: [`الفترة كلها بعد ${planMax ? 'أبعد نهاية مسموحة' : 'آخر تاريخ للبيانات'} (${today}).`, `The whole period is after the ${planMax ? 'latest allowed end' : 'latest data date'} (${today}).`],
    before_data: [`الفترة كلها قبل بداية البيانات (${start}).`, `The whole period is before the data starts (${start}).`],
    from_clamped: [`البيانات تبدأ من ${start}؛ ضُبط تاريخ البداية.`, `Data starts on ${start}; the start date was adjusted.`],
    to_clamped: planMax ? [`أبعد نهاية مسموحة لفترة الخطة ${planMax}؛ ضُبط تاريخ النهاية.`, `The latest allowed plan end is ${planMax}; the end date was adjusted.`] : [`لا توجد بيانات بعد ${today}؛ ضُبط تاريخ النهاية.`, `There is no data after ${today}; the end date was adjusted.`]
  }[code];
  return M ? M[ar ? 0 : 1] : '';
}
export const coverageLine = (lang, { today, start = DATA_START }) => (lang === 'ar' ? `البيانات متاحة من ${start} حتى ${today}` : `Data is available from ${start} to ${today}`);
