// Real, MoMAH-grounded risk categories — replacing the earlier generic
// "AI fraud" narrative (tariff deviation, first-time payer, invoice
// splitting) with the four categories confirmed against the Mini-BRD/raw
// meeting transcript: duplicate submissions, struck-off commercial
// registries, deceased debtors, and invoice-value outliers versus an
// Amanah's own historical pattern. Flags are derived by the data service from
// the invoices — nothing is hand-authored — so they cannot drift out of sync
// with what the rest of the app shows for the same records.

export const RISK_CATEGORIES = ['duplicate', 'struck_off_registry', 'deceased_person', 'value_anomaly'];

// Single source of truth for category copy/color, shared by Risk.jsx and the
// Assistant's live stats — so a category renamed here never drifts out of
// sync between the two surfaces.
export const CATEGORY_LABELS = {
  duplicate: { en: 'Duplicate Submission', ar: 'فاتورة مكررة', zh: '重复提交' },
  struck_off_registry: { en: 'Struck-off Commercial Registry', ar: 'سجل تجاري مشطوب', zh: '已注销的商业登记' },
  deceased_person: { en: 'Deceased Debtor', ar: 'مدين متوفى', zh: '债务人已故' },
  value_anomaly: { en: 'Value Anomaly vs. Amanah Baseline', ar: 'انحراف القيمة عن معدل الأمانة', zh: '金额相对市政厅基准异常' }
};
export const CATEGORY_COLOR = { duplicate: 'red', struck_off_registry: 'gold', deceased_person: 'orange', value_anomaly: 'purple' };

// The flags themselves (rules over the whole population) are computed by the data service: POST /api/risk (server/lists.js).
