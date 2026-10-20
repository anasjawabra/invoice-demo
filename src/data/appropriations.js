// ILLUSTRATIVE appropriation and budget figures for the Strategic Dashboard — invented for this demo, NOT Ministry figures.
// The STRUCTURE follows the Ministry of Finance monthly financial-performance workbook for the Ministry and the Amanahs, restricted to chapters 1–3 (chapter 4 is out of scope):
//   • «الاعتماد مقابل الإيراد» (revenue appropriation): the amount the entity is expected to COLLECT during the fiscal year — original, and after adjustment (the one used for planning);
//   • the BUDGET communicated for chapters 1–3 (original / after adjustment), kept under the names expOriginal / expAdjusted: a fixed annual figure announced by the Ministry of Finance (D38). No spending is held here — spending belongs to the Financial Copilot.
// Amounts are in millions of riyals here and converted to riyals by `appropriationOf`. When the real workbook is loaded, only this table is replaced.
export const APPROPRIATION_YEAR = 2026;
export const HQ_KEY = '__HQ__';          // the Ministry headquarters: expenditure only, it collects no revenue of its own
const M = 1e6;
const TABLE = {
  'Riyadh Amanah':           { revOriginal:  2065, revAdjusted:  2150, expOriginal:  4290, expAdjusted:  5010 },
  'Jeddah Amanah':           { revOriginal:  2480, revAdjusted:  2480, expOriginal:  5065, expAdjusted:  5240 },
  'Eastern Province Amanah': { revOriginal:   500, revAdjusted:   540, expOriginal:  1100, expAdjusted:  1280 },
  'Makkah Amanah':           { revOriginal:  1295, revAdjusted:  1310, expOriginal:  3025, expAdjusted:  3760 },
  'Al Madinah Amanah':       { revOriginal:   715, revAdjusted:   760, expOriginal:  1910, expAdjusted:  2125 },
  'Asir Amanah':             { revOriginal:   750, revAdjusted:   835, expOriginal:  1810, expAdjusted:  2190 },
  'Taif Amanah':             { revOriginal:   280, revAdjusted:   295, expOriginal:   710, expAdjusted:   735 },
  'Al-Qassim Amanah':        { revOriginal:   240, revAdjusted:   245, expOriginal:   535, expAdjusted:   615 },
  'Al-Ahsa Amanah':          { revOriginal:   105, revAdjusted:   105, expOriginal:   210, expAdjusted:   225 },
  'Jazan Amanah':            { revOriginal:   370, revAdjusted:   385, expOriginal:   695, expAdjusted:   815 },
  'Tabuk Amanah':            { revOriginal:   315, revAdjusted:   330, expOriginal:   650, expAdjusted:   810 },
  "Ha'il Amanah":            { revOriginal:    55, revAdjusted:    60, expOriginal:   130, expAdjusted:   150 },
  'Northern Borders Amanah': { revOriginal:   435, revAdjusted:   475, expOriginal:   850, expAdjusted:  1005 },
  'Najran Amanah':           { revOriginal:    65, revAdjusted:    70, expOriginal:   165, expAdjusted:   185 },
  'Al Bahah Amanah':         { revOriginal:    80, revAdjusted:    85, expOriginal:   160, expAdjusted:   200 },
  'Al Jawf Amanah':          { revOriginal:   150, revAdjusted:   160, expOriginal:   435, expAdjusted:   490 },
  'Housing Sector':          { revOriginal:  1075, revAdjusted:  1120, expOriginal:  2515, expAdjusted:  2820 },
  'Hafr Al-Batin Amanah':    { revOriginal:    90, revAdjusted:    90, expOriginal:   160, expAdjusted:   190 },
  '__HQ__':                  { revOriginal:     0, revAdjusted:     0, expOriginal:  4420, expAdjusted:  4860 },
};
export const appropriationOf = (key, year = APPROPRIATION_YEAR) => {
  const t = year === APPROPRIATION_YEAR ? TABLE[key] : null;
  return t ? { revOriginal: t.revOriginal * M, revAdjusted: t.revAdjusted * M, expOriginal: t.expOriginal * M, expAdjusted: t.expAdjusted * M } : null;
};
export const appropriationKeys = () => Object.keys(TABLE);
// Ministry total over the entities that are shown (all of them by default)
export function appropriationTotal(keys = appropriationKeys(), year = APPROPRIATION_YEAR) {
  const t = { revOriginal: 0, revAdjusted: 0, expOriginal: 0, expAdjusted: 0 }; let any = false;
  for (const k of keys) { const a = appropriationOf(k, year); if (a) { any = true; for (const f of Object.keys(t)) t[f] += a[f]; } }
  return any ? t : null;
}
