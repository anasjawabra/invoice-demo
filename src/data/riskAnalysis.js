// Real, MoMAH-grounded risk categories — replacing the earlier generic
// "AI fraud" narrative (tariff deviation, first-time payer, invoice
// splitting) with the four categories confirmed against the Mini-BRD/raw
// meeting transcript: duplicate submissions, struck-off commercial
// registries, deceased debtors, and invoice-value outliers versus an
// Amanah's own historical pattern. Every flag here is derived live from
// INVOICES — nothing is hand-authored — so it can never drift out of sync
// with what the rest of the app shows for the same records.
import { INVOICES } from './mock';

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

function duplicateFlags(invoices) {
  return invoices
    .filter((inv) => inv.status === 'duplicate')
    .map((inv) => ({ invoice: inv, category: 'duplicate', score: 90 }));
}

function invalidDebtorFlags(invoices) {
  return invoices
    .filter((inv) => inv.debtorInvalid)
    .map((inv) => ({
      invoice: inv,
      category: inv.debtorInvalidReason === 'deceased_person' ? 'deceased_person' : 'struck_off_registry',
      score: 85
    }));
}

// Flags an invoice whose amount is far above the typical invoice for its OWN
// Amanah — computed against every other invoice in that same Amanah, so a
// province with naturally larger invoices doesn't get flagged just for being
// itself; only genuine outliers relative to their own peers are caught.
const VALUE_ANOMALY_MULTIPLIER = 1.8;
function valueAnomalyFlags(invoices, multiplier = VALUE_ANOMALY_MULTIPLIER) {
  const byAmanah = new Map();
  for (const inv of invoices) {
    if (!inv.amanahEn) continue;
    if (!byAmanah.has(inv.amanahEn)) byAmanah.set(inv.amanahEn, []);
    byAmanah.get(inv.amanahEn).push(inv);
  }
  const out = [];
  for (const list of byAmanah.values()) {
    if (list.length < 3) continue; // need enough peers for a meaningful baseline
    for (const inv of list) {
      const others = list.filter((x) => x.id !== inv.id);
      const avg = others.reduce((s, x) => s + x.amount, 0) / others.length;
      const ratio = avg > 0 ? inv.amount / avg : 0;
      if (ratio >= multiplier) {
        const score = Math.min(99, Math.round(60 + (ratio - multiplier) * 15));
        out.push({ invoice: inv, category: 'value_anomaly', score, amanahAvg: Math.round(avg), ratio: Math.round(ratio * 100) / 100 });
      }
    }
  }
  return out;
}

export function computeAllRiskFlags(invoices = INVOICES) {
  const flags = [...duplicateFlags(invoices), ...invalidDebtorFlags(invoices), ...valueAnomalyFlags(invoices)];
  return flags.sort((a, b) => b.score - a.score);
}

// Same shape as the old hand-authored `RISKS` array (id/entity*/score/types*)
// so callers like Assistant.jsx's live stats can swap the import with no
// other code changes, while the underlying flags are now real and derived.
export function computeGroupedRiskFlags(invoices = INVOICES) {
  const flags = computeAllRiskFlags(invoices);
  const map = new Map();
  for (const f of flags) {
    if (!map.has(f.invoice.id)) {
      const inv = f.invoice;
      map.set(f.invoice.id, {
        id: inv.id,
        entity: inv.entity,
        entityEn: inv.entityEn,
        entityAr: inv.entityAr,
        score: 0,
        types: [],
        typesEn: [],
        typesAr: []
      });
    }
    const g = map.get(f.invoice.id);
    g.score = Math.max(g.score, f.score);
    g.types.push(CATEGORY_LABELS[f.category].zh);
    g.typesEn.push(CATEGORY_LABELS[f.category].en);
    g.typesAr.push(CATEGORY_LABELS[f.category].ar);
  }
  return [...map.values()].sort((a, b) => b.score - a.score);
}
