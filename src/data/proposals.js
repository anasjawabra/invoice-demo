// Recommendations awaiting human review. They are computed from the active snapshot (cards of the shared layer + collection-gap insights);
// they are proposals, never decisions, and carry NO owner: a suggested unit is only a hint for the reviewer.
import { buildDecisionCards } from './revenueInsights';
import { buildInsights } from './insightsEngine';
import { fillTokens } from './reportFormat';

// Arabic-first (ar, en) — revenueInsights.bi is English-first, which swapped every language field here (F-09)
const bi = (ar, en) => ({ ar, en });

const prio = (score) => (score >= 0.6 ? 'high' : score >= 0.35 ? 'medium' : 'low');

export function buildProposals({ snapshot, prev = null, comparison = null, targets, cases = [], scopeText = '' }) {
  const out = []; const T = snapshot.totals;
  for (const c of buildDecisionCards(snapshot, { enforcementCases: cases, limit: 6 })) {
    out.push({
      id: `card:${c.id}`, title: c.title, issue: c.gap, action: c.action, priority: prio(c.score), score: c.score,
      evidence: { text: c.evidence, scope: scopeText, figures: [{ k: bi('المبلغ المعني', 'Amount concerned'), v: c.amount, fmt: 'money' }, { k: bi('عدد الفواتير', 'Invoices'), v: c.count, fmt: 'count' }, ...(c.maxDaysOverdue ? [{ k: bi('أقصى تأخر (يوم)', 'Max days overdue'), v: c.maxDaysOverdue, fmt: 'count' }] : [])] },
      expectedImpact: { amount: c.amount, kind: 'upper_bound', note: bi('سقف أعلى: ليس كل المبلغ قابلاً للتحصيل ولا يُحتسب كإيراد محقق.', 'An upper bound: not all of it is collectible and it is not counted as realised revenue.') },
      suggestedUnit: c.responsible, timeframe: c.timeframe, drill: c.drill ? { to: c.drill.to, label: bi('الفواتير ذات الصلة', 'Related invoices') } : null
    });
  }
  const res = buildInsights({ snapshot, prev, comparison, forecast: null, targets });
  for (const it of res.insights.filter((i) => i.id.startsWith('gap_'))) {
    out.push({
      id: `gap:${it.id}:${it.drill?.to || ''}`, title: it.title, issue: bi(fillTokens(it.body.ar, it.tokens, 'ar'), fillTokens(it.body.en, it.tokens, 'en')),
      action: bi('متابعة تحصيل هذه الخلية (أمانة × مصدر): مراجعة الفواتير المتأخرة والجزئية وتسجيل استجابة الدافع لكل فاتورة.', 'Follow up this cell (Amanah × source): review overdue and partial invoices and record the payer response on each.'),
      priority: it.severity === 'action' ? 'high' : 'medium', score: it.severity === 'action' ? 0.7 : 0.5,
      evidence: { text: it.basis, scope: scopeText, figures: it.evidence },
      expectedImpact: { amount: it.gapValue, kind: 'estimate', note: bi('تقدير مقابل مستهدف تجريبي غير معتمد.', 'An estimate against an unapproved demo target.') },
      suggestedUnit: bi('وحدة الإيرادات في الأمانة المعنية (مقترح)', 'The Amanah revenue unit concerned (proposed)'), timeframe: bi('خلال 30 يوماً (مقترح)', 'Within 30 days (proposed)'), drill: it.drill
    });
  }
  if (T.net <= 0) return [];
  return out.sort((a, b) => b.score - a.score).slice(0, 8);
}
