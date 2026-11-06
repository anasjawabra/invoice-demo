// Period phrases the base parser (assistantRouter.parsePeriod) does not read, so that a typed period is applied COMPLETELY or asked about — never half-read:
//   · «last quarter / previous quarter / الربع الماضي»  → the previous complete calendar quarter
//   · «from January to March (2026)», «بين يناير ومارس», «Jan–Mar», «Q1 to Q3 2026», «من الربع الأول إلى الثالث»  → one range
//   · «2025 to 2026», «من 2025 إلى 2026»  → one range of years (clamped to the data cutoff);  two unrelated years → asked
//   · impossible periods («Q5», «الربع الخامس», «شهر 13», «31 فبراير») → a targeted question, not a silent fallback to the whole year
//   · Levant month names («آذار», «كانون الثاني», «تشرين الأول») → the usual month names
// All functions work on the NORMALISED text (textNorm.normText) except canonMonths, which also accepts the cleaned raw text.
// parseExtraPeriod(s, today) → null | { period:{from,to,label,naturalEnd?,notStarted?} } | { problem:{ ar, en } }
import { addDaysIso } from './clock';
import { DATA_START } from './revenueLedger';

const MONTHS = [['يناير', 'january', 'jan'], ['فبراير', 'february', 'feb'], ['مارس', 'march', 'mar'], ['ابريل', 'april', 'apr'], ['مايو', 'may'], ['يونيو', 'june', 'jun'], ['يوليو', 'july', 'jul'], ['اغسطس', 'august', 'aug'], ['سبتمبر', 'september', 'sept', 'sep'], ['اكتوبر', 'october', 'oct'], ['نوفمبر', 'november', 'nov'], ['ديسمبر', 'december', 'dec']];
const MON_ALT = MONTHS.flat().sort((a, b) => b.length - a.length).join('|');
const monthNo = (w) => MONTHS.findIndex((m) => m.includes(w)) + 1;
const NB = '(?![a-z\\u0621-\\u064A])'; // a month name ends the word
const lastDayOf = (y, m) => new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
const pad = (m) => String(m).padStart(2, '0');
const quarterNo = (w) => ({ اول: 1, ثاني: 2, ثالث: 3, رابع: 4, first: 1, second: 2, third: 3, fourth: 4 })[w] || Number(w) || 0;

// Levant / alternative spellings → the usual Arabic month names (hamza-tolerant, works on cleaned raw or normalised text)
const LEVANT = [[/كانون\s+(?:ال)?[ثت]اني/g, 'يناير'], [/شباط/g, 'فبراير'], [/[أإآا]ذار/g, 'مارس'], [/نيسان/g, 'ابريل'], [/[أإآا]يار/g, 'مايو'], [/حزيران/g, 'يونيو'], [/تموز/g, 'يوليو'], [/[أإآا]يلول/g, 'سبتمبر'], [/تشرين\s+(?:ال)?[أإآا]ول/g, 'اكتوبر'], [/تشرين\s+(?:ال)?[ثت]اني/g, 'نوفمبر'], [/كانون\s+(?:ال)?[أإآا]ول/g, 'ديسمبر'],
  [/(?<![ء-ي])يون[يئ][هة](?![ء-ي])/g, 'يونيو'], [/(?<![ء-ي])يولي[هة](?![ء-ي])/g, 'يوليو'], [/(?<![ء-ي])ماي(?![ء-ي])/g, 'مايو'], [/(?<![ء-ي])ين[ائ]ير(?![ء-ي])/g, 'يناير']];
export const canonMonths = (t) => LEVANT.reduce((s, [re, to]) => s.replace(re, to), String(t ?? ''));

