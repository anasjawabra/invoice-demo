import dictionary from '../data/zh-CN.json';

// Authored display text only. Keys, records and numeric values are never mutated.
const exact = new Map(Object.entries(dictionary));
const folded = new Map(Object.entries(dictionary).map(([en, zh]) => [en.toLowerCase(), zh]));
const escape = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const templates = Object.entries(dictionary).filter(([en]) => /\{\d+\}/.test(en)).sort((a, b) => b[0].replace(/\{\d+\}/g, '').length - a[0].replace(/\{\d+\}/g, '').length).map(([en, zh]) => {
  const keys = [...en.matchAll(/\{(\d+)\}/g)].map(m => m[1]);
  const pieces = en.split(/\{\d+\}/);
  const expression = pieces.map(escape).join('([\\s\\S]*?)');
  return { pattern: new RegExp(`^${expression}$`), pieces, keys, zh };
});
const cache = new Map();
export function zhText(value, depth = 0) {
  if (typeof value !== 'string' || !value || !/[A-Za-z]/.test(value)) return value;
  if (exact.has(value)) return exact.get(value);
  if (folded.has(value.toLowerCase())) return folded.get(value.toLowerCase());
  if (depth === 0 && cache.has(value)) return cache.get(value);
  const trimmed = value.trim();
  if (trimmed !== value && exact.has(trimmed)) return value.replace(trimmed, exact.get(trimmed));
  if (depth >= 4) return value;
  for (const { pattern, pieces, keys, zh } of templates) {
    // Reject unrelated templates by ordered literals before attempting captures.
    // This also bounds backtracking for adjacent dynamic values in long reports.
    if (pieces[0] && !value.startsWith(pieces[0])) continue;
    if (pieces.at(-1) && !value.endsWith(pieces.at(-1))) continue;
    let cursor = 0, possible = true;
    for (const piece of pieces) {
      if (!piece) continue;
      const found = value.indexOf(piece, cursor);
      if (found < 0) { possible = false; break; }
      cursor = found + piece.length;
    }
    if (!possible) continue;
    const match = pattern.exec(value);
    if (!match) continue;
    const tokens = Object.fromEntries(keys.map((k, i) => [k, match[i + 1].length < value.length ? zhText(match[i + 1], depth + 1) : match[i + 1]]));
    const result = zh.replace(/\{(\d+)\}/g, (_, key) => tokens[key] ?? `{${key}}`);
    if (cache.size > 2000) cache.clear();
    if (depth === 0) cache.set(value, result);
    return result;
  }
  const months = { Jan: 1, Feb: 2, Mar: 3, Apr: 4, May: 5, Jun: 6, Jul: 7, Aug: 8, Sep: 9, Oct: 10, Nov: 11, Dec: 12 };
  return value.replace(/\b(\d{1,2}) (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)(?: (\d{4}))?\b/g, (_, d, m, y) => `${y ? `${y}年` : ''}${months[m]}月${d}日`).replace(/\b(bn|M|K) SAR\b/g, (_, u) => `${{ bn: '十亿', M: '百万', K: '千' }[u]} 沙特里亚尔`).replace(/\bSAR\b/g, '沙特里亚尔').replace(/\bpp\b/g, '个百分点');
}
export const localize = (value, lang) => lang === 'zh' || lang === 'zh-CN' ? Array.isArray(value) ? value.map(v => zhText(v)) : zhText(value) : value;
export const localizedObject = (value, lang) => value == null ? '' : typeof value === 'string' ? localize(value, lang) : lang === 'zh' ? (value.zh || zhText(value.en || '')) : (lang === 'ar' ? value.ar : value.en) || value.en || '';
