// ILLUSTRATIVE appropriation and expenditure figures for the Strategic Dashboard — invented for this demo, NOT Ministry figures.
// The STRUCTURE follows the Ministry of Finance monthly financial-performance workbook for the Ministry and the Amanahs, restricted to chapters 1–3 (chapter 4 is out of scope):
//   • «الاعتماد مقابل الإيراد» (revenue appropriation): the amount the entity is expected to COLLECT during the fiscal year — original, and after adjustment (the one used for planning);
//   • the expenditure appropriation of chapters 1–3 (original / after adjustment) and the CUMULATIVE amount spent, as recorded by the Ministry of Finance up to the last closed month.
// Amounts are in millions of riyals here and converted to riyals by `appropriationOf`. When the real workbook is loaded, only this table is replaced.
export const APPROPRIATION_YEAR = 2026;
export const APPROPRIATION_AS_OF = '2026-08'; // the last month closed by the Ministry of Finance (it lags the invoice data)
// the last day of that closed month — the date up to which collection is compared with spending (like for like)
export const appropriationAsOfEnd = () => { const [y, m] = APPROPRIATION_AS_OF.split('-').map(Number); return `${APPROPRIATION_AS_OF}-${String(new Date(Date.UTC(y, m, 0)).getUTCDate()).padStart(2, '0')}`; };
export const HQ_KEY = '__HQ__';          // the Ministry headquarters: expenditure only, it collects no revenue of its own
const M = 1e6;
const TABLE = {
  'Riyadh Amanah':           { revOriginal:  2065, revAdjusted:  2150, expOriginal:  4290, expAdjusted:  5010, expSpent:  3870 },
  'Jeddah Amanah':           { revOriginal:  2480, revAdjusted:  2480, expOriginal:  5065, expAdjusted:  5240, expSpent:  4365 },
  'Eastern Province Amanah': { revOriginal:   500, revAdjusted:   540, expOriginal:  1100, expAdjusted:  1280, expSpent:  1010 },
  'Makkah Amanah':           { revOriginal:  1295, revAdjusted:  1310, expOriginal:  3025, expAdjusted:  3760, expSpent:  2340 },
  'Al Madinah Amanah':       { revOriginal:   715, revAdjusted:   760, expOriginal:  1910, expAdjusted:  2125, expSpent:  1425 },
  'Asir Amanah':             { revOriginal:   750, revAdjusted:   835, expOriginal:  1810, expAdjusted:  2190, expSpent:  1795 },
  'Taif Amanah':             { revOriginal:   280, revAdjusted:   295, expOriginal:   710, expAdjusted:   735, expSpent:   545 },
  'Al-Qassim Amanah':        { revOriginal:   240, revAdjusted:   245, expOriginal:   535, expAdjusted:   615, expSpent:   435 },
  'Al-Ahsa Amanah':          { revOriginal:   105, revAdjusted:   105, expOriginal:   210, expAdjusted:   225, expSpent:   175 },
  'Jazan Amanah':            { revOriginal:   370, revAdjusted:   385, expOriginal:   695, expAdjusted:   815, expSpent:   670 },
  'Tabuk Amanah':            { revOriginal:   315, revAdjusted:   330, expOriginal:   650, expAdjusted:   810, expSpent:   660 },
  "Ha'il Amanah":            { revOriginal:    55, revAdjusted:    60, expOriginal:   130, expAdjusted:   150, expSpent:   100 },
  'Northern Borders Amanah': { revOriginal:   435, revAdjusted:   475, expOriginal:   850, expAdjusted:  1005, expSpent:   805 },
  'Najran Amanah':           { revOriginal:    65, revAdjusted:    70, expOriginal:   165, expAdjusted:   185, expSpent:   150 },
  'Al Bahah Amanah':         { revOriginal:    80, revAdjusted:    85, expOriginal:   160, expAdjusted:   200, expSpent:   145 },
  'Al Jawf Amanah':          { revOriginal:   150, revAdjusted:   160, expOriginal:   435, expAdjusted:   490, expSpent:   375 },
  'Housing Sector':          { revOriginal:  1075, revAdjusted:  1120, expOriginal:  2515, expAdjusted:  2820, expSpent:  1995 },
  'Hafr Al-Batin Amanah':    { revOriginal:    90, revAdjusted:    90, expOriginal:   160, expAdjusted:   190, expSpent:   150 },
  '__HQ__':                  { revOriginal:     0, revAdjusted:     0, expOriginal:  4420, expAdjusted:  4860, expSpent:  3010 },
};
export const appropriationOf = (key, year = APPROPRIATION_YEAR) => {
  const t = year === APPROPRIATION_YEAR ? TABLE[key] : null;
  return t ? { revOriginal: t.revOriginal * M, revAdjusted: t.revAdjusted * M, expOriginal: t.expOriginal * M, expAdjusted: t.expAdjusted * M, expSpent: t.expSpent * M } : null;
};
export const appropriationKeys = () => Object.keys(TABLE);
// Ministry total over the entities that are shown (all of them by default)
export function appropriationTotal(keys = appropriationKeys(), year = APPROPRIATION_YEAR) {
  const t = { revOriginal: 0, revAdjusted: 0, expOriginal: 0, expAdjusted: 0, expSpent: 0 }; let any = false;
  for (const k of keys) { const a = appropriationOf(k, year); if (a) { any = true; for (const f of Object.keys(t)) t[f] += a[f]; } }
  return any ? t : null;
}
