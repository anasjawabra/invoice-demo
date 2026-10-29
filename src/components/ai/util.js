// Shared helper: pick a localized string from a { zh, en, ar } object.
// Falls back gracefully. Also accepts a plain string (returned as-is).
export function L(obj, lang) {
  if (obj == null) return '';
  if (typeof obj === 'string') return obj;
  return obj[lang] ?? obj.en ?? obj.zh ?? '';
}

// Map a 0-100 score to a gauge color. Direction depends on what the number
// means: a "confidence" score is good when high (green); a "risk" score is
// good when LOW (green) and bad when high (red) — same tiers Risk Radar uses.
export function confTone(v) {
  if (v >= 75) return 'var(--primary)';
  if (v >= 50) return '#C88700';
  return 'var(--danger)';
}

export function riskTone(v) {
  if (v >= 80) return 'var(--danger)';
  if (v >= 60) return '#C88700';
  if (v >= 40) return 'var(--warning)';
  return 'var(--success)';
}
