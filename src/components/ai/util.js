// Shared helper: pick a localized string from a { zh, en, ar } object.
// Falls back gracefully. Also accepts a plain string (returned as-is).
export function L(obj, lang) {
  if (obj == null) return '';
  if (typeof obj === 'string') return obj;
  return obj[lang] ?? obj.en ?? obj.zh ?? '';
}

// Map a 0-100 score to a confidence-bar modifier class.
export function confTone(v) {
  if (v >= 75) return '';
  if (v >= 50) return 'conf-bar__fill--warn';
  return 'conf-bar__fill--danger';
}
