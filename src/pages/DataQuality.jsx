import React from 'react';
import { RecordLink as Link } from '../utils/returnContext';
import { useL } from '../utils/bi';
import { ScopeBar } from '../components/revenue/RevenueUI';
import IssueWorklist from '../components/revenue/IssueWorklist';
import SettingsNav from '../components/settings/SettingsNav';
import { QUALITY_CODES } from '../data/issueGroups';

// «جودة البيانات» (system settings) — record-level completeness and matching: what a data steward completes or matches so that figures can be relied on.
// Source-level status (freshness, versions, imports) is on «مصادر البيانات»; business risks and deviations are on «المخاطر والانحرافات».
export default function DataQuality() {
  const { L } = useL();
  return (
    <div className="rv-page">
      <SettingsNav current="/settings/data-quality" />
      <div className="page-head">
        <div>
          <h1 className="page-title">{L('Data quality', 'جودة البيانات')}</h1>
          <div className="page-sub">{L('Invoice records to complete or match: missing mandatory fields, contracts not linked or not matched, and links or exclusions still awaiting a decision. Source freshness and import status are under Data sources.', 'سجلات فواتير تحتاج استكمالاً أو مطابقة: حقول إلزامية ناقصة، عقود غير مرتبطة أو غير مطابقة، وروابط أو استبعادات تنتظر قراراً. حداثة المصادر وحالة الاستيراد في مصادر البيانات.')}</div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <Link className="btn btn-sm" to="/risk">{L('Risks & deviations', 'المخاطر والانحرافات')}</Link>
        </div>
      </div>

      <ScopeBar />

      <IssueWorklist
        memKey="dq"
        anomalyCodes={QUALITY_CODES}
        emptyText={{ en: 'No records need completing or matching in this scope.', ar: 'لا توجد سجلات تحتاج استكمالاً أو مطابقة في هذا النطاق.' }}
        tiles={({ counts, all, collectedFlagged, count, MetricTile }) => (
          <>
            <MetricTile label={L('Invoices to complete or match', 'فواتير تحتاج استكمالاً أو مطابقة')} value={count(all?.total ?? 0)} />
            <MetricTile label={L('Missing mandatory fields', 'حقول إلزامية ناقصة')} value={count(counts.missing_fields || 0)} tone={counts.missing_fields ? 'warn' : undefined} />
            <MetricTile label={L('Contract not linked or matched', 'عقد غير مرتبط أو غير مطابق')} value={count((counts.contract_unlinked || 0) + (counts.contract_unmatched || 0))} sub={L('Investment invoices; “not matched” stays in the base — it does not mean “no contract”', 'فواتير الاستثمار؛ «غير مطابق» تبقى في القاعدة — ولا تعني «بلا عقد»')} />
            <MetricTile label={L('Awaiting a decision', 'تنتظر قراراً')} value={count((counts.exclusion_pending || 0) + (counts.enforcement_candidate || 0))} sub={L('Exclusions and enforcement links — decided on their own screens', 'استبعادات وروابط إنفاذ — تُحسم في شاشاتها')} />
          </>
        )}
        footer={<p className="muted" style={{ fontSize: 12, marginTop: 10 }}>{L('Exclusions awaiting review are decided on the Noncollection screen and enforcement links on Enforcement management; they are counted here so that nothing is left unseen. A record finding is a reason to complete or check the record, never a reason to change an amount.', 'تُحسم الاستبعادات المعلّقة في شاشة عدم التحصيل وروابط الإنفاذ في إدارة التنفيذ؛ وتُعدّ هنا كي لا يُغفل شيء. نتيجة السجل سبب لاستكماله أو التحقق منه، وليست سبباً لتغيير مبلغ.')} <Link to="/noncollection">{L('Noncollection', 'عدم التحصيل')}</Link> · <Link to="/enforcement">{L('Enforcement management', 'إدارة التنفيذ')}</Link></p>}
      />
    </div>
  );
}
