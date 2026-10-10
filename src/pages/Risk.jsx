import React from 'react';
import { RecordLink as Link } from '../utils/returnContext';
import { useL } from '../utils/bi';
import { ScopeBar } from '../components/revenue/RevenueUI';
import IssueWorklist from '../components/revenue/IssueWorklist';
import { CATEGORY_LABELS as RISK_LABELS } from '../data/riskAnalysis';
import { DEVIATION_CODES, DEVIATION_RISK_CATEGORIES, RISK_FLAG_CATEGORIES } from '../data/issueGroups';

const ANOMALY = DEVIATION_CODES;
const RADAR = [...RISK_FLAG_CATEGORIES, ...DEVIATION_RISK_CATEGORIES];

// «المخاطر والانحرافات» — a daily operational page: findings that need a BUSINESS look or decision.
//  Risks: a possible duplicate, a struck-off registry, a deceased debtor.  Deviations: a value far from the Amanah baseline, an amount that differs from its line items, a payment on an excluded invoice.
// Record completeness and matching (missing fields, unlinked contracts…) is DATA QUALITY and lives under system settings. This page is also not the collection worklist.
export default function Risk() {
  const { L, ar } = useL();
  const sum = (o, keys) => keys.reduce((s, k) => s + (o[k] || 0), 0);
  return (
    <div className="rv-page">
      <div className="page-head">
        <div>
          <h1 className="page-title">{L('Risks & deviations', 'المخاطر والانحرافات')}</h1>
          <div className="page-sub">{L('Invoices that need a business look before figures or actions rely on them: risks (a possible duplicate, a struck-off registry, a deceased debtor) and deviations (a value far from the Amanah baseline, an amount that differs from its line items, a payment on an excluded invoice). Not a collection list: collected invoices may appear here but are labelled.', 'فواتير تحتاج نظراً من الأعمال قبل الاعتماد عليها في الأرقام أو الإجراءات: مخاطر (تكرار محتمل، سجل مشطوب، مدين متوفى) وانحرافات (قيمة بعيدة عن معدل الأمانة، مبلغ يختلف عن بنوده، دفعة على فاتورة مستبعدة). ليست قائمة تحصيل: قد تظهر فواتير محصّلة لكنها موسومة.')}</div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <Link className="btn btn-sm" to="/collection">{L('Collection worklist', 'قائمة التحصيل')}</Link>
          <Link className="btn btn-sm" to="/settings/data-quality">{L('Data quality (system settings)', 'جودة البيانات (إعدادات النظام)')}</Link>
        </div>
      </div>

      <ScopeBar />

      <IssueWorklist
        memKey="risk"
        anomalyCodes={ANOMALY}
        riskCats={RADAR}
        emptyText={{ en: 'No risks or deviations in this scope.', ar: 'لا توجد مخاطر أو انحرافات في هذا النطاق.' }}
        tiles={({ counts, radarCounts, collectedFlagged, count, MetricTile }) => {
          const risks = sum(radarCounts, RISK_FLAG_CATEGORIES.map((c) => `risk_${c}`));
          const devs = sum(radarCounts, DEVIATION_RISK_CATEGORIES.map((c) => `risk_${c}`)) + sum(counts, ANOMALY);
          return (
            <>
              <MetricTile label={L('Risk flags', 'تنبيهات المخاطر')} value={count(risks)} sub={RISK_FLAG_CATEGORIES.map((c) => `${ar ? RISK_LABELS[c].ar : RISK_LABELS[c].en}: ${count(radarCounts[`risk_${c}`] || 0)}`).join(' · ')} />
              <MetricTile label={L('Deviations', 'الانحرافات')} value={count(devs)} sub={L('Counted per finding: an invoice can carry several', 'تُعدّ لكل نتيجة: قد تحمل الفاتورة أكثر من واحدة')} />
              <MetricTile label={L('Amount conflicts', 'تعارضات المبالغ')} value={count(counts.amount_conflict || 0)} tone={counts.amount_conflict ? 'bad' : undefined} sub={L('Header vs line items; never silently corrected', 'الرأس مقابل البنود؛ لا تُصحَّح بصمت')} />
              <MetricTile label={L('Collected but flagged', 'محصّلة لكن موسومة')} value={count(collectedFlagged)} sub={L('Review only — not unpaid priorities', 'للمراجعة فقط — وليست أولويات تحصيل')} />
            </>
          );
        }}
        footer={<p className="muted" style={{ fontSize: 12, marginTop: 10 }}>{L('A flag is a rule-based signal (duplicate match, registry/debtor status, value versus the Amanah baseline) — a reason to look, not a conclusion about the payer. An approved exclusion is a separate human decision made on the Noncollection screen. Records that need completing or matching (missing fields, unlinked contracts) are listed under System settings → Data quality.', 'التنبيه إشارة قائمة على قواعد (تطابق تكرار، حالة السجل/المدين، القيمة مقابل معدل الأمانة) — سبب للمراجعة وليس حكماً على الدافع. والاستبعاد المعتمد قرار بشري منفصل يُتخذ في شاشة عدم التحصيل. أما السجلات التي تحتاج استكمالاً أو مطابقة (حقول ناقصة، عقود غير مرتبطة) فتجدها في إعدادات النظام ← جودة البيانات.')}</p>}
      />
    </div>
  );
}