const THISQ = (today) => { const m = Number(today.slice(5, 7)); const q0 = Math.floor((m - 1) / 3) * 3 + 1; return { y: Number(today.slice(0, 4)), q0 }; };
const bad = (ar, en, options) => ({ problem: { ar, en, ...(options ? { options } : {}) } });
const quarterOptions = (y) => [1, 2, 3, 4].map((q) => ({ label: { ar: `الربع ${['الأول', 'الثاني', 'الثالث', 'الرابع'][q - 1]} ${y}`, en: `Q${q} ${y}` }, text: `أنشئ تقرير الإيرادات للربع ${['الأول', 'الثاني', 'الثالث', 'الرابع'][q - 1]} ${y}` }));

export function parseExtraPeriod(s, today) {
  const curY = Number(today.slice(0, 4)); const curM = Number(today.slice(5, 7));
  // ---- periods that do not exist
  const badQ = s.match(/\bq([05-9])\b/) || s.match(/(?:ال)?ربع\s+(?:ال)?(خامس|سادس|سابع|ثامن|تاسع|عاشر)/) || s.match(/\b(?:quarter|qtr)\s*([05-9])\b/);
  if (badQ) return bad('السنة فيها أربعة أرباع فقط (الربع الأول إلى الرابع). أي ربع تريد؟', 'A year has four quarters only (Q1 to Q4). Which quarter do you want?', quarterOptions(curY));
  const nm = s.match(/(?:^|\s)(?:ل|ب|ال)?(?:شهر|month)\s*(\d{1,2})(?!\d)/); if (nm && (Number(nm[1]) < 1 || Number(nm[1]) > 12)) return bad(`لا يوجد شهر رقم ${nm[1]}: الأشهر من 1 إلى 12. أي شهر تريد؟`, `There is no month number ${nm[1]}: months run from 1 to 12. Which month do you want?`);
  const dm = s.match(new RegExp(`(?:^|\\s)(\\d{1,2})\\s+(${MON_ALT})${NB}(?:\\s+(20\\d{2}))?`));
  if (dm) { const mo = monthNo(dm[2]); const y = dm[3] ? Number(dm[3]) : curY; const d = Number(dm[1]); if (d < 1 || d > Number(lastDayOf(y, mo).slice(8, 10))) return bad(`التاريخ ${dm[1]} ${dm[2]} غير موجود في التقويم. أي تاريخ أو فترة تريد؟`, `${dm[1]} ${dm[2]} is not a date in the calendar. Which date or period do you want?`); }

  // ---- a single ISO date / year-month («2026-03-15», «2026-03»): that day / month — never widened to the whole year
  const one = s.match(/(?:^|\s)(20\d{2})-(\d{2})-(\d{2})(?=\s|$)/);
  if (one && !/(?:^|\s)20\d{2}-\d{2}-\d{2}\s*(?:→|الي|to|-|–)\s*20\d{2}-\d{2}-\d{2}/.test(s)) {
    const d = one[0].trim(); const mo = Number(one[2]); if (mo < 1 || mo > 12 || Number(one[3]) < 1 || Number(one[3]) > Number(lastDayOf(Number(one[1]), mo).slice(8, 10))) return bad(`التاريخ ${d} غير موجود في التقويم. أي تاريخ أو فترة تريد؟`, `${d} is not a date in the calendar. Which date or period do you want?`);
    if (d < DATA_START) return { period: { from: d, to: d, label: 'day', beforeData: true } };
    return d > today ? { period: { from: d, to: d, label: 'day', notStarted: true } } : { period: { from: d, to: d, label: 'day' } };
  }
  const ym = s.match(/(?:^|\s)(20\d{2})-(0[1-9]|1[0-2])(?=\s|$)/);
  if (ym) { const y = Number(ym[1]); const mo = Number(ym[2]); const from = `${y}-${ym[2]}-01`; const end = lastDayOf(y, mo); if (end < DATA_START) return { period: { from, to: end, label: 'month', beforeData: true } }; return from > today ? { period: { from, to: end, label: 'month', notStarted: true } } : { period: { from, to: end > today ? today : end, label: `m${mo}`, naturalEnd: end } }; }
  // ---- a range of months: «من يناير إلى مارس 2026», «بين يناير ومارس», «January to March», «Jan-Mar»
  const mr = s.match(new RegExp(`(?:^|\\s)(?:من\\s+|from\\s+)?(?:شهر\\s+)?[بلف]?(${MON_ALT})${NB}(?:\\s+(?:الي|حتي|to|through|thru|until|till)\\s+|\\s*[-–—]\\s*)(?:شهر\\s+)?[بلف]?(${MON_ALT})${NB}`))
    || s.match(new RegExp(`(?:^|\\s)(?:بين|between)\\s+(?:شهر\\s+)?[بلف]?(${MON_ALT})${NB}\\s+(?:and\\s+)?(?:شهر\\s+)?[بلفو]?(${MON_ALT})${NB}`));
  if (mr) {
    const m1 = monthNo(mr[1]); const m2 = monthNo(mr[2]); const yrs = [...new Set((s.match(/\b(20\d{2})\b/g) || []))];
    if (yrs.length > 1) return bad('ذكرتَ أكثر من سنة مع نطاق الأشهر. حدّد سنة واحدة للنطاق (مثلاً «من يناير إلى مارس 2026»).', 'You named more than one year with the month range. Give one year (for example “January to March 2026”).');
    const explicit = yrs.length === 1; let y = explicit ? Number(yrs[0]) : curY;
    if (m2 < m1) return bad('النطاق يعبر نهاية السنة (من شهر لاحق إلى شهر أبكر). اذكر بداية النطاق ونهايته بالتاريخ الكامل، مثلاً «2025-11-01 إلى 2026-02-28».', 'The range crosses the year end (a later month to an earlier month). Give the start and end as full dates, for example “2025-11-01 to 2026-02-28”.');
    if (!explicit && `${y}-${pad(m1)}-01` > today) y -= 1; // «من نوفمبر إلى ديسمبر» in October means the last such months
    const from = `${y}-${pad(m1)}-01`; const end = lastDayOf(y, m2);
    if (from < DATA_START) return { period: { from, to: end, label: 'range', beforeData: true } };
    if (from > today) return { period: { from, to: end, label: 'range', notStarted: true } };
    return { period: { from, to: end > today ? today : end, label: 'range', naturalEnd: end, yearAssumed: !explicit } };
  }
  // ---- a range of quarters: «Q1 to Q3 2026», «من الربع الأول إلى الربع الثالث»
  const qr = s.match(/\bq([1-4])\s*(?:to|through|thru|until|-|–|—|الي|حتي)\s*q([1-4])\b/) || s.match(/(?:ال)?ربع\s+(?:ال)?(اول|ثاني|ثالث|رابع)\s+(?:الي|حتي)\s+(?:ال)?ربع\s+(?:ال)?(اول|ثاني|ثالث|رابع)/) || s.match(/\b(first|second|third|fourth)\s+quarter\s+(?:to|through|until)\s+(?:the\s+)?(first|second|third|fourth)\s+quarter\b/);
  if (qr) {
    const q1 = quarterNo(qr[1]); const q2 = quarterNo(qr[2]); const yrs = [...new Set((s.match(/\b(20\d{2})\b/g) || []))];
    if (yrs.length > 1) return bad('ذكرتَ أكثر من سنة مع نطاق الأرباع. حدّد سنة واحدة.', 'You named more than one year with the quarter range. Give one year.');
    if (q2 < q1) return bad('نطاق الأرباع يبدأ بربع لاحق على نهايته. اذكر الربع الأبكر أولاً.', 'The quarter range starts with a later quarter than it ends with. Name the earlier quarter first.');
    const y = yrs.length ? Number(yrs[0]) : curY; const from = `${y}-${pad((q1 - 1) * 3 + 1)}-01`; const end = lastDayOf(y, q2 * 3);
    if (from > today) return { period: { from, to: end, label: 'range', notStarted: true } };
    return { period: { from, to: end > today ? today : end, label: 'range', naturalEnd: end } };
  }
  // ---- two different years: a range («من 2025 إلى 2026», «2025-2026») or two periods in one request
  const sNoIso = s.replace(/\b20\d{2}-\d{2}-\d{2}\b/g, ' ');
  const years = [...new Set((sNoIso.match(/\b(20\d{2})\b/g) || []))].map(Number);
  if (years.length >= 2) {
    const yr = sNoIso.match(/\b(20\d{2})\s*(?:to|through|until|-|–|—|الي|حتي|و)\s*(20\d{2})\b/) || sNoIso.match(/(?:between|بين)\s+(20\d{2})\s+(?:and|و)\s+(20\d{2})\b/);
    if (yr) {
      const y1 = Number(yr[1]); const y2 = Number(yr[2]); if (y2 < y1) return bad('نطاق السنوات يبدأ بسنة لاحقة. اذكر السنة الأبكر أولاً.', 'The year range starts with the later year. Name the earlier year first.');
      const from = `${y1}-01-01` < DATA_START ? DATA_START : `${y1}-01-01`; const end = `${y2}-12-31`;
      if (`${y1}-01-01` > today) return { period: { from: `${y1}-01-01`, to: end, label: 'range', notStarted: true } };
      return { period: { from, to: end > today ? today : end, label: 'range', naturalEnd: end } };
    }
    const ys = years.slice().sort(); const lo = ys[0]; const hi = ys[ys.length - 1];
    return bad('ذكرتَ أكثر من سنة في طلب واحد. أي سنة أو نطاق سنوات تريد؟ (مثلاً «2026» أو «من 2025 إلى 2026»)', 'You named more than one year in one request. Which year or range of years do you want? (for example “2026” or “2025 to 2026”)',
      [...ys.map((y) => ({ label: { ar: `عام ${y}`, en: `Year ${y}` }, text: `أنشئ تقرير الإيرادات لعام ${y}` })), { label: { ar: `من ${lo} إلى ${hi}`, en: `${lo} to ${hi}` }, text: `أنشئ تقرير الإيرادات من ${lo} إلى ${hi}` }]);
  }
  // ---- last / previous quarter = the previous COMPLETE calendar quarter
  if (/(?:^|\s)(?:last|previous|prior|past)\s+quarter\b|(?:ال)?ربع\s+(?:ال)?(?:ماضي|سابق)|(?:ال)?ربع\s+(?:اللي|الذي)\s+(?:فات|مضي)/.test(s)) {
    const { y, q0 } = THISQ(today); const py = q0 === 1 ? y - 1 : y; const pq0 = q0 === 1 ? 10 : q0 - 3; const from = `${py}-${pad(pq0)}-01`;
    return { period: { from, to: lastDayOf(py, pq0 + 2), label: 'lastQuarter' } };
  }
  return null;
}

// does the period end at the data cutoff although its natural end lies later («2026» ends at today, not 31 Dec)? → the later natural end, else null
export function naturalEndOf(per, today, text = '') {
  if (!per || per.to !== today) return null;
  const y = Number(per.from.slice(0, 4)); let end = per.naturalEnd || null; const l = per.label || '';
  if (!end) {
    if (l === 'year' || l === 'ytd') end = `${today.slice(0, 4)}-12-31`;
    else if (/^m\d+$/.test(l)) end = lastDayOf(y, Number(l.slice(1)));
    else if (/^q[1-4]$/.test(l)) end = lastDayOf(y, Number(l.slice(1)) * 3);
  }
  if (!end || end <= today) return null;
  if (/\b(?:to date|so far|ytd|mtd|qtd)\b|حتي اليوم|حتي الان|حتي تاريخه/.test(text) && (l === 'ytd')) return null; // «year to date» already says it
  return end;
}
export { addDaysIso };
